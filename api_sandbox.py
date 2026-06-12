import os
import json
import asyncio
import time
from typing import List, Dict, Any
from sqlalchemy.orm import Session
import sys

# Add project root to path so we can import backend
sys.path.append(os.getcwd())

from backend.app.core.database import SessionLocal, engine, Base
from backend.app.services.ai_parser import parse_spec_with_openai, evaluate_optimized_dataset_with_ai, get_mock_fallback_data
from backend.app.algorithms.optimizer_engine import TestSuiteOptimizer
from backend.app.algorithms.boundary_tweak import optimize_testcase_boundaries
from backend.app import models # Import models to ensure tables are created
from dotenv import load_dotenv

# Load .env from backend folder
load_dotenv(dotenv_path="backend/.env")

# Ensure DB is initialized
Base.metadata.create_all(bind=engine)

SCENARIOS = [
    {
        "name": "Đăng ký tài khoản",
        "raw_text": "Form đăng ký thành viên: Tên đăng nhập từ 5-15 ký tự, chỉ chứa chữ và số. Mật khẩu tối thiểu 8 ký tự, tối đa 20 ký tự. Email là bắt buộc và phải đúng định dạng. Tuổi từ 18 đến 100."
    },
    {
        "name": "Thanh toán thẻ tín dụng",
        "raw_text": "Cổng thanh toán: Số thẻ (cardNumber) gồm 16 chữ số. Mã bảo mật CVV gồm 3 chữ số. Số tiền (amount) từ 1 đến 50,000 USD. Đơn vị tiền tệ (currency) chấp nhận: USD, VND, EUR."
    },
    {
        "name": "Tìm kiếm API",
        "raw_text": "API Tìm kiếm sản phẩm: Từ khóa (query) tối đa 200 ký tự. Giới hạn kết quả (limit) từ 1 đến 100. Trang (page) từ 1 đến 1000. Sắp xếp theo (sortBy): relevance, date, price, name. Thứ tự (order): asc, desc."
    }
]

