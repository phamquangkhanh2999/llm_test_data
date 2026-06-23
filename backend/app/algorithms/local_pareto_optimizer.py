import random
import math
from copy import deepcopy

class LocalParetoOptimizer:
    def __init__(
        self,
        schema,
        fitness_evaluator,
        epsilon: float = 0.05,
        max_iterations: int = 15,
        noise_ratio: float = 0.2,
        temperature: float = 5.0
    ):
        self.schema = schema
        self.fitness_evaluator = fitness_evaluator
        self.epsilon = epsilon
        self.max_iterations = max_iterations
        self.noise_ratio = noise_ratio
        self.temperature_base = temperature

    def optimize(self, population: list, categories: list = None) -> tuple:
        if categories is None:
            categories = ["positive"]
            
        optimized = []
        details = []
        for i, tc in enumerate(population):
            best, logs = self._local_search(tc, categories)
            optimized.append(best)
            details.extend([f"Cá thể #{i+1}: {log}" for log in logs])
            
        from .boundary_tweak import BoundaryTweakStats
        stats = BoundaryTweakStats(0, 0, 0, 0, details)
        return optimized, stats

    def _local_search(self, tc: dict, categories: list) -> tuple:
        current = deepcopy(tc)
        logs = []
        
        # Repair initial
        current = self._apply_constraints(current)
        if not current: return tc, ["Bị loại bỏ bởi Hard Constraint"]
        
        current_fit_scalar, current_vec, _ = self.fitness_evaluator(current)
        
        for iteration in range(1, self.max_iterations + 1):
            neighbors = self._generate_neighbors(current)
            improved = False
            
            for nb in neighbors:
                nb = self._apply_constraints(nb)
                if not nb: continue
                
                # Semantic Alignment before evaluating
                from .oracle_engine import OracleEngine
                nb = OracleEngine.align_labels(nb, self.schema)
                
                nb_fit_scalar, nb_vec, _ = self.fitness_evaluator(nb)
                
                # Pareto Dominance (Lexicographic Priority)
                if self._dominates(nb_vec, current_vec):
                    current, current_vec = nb, nb_vec
                    improved = True
                    break
                
                # Epsilon Acceptance (Soft Fallback)
                elif nb_fit_scalar >= current_fit_scalar - self.epsilon:
                    # Simulated Annealing Escape
                    delta = nb_fit_scalar - current_fit_scalar
                    temp = max(0.1, self.temperature_base / iteration)
                    prob = math.exp(delta / temp) if delta < 0 else 1.0
                    
                    if random.random() < prob:
                        current, current_vec = nb, nb_vec
                        improved = True
                        logs.append(f"Chấp nhận lân cận mới (Delta={delta:.4f}, SA_Prob={prob:.2f})")
                        break

            if not improved:
                logs.append(f"Dừng tìm kiếm tại vòng {iteration}")
                break
                
        return current, logs

    def _generate_neighbors(self, tc: dict) -> list:
        neighbors = []
        
        from .mutation_planner import MutationPlanner, MutationExecutor
        import uuid
        
        # Guided steps for fields
        for field in self.schema:
            name = field["name"]
            ftype = field.get("type", "string")
            
            steps = []
            if ftype == "number":
                steps = ["+1", "-1", "boundary_max"]
            else:
                steps = ["approach_boundary", "+2 chars", "-2 chars", "attack_sqli"]
                
            for step in random.sample(steps, min(2, len(steps))):
                neighbors.append({
                    "id": str(uuid.uuid4()),
                    "values": deepcopy(tc),
                    "hc_step": step,
                    "target_field": name
                })
                
        # LLM Batch Execution (Sử dụng dummy mutation nếu không có LLM)
        from .v4_optimizer import extract_domain_vocab, generate_random_field_value
        vocab = extract_domain_vocab([], self.schema)
        
        mutated_neighbors = []
        for nb in neighbors:
            field_name = nb["target_field"]
            field_schema = next((f for f in self.schema if f["name"] == field_name), None)
            if not field_schema: continue
            
            step = nb["hc_step"]
            val = nb["values"].get(field_name)
            
            if "attack" in step and field_schema.get("type") == "string":
                nb["values"][field_name] = "' OR 1=1 --"
            elif "boundary" in step:
                if field_schema.get("type") == "number":
                    nb["values"][field_name] = field_schema.get("maxValue", 999) + 1
                else:
                    nb["values"][field_name] = "A" * (field_schema.get("maxLength", 50) + 1)
            else:
                # Random noise
                nb["values"][field_name] = generate_random_field_value(field_schema, "valid", vocab)
                
            mutated_neighbors.append(nb["values"])
            
        return mutated_neighbors

    def _dominates(self, a_vec: dict, b_vec: dict) -> bool:
        # Lexicographic Constraints
        if a_vec.get("rule", 0) < b_vec.get("rule", 0):
            return False
            
        a_vals = [a_vec.get(k, 0) for k in ["rule", "boundary", "security", "oracle"]]
        b_vals = [b_vec.get(k, 0) for k in ["rule", "boundary", "security", "oracle"]]
        
        greater_or_equal = all(x >= y for x, y in zip(a_vals, b_vals))
        strictly_greater = any(x > y for x, y in zip(a_vals, b_vals))
        
        return greater_or_equal and strictly_greater

    def _apply_constraints(self, tc: dict) -> dict:
        for field in self.schema:
            name = field["name"]
            val = tc.get(name)
            
            # HARD CONSTRAINT: Missing required (Reject)
            if field.get("required") and (val is None or str(val).strip() == ""):
                # We can't reject entirely if we want to test negative cases, 
                # but if the AI review says "Hard Constraint -> Reject", we will return None.
                # Actually, let's keep it to allow Negative testing, but we repair ENUMs!
                pass
                
            # SOFT CONSTRAINT: Invalid ENUM (Repair)
            if field.get("allowedValues") and val not in field["allowedValues"]:
                # If it's a completely meaningless string like 'unknown', auto-repair to a valid one
                if str(val) not in ["", "INVALID_VAL", "MISSING_VAL"]:
                    tc[name] = random.choice(field["allowedValues"])
                    
        return tc
