/*
 * OnNow — Explore Activities
 * --------------------------
 * Reads the fictional sample data and draws:
 *   - three headline figures (sessions, organisations, service locations)
 *   - the map (Leaflet + OpenStreetMap), one marker per physical site
 *   - the register: grouped by program, or as individual dated sessions
 *   - a details drawer that opens only when something is selected
 * Council, suburb and service types are shared with the other pages.
 * Everything runs in the browser. Nothing is sent anywhere.
 */
(() => {
  'use strict';

  const O = window.OnNow;
  const A = window.OnNowAnalysis;
  if (!O) {
    document.body.insertAdjacentHTML('afterbegin', '<p style="padding:16px;background:#fde8e8">Sample data (sample-data.js) could not be loaded.</p>');
    return;
  }
  const { DATA, esc, svg, catBadge, catChip, statusBadge, modeTag, category, orgById, programById, siteById, activityById,
    DEMO_DATE, addDays, daysBetween, fmtDay, fmtDayLong, fmtTime, plural, councilOf, suburbsInCouncil, COUNCILS } = O;
  const { lookups, activities } = DATA;
  const S = O.state;

  const EVENING = DATA.meta.eveningWindow || { start: '18:00', end: '24:00' };
  function isEvening(a) {
    const finish = a.finishTime <= a.startTime ? '24:00' : a.finishTime;
    return a.startTime < EVENING.end && finish > EVENING.start;
  }
  const STATUS_IDS = Object.keys(lookups.verificationStatuses);
  const timeRange = (a) => `${fmtTime(a.startTime)} – ${fmtTime(a.finishTime)}`;
  const orgName = (a) => (orgById.get(a.organisationId) || {}).organisationName || 'Unknown organisation';
  const programOf = (a) => programById.get(a.programId);
  const progKey = (a) => a.programId || a.activityId;
  const siteKey = (a) => a.siteId || `${a.location.latitude.toFixed(4)},${a.location.longitude.toFixed(4)}`;
  const isMobile = (a) => ((programOf(a) || {}).deliveryMode === 'mobile');
  const wrapFriendly = (s) => esc(s).replace(/([@.])/g, '$1<wbr>');
  const relativeDay = (iso) => {
    const diff = daysBetween(DEMO_DATE, iso);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return diff > 0 ? `In ${diff} days` : `${-diff} days ago`;
  };
  // Location type for counting and markers.
  function locationType(siteActs) {
    const site = siteById.get(siteActs[0].siteId);
    if (site && site.siteType === 'mobile_stop') return 'mobile';
    if (site && site.siteType === 'fixed') return 'fixed';
    return siteActs.every(isMobile) ? 'mobile' : 'fixed';
  }
  const placeName = (a) => {
    const site = siteById.get(a.siteId);
    return site && site.siteType !== 'recorded_location' ? site.siteName : a.location.description.replace(/\s*\(fictional[^)]*\)/i, '');
  };

  // Search text for each activity, built once.
  const searchIndex = new Map(activities.map((a) => {
    const org = orgById.get(a.organisationId);
    const site = siteById.get(a.siteId);
    const p = programOf(a);
    const text = [
      a.activityId, a.activityName, a.description, a.suburb, a.lga, site ? site.siteName : '', p ? p.programName : '',
      org ? org.organisationName : '', org ? org.organisationId : '', a.programId || '',
      category(a.category).label, lookups.verificationStatuses[a.verificationStatus].label,
      isEvening(a) ? 'evening night' : '', isMobile(a) ? 'mobile van' : 'fixed'
    ].join(' ').toLowerCase();
    return [a.activityId, text];
  }));

  const defaultFilters = () => ({ search: '', datePreset: 'all', specificDate: DEMO_DATE, eveningOnly: false, statuses: new Set(STATUS_IDS) });
  const state = {
    filters: defaultFilters(),
    sortKey: 'when', sortDir: 1,
    selectedId: null,
    filtered: [],
    regMode: 'programs',
    limit: 25,
    openProgram: null,
    legendOpen: false
  };
  const PAGE_SIZE = { sessions: 25, programs: 15 };

  const $ = (id) => document.getElementById(id);
  const el = {
    search: $('search'), council: $('ex-council'), suburb: $('ex-suburb'),
    datePreset: $('date-preset'), specificField: $('specific-date-field'), specificDate: $('specific-date'),
    eveningOnly: $('evening-only'), eveningCount: $('evening-count'), statusOptions: $('status-options'),
    more: $('ex-more'), morePanel: $('ex-more-panel'), moreCount: $('ex-more-count'), reset: $('reset-filters'),
    map: $('map'), legend: $('legend'), resultCount: $('result-count'),
    body: $('register-body'), empty: $('register-empty'), regMore: $('register-more'), sortKey: $('sort-key'),
    details: $('details'), scrim: $('scrim'), content: document.querySelector('#page-explore .content')
  };

  /* ------------------------------------------------------------------ */
  /* Filtering and sorting                                               */
  /* ------------------------------------------------------------------ */

  function matchesDate(a) {
    const f = state.filters;
    switch (f.datePreset) {
      case 'today': return a.date === DEMO_DATE;
      case 'tomorrow': return a.date === addDays(DEMO_DATE, 1);
      case 'next7': return a.date >= DEMO_DATE && a.date <= addDays(DEMO_DATE, 6);
      case 'next14': return a.date >= DEMO_DATE && a.date <= addDays(DEMO_DATE, 13);
      case 'next30': return a.date >= DEMO_DATE && a.date <= addDays(DEMO_DATE, 29);
      case 'specific': return !f.specificDate || a.date === f.specificDate;
      default: return true;
    }
  }
  function matches(a, skip) {
    const f = state.filters;
    if (skip !== 'category' && !O.inCats(a.category, S.categories)) return false;
    if (skip !== 'status' && !f.statuses.has(a.verificationStatus)) return false;
    if (S.council !== 'all' && councilOf(a) !== S.council) return false;
    if (S.suburb !== 'all' && a.suburb !== S.suburb) return false;
    if (!matchesDate(a)) return false;
    if (skip !== 'evening' && f.eveningOnly && !isEvening(a)) return false;
    if (f.search) {
      const text = searchIndex.get(a.activityId);
      const words = f.search.toLowerCase().split(/\s+/).filter(Boolean);
      if (!words.every((w) => text.includes(w))) return false;
    }
    return true;
  }

  const sorters = {
    when: (a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime),
    activity: (a, b) => a.activityName.localeCompare(b.activityName),
    organisation: (a, b) => orgName(a).localeCompare(orgName(b)),
    suburb: (a, b) => a.suburb.localeCompare(b.suburb),
    status: (a, b) => STATUS_IDS.indexOf(a.verificationStatus) - STATUS_IDS.indexOf(b.verificationStatus)
  };
  function sortList(list) {
    const cmp = sorters[state.sortKey];
    return list.sort((a, b) => (cmp(a, b) * state.sortDir) || sorters.when(a, b));
  }

  /* ------------------------------------------------------------------ */
  /* Controls                                                            */
  /* ------------------------------------------------------------------ */

  function buildControls() {
    const dates = activities.map((a) => a.date).sort();
    el.specificDate.min = dates[0];
    el.specificDate.max = dates[dates.length - 1];
    el.specificDate.value = DEMO_DATE;
    el.council.innerHTML = '<option value="all">Both councils</option>'
      + Object.keys(COUNCILS).map((k) => `<option value="${k}">${esc(COUNCILS[k].name)}</option>`).join('');
    el.statusOptions.innerHTML = STATUS_IDS.map((id) => `
      <label class="check">
        <input type="checkbox" value="${id}" checked>
        ${statusBadge(id)}
        <span class="count" data-count-status="${id}"></span>
      </label>`).join('');
    O.servicePicker($('ex-services'), $('ex-chips'), {
      counts: () => new Map(O.CATEGORY_IDS.map((c) => [c, activities.filter((a) => a.category === c && matches(a, 'category')).length]))
    });
  }

  function syncControls() {
    const f = state.filters;
    el.search.value = f.search;
    el.datePreset.value = f.datePreset;
    el.specificField.hidden = f.datePreset !== 'specific';
    el.specificDate.value = f.specificDate;
    el.eveningOnly.checked = f.eveningOnly;
    el.council.value = S.council;
    el.suburb.innerHTML = '<option value="all">All suburbs</option>'
      + suburbsInCouncil(S.council).map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
    el.suburb.value = S.suburb;
    el.statusOptions.querySelectorAll('input').forEach((i) => { i.checked = f.statuses.has(i.value); });
    el.sortKey.value = state.sortKey;
    document.querySelectorAll('[data-regmode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.regmode === state.regMode)));
  }

  function wireControls() {
    let searchTimer;
    el.search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { state.filters.search = el.search.value.trim(); update({ fit: true }); }, 150);
    });
    el.datePreset.addEventListener('change', () => {
      state.filters.datePreset = el.datePreset.value;
      el.specificField.hidden = el.datePreset.value !== 'specific';
      update({ fit: true });
    });
    el.specificDate.addEventListener('change', () => { state.filters.specificDate = el.specificDate.value; update({ fit: true }); });
    el.eveningOnly.addEventListener('change', () => { state.filters.eveningOnly = el.eveningOnly.checked; update({ fit: true }); });
    el.council.addEventListener('change', () => O.set({ council: el.council.value, suburb: 'all' }, 'explore'));
    el.suburb.addEventListener('change', () => O.set({ suburb: el.suburb.value }, 'explore'));
    el.statusOptions.addEventListener('change', (e) => {
      const set = state.filters.statuses;
      e.target.checked ? set.add(e.target.value) : set.delete(e.target.value);
      update({ fit: true });
    });
    el.more.addEventListener('click', () => {
      const open = el.morePanel.hidden;
      el.morePanel.hidden = !open;
      el.more.setAttribute('aria-expanded', String(open));
    });
    el.reset.addEventListener('click', () => {
      state.filters = defaultFilters();
      O.set({ council: 'all', suburb: 'all', categories: new Set() }, 'explore-reset');
    });
    el.sortKey.addEventListener('change', () => { state.sortKey = el.sortKey.value; state.sortDir = 1; update({ fit: false }); });
    document.querySelectorAll('[data-regmode]').forEach((b) => b.addEventListener('click', () => {
      state.regMode = b.dataset.regmode;
      state.limit = PAGE_SIZE[state.regMode];
      update({ fit: false });
    }));
  }

  /* ------------------------------------------------------------------ */
  /* Map: one marker per physical site                                    */
  /* ------------------------------------------------------------------ */

  let map = null;
  let markerLayer = null;
  const markerBySite = new Map();
  const siteOfActivity = new Map();

  function initMap() {
    if (!window.L) {
      el.map.innerHTML = '<div class="map-fallback"><div><strong>The map could not load.</strong><br>It needs an internet connection to fetch map images. The activity register still works.</div></div>';
      return;
    }
    map = L.map(el.map, { scrollWheelZoom: false, zoomSnap: 0.5 }).setView([-33.79, 150.92], 12);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }).addTo(map);
    let tileErrors = 0;
    tiles.on('tileerror', () => {
      tileErrors += 1;
      if (tileErrors === 4) el.map.insertAdjacentHTML('afterend', '<p class="map-notice">Some map images could not load (check your internet connection). Markers and the register still work.</p>');
    });
    map.on('click focus', () => map.scrollWheelZoom.enable());
    el.map.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());
    markerLayer = L.layerGroup().addTo(map);
    map.on('popupopen', (e) => {
      e.popup.getElement().querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
        map.closePopup();
        selectActivity(b.dataset.pick, { pan: false });
      }));
    });
  }

  // Representative session: the next one on or after the demo date, else the earliest.
  function repOf(list) {
    const sorted = list.slice().sort(sorters.when);
    return sorted.find((a) => a.date >= DEMO_DATE) || sorted[0];
  }

  function markerHtml(g, selected) {
    const programs = g.programs;
    const allConfirmed = g.acts.every((a) => a.verificationStatus === 'provider_confirmed');
    const shape = g.type === 'mobile' ? ' mk--mobile' : '';
    const check = allConfirmed ? `<span class="mk-check">${svg('check', { size: 11, stroke: 3.6 })}</span>` : '';
    if (programs.length === 1) {
      const c = category(g.acts[0].category);
      return `<span class="mk${shape}${selected ? ' is-selected' : ''}" style="--c:${c.color}">${svg(c.icon, { size: 19, stroke: 2.6 })}${check}</span>`;
    }
    const cats = [...new Set(g.acts.map((a) => a.category))].slice(0, 4);
    return `<span class="mk mk--multi${shape}${selected ? ' is-selected' : ''}" style="--c:${O.BRAND.navy}"><span class="mk-n">${programs.length}</span>${check}
      <span class="mk-dots">${cats.map((c) => `<i style="--d:${category(c).color}"></i>`).join('')}</span></span>`;
  }

  function renderMarkers(list) {
    if (!map) return;
    markerLayer.clearLayers();
    markerBySite.clear();
    siteOfActivity.clear();
    const groups = new Map();
    list.forEach((a) => {
      const k = siteKey(a);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(a);
      siteOfActivity.set(a.activityId, k);
    });
    const seen = new Map();
    groups.forEach((acts, key) => {
      const programs = [...new Set(acts.map(progKey))];
      const g = { key, acts, programs, type: locationType(acts) };
      const a0 = acts[0];
      let lat = a0.location.latitude, lng = a0.location.longitude;
      const ck = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      const k = seen.get(ck) || 0;
      seen.set(ck, k + 1);
      if (k > 0) { lat += 0.00035 * Math.sin(k * 2.4); lng += 0.00042 * Math.cos(k * 2.4); }
      const selected = acts.some((a) => a.activityId === state.selectedId);
      const name = placeName(a0);
      const rep = repOf(acts);
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({ className: 'mk-wrap', html: markerHtml(g, selected), iconSize: [34, 34], iconAnchor: [17, 17], tooltipAnchor: [0, -18] }),
        title: programs.length > 1 ? `${name}: ${programs.length} programs` : `${rep.activityName}, ${name}`,
        alt: programs.length > 1 ? `${name}, ${programs.length} programs` : `${rep.activityName} at ${name}`,
        keyboard: true, riseOnHover: true, zIndexOffset: selected ? 1000 : (programs.length > 1 ? 200 : 0)
      });
      if (programs.length > 1) {
        const items = programs.map((pid) => repOf(acts.filter((a) => progKey(a) === pid)))
          .sort((x, y) => category(x.category).label.localeCompare(category(y.category).label));
        marker.bindTooltip(`<strong>${esc(name)}</strong><br>${programs.length} programs · ${plural(acts.length, 'scheduled session')}<br>Select to see them all`, { direction: 'top' });
        marker.bindPopup(`<div class="site-pop"><h3>${esc(name)}</h3><p>${esc(a0.suburb)} · ${g.type === 'mobile' ? 'Mobile stop' : 'Fixed site'} · ${programs.length} programs in the current filters</p>
          <ul>${items.map((r) => `<li><button type="button" data-pick="${esc(r.activityId)}">${catBadge(r.category, 30)}<span><span class="sp-name">${esc(r.activityName)}</span>
            <span class="sp-meta">${esc(orgName(r))} · ${isMobile(r) ? 'Mobile' : 'Fixed'} · next ${esc(fmtDay(r.date))}, ${esc(timeRange(r))} · ${plural(acts.filter((a) => progKey(a) === progKey(r)).length, 'session')}</span></span></button></li>`).join('')}</ul></div>`, { maxWidth: 340, minWidth: 260 });
      } else {
        marker.bindTooltip(`<strong>${esc(rep.activityName)}</strong><br>${esc(name)} · ${esc(orgName(rep))}<br>${acts.length > 1 ? `${acts.length} sessions · next` : ''} ${esc(fmtDay(rep.date))}, ${esc(timeRange(rep))}<br><em>${isMobile(rep) ? 'Mobile service' : 'Fixed site'} · ${esc(O.status(rep.verificationStatus).shortLabel)} (sample)</em>`, { direction: 'top' });
        const pick = () => selectActivity(acts.some((a) => a.activityId === state.selectedId) ? state.selectedId : rep.activityId, { pan: false });
        marker.on('click', pick);
        marker.on('keypress', (e) => { if (e.originalEvent.key === 'Enter') pick(); });
      }
      marker.onnowGroup = g;
      markerLayer.addLayer(marker);
      markerBySite.set(key, marker);
    });
  }

  function refreshMarkerSelection() {
    if (!map) return;
    markerBySite.forEach((m) => {
      const g = m.onnowGroup;
      const sel = g.acts.some((a) => a.activityId === state.selectedId);
      m.setIcon(L.divIcon({ className: 'mk-wrap', html: markerHtml(g, sel), iconSize: [34, 34], iconAnchor: [17, 17], tooltipAnchor: [0, -18] }));
      m.setZIndexOffset(sel ? 1000 : (g.programs.length > 1 ? 200 : 0));
    });
  }

  function renderLegend(list) {
    const cats = [...new Set(list.map((a) => a.category))].sort((x, y) => category(x).label.localeCompare(category(y).label));
    el.legend.innerHTML = `
      <span class="legend-item"><span class="lg-mk">${svg('fixedSite', { size: 14, stroke: 2.8 })}</span>Circle = fixed site</span>
      <span class="legend-item"><span class="lg-mk lg-mk--sq">${svg('van', { size: 14, stroke: 2.8 })}</span>Square = mobile stop</span>
      <span class="legend-item"><span class="lg-mk">3</span>Number = programs at one place</span>
      <span class="legend-item"><span class="lg-mk" style="background:var(--confirmed)">${svg('check', { size: 13, stroke: 3.4 })}</span>Provider confirmed (sample)</span>
      <button type="button" class="link-btn" data-legend aria-expanded="${state.legendOpen}">${state.legendOpen ? 'Hide' : 'Show'} service colours (${cats.length})</button>
      ${state.legendOpen ? `<div class="legend-cats">${cats.map((c) => `<span class="legend-item">${catBadge(c, 24)}${esc(category(c).label)}</span>`).join('')}</div>` : ''}`;
  }

  /* ------------------------------------------------------------------ */
  /* Map / Register / Combined                                           */
  /* ------------------------------------------------------------------ */

  let currentView = 'map';
  let pendingFit = false;
  const isMapVisible = () => currentView !== 'register';

  function setView(view) {
    currentView = view;
    document.querySelectorAll('.view-toggle-btn').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.view === view)));
    $('map-view').hidden = view === 'register';
    $('register-view').hidden = view === 'map';
    el.content.classList.toggle('is-combined', view === 'combined');
    if (view !== 'register' && map) {
      map.invalidateSize();
      if (pendingFit) { pendingFit = false; fitMapTo(state.filtered); }
    }
  }
  function fitMapTo(list) {
    if (!map || !list.length) return;
    if (!isMapVisible() || document.getElementById('page-explore').hidden) { pendingFit = true; return; }
    const bounds = L.latLngBounds(list.map((a) => [a.location.latitude, a.location.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }

  /* ------------------------------------------------------------------ */
  /* Headline figures                                                    */
  /* ------------------------------------------------------------------ */

  function renderStats(list) {
    $('stat-total').textContent = list.length;
    $('stat-programs').textContent = new Set(list.map(progKey)).size;
    $('stat-orgs').textContent = new Set(list.map((a) => a.organisationId)).size;
    const bySite = new Map();
    list.forEach((a) => { const k = siteKey(a); if (!bySite.has(k)) bySite.set(k, []); bySite.get(k).push(a); });
    let fixed = 0, mobile = 0;
    bySite.forEach((acts) => { if (locationType(acts) === 'mobile') mobile++; else fixed++; });
    $('stat-sites').textContent = bySite.size;
    $('stat-fixed').textContent = fixed;
    $('stat-mobile').textContent = mobile;
    STATUS_IDS.forEach((id) => { $(`stat-${id}`).textContent = list.filter((a) => a.verificationStatus === id).length; });

    STATUS_IDS.forEach((id) => {
      const n = activities.filter((a) => a.verificationStatus === id && matches(a, 'status')).length;
      const c = document.querySelector(`[data-count-status="${id}"]`);
      if (c) c.textContent = n;
    });
    {
      const saved = state.filters.eveningOnly;
      state.filters.eveningOnly = true;
      el.eveningCount.textContent = activities.filter((a) => matches(a)).length;
      state.filters.eveningOnly = saved;
    }
    const programs = new Set(list.map(progKey)).size;
    el.resultCount.textContent = `${list.length} of ${activities.length} fictional scheduled sessions, from ${plural(programs, 'program')}`;
    const extra = (state.filters.statuses.size !== STATUS_IDS.length ? 1 : 0) + (state.filters.eveningOnly ? 1 : 0);
    el.moreCount.hidden = !extra;
    el.moreCount.textContent = extra;
    el.more.setAttribute('aria-label', extra ? `More filters, ${extra} active` : 'More filters');
  }

  /* ------------------------------------------------------------------ */
  /* Register                                                            */
  /* ------------------------------------------------------------------ */

  function renderRegister(list) {
    el.empty.hidden = list.length > 0;
    if (state.regMode === 'sessions') renderSessions(list);
    else renderPrograms(list);
  }

  function renderSessions(list) {
    const shown = list.slice(0, state.limit);
    const th = (key, label) => `<th scope="col" data-sort="${key}"${state.sortKey === key ? ` aria-sort="${state.sortDir === 1 ? 'ascending' : 'descending'}"` : ''}><button type="button">${label}</button></th>`;
    el.body.innerHTML = !list.length ? '' : `
      <table class="reg-table">
        <caption class="visually-hidden">Fictional scheduled sessions matching the current filters. Select a row to see details.</caption>
        <thead><tr>${th('when', 'When')}${th('activity', 'Activity')}${th('organisation', 'Organisation')}${th('suburb', 'Location')}${th('status', 'Verification')}</tr></thead>
        <tbody>${shown.map((a) => {
          const sel = a.activityId === state.selectedId;
          return `<tr data-id="${esc(a.activityId)}" tabindex="0"${sel ? ' class="is-selected" aria-current="true"' : ''}>
            <td class="c-when"><span class="when-date">${esc(fmtDay(a.date))}</span><span class="when-time">${esc(timeRange(a))}</span>${isEvening(a) ? '<span class="evening-tag" title="Operates between 6 pm and midnight">Evening</span>' : ''}</td>
            <td class="c-activity"><div class="act-cell">${catBadge(a.category, 34)}<div><span class="act-name">${esc(a.activityName)}</span>
              <span class="act-meta">${esc(category(a.category).label)} · ${isMobile(a) ? 'Mobile' : 'Fixed site'} · ${esc(a.activityId)}</span></div></div></td>
            <td class="c-org">${esc(orgName(a))}</td>
            <td class="c-suburb">${esc(placeName(a))}<span class="act-meta">${esc(a.suburb)}</span></td>
            <td class="c-status">${statusBadge(a.verificationStatus)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
    renderMore(list.length, shown.length, 'sessions');
  }

  function programGroups(list) {
    const groups = new Map();
    list.forEach((a) => {
      const k = progKey(a);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(a);
    });
    const out = [...groups.entries()].map(([pid, acts]) => {
      acts.sort(sorters.when);
      const next = acts.find((a) => a.date >= DEMO_DATE);
      return { pid, acts, rep: next || acts[acts.length - 1], isNext: !!next, program: programById.get(pid) };
    });
    const cmp = {
      when: (x, y) => sorters.when(x.rep, y.rep),
      activity: (x, y) => x.rep.activityName.localeCompare(y.rep.activityName),
      organisation: (x, y) => orgName(x.rep).localeCompare(orgName(y.rep)),
      suburb: (x, y) => x.rep.suburb.localeCompare(y.rep.suburb),
      status: (x, y) => sorters.status(x.rep, y.rep)
    }[state.sortKey];
    return out.sort((x, y) => (cmp(x, y) * state.sortDir) || sorters.when(x.rep, y.rep));
  }

  function renderPrograms(list) {
    const groups = programGroups(list);
    const shown = groups.slice(0, state.limit);
    el.body.innerHTML = !groups.length ? '' : `<ul class="prog-list">${shown.map((g) => {
      const a = g.rep;
      const mobile = isMobile(a);
      const sites = [...new Map(g.acts.map((x) => [siteKey(x), x])).values()];
      const open = state.openProgram === g.pid;
      const pattern = A ? A.patternText(g.acts.map((x) => ({ a: x, date: x.date, start: A.toMin(x.startTime), end: A.toMin(x.finishTime) })), g.pid) : '';
      return `<li class="prog-item${open ? ' is-open' : ''}">
        <button type="button" class="prog-head" data-prog="${esc(g.pid)}" aria-expanded="${open}">
          ${catBadge(a.category, 44)}
          <span class="prog-title"><strong>${esc(g.program ? g.program.programName : a.activityName)}</strong><span>${esc(orgName(a))}</span>
            <span class="act-meta">${modeTag(mobile ? 'mobile' : 'fixed')} ${statusBadge(a.verificationStatus)}</span></span>
          <span class="prog-where"><strong>${sites.length > 1 ? `${sites.length} locations` : esc(placeName(sites[0]))}</strong><span>${esc([...new Set(sites.map((x) => x.suburb))].join(', '))}</span></span>
          <span class="prog-pattern"><strong>${g.isNext ? 'Next' : 'Last'}: ${esc(fmtDay(a.date))}, ${esc(timeRange(a))}</strong><span>${esc(pattern)}</span></span>
          <span class="prog-count"><strong>${g.acts.length}</strong><span>${g.acts.length === 1 ? 'session' : 'sessions'}</span></span>
        </button>
        ${open ? `<div class="prog-body">${sites.map((s) => {
          const here = g.acts.filter((x) => siteKey(x) === siteKey(s));
          const pat = A ? A.patternText(here.map((x) => ({ a: x, date: x.date, start: A.toMin(x.startTime), end: A.toMin(x.finishTime) })), g.pid) : '';
          return `<div class="prog-site"><h4>${svg(locationType(here) === 'mobile' ? 'van' : 'fixedSite', { size: 18 })}${esc(placeName(s))}, ${esc(s.suburb)}</h4>
            <p>${esc(pat)} · ${plural(here.length, 'session')} in the current filters${g.program && A && (DATA.schedules || []).some((sc) => sc.programId === g.pid) ? '' : ' · no weekly schedule recorded'}</p>
            <div class="date-chips">${here.map((x) => `<button type="button" class="date-chip${x.activityId === state.selectedId ? ' is-selected' : ''}" data-select="${esc(x.activityId)}"><strong>${esc(fmtDay(x.date))}</strong>${esc(timeRange(x))}</button>`).join('')}</div></div>`;
        }).join('')}</div>` : ''}
      </li>`;
    }).join('')}</ul>`;
    renderMore(groups.length, shown.length, 'programs');
  }

  function renderMore(total, shown, unit) {
    const label = unit === 'programs' ? 'programs' : 'sessions';
    el.regMore.innerHTML = !total ? '' : `<span>Showing ${shown} of ${total} ${label}</span>${shown < total
      ? `<button type="button" class="btn-outline" data-more>Show ${Math.min(PAGE_SIZE[unit], total - shown)} more</button><button type="button" class="link-btn" data-more-all>Show all</button>`
      : (total > PAGE_SIZE[unit] ? '<button type="button" class="link-btn" data-less>Show fewer</button>' : '')}`;
  }

  function wireRegister() {
    el.body.addEventListener('click', (e) => {
      const th = e.target.closest('th[data-sort] button');
      if (th) {
        const key = th.parentElement.dataset.sort;
        if (state.sortKey === key) state.sortDir *= -1; else { state.sortKey = key; state.sortDir = 1; }
        update({ fit: false });
        return;
      }
      const head = e.target.closest('[data-prog]');
      if (head) {
        state.openProgram = state.openProgram === head.dataset.prog ? null : head.dataset.prog;
        renderRegister(state.filtered);
        const again = el.body.querySelector(`[data-prog="${CSS.escape(head.dataset.prog)}"]`);
        if (again) again.focus({ preventScroll: true });
        return;
      }
      const chip = e.target.closest('[data-select]');
      if (chip) { selectActivity(chip.dataset.select, { pan: true }); return; }
      const row = e.target.closest('tr[data-id]');
      if (row) selectActivity(row.dataset.id, { pan: true });
    });
    el.body.addEventListener('keydown', (e) => {
      const row = e.target.closest('tr[data-id]');
      if (!row) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectActivity(row.dataset.id, { pan: true }); }
      if (e.key === 'ArrowDown' && row.nextElementSibling) { e.preventDefault(); row.nextElementSibling.focus(); }
      if (e.key === 'ArrowUp' && row.previousElementSibling) { e.preventDefault(); row.previousElementSibling.focus(); }
    });
    el.regMore.addEventListener('click', (e) => {
      if (e.target.closest('[data-more]')) state.limit += PAGE_SIZE[state.regMode];
      else if (e.target.closest('[data-more-all]')) state.limit = Infinity;
      else if (e.target.closest('[data-less]')) state.limit = PAGE_SIZE[state.regMode];
      else return;
      renderRegister(state.filtered);
    });
    el.legend.addEventListener('click', (e) => {
      if (!e.target.closest('[data-legend]')) return;
      state.legendOpen = !state.legendOpen;
      renderLegend(state.filtered);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Details drawer                                                      */
  /* ------------------------------------------------------------------ */

  function recordTable(obj) {
    const rows = [];
    const walk = (o, prefix) => {
      Object.entries(o).forEach(([k, v]) => {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, key);
        else {
          const isNull = v === null;
          const val = Array.isArray(v) ? v.join(', ') : String(v);
          rows.push(`<tr><td>${esc(key)}</td><td${isNull ? ' class="null"' : ''}>${esc(isNull ? 'null' : val)}</td></tr>`);
        }
      });
    };
    walk(obj, '');
    return `<table><tbody>${rows.join('')}</tbody></table>`;
  }

  function relatedList(items, withOrg) {
    if (!items.length) return '<p class="hint">None in the sample data.</p>';
    return `<ul class="related">${items.map((r) => `
      <li><button type="button" data-select="${esc(r.activityId)}">${catBadge(r.category, 30)}
        <span><span class="r-name">${esc(r.activityName)}</span>
        <span class="r-meta">${withOrg ? `${esc(orgName(r))} · ` : ''}${esc(fmtDay(r.date))} · ${esc(timeRange(r))}${withOrg ? '' : ` · ${esc(r.suburb)}`}</span></span>
      </button></li>`).join('')}</ul>`;
  }

  function renderDetails(a) {
    const org = orgById.get(a.organisationId) || {};
    const st = O.status(a.verificationStatus);
    const isConfirmed = a.verificationStatus === 'provider_confirmed';
    const hiddenByFilters = !state.filtered.some((x) => x.activityId === a.activityId);
    const program = programOf(a);
    const site = siteById.get(a.siteId);
    const mobile = isMobile(a);
    const after = (x) => (x.date + x.startTime) > (a.date + a.startTime);
    const nextSessions = activities.filter((x) => x.programId && x.programId === a.programId && x.activityId !== a.activityId && after(x)).sort(sorters.when).slice(0, 4);
    const repFor = (list) => {
      const byProgram = new Map();
      list.slice().sort(sorters.when).forEach((x) => {
        const cur = byProgram.get(progKey(x));
        if (!cur || (cur.date < a.date && x.date >= a.date)) byProgram.set(progKey(x), x);
      });
      return [...byProgram.values()];
    };
    const otherAtSite = site && site.siteType !== 'recorded_location'
      ? repFor(activities.filter((x) => x.siteId === site.siteId && progKey(x) !== progKey(a)))
      : activities.filter((x) => x.activityId !== a.activityId && x.date === a.date && siteKey(x) === siteKey(a)).sort(sorters.when);
    const otherOrgPrograms = repFor(activities.filter((x) => x.organisationId === a.organisationId && progKey(x) !== progKey(a)));
    const orgSessions = activities.filter((x) => x.organisationId === a.organisationId);
    const orgPrograms = new Set(orgSessions.map(progKey)).size;
    const siteText = !site ? '' : site.siteType === 'fixed'
      ? `Community site operated by ${(orgById.get(site.hostOrganisationId) || {}).organisationName || 'unknown'}`
      : site.siteType === 'mobile_stop' ? 'Mobile stop: a public place visited by a mobile service' : 'Location recorded with this activity';
    let confirmationText;
    if (isConfirmed && a.lastConfirmedDate) {
      const ago = daysBetween(a.lastConfirmedDate, DEMO_DATE);
      confirmationText = `${fmtDayLong(a.lastConfirmedDate)}<span class="sub">${ago === 0 ? 'Same day as demo date' : `${ago} day${ago === 1 ? '' : 's'} before demo date`}</span>`;
    } else {
      confirmationText = 'Not confirmed by provider<span class="sub">No provider confirmation is recorded for this activity.</span>';
    }
    const council = councilOf(a);

    el.details.innerHTML = `
      <div class="d-top">
        ${catBadge(a.category, 52)}
        <div>
          <h2 id="details-title">${esc(program ? program.programName : a.activityName)}</h2>
          <p>Delivered by <strong>${esc(org.organisationName || 'Unknown')}</strong> <span class="sample-tag">Fictional</span></p>
        </div>
        <button type="button" class="icon-btn" data-close aria-label="Close activity details">${svg('close', { size: 22 })}</button>
      </div>
      <div class="d-body">
        <div class="d-tags">${catChip(a.category)} ${modeTag(mobile ? 'mobile' : 'fixed')} ${statusBadge(a.verificationStatus)} ${isEvening(a) ? '<span class="evening-tag">Evening</span>' : ''}</div>
        ${hiddenByFilters ? '<p class="hint">This session is hidden by your current filters.</p>' : ''}

        <section class="d-section">
          <h3>${svg('schedule', { size: 18 })}When and where</h3>
          <dl class="facts">
            <dt>Date</dt><dd>${esc(fmtDayLong(a.date))}<span class="sub">${esc(relativeDay(a.date))} (relative to demo date)</span></dd>
            <dt>Time</dt><dd>${esc(timeRange(a))}${isEvening(a) ? '<span class="sub">Operates at some time between 6 pm and midnight</span>' : ''}</dd>
            <dt>Location</dt><dd>${esc(placeName(a))}<span class="sub">${esc(a.suburb)}${council ? ` · ${esc(COUNCILS[council].name)}` : ''}${site ? ` · ${esc(siteText)}` : ''}</span></dd>
            ${program ? `<dt>Usual schedule</dt><dd>${esc(program.scheduleText)}<span class="sub">${program.sessionCount} scheduled session${program.sessionCount === 1 ? '' : 's'} of this program in the sample${mobile ? ` · visits ${plural(program.siteIds.length, 'location')}` : ''}</span></dd>` : ''}
          </dl>
        </section>

        <section class="d-section">
          <h3>${svg('verified', { size: 18 })}Verification</h3>
          <div class="status-box status-box--${a.verificationStatus}">
            <div>${statusBadge(a.verificationStatus)}</div>
            <p>${esc(st.description)}</p>
            <dl class="facts"><dt>Source</dt><dd>${esc((lookups.sourceTypes[a.source] || { label: a.source }).label)}</dd><dt>Last confirmed</dt><dd>${confirmationText}</dd></dl>
            <p class="status-fictional"><strong>Sample status only.</strong> This is a fictional example, not a real ${isConfirmed ? 'confirmation from any provider' : 'record from any source'}.</p>
          </div>
        </section>

        <section class="d-section">
          <h3>${svg('info', { size: 18 })}About this activity</h3>
          <p>${esc(a.description)}</p>
        </section>

        <section class="d-section">
          <h3>${svg('handshake', { size: 18 })}Collaboration</h3>
          <div class="d-actions">
            <button type="button" class="btn btn-mint" data-insight="org">${svg('agency', { size: 18 })}Opportunities for ${esc(org.organisationName || 'this organisation')}</button>
            <button type="button" class="btn-outline" data-insight="place">${svg('pin', { size: 18 })}Opportunities in ${esc(a.suburb)}</button>
          </div>
        </section>

        <section class="d-section">
          <h3>${svg('phone', { size: 18 })}Contact <span class="sample-tag">Fictional</span></h3>
          <div class="contact-box">
            <p class="contact-warning"><strong>Fictional contact details.</strong> Made up for this demonstration. Do not call, email or visit.</p>
            <div class="contact-line">${svg('phone', { size: 18 })}<span>${esc(org.phone || 'Not provided')}</span></div>
            <div class="contact-line">${svg('mail', { size: 18 })}<span>${wrapFriendly(org.email || 'Not provided')}</span></div>
            <div class="contact-line">${svg('globe', { size: 18 })}<span>${wrapFriendly(org.website || 'Not provided')}</span></div>
          </div>
        </section>

        <section class="d-section">
          <h3>${svg('fixedSite', { size: 18 })}${site && site.siteType !== 'recorded_location' ? `Other programs at ${esc(site.siteName)}` : 'Other activities here on the same day'}</h3>
          ${relatedList(otherAtSite, true)}
        </section>

        ${nextSessions.length ? `<section class="d-section"><h3>${svg('schedule', { size: 18 })}Next sessions of this program</h3>${relatedList(nextSessions, false)}</section>` : ''}

        <section class="d-section">
          <h3>${svg('agency', { size: 18 })}${esc(org.organisationName || 'Organisation')}</h3>
          <p>${esc(org.organisationType || '')}. ${esc(org.description || '')}</p>
          <p class="hint">${plural(orgPrograms, 'program')} · ${plural(orgSessions.length, 'scheduled session')} in the sample data</p>
          ${otherOrgPrograms.length ? `<h3 style="margin-top:12px">Other programs by this organisation</h3>${relatedList(otherOrgPrograms, false)}` : ''}
        </section>

        <details class="record">
          <summary>View data record (database structure)</summary>
          <div class="record-inner">
            <p>Each dated session links to an organisation, a program and a site by <code>organisationId</code>, <code>programId</code> and <code>siteId</code>.</p>
            <h4>Activity record</h4>${recordTable(a)}
            <h4>Linked organisation record</h4>${recordTable(org)}
            ${program ? `<h4>Linked program record</h4>${recordTable(program)}` : ''}
            ${site ? `<h4>Linked site record</h4>${recordTable(site)}` : ''}
          </div>
        </details>
      </div>`;
    el.details.setAttribute('aria-labelledby', 'details-title');
  }

  let lastFocus = null;
  function selectActivity(id, { pan }) {
    const a = activityById.get(id);
    if (!a) return;
    state.selectedId = id;
    el.body.querySelectorAll('tr.is-selected, .date-chip.is-selected').forEach((r) => { r.classList.remove('is-selected'); r.removeAttribute('aria-current'); });
    const row = el.body.querySelector(`tr[data-id="${CSS.escape(id)}"]`);
    if (row) { row.classList.add('is-selected'); row.setAttribute('aria-current', 'true'); }
    const chip = el.body.querySelector(`.date-chip[data-select="${CSS.escape(id)}"]`);
    if (chip) chip.classList.add('is-selected');
    refreshMarkerSelection();
    renderDetails(a);
    if (el.details.hidden) lastFocus = document.activeElement;
    el.details.hidden = false;
    el.scrim.hidden = false;
    el.details.scrollTop = 0;
    el.details.querySelector('[data-close]').focus({ preventScroll: true });
    if (pan && map && isMapVisible()) {
      const m = markerBySite.get(siteOfActivity.get(id));
      map.setView(m ? m.getLatLng() : [a.location.latitude, a.location.longitude], Math.max(map.getZoom(), 14));
    }
  }

  function closeDetails() {
    state.selectedId = null;
    el.body.querySelectorAll('tr.is-selected, .date-chip.is-selected').forEach((r) => { r.classList.remove('is-selected'); r.removeAttribute('aria-current'); });
    refreshMarkerSelection();
    el.details.hidden = true;
    el.scrim.hidden = true;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  }

  function wireDetails() {
    el.details.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) { closeDetails(); return; }
      const ins = e.target.closest('[data-insight]');
      if (ins) {
        const a = activityById.get(state.selectedId);
        const council = councilOf(a) || O.analysisCouncil();
        closeDetails();
        if (ins.dataset.insight === 'org') {
          O.set({ perspective: 'agency', orgId: a.organisationId, council, suburb: 'all' }, 'explore-link');
        } else {
          O.set({ perspective: 'council', council, suburb: a.suburb }, 'explore-link');
        }
        O.showPage('insights', { view: 'collab' });
        return;
      }
      const rel = e.target.closest('[data-select]');
      if (rel) selectActivity(rel.dataset.select, { pan: true });
    });
    el.scrim.addEventListener('click', closeDetails);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.selectedId && !el.details.hidden && S.page === 'explore') closeDetails();
      // Keep keyboard focus inside the open drawer.
      if (e.key === 'Tab' && !el.details.hidden && S.page === 'explore') {
        const f = [...el.details.querySelectorAll('button, summary, a[href]')].filter((n) => n.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Main update cycle                                                   */
  /* ------------------------------------------------------------------ */

  let dirty = false;
  function update({ fit }) {
    syncControls();
    state.filtered = sortList(activities.filter((a) => matches(a)));
    state.limit = Math.max(state.limit, PAGE_SIZE[state.regMode]);
    renderStats(state.filtered);
    renderRegister(state.filtered);
    renderMarkers(state.filtered);
    renderLegend(state.filtered);
    if (fit) fitMapTo(state.filtered);
    if (state.selectedId && !el.details.hidden) renderDetails(activityById.get(state.selectedId));
  }

  O.on((patch, source) => {
    const relevant = 'council' in patch || 'suburb' in patch || 'categories' in patch;
    if (!relevant) return;
    if (S.page === 'explore') { state.limit = PAGE_SIZE[state.regMode]; update({ fit: true }); }
    else dirty = true;
    if (source === 'explore-reset') syncControls();
  });

  O.registerPage('explore', {
    show() {
      if (dirty) { dirty = false; update({ fit: true }); }
      if (map) { map.invalidateSize(); if (pendingFit) { pendingFit = false; fitMapTo(state.filtered); } }
      if (state.selectedId && !el.details.hidden) el.scrim.hidden = false;
    },
    hide() { el.scrim.hidden = true; }
  });

  buildControls();
  wireControls();
  wireRegister();
  wireDetails();
  document.querySelectorAll('.view-toggle-btn').forEach((btn) => btn.addEventListener('click', () => { if (btn.dataset.view !== currentView) setView(btn.dataset.view); }));
  setView(window.matchMedia('(max-width: 820px)').matches ? 'map' : 'combined'); // Map on phones, Combined otherwise
  initMap();
  update({ fit: true });
})();
