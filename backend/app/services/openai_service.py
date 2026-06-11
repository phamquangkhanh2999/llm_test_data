import os
import json
from openai import OpenAI
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from .ai_parser import log_ai_call

# Initialize OpenAI Client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# --- PYDANTIC MODELS FOR STRUCTURED OUTPUTS ---

class FieldConstraintSchema(BaseModel):
    name: str = Field(..., description="Tên trường dữ liệu (snake_case)")
    type: str = Field(..., description="Kiểu dữ liệu: 'string', 'number', 'email', 'card', 'phone', 'date'")
    required: bool = Field(..., description="Trường này có bắt buộc không")
    minLength: Optional[int] = Field(None, description="Độ dài tối thiểu (cho string)")
    maxLength: Optional[int] = Field(None, description="Độ dài tối đa (cho string)")
    minValue: Optional[float] = Field(None, description="Giá trị tối thiểu (cho number)")
    maxValue: Optional[float] = Field(None, description="Giá trị tối đa (cho number)")
    regex: Optional[str] = Field(None, description="Biểu thức chính quy kiểm tra định dạng")
    allowedValues: Optional[List[str]] = Field(None, description="Danh sách các giá trị hợp lệ (Enum)")
    description: str = Field(..., description="Mô tả nghiệp vụ của trường này")

class SpecOutputSchema(BaseModel):
    fields: List[FieldConstraintSchema] = Field(..., description="Danh sách các ràng buộc trường dữ liệu")
    initialPopulation: List[Dict[str, Any]] = Field(..., description="Danh sách mảng 10-15 objects dữ liệu mẫu F0, mỗi object chứa các key là name của fields + 'method' + 'scenario'")

class SeedOutputSchema(BaseModel):
    initialPopulation: List[Dict[str, Any]] = Field(..., description="Danh sách mảng các objects dữ liệu mẫu, mỗi object chứa các key là name của fields + 'method' + 'scenario'")

class EvaluationOutputSchema(BaseModel):
    score: float = Field(..., description="Điểm chất lượng từ 0-100")
    strengths: List[str] = Field(..., description="Các điểm mạnh của bộ dữ liệu")
    weaknesses: List[str] = Field(..., description="Các điểm yếu cần khắc phục")
    missing_cases: List[str] = Field(..., description="Các kịch bản kiểm thử còn thiếu")
    security_risks: List[str] = Field(..., description="Các rủi ro bảo mật tiềm ẩn (XSS, Injection, SQLi)")

class SanityCheckSchema(BaseModel):
    status: str
    schema_check: str
    type_check: str
    invalid_removed: int
    description: str

class FitnessEvaluationSchema(BaseModel):
    status: str
    fitness_score: float
    penalty_score: float
    violations_count: int
    applied_weights: str
    description: str

class BoundaryEdgeCheckSchema(BaseModel):
    status: str
    boundary_coverage: str
    critical_hits: int
    description: str

class OptimizedEvaluationOutputSchema(BaseModel):
    score: float
    sanity_check: SanityCheckSchema
    fitness_evaluation: FitnessEvaluationSchema
    boundary_edge_check: BoundaryEdgeCheckSchema
    missing_cases: List[str]
    security_risks: List[str]

# --- SERVICE FUNCTIONS ---

