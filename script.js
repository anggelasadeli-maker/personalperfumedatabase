const PALETTE = ["#C08A3E","#6B4059","#7C8B6F","#9C6B26","#B0755F","#5C6B4F","#8C5A73","#4A5C7A","#7A9E7E","#A85C6B"];
const REBUY_COLORS = { "Yes": "#7C8B6F", "Maybe": "#C08A3E", "No": "#A85C6B" };

// Paste your Apps Script Web App URL here after deploying (see README).
// Leave as-is to keep using the static data.json file instead.
const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbyAZQkmG7-x_j_e22okXFWmXq7EVddgEisfbW_3x3RNet1v_zKXPboF-2k3Il6XHAO_6w/exec";
const WRITE_SECRET = "perfumesecret"; // must match SECRET in apps-script.gs

const USING_LIVE_SHEET = SHEET_API_URL && !SHEET_API_URL.startsWith("PASTE_");

function loadData(){
  return USING_LIVE_SHEET
    ? fetch(SHEET_API_URL).then(r => r.json())
    : fetch('data.json').then(r => r.json());
}

loadData()
  .then(data => render(data))
  .catch(err => {
    document.getElementById('collectionGrid').innerHTML =
      `<p style="color:#a33">Couldn't load data — if you opened this file directly, run a local server instead (see README). Error: ${err}</p>`;
  });

let PERFUMES = [];

function render(data){
  document.getElementById('archiveTitle').textContent = data.owner || 'Fragrance Archive';
  const perfumes = data.perfumes || [];
  PERFUMES = perfumes;
  document.getElementById('perfumeCount').textContent = perfumes.length;

  renderAccordWheel(perfumes);
  renderBrandChart(perfumes);
  renderRebuyChart(perfumes);
  renderPriceChart(perfumes);
  renderGapTable(perfumes);
  renderCollectionMap(perfumes);
  setupMapControls(perfumes);
  populateFilters(perfumes);
  renderGrid(perfumes);
  setupPredictor(perfumes);
  setupTodayPick(perfumes);
  setupAddForm(perfumes);
  setupCardFlip();

  ['brandFilter','yearFilter','seasonFilter','occasionFilter'].forEach(id =>
    document.getElementById(id).addEventListener('change', () => renderGrid(perfumes, currentFilters()))
  );
}

function currentFilters(){
  return {
    brand: document.getElementById('brandFilter').value,
    year: document.getElementById('yearFilter').value,
    season: document.getElementById('seasonFilter').value,
    occasion: document.getElementById('occasionFilter').value
  };
}

/* ---------- Accord wheel (donut, split on "/" or ",") ---------- */
function renderAccordWheel(perfumes){
  const counts = {};
  perfumes.forEach(p => {
    const fam = p.accordFamily || '';
    const tokens = fam.split(/[/,]/).map(t => t.trim()).filter(Boolean);
    if (!tokens.length){ counts['Unclassified'] = (counts['Unclassified'] || 0) + 1; return; }
    tokens.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
  });
  const entries = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 10);
  const total = entries.reduce((s,[,c]) => s+c, 0) || 1;

  const svg = document.getElementById('accordWheel');
  const cx = 200, cy = 200, rOuter = 150, rInner = 88;
  let angle = -Math.PI / 2;
  let paths = '', labels = '';

  entries.forEach(([fam, count], i) => {
    const slice = (count / total) * Math.PI * 2;
    const a0 = angle, a1 = angle + slice;
    const x0 = cx + rOuter * Math.cos(a0), y0 = cy + rOuter * Math.sin(a0);
    const x1 = cx + rOuter * Math.cos(a1), y1 = cy + rOuter * Math.sin(a1);
    const xi0 = cx + rInner * Math.cos(a1), yi0 = cy + rInner * Math.sin(a1);
    const xi1 = cx + rInner * Math.cos(a0), yi1 = cy + rInner * Math.sin(a0);
    const large = slice > Math.PI ? 1 : 0;
    const d = `M ${x0} ${y0} A ${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1}
               L ${xi0} ${yi0} A ${rInner} ${rInner} 0 ${large} 0 ${xi1} ${yi1} Z`;
    paths += `<path d="${d}" fill="${PALETTE[i % PALETTE.length]}" opacity="0.92"></path>`;

    const mid = (a0 + a1) / 2;
    const lx = cx + (rOuter + 30) * Math.cos(mid);
    const ly = cy + (rOuter + 30) * Math.sin(mid);
    labels += `<text x="${lx}" y="${ly}" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="#382A1E">${fam} (${count})</text>`;
    angle = a1;
  });

  svg.innerHTML = paths + labels +
    `<circle cx="${cx}" cy="${cy}" r="${rInner - 4}" fill="#F2ECDE"></circle>
     <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="Fraunces" font-size="15" fill="#382A1E">${perfumes.length}</text>
     <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="#382A1E" opacity="0.6">bottles</text>`;
}

/* ---------- Brand breakdown (horizontal bars) ---------- */
function renderBrandChart(perfumes){
  const counts = {};
  perfumes.forEach(p => { counts[p.brand] = (counts[p.brand] || 0) + 1; });
  const entries = Object.entries(counts).sort((a,b) => b[1]-a[1]);

  const svg = document.getElementById('brandChart');
  const width = 480, rowH = 26, top = 10, left = 130, chartW = 300;
  const height = top + entries.length * rowH + 10;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const maxCount = Math.max(...entries.map(([,c]) => c));

  let html = '';
  entries.forEach(([brand, count], i) => {
    const y = top + i * rowH;
    const barW = (count / maxCount) * chartW;
    html += `
      <text x="${left - 10}" y="${y + rowH/2 + 4}" text-anchor="end" class="bar-label">${brand}</text>
      <rect x="${left}" y="${y + 4}" width="${barW}" height="${rowH - 10}" rx="4" fill="${PALETTE[i % PALETTE.length]}"></rect>
      <text x="${left + barW + 8}" y="${y + rowH/2 + 4}" class="bar-value">${count}</text>
    `;
  });
  svg.innerHTML = html;
}

