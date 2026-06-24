import random
import time
from .mutation_planner import MutationPlanner, MutationExecutor
from .fitness_engine import FitnessEngine

class BoundaryTweakStats:
    def __init__(self, original_fitness, optimized_fitness, tweaks_count,
                 edge_cases_discovered, details, restarts_count=0):
        self.original_fitness = original_fitness
        self.optimized_fitness = optimized_fitness
        self.tweaks_count = tweaks_count
        self.edge_cases_discovered = edge_cases_discovered
        self.details = details
        self.restarts_count = restarts_count

    def to_dict(self):
        return {
            "originalFitness": self.original_fitness,
            "optimizedFitness": self.optimized_fitness,
            "tweaksCount": self.tweaks_count,
            "edgeCasesDiscovered": self.edge_cases_discovered,
            "details": self.details,
            "restartsCount": self.restarts_count
        }

def optimize_testcase_boundaries(test_case: dict, schema: list, fitness_evaluator=None, max_iterations: int = 15, global_coverage_set=None, llm_provider="gemini", api_key_override=None, categories=None) -> tuple:
    """
    HC Semantic Navigator: 
    Dò biên tuần tự theo các bước nhảy có định hướng (Sử dụng Mutation Planner).
    """
    random.seed(int(time.time() * 1000) % (2**32))
    
    if categories is None:
        categories = ["positive"]

    optimized = dict(test_case)
    try:
        if fitness_evaluator:
            current_fitness = fitness_evaluator(optimized)
        else:
            current_fitness_res = FitnessEngine.evaluate(optimized, schema, categories)
            current_fitness = current_fitness_res.fitness
    except:
        return optimized, BoundaryTweakStats(0, 0, 0, 0, ["Error evaluating fitness"])
        
    original_fitness = current_fitness
    tweaks_count = 0
    edge_cases_discovered = 0
    details = [f"Khởi động HC Semantic Navigation: {original_fitness:.4f}"]

    iteration = 0
    
    while iteration < max_iterations:
        iteration += 1
        
        try:
            # Luôn cần phân tích weak_points từ FitnessEngine
            fitness_res = FitnessEngine.evaluate(optimized, schema, categories)
            weak_points = fitness_res.weak_points
        except:
            break
            
        if not weak_points:
            # Fallback: Nếu không có weak point rõ ràng, chọn ngẫu nhiên một trường để thăm dò (Exploration)
            field_names = [f["name"] for f in schema if f.get("type") != "boolean"]
            if not field_names:
                details.append(f"Không còn trường hợp lệ. Dừng HC.")
                break
            random_field = random.choice(field_names)
            target_wp = {"field": random_field, "issue": "exploration"}
        else:
            # Chọn 1 weak point để HC nhắm tới
            target_wp = random.choice(weak_points)
            
        field_name = target_wp.get("field")
        if not field_name:
            continue
            
        field_schema = next((f for f in schema if f["name"] == field_name), None)
        if not field_schema:
            continue
            
        # HC tự sinh các step size nhỏ để thăm dò
        ftype = field_schema.get("type", "string")
        if ftype == "number":
            steps = ["+1", "-1", "+5", "-5", "+10%"]
        else:
            steps = ["+2 chars", "+5 chars", "+10 chars", "-2 chars", "approach_boundary"]
            
        best_neighbor = None
        best_neighbor_fitness = current_fitness
        best_step = None
        
        # Tạo 3 bản thể (batch 3)
        offspring_to_mutate = []
        for step in random.sample(steps, min(3, len(steps))):
            offspring_to_mutate.append({
                "index": len(offspring_to_mutate),
                "values": optimized,
                "fitness_res": fitness_res,
                "hc_step": step,
                "target_wp": target_wp
            })
            
        mutated_results = MutationExecutor.batch_execute(
            offspring_to_mutate, 
            schema, 
            llm_provider=llm_provider, 
            api_key_override=api_key_override,
            batch_size=5
        )

        # Case POSITIVE phải GIỮ hợp lệ sau khi HC tinh chỉnh (đúng rule gốc).
        is_positive = not any(
            any(t in str(c).lower() for t in ("negative", "security", "invalid", "boundary", "error", "xss", "sqli"))
            for c in categories
        )
        field_names = [f["name"] for f in schema]

        best_in_batch = None
        best_in_batch_fitness = -1
        best_step = None
        
        # Lọc ra các neighbor hợp lệ theo Rule
        for i, neighbor in enumerate(mutated_results):
            # Chỉ giữ các trường thuộc schema (không để rò key meta ra ngoài)
            neighbor = {k: neighbor.get(k) for k in field_names}

            # Với POSITIVE: loại ngay neighbor làm dữ liệu sai rule (oracle = invalid)
            if is_positive:
                from ..services.ai_service import derive_expected_result
                if not derive_expected_result(neighbor, schema).get("is_valid"):
                    continue

            try:
                if fitness_evaluator:
                    n_fitness = fitness_evaluator(neighbor)
                else:
                    n_fitness = FitnessEngine.evaluate(neighbor, schema, categories).fitness
            except Exception:
                n_fitness = -1

            if n_fitness >= best_in_batch_fitness:
                best_in_batch_fitness = n_fitness
                best_in_batch = neighbor
                best_step = offspring_to_mutate[i]["hc_step"]
                
        best_neighbor = best_in_batch
        best_neighbor_fitness = best_in_batch_fitness
                
        import math
        
        # V6: Probabilistic HC Acceptance (Simulated Annealing)
        if best_neighbor is not None:
            delta_fitness = best_neighbor_fitness - current_fitness
            temperature = max(0.1, 5.0 / iteration) # Cooling schedule
            
            accept = False
            prob = 0.0
            if delta_fitness > 0:
                accept = True
            else:
                prob = math.exp(delta_fitness / temperature)
                if random.random() < prob:
                    accept = True
                    
            if accept:
                optimized = best_neighbor
                current_fitness = best_neighbor_fitness
                tweaks_count += 1
                if delta_fitness > 0:
                    details.append(f"Vòng {iteration}: Cải thiện '{field_name}' step='{best_step}' -> Fitness {current_fitness:.2f}")
                else:
                    details.append(f"Vòng {iteration}: SA Escape (Prob={prob:.2f}) '{field_name}' -> Fitness {current_fitness:.2f}")
            else:
                details.append(f"Vòng {iteration}: Từ chối (Delta={delta_fitness:.2f}) '{field_name}'.")
        else:
            details.append(f"Vòng {iteration}: Không tìm thấy lân cận cho '{field_name}'.")
            
    stats = BoundaryTweakStats(
        original_fitness=original_fitness,
        optimized_fitness=current_fitness,
        tweaks_count=tweaks_count,
        edge_cases_discovered=edge_cases_discovered,
        details=details,
        restarts_count=1
    )
    
    return optimized, stats
