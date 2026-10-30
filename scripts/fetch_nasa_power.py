#!/usr/bin/env python3
"""Fetch and validate reproducible NASA POWER daily climate data for RotaShift.

The default output is a new temperature/climate file. It never overwrites the
verified rainfall input. Missing and POWER fill values are preserved as nulls.
"""
from __future__ import annotations

import argparse
import json
import math
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
API = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMETERS = {"PRECTOTCORR": "mm/day", "T2M_MAX": "C", "T2M_MIN": "C"}
LATITUDE, LONGITUDE = 24.37, 88.60


def request_url(start: str, end: str) -> str:
    query = urlencode({"parameters": ",".join(PARAMETERS), "community": "AG",
                       "longitude": LONGITUDE, "latitude": LATITUDE,
                       "start": start, "end": end, "format": "JSON",
                       "time-standard": "UTC"})
    return f"{API}?{query}"


def expected_days(start: str, end: str) -> list[str]:
    first = date.fromisoformat(f"{start[:4]}-{start[4:6]}-{start[6:]}")
    last = date.fromisoformat(f"{end[:4]}-{end[4:6]}-{end[6:]}")
    if last < first:
        raise ValueError("end date precedes start date")
    result = []
    current = first
    while current <= last:
        result.append(current.strftime("%Y%m%d"))
        current += timedelta(days=1)
    return result


def validate_response(payload: dict, expected_start: str | None = None,
                      expected_end: str | None = None) -> dict:
    """Validate metadata and aligned daily series; convert POWER fill values to null."""
    header = payload.get("header", {})
    params = payload.get("parameters", {})
    series = payload.get("properties", {}).get("parameter", {})
    start, end = header.get("start"), header.get("end")
    if not start or not end:
        raise ValueError("NASA POWER header must include start and end dates")
    if expected_start and start != expected_start:
        raise ValueError(f"start date mismatch: expected {expected_start}, received {start}")
    if expected_end and end != expected_end:
        raise ValueError(f"end date mismatch: expected {expected_end}, received {end}")
    if header.get("time_standard") != "UTC":
        raise ValueError("NASA POWER response must use UTC")
    coords = payload.get("geometry", {}).get("coordinates", [])
    if len(coords) < 2 or not math.isclose(float(coords[0]), LONGITUDE, abs_tol=0.02) or not math.isclose(float(coords[1]), LATITUDE, abs_tol=0.02):
        raise ValueError(f"response coordinates do not match Barind point ({LONGITUDE}, {LATITUDE})")

    days = expected_days(start, end)
    fill = float(header.get("fill_value", -999))
    report = {"source": "NASA POWER Daily API", "api_url": payload.get("rotashift_request_url"),
              "coordinates": {"latitude": float(coords[1]), "longitude": float(coords[0]),
                              "elevation_m": float(coords[2]) if len(coords) > 2 else None},
              "start": start, "end": end, "time_standard": "UTC",
              "sources": header.get("sources", []), "fill_value": fill,
              "parameters": {}, "date_count_expected": len(days)}
    for name, unit in PARAMETERS.items():
        values = series.get(name)
        if not isinstance(values, dict):
            raise ValueError(f"required parameter missing: {name}")
        declared = params.get(name, {}).get("units")
        if declared != unit:
            raise ValueError(f"{name} units mismatch: expected {unit}, received {declared}")
        missing_dates = [day for day in days if day not in values]
        extra_dates = [day for day in values if day not in set(days)]
        if missing_dates or extra_dates:
            raise ValueError(f"{name} date keys mismatch: {len(missing_dates)} missing, {len(extra_dates)} extra")
        fill_count = 0
        invalid_count = 0
        clean = {}
        for day in days:
            value = values[day]
            if value is None or (isinstance(value, (int, float)) and float(value) == fill):
                clean[day] = None
                fill_count += 1
                continue
            try:
                number = float(value)
            except (TypeError, ValueError):
                clean[day] = None
                invalid_count += 1
                continue
            if not math.isfinite(number):
                clean[day] = None
                invalid_count += 1
                continue
            clean[day] = number
        series[name] = clean
        valid_values = [value for value in clean.values() if value is not None]
        report["parameters"][name] = {"unit": declared, "valid_count": len(valid_values),
            "fill_or_missing_count": fill_count, "invalid_count": invalid_count,
            "missing_date_count": 0, "minimum": min(valid_values) if valid_values else None,
            "maximum": max(valid_values) if valid_values else None}
    if "MERRA2" not in header.get("sources", []):
        raise ValueError("expected MERRA2 source is not listed in the NASA POWER header")
    report["missing_value_handling"] = "POWER fill values (-999), explicit nulls, and non-finite/invalid values are retained as null; no imputation. Counts are recorded per parameter."
    return report


def fetch(start: str, end: str, timeout: int = 90) -> dict:
    url = request_url(start, end)
    request = Request(url, headers={"User-Agent": "RotaShift-data-validation/1.0"})
    with urlopen(request, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))
    payload["rotashift_request_url"] = url
    payload["rotashift_validation"] = validate_response(payload, start, end)
    return payload


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", default="19980101", help="YYYYMMDD (default: 19980101)")
    parser.add_argument("--end", default="20251231", help="YYYYMMDD (default: 20251231)")
    parser.add_argument("--output", type=Path, default=ROOT / "data" / "nasa-power-climate.json")
    parser.add_argument("--validate", type=Path, help="Validate a saved NASA POWER JSON response without downloading")
    args = parser.parse_args()
    if args.validate:
        payload = json.loads(args.validate.read_text(encoding="utf-8"))
        payload["rotashift_validation"] = validate_response(payload)
    else:
        payload = fetch(args.start, args.end)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(json.dumps(payload["rotashift_validation"], indent=2))
    print(f"Saved validated response to {args.output}")


if __name__ == "__main__":
    main()
