import random
import re
import string
import math

# Helper: Tính khoảng cách Levenshtein giữa 2 chuỗi để đo lường tính đa dạng (Diversity)
def levenshtein_distance(s1, s2):
    s1 = s1[:30]
    s2 = s2[:30]
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)

    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


# Helper: Chuyển đổi an toàn sang kiểu float để tránh lỗi NoneType/TypeError
def safe_float(val, default=0.0):
    try:
        return float(val) if val is not None else default
    except (ValueError, TypeError):
        return default

def fast_distance(v1, v2):
    if v1 == v2:
        return 0.0
    len1 = len(v1)
    len2 = len(v2)
    max_len = max(len1, len2, 1)
    if len1 <= 12 and len2 <= 12:
        return levenshtein_distance(v1, v2) / max_len
    
    # Fast prefix matching approximation for longer strings to avoid O(N^2) edit distance
    common_prefix = 0
    for i in range(min(len1, len2, 4)):
        if v1[i] == v2[i]:
            common_prefix += 1
        else:
            break
    return 1.0 - (common_prefix * 0.15)

# Helper: Tính độ đa dạng tổng quát của một Test Case so với tập mẫu thử nghiệm
def calculate_diversity_score(test_case, subset):
    if not subset:
        return 1.0
    total_dist = 0.0
    keys = list(test_case.keys())

    for other in subset:
        diffs = 0.0
        for k in keys:
            v1 = str(test_case[k])
            v2 = str(other.get(k, ""))
            diffs += fast_distance(v1, v2)
        total_dist += diffs / len(keys)

    return min(total_dist / len(subset), 1.0)


# Helper: Tự động sinh giá trị ngẫu nhiên theo quy định trường dữ liệu
# =========================================================================
# [BƯỚC 2: PHÂN TÍCH THUẬT TOÁN - PHƯƠNG PHÁP TRUYỀN THỐNG (TRADITIONAL BASELINE)]
# Luồng 1 (Traditional) trong giao diện Dashboard Bước 2.
# Sử dụng phương pháp sinh giá trị ngẫu nhiên (Random) hoặc Phân tích giá trị biên tĩnh (BVA) 
# dựa trên định nghĩa cứng của schema (ví dụ: minValue, maxValue, minLength, maxLength) 
# mà không qua quá trình học máy hay tối ưu hóa tiến hóa.
# =========================================================================
def generate_random_field_value(field, mode="valid"):
    special_chars = ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "-", "_", "+", "=", "[", "]", "{", "}", ";", ":", "'", '"', "<", ">", "/", "?", "\\", "|", "`", "~"]

    # Sinh dữ liệu theo kiểu
    f_type = field["type"]

    if f_type == "email":
        if mode == "invalid":
            return random.choice(["invalid-email", "name@", "@domain.com", "name@domain."])
        if mode == "boundary":
            return f"a@{'b' * 100}.com" # độ dài email cực lớn
        names = ["emma", "liam", "olivia", "noah", "will", "sophia", "james"]
        domains = ["gmail.com", "yahoo.com", "outlook.com", "test.io", "company.vn"]
        return f"{random.choice(names)}{random.randint(10, 99)}@{random.choice(domains)}"

    elif f_type == "card":
        if mode == "invalid":
            return "1234-5678-9012" # sai cấu trúc thẻ 16 số viết liền
        if mode == "boundary":
            return "0" * 16 # biên số 0 nhỏ nhất
        return "".join(str(random.randint(0, 9)) for _ in range(16))

    elif f_type == "phone":
        prefixes = ["03", "05", "07", "08", "09"]
        if mode == "invalid":
            return "0281234567" # sai đầu số di động VN
        if mode == "boundary":
            return "0900000000"
        phone = random.choice(prefixes)
        phone += "".join(str(random.randint(0, 9)) for _ in range(8))
        return phone

    elif f_type == "number":
        try:
            min_v = field.get("minValue")
            max_v = field.get("maxValue")
            min_v = float(min_v) if min_v is not None else 0.0
            max_v = float(max_v) if max_v is not None else 1000.0
        except (ValueError, TypeError):
            min_v, max_v = 0.0, 1000.0

        is_float = not min_v.is_integer() or not max_v.is_integer()
        if is_float:
            if mode == "invalid":
                return min_v - 5.0 if random.random() > 0.5 else max_v + 5.0
            if mode == "boundary":
                return min_v if random.random() > 0.5 else max_v
            return random.uniform(min_v, max_v)
        else:
            min_i = int(min_v)
            max_i = int(max_v)
            if mode == "invalid":
                return min_i - 5 if random.random() > 0.5 else max_i + 5
            if mode == "boundary":
                return min_i if random.random() > 0.5 else max_i
            return random.randint(min_i, max_i)

    else: # type == string
        if field.get("allowedValues"):
            if mode == "invalid":
                return "INVALID_VAL"
            return random.choice(field["allowedValues"])

        min_l = int(field.get("minLength", 3) or 3)
        max_l = int(field.get("maxLength", 20) or 20)

        length = random.randint(min_l, max_l)
        if mode == "invalid":
            length = max(0, min_l - 2) if random.random() > 0.5 else max_l + 5
        elif mode == "boundary":
            length = min_l if random.random() > 0.5 else max_l

        if length == 0:
            return ""

        chars = string.ascii_letters + string.digits
        str_val = "".join(random.choice(chars) for _ in range(length))

        if mode == "boundary" and random.random() > 0.7:
            # nhúng ký tự đặc biệt ở biên cuối chuỗi
            str_val = str_val[:-1] + random.choice(special_chars)
        return str_val


