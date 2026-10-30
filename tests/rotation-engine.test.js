import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { evaluateRotation, calculateAdaptationMargin, rankRotations, compareRotations, calculateRotationClimateExposure, calculateRotationBarePeriodExposure, DEFAULT_ANALYSIS_CYCLE } from "../src/rotation-engine.js";

const catalog = JSON.parse(await readFile(new URL("../data/crops.json", import.meta.url), "utf8")).crops;
const referenceExamples = JSON.parse(await readFile(new URL("../data/reference-rotations.json", import.meta.url), "utf8")).example_schedules;
const boroAman = {id:"ba",name:"Boro-Aman",activities:[
  {cropId:"boro_brri_dhan64",plantingDate:"2025-11-20",transplantDate:"2025-12-26"},
  {cropId:"aman_brri_dhan66",plantingDate:"2026-07-10",transplantDate:"2026-08-01"}
]};
const field = {landClass:"high",irrigationAccess:"reliable"};
const rainfallFile = JSON.parse(await readFile(new URL("../data/nasa-power-precip.json", import.meta.url), "utf8"));
const climateFile = JSON.parse(await readFile(new URL("../data/nasa-power-climate.json", import.meta.url), "utf8"));
const dailyRainfall = Object.entries(rainfallFile.properties.parameter.PRECTOTCORR).map(([date,mm])=>({date:`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`,mm}));
const dailyTemperature = Object.entries(climateFile.properties.parameter.T2M_MAX).map(([date,max])=>({date:`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`,max,min:climateFile.properties.parameter.T2M_MIN[date]}));

test("valid calendar schedule passes documented windows but stays incomplete on unknown evidence", () => {
  const result = evaluateRotation(boroAman,catalog,field,{});
  assert.equal(result.status,"incomplete");
  assert.equal(result.failures.some(x=>x.code==="outside_sowing_window"),false);
  assert.ok(result.evidence.some(x=>x.code==="inside_sowing_window"));
  assert.ok(result.unresolved.some(x=>x.code==="water_volume_unknown"));
  assert.equal(result.score,null);
});

test("calendar feasibility reports the precise out-of-window constraint", () => {
  const shifted={...boroAman,activities:boroAman.activities.map(a=>({...a,plantingDate:a.plantingDate==="2026-07-10"?"2026-07-16":a.plantingDate,transplantDate:a.transplantDate==="2026-08-01"?"2026-08-07":a.transplantDate}))};
  const result=evaluateRotation(shifted,catalog,field,{});
  assert.equal(result.status,"infeasible");
  assert.ok(result.failures.some(x=>x.code==="outside_sowing_window"&&x.message.includes("2026-07-16")&&x.sourceId==="brri_dhan66"));
});

test("adaptation margins return independent first failures and exact source-backed conditions", () => {
  const margin=calculateAdaptationMargin(boroAman,catalog,field,{});
  assert.equal(margin.status,"calendar_only_partial");
  assert.ok(margin.earlierDays>=0&&margin.laterDays>=0);
  assert.equal(margin.earlierFailureAtDays,margin.earlierDays+1);
  assert.equal(margin.laterFailureAtDays,margin.laterDays+1);
  assert.ok(margin.earlierFailure.message);
  assert.ok(margin.laterFailure.message);
  assert.equal(margin.earlierFailure.sourceId,"brri_dhan64");
  assert.equal(margin.laterFailure.sourceId,"brri_dhan66");
});

test("mustard-Boro schedule exposes a possible duration overlap, not a fabricated pass", () => {
  const plan={id:"mba",activities:[
    {cropId:"mustard_rajshahi_generic",plantingDate:"2025-10-15"},
    {cropId:"boro_brri_dhan64",plantingDate:"2025-11-29",transplantDate:"2026-01-08"},
    {cropId:"aman_brri_dhan66",plantingDate:"2026-07-10",transplantDate:"2026-08-01"}
  ]};
  const result=evaluateRotation(plan,catalog,field,{});
  assert.ok(result.unresolved.some(x=>x.code==="field_occupancy_overlap_uncertain"));
  assert.equal(result.score,null);
});

