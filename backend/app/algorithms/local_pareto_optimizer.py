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
        """
        Tạo không gian lân cận N(s) cho mỗi ca kiểm thử — khớp đồ án Chương 3:

        - Số  : tại min, tại max, min-1 (ngoài biên dưới), max+1 (ngoài biên trên),
                min+1 (gần biên dưới), max-1 (gần biên trên), ±delta nhỏ
        - Chuỗi: rỗng "", tại min_length, tại max_length, vượt max_length +1 ký tự,
                dưới min_length -1 ký tự, khoảng trắng đầu cuối, ký tự đặc biệt
        - Enum  : giá trị hợp lệ khác, giá trị không thuộc danh sách
        """
        neighbors = []

        from .v4_optimizer import extract_domain_vocab, generate_random_field_value
        import uuid
        import random as _rnd
        import string as _string

        vocab = extract_domain_vocab([], self.schema)

        for field in self.schema:
            name = field["name"]
            ftype = field.get("type", "string")
            current_val = tc.get(name)

            candidate_values = []

            if ftype == "number":
                min_v = field.get("minValue")
                max_v = field.get("maxValue")

                try:
                    cur_num = float(current_val) if current_val is not None else 0.0
                except (ValueError, TypeError):
                    cur_num = 0.0

                is_int = (min_v is None or float(min_v).is_integer()) and \
                         (max_v is None or float(max_v).is_integer())

                if min_v is not None:
                    mn = int(min_v) if is_int else float(min_v)
                    candidate_values += [
                        mn,                  # tại biên dưới
                        mn + (1 if is_int else 0.01),  # gần biên dưới (bên trong)
                        mn - (1 if is_int else 0.01),  # ngoài biên dưới
                    ]
                if max_v is not None:
                    mx = int(max_v) if is_int else float(max_v)
                    candidate_values += [
                        mx,                  # tại biên trên
                        mx - (1 if is_int else 0.01),  # gần biên trên (bên trong)
                        mx + (1 if is_int else 0.01),  # ngoài biên trên
                    ]
                # Thay đổi nhỏ xung quanh giá trị hiện tại
                candidate_values += [cur_num + 1, cur_num - 1]

            elif field.get("allowedValues"):
                allowed = field["allowedValues"]
                # Giá trị hợp lệ khác với giá trị hiện tại
                others = [v for v in allowed if v != current_val]
                candidate_values.extend(others[:3])
                # Giá trị ngoài danh sách cho phép
                candidate_values.append("INVALID_ENUM_VAL")

            else:
                # Chuỗi: tạo lân cận theo độ dài và nội dung
                min_l = field.get("minLength", 1)
                max_l = field.get("maxLength", 50)
                cur_str = str(current_val) if current_val is not None else ""

                # Rỗng (test INVALID_REQUIRED)
                candidate_values.append("")

                # Tại biên dưới (min_length)
                if min_l is not None and min_l > 0:
                    candidate_values.append("a" * int(min_l))
                    # Dưới biên dưới (ngoài biên)
                    if int(min_l) > 1:
                        candidate_values.append("a" * (int(min_l) - 1))

                # Tại biên trên (max_length)
                if max_l is not None:
                    candidate_values.append("a" * int(max_l))
                    # Vượt biên trên +1 ký tự
                    candidate_values.append("a" * (int(max_l) + 1))

                # Khoảng trắng đầu cuối
                if cur_str:
                    candidate_values.append("  " + cur_str + "  ")

                # Ký tự đặc biệt
                candidate_values.append(cur_str + "@#$")

                # Email: thêm biến thể không hợp lệ nếu là email field
                if ftype == "email" or "email" in name.lower():
                    candidate_values += ["invalid-email", "name@", "@domain.com"]

                # Security payload (SQL injection / XSS)
                candidate_values.append("' OR 1=1 --")

            # Tạo neighbor dict cho mỗi candidate value
            for cand_val in candidate_values:
                nb = dict(tc)
                nb[name] = cand_val
                neighbors.append(nb)

        # Giới hạn để tránh bùng nổ kết hợp: lấy mẫu tối đa 20 lân cận
        _rnd.shuffle(neighbors)
        return neighbors[:20]


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
