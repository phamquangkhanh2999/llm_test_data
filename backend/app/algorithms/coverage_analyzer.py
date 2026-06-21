import re

def is_valid_iso_date(val_str):
    try:
        from datetime import datetime
        datetime.fromisoformat(val_str.replace("Z", "+00:00"))
        return True
    except ValueError:
        return False

def analyze_coverage(test_case: dict, schema: list) -> list:
    """
    Extracts Coverage Tags from a test case based on the schema constraints.
    Returns a list of strings in RULE_ID:OUTCOME format.
    """
    tags = []
    
    for field in schema:
        name = field["name"]
        val = test_case.get(name)
        val_str = str(val) if val is not None else ""
        
        rule_prefix = name.upper()
        
        # 1. Required Check
        is_required = field.get("required", False)
        if is_required:
            if val is None or val_str.strip() == "":
                tags.append(f"{rule_prefix}_REQUIRED:INVALID")
            else:
                tags.append(f"{rule_prefix}_REQUIRED:VALID")
        else:
            if val is None or val_str.strip() == "":
                tags.append(f"{rule_prefix}_OPTIONAL:MISSING")
                continue # Skip length/format checks if optional and missing
            else:
                tags.append(f"{rule_prefix}_OPTIONAL:PRESENT")
                
        if val is None or val_str.strip() == "":
            continue # Skip remaining rules if empty (already caught by REQUIRED:INVALID)
            
        # 2. Format / Type Checks
        ftype = field.get("type", "string")
        regex = field.get("regex")
        format_valid = True
        
        if regex:
            try:
                if not re.search(regex, val_str):
                    format_valid = False
            except re.error:
                pass
        else:
            if ftype == "email":
                if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", val_str): format_valid = False
            elif ftype == "card":
                if not re.match(r"^\d{16}$", val_str): format_valid = False
            elif ftype == "phone":
                if not re.match(r"^(03|05|07|08|09)\d{8}$", val_str): format_valid = False
            elif ftype == "date":
                if not is_valid_iso_date(val_str): format_valid = False
            elif ftype == "number":
                try:
                    float(val)
                except (ValueError, TypeError):
                    format_valid = False

        if format_valid:
            tags.append(f"{rule_prefix}_FORMAT:VALID")
        else:
            tags.append(f"{rule_prefix}_FORMAT:INVALID")
            
        # 3. Allowed Values (Enum checks)
        allowed = field.get("allowedValues")
        if allowed:
            if val_str in [str(a) for a in allowed]:
                tags.append(f"{rule_prefix}_ENUM:VALID")
            else:
                tags.append(f"{rule_prefix}_ENUM:INVALID")
                
        # 4. Range / Length boundaries
        if ftype == "number" and format_valid:
            num = float(val)
            min_v = field.get("minValue")
            max_v = field.get("maxValue")
            
            if min_v is not None:
                if num < min_v: tags.append(f"{rule_prefix}_MIN_VALUE:INVALID")
                elif num == min_v: tags.append(f"{rule_prefix}_MIN_VALUE:BOUNDARY")
                else: tags.append(f"{rule_prefix}_MIN_VALUE:VALID")
            
            if max_v is not None:
                if num > max_v: tags.append(f"{rule_prefix}_MAX_VALUE:INVALID")
                elif num == max_v: tags.append(f"{rule_prefix}_MAX_VALUE:BOUNDARY")
                else: tags.append(f"{rule_prefix}_MAX_VALUE:VALID")
        
        elif ftype != "date":
            length = len(val_str)
            min_l = field.get("minLength")
            max_l = field.get("maxLength")
            
            if min_l is not None:
                if length < min_l: tags.append(f"{rule_prefix}_MIN_LENGTH:INVALID")
                elif length == min_l: tags.append(f"{rule_prefix}_MIN_LENGTH:BOUNDARY")
                elif length == min_l + 1: tags.append(f"{rule_prefix}_MIN_LENGTH:NEAR_BOUNDARY")
                else: tags.append(f"{rule_prefix}_MIN_LENGTH:VALID")
                
            if max_l is not None:
                if length > max_l: tags.append(f"{rule_prefix}_MAX_LENGTH:INVALID")
                elif length == max_l: tags.append(f"{rule_prefix}_MAX_LENGTH:BOUNDARY")
                elif length == max_l - 1: tags.append(f"{rule_prefix}_MAX_LENGTH:NEAR_BOUNDARY")
                else: tags.append(f"{rule_prefix}_MAX_LENGTH:VALID")
                
    return tags
