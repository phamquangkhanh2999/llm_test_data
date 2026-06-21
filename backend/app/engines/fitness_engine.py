import re
from collections import Counter

from .coverage_engine import calculate_coverage, calculate_boundary_coverage
from .constraint_engine import evaluate_constraints

# Khóa "phong bì" do chính generator của hệ thống sinh ra (KHÔNG phải tên trường nghiệp vụ).
# Ổn định giữa các đề bài; tên trường nghiệp vụ luôn lấy động từ `fields` schema.
_META_KEYS = {
    "method", "scenario", "expectedResult", "expected_result", "expected",
    "tcId", "tcid", "id", "coverageTags", "fitnessBreakdown", "seedQualityScore",
    "violatedRule", "origin", "values", "type", "dataType", "data_type", "note",
}


def _input_values(tc: dict) -> dict:
    """Trả về dict giá trị đầu vào của 1 test case, dù nằm trong 'values' hay phẳng."""
    if isinstance(tc.get("values"), dict):
        return tc["values"]
    return {k: v for k, v in tc.items() if k not in _META_KEYS}


def _has_constraint(field: dict) -> bool:
    """Field có ràng buộc nào để đánh giá tính hợp lệ hay không."""
    return bool(
        field.get("required")
        or field.get("allowedValues")
        or field.get("regex")
        or field.get("minLength") is not None
        or field.get("maxLength") is not None
        or field.get("minValue") is not None
        or field.get("maxValue") is not None
    )


def _value_status(field: dict, value) -> tuple:
    """
    So 1 giá trị với ràng buộc schema của field. Hoàn toàn không đọc chữ trong scenario.
    Trả về (is_valid, at_boundary) — at_boundary = giá trị nằm đúng cận min/max.
    """
    required = bool(field.get("required"))
    empty = value is None or (isinstance(value, str) and value.strip() == "")
    if empty:
        return (not required, False)

    s = str(value)
    is_valid = True
    at_boundary = False

    min_l, max_l = field.get("minLength"), field.get("maxLength")
    if min_l is not None or max_l is not None:
        length = len(s)
        if min_l is not None and length < min_l:
            is_valid = False
        if max_l is not None and length > max_l:
            is_valid = False
        if (min_l is not None and length == min_l) or (max_l is not None and length == max_l):
            at_boundary = True

    allowed = field.get("allowedValues")
    if allowed:
        if value not in allowed and s not in {str(a) for a in allowed}:
            is_valid = False

    regex = field.get("regex")
    if regex:
        try:
            if re.fullmatch(regex, s) is None:
                is_valid = False
        except re.error:
            pass  # regex hỏng trong spec thì bỏ qua, không kết luận sai

    min_v, max_v = field.get("minValue"), field.get("maxValue")
    if min_v is not None or max_v is not None:
        try:
            num = float(s)
            if min_v is not None and num < float(min_v):
                is_valid = False
            if max_v is not None and num > float(max_v):
                is_valid = False
            if (min_v is not None and num == float(min_v)) or (max_v is not None and num == float(max_v)):
                at_boundary = True
        except (ValueError, TypeError):
            is_valid = False  # field số nhưng giá trị không phải số

    return (is_valid, at_boundary)


def _classify_type(tc: dict, vals: dict, field_map: dict) -> str:
    """
    Phân loại positive/negative/boundary theo RÀNG BUỘC schema (không theo từ khóa ngôn ngữ).
    Ưu tiên nhãn 'type' tường minh nếu case đã có. Không đủ căn cứ -> 'unknown'.
    """
    explicit = str(tc.get("type") or tc.get("dataType") or tc.get("data_type") or "").lower()
    if explicit in ("positive", "negative", "boundary"):
        return explicit
    if not field_map:
        return "unknown"

    statuses = [
        _value_status(field_map[k], v)
        for k, v in vals.items()
        if k in field_map and _has_constraint(field_map[k])
    ]
    if not statuses:
        return "unknown"
    if any(not valid for valid, _ in statuses):
        return "negative"
    if any(boundary for _, boundary in statuses):
        return "boundary"
    return "positive"


