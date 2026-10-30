# NASA POWER crop-period indicators

## Data used

RotaShift uses the bundled NASA POWER Daily API point series for 24.37°N, 88.60°E, 19.46 m, from 1998-01-01 through 2025-12-31. The parameters are `PRECTOTCORR` (mm/day), `T2M_MAX` (°C), and `T2M_MIN` (°C). The saved validation record reports 10,227 valid daily values for each parameter and no fill values or missing dates for this interval. Data source labels include MERRA-2 and POWER. These are regional gridded estimates/reanalysis, not farm measurements.

The files are reproducible with `python scripts/fetch_nasa_power.py`. NASA documents the [Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) and the [meteorological data sources](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/).

## Calculation

For each crop activity, the engine selects the crop's documented field-entry event (transplant date for transplanted rice, sowing date for mustard). It repeats that month/day in each available observation year. Period length comes from an entered actual harvest date when supplied; otherwise it evaluates both endpoints of the documented crop-duration range. Date intervals are inclusive.

For each complete calendar-matched period:

- Period precipitation = sum of daily `PRECTOTCORR` values (mm).
- Recorded wet days = count of days where `PRECTOTCORR > 0` mm/day. This is a descriptive data rule, not a meteorological threshold for useful crop rain.
- Period mean high and low = arithmetic means of daily `T2M_MAX` and `T2M_MIN` (°C), respectively.
- The UI displays the min–max range across complete analogues and the count of calendar-matched years available for both rainfall and temperature.

The implementation evaluates every whole-day length in the documented duration range, not only its endpoints. This matters for temperature averages, which do not necessarily change monotonically as a period grows. In the UI, rainfall ranges therefore reflect both historical variation and the documented period-length range; the displayed crop duration makes the latter visible. A year contributes to a parameter's range only when every evaluated duration has a complete window for that parameter. This prevents ranges from mixing different historical samples. The implementation excludes incomplete period/parameter windows and never fills missing values. If no common complete years remain, that parameter's summary is unavailable. A farmer harvest date replaces the catalog duration proxy with the entered inclusive duration.

## Shared 12-month comparison cycle and unoccupied time

All three displayed schedules use a common project convention of **1 October through 30 September** (the configured demonstration instance is 2025-10-01 through 2026-09-30). This is a reproducible comparison interval, not a claim that Bangladesh or Barind has an official October-to-September crop year. The same cycle is passed to every rotation in a comparison. Each crop's field-entry month/day is mapped into the corresponding historical cycle, retaining whether it falls before or after the cycle start. Crop occupancy dates use the entered harvest date when supplied, otherwise every integer duration in the catalog's documented range.

For each duration combination, the engine clips occupancy intervals to the cycle, merges their **union** (so overlapping crop dates are counted only once), then calculates its complement across the *entire* cycle. The resulting unoccupied intervals include time before the first crop, gaps between crops, and time after the final crop. This means a crop-free interval that is outside the listed schedule is still included. Leap days are handled by the actual dates in each analog cycle; the number of unoccupied days can differ by one across historical cycles. Rainfall totals and recorded wet days are calculated only for those unoccupied dates. An analog cycle is complete only when every rainfall date in the 12-month interval exists; missing dates are not interpreted as zero. For duration ranges, only historical years common to all configurations are summarized so each row has consistent analog coverage.

The indicator is explicitly **unoccupied time**, not confirmed bare soil. Residue, weeds, cover crops, or other vegetation may cover the ground. It is a possible erosion-exposure screening context only; the calculation does not estimate erosion or soil loss and does not model rainfall intensity, runoff, slope, soil erodibility, tillage, drainage, canopy, or residue cover. A zero unoccupied interval does not establish low erosion risk.

Crop-period weather remains a separate per-crop indicator: each activity's full historical calendar analogue is reported alongside its evaluated duration(s). Those crop-period totals are not summed across crops and may extend past the common comparison cycle. The cycle is used for comparing total unoccupied time, not to truncate a crop that occupies land across the cycle boundary.

If any activity lacks a field-entry date or a harvest/duration basis, the unoccupied-period indicator is unavailable. Excessive duration combinations or absence of complete cycles also produce an explicit unavailable state. A one-crop rotation is supported; an empty farmer schedule is not treated as a crop rotation and remains unassessed.

## Interpretation limits

These indicators describe historical weather in dates matching the entered crop calendar. They are not a climate trend, seasonal onset estimate, forecast, crop-stage stress test, yield predictor, irrigation adequacy test, or field water balance. No temperature or rainfall hazard threshold has been applied. A regional reanalysis point may not represent a particular farm or its microclimate. Wet-day counting at greater-than-zero is a transparent summary convention only.

Adaptation Margin continues to test source-backed calendar windows only. Crop-period weather statistics do not change its breakpoint calculation because crop-stage sensitivity thresholds, validated hazard rules, field water storage, crop demand, and irrigation volume/reliability are not available.

## Soil indicator interpretation

The crop-occupied-day indicator now uses the union of dated crop field-occupancy intervals, so overlapping schedules do not count the same calendar day twice. Where dates are incomplete, duration bounds are used. This is still a duration proxy: it does not measure canopy, residue, or soil cover. Legume presence is shown only as nitrogen-fixing potential; erosion and organic-matter outcomes remain unresolved without measured cover, slope/erodibility/runoff, residue biomass and management, and baseline soil information.
