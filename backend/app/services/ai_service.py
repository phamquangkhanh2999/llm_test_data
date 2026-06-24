import os
import json
import random
import time
import hashlib
from sqlalchemy.orm import Session
from .ai_logger import log_ai_call
from ..validators.rule_validator import validate_rules
from ..validators.schema_validator import validate_schema
from ..validators.seed_validator import validate_seeds
from .llm_client import call_llm_json
from ..engines.fitness_engine import calculate_dataset_fitness, audit_dataset
from .prompts import get_evaluate_test_quality_prompt, get_evaluate_optimized_prompt, get_parse_spec_combined_prompt
from ..algorithms.optimizer_engine import is_valid_iso_date, random_valid_date

def check_record_expected_result(record, fields):
    """
    Kiểm tra tính hợp lệ của record theo schema.
    Trả về "Hợp lệ" hoặc chuỗi mô tả lỗi để tương thích ngược.
    Sử dụng nội bộ hàm derive_expected_result.
    """
    oracle = derive_expected_result(record, fields)
    if oracle["is_valid"]:
        return "Hợp lệ"
    return "Lỗi: " + ", ".join(oracle["violated_fields_desc"])


def derive_expected_result(record: dict, fields: list) -> dict:
    """
    Expected Result Oracle (GENERIC): suy diễn dữ liệu HỢP LỆ hay BỊ TỪ CHỐI
    hoàn toàn từ ràng buộc trong schema — KHÔNG hard-code, KHÔNG đoán locale.

    Verdict nhị phân (Pass/Fail) + lý do vi phạm. Mọi loại vi phạm (thiếu
    required, sai enum, ngoài range số, sai độ dài, sai charset/định dạng, mã độc)
    đều dẫn tới cùng một trạng thái "Error". KHÔNG còn mã HTTP (200/400/422) ở
    bất kỳ đâu — mã HTTP thật do hệ thống đích quyết định, đoán cứng làm test fail oan.

    Returns:
        {
            "is_valid": bool,            # hợp đồng CHÍNH: True = chấp nhận
            "verdict": str,              # "Success" | "Error"
            "message": str,              # mô tả người đọc được: "Hợp lệ" | "Lỗi: <lý do>"
            "violated_fields": list,     # ["field_name", ...]
            "violated_fields_desc": list # ["'field' sai định dạng email", ...]
        }
    """
    import re as _re
    errors_400 = []   # Business logic / constraint errors → 400
    errors_422 = []   # Format/structural errors → 422
    violated_fields = []
    violated_fields_desc = []

    for f in fields:
        name = f["name"]
        val = record.get(name)
        ftype = f.get("type") or f.get("semantic_type") or f.get("data_type", "string")
        required = f.get("required", False)

        # ── Priority 1: Required field missing ─────────────────────────────────
        if required and (val is None or str(val).strip() == ""):
            errors_400.append(f"thiếu trường bắt buộc '{name}'")
            violated_fields.append(name)
            violated_fields_desc.append(f"thiếu '{name}'")
            continue

        if val is None or str(val).strip() == "":
            continue  # Không bắt buộc, bỏ qua

        val_str = str(val)

        # ── Priority Security: XSS / SQLi payload ────────────────────────────────
        if "<script>" in val_str.lower() or "or 1=1" in val_str.lower() or "drop table" in val_str.lower():
            errors_400.append(f"'{name}' chứa mã độc bảo mật")
            violated_fields.append(name)
            violated_fields_desc.append(f"'{name}' chứa mã độc")
            continue

        # ── Priority 2: Enum invalid ────────────────────────────────────────────
        allowed = f.get("allowedValues")
        if allowed:
            if val_str not in [str(v) for v in allowed]:
                errors_400.append(f"'{name}' không nằm trong danh sách cho phép {allowed}")
                violated_fields.append(name)
                violated_fields_desc.append(f"'{name}' không trong enum list")
                continue

        # ── Priority 3: Number range violation ─────────────────────────────────
        if ftype == "number":
            try:
                num = float(val)
                min_v = f.get("minValue")
                max_v = f.get("maxValue")
                if min_v is not None and num < float(min_v):
                    errors_400.append(f"'{name}' nhỏ hơn giá trị tối thiểu {min_v}")
                    violated_fields.append(name)
                    violated_fields_desc.append(f"'{name}' nhỏ hơn {min_v}")
                elif max_v is not None and num > float(max_v):
                    errors_400.append(f"'{name}' vượt giá trị tối đa {max_v}")
                    violated_fields.append(name)
                    violated_fields_desc.append(f"'{name}' lớn hơn {max_v}")
            except (ValueError, TypeError):
                errors_422.append(f"'{name}' không phải số hợp lệ")
                violated_fields.append(name)
                violated_fields_desc.append(f"'{name}' không phải số")
            continue

        # ── Ràng buộc chuỗi (GENERIC): độ dài + charset + regex, áp dụng ĐỒNG NHẤT ──
        # Khác bản cũ ở 3 điểm để generic cho mọi đề:
        #   (a) KHÔNG loại email/phone/card/date ra khỏi việc kiểm độ dài.
        #   (b) Độ dài được kiểm ĐỘC LẬP với regex (không loại trừ nhau).
        #   (c) Mọi giới hạn cụ thể (độ dài, đầu số, số chữ số) đến từ SCHEMA,
        #       code chỉ giữ kiểm cấu trúc tối thiểu theo type — KHÔNG hard-code locale.
        min_l = f.get("minLength")
        max_l = f.get("maxLength")
        if min_l is not None and len(val_str) < int(min_l):
            errors_400.append(f"'{name}' ngắn hơn {min_l} ký tự")
            violated_fields.append(name)
            violated_fields_desc.append(f"'{name}' ngắn hơn {min_l} ký tự")
            continue
        if max_l is not None and len(val_str) > int(max_l):
            errors_400.append(f"'{name}' vượt quá {max_l} ký tự")
            violated_fields.append(name)
            violated_fields_desc.append(f"'{name}' vượt quá {max_l} ký tự")
            continue

        # Charset policy generic (tùy chọn; thiếu key thì bỏ qua — không phá vỡ schema cũ).
        # Nơi để spec khai báo "không được chứa..." / "chỉ cho phép..." mà không cần
        # nhồi vào regex định dạng.
        forbidden_pat = f.get("forbiddenPattern")
        if forbidden_pat:
            try:
                patched_forbidden = forbidden_pat.replace(r"\p{L}", r"a-zA-ZÀ-ỹđĐ")
                if _re.search(patched_forbidden, val_str):
                    errors_422.append(f"'{name}' chứa ký tự không cho phép")
                    violated_fields.append(name)
                    violated_fields_desc.append(f"'{name}' chứa ký tự bị cấm")
                    continue
            except _re.error:
                pass
        allowed_pat = f.get("allowedPattern")
        if allowed_pat:
            try:
                patched_allowed = allowed_pat.replace(r"\p{L}", r"a-zA-ZÀ-ỹđĐ")
                if not _re.fullmatch(patched_allowed, val_str):
                    errors_422.append(f"'{name}' không khớp tập ký tự cho phép")
                    violated_fields.append(name)
                    violated_fields_desc.append(f"'{name}' sai tập ký tự cho phép")
                    continue
            except _re.error:
                pass

        # Regex định dạng do spec khai báo (độc lập với độ dài đã kiểm ở trên).
        spec_regex = f.get("regex") or f.get("pattern")
        if spec_regex:
            try:
                patched_regex = spec_regex.replace(r"\p{L}", r"a-zA-ZÀ-ỹđĐ")
                if not _re.search(patched_regex, val_str):
                    errors_422.append(f"'{name}' không khớp định dạng quy định")
                    violated_fields.append(name)
                    violated_fields_desc.append(f"'{name}' không khớp regex")
                continue  # đã có regex của spec -> KHÔNG áp default theo type
            except _re.error:
                pass  # regex hỏng trong spec -> rơi xuống default cấu trúc theo type

        # Default theo type — CHỈ kiểm cấu trúc tối thiểu, KHÔNG locale.
        if ftype == "email":
            if not _re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", val_str):
                errors_422.append(f"'{name}' sai định dạng email")
                violated_fields.append(name)
                violated_fields_desc.append(f"'{name}' sai định dạng email")
        elif ftype in ("phone", "card"):
            # Chỉ ràng buộc "toàn chữ số" — độ dài/đầu số do schema quyết định.
            if not _re.fullmatch(r"[0-9]+", val_str):
                errors_422.append(f"'{name}' chỉ được chứa chữ số")
                violated_fields.append(name)
                violated_fields_desc.append(f"'{name}' phải toàn chữ số")
        elif ftype == "date":
            if not is_valid_iso_date(val_str):
                errors_422.append(f"'{name}' sai định dạng ngày ISO (YYYY-MM-DD)")
                violated_fields.append(name)
                violated_fields_desc.append(f"'{name}' sai định dạng ngày ISO (YYYY-MM-DD)")

    # ── Kết luận: Pass/Fail nhị phân + lý do, KHÔNG mã HTTP ───────────────────
    # Hợp đồng cho mọi caller là `is_valid` + `verdict` + lý do vi phạm.
    # Mọi loại vi phạm gộp về một trạng thái "Error" (không 400/422), vì mã HTTP
    # thật do hệ thống đích quyết định — đoán cứng sẽ làm test fail oan.
    errors = errors_400 + errors_422
    if errors:
        return {
            "is_valid": False,
            "verdict": "Error",
            "message": "Lỗi: " + "; ".join(errors),
            "violated_fields": violated_fields,
            "violated_fields_desc": violated_fields_desc,
        }
    return {
        "is_valid": True,
        "verdict": "Success",
        "message": "Hợp lệ - tất cả trường đúng định dạng, độ dài và ràng buộc; hệ thống chấp nhận và tạo tài khoản.",
        "violated_fields": [],
        "violated_fields_desc": [],
    }



