from .quality_classifier import classify_quality, InvalidType

def compute_schema_correctness(values: dict, schema: list) -> float:
    total_fields = max(1, len(schema))
    req_pass, type_pass, format_pass, semantic_pass, constraint_pass = 0.0, 0.0, 0.0, 0.0, 0.0
    
    for field in schema:
        name = field["name"]
        val = values.get(name)
        status_res = classify_quality(val, field)
        quality = status_res.quality
        
        req_pass += quality.required_score
        type_pass += quality.type_score
        format_pass += quality.format_score
        semantic_pass += quality.semantic_score
        constraint_pass += quality.boundary_score

    schema_score = (
        (req_pass / total_fields) * 0.20 +
        (type_pass / total_fields) * 0.20 +
        (format_pass / total_fields) * 0.20 +
        (semantic_pass / total_fields) * 0.20 +
        (constraint_pass / total_fields) * 0.20
    )
    return schema_score * 100

