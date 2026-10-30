const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SCORE_KEYS = ["yield", "risk", "soil", "water", "cost"];
export const DEFAULT_ANALYSIS_CYCLE = Object.freeze({ id: "barind_october_to_september", start: "2025-10-01", end: "2026-09-30", months: 12 });

export function evaluateRotation(plan, crops, field = {}, climate = {}) {
  const catalog = new Map(crops.map(crop => [crop.id, crop]));
  const failures = [];
  const unresolved = [];
  const evidence = [];
  const activities = (plan.activities ?? []).map((activity, index) => ({ ...activity, index }));

  if (!activities.length) unresolved.push(issue("rotation", "missing_activities", "Add the crop sequence and planned dates."));

  const dated = [];
  for (const activity of activities) {
    const crop = catalog.get(activity.cropId);
    if (!crop) {
      unresolved.push(issue("crop", "crop_data_missing", `Crop data is missing for ${activity.cropId ?? "an unselected crop"}.`, activity));
      continue;
    }
    const plantingDate = parseDate(activity.plantingDate);
    if (!plantingDate) {
      unresolved.push(issue("planting_window", "planting_date_missing", `Enter the planned sowing date for ${crop.name}.`, activity));
      continue;
    }
    const transplantDate = crop.planting?.transplant_window ? parseDate(activity.transplantDate) : null;
    const occupancyEvent = crop.field_occupancy?.start_event;
    const occupancyValue = occupancyEvent === "transplantDate" ? activity.transplantDate : occupancyEvent === "plantingDate" ? activity.plantingDate : null;
    const occupancyStart = parseDate(occupancyValue);
    if (!occupancyEvent) unresolved.push(issue("duration", "field_occupancy_basis_missing", `Field-occupancy start is not documented for ${crop.name}; same-field overlap cannot be checked.`, activity));
    else if (!occupancyStart) unresolved.push(issue("duration", "field_occupancy_start_missing", `Enter ${occupancyEvent === "transplantDate" ? "transplant" : "sowing"} date to check when ${crop.name} occupies the field.`, activity, crop.field_occupancy?.source_id));
    dated.push({ activity, crop, plantingDate, fieldStart: occupancyStart });
    if (Array.isArray(crop.missing) && crop.missing.length) unresolved.push(issue("crop", "crop_evidence_gaps", `${crop.name} still has ${crop.missing.length} documented evidence gap(s): ${crop.missing.join("; ")}.`, activity));
    const suitableLand = crop.soil?.suitable_land;
    if (Array.isArray(suitableLand) && field.landClass) {
      if (!suitableLand.includes(field.landClass)) failures.push(issue("soil", "land_class_incompatible", `${crop.name} is documented for ${suitableLand.join(" / ")} land; the entered field class is ${field.landClass}.`, activity));
    } else if (Array.isArray(suitableLand)) unresolved.push(issue("soil", "field_land_class_missing", `Enter field land class to check ${crop.name}'s documented land suitability.`, activity));
    const sowingWindow = crop.planting?.sowing_window ?? crop.planting?.seedbed_sowing_window;
    if (sowingWindow) {
      if (!inMonthDayWindow(plantingDate, sowingWindow)) {
        failures.push(issue("planting_window", "outside_sowing_window", `${crop.name} sowing date ${activity.plantingDate} is outside the documented ${sowingWindow.start}–${sowingWindow.end} window.`, activity, sowingWindow.source_id));
      } else {
        evidence.push(issue("planting_window", "inside_sowing_window", `${crop.name} sowing date is inside its documented window.`, activity, sowingWindow.source_id));
      }
    } else {
      const advisory = crop.planting?.sowing_advisory_not_used_as_local_hard_window;
      unresolved.push(issue("planting_window", advisory ? "sowing_window_not_locally_applicable" : "sowing_window_missing", advisory ? `A sowing advisory exists for ${crop.name}, but it is not validated for this region; no local hard window is applied.` : `No sourced sowing window is available for ${crop.name}.`, activity, advisory?.source_id ?? null));
    }

    if (crop.planting?.transplant_window) {
      if (!transplantDate) {
        unresolved.push(issue("planting_window", "transplant_date_missing", `Enter the transplant date for ${crop.name}; the source provides a transplant window.`, activity, crop.planting.transplant_window.source_id));
      } else if (!inMonthDayWindow(transplantDate, crop.planting.transplant_window)) {
        failures.push(issue("planting_window", "outside_transplant_window", `${crop.name} transplant date ${activity.transplantDate} is outside the documented ${crop.planting.transplant_window.start}–${crop.planting.transplant_window.end} window.`, activity, crop.planting.transplant_window.source_id));
      } else {
        evidence.push(issue("planting_window", "inside_transplant_window", `${crop.name} transplant date is inside its documented window.`, activity, crop.planting.transplant_window.source_id));
      }
      const age = transplantDate ? dayDifference(plantingDate, transplantDate) : null;
      const expectedAge = crop.planting.seedling_age_days;
      if (age !== null && expectedAge && (age < expectedAge.min || age > expectedAge.max)) {
        failures.push(issue("duration", "seedling_age_outside_range", `${crop.name} seedling age is ${age} days; the sourced range is ${expectedAge.min}–${expectedAge.max} days.`, activity, expectedAge.source_id));
      }
    }

    const water = crop.water?.dependence;
    if (water === "irrigation_dependent") {
      if (field.irrigationAccess === "none") failures.push(issue("water", "irrigation_unavailable", `${crop.name} is documented as irrigation-dependent, but this field has no irrigation access.`, activity, crop.water.source_id));
      else if (field.irrigationAccess === "reliable") {
        evidence.push(issue("water", "irrigation_access_available", `Irrigation access is reported for ${crop.name}.`, activity, crop.water.source_id));
        unresolved.push(issue("water", "water_volume_unknown", `Irrigation access is reported, but available seasonal volume and crop water demand are not quantified for ${crop.name}.`, activity, crop.water.source_id));
      }
      else unresolved.push(issue("water", "irrigation_access_unknown", `Confirm irrigation access for ${crop.name}; BRRI identifies it as irrigation-dependent.`, activity, crop.water.source_id));
    } else if (water === "rainfed_with_supplemental_irrigation_if_needed" || water === "supplemental_irrigation_at_critical_stages") {
      unresolved.push(issue("water", "water_sufficiency_unknown", `${crop.name} may need supplemental irrigation; field water storage, crop demand, and available irrigation volume are not quantified. NASA rainfall alone cannot establish field water sufficiency.`, activity, crop.water.source_id));
    } else {
      unresolved.push(issue("water", "water_requirement_unknown", `Crop water requirement is not sufficiently documented for ${crop.name}.`, activity, crop.water?.source_id ?? null));
    }
  }

  dated.sort((a, b) => (a.fieldStart ?? a.plantingDate) - (b.fieldStart ?? b.plantingDate));
  for (let i = 1; i < dated.length; i++) {
    const previous = dated[i - 1], next = dated[i];
    if (!previous.fieldStart || !next.fieldStart) continue;
    const duration = previous.crop.duration_days;
    if (!duration || !Number.isFinite(duration.min) || !Number.isFinite(duration.max)) {
      unresolved.push(issue("duration", "duration_missing", `Cannot check field overlap after ${previous.crop.name}; crop duration is missing.`, previous.activity));
      continue;
    }
    const actualHarvest = parseDate(previous.activity.harvestDate);
    if (actualHarvest) {
      if (actualHarvest >= next.fieldStart) failures.push(issue("duration", "field_occupancy_conflict", `${next.crop.name} field occupancy starts ${next.fieldStart.toISOString().slice(0, 10)} before ${previous.crop.name} harvest on ${actualHarvest.toISOString().slice(0, 10)}. Both crops are scheduled on the same field.`, next.activity, duration.source_id));
      else evidence.push(issue("duration", "field_occupancy_nonoverlap", `${previous.crop.name} harvest is recorded before ${next.crop.name} enters the field.`, next.activity, duration.source_id));
      continue;
    }
    const gap = dayDifference(previous.fieldStart, next.fieldStart);
    if (gap < duration.min) {
      failures.push(issue("duration", "field_occupancy_conflict", `${next.crop.name} enters the same field ${gap} days after ${previous.crop.name} field occupancy begins; the shortest sourced duration is ${duration.min} days, so the schedules overlap.`, next.activity, duration.source_id));
    } else if (gap < duration.max) {
      unresolved.push(issue("duration", "field_occupancy_overlap_uncertain", `${next.crop.name} may enter before ${previous.crop.name} is harvested: the interval is ${gap} days and its sourced field-occupancy duration ranges up to ${duration.max} days. Confirm the actual harvest date before treating this sequence as feasible.`, next.activity, duration.source_id));
    } else {
      evidence.push(issue("duration", "field_occupancy_gap", `${next.crop.name} enters after the maximum sourced duration for ${previous.crop.name}; this duration-based check finds no overlap.`, next.activity, duration.source_id));
    }
  }

  if (!climate.temperature) unresolved.push(issue("hazard", "temperature_series_missing", "No temperature series is present in the audited project data; heat/cold exposure is not assessed."));
  if (!climate.hazardRulesValidated) unresolved.push(issue("hazard", "hazard_model_missing", "Crop-specific hazard thresholds and sensitive-stage dates are not validated; hazard feasibility is not assessed."));

  const soilScreen = buildSoilScreen(dated, climate, plan);
  const hardStatus = failures.length ? "infeasible" : unresolved.length ? "incomplete" : "feasible";
  return {
    rotationId: plan.id ?? null,
    rotationName: plan.name ?? "Unnamed rotation",
    status: hardStatus,
    failures,
    unresolved,
    evidence,
    soilScreen,
    score: null,
    scoreStatus: "awaiting_evidence_inputs",
    missingScoreInputs: SCORE_KEYS.filter(key => !Number.isFinite(plan.evidenceScores?.[key]))
  };
}

