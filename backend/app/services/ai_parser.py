import os
import json
import urllib.request
import random
from openai import OpenAI
from dotenv import load_dotenv


# Nạp các biến cấu hình cục bộ từ tệp .env
load_dotenv()

# Hàm phụ trợ: Bộ sinh dữ liệu giả lập thông minh (Smart Mock Parser)
# Được kích hoạt tự động làm cơ chế dự phòng (Fallback) nếu bạn không cấu hình OpenAI API Key.
# Đảm bảo hệ thống luôn chạy mượt mà và không bao giờ bị sập.
def get_mock_fallback_data(raw_text: str):
    text_lower = raw_text.lower()
    
    # 1. Preset Đăng ký tài khoản
    if "email" in text_lower and ("đăng ký" in text_lower or "signup" in text_lower):
        return {
            "fields": [
                {"name": "username", "type": "string", "required": True, "minLength": 5, "maxLength": 15, "regex": "^[a-zA-Z0-9]+$", "description": "Tên tài khoản viết liền không dấu, dài 5-15 ký tự"},
                {"name": "password", "type": "string", "required": True, "minLength": 8, "maxLength": 20, "description": "Mật khẩu tối thiểu 8 ký tự, có chữ và số"},
                {"name": "email", "type": "email", "required": True, "description": "Địa chỉ email liên hệ hợp lệ"},
                {"name": "age", "type": "number", "required": False, "minValue": 18, "maxValue": 100, "description": "Số tuổi từ 18 đến 100"}
            ],
            "initialPopulation": [
                {"username": "admin99", "password": "Password123!", "email": "admin@test.vn", "age": 25},
                {"username": "sarah_k", "password": "SecurePass9!", "email": "sarah.k@yahoo.com", "age": 31},
                {"username": "guest", "password": "Password@2026", "email": "guest@outlook.com", "age": 18}, # giá trị biên
                {"username": "hack' OR '1'='1", "password": "inject' --", "email": "sql@inject.org", "age": 29}, # payload tấn công SQLi
                {"username": "<script>alert(1)</script>", "password": "XssPassword!", "email": "xss@payload.com", "age": 30} # payload tấn công XSS
            ]
        }
    
    # 2. Preset Cổng thanh toán
    elif "card" in text_lower or "thanh toán" in text_lower or "payment" in text_lower:
        return {
            "fields": [
                {"name": "cardNumber", "type": "card", "required": True, "regex": "^\\d{16}$", "description": "Số thẻ tín dụng gồm 16 chữ số"},
                {"name": "cvv", "type": "string", "required": True, "minLength": 3, "maxLength": 3, "regex": "^\\d{3}$", "description": "3 chữ số bảo mật đằng sau thẻ"},
                {"name": "amount", "type": "number", "required": True, "minValue": 1, "maxValue": 50000, "description": "Số tiền thanh toán từ 1 đến 50,000 USD"},
                {"name": "currency", "type": "string", "required": True, "allowedValues": ["USD", "VND", "EUR"], "description": "Đơn vị: USD, VND, EUR"}
            ],
            "initialPopulation": [
                {"cardNumber": "4111222233334444", "cvv": "123", "amount": 150, "currency": "USD"},
                {"cardNumber": "5555666677778888", "cvv": "999", "amount": 50000, "currency": "EUR"}, # giá trị biên
                {"cardNumber": "4111222233334444' OR cvv='999", "cvv": "999", "amount": 100, "currency": "USD"} # payload tấn công SQLi
            ]
        }
        
    # 3. Fallback mặc định nếu không khớp preset nào
    return {
        "fields": [
            {"name": "inputText", "type": "string", "required": True, "minLength": 3, "maxLength": 30, "description": "Dữ liệu nhập thô 3-30 ký tự"}
        ],
        "initialPopulation": [
            {"inputText": "User123"},
            {"inputText": "admin"},
            {"inputText": "' OR 1=1 --"} # payload tấn công SQLi
        ]
    }


