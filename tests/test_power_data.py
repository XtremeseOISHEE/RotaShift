import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from fetch_nasa_power import PARAMETERS, validate_response  # noqa: E402


def payload():
    days = ["20250101", "20250102", "20250103"]
    values = {key: {day: [1.2, -999, 3.4][i] for i, day in enumerate(days)} for key in PARAMETERS}
    return {"geometry": {"coordinates": [88.6, 24.37, 19.46]},
            "header": {"start": days[0], "end": days[-1], "time_standard": "UTC", "sources": ["MERRA2", "POWER"], "fill_value": -999.0},
            "parameters": {key: {"units": unit} for key, unit in PARAMETERS.items()},
            "properties": {"parameter": values}}


class PowerValidationTests(unittest.TestCase):
    def test_validates_metadata_and_retains_missing_as_null(self):
        data = payload()
        report = validate_response(data, "20250101", "20250103")
        self.assertEqual(report["date_count_expected"], 3)
        for name in PARAMETERS:
            self.assertEqual(data["properties"]["parameter"][name]["20250102"], None)
            self.assertEqual(report["parameters"][name]["fill_or_missing_count"], 1)
            self.assertEqual(report["parameters"][name]["unit"], PARAMETERS[name])

    def test_rejects_wrong_coordinates(self):
        data = payload()
        data["geometry"]["coordinates"][0] = 90
        with self.assertRaisesRegex(ValueError, "coordinates"):
            validate_response(data)

    def test_rejects_wrong_units(self):
        data = payload()
        data["parameters"]["T2M_MAX"]["units"] = "K"
        with self.assertRaisesRegex(ValueError, "units mismatch"):
            validate_response(data)

    def test_rejects_missing_date_key(self):
        data = payload()
        del data["properties"]["parameter"]["T2M_MIN"]["20250102"]
        with self.assertRaisesRegex(ValueError, "date keys mismatch"):
            validate_response(data)

    def test_rejects_wrong_time_standard(self):
        data = payload()
        data["header"]["time_standard"] = "LST"
        with self.assertRaisesRegex(ValueError, "UTC"):
            validate_response(data)


if __name__ == "__main__":
    unittest.main()
