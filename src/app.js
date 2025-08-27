
// Data Domain Browser
// Loads ./data/data.csv and renders domain & family cards with filters

import { slugify, uniqueBy } from './utils.js';

const state = {
  rows: [],
  columns: [],
  domainKey: null,
  familyKey: null,
  brandKeys: [],         // e.g., ['AFI','ADG','RH']
  measureKeys: { Quality: null, Accessibility: null, Timeliness: null },
  moatKeys: [],          // e.g., ['MOAT 1','MOAT 2','MOAT 3']
  usecaseKeys: [],       // e.g., ['1.1.1 ...', '2.4.1 ...']
  measureActive: 'Quality',
  domainsOnly: false,
  selectedBrands: new Set(),
  searchText: '',
  moat: '',
  usecase: '',
};

const el = {
  grid: document.getElementById('grid'),
  empty: document.getElementById('emptyState'),
  status: document.getElementById('csvStatus'),
  toggleDomainsOnly: document.getElementById('toggleDomainsOnly'),
  brandAFI: document.getElementById('brandAFI'),
  brandADG: document.getElementById('brandADG'),
  brandRH: document.getElementById('brandRH'),
  measureBtns: Array.from(document.querySelectorAll('.measureBtn')),
  searchInput: document.getElementById('searchInput'),
  moatSelect: document.getElementById('moatSelect'),
  usecaseSelect: document.getElementById('usecaseSelect'),
  resetBtn: document.getElementById('resetBtn'),
};

async function loadCsv() {
  const url = './data/data.csv';
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      header: true,
      dynamicTyping: true,
      download: true,
      skipEmptyLines: 'greedy',
      complete: (results) => resolve(results),
      error: reject,
    });
  });
}

// Discover columns by name/patterns to keep this resilient to column changes.
function discoverColumns(columns) {
  const lower = new Set(columns.map(c => c.toLowerCase()));
  const find = (...candidates) => candidates.find(c => lower.has(c.toLowerCase()));

  // Domain & Family
  state.domainKey = find('Data Domain', 'Domain', 'DataDomain', 'Domain Name') || columns[0];
  state.familyKey = find('Data Family', 'Data Product', 'Family', 'DataFamily') || columns[1];

  // Brands (3 classic columns)
  state.brandKeys = ['AFI', 'ADG', 'RH'].filter(b => lower.has(b.toLowerCase()));

  // Measures
  state.measureKeys.Quality = find('Quality');
  state.measureKeys.Accessibility = find('Accessibility');
  state.measureKeys.Timeliness = find('Timeliness');

  // MOAT columns are named like "MOAT 1", "MOAT 2"…
  state.moatKeys = columns.filter(c => /^moat\s*\d+/i.test(c));

  // Use case columns start with something like "1.2.3 Some Title"
  state.usecaseKeys = columns.filter(c => /^\d+\.\d+(\.\d+)?\s+/i.test(c));

  // Build moat select options
  const moatMap = new Map(); // key: moat number string, value: {col, label}
  for (const moatCol of state.moatKeys) {
    const num = (moatCol.match(/(\d+)/) || [])[1] || '';
    const labelByNum = {
      '1': 'Moat 1: Supply Chain & Demand Planning',
      '2': 'Moat 2: Warehouse & Distribution',
      '3': 'Moat 3: Customer Success',
    };
    moatMap.set(num, { col: moatCol, label: labelByNum[num] || moatCol });
  }
  // populate moat select
  for (const [num, info] of moatMap) {
    const opt = document.createElement('option');
    opt.value = String(num);
    opt.textContent = info.label;
    el.moatSelect.appendChild(opt);
  }

  state._moatMap = moatMap; // keep internally
}