/** Compare rotations side by side without assigning rank or recommendation. */
export function compareRotations(plans, crops, field = {}, climate = {}, analysisCycle = DEFAULT_ANALYSIS_CYCLE) {
  const climateRows = compareRotationClimateExposure(plans, crops, climate, analysisCycle);
  const rows = plans.map((plan, index) => ({
    planId: plan.id ?? null,
    planName: plan.name ?? "Unnamed rotation",
    role: plan.role ?? "candidate",
    result: evaluateRotation(plan, crops, field, climate),
    climateExposure: climateRows[index].cropPeriods,
    unoccupiedPeriodExposure: climateRows[index].unoccupiedPeriods
  }));
  return {
    rows,
    analysisCycle: { ...analysisCycle, basis: "shared 12-month comparison convention; not a Bangladesh-wide official crop-year definition" },
    rankingStatus: "not_ranked_insufficient_comparable_outcome_evidence",
    note: "Rows compare documented constraints and evidence status. No rotation is recommended or ranked without comparable validated outcome evidence."
  };
}

/**
 * Descriptive NASA POWER exposure for each crop's historical calendar analogue.
 * This is not a crop-stress test, forecast, or field water balance. Calendar dates
 * are repeated across the available observation years and crop-duration bounds
 * are both evaluated instead of inventing a single duration.
 */
