import random
import string
import hashlib
from typing import Dict, Any, List

# Mutation Cache: hash -> mutated_value
_MUTATION_CACHE: Dict[str, Any] = {}

class GuidedMutator:
    @staticmethod
    def mutate(values: Dict[str, Any], weak_points: List[Dict[str, Any]], schema: List[Dict[str, Any]], fitness_res=None) -> Dict[str, Any]:
        """
        Thực hiện đột biến có định hướng (Guided Mutation).
        Chia làm 2 loại:
        1. Deterministic (Level 1): Các trường số, enum.
        2. Semantic (Level 2): Các trường cần LLM giữ ngữ nghĩa (email, phone, text dài).
        """
        mutated_values = dict(values)
        if not weak_points:
            # Nếu không có điểm yếu, nhặt bừa 1 field để mutate (Deterministic)
            GuidedMutator._blind_mutate(mutated_values, schema)
            return mutated_values

        # Chỉ chọn 1 điểm yếu để mutate cho tập trung
        target = random.choice(weak_points)
        field_name = target.get("field")
        if not field_name:
            return mutated_values
            
        field_schema = next((f for f in schema if f["name"] == field_name), None)
        if not field_schema:
            return mutated_values
            
        # Xác định Semantic vs Deterministic
        ftype = field_schema.get("type", "string")
        semantic_type = field_schema.get("semantic_type", ftype)
        is_semantic_field = (
            semantic_type in ["email", "phone", "name", "address"] or 
            ftype == "string" and "allowedValues" not in field_schema
        )
        
        if not is_semantic_field:
            # Level 1: Deterministic Mutation (Number, Enum, Date)
            if ftype == "number":
                GuidedMutator._mutate_number(mutated_values, field_schema, target.get("target"))
            elif ftype == "date":
                GuidedMutator._mutate_date(mutated_values, field_schema)
            elif field_schema.get("allowedValues"):
                GuidedMutator._mutate_enum(mutated_values, field_schema)
            else:
                GuidedMutator._fallback_mutate_string(mutated_values, field_schema, target.get("target"))
        else:
            # Level 2: Semantic Mutation via LLM (with Cache)
            current_val = str(mutated_values.get(field_name, ""))
            cache_key_raw = f"{field_name}|{current_val}|{str(field_schema)}|{str(target)}"
            cache_key = hashlib.md5(cache_key_raw.encode("utf-8")).hexdigest()
            
            if cache_key in _MUTATION_CACHE:
                mutated_values[field_name] = _MUTATION_CACHE[cache_key]
            else:
                new_val = GuidedMutator._llm_semantic_mutate(field_name, current_val, field_schema, target, fitness_res)
                if new_val is not None:
                    mutated_values[field_name] = new_val
                    _MUTATION_CACHE[cache_key] = new_val
                else:
                    # Fallback nếu LLM lỗi
                    GuidedMutator._fallback_mutate_string(mutated_values, field_schema, target.get("target"))

        return mutated_values

    @staticmethod
    def _llm_semantic_mutate(field_name: str, current_val: str, field_schema: dict, target: dict, fitness_res) -> str:
        """Gọi LLM để thực hiện đột biến ngữ nghĩa, đảm bảo đi tới biên (boundary) mà không phá hỏng semantic"""
        from ...services.ai_service import semantic_mutate_with_llm
        
        try:
            return semantic_mutate_with_llm(
                field_name=field_name,
                current_val=current_val,
                field_schema=field_schema,
                target=target,
                fitness_res=fitness_res
            )
        except Exception as e:
            print(f"LLM Mutation failed for {field_name}: {e}")
            return None

    @staticmethod
    def _mutate_number(values: dict, field: dict, target_val: Any):
        name = field["name"]
        min_v = field.get("minValue")
        max_v = field.get("maxValue")
        
        if target_val is not None:
            try:
                t = float(target_val)
                values[name] = random.choice([t, t - 1, t + 1])
                return
            except: pass
                
        options = []
        if min_v is not None: options.extend([min_v, min_v - 1, min_v + 1])
        if max_v is not None: options.extend([max_v, max_v - 1, max_v + 1])
            
        if options:
            values[name] = random.choice(options)
        else:
            values[name] = random.randint(-1000, 1000)

    @staticmethod
    def _fallback_mutate_string(values: dict, field: dict, target_val: Any):
        name = field["name"]
        min_l = field.get("minLength")
        max_l = field.get("maxLength")
        
        target_len = None
        if target_val and isinstance(target_val, str) and target_val.startswith("len="):
            try: target_len = int(target_val.split("=")[1])
            except: pass
                
        if target_len is None:
            options = []
            if min_l is not None: options.extend([min_l, max(0, min_l - 1), min_l + 1])
            if max_l is not None: options.extend([max_l, max_l - 1, max_l + 1])
            if options: target_len = random.choice(options)
            else: target_len = random.randint(1, 20)
                
        if target_len <= 0:
            values[name] = ""
        else:
            chars = string.ascii_letters + string.digits
            values[name] = "".join(random.choice(chars) for _ in range(target_len))

    @staticmethod
    def _mutate_enum(values: dict, field: dict):
        name = field["name"]
        allowed = field.get("allowedValues", [])
        if allowed:
            if random.random() < 0.8: values[name] = random.choice(allowed)
            else: values[name] = f"INVALID_{random.randint(1, 100)}"
                
    @staticmethod
    def _mutate_date(values: dict, field: dict):
        name = field["name"]
        from datetime import datetime, timedelta
        now = datetime.now()
        offset = random.choice([0, -1, 1, -365, 365])
        target_date = now + timedelta(days=offset)
        values[name] = target_date.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        
    @staticmethod
    def _blind_mutate(values: dict, schema: list):
        if not schema: return
        field = random.choice(schema)
        name = field["name"]
        ftype = field.get("type", "string")
        if ftype == "number":
            values[name] = random.randint(-100, 100)
        elif field.get("allowedValues"):
            GuidedMutator._mutate_enum(values, field)
        else:
            values[name] = "BLIND_MUTATION_" + str(random.randint(1, 1000))