function setupEvents() {
  el.toggleDomainsOnly.addEventListener('change', () => {
    state.domainsOnly = el.toggleDomainsOnly.checked;
    render();
  });

  // Brands
  const brandInputs = [el.brandAFI, el.brandADG, el.brandRH].filter(Boolean);
  brandInputs.forEach((inp, i) => {
    if (!inp) return;
    inp.addEventListener('change', () => {
      const brandName = ['AFI','ADG','RH'][i];
      if (inp.checked) state.selectedBrands.add(brandName);
      else state.selectedBrands.delete(brandName);
      render();
    });
  });

  // Measures, only one active
  el.measureBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.measureActive = btn.dataset.measure;
      // toggle styles
      el.measureBtns.forEach(b => b.classList.remove('bg-gray-100', 'font-medium'));
      btn.classList.add('bg-gray-100', 'font-medium');
      render();
    });
  });

  // Search
  el.searchInput.addEventListener('input', (e) => {
    state.searchText = e.target.value.trim().toLowerCase();
    render();
  });

  // Moat select
  el.moatSelect.addEventListener('change', () => {
    state.moat = el.moatSelect.value;
    // Rebuild use cases for this moat
    rebuildUsecaseSelect();
    state.usecase = '';
    render();
  });

  // Use case select
  el.usecaseSelect.addEventListener('change', () => {
    state.usecase = el.usecaseSelect.value;
    render();
  });

  // Reset
  el.resetBtn.addEventListener('click', () => {
    // reset state
    state.domainsOnly = false;
    el.toggleDomainsOnly.checked = false;

    state.selectedBrands.clear();
    [el.brandAFI, el.brandADG, el.brandRH].forEach(inp => inp && (inp.checked = false));

    state.measureActive = 'Quality';
    el.measureBtns.forEach(b => {
      b.classList.remove('bg-gray-100','font-medium');
      if (b.dataset.measure === 'Quality') b.classList.add('bg-gray-100','font-medium');
    });

    state.searchText = '';
    el.searchInput.value = '';

    state.moat = '';
    el.moatSelect.value = '';

    state.usecase = '';
    rebuildUsecaseSelect(); // will disable & show placeholder

    render();
  });
}

function rebuildUsecaseSelect() {
  // Build use case options for selected moat
  el.usecaseSelect.innerHTML = '';
  if (!state.moat) {
    el.usecaseSelect.disabled = true;
    const op = document.createElement('option');
    op.value = '';
    op.textContent = '(Select Moat first)';
    el.usecaseSelect.appendChild(op);
    return;
  }
  el.usecaseSelect.disabled = false;

  // Filter usecase columns that start with the moat number and collect their names
  const prefix = state.moat + '.';
  const list = state.usecaseKeys.filter(c => c.startsWith(prefix));

  const allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = 'All use cases';
  el.usecaseSelect.appendChild(allOpt);

  for (const col of list) {
    const opt = document.createElement('option');
    opt.value = col; // use the column name for filtering
    opt.textContent = col;
    el.usecaseSelect.appendChild(opt);
  }
}

function filterRows() {
  let rows = state.rows;

  // Text search (domain or family)
  if (state.searchText) {
    rows = rows.filter(r => {
      const d = String(r[state.domainKey] || '').toLowerCase();
      const f = String(r[state.familyKey] || '').toLowerCase();
      return d.includes(state.searchText) || f.includes(state.searchText);
    });
  }

  // Brand filters (if any selected -> row must match at least one)
  if (state.selectedBrands.size > 0) {
    rows = rows.filter(r => Array.from(state.selectedBrands).some(b => r[b] === true));
  }

  // Moat filter
  if (state.moat) {
    const moatCol = state._moatMap.get(state.moat)?.col;
    if (moatCol) {
      rows = rows.filter(r => Boolean(r[moatCol]));
    }
  }

  // Usecase filter (acts within moat if chosen)
  if (state.usecase) {
    rows = rows.filter(r => Boolean(r[state.usecase]));
  }

  return rows;
}