/* ---------- Rebuy vs rating (vertical bars) ---------- */
function renderRebuyChart(perfumes){
  const order = ["Yes", "Maybe", "No"];
  const groups = {};
  order.forEach(k => groups[k] = []);
  perfumes.forEach(p => {
    if (groups[p.rebuy] && p.rating != null) groups[p.rebuy].push(p.rating);
  });

  const svg = document.getElementById('rebuyChart');
  const width = 480, height = 320, baseY = 260, top = 30, barW = 90, gap = 50;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  let html = `<line x1="40" y1="${baseY}" x2="${width-20}" y2="${baseY}" class="axis-line"></line>`;
  order.forEach((key, i) => {
    const vals = groups[key];
    const avg = vals.length ? vals.reduce((s,v) => s+v, 0) / vals.length : 0;
    const barH = (avg / 5) * (baseY - top);
    const x = 60 + i * (barW + gap);
    html += `
      <rect x="${x}" y="${baseY - barH}" width="${barW}" height="${barH}" rx="6" fill="${REBUY_COLORS[key]}" opacity="0.9"></rect>
      <text x="${x + barW/2}" y="${baseY - barH - 10}" text-anchor="middle" font-family="Fraunces" font-size="16" fill="#382A1E">${avg.toFixed(1)}</text>
      <text x="${x + barW/2}" y="${baseY + 22}" text-anchor="middle" class="bar-label">${key}</text>
      <text x="${x + barW/2}" y="${baseY + 38}" text-anchor="middle" class="bar-value">${vals.length} bottles</text>
    `;
  });
  svg.innerHTML = html;
}

/* ---------- Price/ml vs rating (scatter) ---------- */
function renderPriceChart(perfumes){
  const pts = perfumes.filter(p => p.pricePerMl != null && p.rating != null);
  const svg = document.getElementById('priceChart');
  const width = 700, height = 340, marginL = 60, marginB = 40, marginT = 20, marginR = 20;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const maxPrice = Math.max(...pts.map(p => p.pricePerMl));
  const plotW = width - marginL - marginR;
  const plotH = height - marginT - marginB;

  const xOf = v => marginL + (v / maxPrice) * plotW;
  const yOf = v => marginT + plotH - ((v - 1) / 4) * plotH;

  let html = `
    <line x1="${marginL}" y1="${marginT}" x2="${marginL}" y2="${height-marginB}" class="axis-line"></line>
    <line x1="${marginL}" y1="${height-marginB}" x2="${width-marginR}" y2="${height-marginB}" class="axis-line"></line>
  `;
  [1,2,3,4,5].forEach(r => {
    html += `<text x="${marginL - 10}" y="${yOf(r)+4}" text-anchor="end" class="bar-value">${r}</text>`;
    html += `<line x1="${marginL}" y1="${yOf(r)}" x2="${width-marginR}" y2="${yOf(r)}" class="axis-line" opacity="0.4"></line>`;
  });
  html += `<text x="${marginL + plotW/2}" y="${height - 8}" text-anchor="middle" class="bar-label">Price per ml (IDR) \u2192</text>`;

  pts.forEach(p => {
    const cx = xOf(p.pricePerMl), cy = yOf(p.rating);
    const color = REBUY_COLORS[p.rebuy] || '#999';
    html += `<circle cx="${cx}" cy="${cy}" r="6" fill="${color}" opacity="0.8"><title>${p.name} (${p.brand}) — Rp${Math.round(p.pricePerMl)}/ml, ${p.rating}\u2605</title></circle>`;
  });

  svg.innerHTML = html;

  document.getElementById('priceLegend').innerHTML = Object.entries(REBUY_COLORS).map(([k,c]) =>
    `<span class="legend-item"><span class="legend-dot" style="background:${c}"></span>Rebuy: ${k}</span>`
  ).join('');
}

