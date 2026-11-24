/*
 * OnNow — minimal Word (.docx) writer
 * -----------------------------------
 * Builds a genuine Office Open XML word-processing document in the browser:
 * real Word paragraphs, heading styles, bulleted lists, tables, page numbers,
 * a header and footer, and embedded PNG images (the OnNow logo and icons).
 * The parts are packaged into a standard ZIP file (stored, uncompressed).
 * No external library, server or account is used.
 *
 * window.OnNowDocx.build({ title, blocks, images, footerText }) → Promise<Blob>
 *   images: { key: Uint8Array (PNG bytes) }
 *   blocks: see renderBlock() below.
 */
(() => {
  'use strict';

  const NAVY = '28348E', MINT_DARK = '23806A', MINT = '52C0A5', INK = '1B2140', MUTED = '5D6680', LINE = 'D8DCEB';
  const PAGE_W = 11906, PAGE_H = 16838, MARGIN = 1134;           // A4, 2 cm margins (twips)
  const TEXT_W = PAGE_W - 2 * MARGIN;                            // usable width in twips
  const EMU_PER_PX = 9525;

  /* ---------------- ZIP (stored) ---------------- */

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(files) {
    const enc = new TextEncoder();
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const chunks = [];
    const central = [];
    let offset = 0;
    files.forEach((f) => {
      const name = enc.encode(f.name);
      const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    });
    const cdSize = central.reduce((t, c) => t + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  /* ---------------- XML helpers ---------------- */

  const X = (s) => String(s == null ? '' : s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function pngSize(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  }

  function run(r) {
    if (typeof r === 'string') r = { text: r };
    const p = [];
    if (r.b) p.push('<w:b/>');
    if (r.i) p.push('<w:i/>');
    if (r.color) p.push(`<w:color w:val="${r.color}"/>`);
    if (r.size) p.push(`<w:sz w:val="${r.size}"/><w:szCs w:val="${r.size}"/>`);
    const parts = String(r.text == null ? '' : r.text).split('\n');
    return parts.map((t, i) => `<w:r>${p.length ? `<w:rPr>${p.join('')}</w:rPr>` : ''}${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${X(t)}</w:t></w:r>`).join('');
  }
  const runs = (content) => (Array.isArray(content) ? content.map(run).join('') : run(content));

  function para(content, o) {
    const opt = o || {};
    const pPr = [];
    if (opt.style) pPr.push(`<w:pStyle w:val="${opt.style}"/>`);
    if (opt.keepNext) pPr.push('<w:keepNext/>');
    if (opt.numId) pPr.push(`<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${opt.numId}"/></w:numPr>`);
    if (opt.spacing) pPr.push(`<w:spacing w:before="${opt.spacing[0]}" w:after="${opt.spacing[1]}"/>`);
    if (opt.align) pPr.push(`<w:jc w:val="${opt.align}"/>`);
    return `<w:p>${pPr.length ? `<w:pPr>${pPr.join('')}</w:pPr>` : ''}${opt.raw || ''}${content == null ? '' : runs(content)}</w:p>`;
  }

  /* ---------------- Document builder ---------------- */

  function build(doc) {
    const images = doc.images || {};
    const rels = [];          // document relationships
    const media = [];         // { name, data }
    const imageRel = new Map();
    let docPrId = 1;

    function relForImage(key) {
      if (imageRel.has(key)) return imageRel.get(key);
      const data = images[key];
      if (!data) return null;
      const name = `img_${media.length + 1}.png`;
      media.push({ name, data });
      const id = `rIdImg${media.length}`;
      rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/>`);
      imageRel.set(key, id);
      return id;
    }
    function drawing(key, widthPx, heightPx, alt, relId) {
      const id = relId || relForImage(key);
      if (!id) return '';
      const data = images[key];
      let w = widthPx, h = heightPx;
      if (data && (!w || !h)) {
        const s = pngSize(data);
        if (w && !h) h = Math.round((s.h / s.w) * w);
        else if (h && !w) w = Math.round((s.w / s.h) * h);
        else { w = s.w; h = s.h; }
      }
      const cx = Math.round(w * EMU_PER_PX), cy = Math.round(h * EMU_PER_PX);
      const n = docPrId++;
      return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Picture ${n}" descr="${X(alt || '')}"/>`
        + '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>'
        + '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        + `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="Picture ${n}" descr="${X(alt || '')}"/><pic:cNvPicPr/></pic:nvPicPr>`
        + `<pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
        + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>`
        + '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
    }

    function cellXml(cell, width, o) {
      const opt = o || {};
      const c = (cell && typeof cell === 'object' && !Array.isArray(cell)) ? cell : { text: cell == null ? '' : cell };
      const shade = opt.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${opt.fill}"/>` : '';
      const lines = String(c.text == null ? '' : c.text).split('\n');
      const icon = c.icon ? drawing(c.icon, 18, 18, c.iconAlt || '') + run({ text: ' ' }) : '';
      const paras = lines.map((l, i) => para(null, {
        style: 'TableText',
        raw: (i === 0 ? icon : '') + run({ text: l, b: opt.bold || c.b, color: opt.color })
      })).join('');
      return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shade}</w:tcPr>${paras}</w:tc>`;
    }

    function table(head, rows, widths, o) {
      const opt = o || {};
      const n = (head || rows[0] || []).length;
      const pct = widths || Array(n).fill(1 / n);
      const total = pct.reduce((t, v) => t + v, 0);
      const w = pct.map((v) => Math.floor((v / total) * TEXT_W));
      const grid = w.map((x) => `<w:gridCol w:w="${x}"/>`).join('');
      const border = (k) => `<w:${k} w:val="single" w:sz="4" w:space="0" w:color="${LINE}"/>`;
      // Element order follows the Word schema: tblW, tblBorders, tblLayout, tblCellMar, tblLook.
      let xml = `<w:tbl><w:tblPr><w:tblW w:w="${TEXT_W}" w:type="dxa"/>`
        + `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders><w:tblLayout w:type="fixed"/>`
        + '<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar>'
        + `<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="${opt.kv ? 1 : 0}" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>`;
      if (head) xml += `<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>${head.map((h, i) => cellXml(h, w[i], { fill: NAVY, color: 'FFFFFF', bold: true })).join('')}</w:tr>`;
      rows.forEach((r, ri) => {
        xml += `<w:tr><w:trPr><w:cantSplit/>${opt.minHeight ? `<w:trHeight w:val="${opt.minHeight}"/>` : ''}</w:trPr>${r.map((c, i) => cellXml(c, w[i], opt.kv && i === 0
          ? { fill: 'ECEEF8', color: NAVY, bold: true }
          : (ri % 2 === 1 && !opt.kv ? { fill: 'F7F8FC' } : {}))).join('')}</w:tr>`;
      });
      return xml + '</w:tbl>' + para(null, { spacing: [0, 80] });
    }

    function renderBlock(b) {
      switch (b.t) {
        case 'cover': {
          let x = '';
          if (b.logo && images[b.logo]) x += para(null, { raw: drawing(b.logo, 210, null, 'OnNow logo: Instantly connecting communities'), spacing: [0, 240] });
          if (b.kicker) x += para({ text: b.kicker.toUpperCase(), b: true, color: MINT_DARK, size: 20 }, { spacing: [0, 60] });
          x += para(b.title, { style: 'Title' });
          if (b.subtitle) x += para(b.subtitle, { style: 'Subtitle' });
          if (b.rows) x += table(null, b.rows, [0.32, 0.68], { kv: true });
          if (b.note) x += para(b.note, { style: 'Note' });
          return x;
        }
        case 'h1': return para(b.text, { style: 'Heading1' });
        case 'h2': return para(b.text, { style: 'Heading2' });
        case 'h3': return para(b.text, { style: 'Heading3' });
        case 'p': return para(b.runs || b.text);
        case 'note': return para(b.runs || b.text, { style: 'Note' });
        case 'bullets': return b.items.map((it) => para(it, { style: 'ListParagraph', numId: 1 })).join('');
        case 'kv': return table(null, b.rows, b.widths || [0.32, 0.68], { kv: true });
        case 'table': return table(b.head, b.rows, b.widths, { minHeight: b.minHeight });
        case 'image': return para(null, { raw: drawing(b.key, b.width, b.height, b.alt), align: 'center', spacing: [120, 60] })
          + (b.caption ? para({ text: b.caption, i: true, color: MUTED, size: 18 }, { align: 'center' }) : '');
        case 'pagebreak': return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
        default: return '';
      }
    }

    const body = (doc.blocks || []).map(renderBlock).join('');

    // Header: small logo with the report identification. Footer: page numbers.
    const headerRels = [];
    let headerLogo = '';
    if (images.logo) {
      headerRels.push('<Relationship Id="rIdHdrLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/header_logo.png"/>');
      media.push({ name: 'header_logo.png', data: images.logo });
      headerLogo = drawing('logo', 62, null, 'OnNow logo', 'rIdHdrLogo');
    }
    const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
    const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${ns}>`
      + `<w:p><w:pPr><w:pStyle w:val="Header"/><w:tabs><w:tab w:val="right" w:pos="${TEXT_W}"/></w:tabs></w:pPr>${headerLogo}`
      + `<w:r><w:tab/></w:r>${run({ text: doc.headerText || 'OnNow · Fictional demonstration data', color: MUTED, size: 16 })}</w:p></w:hdr>`;
    const fld = (instr) => `<w:r><w:rPr><w:color w:val="${MUTED}"/><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:color w:val="${MUTED}"/><w:sz w:val="16"/></w:rPr><w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r><w:r><w:rPr><w:color w:val="${MUTED}"/><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:color w:val="${MUTED}"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:color w:val="${MUTED}"/><w:sz w:val="16"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>`;
    const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${ns}>`
      + `<w:p><w:pPr><w:pStyle w:val="Footer"/><w:tabs><w:tab w:val="right" w:pos="${TEXT_W}"/></w:tabs></w:pPr>`
      + `${run({ text: doc.footerText || 'Fictional demonstration data. Not for operational use.', color: MUTED, size: 16 })}<w:r><w:tab/></w:r>`
      + `${run({ text: 'Page ', color: MUTED, size: 16 })}${fld('PAGE')}${run({ text: ' of ', color: MUTED, size: 16 })}${fld('NUMPAGES')}</w:p></w:ftr>`;

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${ns}><w:body>${body}`
      + `<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader1"/><w:footerReference w:type="default" r:id="rIdFooter1"/>`
      + `<w:pgSz w:w="${PAGE_W}" w:h="${PAGE_H}"/><w:pgMar w:top="${MARGIN}" w:right="${MARGIN}" w:bottom="${MARGIN}" w:left="${MARGIN}" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;

    const rPr = (o) => `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${o.b ? '<w:b/><w:bCs/>' : ''}${o.i ? '<w:i/>' : ''}<w:color w:val="${o.color || '222222'}"/><w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/></w:rPr>`;
    const style = (id, name, ppr, rpr, extra) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>${extra || ''}<w:pPr>${ppr}</w:pPr>${rpr}</w:style>`;
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`
      + `<w:docDefaults><w:rPrDefault>${rPr({ size: 21 })}</w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`
      + `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/>${rPr({ size: 21 })}</w:style>`
      + style('Title', 'Title', '<w:spacing w:before="0" w:after="120"/>', rPr({ size: 52, b: true, color: NAVY }))
      + style('Subtitle', 'Subtitle', '<w:spacing w:before="0" w:after="240"/>', rPr({ size: 32, b: true, color: INK }))
      + style('Heading1', 'heading 1', `<w:keepNext/><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="4" w:color="${MINT}"/></w:pBdr><w:spacing w:before="360" w:after="140"/><w:outlineLvl w:val="0"/>`, rPr({ size: 32, b: true, color: NAVY }))
      + style('Heading2', 'heading 2', '<w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="1"/>', rPr({ size: 26, b: true, color: MINT_DARK }))
      + style('Heading3', 'heading 3', '<w:keepNext/><w:spacing w:before="180" w:after="60"/><w:outlineLvl w:val="2"/>', rPr({ size: 22, b: true, color: NAVY }))
      + style('Note', 'OnNow note', '<w:shd w:val="clear" w:color="auto" w:fill="FDF3E1"/><w:spacing w:before="120" w:after="160"/><w:ind w:left="120" w:right="120"/>', rPr({ size: 19, color: '7A4E00' }))
      + style('ListParagraph', 'List Paragraph', '<w:spacing w:after="60"/><w:ind w:left="360" w:hanging="360"/>', rPr({ size: 21 }))
      + style('TableText', 'OnNow table text', '<w:spacing w:before="0" w:after="0" w:line="252" w:lineRule="auto"/>', rPr({ size: 18 }))
      + style('Header', 'header', '<w:spacing w:after="0"/>', rPr({ size: 16, color: MUTED }))
      + style('Footer', 'footer', '<w:spacing w:after="0"/>', rPr({ size: 16, color: MUTED }))
      + '</w:styles>';

    const numberingXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
      + '<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/>'
      + `<w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:color w:val="${MINT_DARK}"/></w:rPr></w:lvl></w:abstractNum>`
      + '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>';

    const settingsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
      + '<w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/>'
      + '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>';

    const created = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const coreXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
      + `<dc:title>${X(doc.title)}</dc:title><dc:subject>${X(doc.subject || 'OnNow fictional demonstration report')}</dc:subject><dc:creator>OnNow demonstration</dc:creator>`
      + `<cp:keywords>OnNow; fictional demonstration data</cp:keywords><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${created}</dcterms:modified></cp:coreProperties>`;
    const appXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>OnNow demonstration</Application></Properties>';

    const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
      + '<Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>'
      + '<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>'
      + '<Relationship Id="rIdHeader1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>'
      + '<Relationship Id="rIdFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'
      + rels.join('') + '</Relationships>';
    const hdrRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + headerRels.join('') + '</Relationships>';
    const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
      + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>';
    const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>'
      + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
      + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
      + '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'
      + '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
      + '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'
      + '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
      + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
      + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>';

    return zip([
      { name: '[Content_Types].xml', data: contentTypes },
      { name: '_rels/.rels', data: rootRels },
      { name: 'docProps/core.xml', data: coreXml },
      { name: 'docProps/app.xml', data: appXml },
      { name: 'word/document.xml', data: documentXml },
      { name: 'word/styles.xml', data: stylesXml },
      { name: 'word/numbering.xml', data: numberingXml },
      { name: 'word/settings.xml', data: settingsXml },
      { name: 'word/header1.xml', data: header },
      { name: 'word/footer1.xml', data: footer },
      { name: 'word/_rels/document.xml.rels', data: docRels },
      { name: 'word/_rels/header1.xml.rels', data: hdrRels },
      ...media.map((m) => ({ name: `word/media/${m.name}`, data: m.data }))
    ]);
  }

  window.OnNowDocx = { build: (doc) => Promise.resolve(build(doc)), crc32 };
})();
