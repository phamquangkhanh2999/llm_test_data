from .coverage_engine import calculate_coverage, calculate_boundary_coverage
from .constraint_engine import evaluate_constraints

def calculate_dataset_fitness(test_cases: list, rules: list, constraints: list) -> dict:
    """
    Calculates the exact mathematical fitness score for the entire dataset.
    Formula: Fitness = rule*0.3 + boundary*0.2 + pairwise*0.15 + diversity*0.15 + constraint*0.1 + mutation*0.1
    """
    if not test_cases:
        return {"fitness_score": 0.0, "details": {}}
        
    # 1. Rule Coverage (Weight: 0.3)
    rule_cov_data = calculate_coverage(test_cases, rules)
    rule_score = rule_cov_data["rule_coverage_percent"] / 100.0
    
    # 2. Boundary Coverage (Weight: 0.2)
    boundary_cov_data = calculate_boundary_coverage(test_cases, rules)
    boundary_score = boundary_cov_data["boundary_coverage_percent"] / 100.0
    
    # 3. Constraint Coverage (Weight: 0.1)
    constraint_scores = [evaluate_constraints(tc, constraints) for tc in test_cases]
    constraint_score = sum(constraint_scores) / len(test_cases) if test_cases else 1.0
    
    # Simple simulated metrics for the rest for Phase 3
    # In a full production engine, diversity is calculated via string distance/cosine similarity
    # Pairwise via combinatorial checks, Mutation via seeded fault detection.
    diversity_score = 0.8  # Placeholder
    pairwise_score = 0.7   # Placeholder
    mutation_score = 0.5   # Placeholder
    
    fitness_score = (
        rule_score * 0.3 +
        boundary_score * 0.2 +
        pairwise_score * 0.15 +
        diversity_score * 0.15 +
        constraint_score * 0.1 +
        mutation_score * 0.1
    )
    
    return {
        "fitness_score": round(fitness_score, 4),
        "details": {
            "rule_score": round(rule_score, 2),
            "boundary_score": round(boundary_score, 2),
            "constraint_score": round(constraint_score, 2),
            "diversity_score": diversity_score,
            "pairwise_score": pairwise_score,
            "mutation_score": mutation_score
        },
        "coverage_data": rule_cov_data,
        "boundary_data": boundary_cov_data
    }

def evaluate_individual_fitness(test_case: dict, rules: list, constraints: list) -> float:
    """
    Evaluates fitness for a single test case (useful for Genetic Algorithms).
    """
    # 1. Rule adherence (is it valid or a targeted negative case?)
    # A simple metric: does it violate any rule?
    from .coverage_engine import calculate_coverage
    rule_score = 1.0 # Base score
    vio = test_case.get("violatedRule")
    if vio:
        rule_score = 0.5 # Valid negative case gets 0.5
        
    # 2. Constraint adherence
    from .constraint_engine import evaluate_constraints
    constraint_score = evaluate_constraints(test_case, constraints)
    
    # 3. Boundary check (Simulated for individual)
    method = test_case.get("method", "").lower()
    boundary_score = 1.0 if method == "bva" else 0.5
    
    # Simplified individual fitness formula
    fitness = (rule_score * 0.4) + (boundary_score * 0.3) + (constraint_score * 0.3)
    return max(0.01, min(fitness, 1.0))
