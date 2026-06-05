import os
import json
import urllib.request
import random
from openai import OpenAI
from dotenv import load_dotenv
from sqlalchemy.orm import Session


# Hàm helper ghi nhận nhật ký cuộc gọi AI vào console và SQLite database
def log_ai_call(db: Session, endpoint: str, provider: str, model: str, input_summary: str, output_summary: str, status: str, token_count: int = None, error_message: str = None):
    # In ra console rõ ràng
    print(f"\n=================== [LLM CALL LOG] ===================")
    print(f"Endpoint:  {endpoint}")
    print(f"Provider:  {provider} ({model})")
    print(f"Status:    {status}")
    if error_message:
        print(f"Error:     {error_message}")
    else:
        # In tóm tắt ngắn lên console
        input_clean = input_summary.replace('\n', ' ') if input_summary else ""
        output_clean = output_summary.replace('\n', ' ') if output_summary else ""
        print(f"Input:     {input_clean[:120] + '...' if len(input_clean) > 120 else input_clean}")
        print(f"Output:    {output_clean[:120] + '...' if len(output_clean) > 120 else output_clean}")
    print(f"======================================================\n")

    if db is None:
        return
    try:
        from ..models import AICallLog
        db_log = AICallLog(
            endpoint=endpoint,
            provider=provider,
            model=model,
            input_summary=input_summary,
            output_summary=output_summary,
            token_count_estimate=token_count if token_count is not None else (len(input_summary or "") + len(output_summary or "")) // 4,
            status=status,
            error_message=error_message
        )
        db.add(db_log)
        db.commit()
        db.refresh(db_log)
    except Exception as e:
        print(f">>> ERROR logging AI call to DB: {e}")


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
        
    # 3. Preset Đăng nhập (Login Form)
    if any(kw in text_lower for kw in ["đăng nhập", "login", "sign in", "signin", "log in"]) and ("password" in text_lower or "mật khẩu" in text_lower):
        return {
            "fields": [
                {"name": "username", "type": "string", "required": True, "minLength": 3, "maxLength": 32, "description": "Tên đăng nhập hoặc email"},
                {"name": "password", "type": "string", "required": True, "minLength": 6, "maxLength": 30, "description": "Mật khẩu đăng nhập"},
                {"name": "rememberMe", "type": "string", "required": False, "allowedValues": ["true", "false"], "description": "Ghi nhớ đăng nhập"}
            ],
            "initialPopulation": [
                {"username": "admin", "password": "Admin@123!", "rememberMe": "true"},
                {"username": "john.doe@gmail.com", "password": "JohnDoe2026!", "rememberMe": "false"},
                {"username": "", "password": "short", "rememberMe": "true"}, # lỗi empty + short
                {"username": "a" * 33, "password": "ValidPass1!", "rememberMe": "maybe"}, # lỗi max length + invalid enum
                {"username": "admin' OR '1'='1", "password": "' OR 1=1 --", "rememberMe": "true"}, # SQLi
                {"username": "test_user", "password": "PassW0rd!", "rememberMe": "false"},
            ]
        }

    # 4. Preset API Search Endpoint
    if any(kw in text_lower for kw in ["search", "tìm kiếm", "query", "api"]) and ("limit" in text_lower or "page" in text_lower or "sort" in text_lower or "filter" in text_lower):
        return {
            "fields": [
                {"name": "query", "type": "string", "required": True, "minLength": 1, "maxLength": 200, "description": "Từ khóa tìm kiếm"},
                {"name": "limit", "type": "number", "required": False, "minValue": 1, "maxValue": 100, "description": "Số kết quả tối đa mỗi trang"},
                {"name": "page", "type": "number", "required": False, "minValue": 1, "maxValue": 1000, "description": "Số trang"},
                {"name": "sortBy", "type": "string", "required": False, "allowedValues": ["relevance", "date", "price", "name"], "description": "Tiêu chí sắp xếp"},
                {"name": "order", "type": "string", "required": False, "allowedValues": ["asc", "desc"], "description": "Thứ tự sắp xếp"}
            ],
            "initialPopulation": [
                {"query": "laptop gaming", "limit": 20, "page": 1, "sortBy": "relevance", "order": "desc"},
                {"query": "", "limit": 0, "page": 0, "sortBy": "invalid", "order": "asc"}, # lỗi validation
                {"query": "phone", "limit": 100, "page": 1, "sortBy": "price", "order": "asc"}, # biên limit max
                {"query": "x" * 201, "limit": 101, "page": 1001, "sortBy": "name", "order": "desc"}, # lỗi biên
                {"query": "laptop' UNION SELECT * FROM users --", "limit": 50, "page": 1, "sortBy": "date", "order": "desc"}, # SQLi
                {"query": "<script>alert(document.cookie)</script>", "limit": 10, "page": 1, "sortBy": "relevance", "order": "asc"}, # XSS
            ]
        }

    # 5. Preset E-Commerce Checkout
    if any(kw in text_lower for kw in ["checkout", "thanh toán", "đặt hàng", "order", "mua hàng", "cart", "giỏ hàng", "shipping", "giao hàng"]):
        return {
            "fields": [
                {"name": "fullName", "type": "string", "required": True, "minLength": 2, "maxLength": 50, "description": "Họ tên người nhận"},
                {"name": "email", "type": "email", "required": True, "description": "Email xác nhận đơn hàng"},
                {"name": "phone", "type": "phone", "required": True, "description": "SĐT giao hàng"},
                {"name": "address", "type": "string", "required": True, "minLength": 10, "maxLength": 200, "description": "Địa chỉ giao hàng chi tiết"},
                {"name": "quantity", "type": "number", "required": True, "minValue": 1, "maxValue": 20, "description": "Số lượng sản phẩm"},
                {"name": "paymentMethod", "type": "string", "required": True, "allowedValues": ["COD", "CreditCard", "BankTransfer", "EWallet"], "description": "Phương thức thanh toán"},
                {"name": "promoCode", "type": "string", "required": False, "maxLength": 15, "description": "Mã giảm giá (tùy chọn)"}
            ],
            "initialPopulation": [
                {"fullName": "Nguyễn Văn An", "email": "an.nguyen@gmail.com", "phone": "0912345678", "address": "123 Nguyễn Huệ, Quận 1, TP.HCM", "quantity": 2, "paymentMethod": "COD", "promoCode": "SALE2026"},
                {"fullName": "Trần Thị Mai", "email": "mai.tran@yahoo.com", "phone": "0388888888", "address": "456 Lê Lợi, Đà Nẵng", "quantity": 1, "paymentMethod": "EWallet", "promoCode": ""},
                {"fullName": "A", "email": "not_an_email", "phone": "12345", "address": "Short", "quantity": 0, "paymentMethod": "Cash", "promoCode": "TOOLONGCODE12345"}, # lỗi validation
                {"fullName": "Lê Hoàng Nam" * 5, "email": "nam.le@domain.com", "phone": "0555555555", "address": "789 Trần Hưng Đạo, Hà Nội", "quantity": 20, "paymentMethod": "CreditCard", "promoCode": "BLACKFRIDAY"}, # biên
                {"fullName": "Phạm Thị Hương", "email": "huong.pham@company.vn", "phone": "0777777777", "address": "12/34 Nguyễn Trãi, Q.5, TP.HCM", "quantity": 5, "paymentMethod": "BankTransfer", "promoCode": "<script>alert(1)</script>"}, # XSS
                {"fullName": "' OR 1=1 --", "email": "hacker@evil.com", "phone": "0999999999", "address": "DROP TABLE orders; --", "quantity": 1, "paymentMethod": "COD", "promoCode": "XSS"}, # SQLi
                {"fullName": "Hoàng Văn Bình", "email": "binh.hoang@outlook.com", "phone": "0333333333", "address": "56 Hai Bà Trưng, Huế", "quantity": 3, "paymentMethod": "COD", "promoCode": "WELCOME10"},
                {"fullName": "Đỗ Minh Tuấn", "email": "tuan.do@test.com", "phone": "0866666666", "address": "Xã A, Huyện B, Tỉnh C — địa chỉ vùng sâu vùng xa có Unicode ©®™", "quantity": 10, "paymentMethod": "CreditCard", "promoCode": "VIP50"},
            ]
        }

    # 6. Fallback mặc định nếu không khớp preset nào
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