def parse_spec_with_openai_v2(raw_text: str, api_key_override: Optional[str] = None, db: Session = None) -> Dict[str, Any]:
    """
    Phân tích đặc tả bằng OpenAI Structured Outputs.
    """
    api_key = api_key_override or os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("API_KEY_ERROR: OpenAI API Key is missing.")
    
    local_client = OpenAI(api_key=api_key)
    model_name = "gpt-4o-2024-08-06"
    
    prompt = f"""
    Bạn là một chuyên gia phân tích nghiệp vụ phần mềm (BA) và kỹ sư kiểm thử (QA).
    Nhiệm vụ của bạn là phân tích văn bản đặc tả dưới đây và trích xuất ra:
    1. Danh sách các trường dữ liệu và ràng buộc của chúng (JSON Schema style).
    2. Một tập dữ liệu mẫu ban đầu (initialPopulation) gồm 12-15 bản ghi đa dạng (Happy path, Edge cases, Invalid cases).
    
    VĂN BẢN ĐẶC TẢ:
    \"\"\"
    {raw_text}
    \"\"\"
    
    YÊU CẦU DỮ LIỆU MẪU:
    - Mỗi bản ghi trong initialPopulation phải chứa tất cả các trường bạn đã định nghĩa.
    - Phải có thêm 2 trường: 'method' (tên phương pháp sinh: 'random', 'bva', 'ep', 'decision') và 'scenario' (mô tả ngắn kịch bản bằng tiếng Việt).

    Trả về JSON object có dạng:
    {{"fields": [ {{"name": ..., "type": ..., "required": ..., "description": ...}} ], "initialPopulation": [ {{...}} ]}}
    """

    try:
        # NOTE: initialPopulation có key động nên không dùng được Pydantic strict mode
        # (strict yêu cầu additionalProperties=false). Dùng json_object mode + parse thủ công.
        completion = local_client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "Bạn là chuyên gia phân tích hệ thống chuyên nghiệp. Luôn trả về JSON hợp lệ."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
        )
        res_dict = json.loads(completion.choices[0].message.content)
        
        log_ai_call(db, "/api/specifications", "OpenAI", model_name, raw_text, json.dumps(res_dict, ensure_ascii=False), "SUCCESS")
        return res_dict
    except Exception as e:
        error_msg = str(e)
        print(f">>> OPENAI ERROR: {error_msg}")
        log_ai_call(db, "/api/specifications", "OpenAI", model_name, raw_text, "", "FAILED", error_message=error_msg)
        raise e

def generate_seeds_openai(fields: List[Dict], test_method: str, raw_text: str = "", api_key_override: Optional[str] = None, db: Session = None) -> List[Dict]:
    """
    Sinh hạt giống F0 bằng OpenAI.
    """
    api_key = api_key_override or os.getenv("OPENAI_API_KEY")
    local_client = OpenAI(api_key=api_key)
    model_name = "gpt-4o-2024-08-06"
    
    fields_str = json.dumps(fields, ensure_ascii=False)
    user_prompt = f"Fields: {fields_str}\nMethod: {test_method}\nExtra context: {raw_text}"
    
    prompt = f"""
    Dựa trên các quy tắc ràng buộc sau:
    {fields_str}
    
    Hãy sinh 15 bản ghi dữ liệu kiểm thử theo phương pháp: {test_method}.
    Đặc tả bổ sung (nếu có): {raw_text}
    
    Mỗi bản ghi phải có các trường tương ứng và thêm:
    - method: '{test_method}'
    - scenario: Mô tả kịch bản kiểm thử

    Trả về JSON object có dạng: {{"initialPopulation": [ {{...}}, ... ]}}
    """

    try:
        # NOTE: Không thể dùng structured-output (Pydantic strict) cho seeds vì mỗi bản ghi
        # có các key động (tên field thay đổi theo spec), trong khi strict mode yêu cầu
        # additionalProperties=false. Dùng json_object mode + parse thủ công.
        completion = local_client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "Bạn là chuyên gia sinh dữ liệu kiểm thử. Luôn trả về JSON hợp lệ."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
        )
        parsed_result = json.loads(completion.choices[0].message.content)
        seeds = parsed_result.get("initialPopulation", [])
        log_ai_call(db, "/api/generate-seeds", "OpenAI", model_name, user_prompt, json.dumps(seeds, ensure_ascii=False), "SUCCESS")
        return seeds
    except Exception as e:
        error_msg = str(e)
        print(f">>> OPENAI SEED ERROR: {error_msg}")
        log_ai_call(db, "/api/generate-seeds", "OpenAI", model_name, user_prompt, "", "FAILED", error_message=error_msg)
        return []