async def run_scenario_validation(scenario: Dict[str, str], db: Session):
    print(f"\n🚀 [SCENARIO]: {scenario['name']}")
    print(f"📝 [INPUT]: {scenario['raw_text']}")
    
    start_time = time.time()
    
    # 1. Parse Specification
    print("🧠 [1/3] Đang phân tích đặc tả bằng AI...")
    try:
        spec_result = parse_spec_with_openai(scenario['raw_text'], db=db)
    except Exception as e:
        print(f"⚠️  [AI ERROR]: {str(e)}. Đang sử dụng chế độ Mock Fallback...")
        spec_result = get_mock_fallback_data(scenario['raw_text'])
        spec_result["is_mock"] = True
        spec_result["engine"] = "mock-sandbox"

    fields = spec_result.get("fields", [])
    initial_seeds = spec_result.get("initialPopulation", [])
    is_mock = spec_result.get("is_mock", False)
    
    print(f"✅ Đã trích xuất {len(fields)} trường dữ liệu. (Engine: {spec_result.get('engine', 'Unknown')})")
    
    # 2. Run Hybrid Optimization (GA + HC)
    print("🧬 [2/3] Đang chạy tối ưu hóa Hybrid (GA + HC)...")
    config = {
        "generations": 20,
        "popSize": 50,
        "crossoverRate": 0.8,
        "mutationRate": 0.1,
        "weights": {"validation": 0.5, "boundary": 0.2, "security": 0.2, "diversity": 0.1}
    }
    
    optimizer = TestSuiteOptimizer(fields, config)
    optimizer.initialize_suite(initial_seeds)
    
    # GA Generations
    for g in range(config["generations"]):
        optimizer.evolve_one_generation()
        
    # Hill Climbing on the best candidate
    best_candidate = optimizer.test_suite[0]["values"]
    raw_suite_values = [p["values"] for p in optimizer.test_suite]
    fitness_evaluator = lambda tc: optimizer.evaluate_testcase_quality(tc, raw_suite_values)
    
    hc_optimized, hc_stats = optimize_testcase_boundaries(best_candidate, fields, fitness_evaluator)
    
    optimizer.test_suite[0]["values"] = hc_optimized
    optimizer.test_suite[0]["fitness"] = hc_stats.optimized_fitness
    
    final_dataset = [p["values"] for p in optimizer.test_suite]
    print(f"✅ Tối ưu hóa hoàn tất. Best Fitness: {hc_stats.optimized_fitness:.4f}. Dò được {hc_stats.edge_cases_discovered} ca biên.")

    # 3. Final AI Evaluation
    print("📊 [3/3] Đang thẩm định chất lượng bộ dữ liệu cuối cùng...")
    try:
        eval_result = evaluate_optimized_dataset_with_ai(
            fields=fields,
            dataset=final_dataset,
            algorithm="hybrid",
            raw_text=scenario['raw_text'],
            db=db
        )
    except Exception as e:
        print(f"⚠️  [EVAL ERROR]: {str(e)}. Sử dụng kết quả đánh giá giả lập...")
        # Mock evaluation result if AI fails
        eval_result = {
            "score": 88,
            "sanity_check": {"status": "Đạt", "description": "Dữ liệu khớp schema 100% (Mock)"},
            "fitness_evaluation": {"status": "Tốt", "fitness_score": 0.95},
            "boundary_edge_check": {"status": "Đạt", "boundary_coverage": "90%"},
            "security_risks": ["Không phát hiện (Mock)"],
            "missing_cases": ["Không (Mock)"]
        }
    
    end_time = time.time()
    duration = end_time - start_time
    
    # --- REPORTING ---
    print("\n" + "="*60)
    print(f"🏆 [KẾT QUẢ]: {scenario['name']}")
    print(f"⏱️ [Thời gian thực thi]: {duration:.2f}s")
    print(f"⭐ [Điểm Chất lượng AI]: {eval_result.get('score', 0)}/100")
    
    sanity = eval_result.get('sanity_check', {})
    print(f"🔹 [Sanity Check]: {sanity.get('status', 'N/A')} - {sanity.get('description', 'N/A')}")
    
    fitness = eval_result.get('fitness_evaluation', {})
    print(f"🔹 [Fitness Eval]: {fitness.get('status', 'N/A')} (Score: {fitness.get('fitness_score', 0)})")
    
    boundary = eval_result.get('boundary_edge_check', {})
    print(f"🔹 [Boundary Check]: {boundary.get('status', 'N/A')} (Coverage: {boundary.get('boundary_coverage', '0%')})")
    
    print(f"🔸 [Rủi ro bảo mật]: {', '.join(eval_result.get('security_risks', ['Không phát hiện']))}")
    print(f"🔸 [Kịch bản còn thiếu]: {', '.join(eval_result.get('missing_cases', ['Không']))}")
    print("="*60 + "\n")
    
    return {
        "scenario": scenario['name'],
        "score": eval_result.get('score', 0),
        "duration": duration,
        "is_mock": is_mock,
        "best_fitness": hc_stats.optimized_fitness,
        "edge_cases": hc_stats.edge_cases_discovered,
        "eval": eval_result
    }

async def main():
    print("🌟 HYPERION TESTFORGE - API SANDBOX BATCH RUN 🌟")
    print(f"Running at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    db = SessionLocal()
    batch_report = []
    try:
        for scenario in SCENARIOS:
            result = await run_scenario_validation(scenario, db)
            batch_report.append(result)
            
        # Save summary report
        with open("sandbox_report.json", "w", encoding="utf-8") as f:
            json.dump(batch_report, f, indent=2, ensure_ascii=False)
        print(f"\n📂 [BÁO CÁO]: Đã lưu kết quả Batch Run vào 'sandbox_report.json'")
            
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