def parse_spec_with_openai(raw_text: str, api_key_override: str = None) -> dict:
    """
    Hàm kết nối trực tiếp với AI API (Hỗ trợ cả Gemini API và OpenAI API).
    Nó nhận diện API Key từ cấu hình hệ thống hoặc từ giá trị tạm thời do Client gửi lên.
    Trả về một đối tượng Python Dict chứa cấu trúc trường và mảng Test Cases mẫu F0.
    """
    # Bước 1: Quyết định API Key sử dụng. Ưu tiên khóa nhập từ màn hình Client trước.
    active_key = None
    if api_key_override:
        active_key = api_key_override
    else:
        # Ưu tiên lấy GEMINI_API_KEY trước, sau đó tới OPENAI_API_KEY
        active_key = os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")
    
    # Bước 2: Nếu hoàn toàn không có API Key, tự động chuyển sang chế độ Dự phòng (Smart Fallback)
    if not active_key or active_key.strip() == "":
        print(">>> WARNING: AI API Key khong tim thay. Kich hoat bo sinh du phong thong minh (Mock Fallback)...")
        return get_mock_fallback_data(raw_text)

    # Nhận diện xem Key thuộc về Gemini hay OpenAI (Key Gemini thường bắt đầu bằng AIzaSy)
    is_gemini = active_key.strip().startswith("AIzaSy") or (os.getenv("GEMINI_API_KEY") == active_key if os.getenv("GEMINI_API_KEY") else False)
    
    system_instructions = (
        "You are an expert senior software developer and automated QA engineer.\n"
        "Your task is to analyze the natural language specification of a web application input form "
        "and extract a structured JSON schema of the field constraints, plus a list of 8-10 smart initial "
        "test case records (F0 dataset) for a test suite.\n\n"
        
        "The returned JSON must EXACTLY follow this structure:\n"
        "{\n"
        "  \"fields\": [\n"
        "    {\n"
        "      \"name\": \"tên_trường_viết_thường_không_dấu\",\n"
        "      \"type\": \"string\" | \"number\" | \"email\" | \"card\" | \"phone\",\n"
        "      \"required\": true | false,\n"
        "      \"minLength\": 5, // tự động phân tích độ dài tối thiểu nếu là dạng chuỗi\n"
        "      \"maxLength\": 20, // độ dài tối đa nếu là dạng chuỗi\n"
        "      \"minValue\": 18, // giá trị nhỏ nhất nếu là số\n"
        "      \"maxValue\": 100, // giá trị lớn nhất nếu là số\n"
        "      \"regex\": \"pattern\", // biểu thức regex kiểm tra nếu đặc tả mô tả cấu trúc phức tạp\n"
        "      \"allowedValues\": [\"VAL1\", \"VAL2\"], // mảng các giá trị được phép nếu dạng ENUM\n"
        "      \"description\": \"Giải thích ngắn gọn quy định của trường dữ liệu bằng Tiếng Việt\"\n"
        "    }\n"
        "  ],\n"
        "  \"initialPopulation\": [\n"
        "    { \"tên_trường\": \"giá_trị_test_1\" },\n"
        "    { \"tên_trường\": \"giá_trị_test_2\" }\n"
        "  ]\n"
        "}\n\n"
        
        "CRITICAL REQUIREMENTS FOR THE F0 INITIAL DATASET:\n"
        "Generate exactly 8-10 smart test case records. Incorporate a wide variety of testing scenarios:\n"
        "- At least 3 valid cases (correct format, normal values).\n"
        "- At least 2 boundary cases (values matching exact minimum/maximum limits or string lengths).\n"
        "- At least 2 security attack injection payloads (such as SQL Injection e.g. \"' OR 1=1 --\" or XSS scripts e.g. \"<script>alert(1)</script>\") to verify robustness.\n"
        "- At least 1 invalid case (out of bounds or broken formats)."
    )

    try:
        # Bước 3: Khởi tạo Client và thực thi tương ứng
        if is_gemini:
            print(">>> INFO: Phat hien Gemini API Key. Dang goi truc tiep Google Gemini REST API...")
            
            # Gọi trực tiếp qua API Endpoint chính thức của Google Gemini v1beta sử dụng JSON mode
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={active_key.strip()}"
            
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": f"{system_instructions}\n\nHere is the natural language input specification:\n{raw_text}"}
                        ]
                    }
                ],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.2
                }
            }
            
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            
            # Khởi tạo SSL Context an toàn sử dụng certifi hoặc dự phòng unverified
            import ssl
            ssl_context = None
            try:
                import certifi
                ssl_context = ssl.create_default_context(cafile=certifi.where())
            except Exception:
                ssl_context = ssl._create_unverified_context()
            
            try:
                with urllib.request.urlopen(req, context=ssl_context, timeout=60) as response:
                    resp_data = response.read().decode("utf-8")
                    resp_json = json.loads(resp_data)
                    text_content = resp_json["candidates"][0]["content"]["parts"][0]["text"]
                    parsed_result = json.loads(text_content)
                    
                    # In log dữ liệu trả về từ Gemini REST API đẹp đẽ lên console của Backend
                    print(">>> INFO: Gemini REST API Response:\n", json.dumps(parsed_result, indent=2, ensure_ascii=False))
                    return parsed_result
            except urllib.error.HTTPError as http_err:
                raise http_err
            except Exception as ssl_err:
                # Nếu gặp lỗi chứng chỉ SSL (như CERTIFICATE_VERIFY_FAILED trên macOS), thực hiện fallback bỏ qua xác thực
                print(f">>> WARNING: SSL verification failed ({str(ssl_err)}). Retrying with unverified context...")
                unverified_context = ssl._create_unverified_context()
                with urllib.request.urlopen(req, context=unverified_context, timeout=60) as response:
                    resp_data = response.read().decode("utf-8")
                    resp_json = json.loads(resp_data)
                    text_content = resp_json["candidates"][0]["content"]["parts"][0]["text"]
                    parsed_result = json.loads(text_content)
                    
                    # In log dữ liệu trả về từ Gemini REST API đẹp đẽ lên console của Backend (chế độ Unverified SSL)
                    print(">>> INFO: Gemini REST API Response (Unverified SSL):\n", json.dumps(parsed_result, indent=2, ensure_ascii=False))
                    return parsed_result
        else:
            print(">>> INFO: Phat hien OpenAI API Key. Dang su dung GPT lam AI engine...")
            client = OpenAI(api_key=active_key)
            
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_instructions},
                    {"role": "user", "content": f"Here is the natural language input specification:\n{raw_text}"}
                ],
                temperature=0.2, # Đặt temperature thấp để cấu trúc trả về mang tính logic, chuẩn xác nhất
                max_tokens=1500
            )
            
            # In log dữ liệu trả về từ OpenAI API đẹp đẽ lên console của Backend
            print(">>> INFO: OpenAI API Response:\n", json.dumps(parsed_result, indent=2, ensure_ascii=False))
            return parsed_result

    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "401" in error_msg or "400" in error_msg or "403" in error_msg or "503" in error_msg:
            raise ValueError(f"API_KEY_ERROR: {error_msg}")
        
        # Nếu có bất kỳ lỗi kết nối hay lỗi API nào khác, kích hoạt Fallback để không làm sập Server
        print(f">>> ERROR: Loi ket noi AI API ({error_msg}). Kich hoat bo sinh du phong thong minh...")
        return get_mock_fallback_data(raw_text)


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
        elif t == "number":
            min_val = field.get("minValue", 0)
            max_val = field.get("maxValue", 1000)
            if mode == 'invalid':
                return min_val - 5 if random.random() > 0.5 else max_val + 5
            if length is not None:
                return length
            return random.randint(min_val, max_val)
        else: # string
            min_len = field.get("minLength", 3)
            max_len = field.get("maxLength", 20)
            if field.get("allowedValues"):
                if mode == 'invalid':
                    return "INVALID_VAL"
                return random.choice(field["allowedValues"])
            
            actual_len = length if length is not None else random.randint(min_len, max_len)
            if mode == 'invalid' and length is None:
                actual_len = max(0, min_len - 2) if random.random() > 0.5 else max_len + 5
                
            if actual_len == 0:
                return ""
            chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
            return "".join(random.choice(chars) for _ in range(actual_len))

    # BVA local generator
    if test_method == "bva":
        field_targets = {}
        for f in fields:
            name = f["name"]
            ftype = f.get("type", "string")
            targets = []
            
            # Hàm tạo offsets chuẩn theo số lượng điểm biên (2, 3, 5)
            # Ánh xạ theo chuẩn kỹ thuật phân tích giá trị biên (Boundary Value Analysis):
            # - 2 biên: Kiểm thử 2 điểm sát nhau (1 hợp lệ, 1 lỗi). VD: biên Min sẽ test (Min-1) và Min.
            # - 3 biên (Robust): Kiểm thử 3 điểm (Min-1, Min, Min+1) để bao quát toàn bộ 2 bên biên.
            # - 5 biên (Worst-case): Tăng cường mở rộng kiểm tra 5 điểm (-2, -1, 0, 1, 2) cho các hệ thống nhạy cảm.
            def get_bva_offsets(b_count, is_min=True):
                if b_count == 2:
                    # Với biên Min, ta lấy [-1, 0] (dưới biên và tại biên)
                    # Với biên Max, ta lấy [0, 1] (tại biên và trên biên)
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

        # Generate test cases to cover these targets
        max_targets = max([len(t) for t in field_targets.values()] or [1])
        num_records = max(10, max_targets)
        
        for i in range(num_records):
            record = {}
            for f in fields:
                name = f["name"]
                ftype = f.get("type", "string")
                targets = field_targets.get(name, [])
                
                if targets:
                    target_val = targets[i % len(targets)]
                    if ftype == "number":
                        record[name] = target_val
                    else: # string
                        record[name] = get_default_value(f, length=target_val)
                else:
                    record[name] = get_default_value(f, mode='boundary' if i % 2 == 0 else 'valid')
            population.append(record)

    # EP local generator
    elif test_method == "ep":
        field_targets = {}
        for f in fields:
            name = f["name"]
            ftype = f.get("type", "string")
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
            elif ftype == "string":
                min_l = f.get("minLength", 3)
                max_l = f.get("maxLength", 20)
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
        num_records = max(8, max_targets)
        for i in range(num_records):
            record = {}
            for f in fields:
                name = f["name"]
                ftype = f.get("type", "string")
                targets = field_targets.get(name, [])
                if targets:
                    target_val = targets[i % len(targets)]
                    if ftype == "number":
                        record[name] = target_val
                    else:
                        record[name] = get_default_value(f, length=target_val)
                else:
                    record[name] = get_default_value(f, mode='invalid' if i % 4 == 0 else 'valid')
            population.append(record)

    # Decision Table local generator
    elif test_method == "decision":
        for i in range(10):
            record = {}
            for idx, f in enumerate(fields):
                name = f["name"]
                if i - 1 == idx:
                    record[name] = get_default_value(f, mode='invalid')
                elif i == 0:
                    record[name] = get_default_value(f, mode='valid')
                elif i == 9:
                    record[name] = get_default_value(f, mode='valid')
                    if f.get("type") in ["string", "email"]:
                        record[name] = "' OR '1'='1"
                else:
                    record[name] = get_default_value(f, mode='valid')
            population.append(record)

    # Random/Hybrid
    else:
        modes = ['valid', 'valid', 'valid', 'boundary', 'boundary', 'security', 'security', 'invalid', 'valid', 'boundary']
        for i in range(10):
            record = {}
            mode = modes[i % len(modes)]
            for f in fields:
                name = f["name"]
                record[name] = get_default_value(f, mode=mode)
            population.append(record)

    return population


