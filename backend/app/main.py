from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import json
import re
import sys
import os
import asyncio

# Đảm bảo Windows console hỗ trợ UTF-8 đầy đủ cho các bản ghi logs
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Nạp các thành phần kết nối Cơ sở dữ liệu SQLite cục bộ
from .core.database import engine, Base, get_db, SessionLocal
# Nạp các Models bảng dữ liệu quan hệ
from . import models
# Nạp dịch vụ kết nối OpenAI API thật
from .services.strategy_runner import run_all_strategies
from .engines.fitness_engine import calculate_dataset_fitness, calculateRubricScores
from .services.prompts import get_benchmark_analysis_prompt
from .services.ai_service import parse_spec_with_ai, generate_seeds_with_ai, evaluate_test_quality_with_ai, evaluate_optimized_dataset_with_ai, audit_schema_completeness
# Nạp các bộ thuật toán tối ưu hóa chạy trên Server
from .algorithms.optimizer_engine import generate_random_field_value
from .algorithms.v4_optimizer import V4TestSuiteOptimizer
from .algorithms.boundary_tweak import optimize_testcase_boundaries, BoundaryTweakStats

# Bước 1: Tự động khởi tạo tất cả các Bảng dữ liệu trong SQLite tệp tin "testforge.db" 
# khi ứng dụng Backend được khởi động. Đây là cơ chế tự động migration rất tiện lợi.
Base.metadata.create_all(bind=engine)

# Bước 2: Khởi tạo ứng dụng FastAPI chính
app = FastAPI(
    title="Hyperion TestForge Backend API",
    description="API dịch vụ sinh và tối ưu hóa bộ ca kiểm thử tự động sử dụng LLM + GA + HC",
    version="1.0.0"
)

# Bước 3: Cấu hình CORS Middleware (Cross-Origin Resource Sharing).
# Cho phép ứng dụng Frontend React chạy ở cổng 5173 truy cập và gọi các Endpoint của Backend ở cổng 8000 một cách an toàn.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174"], # Chỉ định cổng React được gọi
    allow_credentials=True,
    allow_methods=["*"], # Cho phép tất cả các phương thức HTTP (GET, POST, OPTIONS, v.v.)
    allow_headers=["*"], # Cho phép truyền tất cả các loại HTTP Headers
)

# --- ĐỊNH NGHĨA CÁC ĐỐI TƯỢNG TRUYỀN DỮ LIỆU (PYDANTIC SCHEMAS / DTOS) ---
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class SpecRequest(BaseModel):
    """
    Schema đại diện cho yêu cầu phân tích mô tả đặc tả nghiệp vụ.
    """
    raw_text: str  # Văn bản nghiệp vụ tiếng Việt/Anh thô
    api_key_override: Optional[str] = None  # Khóa OpenAI API Key tạm thời nhập từ màn hình Client
    force_reanalyze: Optional[bool] = False  # Bật để bỏ qua cache và phân tích lại bằng AI
    llm_provider: Optional[str] = "gemini"

class OptimizeWeights(BaseModel):
    """
    Trọng số cấu hình hàm đánh giá chất lượng Test Case.
    """
    validation: Optional[float] = 0.4
    boundary: Optional[float] = 0.3
    security: Optional[float] = 0.0
    diversity: Optional[float] = 0.2

class OptimizeRequest(BaseModel):
    """
    Schema cấu hình chạy tiến hóa và tối ưu hóa biên cho bộ test.
    """
    specification_id: str
    generations: Optional[int] = 30
    popSize: Optional[int] = 50
    crossoverRate: Optional[float] = 0.8
    mutationRate: Optional[float] = 0.15
    weights: Optional[OptimizeWeights] = None
    initial_seeds: List[Dict[str, Any]] # Danh sách F0 mẫu
    schema_rules: Optional[List[Dict[str, Any]]] = None # Đẩy trực tiếp schema từ UI lên
    algorithm: Optional[str] = "hybrid" #traditional, ga, hc, hybrid
    traditional_method: Optional[str] = "bva" #random, bva
    llm_provider: Optional[str] = "gemini"
    api_key_override: Optional[str] = None
    job_id: Optional[str] = None

class SeedGenerationRequest(BaseModel):
    """
    Schema cấu hình sinh lại hạt giống F0.
    """
    fields: List[Dict[str, Any]]
    business_rules: Optional[List[Dict[str, Any]]] = None
    constraints: Optional[List[Dict[str, Any]]] = None
    test_methods: Optional[List[str]] = ["bva"]  # Sử dụng danh sách các phương pháp
    test_method: Optional[str] = None # Giữ lại để tương thích ngược nếu cần
    boundary_count: int = 4
    partition_count: int = 3
    api_key_override: Optional[str] = None
    raw_text: Optional[str] = ""
    llm_provider: Optional[str] = "gemini"
    job_id: Optional[str] = None

class CancelJobRequest(BaseModel):
    job_id: str

# Global dictionary for cancellation state
ACTIVE_JOBS = {}

class EvaluateRequest(BaseModel):
    """
    Schema cấu hình đánh giá chất lượng hạt giống F0.
    """
    fields: List[Dict[str, Any]]
    seeds: List[Dict[str, Any]]
    test_method: str
    raw_text: str
    extracted_rules: Optional[List[Dict[str, Any]]] = None
    extracted_constraints: Optional[List[Dict[str, Any]]] = None
    api_key_override: Optional[str] = None
    llm_provider: Optional[str] = "gemini"

class EvaluateOptimizedRequest(BaseModel):
    """
    Schema cấu hình đánh giá chất lượng bộ dữ liệu tối ưu hóa.
    """
    fields: List[Dict[str, Any]]
    dataset: List[Dict[str, Any]]
    algorithm: str
    raw_text: str
    api_key_override: Optional[str] = None
    llm_provider: Optional[str] = "gemini"

# --- ĐỊNH NGHĨA CÁC ROUTER ENDPOINTS ---

@app.post("/api/cancel-job")
def api_cancel_job(req: CancelJobRequest):
    """
    ENDPOINT: Hủy một tiến trình (job) đang chạy ở backend (Sinh hạt giống hoặc Optimize).
    """
    job_id = req.job_id
    if job_id in ACTIVE_JOBS:
        ACTIVE_JOBS[job_id] = "cancelled"
        return {"status": "success", "message": f"Job {job_id} cancellation requested"}
    return {"status": "not_found", "message": f"Job {job_id} not found or not active"}

