const PALETTE = ["#C08A3E","#6B4059","#7C8B6F","#9C6B26","#B0755F","#5C6B4F","#8C5A73","#4A5C7A","#7A9E7E","#A85C6B"];
const REBUY_COLORS = { "Yes": "#7C8B6F", "Maybe": "#C08A3E", "No": "#A85C6B" };

fetch('data.json')
  .then(r => r.json())
  .then(data => render(data))
  .catch(err => {
    document.getElementById('collectionGrid').innerHTML =
      `<p style="color:#a33">Couldn't load data.json — if you opened this file directly, run a local server instead (see README). Error: ${err}</p>`;
  });

function render(data){
  document.getElementById('archiveTitle').textContent = data.owner || 'Fragrance Archive';
  const perfumes = data.perfumes || [];
  document.getElementById('perfumeCount').textContent = perfumes.length;

  renderAccordWheel(perfumes);
  renderBrandChart(perfumes);
  renderRebuyChart(perfumes);
  renderPriceChart(perfumes);
  populateFilters(perfumes);
  renderGrid(perfumes);

  ['brandFilter','seasonFilter','occasionFilter'].forEach(id =>
    document.getElementById(id).addEventListener('change', () => renderGrid(perfumes, currentFilters()))
  );
}

function currentFilters(){
  return {
    brand: document.getElementById('brandFilter').value,
    season: document.getElementById('seasonFilter').value,
    occasion: document.getElementById('occasionFilter').value
  };
}

/* ---------- Accord wheel (donut, split on "/") ---------- */
function renderAccordWheel(perfumes){
  const counts = {};
  perfumes.forEach(p => {
    const fam = p.accordFamily || '';
    const tokens = fam.split('/').map(t => t.trim()).filter(Boolean);
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

/* ---------- Filters ---------- */
function populateFilters(perfumes){
  const brands = [...new Set(perfumes.map(p => p.brand).filter(Boolean))].sort();
  const seasons = [...new Set(perfumes.map(p => p.season).filter(Boolean))];
  const occasions = [...new Set(perfumes.flatMap(p => p.occasion || []))];

  const brandSel = document.getElementById('brandFilter');
  brands.forEach(b => brandSel.insertAdjacentHTML('beforeend', `<option value="${b}">${b}</option>`));

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
    </div>
  `).join('');
}

function noteRow(label, notes, cls){
  if (!notes || !notes.length) return '';
  return `<div class="note-row">
    <span class="tag-label">${label}</span>
    <span class="tags">${notes.map(n => `<span class="tag ${cls}">${n}</span>`).join('')}</span>
  </div>`;
}