export function calculateRotationClimateExposure(plan, crops, climate = {}) {
  const cropById = new Map(crops.map(crop => [crop.id, crop]));
  const rainfallByDate = new Map((climate.dailyRainfall ?? []).map(row => [normaliseIsoDate(row.date), toFiniteNonnegative(row.mm)]).filter(([date, value]) => date && value !== null));
  const temperatureByDate = new Map((climate.dailyTemperature ?? []).map(row => [normaliseIsoDate(row.date), { max: toFinite(row.max), min: toFinite(row.min) }]).filter(([date, value]) => date && value.max !== null && value.min !== null));
  const years = [...new Set([...rainfallByDate.keys(), ...temperatureByDate.keys()].map(date => Number(date.slice(0, 4))))].sort((a, b) => a - b);
  return (plan.activities ?? []).map((activity, index) => {
    const crop = cropById.get(activity.cropId);
    const startEvent = crop?.field_occupancy?.start_event;
    const startValue = startEvent === "transplantDate" ? activity.transplantDate : startEvent === "plantingDate" ? activity.plantingDate : null;
    const start = parseDate(startValue);
    if (!crop || !start) return { activityIndex: index, cropId: activity.cropId ?? null, status: "insufficient_inputs", reason: "A documented field-entry date is needed to match the crop period to historical climate." };

    const actualHarvest = parseDate(activity.harvestDate);
    if (activity.harvestDate && (!actualHarvest || actualHarvest < start)) return { activityIndex: index, cropId: crop.id, status: "insufficient_inputs", reason: "The entered harvest date is invalid or before field entry." };
    const actualDuration = actualHarvest && actualHarvest >= start ? dayDifference(start, actualHarvest) + 1 : null;
    const duration = actualDuration !== null
      ? { min: actualDuration, max: actualDuration, basis: "farmer_reported_harvest" }
      : crop.duration_days && Number.isInteger(crop.duration_days.min) && Number.isInteger(crop.duration_days.max) && crop.duration_days.min > 0 && crop.duration_days.max >= crop.duration_days.min
        ? { min: crop.duration_days.min, max: crop.duration_days.max, basis: "source_duration_proxy" }
        : null;
    if (!duration) return { activityIndex: index, cropId: crop.id, status: "insufficient_inputs", reason: "A recorded harvest date or sourced crop-duration range is needed to define this period." };

    const durations = Array.from({ length: duration.max - duration.min + 1 }, (_, i) => duration.min + i);
    const periodRain = [], periodWetDays = [], periodMeanMax = [], periodMeanMin = [];
    const rainfallDurationCount = new Map(), temperatureDurationCount = new Map();
    let rainfallPartialWindows = 0, temperaturePartialWindows = 0;
    for (const year of years) {
      const yearStart = dateForMonthDay(year, start.getUTCMonth() + 1, start.getUTCDate());
      if (!yearStart) continue;
      for (const days of durations) {
        let rainSum = 0, wetDays = 0, rainCount = 0, maxSum = 0, minSum = 0, tempCount = 0;
        for (let offset = 0; offset < days; offset++) {
          const date = new Date(yearStart.getTime() + offset * DAY_MS).toISOString().slice(0, 10);
          if (rainfallByDate.has(date)) { const mm = rainfallByDate.get(date); rainSum += mm; rainCount++; if (mm > 0) wetDays++; }
          if (temperatureByDate.has(date)) { const temp = temperatureByDate.get(date); maxSum += temp.max; minSum += temp.min; tempCount++; }
        }
        if (rainCount === days) { periodRain.push({year,value:rainSum}); periodWetDays.push({year,value:wetDays}); rainfallDurationCount.set(year,(rainfallDurationCount.get(year)??0)+1); }
        else rainfallPartialWindows++;
        if (tempCount === days) { periodMeanMax.push({year,value:maxSum / days}); periodMeanMin.push({year,value:minSum / days}); temperatureDurationCount.set(year,(temperatureDurationCount.get(year)??0)+1); }
        else temperaturePartialWindows++;
      }
    }
    const rainfallYears = [...rainfallDurationCount].filter(([,count])=>count===durations.length).map(([year])=>year);
    const temperatureYears = [...temperatureDurationCount].filter(([,count])=>count===durations.length).map(([year])=>year);
    const commonRainValues = samples => samples.filter(sample=>rainfallYears.includes(sample.year)).map(sample=>sample.value);
    const commonTemperatureValues = samples => samples.filter(sample=>temperatureYears.includes(sample.year)).map(sample=>sample.value);
    const rainValues=commonRainValues(periodRain),wetValues=commonRainValues(periodWetDays),maxValues=commonTemperatureValues(periodMeanMax),minValues=commonTemperatureValues(periodMeanMin);
    const rainRange = numericRange(rainValues), wetRange = numericRange(wetValues), maxRange = numericRange(maxValues, 2), minRange = numericRange(minValues, 2);
    return {
      activityIndex: index,
      cropId: crop.id,
      status: rainRange || maxRange ? "descriptive_history_available" : "no_complete_historical_window",
      fieldEntryEvent: startEvent,
      durationDays: duration,
      periodLengthsEvaluated: durations.length,
      historicalCalendarYears: years.length ? { start: years[0], end: years.at(-1), availableYearCount: years.length } : null,
      rainfall: { unit: "mm/window", observedRange: rainRange, completeAnalogueYears: rainfallYears.length, partialWindowsExcluded: rainfallPartialWindows },
      rainyDays: { unit: "days/window; days with PRECTOTCORR > 0", observedRange: wetRange, completeAnalogueYears: rainfallYears.length },
      meanDailyTmax: { unit: "°C", observedRange: maxRange, completeAnalogueYears: temperatureYears.length, partialWindowsExcluded: temperaturePartialWindows },
      meanDailyTmin: { unit: "°C", observedRange: minRange, completeAnalogueYears: temperatureYears.length, partialWindowsExcluded: temperaturePartialWindows },
      source: "NASA POWER Daily API · regional MERRA-2 point",
      interpretation: "Observed historical calendar-period context only. Not a forecast, field measurement, crop-stage stress threshold, or water-sufficiency test."
    };
  });
}

