import json
from typing import List, Dict

def get_parse_spec_combined_prompt(raw_text: str) -> tuple[str, str]:
    system_instruction = (
        "# ROLE\n"
        "Bạn là Senior Test Architect và Enterprise Business Analyst.\n"
        "Kinh nghiệm:\n"
        "- 15 năm Software Testing & Requirement Analysis\n"
        "- ISTQB Advanced Level Test Analyst\n"
        "- Thiết kế JSON Schema và Đặc tả hệ thống doanh nghiệp\n\n"
        
        "# MISSION\n"
        "Nhiệm vụ chính:\n"
        "Phân tích đặc tả yêu cầu nghiệp vụ để trích xuất danh sách các Trường dữ liệu (Fields Schema), Quy tắc nghiệp vụ (Business Rules), và Ràng buộc logic chéo (Constraints).\n"
        "Mục tiêu:\n"
        "- TRÍCH XUẤT VÉT CẠN 100%: Tuyệt đối không được bỏ sót bất kỳ trường dữ liệu, quy tắc, ràng buộc biên, hay logic chéo (If-Then) nào có trong tài liệu.\n"
        "- BẮT BUỘC xác định đầy đủ các giới hạn và miền giá trị (minLength, maxLength, minValue, maxValue) cho từng trường.\n"
        "- Mỗi quy tắc phải đi kèm với Kết quả mong đợi/Thông báo lỗi (Expected Results) cực kỳ chi tiết.\n\n"
        
        "# CONTEXT\n"
        f"Raw Specification:\n{raw_text}\n\n"
        
        "# HARD RULES\n"
        "1. VÉT CẠN QUY TẮC (BUSINESS RULES): BẮT BUỘC trích xuất 100% các quy tắc nghiệp vụ xuất hiện trong đặc tả. Mỗi quy tắc phải RÕ RÀNG, ĐẦY ĐỦ, và ĐỘC LẬP. Phân rã chi tiết các quy tắc thành các loại: Ràng buộc bắt buộc (presence), Ràng buộc độ dài (length), Ràng buộc miền giá trị (value), Ràng buộc định dạng (format/regex), và Tập giá trị cho phép (domain/enum). Tuyệt đối không được tự ý gom nhóm, tóm tắt hoặc bỏ bớt bất kỳ quy tắc nào dù là nhỏ nhất.\n"
        "2. VÉT CẠN LOGIC (CONSTRAINTS): Bất kỳ câu nào trong đặc tả có chứa logic điều kiện (ví dụ: 'Nếu... thì...', 'Chỉ khi...', 'Phụ thuộc vào...') BẮT BUỘC phải được trích xuất thành đối tượng trong mảng 'constraints'.\n"
        "3. EXPECTED RESULTS: Mỗi quy tắc (rule) BẮT BUỘC phải có 'errorMessage' (Kết quả mong đợi khi vi phạm quy tắc) thật cụ thể và khớp với nghiệp vụ bằng tiếng Việt.\n"
        "4. Không được suy diễn dữ liệu ngoài thông tin đặc tả đã cung cấp.\n"
        "5. Bắt buộc điền đúng loại dữ liệu 'type' của trường từ danh sách: ['string', 'number', 'email', 'card', 'phone', 'date', 'boolean'].\n"
        "6. Xác định đúng kiểu nhập liệu 'inputType' của trường (ví dụ: 'textbox', 'dropdown', 'datepicker', 'checkbox').\n"
        "7. Định dạng đầu ra phải là chuỗi JSON thuần khiết, không có thẻ markdown wrapped (ví dụ: không có ```json).\n"
        "8. LƯU Ý VỀ DỮ LIỆU MẪU: Mỗi trường BẮT BUỘC có 'successValues' (2-3 ví dụ HỢP LỆ) và 'failureValues' (1-3 ví dụ vi phạm kèm 'reason').\n"
        "9. LƯU Ý QUAN TRỌNG VỀ REGEX: Nếu trường dữ liệu (ví dụ: họ tên, địa chỉ) cho phép tiếng Việt có dấu, "
        "regex BẮT BUỘC phải hỗ trợ ký tự Unicode (sử dụng \\p{L} thay vì chỉ a-zA-Z). Ví dụ: '^[\\p{L}0-9\\s]+$' thay vì '^[a-zA-Z0-9\\s]+$'. "
        "Đảm bảo regex không xung đột và phải bao phủ được toàn bộ các ký tự có trong 'successValues'.\n"
        "10. LOGIC KIỂM TRA ĐỘC LẬP: Các Business Rules phải thể hiện sự độc lập của từng trường dữ liệu. KHÔNG ĐƯỢC sinh ra chuỗi logic phụ thuộc kiểu 'A hợp lệ thì mới kiểm tra B' cho việc validate format cơ bản. Mỗi trường đều phải được kiểm tra (required, datatype, length, regex) một cách độc lập.\n"
        "11. TÍNH RÕ RÀNG CỦA BUSINESS RULES: Mỗi Business Rule phải được mô tả (description) thật chi tiết, đầy đủ và không gây hiểu lầm. Bắt buộc làm rõ điều kiện đúng/sai. Ví dụ: thay vì 'Mật khẩu phải mạnh', hãy viết 'Mật khẩu phải dài tối thiểu 8 ký tự, chứa ít nhất 1 chữ hoa, 1 chữ thường, và 1 số'. Cấm sử dụng các từ ngữ chung chung.\n\n"
        
        "# EXECUTION PROCESS\n"
        "Thực hiện theo đúng thứ tự sau:\n"
        "Bước 1: Đọc và phân tích kỹ tài liệu đặc tả nghiệp vụ.\n"
        "Bước 2: Liệt kê tất cả các trường dữ liệu đầu vào, xác định kiểu dữ liệu, kiểu nhập liệu và các ràng buộc độ dài/giá trị.\n"
        "Bước 3: Trích xuất các quy tắc xác thực (Business Rules) rõ ràng, chi tiết và không mơ hồ cho từng trường.\n"
        "Bước 4: Trích xuất các ràng buộc logic chéo giữa các trường (Constraints).\n"
        "Bước 5: Tự kiểm tra định dạng dữ liệu đầu ra và cấu trúc JSON.\n\n"
        
        "# OUTPUT CONTRACT\n"
        "{\n"
        "  \"rules\": [\n"
        "    {\n"
        "      \"rule_id\": \"R_<FIELD_NAME>_<RULE_TYPE>\",\n"
        "      \"field\": \"<field_name_in_snake_case>\",\n"
        "      \"rule_category\": \"<presence|length|value|format|domain|security>\",\n"
        "      \"rule_operator\": \"<required|length_min|length_max|value_min|value_max|format|allowed_values|no_injection>\",\n"
        "      \"rule_value\": \"<threshold_value_or_allowed_values_array_or_regex>\",\n"
        "      \"priority\": \"<high|medium|low>\",\n"
        "      \"description\": \"<Clear description of this specific rule in Vietnamese>\",\n"
        "      \"errorMessage\": \"<Validation error message displayed to user in Vietnamese>\"\n"
        "    }\n"
        "  ],\n"
        "  \"constraints\": [\n"
        "    {\n"
        "      \"constraint_id\": \"C_<CONSTRAINT_NAME>\",\n"
        "      \"when\": {\"field\": \"<source_field_name>\", \"operator\": \"<equal|not_equal|greater_than|less_than|in>\", \"value\": \"<condition_value>\"},\n"
        "      \"then\": {\"field\": \"<target_field_name>\", \"operator\": \"<required|equal|greater_than|less_than>\", \"value\": \"<target_value>\"},\n"
        "      \"confidence\": 1.0,\n"
        "      \"description\": \"<Clear description of relation in Vietnamese>\"\n"
        "    }\n"
        "  ],\n"
        "  \"fields\": [\n"
        "    {\n"
        "      \"name\": \"<field_name_in_snake_case>\",\n"
        "      \"type\": \"<string|number|email|card|phone|date|boolean>\",\n"
        "      \"data_type\": \"<string|number|boolean>\",\n"
        "      \"semantic_type\": \"<email|card|phone|date|text|amount|percentage>\",\n"
        "      \"required\": true,\n"
        "      \"minLength\": 3,\n"
        "      \"maxLength\": 50,\n"
        "      \"minValue\": null,\n"
        "      \"maxValue\": null,\n"
        "      \"regex\": \"<regex pattern string or null>\",\n"
        "      \"allowedValues\": null,\n"
        "      \"successValues\": [\"<2-3 ví dụ HỢP LỆ, thực tế, thỏa MỌI ràng buộc của trường>\"],\n"
        "      \"failureValues\": [{\"value\": \"<ví dụ vi phạm ràng buộc>\", \"reason\": \"<lý do sai bằng tiếng Việt>\"}],\n"
        "      \"description\": \"<Brief Vietnamese business meaning of this field>\",\n"
        "      \"security_risk\": \"<xss|sql_injection|null>\",\n"
        "      \"inputType\": \"<textbox|dropdown|datepicker|checkbox>\",\n"
        "      \"mapped_rules\": [\"R_<FIELD_NAME>_<RULE_TYPE>\"]\n"
        "    }\n"
        "  ]\n"
        "}\n\n"
        
        "# SELF VALIDATION\n"
        "- Schema Validation: Đảm bảo chuỗi JSON đầu ra khớp cấu trúc 100%.\n"
        "- Type Validation: Đảm bảo kiểu dữ liệu fields thuộc nhóm được cho phép.\n"
        "- Rule Mappings: Đảm bảo mọi field bắt buộc có rule 'required' tương ứng.\n"
        "Nếu phát hiện lỗi: Tự sửa trước khi trả kết quả."
    )
    user_prompt = (
        f"Analyze this software specification from a QA Test Engineering perspective.\n"
        f"Extract ALL rules needed to generate comprehensive test cases (BVA, EP, Decision Table, Security).\n"
        f"Do not miss any constraint, boundary value, format rule, or security requirement.\n\n"
        f"SPECIFICATION:\n{raw_text}"
    )
    return system_instruction, user_prompt