def audit_dataset(test_cases: list, fields: list) -> dict:
    """
    Tính TOÀN BỘ số liệu xác định (deterministic) về tập dữ liệu kiểm thử bằng code,
    để LLM chỉ việc nhận xét chứ KHÔNG phải tự đếm/tự bịa.

    Mọi phán đoán biên/hợp lệ đều lấy từ ràng buộc trong `fields` schema của TỪNG đề bài,
    nên không phụ thuộc ngôn ngữ hay nội dung mô tả.
    """
    if not test_cases:
        return {
            "total": 0, "by_method": {}, "by_type": {},
            "duplicate_tcids": {}, "missing_tcid_count": 0,
            "schema": {}, "boundary_coverage": {}, "duplicate_value_groups": 0,
        }

    field_list = [f for f in (fields or []) if isinstance(f, dict) and f.get("name")]
    field_names = [f["name"] for f in field_list]
    field_set = set(field_names)
    field_map = {f["name"]: f for f in field_list}
    constrained_fields = [f for f in field_list if _has_constraint(f)]

    total = len(test_cases)
    by_method = Counter()
    by_type = Counter()
    tcid_counter = Counter()
    missing_tcid = 0
    wrapped_count = 0
    flat_count = 0
    extra_fields = Counter()              # field trong dữ liệu nhưng không có trong schema
    fingerprints = Counter()
    field_lengths = {f["name"]: set() for f in constrained_fields}   # độ dài chuỗi đã gặp
    field_numbers = {f["name"]: set() for f in constrained_fields}   # giá trị số đã gặp

    for tc in test_cases:
        by_method[str(tc.get("method", "unknown")).lower()] += 1

        tcid = tc.get("tcId") or tc.get("tcid") or tc.get("id")
        if tcid:
            tcid_counter[str(tcid)] += 1
        else:
            missing_tcid += 1

        if isinstance(tc.get("values"), dict):
            wrapped_count += 1
        else:
            flat_count += 1

        vals = _input_values(tc)
        by_type[_classify_type(tc, vals, field_map)] += 1

        if field_set:
            for k in vals:
                if k not in field_set:
                    extra_fields[k] += 1

        # Gom độ dài / giá trị số thực tế cho từng field có ràng buộc -> tính bao phủ biên.
        for k, v in vals.items():
            if k in field_lengths and isinstance(v, (str, int, float)):
                field_lengths[k].add(len(str(v)))
                try:
                    field_numbers[k].add(float(v))
                except (ValueError, TypeError):
                    pass

        fingerprints[str(sorted((k, str(v)) for k, v in vals.items()))] += 1

    duplicate_tcids = {k: c for k, c in tcid_counter.items() if c > 1}
    duplicate_value_groups = sum(1 for c in fingerprints.values() if c > 1)

    # Bao phủ biên theo schema: với mỗi cận min/max, dữ liệu có chạm đúng cận và vượt cận chưa?
    boundary_coverage = {}
    for f in constrained_fields:
        name = f["name"]
        lengths = field_lengths[name]
        numbers = field_numbers[name]
        cov = {}
        if f.get("minLength") is not None:
            m = f["minLength"]
            cov["minLength"] = m
            cov["has_at_minLength"] = m in lengths
            cov["has_below_minLength"] = (m - 1) in lengths
        if f.get("maxLength") is not None:
            m = f["maxLength"]
            cov["maxLength"] = m
            cov["has_at_maxLength"] = m in lengths
            cov["has_above_maxLength"] = (m + 1) in lengths
        if f.get("minValue") is not None:
            m = float(f["minValue"])
            cov["minValue"] = f["minValue"]
            cov["has_at_minValue"] = m in numbers
            cov["has_below_minValue"] = (m - 1) in numbers
        if f.get("maxValue") is not None:
            m = float(f["maxValue"])
            cov["maxValue"] = f["maxValue"]
            cov["has_at_maxValue"] = m in numbers
            cov["has_above_maxValue"] = (m + 1) in numbers
        if lengths:
            cov["lengths_present"] = sorted(lengths)
        boundary_coverage[name] = cov

    return {
        "total": total,
        "by_method": dict(by_method),
        "by_type": dict(by_type),
        "unique_tcids": len(tcid_counter),
        "duplicate_tcids": duplicate_tcids,
        "duplicate_tcid_group_count": len(duplicate_tcids),
        "missing_tcid_count": missing_tcid,
        "schema": {
            "expected_fields": field_names,
            "uses_values_wrapper": wrapped_count,
            "flat_structure": flat_count,
            "structure_inconsistent": wrapped_count > 0 and flat_count > 0,
            "unexpected_fields": dict(extra_fields),
        },
        "boundary_coverage": boundary_coverage,
        "duplicate_value_groups": duplicate_value_groups,
    }


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
