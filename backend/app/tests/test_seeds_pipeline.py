import sys
import os
import unittest

# Adjust path to find backend modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.services.ai_service import (
    validate_and_fix_seeds,
    build_coverage_matrix_contract,
    generate_coverage_summary,
    calculate_cache_key,
    PROMPT_VERSION,
    SEED_ENGINE_VERSION,
)
from app.services.seed_engine import (
    build_full_coverage_contract,
    generate_golden_record,
    validate_schema_for_seeds,
    validate_coverage_contract_items,
)
# Backward-compat aliases for old tests
RULE_ENGINE_VERSION = SEED_ENGINE_VERSION
COVERAGE_MATRIX_VERSION = SEED_ENGINE_VERSION

class TestSeedsPipeline(unittest.TestCase):
    def setUp(self):
        self.fields = [
            {"name": "username", "type": "string", "required": True, "minLength": 5, "maxLength": 15},
            {"name": "email", "type": "email", "required": True},
            {"name": "age", "type": "number", "required": False, "minValue": 18, "maxValue": 60}
        ]

    def test_reject_engine_missing_required_fields(self):
        # Username missing -> should be rejected because required is True
        invalid_seeds = [
            {
                "tcId": "TC-0001",
                "categories": ["positive"],
                "values": {"email": "test@gmail.com", "age": 25},
                "scenario": "Missing username entirely",
                "expectedResult": "Valid"
            }
        ]
        result = validate_and_fix_seeds(invalid_seeds, self.fields)
        # The input invalid seed must be rejected and not present in the output
        scenarios = [s["scenario"] for s in result]
        self.assertNotIn("Missing username entirely", scenarios)
        # But we still have auto-generated boundary/equivalence seeds to satisfy contract
        self.assertGreater(len(result), 0)

    def test_repair_engine_scenario_and_expected_result(self):
        # Scenario too short, expected result generic -> should be repaired
        seeds_to_repair = [
            {
                "tcId": "TC-0001",
                "categories": ["positive"],
                "values": {"username": "user123", "email": "user@gmail.com", "age": 25},
                "scenario": "short",
                "expectedResult": "Thành công",
                "rationale": "valid test"
            }
        ]
        result = validate_and_fix_seeds(seeds_to_repair, self.fields)
        # Find the seed corresponding to the input (first seed or by username match)
        input_seed_repaired = None
        for s in result:
            if s["values"].get("username") == "user123" and "Kiểm thử biên" not in s["scenario"]:
                input_seed_repaired = s
                break
        
        self.assertIsNotNone(input_seed_repaired)
        self.assertGreaterEqual(len(input_seed_repaired["scenario"]), 15)
        self.assertGreaterEqual(len(input_seed_repaired["expectedResult"]), 10)
        self.assertNotEqual(input_seed_repaired["expectedResult"], "Thành công")

    def test_deduplication_exact_and_semantic(self):
        seeds = [
            # Exact duplicate values
            {
                "tcId": "TC-0001",
                "categories": ["positive"],
                "values": {"username": "user123", "email": "user@gmail.com", "age": 25},
                "scenario": "First happy path scenario validation",
                "expectedResult": "HTTP 200 - Xử lý thành công",
                "rationale": "valid test"
            },
            {
                "tcId": "TC-0002",
                "categories": ["positive"],
                "values": {"username": "user123", "email": "user@gmail.com", "age": 25},
                "scenario": "Second identical scenario validation",
                "expectedResult": "HTTP 200 - Xử lý thành công",
                "rationale": "valid test"
            },
            # Semantic duplicate (different values but same categories, same coverageTags/empty, same expectedResult)
            {
                "tcId": "TC-0003",
                "categories": ["positive"],
                "values": {"username": "otheruser", "email": "other@gmail.com", "age": 30},
                "scenario": "Third positive path scenario validation",
                "expectedResult": "HTTP 200 - Xử lý thành công, dữ liệu hợp lệ và được cập nhật vào cơ sở dữ liệu",
                "rationale": "valid test"
            }
        ]
        result = validate_and_fix_seeds(seeds, self.fields)
        # Assert that only one instance of the identical test cases makes it through
        scenario_matches = [s["scenario"] for s in result if "identical" in s["scenario"] or "happy path" in s["scenario"]]
        self.assertEqual(len(scenario_matches), 1)

    def test_cache_key_invalidation_on_version_change(self):
        fields = [{"name": "username", "type": "string"}]
        key1 = calculate_cache_key(fields, "spec text", "bva", "gemini")
        
        # If versions are different, hash must be different
        global PROMPT_VERSION
        orig_version = PROMPT_VERSION
        try:
            # Shift version
            import app.services.ai_service as ai
            ai.PROMPT_VERSION = "4.2"
            key2 = calculate_cache_key(fields, "spec text", "bva", "gemini")
            self.assertNotEqual(key1, key2)
        finally:
            import app.services.ai_service as ai
            ai.PROMPT_VERSION = orig_version

    def test_coverage_matrix_and_summary(self):
        required_cases, _, _ = build_coverage_matrix_contract(self.fields)
        # Verify required boundary IDs are generated for age
        ids = [item["id"] for item in required_cases]
        self.assertTrue(any("BVA_AGE_MIN" in i for i in ids))
        self.assertTrue(any("BVA_AGE_MAX" in i for i in ids))

if __name__ == "__main__":
    unittest.main()
