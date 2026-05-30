import os
import json
import urllib.request
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
                with urllib.request.urlopen(req, context=ssl_context, timeout=20) as response:
                    resp_data = response.read().decode("utf-8")
                    resp_json = json.loads(resp_data)
                    text_content = resp_json["candidates"][0]["content"]["parts"][0]["text"]
                    parsed_result = json.loads(text_content)
                    
                    # In log dữ liệu trả về từ Gemini REST API đẹp đẽ lên console của Backend
                    print(">>> INFO: Gemini REST API Response:\n", json.dumps(parsed_result, indent=2, ensure_ascii=False))
                    return parsed_result
            except Exception as ssl_err:
                # Nếu gặp lỗi chứng chỉ SSL (như CERTIFICATE_VERIFY_FAILED trên macOS), thực hiện fallback bỏ qua xác thực
                print(f">>> WARNING: SSL verification failed ({str(ssl_err)}). Retrying with unverified context...")
                unverified_context = ssl._create_unverified_context()
                with urllib.request.urlopen(req, context=unverified_context, timeout=20) as response:
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
            
            # Đón nhận và giải mã chuỗi JSON trả về
            raw_response_content = response.choices[0].message.content
            parsed_result = json.loads(raw_response_content)
            
            # In log dữ liệu trả về từ OpenAI API đẹp đẽ lên console của Backend
            print(">>> INFO: OpenAI API Response:\n", json.dumps(parsed_result, indent=2, ensure_ascii=False))
            return parsed_result

    except Exception as e:
        # Nếu có bất kỳ lỗi kết nối hay lỗi API nào, tự động kích hoạt Fallback để không làm sập Server
        print(f">>> ERROR: Loi ket noi AI API ({str(e)}). Kich hoat bo sinh du phong thong minh...")
        return get_mock_fallback_data(raw_text)