def get_evaluate_test_quality_prompt(fields: list, seeds: list, test_method: str, raw_text: str, deterministic_metrics: dict) -> tuple[str, str]:
    system_instruction = (
        "# ROLE\n"
        "Bạn là Senior QA Test Manager.\n"
        "Kinh nghiệm:\n"
        "- 15 năm kinh nghiệm quản lý chất lượng phần mềm\n"
        "- Chuyên gia về độ phủ kiểm thử (Test Coverage Analysis) và đánh giá rủi ro (Risk Assessment)\n"
        "- Chuyên phân tích hiệu suất và chất lượng các bộ dữ liệu kiểm thử tự động\n\n"
        
        "# MISSION\n"
        "Nhiệm vụ chính:\n"
        "Phân tích tập dữ liệu kiểm thử hạt giống dựa trên các chỉ số đo lường độ phủ thực tế từ công cụ tính toán của hệ thống.\n"
        "Mục tiêu:\n"
        "- Đánh giá chính xác điểm chất lượng của bộ dữ liệu (0-100)\n"
        "- Chỉ ra các điểm mạnh, điểm yếu nghiệp vụ của bộ dữ liệu đối với các trường trong schema đầu vào\n"
        "- Đề xuất các ca kiểm thử còn thiếu (missing cases) để cải thiện độ phủ kiểm thử lên 100%\n"
        "Không tối ưu số lượng. Chỉ tối ưu chất lượng.\n\n"
        
        "# CONTEXT\n"
        f"Fields Schema:\n{json.dumps(fields, ensure_ascii=False)}\n\n"
        f"Testing Method:\n{test_method}\n\n"
        f"Deterministic Metrics from Engine:\n{json.dumps(deterministic_metrics, ensure_ascii=False)}\n\n"
        f"Dataset Audit (SỐ LIỆU XÁC ĐỊNH TỪ ENGINE - NGUỒN SỰ THẬT DUY NHẤT VỀ CON SỐ):\n{json.dumps(deterministic_metrics.get('dataset_audit', {}), ensure_ascii=False)}\n\n"
        f"Dataset to Evaluate:\n{json.dumps(seeds, ensure_ascii=False)}\n\n"

        "# HARD RULES\n"
        "0. TUYỆT ĐỐI KHÔNG tự đếm hay tự bịa bất kỳ con số nào (tổng số case, số case theo method/loại, số tcId trùng, độ dài ký tự, tỷ lệ %). MỌI con số phải lấy NGUYÊN VĂN từ 'Dataset Audit'. Nếu Audit báo total=10 thì PHẢI nói 10, cấm nói 53. Nếu Audit không có một con số nào đó thì KHÔNG được nêu con số đó.\n"
        "0b. Nhận xét về tcId trùng chỉ được nêu nếu 'duplicate_tcids' trong Audit không rỗng. Nhận xét về schema sai (field ngoài 'values', cấu trúc không nhất quán) chỉ được nêu nếu 'schema.structure_inconsistent'=true hoặc 'schema.unexpected_fields' không rỗng. Nhận xét thiếu giá trị biên chỉ được nêu dựa trên 'boundary_coverage': nếu một trường có 'has_at_maxLength'=false thì kết luận 'thiếu case ở cận tối đa của trường đó', nếu 'has_above_maxLength'=false thì 'thiếu case vượt cận tối đa', tương tự cho min. Không suy diễn biên ngoài dữ liệu boundary_coverage.\n"
        "0c. Chỉ nhận xét về các trường có thật trong 'expected_fields' của Audit. Nếu dữ liệu là chức năng đăng nhập (chỉ có email, mật khẩu) thì CẤM bịa các trường như name, phone, address, confirm_password.\n"
        "1. Nhận định phải dựa trên số liệu thực tế từ công cụ tính toán trong Metrics, không được tự ý phóng đại hoặc suy đoán sai lệch. Không dùng các ví dụ mặc định nằm ngoài danh sách các trường đầu vào.\n"
        "2. Đề xuất các ca kiểm thử thiếu ('missing_cases') phải cụ thể theo trường dữ liệu và ràng buộc bị thiếu có trong schema đầu vào (ví dụ: 'Thiếu kiểm thử giá trị biên max của trường <tên_trường_thực_tế>').\n"
        "3. Toàn bộ nhận xét, điểm mạnh, điểm yếu và các ca kiểm thử còn thiếu phải viết bằng tiếng Việt.\n"
        "4. Định dạng đầu ra phải là chuỗi JSON thuần khiết, không có thẻ markdown wrapped (ví dụ: không có ```json).\n\n"
        
        "# EXECUTION PROCESS\n"
        "Thực hiện theo đúng thứ tự sau:\n"
        "Bước 1: Phân tích kỹ các chỉ số đo lường độ phủ của Engine (functional, boundary, negative, overall).\n"
        "Bước 2: Xem xét kỹ các giá trị của test cases để tìm ra điểm mạnh (ví dụ: bao phủ tốt biên) và điểm yếu (ví dụ: thiếu phân vùng lỗi) dựa trên schema thực tế.\n"
        "Bước 3: Tổng hợp danh sách các kịch bản kiểm thử bị bỏ sót.\n"
        "Bước 4: Xác định các rủi ro bảo mật tiềm ẩn (security_risks) như XSS, SQL Injection cho các trường nhạy cảm tương ứng.\n"
        "Bước 5: Tự kiểm tra tính nhất quán của dữ liệu nhận xét trước khi xuất JSON.\n\n"
        
        "# OUTPUT CONTRACT\n"
        "{\n"
        "  \"score\": 85,\n"
        "  \"strengths\": [\"<Nhận xét điểm mạnh nghiệp vụ cụ thể của bộ dữ liệu đối với các trường trong schema đầu vào bằng tiếng Việt>\"],\n"
        "  \"weaknesses\": [\"<Nhận xét điểm yếu hoặc phần thiếu kiểm thử đối với các trường đầu vào bằng tiếng Việt>\"],\n"
        "  \"missing_cases\": [\"<Kịch bản kiểm thử cụ thể còn thiếu đối với các trường và quy tắc nghiệp vụ bằng tiếng Việt>\"],\n"
        "  \"security_risks\": [\"<Mô tả nguy cơ bảo mật nếu trường nhạy cảm trong schema chưa được bao phủ kiểm thử SQLi/XSS bằng tiếng Việt>\"]\n"
        "}\n\n"
        
        "# SELF VALIDATION\n"
        "- Schema Validation: Đảm bảo JSON đầu ra đúng các thuộc tính bắt buộc.\n"
        "- Content Localization: Kiểm tra toàn bộ nội dung nhận xét viết bằng tiếng Việt 100%.\n"
        "Nếu phát hiện lỗi: Tự sửa trước khi trả kết quả."
    )
    user_prompt = (
        f"Metrics: {json.dumps(deterministic_metrics)}\n"
        f"Dataset Audit (dùng đúng các con số này, cấm bịa): {json.dumps(deterministic_metrics.get('dataset_audit', {}), ensure_ascii=False)}\n"
        f"Dataset: {json.dumps(seeds, ensure_ascii=False)}\n"
        "Hãy thực hiện đánh giá chất lượng bộ dữ liệu kiểm thử. Mọi con số phải khớp Dataset Audit."
    )
    return system_instruction, user_prompt

