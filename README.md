# 🌾 RotaShift


Crop-rotation planning for farmers whose season no longer arrives on time. Measures how far the growing window has moved from 22 years of NASA rainfall data, then shows which rotations survive that shift while improving the soil. NASA Space Apps 2026, Challenge 7.

**Don't ask when the water comes. Ask how late it can come before your plan breaks.**

A decision-support tool for farmers whose growing season no longer arrives on time.
Built for the **NASA Space Apps Challenge 2026 — Challenge 7: Field Shift: Adapting Farms with NASA Data.**

> ⚠️ **Prototype.** Every figure in this build is a sample value in a realistic range, included to demonstrate how the tool works. It is not an agronomic recommendation. See [Data status](#data-status).

---

## The problem

In the haor basin of northeast Bangladesh the year is one crop. Boro rice goes into the ground in Poush and is not ready until late Boishakh — but the flash flood now comes down from the Meghalaya hills before the grain has filled. In the Barind tract of the northwest, the rain arrives late and leaves early, and the ground cracks open while the crop is still in it.

Different crops. Different failures. Different seasons. Same cause: **the calendar these farmers inherited no longer matches the one the sky is keeping.**

Flood warnings exist. They arrive three days before the water. But the farmer's decision — what to plant, and when — was made four months earlier. By then there is nothing left to change.

**Warnings work three days out. RotaShift works four months out, while the decision is still open.**

---

## What it does

| | Part | What it answers |
|---|---|---|
| 01 | **See what changed** | Has the season moved? By how much, and can we prove it? |
| 02 | **Ask the farmer** | What can this household actually afford to lose? |
| 03 | **Adaptation Margin** | How many days can the season shift before this rotation fails? |
| 04 | **Soil Trajectory** | Does this plan leave the soil better or worse after three years? |

### Adaptation Margin

The headline number. The safe window is derived from observed onset dates, then shifted forward one day at a time until a crop sequence no longer fits between planting and the water arriving. The last day that survives is the margin.

A rotation that tolerates a 26-day shift is a fundamentally different proposition from one that fails at 9 — especially where the onset date already swings ±18 days.

### Soil Trajectory

Measured rather than recited from a textbook, so that it can be defended:

```
bare-ground days per year        (Sentinel-2 / Landsat NDVI)
  × heavy rain landing on them   (GPM IMERG extreme-rainfall intensity)
  × local erodibility            (SRDI soil texture class)
  + nitrogen direction           (is there a legume in the sequence?)
  ──────────────────────────────────────────────────────────────
  → improving · holding · degrading
```

---

## Honest statistics

Trends are tested, not asserted. Every figure in the interface carries its test and its p-value.

- **Mann-Kendall** with Sen's slope for onset timing, corrected for autocorrelation
- **Levene's test** for the change in spread
- False-discovery-rate correction across grid cells

**Where a change is not statistically significant, the tool says so and withholds the claim.** Select the Derai field in the prototype to see this: the onset trend returns `p = 0.11`, the figure greys out, and the headline reads *no clear shift* instead of inventing one.

A tool that will say something about every field is a tool you cannot trust about any of them.

---

## Run it

No build step, no dependencies, no server.

```bash
git clone https://github.com/<user>/rotashift.git
cd rotashift
open index.html          # or just double-click the file
```

Single self-contained HTML file. Fonts load from Google Fonts; everything else is inline. Works offline once cached, and respects your system light/dark setting.

### Try this path

1. **Your field** — set the upazila, soil texture and current rotation
2. **When does the rain arrive?** — two decades of onset dates, with p-values beneath
3. Switch the upazila to **Derai** — watch the tool decline to claim a trend
4. **What matters most to you?** — hit a preset, watch the rotations reorder
5. **How far can the season move?** — drag slowly to +9, then +18

---

## Data status

| Layer | Source | Status |
|---|---|---|
| Rainfall, onset, intensity | NASA **GPM IMERG** | Observed · sample values in this build |
| Temperature, growing degree days | NASA **POWER** | Observed · sample values |
| Soil moisture | NASA **SMAP** | Current conditions only — record starts 2015, too short for a 20-year trend |
| Bare-ground days | **Sentinel-2 / Landsat** NDVI | Observed · sample values |
| Flood extent | **Sentinel-1 SAR** (ESA) | Sees through monsoon cloud, unlike optical |
| Crop duration, flood tolerance | **BRRI / BARI** | Placeholder — cited, not redistributed |
| Soil texture class | **SRDI** | Placeholder — cited, not redistributed |
| Seasonal forecast | — | **Not connected.** Nothing here is a prediction |

### Known limits, stated plainly

- **NASA POWER is a ~50 km grid.** Neighbouring upazilas fall in the same cell and return identical values. Onset detection therefore runs on IMERG (~10 km), not POWER.
- **SMAP begins in 2015.** Eleven years is too short for a defensible trend, so SMAP informs current conditions only.
- **Optical NDVI has monsoon cloud gaps.** Sentinel-1 SAR covers the flood-extent layer for that reason.
- **The Adaptation Margin is a crop-window stress test, not a yield model.** It says when a plan stops fitting — never what it will produce.

---

## Roadmap

- Wire the live IMERG pipeline into pre-computed JSON (the interface already reads that shape)
- Ground-truth onset dates against BWDB / FFWC gauge records
- Validate crop timings with BRRI across agro-ecological zones
- Extend beyond the haor: the engine is region-agnostic, so a new crop table is all the Barind or the coastal belt needs
- Bangla voice output for low-literacy users

---

## Attribution

All data sources, libraries, fonts and media used in this project are credited in [`SOURCES.md`](SOURCES.md), as required by the Space Apps participant terms.

## Licence

MIT — see [`LICENSE`](LICENSE).

---

<sub>NASA Space Apps Challenge 2026 · Challenge 7 — Field Shift: Adapting Farms with NASA Data · Bangladesh</sub>

