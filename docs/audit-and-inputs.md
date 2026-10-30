# RotaShift audit and first engine increment

## Validated data on hand

- `data/nasa-power-precip.json` was copied from the earlier analysis workspace. NASA POWER header reports source `MERRA2`, product `NASA/POWER Source Native Resolution Daily Data`, period 1998-01-01 through 2025-12-31, UTC, parameter `PRECTOTCORR` in mm/day, and point 88.60 E / 24.37 N / 19.46 m elevation.
- The inclusive date span has 10,227 dates; the file has 10,227 unique ordered dates. Audit found 0 absent date keys, 0 fill values (-999), 0 other negative values, and 0 non-finite values. Valid reported range is 0.0–90.5 mm/day.
- A reproducible fetch was added in `scripts/fetch_nasa_power.py`; the 1998–2025 NASA POWER response is saved separately at `data/nasa-power-climate.json`. It contains 10,227 daily values each for PRECTOTCORR (0.0–90.5 mm/day), T2M_MAX (16.66–46.42 °C), and T2M_MIN (2.32–30.53 °C), with no fill or missing values in this fetched interval. This does not validate crop-stage hazards; crop-specific thresholds and sensitive-stage dates are still absent.
- MERRA-2 is a regional reanalysis product. This point supports regional daily-rainfall summaries and scenario inputs; it is not a field gauge, field-scale soil-water measurement, crop-yield observation, or proof of a climate trend.

## Critical alignment issue

The previous analysis defines rainfall onset over April 1–June 30. BRRI's BRRI dhan66 calendar gives seedbed sowing July 5–14 and transplanting July 25–August 10. The April–June onset statistic is not a validated predictor of those dates. The engine must not turn that statistic into an Aman planting tolerance or Adaptation Margin. The initial engine uses crop-specific documented calendars; weather-linked water and hazard feasibility remains incomplete until relevant crop-stage data and models are available.

## Inputs available / missing

Available: one daily NASA POWER precipitation series; representative coordinates; official crop calendars/profile information for Aman BRRI dhan66, Boro BRRI dhan64, Rajshahi mustard, and a Kharif-I mungbean candidate; farmer priorities can be collected as inputs; the existing interactive HTML is available as a visual reference.

Missing: a field-specific SRDI soil test; quantitative crop evapotranspiration/water-demand values; farm irrigation volume; a verified current crop sequence; local costs and comparable yield/economic inputs; measured canopy/ground cover; slope/erodibility/runoff; residue biomass and residue-return practice; crop-stage hazard windows and thresholds; validation of the mungbean candidate for this Barind example.

## Engine behavior in this increment

- Hard checks include documented local sowing/transplant windows, sourced seedling-age bounds, and irrigation access where the source explicitly says irrigation-dependent. A dated Rangpur mustard sowing advisory is not applied as a Rajshahi/Barind hard window.
- Field occupancy uses a crop-specific event: transplant for transplanted rice and sowing for mustard/mungbean. A sourced minimum duration longer than the interval to the next field entry is a hard same-field overlap failure. An interval within the duration range is unresolved pending actual harvest date. A farmer-entered harvest date is checked directly.
- Missing information stays `incomplete` and is returned with an explanation. It does not become a pass or an invented score.
- Earlier and later Adaptation Margin are computed independently from the actual date windows by shifting the submitted schedule day by day. First failure conditions are returned. The result is labelled partial while water or hazard checks remain unresolved.
- Soil screening returns duration-based cover proxy, legume nitrogen-fixing potential, rainfall on calendar-unoccupied days as a limited exposure proxy, and organic matter as not estimable until residue and soil data exist.
- Priority scores are combined only from explicit 0–100 evidence inputs. Missing criteria reduce coverage and are listed; absent values are never manufactured.
- Rotation candidates are comparisons of partial source-listed patterns and explicitly illustrative dates. They are not locally validated. The app presents calendar/overlap, water, cover-duration and nitrogen-potential evidence side by side while withholding quantitative ranking.
- The active comparison table calls `compareRotations()` and reads its side-by-side results. Candidate example dates load from `data/reference-rotations.json`; the engine returns no rank.

## Sources

- NASA POWER Daily API and data sources: https://power.larc.nasa.gov/docs/services/api/temporal/daily/ and https://power.larc.nasa.gov/docs/methodology/data/sources/
- BRRI dhan66 profile: https://riceprofile.brri.gov.bd/varieties/75
- BRRI dhan64 profile: https://riceprofile.brri.gov.bd/varieties/73
- BRRI dhan48 profile (not currently in the four-crop MVP catalog): https://riceprofile.brri.gov.bd/varieties/2
- BAMIS crop calendars: Rajshahi mustard https://www.bamis.gov.bd/calendar/1/44/2/ and Rajshahi green gram Kharif-I https://www.bamis.gov.bd/calendar/1/86/2/
- BAMIS mustard guidance: https://www.bamis.gov.bd/en/crops/view/44/ ; dated Rangpur-district sowing advice (context only, not a local hard window): https://www.bamis.gov.bd/res/bulletins/2020/10/15/22451.pdf ; Rajshahi Boro regional phase-wise water context: https://www.bamis.gov.bd/res/calendars/2019/08/23/5105.pdf
- BARI mungbean maturity source: https://bari.gov.bd/sites/default/files/files/bari.portal.gov.bd/annual_reports/2013-2014/annual_report.pdf (BARI Mung-6 maturity observation; catalog retains uncertainty and regional caveat).
- BRRI listed reference cropping patterns are on its dhan66 profile above. These are references, not this farmer's verified existing practice.
