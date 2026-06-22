def compute_rule_coverage(values: dict, schema: list) -> tuple[float, list]:
    total_rules = 0
    covered_rules = 0
    missing_rules = []

    from .quality_classifier import classify_quality, InvalidType

    for field in schema:
        name = field["name"]
        val = values.get(name)
        val_str = str(val) if val is not None else ""
        ftype = field.get("type", "string")

        # Required
        if field.get("required"):
            total_rules += 1
            if val is not None and val_str.strip() != "":
                covered_rules += 1
            else:
                missing_rules.append(f"{name}.required")

        # Format / Enum
        if field.get("regex") or ftype in ["email", "phone", "date", "card"] or field.get("allowedValues"):
            total_rules += 1
            status_res = classify_quality(val_str, field)
            status = status_res.status
            if status not in [InvalidType.INVALID_FORMAT, InvalidType.INVALID_TYPE, InvalidType.INVALID_ENUM]:
                covered_rules += 1
            else:
                missing_rules.append(f"{name}.format_or_enum")

        # Boundaries
        if ftype == "number":
            num = None
            try:
                num = float(val_str)
            except:
                pass
            
            min_v = field.get("minValue")
            if min_v is not None:
                total_rules += 1
                # Cover if within 10% margin
                margin = max(1.0, abs(min_v)) * 0.1
                if num is not None and abs(num - min_v) <= margin:
                    covered_rules += 1
                else:
                    missing_rules.append(f"{name}.minValue")
                    
            max_v = field.get("maxValue")
            if max_v is not None:
                total_rules += 1
                margin = max(1.0, abs(max_v)) * 0.1
                if num is not None and abs(num - max_v) <= margin:
                    covered_rules += 1
                else:
                    missing_rules.append(f"{name}.maxValue")
                    
        elif ftype != "date":
            length = len(val_str)
            min_l = field.get("minLength")
            if min_l is not None:
                total_rules += 1
                margin = max(1.0, min_l) * 0.2
                if abs(length - min_l) <= margin:
                    covered_rules += 1
                else:
                    missing_rules.append(f"{name}.minLength")
                    
            max_l = field.get("maxLength")
            if max_l is not None:
                total_rules += 1
                margin = max(1.0, max_l) * 0.2
                if abs(length - max_l) <= margin:
                    covered_rules += 1
                else:
                    missing_rules.append(f"{name}.maxLength")

    coverage_score = (covered_rules / total_rules) * 100 if total_rules > 0 else 100.0
    return coverage_score, missing_rules
