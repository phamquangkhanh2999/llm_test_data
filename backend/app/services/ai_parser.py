import os
import json
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
    Hàm kết nối trực tiếp với OpenAI API.
    Nó nhận diện API Key từ cấu hình hệ thống hoặc từ giá trị tạm thời do Client gửi lên.
    Trả về một đối tượng Python Dict chứa cấu trúc trường và mảng Test Cases mẫu F0.
    """
    # Bước 1: Quyết định API Key sử dụng. Ưu tiên khóa nhập từ màn hình Client trước.
    active_key = api_key_override if api_key_override else os.getenv("OPENAI_API_KEY")
    
    # Bước 2: Nếu hoàn toàn không có API Key, tự động chuyển sang chế độ Dự phòng (Smart Fallback)
    if not active_key or active_key.strip() == "":
        print(">>> WARNING: Key OpenAI khong tim thay. Kich hoat bo sinh du phong thong minh (Mock Fallback)...")
        return get_mock_fallback_data(raw_text)

    try:
        # Bước 3: Khởi tạo Client OpenAI với API Key hợp lệ
        client = OpenAI(api_key=active_key)

        # Bước 4: Xây dựng System Prompt chi tiết hướng dẫn GPT trích xuất dữ liệu chuẩn Dev & Test
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

        # Bước 5: Gọi OpenAI API bằng chế độ JSON Object (response_format={"type": "json_object"})
        # Sử dụng mô hình gpt-4o-mini hoặc gpt-3.5-turbo để vừa thông minh vừa tiết kiệm chi phí
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

        # Bước 6: Đón nhận và giải mã chuỗi JSON trả về
        raw_response_content = response.choices[0].message.content
        parsed_result = json.loads(raw_response_content)
        
        # Bước 7: Trả về kết quả từ điển Python cho API Route sử dụng
        return parsed_result

    except Exception as e:
        # Nếu có bất kỳ lỗi kết nối hay lỗi API nào của OpenAI, tự động kích hoạt Fallback để không làm sập Server
        print(f">>> ERROR: Loi ket noi OpenAI API ({str(e)}). Kich hoat bo sinh du phong thong minh...")
        return get_mock_fallback_data(raw_text)