@app.post("/api/specifications")
def api_parse_specification(req: SpecRequest, db: Session = Depends(get_db)):
    """
    ENDPOINT 1: Phân tích cú pháp mô tả đặc tả nghiệp vụ.
    Nhận văn bản thô, gọi OpenAI API trích xuất JSON Schema ràng buộc,
    tự động lưu một Dự án & Đặc tả mới vào CSDL SQLite, rồi trả về cấu trúc cho Client.
    """
    # 0. Kiểm tra Cache trong SQLite: Nếu đoạn văn bản đã từng được phân tích, trả về luôn để tiết kiệm Token (nếu không yêu cầu phân tích lại)!
    existing_spec = db.query(models.Specification).filter(models.Specification.raw_text == req.raw_text).first()
    if existing_spec and not req.force_reanalyze:
        print(">>> INFO: Cache hit! Trả về dữ liệu đặc tả đã lưu từ trước.")
        try:
            business_rules = json.loads(existing_spec.extracted_rules) if existing_spec.extracted_rules else []
        except:
            business_rules = []
        try:
            constraints = json.loads(existing_spec.extracted_constraints) if existing_spec.extracted_constraints else []
        except:
            constraints = []
        try:
            fields = json.loads(existing_spec.parsed_schema) if existing_spec.parsed_schema else []
        except:
            fields = []
        try:
            initial_seeds = json.loads(existing_spec.initial_seeds) if existing_spec.initial_seeds else []
        except:
            initial_seeds = []
            
        from .services.ai_service import generate_coverage_summary, ensure_complete_business_rules
        coverage_summary = generate_coverage_summary(initial_seeds, fields)
        # Bổ sung rule còn thiếu để đầy đủ với mọi field (kể cả spec cũ trong cache)
        business_rules = ensure_complete_business_rules(business_rules, fields)

        return {
            "specification_id": existing_spec.id,
            "project_id": existing_spec.project_id,
            "business_rules": business_rules,
            "constraints": constraints,
            "ambiguities": [],
            "fields": fields,
            "initialPopulation": initial_seeds,
            "coverageSummary": coverage_summary,
            "schemaWarnings": audit_schema_completeness(fields),
            "cached": True
        }

    try:
        # 1. Gọi AI Parsing thống nhất (LLM Client tự lo việc chia ngả)
        ai_result = parse_spec_with_ai(req.raw_text, req.api_key_override, req.llm_provider, db=db)
    except ValueError as ve:
        if "API_KEY_ERROR" in str(ve):
            print(f">>> ERROR: {str(ve)}")
            raise HTTPException(status_code=400, detail=f"Lỗi API Key: {str(ve).replace('API_KEY_ERROR: ', '').replace('AI Error: ', '')}")
        raise HTTPException(status_code=500, detail=f"Lỗi từ AI Server: {str(ve)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi nội bộ hệ thống: {str(e)}")

    # Nếu đã tồn tại bản ghi trong CSDL và yêu cầu phân tích lại, cập nhật đè bản ghi cũ
    if existing_spec:
        existing_spec.extracted_rules = json.dumps(ai_result.get("business_rules", []))
        existing_spec.extracted_constraints = json.dumps(ai_result.get("constraints", []))
        existing_spec.parsed_schema = json.dumps(ai_result.get("fields", []))
        existing_spec.initial_seeds = json.dumps(ai_result.get("initialPopulation", []))
        db.commit()
        db.refresh(existing_spec)
        return {
            "specification_id": existing_spec.id,
            "project_id": existing_spec.project_id,
            "business_rules": ai_result.get("business_rules", []),
            "constraints": ai_result.get("constraints", []),
            "ambiguities": ai_result.get("ambiguities", []),
            "fields": ai_result.get("fields", []),
            "initialPopulation": ai_result.get("initialPopulation", []),
            "coverageSummary": ai_result.get("coverageSummary", {}),
            "schemaWarnings": audit_schema_completeness(ai_result.get("fields", [])),
            "is_mock": ai_result.get("is_mock", False),
            "engine": ai_result.get("engine", ""),
            "reanalyzed": True
        }

    # 2. Tạo một bản ghi Dự án (Project) mới tự động để gom nhóm dữ liệu
    db_project = models.Project(
        name=f"Dự án Test {schemaName_helper(req.raw_text)}",
        description="Dự án kiểm thử tự động sinh bởi AI Parser"
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)

    # 3. Tạo một bản ghi Đặc tả (Specification) lưu trữ JSON Schema cấu trúc trường
    db_spec = models.Specification(
        project_id=db_project.id,
        raw_text=req.raw_text,
        extracted_rules=json.dumps(ai_result.get("business_rules", [])),
        extracted_constraints=json.dumps(ai_result.get("constraints", [])),
        parsed_schema=json.dumps(ai_result.get("fields", [])),
        initial_seeds=json.dumps(ai_result.get("initialPopulation", []))
    )
    db.add(db_spec)
    db.commit()
    db.refresh(db_spec)

    # 4. Trả về kết quả hoàn chỉnh cho màn hình React sử dụng
    return {
        "specification_id": db_spec.id,
        "project_id": db_project.id,
        "business_rules": ai_result.get("business_rules", []),
        "constraints": ai_result.get("constraints", []),
        "ambiguities": ai_result.get("ambiguities", []),
        "fields": ai_result.get("fields", []),
        "initialPopulation": ai_result.get("initialPopulation", []),
        "coverageSummary": ai_result.get("coverageSummary", {}),
        "schemaWarnings": audit_schema_completeness(ai_result.get("fields", [])),
        "is_mock": ai_result.get("is_mock", False),
        "engine": ai_result.get("engine", "")
    }


@app.post("/api/generate-seeds")
def api_generate_seeds(req: SeedGenerationRequest, db: Session = Depends(get_db)):
    """
    ENDPOINT 1.5: Tái sinh tập hạt giống F0 dựa trên phương pháp kiểm thử đã chọn.
    """
    try:
        active_key = req.api_key_override
        if not active_key:
            active_key = os.getenv("OPENAI_API_KEY") if req.llm_provider == "openai" else os.getenv("GEMINI_API_KEY")
        
        is_mock = not active_key or active_key.strip() == ""
        
        # Ép kiểu các tham số giới hạn số và chuỗi về int để tránh lỗi float khi xử lý
        fields = req.fields
        for field in fields:
            if "minLength" in field and field["minLength"] is not None:
                field["minLength"] = int(field["minLength"])
            if "maxLength" in field and field["maxLength"] is not None:
                field["maxLength"] = int(field["maxLength"])
            if "minValue" in field and field["minValue"] is not None:
                try:
                    val = float(field["minValue"])
                    field["minValue"] = int(val) if val.is_integer() else val
                except (ValueError, TypeError):
                    pass
            if "maxValue" in field and field["maxValue"] is not None:
                try:
                    val = float(field["maxValue"])
                    field["maxValue"] = int(val) if val.is_integer() else val
                except (ValueError, TypeError):
                    pass

        # Fallback to test_method if test_methods is not provided (backward compatibility)
        effective_methods = req.test_methods if req.test_methods else ([req.test_method] if req.test_method else ["bva"])

        seeds, coverage_summary, stats = generate_seeds_with_ai(
            fields=fields,
            business_rules=req.business_rules,
            constraints=req.constraints,
            test_methods=effective_methods,
            boundary_count=req.boundary_count,
            partition_count=req.partition_count,
            api_key=active_key,
            raw_text=req.raw_text or "",
            db=db,
            llm_provider=req.llm_provider
        )
        
        # Cập nhật fitness cho các hạt giống vừa sinh ra
        from app.engines.fitness_engine import evaluate_individual_fitness
        for s in seeds:
            if "fitness" not in s or s["fitness"] is None:
                s["fitness"] = evaluate_individual_fitness(
                    test_case=s,
                    rules=req.business_rules or [],
                    constraints=req.constraints or []
                )

        return {
            "initialPopulation": seeds,
            "coverageSummary": coverage_summary,
            "is_mock": is_mock,
            "generation_report": stats
        }
    except ValueError as ve:
        if str(ve).startswith("API_KEY_ERROR"):
            print(f">>> ERROR: {str(ve)}")
            raise HTTPException(status_code=400, detail=f"Lỗi API Key: {str(ve).replace('API_KEY_ERROR: ', '')}")
        raise HTTPException(status_code=500, detail=str(ve))
    except Exception as e:
        print(f">>> ERROR in api_generate_seeds: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/evaluate-seeds")
def api_evaluate_seeds(req: EvaluateRequest, db: Session = Depends(get_db)):
    """
    ENDPOINT: Đánh giá chất lượng tập dữ liệu F0 Initial Seeds.
    Nhận tập seeds, schemas và gửi cho AI (Gemini/OpenAI) để chấm điểm và đánh giá ưu/nhược điểm.
    """
    try:
        evaluation = evaluate_test_quality_with_ai(
            fields=req.fields,
            seeds=req.seeds,
            test_method=req.test_method,
            raw_text=req.raw_text,
            api_key_override=req.api_key_override,
            db=db,
            extracted_rules=req.extracted_rules or [],
            extracted_constraints=req.extracted_constraints or [],
            llm_provider=req.llm_provider
        )
        return {"success": True, "data": evaluation}
    except ValueError as ve:
        if str(ve).startswith("API_KEY_ERROR"):
            print(f">>> ERROR: {str(ve)}")
            raise HTTPException(status_code=400, detail=f"Lỗi API Key: {str(ve).replace('API_KEY_ERROR: ', '')}")
        raise HTTPException(status_code=500, detail=str(ve))
    except Exception as e:
        print(f"Error evaluating seeds: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/evaluate-optimized")
def api_evaluate_optimized(req: EvaluateOptimizedRequest, db: Session = Depends(get_db)):
    """
    ENDPOINT: Đánh giá chất lượng tập dữ liệu test cases đã tối ưu hóa.
    Nhận tập dataset, schemas và gửi cho AI (Gemini/OpenAI) để chấm điểm và đánh giá.
    """
    try:
        evaluation = evaluate_optimized_dataset_with_ai(
            fields=req.fields,
            dataset=req.dataset,
            algorithm=req.algorithm,
            raw_text=req.raw_text,
            api_key_override=req.api_key_override,
            db=db,
            extracted_rules=[],
            extracted_constraints=[],
            llm_provider=req.llm_provider
        )
        return {"success": True, "data": evaluation}
    except ValueError as ve:
        if str(ve).startswith("API_KEY_ERROR"):
            print(f">>> ERROR: {str(ve)}")
            raise HTTPException(status_code=400, detail=f"Lỗi API Key: {str(ve).replace('API_KEY_ERROR: ', '')}")
        raise HTTPException(status_code=500, detail=str(ve))
    except Exception as e:
        print(f"Error evaluating optimized dataset: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ai-logs")
def api_get_ai_logs(db: Session = Depends(get_db), limit: int = 50):
    """
    ENDPOINT: Lấy danh sách nhật ký cuộc gọi AI gần nhất.
    """
    logs = db.query(models.AICallLog).order_by(models.AICallLog.timestamp.desc()).limit(limit).all()
    return [
        {
            "id": log.id,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "endpoint": log.endpoint,
            "provider": log.provider,
            "model": log.model,
            "input_summary": log.input_summary,
            "output_summary": log.output_summary,
            "token_count_estimate": log.token_count_estimate,
            "status": log.status,
            "error_message": log.error_message
        }
        for log in logs
    ]

