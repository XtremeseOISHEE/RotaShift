# Barind crop rotation evidence and feasibility model

## What the sources support

No farmer has supplied a verified current rotation in this project snapshot. The comparison therefore uses a **regional reference baseline**, not an asserted existing farm practice: **Boro → fallow → transplanted Aman**. BRRI lists this pattern in the dhan66 profile. BRRI also lists **fallow → fallow → transplanted Aman** and **mustard → Boro → transplanted Aman**. Those pattern listings establish that the sequences are referenced by BRRI; they do not establish district-level adoption, a suitable field, exact dates, yield advantage, or feasibility under every calendar.

The dated examples in `data/reference-rotations.json` are demonstrations based on source windows. They are not a recommendation and must not be described as farmer-validated schedules.

## Crop evidence

| Crop | Sowing / transplant window | Field occupancy / harvest | Land suitability | Water | Rotation benefits or risks supported by evidence |
|---|---|---|---|---|---|
| Boro rice, BRRI dhan64 | Seedbed sowing 15–29 Nov; transplanting 20 Dec–10 Jan; 35–40 day seedlings | BRRI lists 152-day life span; BAMIS Rajshahi regional Boro calendar reports 150–155 days. Use transplant date as field-entry event; life span is a duration proxy, not a recorded harvest date. | BRRI lists high and medium-high land. Require farmer field class; regional Barind soil context is not a parcel assessment. | BRRI labels it irrigation-dependent. BAMIS provides regional “normal phase-wise water requirement” entries of 76, 120, 190, 145 and 100 mm. These are documented as regional reference values but are not matched to dhan64, field soil, effective rainfall, or available irrigation. The engine does not use them as a water pass/fail or score. | Part of BRRI-listed Boro–fallow–Aman and mustard–Boro–Aman patterns. Irrigation dependence is a material feasibility check; no yield or soil benefit is inferred here. |
| Transplanted Aman rice, BRRI dhan66 | Seedbed sowing 5–14 Jul; transplanting 25 Jul–10 Aug; seedlings 20–25 days | BRRI lists 115-day life span. Use transplant date for field entry; life span is a duration proxy until farmer harvest date is entered. | BRRI lists high and medium-high land. | Rainfed with supplemental irrigation if rainfall is insufficient; no field water balance is available. | BRRI lists it in the referenced patterns. Its drought-tolerance statement is a cultivar trait, not proof that a schedule avoids drought stress. |
| Mustard, Rajshahi regional calendar (cultivar unspecified) | Rajshahi BAMIS calendar provides November–February seasonal context, not a precise sowing date. A separate dated Rangpur-district BAMIS advisory gives mid-Oct–mid-Nov advice; that window is **not** treated as a Rajshahi hard constraint. | BAMIS Rajshahi regional calendar says 80–100 days. Treat this range as a screening proxy; actual harvest date/cultivar is needed to resolve a close transition. | Not established for the entered field by the sources currently cataloged. | BAMIS agromet advisories describe irrigation timing around 20–25 and 50–55 days after sowing; these are advisories, not measured field-specific seasonal water volume. | BRRI lists mustard–Boro–Aman as a pattern. The sequence has an occupancy risk: a succeeding Boro transplant can be scheduled before mustard harvest. No yield, profitability, or soil improvement is inferred. |

## Mustard–Boro same-field conflict

The engine distinguishes rice seedbed sowing from main-field occupancy. For Boro and transplanted Aman, it uses the transplant date as field entry; for mustard, the sowing date is the current occupancy proxy because no separate transplant step is represented. If the farmer supplies a crop's actual `harvestDate`, the engine checks that date directly.

In the illustrative schedule, mustard is sown 15 October 2025 and Boro is transplanted 8 January 2026: the interval is 85 days. BAMIS's Rajshahi calendar duration range is 80–100 days, so overlap is **possible**, not a proven conflict or a pass. The engine leaves it unresolved and asks for actual mustard harvest/cultivar information. No Rangpur sowing advice is applied as a Rajshahi planting-window rule.

In the rejected example, mustard starts 15 October and Boro enters the field 20 December: 66 days. That is earlier than the sourced 80-day minimum, so the one-field sequence is **infeasible under those dates** and the engine reports the field-occupancy conflict. This does not mean the BRRI-listed pattern is categorically invalid; it means that particular dated schedule cannot fit the source duration proxy without changing the schedule, field, or crop evidence.

## Reference baseline and alternatives

1. **Regional reference baseline: Boro → fallow → transplanted Aman.** Listed by BRRI. The example dates fit the cataloged variety windows and are not farmer-confirmed. Boro irrigation supply and field land class remain required; actual harvest dates should replace duration proxies.
2. **Alternative: fallow → fallow → transplanted Aman.** Listed by BRRI. It has no preceding crop whose occupancy needs checking in the one-year example. It is a lower-cropping-intensity reference sequence by construction; this is not evidence of better soil, water, yield, or profit.
3. **Alternative: mustard → Boro → transplanted Aman.** Listed by BRRI and supported by BAMIS regional mustard context. It is only calendar-compatible if actual crop timing permits non-overlap. The illustrative schedule is unresolved; the tighter example is rejected as overlapping.

These options are not ranked. The comparison can show source-window checks, field-occupancy conflicts, categorical water dependence, and evidence gaps. It cannot compare economic or agronomic outcomes with the current evidence.

## Implemented constraint semantics

- Sowing and transplant windows are checked against their source-linked month/day bounds.
- Seedling-age bounds and explicit irrigation dependence remain checks.
- Main-field occupancy starts at the crop-specific event in `data/crops.json`; rice nursery sowing is not mistaken for rice field entry.
- A sourced minimum duration longer than the interval to the next field entry is a hard overlap failure. An interval inside the duration range is an unresolved possible overlap. A farmer-supplied harvest date resolves this check for that crop.
- Missing field class, water volume, crop-stage hazard thresholds, yields, costs, and soil outcomes remain missing/unresolved. No score or recommendation is generated.
- The side-by-side engine API returns each plan's status and reasons without assigning rank.
- The soil-cover screen reports the union of source-duration-based field-occupancy intervals (overlap days counted once), not observed canopy/ground cover. Legume presence is only a potential indicator; erosion and organic-matter outcomes stay unresolved without field and residue evidence.
- The NASA POWER crop-period analogue summaries are descriptive regional weather context. Calculation, missing-value handling, and interpretation limits are documented in `docs/climate-period-indicators.md`; they do not become hazard constraints or alter calendar-only Adaptation Margin.

## Direct sources

- BRRI dhan66 variety profile and listed cropping patterns: <https://riceprofile.brri.gov.bd/varieties/75>
- BRRI dhan64 variety profile: <https://riceprofile.brri.gov.bd/varieties/73>
- BAMIS Rajshahi-region Boro crop weather calendar: <https://www.bamis.gov.bd/res/calendars/2019/08/23/5105.pdf>
- BAMIS's Boro water figures remain a regional reference only; field water sufficiency still requires crop-stage demand, effective rainfall, soil storage and reliable irrigation supply.
- BAMIS Rajshahi-region mustard weather calendar: <https://www.bamis.gov.bd/res/public/calendars/2019/12/30/10986.pdf>
- BAMIS dated Rangpur-district mustard sowing advisory (context only): <https://www.bamis.gov.bd/res/bulletins/2020/10/15/22451.pdf>
- BAMIS mustard irrigation timing advisory: <https://www.bamis.gov.bd/res/bulletins/2020/01/25/12463.pdf>
