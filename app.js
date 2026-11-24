/*
 * OnNow demonstration dashboard — application logic
 * ---------------------------------------------------
 * Reads the fictional sample data (sample-data.js), then draws:
 *   - summary counts
 *   - the map (Leaflet + OpenStreetMap)
 *   - the searchable / sortable activity register
 *   - the activity details panel
 * Everything runs in the browser. Nothing is sent anywhere.
 */
(() => {
  'use strict';

  const DATA = window.ONNOW_SAMPLE_DATA;
  if (!DATA) {
    document.body.insertAdjacentHTML('afterbegin',
      '<p style="padding:16px;background:#fde8e8">Sample data (sample-data.js) could not be loaded.</p>');
    return;
  }

  const { meta, lookups, organisations, activities } = DATA;
  const DEMO_DATE = meta.demoReferenceDate;
  // Evening window (default 6 pm to midnight). Times are 'HH:MM' strings, so they compare alphabetically.
  const EVENING = meta.eveningWindow || { start: '18:00', end: '24:00' };

  // An activity is "evening" if any part of it runs inside the evening window.
  // A finish time at or before the start time means it runs past midnight.
  function isEvening(a) {
    const finish = a.finishTime <= a.startTime ? '24:00' : a.finishTime;
    return a.startTime < EVENING.end && finish > EVENING.start;
  }
  const CATEGORY_IDS = Object.keys(lookups.categories);
  const STATUS_IDS = Object.keys(lookups.verificationStatuses);
  const orgById = new Map(organisations.map((o) => [o.organisationId, o]));
  const activityById = new Map(activities.map((a) => [a.activityId, a]));
  // Programs and sites (each dated activity links to one of each).
  const programById = new Map((DATA.programs || []).map((p) => [p.programId, p]));
  const siteById = new Map((DATA.sites || []).map((s) => [s.siteId, s]));

  // Search text for each activity, built once.
  const searchIndex = new Map(activities.map((a) => {
    const org = orgById.get(a.organisationId);
    const site = siteById.get(a.siteId);
    const text = [
      a.activityId, a.activityName, a.description, a.suburb, a.lga, site ? site.siteName : '',
      org ? org.organisationName : '', org ? org.organisationId : '',
      lookups.categories[a.category].label,
      lookups.verificationStatuses[a.verificationStatus].label,
      isEvening(a) ? 'evening night' : ''
    ].join(' ').toLowerCase();
    return [a.activityId, text];
  }));

  const defaultFilters = () => ({
    search: '',
    datePreset: 'all',
    specificDate: DEMO_DATE,
    eveningOnly: false,
    suburb: 'all',
    categories: new Set(CATEGORY_IDS),
    statuses: new Set(STATUS_IDS)
  });

  const state = {
    filters: defaultFilters(),
    sortKey: 'when',
    sortDir: 1,
    selectedId: null,
    filtered: []
  };

  const $ = (id) => document.getElementById(id);
  const el = {
    demoDate: $('demo-date'),
    search: $('search'),
    datePreset: $('date-preset'),
    specificField: $('specific-date-field'),
    specificDate: $('specific-date'),
    eveningOnly: $('evening-only'),
    eveningCount: $('evening-count'),
    categoriesAll: $('categories-all'),
    categoriesNone: $('categories-none'),
    suburb: $('suburb'),
    categoryOptions: $('category-options'),
    statusOptions: $('status-options'),
    resetFilters: $('reset-filters'),
    filters: $('filters'),
    filtersToggle: $('filters-toggle'),
    filtersToggleCount: $('filters-toggle-count'),
    map: $('map'),
    fitMap: $('fit-map'),
    legend: $('legend'),
    resultCount: $('result-count'),
    tbody: $('register-body'),
    empty: $('register-empty'),
    details: $('details'),
    scrim: $('scrim')
  };

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // Escape text, then allow line breaks after "@" and "." so long emails/web addresses wrap neatly.
  const wrapFriendly = (s) => esc(s).replace(/([@.])/g, '$1<wbr>');

  const parseISO =(iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const toISO = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const daysBetween = (fromIso, toIso) => Math.round((parseISO(toIso) - parseISO(fromIso)) / 86400000);

  const fmtShortDate = (iso) => new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }).format(parseISO(iso));
  const fmtLongDate = (iso) => new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseISO(iso));
  const fmtTime = (t) => {
    const [h, m] = t.split(':').map(Number);
    const suffix = h >= 12 ? 'pm' : 'am';
    const h12 = ((h + 11) % 12) + 1;
    return m ? `${h12}:${String(m).padStart(2, '0')}${suffix}` : `${h12}${suffix}`;
  };
  const timeRange = (a) => `${fmtTime(a.startTime)} – ${fmtTime(a.finishTime)}`;
  const relativeDay = (iso) => {
    const diff = daysBetween(DEMO_DATE, iso);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return diff > 0 ? `In ${diff} days` : `${-diff} days ago`;
  };

  const orgName = (a) => (orgById.get(a.organisationId) || {}).organisationName || 'Unknown organisation';
  const category = (id) => lookups.categories[id];
  const status = (id) => lookups.verificationStatuses[id];
  const sourceLabel = (id) => (lookups.sourceTypes[id] || { label: id }).label;

  const catChip = (id) => `<span class="cat-chip" style="--chip:${category(id).color}">${esc(category(id).label)}</span>`;
  const statusBadge = (id) => `<span class="status status--${id}">${esc(status(id).shortLabel)}</span>`;

  const isDrawerMode = () => window.matchMedia('(max-width: 1240px)').matches;
  const isPhone = () => window.matchMedia('(max-width: 820px)').matches;

  /* ------------------------------------------------------------------ */
  /* Filtering and sorting                                               */
  /* ------------------------------------------------------------------ */

  function matchesDate(a) {
    const f = state.filters;
    switch (f.datePreset) {
      case 'today': return a.date === DEMO_DATE;
      case 'tomorrow': return a.date === addDays(DEMO_DATE, 1);
      case 'next7': return a.date >= DEMO_DATE && a.date <= addDays(DEMO_DATE, 6);
      case 'specific': return !f.specificDate || a.date === f.specificDate;
      default: return true;
    }
  }

  function matches(a) {
    const f = state.filters;
    if (!f.categories.has(a.category)) return false;
    if (!f.statuses.has(a.verificationStatus)) return false;
    if (f.suburb !== 'all') {
      if (f.suburb.startsWith('lga:')) { if (a.lga !== f.suburb.slice(4)) return false; }
      else if (a.suburb !== f.suburb) return false;
    }
    if (!matchesDate(a)) return false;
    if (f.eveningOnly && !isEvening(a)) return false;
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
    category: (a, b) => category(a.category).label.localeCompare(category(b.category).label),
    status: (a, b) => STATUS_IDS.indexOf(a.verificationStatus) - STATUS_IDS.indexOf(b.verificationStatus)
  };

  function sortList(list) {
    const cmp = sorters[state.sortKey];
    return list.sort((a, b) => (cmp(a, b) * state.sortDir) || sorters.when(a, b));
  }

  function activeFilterCount() {
    const f = state.filters;
    let n = 0;
    if (f.search) n++;
    if (f.datePreset !== 'all') n++;
    if (f.eveningOnly) n++;
    if (f.suburb !== 'all') n++;
    if (f.categories.size !== CATEGORY_IDS.length) n++;
    if (f.statuses.size !== STATUS_IDS.length) n++;
    return n;
  }

  /* ------------------------------------------------------------------ */
  /* Building the filter controls                                        */
  /* ------------------------------------------------------------------ */

  function buildFilterControls() {
    el.demoDate.textContent = fmtLongDate(DEMO_DATE);

    // Date picker limits match the sample data range.
    const dates = activities.map((a) => a.date).sort();
    el.specificDate.min = dates[0];
    el.specificDate.max = dates[dates.length - 1];
    el.specificDate.value = DEMO_DATE;

    // Suburb dropdown, grouped by council area (LGA).
    const byLga = {};
    activities.forEach((a) => { (byLga[a.lga] = byLga[a.lga] || new Set()).add(a.suburb); });
    let html = '<option value="all">All suburbs</option>';
    Object.keys(byLga).sort().forEach((lga) => {
      html += `<optgroup label="${esc(lga)} LGA">`;
      html += `<option value="lga:${esc(lga)}">All of ${esc(lga)} LGA</option>`;
      [...byLga[lga]].sort().forEach((s) => { html += `<option value="${esc(s)}">${esc(s)}</option>`; });
      html += '</optgroup>';
    });
    el.suburb.innerHTML = html;

    // Category checkboxes.
    el.categoryOptions.innerHTML = CATEGORY_IDS.map((id) => `
      <label class="check">
        <input type="checkbox" value="${id}" checked>
        <span class="cat-chip" style="--chip:${category(id).color}">${esc(category(id).label)}</span>
        <span class="count" data-count-cat="${id}"></span>
      </label>`).join('');

    // Verification status checkboxes.
    el.statusOptions.innerHTML = STATUS_IDS.map((id) => `
      <label class="check">
        <input type="checkbox" value="${id}" checked>
        ${statusBadge(id)}
        <span class="count" data-count-status="${id}"></span>
      </label>`).join('');

    // Map legend.
    const legendPin = (cat, st) => `<span class="pin pin--${st}" style="--pin:${category(cat).color}">${category(cat).glyph}</span>`;
    el.legend.innerHTML = `
      <div class="legend-group"><span class="legend-title">Colour = category</span>
        ${CATEGORY_IDS.map((id) => `<span class="legend-item">${legendPin(id, 'provider_confirmed').replace('pin--provider_confirmed', 'pin--provider_confirmed no-badge')}${esc(category(id).label)}</span>`).join('')}
      </div>
      <div class="legend-group"><span class="legend-title">Pin style = verification</span>
        ${STATUS_IDS.map((id) => `<span class="legend-item">${legendPin('food_relief', id).replace(/--pin:[^"]+/, '--pin:#4b5563')}${esc(status(id).shortLabel)}</span>`).join('')}
      </div>`;
  }

  function syncControlsFromState() {
    const f = state.filters;
    el.search.value = f.search;
    el.datePreset.value = f.datePreset;
    el.specificField.hidden = f.datePreset !== 'specific';
    el.specificDate.value = f.specificDate;
    el.eveningOnly.checked = f.eveningOnly;
    el.suburb.value = f.suburb;
    el.categoryOptions.querySelectorAll('input').forEach((i) => { i.checked = f.categories.has(i.value); });
    el.statusOptions.querySelectorAll('input').forEach((i) => { i.checked = f.statuses.has(i.value); });
  }

  function wireFilterControls() {
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
    el.specificDate.addEventListener('change', () => {
      state.filters.specificDate = el.specificDate.value;
      update({ fit: true });
    });
    el.eveningOnly.addEventListener('change', () => {
      state.filters.eveningOnly = el.eveningOnly.checked;
      update({ fit: true });
    });
    el.categoriesAll.addEventListener('click', () => {
      state.filters.categories = new Set(CATEGORY_IDS);
      syncControlsFromState();
      update({ fit: true });
    });
    el.categoriesNone.addEventListener('click', () => {
      state.filters.categories = new Set();
      syncControlsFromState();
      update({ fit: true });
    });
    el.suburb.addEventListener('change', () => {
      state.filters.suburb = el.suburb.value;
      update({ fit: true });
    });
    el.categoryOptions.addEventListener('change', (e) => {
      const set = state.filters.categories;
      e.target.checked ? set.add(e.target.value) : set.delete(e.target.value);
      update({ fit: true });
    });
    el.statusOptions.addEventListener('change', (e) => {
      const set = state.filters.statuses;
      e.target.checked ? set.add(e.target.value) : set.delete(e.target.value);
      update({ fit: true });
    });
    el.resetFilters.addEventListener('click', () => {
      state.filters = defaultFilters();
      syncControlsFromState();
      update({ fit: true });
    });
    el.filtersToggle.addEventListener('click', () => {
      const open = !el.filters.classList.contains('is-open');
      el.filters.classList.toggle('is-open', open);
      el.filtersToggle.setAttribute('aria-expanded', String(open));
    });
  }

  /* ------------------------------------------------------------------ */
  /* Map                                                                 */
  /* ------------------------------------------------------------------ */

  let map = null;
  let markerLayer = null;
  const markers = new Map();

  function initMap() {
    if (!window.L) {
      el.map.innerHTML = '<div class="map-fallback"><div><strong>The map could not load.</strong><br>It needs an internet connection to fetch map images. The activity register below still works.</div></div>';
      el.fitMap.hidden = true;
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
      if (tileErrors === 4) {
        el.map.insertAdjacentHTML('afterend', '<p class="map-notice">Some map images could not load (check your internet connection). Activity pins and the register still work.</p>');
      }
    });

    // Only zoom with the mouse wheel after the user clicks the map, so the page scrolls normally.
    map.on('click focus', () => map.scrollWheelZoom.enable());
    el.map.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());

    markerLayer = L.layerGroup().addTo(map);
  }

  function pinIcon(a, selected) {
    const cat = category(a.category);
    return L.divIcon({
      className: 'pin-wrap',
      html: `<span class="pin pin--${a.verificationStatus}${selected ? ' is-selected' : ''}" style="--pin:${cat.color}">${cat.glyph}</span>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      tooltipAnchor: [0, -14]
    });
  }

  function renderMarkers(list) {
    if (!map) return;
    markerLayer.clearLayers();
    markers.clear();

    // Repeated sessions of one program at one site (with the same verification
    // status) share a single pin, so a weekly program is not shown as many
    // separate services. The register still lists every session.
    const groups = new Map();
    list.forEach((x) => {
      const gk = x.programId && x.siteId ? `${x.programId}|${x.siteId}|${x.verificationStatus}` : x.activityId;
      if (!groups.has(gk)) groups.set(gk, []);
      groups.get(gk).push(x);
    });

    // Several pins can share one location (e.g. programs at one hub).
    // Spread them out slightly so each pin can still be clicked.
    const seen = new Map();
    groups.forEach((members) => {
      members.sort(sorters.when);
      const a = members[0];
      const n = members.length;
      let lat = a.location.latitude;
      let lng = a.location.longitude;
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      const k = seen.get(key) || 0;
      seen.set(key, k + 1);
      if (k > 0) {
        const angle = k * 2.4;
        const r = 0.00032 * Math.sqrt(k);
        lat += r * Math.sin(angle);
        lng += r * Math.cos(angle) * 1.2;
      }

      const ids = members.map((m) => m.activityId);
      const selected = ids.includes(state.selectedId);
      const marker = L.marker([lat, lng], {
        icon: pinIcon(a, selected),
        title: n > 1 ? `${a.activityName}, ${n} sessions` : `${a.activityName}, ${fmtShortDate(a.date)}`,
        alt: a.activityName,
        keyboard: true,
        riseOnHover: true,
        zIndexOffset: selected ? 1000 : 0
      });
      const site = siteById.get(a.siteId);
      marker.bindTooltip(n > 1
        ? `<strong>${esc(a.activityName)}</strong><br>${n} scheduled sessions here in the current filters<br>Next: ${esc(fmtShortDate(a.date))} · ${esc(timeRange(a))}${site ? `<br>${esc(site.siteName)}` : ''}<br>${esc(orgName(a))}<br><em>${esc(status(a.verificationStatus).shortLabel)} (sample)</em>`
        : `<strong>${esc(a.activityName)}</strong><br>${esc(fmtShortDate(a.date))} · ${esc(timeRange(a))}${isEvening(a) ? ' · Evening' : ''}<br>${esc(orgName(a))}<br><em>${esc(status(a.verificationStatus).shortLabel)} (sample)</em>`,
        { direction: 'top' }
      );
      const pick = () => selectActivity(ids.includes(state.selectedId) ? state.selectedId : a.activityId, { pan: false });
      marker.on('click', pick);
      marker.on('keypress', (e) => { if (e.originalEvent.key === 'Enter') pick(); });
      marker.onnowGroup = { rep: a, ids };
      markerLayer.addLayer(marker);
      ids.forEach((id) => markers.set(id, marker));
    });
  }

  /* ------------------------------------------------------------------ */
  /* Map / Register view switching                                       */
  /* ------------------------------------------------------------------ */

  // The map can't measure itself while hidden, so map moves requested while the
  // Register view is showing are remembered and carried out when the map reappears.
  let currentView = 'map';
  let pendingFit = false;
  let pendingFocus = false;
  const isMapVisible = () => currentView !== 'register';

  function setView(view) {
    currentView = view;
    document.querySelectorAll('.view-toggle-btn').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.view === view));
    });
    // Combined View shows both panels, exactly as in the original dashboard.
    $('map-view').hidden = view === 'register';
    $('register-view').hidden = view === 'map';

    if (view !== 'register' && map) {
      map.invalidateSize();
      if (pendingFit) { pendingFit = false; fitMapTo(state.filtered); }
      if (pendingFocus && state.selectedId) {
        const m = markers.get(state.selectedId);
        if (m) map.setView(m.getLatLng(), Math.max(map.getZoom(), 15));
      }
      pendingFocus = false;
    }
  }

  function wireViewToggle() {
    document.querySelectorAll('.view-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => { if (btn.dataset.view !== currentView) setView(btn.dataset.view); });
    });
  }

  function fitMapTo(list) {
    if (!map || !list.length) return;
    if (!isMapVisible()) { pendingFit = true; return; }
    const bounds = L.latLngBounds(list.map((a) => [a.location.latitude, a.location.longitude]));
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
  }

  function refreshMarkerSelection(prevId) {
    if (!map) return;
    [prevId, state.selectedId].forEach((id) => {
      const m = id && markers.get(id);
      if (!m) return;
      const sel = m.onnowGroup ? m.onnowGroup.ids.includes(state.selectedId) : id === state.selectedId;
      m.setIcon(pinIcon(m.onnowGroup ? m.onnowGroup.rep : activityById.get(id), sel));
      m.setZIndexOffset(sel ? 1000 : 0);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Summary counts, register table                                      */
  /* ------------------------------------------------------------------ */

  function renderStats(list) {
    $('stat-total').textContent = list.length;
    $('stat-programs').textContent = new Set(list.map((a) => a.programId || a.activityId)).size;
    $('stat-orgs').textContent = new Set(list.map((a) => a.organisationId)).size;
    STATUS_IDS.forEach((id) => {
      $(`stat-${id}`).textContent = list.filter((a) => a.verificationStatus === id).length;
    });

    // Small counts beside each checkbox (ignoring that checkbox group's own filter).
    CATEGORY_IDS.forEach((id) => {
      const saved = state.filters.categories;
      state.filters.categories = new Set([id]);
      const n = activities.filter(matches).length;
      state.filters.categories = saved;
      document.querySelector(`[data-count-cat="${id}"]`).textContent = n;
    });
    STATUS_IDS.forEach((id) => {
      const saved = state.filters.statuses;
      state.filters.statuses = new Set([id]);
      const n = activities.filter(matches).length;
      state.filters.statuses = saved;
      document.querySelector(`[data-count-status="${id}"]`).textContent = n;
    });

    {
      const saved = state.filters.eveningOnly;
      state.filters.eveningOnly = true;
      el.eveningCount.textContent = activities.filter(matches).length;
      state.filters.eveningOnly = saved;
    }

    el.resultCount.textContent =`Showing ${list.length} of ${activities.length} fictional scheduled sessions`;
    const active = activeFilterCount();
    el.filtersToggleCount.textContent = active ? `${active} active · ${list.length} shown` : `${list.length} shown`;
  }

  function renderTable(list) {
    el.tbody.innerHTML = list.map((a) => {
      const sel = a.activityId === state.selectedId;
      return `<tr data-id="${esc(a.activityId)}" tabindex="0"${sel ? ' class="is-selected" aria-current="true"' : ''}>
        <td class="c-when"><span class="when-date">${esc(fmtShortDate(a.date))}</span><span class="when-time">${esc(timeRange(a))}</span>${isEvening(a) ? '<span class="evening-tag" title="Operates between 6 pm and midnight">Evening</span>' : ''}</td>
        <td class="c-activity"><span class="act-name">${esc(a.activityName)}</span><span class="act-meta">${catChip(a.category)}<span class="act-id">${esc(a.activityId)}</span></span></td>
        <td class="c-org">${esc(orgName(a))}</td>
        <td class="c-suburb">${esc(a.suburb)}</td>
        <td class="c-status">${statusBadge(a.verificationStatus)}</td>
      </tr>`;
    }).join('');
    el.empty.hidden = list.length > 0;

    document.querySelectorAll('thead th[data-sort]').forEach((th) => {
      if (th.dataset.sort === state.sortKey) th.setAttribute('aria-sort', state.sortDir === 1 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
  }

  function wireTable() {
    el.tbody.addEventListener('click', (e) => {
      const row = e.target.closest('tr[data-id]');
      if (row) selectActivity(row.dataset.id, { pan: true });
    });
    el.tbody.addEventListener('keydown', (e) => {
      const row = e.target.closest('tr[data-id]');
      if (!row) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectActivity(row.dataset.id, { pan: true }); }
      if (e.key === 'ArrowDown' && row.nextElementSibling) { e.preventDefault(); row.nextElementSibling.focus(); }
      if (e.key === 'ArrowUp' && row.previousElementSibling) { e.preventDefault(); row.previousElementSibling.focus(); }
    });
    document.querySelectorAll('thead th[data-sort] button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.parentElement.dataset.sort;
        if (state.sortKey === key) state.sortDir *= -1;
        else { state.sortKey = key; state.sortDir = 1; }
        update({ fit: false });
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Details panel                                                       */
  /* ------------------------------------------------------------------ */

  function renderPlaceholder() {
    el.details.innerHTML = `
      <div class="details-body">
        <div class="placeholder-icon" aria-hidden="true">📍</div>
        <h2>Activity details</h2>
        <p>Select a pin on the map or a row in the register to see what is happening, where, when and who is delivering it.</p>
        <h3>How to read verification status</h3>
        <ul class="status-guide">
          ${STATUS_IDS.map((id) => `<li>${statusBadge(id)}<p>${esc(status(id).description)}</p></li>`).join('')}
        </ul>
        <p class="hint" style="margin-top:14px">In this demonstration every status is fictional. They show how OnNow will separate provider confirmations from information that has only been published or reported.</p>
      </div>`;
  }

  function relatedList(items) {
    if (!items.length) return '<p class="hint">None in the sample data.</p>';
    return `<ul class="related">${items.map((r) => `
      <li><button type="button" data-select="${esc(r.activityId)}">
        <span class="r-name">${esc(r.activityName)}</span>
        <span class="r-meta">${esc(fmtShortDate(r.date))} · ${esc(timeRange(r))} · ${esc(r.suburb)} ${statusBadge(r.verificationStatus)}</span>
      </button></li>`).join('')}</ul>`;
  }

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

  function renderDetails(a) {
    const org = orgById.get(a.organisationId);
    const cat = category(a.category);
    const st = status(a.verificationStatus);
    const isConfirmed = a.verificationStatus === 'provider_confirmed';
    const hiddenByFilters = !state.filtered.some((x) => x.activityId === a.activityId);

    let confirmationText;
    if (isConfirmed && a.lastConfirmedDate) {
      const ago = daysBetween(a.lastConfirmedDate, DEMO_DATE);
      confirmationText = `${fmtLongDate(a.lastConfirmedDate)}<span class="sub">${ago === 0 ? 'Same day as demo date' : `${ago} day${ago === 1 ? '' : 's'} before demo date`}</span>`;
    } else {
      confirmationText = 'Not confirmed by provider<span class="sub">No provider confirmation is recorded for this activity.</span>';
    }

    // Same place, same day (a site can host many sessions across the month).
    const sameLocation = activities
      .filter((x) => x.activityId !== a.activityId && x.date === a.date
        && x.location.latitude.toFixed(4) === a.location.latitude.toFixed(4)
        && x.location.longitude.toFixed(4) === a.location.longitude.toFixed(4))
      .sort(sorters.when);
    const program = programById.get(a.programId);
    const site = siteById.get(a.siteId);
    const after = (x) => (x.date + x.startTime) > (a.date + a.startTime);
    const nextSessions = activities
      .filter((x) => x.programId && x.programId === a.programId && x.activityId !== a.activityId && after(x))
      .sort(sorters.when)
      .slice(0, 4);
    // One representative session (next on or after this date, else earliest) per other program.
    const repFor = (list) => {
      const byProgram = new Map();
      list.slice().sort(sorters.when).forEach((x) => {
        const cur = byProgram.get(x.programId);
        if (!cur || (cur.date < a.date && x.date >= a.date)) byProgram.set(x.programId, x);
      });
      return [...byProgram.values()];
    };
    const otherProgramsAtSite = site ? repFor(activities.filter((x) => x.siteId === site.siteId && x.programId !== a.programId)) : [];
    const otherOrgPrograms = repFor(activities.filter((x) => x.organisationId === a.organisationId && x.programId && x.programId !== a.programId));
    const orgActivityCount = activities.filter((x) => x.organisationId === a.organisationId).length;
    const orgProgramCount = new Set(activities.filter((x) => x.organisationId === a.organisationId).map((x) => x.programId || x.activityId)).size;
    const programList = (list) => (!list.length ? '<p class="hint">None in the sample data.</p>' : `<ul class="related">${list.map((r) => `
      <li><button type="button" data-select="${esc(r.activityId)}">
        <span class="r-name">${esc(r.activityName)}</span>
        <span class="r-meta">${esc(orgName(r))} · next ${esc(fmtShortDate(r.date))} · ${esc(timeRange(r))} ${statusBadge(r.verificationStatus)}</span>
      </button></li>`).join('')}</ul>`);
    const deliveryText = !program ? '' : program.deliveryMode === 'mobile'
      ? `Mobile service · visits ${program.siteIds.length} location${program.siteIds.length === 1 ? '' : 's'}`
      : (program.siteIds.length > 1 ? `Fixed service · delivered at ${program.siteIds.length} locations` : 'Fixed-site service');
    const siteText = !site ? '' : site.siteType === 'fixed'
      ? `Community site operated by ${(orgById.get(site.hostOrganisationId) || {}).organisationName || 'unknown'}`
      : site.siteType === 'mobile_stop' ? 'Mobile stop (public place visited by a mobile service)' : 'Location recorded with this activity';

    el.details.innerHTML = `
      <div class="details-body">
        <div class="details-top">
          ${catChip(a.category)}
          <button type="button" class="details-close" data-close aria-label="Close activity details">×</button>
        </div>
        <h2>${esc(a.activityName)}</h2>
        <p class="details-org">Delivered by <strong>${esc(org ? org.organisationName : 'Unknown')}</strong> <span class="sample-tag">Fictional</span></p>
        ${hiddenByFilters ? '<p class="hint">This activity is hidden by your current filters.</p>' : ''}

        <div class="status-box status-box--${a.verificationStatus}">
          ${statusBadge(a.verificationStatus)}
          <p>${esc(st.description)}</p>
          <p class="status-fictional"><strong>Sample status only.</strong> This is a fictional example — it is not a real ${isConfirmed ? 'confirmation from any provider' : 'record from any source'}.</p>
        </div>

        <h3>When and where</h3>
        <dl class="facts">
          <dt>Date</dt><dd>${esc(fmtLongDate(a.date))}<span class="sub">${esc(relativeDay(a.date))} (relative to demo date)</span></dd>
          <dt>Time</dt><dd>${esc(timeRange(a))}${isEvening(a)
            ? '<span class="sub"><span class="evening-tag">Evening</span> Operates at some time between 6 pm and midnight</span>'
            : ''}</dd>
          <dt>Suburb</dt><dd>${esc(a.suburb)}<span class="sub">${esc(a.lga)} LGA</span></dd>
          <dt>Location</dt><dd>${esc(a.location.description)}<span class="sub">Approximate point: ${a.location.latitude.toFixed(4)}, ${a.location.longitude.toFixed(4)}</span></dd>
        </dl>
${program ? `
        <h3>Program and site</h3>
        <dl class="facts">
          <dt>Program</dt><dd>${esc(program.programName)}<span class="sub">${esc(deliveryText)} · run by ${esc(org ? org.organisationName : 'Unknown')}</span></dd>
          <dt>Usual schedule</dt><dd>${esc(program.scheduleText)}</dd>
          <dt>Sessions</dt><dd>${program.sessionCount} scheduled session${program.sessionCount === 1 ? '' : 's'} of this program in the sample<span class="sub">This is one session of the program, not a separate service</span></dd>
          ${site ? `<dt>Site</dt><dd>${esc(site.siteName)}<span class="sub">${esc(siteText)}</span></dd>` : ''}
        </dl>` : ''}

        <h3>About this activity</h3>
        <p>${esc(a.description)}</p>

        <h3>Source and verification</h3>
        <dl class="facts">
          <dt>Source</dt><dd>${esc(sourceLabel(a.source))}<span class="sub">Fictional source for demonstration</span></dd>
          <dt>Status</dt><dd>${esc(st.label)}</dd>
          <dt>Last confirmed by provider</dt><dd>${confirmationText}</dd>
        </dl>

        <h3>Organisation</h3>
        <dl class="facts">
          <dt>Name</dt><dd>${esc(org.organisationName)}</dd>
          <dt>Type</dt><dd>${esc(org.organisationType)}</dd>
          <dt>About</dt><dd>${esc(org.description)}</dd>
          <dt>Activities</dt><dd>${orgProgramCount} program${orgProgramCount === 1 ? '' : 's'} · ${orgActivityCount} scheduled session${orgActivityCount === 1 ? '' : 's'} in the sample data</dd>
        </dl>

        <h3>Provider contact details <span class="sample-tag">Fictional</span></h3>
        <div class="contact-box">
          <p class="contact-warning"><strong>Fictional contact details.</strong> Made up for this demonstration and not linked to any real organisation. Do not call, email or visit.</p>
          <dl class="facts">
            <dt>Phone</dt><dd>${esc(org.phone || 'Not provided')}</dd>
            <dt>Email</dt><dd>${wrapFriendly(org.email || 'Not provided')}</dd>
            <dt>Website</dt><dd>${wrapFriendly(org.website || 'Not provided')}</dd>
          </dl>
        </div>

        <h3>Other activities at this location on the same day</h3>
        ${relatedList(sameLocation)}

        ${site && site.siteType !== 'recorded_location' ? `<h3>Other programs at ${esc(site.siteName)}</h3>
        ${programList(otherProgramsAtSite)}` : ''}

        <h3>Next sessions of this program</h3>
        ${relatedList(nextSessions)}

        <h3>Other programs by this organisation</h3>
        ${programList(otherOrgPrograms)}

        <details class="record">
          <summary>View data record (database structure)</summary>
          <div class="record-inner">
            <p>How this activity is stored. Each dated session links to an organisation, a program and a site by <code>organisationId</code>, <code>programId</code> and <code>siteId</code>.</p>
            <h4>Activity record</h4>
            ${recordTable(a)}
            <h4>Linked organisation record</h4>
            ${recordTable(org)}
            ${program ? `<h4>Linked program record</h4>${recordTable(program)}` : ''}
            ${site ? `<h4>Linked site record</h4>${recordTable(site)}` : ''}
          </div>
        </details>
      </div>`;
  }

  let lastFocus = null;

  function selectActivity(id, { pan }) {
    const a = activityById.get(id);
    if (!a) return;
    const prevId = state.selectedId;
    state.selectedId = id;

    el.tbody.querySelectorAll('tr.is-selected').forEach((r) => { r.classList.remove('is-selected'); r.removeAttribute('aria-current'); });
    const row = el.tbody.querySelector(`tr[data-id="${CSS.escape(id)}"]`);
    if (row) { row.classList.add('is-selected'); row.setAttribute('aria-current', 'true'); }

    refreshMarkerSelection(prevId);
    renderDetails(a);
    el.details.scrollTop = 0;

    if (pan && map && !isMapVisible()) {
      pendingFocus = true;
    } else if (pan && map) {
      const m = markers.get(id);
      const target = m ? m.getLatLng() : [a.location.latitude, a.location.longitude];
      map.flyTo(target, Math.max(map.getZoom(), 15), { duration: 0.6 });
    }

    if (isDrawerMode()) {
      if (!el.details.classList.contains('is-open')) lastFocus = document.activeElement;
      el.details.classList.add('is-open');
      el.scrim.hidden = false;
      el.details.querySelector('[data-close]').focus({ preventScroll: true });
    }
  }

  function closeDetails() {
    const prevId = state.selectedId;
    state.selectedId = null;
    el.tbody.querySelectorAll('tr.is-selected').forEach((r) => { r.classList.remove('is-selected'); r.removeAttribute('aria-current'); });
    refreshMarkerSelection(prevId);
    el.details.classList.remove('is-open');
    el.scrim.hidden = true;
    renderPlaceholder();
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  }

  function wireDetails() {
    el.details.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) { closeDetails(); return; }
      const rel = e.target.closest('[data-select]');
      if (rel) selectActivity(rel.dataset.select, { pan: true });
    });
    el.scrim.addEventListener('click', closeDetails);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.selectedId) closeDetails();
    });
    // If the window grows back to desktop size, tidy the drawer state.
    window.matchMedia('(max-width: 1240px)').addEventListener('change', (mq) => {
      if (!mq.matches) { el.details.classList.remove('is-open'); el.scrim.hidden = true; }
      else if (state.selectedId) { el.details.classList.add('is-open'); el.scrim.hidden = false; }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Main update cycle                                                   */
  /* ------------------------------------------------------------------ */

  function update({ fit }) {
    state.filtered = sortList(activities.filter(matches));
    renderStats(state.filtered);
    renderTable(state.filtered);
    renderMarkers(state.filtered);
    if (fit) fitMapTo(state.filtered);
    if (state.selectedId) renderDetails(activityById.get(state.selectedId));
  }

  buildFilterControls();
  wireFilterControls();
  wireTable();
  wireDetails();
  wireViewToggle();
  setView(isPhone() ? 'map' : 'combined'); // default: Map View on phones, Combined View otherwise
  initMap();
  renderPlaceholder();
  update({ fit: true });
  if (el.fitMap) el.fitMap.addEventListener('click', () => fitMapTo(state.filtered));
  if (isPhone()) el.filtersToggle.setAttribute('aria-expanded', 'false');
})();
