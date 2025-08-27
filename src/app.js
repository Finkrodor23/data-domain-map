
import { slugify } from './utils.js';

const state = {
  rows: [],
  columns: [],
  domainKey: null,
  familyKey: null,
  brandKeys: [],
  measureKeys: { Quality: null, Accessibility: null, Timeliness: null },
  moatKeys: [],
  usecaseKeys: [],
  measureActive: null,
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
};

async function loadCsv() {
  return new Promise((resolve, reject) => {
    Papa.parse('./data/data.csv', {
      header: true,
      dynamicTyping: true,
      download: true,
      skipEmptyLines: 'greedy',
      complete: (results) => resolve(results),
      error: reject,
    });
  });
}

// Robust truthy evaluation
function truthy(v) {
  if (v === true) return true;
  if (v === false) return false;
  if (v == null) return false;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (s === '') return false;
  return ['true','yes','y','1','x','✓','check','checked','t'].includes(s);
}

function discoverColumns(columns) {
  const lower = new Map(columns.map(c => [c.toLowerCase(), c]));
  const get = (...names) => {
    for (const n of names) {
      const k = lower.get(String(n).toLowerCase());
      if (k) return k;
    }
    return undefined;
  };

  state.domainKey = get('Data Domain', 'Domain', 'DataDomain', 'Domain Name') || columns[0];
  state.familyKey = get('Data Family', 'Data Product', 'Family', 'DataFamily') || columns[1];

  state.brandKeys = ['AFI','ADG','RH'].filter(b => lower.has(b.toLowerCase()));

  state.measureKeys.Quality = get('Quality');
  state.measureKeys.Accessibility = get('Accessibility');
  state.measureKeys.Timeliness = get('Timeliness');

  state.moatKeys = columns.filter(c => /^moat\s*\d+/i.test(c));
  state.usecaseKeys = columns.filter(c => /^\d+\.\d+(\.\d+)?\s+/i.test(c));

  // Moat dropdown
  const labelByNum = {
    '1': 'Moat 1: Supply Chain & Demand Planning',
    '2': 'Moat 2: Warehouse & Distribution',
    '3': 'Moat 3: Customer Success',
  };
  const moatNums = state.moatKeys.map(c => (c.match(/(\d+)/) || [])[1]).filter(Boolean);
  const uniqueNums = Array.from(new Set(moatNums)).sort();
  for (const n of uniqueNums) {
    const op = document.createElement('option');
    op.value = String(n);
    op.textContent = labelByNum[n] || `Moat ${n}`;
    el.moatSelect.appendChild(op);
  }
}

function setupEvents() {
  el.toggleDomainsOnly.addEventListener('change', () => {
    state.domainsOnly = el.toggleDomainsOnly.checked;
    render();
  });

  [el.brandAFI, el.brandADG, el.brandRH].forEach((inp, i) => {
    if (!inp) return;
    const name = ['AFI','ADG','RH'][i];
    inp.addEventListener('change', () => {
      if (inp.checked) state.selectedBrands.add(name);
      else state.selectedBrands.delete(name);
      render();
    });
  });

  // Measure toggle (click again to clear)
  el.measureBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const m = btn.dataset.measure;
      state.measureActive = (state.measureActive === m) ? null : m;
      el.measureBtns.forEach(b => b.classList.remove('bg-gray-100','font-medium'));
      if (state.measureActive) {
        const active = el.measureBtns.find(b => b.dataset.measure === state.measureActive);
        active?.classList.add('bg-gray-100','font-medium');
      }
      render();
    });
  });

  el.searchInput.addEventListener('input', (e) => {
    state.searchText = e.target.value.trim().toLowerCase();
    render();
  });

  el.moatSelect.addEventListener('change', () => {
    state.moat = el.moatSelect.value;
    rebuildUsecases();
    state.usecase = '';
    render();
  });

  el.usecaseSelect.addEventListener('change', () => {
    state.usecase = el.usecaseSelect.value;
    render();
  });
}

function rebuildUsecases() {
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
  const prefix = state.moat + '.';
  const items = state.usecaseKeys.filter(c => c.startsWith(prefix));
  const all = document.createElement('option');
  all.value = '';
  all.textContent = 'All use cases';
  el.usecaseSelect.appendChild(all);
  for (const col of items) {
    const o = document.createElement('option');
    o.value = col;
    o.textContent = col;
    el.usecaseSelect.appendChild(o);
  }
}