test("irrigation and unknown catalog information remain distinct", () => {
  const none=evaluateRotation(boroAman,catalog,{landClass:"high",irrigationAccess:"none"},{});
  assert.ok(none.failures.some(x=>x.code==="irrigation_unavailable"));
  const unknown=evaluateRotation(boroAman,catalog,{landClass:"high",irrigationAccess:"unknown"},{});
  assert.ok(unknown.unresolved.some(x=>x.code==="irrigation_access_unknown"));
});

test("priority sliders cannot create scores when evidence scores are absent", () => {
  const ranked=rankRotations([boroAman],catalog,{priorities:{yield:100,water:50}},{});
  assert.equal(ranked.ranked[0].score,null);
  assert.equal(ranked.ranked[0].scoreStatus,"partial_missing_inputs");
  assert.deepEqual(ranked.ranked[0].missingScoreInputs,["yield","risk","soil","water","cost"]);
});

test("mustard and Boro dates that force same-field overlap are infeasible", () => {
  const plan={id:"mba-definite",activities:[
    {cropId:"mustard_rajshahi_generic",plantingDate:"2025-10-15"},
    {cropId:"boro_brri_dhan64",plantingDate:"2025-11-20",transplantDate:"2025-12-20"},
    {cropId:"aman_brri_dhan66",plantingDate:"2026-07-10",transplantDate:"2026-08-01"}
  ]};
  const result=evaluateRotation(plan,catalog,field,{});
  assert.equal(result.status,"infeasible");
  assert.ok(result.failures.some(x=>x.code==="field_occupancy_conflict"&&x.message.includes("66 days")));
});

test("actual harvest date resolves a duration-range overlap with an explicit conflict", () => {
  const plan={id:"mba-harvest",activities:[
    {cropId:"mustard_rajshahi_generic",plantingDate:"2025-10-15",harvestDate:"2026-01-20"},
    {cropId:"boro_brri_dhan64",plantingDate:"2025-11-29",transplantDate:"2026-01-08"},
    {cropId:"aman_brri_dhan66",plantingDate:"2026-07-10",transplantDate:"2026-08-01"}
  ]};
  const result=evaluateRotation(plan,catalog,field,{});
  assert.ok(result.failures.some(x=>x.code==="field_occupancy_conflict"&&x.message.includes("harvest on 2026-01-20")));
});

test("missing field-entry dates stay unresolved rather than using nursery sowing as occupancy", () => {
  const plan={...boroAman,activities:boroAman.activities.map((a,i)=>i===0?{...a,transplantDate:""}:a)};
  const result=evaluateRotation(plan,catalog,field,{});
  assert.ok(result.unresolved.some(x=>x.code==="field_occupancy_start_missing"));
  assert.ok(result.unresolved.some(x=>x.code==="transplant_date_missing"));
});

test("compareRotations returns side-by-side outcomes and withholds ranking", () => {
  const mustard={id:"mba",name:"Mustard-Boro-Aman",activities:[
    {cropId:"mustard_rajshahi_generic",plantingDate:"2025-10-15"},
    {cropId:"boro_brri_dhan64",plantingDate:"2025-11-29",transplantDate:"2026-01-08"},
    {cropId:"aman_brri_dhan66",plantingDate:"2026-07-10",transplantDate:"2026-08-01"}
  ]};
  const result=compareRotations([boroAman,mustard],catalog,field,{});
  assert.equal(result.rows.length,2);
  assert.equal(result.rows[1].result.status,"incomplete");
  assert.equal(result.rows[1].result.score,null);
  assert.ok(result.rows[1].result.unresolved.some(x=>x.code==="sowing_window_not_locally_applicable"));
  assert.equal(result.rankingStatus,"not_ranked_insufficient_comparable_outcome_evidence");
});

test("active frontend imports and calls compareRotations and loads reference schedules", async () => {
  const app=await readFile(new URL("../src/app.js",import.meta.url),"utf8");
  assert.match(app,/import\s*\{[^}]*compareRotations[^}]*\}\s*from\s*"\.\/rotation-engine\.js"/);
  assert.match(app,/compareRotations\(plans,crops,context\.field,context\.climate,DEFAULT_ANALYSIS_CYCLE\)/);
  assert.match(app,/\.\/data\/reference-rotations\.json/);
  assert.match(app,/dataset\.comparisonEngine="compareRotations"/);
});

