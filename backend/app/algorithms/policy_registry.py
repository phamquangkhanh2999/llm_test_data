def resolve_policy(field: dict) -> str:
    """
    Phân giải chính sách đột biến (Mutation Policy) theo thứ tự ưu tiên:
    1. Explicit policy
    2. Semantic Type
    3. Heuristic Field Name
    4. Datatype Fallback
    """
    # 1. Explicit mutation policy
    if field.get("mutation_policy"):
        return field["mutation_policy"].lower()
        
    semantic_type = field.get("semantic_type", "").lower()
    field_name = field.get("name", "").lower()
    data_type = field.get("type", "").lower()
    
    # 2. Semantic Type
    freeze_semantics = ["entity_name", "entity_description", "company_name", "address", "full_name", "username"]
    if semantic_type in freeze_semantics:
        return "freeze"
        
    if semantic_type == "email" or semantic_type == "phone":
        return "format_preserving"
        
    if semantic_type == "password":
        return "constraint_preserving"
        
    if semantic_type in ["numeric_boundary", "price", "quantity", "age"]:
        return "boundary"
        
    # 3. Heuristic Field Name (If semantic type is missing or generic)
    freeze_keywords = ["name", "desc", "id", "code", "sku", "category", "title"]
    if any(kw in field_name for kw in freeze_keywords):
        return "freeze"
        
    if "email" in field_name:
        return "format_preserving"
        
    # 4. Datatype Fallback
    if data_type in ["number", "integer", "float", "date", "datetime"]:
        return "boundary"
        
    if field.get("regex") or field.get("allowedValues"):
        return "constraint_preserving"
        
    return "heuristic_safe"