def evaluate_test_quality_openai(fields: List[Dict], seeds: List[Dict], test_method: str, raw_text: str, api_key_override: Optional[str] = None, db: Session = None) -> Dict[str, Any]:
    """
    Đánh giá chất lượng hạt giống bằng OpenAI.
    """
    api_key = api_key_override or os.getenv("OPENAI_API_KEY")
    local_client = OpenAI(api_key=api_key)
    model_name = "gpt-4o-2024-08-06"
    
    user_prompt = f"Evaluate quality for {test_method} seeds with {len(seeds)} records."
    
    prompt = f"""
    Đặc tả gốc: {raw_text}
    Quy tắc ràng buộc: {json.dumps(fields, ensure_ascii=False)}
    Phương pháp kiểm thử: {test_method}
    Tập dữ liệu cần đánh giá: {json.dumps(seeds, ensure_ascii=False)}
    
    Hãy đánh giá khách quan bộ dữ liệu này.
    """

    try:
        completion = local_client.beta.chat.completions.parse(
            model=model_name,
            messages=[
                {"role": "system", "content": "Bạn là chuyên gia thẩm định chất lượng kiểm thử."},
                {"role": "user", "content": prompt},
            ],
            response_format=EvaluationOutputSchema,
        )
        res_dict = completion.choices[0].message.parsed.model_dump()
        log_ai_call(db, "/api/evaluate-seeds", "OpenAI", model_name, user_prompt, json.dumps(res_dict, ensure_ascii=False), "SUCCESS")
        return res_dict
    except Exception as e:
        error_msg = str(e)
        print(f">>> OPENAI EVAL ERROR: {error_msg}")
        log_ai_call(db, "/api/evaluate-seeds", "OpenAI", model_name, user_prompt, "", "FAILED", error_message=error_msg)
        raise e

def evaluate_optimized_openai(fields: List[Dict], dataset: List[Dict], algorithm: str, raw_text: str, api_key_override: Optional[str] = None, db: Session = None) -> Dict[str, Any]:
    """
    Đánh giá tập dữ liệu đã tối ưu hóa bằng OpenAI.
    """
    api_key = api_key_override or os.getenv("OPENAI_API_KEY")
    local_client = OpenAI(api_key=api_key)
    model_name = "gpt-4o-2024-08-06"
    
    user_prompt = f"Evaluate optimized dataset from {algorithm} with {len(dataset)} records."
    
    prompt = f"""
    Đặc tả gốc: {raw_text}
    Quy tắc ràng buộc: {json.dumps(fields, ensure_ascii=False)}
    Thuật toán đã dùng: {algorithm}
    Tập dữ liệu tối ưu: {json.dumps(dataset[:30], ensure_ascii=False)} (Chỉ gửi 30 bản ghi đầu để tiết kiệm context)
    
    Hãy thực hiện đánh giá chuyên sâu bao gồm:
    1. Sanity Check (Độ sạch dữ liệu)
    2. Fitness Evaluation (Độ tối ưu và đa dạng)
    3. Boundary Edge Check (Độ bao phủ biên rủi ro)
    """

    try:
        completion = local_client.beta.chat.completions.parse(
            model=model_name,
            messages=[
                {"role": "system", "content": "Bạn là chuyên gia cao cấp về tối ưu hóa kiểm thử phần mềm."},
                {"role": "user", "content": prompt},
            ],
            response_format=OptimizedEvaluationOutputSchema,
        )
        res_dict = completion.choices[0].message.parsed.model_dump()
        log_ai_call(db, "/api/evaluate-optimized", "OpenAI", model_name, user_prompt, json.dumps(res_dict, ensure_ascii=False), "SUCCESS")
        return res_dict
    except Exception as e:
        error_msg = str(e)
        print(f">>> OPENAI OPT EVAL ERROR: {error_msg}")
        log_ai_call(db, "/api/evaluate-optimized", "OpenAI", model_name, user_prompt, "", "FAILED", error_message=error_msg)
        raise e