test("bundled reference rotation examples evaluate through the same evidence engine", () => {
  const baseline=referenceExamples.find(p=>p.id==="reference_boro_fallow_aman_example");
  const mustard=referenceExamples.find(p=>p.id==="reference_mustard_boro_aman_example");
  const rejected=referenceExamples.find(p=>p.id==="mustard_boro_definite_overlap_example");
  assert.ok(baseline&&mustard&&rejected);
  const comparison=compareRotations([baseline,mustard,rejected],catalog,field,{});
  assert.equal(comparison.rows[0].result.status,"incomplete");
  assert.ok(comparison.rows[1].result.unresolved.some(x=>x.code==="field_occupancy_overlap_uncertain"));
  assert.ok(comparison.rows[1].result.unresolved.some(x=>x.code==="sowing_window_not_locally_applicable"));
  assert.equal(comparison.rows[2].result.status,"infeasible");
  assert.ok(comparison.rows.every(x=>x.result.score===null));
});

test("NASA POWER crop-period exposure uses complete calendar analogues and source duration bounds", () => {
  const exposure=calculateRotationClimateExposure(boroAman,catalog,{dailyRainfall,dailyTemperature});
  assert.equal(exposure.length,2);
  const boro=exposure[0];
  assert.equal(boro.status,"descriptive_history_available");
  assert.deepEqual(boro.durationDays,{min:152,max:152,basis:"source_duration_proxy"});
  assert.ok(boro.rainfall.observedRange.min>=0);
  assert.ok(boro.rainfall.observedRange.max>boro.rainfall.observedRange.min);
  assert.ok(boro.meanDailyTmax.observedRange.min>0);
  assert.ok(boro.meanDailyTmin.observedRange.max<50);
  assert.ok(boro.rainfall.completeAnalogueYears>=20);
  assert.equal(boro.periodLengthsEvaluated,1);
  assert.match(boro.interpretation,/Not a forecast/);
});

test("crop-period exposure crosses calendar years and includes leap days in inclusive windows", () => {
  const crossPlan={id:"cross-year",activities:[{cropId:"boro_brri_dhan64",plantingDate:"2020-12-10",transplantDate:"2020-12-30",harvestDate:"2021-01-02"}]};
  const crossRain=[];
  for(const [date,mm] of [["2019-12-30",1],["2019-12-31",2],["2020-01-01",3],["2020-01-02",4],["2020-12-30",5],["2020-12-31",6],["2021-01-01",7],["2021-01-02",8]])crossRain.push({date,mm});
  const [cross]=calculateRotationClimateExposure(crossPlan,catalog,{dailyRainfall:crossRain});
  assert.equal(cross.durationDays.min,4);
  assert.deepEqual(cross.rainfall.observedRange,{min:10,max:26});
  assert.equal(cross.rainfall.completeAnalogueYears,2);

  const leapPlan={id:"leap",activities:[{cropId:"mustard_rajshahi_generic",plantingDate:"2020-02-28",harvestDate:"2020-03-01"}]};
  const leapRain=[
    {date:"2019-02-28",mm:1},{date:"2019-03-01",mm:2},{date:"2019-03-02",mm:4},
    {date:"2020-02-28",mm:1},{date:"2020-02-29",mm:2},{date:"2020-03-01",mm:3}
  ];
  const [leap]=calculateRotationClimateExposure(leapPlan,catalog,{dailyRainfall:leapRain});
  assert.equal(leap.durationDays.min,3);
  assert.deepEqual(leap.rainfall.observedRange,{min:6,max:7});
});

test("all integer crop-duration values are evaluated so interior temperature ranges are retained", () => {
  const plan={id:"duration-range",activities:[{cropId:"mustard_rajshahi_generic",plantingDate:"2022-01-01"}]};
  const dailyRainfall=[],dailyTemperature=[];
  for(let offset=0;offset<110;offset++){
    const date=new Date(Date.UTC(2022,0,1+offset)).toISOString().slice(0,10);
    dailyRainfall.push({date,mm:1});
    dailyTemperature.push({date,max:offset===89?40:0,min:10});
  }
  const [exposure]=calculateRotationClimateExposure(plan,catalog,{dailyRainfall,dailyTemperature});
  assert.equal(exposure.periodLengthsEvaluated,21);
  assert.deepEqual(exposure.rainfall.observedRange,{min:80,max:100});
  assert.ok(exposure.meanDailyTmax.observedRange.max>0.4);
});