def audit_schema_completeness(fields: list) -> list:
    """
    Audit ĐỘ ĐẦY ĐỦ của schema trích xuất (deterministic, không phụ thuộc đề bài).

    Vì oracle (`derive_expected_result`) chỉ mạnh đúng bằng các ràng buộc có trong
    schema, một schema bị extractor đánh rơi maxLength/regex/charset sẽ khiến oracle
    "mù" và gán Success cho dữ liệu thực ra sai. Hàm này bắt sớm các lỗ hổng đó cho
    MỌI spec, trả về danh sách cảnh báo để pipeline/UI surface lại cho người dùng.

    Trả về: list[ {field, severity, code, message} ]
    """
    import re as _re
    warnings = []
    STRING_FAMILY = ("string", "text", "email", "phone", "card", "url", "password")

    for f in fields or []:
        if not isinstance(f, dict) or not f.get("name"):
            continue
        name = f["name"]
        ftype = (f.get("type") or f.get("semantic_type") or f.get("data_type") or "string")
        has_len = f.get("minLength") is not None or f.get("maxLength") is not None
        has_regex = bool(f.get("regex") or f.get("pattern"))

        # 1. Regex/charset không compile được -> oracle sẽ bỏ qua âm thầm.
        for key in ("regex", "pattern", "allowedPattern", "forbiddenPattern"):
            pat = f.get(key)
            if pat:
                try:
                    _re.compile(pat)
                except _re.error as e:
                    warnings.append({
                        "field": name, "severity": "error", "code": "BAD_REGEX",
                        "message": f"'{name}': {key} không hợp lệ ({e}) — oracle sẽ bỏ qua ràng buộc này.",
                    })

        # 2. Chuỗi nhưng thiếu cả biên độ dài lẫn định dạng -> không chặn được giá trị quá dài.
        if ftype in STRING_FAMILY and not has_len and not has_regex and ftype != "email":
            warnings.append({
                "field": name, "severity": "warning", "code": "NO_LENGTH_BOUND",
                "message": f"'{name}' (type={ftype}) thiếu maxLength/regex — oracle không chặn được giá trị quá dài.",
            })

        # 3. phone/card thiếu maxLength và regex -> chỉ kiểm 'toàn chữ số', không chặn số quá dài.
        if ftype in ("phone", "card") and f.get("maxLength") is None and not has_regex:
            warnings.append({
                "field": name, "severity": "warning", "code": "NO_FORMAT_LENGTH",
                "message": f"'{name}' (type={ftype}) chỉ kiểm 'toàn chữ số' — thiếu maxLength/regex nên không chặn được độ dài.",
            })

    return warnings


