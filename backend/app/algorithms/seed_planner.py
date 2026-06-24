import math
from typing import List, Dict, Any

class SeedPlan:
    def __init__(self, total: int, valid: int, boundary: int, invalid: int, targets: List[Dict[str, Any]]):
        self.total = total
        self.categories = {
            "valid": valid,
            "boundary": boundary,
            "invalid": invalid
        }
        self.targets = targets
        
    def to_dict(self):
        return {
            "total": self.total,
            "categories": self.categories,
            "targets": self.targets
        }

def create_seed_plan(test_methods: List[str], schema_rules: List[Dict[str, Any]]) -> SeedPlan:
    if not test_methods:
        test_methods = ["bva", "ep"]
        
    base_per_method = 10
    total_requested = len(test_methods) * base_per_method
    if total_requested > 50:
        total_requested = 50 # Giới hạn tối đa để tránh quá tải API LLM
        
    valid_weight = 0.0
    boundary_weight = 0.0
    invalid_weight = 0.0
    
    # Ưu tiên sinh nhiều case HỢP LỆ hơn (đa số ~50%+) để pipeline có đủ case thành công.
    for m in test_methods:
        if m == "bva":
            boundary_weight += 1.5
            valid_weight += 1.5
            invalid_weight += 0.5
        elif m == "ep":
            valid_weight += 2.0
            invalid_weight += 1.0
        elif m == "random":
            valid_weight += 1.5
            boundary_weight += 1.0
            invalid_weight += 1.0

    total_weight = valid_weight + boundary_weight + invalid_weight
    if total_weight == 0:
        valid_weight, boundary_weight, invalid_weight = 0.5, 0.3, 0.2
        total_weight = 1.0
        
    valid_count = math.ceil(total_requested * (valid_weight / total_weight))
    boundary_count = math.ceil(total_requested * (boundary_weight / total_weight))
    invalid_count = total_requested - valid_count - boundary_count
    if invalid_count < 0:
        invalid_count = 0
    
    # Phân tích schema để lên mục tiêu rule coverage
    targets = []
    for field in schema_rules:
        name = field["name"]
        ftype = field.get("type", "string")
        rules = []
        
        if field.get("required"):
            rules.append("required")
            
        if ftype == "number":
            if field.get("minValue") is not None: rules.append("minValue")
            if field.get("maxValue") is not None: rules.append("maxValue")
        elif ftype == "date":
            rules.append("format_date")
        elif field.get("allowedValues"):
            rules.append("enum")
        else:
            if field.get("minLength") is not None: rules.append("minLength")
            if field.get("maxLength") is not None: rules.append("maxLength")
            if field.get("regex"): rules.append("regex")
            if ftype in ["email", "phone", "card"]: rules.append("format_" + ftype)
            
        if rules:
            targets.append({
                "field": name,
                "rules": rules
            })
            
    return SeedPlan(total_requested, valid_count, boundary_count, invalid_count, targets)