/**
 * Historical precipitation during all unoccupied portions of a shared 12-month
 * analysis cycle, including before, between, and after crop occupancy.
 */
export function calculateRotationBarePeriodExposure(plan, crops, climate = {}, analysisCycle = DEFAULT_ANALYSIS_CYCLE) {
  const rainfallByDate = new Map((climate.dailyRainfall ?? []).map(row => [normaliseIsoDate(row.date), toFiniteNonnegative(row.mm)]).filter(([date, value]) => date && value !== null));
  const rainYears = [...new Set([...rainfallByDate.keys()].map(date => Number(date.slice(0, 4))))].sort((a, b) => a - b);
  const cropById = new Map(crops.map(crop => [crop.id, crop]));
  const activities = (plan.activities ?? []).map(activity => {
    const crop = cropById.get(activity.cropId);
    const startEvent = crop?.field_occupancy?.start_event;
    const startValue = startEvent === "transplantDate" ? activity.transplantDate : startEvent === "plantingDate" ? activity.plantingDate : null;
    const start = parseDate(startValue);
    const harvest = parseDate(activity.harvestDate);
    if (!crop || !start || (activity.harvestDate && (!harvest || harvest < start))) return null;
    const duration = harvest ? dayDifference(start, harvest) + 1 : crop.duration_days?.min;
    const maxDuration = harvest ? duration : crop.duration_days?.max;
    if (!Number.isInteger(duration) || !Number.isInteger(maxDuration) || duration < 1 || maxDuration < duration) return null;
    return { crop, activity, start, minDuration: duration, maxDuration };
  });
  const cycleStart = parseDate(analysisCycle?.start), cycleEnd = parseDate(analysisCycle?.end);
  const nextCycleStart = cycleStart ? dateForMonthDay(cycleStart.getUTCFullYear() + 1, cycleStart.getUTCMonth() + 1, cycleStart.getUTCDate()) : null;
  if (!cycleStart || !cycleEnd || !nextCycleStart || addDays(nextCycleStart, -1).getTime() !== cycleEnd.getTime()) {
    return { status: "insufficient_inputs", reason: "A valid shared 12-month analysis cycle is required." };
  }
  if (!activities.length || activities.some(item => !item)) {
    return { status: "insufficient_inputs", reason: "Each crop needs a documented field-entry date, harvest date, or sourced duration range." };
  }
  activities.sort((a, b) => a.start - b.start);
  let configurations = [[]];
  for (const item of activities) {
    const choices = Array.from({ length: item.maxDuration - item.minDuration + 1 }, (_, i) => item.minDuration + i);
    if (configurations.length * choices.length > 5000) return { status: "insufficient_inputs", reason: "Duration ranges create too many schedule combinations for this screening calculation." };
    configurations = configurations.flatMap(config => choices.map(days => [...config, days]));
  }
  const configurationsResults = [];
  let partialScenarioWindows = 0;
  const cycleStartMonthDay = cycleStart.toISOString().slice(5,10);
  const cycleEndMonthDay = cycleEnd.toISOString().slice(5,10);
  for (const year of rainYears) {
    const analogStart = dateForMonthDay(year, cycleStart.getUTCMonth() + 1, cycleStart.getUTCDate());
    const endYear = cycleEndMonthDay < cycleStartMonthDay ? year + 1 : year;
    const analogEnd = dateForMonthDay(endYear, cycleEnd.getUTCMonth() + 1, cycleEnd.getUTCDate());
    const alignedStarts = activities.map(item => {
      const monthDay = `${String(item.start.getUTCMonth() + 1).padStart(2,"0")}-${String(item.start.getUTCDate()).padStart(2,"0")}`;
      const targetYear = monthDay >= cycleStartMonthDay ? year : year + 1;
      return dateForMonthDay(targetYear, item.start.getUTCMonth() + 1, item.start.getUTCDate());
    });
    if (!analogStart || !analogEnd) continue;
    const shiftedStarts = alignedStarts;
    if (shiftedStarts.some(date => !date)) continue;
    for (const durations of configurations) {
      const intervals = activities.map((item, i) => {
        const start = shiftedStarts[i], end = addDays(start, durations[i] - 1);
        return [start < analogStart ? analogStart : start, end > analogEnd ? analogEnd : end];
      }).filter(([start,end]) => end >= start);
      const occupied = mergeIntervals(intervals);
      const unoccupied = [];
      let cursor = analogStart;
      for (const [start,end] of occupied) {
        if (start > cursor) unoccupied.push([cursor, addDays(start,-1)]);
        if (end >= cursor) cursor = addDays(end,1);
      }
      if (cursor <= analogEnd) unoccupied.push([cursor,analogEnd]);
      // The entire comparison cycle is part of the denominator, even when no
      // crops are entered for an interval. Missing daily observations make the
      // scenario incomplete; they are never treated as dry days.
      let rainSum = 0, wetDays = 0, unoccupiedDays = 0, complete = true;
      for (let date = new Date(analogStart); date <= analogEnd; date = addDays(date, 1)) {
        const key = date.toISOString().slice(0, 10);
        if (!rainfallByDate.has(key)) { complete = false; break; }
      }
      if (!complete) { partialScenarioWindows++; continue; }
      for (const [start, end] of unoccupied) {
        for (let date = new Date(start); date <= end; date = addDays(date, 1)) {
          const key = date.toISOString().slice(0, 10);
          const mm = rainfallByDate.get(key); rainSum += mm; if (mm > 0) wetDays++; unoccupiedDays++;
        }
        if (!complete) break;
      }
      if (complete) configurationsResults.push({ year, rainMm: rainSum, wetDays, unoccupiedDays, unoccupiedIntervals: unoccupied.length, configuration: durations });
      else partialScenarioWindows++;
    }
  }
  if (!configurationsResults.length) return { status: "no_complete_historical_window", durationConfigurations: configurations.length, partialScenarioWindows, reason: "No complete historical rainfall record was available for the unoccupied portions of the shared cycle." };
  const configurationKey = config => config.join(",");
  const completeYearsByConfig = new Map(configurations.map(config => [configurationKey(config), new Set()]));
  for (const row of configurationsResults) {
    completeYearsByConfig.get(configurationKey(row.configuration))?.add(row.year);
  }
  const commonYears = [...completeYearsByConfig.values()].reduce((common, set, i) => i === 0 ? new Set(set) : new Set([...common].filter(year => set.has(year))), new Set());
  const comparableResults = configurationsResults.filter(row => commonYears.has(row.year));
  if (!commonYears.size) return { status: "no_complete_historical_window", durationConfigurations: configurations.length, partialScenarioWindows, reason: "No complete historical years were shared by every crop-duration configuration." };
  return {
    status: "descriptive_history_available",
    basis: "shared_12_month_cycle_complement_of_union_of_crop_occupancy_intervals",
    analysisCycle: { start: analysisCycle.start, end: analysisCycle.end, months: 12 },
    durationConfigurations: configurations.length,
    completeAnalogueYears: commonYears.size,
    completeScenarioWindows: comparableResults.length,
    partialScenarioWindows,
    unoccupiedDays: numericRange(comparableResults.map(row => row.unoccupiedDays)),
    unoccupiedIntervals: numericRange(comparableResults.map(row => row.unoccupiedIntervals)),
    rainfall: { unit: "mm during unoccupied periods in the 12-month analysis cycle", observedRange: numericRange(comparableResults.map(row => row.rainMm)) },
    wetDays: { unit: "days where PRECTOTCORR > 0 mm/day", observedRange: numericRange(comparableResults.map(row => row.wetDays)) },
    interpretation: "Possible erosion-exposure screening context only. Unoccupied does not mean confirmed bare soil; actual ground cover may remain from residue, weeds, or other vegetation. This is not a measured erosion rate or soil-loss estimate; field cover, slope, soil erodibility, runoff, and rainfall intensity are not modeled. Every rotation uses the same 12-month cycle and overlapping crop occupancy is unioned before its complement is calculated."
  };
}