def build_coverage_matrix_contract(fields: list):
    """
    Rule Engine & Coverage Matrix Contract Builder
    Generates requiredCases, required_boundaries, and equivalence_partitions.
    """
    required_cases = []
    required_boundaries = {}
    equivalence_partitions = {}
    
    # 1. Base happy path case (Positive)
    required_cases.append({
        "id": "POS_HAPPY_PATH",
        "field": None,
        "type": "positive",
        "target": "Xác minh luồng hoạt động chuẩn (Happy path) với đầy đủ dữ liệu hợp lệ"
    })
    
    for field in fields:
        name = field.get("name")
        ftype = field.get("semantic_type") or field.get("type") or field.get("data_type", "string")
        required = field.get("required", False)
        
        # Required Check (Negative case)
        if required:
            required_cases.append({
                "id": f"REQ_{name.upper()}_MISSING",
                "field": name,
                "type": "negative",
                "target": f"Để trống trường bắt buộc '{name}'"
            })
            
        bounds = []
        
        # Check numerical limits
        min_v = field.get("minValue")
        max_v = field.get("maxValue")
        if min_v is not None:
            try:
                val = float(min_v)
                val_int = int(val) if val.is_integer() else val
                bounds.extend([val_int - 1, val_int, val_int + 1])
                required_cases.extend([
                    {"id": f"BVA_{name.upper()}_MIN_MINUS_1", "field": name, "type": "negative", "target": f"Giá trị {name} = {val_int - 1} (dưới biên minValue={min_v})"},
                    {"id": f"BVA_{name.upper()}_MIN", "field": name, "type": "boundary", "target": f"Giá trị {name} = {val_int} (tại biên minValue={min_v})"},
                    {"id": f"BVA_{name.upper()}_MIN_PLUS_1", "field": name, "type": "boundary", "target": f"Giá trị {name} = {val_int + 1} (trên biên minValue={min_v})"}
                ])
            except:
                pass
                
        if max_v is not None:
            try:
                val = float(max_v)
                val_int = int(val) if val.is_integer() else val
                bounds.extend([val_int - 1, val_int, val_int + 1])
                required_cases.extend([
                    {"id": f"BVA_{name.upper()}_MAX_MINUS_1", "field": name, "type": "boundary", "target": f"Giá trị {name} = {val_int - 1} (dưới biên maxValue={max_v})"},
                    {"id": f"BVA_{name.upper()}_MAX", "field": name, "type": "boundary", "target": f"Giá trị {name} = {val_int} (tại biên maxValue={max_v})"},
                    {"id": f"BVA_{name.upper()}_MAX_PLUS_1", "field": name, "type": "negative", "target": f"Giá trị {name} = {val_int + 1} (vượt biên maxValue={max_v})"}
                ])
            except:
                pass

        # Check string length limits
        min_l = field.get("minLength")
        max_l = field.get("maxLength")
        if min_l is not None:
            try:
                val = int(min_l)
                bounds.extend([val - 1, val, val + 1])
                required_cases.extend([
                    {"id": f"BVA_{name.upper()}_LEN_MIN_MINUS_1", "field": name, "type": "negative", "target": f"Độ dài {name} = {val - 1} ký tự (dưới biên minLength={min_l})"},
                    {"id": f"BVA_{name.upper()}_LEN_MIN", "field": name, "type": "boundary", "target": f"Độ dài {name} = {val} ký tự (tại biên minLength={min_l})"},
                    {"id": f"BVA_{name.upper()}_LEN_MIN_PLUS_1", "field": name, "type": "boundary", "target": f"Độ dài {name} = {val + 1} ký tự (trên biên minLength={min_l})"}
                ])
            except:
                pass
                
        if max_l is not None:
            try:
                val = int(max_l)
                bounds.extend([val - 1, val, val + 1])
                required_cases.extend([
                    {"id": f"BVA_{name.upper()}_LEN_MAX_MINUS_1", "field": name, "type": "boundary", "target": f"Độ dài {name} = {val - 1} ký tự (dưới biên maxLength={max_l})"},
                    {"id": f"BVA_{name.upper()}_LEN_MAX", "field": name, "type": "boundary", "target": f"Độ dài {name} = {val} ký tự (tại biên maxLength={max_l})"},
                    {"id": f"BVA_{name.upper()}_LEN_MAX_PLUS_1", "field": name, "type": "negative", "target": f"Độ dài {name} = {val + 1} ký tự (vượt biên maxLength={max_l})"}
                ])
            except:
                pass
                
        if bounds:
            required_boundaries[name] = sorted(list(set(bounds)))
            
        # Equivalence partitions mapping
        if ftype == "email":
            equivalence_partitions[name] = {"valid": ["test@gmail.com"], "invalid": ["test_invalid"]}
            required_cases.extend([
                {"id": f"EP_{name.upper()}_VALID_FORMAT", "field": name, "type": "equivalence", "target": f"Định dạng email hợp lệ (vd: test@gmail.com)"},
                {"id": f"EP_{name.upper()}_INVALID_FORMAT", "field": name, "type": "negative", "target": f"Định dạng email không hợp lệ (vd: test_invalid)"}
            ])
        elif ftype == "card":
            equivalence_partitions[name] = {"valid": ["1234567890123456"], "invalid": ["123456"]}
            required_cases.extend([
                {"id": f"EP_{name.upper()}_VALID_CARD", "field": name, "type": "equivalence", "target": f"Số thẻ hợp lệ gồm 16 chữ số"},
                {"id": f"EP_{name.upper()}_INVALID_CARD", "field": name, "type": "negative", "target": f"Số thẻ không hợp lệ"}
            ])
        elif ftype == "phone":
            equivalence_partitions[name] = {"valid": ["0912345678"], "invalid": ["12345"]}
            required_cases.extend([
                {"id": f"EP_{name.upper()}_VALID_PHONE", "field": name, "type": "equivalence", "target": f"Số điện thoại hợp lệ VN đầu số 03/05/07/08/09"},
                {"id": f"EP_{name.upper()}_INVALID_PHONE", "field": name, "type": "negative", "target": f"Số điện thoại không hợp lệ"}
            ])
        elif ftype == "date":
            equivalence_partitions[name] = {"valid": ["2026-06-21"], "invalid": ["2026/06/21"]}
            required_cases.extend([
                {"id": f"EP_{name.upper()}_VALID_DATE", "field": name, "type": "equivalence", "target": f"Định dạng ngày ISO YYYY-MM-DD"},
                {"id": f"EP_{name.upper()}_INVALID_DATE", "field": name, "type": "negative", "target": f"Ngày không đúng định dạng ISO (vd: 2026/06/21)"}
            ])
        elif ftype == "number":
            valid_val = 20.0
            if min_v is not None and max_v is not None:
                valid_val = (float(min_v) + float(max_v)) / 2.0
            elif min_v is not None:
                valid_val = float(min_v) + 5.0
            elif max_v is not None:
                valid_val = float(max_v) - 5.0
            invalid_below = float(min_v) - 5.0 if min_v is not None else -1.0
            invalid_above = float(max_v) + 5.0 if max_v is not None else 999.0
            
            equivalence_partitions[name] = {
                "valid": [valid_val],
                "invalid": [invalid_below, invalid_above]
            }
            required_cases.extend([
                {"id": f"EP_{name.upper()}_VALID_NUMBER", "field": name, "type": "equivalence", "target": f"Giá trị số hợp lệ: {valid_val}"},
                {"id": f"EP_{name.upper()}_INVALID_BELOW", "field": name, "type": "negative", "target": f"Giá trị số không hợp lệ (dưới biên: {invalid_below})"},
                {"id": f"EP_{name.upper()}_INVALID_ABOVE", "field": name, "type": "negative", "target": f"Giá trị số không hợp lệ (trên biên: {invalid_above})"}
            ])
        elif ftype == "boolean":
            equivalence_partitions[name] = {"valid": [True, False], "invalid": ["not-a-boolean"]}
        else:
            allowed = field.get("allowedValues")
            if allowed:
                equivalence_partitions[name] = {"valid": allowed, "invalid": ["invalid_option"]}
                required_cases.extend([
                    {"id": f"EP_{name.upper()}_VALID_OPTION", "field": name, "type": "equivalence", "target": f"Lựa chọn hợp lệ từ danh sách {allowed}"},
                    {"id": f"EP_{name.upper()}_INVALID_OPTION", "field": name, "type": "negative", "target": f"Lựa chọn ngoài danh sách (vd: invalid_option)"}
                ])
            else:
                valid_len = 10
                if min_l is not None and max_l is not None:
                    valid_len = int((int(min_l) + int(max_l)) / 2)
                elif min_l is not None:
                    valid_len = int(min_l) + 2
                elif max_l is not None:
                    valid_len = int(max_l) - 2
                valid_str = "a" * max(1, valid_len)
                invalid_len_below = "a" * max(0, int(min_l) - 2) if min_l is not None else ""
                invalid_len_above = "a" * (int(max_l) + 5) if max_l is not None else "a"*100
                
                equivalence_partitions[name] = {
                    "valid": [valid_str],
                    "invalid": [invalid_len_below, invalid_len_above]
                }

    # Dynamic Decision cases
    decision_fields = [f for f in fields if f.get("allowedValues") or f.get("semantic_type") == "boolean" or f.get("type") == "boolean"]
    if len(decision_fields) >= 2:
        f1 = decision_fields[0]
        f2 = decision_fields[1]
        opts1 = f1.get("allowedValues") or [True, False]
        opts2 = f2.get("allowedValues") or [True, False]
        for idx, (o1, o2) in enumerate([(v1, v2) for v1 in opts1[:2] for v2 in opts2[:2]]):
            required_cases.append({
                "id": f"DEC_{f1['name'].upper()}_{f2['name'].upper()}_COMB_{idx+1}",
                "field": None,
                "type": "decision",
                "target": f"Kết hợp quyết định: {f1['name']}={o1} và {f2['name']}={o2}"
            })
            
    return required_cases, required_boundaries, equivalence_partitions

def calculate_single_testcase_scores(tc, fields, required_boundaries, required_cases):
    """
    Computes individual testcase scores across Completeness, Negative, Boundary, Decision, and Coverage.
    """
    completeness = 0
    if tc.get("tcId") and len(str(tc.get("tcId")).strip()) >= 3:
        completeness += 10
    
    scenario = tc.get("scenario", "")
    if scenario and len(str(scenario).strip()) >= 15:
        completeness += 15
        
    expected = tc.get("expectedResult", "")
    if expected and len(str(expected).strip()) >= 10:
        completeness += 15
        
    categories = tc.get("categories", [])
    if categories and isinstance(categories, list):
        completeness += 10
        
    rationale = tc.get("rationale", "")
    if rationale and len(str(rationale).strip()) >= 5:
        completeness += 10
        
    tags = tc.get("coverageTags", [])
    if tags and isinstance(tags, list):
        completeness += 10
        
    gen_from = tc.get("generatedFrom", [])
    if gen_from and isinstance(gen_from, list):
        completeness += 10
        
    vals = tc.get("values", tc.get("data", {}))
    total_fields = len(fields) if fields else 1
    present_fields_count = sum(1 for f in fields if f["name"] in vals)
    completeness += int((present_fields_count / total_fields) * 20)
    
    completeness_score = min(max(0, completeness), 100)
    
    # negativeScore check
    check_msg = check_record_expected_result(vals, fields)
    is_valid = (check_msg == "Hợp lệ")
    
    cats_lower = [c.lower() for c in categories] if isinstance(categories, list) else []
    is_negative = ("negative" in cats_lower or tc.get("method") == "negative" or "negative" in str(tc.get("tcId", "")).lower())
    
    if is_negative:
        negative_score = 100 if not is_valid else 0
    else:
        negative_score = 100 if is_valid else 0
        
    # boundaryScore check
    hits_boundary = False
    boundary_fields_count = len(required_boundaries)
    
    for name, b_vals in required_boundaries.items():
        val = vals.get(name)
        if val is not None and str(val).strip() != "":
            try:
                val_f = float(val)
                if any(abs(val_f - b) < 1e-9 for b in b_vals):
                    hits_boundary = True
            except:
                pass
            val_len = len(str(val))
            if val_len in b_vals:
                hits_boundary = True
                
    is_boundary_labeled = ("boundary" in cats_lower or tc.get("method") == "bva" or "bva" in str(tc.get("tcId", "")).lower())
    
    if boundary_fields_count == 0:
        boundary_score = 100
    else:
        if is_boundary_labeled:
            boundary_score = 100 if hits_boundary else 50
        else:
            boundary_score = 70 if hits_boundary else 0
            
    # decisionScore check
    is_decision_labeled = ("decision" in cats_lower or tc.get("method") == "decision")
    decision_fields = [f for f in fields if f.get("allowedValues") or f.get("semantic_type") == "boolean" or f.get("type") == "boolean"]
    
    if len(decision_fields) < 2:
        decision_score = 100
    else:
        non_empty_dec = sum(1 for f in decision_fields if vals.get(f["name"]) is not None and str(vals[f["name"]]).strip() != "")
        if is_decision_labeled:
            decision_score = 100 if (non_empty_dec >= 2 and is_valid) else 50
        else:
            decision_score = 100 if is_valid else 0
            
    # coverageScore check
    cov_score = 0
    if fields:
        field_unit = 100.0 / len(fields)
        for f in fields:
            name = f["name"]
            if name in vals:
                val = vals[name]
                if val is not None and str(val).strip() != "":
                    val_str = str(val)
                    ftype = f.get("semantic_type") or f.get("type") or f.get("data_type", "string")
                    is_fmt_valid = True
                    import re
                    if ftype == "email" and not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", val_str):
                        is_fmt_valid = False
                    elif ftype == "card" and not re.match(r"^\d{16}$", val_str):
                        is_fmt_valid = False
                    elif ftype == "phone" and not re.match(r"^(03|05|07|08|09)\d{8}$", val_str):
                        is_fmt_valid = False
                    elif ftype == "date" and not is_valid_iso_date(val_str):
                        is_fmt_valid = False
                    elif ftype == "number":
                        try:
                            float(val)
                        except:
                            is_fmt_valid = False
                            
                    if is_fmt_valid:
                        cov_score += field_unit
                    else:
                        cov_score += field_unit * 0.5
                else:
                    cov_score += field_unit * 0.2
        coverage_score = int(round(cov_score))
    else:
        coverage_score = 100
        
    return {
        "completenessScore": min(max(0, completeness_score), 100),
        "negativeScore": min(max(0, negative_score), 100),
        "boundaryScore": min(max(0, boundary_score), 100),
        "decisionScore": min(max(0, decision_score), 100),
        "coverageScore": min(max(0, coverage_score), 100),
        "diversityScore": 100
    }

