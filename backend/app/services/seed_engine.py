"""
TestForge V4.1 - Deterministic Seed Generation Engine
======================================================
Architecture:
  Phase 0: Fail-Fast Validation Gate (schema, contract, golden record)
  Phase 1: Deterministic Value Engine (golden + mutation → values, no LLM for values)
  Phase 2: Repair Engine (fix non-target field contamination)
  Phase 3: Acceptance Gate (coverage_accuracy, valid_baseline_rate)

Key principles:
  - Backend generates `values` deterministically
  - LLM only generates metadata: scenario, rationale, categories
  - Coverage Contract is Source of Truth (no ruleId regeneration)
  - apply_mutation() is a PURE FUNCTION (no random, no fallback)
  - Fingerprint validates seed integrity (anti-drift)
  - Fail fast on schema/contract errors; repair only LLM generation errors
"""
import re
import json
import copy
import hashlib
from typing import Any
ALLOWED_MUTATION_TYPES = {'set_empty', 'length', 'set_value', 'invalid_format', 'invalid_range'}
_INVALID_FORMAT_MAP = {'email': ['not-an-email', 'user@.com', 'plainaddress'], 'phone': ['12345', '091234567890', 'abcdefghij'], 'card': ['1234', 'not-a-card', '411111111111111a'], 'date': ['2026/13/99', '31-02-2026', 'not-a-date'], 'number': ['not-a-number', 'abc', '!@#$'], 'string': ['!', ' ', '@']}
_VALID_EXAMPLE_MAP = {'email': ['nguyen.van.an@gmail.com', 'user+promo@gmail.com', 'qa.testing@yahoo.com', 'customer01@company.vn'], 'phone': ['0912345678', '0987654321', '0901234567', '0934567890'], 'card': ['4111111111111111', '4222222222222222', '5111111111111111'], 'date': ['2026-06-21', '2025-12-31', '2026-01-01'], 'boolean': [True, False], 'name': ['Nguyễn Văn An', 'Trần Minh Khang', 'Lê Thu Hà', 'Phạm Trọng Thủy'], 'address': ['123 Nguyễn Trãi, Hà Nội', '456 Lê Lợi, TP. HCM', '789 Trần Hưng Đạo, Đà Nẵng']}
_PADDING_CHAR = 'a'

def validate_schema_for_seeds(fields: list) -> list:
    """
    Returns list of error strings.
    Empty list = schema is valid and safe to generate from.
    Must be called BEFORE any LLM call or golden record generation.
    """
    errors = []
    for f in fields:
        name = f.get('name', '<unnamed>')
        min_l = f.get('minLength')
        max_l = f.get('maxLength')
        min_v = f.get('minValue')
        max_v = f.get('maxValue')
        regex = f.get('regex')
        allowed = f.get('allowedValues')
        if min_l is not None and max_l is not None:
            try:
                if int(min_l) > int(max_l):
                    errors.append(f"Field '{name}': minLength({min_l}) > maxLength({max_l})")
            except (TypeError, ValueError):
                errors.append(f"Field '{name}': minLength/maxLength không phải số nguyên")
        if min_v is not None and max_v is not None:
            try:
                if float(min_v) > float(max_v):
                    errors.append(f"Field '{name}': minValue({min_v}) > maxValue({max_v})")
            except (TypeError, ValueError):
                errors.append(f"Field '{name}': minValue/maxValue không phải số")
        if regex:
            try:
                re.compile(regex)
            except re.error as e:
                print(f"WARNING: Field '{name}': regex không hợp lệ - {e}. Bỏ qua regex này để tiếp tục.", flush=True)
                f['regex'] = None
        if allowed is not None and isinstance(allowed, list) and (len(allowed) == 0):
            errors.append(f"Field '{name}': allowedValues là mảng rỗng - không có giá trị hợp lệ nào")
    return errors

