import random
from typing import Dict, Any, List

class MutationPlanner:
    """
    Mutation Planner: Không trực tiếp sửa giá trị, mà tạo ra kế hoạch (Plan)
    để LLM (Semantic Provider) sinh giá trị mới.
    """
    
    @staticmethod
    def plan_mutation(field_name: str, schema: List[Dict[str, Any]], fitness_res=None, hc_step=None) -> Dict[str, Any]:
        """
        Nhận vào thông tin field, schema, và fitness feedback (từ GA hoặc HC).
        Trả về một Kế hoạch đột biến (Mutation Plan).
        """
        field_schema = next((f for f in schema if f["name"] == field_name), None)
        if not field_schema:
            return None

        # Trích xuất weak point của field này từ fitness
        weak_point = None
        if fitness_res and hasattr(fitness_res, "weak_points"):
            for wp in fitness_res.weak_points:
                if wp.get("field") == field_name:
                    weak_point = wp
                    break

        ftype = field_schema.get("type", "string")
        semantic_type = field_schema.get("semantic_type", ftype)
        
        # Action và Target cơ bản
        action = "explore_random"
        target = "unknown"
        strategy = "semantic_mutate"
        
        if weak_point:
            issue = weak_point.get("issue")
            if issue == "far_from_boundary":
                action = "approach_boundary"
                target = str(weak_point.get("target"))
            elif issue == "missing_rule_coverage":
                action = "cover_missing_rule"
                target = str(weak_point.get("rule", "unknown"))
                
        # Nếu HC (Hill Climbing) gọi, nó truyền thêm step size
        if hc_step is not None:
            action = "incremental_step"
            strategy = "semantic_extend"
            target = f"{hc_step}"
            
        plan = {
            "field": field_name,
            "action": action,
            "target": target,
            "strategy": strategy,
            "constraints": [
                "preserve_schema",
                "keep_realistic"
            ]
        }
        
        # Thêm constraints đặc thù
        if semantic_type == "email" or field_name.lower() == "email":
            plan["constraints"].append("must_be_valid_email")
        elif ftype == "string" and "password" in field_name.lower():
            plan["constraints"].extend(["keep_password_rules", "allow_random_append"])
            plan["strategy"] = "password_extend"
        elif semantic_type == "phone" or field_name.lower() == "phone":
            plan["constraints"].append("only_valid_phone_digits")
            
        return plan

_MUTATION_CACHE: Dict[str, Any] = {}