def validate_and_fix_seeds(seeds, fields):
    """
    TESTFORGE V4.1 Advanced Verification, Repair, Deduplication, and Scoring Engine.
    """
    if not isinstance(seeds, list):
        return []
        
    required_cases, required_boundaries, equivalence_partitions = build_coverage_matrix_contract(fields)
    decision_fields = [f for f in fields if f.get("allowedValues") or f.get("semantic_type") == "boolean" or f.get("type") == "boolean"]
    
    # STEP 1: Reject Engine
    passed_reject_gate = []
    for raw_seed in seeds:
        seed = dict(raw_seed)
        
        # Normalize
        data = seed.get("data", seed.get("values", seed))
        if "data" not in seed and "values" not in seed:
            data = {k: v for k, v in seed.items() if k not in ["tcId", "method", "scenario", "expectedResult", "errorDescription", "category", "categories", "origin", "fitness", "llmFitness", "gaFitness", "hcFitness", "coverageTags", "generatedFrom"]}
        seed["values"] = data
        
        # Reject rules
        reject_reason = None
        if not isinstance(data, dict) or not data:
            reject_reason = "Missing values dict"
        else:
            for f in fields:
                if f.get("required") and f["name"] not in data:
                    reject_reason = f"Missing required field {f['name']}"
                    break
                    
        cats = seed.get("categories", [])
        if not isinstance(cats, list) or not cats:
            # Default to positive if categories is missing, instead of rejecting
            seed["categories"] = ["positive"]
            cats = ["positive"]
            
        if reject_reason:
            print(f">>> REJECTED: {seed.get('tcId', 'unknown')} because of {reject_reason}")
            continue
            
        passed_reject_gate.append(seed)
        
    # STEP 2: Repair Engine
    repaired_seeds = []
    for idx, seed in enumerate(passed_reject_gate):
        data = seed["values"]
        
        # Repair TC ID
        seed["tcId"] = f"TC-{idx + 1:04d}"
        
        # Repair missing required/non-required fields
        for f in fields:
            name = f["name"]
            if name not in data:
                data[name] = ""
                
        # Oracle là nguồn chân lý DUY NHẤT cho verdict + lý do. KHÔNG tin nhãn
        # generic 'SUCCESS'/'VALIDATION_ERROR' của LLM vì chúng thiếu chi tiết
        # (không nói rõ field nào / vì sao) — gây "hở" so với data GA/HC.
        oracle = derive_expected_result(data, fields)
        is_valid = oracle["is_valid"]
        reason_detail = "; ".join(oracle["violated_fields_desc"]) or oracle["message"].replace("Lỗi: ", "")
        cats = seed.get("categories", [])

        if is_valid and "negative" in cats:
            cats = [c for c in cats if c != "negative"]
            if not cats or "positive" not in cats:
                cats.append("positive")
        elif not is_valid and "negative" not in cats:
            cats.append("negative")
            cats = [c for c in cats if c != "positive"]
        seed["categories"] = list(set(cats))

        # Repair Scenario
        scn = seed.get("scenario")
        scn = str(scn or "").strip()
        if not scn or len(scn) < 15:
            cats_str = ", ".join(seed["categories"])
            active_fields = [f"{k}={v}" for k, v in data.items() if v != ""]
            seed["scenario"] = f"Kiểm thử kịch bản {cats_str} với dữ liệu: {', '.join(active_fields[:3])}"

        # Expected Result & Error: LUÔN suy từ Oracle (cùng message với GA/HC/final)
        # để MỌI ca (kể cả F0 của LLM) đều có nội dung rõ ràng — Success nói rõ vì sao
        # hợp lệ, Error nói rõ field nào sai. Đồng nhất toàn hệ thống.
        seed["expectedResult"] = oracle["message"]
        seed["errorDescription"] = "Không có" if is_valid else reason_detail
            
        # Repair rationale
        rat = seed.get("rationale")
        if not rat or len(str(rat).strip()) < 5:
            seed["rationale"] = f"Xác minh nghiệp vụ trường {'/'.join([c for c in data.keys() if data[c] != ''])[:50]}"
            
        # Ensure coverageTags and generatedFrom fields exist
        if "coverageTags" not in seed or not isinstance(seed["coverageTags"], list):
            seed["coverageTags"] = []
            
        if "generatedFrom" not in seed or not isinstance(seed["generatedFrom"], list):
            seed["generatedFrom"] = []
            for f in fields:
                if data.get(f["name"]) is not None:
                    seed["generatedFrom"].append({"field": f["name"], "rule": f.get("type", "schema_type")})
                    
        repaired_seeds.append(seed)
        
    # STEP 3: Deduplication
    exact_seen = set()
    unique_seeds = []
    
    for seed in repaired_seeds:
        val_hash = hashlib.sha256(json.dumps(seed["values"], sort_keys=True, ensure_ascii=False).encode('utf-8')).hexdigest()
        if val_hash in exact_seen:
            continue
        exact_seen.add(val_hash)
        
        # Disable Layer 2 Semantic Duplicate check to preserve GA/HC mutants
        # as they intentionally explore values within the same category/expected result.
        unique_seeds.append(seed)
            
    # STEP 4: Coverage Verification & Missing Boundary Auto-Gen
    covered_tags = set()
    for seed in unique_seeds:
        actual_tags = []
        for item in required_cases:
            cid = item["id"]
            c_field = item["field"]
            c_type = item["type"]
            c_target = item["target"]
            
            if c_type == "positive" and check_record_expected_result(seed["values"], fields) == "Hợp lệ":
                actual_tags.append(cid)
            elif c_type == "negative" and c_field:
                err = check_record_expected_result(seed["values"], fields)
                if f"'{c_field}'" in err or f"thiếu '{c_field}'" in err:
                    actual_tags.append(cid)
            elif c_type == "boundary" and c_field:
                val = seed["values"].get(c_field)
                if val is not None:
                    target_num = None
                    try:
                        import re
                        m = re.search(r"=\s*([-\d\.]+)", c_target)
                        if m:
                            target_num = float(m.group(1))
                    except:
                        pass
                    
                    if target_num is not None:
                        try:
                            if abs(float(val) - target_num) < 1e-9:
                                actual_tags.append(cid)
                        except:
                            pass
                    
                    target_len = None
                    try:
                        import re
                        m = re.search(r"=\s*(\d+)\s*ký tự", c_target)
                        if m:
                            target_len = int(m.group(1))
                    except:
                        pass
                    if target_len is not None and len(str(val)) == target_len:
                        actual_tags.append(cid)
            elif c_type == "equivalence" and c_field:
                val = seed["values"].get(c_field)
                if val is not None and check_record_expected_result(seed["values"], fields) == "Hợp lệ":
                    actual_tags.append(cid)
                    
        if actual_tags:
            seed["coverageTags"] = list(set(actual_tags))
            covered_tags.update(actual_tags)
            
    # Re-index TC ID
    for idx, s in enumerate(unique_seeds):
        s["tcId"] = f"TC-{idx + 1:04d}"
        
    # STEP 5: Scoring Engine (completeness, negative, boundary, coverage, decision, diversity)
    # 5.1 Calculate base scores
    for seed in unique_seeds:
        scores = calculate_single_testcase_scores(seed, fields, required_boundaries, required_cases)
        seed.update(scores)
        
    # 5.2 Calculate diversityScore
    if len(unique_seeds) > 1:
        for i, tc1 in enumerate(unique_seeds):
            v1 = tc1["values"]
            max_sim = 0.0
            for j, tc2 in enumerate(unique_seeds):
                if i == j: continue
                v2 = tc2["values"]
                matches = sum(1 for f in fields if str(v1.get(f["name"])) == str(v2.get(f["name"])))
                sim = matches / len(fields) if fields else 1.0
                if sim > max_sim:
                    max_sim = sim
            tc1["diversityScore"] = int(round((1.0 - max_sim) * 100))
    else:
        for seed in unique_seeds:
            seed["diversityScore"] = 100
            
    # 5.3 Calculate dynamic seedQualityScore using the exact Fitness formula:
    # Fitness = (0.4 × Coverage) + (0.3 × Boundary) + (0.1 × Priority) + (0.2 × Diversity) - Penalty
    # Note: Penalty is 0 for initial F0 seeds. We map Priority to completenessScore.
    for seed in unique_seeds:
        cov = seed.get("coverageScore", 100)
        bnd = seed.get("boundaryScore", 100)
        pri = seed.get("completenessScore", 100)
        div = seed.get("diversityScore", 100)
        
        final_score = (0.4 * cov) + (0.3 * bnd) + (0.1 * pri) + (0.2 * div)
        seed["seedQualityScore"] = int(round(final_score))
        
    return unique_seeds