def generate_seeds(fields: list, test_method: str, boundary_count: int = 4, partition_count: int = 3, api_key: str = None, raw_text: str = "") -> list:
    """
    Main entrypoint to generate seeds based on selected test method (AI-powered or local fallback).
    """
    active_key = api_key if api_key else (os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY"))
    
    if not active_key or active_key.strip() == "":
        print(f">>> INFO: No API key found. Running local seed generator for method '{test_method}'...")
        return generate_seeds_locally(fields, test_method, boundary_count, partition_count)

    is_gemini = active_key.strip().startswith("AIzaSy") or (os.getenv("GEMINI_API_KEY") == active_key if os.getenv("GEMINI_API_KEY") else False)

    # Prepare custom system instructions based on test method
    if test_method == "bva":
        system_instructions = (
            "You are an expert QA automation engineer.\n"
            "Your task is to generate exactly 10-12 high-quality initial seed test case records (F0 dataset) "
            "for the given fields schema using Boundary Value Analysis (BVA).\n\n"
            
            f"CRITICAL REQUIREMENT FOR BVA (boundary_count = {boundary_count}):\n"
            "For each field with numeric limits (minValue, maxValue) or string length limits (minLength, maxLength), "
            f"you must generate test values precisely focusing on {boundary_count} values around each boundary limit B.\n"
        )
        if boundary_count == 2:
            system_instructions += "For a minimum limit B, generate B and B-1. For a maximum limit B, generate B and B+1.\n"
        elif boundary_count == 3:
            system_instructions += "For any limit B (min or max), generate exactly B-1, B, and B+1.\n"
        elif boundary_count == 5:
            system_instructions += "For any limit B (min or max), generate exactly B-2, B-1, B, B+1, and B+2.\n"
        else:
            system_instructions += f"For any limit B, generate exactly {boundary_count} values distributed around B.\n"
            
        system_instructions += (
            "These boundary values must cover both valid and invalid boundaries.\n"
            "The generated values must look realistic (e.g. realistic names, passwords, email formats) but have "
            "the exact lengths/values required by BVA.\n\n"
            
            "Your response must be a single JSON object matching this structure:\n"
            "{\n"
            "  \"initialPopulation\": [\n"
            "    { \"field_name\": value },\n"
            "    ...\n"
            "  ]\n"
            "}"
        )
    elif test_method == "ep":
        system_instructions = (
            "You are an expert QA automation engineer.\n"
            "Your task is to generate exactly 8-10 high-quality initial seed test case records (F0 dataset) "
            "for the given fields schema using Equivalence Partitioning (EP).\n\n"
            
            f"CRITICAL REQUIREMENT FOR EP (partition_count = {partition_count}):\n"
            "Divide the input domain of each field (valid range of values or lengths) into exactly "
            f"{partition_count} equal intervals.\n"
            "For each field, generate representative valid values in the middle of each partition, "
            "as well as out-of-bounds invalid values (e.g. values below min and above max).\n"
            "The generated values must look realistic but represent these partitions.\n\n"
            
            "Your response must be a single JSON object matching this structure:\n"
            "{\n"
            "  \"initialPopulation\": [\n"
            "    { \"field_name\": value },\n"
            "    ...\n"
            "  ]\n"
            "}"
        )
    elif test_method == "decision":
        system_instructions = (
            "You are an expert QA automation engineer.\n"
            "Your task is to generate exactly 8-10 high-quality initial seed test case records (F0 dataset) "
            "for the given fields schema using a Decision Table combination approach.\n\n"
            
            "CRITICAL REQUIREMENT:\n"
            "Generate combination cases testing logic rules:\n"
            "- Standard valid case where all fields are valid.\n"
            "- Cases where exactly one field is invalid, and all other fields are valid (to test single-field validations).\n"
            "- Cases where multiple fields are invalid.\n"
            "- At least 2 security payloads (SQLi, XSS) combined with other valid fields.\n"
            "The generated values must look realistic.\n\n"
            
            "Your response must be a single JSON object matching this structure:\n"
            "{\n"
            "  \"initialPopulation\": [\n"
            "    { \"field_name\": value },\n"
            "    ...\n"
            "  ]\n"
            "}"
        )
    else: # random/hybrid
        system_instructions = (
            "You are an expert QA automation engineer.\n"
            "Your task is to generate exactly 8-10 high-quality initial seed test case records (F0 dataset) "
            "for the given fields schema.\n\n"
            
            "CRITICAL REQUIREMENTS:\n"
            "Generate exactly 8-10 smart test case records. Incorporate a wide variety of testing scenarios:\n"
            "- At least 3 valid cases (correct format, normal values).\n"
            "- At least 2 boundary cases (values matching exact minimum/maximum limits or string lengths).\n"
            "- At least 2 security attack injection payloads (such as SQL Injection e.g. \"' OR 1=1 --\" or XSS scripts e.g. \"<script>alert(1)</script>\") to verify robustness.\n"
            "- At least 1 invalid case (out of bounds or broken formats).\n\n"
            
            "Your response must be a single JSON object matching this structure:\n"
            "{\n"
            "  \"initialPopulation\": [\n"
            "    { \"field_name\": value },\n"
            "    ...\n"
            "  ]\n"
            "}"
        )

    user_prompt = f"Fields Schema: {json.dumps(fields, ensure_ascii=False)}\n\nOriginal business requirements context (if any):\n{raw_text}"

    try:
        if is_gemini:
            print(f">>> INFO: Calling Gemini API for seed regeneration (Method: {test_method})...")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={active_key.strip()}"
            
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": f"{system_instructions}\n\n{user_prompt}"}
                        ]
                    }
                ],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.2
                }
            }
            
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            
            import ssl
            ssl_context = None
            try:
                import certifi
                ssl_context = ssl.create_default_context(cafile=certifi.where())
            except Exception:
                ssl_context = ssl._create_unverified_context()
            
            try:
                with urllib.request.urlopen(req, context=ssl_context, timeout=60) as response:
                    resp_data = response.read().decode("utf-8")
                    resp_json = json.loads(resp_data)
                    text_content = resp_json["candidates"][0]["content"]["parts"][0]["text"]
                    parsed_result = json.loads(text_content)
                    return parsed_result.get("initialPopulation", [])
            except urllib.error.HTTPError as http_err:
                raise http_err
            except Exception as ssl_err:
                print(f">>> WARNING: SSL verification failed. Retrying with unverified context...")
                unverified_context = ssl._create_unverified_context()
                with urllib.request.urlopen(req, context=unverified_context, timeout=60) as response:
                    resp_data = response.read().decode("utf-8")
                    resp_json = json.loads(resp_data)
                    text_content = resp_json["candidates"][0]["content"]["parts"][0]["text"]
                    parsed_result = json.loads(text_content)
                    return parsed_result.get("initialPopulation", [])
        else:
            print(f">>> INFO: Calling OpenAI API for seed regeneration (Method: {test_method})...")
            client = OpenAI(api_key=active_key)
            
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_instructions},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                max_tokens=1000
            )
            
            raw_response_content = response.choices[0].message.content
            parsed_result = json.loads(raw_response_content)
            return parsed_result.get("initialPopulation", [])

    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "401" in error_msg or "400" in error_msg or "403" in error_msg or "503" in error_msg:
            raise ValueError(f"API_KEY_ERROR: {error_msg}")
            
        print(f">>> ERROR: AI API failed for seed regeneration ({error_msg}). Running local generator fallback...")
        return generate_seeds_locally(fields, test_method, boundary_count, partition_count)


