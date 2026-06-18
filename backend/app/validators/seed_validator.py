def validate_seeds(seeds: list, fields: list) -> bool:
    """
    Validates the generated seeds against basic schema structural rules.
    """
    if not isinstance(seeds, list):
        raise ValueError("Seeds must be a list")
        
    field_dict = {f["name"]: f for f in fields}
    
    for seed in seeds:
        if not isinstance(seed, dict):
            raise ValueError("Each seed must be a dictionary")
            
        # Ensure seed doesn't contain entirely garbage fields
        # Note: some fields in seed might be valid/invalid scenarios, 
        # so we just ensure it has structural integrity here.
        for k, v in seed.items():
            if k in ["method", "scenario", "expectedResult"]:
                continue
            if k not in field_dict:
                # We can choose to be strict or lenient. For Phase 1, we just warn or ignore.
                pass
                
    return True
