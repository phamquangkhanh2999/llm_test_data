def evaluate_constraints(test_case: dict, constraints: list) -> float:
    """
    Evaluates how well a test case adheres to cross-field conditional constraints.
    Returns a score from 0.0 to 1.0.
    """
    if not constraints:
        return 1.0
        
    data = test_case.get("data", test_case)
    total_applicable = 0
    satisfied_count = 0
    
    for c in constraints:
        when_clause = c.get("when", {})
        then_clause = c.get("then", {})
        
        if not when_clause or not then_clause:
            continue
            
        src_field = when_clause.get("field")
        src_op = when_clause.get("operator")
        src_val_expected = when_clause.get("value")
        
        actual_src_val = data.get(src_field)
        
        # Check if condition applies
        condition_met = False
        if src_op == "equal" and str(actual_src_val) == str(src_val_expected):
            condition_met = True
        elif src_op == "not_equal" and str(actual_src_val) != str(src_val_expected):
            condition_met = True
            
        if condition_met:
            total_applicable += 1
            tgt_field = then_clause.get("field")
            tgt_op = then_clause.get("operator")
            tgt_val_expected = then_clause.get("value")
            
            actual_tgt_val = data.get(tgt_field)
            
            is_satisfied = False
            if tgt_op == "equal" and str(actual_tgt_val) == str(tgt_val_expected):
                is_satisfied = True
            elif tgt_op == "required" and actual_tgt_val:
                is_satisfied = True
                
            if is_satisfied:
                satisfied_count += 1
                
    if total_applicable == 0:
        return 1.0
        
    return satisfied_count / total_applicable