# =========================================================================
# [BƯỚC 2: PHÂN TÍCH THUẬT TOÁN - GIẢI THUẬT DI TRUYỀN (GENETIC ALGORITHM - GA)]
# Luồng 2 (GA) và pha 1 của Luồng 4 (Hybrid) trong giao diện Dashboard Bước 2.
# GA thực hiện tìm kiếm toàn cục (global search) qua các thế hệ tiến hóa:
#   1. Khởi tạo quần thể (initialize_suite) từ hạt giống hoặc ngẫu nhiên.
#   2. Đánh giá độ thích nghi (evaluate_testcase_quality) dựa trên Validation, Biên, Bảo mật, Đa dạng.
#   3. Lựa chọn cá thể bố mẹ (select_parent) bằng Tournament Selection & Crowding Distance.
#   4. Lai ghép (mix_testcases) bằng Uniform Crossover thích nghi.
#   5. Đột biến (tweak_values) bằng đột biến Gauss (số), Enum-aware (danh mục) thích nghi.
#   6. Phát hiện trì trệ (stagnation) và tái tạo quần thể để tránh cực trị cục bộ.
# =========================================================================
class TestSuiteOptimizer:
    """
    BỘ TỐI ƯU HÓA TEST SUITE (Genetic Algorithm Engine in Python).
    Đảm nhận việc nhân bản, hoán đổi trường dữ liệu và tinh chỉnh giá trị ngẫu nhiên
    để lọc ra bộ Test Cases có độ bao phủ biên tốt nhất.

    TIER 1 UPGRADES:
    - Adaptive mutation rate (decaying schedule)
    - Full-population coverage + pairwise combination tracking
    - Near-boundary credit scoring
    - Enum-aware mutation
    - Gaussian mutation for numeric fields
    - Stagnation detection
    - Hall of fame archive
    """
    def __init__(self, schema, config):
        self.schema = schema
        self.config = config
        self.test_suite = []
        self.generation = 0
        self.max_generations = config.get("generations", 60)

        # Adaptive rate state
        self._initial_mutation_rate = config.get("mutationRate", 0.15)
        self._min_mutation_rate = 0.02
        self._initial_crossover_rate = config.get("crossoverRate", 0.8)
        self._min_crossover_rate = 0.45

        # Stagnation tracking
        self._best_fitness_history = []
        self._stagnation_threshold = 8  # generations without improvement

        # Hall of Fame: archive of best unique test cases across ALL generations
        self.hall_of_fame = []
        self._max_hof_size = 20

        # Static evaluations cache (caching validation, boundary, security scores)
        self.static_cache = {}

    # ═══════════════════════════════════════════════════════════
    # ADAPTIVE RATE HELPERS
    # ═══════════════════════════════════════════════════════════

    def _progress_ratio(self):
        """0.0 at gen 0, approaches 1.0 at max_generations."""
        if self.max_generations <= 1:
            return 0.0
        return min(self.generation / (self.max_generations - 1), 1.0)

    def get_adaptive_mutation_rate(self):
        """
        Decay mutation rate using quadratic schedule:
        Start high (~0.25-0.30) for exploration,
        decay to minimum (~0.02) for exploitation.
        rate = initial - (initial - min) * progress^2
        """
        p = self._progress_ratio()
        return self._initial_mutation_rate - (self._initial_mutation_rate - self._min_mutation_rate) * (p ** 2)

    def get_adaptive_crossover_rate(self):
        """
        Decay crossover rate more gently:
        Start high (~0.80) for diversity through recombination,
        decay to minimum (~0.45) for preserving good schemas.
        """
        p = self._progress_ratio()
        return self._initial_crossover_rate - (self._initial_crossover_rate - self._min_crossover_rate) * (p ** 1.5)

    # ═══════════════════════════════════════════════════════════
    # FITNESS FUNCTION (with near-boundary credit)
    # ═══════════════════════════════════════════════════════════

    def evaluate_testcase_quality(self, test_case, current_suite_values):
        """
        Đánh giá chất lượng của một Test Case (Hàm Fitness).
        Trả về điểm số từ 0.01 đến 1.0 và cơ cấu điểm chi tiết.

        UPGRADED: Near-boundary values receive partial credit (0.5 per near-hit).
        """
        # Ensure static cache is initialized
        if not hasattr(self, 'static_cache'):
            self.static_cache = {}

        # Compute unique key for the test case values
        tc_key = str(sorted((k, str(v)) for k, v in test_case.items()))

        if tc_key in self.static_cache:
            v_score, b_score = self.static_cache[tc_key]
        else:
            validation_score = 0.0
            boundary_score = 0.0

            num_fields = len(self.schema)

            for field in self.schema:
                name = field["name"]
                val = test_case.get(name)
                if val is None:
                    continue

                val_str = str(val)
                is_boundary = False
                is_near_boundary = False

                # Split validations into Hard and Soft constraints
                hard_passed = True
                soft_passed = True

                # --- 1. Hard Constraints ---
                # Required check
                if field.get("required") and (val is None or val_str.strip() == ""):
                    hard_passed = False

                # Data type compliance and structural rules
                if hard_passed and val is not None and val_str.strip() != "":
                    if field["type"] == "email":
                        if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", val_str):
                            hard_passed = False
                    elif field["type"] == "card":
                        if not re.match(r"^\d{16}$", val_str):
                            hard_passed = False
                    elif field["type"] == "phone":
                        if not re.match(r"^(03|05|07|08|09)\d{8}$", val_str):
                            hard_passed = False
                    elif field["type"] == "number":
                        try:
                            float(val)
                        except (ValueError, TypeError):
                            hard_passed = False

                    # allowedValues (enum checks)
                    if hard_passed and field.get("allowedValues") and field["allowedValues"]:
                        if val_str not in [str(av) for av in field["allowedValues"]]:
                            hard_passed = False

                # --- 2. Soft Constraints ---
                if hard_passed and val is not None and val_str.strip() != "":
                    # Ranges
                    if field["type"] == "number":
                        try:
                            num = float(val)
                            if field.get("minValue") is not None and num < field["minValue"]:
                                soft_passed = False
                            if field.get("maxValue") is not None and num > field["maxValue"]:
                                soft_passed = False
                        except (ValueError, TypeError):
                            pass
                    else:
                        # minLength / maxLength
                        if field.get("minLength") is not None and len(val_str) < field["minLength"]:
                            soft_passed = False
                        if field.get("maxLength") is not None and len(val_str) > field["maxLength"]:
                            soft_passed = False

                    # Regex match
                    if soft_passed and field.get("regex"):
                        try:
                            if not re.search(field["regex"], val_str):
                                soft_passed = False
                        except Exception:
                            pass

                # Scoring validation
                if not hard_passed:
                    field_val_score = 0.0
                elif not soft_passed:
                    field_val_score = 0.70
                else:
                    field_val_score = 1.00

                validation_score += field_val_score

                # --- 3. Boundary Credit (only for structurally correct field_val_score == 1.0) ---
                if field_val_score == 1.0:
                    # [START: BOUNDARY_FITNESS_SCORING]
                    if field["type"] == "number":
                        try:
                            num = float(val)
                            min_v = field.get("minValue")
                            max_v = field.get("maxValue")

                            if min_v is not None:
                                if num == min_v:
                                    is_boundary = True
                                elif num == min_v + 1:
                                    is_near_boundary = True

                            if max_v is not None:
                                if num == max_v:
                                    is_boundary = True
                                elif num == max_v - 1:
                                    is_near_boundary = True
                        except (ValueError, TypeError):
                            pass
                    else:
                        min_l = field.get("minLength")
                        max_l = field.get("maxLength")

                        if min_l is not None:
                            if len(val_str) == min_l:
                                is_boundary = True
                            elif len(val_str) == min_l + 1:
                                is_near_boundary = True

                        if max_l is not None:
                            if len(val_str) == max_l:
                                is_boundary = True
                            elif len(val_str) == max_l - 1:
                                is_near_boundary = True

                    if is_boundary:
                        boundary_score += 1.0
                    elif is_near_boundary:
                        boundary_score += 0.5
                    # [END: BOUNDARY_FITNESS_SCORING]

            # Normalize scores
            v_score = validation_score / num_fields
            b_score = min(boundary_score / num_fields, 1.0)

            # Store in cache
            self.static_cache[tc_key] = (v_score, b_score)

        # --- 4. Diversity (Dynamic, evaluated on the fly) ---
        sample_size = min(20, max(5, len(current_suite_values) // 2))
        if sample_size > 0 and len(current_suite_values) > 0:
            sample_subset = random.sample(current_suite_values, min(sample_size, len(current_suite_values)))
        else:
            sample_subset = []
        d_score = calculate_diversity_score(test_case, sample_subset)

        # --- 5. Duplicate Penalty (Dynamic, evaluated on the fly) ---
        dup_count = sum(1 for other in current_suite_values if all(str(test_case[k]) == str(other.get(k, "")) for k in test_case.keys()))
        penalty = min(0.15 * (dup_count - 1), 0.6) if dup_count > 1 else 0.0

        # --- 6. Priority (Dynamic, evaluated on the fly) ---
        category = self._categorize_testcase(test_case)
        if category == "boundary":
            p_score = 1.0
        elif category == "negative":
            p_score = 0.7
        else:
            p_score = 0.4

        # Calculate final fitness based on weights
        w1, w2, w3, w4, w5 = 0.4, 0.2, 0.1, 0.3, 0.5
        fitness = (w1 * v_score) + (w2 * d_score) + (w3 * p_score) + (w4 * b_score) - (w5 * penalty)
        fitness = max(0.01, min(fitness, 1.0))

        return fitness

    # ═══════════════════════════════════════════════════════════
    # POPULATION INITIALIZATION
    # ═══════════════════════════════════════════════════════════

    def initialize_suite(self, seeds):
        self.test_suite = []
        self.generation = 0
        self.hall_of_fame = []
        self._best_fitness_history = []

        # 1. Đưa các hạt giống thông minh ban đầu vào bộ dữ liệu
        for s in seeds:
            cleaned_tc = {}
            for field in self.schema:
                name = field["name"]
                cleaned_tc[name] = s[name] if name in s else generate_random_field_value(field, "valid")
            self.test_suite.append({
                "values": cleaned_tc,
                "fitness": 0.0,
                "origin": "Seed"
            })

        # 2. Nhân bản ngẫu nhiên thêm các bộ test biên/lỗi để lấp đầy kích thước (PopSize)
        modes = ["valid", "boundary", "invalid", "valid"]
        while len(self.test_suite) < self.config["popSize"]:
            record = {}
            mode = modes[len(self.test_suite) % len(modes)]
            for field in self.schema:
                record[field["name"]] = generate_random_field_value(field, mode)
            self.test_suite.append({
                "values": record,
                "fitness": 0.0,
                "origin": f"Init_{mode.upper()}"
            })

        self.evaluate_suite()

    def warm_start(self, saved_population, generation=0):
        """
        Tiếp tục tiến hóa từ quần thể đã lưu trước đó.
        Giữ nguyên fitness scores, origins, hall of fame.
        Mở rộng quần thể lên popSize nếu cần.
        """
        self.test_suite = []
        self.generation = generation

        # 1. Load saved individuals
        for ind in saved_population:
            cleaned_tc = {}
            for field in self.schema:
                name = field["name"]
                cleaned_tc[name] = ind.get("values", {}).get(name) if "values" in ind else ind.get(name)
                if cleaned_tc[name] is None:
                    cleaned_tc[name] = generate_random_field_value(field, "valid")
            self.test_suite.append({
                "values": cleaned_tc,
                "fitness": ind.get("fitness", 0.0),
                "origin": ind.get("origin", "WarmStart")
            })

        # 2. Expand if below popSize
        modes = ["valid", "boundary", "invalid", "valid"]
        while len(self.test_suite) < self.config["popSize"]:
            record = {}
            mode = modes[len(self.test_suite) % len(modes)]
            for field in self.schema:
                record[field["name"]] = generate_random_field_value(field, mode)
            self.test_suite.append({
                "values": record,
                "fitness": 0.0,
                "origin": "WarmStart_Expanded"
            })

        self.evaluate_suite()

    def export_state(self):
        """
        Xuất toàn bộ trạng thái quần thể hiện tại để lưu trữ.
        Có thể dùng để warm start sau này.
        """
        return {
            "generation": self.generation,
            "population": [
                {
                    "values": ind["values"],
                    "fitness": ind["fitness"],
                    "origin": ind["origin"]
                }
                for ind in self.test_suite
            ],
            "hall_of_fame": self.hall_of_fame,
            "config": self.config,
        }

    def evaluate_suite(self):
        raw_values = [ind["values"] for ind in self.test_suite]
        for ind in self.test_suite:
            ind["fitness"] = self.evaluate_testcase_quality(ind["values"], raw_values)

        self.test_suite.sort(key=lambda x: x["fitness"], reverse=True)

        # Update Hall of Fame with unique best solutions
        self._update_hall_of_fame()

    def _update_hall_of_fame(self):
        """Archive the best unique test cases found so far."""
        for ind in self.test_suite[:5]:
            # Check if this individual is unique compared to hall of fame
            tc_str = str(sorted(ind["values"].items()))
            if not any(str(sorted(hof["values"].items())) == tc_str for hof in self.hall_of_fame):
                self.hall_of_fame.append({
                    "values": {**ind["values"]},
                    "fitness": ind["fitness"],
                    "origin": f"HoF_Gen{self.generation}"
                })

        # Keep only top N by fitness
        self.hall_of_fame.sort(key=lambda x: x["fitness"], reverse=True)
        if len(self.hall_of_fame) > self._max_hof_size:
            self.hall_of_fame = self.hall_of_fame[:self._max_hof_size]

    # ═══════════════════════════════════════════════════════════
    # SELECTION (with Niche Density Distance tiebreaker)
    # ═══════════════════════════════════════════════════════════

    def select_parent(self):
        """
        Tournament Selection với Niche Density Distance tiebreaker (thay thế Crowding Distance chuẩn).
        Khi 2 cá thể có fitness gần bằng nhau, ưu tiên cá thể ở vùng mật độ thưa thớt hơn trong không gian biến.
        """
        tour_size = 3
        candidates = random.sample(self.test_suite, tour_size)
        candidates.sort(key=lambda x: (-x["fitness"], -self._niche_density_distance(x)))
        return candidates[0]["values"]

    def _niche_density_distance(self, individual):
        """
        Tính toán Niche Density Distance (Khoảng cách mật độ kiểu hình trong không gian biến).
        Được dùng thay thế Crowding Distance (NSGA-II chuẩn vốn tính trên không gian hàm mục tiêu).
        Tính khoảng cách trung bình tới 3 cá thể gần nhất trong tập mẫu so sánh ngẫu nhiên.
        Giá trị càng cao thể hiện cá thể nằm ở khu vực thưa thớt hơn.
        """
        # Lấy mẫu 10 cá thể ngẫu nhiên để so sánh
        sample = random.sample(self.test_suite, min(10, len(self.test_suite)))
        if len(sample) < 2:
            return 0.0

        distances = []
        ind_values = individual["values"]

        for other in sample:
            if other is individual:
                continue
            other_values = other["values"]
            dist = 0.0
            keys = list(ind_values.keys())
            for k in keys:
                v1 = str(ind_values.get(k, ""))
                v2 = str(other_values.get(k, ""))
                dist += fast_distance(v1, v2)
            distances.append(dist / len(keys) if keys else 0)

        if not distances:
            return 0.0

        # Trả về trung bình của 3 khoảng cách gần nhất (niche density estimate)
        distances.sort(reverse=True)
        top_k = distances[:3]
        return sum(top_k) / len(top_k)

    # ═══════════════════════════════════════════════════════════
    # CROSSOVER (adaptive rate)
    # ═══════════════════════════════════════════════════════════

    def mix_testcases(self, p1, p2):
        """
        Uniform Crossover với adaptive crossover rate.
        """
        child1 = {}
        child2 = {}
        rate = self.get_adaptive_crossover_rate()

        for field in self.schema:
            name = field["name"]
            if random.random() < rate:
                child1[name] = p2[name]
                child2[name] = p1[name]
            else:
                child1[name] = p1[name]
                child2[name] = p2[name]
        return child1, child2

    # ═══════════════════════════════════════════════════════════
    # MUTATION (adaptive rate + Gaussian + enum-aware)
    # ═══════════════════════════════════════════════════════════

    def tweak_values(self, test_case):
        """
        Đột biến giá trị (Mutation) với adaptive rate.

        UPGRADES:
        - Adaptive mutation rate (decays over generations)
        - Gaussian mutation for numeric fields
        - Enum-aware mutation for allowedValues fields
        """
        mutated_tc = {**test_case}
        is_mutated = False
        rate = self.get_adaptive_mutation_rate()

        for field in self.schema:
            name = field["name"]
            if random.random() < rate:
                is_mutated = True
                val_str = str(mutated_tc[name])
                rand = random.random()

                if field["type"] == "number":
                    try:
                        num = float(mutated_tc[name])
                        if rand < 0.35:
                            # Gaussian perturbation: N(0, sigma) with sigma decaying
                            sigma = max(0.5, (self.max_generations - self.generation) / self.max_generations * 5)
                            mutated_tc[name] = num + random.gauss(0, sigma)
                            # Clamp to reasonable range
                            if field.get("minValue") is not None:
                                mutated_tc[name] = max(field["minValue"] - 2, mutated_tc[name])
                            if field.get("maxValue") is not None:
                                mutated_tc[name] = min(field["maxValue"] + 2, mutated_tc[name])
                        elif rand < 0.70:
                            mutated_tc[name] = generate_random_field_value(field, "boundary")
                        else:
                            mutated_tc[name] = generate_random_field_value(field, "invalid")
                    except (ValueError, TypeError):
                        mutated_tc[name] = generate_random_field_value(field, "valid")

                elif field["type"] in ["email", "card", "phone"]:
                    if rand < 0.4:
                        if len(val_str) > 3:
                            idx = random.randint(0, len(val_str) - 1)
                            mutated_tc[name] = val_str[:idx] + val_str[idx+1:]
                        else:
                            mutated_tc[name] = generate_random_field_value(field, "valid")
                    elif rand < 0.75:
                        mutated_tc[name] = generate_random_field_value(field, "boundary")
                    else:
                        mutated_tc[name] = generate_random_field_value(field, "invalid")

                else: # string
                    # ENUM-AWARE: nếu field có allowedValues, chỉ mutate trong danh sách
                    if field.get("allowedValues") and field["allowedValues"]:
                        current_vals = [str(v) for v in field["allowedValues"]]
                        if val_str in current_vals and len(current_vals) > 1:
                            others = [v for v in current_vals if v != val_str]
                            mutated_tc[name] = random.choice(others)
                        else:
                            mutated_tc[name] = random.choice(current_vals)
                    elif rand < 0.3:
                        # chèn 1 ký tự đặc biệt biên
                        char = random.choice("!@#$%'\"<>")
                        idx = random.randint(0, len(val_str))
                        mutated_tc[name] = val_str[:idx] + char + val_str[idx:]
                    elif rand < 0.6:
                        # đảo hoa thường
                        mutated_tc[name] = val_str.upper() if random.random() > 0.5 else val_str.lower()
                    elif rand < 0.85:
                        mutated_tc[name] = generate_random_field_value(field, "boundary")
                    else:
                        mutated_tc[name] = generate_random_field_value(field, "invalid")

        return mutated_tc, is_mutated

    # ═══════════════════════════════════════════════════════════
    # STAGNATION DETECTION
    # ═══════════════════════════════════════════════════════════

    def _is_stagnated(self):
        """Detect if the population has stopped improving."""
        if len(self._best_fitness_history) < self._stagnation_threshold:
            return False

        recent = self._best_fitness_history[-self._stagnation_threshold:]
        # Check if no improvement in the last N generations
        return max(recent) - min(recent) < 0.005

    def _restart_population(self):
        """
        Re-initialize 80% of population while preserving top 20%.
        This injects diversity when stagnation is detected.
        """
        preserve_count = max(1, int(self.config["popSize"] * 0.2))
        preserved = self.test_suite[:preserve_count]

        new_individuals = []
        modes = ["valid", "boundary", "invalid", "valid"]
        while len(new_individuals) < (self.config["popSize"] - preserve_count):
            record = {}
            mode = modes[len(new_individuals) % len(modes)]
            for field in self.schema:
                record[field["name"]] = generate_random_field_value(field, mode)
            new_individuals.append({
                "values": record,
                "fitness": 0.0,
                "origin": "Restart"
            })

        self.test_suite = preserved + new_individuals

    # ═══════════════════════════════════════════════════════════
    # GENERATION LOOP
    # ═══════════════════════════════════════════════════════════

    def evolve_one_generation(self):
        """
        Tiến hóa bộ dữ liệu test thêm 1 thế hệ (Generation Loop).

        UPGRADES:
        - Stagnation detection & restart
        - Hall of fame integration
        - Full-population coverage + pairwise tracking
        - Selected/Crossover/Mutation counters for real-time UI reporting
        """
        self.generation += 1
        next_suite = []

        # --- STAGNATION DETECTION ---
        if self._is_stagnated():
            self._restart_population()
            self._best_fitness_history = []
            self.evaluate_suite()

        # 1. Elitism: Giữ nguyên 5% các Test Cases xuất sắc nhất
        elite_size = max(1, int(self.config["popSize"] * 0.05))
        for i in range(elite_size):
            next_suite.append({
                "values": {**self.test_suite[i]["values"]},
                "fitness": self.test_suite[i]["fitness"],
                "origin": "Elite"
            })

        # Track operation counts per generation
        crossover_count = 0
        mutation_count = 0

        # 2. Sinh các Test Cases con thông qua Crossover & Mutation
        while len(next_suite) < self.config["popSize"]:
            p1 = self.select_parent()
            p2 = self.select_parent()

            c1, c2 = self.mix_testcases(p1, p2)
            c1_mut, m1 = self.tweak_values(c1)
            c2_mut, m2 = self.tweak_values(c2)

            if not m1:
                crossover_count += 1
            else:
                mutation_count += 1

            next_suite.append({
                "values": c1_mut,
                "fitness": 0.0,
                "origin": "Mutation" if m1 else "Crossover"
            })

            if len(next_suite) < self.config["popSize"]:
                if not m2:
                    crossover_count += 1
                else:
                    mutation_count += 1
                next_suite.append({
                    "values": c2_mut,
                    "fitness": 0.0,
                    "origin": "Mutation" if m2 else "Crossover"
                })

        # 3. Thay đổi bộ dữ liệu test và tái chấm điểm
        self.test_suite = next_suite
        self.evaluate_suite()

        # Track best fitness for stagnation detection
        best_fit = self.test_suite[0]["fitness"]
        self._best_fitness_history.append(best_fit)
        if len(self._best_fitness_history) > 50:
            self._best_fitness_history = self._best_fitness_history[-50:]

        avg_fit = sum(ind["fitness"] for ind in self.test_suite) / len(self.test_suite)

        # 4. Tính toán thống kê lượt tiến hóa
        dup_rate = self._compute_duplicate_rate()
        coverage = self._compute_full_coverage()

        # Số cá thể thích nghi tốt được giữ lại (fitness >= ngưỡng thích nghi)
        threshold = 0.40 + min(self.generation / self.max_generations, 1.0) * 0.20
        selected_count = sum(1 for ind in self.test_suite if ind["fitness"] >= threshold)

        return {
            "generation": self.generation,
            "bestFitness": best_fit,
            "avgFitness": avg_fit,
            "coverage": coverage,
            "duplicateRate": dup_rate,
            "selected": selected_count,
            "crossover": crossover_count,
            "mutation": mutation_count,
            "test_cases": [
                {"values": p["values"], "fitness": p["fitness"], "origin": p["origin"]}
                for p in self.test_suite[:10]
            ]
        }


    # ═══════════════════════════════════════════════════════════
    # COVERAGE CALCULATION (full population + pairwise)
    # ═══════════════════════════════════════════════════════════

    def _compute_duplicate_rate(self):
        dup_count = 0
        raw_values = [ind["values"] for ind in self.test_suite]
        for i in range(len(raw_values)):
            is_dup = False
            for j in range(i):
                if all(str(raw_values[i][k]) == str(raw_values[j].get(k, "")) for k in raw_values[i].keys()):
                    is_dup = True
                    break
            if is_dup:
                dup_count += 1
        return dup_count / self.config["popSize"]

    def _compute_full_coverage(self):
        """
        UPGRADED coverage calculation:
        - Uses ENTIRE population (not just top 10)
        - Tracks pairwise field combinations
        - Accounts for duplicate rate
        """
        raw_values = [ind["values"] for ind in self.test_suite]

        # --- 1. Individual field coverage (full population) ---
        total_valid = 0
        boundaries_checked = set()

        for tc in raw_values:
            for field in self.schema:
                name = field["name"]
                val = tc.get(name)
                val_str = str(val)

                is_ok = True
                if field.get("required") and (val is None or val_str == ""):
                    is_ok = False

                if is_ok:
                    total_valid += 1

                    # Boundary check (exact + near)
                    if field["type"] == "number":
                        try:
                            num = float(val)
                            if field.get("minValue") is not None and num == field["minValue"]:
                                boundaries_checked.add(f"{name}_min")
                            if field.get("maxValue") is not None and num == field["maxValue"]:
                                boundaries_checked.add(f"{name}_max")
                            if field.get("minValue") is not None and num == field["minValue"] + 1:
                                boundaries_checked.add(f"{name}_min_near")
                            if field.get("maxValue") is not None and num == field["maxValue"] - 1:
                                boundaries_checked.add(f"{name}_max_near")
                        except (ValueError, TypeError):
                            pass
                    else:
                        if field.get("minLength") is not None and len(val_str) == field["minLength"]:
                            boundaries_checked.add(f"{name}_min")
                        if field.get("maxLength") is not None and len(val_str) == field["maxLength"]:
                            boundaries_checked.add(f"{name}_max")
                        if field.get("minLength") is not None and len(val_str) == field["minLength"] + 1:
                            boundaries_checked.add(f"{name}_min_near")
                        if field.get("maxLength") is not None and len(val_str) == field["maxLength"] - 1:
                            boundaries_checked.add(f"{name}_max_near")



        total_cases = len(raw_values)
        max_valid = total_cases * len(self.schema)
        val_factor = total_valid / max_valid if max_valid > 0 else 0

        possible_bounds = len(self.schema) * 4  # 2 exact + 2 near per field
        bound_factor = len(boundaries_checked) / possible_bounds if possible_bounds > 0 else 0

        # --- 2. Pairwise combination coverage ---
        pairwise_coverage = self._compute_pairwise_coverage(raw_values)

        # --- 3. Composite coverage ---
        # 60% validation + 20% boundary + 20% pairwise
        coverage = min(
            (val_factor * 0.60) + (bound_factor * 0.20) + (pairwise_coverage * 0.20),
            1.0
        )

        # Discount by duplicate rate
        dup_rate = self._compute_duplicate_rate()
        if dup_rate > 0.3:
            coverage *= (1.0 - (dup_rate - 0.3) * 0.5)

        return max(coverage, 0.01)

    def _compute_pairwise_coverage(self, raw_values):
        """
        Tính toán độ bao phủ cặp đôi thực tế (Pairwise Coverage).
        Đếm số lượng tổ hợp cặp (field_i = category_i, field_j = category_j) 
        được bao phủ bởi quần thể hiện tại, đối chiếu với tổng số cặp phân loại khả thi (Cartesian Product).
        """
        if len(self.schema) < 2:
            return 1.0

        # Build category map for each field value
        def categorize_value(field, val):
            val_str = str(val)
            if val is None or val_str == '' or val_str == 'None':
                return 'empty'
            if field["type"] == "number":
                try:
                    num = float(val)
                    min_v = field.get("minValue")
                    max_v = field.get("maxValue")
                    if min_v is not None and num == min_v:
                        return 'boundary_min'
                    if max_v is not None and num == max_v:
                        return 'boundary_max'
                    if min_v is not None and num < min_v:
                        return 'invalid_low'
                    if max_v is not None and num > max_v:
                        return 'invalid_high'
                    return 'valid'
                except (ValueError, TypeError):
                    return 'invalid'
            else:
                min_l = field.get("minLength")
                max_l = field.get("maxLength")
                s_len = len(val_str)
                if min_l is not None and s_len == min_l:
                    return 'boundary_min'
                if max_l is not None and s_len == max_l:
                    return 'boundary_max'
                if min_l is not None and s_len < min_l:
                    return 'invalid_short'
                if max_l is not None and s_len > max_l:
                    return 'invalid_long'
                return 'valid'

        # Xác định tập danh mục phân loại khả thi của một trường ràng buộc nghiệp vụ
        def get_possible_categories(field):
            cats = ["empty", "valid"]
            if field["type"] == "number":
                cats.append("invalid")
                if field.get("minValue") is not None:
                    cats.extend(["boundary_min", "invalid_low"])
                if field.get("maxValue") is not None:
                    cats.extend(["boundary_max", "invalid_high"])
            else:
                if field.get("minLength") is not None:
                    cats.extend(["boundary_min", "invalid_short"])
                if field.get("maxLength") is not None:
                    cats.extend(["boundary_max", "invalid_long"])
            return cats

        # Collect all pairs covered
        covered_pairs = set()
        total_possible_pairs = 0

        for i in range(len(self.schema)):
            for j in range(i + 1, len(self.schema)):
                fi = self.schema[i]
                fj = self.schema[j]

                for tc in raw_values:
                    cat_i = categorize_value(fi, tc.get(fi["name"], ""))
                    cat_j = categorize_value(fj, tc.get(fj["name"], ""))
                    covered_pairs.add((fi["name"], cat_i, fj["name"], cat_j))

        # Tính toán chính xác tổng số cặp phân loại khả thi dựa trên tích Đề-các (Cartesian Product)
        for i in range(len(self.schema)):
            for j in range(i + 1, len(self.schema)):
                cats_i = get_possible_categories(self.schema[i])
                cats_j = get_possible_categories(self.schema[j])
                total_possible_pairs += len(cats_i) * len(cats_j)

        return min(len(covered_pairs) / max(total_possible_pairs, 1), 1.0)

    # ═══════════════════════════════════════════════════════════
    # TEST CASE MINIMIZATION
    # ═══════════════════════════════════════════════════════════

    def minimize_testcases(self, test_cases, target_coverage=0.95):
        """
        Greedy test case minimization: loại bỏ test case dư thừa
        trong khi vẫn giữ coverage tối đa.

        Priority order: security > boundary > negative > positive
        """
        if len(test_cases) <= 1:
            return {"minimized": list(test_cases), "removed": 0, "final_coverage": 1.0}

        # Categorize
        categorized = []
        for idx, tc in enumerate(test_cases):
            cat = self._categorize_testcase(tc)
            categorized.append({"tc": tc, "idx": idx, "category": cat})

        priority = {"boundary": 0, "negative": 1, "positive": 2, "happy": 2}
        categorized.sort(key=lambda x: priority.get(x["category"], 3))

        selected = []
        selected_idx = set()
        fingerprints = set()

        # Pass 1: ensure at least one per category
        for cat in ["boundary", "negative", "positive", "happy"]:
            for c in categorized:
                if c["category"] == cat and c["idx"] not in selected_idx:
                    fp = str(sorted(c["tc"].items()))
                    if fp not in fingerprints:
                        fingerprints.add(fp)
                        selected.append(c["tc"])
                        selected_idx.add(c["idx"])
                        break

        # Pass 2: greedy by unique coverage contribution
        for item in categorized:
            if item["idx"] in selected_idx:
                continue

            fp = str(sorted(item["tc"].items()))
            if fp in fingerprints:
                continue

            # Check if adds new boundary/security coverage
            adds = False
            for field in self.schema:
                name = field["name"]
                val = item["tc"].get(name)
                val_str = str(val)

                if field["type"] == "number":
                    try:
                        num = float(val)
                        if field.get("minValue") is not None and num == field["minValue"]:
                            if not any(abs(safe_float(s.get(name, 0)) - num) < 0.001 for s in selected):
                                adds = True
                        if field.get("maxValue") is not None and num == field["maxValue"]:
                            if not any(abs(safe_float(s.get(name, 0)) - num) < 0.001 for s in selected):
                                adds = True
                    except (ValueError, TypeError):
                        pass
                else:
                    if field.get("minLength") is not None and len(val_str) == field["minLength"]:
                        if not any(len(str(s.get(name, ""))) == field["minLength"] for s in selected):
                            adds = True
                    if field.get("maxLength") is not None and len(val_str) == field["maxLength"]:
                        if not any(len(str(s.get(name, ""))) == field["maxLength"] for s in selected):
                            adds = True



            if adds:
                fingerprints.add(fp)
                selected.append(item["tc"])
                selected_idx.add(item["idx"])

        # Pass 3: fill diverse cases up to 50% of original
        max_keep = max(5, len(test_cases) // 2)
        for item in categorized:
            if item["idx"] in selected_idx:
                continue
            if len(selected) >= max_keep:
                break
            fp = str(sorted(item["tc"].items()))
            if fp not in fingerprints:
                fingerprints.add(fp)
                selected.append(item["tc"])
                selected_idx.add(item["idx"])

        final_cov = self._compute_coverage_for_set(selected) if selected else 0

        return {
            "minimized": selected,
            "removed": len(test_cases) - len(selected),
            "final_coverage": final_cov
        }

    def _categorize_testcase(self, tc):
        """Phân loại test case: boundary, negative, positive."""
        has_invalid = False
        has_boundary = False

        for field in self.schema:
            name = field["name"]
            val = tc.get(name)
            if val is None:
                if field.get("required"):
                    has_invalid = True
                continue

            val_str = str(val)
            is_valid = True

            if field.get("required") and val_str == "":
                is_valid = False
            if is_valid and field["type"] == "email":
                if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", val_str):
                    is_valid = False
            elif is_valid and field["type"] == "card":
                if not re.match(r"^\d{16}$", val_str):
                    is_valid = False
            elif is_valid and field["type"] == "phone":
                if not re.match(r"^(03|05|07|08|09)\d{8}$", val_str):
                    is_valid = False
            elif is_valid and field["type"] == "number":
                try:
                    num = float(val)
                    if field.get("minValue") is not None and num < field["minValue"]:
                        is_valid = False
                    if field.get("maxValue") is not None and num > field["maxValue"]:
                        is_valid = False
                    if is_valid:
                        if field.get("minValue") is not None and num == field["minValue"]:
                            has_boundary = True
                        if field.get("maxValue") is not None and num == field["maxValue"]:
                            has_boundary = True
                except (ValueError, TypeError):
                    is_valid = False

            if is_valid and field["type"] not in ["number"]:
                if field.get("minLength") is not None and len(val_str) < field["minLength"]:
                    is_valid = False
                if field.get("maxLength") is not None and len(val_str) > field["maxLength"]:
                    is_valid = False
                if is_valid:
                    if field.get("minLength") is not None and len(val_str) == field["minLength"]:
                        has_boundary = True
                    if field.get("maxLength") is not None and len(val_str) == field["maxLength"]:
                        has_boundary = True

            if not is_valid:
                has_invalid = True

        if has_invalid:
            return "negative"
        if has_boundary:
            return "boundary"
        return "positive"

    def _compute_coverage_for_set(self, test_cases):
        """Tính coverage cho một tập test case bất kỳ."""
        total_valid = 0
        boundaries_checked = set()

        for tc in test_cases:
            for field in self.schema:
                name = field["name"]
                val = tc.get(name)
                val_str = str(val)

                is_ok = True
                if field.get("required") and (val is None or val_str == ""):
                    is_ok = False
                if is_ok:
                    total_valid += 1
                    if field["type"] == "number":
                        try:
                            num = float(val)
                            if field.get("minValue") is not None and num == field["minValue"]:
                                boundaries_checked.add(f"{name}_min")
                            if field.get("maxValue") is not None and num == field["maxValue"]:
                                boundaries_checked.add(f"{name}_max")
                        except (ValueError, TypeError):
                            pass
                    else:
                        if field.get("minLength") is not None and len(val_str) == field["minLength"]:
                            boundaries_checked.add(f"{name}_min")
                        if field.get("maxLength") is not None and len(val_str) == field["maxLength"]:
                            boundaries_checked.add(f"{name}_max")

        total_cases = len(test_cases)
        max_valid = total_cases * len(self.schema)
        val_factor = total_valid / max_valid if max_valid > 0 else 0

        possible_bounds = len(self.schema) * 2
        bound_factor = len(boundaries_checked) / possible_bounds if possible_bounds > 0 else 0

        return min((val_factor * 0.7) + (bound_factor * 0.3), 1.0)