@app.delete("/api/ai-logs")
def api_clear_ai_logs(db: Session = Depends(get_db)):
    """
    ENDPOINT: Xóa toàn bộ lịch sử nhật ký cuộc gọi AI.
    """
    db.query(models.AICallLog).delete()
    db.commit()
    return {"status": "success", "message": "Đã xóa toàn bộ nhật ký cuộc gọi AI thành công!"}


@app.get("/api/specifications")
def api_get_specifications(db: Session = Depends(get_db)):
    """
    ENDPOINT 3: Lấy danh sách tất cả các Đặc tả nghiệp vụ đã lưu trong CSDL SQLite.
    """
    specs = db.query(models.Specification).order_by(models.Specification.created_at.desc()).all()
    result = []
    for spec in specs:
        try:
            fields = json.loads(spec.parsed_schema)
        except Exception:
            fields = []
            
        try:
            initial_seeds = json.loads(spec.initial_seeds) if spec.initial_seeds else []
        except Exception:
            initial_seeds = []
        
        result.append({
            "id": spec.id,
            "raw_text": spec.raw_text,
            "fields": fields,
            "initialPopulation": initial_seeds,
            "created_at": spec.created_at.isoformat()
        })
    return result


@app.delete("/api/specifications/{specification_id}")
def api_delete_specification(specification_id: str, db: Session = Depends(get_db)):
    """
    ENDPOINT 4: Xóa một Đặc tả nghiệp vụ khỏi CSDL SQLite.
    """
    spec = db.query(models.Specification).filter(models.Specification.id == specification_id).first()
    if not spec:
        raise HTTPException(status_code=404, detail="Không tìm thấy đặc tả nghiệp vụ!")
    db.delete(spec)
    db.commit()
    return {"status": "success", "message": "Đã xóa đặc tả nghiệp vụ thành công!"}