def parse_spec_with_openai(raw_text: str, api_key_override: str = None, db: Session = None) -> dict:
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
        res = get_mock_fallback_data(raw_text)
        res["is_mock"] = True
        res["engine"] = "mock"
        log_ai_call(db, "/api/specifications", "Mock", "mock-ai-local", raw_text, json.dumps(res, ensure_ascii=False), "SUCCESS")
        return enrich_result_with_expected_results(res)

    # Nhận diện xem Key thuộc về Gemini hay OpenAI (Key OpenAI bắt đầu bằng sk-)
    is_openai = active_key.strip().startswith("sk-")
    is_gemini = not is_openai
    
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
        "      \"minLength\": 5,\n"
        "      \"maxLength\": 20,\n"
        "      \"minValue\": 18,\n"
        "      \"maxValue\": 100,\n"
        "      \"regex\": \"pattern\",\n"
        "      \"allowedValues\": [\"VAL1\", \"VAL2\"],\n"
        "      \"description\": \"Giải thích ngắn gọn quy định của trường dữ liệu bằng Tiếng Việt\"\n"
        "    }\n"
        "  ],\n"
        "  \"initialPopulation\": [\n"
        "    {\n"
        "      \"tên_trường_1\": \"giá_trị_test_1\",\n"
        "      \"method\": \"random\",\n"
        "      \"scenario\": \"Kịch bản thành công (Happy path) với dữ liệu hợp lệ\"\n"
        "    },\n"
        "    {\n"
        "      \"tên_trường_1\": \"giá_trị_test_2\",\n"
        "      \"method\": \"bva\",\n"
        "      \"scenario\": \"Kiểm tra biên dưới của trường tuổi\"\n"
        "    }\n"
        "  ]\n"
        "}\n\n"
        
        "CRITICAL REQUIREMENTS FOR THE F0 INITIAL DATASET:\n"
        "Generate exactly 8-10 smart test case records. Incorporate a wide variety of testing scenarios:\n"
        "- At least 3 valid cases (correct format, normal values).\n"
        "- At least 2 boundary cases (values matching exact minimum/maximum limits or string lengths).\n"
        "- At least 2 security attack injection payloads (such as SQL Injection e.g. \"' OR 1=1 --\" or XSS scripts e.g. \"<script>alert(1)</script>\") to verify robustness.\n"
        "- At least 1 invalid case (out of bounds or broken formats).\n"
        "For each test case record in \"initialPopulation\", you MUST include the fields \"method\" (which method was used, e.g. \"random\", \"bva\", \"ep\", \"decision\") and \"scenario\" (a short explanation in Vietnamese explaining the exact test scenario, e.g. \"Kiểm tra SQL Injection\", \"Mật khẩu ngắn hơn độ dài tối thiểu\")."
    )

    try:
        # Bước 3: Khởi tạo Client và thực thi tương ứng
        if is_gemini:
            print(">>> INFO: Phat hien Gemini API Key. Dang goi truc tiep Google Gemini REST API...")
            
            # Gọi trực tiếp qua API Endpoint chính thức của Google Gemini v1beta sử dụng JSON mode
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={active_key.strip()}"
            
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
                    "temperature": 0.7
                }
            }
            
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            
            # Khởi tạo SSL Context an sau dụng certifi hoặc dự phòng unverified
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
                    parsed_result["is_mock"] = False
                    parsed_result["engine"] = "gemini"
                    
                    # In log dữ liệu trả về từ Gemini REST API đẹp đẽ lên console của Backend
                    print(">>> INFO: Gemini REST API Response:\n", json.dumps(parsed_result, indent=2, ensure_ascii=False))
                    log_ai_call(db, "/api/specifications", "Gemini", "gemini-2.5-flash", f"System: {system_instructions}\n\nRaw text: {raw_text}", json.dumps(parsed_result, ensure_ascii=False), "SUCCESS")
                    return enrich_result_with_expected_results(parsed_result)
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
                    parsed_result["is_mock"] = False
                    parsed_result["engine"] = "gemini"
                    
                    # In log dữ liệu trả về từ Gemini REST API đẹp đẽ lên console của Backend (chế độ Unverified SSL)
                    print(">>> INFO: Gemini REST API Response (Unverified SSL):\n", json.dumps(parsed_result, indent=2, ensure_ascii=False))
                    log_ai_call(db, "/api/specifications", "Gemini", "gemini-2.5-flash", f"System: {system_instructions}\n\nRaw text: {raw_text}", json.dumps(parsed_result, ensure_ascii=False), "SUCCESS")
                    return enrich_result_with_expected_results(parsed_result)
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
                temperature=0.7, # Đặt temperature thấp để cấu trúc trả về mang tính logic, chuẩn xác nhất
                max_tokens=1500
            )
            
            parsed_result = json.loads(response.choices[0].message.content)
            parsed_result["is_mock"] = False
            parsed_result["engine"] = "openai"
            
            # In log dữ liệu trả về từ OpenAI API đẹp đẽ lên console của Backend
            print(">>> INFO: OpenAI API Response:\n", json.dumps(parsed_result, indent=2, ensure_ascii=False))
            log_ai_call(db, "/api/specifications", "OpenAI", "gpt-3.5-turbo", f"System: {system_instructions}\n\nRaw text: {raw_text}", json.dumps(parsed_result, ensure_ascii=False), "SUCCESS")
            return enrich_result_with_expected_results(parsed_result)

    except Exception as e:
        error_msg = str(e)
        log_ai_call(db, "/api/specifications", "Gemini" if is_gemini else "OpenAI", "gemini-2.5-flash" if is_gemini else "gpt-3.5-turbo", f"System: {system_instructions}\n\nRaw text: {raw_text}", None, "FAILED", error_message=error_msg)
        
        if "429" in error_msg or "401" in error_msg or "400" in error_msg or "403" in error_msg or "503" in error_msg:
            raise ValueError(f"API_KEY_ERROR: {error_msg}")
        
        # Nếu có bất kỳ lỗi kết nối hay lỗi API nào khác, kích hoạt Fallback để không làm sập Server
        print(f">>> ERROR: Loi ket noi AI API ({error_msg}). Kich hoat bo sinh du phong thong minh...")
        res = get_mock_fallback_data(raw_text)
        res["is_mock"] = True
        res["engine"] = "mock"
        log_ai_call(db, "/api/specifications (Fallback)", "Mock", "mock-ai-local", raw_text, json.dumps(res, ensure_ascii=False), "SUCCESS")
        return enrich_result_with_expected_results(res)