function syntheticYearlyRainfall(years){
  const rows=[];
  for(const year of years)for(let date=new Date(Date.UTC(year,0,1));date.getUTCFullYear()===year;date.setUTCDate(date.getUTCDate()+1)){
    const key=date.toISOString().slice(0,10),md=key.slice(5),day=date.getUTCDate();
    const mm=md.startsWith("01-")&&day<=4?1:md.startsWith("01-")&&day>=15&&day<=24?2:md>="01-05"&&md<="02-03"?100:0;
    rows.push({date:key,mm});
  }
  return rows;
}

test("shared 12-month cycle includes unoccupied time before, between, and after crops", () => {
  const plan={id:"unoccupied",activities:[
    {cropId:"boro_brri_dhan64",plantingDate:"2020-01-01",transplantDate:"2020-01-05",harvestDate:"2020-01-14"},
    {cropId:"aman_brri_dhan66",plantingDate:"2020-01-20",transplantDate:"2020-01-25",harvestDate:"2020-02-03"}
  ]};
  const cycle={id:"test_calendar_year",start:"2020-01-01",end:"2020-12-31",months:12};
  const exposure=calculateRotationBarePeriodExposure(plan,catalog,{dailyRainfall:syntheticYearlyRainfall([2019,2020,2021])},cycle);
  assert.equal(exposure.status,"descriptive_history_available");
  assert.deepEqual(exposure.unoccupiedDays,{min:345,max:346}); // leap cycle has one additional unoccupied day
  assert.deepEqual(exposure.unoccupiedIntervals,{min:3,max:3});
  assert.deepEqual(exposure.rainfall.observedRange,{min:24,max:24}); // 4 mm before, 20 mm between; none after
  assert.deepEqual(exposure.wetDays.observedRange,{min:14,max:14});
  assert.equal(exposure.completeAnalogueYears,3);
  assert.match(exposure.interpretation,/Unoccupied does not mean confirmed bare soil/);
  assert.deepEqual(exposure.analysisCycle,{start:cycle.start,end:cycle.end,months:12});
});

test("overlapping crop occupancy is unioned once and missing dates exclude the whole shared cycle", () => {
  const plan={id:"overlap",activities:[
    {cropId:"boro_brri_dhan64",plantingDate:"2020-01-01",transplantDate:"2020-01-05",harvestDate:"2020-01-20"},
    {cropId:"aman_brri_dhan66",plantingDate:"2020-01-10",transplantDate:"2020-01-15",harvestDate:"2020-02-03"}
  ]};
  const cycle={id:"test_calendar_year",start:"2020-01-01",end:"2020-12-31",months:12};
  const dailyRainfall=syntheticYearlyRainfall([2019,2020,2021]);
  const exposure=calculateRotationBarePeriodExposure(plan,catalog,{dailyRainfall},cycle);
  assert.deepEqual(exposure.unoccupiedDays,{min:335,max:336}); // union Jan 5-Feb 3 is 30 days
  const missing=dailyRainfall.filter(row=>row.date!=="2020-03-01");
  const incomplete=calculateRotationBarePeriodExposure(plan,catalog,{dailyRainfall:missing},cycle);
  assert.equal(incomplete.completeAnalogueYears,2);
  assert.equal(incomplete.partialScenarioWindows,1);
});

test("side-by-side rotation comparison uses the shared cycle and withholds ranking", () => {
  const plans=[boroAman,
    {id:"mba",name:"Mustard-Boro-Aman",activities:[
      {cropId:"mustard_rajshahi_generic",plantingDate:"2025-10-15",harvestDate:"2026-01-05"},
      {cropId:"boro_brri_dhan64",plantingDate:"2025-11-29",transplantDate:"2026-01-08"},
      {cropId:"aman_brri_dhan66",plantingDate:"2026-07-10",transplantDate:"2026-08-01"}
    ]},
    {id:"farmer",name:"Farmer schedule",activities:boroAman.activities.map(a=>({...a,harvestDate:a.cropId==="boro_brri_dhan64"?"2026-05-27":"2026-11-23"}))}
  ];
  const result=compareRotations(plans,catalog,field,{dailyRainfall,dailyTemperature});
  assert.equal(result.rows.length,3);
  assert.ok(result.rows.every(row=>Array.isArray(row.climateExposure)));
  assert.ok(result.rows.every(row=>"status" in row.unoccupiedPeriodExposure));
  assert.ok(result.rows.every(row=>JSON.stringify(row.unoccupiedPeriodExposure.analysisCycle)===JSON.stringify({start:DEFAULT_ANALYSIS_CYCLE.start,end:DEFAULT_ANALYSIS_CYCLE.end,months:12})));
  assert.ok(result.rows.every(row=>row.climateExposure.every(period=>period.durationDays.min<=period.durationDays.max&&"mm/window"===period.rainfall.unit)));
  assert.ok(result.rows.every(row=>row.climateExposure.every(period=>"days/window; days with PRECTOTCORR > 0"===period.rainyDays.unit)));
  assert.equal(result.rankingStatus,"not_ranked_insufficient_comparable_outcome_evidence");
});

