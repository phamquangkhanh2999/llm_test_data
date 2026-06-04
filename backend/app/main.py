from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import json
import re
import sys
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
from .services.ai_parser import parse_spec_with_openai, generate_seeds, evaluate_test_quality_with_ai
# Nạp các bộ thuật toán tối ưu hóa chạy trên Server
from .algorithms.optimizer_engine import TestSuiteOptimizer
from .algorithms.boundary_tweak import optimize_testcase_boundaries

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

class OptimizeWeights(BaseModel):
    """
    Trọng số cấu hình hàm đánh giá chất lượng Test Case.
    """
    validation: float
    boundary: float
    security: float
    diversity: float

class OptimizeRequest(BaseModel):
    """
    Schema cấu hình chạy tiến hóa và tối ưu hóa biên cho bộ test.
    """
    specification_id: str
    generations: int
    popSize: int
    crossoverRate: float
    mutationRate: float
    weights: OptimizeWeights
    initial_seeds: List[Dict[str, Any]] # Danh sách F0 mẫu

class SeedGenerationRequest(BaseModel):
    """
    Schema cấu hình sinh lại hạt giống F0.
    """
    fields: List[Dict[str, Any]]
    test_method: str
    boundary_count: int = 4
    partition_count: int = 3
    api_key_override: Optional[str] = None
    raw_text: Optional[str] = ""

class EvaluateRequest(BaseModel):
    """
    Schema cấu hình đánh giá chất lượng hạt giống F0.
    """
    fields: List[Dict[str, Any]]
    seeds: List[Dict[str, Any]]
    test_method: str
    raw_text: str
    api_key_override: Optional[str] = None

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
            fields = json.loads(existing_spec.parsed_schema)
        except:
            fields = []
        try:
            initial_seeds = json.loads(existing_spec.initial_seeds) if existing_spec.initial_seeds else []
        except:
            initial_seeds = []
            
        return {
            "specification_id": existing_spec.id,
            "project_id": existing_spec.project_id,
            "fields": fields,
            "initialPopulation": initial_seeds,
            "cached": True
        }

    try:
        # 1. Gọi OpenAI API (hoặc bộ dự phòng Fallback) xử lý phân tích ngữ nghĩa
        ai_result = parse_spec_with_openai(req.raw_text, req.api_key_override, db=db)
    except ValueError as ve:
        if str(ve).startswith("API_KEY_ERROR"):
            print(f">>> ERROR: {str(ve)}")
            raise HTTPException(status_code=400, detail=f"Lỗi API Key: {str(ve).replace('API_KEY_ERROR: ', '')}")
        raise ve

    # Nếu đã tồn tại bản ghi trong CSDL và yêu cầu phân tích lại, cập nhật đè bản ghi cũ
    if existing_spec:
        existing_spec.parsed_schema = json.dumps(ai_result.get("fields", []))
        existing_spec.initial_seeds = json.dumps(ai_result.get("initialPopulation", []))
        db.commit()
        db.refresh(existing_spec)
        return {
            "specification_id": existing_spec.id,
            "project_id": existing_spec.project_id,
            "fields": ai_result.get("fields", []),
            "initialPopulation": ai_result.get("initialPopulation", []),
            "is_mock": ai_result.get("is_mock", False),
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
        parsed_schema=json.dumps(ai_result.get("fields", [])), # Chuyển mảng Python list sang chuỗi JSON lưu vào CSDL
        initial_seeds=json.dumps(ai_result.get("initialPopulation", [])) # Lưu lại F0 để tiết kiệm token khi gọi lại
    )
    db.add(db_spec)
    db.commit()
    db.refresh(db_spec)

    # 4. Trả về kết quả hoàn chỉnh cho màn hình React sử dụng
    return {
        "specification_id": db_spec.id,
        "project_id": db_project.id,
        "fields": ai_result.get("fields", []),
        "initialPopulation": ai_result.get("initialPopulation", []),
        "is_mock": ai_result.get("is_mock", False)
    }


