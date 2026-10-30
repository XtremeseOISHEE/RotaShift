import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { farmerStatusLabel, farmerCalendarStatus, farmerProfileNeeds, translate, selectPriorityFocus, priorityFocusText } from "../src/farmer-ui.js";
import { evaluateRotation, compareRotations, calculateAdaptationMargin, DEFAULT_ANALYSIS_CYCLE } from "../src/rotation-engine.js";

const { crops } = JSON.parse(await readFile(new URL("../data/crops.json", import.meta.url), "utf8"));

test("English and Bangla controls and farmer result labels switch language", () => {
  assert.equal(translate("en", "modeFarmer"), "Farmer mode");
  assert.equal(translate("bn", "modeFarmer"), "কৃষক মোড");
  assert.equal(translate("bn", "irrigation"), "সেচ দিতে পারেন?");
  assert.equal(farmerStatusLabel("feasible", "bn"), "ক্যালেন্ডারের যাচাই মিলে গেছে");
  assert.equal(farmerStatusLabel("infeasible", "bn"), "রোপণ বা কাটার সময়ে সম্ভাব্য সংঘাত");
  assert.equal(farmerStatusLabel("incomplete", "bn"), "আরও তথ্য দরকার");
  assert.match(translate("en", "weatherCoverage"), /Crop periods/);
  assert.match(translate("bn", "weatherCoverage"), /আবহাওয়ার তথ্য/);
});

test("onboarding input gaps respond to the entered crop schedule", () => {
  assert.match(farmerProfileNeeds([], "bn")[0], /বর্তমানে কী চাষ করেন/);
  assert.match(farmerProfileNeeds([{ cropId: "boro_brri_dhan64" }], "bn")[0], /রোপণের তারিখ/);
  const noHarvest = farmerProfileNeeds([{ cropId: "boro_brri_dhan64", plantingDate: "2025-11-20" }], "en");
  assert.equal(noHarvest.length, 1);
  assert.match(noHarvest[0], /harvest dates/);
  assert.deepEqual(farmerProfileNeeds([{ cropId: "boro_brri_dhan64", plantingDate: "2025-11-20", harvestDate: "2026-04-20" }], "en"), []);
});

test("farmer-facing result changes when the entered date leaves its documented window", () => {
  const cropId = "boro_brri_dhan64";
  const base = { id: "farmer_current", activities: [{ cropId, plantingDate: "2025-11-20", transplantDate: "2025-12-26" }] };
  const passes = evaluateRotation(base, crops, { irrigationAccess: "reliable", landClass: "high" });
  const outside = evaluateRotation({ ...base, activities: [{ ...base.activities[0], plantingDate: "2025-10-10" }] }, crops, { irrigationAccess: "reliable", landClass: "high" });
  assert.notEqual(passes.status, "infeasible");
  assert.equal(outside.status, "infeasible");
  const passedCalendar = farmerCalendarStatus(passes, true);
  const failedCalendar = farmerCalendarStatus(outside, true);
  assert.equal(farmerStatusLabel(passedCalendar, "bn"), "ক্যালেন্ডারের যাচাই মিলে গেছে");
  assert.equal(farmerStatusLabel(failedCalendar, "bn"), "রোপণ বা কাটার সময়ে সম্ভাব্য সংঘাত");
});

