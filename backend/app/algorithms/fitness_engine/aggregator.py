from typing import Dict, Any, List
from .schema_score import compute_schema_correctness
from .coverage_score import compute_rule_coverage
from .boundary_score import compute_boundary_quality
from .quality_classifier import classify_quality, InvalidType
from .models import FitnessResult, FitnessBreakdown, FieldAnalysis

class FitnessEngine:
    @staticmethod
    def evaluate(values: Dict[str, Any], schema: List[Dict[str, Any]], categories: List[str] = None) -> FitnessResult:
        if categories is None:
            categories = []
            
        schema_score = compute_schema_correctness(values, schema)
        coverage_score, missing_rules = compute_rule_coverage(values, schema)
        boundary_score, field_analysis = compute_boundary_quality(values, schema)
        diversity_score = 100.0 # Placeholder for phase 2
        
        # Calculate penalties based on invalid types
        penalty = 0.0
        invalid_reasons = []
        is_negative = "negative" in [c.lower() for c in categories]
        semantic_sum = 0.0
        total_fields = len(schema) or 1
        
        for field in schema:
            val_str = str(values.get(field["name"])) if values.get(field["name"]) is not None else ""
            status_res = classify_quality(val_str, field)
            status = status_res.status
            semantic_sum += status_res.quality.semantic_score
            
            if status == InvalidType.INVALID_TYPE:
                if not is_negative:
                    penalty += 100.0 # STRICT GATE
                invalid_reasons.append(f"{field['name']} has invalid type")
            elif status == InvalidType.INVALID_REQUIRED:
                if not is_negative:
                    penalty += 100.0 # STRICT GATE
                invalid_reasons.append(f"{field['name']} is required but missing")
            elif status == InvalidType.INVALID_FORMAT:
                if not is_negative: 
                    penalty += 100.0 # STRICT GATE
                invalid_reasons.append(f"{field['name']} has invalid format/semantic")
            elif status == InvalidType.INVALID_ENUM:
                if not is_negative: 
                    penalty += 100.0 # STRICT GATE
                invalid_reasons.append(f"{field['name']} has invalid enum")
                    
            if status_res.quality.semantic_score < 1.0 and status != InvalidType.INVALID_FORMAT:
                if not is_negative:
                    penalty += 15.0
                invalid_reasons.append(f"{field['name']} fails heuristic semantic check")
                
        semantic_score = (semantic_sum / total_fields) * 100.0

        # Adjust weights based on user suggestion
        # Schema 15%, Coverage (Rule) 35%, Boundary 30%, Semantic 10%, Diversity 10%
        raw_fitness = (
            schema_score * 0.15 +
            coverage_score * 0.35 +
            boundary_score * 0.30 +
            diversity_score * 0.10 +
            semantic_score * 0.10
        )
        
        # If penalty is massive, final_fitness becomes 0 (Strict Gate)
        final_fitness = max(0.0, raw_fitness - penalty)
        
        # Weak points logic for GA mutation target
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
                penalty=round(penalty, 2),
                raw_fitness=round(raw_fitness, 2)
            ),
            field_analysis=field_analysis,
            missing_rules=missing_rules,
            invalid_reason="; ".join(invalid_reasons) if invalid_reasons else None,
            weak_points=weak_points,
            improvements=improvements
        )
