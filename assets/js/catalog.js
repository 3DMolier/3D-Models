// Catalog data loaded from data/catalog.json
let ALL = [];

document.addEventListener('DOMContentLoaded', function() {
  fetch('/3D-Models/data/catalog.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      ALL = data;
      filtered = ALL.slice();
      renderGrid();
      var spinner = document.getElementById('catalog-spinner');
      if (spinner) spinner.style.display = 'none';
      // URL params
      var urlSearch = new URLSearchParams(location.search);
      var q = urlSearch.get('q'), cat = urlSearch.get('cat');
      if (q) { searchQ = q; var si = document.getElementById('search-input'); if(si)si.value=q; }
      if (cat) { var pill = document.querySelector('.cat-pill[data-cat="'+cat+'"]'); if(pill)pill.click(); }
      if(q||cat) applyFilters();
    })
    .catch(function(e) {
    console.error('Failed to load catalog data', e);
    var spinner = document.getElementById('catalog-spinner');
    if (spinner) spinner.innerHTML = 'Failed to load models. Please refresh the page.';
  });
});

// State
let selCats  = new Set();
let selCerts = new Set();
let priceMin = 0;
let priceMax = 999999;
let searchQ  = '';
let sortMode = 'priority';
let page     = 1;
const PER    = 24;

// Filtered result cache
let filtered = ALL.slice();

function applyFilters() {
  const q = searchQ.toLowerCase();
  filtered = ALL.filter(m => {
    if (q && !m.n.toLowerCase().includes(q)) return false;
    if (selCats.size  && !selCats.has(m.c))    return false;
    if (selCerts.size && !selCerts.has(m.cert)) return false;
    if (m.p < priceMin || m.p > priceMax)       return false;
    return true;
  });

  if (sortMode === 'price-asc')  filtered.sort((a,b) => a.p - b.p);
  else if (sortMode === 'price-desc') filtered.sort((a,b) => b.p - a.p);
  else if (sortMode === 'sales') filtered.sort((a,b) => b.sales - a.sales);
  else if (sortMode === 'name')  filtered.sort((a,b) => a.n.localeCompare(b.n));
  // else keep priority order (already sorted)

  page = 1;
  renderGrid();
  updateActiveFilters();
  updateClearBtn();
}

function certBadgeHtml(cert) {
  if (cert === 'CheckMate Lite/Pro') return '<span class="card-cert cert-cm-badge">CM</span>';
  if (cert === 'StemCell')           return '<span class="card-cert cert-sc-badge">SC</span>';
  return '';
}