function hslForValue(val) {
  // map 0..100 to red(0) -> yellow(60) -> green(120)
  const v = Math.max(0, Math.min(100, Number(val)));
  const hue = (v * 1.2); // 0..120
  const sat = 80;
  const light = 90 - (v * 0.4); // keep readable
  return `hsl(${hue}deg ${sat}% ${light}%)`;
}

function render() {
  const rows = filterRows();
  // Group by domain
  const byDomain = new Map();
  for (const r of rows) {
    const d = r[state.domainKey] || 'Other';
    if (!byDomain.has(d)) byDomain.set(d, []);
    byDomain.get(d).push(r);
  }

  // Clear grid
  el.grid.innerHTML = '';

  const domains = Array.from(byDomain.keys()).sort((a,b) => String(a).localeCompare(String(b)));

  if (domains.length === 0) {
    el.empty.classList.remove('hidden');
    return;
  } else {
    el.empty.classList.add('hidden');
  }

  for (const domain of domains) {
    const children = byDomain.get(domain) || [];
    // Deduplicate families inside a domain
    const seen = new Set();
    const families = [];
    for (const row of children) {
      const famName = row[state.familyKey];
      if (!famName) continue;
      if (!seen.has(famName)) {
        seen.add(famName);
        families.push(row); // keep the first representative row
      }
    }

    const card = document.createElement('section');
    card.className = 'bg-white rounded-xl border shadow-soft p-4 flex flex-col';

    // Header
    const header = document.createElement('div');
    header.className = 'flex items-center gap-3 mb-3';
    const img = document.createElement('img');
    img.alt = String(domain);
    const slug = slugify(String(domain));
    img.src = `./icons/${slug}.svg`;
    img.className = 'w-10 h-10 rounded-lg ring-1 ring-gray-200 object-contain';
    img.onerror = () => { img.src = './icons/_placeholder.svg'; };
    const title = document.createElement('h2');
    title.className = 'text-base font-semibold leading-tight';
    title.textContent = String(domain);
    header.appendChild(img);
    header.appendChild(title);
    card.appendChild(header);

    if (!state.domainsOnly) {
      // Families grid
      const famGrid = document.createElement('div');
      famGrid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-2';
      for (const row of families) {
        const fam = String(row[state.familyKey]);

        const tag = document.createElement('div');
        tag.className = 'rounded-lg border px-3 py-2 text-sm leading-snug';

        // Measure coloring
        const key = state.measureKeys[state.measureActive];
        if (key && row[key] !== undefined && row[key] !== null && row[key] !== '') {
          tag.style.backgroundColor = hslForValue(row[key]);
          tag.title = `${state.measureActive}: ${row[key]}`;
        }

        tag.innerHTML = `<span class="font-medium">${fam}</span>`;

        famGrid.appendChild(tag);
      }

      card.appendChild(famGrid);
    } else {
      // Domains-only view — center icon + subtle hint
      const center = document.createElement('div');
      center.className = 'flex-1 flex items-center justify-center py-6';
      const placeholder = document.createElement('div');
      placeholder.className = 'text-xs text-gray-400';
      placeholder.textContent = 'Data Families hidden';
      center.appendChild(placeholder);
      card.appendChild(center);
    }

    el.grid.appendChild(card);
  }

  // Status
  el.status.textContent = `${rows.length} rows / ${domains.length} data domains shown`;
}

async function init() {
  try {
    const { data, meta } = await loadCsv();
    state.rows = data;
    state.columns = meta.fields || Object.keys(data[0] || {});
    discoverColumns(state.columns);
    setupEvents();
    // default active button style
    el.measureBtns.find(b => b.dataset.measure === state.measureActive)?.classList.add('bg-gray-100','font-medium');
    rebuildUsecaseSelect();
    render();
    el.status.textContent = `Loaded ${state.rows.length} rows from CSV`;
  } catch (err) {
    console.error(err);
    el.status.textContent = 'Failed to load CSV';
  }
}

init();