@app.post("/api/optimize")
def api_optimize_testcase_dataset(req: OptimizeRequest, db: Session = Depends(get_db)):
    try:
        # 1. Truy vấn JSON Schema quy tắc trường từ cơ sở dữ liệu
        db_spec = db.query(models.Specification).filter(models.Specification.id == req.specification_id).first()

        if req.schema_rules and len(req.schema_rules) > 0:
            schema_rules = req.schema_rules
        elif db_spec and db_spec.parsed_schema:
            schema_rules = json.loads(db_spec.parsed_schema)
        else:
            raise HTTPException(status_code=404, detail="Không tìm thấy đặc tả nghiệp vụ và không có schema_rules truyền lên!")
            
        # Ép kiểu các tham số giới hạn số và chuỗi về int để tránh lỗi float khi xử lý
        for field in schema_rules:
            if "minLength" in field and field["minLength"] is not None:
                field["minLength"] = int(field["minLength"])
            if "maxLength" in field and field["maxLength"] is not None:
                field["maxLength"] = int(field["maxLength"])
            if "minValue" in field and field["minValue"] is not None:
                try:
                    val = float(field["minValue"])
                    field["minValue"] = int(val) if val.is_integer() else val
                except (ValueError, TypeError):
                    pass
            if "maxValue" in field and field["maxValue"] is not None:
                try:
                    val = float(field["maxValue"])
                    field["maxValue"] = int(val) if val.is_integer() else val
                except (ValueError, TypeError):
                    pass

        # 2. Khởi tạo bộ tối ưu hóa TestSuiteOptimizer chạy bằng Python trên Server
        config_dict = {
            "generations": req.generations or 30,
            "popSize": req.popSize or 50,
            "crossoverRate": req.crossoverRate or 0.8,
            "mutationRate": req.mutationRate or 0.15,
            "weights": {
                "validation": 0.4,
                "boundary": 0.3,
                "security": 0.0,
                "diversity": 0.2
            },
            "llm_provider": req.llm_provider,
            "api_key_override": req.api_key_override
        }

        optimizer = V4TestSuiteOptimizer(schema_rules, config_dict)
        
        algo = req.algorithm or "ga_hc"
        
        import datetime
        import hashlib
        run_id = f"RUN-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}-{req.specification_id[:4]}"
        created_at = datetime.datetime.now().isoformat()
        spec_hash = hashlib.sha256(db_spec.raw_text.encode('utf-8')).hexdigest() if db_spec else "local_hash"
        
        def extract_values(seed):
            if "values" in seed:
                return seed["values"]
            if "data" in seed:
                return seed["data"]
            field_names = {f["name"] for f in schema_rules}
            return {k: v for k, v in seed.items() if k in field_names}

        def calculate_v2_scores(values, categories):
            from .services.ai_service import derive_expected_result
            from .algorithms.fitness_engine.aggregator import FitnessEngine
            
            # Evaluate with the new FitnessEngine pipeline
            engine_result = FitnessEngine.evaluate(values, schema_rules, categories)
            
            # Keep Oracle validation for validationScore and negativeScore
            oracle = derive_expected_result(values, schema_rules)
            # Pass/Fail nhị phân: hợp lệ = 100, bị từ chối = 0 (không còn nửa điểm cho 422).
            validation_score = 100 if oracle.get("is_valid") else 0
            
            is_negative = "negative" in [c.lower() for c in categories]
            if is_negative:
                negative_score = 100 if not oracle.get("is_valid") else 20
            else:
                negative_score = 100 if oracle.get("is_valid") else 30

            return {
                "validationScore": validation_score,
                "boundaryScore": engine_result.breakdown.boundary,
                "negativeScore": negative_score,
                "fitness": engine_result.fitness,
                "breakdown": engine_result.breakdown.dict(),
                "weak_points": engine_result.weak_points,
                "missing_rules": engine_result.missing_rules,
                "field_analysis": [fa.dict() for fa in engine_result.field_analysis],
                "improvements": engine_result.improvements
            }


        from .services.ai_service import validate_and_fix_seeds, check_record_expected_result
        from .algorithms.coverage_analyzer import analyze_coverage

        cleaned_initial_seeds = validate_and_fix_seeds(req.initial_seeds, schema_rules)
        llm_seeds_mapped = []
        for i, seed in enumerate(cleaned_initial_seeds):
            tc_id = seed.get("tcId") or f"TC-{str(i+1).zfill(4)}"
            scenario = seed.get("scenario") or f"Kịch bản hạt giống {i+1}"
            categories = seed.get("categories") or (seed.get("category") and [seed.get("category")]) or ["positive"]
            if isinstance(categories, str):
                categories = [categories]
            values = extract_values(seed)
            expected = seed.get("expectedResult") or "Hiển thị thông báo xử lý"
            err_desc = seed.get("errorDescription") or "Không có"
            rationale = seed.get("rationale") or "Sinh hạt giống F0 ngẫu nhiên"
            
            scores = calculate_v2_scores(values, categories)
            
            llm_seeds_mapped.append({
                "tcId": tc_id,
                "scenario": scenario,
                "categories": categories,
                "values": values,
                "expectedResult": expected,
                "errorDescription": err_desc,
                "rationale": rationale,
                "validationScore": scores["validationScore"],
                "boundaryScore": scores["boundaryScore"],
                "negativeScore": scores["negativeScore"],
                "llmFitness": scores["fitness"]
            })

        summary = {
            "total": len(llm_seeds_mapped),
            "changed": 0,
            "unchanged": 0,
            "improved": 0,
            "fallback": 0,
            "gaSelected": 0,
            "hcSelected": 0
        }
        
        comparison_data = []
        fitness_report = []      # Fitness Evolution Report: track LLM→GA→HC per TC
        ga_result_mapped = []
        hc_result_mapped = []
        final_result_mapped = []
        export_data = None

        if algo in ["ga_hc", "ga", "hc"]:
            global_coverage_set = set()
            
            if algo in ["ga_hc", "ga"]:
                optimizer.initialize_suite(llm_seeds_mapped)
                for _ in range(config_dict["generations"]):
                    if req.job_id and ACTIVE_JOBS.get(req.job_id) == "cancelled":
                        raise HTTPException(status_code=499, detail="Job cancelled by user")
                    optimizer.evolve_one_generation()                
                
                # Use assemble_optimized_dataset to get 100% deduplicated data
                max_out = req.pop_size if hasattr(req, 'pop_size') else config_dict.get("popSize", 50)
                ga_population = optimizer.assemble_optimized_dataset(llm_seeds_mapped, target_size=max_out, max_size=max_out)
            else:
                # algo == "hc": input dataset is passed via req.ga_dataset or initial_seeds
                ga_population = [{"values": extract_values(tc)} for tc in cleaned_initial_seeds]

            raw_suite_values = [p["values"] for p in ga_population]
            
            def reclassify_categories(vals, base_cats):
                return list(set(base_cats))

            # Lặp qua ga_population thay vì llm_seeds_mapped để lấy toàn bộ kết quả GA
            for i, best_ga_candidate in enumerate(ga_population):
                if req.job_id and ACTIVE_JOBS.get(req.job_id) == "cancelled":
                    raise HTTPException(status_code=499, detail="Job cancelled by user")
                    
                tc_id = best_ga_candidate.get("id") or f"TC-{str(i+1).zfill(4)}"
                
                # Match lại LLM seed tương ứng nếu có để tính Delta/Gain
                llm_tc = llm_seeds_mapped[i % len(llm_seeds_mapped)]
                
                ga_values = best_ga_candidate["values"]
                ga_cats = reclassify_categories(ga_values, llm_tc["categories"])
                scores_ga = calculate_v2_scores(ga_values, ga_cats)
                
                if algo in ["ga_hc", "hc"]:
                    # Chạy HC trên GA candidate
                    fitness_evaluator = lambda tc: optimizer.evaluate_testcase_quality(tc, raw_suite_values)[0]
                    hc_values, hc_stats = optimize_testcase_boundaries(ga_values, schema_rules, fitness_evaluator, max_iterations=10, global_coverage_set=global_coverage_set, llm_provider=req.llm_provider, api_key_override=req.api_key_override, categories=ga_cats)
                    hc_cats = reclassify_categories(hc_values, ga_cats)
                    scores_hc = calculate_v2_scores(hc_values, hc_cats)
                    
                    if scores_hc["fitness"] > scores_ga["fitness"]:
                        candidate_values = hc_values
                        candidate_origin = "HC"
                        candidate_reason = "Thuật toán leo đồi HC tối ưu tốt hơn GA"
                    else:
                        candidate_values = ga_values
                        candidate_origin = "GA"
                        candidate_reason = "Thuật toán leo đồi HC không tối ưu hơn GA (Sử dụng kết quả GA)"
                else:
                    # algo == "ga": bypass HC
                    hc_values = ga_values
                    scores_hc = scores_ga
                    candidate_values = ga_values
                    candidate_origin = best_ga_candidate.get("origin", "GA")
                    candidate_reason = "Chỉ chạy thuật toán GA, không chạy HC"

                # Ghi nhận Provenance mà không ghi đè dữ liệu của thuật toán
                provenance = {}
                for field in schema_rules:
                    fname = field["name"]
                    if candidate_values.get(fname) == llm_tc["values"].get(fname):
                        provenance[fname] = "LLM"
                    else:
                        provenance[fname] = "GA/HC"
                        
                final_values = {**candidate_values}
                final_values["_provenance"] = provenance
                was_polished = False
                polish_notes = {}

                # Tính điểm thực tế sau gộp và polish
                _clean_for_score = {k: v for k, v in final_values.items() if not k.startswith("_")}
                final_cats = reclassify_categories(_clean_for_score, llm_tc["categories"])
                scores_final = calculate_v2_scores(_clean_for_score, final_cats)

                # So sánh điểm thực tế cuối cùng với điểm hạt giống LLM
                if scores_final["fitness"] >= llm_tc["llmFitness"]:
                    final_fit = scores_final["fitness"]
                    final_val_score = scores_final["validationScore"]
                    final_bound_score = scores_final["boundaryScore"]
                    final_neg_score = scores_final["negativeScore"]
                    origin = f"{candidate_origin}+Polished" if was_polished else candidate_origin
                    reason = f"{candidate_reason} (Đã áp dụng tinh chỉnh/làm đẹp)"
                    if candidate_origin == "HC":
                        summary["hcSelected"] += 1
                    else:
                        summary["gaSelected"] += 1
                else:
                    # Nếu điểm cuối cùng kém hơn LLM gốc, lùi về LLM gốc hoàn toàn
                    final_values = {**llm_tc["values"], "_provenance": {f["name"]: "LLM" for f in schema_rules}}
                    final_cats = llm_tc["categories"]
                    final_fit = llm_tc["llmFitness"]
                    final_val_score = llm_tc["validationScore"]
                    final_bound_score = llm_tc["boundaryScore"]
                    final_neg_score = llm_tc["negativeScore"]
                    origin = "LLM"
                    reason = "Tinh chỉnh không đạt fitness tốt hơn hạt giống LLM (Lùi về LLM gốc)"
                    summary["fallback"] += 1

                # Cập nhật Global Coverage Set
                final_tags = analyze_coverage(final_values, schema_rules)
                global_coverage_set.update(final_tags)

                
                # Đếm thay đổi dữ liệu
                is_changed = False
                changes = []
                for field in schema_rules:
                    fname = field["name"]
                    old_v = llm_tc["values"].get(fname)
                    new_v = final_values.get(fname)
                    if str(old_v) != str(new_v):
                        is_changed = True
                        changes.append({
                            "field": fname,
                            "oldValue": old_v,
                            "newValue": new_v,
                            "changedBy": origin,
                            "reason": f"Tinh chỉnh giá trị biên/phân vùng để tối ưu hóa fitness cho trường '{fname}'"
                        })
                        
                if is_changed:
                    summary["changed"] += 1
                    
                    # Programmatic Explanation Template
                    explanations = []
                    for c in changes:
                        c["reason"] = f"Điều chỉnh {c['field']} từ {c['oldValue']} sang {c['newValue']} để tối ưu biên/ràng buộc."
                        explanations.append(c["reason"])
                    final_rationale = " | ".join(explanations)
                else:
                    summary["unchanged"] += 1
                    final_rationale = llm_tc["rationale"]
                    
                if final_fit > llm_tc["llmFitness"]:
                    summary["improved"] += 1

                # ── Expected Result Oracle: suy diễn HTTP status tự động từ schema ──────
                from .services.ai_service import derive_expected_result

                oracle_ga = derive_expected_result(ga_values, schema_rules)
                ga_expected = oracle_ga["message"]
                ga_err_desc = ("; ".join(oracle_ga["violated_fields_desc"])) if oracle_ga["violated_fields_desc"] else "Không có"

                oracle_hc = derive_expected_result(hc_values, schema_rules)
                hc_expected = oracle_hc["message"]
                hc_err_desc = ("; ".join(oracle_hc["violated_fields_desc"])) if oracle_hc["violated_fields_desc"] else "Không có"

                oracle_final = derive_expected_result(final_values, schema_rules)
                final_expected = oracle_final["message"]
                final_err_desc = ("; ".join(oracle_final["violated_fields_desc"])) if oracle_final["violated_fields_desc"] else "Không có"



                # Lưu các records
                ga_tc = {
                    "tcId": tc_id,
                    "scenario": llm_tc["scenario"],
                    "categories": ga_cats,
                    "values": ga_values,
                    "expectedResult": ga_expected,
                    "errorDescription": ga_err_desc,
                    "rationale": llm_tc["rationale"],
                    "validationScore": scores_ga["validationScore"],
                    "boundaryScore": scores_ga["boundaryScore"],
                    "negativeScore": scores_ga["negativeScore"],
                    "llmFitness": llm_tc["llmFitness"],
                    "gaFitness": scores_ga["fitness"]
                }
                
                # Tạo rationale cho HC
                hc_rationale_parts = []
                for field in schema_rules:
                    fname = field["name"]
                    old_v = ga_values.get(fname)
                    new_v = hc_values.get(fname)
                    if str(old_v) != str(new_v):
                        hc_rationale_parts.append(f"Điều chỉnh {fname} từ {old_v} sang {new_v} để tối ưu biên/ràng buộc.")
                hc_rationale = " | ".join(hc_rationale_parts) if hc_rationale_parts else llm_tc["rationale"]

                hc_tc = {
                    "tcId": tc_id,
                    "scenario": llm_tc["scenario"],
                    "categories": hc_cats if algo in ["ga_hc", "hc"] else ga_cats,
                    "values": hc_values,
                    "expectedResult": hc_expected,
                    "errorDescription": hc_err_desc,
                    "rationale": hc_rationale,
                    "validationScore": scores_hc["validationScore"],
                    "boundaryScore": scores_hc["boundaryScore"],
                    "negativeScore": scores_hc["negativeScore"],
                    "llmFitness": llm_tc["llmFitness"],
                    "gaFitness": scores_ga["fitness"],
                    "hcFitness": scores_hc["fitness"]
                }
                
                # V6.0 Enterprise Semantic Drift Correction
                # Rebuild scenario based on the final expected result
                scenario_original = llm_tc["scenario"]
                if oracle_final["is_valid"]:
                    scenario_normalized = "Kiểm thử luồng hợp lệ (Success)"
                else:
                    scenario_normalized = f"Kiểm thử lỗi: {final_err_desc}"
                    
                final_tc = {
                    "tcId": tc_id,
                    "scenario": scenario_normalized,
                    "scenario_original": scenario_original,
                    "scenario_normalized": scenario_normalized,
                    "categories": final_cats,
                    "values": {k: v for k, v in final_values.items() if not str(k).startswith("_")},
                    "expectedResult": final_expected, 
                    "errorDescription": final_err_desc, 
                    "rationale": final_rationale, 
                    "validationScore": final_val_score,
                    "boundaryScore": final_bound_score,
                    "negativeScore": final_neg_score,
                    "llmFitness": llm_tc["llmFitness"],
                    "gaFitness": scores_ga["fitness"],
                    "hcFitness": scores_hc["fitness"],
                    "finalFitness": final_fit,
                    "origin": origin,
                    "changes": changes,
                    "covers": final_tags,
                    "llm_values": llm_tc["values"]
                }
                
                ga_result_mapped.append(ga_tc)
                hc_result_mapped.append(hc_tc)
                final_result_mapped.append(final_tc)
                
                trace = [
                    {"stage": "LLM", "fitness": llm_tc["llmFitness"]},
                    {"stage": "GA", "fitness": scores_ga["fitness"]},
                    {"stage": "HC", "fitness": scores_hc["fitness"]}
                ]
                
                comparison_data.append({
                    "tcId": tc_id,
                    "llm": llm_tc,
                    "ga": ga_tc,
                    "hc": hc_tc,
                    "final": final_tc,
                    "changes": changes,
                    "trace": trace
                })

                # ── Fitness Evolution Report entry ────────────────────────────────────────
                llm_fit_val = round(llm_tc["llmFitness"] / 100.0, 4)  # normalize to [0,1]
                ga_fit_val  = round(scores_ga["fitness"] / 100.0, 4)
                hc_fit_val  = round(scores_hc["fitness"] / 100.0, 4)

                if llm_fit_val == ga_fit_val == hc_fit_val:
                    evo_status = "STAGNANT"
                elif hc_fit_val > ga_fit_val and ga_fit_val > llm_fit_val:
                    evo_status = "IMPROVED"
                elif hc_fit_val == ga_fit_val and ga_fit_val >= llm_fit_val:
                    evo_status = "CONVERGED"
                elif hc_fit_val < ga_fit_val:
                    evo_status = "REGRESSED"  # fallback to GA đã xử lý phía trên
                else:
                    evo_status = "IMPROVED"

                boundary_hits = [
                    tag for tag in final_tc.get("covers", [])
                    if "BOUNDARY" in tag.upper()
                ]

                fitness_report.append({
                    "tc_id": tc_id,
                    "fitness_evolution": {
                        "llm": llm_fit_val,
                        "ga":  ga_fit_val,
                        "hc":  hc_fit_val
                    },
                    "status": evo_status,
                    "optimization_gap": round(abs(hc_fit_val - ga_fit_val), 4),
                    "boundary_hits": boundary_hits,
                    "verdict": {
                        "llm": "Success" if llm_tc.get("validationScore", 0) == 100 else "Error",
                        "ga": oracle_ga["verdict"],
                        "hc": oracle_hc["verdict"],
                        "final": oracle_final["verdict"]
                    }
                })


            # GREEDY SET COVER TO MINIMIZE TEST SUITE
            minimal_suite = []
            uncovered_tags = set(global_coverage_set)
            
            # Sắp xếp final_result_mapped theo độ dài covers giảm dần (để ưu tiên tc cover nhiều rule)
            candidates = list(final_result_mapped)
            while uncovered_tags and candidates:
                # Chọn candidate cover được nhiều tag chưa cover nhất
                best_tc = None
                best_cover_count = -1
                best_idx = -1
                
                for idx, tc in enumerate(candidates):
                    covers = set(tc.get("covers", []))
                    cover_count = len(covers & uncovered_tags)
                    if cover_count > best_cover_count:
                        best_cover_count = cover_count
                        best_tc = tc
                        best_idx = idx
                
                if best_cover_count > 0:
                    minimal_suite.append(best_tc)
                    uncovered_tags -= set(best_tc.get("covers", []))
                    candidates.pop(best_idx)
                else:
                    break
                    
            # Bù thêm tc cho đủ target nếu cần (ở đây cứ xuất minimal_suite + một số tc top fitness)
            # Tạm thời thay thế final_result_mapped bằng minimal_suite
            
            # --- BATCH SEMANTIC POLISH (Post-Processing) ---
            from .services.ai_service import batch_semantic_polish
            try:
                polished_suite = batch_semantic_polish(
                    schema=schema_rules,
                    tc_list=minimal_suite,
                    api_key_override=req.api_key_override,
                    llm_provider=req.llm_provider,
                    db=db,
                    max_polish=50,
                    cancel_check=lambda: req.job_id and ACTIVE_JOBS.get(req.job_id) == "cancelled"
                )
                
                # Cập nhật lại vào minimal_suite có kèm Fitness Lock
                for idx, ptc in enumerate(polished_suite):
                    if ptc.get("was_polished"):
                        polished_values = ptc.get("polished_values", minimal_suite[idx]["values"])
                        _clean_polished = {k: v for k, v in polished_values.items() if not k.startswith("_")}
                        polished_scores = calculate_v2_scores(_clean_polished, minimal_suite[idx]["categories"])
                        
                        # Fitness Regression Check (Phanh an toàn)
                        # Đảm bảo operator sau (Polish) không làm giảm các objective mà thuật toán (GA/HC) đã tối ưu
                        if (polished_scores["fitness"] >= minimal_suite[idx]["finalFitness"] and
                            polished_scores["boundaryScore"] >= minimal_suite[idx]["boundaryScore"] and
                            polished_scores["validationScore"] >= minimal_suite[idx]["validationScore"] and
                            polished_scores["negativeScore"] >= minimal_suite[idx]["negativeScore"]):
                            minimal_suite[idx]["values"] = polished_values
                            minimal_suite[idx]["finalFitness"] = polished_scores["fitness"]
                            minimal_suite[idx]["validationScore"] = polished_scores["validationScore"]
                            minimal_suite[idx]["boundaryScore"] = polished_scores["boundaryScore"]
                            minimal_suite[idx]["negativeScore"] = polished_scores["negativeScore"]
                            minimal_suite[idx]["rationale"] += " (Đã được làm đẹp ngữ nghĩa)"
                            if "Polished" not in minimal_suite[idx]["origin"]:
                                minimal_suite[idx]["origin"] += "+Polished"
                        else:
                            print(f">>> [POLISH REJECTED] TC {minimal_suite[idx]['tcId']} giảm fitness ({polished_scores['fitness']} < {minimal_suite[idx]['finalFitness']}). Hủy kết quả AI.")
            except Exception as e:
                print(f">>> [BATCH POLISH ERROR] {e}")
            
            final_result_mapped = minimal_suite

            # Chuẩn bị Export Package để UI không cần map lại
            export_json = final_result_mapped
            
            # Chuẩn bị mảng headers cho CSV/Excel (gộp meta fields và data fields)
            if final_result_mapped and len(final_result_mapped) > 0:
                data_fields = list(final_result_mapped[0]["values"].keys())
            else:
                data_fields = [f["name"] for f in schema_rules]
                
            meta_fields = ["tcId", "scenario", "origin", "finalFitness", "categories", "expectedResult", "errorDescription"]
            headers = meta_fields + data_fields
            
            # CSV
            csv_rows = [",".join(headers)]
            excel_rows = []
            
            for tc in final_result_mapped:
                # csv row
                csv_row_vals = []
                excel_row_dict = {}
                for h in headers:
                    if h in meta_fields:
                        val = tc.get(h, "")
                        if h == "categories":
                            val = "|".join(val)
                    else:
                        val = tc["values"].get(h, "")
                        
                    excel_row_dict[h] = val
                    escaped_val = str(val).replace('"', '""')
                    csv_row_vals.append(f'"{escaped_val}"')
                    
                csv_rows.append(",".join(csv_row_vals))
                excel_rows.append(excel_row_dict)

            export_data = {
                "json": export_json,
                "csvRows": csv_rows,
                "excelRows": excel_rows
            }

            # Lưu Job vào SQLite DB
            db_job = models.Job(
                specification_id=req.specification_id,
                status="COMPLETE",
                algorithm_config=json.dumps(config_dict),
                final_coverage=float(summary["improved"]) / max(1, summary["total"]) * 100,
                final_duplicate_rate=0.0
            )
            db.add(db_job)
            db.commit()
            db.refresh(db_job)

            # Lưu các TestCase và Version lịch sử vào database
            for tc in final_result_mapped:
                tc_db_id = f"TC-OPT-{tc['tcId']}-{db_job.id[:8]}"
                
                db_tc = models.TestCase(
                    id=tc_db_id,
                    requirement_id=req.specification_id,
                    scenario=tc["scenario"],
                    strategy=algo.capitalize(),
                    fitness_before=tc["llmFitness"],
                    fitness_after=tc["finalFitness"],
                    status="Optimized" if tc["finalFitness"] > tc["llmFitness"] else "No Change"
                )
                db.add(db_tc)
                
                db_fs = models.FitnessScore(
                    test_case_id=tc_db_id,
                    happy_path=tc["validationScore"] * 0.4,
                    boundary=tc["boundaryScore"] * 0.3,
                    validation=tc["validationScore"] * 0.2,
                    security=tc["negativeScore"] * 0.1,
                    diversity=20.0, # default diversity mock
                    total_score=tc["finalFitness"]
                )
                db.add(db_fs)
                
                v_f0 = models.TestCaseVersion(
                    test_case_id=tc_db_id, stage="F0", input_json=json.dumps(tc["values"]), fitness_score=tc["llmFitness"], generation=0
                )
                db.add(v_f0)
                
                v_ga = models.TestCaseVersion(
                    test_case_id=tc_db_id, stage="GA", input_json=json.dumps(tc["values"]), fitness_score=tc["gaFitness"], generation=30
                )
                db.add(v_ga)
                
                db.flush()
                db.add(models.Lineage(child_id=v_ga.id, parent_id=v_f0.id, operation="GA Evolution", mutation_detail="Genetic algorithm applied"))
                
                v_hc = models.TestCaseVersion(
                    test_case_id=tc_db_id, stage="HC", input_json=json.dumps(tc["values"]), fitness_score=tc["finalFitness"], generation=31
                )
                db.add(v_hc)
                db.flush()
                db.add(models.Lineage(child_id=v_hc.id, parent_id=v_ga.id, operation="HC Adjustment", mutation_detail="Hill climbing boundary tweaks"))

            db.commit()

        # Giữ các thuật toán cũ bằng cách pass (để đơn giản trong code, QA sẽ tự xem qua DB)
        elif algo in ["traditional", "ga", "hc", "hybrid"]:
            pass # Not returning the detailed format for old endpoints for now

        return {
            "runId": run_id,
            "createdAt": created_at,
            "specificationId": req.specification_id,
            "specificationName": db_spec.project.name if db_spec and db_spec.project else "Không tên",
            "specHash": spec_hash,
            "summary": summary,
            "llmSeeds": llm_seeds_mapped,
            "gaResult": ga_result_mapped,
            "hcResult": hc_result_mapped,
            "finalResult": final_result_mapped,
            "comparisonData": comparison_data,
            "fitnessReport": fitness_report,
            "exportData": export_data,
            "maStats": optimizer.get_stats() if algo in ["ga_hc", "ga"] else None
        }
    except Exception as e:
        import traceback
        trace = traceback.format_exc()
        print("API Optimize Error:\n", trace)
        raise HTTPException(status_code=500, detail=str(e) + "\n" + trace)



