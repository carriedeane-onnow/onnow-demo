/*
 * OnNow — Service Insights (formerly Service Analysis)
 * ----------------------------------------------------
 * Overview: three insight cards (overlaps, collaboration, recorded gaps).
 * Detail views reveal one area at a time. The detailed analysis from the
 * earlier Service Analysis page (statistics, every overlap period, timeline,
 * concentration map, daily gaps, service areas) is kept in expandable sections.
 * Council and agency perspectives use the same calculations (analysis.js).
 * Also provides the collaboration graphics (window.OnNowGraphics).
 */
(() => {
  'use strict';

  const O = window.OnNow;
  const A = window.OnNowAnalysis;
  if (!O || !A) return;
  const { DATA, esc, svg, badge, catBadge, catChip, statusBadge, modeTag, category, orgById, programById, siteById,
    COUNCILS, SUBURB_COUNCIL, DEMO_DATE, addDays, fmtDay, fmtDayLong, fmtMin, fmtRange, plural, listText, councilOf, suburbsInCouncil } = O;
  const S = O.state;
  const { activities, organisations } = DATA;
  const orgName = A.orgName;
  const GAP_WINDOW = [8 * 60, 20 * 60];
  const LIST_LIMIT = 8;

  /* ================================================================== */
  /* Collaboration graphics (SVG, self-contained so they can also be     */
  /* converted to images for Word reports)                                */
  /* ================================================================== */

  const G = (() => {
    const FONT = 'Segoe UI, Arial, sans-serif';
    const NAVY = O.BRAND.navy, MINT = O.BRAND.mintDark, INK = '#1B2140', MUTED = '#5D6680';
    const iconG = (name, cx, cy, size, color) => {
      const s = size / 24;
      const c = color || '#ffffff';
      return `<g transform="translate(${(cx - size / 2).toFixed(2)} ${(cy - size / 2).toFixed(2)}) scale(${s.toFixed(4)})" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${(O.ICONS[name] || O.ICONS.info).replace(/currentColor/g, c)}</g>`;
    };
    function wrap(text, max, lines) {
      const words = String(text).split(/\s+/);
      const out = [];
      let cur = '';
      words.forEach((w) => {
        if (!cur) cur = w;
        else if ((cur + ' ' + w).length <= max) cur += ' ' + w;
        else { out.push(cur); cur = w; }
      });
      if (cur) out.push(cur);
      if (out.length > lines) {
        const keep = out.slice(0, lines);
        keep[lines - 1] = keep[lines - 1].slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
        return keep;
      }
      return out.map((l) => (l.length > max + 4 ? l.slice(0, max) + '…' : l));
    }
    const text = (lines, x, y, anchor, size, weight, color, lh) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${color}">${lines.map((l, i) => `<tspan x="${x.toFixed(1)}" dy="${i ? lh : 0}">${esc(l)}</tspan>`).join('')}</text>`;
    // Dotted connector that stops cleanly outside both circles (radius + half stroke + clearance).
    function connector(x1, y1, r1, x2, y2, r2, color) {
      const sw = 3, clear = 6 + sw / 2;
      const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
      if (d <= r1 + r2 + 2 * clear) return '';
      const ux = dx / d, uy = dy / d;
      const sx = x1 + ux * (r1 + clear), sy = y1 + uy * (r1 + clear);
      const ex = x2 - ux * (r2 + clear), ey = y2 - uy * (r2 + clear);
      return `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="${color || '#8A93AD'}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="0.01 8"/>`;
    }
    const modeBadge = (cx, cy, r, mode) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${NAVY}" stroke="#fff" stroke-width="3"/>${iconG(mode === 'mobile' ? 'van' : 'fixedSite', cx, cy, r * 1.2)}`;
    const svgOpen = (w, h, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}" class="opp-svg">`;

    // dir: direction (unit vector) for the small fixed/mobile badge, pointing away from any connector.
    function serviceNode(cx, cy, r, cat, mode, ring, dir) {
      const c = category(cat);
      const d = dir || [0.7071, 0.7071];
      const br = Math.max(11, r * 0.34);
      return `${ring ? `<circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="none" stroke="${O.BRAND.mint}" stroke-width="4"/>` : ''}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c.color}"/>${iconG(c.icon, cx, cy, r * 1.05)}${mode ? modeBadge(cx + d[0] * r * 1.02, cy + d[1] * r * 1.02, br, mode) : ''}`;
    }

    // Two organisations connected by a handshake.
    function pair(g, opts) {
      const W = 460, H = 226, cy = 74, r = 46;
      const a = g.a, b = g.b;
      const lbl = (p, x) => {
        const lines = wrap(orgName(p.org), 20, 2);
        const sub = [category(p.cat).label, p.mode === 'mobile' ? 'Mobile service' : 'Fixed site'];
        return text(lines, x, cy + r + 24, 'middle', 14, 700, INK, 17)
          + text(sub, x, cy + r + 24 + lines.length * 17 + 2, 'middle', 12, 400, MUTED, 15);
      };
      return `${svgOpen(W, H, `${orgName(a.org)} and ${orgName(b.org)}`)}${opts && opts.bg ? `<rect width="${W}" height="${H}" fill="#fff"/>` : ''}
        ${connector(80, cy, r, 230, cy, 30, MINT)}${connector(230, cy, 30, 380, cy, r, MINT)}
        ${serviceNode(80, cy, r, a.cat, a.mode)}${serviceNode(380, cy, r, b.cat, b.mode)}
        <circle cx="230" cy="${cy}" r="30" fill="${MINT}"/>${iconG('handshake', 230, cy, 34)}
        ${lbl(a, 80)}${lbl(b, 380)}</svg>`;
    }

    // Two mobile providers and a shared (existing or possible) location.
    function mobile(g, opts) {
      const W = 460, H = 250, vy = 62, r = 40, px = 230, py = 132, pr = 32;
      const lbl = (p, x) => text(wrap(orgName(p.org), 18, 2), x, vy + r + 22, 'middle', 13.5, 700, INK, 16);
      const pin = g.exists
        ? `<circle cx="${px}" cy="${py}" r="${pr}" fill="${NAVY}"/>${iconG('pin', px, py, 34)}`
        : `<circle cx="${px}" cy="${py}" r="${pr}" fill="#fff" stroke="${NAVY}" stroke-width="3" stroke-dasharray="6 5"/>${iconG('pin', px, py, 34, NAVY)}`;
      return `${svgOpen(W, H, `${orgName(g.a.org)} and ${orgName(g.b.org)} at ${g.place}`)}${opts && opts.bg ? `<rect width="${W}" height="${H}" fill="#fff"/>` : ''}
        ${connector(80, vy, r, px, py, pr, MINT)}${connector(380, vy, r, px, py, pr, MINT)}
        ${serviceNode(80, vy, r, g.a.cat, 'mobile', false, [-0.7071, 0.7071])}${serviceNode(380, vy, r, g.b.cat, 'mobile', false, [0.7071, 0.7071])}${pin}
        ${lbl(g.a, 80)}${lbl(g.b, 380)}
        ${text(wrap(g.place, 30, 2), px, py + pr + 22, 'middle', 13.5, 700, INK, 16)}
        ${text([g.exists ? 'Recorded stop used by both' : 'Possible shared stop (not recorded)'], px, py + pr + 22 + wrap(g.place, 30, 2).length * 16 + 2, 'middle', 12, 600, g.exists ? MINT : MUTED, 15)}
        ${g.more > 0 ? text([`+${g.more} more nearby`], W - 8, H - 10, 'end', 12, 600, MUTED, 15) : ''}</svg>`;
    }

    // Hub and spoke: a shared location (or organisation) with surrounding nodes.
    function hub(g, opts) {
      const W = 540, H = 372, cx = 270, cy = 176, R = 42, r = 28, ring = 112;
      const nodes = g.nodes.slice(0, 6);
      const n = nodes.length;
      const start = -90 + 180 / n;
      let lines = '', circles = '', labels = '';
      nodes.forEach((node, i) => {
        const ang = ((start + (360 / n) * i) * Math.PI) / 180;
        const ux = Math.cos(ang), uy = Math.sin(ang);
        const nx = cx + ux * ring, ny = cy + uy * ring;
        lines += connector(cx, cy, R, nx, ny, r + (node.at ? 6 : 0), '#8A93AD');
        circles += serviceNode(nx, ny, r, node.cat, node.mode, node.at, [ux, uy]);
        const lab = wrap(orgName(node.org), 15, 2);
        // Labels sit outside the node and its badge, on the side away from the hub.
        if (Math.abs(ux) >= 0.45) {
          const x = nx + Math.sign(ux) * (r + 20);
          labels += text(lab, x, ny - (lab.length - 1) * 8 + 5, ux > 0 ? 'start' : 'end', 13, 700, INK, 16);
        } else if (uy > 0) {
          labels += text(lab, nx, ny + r + 34, 'middle', 13, 700, INK, 16);
        } else {
          labels += text(lab, nx, ny - r - 22 - (lab.length - 1) * 16, 'middle', 13, 700, INK, 16);
        }
      });
      const centre = g.centerCat
        ? `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${category(g.centerCat).color}"/>${iconG(category(g.centerCat).icon, cx, cy, 40)}`
        : `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${NAVY}"/>${iconG('fixedSite', cx, cy, 42)}`;
      return `${svgOpen(W, H, `${g.center} with ${g.nodes.length} organisations`)}${opts && opts.bg ? `<rect width="${W}" height="${H}" fill="#fff"/>` : ''}
        ${text(wrap(g.center, 44, 1), cx, 22, 'middle', 15, 700, NAVY, 18)}
        ${lines}${centre}${circles}${labels}
        ${g.nodes.length > 6 ? text([`+${g.nodes.length - 6} more (see list)`], W - 8, H - 8, 'end', 12, 600, MUTED, 15) : ''}</svg>`;
    }

    // Concentrated mobile stops and suburbs with no recorded service.
    function geo(g, opts) {
      const W = 460, H = 200;
      const conc = [...new Set(g.stops.map((s) => s.suburb))];
      const vans = [...new Map(g.stops.map((s) => [s.org, s])).values()].slice(0, 3);
      const low = g.low.slice(0, 3);
      let out = `${svgOpen(W, H, 'Concentrated mobile stops and suburbs with no recorded service')}${opts && opts.bg ? `<rect width="${W}" height="${H}" fill="#fff"/>` : ''}`;
      out += `<circle cx="110" cy="78" r="38" fill="${NAVY}"/>${iconG('pin', 110, 78, 38)}`;
      vans.forEach((v, i) => {
        const ang = ((-150 + i * 60) * Math.PI) / 180;
        const x = 110 + Math.cos(ang) * 62, y = 78 + Math.sin(ang) * 54;
        out += serviceNode(x, y, 17, v.cat, null);
      });
      out += text(wrap(`Stops concentrate: ${conc.slice(0, 3).join(', ')}`, 26, 2), 110, 146, 'middle', 13, 700, INK, 16);
      low.forEach((s, i) => {
        const x = 270 + i * 76;
        out += `<circle cx="${x}" cy="78" r="24" fill="#fff" stroke="#475D75" stroke-width="2.5" stroke-dasharray="5 4"/>${iconG('gap', x, 78, 26, '#475D75')}`;
        out += text(wrap(s, 11, 2), x, 122, 'middle', 12, 600, MUTED, 15);
      });
      out += text([g.low.length > 3 ? `No recorded service in ${g.low.length} suburbs` : 'No recorded service'], 346, 176, 'middle', 12, 700, '#475D75', 15);
      return out + '</svg>';
    }

    // Schedule comparison (HTML, responsive).
    function scheduleHtml(g) {
      const all = g.bars.concat(g.hypo);
      const s0 = Math.floor(Math.min(...all.map((b) => b.start)) / 60) * 60;
      const s1 = Math.ceil(Math.max(...all.map((b) => b.end)) / 60) * 60;
      const pct = (m) => ((m - s0) / (s1 - s0)) * 100;
      const ticks = [];
      for (let m = s0; m <= s1; m += 60) ticks.push(`<span style="left:${pct(m)}%">${esc(fmtMin(m))}</span>`);
      const row = (b, hypo) => `<div class="sch-row"><span class="sch-label">${esc(b.name)}<small>${esc(orgName(b.org))}</small></span>
        <span class="sch-track"><span class="sch-bar${hypo ? ' sch-bar--hypo' : ''}" style="--bar:${category(b.cat).color};left:${pct(b.start)}%;width:${pct(b.end) - pct(b.start)}%" title="${esc(fmtRange(b.start, b.end))}">${esc(fmtRange(b.start, b.end))}</span></span></div>`;
      return `<div class="sch">
        <p class="sch-cap"><strong>Recorded operating windows</strong> on ${esc(fmtDay(g.date))}</p>
        ${g.bars.map((b) => row(b, false)).join('')}
        <div class="sch-row sch-row--axis"><span class="sch-label"></span><span class="sch-axis">${ticks.join('')}</span></div>
        <p class="sch-cap sch-cap--hypo"><strong>Hypothetical illustration only</strong>: the same sessions run one after another. Not an agreed or recommended change.</p>
        ${g.hypo.map((b) => row(b, true)).join('')}
      </div>`;
    }

    function forOpp(o, opts) {
      const g = o.graphic;
      if (!g) return '';
      if (g.kind === 'pair') return pair(g, opts);
      if (g.kind === 'mobile') return mobile(g, opts);
      if (g.kind === 'hub') return hub(g, opts);
      if (g.kind === 'geo') return geo(g, opts);
      if (g.kind === 'schedule') return opts && opts.svgOnly ? '' : scheduleHtml(g);
      return '';
    }
    return { pair, mobile, hub, geo, scheduleHtml, forOpp, wrap };
  })();
  window.OnNowGraphics = G;

  /* ================================================================== */
  /* Page state                                                          */
  /* ================================================================== */

  const local = {
    view: 'overview',
    day: DEMO_DATE,
    overlapMode: 'suburb',
    showAll: false,
    expanded: null,
    mapScope: 'range',
    winStart: 15 * 60,
    winEnd: 17 * 60,
    collabType: 'all',
    openOpp: null,
    collabLimit: 8,
    recurringAll: false,
    progAll: false
  };
  let dirty = true;
  let result = null;
  let ctx = null;

  const $ = (id) => document.getElementById(id);
  const el = {
    page: $('page-insights'), council: $('sa-council'), suburb: $('sa-suburb'), period: $('sa-period'), from: $('sa-from'), to: $('sa-to'),
    org: $('in-org'), orgField: $('in-agency-field'), complement: $('in-complement'), more: $('in-more'), morePanel: $('in-more-panel'), moreCount: $('in-more-count'),
    reset: $('sa-reset'), scope: $('sa-scope'), agency: $('in-agency'), cards: $('in-cards'), tabs: $('in-tabs'),
    recurring: $('in-ov-recurring'), summary: $('sa-summary'), overlaps: $('sa-overlaps'), timeline: $('sa-timeline'), day: $('sa-day'),
    prevDay: $('sa-prev-day'), nextDay: $('sa-next-day'), collab: $('in-collab'), coverage: $('in-coverage'),
    mapControls: $('sa-map-controls'), map: $('sa-map'), mapNote: $('sa-map-note'), gaps: $('sa-gaps'), catchment: $('sa-catchment'), method: $('in-method-body')
  };
  if (!el.page) return;

  const council = () => O.analysisCouncil();
  const suburb = () => (S.suburb !== 'all' && suburbsInCouncil(council()).includes(S.suburb) ? S.suburb : 'all');
  const orgId = () => (S.perspective === 'agency' ? S.orgId : null);
  const opt = () => ({ council: council(), suburb: suburb(), categories: S.categories, from: S.from, to: S.to, includeComplementary: S.includeComplementary, orgId: orgId() });
  const scopeName = () => (suburb() === 'all' ? COUNCILS[council()].name : `${suburb()} (${COUNCILS[council()].name})`);
  const catsText = () => O.catsLabel(S.categories);
  const daysInRange = () => { const out = []; for (let d = S.from; d <= S.to && out.length < 366; d = addDays(d, 1)) out.push(d); return out; };
  const involvesOrg = (items) => !orgId() || items.some((s) => s.a.organisationId === orgId());

  function mainCouncilOf(org) {
    const counts = {};
    activities.filter((a) => a.organisationId === org).forEach((a) => { const c = councilOf(a); if (c) counts[c] = (counts[c] || 0) + 1; });
    return Object.keys(counts).sort((x, y) => counts[y] - counts[x])[0] || council();
  }

  /* ================================================================== */
  /* Controls                                                            */
  /* ================================================================== */

  function buildControls() {
    el.council.innerHTML = Object.keys(COUNCILS).map((k) => `<option value="${k}">${esc(COUNCILS[k].name)}</option>`).join('');
    el.org.innerHTML = organisations.slice().sort((x, y) => x.organisationName.localeCompare(y.organisationName))
      .map((o) => `<option value="${o.organisationId}">${esc(o.organisationName)} (${esc(COUNCILS[mainCouncilOf(o.organisationId)].short)})</option>`).join('');
    O.servicePicker($('in-services'), $('in-chips'), {
      counts: () => {
        const r = A.analyse(activities, Object.assign(opt(), { categories: new Set() }));
        return new Map(O.CATEGORY_IDS.map((c) => [c, new Set(r.segs.filter((s) => s.a.category === c).map((s) => s.a.activityId)).size]));
      }
    });
  }

  function syncControls() {
    el.council.value = council();
    el.suburb.innerHTML = '<option value="all">All suburbs in this council</option>'
      + suburbsInCouncil(council()).map((s) => {
        const m = SUBURB_COUNCIL[s];
        return `<option value="${esc(s)}">${esc(s)}${m && m.boundary === 'split' ? ' (split suburb)' : ''}</option>`;
      }).join('');
    el.suburb.value = suburb();
    el.period.value = S.period;
    el.from.value = S.from;
    el.to.value = S.to;
    el.complement.checked = S.includeComplementary;
    el.orgField.hidden = S.perspective !== 'agency';
    if (S.orgId) el.org.value = S.orgId;
    document.querySelectorAll('.persp-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.persp === S.perspective)));
    el.tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === local.view)));
    el.day.innerHTML = daysInRange().map((d) => `<option value="${d}">${esc(fmtDay(d))}</option>`).join('');
    el.day.value = local.day;
    const custom = S.period === 'custom' ? 1 : 0;
    el.moreCount.hidden = !custom;
    el.moreCount.textContent = custom;
  }

  function ensureOrg() {
    if (!S.orgId) {
      const delivering = organisations.filter((o) => mainCouncilOf(o.organisationId) === council())
        .sort((x, y) => x.organisationName.localeCompare(y.organisationName));
      S.orgId = (delivering[0] || organisations[0]).organisationId;
    }
  }

  function wireControls() {
    el.council.addEventListener('change', () => O.set({ council: el.council.value, suburb: 'all' }, 'insights'));
    el.suburb.addEventListener('change', () => O.set({ suburb: el.suburb.value }, 'insights'));
    el.period.addEventListener('change', () => {
      const v = el.period.value;
      if (v === 'custom') { O.set({ period: 'custom' }, 'insights'); el.morePanel.hidden = false; el.more.setAttribute('aria-expanded', 'true'); return; }
      O.set(Object.assign({ period: v }, O.periodFor(v)), 'insights');
    });
    el.from.addEventListener('change', () => { if (A.validDate(el.from.value)) O.set({ from: el.from.value, period: 'custom' }, 'insights'); });
    el.to.addEventListener('change', () => { if (A.validDate(el.to.value)) O.set({ to: el.to.value, period: 'custom' }, 'insights'); });
    el.complement.addEventListener('change', () => O.set({ includeComplementary: el.complement.checked }, 'insights'));
    el.org.addEventListener('change', () => {
      const org = el.org.value;
      const c = mainCouncilOf(org);
      O.set({ orgId: org, council: c, suburb: c === council() ? S.suburb : 'all' }, 'insights');
    });
    el.more.addEventListener('click', () => {
      const open = el.morePanel.hidden;
      el.morePanel.hidden = !open;
      el.more.setAttribute('aria-expanded', String(open));
    });
    el.reset.addEventListener('click', () => {
      Object.assign(local, { view: 'overview', day: DEMO_DATE, collabType: 'all', openOpp: null, expanded: null, showAll: false });
      O.set(Object.assign({ suburb: 'all', categories: new Set(), period: '14', includeComplementary: true }, O.periodFor('14')), 'insights');
    });
    document.querySelectorAll('.persp-btn').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.persp === 'agency') {
        ensureOrg();
        const c = mainCouncilOf(S.orgId);
        O.set({ perspective: 'agency', council: c, suburb: c === council() ? S.suburb : 'all' }, 'insights');
      } else O.set({ perspective: 'council' }, 'insights');
    }));
    el.tabs.addEventListener('click', (e) => { const b = e.target.closest('button[data-view]'); if (b) setView(b.dataset.view); });
    el.page.addEventListener('click', onAction);
    el.page.addEventListener('change', (e) => {
      if (e.target.id === 'sa-win-start' || e.target.id === 'sa-win-end') {
        const s = Number($('sa-win-start').value);
        let f = Number($('sa-win-end').value);
        if (f <= s) f = Math.min(s + 60, 1440);
        local.winStart = s; local.winEnd = f;
        renderMap();
      }
    });
    el.day.addEventListener('change', () => { local.day = el.day.value; renderTimeline(); });
    el.prevDay.addEventListener('click', () => { if (local.day > S.from) { local.day = addDays(local.day, -1); el.day.value = local.day; renderTimeline(); } });
    el.nextDay.addEventListener('click', () => { if (local.day < S.to) { local.day = addDays(local.day, 1); el.day.value = local.day; renderTimeline(); } });
    $('adv-map').addEventListener('toggle', () => { if ($('adv-map').open) { ensureMap(); if (saMap) saMap.invalidateSize(); renderMap(); } });
  }

  function onAction(e) {
    const t = e.target.closest('[data-sa-action], [data-goto], [data-opp], [data-ctype], [data-collab-more], [data-recurring-all], [data-prog-all]');
    if (!t) return;
    if (t.dataset.goto) { setView(t.dataset.goto, t.dataset.ctype); return; }
    if (t.dataset.opp) {
      local.openOpp = local.openOpp === t.dataset.opp ? null : t.dataset.opp;
      renderCollab();
      const again = el.collab.querySelector(`[data-opp="${CSS.escape(t.dataset.opp)}"]`);
      if (again) again.focus({ preventScroll: true });
      return;
    }
    if (t.dataset.ctype) { local.collabType = t.dataset.ctype; local.collabLimit = 8; local.openOpp = null; renderCollab(); return; }
    if ('collabMore' in t.dataset) { local.collabLimit = local.collabLimit === Infinity ? 8 : Infinity; renderCollab(); return; }
    if ('recurringAll' in t.dataset) { local.recurringAll = !local.recurringAll; renderRecurring(); return; }
    if ('progAll' in t.dataset) { local.progAll = !local.progAll; renderAgency(); return; }
    const act = t.dataset.saAction;
    if (act === 'mode') { local.overlapMode = t.dataset.value; local.showAll = false; renderOverlaps(); }
    if (act === 'show-all') { local.showAll = !local.showAll; renderOverlaps(); }
    if (act === 'expand') { local.expanded = local.expanded === t.dataset.value ? null : t.dataset.value; renderOverlaps(); }
    if (act === 'timeline') {
      local.day = t.dataset.value;
      if (local.view !== 'overlaps') setView('overlaps');
      $('adv-timeline').open = true;
      el.day.value = local.day;
      renderTimeline();
      $('adv-timeline').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (act === 'suburb') O.set({ suburb: t.dataset.value }, 'insights');
    if (act === 'map-scope') { local.mapScope = t.dataset.value; renderMap(); }
  }

  function setView(view, ctype) {
    local.view = view;
    if (ctype) { local.collabType = ctype; local.collabLimit = 8; local.openOpp = null; }
    ['overview', 'overlaps', 'collab', 'coverage'].forEach((v) => { $(`in-view-${v}`).hidden = v !== view; });
    el.tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    if (view === 'collab') renderCollab();
    if (view === 'coverage' && $('adv-map').open) { ensureMap(); if (saMap) saMap.invalidateSize(); renderMap(); }
    if (view !== 'overview') {
      const head = $(`in-view-${view}`).querySelector('h2');
      el.tabs.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (head) head.setAttribute('tabindex', '-1');
    }
  }

  /* ================================================================== */
  /* Calculations for the current selection                              */
  /* ================================================================== */

  function compute() {
    const o = opt();
    if (local.day < S.from || local.day > S.to) local.day = S.from;
    result = A.analyse(activities, o);
    const councilSegs = A.buildOccurrences(activities.filter((a) => councilOf(a) === o.council)).segments.filter((s) => s.date >= o.from && s.date <= o.to);
    let similar = A.similarOverlaps(councilSegs, o);
    if (o.orgId) similar = similar.filter((e) => e.orgIds.includes(o.orgId));
    const opps = A.opportunities(activities, o);
    const gaps = A.categoryGaps(activities, o);
    const subGaps = A.suburbGaps(activities, o);
    ctx = { o, councilSegs, similar, opps, gaps, subGaps };
  }

  /* ================================================================== */
  /* Rendering                                                           */
  /* ================================================================== */

  function renderScope() {
    const m = suburb() !== 'all' ? SUBURB_COUNCIL[suburb()] : null;
    const persp = S.perspective === 'agency'
      ? `<span class="scope-persp">${svg('agency', { size: 18 })}Agency view</span>`
      : `<span class="scope-persp">${svg('council', { size: 18 })}Council view</span>`;
    el.scope.innerHTML = `${persp}<span><strong>${esc(COUNCILS[council()].name)}</strong>${suburb() !== 'all' ? ` › <strong>${esc(suburb())}</strong>` : ' · all suburbs'}</span>
      <span>${esc(fmtDay(S.from))} – ${esc(fmtDay(S.to))} ${S.period !== 'custom' ? `(${S.period} days)` : '(custom)'}</span>
      <span>${esc(catsText())}</span>
      ${m && m.note ? `<p class="scope-note"><strong>Boundary note:</strong> ${esc(m.note)}</p>` : ''}`;
  }

  function renderAgency() {
    if (S.perspective !== 'agency') { el.agency.innerHTML = ''; return; }
    const org = orgById.get(S.orgId);
    if (!org) { el.agency.innerHTML = ''; return; }
    const inPeriod = A.buildOccurrences(activities.filter((a) => a.organisationId === org.organisationId)).segments.filter((s) => s.date >= S.from && s.date <= S.to);
    const progs = [...A.programsOf(inPeriod).values()];
    const allProgIds = [...new Set(activities.filter((a) => a.organisationId === org.organisationId).map((a) => a.programId || a.activityId))];
    const locs = new Set(inPeriod.map((s) => s.a.siteId || s.a.activityId));
    const shown = local.progAll ? progs : progs.slice(0, 4);
    el.agency.innerHTML = `
      <section class="agency-card" aria-label="Selected organisation">
        <div class="agency-top">
          ${badge('agency', { size: 56, color: O.BRAND.mintDark })}
          <div><p class="agency-kicker">Agency view</p><h2>${esc(org.organisationName)}</h2><p>${esc(org.organisationType)} · ${esc(org.description)}</p></div>
        </div>
        <div class="agency-stats">
          <span><strong>${allProgIds.length}</strong> program${allProgIds.length === 1 ? '' : 's'} recorded</span>
          <span><strong>${progs.length}</strong> running in this period</span>
          <span><strong>${locs.size}</strong> delivery location${locs.size === 1 ? '' : 's'}</span>
          <span><strong>${new Set(inPeriod.map((s) => s.a.activityId)).size}</strong> scheduled sessions</span>
        </div>
        ${progs.length ? `<ul class="agency-progs">${shown.map((p) => `<li>${catBadge(p.cat, 38)}<div><strong>${esc(p.name)}</strong> ${modeTag(p.mode)}
          <span>${esc(p.stops.map((s) => `${s.name}, ${s.suburb}`).join('; '))}</span><span>${esc(p.pattern)}</span></div></li>`).join('')}</ul>
          ${progs.length > 4 ? `<button type="button" class="link-btn" data-prog-all>${local.progAll ? 'Show fewer programs' : `Show all ${progs.length} programs`}</button>` : ''}`
          : '<p class="hint">No sessions recorded for this organisation in the selected period.</p>'}
        <p class="hint">Agency view shows public, fictional demonstration records only. Selecting an organisation does not give access to any private information.</p>
      </section>`;
  }

  /* ---------- Overview cards ---------- */

  function renderCards() {
    const { similar, opps, gaps, subGaps } = ctx;
    const agency = S.perspective === 'agency';
    const top = similar[0];
    const progName = (id) => (programById.get(id) || {}).programName || (activities.find((a) => (a.programId || a.activityId) === id) || {}).activityName || id;
    const recurring = similar.filter((e) => e.dates.size >= 2);

    const ovFigure = recurring.length || similar.length;
    const ovText = top
      ? `${listText(top.progIds.map((id) => `${progName(id)} (${orgName((activities.find((a) => a.programId === id) || top.items[0].a).organisationId)})`))} overlap ${top.window} on ${plural(top.dates.size, 'date')} in ${top.suburb}.`
      : (agency ? 'No similar services are recorded at the same time and place as this organisation\'s services in this period.' : 'No similar services are recorded at the same time in the same suburb for this selection.');

    const counts = { existing: 0, potential: 0, investigate: 0 };
    opps.forEach((o) => { counts[o.status] += 1; });
    const highlight = opps.find((o) => o.type === 'hub' && o.hub && o.hub.hosted) || opps.find((o) => o.type === 'hub') || opps.find((o) => o.status === 'potential') || opps[0];
    const typeCounts = Object.keys(A.TYPES).map((k) => ({ k, n: opps.filter((o) => o.type === k).length }));

    let gapFigure, gapLabel, gapText;
    if (agency) {
      const around = agencyGaps();
      gapFigure = around.reduce((t, x) => t + x.missing.length, 0);
      gapLabel = 'service types not recorded near your locations';
      gapText = around.length && gapFigure
        ? `${listText(around[0].missing.slice(0, 3).map((c) => category(c).label.toLowerCase()))} ${around[0].missing.length > 3 ? `and ${around[0].missing.length - 3} more ` : ''}not recorded in ${around[0].suburb} in this period.`
        : 'Every service type checked has at least one recorded session near your locations.';
    } else if (gaps.length) {
      gapFigure = gaps.length;
      gapLabel = gaps.length === 1 ? 'service type with no recorded sessions' : 'service types with no recorded sessions';
      gapText = `No ${category(gaps[0].category).label.toLowerCase()} sessions are recorded in ${COUNCILS[council()].name} from ${fmtDay(S.from)} to ${fmtDay(S.to)}.`;
    } else {
      const empty = subGaps.filter((x) => x.occurrences === 0);
      gapFigure = empty.length;
      gapLabel = empty.length === 1 ? 'suburb with no recorded sessions' : 'suburbs with no recorded sessions';
      gapText = empty.length ? `No ${catsText().toLowerCase()} sessions recorded in ${listText(empty.slice(0, 3).map((x) => x.suburb))}${empty.length > 3 ? ` and ${empty.length - 3} more` : ''}.` : 'Every suburb in scope has recorded sessions for this selection.';
    }

    el.cards.innerHTML = `
      <article class="ins-card ins-card--overlaps">
        <div class="ins-head">${badge('layers', { size: 56 })}<h2>Service overlaps</h2></div>
        <p class="ins-purpose">Similar services operating in the same area at the same time.</p>
        <p class="ins-figure"><strong>${ovFigure}</strong><span>${recurring.length ? 'recurring overlap pattern' + (recurring.length === 1 ? '' : 's') : 'overlap pattern' + (similar.length === 1 ? '' : 's')}</span></p>
        <p class="ins-text">${esc(ovText)}</p>
        <button type="button" class="btn" data-goto="overlaps">Explore overlaps${svg('arrowRight', { size: 18 })}</button>
      </article>
      <article class="ins-card ins-card--collab">
        <div class="ins-head">${badge('handshake', { size: 56, color: O.BRAND.mintDark })}<h2>Collaboration opportunities</h2></div>
        <p class="ins-purpose">Discover opportunities for organisations to work together.</p>
        <p class="ins-figure"><strong>${opps.length}</strong><span>${agency ? `involving ${esc(orgName(S.orgId))}` : 'potential opportunities'}</span></p>
        <div class="ins-status">
          <span class="opp-status opp-status--existing">${counts.existing} existing</span>
          <span class="opp-status opp-status--potential">${counts.potential} potential</span>
          <span class="opp-status opp-status--investigate">${counts.investigate} to investigate</span>
        </div>
        <div class="ins-types">${typeCounts.map((t) => `<button type="button" class="ins-type" data-goto="collab" data-ctype="${t.k}" ${t.n ? '' : 'disabled'} title="${esc(A.TYPES[t.k].label)}">${badge(A.TYPES[t.k].icon, { size: 30, color: t.n ? O.BRAND.navy : '#AAB1C4' })}<span>${t.n}</span><span class="visually-hidden">${esc(A.TYPES[t.k].label)}</span></button>`).join('')}</div>
        ${highlight ? `<p class="ins-text"><strong>${esc(highlight.title)}.</strong> ${esc(highlight.summary)}</p>` : '<p class="ins-text">No opportunities identified for this selection.</p>'}
        ${S.categories.size ? `<p class="ins-note">${S.includeComplementary ? 'Complementary service types are included: opportunities start from your selected services and can involve other service types.' : 'Only opportunities where every service is one of your selected service types.'}</p>` : ''}
        <button type="button" class="btn btn-mint" data-goto="collab">Explore collaboration${svg('arrowRight', { size: 18 })}</button>
      </article>
      <article class="ins-card ins-card--gaps">
        <div class="ins-head">${badge('gap', { size: 56, color: '#475D75' })}<h2>Recorded service gaps</h2></div>
        <p class="ins-purpose">Categories, places and times with no or limited recorded activity.</p>
        <p class="ins-figure"><strong>${gapFigure}</strong><span>${esc(gapLabel)}</span></p>
        <p class="ins-text">${esc(gapText)}</p>
        <p class="ins-note">Missing records do not prove that a service does not exist or that need is unmet.</p>
        <button type="button" class="btn" data-goto="coverage">Explore coverage${svg('arrowRight', { size: 18 })}</button>
      </article>`;
  }

  // Service types not recorded in suburbs where the selected organisation delivers.
  function agencyGaps() {
    if (!S.orgId) return [];
    const mine = ctx.councilSegs.filter((s) => s.a.organisationId === S.orgId);
    const myCats = new Set(mine.map((s) => s.a.category));
    const suburbs = [...new Set(mine.map((s) => s.a.suburb))].filter((s) => suburb() === 'all' || s === suburb());
    const check = (S.categories.size ? [...S.categories] : O.CATEGORY_IDS).filter((c) => !myCats.has(c));
    return suburbs.map((sub) => {
      const present = new Set(ctx.councilSegs.filter((s) => s.a.suburb === sub).map((s) => s.a.category));
      return { suburb: sub, missing: check.filter((c) => !present.has(c)) };
    }).sort((x, y) => y.missing.length - x.missing.length);
  }

  /* ---------- Overlaps detail ---------- */

  function renderRecurring() {
    const list = ctx.similar;
    const shown = local.recurringAll ? list : list.slice(0, 4);
    const seg = (pid) => ctx.councilSegs.filter((s) => (s.a.programId || s.a.activityId) === pid);
    el.recurring.innerHTML = `
      <p class="view-intro">Similar services (the same kind of service, with food relief and community meals treated as similar) run by <strong>different organisations</strong> at overlapping times in the <strong>same suburb</strong>, grouped across the period. Overlap is a scheduling pattern, not evidence of duplication.</p>
      ${list.length ? `<ol class="rec-list">${shown.map((e) => {
        const dates = [...e.dates.keys()].sort();
        const weekdays = O.WEEKDAYS.filter((d) => dates.some((x) => O.weekdayOf(x) === d));
        const rep = dates[0];
        const bars = e.progIds.map((pid) => seg(pid).find((s) => s.date === rep)).filter(Boolean)
          .map((s) => ({ name: (programById.get(s.a.programId) || {}).programName || s.a.activityName, org: s.a.organisationId, cat: s.a.category, start: s.start, end: s.end }));
        let cursor = bars.length ? Math.min(...bars.map((b) => b.start)) : 0;
        const hypo = bars.slice().sort((x, y) => x.start - y.start).map((b) => { const s = Math.max(cursor, b.start); const f = s + (b.end - b.start); cursor = f; return Object.assign({}, b, { start: s, end: f }); });
        return `<li class="rec-item">
          <div class="rec-head">
            <span class="rec-count"><strong>${e.dates.size}</strong><span>${e.dates.size === 1 ? 'date' : 'dates'}</span></span>
            <div><h3>${plural(e.orgCount, 'organisation')} · ${esc(A.groupLabel(e.group))} in ${esc(e.suburb)}</h3>
              <p>Overlapping ${esc(e.window)} · ${esc(weekdays.join(', '))} · first on ${esc(fmtDay(dates[0]))}</p></div>
          </div>
          <ul class="rec-progs">${e.progIds.map((pid) => { const s = seg(pid)[0]; return s ? `<li>${catBadge(s.a.category, 30)}<span><strong>${esc((programById.get(s.a.programId) || {}).programName || s.a.activityName)}</strong> · ${esc(orgName(s.a.organisationId))} ${modeTag(((programById.get(s.a.programId) || {}).deliveryMode) || 'fixed')}</span></li>` : ''; }).join('')}</ul>
          ${bars.length >= 2 ? G.scheduleHtml({ date: rep, bars, hypo }) : ''}
          <div class="rec-actions"><button type="button" class="btn-outline" data-sa-action="timeline" data-value="${rep}">${svg('schedule', { size: 18 })}Show ${esc(fmtDay(rep))} on the timeline</button></div>
        </li>`;
      }).join('')}</ol>
      ${list.length > 4 ? `<button type="button" class="link-btn" data-recurring-all>${local.recurringAll ? 'Show fewer' : `Show all ${list.length} overlap patterns`}</button>` : ''}`
      : `<p class="empty-note">${S.perspective === 'agency' ? 'No similar services overlap with this organisation\'s services in this period.' : 'No similar services are recorded at overlapping times in the same suburb for this selection.'}</p>`}
      ${S.perspective === 'council' && suburb() === 'all' && result.areaPeak ? `<div class="callout"><strong>Council-wide concurrency is different.</strong> Up to ${result.areaPeak.items.length} ${esc(catsText().toLowerCase())} sessions are scheduled at the same time somewhere in the council (${esc(fmtDay(result.areaPeak.date))}, ${esc(fmtRange(result.areaPeak.start, result.areaPeak.end))}), but these can be in different suburbs and do not share a location.</div>` : ''}`;
  }

  function when(iv) { return iv ? `${fmtDay(iv.date)}, ${fmtRange(iv.start, iv.end)}` : 'No activities scheduled'; }

  function renderSummary() {
    const r = result;
    const all = suburb() === 'all';
    const card = (value, label, sub) => `<div class="stat-card"><span class="stat-value">${value}</span><span class="stat-label">${label}</span>${sub ? `<span class="stat-sub">${sub}</span>` : ''}</div>`;
    const peak = (iv) => (iv ? iv.items.length : 0);
    const cards = [
      card(r.occurrences, 'Scheduled activity occurrences', r.unknown.length ? `${plural(r.unknown.length, 'other occurrence')} with unknown schedule` : 'Each dated session counted once'),
      card(r.programs, 'Distinct programs', 'A weekly program counts once, however often it runs or however many places it visits'),
      card(r.organisations, 'Participating organisations', 'Delivering activities in this area'),
      card(r.sites, 'Physical delivery locations', 'Fixed sites and mobile stops')
    ];
    if (all) {
      cards.push(card(peak(r.areaPeak), 'Council-wide peak', `Scheduled at the same time anywhere in the council (may be different suburbs). ${esc(when(r.areaPeak))}`));
      cards.push(card(peak(r.suburbPeak), 'Highest same-suburb peak', r.suburbPeak && r.suburbPeak.items.length ? `${esc(r.suburbPeak.suburb)} · ${esc(when(r.suburbPeak))}` : 'No activities scheduled'));
    } else {
      cards.push(card(peak(r.suburbPeak), `Peak in ${esc(suburb())}`, `Scheduled at the same time in this suburb. ${esc(when(r.suburbPeak))}`));
    }
    const none = r.occurrences === 0 && S.categories.size ? `<div class="sa-none-notice" role="status"><strong>No ${esc(catsText().toLowerCase())} sessions recorded for the selected period.</strong> This indicates an absence of recorded scheduled activity in the demonstration dataset. It does not establish that the service is unavailable or that community demand is unmet.</div>` : '';
    const vs = ['provider_confirmed', 'published', 'unverified'].map((id) => `${statusBadge(id)} ${new Set(r.segs.filter((s) => s.a.verificationStatus === id).map((s) => s.a.activityId)).size}`).join(' &nbsp; ');
    el.summary.innerHTML = `${none}<div class="stat-grid">${cards.join('')}</div>
      <p class="sa-note"><strong>Verification of these sessions (fictional):</strong> ${vs}</p>
      <p class="sa-note">An <strong>overlap period</strong> is a stretch of time when the same group of two or more activities is scheduled at the same time. Activities that finish exactly when another starts do not overlap.${r.cancelled.length ? ` ${plural(r.cancelled.length, 'cancelled occurrence')} excluded.` : ''}</p>`;
  }

  function overlapCard(iv, idx) {
    const id = `${iv.type}|${iv.date}|${iv.start}|${iv.suburb || 'council'}|${idx}`;
    const expanded = local.expanded === id;
    const orgs = new Set(iv.items.map((s) => s.a.organisationId));
    const cats = [...new Set(iv.items.map((s) => s.a.category))];
    const similar = new Set(cats.map(A.groupOf)).size === 1;
    const kindTag = similar ? '<span class="sa-kind sa-kind--similar">Similar services</span>' : '<span class="sa-kind sa-kind--mixed">Different (complementary) services</span>';
    const where = iv.type === 'suburb'
      ? `<span class="sa-ov-where">${esc(iv.suburb)}</span><span class="sa-ov-type sa-ov-type--suburb">Same suburb</span>`
      : `<span class="sa-ov-where">Council-wide · ${esc(iv.suburbs.join(', '))}</span><span class="sa-ov-type sa-ov-type--council">Different suburbs</span>`;
    const detail = !expanded ? '' : `
      <div class="sa-ov-detail">
        <p class="sa-ov-lead">${iv.type === 'suburb'
          ? '<strong>Potential coordination opportunity.</strong> These activities are scheduled at the same time in the same suburb.'
          : '<strong>Council-wide activity.</strong> These activities are scheduled at the same time but in <em>different suburbs</em>; they do not share a location.'}</p>
        <ul class="sa-ov-items">${iv.items.slice().sort((x, y) => x.start - y.start).map((s) => `
          <li><div class="sa-ov-item-head"><strong>${esc(s.a.activityName)}</strong> ${statusBadge(s.a.verificationStatus)}</div>
            <div>${esc(orgName(s.a.organisationId))} <span class="sample-tag">Fictional</span></div>
            <div class="sa-ov-item-meta">${catChip(s.a.category)} · ${esc(fmtRange(s.start, s.end))} · ${esc(s.a.suburb)}, ${esc(A.stopName(s.a))}</div></li>`).join('')}</ul>
        <div class="sa-ov-actions"><button type="button" class="btn-outline" data-sa-action="timeline" data-value="${iv.date}">Show ${esc(fmtDay(iv.date))} on the timeline</button></div>
      </div>`;
    return `<li class="sa-ov${expanded ? ' is-open' : ''}${iv.type === 'council' ? ' sa-ov--council' : ''}">
      <button type="button" class="sa-ov-summary" data-sa-action="expand" data-value="${esc(id)}" aria-expanded="${expanded}">
        <span class="sa-ov-count"><strong>${iv.items.length}</strong><span>at once</span></span>
        <span class="sa-ov-main">
          <span class="sa-ov-when"><strong>${esc(fmtDay(iv.date))}</strong> · ${esc(fmtRange(iv.start, iv.end))}</span>
          <span class="sa-ov-line">${where}</span>
          <span class="sa-ov-line">${cats.map(catChip).join(' ')} ${kindTag}</span>
          <span class="sa-ov-line sa-ov-orgs">${plural(orgs.size, 'organisation')} · ${iv.items.length} simultaneous activities</span>
        </span>
        <span class="sa-ov-caret" aria-hidden="true">${svg('chevronDown', { size: 18 })}</span>
      </button>${detail}</li>`;
  }

  function renderOverlaps() {
    const r = result;
    const all = suburb() === 'all';
    const mode = all ? local.overlapMode : 'suburb';
    const sameSuburb = r.sameSuburb.filter((iv) => involvesOrg(iv.items));
    const councilWide = r.councilWide.filter((iv) => involvesOrg(iv.items));
    const list = mode === 'suburb' ? sameSuburb : councilWide;
    const shown = local.showAll ? list : list.slice(0, LIST_LIMIT);
    el.overlaps.innerHTML = `
      ${all ? `<div class="seg seg--small sa-seg" role="group" aria-label="Type of overlap">
        <button type="button" data-sa-action="mode" data-value="suburb" aria-pressed="${mode === 'suburb'}">Same suburb (${sameSuburb.length})</button>
        <button type="button" data-sa-action="mode" data-value="council" aria-pressed="${mode === 'council'}">Council-wide, different suburbs (${councilWide.length})</button>
      </div>` : ''}
      <p class="sa-intro-text">${mode === 'suburb'
        ? 'Every period when two or more recorded activities are scheduled at the same time <strong>in the same suburb</strong>, ranked by the number at once.'
        : 'Every period when two or more activities are scheduled at the same time <strong>across different suburbs</strong> of the council. These do not share a location.'}</p>
      ${list.length ? `<ol class="sa-ov-list">${shown.map(overlapCard).join('')}</ol>` : '<p class="sa-empty">No overlapping scheduled activities recorded for this selection.</p>'}
      ${list.length > LIST_LIMIT ? `<button type="button" class="link-btn" data-sa-action="show-all">${local.showAll ? 'Show fewer' : `Show all ${list.length} overlap periods`}</button>` : ''}`;
  }

  function renderTimeline() {
    const daySegs = result.segs.filter((s) => s.date === local.day).sort((x, y) => (x.start - y.start) || x.a.suburb.localeCompare(y.a.suburb));
    const unknownToday = result.unknown.filter((u) => u.a.date === local.day);
    const all = suburb() === 'all';
    el.prevDay.disabled = local.day <= S.from;
    el.nextDay.disabled = local.day >= S.to;
    if (!daySegs.length) {
      el.timeline.innerHTML = `<p class="sa-timeline-day"><strong>${esc(fmtDayLong(local.day))}</strong> · ${esc(scopeName())}</p><p class="sa-empty">No activity currently recorded for this day and selection.</p>${unknownList(unknownToday)}`;
      return;
    }
    const axisStart = Math.min(GAP_WINDOW[0], Math.floor(Math.min(...daySegs.map((s) => s.start)) / 60) * 60);
    const axisEnd = Math.max(GAP_WINDOW[1], Math.ceil(Math.max(...daySegs.map((s) => s.end)) / 60) * 60);
    const span = axisEnd - axisStart;
    const pct = (m) => ((m - axisStart) / span) * 100;
    let ticks = '', grid = '';
    for (let m = axisStart; m <= axisEnd; m += 60) {
      const major = (m / 60) % 2 === 0;
      ticks += `<span class="sa-tick${major ? ' is-major' : ''}" style="left:${pct(m)}%">${major ? esc(fmtMin(m)) : ''}</span>`;
      grid += `<span class="sa-gridline" style="left:${pct(m)}%"></span>`;
    }
    const conc = A.sweep(daySegs).map((iv) => {
      const n = iv.items.length;
      return `<span class="sa-conc sa-conc--${Math.min(n, 5)}" style="left:${pct(iv.start)}%;width:${pct(iv.end) - pct(iv.start)}%" title="${n} scheduled ${fmtRange(iv.start, iv.end)}">${n >= 2 ? n : ''}</span>`;
    }).join('');
    const rows = daySegs.map((s) => {
      const c = category(s.a.category);
      const mine = orgId() && s.a.organisationId === orgId();
      return `<div class="sa-row${mine ? ' sa-row--mine' : ''}">
        <div class="sa-row-label"><strong>${esc(s.a.activityName)}</strong><span>${esc(orgName(s.a.organisationId))}${mine ? ' (selected organisation)' : ''}</span>
          <span class="sa-row-meta">${esc(fmtRange(s.start, s.end))} · ${esc(A.stopName(s.a))}, ${esc(s.a.suburb)} ${statusBadge(s.a.verificationStatus)}</span></div>
        <div class="sa-track">${grid}<span class="sa-bar sa-bar--${esc(s.a.verificationStatus)}" style="--bar:${c.color};left:${pct(s.start)}%;width:${Math.max(pct(s.end) - pct(s.start), 0.8)}%" title="${esc(s.a.activityName)}: ${esc(fmtRange(s.start, s.end))}"></span></div>
      </div>`;
    }).join('');
    el.timeline.innerHTML = `
      <p class="sa-timeline-day"><strong>${esc(fmtDayLong(local.day))}</strong> · ${esc(scopeName())} · ${esc(catsText())} · ${plural(daySegs.length, 'scheduled occurrence')}</p>
      <div class="sa-tl" role="img" aria-label="Timeline of ${daySegs.length} scheduled activities on ${esc(fmtDayLong(local.day))}">
        <div class="sa-row sa-row--axis"><div class="sa-row-label"></div><div class="sa-axis">${ticks}</div></div>
        <div class="sa-row sa-row--conc"><div class="sa-row-label"><strong>Scheduled at once</strong><span>${all ? 'Council-wide (any suburb)' : 'In this suburb'}</span></div><div class="sa-track">${grid}${conc}</div></div>
        ${rows}
      </div>
      <p class="sa-note">Bars use the service colour. Solid bar = provider confirmed, pale bar = published only, dashed outline = unverified (all fictional).${all ? ' The "Scheduled at once" row counts activities anywhere in the council, which may be in different suburbs.' : ''}</p>
      ${unknownList(unknownToday)}`;
  }

  function unknownList(list) {
    if (!list.length) return '';
    return `<div class="sa-unknown"><strong>Schedule unknown:</strong><ul>${list.map((u) => `<li>${esc(u.a.activityName || u.a.activityId)} (${esc(orgName(u.a.organisationId))}): ${esc(u.reason)}</li>`).join('')}</ul></div>`;
  }

  /* ---------- Collaboration detail ---------- */

  function oppCard(o) {
    const open = local.openOpp === o.id;
    const graphic = G.forOpp(o);
    const statusIcon = o.status === 'existing' ? svg('check', { size: 14, stroke: 3.2 }) : o.status === 'investigate' ? svg('search', { size: 14, stroke: 3 }) : svg('handshake', { size: 14, stroke: 2.6 });
    const contacts = [...new Set(o.parties.map((p) => p.org))].map((id) => orgById.get(id)).filter(Boolean);
    return `<li class="opp opp--${o.status}${open ? ' is-open' : ''}${o.graphic && o.graphic.kind === 'schedule' ? ' opp--wide' : ''}">
      <div class="opp-top">${badge(o.typeInfo.icon, { size: 36 })}<span class="opp-type">${o.typeInfo.n}. ${esc(o.typeInfo.label)}</span>
        <span class="opp-status opp-status--${o.status}">${statusIcon}${esc(o.statusInfo.label)}</span></div>
      ${graphic ? `<div class="opp-graphic">${graphic}</div>` : ''}
      <h3 class="opp-title">${esc(o.title)}</h3>
      <p class="opp-summary">${esc(o.summary)}</p>
      <ul class="opp-meta">
        <li>${svg('pin', { size: 18 })}<span>${esc(o.location)}</span></li>
        <li>${svg('clock', { size: 18 })}<span class="clamp">${esc(o.window)}</span></li>
        <li>${svg('heartHands', { size: 18 })}<span><strong>Potential benefit:</strong> ${esc(o.benefit)}</span></li>
      </ul>
      <div class="opp-orgs">${o.parties.slice(0, 5).map((p) => `<span class="opp-org">${svg(p.mode === 'mobile' ? 'van' : 'fixedSite', { size: 15 })}${esc(orgName(p.org))}</span>`).join('')}${o.parties.length > 5 ? `<span class="opp-org">+${o.parties.length - 5} more</span>` : ''}</div>
      <button type="button" class="btn-outline opp-toggle" data-opp="${esc(o.id)}" aria-expanded="${open}">${open ? 'Hide details' : 'View details'}${svg('chevronDown', { size: 18 })}</button>
      ${open ? `<div class="opp-details">
        <p class="opp-status-help"><strong>${esc(o.statusInfo.label)}:</strong> ${esc(o.statusInfo.help)}</p>
        <dl class="facts">${o.facts.filter((f) => f[1]).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        <h4>Why this was identified</h4><p>${esc(o.why)}</p>
        <h4>Organisations involved</h4>
        <ul class="opp-parties">${o.parties.map((p) => `<li><strong>${esc(orgName(p.org))}</strong> ${modeTag(p.mode)}<span class="hint-inline"> · ${esc(p.role)}</span>
          <ul>${p.programs.map((pr) => `<li>${catChip(pr.cat)} ${esc(pr.name)}: ${esc(pr.pattern)}</li>`).join('')}</ul></li>`).join('')}</ul>
        <h4>Matters to discuss</h4><ul class="opp-consider">${o.considerations.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
        <h4>Suggested next action</h4><p>${esc(o.nextAction)}</p>
        ${o.caution ? `<p class="callout callout--warn">${esc(o.caution)}</p>` : ''}
        ${o.type === 'geo' ? `<div class="opp-map" data-geo="${esc(o.id)}" role="region" aria-label="Map of mobile stops and suburbs with no recorded service"></div>` : ''}
        <h4>Fictional contact details</h4>
        <ul class="opp-contacts">${contacts.map((c) => `<li><strong>${esc(c.organisationName)}</strong><span>${esc(c.phone)} · ${esc(c.email)}</span></li>`).join('')}</ul>
        <p class="hint">A potential opportunity is not a recommendation or a confirmed arrangement. Contact details are fictional.</p>
      </div>` : ''}
    </li>`;
  }

  let geoMaps = [];
  function renderCollab() {
    const opps = ctx.opps;
    const filtered = local.collabType === 'all' ? opps : opps.filter((o) => o.type === local.collabType);
    const shown = filtered.slice(0, local.collabLimit);
    const counts = { existing: 0, potential: 0, investigate: 0 };
    filtered.forEach((o) => { counts[o.status] += 1; });
    const typeBtn = (k) => {
      const n = k === 'all' ? opps.length : opps.filter((o) => o.type === k).length;
      const t = A.TYPES[k];
      return `<button type="button" class="type-chip" data-ctype="${k}" aria-pressed="${local.collabType === k}" ${n || k === 'all' ? '' : 'disabled'}>
        ${k === 'all' ? badge('handshake', { size: 28, color: O.BRAND.mintDark }) : badge(t.icon, { size: 28, color: n ? O.BRAND.navy : '#AAB1C4' })}
        <span>${k === 'all' ? 'All types' : `${t.n}. ${esc(t.short)}`}</span><strong>${n}</strong></button>`;
    };
    geoMaps.forEach((m) => m.remove());
    geoMaps = [];
    el.collab.innerHTML = `
      <p class="view-intro">${S.perspective === 'agency' ? `Opportunities involving <strong>${esc(orgName(S.orgId))}</strong>.` : `Opportunities across <strong>${esc(scopeName())}</strong>.`}
        These are questions agencies may wish to explore together, <strong>not recommendations</strong>.
        ${S.categories.size ? (S.includeComplementary ? ' Complementary service types are included, starting from your selected services.' : ' Only opportunities where every service is one of your selected types are shown.') : ''}</p>
      <div class="type-chips" role="group" aria-label="Filter by opportunity type">${typeBtn('all')}${Object.keys(A.TYPES).map(typeBtn).join('')}</div>
      <div class="status-legend">
        <span class="opp-status opp-status--existing">${svg('check', { size: 14, stroke: 3.2 })}Existing complementary delivery · ${counts.existing}</span>
        <span class="opp-status opp-status--potential">${svg('handshake', { size: 14, stroke: 2.6 })}Potential collaboration · ${counts.potential}</span>
        <span class="opp-status opp-status--investigate">${svg('search', { size: 14, stroke: 3 })}Requires further investigation · ${counts.investigate}</span>
      </div>
      ${filtered.length ? `<ol class="opp-list">${shown.map(oppCard).join('')}</ol>` : '<p class="empty-note">No opportunities of this type for the current selection. Try another council, a wider period or more service types.</p>'}
      ${filtered.length > 8 ? `<div class="list-more"><span>Showing ${shown.length} of ${filtered.length}</span><button type="button" class="btn-outline" data-collab-more>${local.collabLimit === Infinity ? 'Show fewer' : `Show all ${filtered.length}`}</button></div>` : ''}
      <details class="adv"><summary>${svg('info', { size: 18 })}How opportunities are identified</summary><div class="adv-body">${rulesHtml()}</div></details>`;
    el.collab.querySelectorAll('[data-geo]').forEach((node) => {
      const o = opps.find((x) => x.id === node.dataset.geo);
      if (o && window.L) geoMaps.push(drawGeoMap(node, o));
    });
  }

  function suburbCentroid(sub) {
    const pts = activities.filter((a) => a.suburb === sub);
    if (!pts.length) return null;
    return [pts.reduce((t, a) => t + a.location.latitude, 0) / pts.length, pts.reduce((t, a) => t + a.location.longitude, 0) / pts.length];
  }
  function drawGeoMap(node, o) {
    const m = L.map(node, { scrollWheelZoom: false, zoomSnap: 0.5 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(m);
    const pts = [];
    o.graphic.stops.forEach((s) => {
      const c = category(s.cat);
      L.marker([s.loc.latitude, s.loc.longitude], { icon: L.divIcon({ className: 'mk-wrap', html: `<span class="mk mk--mobile" style="--c:${c.color}">${svg(c.icon, { size: 18, stroke: 2.6 })}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] }) })
        .bindTooltip(`${esc(s.name)}, ${esc(s.suburb)}<br>${esc(orgName(s.org))}`).addTo(m);
      pts.push([s.loc.latitude, s.loc.longitude]);
    });
    o.lowSuburbs.forEach((sub) => {
      const c = suburbCentroid(sub);
      if (!c) return;
      L.circleMarker(c, { radius: 16, color: '#475D75', weight: 2, dashArray: '5 4', fillColor: '#fff', fillOpacity: 0.7 })
        .bindTooltip(`${esc(sub)}: no recorded ${esc(A.groupLabel(o.graphic.group).toLowerCase())} in this period (approximate suburb point)`).addTo(m);
      pts.push(c);
    });
    if (pts.length) m.fitBounds(pts, { padding: [30, 30], maxZoom: 14 });
    return m;
  }

  function rulesHtml() {
    return `<ul class="rules">
      <li><strong>Data used:</strong> dated, scheduled sessions inside the selected period and council. Cancelled sessions are excluded; sessions with unknown schedules are never treated as absent.</li>
      <li><strong>Times</strong> overlap only if they intersect for a positive duration. A session ending when another starts does not overlap.</li>
      <li><strong>Similar services:</strong> the same category; food relief and community meals count as similar. Any other pair of categories is complementary.</li>
      <li><strong>Distances</strong> are straight lines between fictional map points. "Nearby" means within ${A.NEAR_M} m; referral pathways use ${(A.REFERRAL_M / 1000).toFixed(1)} km. Both are illustrative demonstration assumptions. Council membership alone is never treated as proximity.</li>
      <li><strong>1. Host a mobile service:</strong> a mobile service stops within ${A.NEAR_M} m of a community site run by another organisation that does not record that service. If the mobile service is already recorded at the site at overlapping times, it is existing complementary delivery.</li>
      <li><strong>2. Mobile services together:</strong> mobile providers of complementary services stop at the same recorded stop, or within ${A.NEAR_M} m. Existing if they are recorded at the same stop at overlapping times. One suggestion per area (stops within 1 km are grouped).</li>
      <li><strong>3. Multi-agency hub:</strong> three or more organisations offering three or more kinds of service deliver at or within ${A.NEAR_M} m of one location. Community sites are considered first; one suggestion per 1 km area.</li>
      <li><strong>4. Coordinate hours:</strong> similar services by different organisations overlap in the same suburb on two or more dates.</li>
      <li><strong>5. Coordinate coverage:</strong> two or more mobile providers of similar services stop in the same suburb, while other suburbs of the council record none of that service.</li>
      <li><strong>6. Visiting provider:</strong> a fixed provider of a support service (housing, legal, health, mental health, social support or English classes) lists the host site's suburb in its service area, and the host site does not record that service. Outreach capability is not recorded, so these always require investigation.</li>
      <li><strong>7. Referral pathways:</strong> an organisation delivering basic support (food, meals, showers, laundry or clothing) has at least two different support services operating within ${(A.REFERRAL_M / 1000).toFixed(1)} km in the period. No referral relationship is implied.</li>
      <li>No numerical scores are used. Each combination of organisations, programs and sites appears once, and weekly sessions are grouped into one opportunity.</li>
    </ul>`;
  }

  /* ---------- Coverage detail ---------- */

  function renderCoverage() {
    const { gaps, subGaps, opps } = ctx;
    const agency = S.perspective === 'agency';
    const otherName = (COUNCILS[Object.keys(COUNCILS).find((c) => c !== council())] || {}).name;
    const gapCards = gaps.map((g) => {
      const label = category(g.category).label.toLowerCase();
      return `<li class="gap-card">
        <div class="gap-head">${catBadge(g.category, 48)}<div><h3>No ${esc(label)} sessions recorded</h3><p>${esc(COUNCILS[council()].name)} · ${esc(fmtDay(S.from))} – ${esc(fmtDay(S.to))}</p></div></div>
        <dl class="facts">
          <dt>Elsewhere</dt><dd>${g.elsewhere.length ? `${plural(g.elsewhere.length, 'session')} in ${esc(otherName)}: ${esc([...new Set(g.elsewhere.map((s) => s.a.suburb))].join(', '))}, e.g. ${esc(fmtDay(g.elsewhere[0].date))} ${esc(fmtRange(g.elsewhere[0].start, g.elsewhere[0].end))}` : 'No sessions recorded in either council'}</dd>
          <dt>Providers</dt><dd>${g.providers.length ? esc(g.providers.map((p) => p.organisationName).join('; ')) : 'None recorded'}</dd>
          ${g.servesHere.length ? `<dt>Service area</dt><dd>${esc(g.servesHere.map((p) => p.organisationName).join(', '))} list${g.servesHere.length === 1 ? 's' : ''} suburbs in this council in their service area.</dd>` : ''}
          <dt>Community sites</dt><dd>${g.hubs.length ? esc(g.hubs.map((s) => `${s.siteName}, ${s.suburb}`).join('; ')) : 'None recorded'}</dd>
        </dl>
        <p class="callout callout--warn">This indicates an absence of recorded scheduled activity in the demonstration dataset. It does not establish that ${esc(label)} is unavailable or that community demand is unmet.${g.unknown ? ` ${plural(g.unknown, 'session')} with unknown schedule information.` : ''}</p>
        ${opps.some((o) => o.type === 'visiting' && o.categories[0] === g.category) ? `<button type="button" class="btn-outline" data-goto="collab" data-ctype="visiting">${svg('agency', { size: 18 })}See possible visiting providers</button>` : ''}
      </li>`;
    }).join('');

    const empty = subGaps.filter((x) => x.occurrences === 0);
    const missingRows = subGaps.filter((x) => x.missing.length);
    const around = agency ? agencyGaps() : [];
    const geoOpp = opps.find((o) => o.type === 'geo');

    el.coverage.innerHTML = `
      <p class="view-intro">Where the records show <strong>no or limited scheduled activity</strong> for ${esc(catsText().toLowerCase())}. Missing records are not proof that a service does not exist.</p>
      ${agency ? `<h3 class="sub-h">Around ${esc(orgName(S.orgId))}'s delivery locations</h3>
        ${around.length ? `<ul class="around-list">${around.map((x) => `<li><strong>${esc(x.suburb)}</strong>${x.missing.length ? `<span>Not recorded in this period:</span><span class="chip-wrap">${x.missing.map(catChip).join(' ')}</span>` : '<span>Every service type checked has recorded sessions.</span>'}</li>`).join('')}</ul>` : '<p class="empty-note">This organisation has no recorded sessions in this council and period.</p>'}
        <h3 class="sub-h">Council-wide context <span class="hint-inline">(not specific to this organisation)</span></h3>` : ''}
      ${gaps.length ? `<ul class="gap-list">${gapCards}</ul>` : `<p class="empty-note">Every ${S.categories.size ? 'selected ' : ''}service type has at least one recorded session in ${esc(COUNCILS[council()].name)} for this period${S.categories.size ? '' : ' (types recorded in neither council are not listed)'}.</p>`}
      <h3 class="sub-h">Suburbs</h3>
      ${empty.length ? `<p>No recorded ${esc(catsText().toLowerCase())} sessions in: <strong>${esc(empty.map((x) => x.suburb).join(', '))}</strong>.</p>` : `<p>Every suburb in scope has at least one recorded ${esc(catsText().toLowerCase())} session.</p>`}
      ${missingRows.length && S.categories.size <= 6 ? `<div class="table-scroll"><table class="simple-table"><thead><tr><th scope="col">Suburb</th><th scope="col">Sessions</th><th scope="col">Selected service types not recorded</th></tr></thead>
        <tbody>${subGaps.map((x) => `<tr><td>${esc(x.suburb)}</td><td>${x.occurrences}</td><td>${x.missing.length ? x.missing.map(catChip).join(' ') : '—'}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${geoOpp ? `<div class="callout"><strong>Geographic coordination:</strong> ${esc(geoOpp.summary)} <button type="button" class="link-btn" data-goto="collab" data-ctype="geo">See the opportunity</button></div>` : ''}`;
  }

  /* ---------- Concentration map ---------- */

  let saMap = null;
  let saLayer = null;
  function ensureMap() {
    if (saMap || !window.L) return;
    saMap = L.map(el.map, { scrollWheelZoom: false, zoomSnap: 0.5 }).setView(COUNCILS[council()].center, 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(saMap);
    saMap.on('click focus', () => saMap.scrollWheelZoom.enable());
    el.map.addEventListener('mouseleave', () => saMap.scrollWheelZoom.disable());
    saLayer = L.layerGroup().addTo(saMap);
    saMap.on('popupopen', (e) => {
      e.popup.getElement().querySelectorAll('[data-sa-popup-suburb]').forEach((b) => b.addEventListener('click', () => { saMap.closePopup(); O.set({ suburb: b.dataset.saPopupSuburb }, 'insights'); }));
    });
  }
  function hourOptions(selected, from, to) {
    let html = '';
    for (let m = from; m <= to; m += 60) html += `<option value="${m}"${m === selected ? ' selected' : ''}>${fmtMin(m)}</option>`;
    return html;
  }
  function renderMap() {
    const all = suburb() === 'all';
    const scope = local.mapScope;
    el.mapControls.innerHTML = `
      <div class="seg seg--small sa-seg" role="group" aria-label="Period shown on the map">
        <button type="button" data-sa-action="map-scope" data-value="range" aria-pressed="${scope === 'range'}">Whole period</button>
        <button type="button" data-sa-action="map-scope" data-value="day" aria-pressed="${scope === 'day'}">${esc(fmtDay(local.day))}</button>
        <button type="button" data-sa-action="map-scope" data-value="window" aria-pressed="${scope === 'window'}">${esc(fmtDay(local.day))}, time window</button>
      </div>
      ${scope === 'window' ? `<div class="sa-window"><label for="sa-win-start">From</label><select id="sa-win-start">${hourOptions(local.winStart, 0, 1380)}</select>
        <label for="sa-win-end">to</label><select id="sa-win-end">${hourOptions(local.winEnd, 60, 1440)}</select></div>` : ''}`;
    const groupKey = all ? (a) => a.suburb : (a) => `${a.location.latitude.toFixed(4)},${a.location.longitude.toFixed(4)}`;
    const groups = A.concentration(result.segs, scope, local.day, local.winStart, local.winEnd, groupKey);
    const total = groups.reduce((t, g) => t + g.count, 0);
    const period = scope === 'range'
      ? `accumulated across ${fmtDay(S.from)} – ${fmtDay(S.to)}. Activities on different days are counted together but were not operating at the same time`
      : scope === 'day' ? `scheduled at any time on ${fmtDayLong(local.day)}. They are not necessarily operating at the same time`
        : `scheduled to operate at some point between ${fmtMin(local.winStart)} and ${fmtMin(local.winEnd)} on ${fmtDayLong(local.day)}`;
    el.mapNote.innerHTML = `Each circle shows the number of scheduled activity occurrences ${all ? 'in a suburb' : 'at a location'} (${plural(total, 'occurrence')} in total), ${esc(period)}. Select a circle to see the activities.`;
    if (!window.L) { el.map.innerHTML = '<div class="map-fallback"><div><strong>The map could not load.</strong><br>It needs an internet connection.</div></div>'; return; }
    if (!saMap || el.page.hidden || !$('adv-map').open) return;
    saLayer.clearLayers();
    const max = Math.max(1, ...groups.map((g) => g.count));
    groups.forEach((g) => {
      const radius = 10 + 22 * Math.sqrt(g.count / max);
      const title = all ? g.key : A.stopName(g.items[0].a);
      const listHtml = g.items.slice(0, 10).map((s) => `<li><strong>${esc(fmtDay(s.date))}, ${esc(fmtRange(s.start, s.end))}</strong><br>${esc(s.a.activityName)} · ${esc(orgName(s.a.organisationId))}<br>${statusBadge(s.a.verificationStatus)}</li>`).join('');
      const popup = `<div class="sa-popup"><strong>${esc(title)}</strong><p>${plural(g.count, 'scheduled occurrence')}${all ? '' : ` · ${esc(g.items[0].a.suburb)}`}</p><ul>${listHtml}</ul>${g.items.length > 10 ? `<p>…and ${g.items.length - 10} more</p>` : ''}
        ${all ? `<button type="button" class="btn-outline" data-sa-popup-suburb="${esc(g.key)}">View ${esc(g.key)}</button>` : ''}</div>`;
      L.circleMarker([g.lat, g.lng], { radius, color: O.BRAND.navy, weight: 2, fillColor: O.BRAND.navy, fillOpacity: 0.25 }).bindPopup(popup, { maxWidth: 280 }).bindTooltip(`${title}: ${plural(g.count, 'occurrence')}`).addTo(saLayer);
      L.marker([g.lat, g.lng], { icon: L.divIcon({ className: 'sa-count-icon', html: `<span>${g.count}</span>`, iconSize: [30, 20], iconAnchor: [15, 10] }), interactive: false, keyboard: false }).addTo(saLayer);
    });
    if (groups.length) saMap.fitBounds(L.latLngBounds(groups.map((g) => [g.lat, g.lng])), { padding: [40, 40], maxZoom: all ? 13 : 16 });
    else saMap.setView(COUNCILS[council()].center, 12);
  }

  /* ---------- Daily gaps 8am – 8pm ---------- */

  function renderGaps() {
    const [ws, we] = GAP_WINDOW;
    const pct = (m) => ((m - ws) / (we - ws)) * 100;
    const byDate = A.groupBy(result.segs, (s) => s.date);
    const unknownByDate = A.groupBy(result.unknown.filter((u) => A.validDate(u.a.date)), (u) => u.a.date);
    const undated = result.unknown.filter((u) => !A.validDate(u.a.date));
    let daysWithGap = 0, daysEmpty = 0, daysIncomplete = 0;
    const rows = daysInRange().map((d) => {
      const { covered, gaps } = A.gapsForDay(byDate.get(d) || [], ws, we);
      const incomplete = (unknownByDate.get(d) || []).length > 0;
      if (incomplete) daysIncomplete++;
      if (gaps.length) daysWithGap++;
      if (!covered.length) daysEmpty++;
      const bars = covered.map(([s, e]) => `<span class="sa-gap-cov" style="left:${pct(s)}%;width:${pct(e) - pct(s)}%"></span>`).join('')
        + gaps.map(([s, e]) => `<span class="sa-gap-${incomplete ? 'unknown' : 'none'}" style="left:${pct(s)}%;width:${pct(e) - pct(s)}%"></span>`).join('');
      let t;
      if (!gaps.length) t = 'Activity recorded throughout 8am – 8pm';
      else if (!covered.length) t = incomplete ? 'Schedule information incomplete for this day' : 'No scheduled activity recorded, 8am – 8pm';
      else t = `${incomplete ? 'Unknown (incomplete schedule)' : 'No scheduled activity recorded'}: ${gaps.map(([s, e]) => fmtRange(s, e)).join(', ')}`;
      return `<li class="sa-gap-row"><button type="button" class="sa-gap-date link-btn" data-sa-action="timeline" data-value="${d}">${esc(fmtDay(d))}</button><span class="sa-gap-strip" aria-hidden="true">${bars}</span><span class="sa-gap-text">${esc(t)}</span></li>`;
    }).join('');
    el.gaps.innerHTML = `
      <p class="sa-intro-text">Periods in the daily window of <strong>8am to 8pm</strong> with no scheduled activity recorded for ${esc(scopeName())} (${esc(catsText().toLowerCase())}).</p>
      <p class="sa-gap-summary">${plural(daysWithGap, 'day')} with at least one period of no recorded activity · ${plural(daysEmpty, 'day')} with no recorded activity at all${daysIncomplete ? ` · ${plural(daysIncomplete, 'day')} with incomplete schedule information` : ''}</p>
      <div class="sa-gap-legend"><span><i class="sa-gap-cov"></i> Activity recorded</span><span><i class="sa-gap-none"></i> No scheduled activity recorded</span><span><i class="sa-gap-unknown"></i> Unknown or incomplete schedule</span></div>
      <ol class="sa-gap-list">${rows}</ol>
      ${undated.length ? `<p class="sa-note">${plural(undated.length, 'activity', 'activities')} could not be placed on a date because the schedule information is missing or invalid.</p>` : ''}
      <p class="sa-note"><strong>Interpret with care.</strong> A period without records does not prove that no service operates, or that there is unmet community need.</p>`;
  }

  /* ---------- Delivered here and service areas ---------- */

  function renderCatchment() {
    const r = result;
    const all = suburb() === 'all';
    const delivering = new Set(r.segs.map((s) => s.a.organisationId));
    const areaMatches = (o) => (o.areasServed || []).some((s) => (all ? SUBURB_COUNCIL[s] && SUBURB_COUNCIL[s].council === council() : s === suburb()));
    const offers = (o) => !S.categories.size || activities.some((a) => a.organisationId === o.organisationId && S.categories.has(a.category));
    const listedNotDelivering = organisations.filter((o) => areaMatches(o) && offers(o) && !delivering.has(o.organisationId));
    const otherCouncils = (o) => [...new Set((o.areasServed || []).map((s) => SUBURB_COUNCIL[s] && SUBURB_COUNCIL[s].council).filter((c) => c && c !== council()))].map((c) => COUNCILS[c].name);
    const deliveringList = [...delivering].map((id) => orgById.get(id)).filter(Boolean).sort((x, y) => x.organisationName.localeCompare(y.organisationName)).map((o) => {
      const n = new Set(r.segs.filter((s) => s.a.organisationId === o.organisationId).map((s) => s.a.activityId)).size;
      const others = otherCouncils(o);
      return `<li><strong>${esc(o.organisationName)}</strong> <span class="sample-tag">Fictional</span><br><span class="sa-row-meta">${plural(n, 'occurrence')} delivered here${others.length ? ` · service area also includes ${esc(others.join(', '))}` : ''}</span></li>`;
    }).join('');
    el.catchment.innerHTML = `
      <h3 class="sub-h">Activities physically delivered in ${esc(scopeName())}</h3>
      <p>${plural(r.occurrences, 'scheduled occurrence')} by ${plural(r.organisations, 'organisation')}, based on where each activity takes place.</p>
      ${deliveringList ? `<ul class="sa-org-list">${deliveringList}</ul>` : '<p class="sa-empty">No activity currently recorded.</p>'}
      <h3 class="sub-h">Service area includes ${esc(all ? COUNCILS[council()].name : suburb())}, but no activity delivered here in this period</h3>
      ${listedNotDelivering.length ? `<ul class="sa-org-list">${listedNotDelivering.map((o) => `<li><strong>${esc(o.organisationName)}</strong> <span class="sample-tag">Fictional</span></li>`).join('')}</ul>` : '<p class="sa-empty">None recorded for this selection.</p>'}
      <p class="sa-note">OnNow records <strong>where activities are delivered</strong>. Residents may also use services in neighbouring areas, and an organisation's service area can extend beyond where it delivers. Delivery location does not show which council or agency funds a service.</p>`;
  }

  function renderMethod() {
    el.method.innerHTML = `
      <ul class="rules">
        <li><strong>Scheduled occurrence:</strong> one dated session. <strong>Program:</strong> one service run by one organisation, counted once however often it runs or however many places it visits. <strong>Delivery location:</strong> a fixed site or mobile stop.</li>
        <li><strong>Reporting period:</strong> ${esc(fmtDayLong(S.from))} to ${esc(fmtDayLong(S.to))}. <strong>Service types:</strong> ${esc(catsText())} (no selection means all).</li>
        <li><strong>Same-suburb overlap</strong> means activities share a suburb and time. <strong>Council-wide concurrency</strong> counts activities at the same time anywhere in the council, which may be in different suburbs.</li>
        <li><strong>Verification:</strong> provider confirmed, published only or unverified. Every status in this demonstration is fictional and is not a real confirmation.</li>
        <li><strong>Council assignment:</strong> from an explicit suburb list; split suburbs use the council recorded on each activity. Councils are never guessed from distance.</li>
        <li><strong>Limitations:</strong> schedules alone do not show service use, demand, capacity, eligibility or funding efficiency. Missing records do not prove a service does not exist.</li>
      </ul>${rulesHtml()}`;
  }

  function render() {
    if (S.perspective === 'agency') ensureOrg();
    compute();
    syncControls();
    renderScope();
    renderAgency();
    renderCards();
    renderRecurring();
    renderSummary();
    renderOverlaps();
    renderTimeline();
    renderCollab();
    renderCoverage();
    renderGaps();
    renderCatchment();
    renderMethod();
    if ($('adv-map').open) { ensureMap(); renderMap(); }
    dirty = false;
  }

  O.on((patch) => {
    const keys = ['council', 'suburb', 'categories', 'period', 'from', 'to', 'includeComplementary', 'perspective', 'orgId'];
    if (!keys.some((k) => k in patch)) return;
    local.openOpp = null; local.expanded = null; local.collabLimit = 8;
    if (S.page === 'insights') render(); else dirty = true;
  });

  O.registerPage('insights', {
    show(opts) {
      if (opts.view) local.view = opts.view;
      if (dirty || !result) render();
      setView(local.view, opts.ctype);
      if (saMap) saMap.invalidateSize();
    }
  });

  buildControls();
  wireControls();
})();
