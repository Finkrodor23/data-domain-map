
import { slugify } from './utils.js';

// Global state
const state = {
  rows: [],
  columns: [],
  domainKey: 'Data Domain',
  familyKey: 'Data Family',
  brandKey: 'Brand',
  existsKey: 'Exists',
  measureKeys: {
    Quality: 'Quality',
    Timeliness: 'Timeliness',
    Accessibility: 'Accessibility',
    Completeness: 'Completeness',
  },
  moatKeys: [],
  usecaseKeys: [],

  measureActive: null,       // 'Quality' | 'Timeliness' | 'Accessibility' | 'Completeness' | null
  domainsOnly: false,
  searchText: '',
  moat: '',
  usecase: '',
  focusBrand: null,          // 'AFI' | 'ADG' | 'RH' | null
};

// Elements
const el = {
  grid: document.getElementById('grid'),
  empty: document.getElementById('emptyState'),
  status: document.getElementById('csvStatus'),
  toggleDomainsOnly: document.getElementById('toggleDomainsOnly'),

  measureBtns: Array.from(document.querySelectorAll('.measureBtn')),
  searchInput: document.getElementById('searchInput'),
  moatSelect: document.getElementById('moatSelect'),
  usecaseSelect: document.getElementById('usecaseSelect'),
  focusBrandBtns: Array.from(document.querySelectorAll('.focusBrandBtn')),

  detailsPanel: document.getElementById('detailsPanel'),
  detailsClose: document.getElementById('detailsClose'),
  detailsContent: document.getElementById('detailsContent'),
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

// truthy evaluator for flags
function truthy(v) {
  if (v === true) return true;
  if (v === false) return false;
  if (v == null) return false;
  if (typeof v === 'number') return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (s === '') return false;
  return ['true','yes','y','1','x','✓','check','checked','t'].includes(s);
}

// Discover dynamic columns
function discoverColumns(columns) {
  const lower = new Map(columns.map(c => [c.toLowerCase(), c]));
  const get = (name, fallback) => lower.get(String(name).toLowerCase()) || fallback;
  state.domainKey = get('Data Domain', columns[0]);
  state.familyKey = get('Data Family', columns[1]);
  state.brandKey  = get('Brand', 'Brand');
  state.existsKey = get('Exists', 'Exists');

  // Measures
  state.measureKeys.Quality       = get('Quality', 'Quality');
  state.measureKeys.Timeliness    = get('Timeliness', 'Timeliness');
  state.measureKeys.Accessibility = get('Accessibility', 'Accessibility');
  state.measureKeys.Completeness  = get('Completeness', 'Completeness');

  // Moats + Use Cases
  state.moatKeys = columns.filter(c => /^moat\s*\d+/i.test(c));
  state.usecaseKeys = columns.filter(c => /^\d+\.\d+(\.\d+)?\s+/i.test(c));

  // Populate moat select
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

// Events
function setupEvents() {
  // Domains-only toggle
  el.toggleDomainsOnly.addEventListener('change', () => {
    state.domainsOnly = el.toggleDomainsOnly.checked;
    render();
  });

  // Measures (toggleable)
  el.measureBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const m = btn.dataset.measure;
      state.measureActive = (state.measureActive === m) ? null : m;
      el.measureBtns.forEach(b => b.classList.remove('bg-gray-100','font-medium'));
      if (state.measureActive) {
        el.measureBtns.find(b => b.dataset.measure === state.measureActive)?.classList.add('bg-gray-100','font-medium');
      }
      render();
    });
  });

  // Search
  el.searchInput.addEventListener('input', (e) => {
    state.searchText = e.target.value.trim().toLowerCase();
    render();
  });

  // Moat
  el.moatSelect.addEventListener('change', () => {
    state.moat = el.moatSelect.value;
    rebuildUsecases();
    state.usecase = '';
    render();
  });

  // Use case
  el.usecaseSelect.addEventListener('change', () => {
    state.usecase = el.usecaseSelect.value;
    render();
  });

  // Focus on brand
  el.focusBrandBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const b = btn.dataset.focusBrand;
      state.focusBrand = (state.focusBrand === b) ? null : b;
      el.focusBrandBtns.forEach(bb => bb.classList.remove('bg-gray-100','font-medium'));
      if (state.focusBrand) {
        el.focusBrandBtns.find(bb => bb.dataset.focusBrand === state.focusBrand)?.classList.add('bg-gray-100','font-medium');
      }
      render();
    });
  });

  // Details panel close
  el.detailsClose.addEventListener('click', () => {
    hideDetails();
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

// Filter rows according to search, moat, usecase
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

  // Moat
  if (state.moat) {
    const moatCol = state.moatKeys.find(c => (c.match(/(\d+)/) || [])[1] === state.moat);
    if (moatCol) rows = rows.filter(r => truthy(r[moatCol]));
  }

  // Use case
  if (state.usecase) rows = rows.filter(r => truthy(r[state.usecase]));

  return rows;
}

// Build a structured view grouped by Domain -> Family -> Brand
function groupData(rows) {
  const byDomain = new Map();
  for (const r of rows) {
    const domain = String(r[state.domainKey] || '').trim();
    if (!domain || /^other$/i.test(domain)) continue;
    const family = String(r[state.familyKey] || '').trim();
    const brand = String(r[state.brandKey] || '').trim().toUpperCase();
    if (!byDomain.has(domain)) byDomain.set(domain, new Map());
    const famMap = byDomain.get(domain);
    if (!famMap.has(family)) famMap.set(family, new Map());
    const brandMap = famMap.get(family);
    brandMap.set(brand, r); // one row per brand
  }
  return byDomain;
}

// Color util
function hslForValue(val) {
  const n = Number(val);
  if (!isFinite(n)) return null;
  const v = Math.max(0, Math.min(100, n));
  const hue = v * 1.2;   // 0..120
  const sat = 80;
  const light = 92 - v * 0.45;
  return `hsl(${hue}deg ${sat}% ${light}%)`;
}

// Render
function render() {
  const filtered = filterRows();
  const grouped = groupData(filtered);
  el.grid.innerHTML = '';

  const domains = Array.from(grouped.keys()).sort((a,b) => a.localeCompare(b));

  if (domains.length === 0) {
    el.empty.classList.remove('hidden');
    el.status.textContent = '0 rows / 0 domains';
    return;
  }
  el.empty.classList.add('hidden');

  for (const domain of domains) {
    const famMap = grouped.get(domain);
    const families = Array.from(famMap.keys()).sort((a,b) => a.localeCompare(b));

    const section = document.createElement('section');
    section.className = 'bg-white border shadow-soft p-3 rounded-none flex flex-col';

    // Header
    const header = document.createElement('div');
    header.className = 'flex items-center gap-2 mb-2';
    const img = document.createElement('img');
    img.alt = domain;
    img.src = `./icons/${slugify(domain)}.svg`;
    img.className = 'w-8 h-8 ring-1 ring-gray-200 object-contain';
    img.onerror = () => { img.src = './icons/_placeholder.svg'; };
    const title = document.createElement('h2');
    title.className = 'text-sm font-semibold leading-snug';
    title.textContent = domain;
    header.appendChild(img);
    header.appendChild(title);
    section.appendChild(header);

    if (!state.domainsOnly) {
      const famGrid = document.createElement('div');
      famGrid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-1.5';

      for (const fam of families) {
        const brandMap = famMap.get(fam);

        // If focusing on a brand, hide families where that brand !exists
        if (state.focusBrand) {
          const r = brandMap.get(state.focusBrand);
          if (!r || !truthy(r[state.existsKey])) {
            continue;
          }
        }

        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'text-left border px-2 py-2 text-xs leading-snug whitespace-normal break-words rounded-none h-28 flex flex-col';
        card.dataset.domain = domain;
        card.dataset.family = fam;

        // Header text (clamped)
        const nameEl = document.createElement('div');
        nameEl.className = 'font-medium mb-1 line-clamp-2';
        nameEl.textContent = fam;
        card.appendChild(nameEl);

        // When brand focus is active, color the whole card (if measure selected)
        if (state.focusBrand && state.measureActive) {
          const r = brandMap.get(state.focusBrand);
          const key = state.measureKeys[state.measureActive];
          const color = r ? hslForValue(r[key]) : null;
          if (color) {
            card.style.backgroundColor = color;
            card.title = `${state.measureActive} (${state.focusBrand}): ${r?.[key] ?? ''}`;
          }
        }

        // Bottom brand boxes row (hidden in focus mode)
        if (!state.focusBrand) {
          const brandsRow = document.createElement('div');
          brandsRow.className = 'mt-auto grid grid-cols-3 gap-1';
          ['AFI','ADG','RH'].forEach(b => {
            const r = brandMap.get(b);
            const box = document.createElement('div');
            box.className = 'border text-center text-[11px] py-1 rounded-none';
            box.textContent = b;
            const exists = r ? truthy(r[state.existsKey]) : false;
            if (!exists) {
              // Always gray if not exists
              box.style.backgroundColor = '#e5e7eb'; // gray-200
              box.title = `${b}: not available`;
            } else if (state.measureActive) {
              const key = state.measureKeys[state.measureActive];
              const color = hslForValue(r?.[key]);
              if (color) {
                box.style.backgroundColor = color;
                box.title = `${state.measureActive} (${b}): ${r?.[key] ?? ''}`;
              }
            }
            brandsRow.appendChild(box);
          });
          card.appendChild(brandsRow);
        }

        // Click handler to open details
        card.addEventListener('click', () => openDetails(domain, fam, brandMap));
        famGrid.appendChild(card);
      }

      section.appendChild(famGrid);
    } else {
      const center = document.createElement('div');
      center.className = 'py-4 text-[11px] text-gray-400';
      center.textContent = 'Data Families hidden';
      section.appendChild(center);
    }

    el.grid.appendChild(section);
  }

  const totalRows = filtered.length;
  el.status.textContent = `${totalRows} rows / ${domains.length} data domains shown`;
}

// Details drawer (bottom-right)
function openDetails(domain, family, brandMap) {
  const owner = brandMap.values().next().value?.['Data Owner'] ?? '';
  const steward = brandMap.values().next().value?.['Data Steward'] ?? '';
  const source = brandMap.values().next().value?.['Source'] ?? '';
  const other = brandMap.values().next().value?.['Other Info'] ?? '';

  const measures = ['Exists','Quality','Timeliness','Accessibility','Completeness'];

  // Build brand table
  const rows = ['AFI','ADG','RH'].map(b => {
    const r = brandMap.get(b);
    return {
      Brand: b,
      Exists: r ? (truthy(r['Exists']) ? 'Yes' : 'No') : 'No',
      Quality: r?.['Quality'] ?? '',
      Timeliness: r?.['Timeliness'] ?? '',
      Accessibility: r?.['Accessibility'] ?? '',
      Completeness: r?.['Completeness'] ?? '',
    };
  });

  const tableHead = `<thead><tr>${['Brand',...measures.slice(1)].map(h=>`<th class="border px-2 py-1 text-xs font-semibold">${h}</th>`).join('')}</tr></thead>`;
  const tableBody = `<tbody>${rows.map(r=>`<tr>
    <td class="border px-2 py-1 text-xs font-medium">${r.Brand}</td>
    <td class="border px-2 py-1 text-xs">${r.Quality}</td>
    <td class="border px-2 py-1 text-xs">${r.Timeliness}</td>
    <td class="border px-2 py-1 text-xs">${r.Accessibility}</td>
    <td class="border px-2 py-1 text-xs">${r.Completeness}</td>
  </tr>`).join('')}</tbody>`;

  el.detailsContent.innerHTML = `
    <div class="mb-2">
      <div class="text-sm font-semibold">${family}</div>
      <div class="text-xs text-gray-500">${domain}</div>
    </div>
    <div class="grid grid-cols-2 gap-2 mb-2">
      <div class="text-xs"><span class="font-medium">Owner:</span> ${owner || '-'}</div>
      <div class="text-xs"><span class="font-medium">Steward:</span> ${steward || '-'}</div>
      <div class="text-xs"><span class="font-medium">Source:</span> ${source || '-'}</div>
      <div class="text-xs"><span class="font-medium">Other:</span> ${other || '-'}</div>
    </div>
    <div class="overflow-auto border rounded-none">
      <table class="min-w-full border-collapse">
        ${tableHead}
        ${tableBody}
      </table>
    </div>
  `;

  el.detailsPanel.classList.remove('hidden');
  el.detailsPanel.classList.add('drawer-enter');
  requestAnimationFrame(() => {
    el.detailsPanel.classList.add('drawer-enter-active');
    el.detailsPanel.classList.remove('drawer-enter');
  });
}

function hideDetails() {
  el.detailsPanel.classList.add('hidden');
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
