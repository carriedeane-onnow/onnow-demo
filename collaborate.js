/*
 * OnNow — Collaborate (default landing page)
 * ------------------------------------------
 *  - Agency perspective: pick your organisation, see your profile, choose how you
 *    would like to collaborate, and see relevant opportunities as simple cards.
 *  - Council perspective: where could we facilitate stronger collaboration?
 *  - Community Hub Builder: host → services → partners → plan → diagram → proposal.
 * Everything is calculated from the fictional records by OnNowAnalysis
 * (analysis.js). Nothing is sent anywhere; profile edits stay in this browser.
 */
(() => {
  'use strict';

  const O = window.OnNow;
  const A = window.OnNowAnalysis;
  const G = window.OnNowGraphics;
  const R = window.OnNowReports;
  const I = window.OnNowInsights;
  if (!O || !A || !G) return;
  const { DATA, esc, svg, badge, catBadge, category, modeTag, orgById, siteById, programById, COUNCILS, SUBURB_COUNCIL,
    councilOf, fmtDay, fmtDate, fmtMin, fmtRange, plural, listText, WEEKDAYS, WEEKDAY_PLURAL, weekdayOf, BRAND } = O;
  const S = O.state;
  const { activities, organisations, lookups } = DATA;
  const orgName = A.orgName;
  const uniq = (a) => [...new Set(a)];
  const $ = (id) => document.getElementById(id);

  const el = {
    page: $('page-collaborate'), org: $('cb-org'), orgField: $('cb-org-field'), council: $('cb-council'), councilField: $('cb-council-field'),
    more: $('cb-more'), morePanel: $('cb-more-panel'), moreCount: $('cb-more-count'), period: $('cb-period'), complement: $('cb-complement'),
    profile: $('cb-profile'), choicesWrap: $('cb-choices-wrap'), choicesTitle: $('cb-choices-title'), choices: $('cb-choices'), moreChoices: $('cb-more-choices'),
    results: $('cb-results'), builder: $('cb-builder'), insights: $('cb-insights'), drawer: $('cb-drawer'), scrim: $('cb-scrim')
  };
  if (!el.page) return;

  const local = {
    path: null, moreOpen: false, limit: 6, editing: false, draft: null, councilTab: 'hub',
    drawerId: null, lastFocus: null
  };
  let dirty = true;
  let opps = [];
  let councilOpps = [];
  let cmap = null;

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  function mainCouncilOf(org) {
    const counts = {};
    activities.filter((a) => a.organisationId === org).forEach((a) => { const c = councilOf(a); if (c) counts[c] = (counts[c] || 0) + 1; });
    const best = Object.keys(counts).sort((x, y) => counts[y] - counts[x])[0];
    if (best) return best;
    const areas = (orgById.get(org) || {}).areasServed || [];
    const hit = areas.map((s) => SUBURB_COUNCIL[s]).find(Boolean);
    return hit ? hit.council : 'Blacktown';
  }
  const agency = () => S.perspective !== 'council';
  const council = () => (agency() && S.orgId ? mainCouncilOf(S.orgId) : O.analysisCouncil());
  const periodSegs = () => A.buildOccurrences(activities).segments.filter((s) => s.date >= S.from && s.date <= S.to);
  const baseOpt = (orgId) => ({ council: council(), suburb: 'all', categories: S.categories, from: S.from, to: S.to, includeComplementary: S.includeComplementary, orgId: orgId || null });
  const ensureOrg = () => { if (!S.orgId || !orgById.get(S.orgId)) S.orgId = 'ORG-017'; };

  // Is a fixed site an established community site? (same rule as the analysis engine)
  function communitySite(site, segs) {
    const cats = segs.filter((s) => s.a.siteId === site.siteId && s.a.organisationId === site.hostOrganisationId).map((s) => s.a.category);
    return cats.some((c) => A.BASIC.has(c)) || !!O.profileOf(site.hostOrganisationId).offers.attendance;
  }
  function siteServices(siteId, segs) {
    return [...A.programsOf(segs.filter((s) => s.a.siteId === siteId)).values()]
      .map((P) => ({ programId: P.id, name: P.name, org: P.org, cat: P.cat, mode: P.mode, pattern: P.pattern }));
  }
  function suburbPoint(sub) {
    const pts = activities.filter((a) => a.suburb === sub);
    if (!pts.length) return { latitude: COUNCILS[council()].center[0], longitude: COUNCILS[council()].center[1] };
    return { latitude: pts.reduce((t, a) => t + a.location.latitude, 0) / pts.length, longitude: pts.reduce((t, a) => t + a.location.longitude, 0) / pts.length };
  }
  const statusPill = (o) => {
    const ico = o.status === 'existing' ? svg('check', { size: 14, stroke: 3.2 }) : o.status === 'investigate' ? svg('search', { size: 14, stroke: 3 }) : svg('handshake', { size: 14, stroke: 2.6 });
    return `<span class="opp-status opp-status--${o.status}">${ico}${esc(o.statusInfo.label)}</span>`;
  };
  const typeBadge = (type, size) => badge(A.TYPES[type].icon, { size: size || 52, color: A.TYPES[type].color });

  /* ------------------------------------------------------------------ */
  /* Collaboration paths (user-friendly, mapped to the matching engine)  */
  /* ------------------------------------------------------------------ */

  const PATHS = {
    hub:        { title: 'Create a community hub', text: 'Bring multiple organisations together to deliver services in one location.', icon: 'hub', color: BRAND.turquoise },
    bring:      { title: 'Bring services to us', text: 'Discover complementary providers who could deliver services at your existing locations.', icon: 'inbound', color: BRAND.cyan },
    take:       { title: 'Take our services to others', text: 'Discover opportunities to deliver outreach at other community locations.', icon: 'outreach', color: BRAND.orange },
    referral:   { title: 'Build referral partnerships', text: 'Connect people with complementary services nearby.', icon: 'referral', color: BRAND.pink },
    coordinate: { title: 'Coordinate service delivery', text: 'Shared mobile stops, geographic coverage and operating hours.', icon: 'schedule', color: BRAND.yellow },
    program:    { title: 'Collaborate on programs', text: 'Guest sessions, coordinated start dates and next steps for courses and workshops.', icon: 'program', color: BRAND.royal }
  };
  const firstParty = (o) => o.parties[0] && o.parties[0].org;
  function inPath(o, path, org) {
    switch (path) {
      case 'hub': return o.type === 'hub';
      case 'bring': return (o.type === 'host' || o.type === 'visiting') && firstParty(o) === org;
      case 'take': return (o.type === 'host' || o.type === 'visiting') && firstParty(o) !== org;
      case 'referral': return o.type === 'referral';
      case 'coordinate': return o.type === 'mobile' || o.type === 'geo' || o.type === 'hours';
      case 'program': return o.type === 'program';
      default: return false;
    }
  }
  // Most relevant first: declared interests, then existing, potential, investigate.
  const rank = { existing: 1, potential: 2, investigate: 3 };
  const relevance = (x, y) => ((y.declared || []).length > 0) - ((x.declared || []).length > 0) || rank[x.status] - rank[y.status] || (y.declared || []).length - (x.declared || []).length;

  /* ------------------------------------------------------------------ */
  /* Controls                                                            */
  /* ------------------------------------------------------------------ */

  function buildControls() {
    el.org.innerHTML = organisations.slice().sort((x, y) => x.organisationName.localeCompare(y.organisationName))
      .map((o) => `<option value="${o.organisationId}">${esc(o.organisationName)}</option>`).join('');
    el.council.innerHTML = Object.keys(COUNCILS).map((k) => `<option value="${k}">${esc(COUNCILS[k].name)}</option>`).join('');
    O.servicePicker($('cb-services'), $('cb-chips'));
  }
  function syncControls() {
    el.page.querySelectorAll('[data-cb-persp]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cbPersp === (agency() ? 'agency' : 'council'))));
    el.orgField.hidden = !agency();
    el.councilField.hidden = agency();
    if (S.orgId) el.org.value = S.orgId;
    el.council.value = O.analysisCouncil();
    el.period.value = S.period === '30' ? '30' : '14';
    el.complement.checked = S.includeComplementary;
    const n = (S.period === '30' ? 1 : 0) + (S.categories.size ? 1 : 0) + (S.includeComplementary ? 0 : 1);
    el.moreCount.hidden = !n;
    el.moreCount.textContent = n;
  }
  function wireControls() {
    el.page.querySelectorAll('[data-cb-persp]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.cbPersp === 'agency') { ensureOrg(); O.set({ perspective: 'agency', council: mainCouncilOf(S.orgId), suburb: 'all' }, 'collaborate'); }
      else O.set({ perspective: 'council', council: O.analysisCouncil(), suburb: 'all' }, 'collaborate');
      local.path = null; closeBuilder(false);
    }));
    el.org.addEventListener('change', () => { local.path = null; local.editing = false; closeBuilder(false); O.set({ orgId: el.org.value, council: mainCouncilOf(el.org.value), suburb: 'all' }, 'collaborate'); });
    el.council.addEventListener('change', () => { closeBuilder(false); O.set({ council: el.council.value, suburb: 'all' }, 'collaborate'); });
    el.period.addEventListener('change', () => O.set(Object.assign({ period: el.period.value }, O.periodFor(el.period.value)), 'collaborate'));
    el.complement.addEventListener('change', () => O.set({ includeComplementary: el.complement.checked }, 'collaborate'));
    el.more.addEventListener('click', () => {
      const open = el.morePanel.hidden;
      el.morePanel.hidden = !open;
      el.more.setAttribute('aria-expanded', String(open));
    });
    el.page.addEventListener('click', onClick);
    el.page.addEventListener('change', onChange);
    el.page.addEventListener('input', onInput);
    el.scrim.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !el.drawer.hidden && S.page === 'collaborate') closeDrawer();
      if (e.key === 'Tab' && !el.drawer.hidden && S.page === 'collaborate') trapFocus(e);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  function compute() {
    if (agency()) ensureOrg();
    councilOpps = A.opportunities(activities, baseOpt(null));
    opps = agency() ? councilOpps.filter((o) => o.orgIds.includes(S.orgId)) : councilOpps;
  }

  function render() {
    compute();
    syncControls();
    if (agency()) { renderProfile(); renderChoices(); renderResults(); renderInsights(); }
    else { renderCouncil(); renderCouncilResults(); el.insights.innerHTML = councilInsightsHtml(); }
    if (hb.open) renderBuilder();
    O.fillIcons(el.page);
    dirty = false;
  }

  /* ---------- Agency profile ---------- */

  function renderProfile() {
    const org = orgById.get(S.orgId);
    const segs = periodSegs().filter((s) => s.a.organisationId === S.orgId);
    const progs = [...A.programsOf(segs).values()];
    const allProgs = (DATA.programs || []).filter((p) => p.organisationId === S.orgId);
    const cats = uniq(allProgs.map((p) => p.category));
    const locs = uniq(segs.map((s) => `${A.stopName(s.a)}, ${s.a.suburb}`));
    const hosted = (DATA.sites || []).filter((s) => s.hostOrganisationId === S.orgId);
    const pr = O.profileOf(S.orgId);
    const offerYes = O.OFFER_FIELDS.filter((f) => pr.offers[f.k] === true);
    const offerUnknown = O.OFFER_FIELDS.filter((f) => pr.offers[f.k] === null).length;
    el.profile.innerHTML = `
      <section class="cb-agency" aria-labelledby="cb-agency-name">
        <div class="cb-agency-main">
          ${badge('agency', { size: 64, color: BRAND.navy })}
          <div class="cb-agency-id">
            <p class="cb-kicker">Your organisation <span class="sample-tag">Fictional</span></p>
            <h2 id="cb-agency-name">${esc(org.organisationName)}</h2>
            <p>${esc(org.organisationType)} · ${esc(org.description)}</p>
          </div>
        </div>
        <div class="cb-agency-facts">
          <div class="cb-fact"><span class="cb-fact-label">Services</span><div class="cb-cats">${cats.map((c) => `<span class="cb-cat">${catBadge(c, 34)}<span>${esc(category(c).label)}</span></span>`).join('')}</div></div>
          <div class="cb-fact"><span class="cb-fact-label">${plural(progs.length, 'program')} running in this period</span>
            <ul class="cb-progs">${(progs.length ? progs : []).slice(0, 4).map((p) => `<li><strong>${esc(p.name)}</strong> ${modeTag(p.mode)}<span>${esc(p.pattern)}</span></li>`).join('') || `<li>${allProgs.length ? esc(allProgs[0].scheduleText || 'No sessions in this period') : 'No programs recorded'}</li>`}${progs.length > 4 ? `<li class="hint">and ${progs.length - 4} more</li>` : ''}</ul></div>
          <div class="cb-fact"><span class="cb-fact-label">${plural(locs.length, 'delivery location')}</span>
            <ul class="cb-locs">${locs.slice(0, 4).map((l) => `<li>${svg('pin', { size: 16 })}${esc(l)}</li>`).join('') || '<li>Not published</li>'}${locs.length > 4 ? `<li class="hint">and ${locs.length - 4} more</li>` : ''}</ul>
            ${hosted.length ? `<p class="hint">Hosts: ${esc(hosted.map((s) => s.siteName).join(', '))}</p>` : ''}</div>
        </div>
        <div class="cb-profile-strip">
          <div class="cb-strip-part">
            <h3>${svg('star', { size: 18 })}What we can offer</h3>
            <div class="cb-strip-icons">${offerYes.length ? offerYes.map((f) => `<span class="cb-offer" title="${esc(f.label)}">${badge(f.icon, { size: 34, color: BRAND.softMint, ink: BRAND.navy })}<span>${esc(f.label)}</span></span>`).join('') : '<span class="hint">Nothing declared yet</span>'}
              ${offerUnknown ? `<span class="hint">${offerUnknown} not specified</span>` : ''}</div>
          </div>
          <div class="cb-strip-part">
            <h3>${svg('collaborate', { size: 18 })}Who we want to connect with</h3>
            <div class="cb-strip-icons">${pr.wants.categories.map((c) => catBadge(c, 34)).join('')}${pr.wants.interests.map((k) => `<span class="cb-interest">${svg(O.INTERESTS[k].icon, { size: 16 })}${esc(O.INTERESTS[k].label)}</span>`).join('') || (pr.wants.categories.length ? '' : '<span class="hint">Not specified</span>')}</div>
          </div>
          <button type="button" class="btn-outline cb-edit-btn" data-cb-edit aria-expanded="${local.editing}">${svg('edit', { size: 18 })}${local.editing ? 'Close profile' : 'View and edit profile'}</button>
        </div>
        ${pr.edited ? '<p class="cb-edited">You have edited this profile in this browser (demonstration only).</p>' : ''}
        ${local.editing ? profileEditor(pr) : ''}
      </section>`;
  }

  function profileEditor(pr) {
    const d = local.draft || (local.draft = JSON.parse(JSON.stringify({ offers: pr.offers, wants: pr.wants })));
    const tri = (k, label, icon) => `<div class="pe-tri"><span class="pe-tri-label">${svg(icon, { size: 20 })}${esc(label)}</span>
      <div class="seg seg--small" role="group" aria-label="${esc(label)}">${[[true, 'Yes'], [false, 'No'], [null, 'Not specified']].map(([v, t]) => `<button type="button" data-pe-offer="${k}" data-v="${v}" aria-pressed="${d.offers[k] === v}">${t}</button>`).join('')}</div></div>`;
    return `<div class="pe" role="region" aria-label="Edit collaboration profile">
      <p class="pe-note">${svg('info', { size: 18 })}<span><strong>Demonstration only.</strong> Changes are saved in this browser and are not sent to any organisation. They update the matching straight away.</span></p>
      <div class="pe-cols">
        <fieldset class="pe-group"><legend>What we can offer</legend>
          ${O.OFFER_FIELDS.map((f) => tri(f.k, f.label, f.icon)).join('')}
          ${O.OFFER_TEXT.map((f) => `<label class="pe-text"><span>${svg(f.icon, { size: 18 })}${esc(f.label)}</span><input type="text" data-pe-text="${f.k}" value="${esc(d.offers[f.k] || '')}" placeholder="Not specified"></label>`).join('')}
          <label class="pe-text"><span>${svg('sparkle', { size: 18 })}Amenities and facilities (comma separated)</span><input type="text" data-pe-text="amenities" value="${esc((d.offers.amenities || []).join(', '))}" placeholder="Not specified"></label>
        </fieldset>
        <fieldset class="pe-group"><legend>Who we want to connect with</legend>
          <p class="pe-sub">Collaboration interests</p>
          <div class="pe-chips">${Object.entries(O.INTERESTS).map(([k, v]) => `<button type="button" class="pe-chip" data-pe-interest="${k}" aria-pressed="${d.wants.interests.includes(k)}">${svg(v.icon, { size: 18 })}<span><strong>${esc(v.label)}</strong><small>${esc(v.help)}</small></span></button>`).join('')}</div>
          <p class="pe-sub">Complementary services we would like to connect with</p>
          ${O.CATEGORY_GROUPS.map((g) => `<details class="pe-cat-group"${g.cats.some((c) => d.wants.categories.includes(c)) ? ' open' : ''}><summary>${esc(g.label)} <span class="hint-inline">${g.cats.filter((c) => d.wants.categories.includes(c)).length || ''}</span></summary>
            <div class="pe-cats">${g.cats.map((c) => `<button type="button" class="pe-cat" data-pe-cat="${c}" aria-pressed="${d.wants.categories.includes(c)}">${catBadge(c, 30, { label: '' })}<span>${esc(category(c).label)}</span></button>`).join('')}</div></details>`).join('')}
        </fieldset>
      </div>
      <div class="pe-actions">
        <button type="button" class="btn btn-mint" data-pe-save>${svg('check', { size: 18 })}Save (this browser only)</button>
        <button type="button" class="btn-outline" data-pe-cancel>Cancel</button>
        ${pr.edited ? '<button type="button" class="link-btn" data-pe-reset>Restore the sample profile</button>' : ''}
      </div>
    </div>`;
  }

  /* ---------- Three primary choices ---------- */

  function renderChoices() {
    el.choicesTitle.textContent = 'How would you like to collaborate?';
    const count = (k) => opps.filter((o) => inPath(o, k, S.orgId)).length;
    const choice = (k, flagship) => {
      const p = PATHS[k];
      const n = count(k);
      return `<button type="button" class="cb-choice${flagship ? ' cb-choice--flagship' : ''}" data-cb-path="${k}" aria-pressed="${local.path === k}" style="--acc:${p.color}">
        <span class="cb-choice-art" aria-hidden="true">${badge(p.icon, { size: flagship ? 88 : 64, color: p.color })}${flagship ? '<span class="dot d1"></span><span class="dot d2"></span><span class="dot d3"></span>' : ''}</span>
        <span class="cb-choice-text"><strong>${esc(p.title)}</strong><span>${esc(p.text)}</span>
          <span class="cb-choice-n">${k === 'hub' ? `${n ? plural(n, 'potential hub') + ' found · ' : ''}Start the Community Hub Builder` : n ? `${plural(n, 'possibility', 'possibilities')} found` : 'None found for this selection'}${svg('arrowRight', { size: 18 })}</span></span>
      </button>`;
    };
    el.choices.innerHTML = choice('hub', true) + choice('bring') + choice('take');
    el.moreChoices.innerHTML = `
      <button type="button" class="btn-outline cb-more-btn" data-cb-morechoices aria-expanded="${local.moreOpen}">${svg(local.moreOpen ? 'chevronDown' : 'plus', { size: 18 })}More collaboration options</button>
      ${local.moreOpen ? `<div class="cb-minor">${['referral', 'coordinate', 'program'].map((k) => {
        const p = PATHS[k];
        return `<button type="button" class="cb-minor-choice" data-cb-path="${k}" aria-pressed="${local.path === k}" style="--acc:${p.color}">${badge(p.icon, { size: 44, color: p.color })}<span><strong>${esc(p.title)}</strong><span>${esc(p.text)}</span><em>${plural(count(k), 'possibility', 'possibilities')}</em></span></button>`;
      }).join('')}</div>` : ''}`;
  }

  /* ---------- Opportunity cards ---------- */

  function card(o, viewer) {
    const T = A.TYPES[o.type];
    const others = uniq(o.parties.map((p) => p.org)).filter((x) => x !== viewer);
    const who = others.slice(0, 3).map(orgName);
    const visual = o.graphic && o.graphic.kind !== 'schedule'
      ? `<div class="cc-visual">${G.forOpp(o)}</div>`
      : `<div class="cc-visual cc-visual--icons">${uniq(o.categories).slice(0, 5).map((c) => catBadge(c, 52)).join('')}</div>`;
    return `<li class="cc cc--${o.status}" style="--acc:${T.color}">
      <div class="cc-head">${typeBadge(o.type, 48)}<span class="cc-type">${esc(T.friendly)}</span>${statusPill(o)}</div>
      <h3 class="cc-title">${esc(o.title)}</h3>
      ${visual}
      <dl class="cc-four">
        <div><dt>${svg('people', { size: 18 })}Who</dt><dd>${esc(who.join(', ') || orgName(viewer))}${others.length > 3 ? ` <span class="hint-inline">and ${others.length - 3} more</span>` : ''}</dd></div>
        <div><dt>${svg('pin', { size: 18 })}Where</dt><dd>${esc(o.location)}</dd></div>
        <div><dt>${svg('clock', { size: 18 })}When</dt><dd>${esc(o.when)}</dd></div>
        <div><dt>${svg('heartHands', { size: 18 })}What</dt><dd>${esc(o.benefit)}</dd></div>
      </dl>
      ${o.declared && o.declared.length ? `<p class="cc-declared">${svg('star', { size: 16 })}${esc(o.declared[0])}${o.declared.length > 1 ? ` <span class="hint-inline">+${o.declared.length - 1} more</span>` : ''}</p>` : ''}
      <div class="cc-actions">
        <button type="button" class="btn btn-mint" data-cc-explore="${esc(o.id)}">${svg('collaborate', { size: 18 })}Explore this collaboration</button>
        <button type="button" class="btn-ghost" data-cc-evidence="${esc(o.id)}">${svg('info', { size: 18 })}View supporting evidence</button>
      </div>
    </li>`;
  }
  const cardList = (list, viewer) => `<ol class="cc-list">${list.slice(0, local.limit).map((o) => card(o, viewer)).join('')}</ol>
    ${list.length > local.limit ? `<div class="list-more"><span>Showing ${Math.min(local.limit, list.length)} of ${list.length}</span><button type="button" class="btn-outline" data-cb-more-cards>Show all ${list.length}</button></div>` : ''}`;

  function renderResults() {
    if (!local.path || hb.open) { el.results.innerHTML = ''; el.results.hidden = true; return; }
    el.results.hidden = false;
    const p = PATHS[local.path];
    const list = opps.filter((o) => inPath(o, local.path, S.orgId)).sort(relevance);
    let empty = 'No possibilities were found for this selection. Try 30 days or more service types under More filters.';
    if (local.path === 'bring' && !(DATA.sites || []).some((s) => s.hostOrganisationId === S.orgId)) empty = `${orgName(S.orgId)} does not record a fixed site of its own. Try "Take our services to others" or "Create a community hub" instead.`;
    el.results.innerHTML = `
      <div class="cb-results-head" style="--acc:${p.color}">${badge(p.icon, { size: 48, color: p.color })}
        <div><h2>${esc(p.title)}</h2><p>${esc(p.text)} These are possibilities to explore together, not recommendations or confirmed arrangements.</p></div>
        ${local.path === 'hub' ? `<button type="button" class="btn btn-lg btn-mint" data-hb-start>${svg('hub', { size: 20 })}Start the Community Hub Builder</button>` : ''}
      </div>
      ${list.length ? cardList(list, S.orgId) : `<p class="empty-note">${esc(empty)}</p>`}`;
  }

  /* ---------- Insights about your services (secondary) ---------- */

  function renderInsights() {
    const segs = periodSegs().filter((s) => councilOf(s.a) === council());
    const similar = A.similarOverlaps(segs, baseOpt(null)).filter((e) => e.orgIds.includes(S.orgId));
    const mine = segs.filter((s) => s.a.organisationId === S.orgId);
    const subs = uniq(mine.map((s) => s.a.suburb));
    const missing = subs.length ? O.CATEGORY_IDS.filter((c) => !segs.some((s) => subs.includes(s.a.suburb) && s.a.category === c)) : [];
    el.insights.innerHTML = `
      <details class="adv cb-ins">
        <summary>${svg('insight', { size: 18 })}Insights about your services</summary>
        <div class="adv-body cb-ins-body">
          <div class="cb-ins-tile">${badge('layers', { size: 44, color: BRAND.yellow })}<div><strong>${similar.length}</strong> recurring overlap pattern${similar.length === 1 ? '' : 's'} with similar services nearby
            <button type="button" class="link-btn" data-cb-insights="overlaps">See service overlaps</button></div></div>
          <div class="cb-ins-tile">${badge('gap', { size: 44, color: BRAND.softPink })}<div><strong>${missing.length}</strong> service types not recorded in ${esc(listText(subs.slice(0, 3)) || 'your suburbs')}
            <button type="button" class="link-btn" data-cb-insights="coverage">See recorded gaps</button></div></div>
          <p class="hint">Missing records do not prove that a service does not exist or that need is unmet. Overlaps are scheduling patterns, not evidence that any service is unnecessary.</p>
        </div>
      </details>`;
  }

  /* ---------- Council perspective ---------- */

  function renderCouncil() {
    el.profile.innerHTML = '';
    const name = COUNCILS[council()].name;
    const segs = periodSegs().filter((s) => councilOf(s.a) === council());
    const hubs = councilOpps.filter((o) => o.type === 'hub');
    const sites = (DATA.sites || []).filter((s) => s.siteType === 'fixed' && s.hostOrganisationId && s.lga === council());
    const community = sites.filter((s) => communitySite(s, segs));
    const declaredHosts = community.filter((s) => { const p = O.profileOf(s.hostOrganisationId); return p.wants.interests.includes('visiting') || p.wants.interests.includes('hub'); });
    const providers = uniq(councilOpps.flatMap((o) => o.orgIds));
    const mobileN = councilOpps.filter((o) => o.type === 'mobile' || o.type === 'geo').length;
    const hoursN = councilOpps.filter((o) => o.type === 'hours').length;
    const gaps = A.categoryGaps(activities, baseOpt(null));
    const recurring = A.similarOverlaps(segs, baseOpt(null)).filter((e) => e.dates.size >= 2);
    const tile = (k, icon, color, n, label, action) => `<button type="button" class="cn-tile" ${action} style="--acc:${color}">${badge(icon, { size: 48, color })}<span><strong>${n}</strong><span>${esc(label)}</span></span></button>`;
    const priorities = councilPriorities(hubs, gaps, recurring);
    el.choicesTitle.textContent = 'Where could we facilitate stronger collaboration across our community?';
    el.choices.innerHTML = `
      <div class="cn-intro">
        ${badge('council', { size: 64, color: BRAND.navy })}
        <div><p class="cb-kicker">Council perspective</p><h3>${esc(name)}</h3><p>${esc(fmtDay(S.from))} to ${esc(fmtDay(S.to))} · ${esc(O.catsLabel(S.categories))}. All records are fictional.</p></div>
        <div class="cn-actions"><button type="button" class="btn btn-lg btn-mint" data-hb-start>${svg('hub', { size: 20 })}Plan a community hub</button>
          <button type="button" class="btn-outline" data-cb-report>${svg('councilReport', { size: 18 })}Council report</button></div>
      </div>
      <div class="cn-tiles">
        ${tile('hub', 'hub', BRAND.turquoise, hubs.length, 'Potential community hubs', 'data-cn-tab="hub"')}
        ${tile('hosts', 'fixedSite', BRAND.cyan, community.length, `Established community sites (${declaredHosts.length} interested in hosting)`, 'data-cn-tab="hosts"')}
        ${tile('prov', 'agency', BRAND.sky, providers.length, 'Organisations in collaboration opportunities', 'data-cn-tab="all"')}
        ${tile('mobile', 'van', BRAND.orange, mobileN, 'Shared mobile delivery opportunities', 'data-cn-tab="mobile"')}
        ${tile('hours', 'schedule', BRAND.yellow, hoursN, 'Collective service coordination', 'data-cn-tab="coordinate"')}
        ${tile('gaps', 'gap', BRAND.softPink, gaps.length, 'Service types with no recorded sessions', 'data-cb-insights="coverage"')}
        ${tile('ov', 'layers', BRAND.pink, recurring.length, 'Recurring overlaps of similar services', 'data-cb-insights="overlaps"')}
        ${tile('map', 'map', BRAND.royal, community.length + hubs.filter((h) => h.proposedLocation).length, 'Hosts and proposed hub locations on the map', 'data-cn-tab="map"')}
      </div>
      <div class="cn-priorities">
        <h3>${svg('star', { size: 20 })}Interagency discussion priorities</h3>
        <ol>${priorities.map((p) => `<li><strong>${esc(p.title)}</strong><span>${esc(p.text)}</span>${p.id ? `<button type="button" class="link-btn" data-cc-evidence="${esc(p.id)}">View evidence</button>` : p.action ? `<button type="button" class="link-btn" ${p.action}>${esc(p.label)}</button>` : ''}</li>`).join('')}</ol>
        <p class="hint">Generated from the fictional records for discussion. They are not recommendations, and they do not imply that any service is unnecessary.</p>
      </div>`;
    el.moreChoices.innerHTML = '';
  }

  function councilPriorities(hubs, gaps, recurring) {
    const out = [];
    const hosted = hubs.find((h) => !h.proposedLocation);
    if (hosted) out.push({ title: `Explore a regular community hub at ${hosted.location}`, text: `${plural(hosted.orgIds.length, 'organisation')} already deliver at or near this established community site.`, id: hosted.id });
    const mob = councilOpps.find((o) => o.type === 'mobile' && o.status === 'existing') || councilOpps.find((o) => o.type === 'mobile');
    if (mob) out.push({ title: mob.title, text: mob.summary, id: mob.id });
    const hrs = councilOpps.find((o) => o.type === 'hours');
    if (hrs) out.push({ title: hrs.title, text: 'Sharing timetables could extend the hours when people can access similar services.', id: hrs.id });
    if (gaps.length) out.push({ title: `Discuss the recorded absence of ${category(gaps[0].category).label.toLowerCase()}`, text: `No ${category(gaps[0].category).label.toLowerCase()} sessions are recorded in this period${gaps.length > 1 ? `, along with ${plural(gaps.length - 1, 'other service type')}` : ''}. Missing records do not prove unmet need.`, action: 'data-cb-insights="coverage"', label: 'See recorded gaps' });
    const prog = councilOpps.find((o) => o.type === 'program');
    if (prog) out.push({ title: prog.title, text: prog.summary, id: prog.id });
    return out.slice(0, 5);
  }

  function renderCouncilResults() {
    if (hb.open) { el.results.innerHTML = ''; el.results.hidden = true; return; }
    el.results.hidden = false;
    const tabs = { hub: 'Community hubs', hosts: 'Community sites', mobile: 'Mobile delivery', coordinate: 'Coordination', all: 'All opportunities', map: 'Map' };
    const t = local.councilTab;
    const filt = { hub: (o) => o.type === 'hub', mobile: (o) => o.type === 'mobile' || o.type === 'geo', coordinate: (o) => o.type === 'hours' || o.type === 'referral' || o.type === 'program', all: () => true };
    let body;
    if (t === 'hosts') body = hostsHtml();
    else if (t === 'map') body = '<div class="cn-map" id="cn-map" role="region" aria-label="Map of established community sites and potential hub locations"></div><p class="hint">Navy pins: established community sites. Turquoise rings: potential hubs. Dashed rings: proposed locations requiring investigation.</p>';
    else {
      const list = councilOpps.filter(filt[t]).sort(relevance);
      body = list.length ? cardList(list, null) : '<p class="empty-note">None identified for this selection.</p>';
    }
    el.results.innerHTML = `<div class="seg cn-tabs" role="group" aria-label="Council collaboration views">${Object.entries(tabs).map(([k, v]) => `<button type="button" data-cn-tab="${k}" aria-pressed="${t === k}">${esc(v)}</button>`).join('')}</div>${body}`;
    if (t === 'map') drawCouncilMap();
  }

  function hostsHtml() {
    const segs = periodSegs();
    const sites = (DATA.sites || []).filter((s) => s.siteType === 'fixed' && s.hostOrganisationId && s.lga === council());
    return `<ul class="host-list">${sites.map((s) => {
      const comm = communitySite(s, segs);
      const svc = siteServices(s.siteId, segs);
      const p = O.profileOf(s.hostOrganisationId);
      return `<li class="host-item">${badge(comm ? 'fixedSite' : 'agency', { size: 44, color: comm ? BRAND.navy : '#6B7590' })}
        <div><h3>${esc(s.siteName)}, ${esc(s.suburb)}</h3><p>${esc(orgName(s.hostOrganisationId))} · ${comm ? 'Established community site' : 'Office or appointment premises: suitability for a hub requires investigation'}</p>
        <div class="host-svc">${svc.map((x) => catBadge(x.cat, 28)).join('')}<span class="hint-inline">${esc(svc.map((x) => x.name).join(', ') || 'No sessions in this period')}</span></div>
        <p class="hint">${esc(A.facilitiesText(s.hostOrganisationId))}${p.wants.interests.includes('hub') ? ' Interested in community hub partnerships (declared).' : ''}</p></div>
        <button type="button" class="btn-outline" data-hb-site="${s.siteId}">${svg('hub', { size: 18 })}Plan a hub here</button></li>`;
    }).join('')}</ul>`;
  }

  function drawCouncilMap() {
    const node = $('cn-map');
    if (!node || !window.L) { if (node) node.innerHTML = '<p class="hint" style="padding:16px">The map needs an internet connection.</p>'; return; }
    if (cmap) { cmap.remove(); cmap = null; }
    cmap = L.map(node, { scrollWheelZoom: false }).setView(COUNCILS[council()].center, 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(cmap);
    const segs = periodSegs();
    const pts = [];
    (DATA.sites || []).filter((s) => s.siteType === 'fixed' && s.hostOrganisationId && s.lga === council() && communitySite(s, segs)).forEach((s) => {
      const ll = [s.location.latitude, s.location.longitude];
      pts.push(ll);
      L.marker(ll, { icon: L.divIcon({ className: 'cn-pin', html: badge('fixedSite', { size: 30, color: BRAND.navy }), iconSize: [30, 30], iconAnchor: [15, 15] }) })
        .addTo(cmap).bindTooltip(`${esc(s.siteName)} · ${esc(orgName(s.hostOrganisationId))}`);
    });
    councilOpps.filter((o) => o.type === 'hub').forEach((o) => {
      const s = o.siteId && siteById.get(o.siteId);
      const ll = s ? [s.location.latitude, s.location.longitude] : (() => { const p = suburbPoint(o.suburbs[0]); return [p.latitude, p.longitude]; })();
      pts.push(ll);
      L.circleMarker(ll, { radius: 22, color: o.proposedLocation ? BRAND.navy : BRAND.turquoise, weight: 4, dashArray: o.proposedLocation ? '6 6' : null, fill: false })
        .addTo(cmap).bindTooltip(esc(o.title));
    });
    if (pts.length) cmap.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
  }

  function councilInsightsHtml() {
    return `<p class="hint cb-council-note">For the detailed timeline, maps, statistics and methodology, open <button type="button" class="link-btn" data-cb-insights="overview">Service Insights</button>.</p>`;
  }

  /* ------------------------------------------------------------------ */
  /* Supporting evidence drawer                                          */
  /* ------------------------------------------------------------------ */

  function findOpp(id) { return opps.find((o) => o.id === id) || councilOpps.find((o) => o.id === id); }
  function openDrawer(id) {
    let o = findOpp(id);
    if (!o) {
      // Opened from another page with different settings: look across both councils.
      o = Object.keys(COUNCILS).map((c) => A.opportunities(activities, Object.assign(baseOpt(null), { council: c }))).flat().find((x) => x.id === id);
      if (!o) return;
      councilOpps.push(o);
    }
    local.drawerId = id;
    if (el.drawer.hidden) local.lastFocus = document.activeElement;
    el.drawer.innerHTML = `
      <div class="d-top">${typeBadge(o.type, 52)}
        <div><p class="cb-kicker">${esc(A.TYPES[o.type].friendly)} · supporting evidence</p><h2 id="cb-drawer-title">${esc(o.title)}</h2>${statusPill(o)}</div>
        <button type="button" class="icon-btn" data-cb-close aria-label="Close supporting evidence">${svg('close', { size: 22 })}</button>
      </div>
      <div class="d-body">
        <p>${esc(o.summary)}</p>
        ${o.graphic && o.graphic.kind === 'schedule' ? G.scheduleHtml(o.graphic) : ''}
        ${I ? I.detailHtml(o) : ''}
        <div class="d-actions">
          ${plannable(o) ? `<button type="button" class="btn btn-mint" data-cc-plan="${esc(o.id)}">${svg('hub', { size: 18 })}Plan this in the Hub Builder</button>` : ''}
          <button type="button" class="btn-outline" data-cb-close>Close</button>
        </div>
      </div>`;
    el.drawer.setAttribute('aria-labelledby', 'cb-drawer-title');
    el.drawer.hidden = false;
    el.scrim.hidden = false;
    el.drawer.scrollTop = 0;
    el.drawer.querySelector('[data-cb-close]').focus({ preventScroll: true });
  }
  function closeDrawer() {
    if (el.drawer.hidden) return;
    el.drawer.hidden = true;
    el.scrim.hidden = true;
    local.drawerId = null;
    if (local.lastFocus && document.contains(local.lastFocus)) local.lastFocus.focus({ preventScroll: true });
  }
  function trapFocus(e) {
    const f = [...el.drawer.querySelectorAll('button, [href], input, select, summary, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
  const plannable = (o) => ['hub', 'host', 'visiting', 'mobile', 'program'].includes(o.type);

  /* ================================================================== */
  /* Community Hub Builder                                               */
  /* ================================================================== */

  const STEPS = ['Host or location', 'Services', 'Partners', 'Plan', 'Visualise', 'Proposal'];
  const FREQS = [['one_off', 'One-off'], ['weekly', 'Weekly'], ['fortnightly', 'Fortnightly'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly']];
  const SENSITIVE = new Set(['legal_assistance', 'dfv_support', 'financial_counselling', 'health_clinics', 'mental_health', 'aod_support', 'housing_homelessness', 'visa_immigration']);
  const NEEDS_POWER = new Set(['laundry', 'dental', 'personal_care', 'showers_hygiene', 'health_clinics']);
  const hb = {
    open: false, step: 1, host: null, services: new Set(), picked: new Map(), preferOrgs: new Set(),
    participating: new Set(), proposedServices: new Set(), day: 'Wed', start: 600, end: 840, frequency: 'monthly',
    proposedSuburb: null, proposedName: 'Community venue to be identified', showAll: new Set(), status: '', model: null
  };

  function hostFromSite(siteId) {
    const s = siteById.get(siteId);
    return { kind: 'site', siteId, org: s.hostOrganisationId, name: s.siteName, suburb: s.suburb, council: s.lga, loc: s.location };
  }
  function hostProposed(sub) {
    return { kind: 'proposed', siteId: null, org: null, name: hb.proposedName || 'Community venue to be identified', suburb: sub, council: (SUBURB_COUNCIL[sub] || {}).council || council(), loc: suburbPoint(sub) };
  }
  function existingAtHost() { return hb.host && hb.host.siteId ? siteServices(hb.host.siteId, periodSegs()) : []; }

  function openBuilder(prefill) {
    Object.assign(hb, { open: true, step: 1, host: null, services: new Set(), picked: new Map(), preferOrgs: new Set(), participating: new Set(),
      proposedServices: new Set(), day: 'Wed', dayChosen: false, start: 600, end: 840, frequency: 'monthly', showAll: new Set(), status: '', model: null });
    hb.proposedSuburb = O.suburbsInCouncil(council())[0];
    const own = agency() ? (DATA.sites || []).find((s) => s.hostOrganisationId === S.orgId && s.siteType === 'fixed') : null;
    if (prefill && prefill.siteId && siteById.get(prefill.siteId) && siteById.get(prefill.siteId).siteType === 'fixed') hb.host = hostFromSite(prefill.siteId);
    else if (prefill && prefill.suburb) { hb.proposedSuburb = prefill.suburb; hb.host = hostProposed(prefill.suburb); }
    else if (prefill && prefill.siteId) hb.host = hostFromSite(prefill.siteId);
    else if (own) hb.host = hostFromSite(own.siteId);
    if (hb.host) defaultServices(prefill && prefill.cats);
    if (prefill && prefill.orgs) prefill.orgs.forEach((x) => hb.preferOrgs.add(x));
    hb.step = prefill && hb.host ? 3 : 1;
    if (hb.step === 3) { autoPick(); suggestDay(); }
    el.builder.hidden = false;
    renderResultsForMode();
    renderBuilder();
    el.builder.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function closeBuilder(rerender) {
    hb.open = false;
    el.builder.hidden = true;
    el.builder.innerHTML = '';
    if (rerender !== false) renderResultsForMode();
  }
  const renderResultsForMode = () => (agency() ? renderResults() : renderCouncilResults());

  function defaultServices(cats) {
    const at = new Set(existingAtHost().map((e) => e.cat));
    hb.services = new Set();
    const wanted = cats && cats.length ? cats : (hb.host.org ? O.profileOf(hb.host.org).wants.categories : []);
    wanted.filter((c) => !at.has(c) && lookups.categories[c]).forEach((c) => hb.services.add(c));
  }

  function candidates() {
    if (!hb.host) return new Map();
    return A.hubPartners({ siteId: hb.host.siteId, org: hb.host.org, suburb: hb.host.suburb, loc: hb.host.loc, council: hb.host.council }, [...hb.services], { from: S.from, to: S.to });
  }
  // Pre-select the most relevant partner per service (preferred organisations first). Users can change this.
  function autoPick() {
    const c = candidates();
    hb.picked = new Map([...hb.picked].filter(([k]) => hb.services.has(k.split('|')[0])));
    c.forEach((list, cat) => {
      if ([...hb.picked.keys()].some((k) => k.startsWith(`${cat}|`))) return;
      const pref = list.find((x) => hb.preferOrgs.has(x.org) && !x.atSite) || list.find((x) => !x.atSite && x.fit !== 'investigate');
      if (pref) hb.picked.set(`${cat}|${pref.org}`, pref);
    });
    syncParticipation();
  }
  function syncParticipation() {
    hb.participating = new Set([...hb.picked.values()].map((p) => p.org));
    hb.proposedServices = new Set([...hb.services]);
  }

  // Recorded sessions of participating partners that overlap the proposed hours elsewhere.
  function conflicts() {
    const out = [];
    const segs = periodSegs();
    const partners = [...hb.picked.values()].filter((p) => hb.participating.has(p.org));
    partners.forEach((p) => {
      const clash = segs.filter((s) => s.a.organisationId === p.org && weekdayOf(s.date) === hb.day && s.start < hb.end && s.end > hb.start && s.a.siteId !== (hb.host && hb.host.siteId));
      if (clash.length) {
        const s = clash[0];
        out.push(`${orgName(p.org)} records ${s.a.activityName} at ${A.stopName(s.a)}, ${s.a.suburb} on ${WEEKDAY_PLURAL[hb.day]} ${fmtRange(s.start, s.end)} (${plural(uniq(clash.map((x) => x.date)).length, 'date')} in this period). This overlaps the proposed hours, so availability would need to be discussed.`);
      }
    });
    const atSite = hb.host && hb.host.siteId ? segs.filter((s) => s.a.siteId === hb.host.siteId && weekdayOf(s.date) === hb.day && s.start < hb.end && s.end > hb.start) : [];
    const running = uniq(atSite.map((s) => `${s.a.activityName} (${fmtRange(s.start, s.end)})`));
    return { partner: out, running };
  }
  function unknowns() {
    const out = [];
    const hp = hb.host && hb.host.org ? O.profileOf(hb.host.org) : null;
    const partners = [...hb.picked.values()].filter((p) => hb.participating.has(p.org));
    out.push('Each organisation\'s availability, staffing and willingness to participate. None of this is assumed.');
    if (!hb.host || hb.host.kind === 'proposed') out.push('A suitable community location has not been identified. Site suitability, cost and access are unknown.');
    else if (!hp || !hp.offers.hostingTimes) out.push(`${hb.host.name} has not specified available hosting days and times.`);
    if (partners.some((p) => p.mode === 'mobile') && !(hp && (hp.offers.vehicleAccess === true || hp.offers.outdoorSpace === true))) out.push('Space and access for service vans are not specified at this location.');
    if (partners.some((p) => NEEDS_POWER.has(p.cat) && p.mode === 'mobile')) out.push('Power and water connections for mobile services (for example laundry, dental or haircuts).');
    if (partners.some((p) => SENSITIVE.has(p.cat)) && !(hp && hp.offers.privateRoom === true)) out.push('A private room for confidential conversations (legal, financial, health or family violence support) is not specified.');
    partners.filter((p) => p.unknowns.length).forEach((p) => out.push(`${orgName(p.org)}: ${p.unknowns.join('; ').toLowerCase()}.`));
    out.push('Insurance, permissions, eligibility rules and any funding conditions for each service.');
    out.push('Community demand. Recorded schedules do not show need or how services are used.');
    return out;
  }
  function existingNodes() {
    const seen = new Set();
    return existingAtHost().filter((e) => { const k = `${e.org}|${e.cat}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .map((e) => ({ org: e.org, cat: e.cat, mode: e.mode, existing: true }));
  }
  function diagram() {
    const nodes = existingNodes().concat([...hb.picked.values()].filter((p) => hb.participating.has(p.org) && hb.proposedServices.has(p.cat)).map((p) => ({ org: p.org, cat: p.cat, mode: p.mode, existing: false })));
    const centre = hb.host ? (hb.host.kind === 'site' ? `${hb.host.name}, ${hb.host.suburb}` : `${hb.host.name}, ${hb.host.suburb} (proposed)`) : 'Choose a host';
    return G.hubPlan({ center: centre, proposed: !hb.host || hb.host.kind === 'proposed', nodes }, { bg: true });
  }
  function buildPlan() {
    const svgText = diagram();
    const m = /viewBox="0 0 (\d+) (\d+)"/.exec(svgText);
    const c = conflicts();
    const matters = [...c.partner, ...(c.running.length ? [`Already running at the site at these times: ${c.running.join('; ')}. These could complement the hub; shared space and noise would need to be checked.`] : []), ...unknowns()];
    if (!c.partner.length) matters.unshift('No recorded sessions of the selected partners overlap the proposed hours. This does not mean they are available.');
    return {
      host: hb.host, initiator: { perspective: agency() ? 'agency' : 'council', orgId: S.orgId },
      services: [...hb.services], existing: existingAtHost(), partners: [...hb.picked.values()],
      participating: hb.participating, proposedServices: hb.proposedServices,
      day: hb.day, start: hb.start, end: hb.end, frequency: hb.frequency, matters,
      svg: svgText, svgW: Number(m[1]), svgH: Number(m[2])
    };
  }

  function stepValid(n) {
    if (n >= 2 && !hb.host) return false;
    if (n >= 3 && !hb.services.size) return false;
    return true;
  }

  function renderBuilder() {
    if (!hb.open) return;
    const step = hb.step;
    el.builder.innerHTML = `
      <div class="hb-head">
        ${badge('hub', { size: 64, color: BRAND.turquoise })}
        <div><p class="cb-kicker">${agency() ? `Agency initiated · ${esc(orgName(S.orgId))}` : `Council facilitated · ${esc(COUNCILS[council()].name)}`}</p>
          <h2 id="hb-title">Community Hub Builder</h2><p>Explore bringing services together at a trusted community location, regularly. Nothing here is booked, sent or confirmed.</p></div>
        <button type="button" class="icon-btn" data-hb-close aria-label="Close the Community Hub Builder">${svg('close', { size: 22 })}</button>
      </div>
      <ol class="hb-steps">${STEPS.map((t, i) => `<li><button type="button" data-hb-step="${i + 1}" ${i + 1 === step ? 'aria-current="step"' : ''} ${stepValid(i + 1) ? '' : 'disabled'}><span class="hb-n">${i + 1 < step ? svg('check', { size: 16, stroke: 3.2 }) : i + 1}</span><span>${esc(t)}</span></button></li>`).join('')}</ol>
      <div class="hb-body" id="hb-body">${[stepHost, stepServices, stepPartners, stepPlan, stepVisual, stepProposal][step - 1]()}</div>
      <div class="hb-foot">
        ${step > 1 ? `<button type="button" class="btn-outline" data-hb-step="${step - 1}">${svg('arrowLeft', { size: 18 })}Back</button>` : '<span></span>'}
        ${step < 6 ? `<button type="button" class="btn btn-lg" data-hb-step="${step + 1}" ${stepValid(step + 1) ? '' : 'disabled'}>Next: ${esc(STEPS[step])}${svg('arrowRight', { size: 18 })}</button>` : ''}
      </div>`;
  }

  function stepHost() {
    const segs = periodSegs();
    const sites = (DATA.sites || []).filter((s) => s.siteType === 'fixed' && s.hostOrganisationId && s.lga === council())
      .map((s) => ({ s, comm: communitySite(s, segs) })).sort((x, y) => Number(y.comm) - Number(x.comm) || x.s.siteName.localeCompare(y.s.siteName));
    const subs = O.suburbsInCouncil(council());
    const sel = hb.host;
    return `<h3 class="hb-h" tabindex="-1">1. Choose a host or location</h3>
      <p class="hb-intro">Choose an organisation's site, or propose a location that still needs to be identified.</p>
      <div class="hb-hosts">${sites.map(({ s, comm }) => {
        const svc = siteServices(s.siteId, segs);
        const p = O.profileOf(s.hostOrganisationId);
        const yes = O.OFFER_FIELDS.filter((f) => p.offers[f.k] === true);
        const on = sel && sel.siteId === s.siteId;
        return `<button type="button" class="hb-host${on ? ' is-on' : ''}" data-hb-host="${s.siteId}" aria-pressed="${on}">
          <span class="hb-host-top">${badge(comm ? 'fixedSite' : 'agency', { size: 44, color: comm ? BRAND.navy : '#6B7590' })}<span><strong>${esc(s.siteName)}</strong><span>${esc(orgName(s.hostOrganisationId))} · ${esc(s.suburb)}</span></span>${on ? `<span class="hb-tick">${svg('check', { size: 18, stroke: 3.2 })}</span>` : ''}</span>
          <span class="hb-tag ${comm ? 'hb-tag--ok' : 'hb-tag--warn'}">${comm ? 'Established community site' : 'Office or appointment premises: suitability requires investigation'}</span>
          <span class="hb-host-svc">${svc.length ? svc.map((x) => `<span>${catBadge(x.cat, 26)}${esc(x.name)} <small>${esc(x.pattern)}</small></span>`).join('') : '<span class="hint">No sessions in this period</span>'}</span>
          <span class="hb-host-fac">${yes.map((f) => `<span title="${esc(f.label)}">${svg(f.icon, { size: 16 })}${esc(f.label)}</span>`).join('') || '<span class="hint">Facilities not specified</span>'}</span>
        </button>`;
      }).join('')}
        <div class="hb-host hb-host--proposed${sel && sel.kind === 'proposed' ? ' is-on' : ''}">
          <span class="hb-host-top">${badge('pin', { size: 44, color: '#fff', ink: BRAND.navy, cls: 'ib--dashed' })}<span><strong>Propose a location</strong><span>For when no suitable host is identified yet</span></span></span>
          <label class="fb-field"><span class="fb-label">Suburb</span><select data-hb-suburb>${subs.map((x) => `<option value="${esc(x)}"${x === hb.proposedSuburb ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
          <label class="fb-field"><span class="fb-label">Working name</span><input type="text" data-hb-pname value="${esc(hb.proposedName)}"></label>
          <button type="button" class="btn-outline" data-hb-proposed aria-pressed="${!!(sel && sel.kind === 'proposed')}">${svg('pin', { size: 18 })}Use this proposed location</button>
          <span class="hb-tag hb-tag--warn">Requires investigation: site suitability is unknown</span>
        </div>
      </div>`;
  }

  function stepServices() {
    const at = existingAtHost();
    const atCats = new Set(at.map((e) => e.cat));
    const wanted = hb.host.org ? O.profileOf(hb.host.org).wants.categories : [];
    return `<h3 class="hb-h" tabindex="-1">2. Choose the services you would like to bring together</h3>
      <p class="hb-intro">Select as many as you like. Services already delivered at ${esc(hb.host.name)} are shown with a tick.${wanted.length ? ' A star shows services the host has asked for (declared).' : ''}</p>
      ${at.length ? `<div class="hb-existing"><strong>Already at this site:</strong> ${at.map((e) => `<span class="hb-ex">${catBadge(e.cat, 28)}${esc(e.name)} <small>(${esc(orgName(e.org))})</small></span>`).join('')}</div>` : ''}
      ${O.CATEGORY_GROUPS.map((g) => `<fieldset class="hb-group"><legend>${esc(g.label)}</legend><div class="hb-svc-grid">${g.cats.filter((c) => lookups.categories[c]).map((c) => {
        const here = atCats.has(c);
        const on = hb.services.has(c);
        return `<button type="button" class="hb-svc${on ? ' is-on' : ''}${here ? ' is-here' : ''}" data-hb-svc="${c}" aria-pressed="${on}" ${here ? 'disabled' : ''}>
          ${catBadge(c, 52, { label: '' })}<span>${esc(category(c).label)}</span>
          ${here ? `<em class="hb-flag hb-flag--here">${svg('check', { size: 14, stroke: 3.2 })}Already here</em>` : wanted.includes(c) ? `<em class="hb-flag">${svg('star', { size: 14 })}Requested</em>` : ''}
        </button>`;
      }).join('')}</div></fieldset>`).join('')}`;
  }

  function stepPartners() {
    const c = candidates();
    const picked = new Set([...hb.picked.keys()]);
    const fitLabel = { existing: 'Already delivers here', strong: 'Strong match', possible: 'Possible match', investigate: 'Requires investigation' };
    return `<h3 class="hb-h" tabindex="-1">3. Discover potential partners</h3>
      <p class="hb-intro">Organisations recorded in the dataset that deliver each service, with the reasons they may be suitable. Select or remove partners. OnNow does not invent providers for services with no records.</p>
      ${[...hb.services].map((cat) => {
        const list = (c.get(cat) || []).filter((x) => !x.atSite);
        const shown = hb.showAll.has(cat) ? list : list.slice(0, 3);
        return `<section class="hb-cat">
          <h4>${catBadge(cat, 40)}<span>${esc(category(cat).label)}</span><small>${plural(list.length, 'organisation')} found</small></h4>
          ${list.length ? `<ul class="hb-partners">${shown.map((p) => {
            const key = `${cat}|${p.org}`;
            const on = picked.has(key);
            return `<li class="hb-partner${on ? ' is-on' : ''}">
              <div class="hb-p-main"><strong class="hb-p-name">${esc(orgName(p.org))}</strong>
                <span class="hb-p-prog">${esc(p.name)} ${modeTag(p.mode)} <span class="fit fit--${p.fit}">${esc(fitLabel[p.fit])}</span></span>
                <span class="hb-p-where">${svg('pin', { size: 16 })}${esc(p.locations.slice(0, 2).join('; ') || 'No public location recorded')}${p.locations.length > 2 ? ` and ${p.locations.length - 2} more` : ''}${p.d != null ? ` · ${esc(A.fmtKm(p.d))} from the ${hb.host.kind === 'site' ? 'site' : 'suburb centre'}` : ''}</span>
                <span class="hb-p-when">${svg('clock', { size: 16 })}${esc(p.pattern)}</span>
                ${p.interests.length ? `<span class="hb-p-int">${p.interests.map((k) => `<span class="cb-interest">${svg(O.INTERESTS[k].icon, { size: 14 })}${esc(O.INTERESTS[k].label)}</span>`).join('')}</span>` : '<span class="hint">Collaboration interests not specified</span>'}
                <details class="hb-why"><summary>Why this organisation may be suitable</summary><ul>${p.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}${p.unknowns.map((u) => `<li class="hb-unknown">${esc(u)}</li>`).join('')}</ul></details>
              </div>
              <button type="button" class="${on ? 'btn' : 'btn-outline'} hb-pick" data-hb-pick="${esc(key)}" aria-pressed="${on}">${on ? `${svg('check', { size: 18, stroke: 3 })}Selected` : `${svg('plus', { size: 18 })}Select`}</button>
            </li>`;
          }).join('')}</ul>${list.length > 3 ? `<button type="button" class="link-btn" data-hb-all="${cat}">${hb.showAll.has(cat) ? 'Show fewer' : `Show all ${list.length}`}</button>` : ''}`
            : `<p class="empty-note">No organisation in the fictional dataset records ${esc(category(cat).label.toLowerCase())} that could serve ${esc(hb.host.suburb)}. This service may need to be sourced through other networks.</p>`}
        </section>`;
      }).join('')}
      <p class="hb-count" aria-live="polite"><strong>${plural(hb.picked.size, 'partner')} selected.</strong> ${hb.picked.size ? listText(uniq([...hb.picked.values()].map((p) => orgName(p.org)))) : 'Select at least one partner to see a hub.'}</p>`;
  }

  function timeOptions(sel, from, to) {
    const out = [];
    for (let m = from; m <= to; m += 30) out.push(`<option value="${m}"${m === sel ? ' selected' : ''}>${esc(fmtMin(m))}</option>`);
    return out.join('');
  }
  function stepPlan() {
    const partners = [...hb.picked.values()];
    const orgs = uniq(partners.map((p) => p.org));
    const c = conflicts();
    return `<h3 class="hb-h" tabindex="-1">4. Plan the proposed hub</h3>
      <p class="hb-intro">Choose a possible day, hours and frequency. These are proposals for discussion: they are not existing operating hours and nothing is booked.</p>
      <div class="hb-plan">
        <div class="hb-plan-col">
          <div class="hb-row">
            <label class="fb-field"><span class="fb-label">Preferred day</span><select data-hb-day>${WEEKDAYS.map((d) => `<option value="${d}"${d === hb.day ? ' selected' : ''}>${esc(WEEKDAY_PLURAL[d].replace(/s$/, ''))}</option>`).join('')}</select></label>
            <label class="fb-field"><span class="fb-label">From</span><select data-hb-start>${timeOptions(hb.start, 360, 1230)}</select></label>
            <label class="fb-field"><span class="fb-label">To</span><select data-hb-end>${timeOptions(hb.end, 390, 1260)}</select></label>
          </div>
          <fieldset class="hb-freq"><legend>Frequency</legend><div class="seg" role="group" aria-label="Frequency">${FREQS.map(([k, t]) => `<button type="button" data-hb-freq="${k}" aria-pressed="${hb.frequency === k}">${t}</button>`).join('')}</div></fieldset>
          <fieldset class="hb-checks"><legend>Participating organisations</legend>
            ${hb.host && hb.host.org ? `<label class="check is-fixed"><input type="checkbox" checked disabled><span>${esc(orgName(hb.host.org))} <small>(host)</small></span></label>` : ''}
            ${orgs.map((o) => `<label class="check"><input type="checkbox" data-hb-org="${o}" ${hb.participating.has(o) ? 'checked' : ''}><span>${esc(orgName(o))}</span></label>`).join('') || '<p class="hint">No partners selected. Go back to step 3 to add some.</p>'}
          </fieldset>
          <fieldset class="hb-checks"><legend>Proposed services</legend>
            ${[...hb.services].map((cat) => `<label class="check"><input type="checkbox" data-hb-psvc="${cat}" ${hb.proposedServices.has(cat) ? 'checked' : ''}>${catBadge(cat, 26)}<span>${esc(category(cat).label)}</span></label>`).join('')}
          </fieldset>
        </div>
        <div class="hb-plan-col">
          <div class="hb-panel ${c.partner.length ? 'hb-panel--warn' : 'hb-panel--ok'}">
            <h4>${svg(c.partner.length ? 'alert' : 'check', { size: 20 })}Recorded scheduling conflicts</h4>
            ${c.partner.length ? `<ul>${c.partner.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p>No recorded sessions of the selected partners overlap ${esc(WEEKDAY_PLURAL[hb.day])} ${esc(fmtRange(hb.start, hb.end))}. This does not mean they are available.</p>`}
            ${c.running.length ? `<p><strong>Already running at the site at these times:</strong> ${esc(c.running.join('; '))}. These could complement the hub.</p>` : ''}
          </div>
          <div class="hb-panel">
            <h4>${svg('info', { size: 20 })}Unknowns to discuss</h4>
            <ul>${unknowns().map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          </div>
        </div>
      </div>`;
  }

  function stepVisual() {
    const ex = existingAtHost();
    const partners = [...hb.picked.values()].filter((p) => hb.participating.has(p.org) && hb.proposedServices.has(p.cat));
    return `<h3 class="hb-h" tabindex="-1">5. Visualise the hub</h3>
      <div class="hb-visual">
        <figure class="hb-diagram">${diagram()}
          <figcaption><span class="lg lg--existing"></span>Already delivered at the site <span class="lg lg--potential"></span>Potential additional partner ${svg('van', { size: 16 })} mobile ${svg('fixedSite', { size: 16 })} fixed site</figcaption></figure>
        <div class="hb-list">
          <h4>${esc(hb.host.name)}, ${esc(hb.host.suburb)}</h4>
          <p class="hint">${esc(FREQS.find((f) => f[0] === hb.frequency)[1])}, ${esc(WEEKDAY_PLURAL[hb.day])}, ${esc(fmtRange(hb.start, hb.end))} (proposed)</p>
          <h5>Already at this site</h5>
          <ul>${ex.map((e) => `<li>${catBadge(e.cat, 28)}<span><strong>${esc(orgName(e.org))}</strong>${esc(e.name)} · ${esc(e.pattern)}</span></li>`).join('') || '<li class="hint">None recorded</li>'}</ul>
          <h5>Potential additional partners</h5>
          <ul>${partners.map((p) => `<li>${catBadge(p.cat, 28)}<span><strong>${esc(orgName(p.org))}</strong>${esc(p.name)} · ${p.mode === 'mobile' ? 'Mobile' : 'Fixed site'}</span></li>`).join('') || '<li class="hint">None selected</li>'}</ul>
        </div>
      </div>`;
  }

  function stepProposal() {
    hb.model = R ? R.hubProposal(buildPlan()) : null;
    return `<h3 class="hb-h" tabindex="-1">6. Create a collaboration proposal</h3>
      <p class="hb-intro">A practical starting point for interagency discussion, generated from your selections. Change any step and the proposal updates.</p>
      <div class="hb-revise"><span>Revise:</span>${STEPS.slice(0, 4).map((t, i) => `<button type="button" class="link-btn" data-hb-step="${i + 1}">${esc(t)}</button>`).join('')}</div>
      <div class="report-actions">
        <button type="button" class="btn btn-lg btn-mint" data-hb-download ${hb.model ? '' : 'disabled'}>${svg('download', { size: 20 })}Download proposal (.docx)</button>
        <p class="report-status${hb.status ? ` is-${hb.statusKind}` : ''}" id="hb-status" role="status" aria-live="polite">${esc(hb.status)}</p>
      </div>
      <article class="report-preview hb-preview">${hb.model ? R.previewHtml(hb.model) : '<p>The report module could not load.</p>'}</article>`;
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */

  // Suggest the weekday with the fewest recorded partner clashes, preferring days when the site is already open.
  function suggestDay() {
    const keep = hb.day;
    let best = null;
    WEEKDAYS.slice(0, 5).forEach((d) => {
      hb.day = d;
      const c = conflicts();
      const score = c.partner.length * 10 - c.running.length;
      if (!best || score < best.score) best = { d, score };
    });
    hb.day = best ? best.d : keep;
  }

  function goStep(n) {
    if (!stepValid(n)) return;
    if (n === 3 && hb.step < 3) autoPick();
    if (n === 4 && !hb.dayChosen) suggestDay();
    hb.step = n;
    hb.status = '';
    renderBuilder();
    const h = el.builder.querySelector('.hb-h');
    if (h) h.focus({ preventScroll: true });
    el.builder.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function onClick(e) {
    const t = e.target.closest('button, [data-cb-insights]');
    if (!t) return;
    const d = t.dataset;
    if (d.cbPath) {
      local.path = local.path === d.cbPath ? null : d.cbPath;
      local.limit = 6;
      if (d.cbPath === 'hub' && local.path === 'hub') { renderChoices(); openBuilder(null); return; }
      closeBuilder(false);
      renderChoices(); renderResults(); O.fillIcons(el.page);
      if (local.path) el.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if ('cbMorechoices' in d) { local.moreOpen = !local.moreOpen; renderChoices(); return; }
    if ('cbMoreCards' in d) { local.limit = Infinity; renderResultsForMode(); return; }
    if (d.ccEvidence) { openDrawer(d.ccEvidence); return; }
    if (d.ccExplore || d.ccPlan) {
      const o = findOpp(d.ccExplore || d.ccPlan);
      if (!o) return;
      if (!plannable(o)) { openDrawer(o.id); return; }
      closeDrawer();
      const site = o.siteId && siteById.get(o.siteId);
      const prefill = site && site.siteType === 'fixed' ? { siteId: o.siteId } : { suburb: o.suburbs[0] };
      const hostOrg = site && site.hostOrganisationId;
      const atSite = site ? new Set(siteServices(site.siteId, periodSegs()).map((x) => x.cat)) : new Set();
      prefill.cats = uniq(o.categories).filter((c) => !atSite.has(c));
      prefill.orgs = o.orgIds.filter((x) => x !== hostOrg);
      if (!prefill.cats.length) prefill.cats = uniq(o.categories);
      openBuilder(prefill);
      return;
    }
    if ('cbClose' in d) { closeDrawer(); return; }
    if (d.cbInsights) {
      if (agency()) O.set({ perspective: 'agency' }, 'collaborate');
      O.showPage('insights', { view: d.cbInsights === 'overview' ? 'overview' : d.cbInsights });
      return;
    }
    if ('cbReport' in d) { O.showPage('reports', { type: 'council' }); return; }
    if (d.cnTab) { local.councilTab = d.cnTab; local.limit = 6; closeBuilder(false); renderCouncilResults(); el.results.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if ('cbEdit' in d) { local.editing = !local.editing; local.draft = null; renderProfile(); return; }
    if (d.peOffer) { const v = d.v === 'true' ? true : d.v === 'false' ? false : null; local.draft.offers[d.peOffer] = v; renderProfile(); return; }
    if (d.peInterest) { toggleArr(local.draft.wants.interests, d.peInterest); renderProfile(); return; }
    if (d.peCat) { toggleArr(local.draft.wants.categories, d.peCat); renderProfile(); return; }
    if ('peSave' in d) { const draft = local.draft; local.editing = false; local.draft = null; O.saveProfile(S.orgId, draft); return; }
    if ('peCancel' in d) { local.editing = false; local.draft = null; renderProfile(); return; }
    if ('peReset' in d) { local.editing = false; local.draft = null; O.resetProfile(S.orgId); return; }
    // Hub Builder
    if ('hbStart' in d) { openBuilder(null); return; }
    if (d.hbSite) { openBuilder({ siteId: d.hbSite }); return; }
    if ('hbClose' in d) { closeBuilder(); if (local.path === 'hub') { local.path = null; renderChoices(); } el.choicesWrap.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (d.hbStep) { goStep(Number(d.hbStep)); return; }
    if (d.hbHost) { hb.host = hostFromSite(d.hbHost); hb.picked = new Map(); defaultServices(); renderBuilder(); return; }
    if ('hbProposed' in d) { hb.host = hostProposed(hb.proposedSuburb); hb.picked = new Map(); hb.services = new Set(); renderBuilder(); return; }
    if (d.hbSvc) { hb.services.has(d.hbSvc) ? hb.services.delete(d.hbSvc) : hb.services.add(d.hbSvc); hb.picked = new Map([...hb.picked].filter(([k]) => hb.services.has(k.split('|')[0]))); syncParticipation(); renderBuilder(); return; }
    if (d.hbPick) {
      if (hb.picked.has(d.hbPick)) hb.picked.delete(d.hbPick);
      else {
        const [cat, org] = d.hbPick.split('|');
        const cand = (candidates().get(cat) || []).find((x) => x.org === org);
        if (cand) hb.picked.set(d.hbPick, cand);
      }
      syncParticipation();
      const y = t.getBoundingClientRect().top;
      renderBuilder();
      const again = el.builder.querySelector(`[data-hb-pick="${CSS.escape(d.hbPick)}"]`);
      if (again) { window.scrollBy(0, again.getBoundingClientRect().top - y); again.focus({ preventScroll: true }); }
      return;
    }
    if (d.hbAll) { hb.showAll.has(d.hbAll) ? hb.showAll.delete(d.hbAll) : hb.showAll.add(d.hbAll); renderBuilder(); return; }
    if (d.hbFreq) { hb.frequency = d.hbFreq; renderBuilder(); return; }
    if ('hbDownload' in d) {
      if (!hb.model) return;
      t.disabled = true;
      R.downloadModel(hb.model, (text, kind) => {
        hb.status = text; hb.statusKind = kind || '';
        const st = $('hb-status');
        if (st) { st.textContent = text; st.className = `report-status${kind ? ` is-${kind}` : ''}`; }
      }).then(() => { t.disabled = false; });
    }
  }
  const toggleArr = (arr, v) => { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); };

  function onChange(e) {
    const t = e.target;
    const d = t.dataset;
    if (d.hbSuburb !== undefined) { hb.proposedSuburb = t.value; if (hb.host && hb.host.kind === 'proposed') { hb.host = hostProposed(t.value); hb.picked = new Map(); } renderBuilder(); return; }
    if (d.hbDay !== undefined) { hb.day = t.value; hb.dayChosen = true; renderBuilder(); return; }
    if (d.hbStart !== undefined) { hb.start = Number(t.value); if (hb.end <= hb.start) hb.end = Math.min(hb.start + 120, 1260); renderBuilder(); return; }
    if (d.hbEnd !== undefined) { hb.end = Number(t.value); if (hb.end <= hb.start) hb.start = Math.max(hb.end - 120, 360); renderBuilder(); return; }
    if (d.hbOrg) { t.checked ? hb.participating.add(d.hbOrg) : hb.participating.delete(d.hbOrg); renderBuilder(); return; }
    if (d.hbPsvc) { t.checked ? hb.proposedServices.add(d.hbPsvc) : hb.proposedServices.delete(d.hbPsvc); renderBuilder(); }
  }
  function onInput(e) {
    const t = e.target;
    if (t.dataset.hbPname !== undefined) { hb.proposedName = t.value; if (hb.host && hb.host.kind === 'proposed') hb.host.name = t.value || 'Community venue to be identified'; return; }
    if (t.dataset.peText && local.draft) {
      if (t.dataset.peText === 'amenities') local.draft.offers.amenities = t.value.split(',').map((x) => x.trim()).filter(Boolean);
      else local.draft.offers[t.dataset.peText] = t.value.trim() || null;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Page lifecycle                                                      */
  /* ------------------------------------------------------------------ */

  O.on((patch, source) => {
    const keys = ['council', 'suburb', 'categories', 'period', 'from', 'to', 'includeComplementary', 'orgId', 'perspective', 'profileVersion'];
    if (!keys.some((k) => k in patch)) return;
    if (S.page === 'collaborate') render(); else dirty = true;
  });
  O.registerPage('collaborate', {
    show(opts) {
      if (dirty) render();
      if (opts && opts.oppId) openDrawer(opts.oppId);
    },
    hide() { closeDrawer(); }
  });

  // Collaborate opens in the agency perspective, with an established community kitchen selected.
  // Explore Activities keeps its own default of both councils; Insights and Reports follow the organisation's council.
  if (!S.orgId) S.orgId = 'ORG-017';
  S.perspective = 'agency';
  S.lastCouncil = mainCouncilOf(S.orgId);
  buildControls();
  wireControls();
})();
