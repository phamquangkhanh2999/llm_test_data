import os
import json
import random
from sqlalchemy.orm import Session
from .ai_logger import log_ai_call
from ..validators.rule_validator import validate_rules
from ..validators.schema_validator import validate_schema
from ..validators.seed_validator import validate_seeds
from .llm_client import call_llm_json
from ..engines.fitness_engine import calculate_dataset_fitness
from .prompts import get_extract_rules_prompt, get_generate_schema_prompt, get_generate_initial_population_prompt, get_generate_seeds_prompt, get_evaluate_test_quality_prompt, get_evaluate_optimized_prompt, get_parse_spec_combined_prompt
from ..algorithms.optimizer_engine import is_valid_iso_date, random_valid_date

def check_record_expected_result(record, fields):
    import re
    errors = []
    for f in fields:
        name = f["name"]
        val = record.get(name)
        ftype = f.get("semantic_type") or f.get("data_type", "string")
        required = f.get("required", False)
        
        if required and (val is None or str(val).strip() == ""):
            errors.append(f"thiếu '{name}'")
            continue
        if val is None or str(val).strip() == "": continue
            
        val_str = str(val)
        field_regex = f.get("regex")
        if field_regex:
            try:
                if not re.search(field_regex, val_str): errors.append(f"'{name}' không khớp định dạng quy định (regex)")
            except re.error: pass
        elif ftype == "email":
            if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", val_str): errors.append(f"'{name}' sai định dạng email")
        elif ftype == "card":
            if not re.match(r"^\d{16}$", val_str): errors.append(f"'{name}' phải gồm 16 chữ số")
        elif ftype == "phone":
            if not re.match(r"^(03|05|07|08|09)\d{8}$", val_str): errors.append(f"'{name}' sai đầu số di động VN")
        elif ftype == "date":
            if not is_valid_iso_date(val_str): errors.append(f"'{name}' sai định dạng ngày (YYYY-MM-DD)")
        elif ftype == "number":
            try:
                num = float(val)
                min_v = f.get("minValue")
                max_v = f.get("maxValue")
                if min_v is not None and num < float(min_v): errors.append(f"'{name}' nhỏ hơn {min_v}")
                if max_v is not None and num > float(max_v): errors.append(f"'{name}' lớn hơn {max_v}")
            except: errors.append(f"'{name}' không phải số")
        else:
            if f.get("allowedValues") and f["allowedValues"]:
                if val_str not in [str(v) for v in f["allowedValues"]]: errors.append(f"'{name}' không nằm trong danh sách cho phép")
            else:
                min_l = f.get("minLength")
                max_l = f.get("maxLength")
                if min_l is not None and len(val_str) < int(min_l): errors.append(f"'{name}' ngắn hơn {min_l} ký tự")
                if max_l is not None and len(val_str) > int(max_l): errors.append(f"'{name}' vượt quá {max_l} ký tự")
    if errors: return "Lỗi: " + ", ".join(errors)
    return "Hợp lệ"

def enrich_result_with_expected_results(parsed_result):
    if parsed_result and "initialPopulation" in parsed_result:
        fields = parsed_result.get("fields", [])
        seeds = parsed_result.get("initialPopulation", [])
        for seed in seeds:
            if "expectedResult" not in seed:
                seed["expectedResult"] = check_record_expected_result(seed, fields)
    return parsed_result