class MutationExecutor:
    """Thực thi Kế hoạch Đột biến do MutationPlanner tạo ra"""
    
    @staticmethod
    def execute(values: Dict[str, Any], schema: List[Dict[str, Any]], fitness_res=None, hc_step=None, llm_provider="gemini", api_key_override=None) -> Dict[str, Any]:
        mutated_values = dict(values)
        weak_points = getattr(fitness_res, "weak_points", []) if fitness_res else []
        
        if not weak_points:
            import random
            from .mutation_engine.guided_mutator import GuidedMutator
            GuidedMutator._blind_mutate(mutated_values, schema)
            return mutated_values

        import random
        target_wp = random.choice(weak_points)
        field_name = target_wp.get("field")
        if not field_name:
            return mutated_values
            
        field_schema = next((f for f in schema if f["name"] == field_name), None)
        if not field_schema:
            return mutated_values

        plan = MutationPlanner.plan_mutation(field_name, schema, fitness_res, hc_step)
        if not plan:
            return mutated_values
            
        ftype = field_schema.get("type", "string")
        semantic_type = field_schema.get("semantic_type", ftype)
        is_semantic = (semantic_type in ["email", "phone", "name", "address"] or (ftype == "string" and "allowedValues" not in field_schema))
        
        if not is_semantic:
            from .mutation_engine.guided_mutator import GuidedMutator
            if ftype == "number":
                GuidedMutator._mutate_number(mutated_values, field_schema, target_wp.get("target"))
            elif ftype == "date":
                GuidedMutator._mutate_date(mutated_values, field_schema)
            elif field_schema.get("allowedValues"):
                GuidedMutator._mutate_enum(mutated_values, field_schema)
        else:
            current_val = str(mutated_values.get(field_name, ""))
            action = plan.get('action', '')
            target = str(plan.get('target', ''))
            
            # Fast programmatic string mutation (No LLM)
            new_val = current_val
            max_len = field_schema.get("maxLength", 100)
            
            if "maxLength" in target or action == "approach_boundary":
                if len(new_val) < max_len:
                    if "email" in semantic_type:
                        parts = new_val.split('@')
                        if len(parts) == 2:
                            needed = max_len - len(new_val)
                            new_val = parts[0] + 'b'*needed + '@' + parts[1]
                        else:
                            new_val = new_val.ljust(max_len, 'b')
                    else:
                        new_val = new_val.ljust(max_len, 'b')
            elif "minLength" in target:
                min_len = field_schema.get("minLength", 1)
                if len(new_val) > min_len:
                    new_val = new_val[:min_len-1]
            elif action == "incremental_step" and hc_step:
                if "chars" in hc_step:
                    try:
                        num_str = hc_step.split(' ')[0]
                        num = int(num_str)
                        if num > 0:
                            chars_to_add = min(num, max_len - len(new_val))
                            if chars_to_add > 0:
                                if "email" in semantic_type:
                                    parts = new_val.split('@')
                                    if len(parts) == 2:
                                        new_val = parts[0] + 'b'*chars_to_add + '@' + parts[1]
                                    else:
                                        new_val += 'b'*chars_to_add
                                else:
                                    new_val += 'b'*chars_to_add
                        else:
                            chars_to_remove = abs(num)
                            if len(new_val) > chars_to_remove:
                                new_val = new_val[:-chars_to_remove]
                    except:
                        pass
                        
            mutated_values[field_name] = new_val
            
        return mutated_values

    @staticmethod
    def batch_execute(population_mutations: List[Dict[str, Any]], schema: List[Dict[str, Any]], llm_provider="gemini", api_key_override=None, batch_size=20) -> List[Dict[str, Any]]:
        """
        Nhận vào 1 danh sách các yêu cầu đột biến:
        [
            {
                "index": i,
                "values": dict,
                "fitness_res": obj,
                "hc_step": str (optional)
            },
            ...
        ]
        
        Trả về danh sách kết quả mutated_values tương ứng.
        Các đột biến non-semantic sẽ được chạy local ngay.
        Các đột biến semantic sẽ được xử lý chương trình.
        """
        import random
        import hashlib
        import json
        from .mutation_engine.guided_mutator import GuidedMutator
        
        results = [dict(req["values"]) for req in population_mutations]
        
        for idx, req in enumerate(population_mutations):
            values = req["values"]
            fitness_res = req.get("fitness_res")
            hc_step = req.get("hc_step")
            
            weak_points = getattr(fitness_res, "weak_points", []) if fitness_res else []
            
            if not weak_points:
                GuidedMutator._blind_mutate(results[idx], schema)
                continue
                
            target_wp = random.choice(weak_points)
            field_name = target_wp.get("field")
            if not field_name:
                continue
                
            field_schema = next((f for f in schema if f["name"] == field_name), None)
            if not field_schema:
                continue
                
            plan = MutationPlanner.plan_mutation(field_name, schema, fitness_res, hc_step)
            if not plan:
                continue
                
            ftype = field_schema.get("type", "string")
            semantic_type = field_schema.get("semantic_type", ftype)
            is_semantic = (semantic_type in ["email", "phone", "name", "address"] or (ftype == "string" and "allowedValues" not in field_schema))
            
            if not is_semantic:
                if ftype == "number":
                    GuidedMutator._mutate_number(results[idx], field_schema, target_wp.get("target"))
                elif ftype == "date":
                    GuidedMutator._mutate_date(results[idx], field_schema)
                elif field_schema.get("allowedValues"):
                    GuidedMutator._mutate_enum(results[idx], field_schema)
            else:
                current_val = str(values.get(field_name, ""))
                action = plan.get('action', '')
                target = str(plan.get('target', ''))
                
                # Fast programmatic string mutation (No LLM)
                new_val = current_val
                max_len = field_schema.get("maxLength", 100)
                
                if "maxLength" in target or action == "approach_boundary":
                    if len(new_val) < max_len:
                        if "email" in semantic_type:
                            parts = new_val.split('@')
                            if len(parts) == 2:
                                needed = max_len - len(new_val)
                                new_val = parts[0] + 'b'*needed + '@' + parts[1]
                            else:
                                new_val = new_val.ljust(max_len, 'b')
                        else:
                            new_val = new_val.ljust(max_len, 'b')
                elif "minLength" in target:
                    min_len = field_schema.get("minLength", 1)
                    if len(new_val) > min_len:
                        new_val = new_val[:min_len-1]
                elif action == "incremental_step" and hc_step:
                    if "chars" in hc_step:
                        try:
                            # e.g. "+5 chars", "-2 chars"
                            num_str = hc_step.split(' ')[0]
                            num = int(num_str)
                            if num > 0:
                                chars_to_add = min(num, max_len - len(new_val))
                                if chars_to_add > 0:
                                    if "email" in semantic_type:
                                        parts = new_val.split('@')
                                        if len(parts) == 2:
                                            new_val = parts[0] + 'b'*chars_to_add + '@' + parts[1]
                                        else:
                                            new_val += 'b'*chars_to_add
                                    else:
                                        new_val += 'b'*chars_to_add
                            else:
                                chars_to_remove = abs(num)
                                if len(new_val) > chars_to_remove:
                                    new_val = new_val[:-chars_to_remove]
                        except:
                            pass
                            
                results[idx][field_name] = new_val
                
        return results