/** Side-by-side descriptive climate rows; crop periods are never summed across crops. */
export function compareRotationClimateExposure(plans, crops, climate = {}, analysisCycle = DEFAULT_ANALYSIS_CYCLE) {
  return (plans ?? []).map(plan => ({
    planId: plan.id ?? null,
    planName: plan.name ?? "Unnamed rotation",
    cropPeriods: calculateRotationClimateExposure(plan, crops, climate),
    unoccupiedPeriods: calculateRotationBarePeriodExposure(plan, crops, climate, analysisCycle)
  }));
}

export function calculateAdaptationMargin(plan, crops, field = {}, climate = {}) {
  const baseline = evaluateRotation(plan, crops, field, climate);
  const cropWindows = (plan.activities ?? []).some(activity => {
    const crop = crops.find(item => item.id === activity.cropId);
    return Boolean(crop?.planting?.sowing_window ?? crop?.planting?.seedbed_sowing_window ?? crop?.planting?.transplant_window);
  });
  if (!cropWindows) {
    return { earlierDays: null, laterDays: null, status: "not_calculable", reason: "No sourced planting window constrains this rotation." };
  }
  const missingSchedule = baseline.unresolved.filter(item => ["missing_activities", "crop_data_missing", "planting_date_missing", "transplant_date_missing", "sowing_window_missing"].includes(item.code));
  if (missingSchedule.length) {
    return { earlierDays: null, laterDays: null, status: "baseline_incomplete", baselineUnresolved: missingSchedule, reason: "Complete the crop sequence and all sourced sowing/transplant dates before calculating a calendar margin." };
  }
  if (baseline.failures.length) {
    return { earlierDays: null, laterDays: null, status: "baseline_infeasible", baselineFailures: baseline.failures, earlierFailure: baseline.failures, laterFailure: baseline.failures };
  }

  const findDirection = direction => {
    let lastPass = 0;
    for (let magnitude = 1; magnitude <= 366; magnitude++) {
      const shiftDays = direction * magnitude;
      const shifted = shiftPlan(plan, shiftDays);
      const result = evaluateRotation(shifted, crops, field, climate);
      if (result.failures.length) return { days: lastPass, firstFailureAtDays: magnitude, failure: result.failures[0], censored: false };
      lastPass = magnitude;
    }
    return { days: null, firstFailureAtDays: null, failure: null, censored: true, note: "No known failure within one complete calendar-year search envelope." };
  };
  const earlier = findDirection(-1);
  const later = findDirection(1);
  const incomplete = baseline.unresolved.length > 0;
  return {
    earlierDays: earlier.days,
    laterDays: later.days,
    status: incomplete ? "calendar_only_partial" : "complete_for_configured_constraints",
    baselineUnresolved: baseline.unresolved,
    earlierFailure: earlier.failure,
    earlierFailureAtDays: earlier.firstFailureAtDays,
    laterFailure: later.failure,
    laterFailureAtDays: later.firstFailureAtDays,
    searchEnvelopeDays: 366,
    note: "Margins are the last passing integer-day shifts under configured constraints. A partial result excludes unresolved water and hazard checks; it is not a crop recommendation."
  };
}