# (Keeping local generation out for brevity or putting a simplified version, but let's copy the real one to be safe)
def generate_seeds_locally(fields: list, test_method: str, boundary_count: int, partition_count: int) -> list:
    """
    Generates a realistic set of initial seeds locally using standard python algorithms
    """
    population = []
    
    # Helper to generate random/default value for a field
    def get_default_value(field, mode='valid', length=None):
        t = field.get("type", "string")
        if t == "email":
            if mode == 'invalid':
                return "invalid-email"
            if length is not None:
                # Tạo email đúng độ dài yêu cầu
                suffix = "@gmail.com"
                if length <= len(suffix):
                    return "a" * length
                return "a" * (length - len(suffix)) + suffix
            return f"test{random.randint(10,99)}@gmail.com"
        elif t == "card":
            if mode == 'invalid':
                return "1234-invalid"
            if length is not None:
                return "".join(str(random.randint(0,9)) for _ in range(length))
            return "".join(str(random.randint(0,9)) for _ in range(16))
        elif t == "phone":
            if mode == 'invalid':
                return "028123"
            if length is not None:
                if length <= 2:
                    return "09"[:length]
                return "09" + "".join(str(random.randint(0,9)) for _ in range(length - 2))
            return "09" + "".join(str(random.randint(0,9)) for _ in range(8))
        elif t == "date":
            if mode == 'invalid':
                return random.choice(["2024-13-01", "2024-02-30", "not-a-date", "2024/01/01"])
            if mode == 'boundary':
                return random.choice(["2024-02-29", "2020-01-01", "2023-12-31", "2024-04-30"])
            return random_valid_date()
        elif t == "number":
            try:
                min_val = field.get("minValue")
                max_val = field.get("maxValue")
                min_val = float(min_val) if min_val is not None else 0.0
                max_val = float(max_val) if max_val is not None else 1000.0
            except (ValueError, TypeError):
                min_val, max_val = 0.0, 1000.0

            is_float = not min_val.is_integer() or not max_val.is_integer()
            if mode == 'invalid':
                offset = 5.0 if is_float else 5
                return min_val - offset if random.random() > 0.5 else max_val + offset
            if length is not None:
                return length

            if is_float:
                return random.uniform(min_val, max_val)
            else:
                return random.randint(int(min_val), int(max_val))
        else: # string
            min_len = int(field.get("minLength", 3) or 3)
            max_len = int(field.get("maxLength", 20) or 20)
            if field.get("allowedValues"):
                if mode == 'invalid':
                    return "INVALID_VAL"
                return random.choice(field["allowedValues"])
            
            # Check if this is a password field
            name_lower = field.get("name", "").lower()
            desc_lower = field.get("description", "").lower()
            if "pass" in name_lower or "mật khẩu" in desc_lower:
                if mode == 'invalid':
                    return "123"
                actual_len = length if length is not None else random.randint(min_len, max_len)
                if actual_len < 4:
                    actual_len = 4
                u = random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
                l = random.choice("abcdefghijklmnopqrstuvwxyz")
                d = random.choice("0123456789")
                s = random.choice("!@#$%^&*")
                remaining = actual_len - 4
                chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
                rest = "".join(random.choice(chars) for _ in range(remaining))
                pw = list(u + l + d + s + rest)
                random.shuffle(pw)
                return "".join(pw)
            
            actual_len = length if length is not None else random.randint(min_len, max_len)
            if mode == 'invalid' and length is None:
                actual_len = max(0, min_len - 2) if random.random() > 0.5 else max_len + 5
                
            if actual_len == 0:
                return ""
            chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
            return "".join(random.choice(chars) for _ in range(actual_len))

    # =========================================================================
    # [BVA - PHÂN TÍCH GIÁ TRỊ BIÊN] KHỞI TẠO BỘ TẬP DỮ LIỆU KIỂM THỬ BAN ĐẦU (SEEDS)
    # =========================================================================
    if test_method == "bva":
        field_targets = {}
        for f in fields:
            name = f["name"]
            ftype = f.get("semantic_type") or f.get("data_type", "string")
            targets = []
            
            def get_bva_offsets(b_count, is_min=True):
                if b_count == 2:
                    return [-1, 0] if is_min else [0, 1]
                elif b_count == 3:
                    return [-1, 0, 1]
                elif b_count == 5:
                    return [-2, -1, 0, 1, 2]
                else:
                    half = b_count // 2
                    return list(range(-half, half + 1))

            if ftype == "number":
                min_v = f.get("minValue")
                max_v = f.get("maxValue")
                if min_v is not None:
                    for o in get_bva_offsets(boundary_count, is_min=True):
                        targets.append(min_v + o)
                if max_v is not None:
                    for o in get_bva_offsets(boundary_count, is_min=False):
                        targets.append(max_v + o)
            elif ftype in ["string", "email", "card", "phone"]:
                min_l = f.get("minLength")
                max_l = f.get("maxLength")
                if min_l is not None:
                    for o in get_bva_offsets(boundary_count, is_min=True):
                        targets.append(max(0, min_l + o))
                if max_l is not None:
                    for o in get_bva_offsets(boundary_count, is_min=False):
                        targets.append(max(0, max_l + o))
            
            if targets:
                field_targets[name] = sorted(list(set(targets)))
            else:
                field_targets[name] = []

        max_targets = max([len(t) for t in field_targets.values()] or [1])
        num_records = max(25, max_targets)

        for i in range(num_records):
            record = {}
            scenarios = []
            for f in fields:
                name = f["name"]
                ftype = f.get("semantic_type") or f.get("data_type", "string")
                targets = field_targets.get(name, [])

                if targets:
                    target_val = targets[i % len(targets)]
                    if ftype == "number":
                        record[name] = target_val
                        scenarios.append(f"{name}={target_val} (biên số)")
                    else:
                        record[name] = get_default_value(f, length=target_val)
                        scenarios.append(f"{name} độ dài={target_val} (biên chuỗi)")
                else:
                    mode = 'boundary' if i % 2 == 0 else 'valid'
                    record[name] = get_default_value(f, mode=mode)
                    if mode == 'boundary':
                        scenarios.append(f"{name} ngẫu nhiên (biên)")
            
            record["method"] = "bva"
            record["scenario"] = f"Phân tích biên BVA: " + ", ".join(scenarios[:3])
            population.append(record)

    # EP local generator
    elif test_method == "ep":
        field_targets = {}
        for f in fields:
            name = f["name"]
            ftype = f.get("semantic_type") or f.get("data_type", "string")
            targets = []
            
            if ftype == "number":
                min_v = f.get("minValue", 0)
                max_v = f.get("maxValue", 1000)
                step = (max_v - min_v) / max(1, partition_count)
                for p in range(partition_count):
                    start = min_v + p * step
                    end = min_v + (p + 1) * step
                    mid = int((start + end) / 2)
                    targets.append(mid)
                targets.append(min_v - 3)
                targets.append(max_v + 3)
            elif ftype in ["string", "email", "card", "phone"]:
                min_l = f.get("minLength", 3 if ftype == "string" else (16 if ftype == "card" else (10 if ftype == "phone" else 5)))
                max_l = f.get("maxLength", 20 if ftype == "string" else (16 if ftype == "card" else (10 if ftype == "phone" else 50)))
                if min_l is None: min_l = 3
                if max_l is None: max_l = 20
                step = (max_l - min_l) / max(1, partition_count)
                for p in range(partition_count):
                    start = min_l + p * step
                    end = min_l + (p + 1) * step
                    mid = max(0, int((start + end) / 2))
                    targets.append(mid)
                targets.append(max(0, min_l - 2))
                targets.append(max_l + 4)
                
            if targets:
                field_targets[name] = sorted(list(set(targets)))
            else:
                field_targets[name] = []

        max_targets = max([len(t) for t in field_targets.values()] or [1])
        num_records = max(20, max_targets)
        for i in range(num_records):
            record = {}
            scenarios = []
            for f in fields:
                name = f["name"]
                ftype = f.get("semantic_type") or f.get("data_type", "string")
                targets = field_targets.get(name, [])
                if targets:
                    target_val = targets[i % len(targets)]
                    if ftype == "number":
                        record[name] = target_val
                        scenarios.append(f"{name}={target_val} (phân vùng số)")
                    else:
                        record[name] = get_default_value(f, length=target_val)
                        scenarios.append(f"{name} độ dài={target_val} (phân vùng chuỗi)")
                else:
                    mode = 'invalid' if i % 4 == 0 else 'valid'
                    record[name] = get_default_value(f, mode=mode)
                    if mode == 'invalid':
                        scenarios.append(f"{name} không hợp lệ")
            
            record["method"] = "ep"
            record["scenario"] = f"Phân vùng tương đương EP: " + ", ".join(scenarios[:3])
            population.append(record)

    # Decision Table local generator
    elif test_method == "decision":
        num_records = len(fields) + 15
        for i in range(num_records):
            record = {}
            scenario = ""
            for idx, f in enumerate(fields):
                name = f["name"]
                if i - 1 == idx:
                    record[name] = get_default_value(f, mode='invalid')
                    scenario = f"Kiểm thử lỗi validation của trường: {name}"
                elif i == 0:
                    record[name] = get_default_value(f, mode='valid')
                    scenario = "Kịch bản thành công (Happy path) - Tất cả các trường hợp hợp lệ"
                elif i == num_records - 1:
                    record[name] = get_default_value(f, mode='valid')
                    scenario = "Kiểm thử kịch bản thành công bổ sung"
                elif i == num_records - 2:
                    record[name] = get_default_value(f, mode='invalid')
                    scenario = "Kiểm thử biên lỗi kết hợp"
                else:
                    record[name] = get_default_value(f, mode='valid')
            
            if not scenario:
                scenario = "Phân tích bảng quyết định - Kiểm thử nghiệp vụ kết hợp"
                
            record["method"] = "decision"
            record["scenario"] = scenario
            population.append(record)

    # Random/Hybrid
    else:
        modes = ['valid', 'valid', 'valid', 'boundary', 'boundary', 'invalid', 'valid', 'boundary']
        for i in range(25):
            record = {}
            mode = modes[i % len(modes)]
            for f in fields:
                name = f["name"]
                record[name] = get_default_value(f, mode=mode)
            
            mode_desc = {
                'valid': "Dữ liệu hợp lệ ngẫu nhiên",
                'boundary': "Dữ liệu biên ngẫu nhiên",
                'invalid': "Định dạng không hợp lệ"
            }.get(mode, "Kiểm thử ngẫu nhiên")
            
            record["method"] = "random"
            record["scenario"] = f"Ngẫu nhiên/Lai ghép: {mode_desc}"
            population.append(record)

    return population