test("farmer mode defaults on and retains a mobile layout breakpoint", async () => {
  const html = await readFile(new URL("../rotashift.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/farmer-mode.css", import.meta.url), "utf8");
  assert.match(html, /<body data-mode="farmer">/);
  assert.match(html, /id="farmerMode"/);
  assert.match(html, /id="evidenceMode"/);
  assert.match(html, /id="langBn"/);
  assert.match(html, /@media\s*\(max-width:\s*760px\)/);
  assert.match(html, /id="farmerRotations"/);
  assert.match(html, /id="farmerPriorityControls"/);
  assert.match(html, /id="themeToggle"/);
  assert.match(html, /\.\/src\/farmer-mode\.css/);
  assert.match(app, /langBn.*setLanguage\("bn"\)/);
  assert.match(app, /themeToggle.*toggleTheme/);
  assert.match(app, /rotashift-theme-v1/);
  assert.equal(translate("en", "themeDark"), "Dark mode");
  assert.equal(translate("bn", "themeLight"), "লাইট মোড");
  assert.match(app, /farmerMode.*setMode\("farmer"\)/);
  assert.match(app, /compareRotations\(plans,crops/);
  assert.match(app, /unoccupiedPeriodExposure:row\.unoccupiedPeriodExposure/);
  assert.match(app, /function bareExposureHtml/);
  assert.match(translate("en", "unoccupiedMeaning"), /does not confirm bare soil/);
  assert.match(translate("bn", "infoStillNeeded"), /জমিতে ব্যবহারের আগে/);
  assert.match(translate("en", "cycleHint"), /not an official Bangladesh crop-year definition/);
  assert.match(translate("bn", "cycleHint"), /সরকারি ফসলি বছরের সংজ্ঞা নয়/);
  assert.match(app, /weatherCoverage/);
  assert.match(app, /setLanguage\("bn"\)/);
  assert.match(css, /\.farmer-summary/);
  assert.match(css, /min-height:48px/);
  assert.match(app, /renderPriorityFocus/);
  const method = await readFile(new URL("../docs/climate-period-indicators.md", import.meta.url), "utf8");
  assert.match(method, /excludes incomplete period\/parameter windows/);
  assert.match(method, /not a climate trend/);
  assert.match(css, /body\[data-mode="evidence"\] \.farmer-only/);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, "HTML ids must be unique for the interactive controls");
});

test("priorities highlight relevant evidence without changing ranking or scenario order", async () => {
  assert.deepEqual(selectPriorityFocus({water:100,soil:50,risk:25,yield:10,cost:0}),["water"]);
  assert.deepEqual(selectPriorityFocus({water:60,soil:60,risk:10,yield:10,cost:0}),["water","soil"]);
  assert.deepEqual(selectPriorityFocus({water:50,soil:50,risk:50,yield:50,cost:50}),[]);
  assert.match(priorityFocusText("water","bn"),/সেচের নির্ভরতা/);
  const refs=JSON.parse(await readFile(new URL("../data/reference-rotations.json",import.meta.url),"utf8")).example_schedules;
  const plans=[
    {id:"farmer",role:"farmer_entered",activities:[{cropId:"boro_brri_dhan64",plantingDate:"2025-11-20",transplantDate:"2025-12-26",harvestDate:"2026-05-20"},{cropId:"aman_brri_dhan66",plantingDate:"2026-07-10",transplantDate:"2026-08-01",harvestDate:"2026-11-20"}]},
    ...refs.filter(plan=>["reference_boro_fallow_aman_example","reference_mustard_boro_aman_example"].includes(plan.id)).map((plan,index)=>({...plan,id:`reference-${index}`,role:"illustrative_reference"}))
  ];
  const climate={dailyRainfall:[],dailyTemperature:[],temperature:null};
  const compare=compareRotations(plans,crops,{landClass:"high",irrigationAccess:"limited"},climate,DEFAULT_ANALYSIS_CYCLE);
  assert.deepEqual(compare.rows.map(row=>row.role),["farmer_entered","illustrative_reference","illustrative_reference"]);
  assert.ok(compare.rows.every(row=>row.result.score===null));
  assert.ok(compare.rows.every(row=>row.unoccupiedPeriodExposure.status!=="descriptive_history_available"));
  const margin=calculateAdaptationMargin(plans[0],crops,{landClass:"high",irrigationAccess:"limited"},climate);
  assert.ok(Number.isFinite(margin.earlierDays));
  assert.ok(Number.isFinite(margin.laterDays));
  assert.equal(compare.rankingStatus,"not_ranked_insufficient_comparable_outcome_evidence");
});