def generate_coverage_summary(seeds: list, fields: list) -> dict:
    """
    Computes required vs actual coverage summary counts.
    """
    required_cases, _, _ = build_coverage_matrix_contract(fields)
    summary = {
        "positive": {"required": 0, "actual": 0},
        "negative": {"required": 0, "actual": 0},
        "boundary": {"required": 0, "actual": 0},
        "equivalence": {"required": 0, "actual": 0},
        "decision": {"required": 0, "actual": 0}
    }
    
    for item in required_cases:
        t = item["type"]
        if t == "ep":
            t = "equivalence"
        if t in summary:
            summary[t]["required"] += 1
            
    covered_tags = set()
    for seed in seeds:
        for tag in seed.get("coverageTags", []):
            covered_tags.add(tag)
            
    for item in required_cases:
        cid = item["id"]
        t = item["type"]
        if t == "ep":
            t = "equivalence"
        if cid in covered_tags:
            if t in summary:
                summary[t]["actual"] += 1
                
    return summary

def enrich_result_with_expected_results(parsed_result):
    if parsed_result and "initialPopulation" in parsed_result:
        fields = parsed_result.get("fields", [])
        seeds = parsed_result.get("initialPopulation", [])
        parsed_result["initialPopulation"] = validate_and_fix_seeds(seeds, fields)
        parsed_result["coverageSummary"] = generate_coverage_summary(parsed_result["initialPopulation"], fields)
    return parsed_result