def generate_seeds(fields: list, test_method: str, boundary_count: int = 4, partition_count: int = 3, api_key: str = None, raw_text: str = "", db: Session = None) -> list:
    """
    Main entrypoint to generate seeds based on selected test method (AI-powered or local fallback).
    """
    active_key = api_key if api_key else (os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY"))
    
    if not active_key or active_key.strip() == "":
        print(f">>> INFO: No API key found. Running local seed generator for method '{test_method}'...")

def parse_spec_with_ai(raw_text: str, api_key_override: str = None, llm_provider: str = "gemini", db: Session = None) -> dict:
    import time as _time
    t_total = _time.time()
    print(f"\n{'='*60}", flush=True)
    print(f">>> [PARSE] Bắt đầu phân tích | Provider: {llm_provider} | Text: {len(raw_text)} chars", flush=True)
    print(f"{'='*60}", flush=True)
    try:
        # STEP 1/2: Combined - Extract Rules + Schema in ONE LLM call (tránh rate limit 429)
        print(f"\n>>> [STEP 1/2] Trích xuất Luật + Schema (Combined Call)...", flush=True)
        t1 = _time.time()
        sys1, usr1 = get_parse_spec_combined_prompt(raw_text)
        combined_result, engine_name, model_name = call_llm_json(sys1, usr1, api_key_override, llm_provider)
        
        # Extract rules and schema from combined result
        rules_data = {
            "rules": combined_result.get("rules", []),
            "constraints": combined_result.get("constraints", []),
            "ambiguities": combined_result.get("ambiguities", [])
        }
        validate_rules(rules_data)
        
        schema_fields = combined_result.get("fields", [])
        # Retrofit: ensure 'type' field exists for validator & frontend
        _SEMANTIC_TYPES = {"email", "card", "phone", "date"}
        for field in schema_fields:
            if not field.get("type"):
                sem = field.get("semantic_type", "")
                dt = field.get("data_type", "string") or "string"
                field["type"] = sem if sem in _SEMANTIC_TYPES else dt
                
            # Quick fix for LLM outputting "numeric" or "integer" instead of "number"
            if field["type"] in ["numeric", "integer", "float"]:
                field["type"] = "number"
        validate_schema(schema_fields)
        
        print(f">>> [STEP 1/2] ✓ Hoàn thành | {len(rules_data['rules'])} rules, {len(schema_fields)} fields | {_time.time()-t1:.1f}s", flush=True)
        
        # STEP 2/2: Generate F0 Seeds
        print(f"\n>>> [STEP 2/2] Sinh Hạt Giống F0 (Initial Seeds)...", flush=True)
        t2 = _time.time()
        schema_result = {"fields": schema_fields}
        sys3, usr3 = get_generate_initial_population_prompt(schema_result, rules_data)
        seeds_result, _, _ = call_llm_json(sys3, usr3, api_key_override, llm_provider)
        print(f">>> [STEP 2/2] ✓ Hoàn thành | {len(seeds_result.get('initialPopulation',[]))} seeds | {_time.time()-t2:.1f}s", flush=True)
        
        # Combine everything
        final_result = {
            "business_rules": rules_data.get("rules", []),
            "constraints": rules_data.get("constraints", []),
            "ambiguities": rules_data.get("ambiguities", []),
            "fields": schema_fields,
            "initialPopulation": seeds_result.get("initialPopulation", []),
            "is_mock": False,
            "engine": engine_name
        }
        
        total = _time.time() - t_total
        print(f"\n>>> [PARSE] ✓ HOÀN TẤT | Tổng: {total:.1f}s | Engine: {engine_name} ({model_name})", flush=True)
        print(f"{'='*60}\n", flush=True)
        
        log_ai_call(db, "/api/specifications", engine_name, model_name, f"Raw: {raw_text[:50]}", json.dumps(final_result, ensure_ascii=False), "SUCCESS")
        return enrich_result_with_expected_results(final_result)
    except Exception as e:
        error_msg = str(e)
        log_ai_call(db, "/api/specifications", "LLM", "unknown", "Error", None, "FAILED", error_message=error_msg)
        raise ValueError(f"AI Error: {error_msg}")
def generate_seeds_with_ai(fields: list, test_method: str, boundary_count: int = 4, partition_count: int = 3, api_key: str = None, raw_text: str = "", db: Session = None) -> list:
    system_instructions, user_prompt_text = get_generate_seeds_prompt(fields, test_method, raw_text)
    prompt_feedback = ""
    for attempt in range(1, 3):
        user_prompt = user_prompt_text
        if prompt_feedback: user_prompt += f"\\n\\nFeedback: {prompt_feedback}"
        try:
            parsed_result, engine_name, model_name = call_llm_json(system_instructions, user_prompt, api_key)
            seeds = parsed_result.get("initialPopulation", [])
            log_ai_call(db, f"/api/generate-seeds?method={test_method}", engine_name, model_name, "Prompt", json.dumps(seeds, ensure_ascii=False), "SUCCESS")
            if seeds: return seeds
        except Exception as e:
            print(f"Attempt {attempt} failed: {e}")
            log_ai_call(db, f"/api/generate-seeds?method={test_method}", "LLM", "unknown", "Prompt", None, "FAILED", error_message=str(e))
    
    print(f">>> INFO: Running local seed generator for method '{test_method}'...")
    seeds = generate_seeds_locally(fields, test_method, boundary_count, partition_count)
    for s in seeds:
        if "expectedResult" not in s: s["expectedResult"] = check_record_expected_result(s, fields)
    return seeds

def evaluate_test_quality_with_ai(fields: list, seeds: list, test_method: str, raw_text: str, api_key_override: str = None, db: Session = None, extracted_rules: list = None, extracted_constraints: list = None) -> dict:
    if extracted_rules is None: extracted_rules = []
    if extracted_constraints is None: extracted_constraints = []
    
    # Deterministic Engine Calculation
    deterministic_metrics = calculate_dataset_fitness(seeds, extracted_rules, extracted_constraints)
    
    system_instructions, user_prompt_text = get_evaluate_test_quality_prompt(fields, seeds, test_method, raw_text, deterministic_metrics)
    try:
        res, engine_name, model_name = call_llm_json(system_instructions, user_prompt_text, api_key_override)
        log_ai_call(db, "/api/evaluate-seeds", engine_name, model_name, "Prompt", json.dumps(res, ensure_ascii=False), "SUCCESS")
        return res
    except Exception as e:
        error_msg = str(e)
        log_ai_call(db, "/api/evaluate-seeds", "LLM", "unknown", "Prompt", None, "FAILED", error_message=error_msg)
        raise ValueError(f"AI Evaluation Error: {error_msg}")
def evaluate_optimized_dataset_with_ai(fields: list, dataset: list, algorithm: str, raw_text: str, api_key_override: str = None, db: Session = None, extracted_rules: list = None, extracted_constraints: list = None) -> dict:
    if extracted_rules is None: extracted_rules = []
    if extracted_constraints is None: extracted_constraints = []
    
    # Deterministic Engine Calculation
    deterministic_metrics = calculate_dataset_fitness(dataset, extracted_rules, extracted_constraints)
    
    system_instructions, user_prompt_text = get_evaluate_optimized_prompt(fields, dataset, algorithm, raw_text, deterministic_metrics)
    try:
        res, engine_name, model_name = call_llm_json(system_instructions, user_prompt_text, api_key_override)
        log_ai_call(db, "/api/evaluate-optimized", engine_name, model_name, "Prompt", json.dumps(res, ensure_ascii=False), "SUCCESS")
        return res
    except Exception as e:
        error_msg = str(e)
        log_ai_call(db, "/api/evaluate-optimized", "LLM", "unknown", "Prompt", None, "FAILED", error_message=error_msg)
        raise ValueError(f"AI Evaluation Error: {error_msg}")