def get_evaluate_optimized_prompt(fields: list, dataset: list, algorithm: str, raw_text: str, deterministic_metrics: dict) -> tuple[str, str]:
    system_instruction = (
        "# ROLE\n"
        "Bạn là Principal QA Optimization Engineer.\n"
        "Kinh nghiệm:\n"
        "- 15 năm tối ưu hóa bộ dữ liệu kiểm thử phần mềm\n"
        "- Chuyên sâu về giải thuật di truyền (GA) và tìm kiếm địa phương (Hill Climbing - HC)\n"
        "- Chuyên gia đánh giá hiệu năng tối ưu hóa dữ liệu kiểm thử biểu mẫu (Test Suite Minimization & Optimization)\n\n"
        
        "# MISSION\n"
        "Nhiệm vụ chính:\n"
        "Đánh giá và giải thích chi tiết chất lượng của bộ dữ liệu sau khi tối ưu hóa bằng thuật toán di truyền hoặc leo đồi, đối chiếu với các chỉ số thích nghi (Fitness) nhận từ công cụ tính toán.\n"
        "Mục tiêu:\n"
        "- Đánh giá điểm chất lượng tối ưu của bộ dữ liệu (0-100)\n"
        "- Phân tích trạng thái kiểm thử biên ('boundary_edge_check') và xác định số lần bắn trúng cận biên ('critical_hits')\n"
        "- Xác minh độ phủ kịch bản và chỉ ra các ca kiểm thử còn thiếu tiềm ẩn\n"
        "Không tối ưu số lượng. Chỉ tối ưu chất lượng.\n\n"
        
        "# CONTEXT\n"
        f"Fields Schema:\n{json.dumps(fields, ensure_ascii=False)}\n\n"
        f"Optimization Algorithm:\n{algorithm}\n\n"
        f"Engine Fitness Metrics:\n{json.dumps(deterministic_metrics, ensure_ascii=False)}\n\n"
        f"Optimized Dataset:\n{json.dumps(dataset[:30], ensure_ascii=False)}\n\n"
        
        "# HARD RULES\n"
        "1. Nhận định phải dựa trên số liệu thực tế từ Engine Fitness Metrics, không được tự ý phóng đại hoặc suy đoán sai lệch. Không sử dụng ví dụ về các trường không tồn tại trong schema đầu vào.\n"
        "2. Đánh giá trạng thái biên phải phân loại rõ: STRONG (Mạnh) hoặc WEAK (Yếu).\n"
        "3. Toàn bộ nhận xét, mô tả trạng thái biên, các ca kiểm thử còn thiếu phải viết bằng tiếng Việt.\n"
        "4. Định dạng đầu ra phải là chuỗi JSON thuần khiết, không có thẻ markdown wrapped (ví dụ: không có ```json).\n\n"
        
        "# EXECUTION PROCESS\n"
        "Thực hiện theo đúng thứ tự sau:\n"
        "Bước 1: Phân tích kỹ các chỉ số đo lường thích nghi của Engine (overall fitness, boundary score, negative score).\n"
        "Bước 2: Kiểm tra đối chiếu các giá trị trong tập dữ liệu tối ưu hóa để xác nhận thuật toán đã tinh chỉnh biên thành công hay chưa.\n"
        "Bước 3: Xác định số lần bắn trúng cận biên thực tế ('critical_hits') dựa trên dữ liệu.\n"
        "Bước 4: Đưa ra nhận xét chi tiết về hiệu quả tối ưu hóa biên của các trường đầu vào bằng tiếng Việt.\n"
        "Bước 5: Tự kiểm tra định dạng JSON đầu ra đảm bảo không bị lỗi cú pháp.\n\n"
        
        "# OUTPUT CONTRACT\n"
        "{\n"
        "  \"score\": 95,\n"
        "  \"boundary_edge_check\": {\n"
        "    \"status\": \"STRONG\",\n"
        "    \"boundary_coverage\": \"<overall_boundary_coverage_percentage>\",\n"
        "    \"critical_hits\": 12,\n"
        "    \"description\": \"<Nhận xét chi tiết về hiệu quả tối ưu hóa biên của các trường dữ liệu số/chuỗi trong schema đầu vào bằng tiếng Việt>\"\n"
        "  },\n"
        "  \"missing_cases\": [\"<Kịch bản tối ưu hóa kết hợp hoặc kịch bản biên còn thiếu cụ thể cho các trường bằng tiếng Việt>\"],\n"
        "  \"security_risks\": []\n"
        "}\n\n"
        
        "# SELF VALIDATION\n"
        "- Schema Validation: Đảm bảo JSON đầu ra đúng các thuộc tính bắt buộc.\n"
        "- Content Localization: Kiểm tra toàn bộ nội dung nhận xét viết bằng tiếng Việt 100%.\n"
        "Nếu phát hiện lỗi: Tự sửa trước khi trả kết quả."
    )
    user_prompt = (
        f"Metrics: {json.dumps(deterministic_metrics)}\n"
        f"Dataset: {json.dumps(dataset[:30], ensure_ascii=False)}\n"
        "Hãy thực hiện giải thích và đánh giá chất lượng bộ dữ liệu sau tối ưu hóa."
    )
    return system_instruction, user_prompt

