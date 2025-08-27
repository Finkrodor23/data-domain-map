# Data Domain Browser (Tailwind + Static CSV) — v2

Changes in this version:
- Header reorganized into three rows (Measures + Domains-only / Moat + Use cases + Brands / Search)
- Smaller family tiles with wrapping text (no overlap), tighter domain cards
- Brand, Moat, and Use case filters now use robust truthy parsing (True/False/1/0/X/Yes/No)
- Measure control includes **Timeliness** and supports **click again to clear**
- Domain bucket **"Other"** is hidden
- Up to 5 domains per row, with leaner gaps

See `src/app.js` for details.

## Run in Codespaces
```bash
npm start
```
Port 3000 will open automatically.
