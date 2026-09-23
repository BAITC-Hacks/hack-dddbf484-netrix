"""Boundary and behavior tests for the actual 66-profile catalog."""

import unittest
from datetime import date

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import app
from matching import MatchRequest, load_catalog, match_profiles


class MatchingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = load_catalog()
        cls.client = TestClient(app)

    def request(self, **overrides):
        data = dict(city="Алматы", event_date=date(2026, 9, 23),
                    event_format="свадьба", category="Флорист", budget_kzt=500000)
        data.update(overrides)
        return MatchRequest(**data)

    def test_catalog_and_calendar_boundaries(self):
        self.assertEqual(len(self.catalog), 66)
        for day in (date(2026, 9, 23), date(2026, 12, 31)):
            self.assertEqual(self.request(event_date=day).event_date, day)
        for day in (date(2026, 9, 22), date(2027, 1, 1)):
            with self.assertRaises(ValidationError):
                self.request(event_date=day)

    def test_busy_date_differs_from_free_date(self):
        profile = self.catalog[0]  # HK-39372: free Sep 23, busy Sep 25
        free = match_profiles(self.request(), [profile])
        busy = match_profiles(self.request(event_date=date(2026, 9, 25)), [profile])
        self.assertEqual(free.status, "matched")
        self.assertEqual(busy.status, "no_matches")
        self.assertEqual(busy.exclusions["busy_date"], 1)
        self.assertIn("заняты", busy.message)
        self.assertIn("23.09.2026", free.recommendations[0].explanation)

    def test_each_eligibility_rule_and_null_hours(self):
        profile = {**self.catalog[0], "busy_dates": []}
        self.assertEqual(match_profiles(self.request(budget_kzt=profile["price_from_kzt"]), [profile]).status, "matched")
        self.assertEqual(match_profiles(self.request(budget_kzt=profile["price_from_kzt"] - 1), [profile]).exclusions["over_budget"], 1)
        self.assertEqual(match_profiles(self.request(event_format="концерт"), [profile]).exclusions["event_format"], 1)
        self.assertEqual(match_profiles(self.request(language="английский"), [profile]).exclusions["language"], 1)
        self.assertEqual(match_profiles(self.request(duration_hours=12), [profile]).status, "matched")
        limited = {**profile, "max_hours": 3}
        self.assertEqual(match_profiles(self.request(duration_hours=4), [limited]).exclusions["duration"], 1)
        self.assertEqual(match_profiles(self.request(duration_hours=3), [limited]).status, "matched")

    def test_statuses_order_and_specific_explanations(self):
        req = self.request(category="Ведущий", budget_kzt=3000000)
        result = match_profiles(req, self.catalog)
        reversed_result = match_profiles(req, list(reversed(self.catalog)))
        self.assertEqual(result.model_dump(), reversed_result.model_dump())
        self.assertEqual(result.status, "matched")
        self.assertLessEqual(len(result.recommendations), 3)
        self.assertEqual(len({r.explanation for r in result.recommendations}), len(result.recommendations))
        self.assertEqual(match_profiles(self.request(city="Зарубежье"), self.catalog).status, "no_category_in_city")
        self.assertEqual(match_profiles(self.request(budget_kzt=0), self.catalog).status, "no_matches")

    def test_api_responds_and_rejects_invalid_inputs(self):
        request = dict(city="Алматы", event_date="2026-09-23", event_format="свадьба",
                       category="Флорист", budget_kzt=500000)
        response = self.client.post("/match", json=request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "matched")
        self.assertEqual(self.client.get("/health").json()["profiles"], 66)
        for update in ({"event_date": "2027-01-01"}, {"duration_hours": 0}, {"category": " "}):
            self.assertEqual(self.client.post("/match", json={**request, **update}).status_code, 422)


if __name__ == "__main__":
    unittest.main()
