from typing import Dict, Any, List
from .schema_score import compute_schema_correctness
from .coverage_score import compute_rule_coverage
from .boundary_score import compute_boundary_quality
from .quality_classifier import classify_quality, InvalidType
from .models import FitnessResult, FitnessBreakdown, FieldAnalysis


def _compute_diversity_score(values: Dict[str, Any], schema: List[Dict[str, Any]]) -> float:
    """
    Tính DiversityScore của một ca kiểm thử dựa trên mức độ phân tán giá trị
    trong không gian kiểm thử.

    Công thức:
        DiversityScore = (số trường có giá trị khác biệt / tổng trường) * 100

    Đánh giá:
    - Chuỗi: giá trị khác "", None, và không đồng nhất với tên trường
    - Số: giá trị không phải 0, None
    - Enum/Boolean: luôn được tính là đa dạng nếu có giá trị hợp lệ
    """
    if not schema:
        return 100.0

    diverse_count = 0
    total = 0

    for field in schema:
        name = field["name"]
        val = values.get(name)
        ftype = field.get("type", "string")
        total += 1

        if val is None:
            continue

        val_str = str(val).strip()

        if val_str == "" or val_str.lower() == "none":
            continue

        if ftype == "number":
            try:
                num = float(val_str)
                # Coi là đa dạng nếu không phải giá trị 0 mặc định
                if num != 0.0:
                    diverse_count += 1
                else:
                    diverse_count += 0.5  # Giá trị 0 vẫn có ý nghĩa nhưng ít đa dạng hơn
            except (ValueError, TypeError):
                pass
        elif field.get("allowedValues"):
            # Enum field: đa dạng nếu có giá trị hợp lệ
            if val in field["allowedValues"]:
                diverse_count += 1
            else:
                diverse_count += 0.5  # Giá trị ngoài danh sách vẫn có ý nghĩa kiểm thử
        else:
            # Chuỗi: đa dạng nếu có độ dài > 1 và không trùng với tên trường
            if len(val_str) > 1 and val_str.lower() != name.lower():
                diverse_count += 1
            else:
                diverse_count += 0.3  # Giá trị đơn giản

    if total == 0:
        return 100.0

    raw_ratio = diverse_count / total
    # Chuẩn hóa về [0, 100], áp dụng sigmoid nhẹ để tránh phần thưởng tuyến tính
    score = min(raw_ratio * 100.0, 100.0)
    return round(score, 2)


class FitnessEngine:
    @staticmethod
    def evaluate(
        values: Dict[str, Any],
        schema: List[Dict[str, Any]],
        categories: List[str] = None
    ) -> FitnessResult:
        """
        Đánh giá chất lượng một ca kiểm thử theo hàm fitness đa tiêu chí.

        Công thức tổng quát (đồ án, trang Chương 3):
            F(Xᵢ) = w₁·ValidationScore + w₂·DiversityScore
                   + w₃·PriorityScore  + w₄·BoundaryScore
                   - w₅·Penalty

        Với POSITIVE/BOUNDARY: w₁=w₂=w₃=w₄=0.25, w₅ = 1000 nếu vi phạm
        Với NEGATIVE: điều chỉnh ưu tiên error_path (vi phạm có chủ đích)
        """
        if categories is None:
            categories = []

        schema_score = compute_schema_correctness(values, schema)
        coverage_score, missing_rules = compute_rule_coverage(values, schema)
        boundary_score, field_analysis = compute_boundary_quality(values, schema)

        # --- FIX #1: Tính DiversityScore thực sự (không còn hardcode 100.0) ---
        diversity_score = _compute_diversity_score(values, schema)

        error_path_score = 0.0
        business_rule_score = 100.0
        penalty = 0.0
        invalid_reasons = []

        # Phân loại ca kiểm thử
        categories_upper = [c.upper() for c in categories]
        is_negative = any(
            c in ["NEGATIVE_FUNCTIONAL", "NEGATIVE_SECURITY", "NEGATIVE"]
            for c in categories_upper
        )
        is_security = "NEGATIVE_SECURITY" in categories_upper

        semantic_sum = 0.0
        total_fields = len(schema) or 1
        violation_count = 0

        for field in schema:
            val_str = (
                str(values.get(field["name"]))
                if values.get(field["name"]) is not None
                else ""
            )
            status_res = classify_quality(val_str, field)
            status = status_res.status
            semantic_sum += status_res.quality.semantic_score

            if status != InvalidType.VALID:
                violation_count += 1
                error_path_score += 25.0
                invalid_reasons.append(f"{field['name']} -> {status.name}")

            if status_res.quality.semantic_score < 1.0 and status != InvalidType.INVALID_FORMAT:
                penalty += 5.0
                invalid_reasons.append(f"{field['name']} fails heuristic semantic check")

        semantic_score = (semantic_sum / total_fields) * 100.0
        expected_result_coverage = min(error_path_score, 100.0)

        if is_negative:
            # Ca NEGATIVE: vi phạm có chủ đích → ưu tiên error_path
            # F = 0.25·Validation + 0.10·Coverage + 0.25·Boundary
            #   + 0.25·ErrorPath  + 0.15·Diversity
            raw_fitness = (
                schema_score            * 0.25 +
                coverage_score          * 0.10 +
                boundary_score          * 0.25 +
                expected_result_coverage * 0.25 +
                diversity_score         * 0.15
            )
            # Penalty cho quá nhiều vi phạm không cần thiết (trừ security)
            if not is_security and violation_count > 3:
                penalty += (violation_count - 3) * 10.0
        else:
            # Ca POSITIVE/BOUNDARY: đúng ràng buộc hoàn toàn
            # F = 0.25·ValidationScore + 0.25·DiversityScore
            #   + 0.25·PriorityScore   + 0.25·BoundaryScore
            # (PriorityScore ≈ coverage_score)
            raw_fitness = (
                schema_score   * 0.25 +
                diversity_score * 0.25 +
                coverage_score * 0.25 +
                boundary_score * 0.25
            )
            if violation_count > 0:
                # Hard penalty: ca POSITIVE không được vi phạm ràng buộc
                penalty += 1000.0

        final_fitness = max(0.0, raw_fitness - penalty)

        # Weak points → GA mutation target
        weak_points = []
        improvements = []
        for fa in field_analysis:
            if fa.score < 80.0:
                weak_points.append({
                    "field": fa.field,
                    "issue": "far_from_boundary",
                    "current": fa.value,
                    "target": fa.target
                })
                improvements.append(f"Move {fa.field} closer to {fa.target}")

        for mr in missing_rules:
            weak_points.append({
                "field": mr.split(".")[0],
                "issue": "missing_rule_coverage",
                "rule": mr.split(".")[1] if "." in mr else mr
            })
            improvements.append(f"Cover rule: {mr}")

        return FitnessResult(
            fitness=round(final_fitness, 2),
            breakdown=FitnessBreakdown(
                schema_score=round(schema_score, 2),
                coverage=round(coverage_score, 2),
                boundary=round(boundary_score, 2),
                diversity=round(diversity_score, 2),
                semantic=round(semantic_score, 2),
                error_path_score=round(error_path_score, 2),
                business_rule_score=round(business_rule_score, 2),
                penalty=round(penalty, 2),
                raw_fitness=round(raw_fitness, 2)
            ),
            field_analysis=field_analysis,
            missing_rules=missing_rules,
            invalid_reason="; ".join(invalid_reasons) if invalid_reasons else None,
            weak_points=weak_points,
            improvements=improvements
        )
