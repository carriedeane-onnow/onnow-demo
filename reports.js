/*
 * OnNow — Reports (council report and agency report)
 * --------------------------------------------------
 * Builds one report model (a list of blocks) from the same calculations used
 * by Service Insights, then:
 *   - shows it as an on-screen preview, and
 *   - downloads it as a genuine, editable Word document (docx.js).
 * Narrative text is generated from the selected records. Nothing is hardcoded.
 */
(() => {
  'use strict';

  const O = window.OnNow;
  const A = window.OnNowAnalysis;
  const G = window.OnNowGraphics;
  if (!O || !A) return;
  const { DATA, esc, catBadge, category, orgById, programById, COUNCILS, SUBURB_COUNCIL, DEMO_DATE, fmtDay, fmtDate, fmtDayLong,
    fmtRange, plural, listText, councilOf, suburbsInCouncil } = O;
  const S = O.state;
  const { activities, organisations, lookups } = DATA;
  const orgName = A.orgName;

  const local = { type: 'council' };
  let dirty = true;
  let current = null;

  const $ = (id) => document.getElementById(id);
  const el = {
    page: $('page-reports'), council: $('rp-council'), suburb: $('rp-suburb'), period: $('rp-period'), from: $('rp-from'), to: $('rp-to'),
    datesFrom: $('rp-dates'), datesTo: $('rp-dates-to'), org: $('rp-org'), orgField: $('rp-org-field'), complement: $('rp-complement'),
    download: $('rp-download'), status: $('rp-status'), preview: $('rp-preview')
  };
  if (!el.page) return;

  const council = () => O.analysisCouncil();
  const suburb = () => (S.suburb !== 'all' && suburbsInCouncil(council()).includes(S.suburb) ? S.suburb : 'all');
  const periodText = () => `${fmtDayLong(S.from)} to ${fmtDayLong(S.to)} (${O.daysBetween(S.from, S.to) + 1} days)`;
  const catsList = () => (S.categories.size ? [...S.categories].map((c) => category(c).label).join(', ') : 'All service types');
  const areaText = () => (suburb() === 'all' ? `All suburbs in ${COUNCILS[council()].name}` : `${suburb()}, ${COUNCILS[council()].name}`);
  const slug = (s) => String(s).replace(/&/g, 'and').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function mainCouncilOf(org) {
    const counts = {};
    activities.filter((a) => a.organisationId === org).forEach((a) => { const c = councilOf(a); if (c) counts[c] = (counts[c] || 0) + 1; });
    return Object.keys(counts).sort((x, y) => counts[y] - counts[x])[0] || council();
  }
  const catCell = (c, extra) => ({ text: `${category(c).label}${extra || ''}`, icon: `cat_${c}`, iconAlt: category(c).label, cat: c });
  const today = () => fmtDayLong(O.toISO(new Date()));

  /* ------------------------------------------------------------------ */
  /* Shared calculations                                                 */
  /* ------------------------------------------------------------------ */

  function calc(orgId) {
    const o = { council: council(), suburb: suburb(), categories: S.categories, from: S.from, to: S.to, includeComplementary: S.includeComplementary, orgId: orgId || null };
    const r = A.analyse(activities, o);
    const prof = A.profile(r.segs);
    const councilSegs = A.buildOccurrences(activities.filter((a) => councilOf(a) === o.council)).segments.filter((s) => s.date >= o.from && s.date <= o.to);
    let similar = A.similarOverlaps(councilSegs, o);
    if (orgId) similar = similar.filter((e) => e.orgIds.includes(orgId));
    const opps = A.opportunities(activities, o);
    const gaps = A.categoryGaps(activities, o);
    const subGaps = A.suburbGaps(activities, o);
    let daysWithGap = 0, daysEmpty = 0, days = 0;
    const byDate = A.groupBy(r.segs, (s) => s.date);
    for (let d = o.from; d <= o.to; d = O.addDays(d, 1)) {
      days++;
      const g = A.gapsForDay(byDate.get(d) || [], 480, 1200);
      if (g.gaps.length) daysWithGap++;
      if (!g.covered.length) daysEmpty++;
    }
    return { o, r, prof, councilSegs, similar, opps, gaps, subGaps, daysWithGap, daysEmpty, days };
  }
  const progName = (id) => (programById.get(id) || {}).programName || (activities.find((a) => (a.programId || a.activityId) === id) || {}).activityName || id;
  const progOrg = (id) => orgName((activities.find((a) => (a.programId || a.activityId) === id) || {}).organisationId);
  const statusCounts = (opps) => { const c = { existing: 0, potential: 0, investigate: 0 }; opps.forEach((x) => { c[x.status] += 1; }); return c; };
  const verif = (segs) => ['provider_confirmed', 'published', 'unverified'].map((id) => [lookups.verificationStatuses[id].label, String(new Set(segs.filter((s) => s.a.verificationStatus === id).map((s) => s.a.activityId)).size)]);
  const disclaimer = 'Fictional demonstration. Every organisation, service, place, contact detail and verification status in this report is made up. Findings are calculated from recorded schedules only. They do not show service use, community demand, capacity or funding efficiency, and potential opportunities are not confirmed partnerships or recommendations.';
  function overlapRows(similar, limit) {
    return similar.slice(0, limit).map((e) => {
      const dates = [...e.dates.keys()].sort();
      const weekdays = O.WEEKDAYS.filter((d) => dates.some((x) => O.weekdayOf(x) === d));
      return [
        e.suburb,
        e.progIds.map((id) => `${progName(id)} (${progOrg(id)})`).join('\n'),
        e.window,
        `${plural(e.dates.size, 'date')}: ${weekdays.join(', ')}, first ${fmtDay(dates[0])}`,
        A.groupLabel(e.group)
      ];
    });
  }
  function oppBlocks(o, full) {
    const blocks = [{ t: 'h3', text: o.title }];
    const rows = [
      ['Status', o.statusInfo.label],
      ['Organisations', [...new Set(o.parties.map((p) => p.org))].map(orgName).join('; ')],
      ['Location', o.location],
      ['Operating times', o.window],
      ['Why identified', o.why],
      ['What to investigate', o.nextAction]
    ];
    if (full) {
      rows.splice(2, 0, ['Services involved', o.parties.flatMap((p) => p.programs.map((pr) => `${pr.name} (${category(pr.cat).label}, ${pr.mode === 'mobile' ? 'mobile' : 'fixed'})`)).join('; ')]);
      rows.splice(4, 0, ['Current operating schedules', o.parties.flatMap((p) => p.programs.map((pr) => `${pr.name}: ${pr.pattern}`)).join('\n')]);
      rows.splice(5, 0, ['Possible arrangement', o.summary]);
      rows.splice(6, 0, ['Potential community benefit', o.benefit]);
      rows.push(['Matters requiring discussion', o.considerations.join('\n')]);
    }
    blocks.push({ t: 'kv', rows });
    if (o.caution) blocks.push({ t: 'note', text: o.caution });
    return blocks;
  }

  /* ------------------------------------------------------------------ */
  /* Council report                                                      */
  /* ------------------------------------------------------------------ */

  function councilReport() {
    const c = calc(null);
    const { r, prof, similar, opps, gaps, subGaps } = c;
    const name = COUNCILS[council()].name;
    const sc = statusCounts(opps);
    const hubOpp = opps.filter((o) => o.type === 'hub').sort((x, y) => y.orgIds.length - x.orgIds.length)[0];
    const topSim = similar[0];
    const blocks = [];
    const images = [];

    blocks.push({
      t: 'cover', logo: 'logo', kicker: 'Council report · fictional demonstration',
      title: 'Social Service Delivery and Collaboration Report', subtitle: name,
      rows: [
        ['Council', name], ['Geographic area', areaText()], ['Reporting period', periodText()], ['Service categories', catsList()],
        ['Complementary service types', S.includeComplementary ? 'Included in collaboration opportunities' : 'Not included'],
        ['Report generated', `${today()} (demonstration reference date ${fmtDate(DEMO_DATE)})`]
      ],
      note: disclaimer
    });

    // 1. Executive summary
    blocks.push({ t: 'h1', text: '1. Executive summary' });
    const exec = [
      `Service delivery profile: ${plural(prof.occurrences, 'scheduled session')} from ${plural(prof.programs, 'unique program')}, delivered by ${plural(prof.organisations, 'organisation')} at ${plural(prof.sites, 'physical location')} (${prof.fixedPrograms} fixed-site and ${prof.mobilePrograms} mobile programs).`,
      topSim
        ? `Recurring overlaps: ${plural(similar.length, 'pattern')} of similar services running at the same time in the same suburb. The most frequent is in ${topSim.suburb}, where ${listText(topSim.progIds.map((id) => `${progName(id)} (${progOrg(id)})`))} overlap ${topSim.window} on ${plural(topSim.dates.size, 'date')}.`
        : 'Recurring overlaps: no similar services by different organisations are recorded at the same time in the same suburb.',
      `Collaboration: ${plural(opps.length, 'collaboration opportunity', 'collaboration opportunities')} identified (${sc.existing} existing complementary delivery, ${sc.potential} potential collaboration, ${sc.investigate} requiring further investigation).${hubOpp ? ` The largest multi-agency opportunity involves ${plural(hubOpp.orgIds.length, 'organisation')} around ${hubOpp.location}.` : ''}`,
      gaps.length
        ? `Recorded coverage gaps: no ${listText(gaps.map((g) => category(g.category).label.toLowerCase()))} sessions are recorded in ${name} for this period.`
        : `Recorded coverage gaps: every ${S.categories.size ? 'selected ' : ''}service type recorded in either council has at least one session here in this period.`,
      `Matters requiring further investigation: ${sc.investigate ? `${plural(sc.investigate, 'opportunity', 'opportunities')} depend on information not recorded in OnNow, such as outreach capability or site suitability.` : 'none flagged.'} Recorded schedules do not show demand, capacity or funding conditions.`
    ];
    blocks.push({ t: 'bullets', items: exec });

    // 2. Service delivery profile
    blocks.push({ t: 'h1', text: '2. Service delivery profile' });
    blocks.push({ t: 'kv', rows: [
      ['Organisations', `${prof.organisations} (each counted once)`],
      ['Unique programs', `${prof.programs} (a weekly or mobile program counts once)`],
      ['Physical delivery locations', `${prof.sites} (fixed sites and mobile stops)`],
      ['Scheduled occurrences', `${prof.occurrences} dated sessions`],
      ['Fixed-site delivery', `${prof.fixedPrograms} programs · ${prof.fixedSessions} sessions`],
      ['Mobile delivery', `${prof.mobilePrograms} programs · ${prof.mobileSessions} sessions`]
    ] });
    blocks.push({ t: 'h2', text: 'Service categories' });
    blocks.push({ t: 'table', head: ['Service category', 'Sessions', 'Programs', 'Organisations'], widths: [0.46, 0.18, 0.18, 0.18],
      rows: prof.byCategory.sort((x, y) => y.occurrences - x.occurrences).map((x) => [catCell(x.category), String(x.occurrences), String(x.programs), String(x.organisations)]) });
    blocks.push({ t: 'p', text: 'A scheduled occurrence is one dated session. A program is one service run by one organisation, counted once however often it runs or however many places it visits.' });

    // 3. Geographic distribution
    blocks.push({ t: 'h1', text: '3. Geographic distribution' });
    if (prof.bySuburb.length) {
      const topSub = prof.bySuburb[0];
      blocks.push({ t: 'p', text: `Recorded sessions are spread across ${plural(prof.bySuburb.length, 'suburb')}. ${topSub.suburb} records the most (${topSub.occurrences} sessions, ${Math.round((topSub.occurrences / Math.max(1, prof.occurrences)) * 100)}% of the total) from ${plural(topSub.organisations, 'organisation')}.` });
      blocks.push({ t: 'table', head: ['Suburb', 'Sessions', 'Programs', 'Organisations', 'Locations', 'Service categories'], widths: [0.18, 0.11, 0.11, 0.14, 0.12, 0.34],
        rows: prof.bySuburb.map((x) => [x.suburb, String(x.occurrences), String(x.programs), String(x.organisations), String(x.sites), x.categories.map((k) => category(k).label).join(', ')]) });
    } else blocks.push({ t: 'p', text: 'No sessions are recorded for this selection.' });
    const empty = subGaps.filter((x) => x.occurrences === 0).map((x) => x.suburb);
    if (empty.length) blocks.push({ t: 'p', text: `Suburbs with no recorded sessions for the selected service types: ${empty.join(', ')}.` });
    blocks.push({ t: 'p', runs: [{ text: 'Maps are available in Service Insights. ', i: true }, { text: 'Counts show where sessions are delivered, not where people live or which council funds a service.', i: true }] });

    // 4. Overlap analysis
    blocks.push({ t: 'h1', text: '4. Service overlap analysis' });
    blocks.push({ t: 'p', text: 'Same-suburb overlap means similar services (food relief and community meals are treated as similar) run by different organisations at the same time in the same suburb. A session that ends when another starts does not overlap. Overlap is a scheduling pattern and does not imply duplication or waste.' });
    if (similar.length) {
      blocks.push({ t: 'table', head: ['Suburb', 'Services and organisations', 'Usual overlap', 'Frequency', 'Type'], widths: [0.14, 0.38, 0.16, 0.2, 0.12], rows: overlapRows(similar, 10) });
      if (similar.length > 10) blocks.push({ t: 'p', text: `${similar.length - 10} further overlap patterns are listed in Service Insights.` });
    } else blocks.push({ t: 'p', text: 'No same-suburb overlaps of similar services are recorded for this selection.' });
    if (suburb() === 'all' && r.areaPeak) {
      blocks.push({ t: 'h2', text: 'Council-wide concurrency' });
      blocks.push({ t: 'p', text: `At the busiest time, ${plural(r.areaPeak.items.length, 'session')} of the selected service types are scheduled at once somewhere in the council (${fmtDay(r.areaPeak.date)}, ${fmtRange(r.areaPeak.start, r.areaPeak.end)}). These can be in different suburbs and do not share a location, so this is not the same as a local overlap.` });
    }

    // 5. Collaboration opportunities
    blocks.push({ t: 'h1', text: '5. Collaboration opportunities' });
    blocks.push({ t: 'p', text: `${plural(opps.length, 'opportunity', 'opportunities')} identified using transparent matching rules (see section 8). Existing complementary delivery means organisations are already recorded together at the same place and time; it does not establish a formal partnership. Potential opportunities are questions to explore, not recommendations.` });
    Object.keys(A.TYPES).forEach((k) => {
      const list = opps.filter((x) => x.type === k);
      if (!list.length) return;
      const t = A.TYPES[k];
      blocks.push({ t: 'h2', text: `${t.n}. ${t.label} (${list.length})` });
      if (k === 'hub' && list[0]) images.push({ key: `hub_${images.length}`, opp: list[0] });
      if (k === 'hub' && list[0]) blocks.push({ t: 'image', key: `hub_${images.length - 1}`, width: 430, alt: `Diagram: ${list[0].title}`, caption: `${list[0].title}. Rings show organisations already delivering at the location.`, svg: G ? G.hub(list[0].graphic, { bg: true }) : '' });
      list.slice(0, 3).forEach((x) => oppBlocks(x, false).forEach((b) => blocks.push(b)));
      if (list.length > 3) blocks.push({ t: 'p', text: `${list.length - 3} more ${t.short.toLowerCase()} opportunities are listed in Service Insights.` });
    });
    if (!opps.length) blocks.push({ t: 'p', text: 'No collaboration opportunities are identified for this selection.' });

    // 6. Recorded service coverage gaps
    blocks.push({ t: 'h1', text: '6. Recorded service coverage gaps' });
    blocks.push({ t: 'note', text: 'Recorded coverage is not the same as actual service availability. An absence of records does not establish that a service is unavailable or that community demand is unmet.' });
    if (gaps.length) {
      const other = COUNCILS[Object.keys(COUNCILS).find((k) => k !== council())].name;
      blocks.push({ t: 'table', head: ['Service category', 'Recorded in this council', 'Recorded elsewhere', 'Providers listing this council in their service area'], widths: [0.24, 0.18, 0.3, 0.28],
        rows: gaps.map((g) => [catCell(g.category), 'No sessions', g.elsewhere.length ? `${plural(g.elsewhere.length, 'session')} in ${other} (${[...new Set(g.elsewhere.map((s) => s.a.suburb))].join(', ')})` : 'None', g.servesHere.length ? g.servesHere.map((p) => p.organisationName).join('; ') : 'None recorded']) });
    } else blocks.push({ t: 'p', text: 'No service category is entirely absent from the records for this council and period.' });
    blocks.push({ t: 'p', text: `Daily coverage, 8am to 8pm: ${plural(c.daysWithGap, 'day')} of ${c.days} include at least one period with no recorded ${O.catsLabel(S.categories).toLowerCase()} session, and ${plural(c.daysEmpty, 'day')} have none at all.` });

    // 7. Discussion priorities
    blocks.push({ t: 'h1', text: '7. Suggested discussion priorities' });
    blocks.push({ t: 'p', text: 'These are discussion prompts for council officers and interagency networks, not confirmed recommendations.' });
    const q = [];
    const first = (k) => opps.find((x) => x.type === k);
    if (first('hours')) q.push(`Could ${listText(first('hours').orgIds.map(orgName))} share timetables and discuss whether coordinating or staggering hours in ${first('hours').location} could extend collective coverage?`);
    if (first('host')) { const h = opps.find((x) => x.type === 'host' && x.status === 'potential') || first('host'); q.push(`Could ${orgName(h.parties[0].org)} discuss hosting ${h.parties[1].programs[0].name} (${orgName(h.parties[1].org)}) at ${h.location}?`); }
    if (first('mobile')) { const m = opps.find((x) => x.type === 'mobile' && x.status === 'potential') || first('mobile'); q.push(`Could the mobile services near ${m.location} coordinate a shared stop on the same day?`); }
    if (hubOpp) q.push(`Could the ${hubOpp.orgIds.length} organisations around ${hubOpp.location} investigate a joint community support day?`);
    if (first('visiting')) q.push(`Could ${orgName(first('visiting').parties[1].org)} explore a visiting session at ${first('visiting').location}, if outreach is possible?`);
    if (gaps.length) q.push(`How do residents currently reach ${listText(gaps.map((g) => category(g.category).label.toLowerCase()))}, and would providers consider a scheduled session in the council?`);
    if (first('referral')) q.push('Would basic support providers and nearby housing, legal, health and wellbeing services benefit from simple, shared referral information?');
    blocks.push({ t: 'bullets', items: q.length ? q : ['No specific prompts arise from this selection.'] });

    // 8. Data quality and methodology
    blocks.push({ t: 'h1', text: '8. Data quality and methodology' });
    blocks.push({ t: 'kv', rows: [
      ['Reporting period', periodText()], ['Geographic area', areaText()], ['Service categories', catsList()],
      ['Complementary types', S.includeComplementary ? 'Included: opportunities start from the selected services and can involve other service types' : 'Not included: every service in an opportunity is one of the selected types'],
      ...verif(r.segs).map(([k, v]) => [`${k} (fictional)`, `${v} sessions`])
    ] });
    blocks.push({ t: 'bullets', items: [
      'Counting: scheduled occurrences, unique programs, organisations and physical locations are counted separately. Repeated sessions never inflate organisation or program counts.',
      'Cancelled sessions are excluded. Sessions with missing or invalid times are treated as unknown, not as absent.',
      'Times overlap only when they intersect for a positive duration.',
      `Distances are straight lines between fictional map points. "Nearby" means within ${A.NEAR_M} m; referral pathways use ${(A.REFERRAL_M / 1000).toFixed(1)} km. These are illustrative demonstration assumptions. Council membership alone is never used as evidence of proximity.`,
      'Opportunities are grouped so each combination of organisations, programs and sites appears once. No numerical scores or external recommendation services are used.',
      'Limitations: schedules do not show service use, demand, eligibility, capacity, facilities or funding. Missing records do not prove a service does not exist.',
      'All data is fictional and is used for demonstration only.'
    ] });

    const filename = `OnNow-Council-Report_${slug(name)}${suburb() !== 'all' ? `_${slug(suburb())}` : ''}_${S.from}_to_${S.to}.docx`;
    return { title: 'Social Service Delivery and Collaboration Report', subject: name, filename, blocks, images, headerText: `${name} · Fictional demonstration` };
  }

  /* ------------------------------------------------------------------ */
  /* Agency report                                                       */
  /* ------------------------------------------------------------------ */

  function agencyReport() {
    const orgId = S.orgId;
    const org = orgById.get(orgId);
    const c = calc(orgId);
    const { similar, opps } = c;
    const sc = statusCounts(opps);
    const mySegs = c.councilSegs.filter((s) => s.a.organisationId === orgId && (suburb() === 'all' || s.a.suburb === suburb()));
    const progs = [...A.programsOf(mySegs).values()];
    const allProgIds = [...new Set(activities.filter((a) => a.organisationId === orgId).map((a) => a.programId || a.activityId))];
    const fixedLocs = [...new Set(progs.filter((p) => p.mode !== 'mobile').flatMap((p) => p.stops.map((s) => `${s.name}, ${s.suburb}`)))];
    const mobileLocs = [...new Set(progs.filter((p) => p.mode === 'mobile').flatMap((p) => p.stops.map((s) => `${s.name}, ${s.suburb}`)))];
    const blocks = [];
    const images = [];

    blocks.push({
      t: 'cover', logo: 'logo', kicker: 'Agency report · fictional demonstration',
      title: 'Your Service Collaboration Report', subtitle: org.organisationName,
      rows: [
        ['Organisation', `${org.organisationName} (${org.organisationType})`], ['Geography', areaText()], ['Reporting period', periodText()],
        ['Service categories', catsList()], ['Complementary service types', S.includeComplementary ? 'Included' : 'Not included'],
        ['Report generated', `${today()} (demonstration reference date ${fmtDate(DEMO_DATE)})`]
      ],
      note: `${disclaimer} Selecting an organisation does not give access to any private information.`
    });

    // 1. Agency overview
    blocks.push({ t: 'h1', text: '1. Agency overview' });
    blocks.push({ t: 'p', text: org.description });
    blocks.push({ t: 'kv', rows: [
      ['Programs recorded', `${allProgIds.length} in total · ${progs.length} running in this area and period`],
      ['Fixed sites', fixedLocs.length ? fixedLocs.join('\n') : 'None in this period'],
      ['Mobile delivery locations', mobileLocs.length ? mobileLocs.join('\n') : 'None in this period'],
      ['Service categories', [...new Set(progs.map((p) => category(p.cat).label))].join(', ') || 'None in this period'],
      ['Scheduled sessions', `${new Set(mySegs.map((s) => s.a.activityId)).size} in this period`]
    ] });
    if (progs.length) {
      blocks.push({ t: 'table', head: ['Program', 'Delivery', 'Locations', 'Operating schedule', 'Sessions'], widths: [0.26, 0.11, 0.25, 0.28, 0.1],
        rows: progs.map((p) => [catCell(p.cat, `: ${p.name}`), p.mode === 'mobile' ? 'Mobile' : 'Fixed site', p.stops.map((s) => `${s.name}, ${s.suburb}`).join('\n'), p.pattern, String(new Set(p.segs.map((s) => s.a.activityId)).size)]) });
    }

    // 2. Key insights
    blocks.push({ t: 'h1', text: '2. Your key insights' });
    const top = opps.filter((o) => o.status !== 'existing').slice(0, 3);
    blocks.push({ t: 'bullets', items: [
      similar.length
        ? `Similar services overlap with yours on ${plural(new Set(similar.flatMap((e) => [...e.dates.keys()])).size, 'date')}: ${similar.slice(0, 2).map((e) => `${listText(e.progIds.map((id) => `${progName(id)} (${progOrg(id)})`))} in ${e.suburb}, ${e.window}`).join('; ')}.`
        : 'No similar services by other organisations are recorded at the same time and place as yours in this period.',
      sc.existing ? `Existing complementary delivery: ${opps.filter((o) => o.status === 'existing').map((o) => o.title).join('; ')}.` : 'No existing complementary delivery with other organisations is recorded at the same place and time.',
      `${plural(opps.length, 'collaboration opportunity', 'collaboration opportunities')} involve your organisation (${sc.potential} potential, ${sc.investigate} requiring further investigation).`,
      ...top.map((o) => `${o.title}.`)
    ] });

    // 3. Your collaboration opportunities, organised by role
    blocks.push({ t: 'h1', text: '3. Your collaboration opportunities' });
    blocks.push({ t: 'p', text: 'Each opportunity shows potential partners, current schedules and matters to discuss. A recorded operating window is not an available hosting slot, and no arrangement has been confirmed.' });
    const isMobileOrg = progs.length && progs.every((p) => p.mode === 'mobile');
    const roleOf = (o) => {
      if (o.type === 'host') return o.parties[0].org === orgId ? 'Hosting a mobile provider' : 'Visiting an existing community site';
      if (o.type === 'visiting') return o.parties[0].org === orgId ? 'Hosting a visiting specialist service' : 'Offering a visiting service at another site';
      if (o.type === 'hub') return 'Joining a multi-agency service day';
      if (o.type === 'hours') return 'Coordinating schedules with nearby organisations';
      if (o.type === 'mobile') return 'Coordinating with other mobile providers';
      if (o.type === 'geo') return 'Investigating alternative delivery locations';
      return 'Establishing referral pathways';
    };
    const order = isMobileOrg
      ? ['Visiting an existing community site', 'Coordinating with other mobile providers', 'Joining a multi-agency service day', 'Investigating alternative delivery locations', 'Establishing referral pathways', 'Coordinating schedules with nearby organisations', 'Offering a visiting service at another site', 'Hosting a mobile provider', 'Hosting a visiting specialist service']
      : ['Hosting a mobile provider', 'Hosting a visiting specialist service', 'Joining a multi-agency service day', 'Coordinating schedules with nearby organisations', 'Establishing referral pathways', 'Offering a visiting service at another site', 'Visiting an existing community site', 'Coordinating with other mobile providers', 'Investigating alternative delivery locations'];
    const groups = A.groupBy(opps, roleOf);
    let shown = 0;
    order.forEach((role) => {
      const list = groups.get(role);
      if (!list || shown >= 10) return;
      blocks.push({ t: 'h2', text: `${role} (${list.length})` });
      list.slice(0, Math.min(3, 10 - shown)).forEach((o) => {
        if (o.type === 'hub' && !images.length && G) {
          images.push({ key: 'hub_0', opp: o });
          blocks.push({ t: 'image', key: 'hub_0', width: 430, alt: `Diagram: ${o.title}`, caption: `${o.title}. Rings show organisations already delivering at the location.`, svg: G.hub(o.graphic, { bg: true }) });
        }
        oppBlocks(o, true).forEach((b) => blocks.push(b));
        blocks.push({ t: 'p', runs: [{ text: 'Suggested next action: ', b: true }, { text: o.nextAction }] });
        shown++;
      });
      if (list.length > 3) blocks.push({ t: 'p', text: `${list.length - 3} more in Service Insights (Agency view).` });
    });
    if (!opps.length) blocks.push({ t: 'p', text: 'No collaboration opportunities involving this organisation are identified for this selection. Try a longer period, another council or more service types.' });

    // 4. Organisations to connect with
    blocks.push({ t: 'h1', text: '4. Organisations to connect with' });
    const partners = new Map();
    opps.forEach((o) => o.parties.forEach((p) => {
      if (p.org === orgId) return;
      const cur = partners.get(p.org) || { programs: new Map() };
      p.programs.forEach((pr) => cur.programs.set(pr.id, pr));
      partners.set(p.org, cur);
    }));
    if (partners.size) {
      blocks.push({ t: 'note', text: 'Contact details are fictional and made up for this demonstration. Do not call, email or visit.' });
      blocks.push({ t: 'table', head: ['Organisation', 'Programs', 'Delivery locations and times', 'Contact (fictional)'], widths: [0.22, 0.24, 0.32, 0.22],
        rows: [...partners.entries()].map(([id, p]) => {
          const o = orgById.get(id) || {};
          const prs = [...p.programs.values()];
          const locs = activities.filter((a) => a.organisationId === id && prs.some((pr) => pr.id === (a.programId || a.activityId)) && a.date >= S.from && a.date <= S.to);
          const stops = [...new Set(locs.map((a) => `${A.stopName(a)}, ${a.suburb}`))].slice(0, 4);
          return [o.organisationName, prs.map((pr) => `${pr.name} (${category(pr.cat).label})`).join('\n'), `${stops.join('\n')}\n${prs.map((pr) => pr.pattern).join('; ')}`, `${o.phone}\n${o.email}\n${o.website}`];
        }) });
    } else blocks.push({ t: 'p', text: 'No partner organisations are identified for this selection.' });

    // 5. Discussion and action planning (editable)
    blocks.push({ t: 'h1', text: '5. Discussion and action planning' });
    blocks.push({ t: 'p', text: 'Use this table in interagency meetings. Responsibility and target dates are left blank to be agreed.' });
    const actionRows = opps.slice(0, 8).map((o) => [[...new Set(o.parties.map((p) => p.org).filter((x) => x !== orgId))].map(orgName).join('; '), o.title, '', '', '', '']);
    for (let i = 0; i < 3; i++) actionRows.push(['', '', '', '', '', '']);
    blocks.push({ t: 'table', head: ['Potential partner', 'Opportunity to explore', 'Person responsible', 'Next action', 'Target date', 'Outcome or notes'], widths: [0.18, 0.26, 0.14, 0.16, 0.1, 0.16], rows: actionRows, minHeight: 520 });

    // 6. Data limitations
    blocks.push({ t: 'h1', text: '6. Data limitations' });
    blocks.push({ t: 'bullets', items: [
      'This report is based on recorded schedules in a fictional demonstration dataset.',
      'Potential opportunities are not confirmed arrangements. Existing shared delivery does not by itself establish a formal partnership.',
      'Outreach capability, site facilities, availability, capacity, eligibility, demand and funding conditions are not recorded and need to be discussed directly.',
      `Distances are straight lines; "nearby" means within ${A.NEAR_M} m and referral pathways use ${(A.REFERRAL_M / 1000).toFixed(1)} km (illustrative assumptions).`,
      ...verif(mySegs).map(([k, v]) => `${k} (fictional): ${v} of your sessions in this period.`)
    ] });

    const filename = `OnNow-Agency-Report_${slug(org.organisationName)}_${S.from}_to_${S.to}.docx`;
    return { title: 'Your Service Collaboration Report', subject: org.organisationName, filename, blocks, images, headerText: `${org.organisationName} · Fictional demonstration` };
  }

  /* ------------------------------------------------------------------ */
  /* Preview (HTML)                                                      */
  /* ------------------------------------------------------------------ */

  const cellHtml = (cell) => {
    if (cell && typeof cell === 'object') return `<span class="rp-cat">${cell.cat ? catBadge(cell.cat, 24) : ''}${esc(cell.text).replace(/\n/g, '<br>')}</span>`;
    return esc(cell).replace(/\n/g, '<br>');
  };
  const runsHtml = (b) => (b.runs ? b.runs.map((r) => (r.b ? `<strong>${esc(r.text)}</strong>` : r.i ? `<em>${esc(r.text)}</em>` : esc(r.text))).join('') : esc(b.text));
  function renderPreview(model) {
    el.preview.innerHTML = model.blocks.map((b) => {
      switch (b.t) {
        case 'cover': return `<header class="rp-cover"><img src="Colour-Logo-TAG400px.png" alt="OnNow: Instantly connecting communities" width="400" height="235">
          <p class="rp-kicker">${esc(b.kicker)}</p><h1>${esc(b.title)}</h1><p class="rp-sub">${esc(b.subtitle)}</p>
          <table class="rp-kv"><tbody>${b.rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
          <p class="rp-note">${esc(b.note)}</p></header>`;
        case 'h1': return `<h2>${esc(b.text)}</h2>`;
        case 'h2': return `<h3>${esc(b.text)}</h3>`;
        case 'h3': return `<h4>${esc(b.text)}</h4>`;
        case 'p': return `<p>${runsHtml(b)}</p>`;
        case 'note': return `<p class="rp-note">${runsHtml(b)}</p>`;
        case 'bullets': return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
        case 'kv': return `<table class="rp-kv"><tbody>${b.rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${cellHtml(v)}</td></tr>`).join('')}</tbody></table>`;
        case 'table': return `<div class="table-scroll"><table class="rp-table"><thead><tr>${b.head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td${c === '' ? ' class="rp-blank"' : ''}>${cellHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        case 'image': return b.svg ? `<figure class="rp-figure">${b.svg}<figcaption>${esc(b.caption)}</figcaption></figure>` : '';
        default: return '';
      }
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Word download                                                       */
  /* ------------------------------------------------------------------ */

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function logoBytes() {
    try {
      const res = await fetch('Colour-Logo-TAG400px.png');
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
    } catch (e) { /* blocked when opened from a file: use the embedded copy */ }
    return window.ONNOW_LOGO_PNG_BASE64 ? b64ToBytes(window.ONNOW_LOGO_PNG_BASE64) : null;
  }
  // Draw an SVG onto a canvas and return PNG bytes (used for icons and diagrams).
  async function svgToPng(svgText, w, h, scale) {
    const s = scale || 2;
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * s);
    canvas.height = Math.round(h * s);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
  }

  async function buildDocx(model) {
    const images = {};
    const logo = await logoBytes();
    if (logo) images.logo = logo;
    const cats = new Set();
    model.blocks.forEach((b) => {
      const scan = (cell) => { if (cell && typeof cell === 'object' && cell.cat) cats.add(cell.cat); };
      if (b.rows) b.rows.forEach((r) => r.forEach(scan));
    });
    for (const c of cats) {
      try { images[`cat_${c}`] = await svgToPng(O.iconSvgDocument(category(c).icon, category(c).color, 48), 48, 48, 1); } catch (e) { /* icon omitted; text remains */ }
    }
    for (const im of model.images) {
      try {
        const svgText = G.hub(im.opp.graphic, { bg: true });
        const m = /viewBox="0 0 (\d+) (\d+)"/.exec(svgText);
        images[im.key] = await svgToPng(svgText, Number(m[1]), Number(m[2]), 2);
      } catch (e) { /* diagram omitted */ }
    }
    const blocks = model.blocks.filter((b) => b.t !== 'image' || images[b.key]);
    return window.OnNowDocx.build({ title: model.title, subject: model.subject, blocks, images, headerText: model.headerText, footerText: 'Fictional demonstration data. Not for operational use. Generated by OnNow.' });
  }

  async function download() {
    if (!window.OnNowDocx) { setStatus('The Word generator could not load.', 'error'); return; }
    el.download.disabled = true;
    setStatus('Preparing the Word document…');
    try {
      const model = current || build();
      const blob = await buildDocx(model);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = model.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setStatus(`Downloaded ${model.filename} (${Math.round(blob.size / 1024)} KB).`, 'ok');
    } catch (e) {
      setStatus(`The Word document could not be created: ${e.message}`, 'error');
    } finally {
      el.download.disabled = false;
    }
  }
  function setStatus(text, kind) {
    el.status.textContent = text;
    el.status.className = `report-status${kind ? ` is-${kind}` : ''}`;
  }

  /* ------------------------------------------------------------------ */
  /* Controls                                                            */
  /* ------------------------------------------------------------------ */

  function build() {
    if (local.type === 'agency' && !S.orgId) S.orgId = organisations.slice().sort((x, y) => x.organisationName.localeCompare(y.organisationName))[0].organisationId;
    current = local.type === 'agency' ? agencyReport() : councilReport();
    return current;
  }

  function syncControls() {
    document.querySelectorAll('.report-type').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.report === local.type)));
    el.orgField.hidden = local.type !== 'agency';
    el.council.value = council();
    el.suburb.innerHTML = '<option value="all">All suburbs</option>' + suburbsInCouncil(council()).map((s) => `<option value="${esc(s)}">${esc(s)}${SUBURB_COUNCIL[s] && SUBURB_COUNCIL[s].boundary === 'split' ? ' (split suburb)' : ''}</option>`).join('');
    el.suburb.value = suburb();
    el.period.value = S.period;
    el.from.value = S.from;
    el.to.value = S.to;
    el.datesFrom.hidden = S.period !== 'custom';
    el.datesTo.hidden = S.period !== 'custom';
    el.complement.checked = S.includeComplementary;
    if (S.orgId) el.org.value = S.orgId;
    el.download.lastChild.textContent = `Download ${local.type === 'agency' ? 'agency' : 'council'} report (.docx)`;
  }

  function render() {
    syncControls();
    renderPreview(build());
    setStatus('');
    dirty = false;
  }

  function wire() {
    el.council.innerHTML = Object.keys(COUNCILS).map((k) => `<option value="${k}">${esc(COUNCILS[k].name)}</option>`).join('');
    el.org.innerHTML = organisations.slice().sort((x, y) => x.organisationName.localeCompare(y.organisationName))
      .map((o) => `<option value="${o.organisationId}">${esc(o.organisationName)}</option>`).join('');
    O.servicePicker($('rp-services'), $('rp-chips'));
    document.querySelectorAll('.report-type').forEach((b) => b.addEventListener('click', () => {
      local.type = b.dataset.report;
      if (local.type === 'agency') {
        if (!S.orgId) S.orgId = organisations.slice().sort((x, y) => x.organisationName.localeCompare(y.organisationName))[0].organisationId;
        const c = mainCouncilOf(S.orgId);
        if (c !== council()) { O.set({ council: c, suburb: 'all' }, 'reports'); return; }
      }
      render();
    }));
    el.council.addEventListener('change', () => O.set({ council: el.council.value, suburb: 'all' }, 'reports'));
    el.suburb.addEventListener('change', () => O.set({ suburb: el.suburb.value }, 'reports'));
    el.period.addEventListener('change', () => {
      const v = el.period.value;
      if (v === 'custom') O.set({ period: 'custom' }, 'reports');
      else O.set(Object.assign({ period: v }, O.periodFor(v)), 'reports');
    });
    el.from.addEventListener('change', () => { if (A.validDate(el.from.value)) O.set({ from: el.from.value, period: 'custom' }, 'reports'); });
    el.to.addEventListener('change', () => { if (A.validDate(el.to.value)) O.set({ to: el.to.value, period: 'custom' }, 'reports'); });
    el.complement.addEventListener('change', () => O.set({ includeComplementary: el.complement.checked }, 'reports'));
    el.org.addEventListener('change', () => {
      const c = mainCouncilOf(el.org.value);
      O.set({ orgId: el.org.value, council: c, suburb: c === council() ? S.suburb : 'all' }, 'reports');
    });
    el.download.addEventListener('click', download);
  }

  O.on((patch) => {
    const keys = ['council', 'suburb', 'categories', 'period', 'from', 'to', 'includeComplementary', 'orgId'];
    if (!keys.some((k) => k in patch)) return;
    if (S.page === 'reports') render(); else dirty = true;
  });
  O.registerPage('reports', {
    show(opts) {
      if (opts.type) local.type = opts.type;
      else if (S.perspective === 'agency' && S.orgId && dirty) local.type = 'agency';
      render();
    }
  });

  wire();
  window.OnNowReports = { councilReport, agencyReport, buildDocx, build: () => build() };
})();