function proxyImg(url) {
  if (!url) return '';
  var bare = url.replace(/^https?:\/\//, '');
  return 'https://images.weserv.nl/?url=' + bare + '&w=600&q=85&output=webp';
}

function cardHtml(m) {
  const price = Number.isInteger(m.p) ? m.p : m.p.toFixed(0);
  const imgSrc = proxyImg(m.img);
  const certBadge = certBadgeHtml(m.cert);
  return `<a href="/3D-Models/models/${m.s}/" class="model-card">
    <div class="card-img">
      <img src=”${imgSrc}” alt=”${m.n} 3D model — ${m.c} by 3D Molier” loading=”lazy” onerror=”this.style.display='none';this.nextElementSibling.style.display='flex'”>
      <div class="img-fallback" style="display:none;background:#f5f5f5;">
        <span style="font-size:36px;">&#128247;</span>
      </div>
      <div class="card-overlay"></div>
      <span class="card-cat-badge">${m.c}</span>
      ${certBadge}
      <div class="card-quick-view">View Model &#8594;</div>
    </div>
    <div class="card-body">
      <div class="card-name">${m.n}</div>
      <div class="card-footer">
        <div class="card-price">$${price}</div>
        <div class="card-view">&#8594;</div>
      </div>
    </div>
  </a>`;
}

function renderGrid() {
  const grid      = document.getElementById('model-grid');
  const emptyEl   = document.getElementById('empty-state');
  const loadBtn   = document.getElementById('load-more-btn');
  const countEl   = document.getElementById('count-display');
  const visible   = filtered.slice(0, page * PER);

  countEl.textContent = filtered.length.toLocaleString();

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyEl.style.display = 'block';
    loadBtn.style.display = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  grid.innerHTML = visible.map(cardHtml).join('');

  const hasMore = visible.length < filtered.length;
  loadBtn.style.display = hasMore ? 'inline-block' : 'none';
  if (hasMore) {
    const rem = filtered.length - visible.length;
    loadBtn.textContent = `Load More (${rem} remaining)`;
  }
}

function loadMore() {
  page++;
  renderGrid();
}

// Active filter chips
function updateActiveFilters() {
  const wrap = document.getElementById('active-filters');
  const chips = [];

  selCats.forEach(c => {
    chips.push(`<div class="active-chip">${c} <button onclick="removecat('${c}')" title="Remove">Г—</button></div>`);
  });

  if (priceMin > 0 || priceMax < 999999) {
    const label = priceMax >= 999999 ? `$${priceMin}+` : `$${priceMin} –“ $${priceMax}`;
    chips.push(`<div class="active-chip">${label} <button onclick="removeprice()" title="Remove">Г—</button></div>`);
  }

  selCerts.forEach(c => {
    const label = c === 'no certification' ? 'No Cert' : c;
    chips.push(`<div class="active-chip">${label} <button onclick="removecert('${c}')" title="Remove">Г—</button></div>`);
  });

  if (searchQ) {
    chips.push(`<div class="active-chip">Search: "${searchQ}" <button onclick="clearsearch()" title="Remove">Г—</button></div>`);
  }

  wrap.innerHTML = chips.join('');
}

function removecat(c)  { selCats.delete(c);  var p=document.querySelector(`.cat-pill[data-cat="${c}"]`); p.classList.remove('active'); p.setAttribute('aria-pressed','false'); applyFilters(); }
function removeprice() { priceMin=0; priceMax=999999; document.querySelectorAll('.price-btn').forEach((b,i)=>b.classList.toggle('active',i===0)); applyFilters(); }
function removecert(c) { selCerts.delete(c); document.querySelector(`.cert-opt[data-cert="${c}"]`).classList.remove('active'); applyFilters(); }
function clearsearch() { searchQ=''; document.getElementById('search-input').value=''; applyFilters(); }

function clearAll() {
  selCats.clear(); selCerts.clear();
  priceMin=0; priceMax=999999; searchQ='';
  document.getElementById('search-input').value = '';
  document.querySelectorAll('.cat-pill').forEach(p => { p.classList.remove('active'); p.setAttribute('aria-pressed', 'false'); });
  document.querySelectorAll('.price-btn').forEach((b,i) => b.classList.toggle('active', i===0));
  document.querySelectorAll('.cert-opt').forEach(o => o.classList.remove('active'));
  applyFilters();
}

function updateClearBtn() {
  const hasFilter = selCats.size || selCerts.size || priceMin > 0 || priceMax < 999999 || searchQ;
  document.getElementById('clear-btn').classList.toggle('visible', !!hasFilter);
}

// Event listeners
document.querySelectorAll('.cat-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const cat = pill.dataset.cat;
    if (selCats.has(cat)) { selCats.delete(cat); pill.classList.remove('active'); }
    else { selCats.add(cat); pill.classList.add('active'); }
    applyFilters();
  });
});

document.querySelectorAll('.price-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.price-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    priceMin = +btn.dataset.min;
    priceMax = +btn.dataset.max;
    applyFilters();
  });
});

document.querySelectorAll('.cert-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    const cert = opt.dataset.cert;
    if (selCerts.has(cert)) { selCerts.delete(cert); opt.classList.remove('active'); }
    else { selCerts.add(cert); opt.classList.add('active'); }
    applyFilters();
  });
});

let searchTimer;
document.getElementById('search-input').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { searchQ = e.target.value.trim(); applyFilters(); }, 250);
});

document.getElementById('sort-select').addEventListener('change', e => {
  sortMode = e.target.value;
  applyFilters();
});

// Initial render
renderGrid();