def check_record_expected_result(record, fields):
    import re
    errors = []
    
    # 1. Kiểm tra payload tấn công bảo mật trước tiên
    security_fields = []
    for f in fields:
        name = f["name"]
        val = record.get(name)
        if val is not None:
            val_str = str(val).lower()
            if ("' or" in val_str or 
                "--" in val_str or 
                "<script" in val_str or 
                "union select" in val_str or 
                "drop table" in val_str or
                "select * from" in val_str):
                security_fields.append(name)
                
    if security_fields:
        return f"Chặn tấn công: Phát hiện payload bảo mật ở trường {', '.join(security_fields)}"

    # 2. Kiểm tra ràng buộc hợp lệ thông thường
    for f in fields:
        name = f["name"]
        val = record.get(name)
        ftype = f.get("type", "string")
        required = f.get("required", False)
        
        # Kiểm tra bắt buộc
        if required and (val is None or str(val).strip() == ""):
            errors.append(f"thiếu '{name}'")
            continue
            
        if val is None or str(val).strip() == "":
            continue
            
        val_str = str(val)
        
        if ftype == "email":
            if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", val_str):
                errors.append(f"'{name}' sai định dạng email")
        elif ftype == "card":
            if not re.match(r"^\d{16}$", val_str):
                errors.append(f"'{name}' phải gồm 16 chữ số")
        elif ftype == "phone":
            if not re.match(r"^(03|05|07|08|09)\d{8}$", val_str):
                errors.append(f"'{name}' sai đầu số di động VN")
        elif ftype == "number":
            try:
                num = float(val)
                min_v = f.get("minValue")
                max_v = f.get("maxValue")
                if min_v is not None and num < float(min_v):
                    errors.append(f"'{name}' nhỏ hơn {min_v}")
                if max_v is not None and num > float(max_v):
                    errors.append(f"'{name}' lớn hơn {max_v}")
            except (ValueError, TypeError):
                errors.append(f"'{name}' không phải số")
        else: # string
            if f.get("allowedValues") and f["allowedValues"]:
                if val_str not in [str(v) for v in f["allowedValues"]]:
                    errors.append(f"'{name}' không nằm trong danh sách cho phép")
            else:
                min_l = f.get("minLength")
                max_l = f.get("maxLength")
                if min_l is not None and len(val_str) < int(min_l):
                    errors.append(f"'{name}' ngắn hơn {min_l} ký tự")
                if max_l is not None and len(val_str) > int(max_l):
                    errors.append(f"'{name}' vượt quá {max_l} ký tự")
                    
    if errors:
        return "Lỗi: " + ", ".join(errors)
    return "Hợp lệ"


