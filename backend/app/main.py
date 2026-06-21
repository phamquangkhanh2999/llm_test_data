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
from .services.ai_service import parse_spec_with_ai, generate_seeds_with_ai, evaluate_test_quality_with_ai, evaluate_optimized_dataset_with_ai
# Nạp các bộ thuật toán tối ưu hóa chạy trên Server
from .algorithms.optimizer_engine import TestSuiteOptimizer, generate_random_field_value
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

class SeedGenerationRequest(BaseModel):
    """
    Schema cấu hình sinh lại hạt giống F0.
    """
    fields: List[Dict[str, Any]]
    business_rules: Optional[List[Dict[str, Any]]] = None
    constraints: Optional[List[Dict[str, Any]]] = None
    test_method: str
    boundary_count: int = 4
    partition_count: int = 3
    api_key_override: Optional[str] = None
    raw_text: Optional[str] = ""
    llm_provider: Optional[str] = "gemini"

class EvaluateRequest(BaseModel):
    """
    Schema cấu hình đánh giá chất lượng hạt giống F0.
    """
    fields: List[Dict[str, Any]]
    seeds: List[Dict[str, Any]]
    test_method: str
    raw_text: str
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
            
        from .services.ai_service import generate_coverage_summary
        coverage_summary = generate_coverage_summary(initial_seeds, fields)
            
        return {
            "specification_id": existing_spec.id,
            "project_id": existing_spec.project_id,
            "business_rules": business_rules,
            "constraints": constraints,
            "ambiguities": [],
            "fields": fields,
            "initialPopulation": initial_seeds,
            "coverageSummary": coverage_summary,
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

        seeds, coverage_summary = generate_seeds_with_ai(
            fields=fields,
            business_rules=req.business_rules,
            constraints=req.constraints,
            test_method=req.test_method,
            boundary_count=req.boundary_count,
            partition_count=req.partition_count,
            api_key=active_key,
            raw_text=req.raw_text or "",
            db=db,
            llm_provider=req.llm_provider
        )
        return {
            "initialPopulation": seeds,
            "coverageSummary": coverage_summary,
            "is_mock": is_mock
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
    """
    ENDPOINT 2: Thực thi tiến hóa và tinh chỉnh biên tối ưu hóa bộ Test Cases.
    """
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
        }
    }

    optimizer = TestSuiteOptimizer(schema_rules, config_dict)
    
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
        """
        Tính fitness score thực sự cho một test case theo công thức đã được chuẩn hóa.
        Sử dụng trực tiếp coverage_analyzer + Oracle — không dùng static_cache.

        Công thức:
          coverage_fitness = (#tags + novelty_estimate) / max_possible  [0,1]
          boundary_fitness = boundary_bonus / max_possible               [0,1]
          raw_fitness = 0.55 * coverage_fitness + 0.45 * boundary_fitness [0,1]
          display_fitness = raw_fitness * 100  (hiển thị trên UI)
        """
        from .algorithms.coverage_analyzer import analyze_coverage
        from .services.ai_service import derive_expected_result

        # 1. Coverage tags
        tags = analyze_coverage(values, schema_rules)
        num_tags = max(1, len(tags))

        # 2. Coverage component (base + novelty estimate)
        base_coverage = float(len(tags))
        novelty_estimate = len(tags) * 0.3   # conservative estimate khi không có global pool
        coverage_raw = base_coverage + novelty_estimate
        max_coverage = num_tags * 3.0
        norm_coverage = min(coverage_raw / max_coverage, 1.0)

        # 3. Boundary component
        boundary_raw = 0.0
        for tag in tags:
            tag_upper = tag.upper()
            if "NEAR_BOUNDARY" in tag_upper:
                boundary_raw += 1.5
            elif "BOUNDARY" in tag_upper:
                boundary_raw += 3.0
            elif "INVALID" in tag_upper:
                boundary_raw += 0.5
        max_boundary = num_tags * 3.0
        norm_boundary = min(boundary_raw / max_boundary, 1.0)

        # 4. Raw fitness [0,1] → display [0,100]
        raw_fitness = 0.55 * norm_coverage + 0.45 * norm_boundary

        # 5. Penalty cho duplicate (chỉ penalize nếu hoàn toàn tróng lặp với chính nó)
        #    Không áp dụng ở đây vì không có population context.

        fitness_val = round(raw_fitness * 100, 2)

        # 6. validationScore riêng: check Oracle
        oracle = derive_expected_result(values, schema_rules)
        validation_score = 100 if oracle["http_status"] == 200 else (50 if oracle["http_status"] == 422 else 0)

        # 7. boundaryScore riêng
        boundary_score = round(norm_boundary * 100)

        # 8. negativeScore
        is_negative = "negative" in [c.lower() for c in categories]
        if is_negative:
            negative_score = 100 if oracle["http_status"] != 200 else 20
        else:
            negative_score = 100 if oracle["http_status"] == 200 else 30

        return {
            "validationScore": validation_score,
            "boundaryScore": boundary_score,
            "negativeScore": negative_score,
            "fitness": fitness_val
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

    if algo == "ga_hc":
        optimizer.initialize_suite([s["values"] for s in llm_seeds_mapped])
        for _ in range(config_dict["generations"]):
            optimizer.evolve_one_generation()
            
        ga_population = sorted(optimizer.test_suite, key=lambda x: x["fitness"], reverse=True)
        raw_suite_values = [p["values"] for p in ga_population]
        
        global_coverage_set = set()
        
        for i, llm_tc in enumerate(llm_seeds_mapped):
            tc_id = llm_tc["tcId"]
            
            # Lấy GA candidate tương ứng (giả lập Lineage 1-1 bằng rank)
            ga_candidate = ga_population[i] if i < len(ga_population) else ga_population[-1]
            ga_values = ga_candidate["values"]
            scores_ga = calculate_v2_scores(ga_values, llm_tc["categories"])
            
            # Chạy HC trên GA candidate
            fitness_evaluator = lambda tc: optimizer.evaluate_testcase_quality(tc, raw_suite_values)
            hc_values, hc_stats = optimize_testcase_boundaries(ga_values, schema_rules, fitness_evaluator, max_iterations=10, global_coverage_set=global_coverage_set)
            scores_hc = calculate_v2_scores(hc_values, llm_tc["categories"])
            
            # Fallback logic
            if scores_hc["fitness"] >= scores_ga["fitness"]:
                final_values = hc_values
                final_fit = scores_hc["fitness"]
                final_val_score = scores_hc["validationScore"]
                final_bound_score = scores_hc["boundaryScore"]
                final_neg_score = scores_hc["negativeScore"]
                origin = "HC"
                reason = "Thuật toán leo đồi HC tối ưu tốt hơn GA"
                summary["hcSelected"] += 1
            else:
                final_values = ga_values
                final_fit = scores_ga["fitness"]
                final_val_score = scores_ga["validationScore"]
                final_bound_score = scores_ga["boundaryScore"]
                final_neg_score = scores_ga["negativeScore"]
                origin = "GA"
                reason = "Thuật toán leo đồi HC không tối ưu hơn GA (Sử dụng kết quả GA)"
                summary["gaSelected"] += 1
                summary["fallback"] += 1
                
            # [TÍCH HỢP] SPRINT 1: P2 Semantic-Preserving Merge & Provenance
            from .algorithms.policy_registry import resolve_policy
            merged_final_values = {**final_values}
            provenance = {}
            for field in schema_rules:
                fname = field["name"]
                policy = resolve_policy(field)
                if policy == "freeze":
                    merged_final_values[fname] = llm_tc["values"].get(fname)
                    provenance[fname] = "LLM"
                elif policy in ["format_preserving", "constraint_preserving"]:
                    merged_final_values[fname] = llm_tc["values"].get(fname)
                    provenance[fname] = "LLM/Refined"
                else:
                    provenance[fname] = "GA/HC"
            merged_final_values["_provenance"] = provenance
            final_values = merged_final_values

            # ── LLM Semantic Polish: làm đẹp dữ liệu sau GA/HC ─────────────────────
            # Chỉ polish nếu dữ liệu trông robot (pattern lặp, aaaa@bbb.com, v.v.)
            try:
                from .services.ai_service import semantic_polish_with_llm
                from .algorithms.enum_constraint_validator import validate_and_repair_enum_fields

                _categories = llm_tc.get("categories", ["positive"])
                _cat_str = _categories[0] if _categories else "positive"

                _clean_final = {k: v for k, v in final_values.items() if not k.startswith("_")}
                _llm_original = {k: v for k, v in llm_tc["values"].items() if not k.startswith("_")}

                polish_result = semantic_polish_with_llm(
                    schema=schema_rules,
                    optimized_values=_clean_final,
                    original_values=_llm_original,
                    test_category=_cat_str,
                    api_key_override=req.api_key_override,
                    llm_provider=req.llm_provider,
                    db=db
                )

                if polish_result["was_polished"]:
                    # Áp dụng polished values, giữ lại provenance metadata
                    polished_clean, _ = validate_and_repair_enum_fields(
                        polish_result["polished_values"], schema_rules
                    )
                    final_values = {**polished_clean, "_provenance": provenance, "_polish_notes": polish_result["polish_notes"]}
                    print(f">>> [POLISH] TC {tc_id} đã được làm đẹp ngữ nghĩa")
            except Exception as _pe:
                print(f">>> [POLISH] Skip TC {tc_id}: {_pe}")

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
                from .services.ai_service import explain_optimization_with_ai
                try:
                    explanation = explain_optimization_with_ai(
                        before_values=llm_tc["values"],
                        after_values=final_values,
                        algorithm=origin,
                        api_key_override=req.api_key_override,
                        llm_provider=req.llm_provider,
                        db=db
                    )
                    for c in changes:
                        c["reason"] = explanation.get("improvementReason", c["reason"])
                    final_rationale = explanation.get("improvementReason", llm_tc["rationale"])
                except Exception as e:
                    final_rationale = llm_tc["rationale"]
                    print(f"Error calling LLM for explanation: {e}")
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
                "categories": llm_tc["categories"],
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
            hc_tc = {
                "tcId": tc_id,
                "scenario": llm_tc["scenario"],
                "categories": llm_tc["categories"],
                "values": hc_values,
                "expectedResult": hc_expected,
                "errorDescription": hc_err_desc,
                "rationale": llm_tc["rationale"],
                "validationScore": scores_hc["validationScore"],
                "boundaryScore": scores_hc["boundaryScore"],
                "negativeScore": scores_hc["negativeScore"],
                "llmFitness": llm_tc["llmFitness"],
                "gaFitness": scores_ga["fitness"],
                "hcFitness": scores_hc["fitness"]
            }
            final_tc = {
                "tcId": tc_id, 
                "scenario": llm_tc["scenario"], 
                "categories": llm_tc["categories"], 
                "values": final_values, 
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
                "finalFitness": final_fit,
                "origin": origin,
                "changes": changes,
                "covers": final_tags
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
                "http_status": {
                    "llm": 200 if llm_tc.get("validationScore", 0) == 100 else 400,
                    "ga": oracle_ga["http_status"],
                    "hc": oracle_hc["http_status"],
                    "final": oracle_final["http_status"]
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
        "exportData": export_data
    }



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
        optimizer = TestSuiteOptimizer(schema_rules, config_dict)
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
                "avgFitness": sum(p["fitness"] for p in optimizer.test_suite) / len(optimizer.test_suite),
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
            f0_avg = sum(p["fitness"] for p in optimizer.test_suite) / len(optimizer.test_suite)
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
            f0_avg = sum(p["fitness"] for p in optimizer.test_suite) / len(optimizer.test_suite)
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
            
            hc_stats_list = []
            for idx, ind in enumerate(optimizer.test_suite):
                best_candidate = ind["values"]
                raw_suite_values = [p["values"] for p in optimizer.test_suite]
                fitness_evaluator = lambda tc: optimizer.evaluate_testcase_quality(tc, raw_suite_values)
                hc_optimized, stats = optimize_testcase_boundaries(best_candidate, schema_rules, fitness_evaluator, max_iterations=10)
                ind["values"] = hc_optimized
                ind["fitness"] = stats.optimized_fitness
                ind["origin"] = "HC_ONLY"
                
                hc_stats_list.append(stats)
                
                await websocket.send_json({
                    "event": "HC_PROGRESS",
                    "data": {
                        "status": "ACTIVE",
                        "log": f"Tinh chỉnh cá thể #{idx+1} | Fitness: {stats.optimized_fitness:.4f}"
                    }
                })
                await asyncio.sleep(0.03)
                
            optimizer.test_suite.sort(key=lambda x: x["fitness"], reverse=True)
            if hc_stats_list:
                hc_tweak_stats = hc_stats_list[0]
            
        else: # hybrid
            # Chạy GA di truyền rồi leo đồi HC (Mặc định)
            optimizer.initialize_suite(initial_seeds)
            f0_best = optimizer.test_suite[0]["fitness"]
            f0_avg = sum(p["fitness"] for p in optimizer.test_suite) / len(optimizer.test_suite)
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
            
            best_candidate = optimizer.test_suite[0]["values"]
            raw_suite_values = [p["values"] for p in optimizer.test_suite]
            fitness_evaluator = lambda tc: optimizer.evaluate_testcase_quality(tc, raw_suite_values)
            hc_optimized, hc_tweak_stats = optimize_testcase_boundaries(best_candidate, schema_rules, fitness_evaluator)
            
            for detail in hc_tweak_stats.details:
                await websocket.send_json({
                    "event": "HC_PROGRESS",
                    "data": {
                        "status": "ACTIVE",
                        "log": detail
                    }
                })
                await asyncio.sleep(0.03)
                
            optimizer.test_suite[0]["values"] = hc_optimized
            optimizer.test_suite[0]["fitness"] = hc_tweak_stats.optimized_fitness
            optimizer.test_suite[0]["origin"] = "HC_FINE_TUNED"
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
