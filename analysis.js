/*
 * OnNow — analysis engine (shared by Service Insights and Reports)
 * ----------------------------------------------------------------
 * Pure calculations on the fictional dataset. No page drawing happens here.
 *   - occurrences, overlap sweeps, peaks, concentration, daily gaps
 *   - similar-service overlaps and recorded category gaps
 *   - eight types of potential collaboration opportunity, using declared agency profiles
 * Everything is calculated from the records. Nothing is hardcoded.
 */
(() => {
  'use strict';

  const O = window.OnNow;
  if (!O) return;
  const { DATA, orgById, programById, siteById, councilOf, suburbsInCouncil, inCats, COUNCILS, SUBURB_COUNCIL,
    fmtRange, fmtDay, fmtDate, fmtMin, weekdayOf, WEEKDAYS, WEEKDAY_PLURAL, plural, listText, category, CATEGORY_IDS } = O;
  const { activities } = DATA;

  // Food relief and community meals are treated as "similar" food services.
  // Every other category is only similar to itself.
  const SIMILAR_GROUP = { food_relief: 'food', community_meals: 'food' };
  const groupOf = (cat) => SIMILAR_GROUP[cat] || cat;
  const groupLabel = (g) => (g === 'food' ? 'Food services' : category(g).label);

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

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
  const uniq = (arr) => [...new Set(arr)];
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  // Straight-line distance (metres) between two fictional map points.
  function distanceM(p, q) {
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(q.latitude - p.latitude);
    const dLng = toRad(q.longitude - p.longitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(p.latitude)) * Math.cos(toRad(q.latitude)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(h));
  }

  /* ------------------------------------------------------------------ */
  /* Core calculations                                                   */
  /* ------------------------------------------------------------------ */

  // Each activity record is one dated occurrence. This turns records into
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
        if (f > 0) segments.push({ a, date: O.addDays(a.date, 1), start: 0, end: f, overnight: true });
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

  // Full analysis for one geography, set of categories and date range.
  // opt: { council, suburb ('all' or name), categories (Set; empty = all), from, to }
  function analyse(list, opt) {
    const geo = (a) => councilOf(a) === opt.council && (opt.suburb === 'all' || a.suburb === opt.suburb);
    const inRange = (d) => d >= opt.from && d <= opt.to;

    const scoped = list.filter((a) => geo(a) && inCats(a.category, opt.categories));
    const built = buildOccurrences(scoped);
    const segs = built.segments.filter((s) => inRange(s.date));
    const unknown = built.unknown.filter((u) => !validDate(u.a.date) || inRange(u.a.date));
    const cancelled = built.cancelled.filter((a) => validDate(a.date) && inRange(a.date));

    const occurrenceIds = new Set(segs.map((s) => s.a.activityId));
    const orgIds = new Set(segs.map((s) => s.a.organisationId));
    const programIds = new Set(segs.map((s) => s.a.programId || s.a.activityId));
    const siteIds = new Set(segs.map((s) => s.a.siteId || `${s.a.location.latitude.toFixed(4)},${s.a.location.longitude.toFixed(4)}`));

    const areaIntervals = intervalsByDay(segs, {});
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
      sites: siteIds.size,
      areaPeak: peakOf(areaIntervals),
      suburbPeak: peakOf(suburbIntervals),
      sameSuburb,
      councilWide
    };
  }

  // Delivery profile counts for any list of segments.
  function profile(segs) {
    const progIds = uniq(segs.map((s) => s.a.programId || s.a.activityId));
    const mode = (pid) => ((programById.get(pid) || {}).deliveryMode || 'fixed');
    return {
      occurrences: uniq(segs.map((s) => s.a.activityId)).length,
      programs: progIds.length,
      organisations: uniq(segs.map((s) => s.a.organisationId)).length,
      sites: uniq(segs.map((s) => s.a.siteId || s.a.activityId)).length,
      fixedPrograms: progIds.filter((p) => mode(p) !== 'mobile').length,
      mobilePrograms: progIds.filter((p) => mode(p) === 'mobile').length,
      fixedSessions: uniq(segs.filter((s) => mode(s.a.programId) !== 'mobile').map((s) => s.a.activityId)).length,
      mobileSessions: uniq(segs.filter((s) => mode(s.a.programId) === 'mobile').map((s) => s.a.activityId)).length,
      byCategory: CATEGORY_IDS.map((c) => {
        const cs = segs.filter((s) => s.a.category === c);
        return {
          category: c,
          occurrences: uniq(cs.map((s) => s.a.activityId)).length,
          programs: uniq(cs.map((s) => s.a.programId || s.a.activityId)).length,
          organisations: uniq(cs.map((s) => s.a.organisationId)).length
        };
      }).filter((r) => r.occurrences > 0),
      bySuburb: [...groupBy(segs, (s) => s.a.suburb).entries()].map(([suburb, ss]) => ({
        suburb,
        occurrences: uniq(ss.map((s) => s.a.activityId)).length,
        programs: uniq(ss.map((s) => s.a.programId || s.a.activityId)).length,
        organisations: uniq(ss.map((s) => s.a.organisationId)).length,
        sites: uniq(ss.map((s) => s.a.siteId || s.a.activityId)).length,
        categories: uniq(ss.map((s) => s.a.category))
      })).sort((x, y) => y.occurrences - x.occurrences)
    };
  }

  // Number of scheduled occurrences per place for the concentration map.
  function concentration(segs, mode, day, winStart, winEnd, groupKey) {
    const chosen = segs.filter((s) => {
      if (mode === 'range') return true;
      if (s.date !== day) return false;
      if (mode === 'window') return s.start < winEnd && s.end > winStart;
      return true;
    });
    const groups = new Map();
    chosen.forEach((s) => {
      const k = groupKey(s.a);
      if (!groups.has(k)) groups.set(k, new Map());
      groups.get(k).set(s.a.activityId, s);
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

  /* ------------------------------------------------------------------ */
  /* Schedule text                                                       */
  /* ------------------------------------------------------------------ */

  const hasSchedule = (pid) => (DATA.schedules || []).some((sc) => sc.programId === pid);
  function compressDays(days) {
    const idx = uniq(days).map((d) => WEEKDAYS.indexOf(d)).sort((x, y) => x - y);
    const runs = [];
    idx.forEach((i) => { const r = runs[runs.length - 1]; if (r && i === r[1] + 1) r[1] = i; else runs.push([i, i]); });
    return runs.map(([s, e]) => (e - s >= 2 ? `${WEEKDAYS[s]}–${WEEKDAYS[e]}` : (s === e ? WEEKDAYS[s] : `${WEEKDAYS[s]}, ${WEEKDAYS[e]}`))).join(', ');
  }
  // Describe when segments run. Weekly wording is only used when the program
  // has a recorded weekly schedule; otherwise the actual dates are listed.
  function patternText(segs, pid) {
    if (!segs.length) return 'No sessions in this period';
    const weekly = pid && hasSchedule(pid);
    const byTimeRange = groupBy(segs, (s) => `${s.start}|${s.end}`);
    const parts = [];
    byTimeRange.forEach((g, k) => {
      const [st, en] = k.split('|').map(Number);
      const dates = uniq(g.map((s) => s.date)).sort();
      if (weekly) {
        const days = uniq(dates.map(weekdayOf));
        const dayText = days.length === 1 ? WEEKDAY_PLURAL[days[0]] : compressDays(days);
        parts.push({ order: Math.min(...days.map((d) => WEEKDAYS.indexOf(d))) * 1440 + st, text: `${dayText}, ${fmtRange(st, en)}` });
      } else {
        parts.push({ order: dates[0] + String(st).padStart(4, '0'), text: `${dates.slice(0, 3).map(fmtDay).join(' and ')}${dates.length > 3 ? ` and ${dates.length - 3} more` : ''}, ${fmtRange(st, en)}` });
      }
    });
    return parts.sort((x, y) => (x.order < y.order ? -1 : x.order > y.order ? 1 : 0)).map((p) => p.text).join('; ');
  }
  function commonRange(ranges) {
    const counts = new Map();
    ranges.forEach((r) => { const k = fmtRange(r[0], r[1]); counts.set(k, (counts.get(k) || 0) + 1); });
    return [...counts.entries()].sort((x, y) => y[1] - x[1])[0][0];
  }

  /* ------------------------------------------------------------------ */
  /* Similar overlaps and recorded category gaps                          */
  /* ------------------------------------------------------------------ */

  // Similar services (same group) run by 2+ organisations at overlapping times
  // in the same suburb, aggregated across dates.
  function similarOverlaps(segs, opt) {
    const inSuburb = (sub) => opt.suburb === 'all' || sub === opt.suburb;
    const agg = new Map();
    const pid = (s) => s.a.programId || s.a.activityId;
    groupBy(segs, (s) => s.a.suburb).forEach((subSegs, suburb) => {
      if (!inSuburb(suburb)) return;
      groupBy(subSegs, (s) => groupOf(s.a.category)).forEach((gSegs, group) => {
        const ivs = intervalsByDay(gSegs, { suburb });
        ivs.forEach((iv) => {
          const orgs = new Set(iv.items.map((s) => s.a.organisationId));
          if (orgs.size < 2 || !iv.items.some((s) => inCats(s.a.category, opt.categories))) return;
          const progIds = [...new Set(iv.items.map(pid))].sort();
          const key = `${suburb}|${progIds.join(',')}`;
          if (!agg.has(key)) agg.set(key, { key, suburb, group, orgCount: orgs.size, items: iv.items, progIds, dates: new Map(), ivs });
        });
      });
    });
    // A combination overlaps on every date where all its programs run at the same time.
    agg.forEach((e) => {
      e.ivs.forEach((iv) => {
        const here = new Set(iv.items.map(pid));
        if (!e.progIds.every((p) => here.has(p))) return;
        const prev = e.dates.get(iv.date);
        if (!prev) { e.dates.set(iv.date, { start: iv.start, end: iv.end }); return; }
        if (iv.start <= prev.end && iv.end >= prev.start) e.dates.set(iv.date, { start: Math.min(prev.start, iv.start), end: Math.max(prev.end, iv.end) });
      });
      delete e.ivs;
      e.orgIds = uniq(e.items.map((s) => s.a.organisationId));
      e.window = commonRange([...e.dates.values()].map((d) => [d.start, d.end]));
    });
    // Drop a combination when a larger combination already covers all of its dates.
    const entries = [...agg.values()];
    return entries.filter((e) => !entries.some((o) => o !== e && o.suburb === e.suburb
        && o.progIds.length > e.progIds.length
        && e.progIds.every((p) => o.progIds.includes(p))
        && [...e.dates.keys()].every((d) => o.dates.has(d))))
      .sort((x, y) => (y.dates.size - x.dates.size) || (y.orgCount - x.orgCount));
  }

  // Categories with no recorded sessions in the council for the period
  // (shown when the other council records them, or when that category is selected).
  function categoryGaps(list, opt) {
    const inRange = (d) => d >= opt.from && d <= opt.to;
    const built = buildOccurrences(list.filter((a) => councilOf(a) === opt.council));
    const segs = built.segments.filter((s) => inRange(s.date));
    const here = new Set(segs.map((s) => s.a.category));
    const otherCouncils = Object.keys(COUNCILS).filter((c) => c !== opt.council);
    const otherSegs = buildOccurrences(list.filter((a) => otherCouncils.includes(councilOf(a)))).segments.filter((s) => inRange(s.date));
    const unknownHere = built.unknown.filter((u) => !validDate(u.a.date) || inRange(u.a.date));
    const councilSuburbs = new Set(suburbsInCouncil(opt.council));
    const fixedSites = (DATA.sites || []).filter((s) => s.siteType === 'fixed' && s.lga === opt.council);
    const selectedOnly = opt.categories && opt.categories.size > 0;
    const out = [];
    CATEGORY_IDS.filter((c) => inCats(c, opt.categories)).forEach((cat) => {
      if (here.has(cat)) return;
      const elsewhere = otherSegs.filter((s) => s.a.category === cat);
      if (!elsewhere.length && !selectedOnly) return;
      const providers = uniq(elsewhere.map((s) => s.a.organisationId)).map((id) => orgById.get(id)).filter(Boolean);
      out.push({
        key: cat, category: cat, elsewhere, providers,
        servesHere: providers.filter((o) => (o.areasServed || []).some((s) => councilSuburbs.has(s))),
        hubs: fixedSites,
        unknown: unknownHere.filter((u) => u.a.category === cat).length
      });
    });
    return out;
  }

  // Suburbs (in scope) with no recorded sessions of each selected category.
  function suburbGaps(list, opt) {
    const inRange = (d) => d >= opt.from && d <= opt.to;
    const segs = buildOccurrences(list.filter((a) => councilOf(a) === opt.council)).segments.filter((s) => inRange(s.date));
    const suburbs = opt.suburb === 'all' ? suburbsInCouncil(opt.council) : [opt.suburb];
    const cats = opt.categories && opt.categories.size ? [...opt.categories] : null;
    return suburbs.map((suburb) => {
      const ss = segs.filter((s) => s.a.suburb === suburb);
      const present = new Set(ss.map((s) => s.a.category));
      return {
        suburb,
        occurrences: uniq(ss.filter((s) => inCats(s.a.category, opt.categories)).map((s) => s.a.activityId)).length,
        missing: cats ? cats.filter((c) => !present.has(c)) : []
      };
    });
  }

  /* ------------------------------------------------------------------ */
  /* Collaboration opportunities (eight types)                            */
  /* ------------------------------------------------------------------ */

  const NEAR_M = 500;       // illustrative "nearby" distance (straight line)
  const REFERRAL_M = 2500;  // illustrative distance for referral pathways
  const BASIC = new Set(['food_relief', 'community_meals', 'showers_hygiene', 'laundry', 'clothing_assistance', 'personal_care']);
  const SUPPORT = new Set(['housing_homelessness', 'legal_assistance', 'mental_health', 'health_clinics', 'social_support', 'english_classes',
    'financial_counselling', 'employment', 'dental', 'dfv_support', 'digital_access', 'aod_support', 'crisis_support', 'disability_ndis',
    'carer_support', 'migrant_refugee', 'visa_immigration', 'family_support', 'education', 'life_skills', 'wellness']);
  const GUEST_CATS = new Set(['financial_counselling', 'legal_assistance', 'employment', 'health_clinics', 'digital_access', 'housing_homelessness', 'mental_health', 'dental']);
  const PATHWAY_CATS = new Set(['employment', 'education', 'digital_access', 'english_classes', 'life_skills']);

  // Declared (fictional) collaboration profiles. Unknown values stay unknown.
  const prof = (org) => O.profileOf(org);
  const wantsCat = (org, cat) => prof(org).wants.categories.includes(cat);
  const interested = (org, k) => prof(org).wants.interests.includes(k);
  const servesSuburb = (org, sub) => ((orgById.get(org) || {}).areasServed || []).includes(sub);
  const fmtKm = (m) => (m < 1000 ? `about ${Math.round(m / 10) * 10} m` : `about ${(m / 1000).toFixed(1)} km`);
  function facilitiesText(org) {
    const p = prof(org);
    if (!p.hasProfile) return 'Not specified. Site suitability requires investigation.';
    const yes = O.OFFER_FIELDS.filter((f) => p.offers[f.k] === true).map((f) => f.label.toLowerCase());
    const unknown = O.OFFER_FIELDS.filter((f) => p.offers[f.k] === null).length;
    return `${yes.length ? cap(listText(yes)) : 'No facilities declared'}${unknown ? ` (${unknown} item${unknown === 1 ? '' : 's'} not specified)` : ''}. Declared in a fictional demonstration profile.`;
  }

  const TYPES = {
    host:     { n: 1, icon: 'fixedSite', label: 'Fixed site hosting a mobile service', short: 'Host a mobile service', friendly: 'Bring a mobile service to a site', color: '#00C1DE' },
    mobile:   { n: 2, icon: 'van',       label: 'Mobile services operating together', short: 'Mobile services together', friendly: 'Share a mobile stop', color: '#E65300' },
    hub:      { n: 3, icon: 'hub',       label: 'Multi-agency service hub', short: 'Multi-agency hub', friendly: 'Community hub', color: '#3BD4AE' },
    hours:    { n: 4, icon: 'schedule',  label: 'Coordinating operating hours', short: 'Coordinate hours', friendly: 'Coordinate operating hours', color: '#FFCD00' },
    geo:      { n: 5, icon: 'map',       label: 'Coordinating geographic coverage', short: 'Coordinate coverage', friendly: 'Coordinate where services go', color: '#DE8ABA' },
    visiting: { n: 6, icon: 'inbound',   label: 'Fixed organisation hosting a visiting provider', short: 'Visiting provider', friendly: 'Visiting specialist service', color: '#00A1E2' },
    referral: { n: 7, icon: 'referral',  label: 'Coordinated referral pathways', short: 'Referral pathways', friendly: 'Referral partnership', color: '#F4436C' },
    program:  { n: 8, icon: 'program',   label: 'Collaborating on programs', short: 'Program collaboration', friendly: 'Program collaboration', color: '#000F9F' }
  };
  const STATUSES = {
    existing: { label: 'Existing complementary delivery', help: 'Different organisations are recorded delivering complementary services at the same location and time. This does not establish a formal partnership.' },
    potential: { label: 'Potential collaboration', help: 'The records indicate a possible opportunity. No arrangement has been confirmed.' },
    investigate: { label: 'Requires further investigation', help: 'Important information is missing, such as outreach capability, site suitability or provider availability.' }
  };
  const CONSIDER = {
    interest: 'Provider interest: whether each organisation wants to explore this.',
    staffing: 'Staffing capacity: staff or volunteers available on the day.',
    site: 'Site availability: space and times are not recorded in OnNow.',
    vehicle: 'Parking and vehicle access for vans or trucks.',
    utilities: 'Water and electricity requirements.',
    privacy: 'Privacy and appropriate facilities for confidential conversations.',
    insurance: 'Insurance and permissions for the site and activity.',
    eligibility: 'Client eligibility rules for each service.',
    funding: 'Funding restrictions on where, when or for whom services are delivered.',
    demand: 'Community demand: schedules alone do not show need or use.',
    route: 'Route capacity and travel time between existing stops.',
    outreach: 'Outreach capability is not recorded: the provider may not offer services away from its own site.',
    consent: 'Client consent and privacy when sharing referral information.'
  };
  const CONSIDER_BY_TYPE = {
    host: ['interest', 'site', 'vehicle', 'utilities', 'insurance', 'staffing'],
    mobile: ['interest', 'route', 'vehicle', 'insurance', 'eligibility'],
    hub: ['interest', 'site', 'staffing', 'privacy', 'insurance', 'demand'],
    hours: ['demand', 'funding', 'staffing', 'interest'],
    geo: ['demand', 'route', 'funding', 'vehicle'],
    visiting: ['outreach', 'interest', 'site', 'privacy', 'eligibility', 'funding'],
    referral: ['interest', 'eligibility', 'consent', 'staffing'],
    program: ['interest', 'staffing', 'eligibility', 'site', 'funding']
  };
  const NEXT_ACTION = {
    host: 'Arrange an introductory conversation between the host and the mobile provider about whether a visit is practical.',
    mobile: 'Compare current routes and discuss whether a shared stop on the same day is practical.',
    hub: 'Convene an interagency conversation about a possible joint community support day.',
    hours: 'Share current timetables and discuss whether coordinating or staggering hours could extend collective coverage.',
    geo: 'Discuss route coordination using current stop locations and any information about community demand.',
    visiting: 'Ask the provider whether it offers outreach, and whether the host site could accommodate a visiting session.',
    referral: 'Exchange service information and contact points, and discuss a simple referral process.',
    program: 'Share course outlines and dates, and discuss whether a guest session, a coordinated start date or a referral after the course would help participants.'
  };

  function stopKey(a) { return a.siteId || `${a.location.latitude.toFixed(4)},${a.location.longitude.toFixed(4)}`; }
  function stopName(a) {
    const s = siteById.get(a.siteId);
    return s && s.siteType !== 'recorded_location' ? s.siteName : a.location.description.replace(/\s*\(fictional[^)]*\)/i, '');
  }

  function programsOf(segs) {
    const out = new Map();
    groupBy(segs, (s) => s.a.programId || s.a.activityId).forEach((ps, pid) => {
      const p = programById.get(pid);
      const a = ps[0].a;
      const stops = [...groupBy(ps, (s) => stopKey(s.a)).entries()].map(([key, ss]) => ({
        key, siteId: ss[0].a.siteId, loc: ss[0].a.location, suburb: ss[0].a.suburb, name: stopName(ss[0].a), segs: ss,
        pattern: patternText(ss, pid)
      }));
      out.set(pid, {
        id: pid, name: p ? p.programName : a.activityName, org: a.organisationId, cat: a.category,
        group: groupOf(a.category), mode: p ? p.deliveryMode : 'fixed', segs: ps, stops,
        pattern: patternText(ps, pid),
        statuses: uniq(ps.map((s) => s.a.verificationStatus))
      });
    });
    return out;
  }
  const progBrief = (P) => ({ id: P.id, name: P.name, org: P.org, cat: P.cat, mode: P.mode, pattern: P.pattern, statuses: P.statuses });
  function siteServices(siteSegs, progs) {
    return uniq(siteSegs.map((s) => s.a.programId || s.a.activityId)).map((pid) => progs.get(pid)).filter(Boolean);
  }
  const serviceList = (ps) => listText(uniq(ps.map((p) => category(p.cat).label.toLowerCase())));

  // opt: { council, suburb, from, to, categories (Set), includeComplementary, orgId? }
  function opportunities(list, opt) {
    const inRange = (d) => d >= opt.from && d <= opt.to;
    const allSegs = buildOccurrences(list).segments.filter((s) => inRange(s.date));
    const segs = allSegs.filter((s) => councilOf(s.a) === opt.council);
    const progs = programsOf(segs);
    const allProgs = programsOf(allSegs);
    const mobile = [...progs.values()].filter((p) => p.mode === 'mobile');
    // Established community sites: the host runs a drop-in essentials service there, or declares
    // regular community attendance. Offices and appointment-only premises are not assumed to be hub hosts.
    const communitySite = (s) => {
      const hostCats = segs.filter((x) => x.a.siteId === s.siteId && x.a.organisationId === s.hostOrganisationId).map((x) => x.a.category);
      return hostCats.some((c) => BASIC.has(c)) || !!prof(s.hostOrganisationId).offers.attendance;
    };
    const hostedSites = (DATA.sites || []).filter((s) => s.siteType === 'fixed' && s.hostOrganisationId && s.lga === opt.council
      && (communitySite(s) || interested(s.hostOrganisationId, 'visiting')));
    const communityIds = new Set(hostedSites.filter(communitySite).map((s) => s.siteId));
    const out = [];
    const add = (o) => {
      o.typeInfo = TYPES[o.type];
      o.statusInfo = STATUSES[o.status];
      o.considerations = CONSIDER_BY_TYPE[o.type].map((k) => CONSIDER[k]);
      o.nextAction = o.nextAction || NEXT_ACTION[o.type];
      o.orgIds = uniq(o.orgIds);
      o.categories = uniq(o.categories);
      o.suburbs = uniq(o.suburbs);
      o.declared = uniq(o.declared || []);
      o.when = o.when || o.window;
      out.push(o);
    };

    /* 1. Fixed site hosting a mobile service */
    hostedSites.filter((s) => communityIds.has(s.siteId)).forEach((site) => {
      const atSite = segs.filter((s) => s.a.siteId === site.siteId);
      const hostSegs = atSite.filter((s) => s.a.organisationId === site.hostOrganisationId);
      if (!hostSegs.length) return;
      const hostProgs = siteServices(hostSegs, progs);
      const hostGroups = new Set(hostProgs.map((p) => p.group));
      const siteGroups = new Set(atSite.map((s) => groupOf(s.a.category)));
      const seenPair = new Set();
      mobile.forEach((P) => {
        if (P.org === site.hostOrganisationId || hostGroups.has(P.group)) return;
        // One suggestion per provider and kind of service at each site.
        if (seenPair.has(`${P.org}|${P.group}`)) return;
        seenPair.add(`${P.org}|${P.group}`);
        const visits = P.segs.filter((s) => s.a.siteId === site.siteId);
        const base = {
          type: 'host', location: `${site.siteName}, ${site.suburb}`, siteId: site.siteId,
          orgIds: [site.hostOrganisationId, P.org], categories: [...hostProgs.map((p) => p.cat), P.cat],
          parties: [
            { org: site.hostOrganisationId, role: visits.length ? 'Host site' : 'Potential host', mode: 'fixed', programs: hostProgs.map(progBrief) },
            { org: P.org, role: 'Mobile provider', mode: 'mobile', programs: [progBrief(P)] }
          ],
          graphic: { kind: 'pair', a: { cat: hostProgs[0].cat, org: site.hostOrganisationId, mode: 'fixed' }, b: { cat: P.cat, org: P.org, mode: 'mobile' } }
        };
        if (visits.length) {
          const during = visits.map((v) => ({ v, host: hostSegs.filter((h) => h.date === v.date && h.start < v.end && h.end > v.start) })).filter((x) => x.host.length);
          if (!during.length) return;
          const hostDuring = siteServices(during.flatMap((x) => x.host), progs);
          add(Object.assign(base, {
            id: `host|${site.siteId}|${P.id}`, status: 'existing', suburbs: [site.suburb],
            title: `${P.name} already visits ${site.siteName}`,
            summary: `${orgName(P.org)} is recorded at ${site.siteName} while ${orgName(site.hostOrganisationId)} runs ${serviceList(hostDuring)}.`,
            window: `${patternText(visits, P.id)}, overlapping ${listText(hostDuring.map((p) => p.name))}`,
            when: patternText(visits, P.id),
            benefit: `People could reach ${category(P.cat).label.toLowerCase()} and ${serviceList(hostDuring)} in one visit.`,
            why: 'Both organisations are recorded at the same site with overlapping operating hours. Shared delivery does not by itself establish a formal partnership.',
            facts: [
              ['Host organisation', orgName(site.hostOrganisationId)],
              ['Fixed site', `${site.siteName}, ${site.suburb}`],
              ['Existing services at the site', hostProgs.map((p) => `${p.name} (${p.pattern})`).join('; ')],
              ['Visiting mobile provider', orgName(P.org)],
              ['Service offered', `${P.name} (${category(P.cat).label})`],
              ['Recorded visit', patternText(visits, P.id)],
              ['Shared delivery window', `${commonRange(during.map((x) => [Math.max(x.v.start, Math.min(...x.host.map((h) => h.start))), Math.min(x.v.end, Math.max(...x.host.map((h) => h.end)))]))} on ${plural(uniq(during.map((x) => x.v.date)).length, 'date')}`]
            ]
          }));
          return;
        }
        if (siteGroups.has(P.group)) return; // another visitor already offers this at the site
        const near = P.segs.filter((s) => distanceM(s.a.location, site.location) <= NEAR_M);
        // Declared interest: the host wants this service and the provider lists the host suburb.
        const declared = wantsCat(site.hostOrganisationId, P.cat) && servesSuburb(P.org, site.suburb);
        if (!near.length && !declared) return;
        const ref = near.length ? near : P.segs;
        const distM = Math.min(...ref.map((s) => distanceM(s.a.location, site.location)));
        const dist = Math.round(distM);
        const nearDays = uniq(ref.map((s) => weekdayOf(s.date)));
        const hostSameDays = hostSegs.filter((h) => nearDays.includes(weekdayOf(h.date)));
        const hostOnDays = siteServices(hostSameDays, progs);
        const hp = prof(site.hostOrganisationId);
        const vanOK = hp.offers.vehicleAccess === true || hp.offers.outdoorSpace === true;
        const vanNo = hp.offers.vehicleAccess === false && hp.offers.outdoorSpace === false;
        const windowText = hostOnDays.length
          ? `When ${orgName(P.org)} operates (${patternText(ref, P.id)}), ${site.siteName} records ${hostOnDays.map((p) => `${p.name} ${patternText(hostSameDays.filter((h) => (h.a.programId || h.a.activityId) === p.id), p.id).replace(/^[A-Za-z–, ]+?, (?=\d)/, '')}`).join('; ')}. This is a recorded operating window, not an available hosting slot.`
          : `${orgName(P.org)} currently operates ${patternText(ref, P.id)}. ${site.siteName} records no sessions on those days.`;
        const declaredNotes = [
          declared ? `${orgName(site.hostOrganisationId)} would like to connect with ${category(P.cat).label.toLowerCase()} (declared)` : '',
          interested(P.org, 'hosts') ? `${orgName(P.org)} is looking for host sites (declared)` : ''
        ].filter(Boolean);
        add(Object.assign(base, {
          id: `host|${site.siteId}|${P.id}`, status: vanNo ? 'investigate' : 'potential', suburbs: [site.suburb, ...ref.map((s) => s.a.suburb)],
          title: `${site.siteName} could host ${P.name}`,
          summary: `${orgName(P.org)} already stops ${fmtKm(dist)} away${declared && !near.length ? ' and lists ' + site.suburb + ' in its service area' : ''}. ${site.siteName} does not record ${category(P.cat).label.toLowerCase()}.`,
          window: windowText,
          when: hp.offers.hostingTimes ? `${hp.offers.hostingTimes} (declared hosting times)` : `${WEEKDAY_PLURAL[nearDays[0]] || 'Day to be discussed'}: when ${orgName(P.org)} is already in the area`,
          benefit: `People attending ${serviceList(hostProgs)} could also access ${category(P.cat).label.toLowerCase()} in the same visit.`,
          why: near.length
            ? `A mobile ${category(P.cat).label.toLowerCase()} service stops within ${NEAR_M} m (straight line) of a fixed site that does not record that service.${declared ? ' The host has also declared an interest in this service.' : ''} No visit to the site is recorded.`
            : `The host has declared an interest in ${category(P.cat).label.toLowerCase()}, and this mobile provider lists ${site.suburb} in its service area. Distance alone was not the reason for this match.`,
          declared: declaredNotes,
          facts: [
            ['Potential host organisation', orgName(site.hostOrganisationId)],
            ['Fixed site', `${site.siteName}, ${site.suburb}`],
            ['Existing services at the site', hostProgs.map((p) => `${p.name} (${p.pattern})`).join('; ')],
            ['Site facilities', facilitiesText(site.hostOrganisationId)],
            ['Space for a service van', vanOK ? 'Declared' : vanNo ? 'Not available (declared). Requires investigation.' : 'Not specified. Requires investigation.'],
            ['Relevant mobile provider', orgName(P.org)],
            ['Service offered', `${P.name} (${category(P.cat).label})`],
            ['Current nearest stop', `${uniq(ref.filter((s) => Math.round(distanceM(s.a.location, site.location)) === dist).map((s) => stopName(s.a))).join('; ')}, ${fmtKm(dist)} away (${patternText(ref, P.id)})`],
            ['Declared interests', declaredNotes.join('; ') || 'None recorded'],
            ['Potential shared delivery window', windowText]
          ]
        }));
      });
    });

    /* 2. Mobile services operating together
     *    Grouped by location: one opportunity per stop where mobile providers of
     *    different (complementary) services already stop, or stop within NEAR_M. */
    {
      const anchors = [];
      const seenKey = new Set();
      mobile.forEach((P) => P.stops.forEach((st) => {
        if (seenKey.has(st.key)) return;
        seenKey.add(st.key);
        const members = mobile.map((Q) => {
          let best = null;
          Q.stops.forEach((qs) => {
            const same = qs.key === st.key;
            const d = same ? 0 : distanceM(qs.loc, st.loc);
            if (d <= NEAR_M && (!best || d < best.d)) best = { Q, qs, d: Math.round(d), same };
          });
          return best;
        }).filter(Boolean);
        const orgs = uniq(members.map((m) => m.Q.org));
        const groups = uniq(members.map((m) => m.Q.group));
        if (orgs.length < 2 || groups.length < 2) return;
        // Existing: complementary providers at this same stop at overlapping times.
        const atStop = members.filter((m) => m.same);
        const concurrent = [];
        atStop.forEach((m1, i) => atStop.slice(i + 1).forEach((m2) => {
          if (m1.Q.org === m2.Q.org || m1.Q.group === m2.Q.group) return;
          m1.qs.segs.forEach((x) => m2.qs.segs.forEach((y) => {
            if (x.date === y.date && x.start < y.end && y.start < x.end) concurrent.push({ m1, m2, x, y });
          }));
        }));
        const sameStopOrgs = uniq(atStop.map((m) => m.Q.org));
        anchors.push({ st, members, orgs, groups, concurrent, sameStopOrgs });
      }));
      anchors.sort((x, y) => (y.concurrent.length ? 1 : 0) - (x.concurrent.length ? 1 : 0)
        || (y.sameStopOrgs.length - x.sameStopOrgs.length) || (y.orgs.length - x.orgs.length));
      const chosen = [];
      anchors.forEach((x) => {
        // One suggestion per area: skip a stop within 1 km of one already chosen.
        const covered = chosen.some((c) => distanceM(c.st.loc, x.st.loc) <= 1000);
        if (!covered) chosen.push(x);
      });
      chosen.forEach((x) => {
        const existing = x.concurrent.length > 0;
        const ordered = x.members.slice().sort((p, q) => (Number(q.same) - Number(p.same)) || (p.d - q.d));
        const lead = existing ? [x.concurrent[0].m1, x.concurrent[0].m2] : ordered.slice(0, 2);
        const sharedRecorded = x.sameStopOrgs.length >= 2;
        const place = `${x.st.name}, ${x.st.suburb}`;
        const concDates = uniq(x.concurrent.map((c) => c.x.date));
        add({
          id: `mobile|${x.st.key}`, type: 'mobile', status: existing ? 'existing' : 'potential',
          title: existing
            ? `${lead[0].Q.name} and ${lead[1].Q.name} already share a stop at ${x.st.name}`
            : `${plural(x.orgs.length, 'mobile service')} could coordinate a shared stop at ${x.st.name}`,
          summary: existing
            ? `Both are recorded at ${x.st.name} at overlapping times on ${plural(concDates.length, 'date')}.${x.orgs.length > 2 ? ` ${x.orgs.length - 2} more mobile service${x.orgs.length - 2 === 1 ? '' : 's'} stop nearby.` : ''}`
            : sharedRecorded
              ? `${listText(uniq(ordered.filter((m) => m.same).map((m) => m.Q.name)))} use this stop on different days or at different times.`
              : `Their stops are within ${NEAR_M} m of each other. A shared stop here would be new.`,
          location: place,
          sharedLocationExists: sharedRecorded,
          window: existing
            ? `${commonRange(x.concurrent.map((c) => [Math.max(c.x.start, c.y.start), Math.min(c.x.end, c.y.end)]))} on ${WEEKDAY_PLURAL[weekdayOf(concDates[0])]} (${plural(concDates.length, 'date')})`
            : ordered.map((m) => `${m.Q.name}: ${m.qs.pattern}${m.same ? '' : ` (about ${m.d} m away)`}`).join('; '),
          when: existing
            ? `${WEEKDAY_PLURAL[weekdayOf(concDates[0])]}, ${commonRange(x.concurrent.map((c) => [Math.max(c.x.start, c.y.start), Math.min(c.x.end, c.y.end)]))}`
            : `Current days: ${listText(uniq(ordered.map((m) => WEEKDAY_PLURAL[weekdayOf(m.qs.segs[0].date)])))}`,
          siteId: x.st.siteId,
          benefit: `People could access ${listText(uniq(x.members.map((m) => category(m.Q.cat).label.toLowerCase())))} at one stop.`,
          why: existing
            ? 'Complementary mobile services are recorded at the same stop at overlapping times. This does not establish a formal partnership.'
            : `Mobile providers offering complementary services stop ${sharedRecorded ? 'at the same recorded location' : `within ${NEAR_M} m (straight line) of each other`}. No shared arrangement is recorded.`,
          orgIds: x.orgs, categories: x.members.map((m) => m.Q.cat), suburbs: x.members.map((m) => m.qs.suburb),
          parties: ordered.map((m) => ({ org: m.Q.org, role: m.same ? 'Stops at this location' : `Stops about ${m.d} m away`, mode: 'mobile', programs: [Object.assign(progBrief(m.Q), { pattern: m.qs.pattern })] })),
          facts: [
            ['Location', `${place}: ${sharedRecorded ? 'a recorded stop already used by more than one provider' : 'only one provider stops here; a shared stop would be new'}`],
            ['Mobile services', ordered.map((m) => `${m.Q.name}, ${orgName(m.Q.org)} (${category(m.Q.cat).label}) ${m.same ? 'at this stop' : `about ${m.d} m away at ${m.qs.name}`}: ${m.qs.pattern}`).join(' | ')],
            ['Existing shared stop', existing ? `Yes: overlapping on ${plural(concDates.length, 'date')}, first on ${fmtDay(concDates.sort()[0])}` : 'Not at the same time']
          ],
          graphic: { kind: 'mobile', a: { cat: lead[0].Q.cat, org: lead[0].Q.org }, b: { cat: lead[1].Q.cat, org: lead[1].Q.org }, more: x.orgs.length - 2, place: x.st.name, exists: sharedRecorded }
        });
      });
    }

    /* 3. Multi-agency service hubs (3+ organisations) */
    {
      const anchors = [...groupBy(segs, (s) => stopKey(s.a)).entries()].map(([key, ss]) => {
        const a = ss[0].a;
        const site = siteById.get(a.siteId);
        const members = [...progs.values()].map((P) => {
          const near = P.segs.filter((s) => distanceM(s.a.location, a.location) <= NEAR_M);
          return near.length ? { P, near, at: near.some((s) => stopKey(s.a) === key), d: Math.round(Math.min(...near.map((s) => distanceM(s.a.location, a.location)))) } : null;
        }).filter(Boolean);
        return {
          key, a, site, members,
          name: stopName(a),
          office: !!(site && site.siteType === 'fixed' && site.hostOrganisationId && !communityIds.has(site.siteId)),
          hosted: !!(site && communityIds.has(site.siteId)),
          orgs: uniq(members.map((m) => m.P.org)),
          groups: uniq(members.map((m) => m.P.group))
        };
      }).filter((x) => !x.office && x.orgs.length >= 3 && x.groups.length >= 3);
      // Community sites run by a host organisation come first, then the largest groups.
      anchors.sort((x, y) => (Number(y.hosted) - Number(x.hosted)) || (y.orgs.length - x.orgs.length) || (y.members.length - x.members.length));
      const chosen = [];
      anchors.forEach((x) => {
        // One suggestion per area: skip a location within 1 km of one already chosen.
        const overlapping = chosen.some((c) => distanceM(c.a.location, x.a.location) <= 1000);
        if (!overlapping) chosen.push(x);
      });
      chosen.forEach((x) => {
        const byOrg = groupBy(x.members, (m) => m.P.org);
        const nodes = [...byOrg.entries()].map(([org, ms]) => ({
          org, cats: uniq(ms.map((m) => m.P.cat)), mode: ms.every((m) => m.P.mode === 'mobile') ? 'mobile' : 'fixed',
          at: ms.some((m) => m.at), d: Math.min(...ms.map((m) => m.d)),
          programs: ms.map((m) => Object.assign(progBrief(m.P), { pattern: patternText(m.near, m.P.id) }))
        })).sort((p, q) => (Number(q.at) - Number(p.at)) || (p.d - q.d));
        // Which weekday has the most of these organisations operating nearby?
        const dayOrgs = new Map();
        x.members.forEach((m) => m.near.forEach((s) => {
          const wd = weekdayOf(s.date);
          if (!dayOrgs.has(wd)) dayOrgs.set(wd, new Set());
          dayOrgs.get(wd).add(m.P.org);
        }));
        const bestDay = [...dayOrgs.entries()].sort((p, q) => (q[1].size - p[1].size) || (WEEKDAYS.indexOf(p[0]) - WEEKDAYS.indexOf(q[0])))[0];
        const atSite = nodes.filter((n) => n.at);
        // Similar providers need a distinct contribution; this is not assumed.
        const byGroup = groupBy(nodes.flatMap((n) => n.cats.map((c) => ({ g: groupOf(c), org: n.org }))), (r) => r.g);
        const similar = [...byGroup.entries()].map(([g, rs]) => [g, uniq(rs.map((r) => r.org))]).filter(([, os]) => os.length > 1);
        const host = x.hosted ? x.site.hostOrganisationId : null;
        const hostDeclared = host && (interested(host, 'hub') || interested(host, 'visiting'));
        // A clinic van, car park or other recorded delivery point is never treated as a confirmed hub host.
        const place = x.hosted ? `${x.name}, ${x.a.suburb}` : `A location in ${x.a.suburb} to be identified`;
        add({
          id: `hub|${x.key}`, type: 'hub', status: x.hosted ? 'potential' : 'investigate',
          title: x.hosted
            ? `${x.name} could host a regular community hub with ${x.orgs.length - (x.orgs.includes(host) ? 1 : 0)} partner organisations`
            : `${x.orgs.length} organisations could investigate a shared community support day in ${x.a.suburb}`,
          summary: `${cap(listText(uniq(nodes.flatMap((n) => n.cats)).map((c) => category(c).label.toLowerCase())))} are all delivered at or within ${NEAR_M} m of ${x.hosted ? x.name : `a recorded delivery point (${x.name})`}.`,
          location: place,
          proposedLocation: !x.hosted,
          siteId: x.hosted ? x.site.siteId : null,
          window: bestDay ? `${WEEKDAY_PLURAL[bestDay[0]]}: ${bestDay[1].size} of these ${x.orgs.length} organisations already operate at or near this location.` : '',
          when: bestDay ? `${WEEKDAY_PLURAL[bestDay[0]]}: ${bestDay[1].size} of ${x.orgs.length} already operate nearby` : 'Day to be discussed',
          benefit: 'People could access several services in one place, regularly, and organisations could share information about each other\'s services.',
          why: `${x.orgs.length} distinct organisations deliver ${x.groups.length} different kinds of service within ${NEAR_M} m (straight line) of one location. ${atSite.length >= 2 ? `${atSite.length} already deliver at this location itself.` : 'Most deliver nearby rather than at this location.'}${x.hosted ? (hostDeclared ? ' The host has declared an interest in hub or visiting partnerships.' : '') : ' No community host is recorded at this point, so a suitable location requires investigation.'}`,
          declared: hostDeclared ? [`${orgName(host)} is interested in community hub partnerships (declared)`] : [],
          orgIds: x.orgs, categories: nodes.flatMap((n) => n.cats), suburbs: [x.a.suburb, ...x.members.flatMap((m) => m.near.map((s) => s.a.suburb))],
          hub: { name: x.name, hosted: x.hosted, host },
          parties: nodes.map((n) => ({ org: n.org, role: n.org === host ? 'Host organisation' : n.at ? 'Already delivers at this location' : `Delivers about ${n.d} m away`, mode: n.mode, programs: n.programs })),
          facts: [
            [x.hosted ? 'Proposed host' : 'Proposed location', x.hosted ? `${x.name}, ${x.a.suburb} (operated by ${orgName(host)})` : `To be identified in ${x.a.suburb}. The nearest recorded delivery point is "${x.name}", which is not a confirmed community host.`],
            ['Host facilities', x.hosted ? facilitiesText(host) : 'Unknown. Requires investigation.'],
            ['Already delivering at this location', atSite.length ? atSite.map((n) => orgName(n.org)).join('; ') : 'None recorded'],
            ['Delivering nearby', nodes.filter((n) => !n.at).map((n) => `${orgName(n.org)} (about ${n.d} m)`).join('; ') || 'None'],
            ['Compatible operating pattern', bestDay ? `${WEEKDAY_PLURAL[bestDay[0]]}: ${listText([...bestDay[1]].map(orgName))}` : 'No shared weekday recorded'],
            ['Similar providers', similar.length ? `${similar.map(([g, os]) => `${groupLabel(g)}: ${listText(os.map(orgName))}`).join('; ')}. Each would need a distinct contribution (for example different days, items or client groups). This is not assumed.` : 'None: each organisation offers a different kind of service']
          ],
          graphic: { kind: 'hub', center: x.hosted ? x.name : `${x.a.suburb} (location to be identified)`, proposed: !x.hosted, nodes: nodes.filter((n) => n.org !== host).map((n) => ({ org: n.org, cat: n.cats[0], mode: n.mode, at: n.at })) }
        });
      });
    }

    /* 4. Coordinating operating hours (repeated similar overlaps) */
    {
      const sim = similarOverlaps(segs, Object.assign({}, opt, { categories: new Set() })).filter((e) => e.dates.size >= 2);
      groupBy(sim, (e) => `${e.suburb}|${e.group}`).forEach((entries, key) => {
        const [suburb, group] = key.split('|');
        const progIds = uniq(entries.flatMap((e) => e.progIds));
        const P = progIds.map((id) => progs.get(id)).filter(Boolean);
        const dates = uniq(entries.flatMap((e) => [...e.dates.keys()])).sort();
        // Representative date: the one where the most of these programs run.
        const groupSegs = segs.filter((s) => s.a.suburb === suburb && groupOf(s.a.category) === group);
        const repDate = dates.slice().sort((d1, d2) => (groupSegs.filter((s) => s.date === d2).length - groupSegs.filter((s) => s.date === d1).length) || d1.localeCompare(d2))[0];
        const daySegs = groupSegs.filter((s) => s.date === repDate).sort((x, y) => x.start - y.start);
        const bars = daySegs.map((s) => ({ name: (programById.get(s.a.programId) || {}).programName || s.a.activityName, org: s.a.organisationId, cat: s.a.category, start: s.start, end: s.end }));
        const cover = gapsForDay(daySegs, 8 * 60, 20 * 60);
        const covStart = cover.covered.length ? cover.covered[0][0] : null;
        const covEnd = cover.covered.length ? cover.covered[cover.covered.length - 1][1] : null;
        let cursor = bars.length ? bars[0].start : 0;
        const hypo = bars.map((b) => { const s = Math.max(cursor, b.start); const e = s + (b.end - b.start); cursor = e; return Object.assign({}, b, { start: s, end: e }); });
        const hypoEnd = hypo.length ? hypo[hypo.length - 1].end : null;
        const later = cover.gaps.filter(([s]) => covEnd !== null && s >= covEnd);
        const orgIds = uniq(P.map((p) => p.org));
        add({
          id: `hours|${suburb}|${group}`, type: 'hours', status: 'potential',
          title: `${groupLabel(group)} in ${suburb} overlap on ${plural(dates.length, 'date')}`,
          summary: `${plural(orgIds.length, 'organisation')} run similar services at the same time, mostly ${entries[0].window}.${later.length ? ` Fewer are recorded later in the day.` : ''}`,
          location: suburb,
          window: entries.map((e) => `${listText(e.progIds.map((id) => (progs.get(id) || {}).name || id))}: ${e.window} on ${plural(e.dates.size, 'date')}`).join('; '),
          when: `Recorded overlap ${entries[0].window}, ${listText(WEEKDAYS.filter((d) => dates.some((x) => weekdayOf(x) === d)).map((d) => WEEKDAY_PLURAL[d]))}`,
          benefit: 'Coordinating or staggering hours could extend the times when people can access a similar service.',
          why: `Similar services run by different organisations are scheduled at overlapping times in ${suburb} on ${plural(dates.length, 'date')} in this period. This is not evidence of duplication.`,
          orgIds, categories: P.map((p) => p.cat), suburbs: [suburb],
          parties: orgIds.map((org) => ({ org, role: 'Similar service', mode: P.filter((p) => p.org === org).every((p) => p.mode === 'mobile') ? 'mobile' : 'fixed', programs: P.filter((p) => p.org === org).map(progBrief) })),
          facts: [
            ['Services involved', P.map((p) => `${p.name}, ${orgName(p.org)} (${p.pattern})`).join('; ')],
            ['Recurring overlap', entries.map((e) => `${e.window} on ${plural(e.dates.size, 'date')}`).join('; ')],
            [`Recorded coverage on ${fmtDay(repDate)}`, covStart !== null ? `${fmtRange(covStart, covEnd)}${later.length ? `; no similar service recorded ${later.map(([s, e]) => fmtRange(s, e)).join(', ')}` : ''}` : 'None'],
            ['Hypothetical illustration', hypoEnd !== null ? `If the same sessions ran one after another, they would span ${fmtRange(hypo[0].start, hypoEnd)}. This is an illustration only, not a recommendation.` : '']
          ],
          nextAction: NEXT_ACTION.hours,
          caution: 'Do not change, close or relocate a service on the basis of schedules alone. Demand, funding conditions and operational constraints are not recorded.',
          graphic: { kind: 'schedule', date: repDate, bars, hypo }
        });
      });
    }

    /* 5. Coordinating geographic coverage (mobile services) */
    {
      const councilSuburbs = Object.keys(SUBURB_COUNCIL).filter((s) => SUBURB_COUNCIL[s].council === opt.council);
      groupBy(mobile, (p) => p.group).forEach((ms, group) => {
        const orgs = uniq(ms.map((p) => p.org));
        if (orgs.length < 2) return;
        const bySuburb = new Map();
        ms.forEach((P) => P.stops.forEach((st) => {
          if (!bySuburb.has(st.suburb)) bySuburb.set(st.suburb, new Map());
          bySuburb.get(st.suburb).set(P.org, (bySuburb.get(st.suburb).get(P.org) || []).concat(Object.assign({ program: P }, st)));
        }));
        const conc = [...bySuburb.entries()].filter(([, m]) => m.size >= 2).map(([suburb, m]) => ({ suburb, orgs: [...m.keys()], stops: [...m.values()].flat() }));
        if (!conc.length) return;
        const recorded = new Set(segs.filter((s) => groupOf(s.a.category) === group).map((s) => s.a.suburb));
        const low = councilSuburbs.filter((s) => !recorded.has(s));
        if (!low.length) return;
        add({
          id: `geo|${group}`, type: 'geo', status: 'potential',
          title: `Mobile ${groupLabel(group).toLowerCase()} concentrate in ${listText(conc.map((c) => c.suburb))}`,
          summary: `${plural(orgs.length, 'mobile provider')} stop in the same suburbs, while ${plural(low.length, 'suburb')} record${low.length === 1 ? 's' : ''} no ${groupLabel(group).toLowerCase()} in this period.`,
          location: listText(conc.map((c) => c.suburb)),
          window: conc.map((c) => `${c.suburb}: ${c.stops.map((st) => `${st.program.name} (${st.pattern})`).join('; ')}`).join(' | '),
          when: 'When routes are next reviewed',
          benefit: 'Coordinating routes could help mobile services reach more locations without duplicating stops.',
          why: `Several mobile providers of similar services stop in the same suburbs, while other suburbs in the council record none. Fewer recorded services does not show greater unmet demand.`,
          orgIds: orgs, categories: ms.map((p) => p.cat), suburbs: conc.map((c) => c.suburb).concat(low),
          lowSuburbs: low,
          parties: orgs.map((org) => ({ org, role: 'Mobile provider', mode: 'mobile', programs: ms.filter((p) => p.org === org).map(progBrief) })),
          facts: [
            ['Mobile providers', orgs.map(orgName).join('; ')],
            ['Where they concentrate', conc.map((c) => `${c.suburb} (${plural(c.orgs.length, 'provider')})`).join('; ')],
            ['Current stops', ms.map((p) => `${p.name}: ${p.stops.map((s) => `${s.name}, ${s.suburb} (${s.pattern})`).join('; ')}`).join(' | ')],
            [`Suburbs with no recorded ${groupLabel(group).toLowerCase()}`, low.join(', ')]
          ],
          caution: 'A suburb with fewer recorded services does not necessarily have greater unmet demand.',
          graphic: { kind: 'geo', cat: ms[0].cat, group, stops: ms.flatMap((p) => p.stops.map((s) => ({ name: s.name, suburb: s.suburb, loc: s.loc, org: p.org, cat: p.cat }))), low }
        });
      });
    }

    /* 6. Fixed organisations hosting visiting providers */
    hostedSites.forEach((site) => {
      const atSite = segs.filter((s) => s.a.siteId === site.siteId);
      if (!atSite.length) return;
      const siteGroups = new Set(atSite.map((s) => groupOf(s.a.category)));
      const hostProgs = siteServices(atSite.filter((s) => s.a.organisationId === site.hostOrganisationId), progs);
      const councilCats = new Set(segs.map((s) => s.a.category));
      const host = site.hostOrganisationId;
      const hp = prof(host);
      // Requested services first, then services with a provider that declares visiting capability.
      // At most three visiting suggestions per site, so a site is not flooded with possibilities.
      const CORE = ['housing_homelessness', 'legal_assistance', 'mental_health', 'health_clinics', 'social_support', 'english_classes'];
      const capable = (cat) => (DATA.programs || []).some((p) => p.category === cat && p.deliveryMode !== 'mobile' && p.organisationId !== host
        && servesSuburb(p.organisationId, site.suburb) && prof(p.organisationId).offers.visitingSpecialist === true);
      const order = [...SUPPORT].filter((cat) => wantsCat(host, cat) || capable(cat) || (!hp.hasProfile && CORE.includes(cat)))
        .sort((x, y) => (Number(wantsCat(host, y)) - Number(wantsCat(host, x))) || (Number(capable(y)) - Number(capable(x))));
      let made = 0;
      order.forEach((cat) => {
        if (made >= 3 || siteGroups.has(groupOf(cat))) return;
        // Candidates include programs with no public schedule (for example appointment-only specialist services).
        const candidates = (DATA.programs || []).filter((p) => p.category === cat && p.deliveryMode !== 'mobile' && p.organisationId !== host);
        const byOrg = groupBy(candidates, (p) => p.organisationId);
        const ranked = [...byOrg.entries()].map(([org, plist]) => {
          const ps = plist.map((p) => allProgs.get(p.programId) || { id: p.programId, name: p.programName, org, cat, mode: 'fixed', segs: [], stops: [], pattern: p.scheduleText || 'No public schedule recorded', statuses: [] });
          const stops = ps.flatMap((P) => P.stops);
          const d = stops.length ? Math.round(Math.min(...stops.map((st) => distanceM(st.loc, site.location)))) : null;
          const visitCap = prof(org).offers.visitingSpecialist;
          return { org, ps, serves: servesSuburb(org, site.suburb), d, visitCap, declaredHost: wantsCat(host, cat), declaredProv: interested(org, 'hosts') };
        }).filter((r) => r.serves) // the provider's recorded service area includes the host suburb
          .sort((x, y) => (Number(y.visitCap === true) - Number(x.visitCap === true)) || (Number(y.declaredHost) - Number(x.declaredHost)) || ((x.d == null ? 1e9 : x.d) - (y.d == null ? 1e9 : y.d))).slice(0, 2);
        if (!ranked.length) return;
        made += 1;
        const lead = ranked[0];
        const gapHere = !councilCats.has(cat);
        const hostWelcomes = lead.declaredHost || interested(host, 'visiting');
        const status = lead.visitCap === true && hostWelcomes ? 'potential' : 'investigate';
        const declaredNotes = [
          lead.declaredHost ? `${orgName(host)} would like to connect with ${category(cat).label.toLowerCase()} (declared)` : (interested(host, 'visiting') ? `${orgName(host)} welcomes visiting providers (declared)` : ''),
          lead.visitCap === true ? `${orgName(lead.org)} can deliver visiting specialist sessions (declared)` : '',
          lead.declaredProv ? `${orgName(lead.org)} is looking for host sites (declared)` : ''
        ].filter(Boolean);
        const from = lead.ps.find((P) => P.stops.length);
        add({
          id: `visiting|${site.siteId}|${cat}`, type: 'visiting', status, siteId: site.siteId,
          title: `${orgName(lead.org)} could ${status === 'potential' ? 'explore' : 'investigate'} a visiting ${category(cat).label.toLowerCase()} session at ${site.siteName}`,
          summary: `${site.siteName} records ${serviceList(hostProgs)} but no ${category(cat).label.toLowerCase()}.${gapHere ? ` No ${category(cat).label.toLowerCase()} sessions are recorded anywhere in ${COUNCILS[opt.council].name} in this period.` : ''}`,
          location: `${site.siteName}, ${site.suburb}`,
          window: `${site.siteName} currently records: ${hostProgs.map((p) => `${p.name} (${p.pattern})`).join('; ')}. A recorded operating window is not an available slot.`,
          when: hp.offers.hostingTimes ? `${hp.offers.hostingTimes} (declared hosting times)` : `Alongside ${hostProgs[0] ? hostProgs[0].name : 'existing services'} (${hostProgs[0] ? hostProgs[0].pattern : 'times not recorded'})`,
          benefit: `People already visiting ${site.siteName} could access ${category(cat).label.toLowerCase()} without ${from ? `travelling to ${from.stops[0].suburb}` : 'a separate appointment elsewhere'}.`,
          why: `${orgName(lead.org)} delivers ${category(cat).label.toLowerCase()} and lists ${site.suburb} in its service area. ${lead.visitCap === true ? 'It has declared that it can deliver visiting specialist sessions.' : 'Whether it offers outreach is not recorded.'}${hostWelcomes ? ' The host has declared an interest.' : ''}`,
          declared: declaredNotes,
          orgIds: [host, ...ranked.map((r) => r.org)], categories: [cat, ...hostProgs.map((p) => p.cat)], suburbs: [site.suburb],
          gapHere,
          parties: [
            { org: host, role: 'Potential host site', mode: 'fixed', programs: hostProgs.map(progBrief) },
            ...ranked.map((r) => ({ org: r.org, role: `Potential visiting provider${r.d != null ? ` (${fmtKm(r.d)} away)` : ' (location not published)'}`, mode: 'fixed', programs: r.ps.map(progBrief) }))
          ],
          facts: [
            ['Potential host site', `${site.siteName}, ${site.suburb} (${orgName(host)})`],
            ['Existing services at the site', hostProgs.map((p) => `${p.name} (${p.pattern})`).join('; ')],
            ['Site facilities', facilitiesText(host)],
            ['Private room', hp.offers.privateRoom === true ? 'Declared' : hp.offers.privateRoom === false ? 'Not available (declared)' : 'Not specified. Requires investigation.'],
            ['Possible visiting providers', ranked.map((r) => `${orgName(r.org)}: ${r.ps.map((P) => `${P.name}${P.stops.length ? `, ${uniq(P.stops.map((s) => s.suburb)).join(', ')}` : ''} (${P.pattern})`).join('; ')}`).join(' | ')],
            ['Service area', ranked.map((r) => `${orgName(r.org)} lists ${site.suburb}`).join('; ')],
            ['Outreach capability', ranked.map((r) => `${orgName(r.org)}: ${r.visitCap === true ? 'visiting sessions declared' : r.visitCap === false ? 'does not offer visiting sessions (declared)' : 'not specified, requires investigation'}`).join('; ')],
            ['Declared interests', declaredNotes.join('; ') || 'None recorded']
          ],
          graphic: { kind: 'pair', a: { cat: hostProgs[0] ? hostProgs[0].cat : cat, org: host, mode: 'fixed' }, b: { cat, org: lead.org, mode: 'fixed' } }
        });
      });
    });

    /* 7. Coordinated referral pathways */
    {
      const basicProgs = [...progs.values()].filter((P) => BASIC.has(P.cat));
      groupBy(basicProgs, (P) => P.org).forEach((ps, org) => {
        const locs = ps.flatMap((P) => P.stops);
        const partners = new Map();
        [...allProgs.values()].filter((Q) => SUPPORT.has(Q.cat) && Q.org !== org).forEach((Q) => {
          let best = null;
          Q.stops.forEach((qs) => locs.forEach((ls) => {
            const d = distanceM(qs.loc, ls.loc);
            if (d <= REFERRAL_M && (!best || d < best.d)) best = { d: Math.round(d), qs, ls };
          }));
          if (!best) return;
          const cur = partners.get(Q.cat);
          if (!cur || best.d < cur.best.d) partners.set(Q.cat, { Q, best });
        });
        if (partners.size < 2) return;
        const list2 = [...partners.values()].sort((x, y) => x.best.d - y.best.d);
        add({
          id: `referral|${org}`, type: 'referral', status: 'potential',
          title: `${orgName(org)} could strengthen referral pathways with ${plural(list2.length, 'nearby support service')}`,
          summary: `${cap(listText(list2.map((p) => category(p.Q.cat).label.toLowerCase())))} operate within ${(REFERRAL_M / 1000).toFixed(1)} km of where ${orgName(org)} delivers ${serviceList(ps)}.`,
          location: uniq(locs.map((l) => `${l.name}, ${l.suburb}`)).slice(0, 3).join('; '),
          window: `${orgName(org)}: ${ps.map((P) => `${P.name} (${P.pattern})`).join('; ')}`,
          when: `Ongoing, during ${orgName(org)}'s existing sessions`,
          declared: interested(org, 'referral') ? [`${orgName(org)} is interested in referral partnerships (declared)`] : [],
          benefit: 'People seeking basic support could be connected more easily with housing, legal, health or wellbeing help.',
          why: `Complementary support services operate within ${(REFERRAL_M / 1000).toFixed(1)} km (straight line, illustrative) during this period. No formal referral relationship is recorded.`,
          orgIds: [org, ...list2.map((p) => p.Q.org)], categories: [...ps.map((P) => P.cat), ...list2.map((p) => p.Q.cat)],
          suburbs: locs.map((l) => l.suburb),
          parties: [
            { org, role: 'Basic support provider', mode: ps.every((P) => P.mode === 'mobile') ? 'mobile' : 'fixed', programs: ps.map(progBrief) },
            ...list2.map((p) => ({ org: p.Q.org, role: `${category(p.Q.cat).label}, about ${(p.best.d / 1000).toFixed(1)} km away`, mode: p.Q.mode, programs: [progBrief(p.Q)] }))
          ],
          facts: [
            ['Starting organisation', `${orgName(org)}: ${ps.map((P) => `${P.name} (${P.pattern})`).join('; ')}`],
            ['Nearby complementary services', list2.map((p) => `${category(p.Q.cat).label}: ${p.Q.name}, ${orgName(p.Q.org)}, ${p.best.qs.name}, ${p.best.qs.suburb} (${p.Q.pattern}), about ${(p.best.d / 1000).toFixed(1)} km`).join(' | ')],
            ['Referral relationship', 'None recorded. This is a possibility only.']
          ],
          graphic: { kind: 'hub', center: orgName(org), centerCat: ps[0].cat, nodes: list2.map((p) => ({ org: p.Q.org, cat: p.Q.cat, mode: p.Q.mode, at: false })) }
        });
      });
    }

    /* 8. Collaborating on programs (courses, workshops and intakes)
     *    One program and one intake, however many sessions it has. */
    {
      const courses = [...progs.values()].filter((P) => (programById.get(P.id) || {}).programType === 'fixed_term');
      const intakeOf = (p) => (p.intakes || []).find((it) => it.commencementDate <= opt.to && it.completionDate >= opt.from) || (p.intakes || [])[0];
      courses.forEach((P) => {
        const p = programById.get(P.id);
        const it = intakeOf(p);
        const st = P.stops[0];
        const site = siteById.get(st.siteId);
        const days = it ? `${fmtDate(it.commencementDate)} to ${fmtDate(it.completionDate)}` : P.pattern;
        const courseBrief = Object.assign(progBrief(P), { pattern: p.scheduleText || P.pattern });
        const near = (Q) => Q.stops.length ? Math.min(...Q.stops.map((qs) => distanceM(qs.loc, st.loc))) : null;
        const base = {
          type: 'program', siteId: st.siteId, location: `${st.name}, ${st.suburb}`, suburbs: [st.suburb],
          intake: it || null, courseId: P.id
        };

        // a) Guest specialist sessions during the course.
        const guests = [];
        const seenOrg = new Set([P.org]);
        const wanted = prof(P.org).wants.categories;
        const guestProgs = (DATA.programs || []).filter((q) => GUEST_CATS.has(q.category) && q.organisationId !== P.org)
          .map((q) => ({ q, Q: allProgs.get(q.programId) }))
          .filter(({ q }) => servesSuburb(q.organisationId, st.suburb) && (prof(q.organisationId).offers.visitingSpecialist === true || interested(q.organisationId, 'program')))
          .sort((x, y) => (Number(wanted.includes(y.q.category)) - Number(wanted.includes(x.q.category))) || (Number(interested(y.q.organisationId, 'program')) - Number(interested(x.q.organisationId, 'program'))));
        guestProgs.forEach(({ q, Q }) => {
          if (guests.length >= 3 || seenOrg.has(q.organisationId) || guests.some((g) => g.q.category === q.category)) return;
          seenOrg.add(q.organisationId);
          guests.push({ q, Q });
        });
        if (guests.length) {
          const allDeclared = interested(P.org, 'program') && guests.every((g) => interested(g.q.organisationId, 'program') || prof(g.q.organisationId).offers.visitingSpecialist === true);
          const topics = guests.map((g) => category(g.q.category).label.toLowerCase());
          add(Object.assign({}, base, {
            id: `program|guest|${P.id}`, status: allDeclared ? 'potential' : 'investigate',
            title: `Guest specialist session${guests.length > 1 ? 's' : ''} during ${P.name}`,
            summary: `${listText(guests.map((g) => orgName(g.q.organisationId)))} could each present one session on ${listText(topics)} to course participants.`,
            window: `${P.name}: ${p.scheduleText || P.pattern}`,
            when: `During the course, ${days}`,
            benefit: `Participants could learn about ${listText(topics)} from a trusted setting, without a separate appointment.`,
            why: `The course runs for ${plural(p.durationWeeks || P.segs.length, 'week')} with the same group of participants. These providers list ${st.suburb} in their service area and have declared visiting or program capability.`,
            declared: [interested(P.org, 'program') ? `${orgName(P.org)} is interested in program partners (declared)` : '', ...guests.map((g) => (interested(g.q.organisationId, 'program') ? `${orgName(g.q.organisationId)}: program partner (declared)` : `${orgName(g.q.organisationId)}: visiting sessions (declared)`))].filter(Boolean),
            orgIds: [P.org, ...guests.map((g) => g.q.organisationId)], categories: [P.cat, ...guests.map((g) => g.q.category)],
            parties: [
              { org: P.org, role: 'Course provider', mode: 'fixed', programs: [courseBrief] },
              ...guests.map((g) => ({ org: g.q.organisationId, role: `Possible guest presenter (${category(g.q.category).label.toLowerCase()})`, mode: g.q.deliveryMode, programs: [g.Q ? progBrief(g.Q) : { id: g.q.programId, name: g.q.programName, org: g.q.organisationId, cat: g.q.category, mode: g.q.deliveryMode, pattern: g.q.scheduleText, statuses: [] }] }))
            ],
            facts: [
              ['Course', `${P.name}, ${orgName(P.org)}`],
              ['Intake', it ? O.intakeText(it) : 'Not specified'],
              ['Entry', (O.DATA.lookups.entryRequirements[p.entryRequirement] || 'Not specified')],
              ['Where', `${st.name}, ${st.suburb}${site && site.hostOrganisationId && site.hostOrganisationId !== P.org ? ` (hosted by ${orgName(site.hostOrganisationId)})` : ''}`],
              ['Possible guest topics', guests.map((g) => `${category(g.q.category).label}: ${orgName(g.q.organisationId)}`).join('; ')],
              ['Session counts', `${plural(P.segs.length, 'session')} of one intake recorded in this period. Course sessions are not separate programs or separate enrolment opportunities.`]
            ],
            graphic: { kind: 'hub', center: P.name, centerCat: P.cat, nodes: guests.map((g) => ({ org: g.q.organisationId, cat: g.q.category, mode: g.q.deliveryMode, at: false })) }
          }));
        }

        // b) A referral pathway for participants after the course finishes.
        const after = (DATA.programs || []).filter((q) => PATHWAY_CATS.has(q.category) && q.organisationId !== P.org && q.programId !== P.id
          && (q.programType === 'rolling' || q.programType === 'drop_in' || q.entryRequirement === 'join_anytime'))
          .map((q) => ({ q, Q: allProgs.get(q.programId) }))
          .filter(({ q, Q }) => Q && (servesSuburb(q.organisationId, st.suburb) || (near(Q) != null && near(Q) <= REFERRAL_M)))
          .slice(0, 3);
        if (after.length) {
          add(Object.assign({}, base, {
            id: `program|pathway|${P.id}`, status: 'potential',
            title: `A next step for participants after ${P.name}`,
            summary: `${listText(after.map(({ Q }) => `${Q.name} (${orgName(Q.org)})`))} can be joined at any time, so participants could be referred on when the course finishes.`,
            window: after.map(({ Q }) => `${Q.name}: ${Q.pattern}`).join('; '),
            when: it ? `After the course finishes on ${fmtDate(it.completionDate)}` : 'After the course finishes',
            benefit: 'Participants could keep building skills with a known next step, rather than finishing with no connection.',
            why: `These programs accept people at any time and operate in or near ${st.suburb}. No referral arrangement is recorded.`,
            declared: [interested(P.org, 'referral') ? `${orgName(P.org)} is interested in referral partners (declared)` : '', ...after.map(({ q }) => (interested(q.organisationId, 'program') || interested(q.organisationId, 'referral') ? `${orgName(q.organisationId)} is interested in program or referral partners (declared)` : ''))].filter(Boolean),
            orgIds: [P.org, ...after.map(({ q }) => q.organisationId)], categories: [P.cat, ...after.map(({ q }) => q.category)],
            parties: [
              { org: P.org, role: 'Course provider', mode: 'fixed', programs: [courseBrief] },
              ...after.map(({ Q }) => ({ org: Q.org, role: `Next-step program (${category(Q.cat).label.toLowerCase()})`, mode: Q.mode, programs: [progBrief(Q)] }))
            ],
            facts: [
              ['Course', `${P.name}, ${orgName(P.org)}: ${p.scheduleText || P.pattern}`],
              ['Next-step programs', after.map(({ q, Q }) => `${Q.name}, ${orgName(Q.org)} (${O.DATA.lookups.entryRequirements[q.entryRequirement] || (O.DATA.lookups.programTypes[q.programType] || {}).label || 'entry not specified'}): ${Q.pattern}`).join(' | ')],
              ['Referral relationship', 'None recorded. This is a possibility only.']
            ],
            graphic: { kind: 'pair', a: { cat: P.cat, org: P.org, mode: 'fixed' }, b: { cat: after[0].Q.cat, org: after[0].Q.org, mode: after[0].Q.mode } }
          }));
        }

        // c) Coordinated commencement with another course in the same suburb.
        courses.filter((C) => C.id > P.id && C.org !== P.org && C.stops[0].suburb === st.suburb).forEach((C) => {
          const c = programById.get(C.id);
          const ci = intakeOf(c);
          const sameWeek = it && ci && Math.abs(O.daysBetween(it.commencementDate, ci.commencementDate)) <= 7;
          const clash = P.segs.some((s) => C.segs.some((t) => s.date === t.date && s.start < t.end && t.start < s.end));
          add(Object.assign({}, base, {
            id: `program|start|${P.id}|${C.id}`, status: 'potential', courseId: P.id,
            title: `Coordinate start dates for ${P.name} and ${C.name}`,
            summary: `Both courses run in ${st.suburb}${sameWeek ? ' and start in the same week' : ''}. ${clash ? 'Some sessions run at the same time.' : 'Their sessions do not clash, so people could attend both.'}`,
            window: `${P.name}: ${p.scheduleText || P.pattern}; ${C.name}: ${c.scheduleText || C.pattern}`,
            when: it && ci ? `Next intakes: ${fmtDate(it.commencementDate)} and ${fmtDate(ci.commencementDate)}` : 'Next intakes',
            benefit: 'Coordinated dates and shared promotion could help people take part in both courses.',
            why: `Two fixed-term courses with set start dates are recorded in the same suburb. Participants must commence at the start${c.entryRequirement === 'provider_approval' ? ' (late entry by provider approval for one course)' : ''}, so start dates matter.`,
            declared: [interested(P.org, 'program') ? `${orgName(P.org)}: program partners (declared)` : '', interested(C.org, 'program') ? `${orgName(C.org)}: program partners (declared)` : ''].filter(Boolean),
            orgIds: [P.org, C.org], categories: [P.cat, C.cat], suburbs: [st.suburb, C.stops[0].suburb],
            parties: [
              { org: P.org, role: 'Course provider', mode: 'fixed', programs: [courseBrief] },
              { org: C.org, role: 'Course provider', mode: 'fixed', programs: [Object.assign(progBrief(C), { pattern: c.scheduleText || C.pattern })] }
            ],
            facts: [
              ['Courses', `${P.name} (${it ? O.intakeText(it) : 'intake not specified'}); ${C.name} (${ci ? O.intakeText(ci) : 'intake not specified'})`],
              ['Sessions at the same time', clash ? 'Yes, on some dates' : 'No']
            ],
            graphic: { kind: 'pair', a: { cat: P.cat, org: P.org, mode: 'fixed' }, b: { cat: C.cat, org: C.org, mode: 'fixed' } }
          }));
        });
      });
    }

    // Relevance to the selected geography, service types and agency.
    const sel = opt.categories;
    const catOK = (o) => {
      if (!sel || sel.size === 0) return true;
      return opt.includeComplementary ? o.categories.some((c) => sel.has(c)) : o.categories.every((c) => sel.has(c));
    };
    const geoOK = (o) => opt.suburb === 'all' || o.suburbs.includes(opt.suburb);
    const orgOK = (o) => !opt.orgId || o.orgIds.includes(opt.orgId);
    const statusRank = { existing: 0, potential: 1, investigate: 2 };
    return out.filter((o) => catOK(o) && geoOK(o) && orgOK(o))
      .sort((x, y) => (x.typeInfo.n - y.typeInfo.n) || (statusRank[x.status] - statusRank[y.status]) || (y.orgIds.length - x.orgIds.length));
  }

  /* ------------------------------------------------------------------ */
  /* Community Hub Builder: potential partners for a host and services    */
  /* ------------------------------------------------------------------ */

  // host: { siteId?, org?, suburb, loc:{latitude,longitude}, council }. cats: service types wanted.
  // Only organisations recorded in the dataset are returned; missing categories stay empty.
  function hubPartners(host, cats, opt) {
    const segs = buildOccurrences(activities).segments.filter((s) => s.date >= opt.from && s.date <= opt.to);
    const all = programsOf(segs);
    const hostCats = host.siteId ? uniq(segs.filter((s) => s.a.siteId === host.siteId).map((s) => s.a.category)) : [];
    const councilSubs = Object.keys(SUBURB_COUNCIL).filter((s) => SUBURB_COUNCIL[s].council === host.council);
    const out = new Map();
    cats.forEach((cat) => {
      const list = [];
      (DATA.programs || []).filter((p) => p.category === cat && p.organisationId !== host.org).forEach((p) => {
        const org = p.organisationId;
        const P = all.get(p.programId);
        const pr = prof(org);
        const atSite = !!(host.siteId && P && P.stops.some((st) => st.siteId === host.siteId));
        const d = P && P.stops.length ? Math.round(Math.min(...P.stops.map((st) => distanceM(st.loc, host.loc)))) : null;
        const serves = servesSuburb(org, host.suburb);
        const inCouncil = (P && P.segs.some((s) => councilOf(s.a) === host.council)) || ((orgById.get(org) || {}).areasServed || []).some((s) => councilSubs.includes(s));
        const mobile = p.deliveryMode === 'mobile' || pr.offers.mobileDelivery === true;
        const visiting = pr.offers.visitingSpecialist === true;
        const hub = pr.wants.interests.includes('hub');
        const seeksHost = pr.wants.interests.includes('hosts');
        const wantsHere = pr.wants.categories.some((c) => hostCats.includes(c));
        if (!atSite && !serves && !inCouncil) return;
        const reasons = [];
        if (atSite) reasons.push('Already delivers at this site');
        if (serves) reasons.push(`Lists ${host.suburb} in its service area`);
        if (d != null && !atSite) reasons.push(d <= NEAR_M ? `Already operates ${fmtKm(d)} away` : d <= REFERRAL_M ? `Operates ${fmtKm(d)} away` : `Nearest recorded location is ${fmtKm(d)} away`);
        if (p.deliveryMode === 'mobile') reasons.push('Mobile service that already travels to community locations');
        if (visiting) reasons.push('Can deliver visiting specialist sessions (declared)');
        if (hub) reasons.push('Interested in community hub partnerships (declared)');
        if (seeksHost) reasons.push('Looking for sites to host its services (declared)');
        if (wantsHere) reasons.push('Wants to connect with services already at this site (declared)');
        const unknowns = [];
        if (!pr.hasProfile) unknowns.push('Collaboration interests not specified');
        if (!atSite && !mobile && !visiting) unknowns.push('Outreach capability not recorded');
        if (!P) unknowns.push(p.publicSchedule === false ? 'Times and locations not published' : 'No sessions recorded in this period');
        const fit = atSite ? 'existing' : (serves && (mobile || visiting || hub || seeksHost)) ? 'strong' : (serves || (d != null && d <= REFERRAL_M && (mobile || visiting))) ? 'possible' : 'investigate';
        const score = (atSite ? 100 : 0) + (hub ? 6 : 0) + (seeksHost ? 4 : 0) + (visiting || mobile ? 5 : 0) + (serves ? 5 : 0) + (wantsHere ? 2 : 0)
          + (d != null ? (d <= NEAR_M ? 3 : d <= REFERRAL_M ? 2 : 0) : 0) + (P ? 1 : 0);
        list.push({
          org, programId: p.programId, name: p.programName, cat, mode: p.deliveryMode, atSite, d, serves, inCouncil,
          locations: P ? uniq(P.stops.map((st) => `${st.name}, ${st.suburb}`)) : [],
          pattern: P ? P.pattern : (p.scheduleText || 'No public schedule recorded'),
          segs: P ? P.segs : [], interests: pr.wants.interests.slice(), hasProfile: pr.hasProfile,
          reasons, unknowns, fit, score, program: p
        });
      });
      // One entry per organisation per service type (its most relevant program).
      const best = new Map();
      list.sort((x, y) => y.score - x.score).forEach((c) => { if (!best.has(c.org)) best.set(c.org, c); });
      out.set(cat, [...best.values()]);
    });
    return out;
  }

  window.OnNowAnalysis = {
    buildOccurrences, sweep, intervalsByDay, peakOf, analyse, profile, concentration, gapsForDay,
    similarOverlaps, categoryGaps, suburbGaps, opportunities, programsOf, patternText, commonRange,
    distanceM, toMin, validDate, groupBy, groupOf, groupLabel, orgName, stopName, hubPartners, facilitiesText, fmtKm,
    NEAR_M, REFERRAL_M, TYPES, STATUSES, CONSIDER, BASIC, SUPPORT
  };
})();
