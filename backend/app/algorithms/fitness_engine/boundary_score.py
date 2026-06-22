from typing import List, Tuple
from .models import FieldAnalysis

def compute_boundary_quality(values: dict, schema: list) -> Tuple[float, List[FieldAnalysis]]:
    reports = []
    total_score = 0.0
    evaluated_fields = 0
    
    for field in schema:
        name = field["name"]
        val = values.get(name)
        val_str = str(val) if val is not None else ""
        ftype = field.get("type", "string")
        
        distance = 0.0
        target = None
        score = 1.0
        has_boundary = False
        
        if ftype == "number":
            min_v = field.get("minValue")
            max_v = field.get("maxValue")
            
            try:
                num = float(val_str)
                if min_v is not None and max_v is not None:
                    has_boundary = True
                    d_min = abs(num - min_v)
                    d_max = abs(num - max_v)
                    distance = min(d_min, d_max)
                    target = min_v if d_min < d_max else max_v
                    max_possible = abs(max_v - min_v) or 1.0
                    score = max(0.0, 1.0 - (distance / max_possible))
                elif min_v is not None:
                    has_boundary = True
                    distance = abs(num - min_v)
                    target = min_v
                    max_possible = max(1.0, abs(min_v))
                    score = max(0.0, 1.0 - (distance / max_possible))
                elif max_v is not None:
                    has_boundary = True
                    distance = abs(num - max_v)
                    target = max_v
                    max_possible = max(1.0, abs(max_v))
                    score = max(0.0, 1.0 - (distance / max_possible))
            except:
                pass
                
        elif ftype != "date" and ftype != "enum" and field.get("allowedValues") is None:
            min_l = field.get("minLength")
            max_l = field.get("maxLength")
            length = len(val_str)
            
            if min_l is not None and max_l is not None:
                has_boundary = True
                d_min = abs(length - min_l)
                d_max = abs(length - max_l)
                distance = min(d_min, d_max)
                target = f"len={min_l}" if d_min < d_max else f"len={max_l}"
                max_possible = abs(max_l - min_l) or 1.0
                score = max(0.0, 1.0 - (distance / max_possible))
            elif min_l is not None:
                has_boundary = True
                distance = abs(length - min_l)
                target = f"len={min_l}"
                max_possible = max(1.0, min_l)
                score = max(0.0, 1.0 - (distance / max_possible))
            elif max_l is not None:
                has_boundary = True
                distance = abs(length - max_l)
                target = f"len={max_l}"
                max_possible = max(1.0, max_l)
                score = max(0.0, 1.0 - (distance / max_possible))
                
        if has_boundary:
            status = "AT_BOUNDARY" if score == 1.0 else ("NEAR_BOUNDARY" if score > 0.8 else "FAR_FROM_BOUNDARY")
            reports.append(FieldAnalysis(
                field=name,
                value=val_str,
                target=target,
                distance=distance,
                score=score * 100,
                status=status
            ))
            total_score += score * 100
            evaluated_fields += 1
            
    final_score = (total_score / evaluated_fields) if evaluated_fields > 0 else 100.0
    return final_score, reports
