# Data Domain Browser — v3 (Tailwind + Static CSV)

This iteration supports **brand-specific rows** per data family and a **details drawer**.

## New in v3
- **Uniform family tile height** (fixed height with line-clamped text; long names are truncated with “…”).  
- **Per‑brand boxes (AFI/ADG/RH)** at the bottom of each family:  
  - If **Exists=false** → box is **gray**.  
  - If a **measure** (Quality / Timeliness / Accessibility / Completeness) is selected → the **box** is colored by that measure value.  
  - The family tile stays white.
- **Focus on brand** control: select AFI / ADG / RH to:  
  - Hide the three brand boxes,  
  - Hide families where the selected brand has `Exists=false`,  
  - Color the **entire family tile** using the active measure for the selected brand. Click again to clear focus.
- **Square corners everywhere** (no rounding).
- **Header layout**
  - **Row 1:** Measures + Moat + Use case  
  - **Row 2:** Focus on brand + Domains-only  
  - **Row 3:** Search
- **Details panel (bottom-right)** when clicking a family: shows Owner, Steward, Source, Other info, plus a brand-comparison table.
- **Moat/Use-case filters** and **Search** continue to work with the new per‑brand structure.

## Run in Codespaces
```bash
npm start
```
Port 3000 will open automatically.

## CSV expectations
- Required: `Data Domain`, `Data Family`, `Brand`, `Exists`
- Measures: `Quality`, `Timeliness`, `Accessibility`, `Completeness`
- Optional text: `Data Owner`, `Data Steward`, `Source`, `Other Info`
- Moats: `MOAT 1`, `MOAT 2`, `MOAT 3`
- Use cases: columns starting with `1.x.x`, `2.x.x`, `3.x.x` …