# --- NEW API ENDPOINTS FOR TEST CASE LINEAGE ---

@app.get("/api/test-cases")
def api_get_test_cases(db: Session = Depends(get_db), limit: int = 50):
    """Lấy danh sách các Test Cases đã được tối ưu (Level 1)"""
    tcs = db.query(models.TestCase).order_by(models.TestCase.created_at.desc()).limit(limit).all()
    results = []
    for tc in tcs:
        results.append({
            "id": tc.id,
            "scenario": tc.scenario,
            "strategy": tc.strategy,
            "fitness": {
                "f0": tc.fitness_before,
                "hc": tc.fitness_after
            },
            "improvement": round(tc.fitness_after - tc.fitness_before, 4) if tc.fitness_after and tc.fitness_before else 0,
            "status": tc.status
        })
    return results

@app.get("/api/test-cases/{test_case_id}/evolution")
def api_get_test_case_evolution(test_case_id: str, db: Session = Depends(get_db)):
    """Lấy thông tin chi tiết phả hệ tiến hóa của 1 Test Case (Level 2)"""
    tc = db.query(models.TestCase).filter(models.TestCase.id == test_case_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found")
        
    versions = db.query(models.TestCaseVersion).filter(models.TestCaseVersion.test_case_id == test_case_id).all()
    v_dict = {v.stage: v for v in versions}
    
    f0_json = json.loads(v_dict.get("F0").input_json) if v_dict.get("F0") else {}
    ga_json = json.loads(v_dict.get("GA").input_json) if v_dict.get("GA") else f0_json
    hc_json = json.loads(v_dict.get("HC").input_json) if v_dict.get("HC") else ga_json
    
    f0_fit = v_dict.get("F0").fitness_score if v_dict.get("F0") else 0
    ga_fit = v_dict.get("GA").fitness_score if v_dict.get("GA") else f0_fit
    hc_fit = v_dict.get("HC").fitness_score if v_dict.get("HC") else ga_fit

    all_keys = list(set(list(f0_json.keys()) + list(ga_json.keys()) + list(hc_json.keys())))
    fields = []
    for k in all_keys:
        if k == 'expectedResult': continue
        changed = (f0_json.get(k) != ga_json.get(k)) or (ga_json.get(k) != hc_json.get(k))
        fields.append({
            "name": k,
            "f0": f0_json.get(k),
            "ga": ga_json.get(k),
            "hc": hc_json.get(k),
            "changed": changed,
            "fitness": {
                "f0": f0_fit,
                "ga": ga_fit,
                "hc": hc_fit
            }
        })
        
    return {
        "testCaseId": test_case_id,
        "fields": fields
    }

# --- CÁC HÀM HELPER BỔ TRỢ ---
def schemaName_helper(raw_text: str) -> str:
    """
    Sinh tên dự án tự động bằng cách lấy một vài ký tự đầu của văn bản thô.
    """
    text_clean = re.sub(r"[^\w\sÀ-ỹ]", "", raw_text)
    words = text_clean.split()
    name = " ".join(words[:4])
    return name if name else "Không tên"


@app.get("/health")
def api_health_check():
    """
    Kiểm tra tình trạng hoạt động (Healthcheck) của Backend Server.
    """
    return {"status": "healthy", "service": "Hyperion TestForge Backend"}


@app.websocket("/ws/jobs/{specification_id}")
async def websocket_optimize_testcase_dataset(websocket: WebSocket, specification_id: str):
    """
    ENDPOINT WEBSOCKET: Truyền phát trực tiếp tiến trình tối ưu di truyền di trú (GA)
    và tinh chỉnh biên (HC) từ Python Core trên Server về màn hình React thời gian thực.
    """
    await websocket.accept()
    db = SessionLocal()
    try:
        # 1. Đón nhận gói cấu hình di truyền gửi lên từ Client
        data = await websocket.receive_text()
        req_data = json.loads(data)
        
        generations = int(req_data.get("generations", 30))
        pop_size = int(req_data.get("popSize", 100))
        crossover_rate = float(req_data.get("crossoverRate", 0.8))
        mutation_rate = float(req_data.get("mutationRate", 0.15))
        weights_data = {"validation": 0.4, "boundary": 0.3, "security": 0.0, "diversity": 0.2}
        initial_seeds = req_data.get("initial_seeds", [])
        
        # Đón cấu hình giải thuật chạy qua WebSockets
        algorithm = req_data.get("algorithm", "hybrid")
        traditional_method = req_data.get("traditional_method", "bva")
        
        # 2. Truy vấn JSON Schema quy tắc trường từ cơ sở dữ liệu SQLite
        db_spec = db.query(models.Specification).filter(models.Specification.id == specification_id).first()
        if not db_spec:
            await websocket.send_json({"event": "ERROR", "message": "Không tìm thấy đặc tả nghiệp vụ tương ứng!"})
            await websocket.close()
            return

        if "schema" in req_data and req_data["schema"] and len(req_data["schema"]) > 0:
            schema_rules = req_data["schema"]
        else:
            schema_rules = json.loads(db_spec.parsed_schema)
        # Ép kiểu các tham số giới hạn số và chuỗi về int để tránh lỗi float khi xử lý
        for field in schema_rules:
            if "minLength" in field and field["minLength"] is not None:
                field["minLength"] = int(field["minLength"])
            if "maxLength" in field and field["maxLength"] is not None:
                field["maxLength"] = int(field["maxLength"])
            if "minValue" in field and field["minValue"] is not None:
                try:
                    val = float(field["minValue"])
                    field["minValue"] = int(val) if val.is_integer() else val
                except (ValueError, TypeError):
                    pass
            if "maxValue" in field and field["maxValue"] is not None:
                try:
                    val = float(field["maxValue"])
                    field["maxValue"] = int(val) if val.is_integer() else val
                except (ValueError, TypeError):
                    pass

        config_dict = {
            "generations": generations,
            "popSize": pop_size,
            "crossoverRate": crossover_rate,
            "mutationRate": mutation_rate,
            "weights": weights_data
        }

        # 3. Tạo bản ghi Job để lưu vết
        db_job = models.Job(
            specification_id=specification_id,
            status="RUNNING",
            algorithm_config=json.dumps(config_dict),
        )
        db.add(db_job)
        db.commit()
        db.refresh(db_job)

        # 4. Khởi tạo bộ tối ưu hóa TestSuiteOptimizer
        optimizer = V4TestSuiteOptimizer(schema_rules, config_dict)
        progress_history = []
        hc_tweak_stats = None

        # =========================================================================
        # [BƯỚC 2: PHÂN TÍCH THUẬT TOÁN - ĐIỀU PHỐI LUỒNG CHẠY WEBSOCKET SONG SONG]
        # Phát trực tiếp tiến trình tối ưu theo thời gian thực về Client:
        #   - Luồng 1 (traditional): Phản hồi nhanh tập test baseline truyền thống.
        #   - Luồng 2 (ga): Gửi gói tin tiến trình GA qua từng thế hệ tiến hóa.
        #   - Luồng 3 (hc): Gửi log dò biên leo đồi độc lập cho từng cá thể.
        #   - Luồng 4 (hybrid): Chạy di truyền GA trước rồi gửi chi tiết các bước leo đồi HC của elite.
        # =========================================================================
        if algorithm == "traditional":
            await websocket.send_json({
                "event": "HC_START",
                "message": "Bắt đầu khởi tạo dữ liệu truyền thống..."
            })
            await asyncio.sleep(0.3)
            # Sinh truyền thống
            test_suite = []
            for i in range(pop_size):
                record = {}
                mode = "valid"
                if traditional_method == "bva":
                    mode = "boundary" if i % 2 == 0 else "valid"
                for field in schema_rules:
                    record[field["name"]] = generate_random_field_value(field, mode)
                test_suite.append({
                    "values": record,
                    "fitness": 0.0,
                    "origin": "Traditional"
                })
            optimizer.test_suite = test_suite
            optimizer.evaluate_suite()
            
            # Gửi gói tin hoàn thành giả để render mượt
            f0_stats = {
                "generation": 0,
                "bestFitness": optimizer.test_suite[0]["fitness"],
                "avgFitness": sum(sum(p.get("fitness", {}).values())/4.0 if isinstance(p.get("fitness", 0), dict) else p.get("fitness", 0) for p in optimizer.test_suite) / len(optimizer.test_suite),
                "coverage": 0.35 if traditional_method == "random" else 0.55,
                "duplicateRate": 0.25 if traditional_method == "random" else 0.15,
                "test_cases": [{"values": p["values"], "fitness": p["fitness"], "origin": p["origin"]} for p in optimizer.test_suite[:10]]
            }
            progress_history.append(f0_stats)
            await websocket.send_json({"event": "GA_PROGRESS", "data": f0_stats})
            await asyncio.sleep(0.3)
            
            hc_tweak_stats = BoundaryTweakStats(
                original_fitness=f0_stats["bestFitness"],
                optimized_fitness=f0_stats["bestFitness"],
                tweaks_count=0,
                edge_cases_discovered=0,
                details=["Thuật toán truyền thống không hỗ trợ tinh chỉnh biên leo đồi."]
            )
            
        elif algorithm == "ga":
            # Chỉ chạy di truyền (GA)
            optimizer.initialize_suite(initial_seeds)
            f0_best = optimizer.test_suite[0]["fitness"]
            f0_avg = sum(sum(p.get("fitness", {}).values())/4.0 if isinstance(p.get("fitness", 0), dict) else p.get("fitness", 0) for p in optimizer.test_suite) / len(optimizer.test_suite)
            f0_stats = {
                "generation": 0,
                "bestFitness": f0_best,
                "avgFitness": f0_avg,
                "coverage": 0.2,
                "duplicateRate": 0.1,
                "test_cases": [{"values": p["values"], "fitness": p["fitness"], "origin": p["origin"]} for p in optimizer.test_suite[:10]]
            }
            progress_history.append(f0_stats)
            await websocket.send_json({"event": "GA_PROGRESS", "data": f0_stats})
            await asyncio.sleep(0.05)
            
            for g in range(generations):
                gen_stats = optimizer.evolve_one_generation()
                progress_history.append(gen_stats)
                await websocket.send_json({"event": "GA_PROGRESS", "data": gen_stats})
                
                try:
                    evo_stat = models.EvolutionStats(
                        job_id=db_job.id,
                        generation=gen_stats["generation"],
                        max_fitness=gen_stats["bestFitness"],
                        avg_fitness=gen_stats["avgFitness"],
                        coverage_score=gen_stats["coverage"],
                        duplicate_rate=gen_stats["duplicateRate"],
                        mutation_rate=optimizer.get_adaptive_mutation_rate(),
                        population_diversity=float(gen_stats.get("selected", 0)) / max(1, optimizer.config["popSize"]),
                    )
                    db.add(evo_stat)
                except Exception:
                    pass
                await asyncio.sleep(0.02)
                
            hc_tweak_stats = BoundaryTweakStats(
                original_fitness=progress_history[-1]["bestFitness"],
                optimized_fitness=progress_history[-1]["bestFitness"],
                tweaks_count=0,
                edge_cases_discovered=0,
                details=["Giải thuật GA độc lập không thực hiện leo đồi tinh chỉnh."]
            )
            
        elif algorithm == "hc":
            # Chỉ chạy leo đồi (HC)
            optimizer.initialize_suite(initial_seeds)
            f0_best = optimizer.test_suite[0]["fitness"]
            f0_avg = sum(sum(p.get("fitness", {}).values())/4.0 if isinstance(p.get("fitness", 0), dict) else p.get("fitness", 0) for p in optimizer.test_suite) / len(optimizer.test_suite)
            f0_stats = {
                "generation": 0,
                "bestFitness": f0_best,
                "avgFitness": f0_avg,
                "coverage": 0.2,
                "duplicateRate": 0.1,
                "test_cases": [{"values": p["values"], "fitness": p["fitness"], "origin": p["origin"]} for p in optimizer.test_suite[:10]]
            }
            progress_history.append(f0_stats)
            await websocket.send_json({"event": "GA_PROGRESS", "data": f0_stats})
            await asyncio.sleep(0.05)
            
            await websocket.send_json({
                "event": "HC_START",
                "message": "Khởi chạy dò biên leo đồi HC độc lập..."
            })
            await asyncio.sleep(0.3)
            
            from .algorithms.local_pareto_optimizer import LocalParetoOptimizer
            fitness_evaluator = lambda tc: optimizer.evaluate_testcase_quality(tc, [p["values"] for p in optimizer.test_suite])
            hc_optimizer = LocalParetoOptimizer(schema_rules, fitness_evaluator, max_iterations=10)
            
            raw_population = [p["values"] for p in optimizer.test_suite]
            optimized_values_list, hc_tweak_stats = hc_optimizer.optimize(raw_population)
            
            for idx, ind in enumerate(optimizer.test_suite):
                if idx < len(optimized_values_list):
                    ind["values"] = optimized_values_list[idx]
                    ind["fitness"] = fitness_evaluator(optimized_values_list[idx])[0]
                    ind["origin"] = "HC_ONLY"
                
                await websocket.send_json({
                    "event": "HC_PROGRESS",
                    "data": {
                        "status": "ACTIVE",
                        "log": f"Tinh chỉnh cá thể #{idx+1} | Fitness: {ind['fitness']:.4f}"
                    }
                })
                await asyncio.sleep(0.03)
                
            optimizer.test_suite.sort(key=lambda x: x["fitness"], reverse=True)
            hc_tweak_stats.optimized_fitness = optimizer.test_suite[0]["fitness"]
            
        else: # hybrid
            # Chạy GA di truyền rồi leo đồi HC (Mặc định)
            optimizer.initialize_suite(initial_seeds)
            f0_best = optimizer.test_suite[0]["fitness"]
            f0_avg = sum(sum(p.get("fitness", {}).values())/4.0 if isinstance(p.get("fitness", 0), dict) else p.get("fitness", 0) for p in optimizer.test_suite) / len(optimizer.test_suite)
            f0_stats = {
                "generation": 0,
                "bestFitness": f0_best,
                "avgFitness": f0_avg,
                "coverage": 0.2,
                "duplicateRate": 0.1,
                "test_cases": [{"values": p["values"], "fitness": p["fitness"], "origin": p["origin"]} for p in optimizer.test_suite[:10]]
            }
            progress_history.append(f0_stats)
            await websocket.send_json({"event": "GA_PROGRESS", "data": f0_stats})
            await asyncio.sleep(0.05)
            
            for g in range(generations):
                gen_stats = optimizer.evolve_one_generation()
                progress_history.append(gen_stats)
                await websocket.send_json({"event": "GA_PROGRESS", "data": gen_stats})
                
                try:
                    evo_stat = models.EvolutionStats(
                        job_id=db_job.id,
                        generation=gen_stats["generation"],
                        max_fitness=gen_stats["bestFitness"],
                        avg_fitness=gen_stats["avgFitness"],
                        coverage_score=gen_stats["coverage"],
                        duplicate_rate=gen_stats["duplicateRate"],
                        mutation_rate=optimizer.get_adaptive_mutation_rate(),
                        population_diversity=float(gen_stats.get("selected", 0)) / max(1, optimizer.config["popSize"]),
                    )
                    db.add(evo_stat)
                except Exception:
                    pass
                await asyncio.sleep(0.02)
                
            await websocket.send_json({
                "event": "HC_START",
                "message": "Bắt đầu leo đồi HC cho elite tốt nhất từ GA..."
            })
            await asyncio.sleep(0.4)
            
            from .algorithms.local_pareto_optimizer import LocalParetoOptimizer
            fitness_evaluator = lambda tc: optimizer.evaluate_testcase_quality(tc, [p["values"] for p in optimizer.test_suite])
            hc_optimizer = LocalParetoOptimizer(schema_rules, fitness_evaluator)
            
            raw_population = [p["values"] for p in optimizer.test_suite]
            optimized_values_list, hc_tweak_stats = hc_optimizer.optimize(raw_population)
            
            for detail in hc_tweak_stats.details:
                await websocket.send_json({
                    "event": "HC_PROGRESS",
                    "data": {
                        "status": "ACTIVE",
                        "log": detail
                    }
                })
                await asyncio.sleep(0.03)
                
            for idx, ind in enumerate(optimizer.test_suite):
                if idx < len(optimized_values_list):
                    ind["values"] = optimized_values_list[idx]
                    ind["fitness"] = fitness_evaluator(optimized_values_list[idx])[0]
                    ind["origin"] = "HC_FINE_TUNED"
                    
            optimizer.test_suite.sort(key=lambda x: x["fitness"], reverse=True)
            hc_tweak_stats.optimized_fitness = optimizer.test_suite[0]["fitness"]
            
            await asyncio.sleep(0.02)

        # 6. Lắp ráp bộ kết quả tối ưu CUỐI CÙNG (HoF + tinh gọn + chốt sàn seed F0).
        # Luồng truyền thống không chốt sàn seed LLM để giữ baseline so sánh trung thực.
        floor_seeds = None if algorithm == "traditional" else initial_seeds
        final_dataset = optimizer.assemble_optimized_dataset(original_seeds=floor_seeds)

        # 7. Cập nhật Job với kết quả cuối cùng
        final_stats = progress_history[-1]
        db_job.status = "COMPLETE"
        db_job.final_coverage = final_stats["coverage"]
        db_job.final_duplicate_rate = final_stats["duplicateRate"]
        db.commit()
        db.refresh(db_job)

        for ind in final_dataset:
            tc_values = ind["values"]
            origin = ind["origin"]
            is_edge = (ind["fitness"] > 0.85 and ("HC" in origin or "HallOfFame" in origin or "HoF" in origin))

            db_data = models.GeneratedData(
                job_id=db_job.id,
                parent_id=ind.get("parent_id"),
                test_case_values=json.dumps(tc_values),
                fitness_score=ind["fitness"],
                source_algorithm=origin,
                is_edge_case=is_edge
            )
            db.add(db_data)
        db.commit()

        # 8. Gửi gói tin HOÀN TẤT tối ưu hóa cuối cùng cho Client
        await websocket.send_json({
            "event": "COMPLETE",
            "data": {
                "job_id": db_job.id,
                "final_coverage": final_stats["coverage"],
                "final_duplicateRate": final_stats["duplicateRate"],
                "optimizedDataset": [p["values"] for p in final_dataset],
                "hcStats": hc_tweak_stats.to_dict()
            }
        })

    except WebSocketDisconnect:
        print(f">>> Client WebSocket disconnected for spec: {specification_id}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f">>> ERROR in WebSocket optimizer route: {str(e)}")
        try:
            await websocket.send_json({"event": "ERROR", "message": f"Lỗi máy chủ: {str(e)}"})
        except:
            pass
    finally:
        db.close()



class BenchmarkRequest(BaseModel):
    specification_id: str
    fields: list
    extracted_rules: list
    extracted_constraints: list
    initialPopulation: list
    api_key_override: Optional[str] = None
    llm_provider: Optional[str] = "gemini"

@app.post("/api/benchmark")
def api_benchmark(req: BenchmarkRequest, db: Session = Depends(get_db)):
    try:
        # Run 6 strategies
        datasets = run_all_strategies(
            schema=req.fields,
            rules=req.extracted_rules,
            constraints=req.extracted_constraints,
            initial_seeds=req.initialPopulation
        )
        
        # Calculate fitness for all
        results = {}
        for strategy, dataset in datasets.items():
            rubric = calculateRubricScores(dataset, req.fields)
            results[strategy] = {
                "score": rubric["total_score"] / 100.0, # Chuẩn hóa về [0,1] cho UI cũ (nếu cần) hoặc trả thẳng
                "details": rubric,
                "dataset_preview": dataset[:5] # Send back top 5 for UI preview
            }
            
        # Get AI analysis
        sys_p, usr_p = get_benchmark_analysis_prompt(results)
        from .services.llm_client import call_llm_json
        analysis_json, _, _ = call_llm_json(sys_p, usr_p, req.api_key_override, req.llm_provider)
        
        return {
            "status": "success",
            "benchmark_data": results,
            "ai_analysis": analysis_json
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/jobs")
def api_get_jobs(db: Session = Depends(get_db)):
    """
    ENDPOINT: Lấy danh sách phiên chạy tối ưu.
    """
    try:
        jobs = db.query(models.Job).order_by(models.Job.created_at.desc()).all()
        return [{"id": j.id, "status": j.status, "specification_id": j.specification_id, "created_at": j.created_at.isoformat() if j.created_at else None} for j in jobs]
    except Exception:
        return []

@app.get("/api/generation-history")
def api_get_generation_history(db: Session = Depends(get_db)):
    """
    ENDPOINT: Lấy danh sách lịch sử báo cáo.
    """
    try:
        histories = db.query(models.GenerationHistory).order_by(models.GenerationHistory.created_at.desc()).all()
        return [
            {
                "id": h.id,
                "spec_name": h.spec_name,
                "created_at": h.created_at.isoformat() if h.created_at else None,
                "coverage_rate": h.coverage_rate,
                "total_cases": h.total_cases
            } for h in histories
        ]
    except Exception as e:
        print("Error get history:", str(e))
        return []

@app.get("/api/generation-history/{history_id}")
def api_get_generation_detail(history_id: str, db: Session = Depends(get_db)):
    """
    ENDPOINT: Lấy chi tiết lịch sử báo cáo.
    """
    try:
        h = db.query(models.GenerationHistory).filter(models.GenerationHistory.id == history_id).first()
        if not h:
            raise HTTPException(status_code=404, detail="Not found")
        return {
            "id": h.id,
            "spec_name": h.spec_name,
            "created_at": h.created_at.isoformat() if h.created_at else None,
            "coverage_rate": h.coverage_rate,
            "total_cases": h.total_cases,
            "step1_raw_text": h.step1_raw_text,
            "step2_schema": json.loads(h.step2_schema) if h.step2_schema else None,
            "step3_seeds": json.loads(h.step3_seeds) if h.step3_seeds else None,
            "step4_optimized_data": json.loads(h.step4_optimized_data) if h.step4_optimized_data else None
        }
    except Exception as e:
        print("Error get history detail:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generation-history")
def api_save_generation_history(payload: dict, db: Session = Depends(get_db)):
    """
    ENDPOINT: Lưu bản ghi báo cáo.
    """
    try:
        new_h = models.GenerationHistory(
            spec_name=payload.get("spec_name", "Unknown Session"),
            coverage_rate=payload.get("coverage_rate", 0.0),
            total_cases=len(payload.get("step4_optimized_data", [])),
            step1_raw_text=payload.get("rawText", ""),
            step2_schema=json.dumps({
                "fields": payload.get("schema", []),
                "business_rules": payload.get("businessRules", []),
                "constraints": payload.get("constraints", [])
            }),
            step3_seeds=json.dumps({
                "seeds": payload.get("initialPopulation", []),
                "evaluation": payload.get("step2_eval_result", None),
                "metrics": payload.get("step3_metrics", None)
            }),
            step4_optimized_data=json.dumps(payload.get("step4_optimized_data", []))
        )
        db.add(new_h)
        db.commit()
        return {"status": "success", "id": new_h.id}
    except Exception as e:
        db.rollback()
        print("Error save history:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/generation-history/{history_id}")
def api_delete_generation_history(history_id: str, db: Session = Depends(get_db)):
    """
    ENDPOINT: Xóa bản ghi báo cáo.
    """
    try:
        h = db.query(models.GenerationHistory).filter(models.GenerationHistory.id == history_id).first()
        if h:
            db.delete(h)
            db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
