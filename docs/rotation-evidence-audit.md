# Barind crop and rotation evidence audit

Audit date: 2026-10-30. This is a source and software audit, not field validation.

## What can be compared now

The app compares a farmer-entered schedule with two illustrative, source-listed patterns. The patterns are useful as **calendar and evidence comparisons**, not as locally validated recommendations:

| Pattern in app | Evidence available | What remains unresolved |
|---|---|---|
| Boro → transplanted Aman | BRRI dhan64 and dhan66 profiles provide variety-specific planting windows, seedling ages, durations, land classes and broad irrigation dependence. BAMIS's Rajshahi regional Boro calendar covers Rajshahi, Chapainawabganj, Naogaon and Natore, and reports 150–155 days, consistent with the dhan64 profile's 152-day duration. BRRI dhan66 profile lists a Boro–fallow–Aman cropping pattern. | These sources support a regional calendar comparison, not validation of the exact dates, the dhan64+dhan66 pairing in this pattern, Barind field suitability, water balance, yield, costs, crop-stage hazards or measured soil response. The inter-season fallow interval is not an observed crop or soil-cover measurement. |
| Mustard → Boro → transplanted Aman | BRRI dhan66 profile lists mustard–Boro–Aman. BAMIS has a Rajshahi-region mustard weather calendar for Rajshahi, Chapainawabganj, Naogaon and Natore (80–100 days, November–February seasonal context). A dated mid-October–mid-November sowing advisory was issued for Rangpur district; it is retained as context but is not used as a Rajshahi/Barind hard window. BRRI provides Boro/Aman variety windows. | The illustrative mustard sowing date is not a cultivar-specific Rajshahi validated date. With current dates, mustard sown October 15 and Boro transplanted January 8 are 85 days apart while mustard duration is 80–100 days, so overlap is possible and remains unresolved until actual harvest is entered. A tighter example with Boro field entry December 20 is rejected: 66 days is shorter than the sourced 80-day minimum. Irrigation, field suitability, local adoption and outcomes are not demonstrated. |

The current candidate crop catalog is partial. It supports source-based date checks and selected categorical flags; **no complete rotation is supported as an agronomic recommendation**. The app therefore withholds score/rank. Mungbean remains a regional candidate and is not included among the two comparison schedules because local adoption/rotation and water/soil evidence are weaker.

## Evidence labels used in the interface

- **Documented calendar check:** A date fits or violates a published crop window. It says nothing by itself about yield or overall farm suitability.
- **Possible overlap:** The interval is between the crop-duration minimum and maximum; it is not reported as a pass.
- **Field-entry event:** Nursery sowing is not treated as field entry for transplanted rice; the engine uses transplant date for those crops and sowing date for mustard. A farmer-entered harvest date takes precedence over the duration proxy.
- **Soil-cover duration proxy:** Sums sourced crop durations. This is calendar occupancy, not canopy/ground-cover measurement.
- **Nitrogen-fixing potential:** Indicates a documented legume is present; does not estimate fixation rate or net soil nitrogen. The two displayed scenarios have no documented legume.
- **Water, field soil, yield, cost, risk and crop-stage hazard:** Unsupported or unknown where quantitative and locally applicable evidence is absent. POWER rainfall totals are not crop water sufficiency.

## Barind soil and crop-water source investigation

BARC's Fertilizer Recommendation Guide 2024 describes the Barind area across AEZ 25, 26 and 27, with high/undulating terrain, reddish/yellowish clay and broad constraints including hard clay, drought, heat stress, groundwater decline and low annual rainfall. This is appropriate **regional context**, not a field-level soil observation or suitability decision.

BARC's Crop Zoning portal says its suitability analysis uses agro-edaphic and agro-climatic layers, including soil permeability, effective soil depth, available soil moisture, nutrient status, pH, salinity, consistency, drainage, inundation/flood hazard and slope. This is a promising integration source if a suitable downloadable crop/map layer is found and can be matched to an actual upazila/field. The current app has not imported or spatially matched these layers.

SRDI publicly posts soil-sample chemical-analysis reports, but the reviewed archive presents individual lab-report records rather than a ready-to-use georeferenced Barind soil layer. A farmer-provided SRDI report or field soil test is the defensible immediate integration path; the free-text soil note in the app is not lab evidence.

BAMIS has generic rice water guidance, and crop pages/calendars provide qualitative irrigation timing/dependence. These do not provide the full cultivar-, soil-, season- and field-specific crop water requirement and water supply needed for ranking or water feasibility. The app therefore reports irrigation dependence and unknown water volume separately; it does not convert annual rainfall into an irrigation score.

The Rajshahi regional BAMIS Boro calendar also prints a normal phase-wise water-requirement series. That is useful regional reference material, but it is not yet mapped to this exact BRRI dhan64 schedule, field soils, effective rainfall, irrigation source, or farmer-available volume. It should be added later as a labeled regional benchmark, not treated as a field water-balance result.

## MODIS vegetation data: investigated, not integrated

MODIS/Terra MOD13Q1 Collection 6.1 is a NASA LP DAAC vegetation-index product at 250 m with 16-day composites. The product provides vegetation-index information (NDVI/EVI family) and has quality layers. It could support a **regional vegetation-season pattern exploratory view** after QA filtering and spatial matching.

It is not yet a defensible farm-level crop rotation or soil-health indicator here: 250 m pixels may mix field, settlement, tree and water cover; NDVI/EVI is not crop identity, measured soil cover, soil organic matter, or a direct soil-health outcome. No MODIS retrieval, field boundary, quality screen, or cross-check against local crop calendars has been implemented in this increment.

## NASA POWER reproducibility

`scripts/fetch_nasa_power.py` requests daily PRECTOTCORR, T2M_MAX and T2M_MIN at 24.37 N, 88.60 E for 1998-01-01 through 2025-12-31 in UTC and writes a separate file. It records the request URL, coordinates/elevation, source, dates, parameter units and validation counts. Missing/fill/invalid entries become JSON null and are counted; no imputation is made. It never writes to `data/nasa-power-precip.json`.

## Sources

- NASA POWER Daily API docs: https://power.larc.nasa.gov/docs/services/api/temporal/daily/ (daily point time series, parameter/unit and UTC options).
- NASA POWER meteorological source/methodology: https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/ (meteorological values are MERRA-2/GEOS-IT grid estimates; PRECTOTCORR incorporates observationally corrected precipitation).
- BARC Fertilizer Recommendation Guide 2024: https://apps.barc.gov.bd/fertilizer_recommendation/FRG%20English%2030.10.2024.pdf
- BARC Crop Zoning portal: https://apps.barc.gov.bd/cropzoning/homes/intro
- SRDI soil analysis results archive: https://srdi.gov.bd/pages/srdi-analysis-results
- NASA LP DAAC MOD13Q1 product: https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/products/MOD13Q1/
- NASA LP DAAC vegetation indices overview: https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/science-domain/vegetation-indices/
- Crop-level calendars and profiles: see `data/sources.json`.
- BAMIS Rajshahi Boro weather calendar: https://www.bamis.gov.bd/res/calendars/2019/08/23/5105.pdf
- BAMIS Rajshahi mustard weather calendar: https://www.bamis.gov.bd/res/public/calendars/2019/12/30/10986.pdf
- Full updated constraints and sample schedules: see `docs/barind-rotation-evidence-model.md` and `data/reference-rotations.json`.