export function rankRotations(plans, crops, farmer = {}, climate = {}) {
  const weights = normalizeWeights(farmer.priorities ?? {});
  const evaluations = plans.map(plan => ({ plan, result: evaluateRotation(plan, crops, farmer, climate) }));
  const feasible = evaluations.filter(item => item.result.status !== "infeasible");
  const active = SCORE_KEYS.filter(key => weights[key] > 0);
  const missing = new Map();
  for (const item of feasible) {
    const absent = active.filter(key => !validScore(item.plan.evidenceScores?.[key]));
    missing.set(item.plan.id, absent);
    const totalWeight = active.reduce((sum, key) => sum + weights[key], 0);
    const availableWeight = active.filter(key => validScore(item.plan.evidenceScores?.[key])).reduce((sum, key) => sum + weights[key], 0);
    item.result.score = availableWeight ? active.reduce((sum, key) => sum + (validScore(item.plan.evidenceScores?.[key]) ? item.plan.evidenceScores[key] * weights[key] : 0), 0) / availableWeight : null;
    item.result.scoreStatus = !active.length ? "no_active_priorities" : absent.length ? "partial_missing_inputs" : "complete_for_active_priorities";
    item.result.scoreCoverage = totalWeight ? availableWeight / totalWeight : 0;
  }
  feasible.sort((a, b) => (b.result.score ?? -Infinity) - (a.result.score ?? -Infinity));
  return {
    rankingStatus: !active.length ? "no_active_priorities" : feasible.some(item => item.result.status !== "feasible" || item.result.scoreStatus !== "complete_for_active_priorities") ? "partial" : "complete",
    activePriorities: active,
    weights,
    missingInputsByRotation: Object.fromEntries(missing),
    ranked: feasible.map(({ plan, result }, index) => ({ rank: result.score === null ? null : index + 1, ...result })),
    infeasible: evaluations.filter(item => item.result.status === "infeasible").map(({ result }) => result),
    note: "Only explicit evidenceScores are combined. Missing criteria are omitted from the partial score and reported; no agronomic score is invented."
  };
}

