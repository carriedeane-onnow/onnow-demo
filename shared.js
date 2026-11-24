/*
 * OnNow — shared foundations used by all three pages
 * --------------------------------------------------
 *  - brand palette (taken from the supplied OnNow logo)
 *  - one icon and colour per service category, and the platform icon set
 *  - councils and the explicit suburb → council list
 *  - small date / text helpers
 *  - shared filter state (council, suburb, service types, reporting period)
 *  - the service type picker used on every page
 *  - page navigation (Explore Activities | Service Insights | Reports)
 * Icons are hand-drawn SVG on a 24-unit canvas with bold 2.5-unit rounded strokes.
 * No external icon library is used.
 */
(() => {
  'use strict';

  const DATA = window.ONNOW_SAMPLE_DATA;
  if (!DATA) return;
  const { lookups, organisations, activities } = DATA;

  /* ------------------------------------------------------------------ */
  /* Brand palette                                                       */
  /* ------------------------------------------------------------------ */

  // Navy and mint are sampled from the supplied logo (Colour-Logo-TAG400px.png).
  const BRAND = {
    navy: '#28348E',      // logo "NOW" and tagline
    navyDark: '#1C2568',
    mint: '#52C0A5',      // logo "ON" speech bubble (accent only: too light for white text)
    mintDark: '#23806A',  // accessible mint for buttons and icons with white symbols
    softNavy: '#ECEEF8',
    softMint: '#E4F5F0',
    background: '#F4F6FA',
    ink: '#1B2140',
    slate: '#55607A'
  };

  // One permanent icon + colour per service category (white symbol on a solid colour).
  const CATEGORY_STYLE = {
    community_meals:      { icon: 'meals',       color: '#A65B17' },
    food_relief:          { icon: 'basket',      color: '#397545' },
    showers_hygiene:      { icon: 'shower',      color: '#16758A' },
    laundry:              { icon: 'laundry',     color: '#365FA0' },
    clothing_assistance:  { icon: 'shirt',       color: '#7950A2' },
    legal_assistance:     { icon: 'scales',      color: '#475D75' },
    mental_health:        { icon: 'mind',        color: '#AD4869' },
    housing_homelessness: { icon: 'house',       color: '#10485D' },
    health_clinics:       { icon: 'stethoscope', color: '#237F73' },
    veterinary:           { icon: 'paw',         color: '#98751A' },
    english_classes:      { icon: 'language',    color: '#6056A6' },
    social_support:       { icon: 'heartHands',  color: '#A34F79' }
  };
  Object.keys(lookups.categories).forEach((id) => {
    const s = CATEGORY_STYLE[id] || { icon: 'info', color: '#475D75' };
    Object.assign(lookups.categories[id], { color: s.color, icon: s.icon });
  });
  const CATEGORY_IDS = Object.keys(lookups.categories);

  /* ------------------------------------------------------------------ */
  /* Icons (24 x 24, stroke-based)                                       */
  /* ------------------------------------------------------------------ */

  const F = 'fill="currentColor" stroke="none"';
  const ICONS = {
    // Service categories
    meals: '<path d="M5 3v5a2 2 0 0 0 4 0V3"/><path d="M7 10v11"/><path d="M18 21V3c-2.3 1.7-3.6 4.6-3.6 8.6H18"/>',
    basket: '<path d="M3 10h18l-2.2 9.3a1.5 1.5 0 0 1-1.5 1.2H6.7a1.5 1.5 0 0 1-1.5-1.2z"/><path d="M8 10l3-6"/><path d="M16 10l-3-6"/><path d="M9.5 14v3"/><path d="M14.5 14v3"/>',
    shower: '<path d="M5 21V7.5A3.5 3.5 0 0 1 8.5 4H10a3.5 3.5 0 0 1 3.5 3.5V9"/><path d="M9.5 9h8"/><path d="M10.5 13v.5"/><path d="M13.5 13v.5"/><path d="M16.5 13v.5"/><path d="M12 16.5v.5"/><path d="M15 16.5v.5"/><path d="M13.5 20v.5"/>',
    laundry: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M4 8h16"/><circle cx="12" cy="14.5" r="3.5"/><path d="M7.5 5.5h.01"/>',
    shirt: '<path d="M8.5 3.5 3 6.5l2 4.5 2.8-1.2V20.5h8.4V9.8l2.8 1.2 2-4.5-5.5-3c-.6 1.6-2 2.6-3.5 2.6s-2.9-1-3.5-2.6z"/>',
    scales: '<path d="M12 4v16.5"/><path d="M8 20.5h8"/><path d="M5 7.5h14"/><path d="M5 7.5 2.5 14a2.6 2.6 0 0 0 5 0z"/><path d="M19 7.5 16.5 14a2.6 2.6 0 0 0 5 0z"/>',
    mind: '<path d="M12 5.5A3.2 3.2 0 0 0 6.3 7 3.3 3.3 0 0 0 4.5 12.6 3.3 3.3 0 0 0 7.7 18.5 3 3 0 0 0 12 19z"/><path d="M12 5.5A3.2 3.2 0 0 1 17.7 7a3.3 3.3 0 0 1 1.8 5.6 3.3 3.3 0 0 1-3.2 5.9A3 3 0 0 1 12 19z"/><path d="M12 5.5V19"/>',
    house: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10.5h13V10"/><path d="M10 20.5V15h4v5.5"/>',
    stethoscope: '<path d="M5 3.5H4v5a5 5 0 0 0 10 0v-5h-1"/><path d="M9 13.5v1.5a4.5 4.5 0 0 0 9 0v-2"/><circle cx="18" cy="10.5" r="2.4"/>',
    paw: `<circle cx="5.5" cy="10.5" r="2" ${F}/><circle cx="9.5" cy="5.8" r="2" ${F}/><circle cx="14.5" cy="5.8" r="2" ${F}/><circle cx="18.5" cy="10.5" r="2" ${F}/><path d="M12 11.5c-3 0-5.5 3.6-5.5 6.2 0 1.5 1.2 2.5 2.7 2.2 1-.2 1.8-.7 2.8-.7s1.8.5 2.8.7c1.5.3 2.7-.7 2.7-2.2 0-2.6-2.5-6.2-5.5-6.2z" ${F}/>`,
    language: '<path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h7A2.5 2.5 0 0 1 15 5.5v4a2.5 2.5 0 0 1-2.5 2.5H8l-3.5 3v-3.2A2.5 2.5 0 0 1 3 9.5z"/><path d="M18 8.5h.5A2.5 2.5 0 0 1 21 11v4a2.5 2.5 0 0 1-1.5 2.3V20.5L16.5 18H13a2.5 2.5 0 0 1-2.5-2.5V15"/>',
    heartHands: '<path d="M12 11.5S8 9 8 6.4A2.1 2.1 0 0 1 12 5.5a2.1 2.1 0 0 1 4 .9c0 2.6-4 5.1-4 5.1z"/><path d="M2.5 14.5h3l4 1.8h3a1.6 1.6 0 0 1 0 3.2H9"/><path d="M14.5 19.3l4.6-2.6a1.6 1.6 0 0 1 2.1 2.3L15 22H8l-5.5-2.5"/>',

    // Platform
    map: '<path d="M3 6.5 9 3.5l6 3 6-3V18l-6 3-6-3-6 3z"/><path d="M9 3.5V18"/><path d="M15 6.5V21"/>',
    insight: '<path d="M9 18h6"/><path d="M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-4.2 11.5c.8.7 1.2 1.6 1.2 2.6V17h6v-.4c0-1 .4-1.9 1.2-2.6A6.5 6.5 0 0 0 12 2.5z"/>',
    report: '<path d="M6 2.5h8.5l4.5 4.5v14.5H6z"/><path d="M14 2.5V7h5"/><path d="M9.5 18v-3"/><path d="M12.5 18v-6"/><path d="M15.5 18v-4"/>',
    council: '<path d="M3 9.5 12 4l9 5.5z"/><path d="M5 9.5v9"/><path d="M9.7 9.5v9"/><path d="M14.3 9.5v9"/><path d="M19 9.5v9"/><path d="M2.5 21h19"/>',
    agency: '<path d="M4.5 21V5a2 2 0 0 1 2-2h6.5a2 2 0 0 1 2 2v16"/><path d="M15 9.5h3a2 2 0 0 1 2 2V21"/><path d="M2.5 21h19"/><path d="M8 7.5h3.5"/><path d="M8 11.5h3.5"/><path d="M8 15.5h3.5"/>',
    fixedSite: '<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><path d="M8.8 10.8 12 8.3l3.2 2.5v3.4H8.8z"/>',
    van: '<path d="M14 16.5V6H3.5a1 1 0 0 0-1 1v9.5h1.7"/><path d="M14 9.5h3.6l3.9 4.3v2.7h-1.7"/><path d="M8.6 16.5h6.8"/><circle cx="6.4" cy="17" r="2.1"/><circle cx="17.6" cy="17" r="2.1"/>',
    handshake: '<path d="M2 8h3.2l3.1-2.2a2 2 0 0 1 2 0L12 7"/><path d="M22 8h-3.3l-4.2-2.4a2 2 0 0 0-2.1.1L8.7 8.4a1.4 1.4 0 0 0 1.6 2.3l2.3-1.4 5.6 5.1"/><path d="M2 8v7.5h2l4.8 4.4a1.4 1.4 0 0 0 2-2"/><path d="M10.8 17.9l1 .9a1.4 1.4 0 0 0 2-2"/><path d="M13.8 16.8l.6.6a1.4 1.4 0 0 0 2-2l-.3-.3"/><path d="M22 8v7.5h-3.7"/>',
    layers: '<path d="M12 3 21 8l-9 5-9-5z"/><path d="M3 12.5l9 5 9-5"/><path d="M3 17l9 5 9-5"/>',
    gap: '<path d="M12 21.5s-7-6-7-11.6A7 7 0 0 1 17.5 5.6"/><path d="M19 9.9c0 2.4-1.3 4.8-2.9 6.9"/><path d="M3.5 3.5l17 17"/><path d="M10.7 7.6a2.5 2.5 0 0 1 3.3 2.6"/>',
    network: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M10.7 7.2 6.3 15.8"/><path d="M13.3 7.2l4.4 8.6"/><path d="M7.5 18h9"/>',
    hub: '<circle cx="12" cy="12" r="3.2"/><circle cx="4.5" cy="5" r="1.8"/><circle cx="19.5" cy="5" r="1.8"/><circle cx="4.5" cy="19" r="1.8"/><circle cx="19.5" cy="19" r="1.8"/><path d="M6 6.4l3.6 3.4"/><path d="M18 6.4l-3.6 3.4"/><path d="M6 17.6l3.6-3.4"/><path d="M18 17.6l-3.6-3.4"/>',
    referral: '<circle cx="5.5" cy="6" r="2.5"/><circle cx="18.5" cy="18" r="2.5"/><path d="M8 6h6.5a3.5 3.5 0 0 1 0 7h-5a3.5 3.5 0 0 0 0 7H16"/>',
    schedule: '<path d="M8 2.5v3"/><path d="M16 2.5v3"/><path d="M20 11V6a1.5 1.5 0 0 0-1.5-1.5h-13A1.5 1.5 0 0 0 4 6v13a1.5 1.5 0 0 0 1.5 1.5H11"/><path d="M4 9.5h16"/><circle cx="17.5" cy="17.5" r="4"/><path d="M17.5 15.8v1.9l1.2 1"/>',
    councilReport: '<path d="M6 2.5h8.5l4.5 4.5v14.5H6z"/><path d="M14 2.5V7h5"/><path d="M8.8 12.5 12 10.5l3.2 2z"/><path d="M9.5 13v4"/><path d="M14.5 13v4"/><path d="M8.5 18h7"/>',
    agencyReport: '<path d="M6 2.5h8.5l4.5 4.5v14.5H6z"/><path d="M14 2.5V7h5"/><circle cx="12.5" cy="12" r="2.2"/><path d="M8.8 18.5a3.7 3.7 0 0 1 7.4 0"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    verified: '<path d="M12 2.5l2.4 1.8 3 .1.9 2.8 2.4 1.8-.9 2.8.9 2.8-2.4 1.8-.9 2.8-3 .1L12 21.5l-2.4-1.8-3-.1-.9-2.8-2.4-1.8.9-2.8-.9-2.8 2.4-1.8.9-2.8 3-.1z"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.5h.01"/>',
    download: '<path d="M12 3.5v11"/><path d="M7 10l5 5 5-5"/><path d="M4.5 20.5h15"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/>',
    sliders: '<path d="M4 6h10"/><path d="M19 6h1"/><path d="M4 12h3"/><path d="M12 12h8"/><path d="M4 18h12"/><circle cx="16.5" cy="6" r="2.3"/><circle cx="9.5" cy="12" r="2.3"/><circle cx="18.5" cy="18" r="2.3"/>',
    close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    chevronLeft: '<path d="M15 5l-7 7 7 7"/>',
    chevronRight: '<path d="M9 5l7 7-7 7"/>',
    arrowLeft: '<path d="M20 12H5"/><path d="M11 5.5 4.5 12l6.5 6.5"/>',
    arrowRight: '<path d="M4 12h15"/><path d="M13 5.5l6.5 6.5-6.5 6.5"/>',
    list: '<path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4.5 6h.01"/><path d="M4.5 12h.01"/><path d="M4.5 18h.01"/>',
    combined: '<rect x="3" y="3" width="18" height="9" rx="2"/><path d="M3 16.5h18"/><path d="M3 20.5h12"/>',
    pin: '<path d="M12 21.5s-7-6-7-11.6a7 7 0 0 1 14 0c0 5.6-7 11.6-7 11.6z"/><circle cx="12" cy="9.8" r="2.6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    phone: '<path d="M5 3.5h3.2l1.6 4.2-2.2 1.4a11 11 0 0 0 7.3 7.3l1.4-2.2 4.2 1.6V19a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3 5.5a2 2 0 0 1 2-2z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5 12 13l8.5-6.5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 4.9a3.2 3.2 0 0 1 0 6.2"/><path d="M18 14.3A6 6 0 0 1 21 20"/>',
    alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5"/><path d="M12 17.3h.01"/>'
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  // Plain icon in the current text colour.
  function svg(name, opt) {
    const o = opt || {};
    const size = o.size || 20;
    return `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${o.stroke || 2.5}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ICONS.info}</svg>`;
  }
  // White icon on a solid coloured circle (or rounded square with shape:'square').
  function badge(name, opt) {
    const o = opt || {};
    const size = o.size || 40;
    const label = o.label ? ` role="img" aria-label="${esc(o.label)}" title="${esc(o.label)}"` : ' aria-hidden="true"';
    return `<span class="ib${o.shape === 'square' ? ' ib--sq' : ''}${o.cls ? ' ' + o.cls : ''}" style="--ib:${o.color || BRAND.navy};--is:${size}px"${label}>${svg(name, { size: Math.round(size * (o.scale || 0.58)), stroke: o.stroke })}</span>`;
  }
  const category = (id) => lookups.categories[id] || { label: id, icon: 'info', color: '#475D75' };
  const catBadge = (id, size, opt) => badge(category(id).icon, Object.assign({ color: category(id).color, size: size || 32, label: category(id).label }, opt || {}));
  // Small pill: coloured icon + label.
  const catChip = (id) => `<span class="cat-chip" style="--chip:${category(id).color}"><span class="cat-chip-ico" aria-hidden="true">${svg(category(id).icon, { size: 14, stroke: 2.8 })}</span>${esc(category(id).label)}</span>`;
  // Standalone SVG string (for converting to an image for Word reports).
  function iconSvgDocument(name, color, px, shape) {
    const r = shape === 'square' ? 5 : 12;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24"><rect width="24" height="24" rx="${r}" fill="${color}"/><g transform="translate(5 5) scale(0.5833)" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" color="#ffffff">${(ICONS[name] || ICONS.info).replace(/currentColor/g, '#ffffff')}</g></svg>`;
  }

  // Fill <span data-icon="name"> and <span data-badge="name"> placeholders in static HTML.
  function fillIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach((n) => {
      n.innerHTML = svg(n.dataset.icon, { size: Number(n.dataset.size) || 20 });
      n.classList.add('ico-wrap');
    });
    (root || document).querySelectorAll('[data-badge]').forEach((n) => {
      n.outerHTML = badge(n.dataset.badge, { size: Number(n.dataset.size) || 40, color: n.dataset.color || undefined });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Verification and delivery labels                                    */
  /* ------------------------------------------------------------------ */

  const status = (id) => lookups.verificationStatuses[id];
  const statusBadge = (id) => {
    const st = status(id);
    if (!st) return '<span class="status status--unverified">Unknown status</span>';
    const ico = id === 'provider_confirmed' ? svg('check', { size: 12, stroke: 3.2 }) : '';
    return `<span class="status status--${esc(id)}">${ico}${esc(st.shortLabel)}</span>`;
  };
  const modeTag = (mode) => (mode === 'mobile'
    ? `<span class="mode mode--mobile">${svg('van', { size: 14, stroke: 2.6 })}Mobile</span>`
    : `<span class="mode mode--fixed">${svg('fixedSite', { size: 14, stroke: 2.6 })}Fixed site</span>`);

  /* ------------------------------------------------------------------ */
  /* Councils and suburbs                                                */
  /* ------------------------------------------------------------------ */

  const COUNCILS = {
    Blacktown: { name: 'Blacktown City Council', short: 'Blacktown', center: [-33.765, 150.875] },
    Parramatta: { name: 'City of Parramatta Council', short: 'Parramatta', center: [-33.812, 151.01] }
  };

  // Explicit list. Councils are never guessed from distance.
  //   whole      = suburb lies within one council
  //   split      = suburb is divided between councils (note explains)
  //   unverified = assumed in this demo, boundary not independently checked
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
    const set = new Set(Object.keys(SUBURB_COUNCIL).filter((s) => council === 'all' || SUBURB_COUNCIL[s].council === council));
    activities.forEach((a) => { if (council === 'all' || councilOf(a) === council) set.add(a.suburb); });
    return [...set].sort();
  }

  /* ------------------------------------------------------------------ */
  /* Dates and text                                                      */
  /* ------------------------------------------------------------------ */

  const DEMO_DATE = DATA.meta.demoReferenceDate;
  const parseISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const toISO = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const daysBetween = (fromIso, toIso) => Math.round((parseISO(toIso) - parseISO(fromIso)) / 86400000);
  const fmtDay = (iso) => new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }).format(parseISO(iso));
  const fmtDate = (iso) => new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(parseISO(iso));
  const fmtDayLong = (iso) => new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseISO(iso));
  function fmtMin(min) {
    if (min === 0 || min === 1440) return 'midnight';
    if (min === 720) return '12pm';
    const h = Math.floor(min / 60), m = min % 60;
    const suffix = h >= 12 ? 'pm' : 'am';
    const h12 = ((h + 11) % 12) + 1;
    return m ? `${h12}:${String(m).padStart(2, '0')}${suffix}` : `${h12}${suffix}`;
  }
  const fmtTime = (t) => { const [h, m] = t.split(':').map(Number); return fmtMin(h * 60 + m === 1440 ? 1440 : h * 60 + m); };
  const fmtRange = (s, e) => `${fmtMin(s)} – ${fmtMin(e)}`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const WEEKDAY_PLURAL = { Mon: 'Mondays', Tue: 'Tuesdays', Wed: 'Wednesdays', Thu: 'Thursdays', Fri: 'Fridays', Sat: 'Saturdays', Sun: 'Sundays' };
  const weekdayOf = (iso) => WEEKDAYS[(parseISO(iso).getDay() + 6) % 7];
  const listText = (arr) => (arr.length <= 1 ? (arr[0] || '') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`);

  /* ------------------------------------------------------------------ */
  /* Shared filter state                                                 */
  /* ------------------------------------------------------------------ */

  // Service types: an EMPTY selection means ALL service types, on every page.
  const state = {
    council: 'all',            // 'all' (Explore only) or a COUNCILS key
    lastCouncil: 'Blacktown',  // council used by Insights and Reports while Explore shows both
    suburb: 'all',
    categories: new Set(),
    period: '14',              // Insights and Reports: '14', '30' or 'custom'
    from: DEMO_DATE,
    to: addDays(DEMO_DATE, 13),
    includeComplementary: true,
    perspective: 'council',    // Insights: 'council' or 'agency'
    orgId: null,
    page: 'explore'
  };
  const listeners = [];
  const on = (fn) => listeners.push(fn);
  function set(patch, source) {
    Object.assign(state, patch);
    if (state.council !== 'all') state.lastCouncil = state.council;
    if (state.from > state.to) { const t = state.from; state.from = state.to; state.to = t; }
    listeners.forEach((fn) => fn(patch, source));
  }
  const analysisCouncil = () => (state.council === 'all' ? state.lastCouncil : state.council);
  const inCats = (cat, set) => !set || set.size === 0 || set.has(cat);
  const catsLabel = (set) => {
    if (!set || set.size === 0 || set.size === CATEGORY_IDS.length) return 'All service types';
    const names = [...set].map((id) => category(id).label);
    return names.length <= 2 ? names.join(' and ') : `${names.length} service types`;
  };
  function periodFor(period) {
    if (period === '30') return { from: DEMO_DATE, to: addDays(DEMO_DATE, 29) };
    return { from: DEMO_DATE, to: addDays(DEMO_DATE, 13) };
  }

  /* ------------------------------------------------------------------ */
  /* Service type picker (multi-select with icons and removable chips)   */
  /* ------------------------------------------------------------------ */

  const pickers = [];
  let openPicker = null;

  function closePicker(focusButton) {
    if (!openPicker) return;
    const p = openPicker;
    openPicker = null;
    p.pop.hidden = true;
    p.btn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('picker-open');
    if (focusButton) p.btn.focus();
  }

  // root: element to build the button + popover in. chipsRoot: element for chips.
  // counts(): optional Map of category id -> number of matching sessions.
  function servicePicker(root, chipsRoot, opt) {
    const o = opt || {};
    const id = `svc-${pickers.length + 1}`;
    root.classList.add('svc-picker');
    root.innerHTML = `
      <button type="button" class="field-btn svc-btn" aria-expanded="false" aria-controls="${id}-pop" aria-haspopup="dialog">
        <span class="svc-btn-text"></span>${svg('chevronDown', { size: 18 })}
      </button>
      <div class="svc-pop" id="${id}-pop" role="dialog" aria-label="Choose service types" hidden>
        <div class="svc-pop-head">
          <div><strong>Service types</strong><span class="svc-pop-hint">Choose one or more. None ticked means all service types.</span></div>
          <button type="button" class="icon-btn" data-svc="close" aria-label="Close service types">${svg('close', { size: 20 })}</button>
        </div>
        <div class="svc-pop-actions">
          <button type="button" class="link-btn" data-svc="all">Select all</button>
          <button type="button" class="link-btn" data-svc="clear">Clear selection</button>
          <span class="svc-pop-count" aria-live="polite"></span>
        </div>
        <div class="svc-grid">
          ${CATEGORY_IDS.map((c) => `
            <label class="svc-opt">
              <input type="checkbox" value="${c}">
              ${catBadge(c, 34, { label: '' })}
              <span class="svc-opt-label">${esc(category(c).label)}</span>
              <span class="svc-opt-n" data-n="${c}"></span>
            </label>`).join('')}
        </div>
        <div class="svc-pop-foot"><button type="button" class="btn" data-svc="close">Done</button></div>
      </div>`;
    const p = { root, chipsRoot, btn: root.querySelector('.svc-btn'), pop: root.querySelector('.svc-pop'), counts: o.counts };
    pickers.push(p);

    p.btn.addEventListener('click', () => {
      if (openPicker === p) { closePicker(); return; }
      closePicker();
      openPicker = p;
      p.pop.hidden = false;
      p.btn.setAttribute('aria-expanded', 'true');
      document.body.classList.add('picker-open');
      renderPicker(p);
      const first = p.pop.querySelector('input');
      if (first) first.focus();
    });
    p.pop.addEventListener('change', (e) => {
      if (!e.target.matches('input[type=checkbox]')) return;
      const next = new Set(state.categories.size === 0 ? [] : state.categories);
      e.target.checked ? next.add(e.target.value) : next.delete(e.target.value);
      set({ categories: next.size === CATEGORY_IDS.length ? new Set(CATEGORY_IDS) : next }, 'picker');
    });
    p.pop.addEventListener('click', (e) => {
      const t = e.target.closest('[data-svc]');
      if (!t) return;
      if (t.dataset.svc === 'close') closePicker(true);
      if (t.dataset.svc === 'all') set({ categories: new Set(CATEGORY_IDS) }, 'picker');
      if (t.dataset.svc === 'clear') set({ categories: new Set() }, 'picker');
    });
    if (chipsRoot) {
      chipsRoot.addEventListener('click', (e) => {
        const t = e.target.closest('[data-remove-cat]');
        if (!t) return;
        const next = new Set(state.categories);
        next.delete(t.dataset.removeCat);
        set({ categories: next }, 'picker');
      });
    }
    renderPicker(p);
    return p;
  }

  function renderPicker(p) {
    const sel = state.categories;
    const all = sel.size === 0 || sel.size === CATEGORY_IDS.length;
    p.btn.querySelector('.svc-btn-text').innerHTML = all
      ? '<strong>All service types</strong>'
      : `<strong>${sel.size} selected</strong> <span class="svc-mini">${[...sel].slice(0, 4).map((c) => catBadge(c, 20, { label: '' })).join('')}</span>`;
    p.btn.setAttribute('aria-label', `Service types: ${all ? 'all service types' : `${sel.size} selected`}`);
    p.pop.querySelectorAll('input').forEach((i) => { i.checked = sel.has(i.value); });
    p.pop.querySelector('.svc-pop-count').textContent = sel.size === 0 ? 'All included' : `${sel.size} of ${CATEGORY_IDS.length} selected`;
    if (p.counts && !p.pop.hidden) {
      const counts = p.counts();
      p.pop.querySelectorAll('[data-n]').forEach((n) => { const v = counts.get(n.dataset.n) || 0; n.textContent = v; n.title = `${v} matching scheduled sessions`; });
    }
    if (p.chipsRoot) {
      p.chipsRoot.innerHTML = all ? '' : [...sel].map((c) => `
        <button type="button" class="chip" data-remove-cat="${c}" style="--chip:${category(c).color}" aria-label="Remove ${esc(category(c).label)}">
          <span class="chip-ico" aria-hidden="true">${svg(category(c).icon, { size: 14, stroke: 2.8 })}</span>${esc(category(c).label)}${svg('close', { size: 14, stroke: 3 })}
        </button>`).join('');
      p.chipsRoot.hidden = all;
    }
  }
  on(() => pickers.forEach(renderPicker));

  document.addEventListener('click', (e) => {
    if (openPicker && !openPicker.root.contains(e.target) && !e.target.closest('[data-remove-cat]')) closePicker();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openPicker) { e.stopPropagation(); closePicker(true); }
  }, true);

  /* ------------------------------------------------------------------ */
  /* Page navigation                                                     */
  /* ------------------------------------------------------------------ */

  const PAGES = ['explore', 'insights', 'reports'];
  const pageHandlers = {};
  function registerPage(name, handler) { pageHandlers[name] = handler; }

  function showPage(page, opts) {
    if (!PAGES.includes(page)) page = 'explore';
    closePicker();
    const prev = state.page;
    state.page = page;
    PAGES.forEach((p) => {
      const panel = document.getElementById(`page-${p}`);
      if (panel) panel.hidden = p !== page;
    });
    document.querySelectorAll('.nav-tab').forEach((b) => {
      if (b.dataset.page === page) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    if (location.hash !== `#${page}`) history.replaceState(null, '', `#${page}`);
    if (prev !== page && pageHandlers[prev] && pageHandlers[prev].hide) pageHandlers[prev].hide();
    if (pageHandlers[page] && pageHandlers[page].show) pageHandlers[page].show(opts || {});
    if (prev !== page) window.scrollTo({ top: 0 });
  }

  function initNavigation() {
    document.querySelectorAll('.nav-tab').forEach((b) => b.addEventListener('click', () => showPage(b.dataset.page)));
    window.addEventListener('hashchange', () => {
      const p = location.hash.slice(1);
      if (PAGES.includes(p) && p !== state.page) showPage(p);
    });
    const demo = document.getElementById('demo-date');
    if (demo) demo.textContent = fmtDate(DEMO_DATE);
    fillIcons(document);
  }

  window.OnNow = {
    DATA, BRAND, CATEGORY_IDS, ICONS, COUNCILS, SUBURB_COUNCIL, DEMO_DATE, WEEKDAYS, WEEKDAY_PLURAL,
    orgById: new Map(organisations.map((o) => [o.organisationId, o])),
    programById: new Map((DATA.programs || []).map((p) => [p.programId, p])),
    siteById: new Map((DATA.sites || []).map((s) => [s.siteId, s])),
    activityById: new Map(activities.map((a) => [a.activityId, a])),
    esc, svg, badge, category, catBadge, catChip, iconSvgDocument, fillIcons, status, statusBadge, modeTag,
    councilOf, suburbsInCouncil,
    parseISO, toISO, addDays, daysBetween, fmtDay, fmtDate, fmtDayLong, fmtMin, fmtTime, fmtRange, plural, weekdayOf, listText,
    state, set, on, analysisCouncil, inCats, catsLabel, periodFor,
    servicePicker, closePicker, registerPage, showPage, initNavigation
  };
})();