def validate_coverage_contract_items(contract: list, fields: list) -> list:
    """
    Returns list of error strings.
    Empty list = contract is structurally valid.
    """
    errors = []
    field_names = {f['name'] for f in fields}
    seen_ids: set = set()
    for item in contract:
        item_id = item.get('id', '<no_id>')
        outcome = item.get('expectedOutcome')
        field = item.get('field')
        mutation = item.get('mutation')
        if item_id in seen_ids:
            errors.append(f"Contract: duplicate id '{item_id}'")
        seen_ids.add(item_id)
        if outcome not in ('valid', 'invalid'):
            errors.append(f"'{item_id}': expectedOutcome phải là 'valid' hoặc 'invalid', got '{outcome}'")
        if field is not None and field not in field_names:
            errors.append(f"'{item_id}': field '{field}' không tồn tại trong schema")
        if outcome == 'invalid' and mutation is None:
            errors.append(f"'{item_id}': expectedOutcome='invalid' nhưng thiếu mutation")
        if mutation is not None:
            m_type = mutation.get('type')
            if m_type not in ALLOWED_MUTATION_TYPES:
                errors.append(f"'{item_id}': mutation.type='{m_type}' không hợp lệ. Allowed: {ALLOWED_MUTATION_TYPES}")
            if m_type == 'length' and mutation.get('target') is None:
                errors.append(f"'{item_id}': mutation type='length' thiếu target")
            if m_type in ('set_value', 'invalid_format') and 'value' not in mutation:
                errors.append(f"'{item_id}': mutation type='{m_type}' thiếu value")
    return errors