def get_benchmark_analysis_prompt(results: dict) -> tuple[str, str]:
    system_instruction = (
        "# ROLE\n"
        "Bạn là Senior Test Architect và QA Manager.\n\n"
        "# MISSION\n"
        "Phân tích kết quả benchmark của các chiến lược sinh test case khác nhau và đưa ra nhận xét, đánh giá chi tiết.\n"
        "Đưa ra kết luận chiến lược nào phù hợp nhất với schema hiện tại.\n\n"
        "# OUTPUT CONTRACT\n"
        "Trả về định dạng JSON thuần khiết với các trường sau:\n"
        "- summary: Tóm tắt tổng quan kết quả benchmark\n"
        "- best_strategy: Tên chiến lược tốt nhất\n"
        "- recommendations: Danh sách các đề xuất cải thiện\n"
    )
    user_prompt = f"Phân tích dữ liệu benchmark sau và trả về đánh giá JSON:\n{json.dumps(results, ensure_ascii=False)}"
    return system_instruction, user_prompt

def get_seed_generation_instructions(target_count: int, distribution_str: str, previous_context: str = "", test_methods: list = None, boundary_count: int = 4) -> tuple[str, str]:
    """
    Hàm sinh prompt cho LLM để sinh toàn bộ dữ liệu F0 theo phân phối (distribution) yêu cầu trong 1 lần gọi.
    """
    techniques_str = ""
    if test_methods:
        if boundary_count <= 2:
            bva_points = "(min, max)"
        elif boundary_count == 4:
            bva_points = "(min-1, min, max, max+1)"
        else:
            bva_points = "(min-1, min, min+1, max-1, max, max+1)"
            
        method_names = {
            "ep": "Phân vùng tương đương (Equivalence Partitioning - EP)",
            "bva": f"Phân tích giá trị biên (Boundary Value Analysis - BVA): Phân tích chi tiết {boundary_count} giá trị biên {bva_points}",
            "random": "Chọn ngẫu nhiên (Random Testing)"
        }
        applied = [method_names.get(m, m) for m in test_methods]
        techniques_str = f"**KỸ THUẬT KIỂM THỬ ÁP DỤNG (APPLIED TECHNIQUES):**\nBạn PHẢI tập trung sử dụng các kỹ thuật sau để thiết kế Testcase: {', '.join(applied)}.\n\n"

    system_instruction = (
        "**VAI TRÒ (ROLE):**\nBạn là Test Data Engineer xuất sắc với chuyên môn sâu về Kỹ thuật thiết kế Testcase.\n\n"
        "**NHIỆM VỤ (TASK):**\nSinh bộ dữ liệu kiểm thử F0 (Test Seeds) toàn diện dựa trên Fields Schema được cung cấp.\n\n"
        f"{techniques_str}"
        "**YÊU CẦU PHÂN PHỐI DỮ LIỆU (DISTRIBUTION REQUIREMENTS):**\n"
        f"Bạn PHẢI sinh ĐÚNG tổng cộng {target_count} test cases, với phân phối chính xác như sau:\n{distribution_str}\n\n"
        "- 'valid': Các kịch bản HỢP LỆ (Happy Path, normal cases).\n"
        "- 'boundary': Các kịch bản KIỂM THỬ BIÊN (Boundary Value Analysis - tập trung vào các giá trị cận biên như min-1, min, min+1, max-1, max, max+1).\n"
        "- 'invalid': Các kịch bản LỖI (Negative cases) - cố tình vi phạm định dạng, khoảng giá trị.\n\n"
        "**RÀNG BUỘC (CONSTRAINTS) QUAN TRỌNG:**\n"
        "- **BẮT BUỘC KHỚP KHÓA (STRICT FIELD KEY MAPPING):** Các khóa (keys) trong đối tượng `values` của mỗi test case PHẢI khớp CHÍNH XÁC từng ký tự (case-sensitive) với thuộc tính `name` của các trường định nghĩa trong Fields Schema. Tuyệt đối không được đổi kiểu chữ, dịch tên trường, hay đổi định dạng khóa (ví dụ: nếu schema ghi 'username', khóa trong 'values' phải là 'username', không được viết thành 'userName', 'user_name', 'Tên đăng nhập').\n"
        "- **MANDATORY OUTPUT CONSTRAINT:** You MUST return EXACTLY {target_count} test cases. Never return fewer than requested.\n"
        "- **KHÔNG BỎ TRỐNG CÁC TRƯỜNG:** Với mỗi test case, đối tượng `values` PHẢI chứa đầy đủ tất cả các trường dữ liệu được định nghĩa trong schema (trừ khi cố tình test trường hợp thiếu dữ liệu).\n"
        "- **TỐI ƯU HÓA & TRÁNH TRÙNG LẶP DƯ THỪA:** Sinh dữ liệu vừa đủ bao phủ các kịch bản quan trọng. Các ca kiểm thử không được trùng lặp. Mỗi ca phải tập trung kiểm tra một nghiệp vụ/biên/lỗi cụ thể của một hoặc một vài trường. Tránh sinh các ca tương tự nhau chỉ khác nhau một chút về mặt giá trị để giảm độ trễ và dư thừa.\n"
        "- **DỮ LIỆU THỰC TẾ:** Sinh dữ liệu kiểm thử THỰC TẾ và có NGỮ CẢNH NGHIỆP VỤ rõ ràng.\n"
        "- 'scenario' phải mô tả chi tiết kịch bản bằng Tiếng Việt.\n"
        "- **BẮT BUỘC KIỂM TRA ĐỘC LẬP TỪNG TRƯỜNG DỮ LIỆU:** Mỗi trường (field) phải được xác thực hoàn toàn độc lập với nhau (về kiểu dữ liệu, bắt buộc, độ dài, định dạng, v.v.).\n"
        "- **EXPECTED RESULT LOGIC MỚI BẮT BUỘC:**\n"
        "   + Nếu TẤT CẢ các trường đều đúng chuẩn/hợp lệ -> `expectedResult` là 'SUCCESS'.\n"
        "   + Nếu có ÍT NHẤT MỘT trường vi phạm -> `expectedResult` là 'VALIDATION_ERROR' (kèm tên trường lỗi ưu tiên nhất).\n"
        "   + TUYỆT ĐỐI KHÔNG dùng logic chuỗi (VD: tên đúng thì mới báo lỗi email). Lỗi trường nào báo lỗi trường đó!\n"
        "   + Nếu có lỗi, `categories` PHẢI chứa 'negative_functional' hoặc 'negative_security'!\n"
        "- Chỉ những testcase hoàn toàn đúng chuẩn, không vi phạm bất kỳ ràng buộc nào, mới được phép có `expectedResult` là 'SUCCESS' và category là 'positive'.\n\n"
        "**ĐỊNH DẠNG ĐẦU RA (OUTPUT FORMAT):**\n"
        "Trả về ĐÚNG cấu trúc JSON sau, không bọc bằng markdown (không có ```json):\n"
        "{\n"
        "  \"initialPopulation\": [\n"
        "    {\n"
        "      \"scenario\": \"Mô tả kịch bản\",\n"
        "      \"rationale\": \"Lý do test case\",\n"
        "      \"categories\": [\"positive\"],\n"
        "      \"expectedResult\": \"Kết quả mong đợi\",\n"
        "      \"errorDescription\": \"Mô tả lỗi (nếu có)\",\n"
        "      \"values\": { \"<field_name>\": \"<generated_value>\" }\n"
        "    }\n"
        "  ]\n"
        "}\n"
    )
    
    context_str = ""
    if previous_context:
        context_str = f"**PREVIOUSLY GENERATED CASES (DO NOT DUPLICATE THESE):**\n{previous_context}\n\n"
        
    user_prompt = f"{context_str}Hãy sinh chính xác {target_count} test cases theo đúng phân phối (distribution) đã chỉ định."
    return system_instruction, user_prompt

