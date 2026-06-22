import re
from .models import InvalidType, FieldQualityStatus, SemanticQuality

def classify_quality(val_str: str, field: dict) -> FieldQualityStatus:
    quality = SemanticQuality()

    if val_str is None or str(val_str).strip() == "":
        if field.get("required", False):
            quality.required_score = 0.0
            return FieldQualityStatus(status=InvalidType.INVALID_REQUIRED, quality=quality)
        return FieldQualityStatus(status=InvalidType.VALID, quality=quality)
        
    val_str = str(val_str)
    ftype = field.get("type", "string")
    semantic_type = field.get("semantic_type", ftype)
    
    # 1. Type mismatch
    if ftype == "number":
        try:
            float(val_str)
        except (ValueError, TypeError):
            quality.type_score = 0.0
            return FieldQualityStatus(status=InvalidType.INVALID_TYPE, quality=quality)
            
    if ftype == "date":
        try:
            from datetime import datetime
            datetime.fromisoformat(val_str.replace("Z", "+00:00"))
        except ValueError:
            quality.type_score = 0.0
            return FieldQualityStatus(status=InvalidType.INVALID_TYPE, quality=quality)
            
    # 2. Format / Semantic mismatch
    regex = field.get("regex")
    if regex:
        try:
            if not re.search(regex, val_str):
                quality.format_score = 0.0
                return FieldQualityStatus(status=InvalidType.INVALID_FORMAT, quality=quality)
        except re.error:
            pass
    else:
        # Check semantic types
        if semantic_type == "email" or ftype == "email" or field["name"].lower() == "email":
            if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", val_str): 
                quality.semantic_score = 0.0
                return FieldQualityStatus(status=InvalidType.INVALID_FORMAT, quality=quality)
        elif semantic_type == "phone" or field["name"].lower() == "phone":
            # Simple check for phone (no letters, reasonable length)
            if re.search(r"[A-Za-z]", val_str) or not re.match(r"^[0-9+\-\s()]{7,20}$", val_str):
                quality.semantic_score = 0.0
                return FieldQualityStatus(status=InvalidType.INVALID_FORMAT, quality=quality)
        elif semantic_type == "text" and field["name"].lower() == "full_name":
            # Heuristic for name: should not be entirely random looking. But for now, if it's very long without spaces...
            if len(val_str) > 15 and " " not in val_str:
                quality.semantic_score = 0.5
                
    # 3. Enum mismatch
    allowed = field.get("allowedValues")
    if allowed:
        if val_str not in [str(a) for a in allowed]:
            quality.semantic_score = 0.0
            return FieldQualityStatus(status=InvalidType.INVALID_ENUM, quality=quality)
            
    # 4. Boundary mismatch
    if ftype == "number":
        num = float(val_str)
        min_v = field.get("minValue")
        max_v = field.get("maxValue")
        if min_v is not None and num < min_v: 
            quality.boundary_score = 0.0
            return FieldQualityStatus(status=InvalidType.INVALID_BOUNDARY, quality=quality)
        if max_v is not None and num > max_v: 
            quality.boundary_score = 0.0
            return FieldQualityStatus(status=InvalidType.INVALID_BOUNDARY, quality=quality)
    elif ftype != "date":
        length = len(val_str)
        min_l = field.get("minLength")
        max_l = field.get("maxLength")
        if min_l is not None and length < min_l: 
            quality.boundary_score = 0.0
            return FieldQualityStatus(status=InvalidType.INVALID_BOUNDARY, quality=quality)
        if max_l is not None and length > max_l: 
            quality.boundary_score = 0.0
            return FieldQualityStatus(status=InvalidType.INVALID_BOUNDARY, quality=quality)

    return FieldQualityStatus(status=InvalidType.VALID, quality=quality)
