# Data Domain Browser (Tailwind + Static CSV)

A zero-build static web app that visualizes your **Data Domains** and **Data Families** from a CSV.  
It uses the Tailwind **Play CDN** (no build step) and [Papa Parse](https://www.papaparse.com/) to read the CSV in the browser.  
The app is **column-name driven** so it remains flexible when new columns are added later (e.g. *data owner*, *business capability*, etc.).

> ✅ Works in Codespaces out-of-the-box.

## Quick Start (Codespaces)

1. Open this repo in **GitHub Codespaces**.
2. When the container finishes building, run:

```bash
npm start
```

> The devcontainer is set to auto-forward port **3000** and open a preview.

## CSV
Put your CSV at: `data/data.csv`.  
This repo includes your uploaded file as a starting point.

**Required column names (case-insensitive):**
- **Data Domain** – the top-level grouping
- **Data Family** – items inside each domain

**Optional columns (auto-detected if present):**
- **AFI**, **ADG**, **RH** – brand checkboxes
- **Quality**, **Accessibility**, **Timeliness** – measure coloring (0–100)
- **MOAT 1**, **MOAT 2**, **MOAT 3** – high-level moats
- Columns like `1.2.3 Some Use Case` – use case flags (filtered based on selected moat)

> Column **C** (`Kurzbeschreibung (Deutsch)`) is ignored as requested.

## UI / Features

- **Header filters**
  - `Show only data domains` – collapse/hide Data Families to show domain tiles with an icon.
  - **Brands** (`AFI`, `ADG`, `RH`) – filter to rows that match any selected brand.
  - **Measures** – *Quality* / *Accessibility* / *Timeliness* (only one active). Active measure colors each Data Family using an HSL gradient from red→yellow→green based on its 0–100 value.
  - **Search** – text filter on *Data Domain* and *Data Family*.
  - **Moat** – choose *Moat 1*, *Moat 2* or *Moat 3*.
  - **Use case** – populated once a moat is chosen (only `1.x.x` for Moat 1, `2.x.x` for Moat 2, etc.).

- **Responsive layout**
  - Uses a Tailwind grid: up to **5 domains per row** on wide screens (`2xl:grid-cols-5`), and gracefully wraps on smaller widths.

- **Icons**
  - Placeholder icons live in `/icons`.  
    The app will try an icon named after the domain slug, e.g. `icons/company-services.svg`. If none is found, it falls back to `icons/_placeholder.svg`.
  - This repo ships auto-generated placeholders for the domains present in the sample CSV. Replace them freely.

## Customize
- If your CSV column names change, the app will **auto-detect** them based on name:
  - `Data Domain`/`Domain` for domains and `Data Family`/`Data Product` for families
  - `/^MOAT \d+/` for moat columns
  - `/^\d+\.\d+(\.\d+)?\s+/` for use case columns

- Colors are computed dynamically via inline HSL. If you prefer strict Tailwind tokens, replace `hslForValue()` in `src/app.js` with a class-based mapping.

## Project Structure

```
.
├── .devcontainer/devcontainer.json
├── data/data.csv
├── icons/
│   ├── _placeholder.svg
│   └── <domain>.svg
├── index.html
├── package.json
├── src/
│   ├── app.js
│   └── utils.js
└── README.md
```

## License
MIT