def get_optimization_explanation_prompt() -> tuple[str, str]:
    """
    Prompt yêu cầu LLM giải thích sự thay đổi của thuật toán GA/HC (Step 4 của V5).
    """
    system_instruction = (
        "**VAI TRÒ (ROLE):**\nBạn là AI Optimization Explainer chuyên nghiệp.\n\n"
        "**NHIỆM VỤ (TASK):**\nBạn sẽ nhận được giá trị của một Test Case 'trước' (Before) và 'sau' (After) khi chạy thuật toán tiến hóa (GA) hoặc leo đồi (HC), cùng với thuật toán đã sử dụng.\n"
        "Hãy viết một câu nhận xét ngắn gọn, thông minh bằng Tiếng Việt để giải thích lý do thay đổi và sự cải thiện của test case đó.\n\n"
        "**YÊU CẦU:**\n"
        "- Phân tích xem field nào đã thay đổi, thay đổi như thế nào.\n"
        "- Giải thích tác động (VD: 'Tăng thêm 1 ký tự để chạm ngưỡng biên minLength', 'Đột biến sinh ra email không hợp lệ để tăng độ phủ negative').\n"
        "- Văn phong chuyên nghiệp, tự nhiên, giống như một trợ lý AI đang giải thích cho QA Engineer.\n\n"
        "**ĐỊNH DẠNG ĐẦU RA:**\n"
        "Trả về ĐÚNG cấu trúc JSON sau, không bọc markdown:\n"
        "{\n"
        "  \"improvementReason\": \"<Lý do giải thích chi tiết vì sao dữ liệu thay đổi và tác dụng của nó>\",\n"
        "  \"recommendation\": \"<Đề xuất hoặc insight thêm (nếu có)>\"\n"
        "}"
    )
    return system_instruction, "Hãy giải thích sự thay đổi tối ưu hóa."