# (Keeping local generation out for brevity or putting a simplified version, but let's copy the real one to be safe)
def generate_seeds(fields: list, test_method: str, boundary_count: int = 4, partition_count: int = 3, api_key: str = None, raw_text: str = "", db: Session = None) -> list:
    """
    Main entrypoint to generate seeds based on selected test method (AI-powered or local fallback).
    """
    active_key = api_key if api_key else (os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY"))
    
    if not active_key or active_key.strip() == "":
        print(f">>> INFO: No API key found. Running local seed generator for method '{test_method}'...")

def ensure_complete_business_rules(rules: list, fields: list) -> list:
    """
    Đảm bảo Business Rules ĐẦY ĐỦ & nhất quán với schema: mọi field có ràng buộc
    (required / length / value / regex / enum) đều phải có rule tương ứng.
    Bổ sung deterministic những rule LLM bỏ sót (vd 'phone' bắt buộc nhưng thiếu rule),
    GIỮ NGUYÊN rule do LLM sinh (ưu tiên mô tả chất lượng) — chỉ lấp phần thiếu.
    """
    rules = list(rules or [])
    existing = set()
    for r in rules:
        fld = str(r.get("field", "")).lower()
        cat = str(r.get("rule_category") or r.get("rule_operator") or "").lower()
        existing.add((fld, cat))

    def has(fld, *cats):
        f = str(fld).lower()
        return any((f, c) in existing for c in cats)

    def add(rule):
        rules.append(rule)
        existing.add((str(rule["field"]).lower(), rule["rule_category"]))

    for fdef in (fields or []):
        name = fdef.get("name")
        if not name:
            continue
        up = str(name).upper()

        if fdef.get("required") and not has(name, "presence", "required"):
            add({
                "rule_id": f"R_{up}_REQUIRED", "field": name,
                "rule_category": "presence", "rule_operator": "required",
                "rule_value": "true", "priority": "high",
                "description": f"Trường '{name}' là bắt buộc, không được để trống.",
                "errorMessage": f"Vui lòng nhập '{name}'."
            })

        if (fdef.get("minLength") is not None or fdef.get("maxLength") is not None) and not has(name, "length"):
            mn, mx = fdef.get("minLength"), fdef.get("maxLength")
            add({
                "rule_id": f"R_{up}_LENGTH", "field": name,
                "rule_category": "length", "rule_operator": "length_range",
                "rule_value": f"{mn}-{mx}", "priority": "medium",
                "description": f"Trường '{name}' phải có độ dài từ {mn} đến {mx} ký tự.",
                "errorMessage": f"'{name}' phải dài {mn}-{mx} ký tự."
            })

        if (fdef.get("minValue") is not None or fdef.get("maxValue") is not None) and not has(name, "value"):
            mn, mx = fdef.get("minValue"), fdef.get("maxValue")
            add({
                "rule_id": f"R_{up}_VALUE", "field": name,
                "rule_category": "value", "rule_operator": "value_range",
                "rule_value": f"{mn}-{mx}", "priority": "medium",
                "description": f"Trường '{name}' phải nằm trong khoảng {mn} đến {mx}.",
                "errorMessage": f"'{name}' phải trong khoảng {mn}-{mx}."
            })

        if fdef.get("regex") and not has(name, "format"):
            add({
                "rule_id": f"R_{up}_FORMAT", "field": name,
                "rule_category": "format", "rule_operator": "format",
                "rule_value": fdef.get("regex"), "priority": "medium",
                "description": f"Trường '{name}' phải đúng định dạng quy định.",
                "errorMessage": f"'{name}' sai định dạng quy định."
            })

        if fdef.get("allowedValues") and not has(name, "domain", "allowed_values"):
            add({
                "rule_id": f"R_{up}_ENUM", "field": name,
                "rule_category": "domain", "rule_operator": "allowed_values",
                "rule_value": fdef.get("allowedValues"), "priority": "medium",
                "description": f"Trường '{name}' chỉ nhận giá trị trong: {fdef.get('allowedValues')}.",
                "errorMessage": f"'{name}' không nằm trong danh sách cho phép."
            })

    return rules


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
            "ambiguities": []
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

        # Bổ sung deterministic các rule LLM bỏ sót để Business Rules ĐẦY ĐỦ với mọi field
        # (vd 'phone' bắt buộc nhưng LLM quên sinh rule -> tự thêm rule 'required').
        complete_rules = ensure_complete_business_rules(rules_data.get("rules", []), schema_fields)

        print(f">>> [STEP 1/1] ✓ Hoàn thành | {len(complete_rules)} rules ({len(rules_data['rules'])} từ LLM), {len(schema_fields)} fields | {_time.time()-t1:.1f}s", flush=True)

        # [P0 OPT] STEP 2 (seed generation) removed — seeds generated on-demand
        # via /api/generate-seeds to avoid blocking parse with an extra LLM call.
        final_result = {
            "business_rules": complete_rules,
            "constraints": rules_data.get("constraints", []),
            "ambiguities": [],
            "fields": schema_fields,
            "initialPopulation": [],
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

PROMPT_VERSION = "4.1"
SEED_ENGINE_VERSION = "1.0"
SEED_CACHE = {}

def calculate_cache_key(fields: list, raw_text: str, method: str, provider: str) -> str:
    serialized_fields = json.dumps(fields, sort_keys=True, ensure_ascii=False)
    raw_key = f"{serialized_fields}:{raw_text}:{method}:{provider}:{PROMPT_VERSION}:{SEED_ENGINE_VERSION}"
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

def _bva_value_of_length(field: dict, length: int) -> str:
    """
    Sinh giá trị có ĐỘ DÀI đúng = length, cố giữ hợp lệ theo type/charset của field.
    Generic cho mọi đề: không hard-code tên trường, tự né charset cấm của chính field.
    """
    import re as _re
    if length <= 0:
        return ""
    ftype = (field.get("type") or field.get("semantic_type") or field.get("data_type") or "string")
    if ftype == "email":
        suffix = "@ex.com"
        if length > len(suffix):
            return "a" * (length - len(suffix)) + suffix
        return "a" * length  # quá ngắn cho email -> Oracle sẽ phản ánh sai định dạng
    if ftype in ("phone", "card"):
        return "0" * length
    # string/text/password/url...: mẫu đủ lớp ký tự, nếu charset của field cấm thì lùi về chữ cái
    candidate = ("Aa1!" * (length // 4 + 1))[:length]
    fp = field.get("forbiddenPattern")
    if fp:
        try:
            if _re.search(fp, candidate):
                candidate = ("Abcde" * (length // 5 + 1))[:length]
        except _re.error:
            pass
    return candidate


def _bva_baseline(fields: list) -> dict:
    """Một record HỢP LỆ làm nền, để mỗi seed biên chỉ phá đúng 1 trường (cô lập biên)."""
    rec = {}
    for f in fields:
        name = f["name"]
        ftype = (f.get("type") or f.get("semantic_type") or f.get("data_type") or "string")
        if ftype == "number":
            mn, mx = f.get("minValue"), f.get("maxValue")
            rec[name] = mn if mn is not None else (mx if mx is not None else 0)
        else:
            min_l = int(f.get("minLength") or 1)
            max_l = int(f.get("maxLength") or max(min_l, 8))
            rec[name] = _bva_value_of_length(f, max(min_l, min(max_l, 8)))
    return rec


def synthesize_boundary_seeds(fields: list) -> list:
    """
    Sinh seed BIÊN xác định (deterministic) từ schema — bù phần LLM hay bỏ sót.
    Với mỗi trường có ràng buộc độ dài: tạo các ca tại-biên (min, max) và vượt-biên
    (min-1, max+1). Với trường số: min±1, max±1. Nhãn Success/Error + lý do do Oracle
    quyết định nên luôn trung thực. Các trường khác giữ giá trị nền hợp lệ.
    """
    baseline = _bva_baseline(fields)
    out = []

    def mk(field_name, value, kind):
        vals = dict(baseline)
        vals[field_name] = value
        oc = derive_expected_result(vals, fields)
        cats = ["boundary"] if oc["is_valid"] else ["boundary", "negative"]
        return {
            "values": vals,
            "categories": cats,
            "method": "bva",
            "origin": "BVA-SYNTH",
            "scenario": f"Biên trường '{field_name}' ({kind})",
            "expectedResult": oc["message"],
            "errorDescription": "Không có" if oc["is_valid"] else ("; ".join(oc["violated_fields_desc"]) or oc["message"]),
            "rationale": f"Kiểm thử giá trị biên của '{field_name}': {kind}.",
        }

    for f in fields:
        name = f["name"]
        ftype = (f.get("type") or f.get("semantic_type") or f.get("data_type") or "string")
        min_l, max_l = f.get("minLength"), f.get("maxLength")

        if ftype != "number":
            if min_l is not None:
                m = int(min_l)
                if m - 1 >= 0:
                    out.append(mk(name, _bva_value_of_length(f, m - 1), f"dưới minLength={m}"))
                out.append(mk(name, _bva_value_of_length(f, m), f"tại minLength={m}"))
            if max_l is not None:
                M = int(max_l)
                out.append(mk(name, _bva_value_of_length(f, M), f"tại maxLength={M}"))
                out.append(mk(name, _bva_value_of_length(f, M + 1), f"vượt maxLength={M}"))
        else:
            mn, mx = f.get("minValue"), f.get("maxValue")
            if mn is not None:
                try:
                    base = float(mn); base = int(base) if base.is_integer() else base
                    out += [mk(name, base - 1, f"dưới minValue={mn}"),
                            mk(name, base, f"tại minValue={mn}")]
                except (ValueError, TypeError):
                    pass
            if mx is not None:
                try:
                    base = float(mx); base = int(base) if base.is_integer() else base
                    out += [mk(name, base, f"tại maxValue={mx}"),
                            mk(name, base + 1, f"vượt maxValue={mx}")]
                except (ValueError, TypeError):
                    pass
    return out


def generate_seeds_with_ai(
    fields: list,
    business_rules: list = None,
    constraints: list = None,
    test_methods: list = None,
    boundary_count: int = 4,
    partition_count: int = 3,
    api_key: str = None,
    raw_text: str = "",
    db: Session = None,
    llm_provider: str = "gemini"
) -> tuple:
    import time as _time
    import json
    import hashlib
    from .prompts import get_seed_generation_instructions
    from ..algorithms.seed_planner import create_seed_plan
    
    t_start = _time.time()
    plan = create_seed_plan(test_methods, fields)
    total_requested = plan.total
    print(f"\n>>> [SEEDS V6] Start Batch LLM Generation | plan={plan.to_dict()}", flush=True)

    all_seeds = []
    seen_hashes = set()
    MAX_RETRY = 5
    
    # Track generation statistics
    stats = {
        "requested": total_requested,
        "generated": 0,
        "accepted": 0,
        "rejected": 0,
        "distribution": {"valid": 0, "boundary": 0, "invalid": 0},
        "rejected_reason": []
    }
    
    def _add_reject(reason):
        stats["rejected"] += 1
        for r in stats["rejected_reason"]:
            if r["type"] == reason:
                r["count"] += 1
                return
        stats["rejected_reason"].append({"type": reason, "count": 1})

    # Build distribution string
    import json
    distribution_str = json.dumps(plan.categories, ensure_ascii=False)
    
    retry_count = 0
    while len(all_seeds) < total_requested and retry_count < MAX_RETRY:
        needed = total_requested - len(all_seeds)
        # BATCH_SIZE limits logic: Try to get up to 30 in a single request as requested by the user
        batch_size = min(needed, 30)
        
        # Context memory
        context_str = ""
        if len(all_seeds) > 0:
            context_str = json.dumps([s["values"] for s in all_seeds[-5:]], ensure_ascii=False)
            
        sys_prompt, usr_prompt = get_seed_generation_instructions(
            target_count=batch_size, 
            distribution_str=distribution_str, 
            previous_context=context_str, 
            test_methods=test_methods,
            boundary_count=boundary_count
        )
        usr_prompt_full = f"{usr_prompt}\n\nFields Schema:\n{json.dumps(fields, ensure_ascii=False)}"
        
        if business_rules:
            usr_prompt_full += f"\n\nBusiness Rules:\n{json.dumps(business_rules, ensure_ascii=False)}"
        if constraints:
            usr_prompt_full += f"\n\nConstraints:\n{json.dumps(constraints, ensure_ascii=False)}"
            
        try:
            llm_result, engine_name, model_name = call_llm_json(sys_prompt, usr_prompt_full, api_key_override=api_key, llm_provider=llm_provider)
            batch = llm_result.get("initialPopulation", [])
            stats["generated"] += len(batch)
            
            for s in batch:
                if "values" not in s:
                    val_keys = {f["name"] for f in fields}
                    s["values"] = {k: v for k, v in s.items() if k in val_keys}
                    
                # Oracle Classification (Phase 1C)
                from ..algorithms.fitness_engine.quality_classifier import classify_quality, InvalidType
                is_rejected = False
                for f in fields:
                    val_str = str(s["values"].get(f["name"])) if s["values"].get(f["name"]) is not None else ""
                    status_res = classify_quality(val_str, f)
                    status = status_res.status
                    if status == InvalidType.INVALID_TYPE:
                        _add_reject("INVALID_TYPE")
                        is_rejected = True
                        break
                if is_rejected: continue
                
                # Deduplication (Phase 1D) - Exact hash 
                val_hash = hashlib.sha256(json.dumps(s["values"], sort_keys=True, ensure_ascii=False).encode('utf-8')).hexdigest()
                if val_hash in seen_hashes:
                    _add_reject("SIMILARITY_DUPLICATE")
                    continue
                    
                seen_hashes.add(val_hash)
                s["tcId"] = f"TC-{len(all_seeds)+1:04d}"
                
                # Áp dụng Oracle để ghi đè Expected Result và Error Description từ LLM
                oracle = derive_expected_result(s["values"], fields)
                s["expectedResult"] = oracle["message"]
                s["errorDescription"] = "Không có" if oracle["is_valid"] else ("; ".join(oracle["violated_fields_desc"]) or oracle["message"].replace("Lỗi: ", ""))
                
                all_seeds.append(s)
                
                # Guess distribution based on valid/boundary/invalid since we requested it combined
                cats = s.get("categories", ["positive"])
                if "negative" in cats:
                    stats["distribution"]["invalid"] += 1
                elif "boundary" in cats:
                    stats["distribution"]["boundary"] += 1
                else:
                    stats["distribution"]["valid"] += 1
                stats["accepted"] += 1
                
        except Exception as e:
            print(f">>> [SEEDS V6] Generate Batch Error: {e}")
            _time.sleep(1.0)
            
        retry_count += 1

    # ── Tiêm seed BIÊN xác định từ schema (bù phần LLM hay bỏ sót giá trị biên) ──
    if any("bva" in str(m).lower() for m in (test_methods or [])):
        try:
            for bs in synthesize_boundary_seeds(fields):
                vh = hashlib.sha256(json.dumps(bs["values"], sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
                if vh in seen_hashes:
                    continue
                seen_hashes.add(vh)
                bs["tcId"] = f"TC-{len(all_seeds)+1:04d}"
                all_seeds.append(bs)
                stats["distribution"]["boundary"] += 1
                stats["accepted"] = stats.get("accepted", 0) + 1
            print(f">>> [BVA-SYNTH] Đã tiêm seed biên xác định | tổng {len(all_seeds)} seeds", flush=True)
        except Exception as e:
            print(f">>> [BVA-SYNTH] bỏ qua do lỗi: {e}", flush=True)

    summary = generate_coverage_summary(all_seeds, fields)
    
    # Quality Gate (Phase 1E)
    if stats["accepted"] < total_requested * 0.9:
        print(f"Warning: Quality Gate failed. Only generated {stats['accepted']}/{total_requested}")
        
    elapsed = _time.time() - t_start
    print(f">>> [SEEDS V6] Done | {len(all_seeds)} seeds | {elapsed:.1f}s", flush=True)
        
    return all_seeds, summary, stats

def evaluate_test_quality_with_ai(fields: list, seeds: list, test_method: str, raw_text: str, api_key_override: str = None, db: Session = None, extracted_rules: list = None, extracted_constraints: list = None, llm_provider: str = "gemini") -> dict:
    if extracted_rules is None: extracted_rules = []
    if extracted_constraints is None: extracted_constraints = []
    
    # Deterministic Engine Calculation
    deterministic_metrics = calculate_dataset_fitness(seeds, extracted_rules, extracted_constraints)
    # Số liệu thống kê xác định (đếm, tcId trùng, schema, biên) — nguồn sự thật cho LLM, tránh bịa số.
    dataset_audit = audit_dataset(seeds, fields)
    deterministic_metrics["dataset_audit"] = dataset_audit

    system_instructions, user_prompt_text = get_evaluate_test_quality_prompt(fields, seeds, test_method, raw_text, deterministic_metrics)
    try:
        res, engine_name, model_name = call_llm_json(system_instructions, user_prompt_text, api_key_override, llm_provider)
        # Ghi đè số liệu đếm được bằng giá trị xác định để báo cáo luôn khớp dữ liệu thật.
        if isinstance(res, dict):
            res["dataset_stats"] = dataset_audit
        log_ai_call(db, "/api/evaluate-seeds", engine_name, model_name, "Prompt", json.dumps(res, ensure_ascii=False), "SUCCESS")
        return res
    except Exception as e:
        error_msg = str(e)
        log_ai_call(db, "/api/evaluate-seeds", "LLM", "unknown", "Prompt", None, "FAILED", error_message=error_msg)
        raise ValueError(f"AI Evaluation Error: {error_msg}")
def evaluate_optimized_dataset_with_ai(fields: list, dataset: list, algorithm: str, raw_text: str, api_key_override: str = None, db: Session = None, extracted_rules: list = None, extracted_constraints: list = None, llm_provider: str = "gemini") -> dict:
    if extracted_rules is None: extracted_rules = []
    if extracted_constraints is None: extracted_constraints = []
    
    # Deterministic Engine Calculation
    deterministic_metrics = calculate_dataset_fitness(dataset, extracted_rules, extracted_constraints)
    
    system_instructions, user_prompt_text = get_evaluate_optimized_prompt(fields, dataset, algorithm, raw_text, deterministic_metrics)
    try:
        res, engine_name, model_name = call_llm_json(system_instructions, user_prompt_text, api_key_override, llm_provider)
        log_ai_call(db, "/api/evaluate-optimized", engine_name, model_name, "Prompt", json.dumps(res, ensure_ascii=False), "SUCCESS")
        return res
    except Exception as e:
        error_msg = str(e)
        log_ai_call(db, "/api/evaluate-optimized", "LLM", "unknown", "Prompt", None, "FAILED", error_message=error_msg)
        raise ValueError(f"AI Evaluation Error: {error_msg}")


def explain_optimization_with_ai(
    before_values: dict,
    after_values: dict,
    algorithm: str,
    api_key_override: str = None,
    llm_provider: str = "gemini",
    db: Session = None
) -> dict:
    import json
    from .prompts import get_optimization_explanation_prompt
    sys_prompt, base_usr_prompt = get_optimization_explanation_prompt()
    usr_prompt = (
        f"{base_usr_prompt}\n\n"
        f"Algorithm Used: {algorithm}\n"
        f"Before Values: {json.dumps(before_values, ensure_ascii=False)}\n"
        f"After Values: {json.dumps(after_values, ensure_ascii=False)}"
    )
    try:
        res, engine, model = call_llm_json(sys_prompt, usr_prompt, api_key_override, llm_provider)
        return {
            "improvementReason": res.get("improvementReason", f"Tinh chỉnh bằng thuật toán {algorithm}"),
            "recommendation": res.get("recommendation", "")
        }
    except Exception as e:
        print(f"Error explaining optimization: {e}")
        return {
            "improvementReason": f"Tinh chỉnh bằng thuật toán {algorithm}",
            "recommendation": ""
        }


def semantic_polish_with_llm(
    schema: list,
    optimized_values: dict,
    original_values: dict,
    test_category: str = "positive",
    api_key_override: str = None,
    llm_provider: str = "gemini",
    db: Session = None
) -> dict:
    """
    LLM Semantic Polish: viết lại dữ liệu sau GA/HC để trông realistic.
    Giữ nguyên constraint (type, length, range, enum).
    
    Trả về:
      {
        "polished_values": { field: value, ... },
        "polish_notes": { field: reason, ... },
        "was_polished": True/False
      }
    """
    from .prompts import get_semantic_polish_prompt
    from .llm_client import call_llm_json

    # Nếu không có API key, không gọi LLM
    active_key = api_key_override or os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not active_key:
        return {"polished_values": optimized_values, "polish_notes": {}, "was_polished": False}

    try:
        sys_prompt, usr_prompt = get_semantic_polish_prompt(
            schema, optimized_values, original_values, test_category
        )
        result, engine, model = call_llm_json(sys_prompt, usr_prompt, api_key_override, llm_provider)
        polished = result.get("polished_values", {})
        notes = result.get("polish_notes", {})

        if not polished or not isinstance(polished, dict):
            return {"polished_values": optimized_values, "polish_notes": {}, "was_polished": False}

        # Validate: kiểm tra enum không bị phá vỡ sau LLM polish
        enum_safe_polished = {**optimized_values}  # start from optimized
        for f in schema:
            name = f.get("name")
            if name not in polished:
                continue
            new_val = polished[name]
            allowed = f.get("allowedValues")
            if allowed and str(new_val) not in [str(v) for v in allowed]:
                # LLM vi phạm enum → giữ nguyên optimized value
                print(f">>> [POLISH] Enum violation cho '{name}': LLM sinh '{new_val}' không trong {allowed}. Giữ nguyên.")
                enum_safe_polished[name] = optimized_values.get(name, new_val)
            else:
                enum_safe_polished[name] = new_val

        log_ai_call(db, "/semantic-polish", engine, model,
                    f"TC polish: {len(polished)} fields",
                    json.dumps(enum_safe_polished, ensure_ascii=False), "SUCCESS")

        return {"polished_values": enum_safe_polished, "polish_notes": notes, "was_polished": True}

    except Exception as e:
        print(f">>> [POLISH] LLM Polish failed: {e}. Sử dụng optimized values gốc.")
        return {"polished_values": optimized_values, "polish_notes": {}, "was_polished": False}


def batch_semantic_polish(
    schema: list,
    tc_list: list,
    api_key_override: str = None,
    llm_provider: str = "gemini",
    db: Session = None,
    max_polish: int = 20,
    cancel_check = None
) -> list:
    """
    Áp dụng semantic_polish_with_llm cho batch TC.
    Chỉ polish các TC có dữ liệu trông "robot" (length boundary hoặc pattern lạ).
    Giới hạn max_polish TC để tránh rate limit.

    Args:
        tc_list: list of { "hc_values": {...}, "llm_values": {...}, "categories": [...], ... }
    
    Returns:
        list với trường "polished_values" được thêm vào mỗi TC.
    """
    import time as _time

    def looks_robot(values: dict, schema: list) -> bool:
        """Heuristic: detect nếu dữ liệu trông 'robot' (boundary string dạng aaa...@bbb.com)"""
        for f in schema:
            name = f.get("name")
            ftype = f.get("type") or f.get("semantic_type", "string")
            val = values.get(name)
            if val is None:
                continue
            val_str = str(val)
            # Email pattern: nhiều ký tự lặp lại
            if ftype == "email" and len(val_str) > 30:
                local = val_str.split("@")[0] if "@" in val_str else ""
                if local and len(set(local)) <= 3:  # 3 ký tự unique = rõ ràng là pattern lặp
                    return True
            # String: 70% ký tự giống nhau = robot
            if ftype in ("string", "password") and len(val_str) > 15:
                if len(set(val_str)) / len(val_str) < 0.3:
                    return True
        return False

    import json
    import os
    
    # 1. Thu thập các TC cần polish
    tc_batch = []
    tc_map = {} # map tcId -> tc original data
    
    for idx, tc in enumerate(tc_list):
        hc_values = tc.get("hc_values", tc.get("values", {}))
        llm_values = tc.get("llm_values", hc_values)
        categories = tc.get("categories", ["positive"])
        tc_id = tc.get("tcId", f"TC-{idx}")
        tc["_internal_id"] = tc_id
        
        should_polish = looks_robot(hc_values, schema)
        
        tc_map[tc_id] = tc
        
        if should_polish:
            tc_batch.append({
                "tcId": tc_id,
                "original": llm_values,
                "optimized": hc_values,
                "category": categories[0] if categories else "positive"
            })

    # 2. Nếu không có gì cần polish, trả về luôn
    if not tc_batch:
        return [
            {**tc, "polished_values": tc.get("hc_values", tc.get("values", {})), "polish_notes": {}, "was_polished": False}
            for tc in tc_list
        ]
        
    # 3. Gọi LLM theo từng chunk (batching)
    active_key = api_key_override or os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")
    from .prompts import get_batch_semantic_polish_prompt
    from .llm_client import call_llm_json
    
    polished_results_map = {}
    
    chunks = []
    if active_key:
        # Chia nhỏ tc_batch thành các chunk kích thước max_polish
        chunks = [tc_batch[i:i + max_polish] for i in range(0, len(tc_batch), max_polish)]
        for chunk in chunks:
            if cancel_check and cancel_check():
                print(">>> [POLISH] Job cancelled by user")
                break
            try:
                sys_prompt, usr_prompt = get_batch_semantic_polish_prompt(schema, chunk)
                result, engine, model = call_llm_json(sys_prompt, usr_prompt, api_key_override, llm_provider)
                
                # Kết quả là { "results": [ { "tcId": ..., "polished_values": ..., "polish_notes": ... } ] }
                results_array = result.get("results", [])
                for r in results_array:
                    tc_id = r.get("tcId")
                    if tc_id:
                        # Validate: kiểm tra enum không bị phá vỡ
                        polished = r.get("polished_values", {})
                        notes = r.get("polish_notes", {})
                        original_optimized = tc_map[tc_id].get("hc_values", tc_map[tc_id].get("values", {}))
                        
                        import re as _re
                        _PLACEHOLDER = _re.compile(
                            r"(invalid input|no valid|not provided|no address|placeholder|"
                            r"\bunknown\b|sample value|input detected|\bn/a\b|no data|"
                            r"không hợp lệ|không có dữ liệu)", _re.IGNORECASE)

                        enum_safe_polished = {**original_optimized}
                        for f in schema:
                            name = f.get("name")
                            if name not in polished: continue
                            new_val = polished[name]
                            keep_orig = original_optimized.get(name, new_val)

                            # a) Enum: phải nằm trong allowedValues
                            allowed = f.get("allowedValues")
                            if allowed and str(new_val) not in [str(v) for v in allowed]:
                                print(f">>> [POLISH] Enum violation '{name}': '{new_val}'. Giữ giá trị thuật toán.")
                                enum_safe_polished[name] = keep_orig
                                continue

                            # b) Regex của spec: polished phải khớp, nếu không -> giữ giá trị thuật toán
                            freg = f.get("regex")
                            if freg and isinstance(new_val, str):
                                try:
                                    if not _re.search(freg, new_val):
                                        print(f">>> [POLISH] Regex violation '{name}': '{new_val[:40]}'. Giữ giá trị thuật toán.")
                                        enum_safe_polished[name] = keep_orig
                                        continue
                                except _re.error:
                                    pass

                            # c) Text placeholder/mô tả (không phải giá trị thật) -> từ chối
                            if isinstance(new_val, str) and _PLACEHOLDER.search(new_val):
                                print(f">>> [POLISH] Placeholder text '{name}': '{new_val[:40]}'. Giữ giá trị thuật toán.")
                                enum_safe_polished[name] = keep_orig
                                continue

                            enum_safe_polished[name] = new_val
                                
                        polished_results_map[tc_id] = {
                            "polished_values": enum_safe_polished,
                            "polish_notes": notes,
                            "was_polished": True
                        }
                        
                log_ai_call(db, "/semantic-polish-batch", engine, model, f"Batch polish: {len(chunk)} TCs", json.dumps(result, ensure_ascii=False), "SUCCESS")
            except Exception as e:
                print(f">>> [POLISH BATCH] LLM failed for chunk: {e}")

    # 4. Gộp kết quả
    results = []
    for tc in tc_list:
        tc_id = tc.get("_internal_id")
        hc_values = tc.get("hc_values", tc.get("values", {}))
        
        if tc_id in polished_results_map:
            results.append({**tc, **polished_results_map[tc_id]})
            print(f">>> [POLISH] TC {tc_id} đã được làm đẹp ngữ nghĩa (Batched)")
        else:
            results.append({
                **tc,
                "polished_values": hc_values,
                "polish_notes": {},
                "was_polished": False
            })

    print(f">>> [POLISH] Đã batch polish {len(tc_batch)}/{len(tc_list)} TC (Sử dụng {len(chunks)} chunks)")
    return results


def execute_semantic_mutation_plan(current_val: str, field_schema: dict, plan: dict, api_key_override: str = None, llm_provider: str = "gemini") -> str:
    """
    Sử dụng LLM làm Semantic Mutation Provider.
    Nhận Mutation Contract (Kế hoạch) từ GA/HC Planner và sinh ra dữ liệu phù hợp.
    """
    system_prompt = (
        "You are a semantic test data mutation engine.\n"
        "Rules:\n"
        "- Never break schema.\n"
        "- Preserve meaning.\n"
        "- Move toward requested boundary.\n"
        "- Return ONLY JSON.\n"
    )
    
    user_prompt = f"""
INPUT:

field:
{plan.get('field')}

current:
{current_val}

goal:
{plan.get('action', 'explore')} {plan.get('target', 'unknown')}

constraint:
{json.dumps(plan.get('constraints', []), ensure_ascii=False)}
{json.dumps(field_schema, ensure_ascii=False)}

OUTPUT FORMAT:
{{
 "value": "<mutated_value>",
 "reasoning": "<brief explanation>",
 "preserved_rules": ["<rule1>", "<rule2>"]
}}

CRITICAL: Return ONLY valid JSON, without Markdown blocks.
"""

    try:
        response, _, _ = call_llm_json(system_prompt, user_prompt, api_key_override, llm_provider)
        if isinstance(response, dict) and "value" in response:
            return str(response["value"])
        return current_val
    except Exception as e:
        print(f"[Mutation Planner] LLM Error: {e}")
        return None

def execute_batch_semantic_mutation(batch_requests: list, api_key_override: str = None, llm_provider: str = "gemini") -> dict:
    """
    Sử dụng LLM để xử lý một BATCH các đột biến cùng lúc.
    Trả về dictionary map: mutation_id -> mutated_value
    """
    if not batch_requests:
        return {}
        
    from .prompts import get_batch_semantic_mutation_prompt
    import os
    
    active_key = api_key_override or os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not active_key:
        return {}

    try:
        sys_prompt, usr_prompt = get_batch_semantic_mutation_prompt(batch_requests)
        result, engine, model = call_llm_json(sys_prompt, usr_prompt, api_key_override, llm_provider)
        
        mutated_map = {}
        results_array = result.get("results", [])
        for r in results_array:
            mid = r.get("mutation_id")
            val = r.get("value")
            if mid and val is not None:
                mutated_map[mid] = str(val)
                
        # TODO: log_ai_call here if we pass db? 
        # Skipping db log here because we don't pass db to mutation executor
        return mutated_map
    except Exception as e:
        print(f"[Mutation Batch Planner] LLM Error: {e}")
        return {}