test("farmer harvest date defines an inclusive crop period and invalid dates stay unresolved", () => {
  const plan={id:"harvest",activities:[{cropId:"boro_brri_dhan64",plantingDate:"2025-11-20",transplantDate:"2025-12-26",harvestDate:"2026-04-25"}]};
  const [exposure]=calculateRotationClimateExposure(plan,catalog,{dailyRainfall,dailyTemperature});
  assert.equal(exposure.durationDays.min,121);
  assert.equal(exposure.durationDays.max,121);
  assert.equal(exposure.durationDays.basis,"farmer_reported_harvest");
  const [invalid]=calculateRotationClimateExposure({...plan,activities:[{...plan.activities[0],harvestDate:"2025-12-20"}]},catalog,{dailyRainfall,dailyTemperature});
  assert.equal(invalid.status,"insufficient_inputs");
});

test("missing daily values are excluded rather than imputed in crop-period summaries", () => {
  const plan={id:"tiny",activities:[{cropId:"mustard_rajshahi_generic",plantingDate:"2024-01-01",harvestDate:"2024-01-03"}]};
  const exposure=calculateRotationClimateExposure(plan,catalog,{
    dailyRainfall:[{date:"2023-01-01",mm:1},{date:"2023-01-02",mm:null},{date:"2023-01-03",mm:3}],
    dailyTemperature:[{date:"2023-01-01",max:20,min:10},{date:"2023-01-02",max:null,min:11},{date:"2023-01-03",max:22,min:12}]
  })[0];
  assert.equal(exposure.status,"no_complete_historical_window");
  assert.equal(exposure.rainfall.observedRange,null);
  assert.equal(exposure.meanDailyTmax.observedRange,null);
  assert.equal(exposure.rainfall.partialWindowsExcluded,1);
  assert.equal(exposure.meanDailyTmax.partialWindowsExcluded,1);

  const ranged={id:"duration-missing",activities:[{cropId:"mustard_rajshahi_generic",plantingDate:"2022-01-01"}]};
  const rain=[],temp=[];
  for(let offset=0;offset<105;offset++){
    const date=new Date(Date.UTC(2022,0,1+offset)).toISOString().slice(0,10);
    if(offset!==94)rain.push({date,mm:1});
    temp.push({date,max:20,min:10});
  }
  const [rangedExposure]=calculateRotationClimateExposure(ranged,catalog,{dailyRainfall:rain,dailyTemperature:temp});
  assert.equal(rangedExposure.rainfall.completeAnalogueYears,0);
  assert.equal(rangedExposure.rainfall.observedRange,null);
  assert.equal(rangedExposure.meanDailyTmax.completeAnalogueYears,1);
});

test("soil occupancy proxy merges overlapping crop intervals rather than double counting them", () => {
  const plan={id:"union",activities:[
    {cropId:"boro_brri_dhan64",plantingDate:"2025-11-20",transplantDate:"2025-12-26",harvestDate:"2026-03-01"},
    {cropId:"aman_brri_dhan66",plantingDate:"2026-07-10",transplantDate:"2026-02-15",harvestDate:"2026-04-15"}
  ]};
  const screen=evaluateRotation(plan,catalog,field,{}).soilScreen.soilCoverPotential;
  const expected=Math.round((Date.parse("2026-04-15T00:00:00Z")-Date.parse("2025-12-26T00:00:00Z"))/86_400_000)+1;
  assert.equal(screen.min,expected);
  assert.equal(screen.max,expected);
  assert.equal(screen.basis,"union_of_calendar_occupancy_intervals");
  assert.match(screen.caveat,/does not measure canopy or ground cover/);
});