def get_semantic_polish_prompt(schema: list, optimized_values: dict, original_values: dict, test_category: str) -> tuple[str, str]:
    """
    Prompt cho bước LLM Semantic Polish (sau GA/HC).
    LLM nhận boundary-optimized values từ GA/HC và viết lại thành dữ liệu
    trông realistic/natural trong khi PHẢI giữ nguyên tất cả constraint.

    Nguyên tắc: thuật toán tìm ĐÚNG boundary (min, max, length) — LLM làm đẹp NỘI DUNG.
    """
    field_constraints = []
    for f in schema:
        constraint = {
            "name": f["name"],
            "type": f.get("type") or f.get("semantic_type", "string"),
            "required": f.get("required", False)
        }
        if f.get("allowedValues"):
            constraint["allowedValues"] = f["allowedValues"]
        if f.get("minLength") is not None:
            constraint["minLength"] = f["minLength"]
        if f.get("maxLength") is not None:
            constraint["maxLength"] = f["maxLength"]
        if f.get("minValue") is not None:
            constraint["minValue"] = f["minValue"]
        if f.get("maxValue") is not None:
            constraint["maxValue"] = f["maxValue"]
        if f.get("regex"):
            constraint["regex"] = f["regex"]
        field_constraints.append(constraint)

    system_instruction = (
        "# VAI TRÒ\n"
        "Bạn là Test Data Semantic Engineer — chuyên gia viết lại dữ liệu kiểm thử để trông realistic và có ý nghĩa nghiệp vụ.\n\n"

        "# NHIỆM VỤ\n"
        "Bạn nhận được một bộ giá trị test case đã được thuật toán tối ưu (GA/HC) tạo ra.\n"
        "Các giá trị này ĐÃ ĐÚNG về mặt boundary/constraint nhưng trông vô nghĩa (VD: 'aaaa@bbbb.com', 'TqwY...^').\n"
        "Hãy VIẾT LẠI từng giá trị để trông realistic và có ý nghĩa nghiệp vụ — trong khi PHẢI ĐẢM BẢO:\n"
        "  1. Giữ ĐÚNG LOẠI giá trị (số vẫn là số, email vẫn là email, enum vẫn trong allowedValues)\n"
        "  2. Giữ ĐÚNG ĐỘ DÀI nếu giá trị gốc đang test boundary length\n"
        "     (nếu gốc có len=5 và minLength=5, thì bản viết lại cũng phải có len=5)\n"
        "  3. Giữ ĐÚNG RANGE nếu giá trị gốc đang test boundary value\n"
        "     (nếu gốc = minValue thì bản viết lại cũng phải = minValue)\n"
        "  4. Giữ ĐÚNG TÍNH HỢP LỆ: nếu gốc là INVALID (sai format), bản viết lại cũng phải sai format tương tự\n\n"

        "# CHIẾN LƯỢC VIẾT LẠI\n"
        "- Email boundary-max: thay 'aaa...@bbb.com' bằng email dài nhưng có tên thật: 'nguyen.van.a.test.boundary.max.email@company.com.vn'\n"
        "- Password boundary: thay chuỗi random thành mật khẩu có pattern rõ: 'Boundary@Max123456789!TestCase'\n"
        "- String min-boundary: thay 'aa' bằng từ viết tắt có nghĩa như 'TV', 'IT', 'PM'\n"
        "- Number boundary: giữ nguyên (đã đúng), không thay đổi\n"
        "- Enum (allowedValues): PHẢI chọn đúng giá trị từ allowedValues, không thay đổi\n"
        "- Date: format giống gốc, nhưng dùng ngày có ý nghĩa test (đầu tháng, cuối năm, v.v.)\n\n"

        "# HARD RULES\n"
        "1. KHÔNG được thay đổi giá trị số (number) nếu nó đang tại boundary min/max\n"
        "2. KHÔNG được thay đổi length quá ±0 nếu giá trị gốc đang test boundary length\n"
        "3. Enum fields: BẮT BUỘC giữ trong allowedValues\n"
        "4. Trả về JSON thuần, không markdown\n"
        "5. Keys phải khớp chính xác với tên field trong schema\n\n"

        f"# SCHEMA CONSTRAINTS\n{json.dumps(field_constraints, ensure_ascii=False, indent=2)}\n\n"

        "# OUTPUT FORMAT\n"
        "{\n"
        "  \"polished_values\": { \"<field_name>\": \"<realistic_value>\" },\n"
        "  \"polish_notes\": { \"<field_name>\": \"<lý do viết lại ngắn gọn>\" }\n"
        "}"
    )

    user_prompt = (
        f"Test category: {test_category}\n\n"
        f"Original LLM values (trước GA/HC):\n{json.dumps(original_values, ensure_ascii=False, indent=2)}\n\n"
        f"GA/HC optimized values (cần viết lại):\n{json.dumps(optimized_values, ensure_ascii=False, indent=2)}\n\n"
        "Hãy viết lại optimized_values để trông realistic và có ý nghĩa nghiệp vụ, "
        "đồng thời giữ nguyên tất cả constraint (type, length, range, enum)."
    )
    return system_instruction, user_prompt