/* ---------- Coverage gaps (Season x Occasion) ---------- */
function renderGapTable(perfumes){
  const seasonOrder = ["Day/Summer", "Night/Winter", "Rainy/Fresh", "All-Season"];
  const seasons = seasonOrder.filter(s => perfumes.some(p => p.season === s));
  const occasions = [...new Set(perfumes.flatMap(p => p.occasion || []))].sort();

  const el = document.getElementById('gapTable');
  if (!seasons.length || !occasions.length){
    el.innerHTML = '<p>Add season/occasion tags to your perfumes to see coverage.</p>';
    return;
  }

  let html = '<table><thead><tr><th>Season \\ Occasion</th>' +
    occasions.map(o => `<th>${o}</th>`).join('') + '</tr></thead><tbody>';

  seasons.forEach(season => {
    html += `<tr><td>${season}</td>`;
    occasions.forEach(occ => {
      const count = perfumes.filter(p => p.season === season && (p.occasion||[]).includes(occ)).length;
      html += `<td class="${count ? 'filled' : 'zero'}">${count || '–'}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

/* ---------- Layering Suggestions ---------- */
function findSharedNotes(listA, listB){
  const normA = [...new Set(listA.map(normalizeNote).filter(Boolean))];
  const normB = [...new Set(listB.map(normalizeNote).filter(Boolean))];
  const shared = [];
  normA.forEach(a => { if (normB.some(b => notesMatch(a, b))) shared.push(a); });
  return shared;
}

/* ---------- Collection Map (real PCA, computed client-side) ---------- */
function dot_(a, b){ return a.reduce((s,x,i) => s + x*b[i], 0); }
function matVec_(M, v){ return M.map(row => dot_(row, v)); }
function vecNorm_(v){ return Math.sqrt(dot_(v,v)); }
function normalizeVec_(v){ const n = vecNorm_(v) || 1; return v.map(x => x/n); }

function powerIteration_(M, iterations=250){
  const n = M.length;
  let v = normalizeVec_(Array.from({length:n}, () => Math.random() - 0.5));
  for (let it = 0; it < iterations; it++) v = normalizeVec_(matVec_(M, v));
  const Mv = matVec_(M, v);
  return { vector: v, value: dot_(v, Mv) };
}

function topKEigen_(M, k=2){
  const n = M.length;
  let cur = M.map(row => row.slice());
  const results = [];
  for (let c = 0; c < k; c++){
    const { vector, value } = powerIteration_(cur);
    results.push({ vector, value });
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        cur[i][j] -= value * vector[i] * vector[j];
  }
  return results;
}

// Splits an Accord Family string on both "/" and "," since the sheet has a
// mix of both delimiters, and normalizes casing for consistent grouping.
function accordTokens(fam){
  return (fam || '')
    .split(/[/,]/)
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);
}

function buildAccordFeatures(perfumes){
  const famLists = perfumes.map(p => [...new Set(accordTokens(p.accordFamily))]);
  const vocabSet = new Set();
  famLists.forEach(list => list.forEach(f => vocabSet.add(f)));
  return { famLists, vocab: [...vocabSet].sort() };
}

function computePCAScores(perfumes, famLists, vocab){
  const n = perfumes.length;
  if (vocab.length < 3 || n < 4) return null;

  let X = famLists.map(list => vocab.map(v => list.includes(v) ? 1 : 0));
  const means = vocab.map((_, j) => X.reduce((s, row) => s + row[j], 0) / n);
  X = X.map(row => row.map((val, j) => val - means[j]));

  const G = X.map((rowI) => X.map((rowJ) => dot_(rowI, rowJ)));
  const eig = topKEigen_(G, 2);

  const scoreFor = (k) => {
    const { vector, value } = eig[k];
    if (value <= 0) return perfumes.map(() => 0);
    const scale = Math.sqrt(value);
    return vector.map(u => u * scale);
  };
  const xs = scoreFor(0), ys = scoreFor(1);

  // axis labels: accord families with the strongest positive/negative loading on each component
  const loadingsFor = (k) => {
    const { vector, value } = eig[k];
    if (value <= 0) return null;
    const scale = 1 / Math.sqrt(value);
    return vocab.map((fam, j) => ({
      fam,
      w: X.reduce((s, row, i) => s + row[j] * vector[i], 0) * scale
    }));
  };
  const axisLabel = (k) => {
    const loadings = loadingsFor(k);
    if (!loadings) return '';
    const sorted = loadings.slice().sort((a,b) => b.w - a.w);
    const pos = sorted[0]?.fam, neg = sorted[sorted.length-1]?.fam;
    return (neg || '?') + '  \u2194  ' + (pos || '?');
  };

  return { xs, ys, xLabel: axisLabel(0), yLabel: axisLabel(1) };
}

// Deterministic small jitter (based on perfume id, not random) so multiple
// bottles sharing the same 0/1 value on a manually chosen axis don't stack
// exactly on top of each other.
function jitterFor(id, salt){
  let hash = 0;
  const s = id + salt;
  for (const ch of s) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return ((hash % 1000) / 1000 - 0.5) * 0.34;
}

function capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

function renderCollectionMap(perfumes, x1='pca', x2='none', y1='pca', y2='none'){
  const svg = document.getElementById('mapChart');
  const { famLists, vocab } = buildAccordFeatures(perfumes);

  if (vocab.length < 3 || perfumes.length < 4){
    svg.outerHTML = '<p style="color:rgba(56,42,30,0.5)">Not enough accord-family data yet to map the collection — tag more bottles first.</p>';
    return;
  }

  const pca = computePCAScores(perfumes, famLists, vocab);
  const presence = (famKey, i) => famLists[i].includes(famKey) ? 1 : 0;

  // axis1='pca' -> use PCA scores (axis2 ignored).
  // axis2 set -> bipolar spectrum: -1 (pure axis1) to +1 (pure axis2), 0 = neither/both.
  // axis2='none' -> plain 0/1 presence of axis1.
  const valuesFor = (axis1, axis2, salt) => {
    if (axis1 === 'pca') return salt === 'x' ? pca.xs : pca.ys;
    if (axis2 && axis2 !== 'none'){
      return perfumes.map((p, i) => (presence(axis2, i) - presence(axis1, i)) + jitterFor(p.id, axis1 + axis2 + salt));
    }
    return perfumes.map((p, i) => presence(axis1, i) + jitterFor(p.id, axis1 + salt));
  };
  const labelFor = (axis1, axis2, autoLabel) => {
    if (axis1 === 'pca') return autoLabel;
    if (axis2 && axis2 !== 'none') return `${capitalize(axis1)}  \u2194  ${capitalize(axis2)}`;
    return `${capitalize(axis1)} — has it (right/top) or not (left/bottom)`;
  };

  const xs = valuesFor(x1, x2, 'x');
  const ys = valuesFor(y1, y2, 'y');
  const xLabel = labelFor(x1, x2, pca.xLabel);
  const yLabel = labelFor(y1, y2, pca.yLabel);

  const width = 700, height = 500, pad = 70;
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xSpan = (xMax - xMin) || 1, ySpan = (yMax - yMin) || 1;
  const xOf = x => pad + ((x - xMin) / xSpan) * (width - 2*pad);
  const yOf = y => height - pad - ((y - yMin) / ySpan) * (height - 2*pad);

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const colorFor = fam => {
    const key = accordTokens(fam)[0] || 'unclassified';
    let hash = 0;
    for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) % PALETTE.length;
    return PALETTE[hash];
  };

  let html = `
    <line x1="${pad}" y1="${(pad + height - pad)/2}" x2="${width-pad}" y2="${(pad+height-pad)/2}" class="axis-line" opacity="0.35"></line>
    <line x1="${width/2}" y1="${pad}" x2="${width/2}" y2="${height-pad}" class="axis-line" opacity="0.35"></line>
    <text x="${width/2}" y="${height-20}" text-anchor="middle" class="bar-label">${xLabel}</text>
    <text x="20" y="${height/2}" text-anchor="middle" class="bar-label" transform="rotate(-90 20 ${height/2})">${yLabel}</text>
  `;
  perfumes.forEach((p, i) => {
    const cx = xOf(xs[i]), cy = yOf(ys[i]);
    html += `<circle cx="${cx}" cy="${cy}" r="6" fill="${colorFor(p.accordFamily)}" opacity="0.85"><title>${p.name} (${p.brand})</title></circle>`;
    html += `<text x="${cx}" y="${cy - 10}" text-anchor="middle" font-family="IBM Plex Mono" font-size="9" fill="#382A1E">${p.name}</text>`;
  });
  svg.innerHTML = html;
}

function setupMapControls(perfumes){
  const { vocab } = buildAccordFeatures(perfumes);
  const x1Sel = document.getElementById('mapX1');
  const x2Sel = document.getElementById('mapX2');
  const y1Sel = document.getElementById('mapY1');
  const y2Sel = document.getElementById('mapY2');

  vocab.forEach(fam => {
    x1Sel.insertAdjacentHTML('beforeend', `<option value="${fam}">X1: ${capitalize(fam)}</option>`);
    x2Sel.insertAdjacentHTML('beforeend', `<option value="${fam}">X2: ${capitalize(fam)}</option>`);
    y1Sel.insertAdjacentHTML('beforeend', `<option value="${fam}">Y1: ${capitalize(fam)}</option>`);
    y2Sel.insertAdjacentHTML('beforeend', `<option value="${fam}">Y2: ${capitalize(fam)}</option>`);
  });

  [x1Sel, x2Sel, y1Sel, y2Sel].forEach(sel => sel.addEventListener('change', () =>
    renderCollectionMap(perfumes, x1Sel.value, x2Sel.value, y1Sel.value, y2Sel.value)
  ));
}

/* ---------- Filters ---------- */
function purchaseYear(p){
  const d = p.purchaseDate;
  if (!d) return null;
  const parts = d.split('/');
  return parts.length === 3 ? parts[2] : null;
}

function populateFilters(perfumes){
  const brands = [...new Set(perfumes.map(p => p.brand).filter(Boolean))].sort();
  const years = [...new Set(perfumes.map(purchaseYear).filter(Boolean))].sort((a,b) => b - a);
  const seasons = [...new Set(perfumes.map(p => p.season).filter(Boolean))];
  const occasions = [...new Set(perfumes.flatMap(p => p.occasion || []))];

  const brandSel = document.getElementById('brandFilter');
  brands.forEach(b => brandSel.insertAdjacentHTML('beforeend', `<option value="${b}">${b}</option>`));

  const yearSel = document.getElementById('yearFilter');
  years.forEach(y => yearSel.insertAdjacentHTML('beforeend', `<option value="${y}">${y}</option>`));

  const seasonSel = document.getElementById('seasonFilter');
  seasons.forEach(s => seasonSel.insertAdjacentHTML('beforeend', `<option value="${s}">${s}</option>`));

  const occSel = document.getElementById('occasionFilter');
  occasions.forEach(o => occSel.insertAdjacentHTML('beforeend', `<option value="${o}">${o}</option>`));
}

/* ---------- Collection grid ---------- */
function renderGrid(perfumes, filters = {}){
  const grid = document.getElementById('collectionGrid');
  const filtered = perfumes.filter(p => {
    if (filters.brand && p.brand !== filters.brand) return false;
    if (filters.year && purchaseYear(p) !== filters.year) return false;
    if (filters.season && p.season !== filters.season) return false;
    if (filters.occasion && !(p.occasion || []).includes(filters.occasion)) return false;
    return true;
  });

  if (!filtered.length){
    grid.innerHTML = `<p style="color:rgba(56,42,30,0.5)">No bottles match that filter.</p>`;
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <div class="card">
      <div class="card-flip">
        <div class="card-front">
          <div class="card-top">
            <div>
              <h3>${p.name}</h3>
              <p class="brand">${p.brand} · ${p.concentration || ''}</p>
            </div>
            <span class="rating">${p.rating != null ? p.rating + '\u2605' : ''}</span>
          </div>
          ${noteRow('Top', p.notes?.top, 'top')}
          ${noteRow('Heart', p.notes?.mid, 'mid')}
          ${noteRow('Base', p.notes?.base, 'base')}
          ${noteRow('Notes', p.notes?.general, 'general')}
          <div class="card-meta">
            <span>${p.season || '—'}</span>
            <span>${(p.occasion || []).join(', ') || '—'}</span>
            <span>${p.pricePerMl ? 'Rp' + Math.round(p.pricePerMl).toLocaleString('id-ID') + '/ml' : '—'}</span>
            <span>${p.rebuy ? 'Rebuy: ' + p.rebuy : '—'}</span>
          </div>
          ${p.comments ? '<span class="flip-hint">tap for your notes \u2192</span>' : ''}
        </div>
        <div class="card-back">
          <h3>${p.name}</h3>
          <p class="back-comment">${p.comments ? '"' + p.comments + '"' : 'No comments logged yet.'}</p>
          <span class="flip-hint">\u2190 tap to flip back</span>
        </div>
      </div>
    </div>
  `).join('');
}

/* ---------- Card flip (event delegation, set up once) ---------- */
function setupCardFlip(){
  const grid = document.getElementById('collectionGrid');
  if (grid.dataset.flipBound) return; // avoid double-binding across re-renders
  grid.dataset.flipBound = 'true';
  grid.addEventListener('click', e => {
    const flip = e.target.closest('.card-flip');
    if (flip) flip.classList.toggle('flipped');
  });
}

function noteRow(label, notes, cls){
  if (!notes || !notes.length) return '';
  return `<div class="note-row">
    <span class="tag-label">${label}</span>
    <span class="tags">${notes.map(n => `<span class="tag ${cls}">${n}</span>`).join('')}</span>
  </div>`;
}

/* ---------- Note similarity helpers ---------- */
function parseNoteInput(str){
  return (str || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function allNotes(p){
  const n = p.notes || {};
  return [...(n.top||[]), ...(n.mid||[]), ...(n.base||[]), ...(n.general||[])]
    .map(s => s.toLowerCase());
}

// Strips extraction-method qualifiers (EO, absolute, extract...) and normalizes
// spelling variants (hyphens, plurals) so "Vanilla Absolute" and "vanillas" both
// reduce to the same core note as plain "Vanilla".
const NOTE_QUALIFIERS = ['essential oil','co2 extract','absolute','extract','resinoid','tincture',' eo\\b','\\boil\\b'];
const NON_PLURAL_S_NOTES = ['iris','cassis','citrus','anise','narcissus','osmanthus','hibiscus','sassafras','molasses','chypre'];
function normalizeNote(s){
  let n = (s || '').toLowerCase().trim().replace(/-/g, ' ').replace(/\s+/g, ' ');
  NOTE_QUALIFIERS.forEach(q => { n = n.replace(new RegExp('\\b' + q, 'g'), ''); });
  n = n.replace(/\s+/g, ' ').trim();
  const tokens = n.split(' ');
  const lastWord = tokens[tokens.length - 1];
  if (!NON_PLURAL_S_NOTES.includes(lastWord)){
    if (n.endsWith('sses')) n = n.slice(0, -2);           // grasses -> grass
    else if (n.length > 3 && n.endsWith('s') && !n.endsWith('ss')) n = n.slice(0, -1);
  }
  return n;
}

// Two normalized notes match if identical, if one is a whole word inside the
// other's space-separated words (e.g. "lemon" in "sicilian lemon"), or if
// they're the same fused compound (e.g. "cedar"/"cedarwood", "moss"/"oakmoss").
// Deliberately NOT generic substring matching — that catches false friends
// like "tea"/"teakwood" or "rose"/"rosemary".
function notesMatch(a, b){
  if (!a || !b || a.length < 3 || b.length < 3) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (longer.split(' ').includes(shorter)) return true;
  if (longer === shorter + 'wood') return true;
  if (shorter.length >= 4 && !longer.includes(' ') && longer.endsWith(shorter)) return true;
  return false;
}

// Similarity between two note lists: fuzzy/containment-matched intersection over union.
function noteSimilarity(listA, listB){
  const normA = [...new Set(listA.map(normalizeNote).filter(Boolean))];
  const normB = [...new Set(listB.map(normalizeNote).filter(Boolean))];
  if (!normA.length || !normB.length) return 0;
  const usedB = new Set();
  let matches = 0;
  normA.forEach(a => {
    const idx = normB.findIndex((b, i) => !usedB.has(i) && notesMatch(a, b));
    if (idx !== -1){ matches++; usedB.add(idx); }
  });
  const union = normA.length + normB.length - matches;
  return union > 0 ? matches / union : 0;
}

/* ---------- Match Predictor ---------- */
function setupPredictor(perfumes){
  document.getElementById('predictorForm').addEventListener('submit', e => {
    e.preventDefault();
    const candidateNotes = [
      ...parseNoteInput(document.getElementById('pTop').value),
      ...parseNoteInput(document.getElementById('pMid').value),
      ...parseNoteInput(document.getElementById('pBase').value),
      ...parseNoteInput(document.getElementById('pGeneral').value),
    ];
    const price = parseFloat(document.getElementById('pPrice').value) || null;
    const size = parseFloat(document.getElementById('pSize').value) || null;
    const name = document.getElementById('pName').value || 'This perfume';
    const brand = document.getElementById('pBrand').value;
    const pricePerMl = (price && size) ? price / size : null;

    if (!candidateNotes.length){
      document.getElementById('predictorResult').innerHTML =
        `<div class="result-box"><p>Add at least a few notes to compare against your collection.</p></div>`;
      return;
    }

    const scored = perfumes
      .map(p => ({ p, sim: noteSimilarity(candidateNotes, allNotes(p)) }))
      .filter(x => x.sim > 0)
      .sort((a,b) => b.sim - a.sim);

    const top = scored.slice(0, 5);

    if (!top.length){
      document.getElementById('predictorResult').innerHTML = `
        <div class="result-box">
          <p class="result-headline">${name}${brand ? ' — ' + brand : ''}: no real overlap found</p>
          <p class="result-sub">None of your notes match anything you already own — this would be a genuinely new direction, not a data point I can predict from.</p>
          ${pricePerMl ? `<div class="stat-grid"><div class="stat-box"><div class="stat-label">Price / ml</div><div class="stat-value">Rp${Math.round(pricePerMl).toLocaleString('id-ID')}</div></div></div>` : ''}
        </div>`;
      return;
    }

    const weightSum = top.reduce((s,x) => s + x.sim, 0);
    const predictedRating = top.reduce((s,x) => s + x.sim * x.p.rating, 0) / weightSum;
    const rebuyYesWeight = top.filter(x => x.p.rebuy === 'Yes').reduce((s,x) => s + x.sim, 0);
    const predictedRebuy = Math.round((rebuyYesWeight / weightSum) * 100);

    const seasonVotes = {}, occVotes = {}, accordVotes = {};
    top.forEach(({p, sim}) => {
      if (p.season) seasonVotes[p.season] = (seasonVotes[p.season]||0) + sim;
      (p.occasion||[]).forEach(o => occVotes[o] = (occVotes[o]||0) + sim);
      (p.accordFamily||'').split(/[/,]/).map(s=>s.trim()).filter(Boolean).forEach(a => accordVotes[a] = (accordVotes[a]||0) + sim);
    });
    const bestOf = obj => Object.entries(obj).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';
    const predSeason = bestOf(seasonVotes);
    const predOccasion = bestOf(occVotes);
    const predAccord = Object.entries(accordVotes).sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0]).join('/') || '—';

    // Gap check against actual collection
    const gapCount = perfumes.filter(p => p.season === predSeason && (p.occasion||[]).includes(predOccasion)).length;
    const fillsGap = gapCount <= 1;

    const matchRows = top.map(({p, sim}) =>
      `<div class="match-row"><span>${p.name} (${p.brand}) — ${p.rating}★</span><span class="match-sim">${Math.round(sim*100)}% overlap</span></div>`
    ).join('');

    document.getElementById('predictorResult').innerHTML = `
      <div class="result-box">
        <p class="result-headline">${name}${brand ? ' — ' + brand : ''}</p>
        <p class="result-sub">Predicted from ${top.length} note-similar bottle${top.length>1?'s':''} in your collection</p>
        <div class="stat-grid">
          <div class="stat-box"><div class="stat-label">Predicted Rating</div><div class="stat-value">${predictedRating.toFixed(1)} ★</div></div>
          <div class="stat-box"><div class="stat-label">Predicted Rebuy</div><div class="stat-value">${predictedRebuy}%</div></div>
          <div class="stat-box"><div class="stat-label">Suggested Season</div><div class="stat-value" style="font-size:15px">${predSeason}</div></div>
          <div class="stat-box"><div class="stat-label">Suggested Occasion</div><div class="stat-value" style="font-size:15px">${predOccasion}</div></div>
          <div class="stat-box"><div class="stat-label">Likely Accord</div><div class="stat-value" style="font-size:15px">${predAccord}</div></div>
          ${pricePerMl ? `<div class="stat-box"><div class="stat-label">Price / ml</div><div class="stat-value" style="font-size:15px">Rp${Math.round(pricePerMl).toLocaleString('id-ID')}</div></div>` : ''}
        </div>
        <div class="gap-flag ${fillsGap ? 'fills' : 'covered'}">
          ${fillsGap
            ? `You only own ${gapCount} bottle(s) for ${predSeason} + ${predOccasion} — this would fill a real gap.`
            : `You already own ${gapCount} bottles for ${predSeason} + ${predOccasion} — this would be more overlap, not new coverage.`}
        </div>
        <p class="result-sub" style="margin-top:16px">Closest matches in your collection:</p>
        <div class="match-list">${matchRows}</div>
      </div>
    `;
  });
}

/* ---------- Today's Pick ---------- */
/* ---------- Categorized layering for Today's Pick ---------- */
const SWEET_CLUSTER = ['gourmand','sweet','vanilla','oriental','ambery','warm'];
const FRESH_CLUSTER = ['fresh','green','aromatic','clean','tea'];

function computeLayeringCategories(pick, perfumes){
  const pickNotes = allNotes(pick);
  const pickFams = new Set(accordTokens(pick.accordFamily));
  const used = new Set([pick.id]);

  const scored = perfumes
    .filter(p => p.id !== pick.id)
    .map(p => {
      const notesP = allNotes(p);
      const fams = new Set(accordTokens(p.accordFamily));
      return {
        p,
        overallSim: noteSimilarity(pickNotes, notesP),
        baseSim: noteSimilarity(pick.notes?.base || [], p.notes?.base || []),
        sharedBase: findSharedNotes(pick.notes?.base || [], p.notes?.base || []),
        sharedAny: findSharedNotes(pickNotes, notesP),
        fams,
        sharedFam: [...fams].some(f => pickFams.has(f)),
        sweetHit: [...fams].filter(f => SWEET_CLUSTER.includes(f)),
        freshHit: [...fams].filter(f => FRESH_CLUSTER.includes(f)),
      };
    });

  function takeBest(pool, sortFn){
    const avail = pool.filter(x => !used.has(x.p.id));
    if (!avail.length) return null;
    avail.sort(sortFn);
    used.add(avail[0].p.id);
    return avail[0];
  }

  const similar = takeBest(
    scored.filter(x => x.overallSim >= 0.15 && x.overallSim <= 0.6),
    (a,b) => (b.baseSim*2 + b.overallSim) - (a.baseSim*2 + a.overallSim)
  );
  const sweet = takeBest(
    scored.filter(x => x.sweetHit.length),
    (a,b) => (b.p.rating||0) - (a.p.rating||0) || b.overallSim - a.overallSim
  );
  const fresh = takeBest(
    scored.filter(x => x.freshHit.length),
    (a,b) => (b.p.rating||0) - (a.p.rating||0) || b.overallSim - a.overallSim
  );
  const explorative = takeBest(
    scored.filter(x => x.overallSim < 0.03 && !x.sharedFam),
    (a,b) => (b.p.rating||0) - (a.p.rating||0)
  );

  return { similar, sweet, fresh, explorative };
}

function layeringCategoryHtml(pick, categories){
  const cards = [
    {
      key: 'similar', label: 'Similar Notes',
      match: categories.similar,
      reason: m => {
        const shared = m.sharedBase.length ? m.sharedBase : m.sharedAny;
        return shared.length
          ? `Shares ${shared.slice(0,3).join(', ')} — will deepen and extend the scent rather than compete with it.`
          : `Moderate overall note overlap — should blend without either one disappearing.`;
      },
      empty: 'Nothing close enough in your collection to reinforce this one without just duplicating it.'
    },
    {
      key: 'sweet', label: 'Sweet Layering',
      match: categories.sweet,
      reason: m => `Tagged ${m.sweetHit.join('/')} — adds warmth ${pick.name} doesn't have on its own. You rated it ${m.p.rating ?? '—'}★.`,
      empty: 'No sweet/gourmand/amber bottle in your collection to pair here.'
    },
    {
      key: 'fresh', label: 'Fresher Layering',
      match: categories.fresh,
      reason: m => `Tagged ${m.freshHit.join('/')} — lightens things up on top. You rated it ${m.p.rating ?? '—'}★.`,
      empty: 'No fresh/green/aromatic bottle in your collection to pair here.'
    },
    {
      key: 'explorative', label: 'Explorative',
      match: categories.explorative,
      reason: m => `No shared notes or accords with ${pick.name} — a genuine wildcard. You rated it ${m.p.rating ?? '—'}★.`,
      empty: 'Nothing distinct enough from this pick to count as a real wildcard right now.'
    },
  ];

  return `<div class="layer-grid">${cards.map(c => `
    <div class="layer-card">
      <p class="layer-cat-label">${c.label}</p>
      ${c.match ? `
        <div class="layer-pair"><span>${c.match.p.name}</span></div>
        <p class="layer-reasons-single">${c.reason(c.match)}</p>
      ` : `<p class="layer-reasons-single layer-empty">${c.empty}</p>`}
    </div>
  `).join('')}</div>`;
}

function setupTodayPick(perfumes){
  const occSel = document.getElementById('tOccasion');
  [...new Set(perfumes.flatMap(p => p.occasion || []))].sort().forEach(o =>
    occSel.insertAdjacentHTML('beforeend', `<option value="${o}">${o}</option>`)
  );

  document.getElementById('todayForm').addEventListener('submit', e => {
    e.preventDefault();
    const weather = document.getElementById('tWeather').value;
    const occasion = document.getElementById('tOccasion').value;

    // Tiered matching: exact season+occasion, then season-only, then occasion-only, then anything.
    let matches = perfumes.filter(p => p.season === weather && (!occasion || (p.occasion||[]).includes(occasion)));
    let tier = 'exact';
    if (!matches.length){
      matches = perfumes.filter(p => p.season === weather || p.season === 'All-Season');
      tier = 'season';
    }
    if (!matches.length && occasion){
      matches = perfumes.filter(p => (p.occasion||[]).includes(occasion));
      tier = 'occasion';
    }
    if (!matches.length){
      matches = perfumes.slice();
      tier = 'none';
    }
    matches = matches.slice().sort((a,b) => (b.rating||0) - (a.rating||0));
    const top3 = matches.slice(0, 3);

    const tierNote = {
      exact: '',
      season: `No exact match for ${weather.split('/')[0]} + ${occasion || 'that occasion'} — widened to anything that fits the weather. This is a coverage gap worth knowing about.`,
      occasion: `Nothing tagged for that weather — matched on occasion only instead.`,
      none: `Nothing tagged for that combo at all yet — showing your highest-rated bottles overall.`
    }[tier];

    const slides = top3.map((p, i) => {
      const layering = computeLayeringCategories(p, perfumes);
      return `
        <div class="slide ${i === 0 ? 'active' : ''}" data-index="${i}">
          <p class="result-headline">${p.name}</p>
          <p class="result-sub">${p.brand} · ${p.rating != null ? p.rating + '★' : 'unrated'}${i === 0 && tierNote ? ' — ' + tierNote : ''}</p>
          ${noteRow('Top', p.notes?.top, 'top')}
          ${noteRow('Heart', p.notes?.mid, 'mid')}
          ${noteRow('Base', p.notes?.base, 'base')}
          ${noteRow('Notes', p.notes?.general, 'general')}
          <p class="result-sub" style="margin-top:16px">Layering ideas:</p>
          ${layeringCategoryHtml(p, layering)}
        </div>
      `;
    }).join('');

    const navHtml = top3.length > 1 ? `
      <div class="slide-nav">
        <button type="button" class="slide-btn" id="slidePrev">\u2190 Prev</button>
        <span class="slide-indicator" id="slideIndicator">1 / ${top3.length}</span>
        <button type="button" class="slide-btn" id="slideNext">Next \u2192</button>
      </div>` : '';

    document.getElementById('todayResult').innerHTML = `
      <div class="result-box">
        <div class="slideshow">${slides}</div>
        ${navHtml}
      </div>
    `;

    if (top3.length > 1){
      let current = 0;
      const container = document.getElementById('todayResult');
      const slideEls = container.querySelectorAll('.slide');
      const indicator = document.getElementById('slideIndicator');
      const show = idx => {
        current = (idx + top3.length) % top3.length;
        slideEls.forEach((s, i) => s.classList.toggle('active', i === current));
        indicator.textContent = `${current + 1} / ${top3.length}`;
      };
      document.getElementById('slidePrev').addEventListener('click', () => show(current - 1));
      document.getElementById('slideNext').addEventListener('click', () => show(current + 1));
    }
  });
}


/* ---------- Add a Bottle ---------- */
function setupAddForm(perfumes){
  document.getElementById('addFormSub').textContent = USING_LIVE_SHEET
    ? 'Fill this in for a bottle you actually own — it saves straight to your Google Sheet.'
    : 'Fill this in for a bottle you actually own — it generates the JSON block to paste into data.json on GitHub.';
  document.getElementById('addFormBtn').textContent = USING_LIVE_SHEET ? 'Save to Sheet' : 'Generate JSON Block';

  document.getElementById('addForm').addEventListener('submit', e => {
    e.preventDefault();
    const val = id => document.getElementById(id).value.trim();
    const num = id => { const v = val(id); return v ? parseFloat(v) : null; };
    const price = num('aPrice'), size = num('aSize');

    const fields = {
      name: val('aName'), brand: val('aBrand'), concentration: val('aConc'),
      sizeMl: size, price: price, purchaseDate: val('aDate'),
      top: val('aTop'), mid: val('aMid'), base: val('aBase'), general: val('aGeneral'),
      accordFamily: val('aAccord'), season: val('aSeason'), occasion: val('aOccasion'),
      rating: num('aRating'), longevity: null, sillage: val('aSillage'),
      wearFrequency: '', rebuy: val('aRebuy'), comments: val('aComments'),
    };

    if (USING_LIVE_SHEET){
      document.getElementById('addResult').innerHTML = `<div class="result-box"><p>Saving to your sheet...</p></div>`;
      fetch(SHEET_API_URL, {
        method: 'POST',
        body: JSON.stringify({ ...fields, secret: WRITE_SECRET }) // plain-text body avoids CORS preflight issues with Apps Script
      })
        .then(r => r.json())
        .then(res => {
          if (res.error){
            document.getElementById('addResult').innerHTML =
              `<div class="result-box"><p class="result-headline">Couldn't save</p><p class="result-sub">${res.error} — check WRITE_SECRET matches SECRET in apps-script.gs.</p></div>`;
            return;
          }
          document.getElementById('addResult').innerHTML =
            `<div class="result-box"><p class="result-headline">Saved as ${res.id}</p><p class="result-sub">Added straight to your Google Sheet. Refresh the page to see it in the charts and grid below.</p></div>`;
          document.getElementById('addForm').reset();
        })
        .catch(err => {
          document.getElementById('addResult').innerHTML =
            `<div class="result-box"><p class="result-headline">Couldn't reach the sheet</p><p class="result-sub">${err}</p></div>`;
        });
      return;
    }

    // Fallback: no live sheet connected yet — generate a JSON block to paste manually
    const nextNum = perfumes.length + 1;
    const obj = {
      id: 'P' + String(nextNum).padStart(3, '0'),
      name: fields.name, brand: fields.brand, concentration: fields.concentration,
      sizeMl: fields.sizeMl, price: fields.price,
      pricePerMl: (fields.price && fields.sizeMl) ? Math.round((fields.price/fields.sizeMl)*100)/100 : null,
      purchaseDate: fields.purchaseDate,
      notes: {
        top: parseNoteInput(fields.top), mid: parseNoteInput(fields.mid),
        base: parseNoteInput(fields.base), general: parseNoteInput(fields.general),
      },
      accordFamily: fields.accordFamily, season: fields.season,
      occasion: parseNoteInput(fields.occasion), rating: fields.rating,
      longevity: null, sillage: fields.sillage, wearFrequency: '',
      rebuy: fields.rebuy, comments: fields.comments,
    };
    const jsonText = JSON.stringify(obj, null, 2) + ',';
    document.getElementById('addResult').innerHTML = `
      <div class="result-box">
        <p class="result-headline">Ready to paste</p>
        <p class="result-sub">Copy this, then on GitHub open data.json, paste it right before the last perfume entry (or right after the opening "perfumes": [ if it's your first). Tip: connect Google Sheets (see README) and this becomes a one-click save instead.</p>
        <div class="json-output" id="jsonOutput">${jsonText.replace(/</g,'&lt;')}</div>
        <button class="copy-btn" id="copyBtn">Copy JSON</button>
      </div>
    `;
    document.getElementById('copyBtn').addEventListener('click', () => {
      navigator.clipboard.writeText(jsonText).then(() => {
        const btn = document.getElementById('copyBtn');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy JSON', 1500);
      });
    });
  });
}
