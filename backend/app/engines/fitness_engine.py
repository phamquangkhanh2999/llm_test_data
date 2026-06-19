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

def calculateRubricScores(test_cases: list, schema: list) -> dict:
    """
    Hợp nhất logic tính điểm Fitness theo thang điểm 100.
    """
    if not test_cases:
        return {
            "total_score": 0,
            "rubric": {
                "validation": {"score": 0, "max": 40, "label": "Validation (Tính hợp lệ)"},
                "boundary": {"score": 0, "max": 30, "label": "Boundary (Bao phủ biên)"},
                "diversity": {"score": 0, "max": 20, "label": "Diversity (Độ đa dạng)"},
                "security": {"score": 0, "max": 10, "label": "Security (Bảo mật/Rủi ro)"}
            }
        }
    
    # 1. Validation (Mức độ hợp lệ với schema)
    # Giả lập: Kiểm tra số trường hợp lệ. Nếu 100% hợp lệ -> 40 điểm.
    # Trong môi trường thật, validation tính dựa trên constraints (như cũ).
    from .constraint_engine import evaluate_constraints
    validation_score_raw = sum(evaluate_constraints(tc, schema) for tc in test_cases) / len(test_cases)
    val_score = round(validation_score_raw * 40)
    
    # 2. Boundary (Bao phủ biên)
    # Tái sử dụng calculate_boundary_coverage nếu có rules, nhưng ở đây nhận schema
    # Giả lập chấm điểm dựa trên origin hoặc fitness đã lưu.
    # Trong hệ thống production: đếm tỷ lệ các giá trị nằm ở cận/biên.
    from .coverage_engine import calculate_boundary_coverage
    # Giả định "schema" cũng dùng thay cho "rules" tạm thời để chấm điểm
    bound_cov = calculate_boundary_coverage(test_cases, schema) 
    bound_score = round((bound_cov["boundary_coverage_percent"] / 100.0) * 30)

    # 3. Diversity (Đa dạng dữ liệu)
    # Hệ số khác biệt giữa các test case trong quần thể.
    # Tính nhanh = 1 - (tỷ lệ trùng lặp)
    seen_fp = set()
    for tc in test_cases:
        fp = str(sorted((k, str(v)) for k, v in tc.items()))
        seen_fp.add(fp)
    diversity_ratio = len(seen_fp) / len(test_cases) if test_cases else 0
    div_score = round(diversity_ratio * 20)
    
    # 4. Security / Negative Testing
    # Kiểm tra các ca kiểm thử cố tình điền sai hoặc chèn ký tự đặc biệt
    # Tạm mô phỏng tỷ lệ invalid/boundary là security coverage
    sec_score = round((bound_cov["boundary_coverage_percent"] / 100.0) * 10)
    
    total = val_score + bound_score + div_score + sec_score
    
    return {
        "total_score": min(total, 100),
        "rubric": {
            "validation": {"score": min(val_score, 40), "max": 40, "label": "Validation (Tính hợp lệ)"},
            "boundary": {"score": min(bound_score, 30), "max": 30, "label": "Boundary (Bao phủ biên)"},
            "diversity": {"score": min(div_score, 20), "max": 20, "label": "Diversity (Độ đa dạng)"},
            "security": {"score": min(sec_score, 10), "max": 10, "label": "Security (Bảo mật/Rủi ro)"}
        }
    }