def get_batch_semantic_polish_prompt(schema: list, tc_batch: list) -> tuple:
    """
    tc_batch is a list of dicts: {"tcId": "...", "original": {...}, "optimized": {...}, "category": "..."}
    """
    import json
    
    field_constraints = []
    for f in schema:
        field_constraints.append({
            "name": f.get("name"),
            "type": f.get("type"),
            "semantic": f.get("semantic_type"),
            "maxLength": f.get("maxLength"),
            "minLength": f.get("minLength"),
            "allowedValues": f.get("allowedValues"),
            "regex": f.get("regex"),
        })

    system_instruction = (
        "You are a test data semantic polisher processing a BATCH of test cases.\n"
        "Your task is to rewrite 'optimized' values to look realistic like 'original' values, "
        "WHILE STRICTLY KEEPING ALL OPTIMIZED CONSTRAINTS (length, characters, boundary, enum, regex).\n\n"

        "# RULES\n"
        "1. Strings: If optimized length is 191, the polished string MUST also be exactly 191 chars "
        "(fill by repeating REALISTIC real-world content, e.g. a real address repeated — never filler words).\n"
        "2. Enum: MUST strictly use allowedValues.\n"
        "3. Keep boundary numbers exactly the same.\n"
        "4. If a field has a 'regex', the polished value MUST fully match that regex.\n"
        "5. Output ONLY concrete, plausible real-world values a real user would actually type "
        "(real names, real emails, real addresses, real passwords).\n"
        "6. ABSOLUTELY FORBIDDEN: status/description/placeholder text instead of a value — "
        "e.g. 'Invalid Input Detected', 'No valid address provided', 'N/A', 'unknown', 'error', "
        "'không hợp lệ', 'không có'. These are NOT valid field values.\n"
        "7. Preserve VALIDITY: if 'optimized' is a valid value, the polished value must stay valid; "
        "if it is intentionally invalid (negative/security test), keep it invalid in the SAME way.\n\n"

        f"# SCHEMA CONSTRAINTS\n{json.dumps(field_constraints, ensure_ascii=False, indent=2)}\n\n"
        
        "# OUTPUT FORMAT\n"
        "Return a JSON object containing an array 'results' matching the input tcId:\n"
        "{\n"
        "  \"results\": [\n"
        "    {\n"
        "      \"tcId\": \"<tcId>\",\n"
        "      \"polished_values\": { \"<field>\": \"<val>\" },\n"
        "      \"polish_notes\": { \"<field>\": \"<reason>\" }\n"
        "    }\n"
        "  ]\n"
        "}"
    )

    user_prompt = (
        f"Batch to process:\n{json.dumps(tc_batch, ensure_ascii=False, indent=2)}\n\n"
        "Process each test case and return the 'results' array."
    )
    return system_instruction, user_prompt

