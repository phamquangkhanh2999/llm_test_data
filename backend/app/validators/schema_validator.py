def validate_schema(fields: list) -> bool:
    """
    Validates the generated schema fields.
    Raises ValueError on invalid schema structures.
    """
    if not isinstance(fields, list):
        raise ValueError("Schema fields must be a list")
        
    allowed_types = ["string", "number", "email", "card", "phone", "date", "boolean"]
    
    for f in fields:
        name = f.get("name")
        if not name:
            raise ValueError("Field missing 'name'")
            
        ftype = f.get("type")
        if ftype not in allowed_types:
            raise ValueError(f"Field '{name}' has invalid type: {ftype}. Allowed: {allowed_types}")
            
        # Check constraints logic
        min_len = f.get("minLength")
        max_len = f.get("maxLength")
        if min_len is not None and max_len is not None and min_len > max_len:
            raise ValueError(f"Field '{name}' has minLength > maxLength")
            
        min_val = f.get("minValue")
        max_val = f.get("maxValue")
        if min_val is not None and max_val is not None and min_val > max_val:
            raise ValueError(f"Field '{name}' has minValue > maxValue")
            
    return True
