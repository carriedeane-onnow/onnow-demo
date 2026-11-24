/*
 * OnNow — analysis engine (shared by Service Insights and Reports)
 * ----------------------------------------------------------------
 * Pure calculations on the fictional dataset. No page drawing happens here.
 *   - occurrences, overlap sweeps, peaks, concentration, daily gaps
 *   - similar-service overlaps and recorded category gaps
 *   - seven types of potential collaboration opportunity
 * Everything is calculated from the records. Nothing is hardcoded.
 */
(() => {
  'use strict';

  const O = window.OnNow;
  if (!O) return;
  const { DATA, orgById, programById, siteById, councilOf, suburbsInCouncil, inCats, COUNCILS, SUBURB_COUNCIL,
    fmtRange, fmtDay, weekdayOf, WEEKDAYS, WEEKDAY_PLURAL, plural, listText, category, CATEGORY_IDS } = O;
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
  /* Collaboration opportunities (seven types)                            */
  /* ------------------------------------------------------------------ */

  const NEAR_M = 500;       // illustrative "nearby" distance (straight line)
  const REFERRAL_M = 2500;  // illustrative distance for referral pathways
  const BASIC = new Set(['food_relief', 'community_meals', 'showers_hygiene', 'laundry', 'clothing_assistance']);
  const SUPPORT = new Set(['housing_homelessness', 'legal_assistance', 'mental_health', 'health_clinics', 'social_support', 'english_classes']);

  const TYPES = {
    host:     { n: 1, icon: 'fixedSite', label: 'Fixed site hosting a mobile service', short: 'Host a mobile service' },
    mobile:   { n: 2, icon: 'van',       label: 'Mobile services operating together', short: 'Mobile services together' },
    hub:      { n: 3, icon: 'hub',       label: 'Multi-agency service hub', short: 'Multi-agency hub' },
    hours:    { n: 4, icon: 'schedule',  label: 'Coordinating operating hours', short: 'Coordinate hours' },
    geo:      { n: 5, icon: 'map',       label: 'Coordinating geographic coverage', short: 'Coordinate coverage' },
    visiting: { n: 6, icon: 'agency',    label: 'Fixed organisation hosting a visiting provider', short: 'Visiting provider' },
    referral: { n: 7, icon: 'referral',  label: 'Coordinated referral pathways', short: 'Referral pathways' }
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
    referral: ['interest', 'eligibility', 'consent', 'staffing']
  };
  const NEXT_ACTION = {
    host: 'Arrange an introductory conversation between the host and the mobile provider about whether a visit is practical.',
    mobile: 'Compare current routes and discuss whether a shared stop on the same day is practical.',
    hub: 'Convene an interagency conversation about a possible joint community support day.',
    hours: 'Share current timetables and discuss whether coordinating or staggering hours could extend collective coverage.',
    geo: 'Discuss route coordination using current stop locations and any information about community demand.',
    visiting: 'Ask the provider whether it offers outreach, and whether the host site could accommodate a visiting session.',
    referral: 'Exchange service information and contact points, and discuss a simple referral process.'
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
    const hostedSites = (DATA.sites || []).filter((s) => s.siteType === 'fixed' && s.hostOrganisationId && s.lga === opt.council);
    const out = [];
    const add = (o) => {
      o.typeInfo = TYPES[o.type];
      o.statusInfo = STATUSES[o.status];
      o.considerations = CONSIDER_BY_TYPE[o.type].map((k) => CONSIDER[k]);
      o.nextAction = o.nextAction || NEXT_ACTION[o.type];
      o.orgIds = uniq(o.orgIds);
      o.categories = uniq(o.categories);
      o.suburbs = uniq(o.suburbs);
      out.push(o);
    };

    /* 1. Fixed site hosting a mobile service */
    hostedSites.forEach((site) => {
      const atSite = segs.filter((s) => s.a.siteId === site.siteId);
      const hostSegs = atSite.filter((s) => s.a.organisationId === site.hostOrganisationId);
      if (!hostSegs.length) return;
      const hostProgs = siteServices(hostSegs, progs);
      const hostGroups = new Set(hostProgs.map((p) => p.group));
      const siteGroups = new Set(atSite.map((s) => groupOf(s.a.category)));
      mobile.forEach((P) => {
        if (P.org === site.hostOrganisationId || hostGroups.has(P.group)) return;
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
        if (!near.length) return;
        const dist = Math.round(Math.min(...near.map((s) => distanceM(s.a.location, site.location))));
        const nearDays = uniq(near.map((s) => weekdayOf(s.date)));
        const hostSameDays = hostSegs.filter((h) => nearDays.includes(weekdayOf(h.date)));
        const hostOnDays = siteServices(hostSameDays, progs);
        const windowText = hostOnDays.length
          ? `When ${orgName(P.org)} stops nearby (${patternText(near, P.id)}), ${site.siteName} records ${hostOnDays.map((p) => `${p.name} ${patternText(hostSameDays.filter((h) => (h.a.programId || h.a.activityId) === p.id), p.id).replace(/^[A-Za-z–, ]+?, (?=\d)/, '')}`).join('; ')}. This is a recorded operating window, not an available hosting slot.`
          : `${orgName(P.org)} stops nearby ${patternText(near, P.id)}. ${site.siteName} records no sessions on those days.`;
        add(Object.assign(base, {
          id: `host|${site.siteId}|${P.id}`, status: 'potential', suburbs: [site.suburb, ...near.map((s) => s.a.suburb)],
          title: `${site.siteName} could host ${P.name}`,
          summary: `${orgName(P.org)} already stops about ${dist} m away. ${site.siteName} does not record ${category(P.cat).label.toLowerCase()}.`,
          window: windowText,
          benefit: `People attending ${serviceList(hostProgs)} could also access ${category(P.cat).label.toLowerCase()} in the same visit.`,
          why: `A mobile ${category(P.cat).label.toLowerCase()} service stops within ${NEAR_M} m (straight line) of a fixed site that does not record that service. No visit to the site is recorded.`,
          facts: [
            ['Potential host organisation', orgName(site.hostOrganisationId)],
            ['Fixed site', `${site.siteName}, ${site.suburb}`],
            ['Existing services at the site', hostProgs.map((p) => `${p.name} (${p.pattern})`).join('; ')],
            ['Relevant mobile provider', orgName(P.org)],
            ['Service offered', `${P.name} (${category(P.cat).label})`],
            ['Current nearby stop', `${uniq(near.map((s) => stopName(s.a))).join('; ')}, about ${dist} m away (${patternText(near, P.id)})`],
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
          hosted: !!(site && site.siteType === 'fixed' && site.hostOrganisationId),
          orgs: uniq(members.map((m) => m.P.org)),
          groups: uniq(members.map((m) => m.P.group))
        };
      }).filter((x) => x.orgs.length >= 3 && x.groups.length >= 3);
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
        add({
          id: `hub|${x.key}`, type: 'hub', status: 'potential',
          title: `${x.orgs.length} organisations could investigate a shared community support day ${x.hosted ? 'at' : 'near'} ${x.name}`,
          summary: `${cap(listText(uniq(nodes.flatMap((n) => n.cats)).map((c) => category(c).label.toLowerCase())))} are all delivered at or within ${NEAR_M} m of ${x.name}.`,
          location: `${x.name}, ${x.a.suburb}`,
          window: bestDay ? `${WEEKDAY_PLURAL[bestDay[0]]}: ${bestDay[1].size} of these ${x.orgs.length} organisations already operate at or near this location.` : '',
          benefit: 'People could access several essential services in one place, and organisations could share information about each other\'s services.',
          why: `${x.orgs.length} distinct organisations deliver ${x.groups.length} different kinds of service within ${NEAR_M} m (straight line) of one location. ${atSite.length >= 2 ? `${atSite.length} already deliver at this location itself.` : 'Most deliver nearby rather than at this location.'}`,
          orgIds: x.orgs, categories: nodes.flatMap((n) => n.cats), suburbs: [x.a.suburb, ...x.members.flatMap((m) => m.near.map((s) => s.a.suburb))],
          hub: { name: x.name, hosted: x.hosted, host: x.site && x.site.hostOrganisationId },
          parties: nodes.map((n) => ({ org: n.org, role: n.at ? 'Already delivers at this location' : `Delivers about ${n.d} m away`, mode: n.mode, programs: n.programs })),
          facts: [
            ['Shared location', `${x.name}, ${x.a.suburb}${x.hosted ? ` (operated by ${orgName(x.site.hostOrganisationId)})` : ''}`],
            ['Already delivering at this location', atSite.length ? atSite.map((n) => orgName(n.org)).join('; ') : 'None recorded'],
            ['Delivering nearby', nodes.filter((n) => !n.at).map((n) => `${orgName(n.org)} (about ${n.d} m)`).join('; ') || 'None'],
            ['Compatible operating pattern', bestDay ? `${WEEKDAY_PLURAL[bestDay[0]]}: ${listText([...bestDay[1]].map(orgName))}` : 'No shared weekday recorded']
          ],
          graphic: { kind: 'hub', center: x.name, nodes: nodes.map((n) => ({ org: n.org, cat: n.cats[0], mode: n.mode, at: n.at })) }
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
      SUPPORT.forEach((cat) => {
        if (siteGroups.has(groupOf(cat))) return;
        const candidates = [...allProgs.values()].filter((P) => P.cat === cat && P.mode !== 'mobile' && P.org !== site.hostOrganisationId);
        const byOrg = groupBy(candidates, (P) => P.org);
        const ranked = [...byOrg.entries()].map(([org, ps]) => {
          const o = orgById.get(org) || {};
          const servesSuburb = (o.areasServed || []).includes(site.suburb);
          const inCouncil = ps.some((P) => P.segs.some((s) => councilOf(s.a) === opt.council));
          const d = Math.round(Math.min(...ps.flatMap((P) => P.stops.map((st) => distanceM(st.loc, site.location)))));
          return { org, ps, servesSuburb, inCouncil, d };
        }).filter((r) => r.servesSuburb) // the provider's recorded service area includes the host suburb
          .sort((x, y) => (Number(y.servesSuburb) - Number(x.servesSuburb)) || (x.d - y.d)).slice(0, 2);
        if (!ranked.length) return;
        const lead = ranked[0];
        const gapHere = !councilCats.has(cat);
        add({
          id: `visiting|${site.siteId}|${cat}`, type: 'visiting', status: 'investigate',
          title: `${orgName(lead.org)} could investigate a visiting ${category(cat).label.toLowerCase()} session at ${site.siteName}`,
          summary: `${site.siteName} records ${serviceList(hostProgs)} but no ${category(cat).label.toLowerCase()}.${gapHere ? ` No ${category(cat).label.toLowerCase()} sessions are recorded anywhere in ${COUNCILS[opt.council].name} in this period.` : ''}`,
          location: `${site.siteName}, ${site.suburb}`,
          window: `${site.siteName} currently records: ${hostProgs.map((p) => `${p.name} (${p.pattern})`).join('; ')}. A recorded operating window is not an available slot.`,
          benefit: `People already visiting ${site.siteName} could access ${category(cat).label.toLowerCase()} without travelling to ${lead.ps[0].stops[0].suburb}.`,
          why: `${orgName(lead.org)} delivers ${category(cat).label.toLowerCase()} at a fixed location${lead.servesSuburb ? ` and lists ${site.suburb} in its service area` : ` in ${COUNCILS[opt.council].name}`}. Whether it offers outreach is not recorded.`,
          orgIds: [site.hostOrganisationId, ...ranked.map((r) => r.org)], categories: [cat, ...hostProgs.map((p) => p.cat)], suburbs: [site.suburb],
          gapHere,
          parties: [
            { org: site.hostOrganisationId, role: 'Potential host site', mode: 'fixed', programs: hostProgs.map(progBrief) },
            ...ranked.map((r) => ({ org: r.org, role: `Potential visiting provider (about ${(r.d / 1000).toFixed(1)} km away)`, mode: 'fixed', programs: r.ps.map(progBrief) }))
          ],
          facts: [
            ['Potential host site', `${site.siteName}, ${site.suburb} (${orgName(site.hostOrganisationId)})`],
            ['Existing services at the site', hostProgs.map((p) => `${p.name} (${p.pattern})`).join('; ')],
            ['Possible visiting providers', ranked.map((r) => `${orgName(r.org)}: ${r.ps.map((P) => `${P.name}, ${P.stops.map((s) => s.suburb).join(', ')} (${P.pattern})`).join('; ')}`).join(' | ')],
            ['Service area', ranked.map((r) => `${orgName(r.org)} ${r.servesSuburb ? `lists ${site.suburb}` : `does not list ${site.suburb}`}`).join('; ')],
            ['Outreach capability', 'Not recorded. Requires investigation.']
          ],
          graphic: { kind: 'pair', a: { cat: hostProgs[0] ? hostProgs[0].cat : cat, org: site.hostOrganisationId, mode: 'fixed' }, b: { cat, org: lead.org, mode: 'fixed' } }
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

  window.OnNowAnalysis = {
    buildOccurrences, sweep, intervalsByDay, peakOf, analyse, profile, concentration, gapsForDay,
    similarOverlaps, categoryGaps, suburbGaps, opportunities, programsOf, patternText, commonRange,
    distanceM, toMin, validDate, groupBy, groupOf, groupLabel, orgName, stopName,
    NEAR_M, REFERRAL_M, TYPES, STATUSES, CONSIDER
  };
})();