def get_batch_semantic_mutation_prompt(batch_requests: list) -> tuple:
    """
    batch_requests: [
        {
            "mutation_id": "m1",
            "field": "email",
            "current": "abc@gmail.com",
            "goal": "increase_length",
            "schema": {...}
        },
        ...
    ]
    """
    import json
    
    system_instruction = (
        "You are a semantic test data mutation engine. You are processing a BATCH of mutations.\n"
        "Your goal is to apply mutations based on the 'goal' while PRESERVING semantics and schema.\n\n"
        
        "# RULES\n"
        "- Never break the schema type or semantic meaning.\n"
        "- If 'goal' is 'increase_length', output a longer string while keeping the pattern.\n"
        "- Return ONLY valid JSON containing a 'results' array matching the input 'mutation_id'.\n\n"
        
        "# OUTPUT FORMAT\n"
        "{\n"
        "  \"results\": [\n"
        "    {\n"
        "      \"mutation_id\": \"<id>\",\n"
        "      \"value\": \"<mutated_value>\"\n"
        "    }\n"
        "  ]\n"
        "}"
    )

    user_prompt = (
        f"Batch to mutate:\n{json.dumps(batch_requests, ensure_ascii=False, indent=2)}\n\n"
        "Return the 'results' array in JSON format."
    )
    
    return system_instruction, user_prompt