function buildSoilScreen(datedActivities, climate, plan) {
  const coverDays = calculateMergedOccupancyDays(datedActivities);
  const nFixing = datedActivities.filter(item => item.crop.soil?.n_fixing_potential === "yes_potential_only").map(item => item.crop.name);
  const rainOnUnoccupiedDays = calculateRainOnUnoccupiedDays(datedActivities, climate.dailyRainfall ?? [], plan.cycle);
  return {
    soilCoverPotential: { ...coverDays, caveat: "Crop duration is a calendar-occupancy proxy; it does not measure canopy or ground cover." },
    nitrogenFixingPotential: { crops: nFixing, status: nFixing.length ? "potential_present" : datedActivities.length ? "no_documented_legume_in_sequence" : "incomplete", caveat: "Potential only; no nitrogen fixation rate or net soil-N change is estimated." },
    erosionExposure: rainOnUnoccupiedDays === null
      ? { valueMm: null, status: "missing_inputs", caveat: "Requires dated daily rain, a complete rotation schedule, and cycle bounds; slope, soil erodibility, runoff, and cover fraction are also missing." }
      : { valueMm: rainOnUnoccupiedDays, status: "rain_on_calendar_unoccupied_days_proxy", caveat: "Not an erosion rate: no rainfall intensity, runoff, slope, erodibility, or measured cover fraction." },
    organicMatterContribution: { value: null, status: "not_estimable", missing: ["residue biomass", "residue removal/return practice", "soil carbon or organic matter baseline"] }
  };
}