def _make_valid_value(field: dict) -> Any:
    """
    Returns a deterministic realistic value for a field using Realistic Data Factory.
    """
    name = field.get('name', '')
    ftype = field.get('semantic_type') or field.get('type') or field.get('data_type', 'string')
    allowed = field.get('allowedValues')
    name_lower = name.lower()
    if allowed and isinstance(allowed, list) and (len(allowed) > 0):
        return _get_deterministic_choice(allowed, name)
    if ftype == 'email' or 'email' in name_lower:
        return _get_deterministic_choice(_VALID_EXAMPLE_MAP['email'], name)
    if ftype == 'phone' or 'phone' in name_lower or 'sdt' in name_lower:
        return _get_deterministic_choice(_VALID_EXAMPLE_MAP['phone'], name)
    if ftype == 'card' or 'card' in name_lower:
        return _get_deterministic_choice(_VALID_EXAMPLE_MAP['card'], name)
    if ftype == 'date' or 'date' in name_lower or 'ngay' in name_lower:
        return _get_deterministic_choice(_VALID_EXAMPLE_MAP['date'], name)
    if ftype == 'boolean':
        return True
    if 'name' in name_lower or 'ten' in name_lower:
        return _get_deterministic_choice(_VALID_EXAMPLE_MAP['name'], name)
    if 'address' in name_lower or 'dia_chi' in name_lower:
        return _get_deterministic_choice(_VALID_EXAMPLE_MAP['address'], name)
    if ftype == 'number':
        min_v = field.get('minValue')
        max_v = field.get('maxValue')
        if min_v is not None and max_v is not None:
            mid = (float(min_v) + float(max_v)) / 2
            return int(mid) if mid == int(mid) else mid
        if min_v is not None:
            return float(min_v)
        if max_v is not None:
            return float(max_v) - 1
        return 0
    min_l = field.get('minLength')
    max_l = field.get('maxLength')
    regex = field.get('regex')
    target_len = 8
    if min_l is not None and max_l is not None:
        target_len = (int(min_l) + int(max_l)) // 2
        target_len = max(int(min_l), target_len)
    elif min_l is not None:
        target_len = int(min_l) + 2
    elif max_l is not None:
        target_len = max(1, int(max_l) - 2)
    if regex:
        candidate = _build_regex_satisfying_string(regex, target_len, field)
        if candidate:
            return candidate
    base_text = 'Sản phẩm Dịch vụ Hệ thống Tự động Hóa ' * (target_len // 30 + 1)
    return base_text[:target_len].strip()

def _build_regex_satisfying_string(regex_pattern: str, target_len: int, field: dict) -> str:
    """
    Attempts to build a realistic string that satisfies the given regex at target_len.
    Uses known patterns for common password-like regexes.
    Returns empty string if cannot satisfy.
    """
    has_upper = bool(re.search('\\[.*A-Z.*\\]|\\(\\?=.*\\[A-Z\\]\\)', regex_pattern))
    has_lower = bool(re.search('\\[.*a-z.*\\]|\\(\\?=.*\\[a-z\\]\\)', regex_pattern))
    has_digit = bool(re.search('\\\\d|\\[.*0-9.*\\]|\\(\\?=.*\\[0-9\\]\\)', regex_pattern))
    has_special = bool(re.search('\\[.*[@#\\$!%\\*\\?&\\^\\-_].*\\]|\\(\\?=.*[@#\\$]', regex_pattern))
    if has_upper or has_lower or has_digit or has_special:
        base_passwords = ['Welcome', 'Password', 'Hyperion', 'Secure', 'Testing']
        base = _get_deterministic_choice(base_passwords, field.get('name', ''))
        if has_upper and (not any((c.isupper() for c in base))):
            base = 'A' + base[1:]
        if has_lower and (not any((c.islower() for c in base))):
            base = base[:-1] + 'a'
        if has_digit:
            base += '1'
        if has_special:
            base += '@'
        pad_len = max(0, target_len - len(base))
        if pad_len > 0:
            padding = '234567890' * (pad_len // 9 + 1)
            candidate = base + padding[:pad_len]
        else:
            essential = ''
            if has_digit:
                essential += '1'
            if has_special:
                essential += '@'
            base_trunc_len = target_len - len(essential)
            candidate = base[:max(1, base_trunc_len)] + essential
            candidate = candidate[:target_len]
        try:
            if re.search(regex_pattern, candidate):
                return candidate
        except re.error:
            pass
    return ''

def _sync_cross_field_rules(record: dict, fields: list) -> None:
    """
    Syncs cross-field rules in-place.
    Currently handles: confirm_password = password, password_confirm = password.
    """
    password_field = None
    confirm_field = None
    for f in fields:
        name = f.get('name', '').lower()
        if name == 'password' or name == 'mat_khau':
            password_field = f['name']
        if name in ('confirm_password', 'password_confirm', 'nhap_lai_mat_khau', 'confirmpassword', 'repassword', 're_password'):
            confirm_field = f['name']
    if password_field and confirm_field and (password_field in record):
        record[confirm_field] = record[password_field]

def _check_all_field_validity(record: dict, fields: list) -> list:
    """
    Returns list of {field, rule, message} for each constraint violation.
    Used by golden record generation and validate_seed_against_coverage.
    """
    errors = []
    for f in fields:
        name = f.get('name')
        val = record.get(name)
        ftype = f.get('semantic_type') or f.get('type') or f.get('data_type', 'string')
        req = f.get('required', False)
        val_is_empty = val is None or str(val).strip() == ''
        if req and val_is_empty:
            errors.append({'field': name, 'rule': 'required', 'message': f"'{name}' là bắt buộc nhưng bị bỏ trống"})
            continue
        if val_is_empty:
            continue
        val_str = str(val)
        allowed = f.get('allowedValues')
        if allowed and isinstance(allowed, list):
            if val_str not in [str(v) for v in allowed]:
                errors.append({'field': name, 'rule': 'allowedValues', 'message': f"'{name}' = '{val}' không có trong allowedValues"})
            continue
        field_regex = f.get('regex')
        if field_regex:
            try:
                if not re.search(field_regex, val_str):
                    errors.append({'field': name, 'rule': 'regex', 'message': f"'{name}' không khớp regex"})
            except re.error:
                pass
        if ftype == 'email':
            if not re.match('^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', val_str):
                errors.append({'field': name, 'rule': 'email_format', 'message': f"'{name}' sai định dạng email"})
        elif ftype == 'phone':
            if not re.match('^(03|05|07|08|09)\\d{8}$', val_str):
                errors.append({'field': name, 'rule': 'phone_format', 'message': f"'{name}' sai định dạng SĐT VN"})
        elif ftype == 'card':
            if not re.match('^\\d{16}$', val_str):
                errors.append({'field': name, 'rule': 'card_format', 'message': f"'{name}' phải gồm 16 chữ số"})
        elif ftype == 'number':
            try:
                num = float(val)
                min_v = f.get('minValue')
                max_v = f.get('maxValue')
                if min_v is not None and num < float(min_v):
                    errors.append({'field': name, 'rule': 'minValue', 'message': f"'{name}' = {val} < minValue({min_v})"})
                if max_v is not None and num > float(max_v):
                    errors.append({'field': name, 'rule': 'maxValue', 'message': f"'{name}' = {val} > maxValue({max_v})"})
            except (TypeError, ValueError):
                errors.append({'field': name, 'rule': 'type_number', 'message': f"'{name}' không phải số"})
        else:
            min_l = f.get('minLength')
            max_l = f.get('maxLength')
            if min_l is not None and len(val_str) < int(min_l):
                errors.append({'field': name, 'rule': 'minLength', 'message': f"'{name}' dài {len(val_str)} < minLength({min_l})"})
            if max_l is not None and len(val_str) > int(max_l):
                errors.append({'field': name, 'rule': 'maxLength', 'message': f"'{name}' dài {len(val_str)} > maxLength({max_l})"})
    return errors

def build_global_coverage_contract(fields: list) -> list:
    """
    Builds a fully specified Coverage Matrix Contract.
    Each item includes: id, field, type, expectedOutcome, mutation.
    This IS the Source of Truth - no ruleId regeneration elsewhere.
    """
    contract = []
    contract.append({'id': 'POS_HAPPY_PATH', 'field': None, 'type': 'positive', 'expectedOutcome': 'valid', 'mutation': None})
    for field in fields:
        name = field.get('name')
        ftype = field.get('semantic_type') or field.get('type') or field.get('data_type', 'string')
        req = field.get('required', False)
        min_l = field.get('minLength')
        max_l = field.get('maxLength')
        min_v = field.get('minValue')
        max_v = field.get('maxValue')
        allowed = field.get('allowedValues')
        N = name.upper()
        if req:
            contract.append({'id': f'REQ_{N}_MISSING', 'field': name, 'type': 'negative', 'expectedOutcome': 'invalid', 'mutation': {'type': 'set_empty'}})
        if min_l is not None:
            try:
                v = int(min_l)
                if v - 1 >= 0:
                    contract.append({'id': f'BVA_{N}_LEN_MIN_MINUS_1', 'field': name, 'type': 'negative', 'expectedOutcome': 'invalid', 'mutation': {'type': 'length', 'target': v - 1, 'preserveOtherConstraints': True}})
                contract.append({'id': f'BVA_{N}_LEN_MIN', 'field': name, 'type': 'boundary', 'expectedOutcome': 'valid', 'mutation': {'type': 'length', 'target': v, 'preserveOtherConstraints': True}})
                if max_l is None or v + 1 <= int(max_l):
                    contract.append({'id': f'BVA_{N}_LEN_MIN_PLUS_1', 'field': name, 'type': 'boundary', 'expectedOutcome': 'valid', 'mutation': {'type': 'length', 'target': v + 1, 'preserveOtherConstraints': True}})
            except (TypeError, ValueError):
                pass
        if max_l is not None:
            try:
                v = int(max_l)
                if min_l is None or v - 1 >= int(min_l):
                    contract.append({'id': f'BVA_{N}_LEN_MAX_MINUS_1', 'field': name, 'type': 'boundary', 'expectedOutcome': 'valid', 'mutation': {'type': 'length', 'target': v - 1, 'preserveOtherConstraints': True}})
                contract.append({'id': f'BVA_{N}_LEN_MAX', 'field': name, 'type': 'boundary', 'expectedOutcome': 'valid', 'mutation': {'type': 'length', 'target': v, 'preserveOtherConstraints': True}})
                contract.append({'id': f'BVA_{N}_LEN_MAX_PLUS_1', 'field': name, 'type': 'negative', 'expectedOutcome': 'invalid', 'mutation': {'type': 'length', 'target': v + 1, 'preserveOtherConstraints': True}})
            except (TypeError, ValueError):
                pass
        if min_v is not None:
            try:
                v = float(min_v)
                vi = int(v) if v == int(v) else v
                contract.extend([{'id': f'BVA_{N}_MIN_MINUS_1', 'field': name, 'type': 'negative', 'expectedOutcome': 'invalid', 'mutation': {'type': 'invalid_range', 'value': vi - 1}}, {'id': f'BVA_{N}_MIN', 'field': name, 'type': 'boundary', 'expectedOutcome': 'valid', 'mutation': {'type': 'set_value', 'value': vi}}, {'id': f'BVA_{N}_MIN_PLUS_1', 'field': name, 'type': 'boundary', 'expectedOutcome': 'valid', 'mutation': {'type': 'set_value', 'value': vi + 1}}])
            except (TypeError, ValueError):
                pass
        if max_v is not None:
            try:
                v = float(max_v)
                vi = int(v) if v == int(v) else v
                contract.extend([{'id': f'BVA_{N}_MAX_MINUS_1', 'field': name, 'type': 'boundary', 'expectedOutcome': 'valid', 'mutation': {'type': 'set_value', 'value': vi - 1}}, {'id': f'BVA_{N}_MAX', 'field': name, 'type': 'boundary', 'expectedOutcome': 'valid', 'mutation': {'type': 'set_value', 'value': vi}}, {'id': f'BVA_{N}_MAX_PLUS_1', 'field': name, 'type': 'negative', 'expectedOutcome': 'invalid', 'mutation': {'type': 'invalid_range', 'value': vi + 1}}])
            except (TypeError, ValueError):
                pass
        if ftype == 'email':
            contract.extend([{'id': f'EP_{N}_VALID_FORMAT', 'field': name, 'type': 'equivalence', 'expectedOutcome': 'valid', 'mutation': {'type': 'set_value', 'value': _get_deterministic_choice(_VALID_EXAMPLE_MAP['email'], name)}}, {'id': f'EP_{N}_INVALID_FORMAT', 'field': name, 'type': 'negative', 'expectedOutcome': 'invalid', 'mutation': {'type': 'invalid_format', 'value': _get_deterministic_choice(_INVALID_FORMAT_MAP['email'], name)}}, {'id': f'EP_{N}_MISSING_AT', 'field': name, 'type': 'negative', 'expectedOutcome': 'invalid', 'mutation': {'type': 'invalid_format', 'value': 'usergmail.com'}}])
        elif ftype == 'phone':
            contract.extend([{'id': f'EP_{N}_VALID_VN', 'field': name, 'type': 'equivalence', 'expectedOutcome': 'valid', 'mutation': {'type': 'set_value', 'value': '0912345678'}}, {'id': f'EP_{N}_INVALID_PREFIX', 'field': name, 'type': 'negative', 'expectedOutcome': 'invalid', 'mutation': {'type': 'invalid_format', 'value': '1234567890'}}, {'id': f'EP_{N}_TOO_SHORT', 'field': name, 'type': 'negative', 'expectedOutcome': 'invalid', 'mutation': {'type': 'invalid_format', 'value': '09123'}}])
        elif ftype == 'card':
            contract.extend([{'id': f'EP_{N}_VALID_16D', 'field': name, 'type': 'equivalence', 'expectedOutcome': 'valid', 'mutation': {'type': 'set_value', 'value': '4111111111111111'}}, {'id': f'EP_{N}_INVALID_SHORT', 'field': name, 'type': 'negative', 'expectedOutcome': 'invalid', 'mutation': {'type': 'invalid_format', 'value': '411111'}}])
        elif ftype == 'date':
            contract.extend([{'id': f'EP_{N}_VALID_ISO', 'field': name, 'type': 'equivalence', 'expectedOutcome': 'valid', 'mutation': {'type': 'set_value', 'value': '2026-06-21'}}, {'id': f'EP_{N}_INVALID_FORMAT', 'field': name, 'type': 'negative', 'expectedOutcome': 'invalid', 'mutation': {'type': 'invalid_format', 'value': '21/06/2026'}}])
        elif ftype == 'number':
            if min_v is not None and max_v is not None:
                mid = (float(min_v) + float(max_v)) / 2
                mid_val = int(mid) if mid == int(mid) else mid
            elif min_v is not None:
                mid_val = float(min_v) + 5
            elif max_v is not None:
                mid_val = float(max_v) - 5
            else:
                mid_val = 50
            contract.extend([{'id': f'EP_{N}_VALID_RANGE', 'field': name, 'type': 'equivalence', 'expectedOutcome': 'valid', 'mutation': {'type': 'set_value', 'value': mid_val}}, {'id': f'EP_{N}_INVALID_TYPE', 'field': name, 'type': 'negative', 'expectedOutcome': 'invalid', 'mutation': {'type': 'invalid_format', 'value': 'not-a-number'}}])
        elif ftype == 'boolean':
            contract.extend([{'id': f'EP_{N}_TRUE', 'field': name, 'type': 'equivalence', 'expectedOutcome': 'valid', 'mutation': {'type': 'set_value', 'value': True}}, {'id': f'EP_{N}_FALSE', 'field': name, 'type': 'equivalence', 'expectedOutcome': 'valid', 'mutation': {'type': 'set_value', 'value': False}}])
        elif allowed and isinstance(allowed, list) and (len(allowed) > 0):
            contract.extend([{'id': f'EP_{N}_VALID_OPTION', 'field': name, 'type': 'equivalence', 'expectedOutcome': 'valid', 'mutation': {'type': 'set_value', 'value': allowed[0]}}, {'id': f'EP_{N}_INVALID_OPTION', 'field': name, 'type': 'negative', 'expectedOutcome': 'invalid', 'mutation': {'type': 'set_value', 'value': '__INVALID_OPTION__'}}])
    bool_enum_fields = [f for f in fields if f.get('semantic_type') == 'boolean' or f.get('type') == 'boolean' or (f.get('allowedValues') and isinstance(f['allowedValues'], list))]
    if len(bool_enum_fields) >= 2:
        f1 = bool_enum_fields[0]
        f2 = bool_enum_fields[1]
        val1 = True if f1.get('semantic_type') == 'boolean' or f1.get('type') == 'boolean' else f1['allowedValues'][0]
        val2 = True if f2.get('semantic_type') == 'boolean' or f2.get('type') == 'boolean' else f2['allowedValues'][0]
        contract.append({'id': f"DEC_{f1['name'].upper()}_AND_{f2['name'].upper()}", 'field': f1['name'], 'type': 'positive', 'expectedOutcome': 'valid', 'mutation': {'type': 'structural_variant', 'variant_index': 99, 'extra_values': {f1['name']: val1, f2['name']: val2}}})
    return contract

def get_method_view(global_contract: list, test_method: str) -> list:
    """
    Filters the global coverage contract based on the requested test_method.
    This maintains cross-method synergy while isolating test objectives.
    """
    view = []
    if test_method in ('hybrid', 'random'):
        view.append({'id': 'F0_HYBRID_BASE', 'field': None, 'type': 'positive', 'expectedOutcome': 'valid', 'mutation': None, 'method': 'HYBRID'})
        view.append({'id': 'F0_HYBRID_VAR_1', 'field': None, 'type': 'positive', 'expectedOutcome': 'valid', 'mutation': {'type': 'structural_variant', 'variant_index': 1}, 'method': 'HYBRID'})
        view.append({'id': 'F0_HYBRID_VAR_2', 'field': None, 'type': 'positive', 'expectedOutcome': 'valid', 'mutation': {'type': 'structural_variant', 'variant_index': 2}, 'method': 'HYBRID'})
        view.append({'id': 'F0_HYBRID_VAR_3', 'field': None, 'type': 'positive', 'expectedOutcome': 'valid', 'mutation': {'type': 'structural_variant', 'variant_index': 3}, 'method': 'HYBRID'})
    elif test_method == 'bva':
        for item in global_contract:
            if item['id'].startswith('BVA_'):
                item['method'] = 'BVA'
                view.append(item)
    elif test_method == 'ep':
        for item in global_contract:
            if item['id'].startswith('EP_'):
                item['method'] = 'EP'
                view.append(item)
    elif test_method == 'decision':
        for item in global_contract:
            if item['id'].startswith('DEC_') or item['id'].startswith('REQ_'):
                item['method'] = 'DECISION'
                view.append(item)
    else:
        view = global_contract
    return view

def build_coverage_index(contract: list) -> dict:
    """
    O(1) lookup map: coverage_id → coverage_item.
    Must be built once and passed through the entire pipeline.
    """
    return {item['id']: item for item in contract}

def _make_string_with_exact_length(field_def: dict, target_len: int, preserve_constraints: bool, base_val: str='') -> str:
    """Returns a string of EXACTLY target_len characters."""
    if target_len <= 0:
        return ''
    if base_val:
        if len(base_val) >= target_len:
            candidate = base_val[:target_len]
        else:
            pad_len = target_len - len(base_val)
            padding = ' thêm dữ liệu mới' * (pad_len // 15 + 1)
            candidate = base_val + padding[:pad_len]
        if not preserve_constraints:
            return candidate
        regex = field_def.get('regex')
        if regex:
            import re
            try:
                if re.search(regex, candidate):
                    return candidate
            except re.error:
                pass
        else:
            return candidate
    base_text = 'Dữ liệu kiểm thử hệ thống Hyperion TestForge ' * (target_len // 40 + 1)
    if not preserve_constraints:
        return base_text[:target_len]
    regex = field_def.get('regex')
    ftype = field_def.get('semantic_type') or field_def.get('type') or 'string'
    if regex:
        candidate = _build_regex_satisfying_string(regex, target_len, field_def)
        if candidate and len(candidate) == target_len:
            return candidate
        if candidate:
            if len(candidate) < target_len:
                pad_len = target_len - len(candidate)
                padding = '234567890' * (pad_len // 9 + 1)
                return (candidate + padding)[:target_len]
            return candidate[:target_len]
    return base_text[:target_len]

def compute_seed_fingerprint(golden_record: dict, coverage_item: dict) -> str:
    """
    SHA-256 fingerprint of golden_record + coverage_item id + mutation.
    Embed in seed; verify after LLM + repair to detect unintended drift.
    """
    raw = json.dumps({'golden': golden_record, 'coverage': coverage_item.get('id'), 'mutation': coverage_item.get('mutation')}, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16]

def validate_seed_against_coverage(seed: dict, coverage_item: dict, golden_record: dict, fields: list) -> bool:
    """
    Validates a seed using Coverage Contract as source of truth.
    Does NOT regenerate ruleIds - checks against contract directly.

    Rules:
    1. Non-target fields in seed["values"] must match golden_record exactly.
    2. Target field outcome must match coverage_item["expectedOutcome"].
    3. Fingerprint must match (if present).
    """
    outcome = coverage_item.get('expectedOutcome', 'invalid')
    field_name = coverage_item.get('field')
    values = seed.get('values', seed)
    expected_fp = compute_seed_fingerprint(golden_record, coverage_item)
    actual_fp = seed.get('seedFingerprint', '')
    if actual_fp and actual_fp != expected_fp:
        print(f">>> [VALIDATE] Fingerprint mismatch for {coverage_item['id']}: expected={expected_fp}, got={actual_fp}", flush=True)
        return False
    for field in fields:
        name = field['name']
        if name == field_name:
            continue
        seed_val = str(values.get(name, ''))
        golden_val = str(golden_record.get(name, ''))
        if seed_val != golden_val:
            print(f">>> [VALIDATE] Contamination: '{name}' = '{seed_val}' (expected golden='{golden_val}')", flush=True)
            return False
    if field_name is None:
        errors = _check_all_field_validity(values, fields)
        return len(errors) == 0
    target_errors = [e for e in _check_all_field_validity(values, fields) if e['field'] == field_name]
    if outcome == 'valid':
        if len(target_errors) == 0:
            return True
        else:
            print(f">>> [REJECT ENGINE] REPAIR: Unintended Invalid on target '{field_name}' (expected valid, got {target_errors})", flush=True)
            return False
    elif len(target_errors) >= 1:
        print(f">>> [REJECT ENGINE] ACCEPT: Expected Invalid on target '{field_name}'", flush=True)
        return True
    else:
        print(f">>> [REJECT ENGINE] REPAIR: Unintended Valid on target '{field_name}' (expected invalid)", flush=True)
        return False

def repair_seed(seed: dict, coverage_item: dict, golden_record: dict, fields: list) -> dict:
    """
    Repairs a seed by restoring contaminated non-target fields to golden_record values.
    Does NOT deepcopy golden (which would lose LLM metadata).
    Only called for LLM generation errors - not schema or contract errors.
    """
    repaired = copy.deepcopy(seed)
    field_name = coverage_item.get('field')
    values = repaired.get('values', repaired)
    correct_values = apply_mutation(golden_record, coverage_item, fields)
    for field in fields:
        name = field['name']
        if name == field_name:
            values[name] = correct_values[name]
            continue
        values[name] = golden_record[name]
    _sync_cross_field_rules(values, fields)
    repaired['values'] = values
    repaired['expectedResult'] = _deterministic_result(coverage_item['expectedOutcome'], coverage_item)
    repaired['errorDescription'] = _deterministic_error(coverage_item['expectedOutcome'], coverage_item)
    repaired['coverageTags'] = [coverage_item['id']]
    repaired['seedFingerprint'] = compute_seed_fingerprint(golden_record, coverage_item)
    return repaired

def run_acceptance_gate(seeds: list, contract: list, coverage_index: dict, golden_record: dict, fields: list) -> dict:
    """
    Evaluates seeds against acceptance criteria.
    Returns {"passed": bool, "metrics": {...}}.
    """
    total = len(contract)
    covered_ok = 0
    valid_ok = 0
    total_valid = sum((1 for c in contract if c.get('expectedOutcome') == 'valid'))
    executed_ids = set()
    for seed in seeds:
        cov_id = seed.get('coverageId')
        if not cov_id or cov_id not in coverage_index:
            continue
        cov_item = coverage_index[cov_id]
        executed_ids.add(cov_id)
        if validate_seed_against_coverage(seed, cov_item, golden_record, fields):
            covered_ok += 1
            if cov_item['expectedOutcome'] == 'valid':
                valid_ok += 1
    coverage_accuracy = round(covered_ok / max(total, 1), 3)
    valid_baseline_rate = round(valid_ok / max(total_valid, 1), 3) if total_valid else 1.0
    mutation_coverage = round(len(executed_ids) / max(total, 1), 3)
    metrics = {'coverage_accuracy': coverage_accuracy, 'valid_baseline_rate': valid_baseline_rate, 'mutation_coverage': mutation_coverage, 'covered_count': covered_ok, 'total_contract': total}
    passed = coverage_accuracy >= 0.95 and valid_baseline_rate == 1.0 and (mutation_coverage == 1.0)
    print(f'>>> [GATE] coverage={coverage_accuracy:.1%} | valid_baseline={valid_baseline_rate:.1%} | mutation_coverage={mutation_coverage:.1%} | passed={passed}', flush=True)
    return {'passed': passed, 'metrics': metrics}

def describe_mutation(coverage_item: dict) -> str:
    """Returns a short Vietnamese description of what this coverage item tests."""
    item_id = coverage_item.get('id', '')
    field = coverage_item.get('field', '')
    mutation = coverage_item.get('mutation') or {}
    outcome = coverage_item.get('expectedOutcome', 'invalid')
    m_type = mutation.get('type', '')
    target = mutation.get('target', '')
    value = mutation.get('value', '')
    if m_type == 'set_empty':
        return f"Bỏ trống trường '{field}' (bắt buộc)"
    if m_type == 'length':
        direction = 'ngắn hơn giới hạn tối thiểu' if outcome == 'invalid' and 'MIN' in item_id else 'đúng biên' if outcome == 'valid' else 'vượt quá giới hạn tối đa'
        return f"Trường '{field}' dài {target} ký tự ({direction})"
    if m_type == 'set_value':
        return f"Trường '{field}' = {value} (giá trị {('hợp lệ' if outcome == 'valid' else 'không hợp lệ')})"
    if m_type == 'invalid_format':
        return f"Trường '{field}' = '{value}' (định dạng không hợp lệ)"
    if m_type == 'invalid_range':
        return f"Trường '{field}' = {value} (ngoài khoảng cho phép)"
    if item_id == 'POS_HAPPY_PATH':
        return 'Tất cả trường hợp lệ - Happy path'
    return item_id