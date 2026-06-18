def calculate_coverage(test_cases: list, rules: list) -> dict:
    """
    Calculates Rule Coverage based on the dataset.
    """
    if not rules:
        return {"rule_coverage_percent": 100.0, "covered_rules": [], "missing_rules": []}

    all_rule_ids = {r["rule_id"] for r in rules}
    covered_rule_ids = set()

    for tc in test_cases:
        # Expected format from Phase 2 LLM: "coveredRules": ["R-001", "R-002"]
        cov = tc.get("coveredRules", [])
        if isinstance(cov, list):
            covered_rule_ids.update(cov)
        
        # Also, if it violates a rule, we consider that rule "tested" (negative testing)
        vio = tc.get("violatedRule")
        if vio:
            covered_rule_ids.add(vio)

    missing_rule_ids = all_rule_ids - covered_rule_ids
    coverage_percent = (len(covered_rule_ids) / len(all_rule_ids)) * 100.0 if all_rule_ids else 100.0

    return {
        "rule_coverage_percent": round(coverage_percent, 2),
        "covered_rules": list(covered_rule_ids),
        "missing_rules": list(missing_rule_ids)
    }

def calculate_boundary_coverage(test_cases: list, rules: list) -> dict:
    """
    Simulated Boundary Coverage calculation.
    In a fully fleshed out engine, this would parse values and detect exactly 
    if MIN and MAX bounds are hit. For now, we simulate based on "method" = "bva".
    """
    bva_cases = [tc for tc in test_cases if tc.get("method", "").lower() == "bva"]
    
    # Ideally we'd look at rule_operator = length_max, length_min, etc.
    boundary_rules = [r for r in rules if r.get("rule_operator") in ["length_min", "length_max", "value_min", "value_max"]]
    total_boundaries_expected = len(boundary_rules) * 2 # Typical min and max edges

    # For simplicity, we just count BVA test cases vs expected bounds
    hit_ratio = len(bva_cases) / max(total_boundaries_expected, 1)
    boundary_coverage_percent = min(hit_ratio * 100.0, 100.0)
    
    return {
        "boundary_coverage_percent": round(boundary_coverage_percent, 2),
        "critical_hits": len(bva_cases)
    }