@app.post("/api/generate-seeds")
def api_generate_seeds(req: SeedGenerationRequest, db: Session = Depends(get_db)):
    """
    ENDPOINT 1.5: Tái sinh tập hạt giống F0 dựa trên phương pháp kiểm thử đã chọn.
    """
    try:
        active_key = req.api_key_override if req.api_key_override else (os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY"))
        is_mock = not active_key or active_key.strip() == ""
        seeds = generate_seeds(
            fields=req.fields,
            test_method=req.test_method,
            boundary_count=req.boundary_count,
            partition_count=req.partition_count,
            api_key=req.api_key_override,
            raw_text=req.raw_text or "",
            db=db
        )
        return {
            "initialPopulation": seeds,
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
            db=db
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
    Nhận cấu hình, chạy thuật toán GA trên Server qua N thế hệ, kích hoạt leo đồi HC
    cho ca tốt nhất để sinh biên độc hại sâu sắc, lưu kết quả tối ưu vào SQLite và trả về.
    """
    # 1. Truy vấn JSON Schema quy tắc trường từ cơ sở dữ liệu
    db_spec = db.query(models.Specification).filter(models.Specification.id == req.specification_id).first()
    if not db_spec:
        raise HTTPException(status_code=404, detail="Không tìm thấy đặc tả nghiệp vụ tương ứng!")

    schema_rules = json.loads(db_spec.parsed_schema)

    # 2. Khởi tạo bộ tối ưu hóa TestSuiteOptimizer chạy bằng Python trên Server
    config_dict = {
        "generations": req.generations,
        "popSize": req.popSize,
        "crossoverRate": req.crossoverRate,
        "mutationRate": req.mutationRate,
        "weights": {
            "validation": req.weights.validation,
            "boundary": req.weights.boundary,
            "security": req.weights.security,
            "diversity": req.weights.diversity
        }
    }

    optimizer = TestSuiteOptimizer(schema_rules, config_dict)
    optimizer.initialize_suite(req.initial_seeds)

    # Mảng lưu lịch sử điểm qua từng thế hệ phục vụ vẽ biểu đồ Recharts
    progress_history = []
    
    # Lưu thế hệ F0 ban đầu
    f0_best = optimizer.test_suite[0]["fitness"]
    f0_avg = sum(p["fitness"] for p in optimizer.test_suite) / len(optimizer.test_suite)
    progress_history.append({
        "generation": 0,
        "bestFitness": f0_best,
        "avgFitness": f0_avg,
        "coverage": 0.2,
        "duplicateRate": 0.1,
        "test_cases": [
            {"values": p["values"], "fitness": p["fitness"], "origin": p["origin"]}
            for p in optimizer.test_suite[:10]
        ]
    })

    # 3. Vòng lặp tiến hóa qua từng thế hệ (GA generations loops)
    for g in range(req.generations):
        gen_stats = optimizer.evolve_one_generation()
        progress_history.append(gen_stats)

    # 4. Kích hoạt tối ưu tinh chỉnh biên cục bộ (Hill Climbing) trên ca test xuất sắc nhất F_final
    best_candidate = optimizer.test_suite[0]["values"]
    raw_suite_values = [p["values"] for p in optimizer.test_suite]
    
    # Định nghĩa hàm callback chấm điểm fitness cục bộ dựa trên suite hiện tại
    fitness_evaluator = lambda tc: optimizer.evaluate_testcase_quality(tc, raw_suite_values)
    
    # Tinh chỉnh ca test biên
    hc_optimized, hc_tweak_stats = optimize_testcase_boundaries(best_candidate, schema_rules, fitness_evaluator)

    # Thay thế ca test đầu tiên tốt nhất bằng bản ghi đã được leo đồi tinh chỉnh
    optimizer.test_suite[0]["values"] = hc_optimized
    optimizer.test_suite[0]["fitness"] = hc_tweak_stats.optimized_fitness
    optimizer.test_suite[0]["origin"] = "HC_FINE_TUNED"

    # 5. Lưu phiên chạy Job này vào Cơ sở dữ liệu SQLite
    final_stats = progress_history[-1]
    db_job = models.Job(
        specification_id=req.specification_id,
        status="COMPLETE",
        algorithm_config=json.dumps(config_dict),
        final_coverage=final_stats["coverage"],
        final_duplicate_rate=final_stats["duplicateRate"]
    )
    db.add(db_job)
    db.commit()
    db.refresh(db_job)

    # 6. Lưu toàn bộ các Test Cases tối ưu hóa vừa sinh ra vào bảng generated_data trong CSDL SQLite
    # Đánh dấu các ca test được nhúng mã độc hoặc chạm đúng biên
    security_keywords = ["' or", '" or', "--", "union", "select", "<script"]
    for ind in optimizer.test_suite:
        tc_values = ind["values"]
        
        # Nhận diện xem có phải ca biên đặc biệt / độc hại không
        is_security = any(any(kw in str(val).lower() for kw in security_keywords) for val in tc_values.values())
        is_edge = is_security or (ind["fitness"] > 0.85 and "Tweak" in ind["origin"])

        db_data = models.GeneratedData(
            job_id=db_job.id,
            test_case_values=json.dumps(tc_values),
            fitness_score=ind["fitness"],
            source_algorithm=ind["origin"],
            is_edge_case=is_edge
        )
        db.add(db_data)
    db.commit()

    # 7. Trả về kết quả tối ưu hoàn chỉnh cho React hiển thị trực quan
    return {
        "job_id": db_job.id,
        "final_coverage": final_stats["coverage"],
        "final_duplicateRate": final_stats["duplicateRate"],
        "optimizedDataset": [p["values"] for p in optimizer.test_suite],
        "progressHistory": progress_history,
        "hcStats": hc_tweak_stats.to_dict()
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
        
        generations = int(req_data.get("generations", 60))
        pop_size = int(req_data.get("popSize", 100))
        crossover_rate = float(req_data.get("crossoverRate", 0.8))
        mutation_rate = float(req_data.get("mutationRate", 0.15))
        weights_data = req_data.get("weights", {"validation": 0.5, "boundary": 0.2, "security": 0.2, "diversity": 0.1})
        initial_seeds = req_data.get("initial_seeds", [])
        
        # 2. Truy vấn JSON Schema quy tắc trường từ cơ sở dữ liệu SQLite
        db_spec = db.query(models.Specification).filter(models.Specification.id == specification_id).first()
        if not db_spec:
            await websocket.send_json({"event": "ERROR", "message": "Không tìm thấy đặc tả nghiệp vụ tương ứng!"})
            await websocket.close()
            return

        schema_rules = json.loads(db_spec.parsed_schema)

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
        optimizer.initialize_suite(initial_seeds)

        progress_history = []
        
        # Lưu và truyền phát thế hệ F0 ban đầu
        f0_best = optimizer.test_suite[0]["fitness"]
        f0_avg = sum(p["fitness"] for p in optimizer.test_suite) / len(optimizer.test_suite)
        f0_stats = {
            "generation": 0,
            "bestFitness": f0_best,
            "avgFitness": f0_avg,
            "coverage": 0.2,
            "duplicateRate": 0.1,
            "test_cases": [
                {"values": p["values"], "fitness": p["fitness"], "origin": p["origin"]}
                for p in optimizer.test_suite[:10]
            ]
        }
        progress_history.append(f0_stats)
        
        # Gửi gói tin thế hệ F0
        await websocket.send_json({
            "event": "GA_PROGRESS",
            "data": f0_stats
        })
        await asyncio.sleep(0.05)

        # 4. Vòng lặp tiến hóa qua từng thế hệ (GA generations loops)
        for g in range(generations):
            gen_stats = optimizer.evolve_one_generation()
            progress_history.append(gen_stats)

            # Gửi gói tin tiến độ thế hệ di truyền qua kết nối WebSocket thời gian thực
            await websocket.send_json({
                "event": "GA_PROGRESS",
                "data": gen_stats
            })

            # Lưu vết evolution stats cho thế hệ này
            try:
                evo_stat = models.EvolutionStats(
                    job_id=db_job.id,
                    generation=gen_stats["generation"],
                    max_fitness=gen_stats["bestFitness"],
                    avg_fitness=gen_stats["avgFitness"],
                    coverage_score=gen_stats["coverage"],
                    duplicate_rate=gen_stats["duplicateRate"],
                    mutation_rate=optimizer.get_adaptive_mutation_rate(),
                )
                db.add(evo_stat)
            except Exception:
                pass
            # Tạm dừng rất ngắn để client render hoạt ảnh mượt mà và tránh nghẽn luồng
            await asyncio.sleep(0.02)

        # 5. Kích hoạt tối ưu tinh chỉnh biên cục bộ (Hill Climbing)
        await websocket.send_json({
            "event": "HC_START",
            "message": "Bắt đầu tinh chỉnh dò biên cục bộ (Hill Climbing)..."
        })
        await asyncio.sleep(0.4)

        best_candidate = optimizer.test_suite[0]["values"]
        raw_suite_values = [p["values"] for p in optimizer.test_suite]
        fitness_evaluator = lambda tc: optimizer.evaluate_testcase_quality(tc, raw_suite_values)
        
        # Tinh chỉnh ca test biên
        hc_optimized, hc_tweak_stats = optimize_testcase_boundaries(best_candidate, schema_rules, fitness_evaluator)

        # Truyền phát từng bước tinh chỉnh của leo đồi về cho terminal log của Client
        for detail in hc_tweak_stats.details:
            await websocket.send_json({
                "event": "HC_PROGRESS",
                "data": {
                    "status": "ACTIVE",
                    "log": detail
                }
            })
            await asyncio.sleep(0.03)

        # Thay thế ca tốt nhất bằng ca sau khi leo đồi
        optimizer.test_suite[0]["values"] = hc_optimized
        optimizer.test_suite[0]["fitness"] = hc_tweak_stats.optimized_fitness
        optimizer.test_suite[0]["origin"] = "HC_FINE_TUNED"

        # 6. Cập nhật Job với kết quả cuối cùng
        final_stats = progress_history[-1]
        db_job.status = "COMPLETE"
        db_job.final_coverage = final_stats["coverage"]
        db_job.final_duplicate_rate = final_stats["duplicateRate"]
        db.commit()
        db.refresh(db_job)

        # 7. Lưu tất cả các Test Cases tối ưu hóa vào bảng generated_data
        security_keywords = ["' or", '\" or', "--", "union", "select", "<script"]
        for ind in optimizer.test_suite:
            tc_values = ind["values"]
            is_security = any(any(kw in str(val).lower() for kw in security_keywords) for val in tc_values.values())
            is_edge = is_security or (ind["fitness"] > 0.85 and "Tweak" in ind["origin"])

            db_data = models.GeneratedData(
                job_id=db_job.id,
                test_case_values=json.dumps(tc_values),
                fitness_score=ind["fitness"],
                source_algorithm=ind["origin"],
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
                "optimizedDataset": [p["values"] for p in optimizer.test_suite],
                "hcStats": hc_tweak_stats.to_dict()
            }
        })

    except WebSocketDisconnect:
        print(f">>> Client WebSocket disconnected for spec: {specification_id}")
    except Exception as e:
        print(f">>> ERROR in WebSocket optimizer route: {str(e)}")
        try:
            await websocket.send_json({"event": "ERROR", "message": f"Lỗi máy chủ: {str(e)}"})
        except:
            pass
    finally:
        db.close()