def enrich_result_with_expected_results(parsed_result):
    if parsed_result and "initialPopulation" in parsed_result:
        fields = parsed_result.get("fields", [])
        seeds = parsed_result.get("initialPopulation", [])
        for seed in seeds:
            if "expectedResult" not in seed:
                seed["expectedResult"] = check_record_expected_result(seed, fields)
    return parsed_result


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
            ftype = f.get("type", "string")
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
        num_records = max(10, max_targets)
        
        for i in range(num_records):
            record = {}
            scenarios = []
            for f in fields:
                name = f["name"]
                ftype = f.get("type", "string")
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
        num_records = max(8, max_targets)
        for i in range(num_records):
            record = {}
            scenarios = []
            for f in fields:
                name = f["name"]
                ftype = f.get("type", "string")
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
        num_records = len(fields) + 3
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
                    if f.get("type") in ["string", "email"]:
                        record[name] = "' OR '1'='1"
                    scenario = "Kiểm tra an toàn hệ thống (SQL Injection / XSS injection)"
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
        modes = ['valid', 'valid', 'valid', 'boundary', 'boundary', 'security', 'security', 'invalid', 'valid', 'boundary']
        for i in range(10):
            record = {}
            mode = modes[i % len(modes)]
            for f in fields:
                name = f["name"]
                record[name] = get_default_value(f, mode=mode)
            
            mode_desc = {
                'valid': "Dữ liệu hợp lệ ngẫu nhiên",
                'boundary': "Dữ liệu biên ngẫu nhiên",
                'security': "Payload tấn công bảo mật",
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
    
    user_prompt = f"Fields Schema: {json.dumps(fields, ensure_ascii=False)}\n\nOriginal business requirements context (if any):\n{raw_text}"

    if not active_key or active_key.strip() == "":
        print(f">>> INFO: No API key found. Running local seed generator for method '{test_method}'...")
        seeds = generate_seeds_locally(fields, test_method, boundary_count, partition_count)
        log_ai_call(db, f"/api/generate-seeds?method={test_method}", "Mock", "mock-ai-local", user_prompt, json.dumps(seeds, ensure_ascii=False), "SUCCESS")
        # Bổ sung expectedResult trước khi trả về
        for s in seeds:
            if "expectedResult" not in s:
                s["expectedResult"] = check_record_expected_result(s, fields)
        return seeds

    # Nhận diện xem Key thuộc về Gemini hay OpenAI (Key OpenAI bắt đầu bằng sk-)
    is_openai = active_key.strip().startswith("sk-")
    is_gemini = not is_openai

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
            "    {\n"
            "      \"field_name_1\": value1,\n"
            "      \"method\": \"bva\",\n"
            "      \"scenario\": \"Kiểm tra biên dưới của trường A\"\n"
            "    },\n"
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
            "    {\n"
            "      \"field_name_1\": value1,\n"
            "      \"method\": \"ep\",\n"
            "      \"scenario\": \"Kiểm tra phân vùng 2 của trường B\"\n"
            "    },\n"
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
            "    {\n"
            "      \"field_name_1\": value1,\n"
            "      \"method\": \"decision\",\n"
            "      \"scenario\": \"Kiểm tra validation trường email trống\"\n"
            "    },\n"
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
            "    {\n"
            "      \"field_name_1\": value1,\n"
            "      \"method\": \"random\",\n"
            "      \"scenario\": \"Kịch bản kiểm thử ngẫu nhiên payload bảo mật\"\n"
            "    },\n"
            "    ...\n"
            "  ]\n"
            "}"
        )

    try:
        if is_gemini:
            print(f">>> INFO: Calling Gemini API for seed regeneration (Method: {test_method})...")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={active_key.strip()}"
            
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
                    "temperature": 0.7
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
                    seeds = parsed_result.get("initialPopulation", [])
                    log_ai_call(db, f"/api/generate-seeds?method={test_method}", "Gemini", "gemini-2.5-flash", f"System: {system_instructions}\n\nUser: {user_prompt}", json.dumps(parsed_result, ensure_ascii=False), "SUCCESS")
                    for s in seeds:
                        if "expectedResult" not in s:
                            s["expectedResult"] = check_record_expected_result(s, fields)
                    return seeds
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
                    seeds = parsed_result.get("initialPopulation", [])
                    log_ai_call(db, f"/api/generate-seeds?method={test_method}", "Gemini", "gemini-2.5-flash", f"System: {system_instructions}\n\nUser: {user_prompt}", json.dumps(parsed_result, ensure_ascii=False), "SUCCESS")
                    for s in seeds:
                        if "expectedResult" not in s:
                            s["expectedResult"] = check_record_expected_result(s, fields)
                    return seeds
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
                temperature=0.7,
                max_tokens=1000
            )
            
            raw_response_content = response.choices[0].message.content
            parsed_result = json.loads(raw_response_content)
            seeds = parsed_result.get("initialPopulation", [])
            log_ai_call(db, f"/api/generate-seeds?method={test_method}", "OpenAI", "gpt-3.5-turbo", f"System: {system_instructions}\n\nUser: {user_prompt}", json.dumps(parsed_result, ensure_ascii=False), "SUCCESS")
            for s in seeds:
                if "expectedResult" not in s:
                    s["expectedResult"] = check_record_expected_result(s, fields)
            return seeds

    except Exception as e:
        error_msg = str(e)
        log_ai_call(db, f"/api/generate-seeds?method={test_method}", "Gemini" if is_gemini else "OpenAI", "gemini-2.5-flash" if is_gemini else "gpt-3.5-turbo", f"System: {system_instructions}\n\nUser: {user_prompt}", None, "FAILED", error_message=error_msg)
        if "401" in error_msg or "403" in error_msg:
            raise ValueError(f"API_KEY_ERROR: {error_msg}")
            
        print(f">>> WARNING: AI API failed for seed regeneration ({error_msg}). Running local generator fallback...")
        seeds = generate_seeds_locally(fields, test_method, boundary_count, partition_count)
        log_ai_call(db, f"/api/generate-seeds?method={test_method} (Fallback)", "Mock", "mock-ai-local", user_prompt, json.dumps(seeds, ensure_ascii=False), "SUCCESS")
        for s in seeds:
            if "expectedResult" not in s:
                s["expectedResult"] = check_record_expected_result(s, fields)
        return seeds



