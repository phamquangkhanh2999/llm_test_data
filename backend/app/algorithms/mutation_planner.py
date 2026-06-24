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
    def _semantic_pad(base_str: str, target_len: int, is_email: bool = False) -> str:
        import random
        if len(base_str) >= target_len:
            return base_str
            
        if is_email:
            parts = base_str.split('@')
            if len(parts) == 2:
                needed = target_len - len(base_str)
                # Nối hậu tố chữ-số SẠCH vào phần local của email (đọc được, không marketing-word)
                ext = "".join(str(i % 10) for i in range(needed))
                return parts[0] + ext + '@' + parts[1]

        # Nối SẠCH bằng cách lặp lại chính nội dung gốc (giữ chuỗi đọc được, không "đáng sợ")
        seed = base_str.strip() or "Du lieu mau"
        out = base_str
        while len(out) < target_len:
            out += " " + seed
        return out[:target_len].rstrip()[:target_len] if len(out) > target_len else out[:target_len]
        
    @staticmethod
    def _semantic_truncate(base_str: str, target_len: int) -> str:
        if len(base_str) <= target_len:
            return base_str
        # Try to cut at word boundary if possible, else just cut string
        cut = base_str[:target_len]
        return cut
    
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
            
            # Semantic string mutation
            new_val = current_val
            max_len = field_schema.get("maxLength", 100)
            is_email = "email" in semantic_type
            
            if "maxLength" in target or action == "approach_boundary":
                new_val = MutationExecutor._semantic_pad(new_val, max_len, is_email)
            elif "minLength" in target:
                min_len = field_schema.get("minLength", 1)
                new_val = MutationExecutor._semantic_truncate(new_val, max_len if max_len < min_len else min_len)
            elif action == "incremental_step" and hc_step:
                if "chars" in hc_step:
                    try:
                        num_str = hc_step.split(' ')[0]
                        num = int(num_str)
                        if num > 0:
                            target_len = min(len(new_val) + num, max_len)
                            new_val = MutationExecutor._semantic_pad(new_val, target_len, is_email)
                        else:
                            chars_to_remove = abs(num)
                            target_len = max(len(new_val) - chars_to_remove, 1)
                            new_val = MutationExecutor._semantic_truncate(new_val, target_len)
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
                
                # Semantic string mutation
                new_val = current_val
                max_len = field_schema.get("maxLength", 100)
                is_email = "email" in semantic_type
                
                if "maxLength" in target or action == "approach_boundary":
                    new_val = MutationExecutor._semantic_pad(new_val, max_len, is_email)
                elif "minLength" in target:
                    min_len = field_schema.get("minLength", 1)
                    new_val = MutationExecutor._semantic_truncate(new_val, max_len if max_len < min_len else min_len)
                elif action == "incremental_step" and hc_step:
                    if "chars" in hc_step:
                        try:
                            # e.g. "+5 chars", "-2 chars"
                            num_str = hc_step.split(' ')[0]
                            num = int(num_str)
                            if num > 0:
                                target_len = min(len(new_val) + num, max_len)
                                new_val = MutationExecutor._semantic_pad(new_val, target_len, is_email)
                            else:
                                chars_to_remove = abs(num)
                                target_len = max(len(new_val) - chars_to_remove, 1)
                                new_val = MutationExecutor._semantic_truncate(new_val, target_len)
                        except:
                            pass
                            
                results[idx][field_name] = new_val
                
        return results
