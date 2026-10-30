# RotaShift

A local, evidence-transparent MVP for exploring crop-calendar fit and regional rainfall context in Barind, Northwest Bangladesh. Built for the NASA Space Apps Challenge 2026. Independent project; not endorsed by NASA.

## Run locally

From this directory, start a static server (the app uses ES modules and fetches local JSON, so do not open the HTML as `file://`):

```powershell
python -m http.server 8000
```

Then open <http://localhost:8000/rotashift.html>. Stop with `Ctrl+C`. Python 3 is sufficient; there are no package dependencies or build step.

## What works

- Farmer profile for the Barind regional demonstration: field land class, farmer-entered soil notes, irrigation availability, and a dated existing crop schedule. Profile is saved in this browser's local storage.
- The frontend loads the crop/source/reference-rotation catalogs and the local NASA POWER series, then calls `compareRotations()` from `src/rotation-engine.js` for the side-by-side cards and evidence table. The API withholds rank/recommendation while outcome evidence is not comparable.
- A separately fetched and validated NASA POWER daily climate record is bundled at `data/nasa-power-climate.json`, including PRECTOTCORR, T2M_MAX, and T2M_MIN. Temperatures are visible as evidence metadata, but are not yet connected to crop-stage hazard thresholds.
- Schedule checks include documented sowing/transplant windows, seedling age, land class where supplied, field occupancy, and documented irrigation dependence. A transplanted crop occupies the field from transplanting, not seedbed sowing. An optional actual harvest date can resolve a possible duration-range overlap.
- Comparison of the entered schedule with two illustrative dated scenarios based on source-listed crop patterns. Their dates are not farmer-verified or locally validated, and the UI shows criterion-level evidence side by side. They are not recommendations.
- Earlier and later calendar margins are calculated separately by the engine; the simulator reports the first checked constraint failure. Margins are calendar-only while water/hazard constraints are unresolved.
- Annual rainfall totals and annual means of daily maximum/minimum temperature are summarized from the bundled NASA POWER MERRA-2 series. These are descriptive charts; the app makes no trend or crop-stage stress claim.
- Evidence gaps and four soil-screening indicators are surfaced. No crop outcome scores or rankings are fabricated.

## Evidence limits

The bundled NASA POWER climate records are daily `PRECTOTCORR`, `T2M_MAX`, and `T2M_MIN`, source MERRA-2, UTC, 1998-01-01 through 2025-12-31, at 24.37 N, 88.60 E. These gridded reanalysis values are not farm-gauge or soil-water measurements. Temperature summaries are descriptive; there are no crop-stage hazard checks. Crop calendars are partial sources, and the catalog explicitly records missing evidence.

The app cannot yet determine seasonal crop water sufficiency, yield, crop-specific hazard exposure, farm costs, field soil properties, measured cover, erosion rate, or organic-matter change. Soil-cover duration is only a crop-duration proxy; legume nitrogen fixation is potential only. Farmer inputs and candidate dates are unverified. Comparative scoring is withheld until comparable evidence exists.

See [the audit and input checklist](docs/audit-and-inputs.md), [crop catalog](data/crops.json), [source registry](data/sources.json), and [reference patterns](data/reference-rotations.json).

See the [rotation evidence audit](docs/rotation-evidence-audit.md) for crop-pattern readiness, Barind soil/water source review, and MODIS investigation. Refresh the NASA POWER climate file with `python scripts/fetch_nasa_power.py`; it writes a separate file and does not overwrite the preserved precipitation file. Run automated checks with `npm test`.