def evaluate_test_quality_with_ai(fields: list, seeds: list, test_method: str, raw_text: str, api_key_override: str = None, db: Session = None) -> dict:
    """
    Gửi bộ F0 Seeds và Schema lên AI (Gemini/OpenAI) để đánh giá chất lượng độ phủ, biên, và bảo mật.
    """
    active_key = api_key_override or os.getenv("OPENAI_API_KEY") or os.getenv("GEMINI_API_KEY")
    
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
        res = mock_response.copy()
        res["is_mock"] = True
        log_ai_call(db, "/api/evaluate-seeds", "Mock", "mock-ai-local", user_prompt, json.dumps(res, ensure_ascii=False), "SUCCESS")
        return res
        
    is_openai = active_key.strip().startswith("sk-")
    try:
        active_key = active_key.strip()
        if not is_openai:
            import ssl
            import urllib.request
            req_data = {
                "contents": [
                    {"role": "user", "parts": [{"text": system_instructions + "\n\n" + user_prompt}]}
                ],
                "generationConfig": {
                    "temperature": 0.7,
                    "responseMimeType": "application/json"
                }
            }
            # Sử dụng gemini-2.5-flash làm model an toàn ổn định
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={active_key}"
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
                    res = json.loads(text_content)
                    res["is_mock"] = False
                    log_ai_call(db, "/api/evaluate-seeds", "Gemini", "gemini-2.5-flash", f"System: {system_instructions}\n\nUser: {user_prompt}", json.dumps(res, ensure_ascii=False), "SUCCESS")
                    return res
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
            res = json.loads(response.choices[0].message.content)
            res["is_mock"] = False
            log_ai_call(db, "/api/evaluate-seeds", "OpenAI", "gpt-3.5-turbo", f"System: {system_instructions}\n\nUser: {user_prompt}", json.dumps(res, ensure_ascii=False), "SUCCESS")
            return res
            
    except Exception as e:
        error_msg = str(e)
        log_ai_call(db, "/api/evaluate-seeds", "Gemini" if not is_openai else "OpenAI", "gemini-2.5-flash" if not is_openai else "gpt-3.5-turbo", f"System: {system_instructions}\n\nUser: {user_prompt}", None, "FAILED", error_message=error_msg)
        if "401" in error_msg or "403" in error_msg:
            raise ValueError(f"API_KEY_ERROR: {error_msg}")
            
        print(f">>> ERROR: Evaluation API failed: {error_msg}. Using mock data.")
        res = mock_response.copy()
        res["is_mock"] = True
        log_ai_call(db, "/api/evaluate-seeds (Fallback)", "Mock", "mock-ai-local", user_prompt, json.dumps(res, ensure_ascii=False), "SUCCESS")
        return res