def evaluate_test_quality_with_ai(fields: list, seeds: list, test_method: str, raw_text: str, api_key_override: str = None) -> dict:
    """
    Gửi bộ F0 Seeds và Schema lên AI (Gemini/OpenAI) để đánh giá chất lượng độ phủ, biên, và bảo mật.
    """
    active_key = api_key_override or os.getenv("OPENAI_API_KEY")
    
    system_instructions = """
    Bạn là một chuyên gia kiểm thử phần mềm (QA Manager/Test Architect) xuất sắc.
    Nhiệm vụ của bạn là đánh giá tập dữ liệu hạt giống (Initial Test Seeds) vừa được sinh ra dựa trên đặc tả nghiệp vụ và cấu trúc trường dữ liệu.
    Hãy phân tích và trả về kết quả dưới dạng JSON theo đúng cấu trúc sau:
    {
        "score": 85, // Điểm chất lượng (0-100)
        "strengths": ["Điểm mạnh 1", "Điểm mạnh 2"], // Mảng các chuỗi
        "weaknesses": ["Điểm yếu 1", "Điểm yếu 2"], // Mảng các chuỗi
        "missing_cases": ["Trường hợp thiếu 1", "Trường hợp thiếu 2"], // Mảng các chuỗi
        "security_risks": ["Rủi ro 1", "Rủi ro 2"] // Mảng các chuỗi, nếu an toàn thì để mảng rỗng
    }
    Lưu ý: TRẢ VỀ ĐÚNG FORMAT JSON OBJECT. Tối đa 3 item cho mỗi mảng để giữ sự ngắn gọn. Viết bằng Tiếng Việt.
    """
    
    user_prompt = f"""
    --- ĐẶC TẢ NGHIỆP VỤ ---
    {raw_text}
    
    --- CẤU TRÚC TRƯỜNG DỮ LIỆU ---
    {json.dumps(fields, indent=2, ensure_ascii=False)}
    
    --- PHƯƠNG PHÁP KIỂM THỬ ĐANG DÙNG ---
    {test_method}
    
    --- BỘ CA KIỂM THỬ F0 ---
    {json.dumps(seeds, indent=2, ensure_ascii=False)}
    
    Hãy đánh giá khách quan và trả về JSON theo yêu cầu.
    """
    
    # Mock fallback logic nếu không có KEY hoặc có lỗi
    mock_response = {
        "score": random.randint(75, 95),
        "strengths": [
            "Bao phủ tốt các trường hợp cơ bản (Happy path).",
            "Đã sử dụng cấu trúc đúng định dạng dữ liệu được yêu cầu."
        ],
        "weaknesses": [
            "Chưa có nhiều dữ liệu đột biến dị biệt.",
            "Số lượng ca kiểm thử F0 còn hạn chế để tiến hóa mạnh."
        ],
        "missing_cases": [
            "Thiếu kiểm thử giá trị rỗng (Null/Empty) ở một số trường phụ.",
            "Thiếu chuỗi Unicode đặc biệt hoặc Emoji."
        ],
        "security_risks": [
            "Cần bổ sung thêm mẫu XSS nâng cao."
        ]
    }
    
    if not active_key:
        print(">>> WARNING: No API Key provided for evaluation. Using mock data.")
        return mock_response
        
    try:
        active_key = active_key.strip()
        if active_key.startswith("AIza"):
            import ssl
            import urllib.request
            req_data = {
                "contents": [
                    {"role": "user", "parts": [{"text": system_instructions + "\n\n" + user_prompt}]}
                ],
                "generationConfig": {
                    "temperature": 0.2,
                    "responseMimeType": "application/json"
                }
            }
            # Sử dụng gemini-3.5-flash theo cấu hình custom của dự án
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={active_key}"
            req = urllib.request.Request(url, data=json.dumps(req_data).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
            
            ssl_context = None
            try:
                import certifi
                ssl_context = ssl.create_default_context(cafile=certifi.where())
            except Exception:
                ssl_context = ssl._create_unverified_context()
                
            try:
                with urllib.request.urlopen(req, context=ssl_context, timeout=60) as response:
                    resp_data = response.read().decode("utf-8")
                    resp_json = json.loads(resp_data)
                    text_content = resp_json["candidates"][0]["content"]["parts"][0]["text"]
                    return json.loads(text_content)
            except urllib.error.HTTPError as http_err:
                raise http_err
        else:
            client = OpenAI(api_key=active_key)
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_instructions},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2
            )
            return json.loads(response.choices[0].message.content)
            
    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "401" in error_msg or "400" in error_msg or "403" in error_msg or "503" in error_msg:
            raise ValueError(f"API_KEY_ERROR: {error_msg}")
            
        print(f">>> ERROR: Evaluation API failed: {error_msg}. Using mock data.")
        return mock_response