function calculateMergedOccupancyDays(datedActivities) {
  if (!datedActivities.length) return { min: null, max: null, status: "incomplete", basis: "union_of_calendar_occupancy_intervals" };
  const minIntervals = [], maxIntervals = [];
  for (const item of datedActivities) {
    if (!item.fieldStart) return { min: null, max: null, status: "incomplete", basis: "union_of_calendar_occupancy_intervals" };
    const harvest = parseDate(item.activity.harvestDate);
    const duration = item.crop.duration_days;
    if (harvest && harvest >= item.fieldStart) {
      minIntervals.push([item.fieldStart, harvest]); maxIntervals.push([item.fieldStart, harvest]);
    } else if (duration && Number.isInteger(duration.min) && Number.isInteger(duration.max) && duration.min > 0 && duration.max >= duration.min) {
      minIntervals.push([item.fieldStart, addDays(item.fieldStart, duration.min - 1)]);
      maxIntervals.push([item.fieldStart, addDays(item.fieldStart, duration.max - 1)]);
    } else return { min: null, max: null, status: "incomplete", basis: "union_of_calendar_occupancy_intervals" };
  }
  return { min: mergedIntervalDays(minIntervals), max: mergedIntervalDays(maxIntervals), status: "duration_proxy", basis: "union_of_calendar_occupancy_intervals" };
}
function mergedIntervalDays(intervals) {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [start, end] of sorted) {
    const last = merged.at(-1);
    if (!last || start > addDays(last[1], 1)) merged.push([start, end]);
    else if (end > last[1]) last[1] = end;
  }
  return merged.reduce((sum, [start, end]) => sum + dayDifference(start, end) + 1, 0);
}
function mergeIntervals(intervals) {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [start, end] of sorted) {
    const last = merged.at(-1);
    if (!last || start > addDays(last[1], 1)) merged.push([start, end]);
    else if (end > last[1]) last[1] = end;
  }
  return merged;
}

function calculateRainOnUnoccupiedDays(activities, rainfall, cycle) {
  if (!cycle?.start || !cycle?.end || !activities.length || !rainfall.length) return null;
  const start = parseDate(cycle.start), end = parseDate(cycle.end);
  if (!start || !end || end < start) return null;
  const occupied = [];
  for (const item of activities) {
    const duration = item.crop.duration_days;
    if (!duration) return null;
    occupied.push([item.fieldStart, addDays(item.fieldStart, duration.max - 1)]);
  }
  let total = 0;
  for (const day of rainfall) {
    const date = parseDate(day.date), mm = Number(day.mm);
    if (!date || date < start || date > end || !Number.isFinite(mm) || mm < 0) continue;
    if (!occupied.some(([a, b]) => date >= a && date <= b)) total += mm;
  }
  return Math.round(total * 10) / 10;
}

function normalizeWeights(priorities) {
  const raw = Object.fromEntries(SCORE_KEYS.map(key => [key, Math.min(100, Math.max(0, Number(priorities[key]) || 0))]));
  const total = Object.values(raw).reduce((sum, value) => sum + value, 0);
  return total ? Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, value / total])) : raw;
}
function validScore(value) { return Number.isFinite(value) && value >= 0 && value <= 100; }
function shiftPlan(plan, days) {
  return { ...plan, activities: (plan.activities ?? []).map(activity => ({
    ...activity,
    plantingDate: addDays(parseDate(activity.plantingDate), days)?.toISOString().slice(0, 10) ?? activity.plantingDate,
    transplantDate: activity.transplantDate ? addDays(parseDate(activity.transplantDate), days)?.toISOString().slice(0, 10) : undefined
  })) };
}
function inMonthDayWindow(date, window) {
  const value = date.toISOString().slice(5, 10);
  return window.start <= window.end ? value >= window.start && value <= window.end : value >= window.start || value <= window.end;
}
function parseDate(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())) : null;
  if (typeof value !== "string" || !ISO_DATE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}
function dateForMonthDay(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}
function normaliseIsoDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value !== "string") return null;
  const date = value.includes("-") ? value : value.length === 8 ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : null;
  return parseDate(date) ? date : null;
}
function toFinite(value) { if (value === null || value === undefined || value === "") return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
function toFiniteNonnegative(value) { const number = toFinite(value); return number !== null && number >= 0 ? number : null; }
function numericRange(values, decimals = 1) { return values.length ? { min: round(values.reduce((a, b) => Math.min(a, b), Infinity), decimals), max: round(values.reduce((a, b) => Math.max(a, b), -Infinity), decimals) } : null; }
function round(value, decimals) { const scale = 10 ** decimals; return Math.round(value * scale) / scale; }
function addDays(date, days) { if (!date) return null; return new Date(date.getTime() + days * DAY_MS); }
function dayDifference(start, end) { return Math.round((end - start) / DAY_MS); }
function issue(type, code, message, activity = null, sourceId = null) { return { type, code, message, activityIndex: activity?.index ?? null, cropId: activity?.cropId ?? null, sourceId }; }
