def validate_rules(data: dict) -> bool:
    """
    Validates the normalized Rule Engine format.
    Expects { "rules": [...], "constraints": [...] }
    """
    if not isinstance(data, dict):
        raise ValueError("Root object must be a dictionary")
        
    rules = data.get("rules", [])
    if not isinstance(rules, list):
        raise ValueError("'rules' must be a list")
    
    for r in rules:
        if not r.get("rule_id") or not r.get("field"):
            raise ValueError("Each rule must have 'rule_id' and 'field'")
            
    constraints = data.get("constraints", [])
    if not isinstance(constraints, list):
        raise ValueError("'constraints' must be a list")
        
    for c in constraints:
        if not c.get("constraint_id") or not c.get("when") or not c.get("then"):
            raise ValueError("Each constraint must have 'constraint_id', 'when', 'then'")
            
    return True