function filterRows() {
  let rows = state.rows;

  // Search
  if (state.searchText) {
    rows = rows.filter(r => {
      const d = String(r[state.domainKey] || '').toLowerCase();
      const f = String(r[state.familyKey] || '').toLowerCase();
      return d.includes(state.searchText) || f.includes(state.searchText);
    });
  }

  // Brands (any selected)
  if (state.selectedBrands.size > 0) {
    rows = rows.filter(r => Array.from(state.selectedBrands).some(b => truthy(r[b])));
  }

  // Moat
  if (state.moat) {
    const moatCol = state.moatKeys.find(c => (c.match(/(\d+)/) || [])[1] === state.moat);
    if (moatCol) rows = rows.filter(r => truthy(r[moatCol]));
  }

  // Use case
  if (state.usecase) {
    rows = rows.filter(r => truthy(r[state.usecase]));
  }

  return rows;
}

function hslForValue(val) {
  const n = Number(val);
  if (!isFinite(n)) return null;
  const v = Math.max(0, Math.min(100, n));
  const hue = v * 1.2;   // 0..120
  const sat = 80;
  const light = 90 - v * 0.4;
  return `hsl(${hue}deg ${sat}% ${light}%)`;
}

function render() {
  const rows = filterRows();

  // Group by domain, omit falsy or "Other"
  const byDomain = new Map();
  for (const r of rows) {
    const d = String(r[state.domainKey] || '').trim();
    if (!d || /^other$/i.test(d)) continue;
    if (!byDomain.has(d)) byDomain.set(d, []);
    byDomain.get(d).push(r);
  }

  el.grid.innerHTML = '';

  const domains = Array.from(byDomain.keys()).sort((a,b) => a.localeCompare(b));

  if (domains.length === 0) {
    el.empty.classList.remove('hidden');
    el.status.textContent = `0 rows / 0 data domains shown`;
    return;
  }
  el.empty.classList.add('hidden');

  for (const domain of domains) {
    const children = byDomain.get(domain) || [];

    // Dedup families
    const seen = new Set();
    const families = [];
    for (const row of children) {
      const fam = String(row[state.familyKey] || '').trim();
      if (!fam) continue;
      if (!seen.has(fam)) {
        seen.add(fam);
        families.push(row);
      }
    }

    const card = document.createElement('section');
    card.className = 'bg-white rounded-xl border shadow-soft p-3 flex flex-col';

    // Header
    const header = document.createElement('div');
    header.className = 'flex items-center gap-2 mb-2';
    const img = document.createElement('img');
    img.alt = domain;
    img.src = `./icons/${slugify(domain)}.svg`;
    img.className = 'w-8 h-8 rounded-md ring-1 ring-gray-200 object-contain';
    img.onerror = () => { img.src = './icons/_placeholder.svg'; };
    const title = document.createElement('h2');
    title.className = 'text-sm font-semibold leading-snug';
    title.textContent = domain;
    header.appendChild(img);
    header.appendChild(title);
    card.appendChild(header);

    if (!state.domainsOnly) {
      const famGrid = document.createElement('div');
      famGrid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-1.5';
      for (const row of families) {
        const fam = String(row[state.familyKey]);

        const tag = document.createElement('div');
        tag.className = 'rounded-lg border px-2 py-1.5 text-xs leading-snug break-words whitespace-normal';

        if (state.measureActive) {
          const key = state.measureKeys[state.measureActive];
          const col = key ? hslForValue(row[key]) : null;
          if (col) {
            tag.style.backgroundColor = col;
            tag.title = `${state.measureActive}: ${row[key]}`;
          } else {
            tag.style.backgroundColor = '';
            tag.removeAttribute('title');
          }
        } else {
          tag.style.backgroundColor = '';
          tag.removeAttribute('title');
        }
        tag.innerHTML = `<span class="font-medium">${fam}</span>`;
        famGrid.appendChild(tag);
      }
      card.appendChild(famGrid);
    } else {
      const center = document.createElement('div');
      center.className = 'flex-1 flex items-center justify-center py-4';
      const note = document.createElement('div');
      note.className = 'text-[11px] text-gray-400';
      note.textContent = 'Data Families hidden';
      center.appendChild(note);
      card.appendChild(center);
    }

    el.grid.appendChild(card);
  }

  el.status.textContent = `${rows.length} rows / ${domains.length} data domains shown`;
}

async function init() {
  try {
    const { data, meta } = await loadCsv();
    state.rows = data;
    state.columns = meta.fields || Object.keys(data[0] || {});
    discoverColumns(state.columns);
    setupEvents();
    render();
    el.status.textContent = `Loaded ${state.rows.length} rows from CSV`;
  } catch (e) {
    console.error(e);
    el.status.textContent = 'Failed to load CSV';
  }
}

init();
