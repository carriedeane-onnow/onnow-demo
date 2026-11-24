/*
 * OnNow — Service Analysis tab
 * ----------------------------
 * A separate add-on to the approved Explore Activities dashboard. It reads the
 * same fictional dataset (window.ONNOW_SAMPLE_DATA) and does not change any
 * Explore Activities code or state.
 *
 * Shows, for a council area or one suburb:
 *   - a summary (occurrences, organisations, peaks, overlap periods)
 *   - Where Activities Overlap (same suburb and council-wide)
 *   - a concentration map (Leaflet circles, no plugins)
 *   - a daily timeline
 *   - Where Activity Is Not Recorded (8 am – 8 pm window)
 *   - delivery location versus organisation service areas
 *
 * All figures are calculated here from the data. Nothing is hardcoded.
 */
(() => {
  'use strict';

  const DATA = window.ONNOW_SAMPLE_DATA;
  if (!DATA) return;
  const { meta, lookups, organisations, activities } = DATA;
  const DEMO_DATE = meta.demoReferenceDate;
  const orgById = new Map(organisations.map((o) => [o.organisationId, o]));
  const CATEGORY_IDS = Object.keys(lookups.categories);
  const programById = new Map((DATA.programs || []).map((p) => [p.programId, p]));
  const siteById = new Map((DATA.sites || []).map((s) => [s.siteId, s]));

  // Food relief and community meals are treated as "similar" food services.
  // Every other category is only similar to itself.
  const FOOD_GROUP = 'group:food';
  const SIMILAR_GROUP = { food_relief: 'food', community_meals: 'food' };
  const groupOf = (cat) => SIMILAR_GROUP[cat] || cat;
  function inCategory(cat, sel) {
    if (sel === 'all') return true;
    if (sel === FOOD_GROUP) return groupOf(cat) === 'food';
    return cat === sel;
  }

  /* ------------------------------------------------------------------ */
  /* Council areas and explicit suburb → council mapping                 */
  /* ------------------------------------------------------------------ */

  const COUNCILS = {
    Blacktown: { name: 'Blacktown City Council', center: [-33.765, 150.875] },
    Parramatta: { name: 'City of Parramatta Council', center: [-33.812, 151.01] }
  };

  // Explicit list. Councils are never guessed from distance.
  //   whole      = suburb lies within one council
  //   split      = suburb is divided between councils (note explains)
  //   unverified = assumed in this demo, boundary not independently checked
  // For split or unverified suburbs, each activity is assigned using the
  // council recorded on the activity itself (its `lga` field), which in this
  // fictional demonstration is an approximate, point-level assignment.
  const SUBURB_COUNCIL = {
    'Bidwill':          { council: 'Blacktown', boundary: 'whole' },
    'Blacktown':        { council: 'Blacktown', boundary: 'whole' },
    'Doonside':         { council: 'Blacktown', boundary: 'whole' },
    'Lalor Park':       { council: 'Blacktown', boundary: 'whole' },
    'Mount Druitt':     { council: 'Blacktown', boundary: 'whole' },
    'Plumpton':         { council: 'Blacktown', boundary: 'whole' },
    'Quakers Hill':     { council: 'Blacktown', boundary: 'whole' },
    'Rooty Hill':       { council: 'Blacktown', boundary: 'whole' },
    'Whalan':           { council: 'Blacktown', boundary: 'whole' },
    'Seven Hills':      { council: 'Blacktown', boundary: 'split', note: 'Seven Hills is split between councils: most of it is in Blacktown City, with a small area along Toongabbie Creek in the City of Parramatta. Activities are assigned using the council recorded on each (fictional) activity location.' },
    'Ermington':        { council: 'Parramatta', boundary: 'whole' },
    'Harris Park':      { council: 'Parramatta', boundary: 'whole' },
    'Northmead':        { council: 'Parramatta', boundary: 'whole' },
    'Parramatta':       { council: 'Parramatta', boundary: 'whole' },
    'Rydalmere':        { council: 'Parramatta', boundary: 'whole' },
    'Westmead':         { council: 'Parramatta', boundary: 'split', note: 'Westmead is split between councils: north of the Main Western railway line is in the City of Parramatta; the south is in Cumberland City Council. Activities are assigned using the council recorded on each (fictional) activity location.' },
    'North Parramatta': { council: 'Parramatta', boundary: 'unverified', note: 'Treated as City of Parramatta in this demonstration. This boundary has not been independently verified.' },
    'Rosehill':         { council: 'Parramatta', boundary: 'unverified', note: 'Treated as City of Parramatta in this demonstration. This boundary has not been independently verified.' }
  };

  // Council where an activity is physically delivered.
  function councilOf(a) {
    if (a.lga && COUNCILS[a.lga]) return a.lga;
    const m = SUBURB_COUNCIL[a.suburb];
    return m && m.boundary === 'whole' ? m.council : null;
  }

  function suburbsInCouncil(council) {
    const set = new Set(Object.keys(SUBURB_COUNCIL).filter((s) => SUBURB_COUNCIL[s].council === council));
    activities.forEach((a) => { if (councilOf(a) === council) set.add(a.suburb); }); // split suburbs recorded here
    return [...set].sort();
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const parseISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const toISO = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const fmtDay = (iso) => new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }).format(parseISO(iso));
  const fmtDayLong = (iso) => new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseISO(iso));

  function fmtMin(min) {
    if (min === 0 || min === 1440) return 'midnight';
    if (min === 720) return '12pm';
    const h = Math.floor(min / 60), m = min % 60;
    const suffix = h >= 12 ? 'pm' : 'am';
    const h12 = ((h + 11) % 12) + 1;
    return m ? `${h12}:${String(m).padStart(2, '0')}${suffix}` : `${h12}${suffix}`;
  }
  const fmtRange = (s, e) => `${fmtMin(s)} – ${fmtMin(e)}`;

  // 'HH:MM' → minutes after midnight, or null if missing/invalid. '24:00' allowed as end of day.
  function toMin(t) {
    if (typeof t !== 'string') return null;
    const m = /^(\d{2}):(\d{2})$/.exec(t.trim());
    if (!m) return null;
    const h = Number(m[1]), mi = Number(m[2]);
    if (mi > 59) return null;
    if (h === 24 && mi === 0) return 1440;
    if (h > 23) return null;
    return h * 60 + mi;
  }

  function validDate(d) {
    if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    const [y, m, dd] = d.split('-').map(Number);
    const dt = new Date(y, m - 1, dd);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === dd;
  }

  const isCancelled = (a) => a.cancelled === true || String(a.occurrenceStatus || '').toLowerCase() === 'cancelled';

  function groupBy(list, keyFn) {
    const map = new Map();
    list.forEach((x) => { const k = keyFn(x); if (!map.has(k)) map.set(k, []); map.get(k).push(x); });
    return map;
  }

  const orgName = (id) => (orgById.get(id) || {}).organisationName || 'Unknown organisation';
  const catLabel = (id) => (id === FOOD_GROUP ? 'Food services (food relief and community meals)' : (lookups.categories[id] || { label: id }).label);
  const statusBadge = (id) => {
    const st = lookups.verificationStatuses[id];
    return st ? `<span class="status status--${esc(id)}">${esc(st.shortLabel)}</span>` : '<span class="status status--unverified">Unknown status</span>';
  };
  const catChip = (id) => {
    const c = lookups.categories[id];
    return `<span class="cat-chip" style="--chip:${c ? c.color : '#555'}">${esc(catLabel(id))}</span>`;
  };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const siteLabel = (a) => {
    const s = siteById.get(a.siteId);
    return s && s.siteType !== 'recorded_location' ? `${s.siteName}, ${a.suburb}` : a.suburb;
  };

  /* ------------------------------------------------------------------ */
  /* Core calculations (pure functions, exposed for testing)              */
  /* ------------------------------------------------------------------ */

  // Each activity record in the dataset is already one dated occurrence
  // (there are no recurrence rules to expand). This turns records into
  // time segments, de-duplicates by activityId, removes cancelled
  // occurrences and sets aside anything with an unknown schedule.
  function buildOccurrences(list) {
    const seen = new Set();
    const segments = [];
    const unknown = [];
    const cancelled = [];
    list.forEach((a) => {
      if (!a || !a.activityId || seen.has(a.activityId)) return;
      seen.add(a.activityId);
      if (isCancelled(a)) { cancelled.push(a); return; }
      const s = toMin(a.startTime);
      const f = toMin(a.finishTime);
      if (!validDate(a.date)) { unknown.push({ a, reason: 'Date missing or invalid' }); return; }
      if (s === null || f === null) { unknown.push({ a, reason: 'Start or finish time missing or invalid' }); return; }
      if (s === f || s === 1440) { unknown.push({ a, reason: 'Start and finish times do not describe a valid period' }); return; }
      if (f > s) {
        segments.push({ a, date: a.date, start: s, end: f });
      } else {
        // Finish earlier than start: runs past midnight into the next day.
        segments.push({ a, date: a.date, start: s, end: 1440, overnight: true });
        if (f > 0) segments.push({ a, date: addDays(a.date, 1), start: 0, end: f, overnight: true });
      }
    });
    return { segments, unknown, cancelled };
  }

  // Sweep one day's segments. Returns consecutive intervals where the set of
  // scheduled activities stays the same. An activity that finishes exactly
  // when another starts is never counted as overlapping it.
  function sweep(segs) {
    const points = [...new Set(segs.flatMap((s) => [s.start, s.end]))].sort((x, y) => x - y);
    const out = [];
    for (let i = 0; i < points.length - 1; i++) {
      const t0 = points[i], t1 = points[i + 1];
      if (t1 <= t0) continue;
      const byId = new Map();
      segs.forEach((s) => { if (s.start <= t0 && s.end >= t1) byId.set(s.a.activityId, s); });
      if (!byId.size) continue;
      const key = [...byId.keys()].sort().join('|');
      const prev = out[out.length - 1];
      if (prev && prev.end === t0 && prev.key === key) prev.end = t1;
      else out.push({ start: t0, end: t1, key, items: [...byId.values()] });
    }
    return out;
  }

  function intervalsByDay(segs, extra) {
    const out = [];
    groupBy(segs, (s) => s.date).forEach((daySegs, date) => {
      sweep(daySegs).forEach((iv) => out.push(Object.assign({ date }, extra, iv)));
    });
    return out;
  }

  const byRank = (x, y) => (y.items.length - x.items.length)
    || ((y.end - y.start) - (x.end - x.start))
    || x.date.localeCompare(y.date)
    || (x.start - y.start);
  const byTime = (x, y) => x.date.localeCompare(y.date) || (x.start - y.start);

  function peakOf(intervals) {
    let best = null;
    intervals.slice().sort(byTime).forEach((iv) => { if (!best || iv.items.length > best.items.length) best = iv; });
    return best;
  }

  // Full analysis for one geography, category and date range.
  function analyse(list, opt) {
    const geo = (a) => councilOf(a) === opt.council && (opt.suburb === 'all' || a.suburb === opt.suburb);
    const cat = (a) => inCategory(a.category, opt.category);
    const inRange = (d) => d >= opt.from && d <= opt.to;

    const scoped = list.filter((a) => geo(a) && cat(a));
    const built = buildOccurrences(scoped);
    const segs = built.segments.filter((s) => inRange(s.date));
    const unknown = built.unknown.filter((u) => !validDate(u.a.date) || inRange(u.a.date));
    const cancelled = built.cancelled.filter((a) => validDate(a.date) && inRange(a.date));

    const occurrenceIds = new Set(segs.map((s) => s.a.activityId));
    const orgIds = new Set(segs.map((s) => s.a.organisationId));
    const programIds = new Set(segs.map((s) => s.a.programId || s.a.activityId));

    // Area-wide intervals (whole council, or the one selected suburb).
    const areaIntervals = intervalsByDay(segs, {});
    // Per-suburb intervals.
    const suburbIntervals = [];
    groupBy(segs, (s) => s.a.suburb).forEach((ss, suburb) => {
      intervalsByDay(ss, { suburb }).forEach((iv) => suburbIntervals.push(iv));
    });

    const sameSuburb = suburbIntervals
      .filter((iv) => iv.items.length >= 2)
      .map((iv) => Object.assign(iv, { type: 'suburb' }))
      .sort(byRank);

    const councilWide = opt.suburb !== 'all' ? [] : areaIntervals
      .filter((iv) => iv.items.length >= 2 && new Set(iv.items.map((s) => s.a.suburb)).size >= 2)
      .map((iv) => Object.assign({}, iv, { type: 'council', suburbs: [...new Set(iv.items.map((s) => s.a.suburb))].sort() }))
      .sort(byRank);

    return {
      opt, segs, unknown, cancelled,
      occurrences: occurrenceIds.size,
      organisations: orgIds.size,
      programs: programIds.size,
      areaPeak: peakOf(areaIntervals),
      suburbPeak: peakOf(suburbIntervals),
      sameSuburb,
      councilWide
    };
  }

  // Number of scheduled occurrences per place for the concentration map.
  function concentration(segs, mode, day, winStart, winEnd, groupKey) {
    const chosen = segs.filter((s) => {
      if (mode === 'range') return true;
      if (s.date !== day) return false;
      if (mode === 'window') return s.start < winEnd && s.end > winStart; // positive-duration overlap with window
      return true;
    });
    const groups = new Map();
    chosen.forEach((s) => {
      const k = groupKey(s.a);
      if (!groups.has(k)) groups.set(k, new Map());
      groups.get(k).set(s.a.activityId, s); // one count per occurrence
    });
    return [...groups.entries()].map(([key, m]) => {
      const items = [...m.values()];
      const lat = items.reduce((t, s) => t + s.a.location.latitude, 0) / items.length;
      const lng = items.reduce((t, s) => t + s.a.location.longitude, 0) / items.length;
      return { key, count: items.length, lat, lng, items: items.sort(byTime) };
    }).sort((x, y) => y.count - x.count);
  }

  // Uncovered periods inside the daily window for one day.
  function gapsForDay(daySegs, winStart, winEnd) {
    const covered = daySegs
      .map((s) => [Math.max(s.start, winStart), Math.min(s.end, winEnd)])
      .filter(([s, e]) => e > s)
      .sort((x, y) => x[0] - y[0]);
    const merged = [];
    covered.forEach(([s, e]) => {
      const last = merged[merged.length - 1];
      if (last && s <= last[1]) last[1] = Math.max(last[1], e);
      else merged.push([s, e]);
    });
    const gaps = [];
    let cursor = winStart;
    merged.forEach(([s, e]) => { if (s > cursor) gaps.push([cursor, s]); cursor = Math.max(cursor, e); });
    if (cursor < winEnd) gaps.push([cursor, winEnd]);
    return { covered: merged, gaps };
  }

  /* ---------- Potential collaboration opportunities ---------- */

  // Straight-line distance used for the illustrative "nearby" rule.
  const NEAR_METRES = 500;
  function distanceM(p, q) {
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(q.latitude - p.latitude);
    const dLng = toRad(q.longitude - p.longitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(p.latitude)) * Math.cos(toRad(q.latitude)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(h));
  }

  // Transparent matching rules (see the note shown in the interface):
  //  A similar     - same suburb, same service group, 2+ different organisations,
  //                  operating times intersect on the same date.
  //  B colocated   - a visiting program recorded at a fixed site, with hours
  //                  overlapping a different kind of service run by the host.
  //  C partnership - a mobile program stops within 500 m of a fixed site that
  //                  does not record that kind of service; no shared arrangement.
  //  D gap         - a category with no recorded sessions in the council for the
  //                  period (compared with the other council).
  function collaborations(list, opt) {
    const inRange = (d) => d >= opt.from && d <= opt.to;
    const inSuburb = (sub) => opt.suburb === 'all' || sub === opt.suburb;
    const built = buildOccurrences(list.filter((a) => councilOf(a) === opt.council));
    const segs = built.segments.filter((s) => inRange(s.date));
    const fixedSites = (DATA.sites || []).filter((s) => s.siteType === 'fixed' && s.lga === opt.council);
    const out = { similar: [], colocated: [], partnership: [], gaps: [] };

    // A. Similar services overlapping in the same suburb.
    const agg = new Map();
    const pid = (s) => s.a.programId || s.a.activityId;
    groupBy(segs, (s) => s.a.suburb).forEach((subSegs, suburb) => {
      if (!inSuburb(suburb)) return;
      groupBy(subSegs, (s) => groupOf(s.a.category)).forEach((gSegs) => {
        const ivs = intervalsByDay(gSegs, { suburb });
        ivs.forEach((iv) => {
          const orgs = new Set(iv.items.map((s) => s.a.organisationId));
          if (orgs.size < 2 || !iv.items.some((s) => inCategory(s.a.category, opt.category))) return;
          const progIds = [...new Set(iv.items.map(pid))].sort();
          const key = `${suburb}|${progIds.join(',')}`;
          if (!agg.has(key)) agg.set(key, { type: 'similar', key, suburb, orgCount: orgs.size, items: iv.items, progIds, dates: new Map(), ivs });
        });
      });
    });
    // A combination overlaps on every date where all its programs run at the
    // same time, even if another service is also running then.
    agg.forEach((e) => {
      e.ivs.forEach((iv) => {
        const here = new Set(iv.items.map(pid));
        if (!e.progIds.every((p) => here.has(p))) return;
        const prev = e.dates.get(iv.date);
        if (!prev) { e.dates.set(iv.date, { start: iv.start, end: iv.end }); return; }
        // Contiguous intervals on the same date extend the overlap window.
        if (iv.start <= prev.end && iv.end >= prev.start) e.dates.set(iv.date, { start: Math.min(prev.start, iv.start), end: Math.max(prev.end, iv.end) });
      });
      delete e.ivs;
    });
    // Avoid near-duplicate suggestions: drop a combination when a larger
    // combination in the same suburb already covers all of its dates.
    const entries = [...agg.values()];
    out.similar = entries.filter((e) => !entries.some((o) => o !== e && o.suburb === e.suburb
        && o.progIds.length > e.progIds.length
        && e.progIds.every((p) => o.progIds.includes(p))
        && [...e.dates.keys()].every((d) => o.dates.has(d))))
      .sort((x, y) => (y.orgCount - x.orgCount) || (y.dates.size - x.dates.size));

    // B. Complementary services already recorded at the same site and time.
    fixedSites.filter((site) => inSuburb(site.suburb)).forEach((site) => {
      const atSite = segs.filter((s) => s.a.siteId === site.siteId);
      const hostSegs = atSite.filter((s) => s.a.organisationId === site.hostOrganisationId);
      groupBy(atSite.filter((s) => s.a.organisationId !== site.hostOrganisationId), (s) => s.a.programId).forEach((vSegs) => {
        const dates = new Map();
        vSegs.forEach((v) => {
          const host = hostSegs.filter((h) => h.date === v.date && h.start < v.end && h.end > v.start && groupOf(h.a.category) !== groupOf(v.a.category));
          if (host.length) dates.set(v.date, { v, host });
        });
        if (!dates.size) return;
        const cats = [vSegs[0].a.category, ...hostSegs.map((h) => h.a.category)];
        if (!cats.some((c) => inCategory(c, opt.category))) return;
        out.colocated.push({ type: 'colocated', key: `${site.siteId}|${vSegs[0].a.programId}`, site, visitor: vSegs[0].a, dates, hostSegs });
      });
    });

    // C. Nearby mobile services a fixed site does not currently record.
    const mobilePrograms = (DATA.programs || []).filter((p) => p.deliveryMode === 'mobile');
    fixedSites.forEach((site) => {
      const siteSegs = segs.filter((s) => s.a.siteId === site.siteId);
      const siteGroups = new Set(siteSegs.map((s) => groupOf(s.a.category)));
      mobilePrograms.forEach((p) => {
        if (p.organisationId === site.hostOrganisationId || siteGroups.has(groupOf(p.category))) return;
        const pSegs = segs.filter((s) => s.a.programId === p.programId);
        if (!pSegs.length || pSegs.some((s) => s.a.siteId === site.siteId)) return;
        const near = pSegs.filter((s) => distanceM(s.a.location, site.location) <= NEAR_METRES);
        if (!near.length) return;
        if (!inSuburb(site.suburb) && !near.some((s) => inSuburb(s.a.suburb))) return;
        if (!inCategory(p.category, opt.category) && !siteSegs.some((s) => inCategory(s.a.category, opt.category))) return;
        out.partnership.push({
          type: 'partnership', key: `${site.siteId}|${p.programId}`, site, program: p, near, siteSegs,
          distance: Math.round(Math.min(...near.map((s) => distanceM(s.a.location, site.location))))
        });
      });
    });

    // D. Categories with no recorded sessions in this council for the period.
    const here = new Set(segs.map((s) => s.a.category));
    const otherCouncils = Object.keys(COUNCILS).filter((c) => c !== opt.council);
    const otherSegs = buildOccurrences(list.filter((a) => otherCouncils.includes(councilOf(a)))).segments.filter((s) => inRange(s.date));
    const unknownHere = built.unknown.filter((u) => !validDate(u.a.date) || inRange(u.a.date));
    const councilSuburbs = new Set(suburbsInCouncil(opt.council));
    CATEGORY_IDS.filter((c) => inCategory(c, opt.category)).forEach((cat) => {
      if (here.has(cat)) return;
      const elsewhere = otherSegs.filter((s) => s.a.category === cat);
      if (!elsewhere.length && opt.category === 'all') return;
      const providers = [...new Set(elsewhere.map((s) => s.a.organisationId))].map((id) => orgById.get(id)).filter(Boolean);
      out.gaps.push({
        type: 'gap', key: cat, category: cat, elsewhere, providers,
        servesHere: providers.filter((o) => (o.areasServed || []).some((s) => councilSuburbs.has(s))),
        hubs: fixedSites,
        unknown: unknownHere.filter((u) => u.a.category === cat).length
      });
    });
    return out;
  }

  window.OnNowAnalysis = { buildOccurrences, sweep, analyse, concentration, gapsForDay, collaborations, distanceM, councilOf, SUBURB_COUNCIL, toMin };

  /* ------------------------------------------------------------------ */
  /* Interface state                                                     */
  /* ------------------------------------------------------------------ */

  const RANGE_DAYS = 14;
  const GAP_WINDOW = [8 * 60, 20 * 60]; // 8 am – 8 pm
  const LIST_LIMIT = 8;

  const defaults = () => ({
    council: 'Blacktown',
    suburb: 'all',
    category: 'all',
    period: String(RANGE_DAYS),
    from: DEMO_DATE,
    to: addDays(DEMO_DATE, RANGE_DAYS - 1),
    day: DEMO_DATE,
    collabShowAll: {},
    overlapMode: 'suburb',
    showAll: false,
    expanded: null,
    mapScope: 'range',
    winStart: 15 * 60,
    winEnd: 17 * 60
  });
  let state = defaults();
  let result = null;

  const $ = (id) => document.getElementById(id);
  const el = {
    section: $('service-analysis'),
    council: $('sa-council'),
    suburb: $('sa-suburb'),
    category: $('sa-category'),
    period: $('sa-period'),
    collab: $('sa-collab'),
    from: $('sa-from'),
    to: $('sa-to'),
    day: $('sa-day'),
    reset: $('sa-reset'),
    scope: $('sa-scope'),
    summary: $('sa-summary'),
    overlaps: $('sa-overlaps'),
    mapControls: $('sa-map-controls'),
    map: $('sa-map'),
    mapNote: $('sa-map-note'),
    timeline: $('sa-timeline'),
    prevDay: $('sa-prev-day'),
    nextDay: $('sa-next-day'),
    gaps: $('sa-gaps'),
    catchment: $('sa-catchment')
  };
  if (!el.section) return;

  const daysInRange = () => {
    const out = [];
    for (let d = state.from; d <= state.to && out.length < 366; d = addDays(d, 1)) out.push(d);
    return out;
  };
  const scopeName = () => (state.suburb === 'all' ? COUNCILS[state.council].name : `${state.suburb} (${COUNCILS[state.council].name})`);

  /* ------------------------------------------------------------------ */
  /* Controls                                                            */
  /* ------------------------------------------------------------------ */

  function buildControls() {
    el.council.innerHTML = Object.keys(COUNCILS).map((k) => `<option value="${k}">${esc(COUNCILS[k].name)}</option>`).join('');
    el.category.innerHTML = '<option value="all">All service categories</option>'
      + `<option value="${FOOD_GROUP}">${esc(catLabel(FOOD_GROUP))}</option>`
      + CATEGORY_IDS.map((id) => `<option value="${id}">${esc(catLabel(id))}</option>`).join('');
  }

  function syncControls() {
    el.council.value = state.council;
    el.suburb.innerHTML = '<option value="all">All suburbs in this council</option>'
      + suburbsInCouncil(state.council).map((s) => {
        const m = SUBURB_COUNCIL[s];
        const tag = m && m.boundary === 'split' ? ' (split suburb)' : '';
        return `<option value="${esc(s)}">${esc(s)}${tag}</option>`;
      }).join('');
    el.suburb.value = state.suburb;
    el.category.value = state.category;
    el.period.value = state.period;
    el.from.value = state.from;
    el.to.value = state.to;
    el.day.innerHTML = daysInRange().map((d) => `<option value="${d}">${esc(fmtDay(d))}</option>`).join('');
    el.day.value = state.day;
  }

  function setState(patch, opts) {
    Object.assign(state, patch);
    if (state.from > state.to) { const t = state.from; state.from = state.to; state.to = t; }
    if (state.day < state.from || state.day > state.to) state.day = state.from;
    if (!opts || !opts.keepExpanded) state.expanded = null;
    render();
  }

  function wireControls() {
    el.council.addEventListener('change', () => setState({ council: el.council.value, suburb: 'all', showAll: false }));
    el.suburb.addEventListener('change', () => setState({ suburb: el.suburb.value, showAll: false }));
    el.category.addEventListener('change', () => setState({ category: el.category.value, showAll: false }));
    el.period.addEventListener('change', () => {
      const v = el.period.value;
      if (v === 'custom') { setState({ period: 'custom' }); return; }
      const days = Number(v);
      setState({ period: v, from: DEMO_DATE, to: addDays(DEMO_DATE, days - 1), showAll: false });
    });
    el.from.addEventListener('change', () => { if (validDate(el.from.value)) setState({ from: el.from.value, period: 'custom' }); });
    el.to.addEventListener('change', () => { if (validDate(el.to.value)) setState({ to: el.to.value, period: 'custom' }); });
    el.day.addEventListener('change', () => setState({ day: el.day.value }, { keepExpanded: true }));
    el.reset.addEventListener('click', () => { state = defaults(); render(); });
    el.prevDay.addEventListener('click', () => { if (state.day > state.from) setState({ day: addDays(state.day, -1) }, { keepExpanded: true }); });
    el.nextDay.addEventListener('click', () => { if (state.day < state.to) setState({ day: addDays(state.day, 1) }, { keepExpanded: true }); });

    // Delegated clicks inside the analysis section.
    el.section.addEventListener('click', (e) => {
      const t = e.target.closest('[data-sa-action]');
      if (!t) return;
      const act = t.dataset.saAction;
      if (act === 'council') setState({ suburb: 'all', showAll: false });
      if (act === 'suburb') { setState({ suburb: t.dataset.value, showAll: false }); el.scope.scrollIntoView({ block: 'nearest' }); }
      if (act === 'mode') setState({ overlapMode: t.dataset.value, showAll: false });
      if (act === 'show-all') setState({ showAll: !state.showAll });
      if (act === 'expand') setState({ expanded: state.expanded === t.dataset.value ? null : t.dataset.value }, { keepExpanded: true });
      if (act === 'timeline') {
        setState({ day: t.dataset.value }, { keepExpanded: true });
        $('sa-timeline-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (act === 'map-scope') setState({ mapScope: t.dataset.value }, { keepExpanded: true });
      if (act === 'collab-more') {
        state.collabShowAll[t.dataset.value] = !state.collabShowAll[t.dataset.value];
        setState({}, { keepExpanded: true });
      }
    });
    el.section.addEventListener('change', (e) => {
      if (e.target.id === 'sa-win-start' || e.target.id === 'sa-win-end') {
        let s = Number($('sa-win-start').value), f = Number($('sa-win-end').value);
        if (f <= s) f = Math.min(s + 60, 1440);
        setState({ winStart: s, winEnd: f }, { keepExpanded: true });
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  function renderScope() {
    const counts = new Map();
    const allInCouncil = analyse(activities, Object.assign({}, state, { suburb: 'all' }));
    allInCouncil.segs.forEach((s) => {
      if (!counts.has(s.a.suburb)) counts.set(s.a.suburb, new Set());
      counts.get(s.a.suburb).add(s.a.activityId);
    });
    const chips = suburbsInCouncil(state.council).map((s) => {
      const n = counts.has(s) ? counts.get(s).size : 0;
      const on = state.suburb === s;
      return `<button type="button" class="sa-chip${on ? ' is-on' : ''}" data-sa-action="suburb" data-value="${esc(s)}" aria-pressed="${on}">${esc(s)} <span>${n}</span></button>`;
    }).join('');

    const m = state.suburb !== 'all' ? SUBURB_COUNCIL[state.suburb] : null;
    const note = m && m.note ? `<p class="sa-boundary-note"><strong>Boundary note:</strong> ${esc(m.note)}</p>` : '';

    el.scope.innerHTML = `
      <nav class="sa-crumbs" aria-label="Analysis level">
        ${state.suburb === 'all'
          ? `<strong>${esc(COUNCILS[state.council].name)}</strong> <span class="sa-crumb-sep">›</span> <span>All suburbs (council overview)</span>`
          : `<button type="button" class="link-btn" data-sa-action="council">${esc(COUNCILS[state.council].name)}</button> <span class="sa-crumb-sep">›</span> <strong>${esc(state.suburb)}</strong> <span>(suburb view)</span>`}
        <span class="sa-crumb-meta">${esc(state.category === 'all' ? 'All service categories' : catLabel(state.category))} · ${esc(fmtDay(state.from))} – ${esc(fmtDay(state.to))}</span>
      </nav>
      <div class="sa-chips" role="group" aria-label="Choose a suburb (number of scheduled occurrences)">${chips}</div>
      ${note}`;
  }

  function when(iv) { return iv ? `${fmtDay(iv.date)}, ${fmtRange(iv.start, iv.end)}` : 'No activities scheduled'; }

  function renderSummary() {
    const r = result;
    const council = state.suburb === 'all';
    const card = (value, label, sub, mod) => `
      <div class="stat sa-stat${mod ? ' ' + mod : ''}">
        <span class="stat-value">${value}</span>
        <span class="stat-label">${label}</span>
        ${sub ? `<span class="sa-stat-sub">${sub}</span>` : ''}
      </div>`;
    const peakCount = (iv) => (iv ? iv.items.length : 0);
    const cards = [
      card(r.occurrences, 'Scheduled activity occurrences',
        r.unknown.length ? `${plural(r.unknown.length, 'other occurrence')} with unknown schedule` : 'Each dated session counted once'),
      card(r.organisations, 'Participating organisations', 'Delivering activities in this area'),
      card(r.programs, 'Distinct programs', 'A weekly program counts once, however often it runs or however many places it visits')
    ];
    if (council) {
      cards.push(card(peakCount(r.areaPeak), 'Council-wide peak',
        `Scheduled at the same time anywhere in the council (may be in different suburbs). ${esc(when(r.areaPeak))}`, 'sa-stat--council'));
      cards.push(card(peakCount(r.suburbPeak), 'Highest same-suburb peak',
        r.suburbPeak && r.suburbPeak.items.length ? `${esc(r.suburbPeak.suburb)} · ${esc(when(r.suburbPeak))}` : 'No activities scheduled', 'sa-stat--suburb'));
      cards.push(card(r.sameSuburb.length + r.councilWide.length, 'Overlap periods',
        `${r.sameSuburb.length} in the same suburb · ${r.councilWide.length} council-wide across different suburbs`));
    } else {
      cards.push(card(peakCount(r.suburbPeak), `Peak in ${esc(state.suburb)}`,
        `Scheduled at the same time in this suburb. ${esc(when(r.suburbPeak))}`, 'sa-stat--suburb'));
      cards.push(card(r.sameSuburb.length, 'Overlap periods', 'Periods when 2 or more activities are scheduled at the same time in this suburb'));
    }
    const noneNotice = r.occurrences === 0 && state.category !== 'all' ? `
      <div class="sa-none-notice" role="status">
        <strong>No ${esc(catLabel(state.category).toLowerCase())} sessions recorded for the selected period.</strong>
        This indicates an absence of recorded scheduled activity in the demonstration dataset. It does not establish that ${esc(catLabel(state.category).toLowerCase())} is unavailable or that community demand is unmet.
      </div>` : '';
    el.summary.innerHTML = `${noneNotice}<div class="sa-cards">${cards.join('')}</div>
      <p class="sa-note">An <strong>overlap period</strong> is a stretch of time when the same group of two or more activities is scheduled at the same time. Activities that finish exactly when another starts do not overlap.${r.cancelled.length ? ` ${plural(r.cancelled.length, 'cancelled occurrence')} excluded.` : ''}</p>`;
  }

  function overlapCard(iv, idx) {
    const id = `${iv.type}|${iv.date}|${iv.start}|${iv.suburb || 'council'}|${idx}`;
    const expanded = state.expanded === id;
    const orgs = new Set(iv.items.map((s) => s.a.organisationId));
    const cats = [...new Set(iv.items.map((s) => s.a.category))];
    const similar = new Set(cats.map(groupOf)).size === 1;
    const kindTag = similar
      ? '<span class="sa-kind sa-kind--similar">Similar services</span>'
      : '<span class="sa-kind sa-kind--mixed">Different (complementary) services</span>';
    const where = iv.type === 'suburb'
      ? `<span class="sa-ov-where">📍 ${esc(iv.suburb)}</span><span class="sa-ov-type sa-ov-type--suburb">Same suburb</span>`
      : `<span class="sa-ov-where">Council-wide · ${esc(iv.suburbs.join(', '))}</span><span class="sa-ov-type sa-ov-type--council">Council-wide activity, different suburbs</span>`;
    const detail = !expanded ? '' : `
      <div class="sa-ov-detail" id="sa-ov-${idx}">
        <p class="sa-ov-lead">${iv.type === 'suburb'
          ? '<strong>Potential coordination opportunity.</strong> These activities are scheduled at the same time in the same suburb. Providers may wish to check whether timing or information sharing could help people reach each service.'
          : '<strong>Council-wide activity.</strong> These activities are scheduled at the same time but in <em>different suburbs</em>; they do not share a location.'}</p>
        <ul class="sa-ov-items">
          ${iv.items.slice().sort((x, y) => x.start - y.start).map((s) => `
            <li>
              <div class="sa-ov-item-head"><strong>${esc(s.a.activityName)}</strong> ${statusBadge(s.a.verificationStatus)}</div>
              <div>${esc(orgName(s.a.organisationId))} <span class="sample-tag">Fictional</span></div>
              <div class="sa-ov-item-meta">${catChip(s.a.category)} · Scheduled ${esc(fmtRange(s.start, s.end))} · ${esc(s.a.suburb)} — ${esc(s.a.location.description)}</div>
            </li>`).join('')}
        </ul>
        <div class="sa-ov-actions">
          <button type="button" class="btn-secondary" data-sa-action="timeline" data-value="${iv.date}">Show ${esc(fmtDay(iv.date))} on the timeline</button>
          ${iv.type === 'suburb' && state.suburb === 'all' ? `<button type="button" class="btn-secondary" data-sa-action="suburb" data-value="${esc(iv.suburb)}">View ${esc(iv.suburb)}</button>` : ''}
        </div>
        <p class="sa-note">Verification statuses are fictional. "Scheduled" means recorded in the data, not confirmed by the provider unless marked Provider confirmed.</p>
      </div>`;
    return `
      <li class="sa-ov${expanded ? ' is-open' : ''}${iv.type === 'council' ? ' sa-ov--council' : ''}">
        <button type="button" class="sa-ov-summary" data-sa-action="expand" data-value="${esc(id)}" aria-expanded="${expanded}">
          <span class="sa-ov-count"><strong>${iv.items.length}</strong><span>at once</span></span>
          <span class="sa-ov-main">
            <span class="sa-ov-when"><strong>${esc(fmtDay(iv.date))}</strong> · ${esc(fmtRange(iv.start, iv.end))}</span>
            <span class="sa-ov-line">${where}</span>
            <span class="sa-ov-line">${cats.map(catChip).join(' ')} ${kindTag}</span>
            <span class="sa-ov-line sa-ov-orgs">${plural(orgs.size, 'organisation')} · ${iv.items.length} simultaneous activities</span>
          </span>
          <span class="sa-ov-caret" aria-hidden="true">${expanded ? '▴' : '▾'}</span>
        </button>
        ${detail}
      </li>`;
  }

  function renderOverlaps() {
    const r = result;
    const council = state.suburb === 'all';
    const mode = council ? state.overlapMode : 'suburb';
    const list = mode === 'suburb' ? r.sameSuburb : r.councilWide;
    const shown = state.showAll ? list : list.slice(0, LIST_LIMIT);

    const toggle = council ? `
      <div class="sa-seg" role="group" aria-label="Type of overlap">
        <button type="button" data-sa-action="mode" data-value="suburb" aria-pressed="${mode === 'suburb'}">Same suburb (${r.sameSuburb.length})</button>
        <button type="button" data-sa-action="mode" data-value="council" aria-pressed="${mode === 'council'}">Council-wide, different suburbs (${r.councilWide.length})</button>
      </div>` : '';
    const intro = mode === 'suburb'
      ? `Periods when two or more recorded activities are scheduled at the same time <strong>in the same suburb</strong>, ranked by the number of simultaneous activities. These are potential coordination opportunities.`
      : `Periods when two or more activities are scheduled at the same time <strong>across different suburbs</strong> of the council. These do not share a location.`;

    el.overlaps.innerHTML = `
      ${toggle}
      <p class="sa-intro-text">${intro} Select a result to see the organisations and activities involved.</p>
      ${list.length ? `<ol class="sa-ov-list">${shown.map(overlapCard).join('')}</ol>` : `<p class="sa-empty">No overlapping scheduled activities recorded for this selection.</p>`}
      ${list.length > LIST_LIMIT ? `<button type="button" class="link-btn" data-sa-action="show-all">${state.showAll ? 'Show fewer' : `Show all ${list.length} overlap periods`}</button>` : ''}`;
  }

  /* ---------- Concentration map ---------- */

  let saMap = null;
  let saLayer = null;

  function ensureMap() {
    if (saMap || !window.L) return;
    saMap = L.map(el.map, { scrollWheelZoom: false, zoomSnap: 0.5 }).setView(COUNCILS[state.council].center, 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }).addTo(saMap);
    saMap.on('click focus', () => saMap.scrollWheelZoom.enable());
    el.map.addEventListener('mouseleave', () => saMap.scrollWheelZoom.disable());
    saLayer = L.layerGroup().addTo(saMap);
    saMap.on('popupopen', (e) => {
      e.popup.getElement().querySelectorAll('[data-sa-popup-suburb]').forEach((b) => {
        b.addEventListener('click', () => { saMap.closePopup(); setState({ suburb: b.dataset.saPopupSuburb }); });
      });
    });
  }

  function hourOptions(selected, from, to) {
    let html = '';
    for (let m = from; m <= to; m += 60) html += `<option value="${m}"${m === selected ? ' selected' : ''}>${fmtMin(m)}</option>`;
    return html;
  }

  function renderMap() {
    const council = state.suburb === 'all';
    const scope = state.mapScope;
    el.mapControls.innerHTML = `
      <div class="sa-seg" role="group" aria-label="Period shown on the map">
        <button type="button" data-sa-action="map-scope" data-value="range" aria-pressed="${scope === 'range'}">Whole date range</button>
        <button type="button" data-sa-action="map-scope" data-value="day" aria-pressed="${scope === 'day'}">${esc(fmtDay(state.day))}</button>
        <button type="button" data-sa-action="map-scope" data-value="window" aria-pressed="${scope === 'window'}">${esc(fmtDay(state.day))}, time window</button>
      </div>
      ${scope === 'window' ? `
        <div class="sa-window">
          <label for="sa-win-start">From</label><select id="sa-win-start">${hourOptions(state.winStart, 0, 1380)}</select>
          <label for="sa-win-end">to</label><select id="sa-win-end">${hourOptions(state.winEnd, 60, 1440)}</select>
        </div>` : ''}`;

    const groupKey = council ? (a) => a.suburb : (a) => `${a.location.latitude.toFixed(4)},${a.location.longitude.toFixed(4)}`;
    const groups = concentration(result.segs, scope, state.day, state.winStart, state.winEnd, groupKey);
    const total = groups.reduce((t, g) => t + g.count, 0);

    const period = scope === 'range'
      ? `accumulated across ${fmtDay(state.from)} – ${fmtDay(state.to)}. Activities on different days are counted together but were not operating at the same time`
      : scope === 'day'
        ? `scheduled at any time on ${fmtDayLong(state.day)}. They are not necessarily operating at the same time`
        : `scheduled to operate at some point between ${fmtMin(state.winEnd === 1440 && state.winStart === 0 ? 0 : state.winStart)} and ${fmtMin(state.winEnd)} on ${fmtDayLong(state.day)}`;
    el.mapNote.innerHTML = `Each circle shows the number of scheduled activity occurrences ${council ? 'in a suburb' : 'at a location'} (${plural(total, 'occurrence')} in total), ${esc(period)}. Circle size grows with the count. Select a circle to see the activities.`;

    if (!window.L) {
      el.map.innerHTML = '<div class="map-fallback"><div><strong>The map could not load.</strong><br>It needs an internet connection.</div></div>';
      return;
    }
    if (!saMap || el.section.hidden) return;
    saLayer.clearLayers();
    const max = Math.max(1, ...groups.map((g) => g.count));
    groups.forEach((g) => {
      const radius = 10 + 22 * Math.sqrt(g.count / max);
      const title = council ? g.key : g.items[0].a.location.description;
      const listHtml = g.items.slice(0, 10).map((s) => `<li><strong>${esc(fmtDay(s.date))}, ${esc(fmtRange(s.start, s.end))}</strong><br>${esc(s.a.activityName)} · ${esc(orgName(s.a.organisationId))}<br>${statusBadge(s.a.verificationStatus)}</li>`).join('');
      const popup = `<div class="sa-popup"><strong>${esc(title)}</strong><p>${plural(g.count, 'scheduled occurrence')}${council ? '' : ` · ${esc(g.items[0].a.suburb)}`}</p>
        <ul>${listHtml}</ul>${g.items.length > 10 ? `<p>…and ${g.items.length - 10} more</p>` : ''}
        ${council ? `<button type="button" class="btn-secondary" data-sa-popup-suburb="${esc(g.key)}">View ${esc(g.key)}</button>` : ''}</div>`;
      L.circleMarker([g.lat, g.lng], { radius, color: '#0b4f6c', weight: 2, fillColor: '#0b4f6c', fillOpacity: 0.28 })
        .bindPopup(popup, { maxWidth: 280 })
        .bindTooltip(`${title}: ${plural(g.count, 'occurrence')}`)
        .addTo(saLayer);
      L.marker([g.lat, g.lng], {
        icon: L.divIcon({ className: 'sa-count-icon', html: `<span>${g.count}</span>`, iconSize: [30, 20], iconAnchor: [15, 10] }),
        interactive: false, keyboard: false
      }).addTo(saLayer);
    });
    if (groups.length) {
      const b = L.latLngBounds(groups.map((g) => [g.lat, g.lng]));
      saMap.fitBounds(b, { padding: [40, 40], maxZoom: council ? 13 : 16 });
    } else {
      saMap.setView(COUNCILS[state.council].center, 12);
    }
  }

  /* ---------- Daily timeline ---------- */

  function renderTimeline() {
    const daySegs = result.segs.filter((s) => s.date === state.day).sort((x, y) => (x.start - y.start) || x.a.suburb.localeCompare(y.a.suburb));
    const unknownToday = result.unknown.filter((u) => u.a.date === state.day);
    const council = state.suburb === 'all';
    el.prevDay.disabled = state.day <= state.from;
    el.nextDay.disabled = state.day >= state.to;

    if (!daySegs.length) {
      el.timeline.innerHTML = `<p class="sa-timeline-day"><strong>${esc(fmtDayLong(state.day))}</strong> · ${esc(scopeName())}</p>
        <p class="sa-empty">No activity currently recorded for this day and selection.</p>${unknownList(unknownToday)}`;
      return;
    }
    const axisStart = Math.min(GAP_WINDOW[0], Math.floor(Math.min(...daySegs.map((s) => s.start)) / 60) * 60);
    const axisEnd = Math.max(GAP_WINDOW[1], Math.ceil(Math.max(...daySegs.map((s) => s.end)) / 60) * 60);
    const span = axisEnd - axisStart;
    const pct = (m) => ((m - axisStart) / span) * 100;

    let ticks = '';
    for (let m = axisStart; m <= axisEnd; m += 60) {
      const major = (m / 60) % 2 === 0;
      ticks += `<span class="sa-tick${major ? ' is-major' : ''}" style="left:${pct(m)}%">${major ? esc(fmtMin(m)) : ''}</span>`;
    }
    const grid = (() => { let g = ''; for (let m = axisStart; m <= axisEnd; m += 60) g += `<span class="sa-gridline" style="left:${pct(m)}%"></span>`; return g; })();

    // Concurrency track: council-wide (or suburb) count for each interval.
    const conc = sweep(daySegs).map((iv) => {
      const n = iv.items.length;
      return `<span class="sa-conc sa-conc--${Math.min(n, 5)}" style="left:${pct(iv.start)}%;width:${pct(iv.end) - pct(iv.start)}%" title="${n} scheduled ${fmtRange(iv.start, iv.end)}">${n >= 2 ? n : ''}</span>`;
    }).join('');

    const rows = daySegs.map((s) => {
      const c = lookups.categories[s.a.category];
      return `
        <div class="sa-row">
          <div class="sa-row-label">
            <strong>${esc(s.a.activityName)}</strong>
            <span>${esc(orgName(s.a.organisationId))}</span>
            <span class="sa-row-meta">${esc(fmtRange(s.start, s.end))} · ${esc(siteLabel(s.a))} ${statusBadge(s.a.verificationStatus)}</span>
          </div>
          <div class="sa-track">${grid}
            <span class="sa-bar sa-bar--${esc(s.a.verificationStatus)}" style="--bar:${c ? c.color : '#555'};left:${pct(s.start)}%;width:${Math.max(pct(s.end) - pct(s.start), 0.8)}%" title="${esc(s.a.activityName)}: ${esc(fmtRange(s.start, s.end))}"></span>
          </div>
        </div>`;
    }).join('');

    el.timeline.innerHTML = `
      <p class="sa-timeline-day"><strong>${esc(fmtDayLong(state.day))}</strong> · ${esc(scopeName())} · ${esc(state.category === 'all' ? 'All service categories' : catLabel(state.category))} · ${plural(daySegs.length, 'scheduled occurrence')}</p>
      <div class="sa-tl" role="img" aria-label="Timeline of ${daySegs.length} scheduled activities on ${esc(fmtDayLong(state.day))}">
        <div class="sa-row sa-row--axis"><div class="sa-row-label"></div><div class="sa-axis">${ticks}</div></div>
        <div class="sa-row sa-row--conc">
          <div class="sa-row-label"><strong>Scheduled at once</strong><span>${council ? 'Council-wide (any suburb)' : 'In this suburb'}</span></div>
          <div class="sa-track">${grid}${conc}</div>
        </div>
        ${rows}
      </div>
      <p class="sa-note">Bars use the category colour. Solid bar = provider confirmed, pale bar = published only, dashed outline = unverified (all fictional). ${council ? 'The "Scheduled at once" row counts activities anywhere in the council, which may be in different suburbs.' : ''}</p>
      ${unknownList(unknownToday)}`;
  }

  function unknownList(list) {
    if (!list.length) return '';
    return `<div class="sa-unknown"><strong>Schedule unknown:</strong><ul>${list.map((u) => `<li>${esc(u.a.activityName || u.a.activityId)} (${esc(orgName(u.a.organisationId))}): ${esc(u.reason)}</li>`).join('')}</ul></div>`;
  }

  /* ---------- Where activity is not recorded ---------- */

  function renderGaps() {
    const [ws, we] = GAP_WINDOW;
    const span = we - ws;
    const pct = (m) => ((m - ws) / span) * 100;
    const byDate = groupBy(result.segs, (s) => s.date);
    const unknownByDate = groupBy(result.unknown.filter((u) => validDate(u.a.date)), (u) => u.a.date);
    const undated = result.unknown.filter((u) => !validDate(u.a.date));
    let daysWithGap = 0, daysEmpty = 0, daysIncomplete = 0;

    const rows = daysInRange().map((d) => {
      const { covered, gaps } = gapsForDay(byDate.get(d) || [], ws, we);
      const unknownHere = unknownByDate.get(d) || [];
      const incomplete = unknownHere.length > 0;
      if (incomplete) daysIncomplete++;
      if (gaps.length) daysWithGap++;
      if (!covered.length) daysEmpty++;
      const bars = covered.map(([s, e]) => `<span class="sa-gap-cov" style="left:${pct(s)}%;width:${pct(e) - pct(s)}%"></span>`).join('')
        + gaps.map(([s, e]) => `<span class="sa-gap-${incomplete ? 'unknown' : 'none'}" style="left:${pct(s)}%;width:${pct(e) - pct(s)}%"></span>`).join('');
      let text;
      if (!gaps.length) text = 'Activity recorded throughout 8am – 8pm';
      else if (!covered.length) text = incomplete ? 'Schedule information incomplete for this day' : 'No scheduled activity recorded, 8am – 8pm';
      else text = `${incomplete ? 'Unknown (incomplete schedule)' : 'No scheduled activity recorded'}: ${gaps.map(([s, e]) => fmtRange(s, e)).join(', ')}`;
      return `<li class="sa-gap-row${d === state.day ? ' is-day' : ''}">
        <button type="button" class="sa-gap-date link-btn" data-sa-action="timeline" data-value="${d}">${esc(fmtDay(d))}</button>
        <span class="sa-gap-strip" aria-hidden="true">${bars}</span>
        <span class="sa-gap-text">${esc(text)}</span>
      </li>`;
    }).join('');

    el.gaps.innerHTML = `
      <p class="sa-intro-text">Periods in the daily analysis window of <strong>8am to 8pm</strong> with no scheduled activity recorded for ${esc(scopeName())} (${esc(state.category === 'all' ? 'all service categories' : catLabel(state.category))}).</p>
      <p class="sa-gap-summary">${plural(daysWithGap, 'day')} with at least one period of no recorded activity · ${plural(daysEmpty, 'day')} with no recorded activity at all${daysIncomplete ? ` · ${plural(daysIncomplete, 'day')} with incomplete schedule information` : ''}</p>
      <div class="sa-gap-legend"><span><i class="sa-gap-cov"></i> Activity recorded</span><span><i class="sa-gap-none"></i> No scheduled activity recorded</span><span><i class="sa-gap-unknown"></i> Unknown or incomplete schedule</span></div>
      <ol class="sa-gap-list">${rows}</ol>
      ${undated.length ? `<p class="sa-note">${plural(undated.length, 'activity', 'activities')} could not be placed on a date because the schedule information is missing or invalid.</p>` : ''}
      <p class="sa-note"><strong>Interpret with care.</strong> This shows only what is recorded in the fictional data. A period without records does not prove that no service operates, or that there is unmet community need.</p>`;
  }

  /* ---------- Delivery location versus service area ---------- */

  function renderCatchment() {
    const r = result;
    const council = state.suburb === 'all';
    const delivering = new Set(r.segs.map((s) => s.a.organisationId));
    const areaMatches = (o) => (o.areasServed || []).some((s) => (council
      ? SUBURB_COUNCIL[s] && SUBURB_COUNCIL[s].council === state.council
      : s === state.suburb));
    const offersCategory = (o) => state.category === 'all'
      || activities.some((a) => a.organisationId === o.organisationId && inCategory(a.category, state.category));
    const listedNotDelivering = organisations.filter((o) => areaMatches(o) && offersCategory(o) && !delivering.has(o.organisationId));

    const otherCouncils = (o) => [...new Set((o.areasServed || [])
      .map((s) => SUBURB_COUNCIL[s] && SUBURB_COUNCIL[s].council)
      .filter((c) => c && c !== state.council))].map((c) => COUNCILS[c].name);

    const deliveringList = [...delivering].map((id) => orgById.get(id)).filter(Boolean)
      .sort((x, y) => x.organisationName.localeCompare(y.organisationName))
      .map((o) => {
        const n = new Set(r.segs.filter((s) => s.a.organisationId === o.organisationId).map((s) => s.a.activityId)).size;
        const others = otherCouncils(o);
        return `<li><strong>${esc(o.organisationName)}</strong> <span class="sample-tag">Fictional</span><br><span class="sa-row-meta">${plural(n, 'occurrence')} delivered here${others.length ? ` · service area also includes ${esc(others.join(', '))}` : ''}</span></li>`;
      }).join('');

    el.catchment.innerHTML = `
      <h3 class="sa-h3">Activities physically delivered in ${esc(scopeName())}</h3>
      <p>${plural(r.occurrences, 'scheduled occurrence')} by ${plural(r.organisations, 'organisation')}, based on where each activity takes place.</p>
      ${deliveringList ? `<ul class="sa-org-list">${deliveringList}</ul>` : '<p class="sa-empty">No activity currently recorded.</p>'}
      <h3 class="sa-h3">Service area includes ${esc(council ? COUNCILS[state.council].name : state.suburb)}, no activity delivered here in this period</h3>
      ${listedNotDelivering.length
        ? `<ul class="sa-org-list">${listedNotDelivering.map((o) => `<li><strong>${esc(o.organisationName)}</strong> <span class="sample-tag">Fictional</span></li>`).join('')}</ul>`
        : '<p class="sa-empty">None recorded for this selection.</p>'}
      <p class="sa-note">OnNow records <strong>where activities are delivered</strong>. Residents of this area may also use services delivered in neighbouring areas, and an organisation's service area can extend beyond the place it delivers an activity. Delivery location does not show which council or agency funds a service.</p>`;
  }

  /* ---------- Potential Collaboration Opportunities ---------- */

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekdayOf = (iso) => WEEKDAYS[(parseISO(iso).getDay() + 6) % 7];
  function datesText(dateList) {
    const ds = [...new Set(dateList)].sort();
    const days = WEEKDAYS.filter((d) => ds.some((x) => weekdayOf(x) === d));
    return `${plural(ds.length, 'date')} in this period (${days.join(', ')}), first on ${fmtDay(ds[0])}`;
  }
  function commonRange(ranges) {
    const counts = new Map();
    ranges.forEach((r) => { const k = fmtRange(r[0], r[1]); counts.set(k, (counts.get(k) || 0) + 1); });
    return [...counts.entries()].sort((x, y) => y[1] - x[1])[0][0];
  }
  const modeTag = (a) => {
    const p = programById.get(a.programId);
    return p && p.deliveryMode === 'mobile' ? '<span class="sa-mode sa-mode--mobile">Mobile</span>' : '<span class="sa-mode">Fixed</span>';
  };
  const programLine = (a) => `<span class="sa-opp-prog"><strong>${esc(a.activityName)}</strong> · ${esc(orgName(a.organisationId))} ${modeTag(a)} ${statusBadge(a.verificationStatus)}</span>`;
  function hostServices(site) {
    return (site.programIds || []).map((id) => programById.get(id))
      .filter((p) => p && p.organisationId === site.hostOrganisationId)
      .map((p) => `${p.programName} (${p.scheduleText.replace(` at ${site.siteName}`, '')})`);
  }
  const hostName = (site) => orgName(site.hostOrganisationId);
  const statusesText = (segsList) => {
    const ids = [...new Set(segsList.map((s) => s.a.verificationStatus))];
    return ids.map((id) => statusBadge(id)).join(' ');
  };

  function oppCard(kind, title, rows, question) {
    const label = {
      similar: 'Potential coordination to explore',
      colocated: 'Already co-located in fictional data',
      partnership: 'Potential partnership to explore',
      gap: 'No sessions recorded'
    }[kind];
    return `
      <li class="sa-opp sa-opp--${kind}">
        <div class="sa-opp-head"><span class="sa-opp-status sa-opp-status--${kind}">${label}</span><strong>${title}</strong></div>
        <dl class="sa-opp-facts">${rows.filter(Boolean).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        <p class="sa-opp-q"><strong>Question for agencies to explore:</strong> ${question}</p>
      </li>`;
  }

  function renderCollab() {
    const c = collaborations(activities, state);
    const LIMIT = 3;
    const caution = 'Scheduled in fictional data; not confirmed unless marked Provider confirmed.';

    const similarCards = c.similar.map((o) => {
      const fixed = [...new Set(o.items.map((s) => siteById.get(s.a.siteId)).filter((s) => s && s.siteType === 'fixed'))];
      const ivs = [...o.dates.values()];
      return oppCard('similar',
        `${plural(o.orgCount, 'organisation')} offering similar services at the same time in ${esc(o.suburb)}`,
        [
          ['Fixed site', fixed.length ? fixed.map((s) => esc(s.siteName)).join('; ') : 'None (mobile services only)'],
          ['Site operated by', fixed.length ? fixed.map((s) => esc(hostName(s))).join('; ') : '—'],
          ['Programs involved', o.items.map((s) => programLine(s.a)).join('')],
          ['Current delivery locations', [...new Set(o.items.map((s) => siteLabel(s.a)))].map(esc).join('; ')],
          ['Dates and times', `${esc(datesText([...o.dates.keys()]))}. Usually overlapping ${esc(commonRange(ivs.map((iv) => [iv.start, iv.end])))}`],
          ['Why identified', `Similar services (${esc(o.items.map((s) => catLabel(s.a.category)).filter((v, i, arr) => arr.indexOf(v) === i).join(', '))}) are scheduled at overlapping times in the same suburb by different organisations. This is not evidence of duplication.`],
          ['Verification', `${statusesText(o.items)} ${caution}`]
        ],
        'Could these organisations coordinate schedules, referrals or resources?');
    });

    const colocatedCards = c.colocated.map((o) => {
      const entries = [...o.dates.values()];
      const hostProgs = [...new Set(entries.flatMap((e) => e.host.map((h) => h.a.activityName)))];
      return oppCard('colocated',
        `${esc(o.visitor.activityName)} visits ${esc(o.site.siteName)} while other services are running`,
        [
          ['Fixed site', `${esc(o.site.siteName)}, ${esc(o.site.suburb)}`],
          ['Site operated by', esc(hostName(o.site))],
          ['Existing services at site', hostServices(o.site).map(esc).join('; ') || '—'],
          ['Visiting provider', `${esc(orgName(o.visitor.organisationId))} ${modeTag(o.visitor)}`],
          ['Program offered', `${esc(o.visitor.activityName)} (${esc(catLabel(o.visitor.category))})`],
          ['Current delivery location', `${esc(o.site.siteName)} (recorded at this site)`],
          ['Dates and times', `${esc(datesText([...o.dates.keys()]))}. Visit ${esc(commonRange(entries.map((e) => [e.v.start, e.v.end])))}, overlapping: ${esc(hostProgs.join(', '))}`],
          ['Why identified', 'Both services are recorded at the same site with overlapping operating hours, so people could reach several services in one visit.'],
          ['Verification', `${statusesText(entries.map((e) => e.v).concat(entries.flatMap((e) => e.host)))} ${caution}`]
        ],
        'Could people access several essential services in one visit, and is information about each service shared with visitors?');
    });

    const partnershipCards = c.partnership.map((o) => {
      const stops = [...new Set(o.near.map((s) => siteLabel(s.a)))];
      const sameDay = o.near.filter((s) => o.siteSegs.some((h) => h.date === s.date && h.start < s.end && h.end > s.start));
      return oppCard('partnership',
        `${esc(o.program.programName)} stops near ${esc(o.site.siteName)}`,
        [
          ['Fixed site', `${esc(o.site.siteName)}, ${esc(o.site.suburb)}`],
          ['Site operated by', esc(hostName(o.site))],
          ['Existing services at site', hostServices(o.site).map(esc).join('; ') || 'None recorded in this period'],
          ['Mobile provider', `${esc(orgName(o.program.organisationId))} <span class="sa-mode sa-mode--mobile">Mobile</span>`],
          ['Program offered', `${esc(o.program.programName)} (${esc(catLabel(o.program.category))})`],
          ['Current delivery location', `${stops.map(esc).join('; ')}, about ${o.distance} m away (straight line)`],
          ['Dates and times', `${esc(datesText(o.near.map((s) => s.date)))}, ${esc(commonRange(o.near.map((s) => [s.start, s.end])))}${sameDay.length ? `. On ${plural(new Set(sameDay.map((s) => s.date)).size, 'date')} this overlaps services already running at the site` : ''}`],
          ['Why identified', `The site does not record ${esc(catLabel(o.program.category).toLowerCase())}, and this mobile service already stops within ${NEAR_METRES} m. No shared arrangement is recorded.`],
          ['Verification', `${statusesText(o.near)} ${caution} Site facilities, permissions and capacity are not known.`]
        ],
        `Could ${esc(orgName(o.program.organisationId))} discuss visiting ${esc(o.site.siteName)} on a suitable day?`);
    });

    const gapCards = c.gaps.map((o) => {
      const label = catLabel(o.category).toLowerCase();
      const other = otherCouncilName();
      return oppCard('gap',
        `No ${esc(label)} sessions recorded in ${esc(COUNCILS[state.council].name)} for the selected period`,
        [
          ['Fixed sites in this council', o.hubs.length ? o.hubs.map((s) => `${esc(s.siteName)} (${esc(hostName(s))}), ${esc(s.suburb)}`).join('; ') : 'None recorded'],
          ['Existing services at those sites', o.hubs.map((s) => `${esc(s.siteName)}: ${hostServices(s).map((t) => esc(t.split(' (')[0])).join(', ')}`).join('<br>') || '—'],
          ['Provider elsewhere', o.providers.length ? o.providers.map((p) => esc(p.organisationName)).join('; ') : 'None recorded in either council'],
          ['Current delivery location', o.elsewhere.length ? `${esc(other)}: ${[...new Set(o.elsewhere.map((s) => s.a.suburb))].map(esc).join(', ')}` : '—'],
          ['Dates and times', o.elsewhere.length ? `${plural(o.elsewhere.length, 'session')} in ${esc(other)} in this period, e.g. ${esc(fmtDay(o.elsewhere[0].date))} ${esc(fmtRange(o.elsewhere[0].start, o.elsewhere[0].end))}` : 'No sessions recorded in either council'],
          ['Why identified', `No ${esc(label)} sessions are recorded in this council for ${esc(fmtDay(state.from))} – ${esc(fmtDay(state.to))}.${o.servesHere.length ? ` ${esc(o.servesHere.map((p) => p.organisationName).join(', '))} list${o.servesHere.length === 1 ? 's' : ''} suburbs in this council in their service area.` : ''}`],
          ['Uncertainty', `This indicates an absence of recorded scheduled activity in the demonstration dataset. It does not establish that ${esc(label)} is unavailable or that community demand is unmet.${o.unknown ? ` ${plural(o.unknown, 'session')} with unknown schedule information.` : ''}`]
        ],
        `Could an existing ${esc(label)} provider consider delivering a scheduled session at a community hub?`);
    });

    const section = (kind, title, intro, cards) => {
      const all = !!state.collabShowAll[kind];
      return `
        <div class="sa-opp-group">
          <h3 class="sa-h3">${title} (${cards.length})</h3>
          <p class="sa-note">${intro}</p>
          ${cards.length ? `<ol class="sa-opp-list">${(all ? cards : cards.slice(0, LIMIT)).join('')}</ol>` : '<p class="sa-empty">None identified for this selection.</p>'}
          ${cards.length > LIMIT ? `<button type="button" class="link-btn" data-sa-action="collab-more" data-value="${kind}">${all ? 'Show fewer' : `Show all ${cards.length}`}</button>` : ''}
        </div>`;
    };

    el.collab.innerHTML = `
      <p class="sa-intro-text">Questions agencies may wish to investigate together. These are <strong>not recommendations</strong>, and no partnership is implied unless the fictional records show both services at the same site.</p>
      ${section('similar', 'A. Similar services at overlapping times', 'Same suburb, similar service type, different organisations, overlapping operating hours.', similarCards)}
      ${section('colocated', 'B. Complementary services at the same site', 'A visiting provider is recorded at a fixed site while the host runs a different kind of service.', colocatedCards)}
      ${section('partnership', 'C. Nearby services that could partner', `A mobile service stops within ${NEAR_METRES} m (straight line, illustrative) of a fixed site that does not record that kind of service.`, partnershipCards)}
      ${section('gap', 'D. No sessions recorded', 'Service categories with no recorded sessions in this council for the selected period (shown when the other council records them, or when the category is selected).', gapCards)}
      <details class="sa-rules"><summary>How these are identified</summary>
        <ul>
          <li>Only dated, scheduled sessions inside the selected period and council are used. Cancelled sessions are excluded; sessions with unknown schedules are not treated as absent.</li>
          <li>Times overlap only if they intersect for a positive duration. A session ending when another starts does not overlap.</li>
          <li>Food relief and community meals count as similar food services. Other categories are similar only to themselves.</li>
          <li>Distances are straight-line between fictional map points. Council membership alone is never used as evidence that services are near each other.</li>
          <li>Each organisation, site and program combination appears once.</li>
        </ul>
      </details>`;
  }

  function otherCouncilName() {
    const other = Object.keys(COUNCILS).find((c) => c !== state.council);
    return other ? COUNCILS[other].name : '';
  }

  function render() {
    result = analyse(activities, state);
    syncControls();
    renderScope();
    renderSummary();
    renderOverlaps();
    renderCollab();
    renderMap();
    renderTimeline();
    renderGaps();
    renderCatchment();
  }

  /* ------------------------------------------------------------------ */
  /* Primary navigation: Explore Activities | Service Analysis           */
  /* ------------------------------------------------------------------ */

  const exploreParts = [document.querySelector('.stats'), document.querySelector('main.layout')];
  const scrim = document.getElementById('scrim');
  let activeTab = 'explore';
  let scrimWasOpen = false;

  function showTab(tab) {
    if (tab === activeTab) return;
    activeTab = tab;
    document.querySelectorAll('.primary-tab').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    const analysis = tab === 'analysis';
    exploreParts.forEach((p) => { if (p) p.hidden = analysis; });
    el.section.hidden = !analysis;

    if (analysis) {
      // Keep the Explore details drawer state, but hide its backdrop while away.
      scrimWasOpen = scrim && !scrim.hidden;
      if (scrim) scrim.hidden = true;
      ensureMap();
      render();
      if (saMap) { saMap.invalidateSize(); renderMap(); }
    } else {
      if (scrim) scrim.hidden = !scrimWasOpen;
      // Let the Explore Activities map re-measure itself now it is visible again.
      window.dispatchEvent(new Event('resize'));
    }
    window.scrollTo({ top: 0 });
  }

  document.querySelectorAll('.primary-tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  // While Service Analysis is showing, Escape must not affect the hidden Explore panel.
  window.addEventListener('keydown', (e) => {
    if (activeTab === 'analysis' && e.key === 'Escape') {
      e.stopPropagation();
      if (state.expanded) setState({ expanded: null });
    }
  }, true);

  buildControls();
  wireControls();
})();
