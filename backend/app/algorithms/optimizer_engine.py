import random
import uuid
from ..engines.fitness_engine import evaluate_individual_fitness
import re
import string
import math
import datetime

# =========================================================================
# [HỖ TRỢ KIỂU NGÀY - DATE SUPPORT]
# Định dạng chuẩn ISO YYYY-MM-DD. Dùng chung cho sinh giá trị, validate và
# chấm biên để KHÔNG hard-code rời rạc -> đặc tả có field date được xử lý đúng.
# =========================================================================
ISO_DATE_RE = r"^\d{4}-\d{2}-\d{2}$"


def is_valid_iso_date(val_str):
    """True nếu chuỗi đúng định dạng YYYY-MM-DD VÀ là ngày lịch hợp lệ."""
    if not isinstance(val_str, str) or not re.match(ISO_DATE_RE, val_str):
        return False
    try:
        datetime.date.fromisoformat(val_str)
        return True
    except ValueError:
        return False


def is_boundary_date(val_str):
    """Biên ngày kinh điển (BVA): đầu/cuối tháng, ngày nhuận 29/02, đầu/cuối năm."""
    if not is_valid_iso_date(val_str):
        return False
    d = datetime.date.fromisoformat(val_str)
    # Ngày cuối tháng
    if d.month == 12:
        next_month_first = datetime.date(d.year + 1, 1, 1)
    else:
        next_month_first = datetime.date(d.year, d.month + 1, 1)
    last_day = (next_month_first - datetime.timedelta(days=1)).day
    if d.day == 1 or d.day == last_day:
        return True
    if d.month == 2 and d.day == 29:  # ngày nhuận
        return True
    if (d.month, d.day) in [(1, 1), (12, 31)]:  # đầu/cuối năm
        return True
    return False


def random_valid_date():
    """Sinh một ngày hợp lệ ngẫu nhiên dạng YYYY-MM-DD."""
    y = random.randint(1971, 2030)
    m = random.randint(1, 12)
    is_leap = (y % 4 == 0 and (y % 100 != 0 or y % 400 == 0))
    days_in_month = [31, 29 if is_leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    d = random.randint(1, days_in_month[m - 1])
    return f"{y:04d}-{m:02d}-{d:02d}"

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
        if mode in ("invalid", "ep_invalid"):
            return random.choice(["invalid-email", "name@", "@domain.com", "name@domain."])
        if mode == "boundary":
            return f"a@{'b' * 100}.com" # độ dài email cực lớn
        if mode == "ep_valid":
            return "standard.user@example.com"
        names = ["emma", "liam", "olivia", "noah", "will", "sophia", "james"]
        domains = ["gmail.com", "yahoo.com", "outlook.com", "test.io", "company.vn"]
        return f"{random.choice(names)}{random.randint(10, 99)}@{random.choice(domains)}"

    elif f_type == "card":
        if mode in ("invalid", "ep_invalid"):
            return "1234-5678-9012" # sai cấu trúc thẻ 16 số viết liền
        if mode == "boundary":
            return "0" * 16 # biên số 0 nhỏ nhất
        if mode == "ep_valid":
            return "1234567890123456"
        return "".join(str(random.randint(0, 9)) for _ in range(16))

    elif f_type == "phone":
        prefixes = ["03", "05", "07", "08", "09"]
        if mode in ("invalid", "ep_invalid"):
            return "0281234567" # sai đầu số di động VN
        if mode == "boundary":
            return "0900000000"
        if mode == "ep_valid":
            return "0987654321"
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
            if mode in ("invalid", "ep_invalid"):
                return min_v - 50.0 if random.random() > 0.5 else max_v + 50.0
            if mode == "boundary":
                return min_v if random.random() > 0.5 else max_v
            if mode == "ep_valid":
                return (min_v + max_v) / 2.0
            return random.uniform(min_v, max_v)
        else:
            min_i = int(min_v)
            max_i = int(max_v)
            if mode in ("invalid", "ep_invalid"):
                return min_i - 50 if random.random() > 0.5 else max_i + 50
            if mode == "boundary":
                return min_i if random.random() > 0.5 else max_i
            if mode == "ep_valid":
                return (min_i + max_i) // 2
            return random.randint(min_i, max_i)

    elif f_type == "date":
        if field.get("allowedValues") and mode not in ("invalid", "ep_invalid"):
            return random.choice(field["allowedValues"])
        if mode in ("invalid", "ep_invalid"):
            return random.choice([
                "2024-13-01", "2024-00-10", "2024-02-30", "not-a-date",
                "2024/01/01", "20240101", "2024-1-1", "01-01-2024"
            ])
        if mode == "boundary":
            return random.choice([
                "2024-02-29", "2020-01-01", "2023-12-31", "2024-04-30", "2021-02-28"
            ])
        if mode == "ep_valid":
            return "2024-06-15"
        return random_valid_date()

    else: # type == string
        if field.get("allowedValues"):
            if mode in ("invalid", "ep_invalid"):
                return "INVALID_VAL"
            return random.choice(field["allowedValues"])

        min_l = int(field.get("minLength", 3) or 3)
        max_l = int(field.get("maxLength", 20) or 20)

        length = random.randint(min_l, max_l)
        if mode in ("invalid", "ep_invalid"):
            length = max(0, min_l - 10) if random.random() > 0.5 else max_l + 10
        elif mode == "boundary":
            length = min_l if random.random() > 0.5 else max_l
        elif mode == "ep_valid":
            length = (min_l + max_l) // 2

        if length <= 0:
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

    def evaluate_testcase_quality(self, test_case, current_suite_values, global_tag_counts=None):
        """
        Đánh giá chất lượng của một Test Case (Hàm Fitness) - PHIÊN BẢN NÂNG CẤP.

        Kiến trúc 2 component tách biệt:
          Component 1: coverage_fitness = coverage_base + novelty (đo độ bao phủ & đa dạng)
          Component 2: boundary_fitness = trọng số BVA tăng cường (đo mức độ tập trung biên)

        Công thức cuối: fitness = 0.55 * norm_coverage + 0.45 * norm_boundary
        Normalize về [0, 1] để HC nhận biết được Δ rất nhỏ.

        Boundary weights:
          BOUNDARY (exact)   → +3.0  (tăng từ +1.0 — phần thưởng chính)
          NEAR_BOUNDARY      → +1.5  (thêm mới — khuyến khích tiến gần biên)
          INVALID (negative) → +0.5  (giữ nguyên — test case âm cũng có giá trị)
        """
        from .coverage_analyzer import analyze_coverage

        # 1. Coverage Tags
        tags = analyze_coverage(test_case, self.schema)

        # ── Component 1: Coverage Fitness ──────────────────────────────────────
        # 1a. Base coverage: mỗi tag = 1 điểm
        base_coverage = float(len(tags))

        # 1b. Novelty Score (tag hiếm gặp = điểm cao hơn)
        novelty_score = 0.0
        if global_tag_counts:
            pop_size = max(1, len(current_suite_values))
            for tag in tags:
                count = global_tag_counts.get(tag, 1)
                rarity = 1.0 - (count / pop_size)
                novelty_score += max(0.0, rarity)
        else:
            novelty_score = len(tags) * 0.5  # fallback khi chưa có global_tag_counts

        coverage_raw = base_coverage + (novelty_score * 2.0)

        # ── Component 2: Boundary Fitness (tăng độ nhạy) ────────────────────────
        boundary_raw = 0.0
        for tag in tags:
            outcome = tag.split(":")[-1] if ":" in tag else ""
            tag_upper = tag.upper()
            if "NEAR_BOUNDARY" in tag_upper:
                boundary_raw += 1.5   # gần biên — thêm mới
            elif "BOUNDARY" in tag_upper:
                boundary_raw += 3.0   # đúng biên — tăng từ 1.0
            elif "INVALID" in tag_upper:
                boundary_raw += 0.5   # test case âm — giữ nguyên

        # ── Normalize về [0, 1] ─────────────────────────────────────────────────
        # max_possible_coverage = num_tags * (1 + 2.0) [base + max novelty]
        # max_possible_boundary = num_tags * 3.0
        num_tags = max(1, len(tags))
        max_coverage = num_tags * 3.0
        max_boundary = num_tags * 3.0

        norm_coverage = min(coverage_raw / max_coverage, 1.0)
        norm_boundary = min(boundary_raw / max_boundary, 1.0)

        # ── Tổng hợp Fitness ────────────────────────────────────────────────────
        fitness = 0.55 * norm_coverage + 0.45 * norm_boundary

        # Duplicate Penalty (nhẹ hơn vì đã normalize)
        dup_count = sum(
            1 for other in current_suite_values
            if all(str(test_case.get(k["name"])) == str(other.get(k["name"])) for k in self.schema)
        )
        if dup_count > 1:
            fitness -= (dup_count - 1) * 0.05  # penalty nhỏ hơn sau normalize

        return max(0.001, min(fitness, 1.0))



    def evaluate_suite(self):
        from .coverage_analyzer import analyze_coverage
        raw_values = [ind["values"] for ind in self.test_suite]
        
        # Tính Global Tag Counts cho thế hệ hiện tại
        global_tag_counts = {}
        for ind in self.test_suite:
            tags = analyze_coverage(ind["values"], self.schema)
            ind["coverage_tags"] = tags
            for tag in set(tags):
                global_tag_counts[tag] = global_tag_counts.get(tag, 0) + 1
                
        # Đánh giá fitness với Novelty
        for ind in self.test_suite:
            ind["fitness"] = self.evaluate_testcase_quality(ind["values"], raw_values, global_tag_counts)

        self.test_suite.sort(key=lambda x: x["fitness"], reverse=True)
        self._update_hall_of_fame()

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
                "id": str(uuid.uuid4()),
                "parent_id": None,
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
                "id": str(uuid.uuid4()),
                "parent_id": None,
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
                "id": ind.get("id", str(uuid.uuid4())),
                "parent_id": ind.get("parent_id"),
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
                "id": str(uuid.uuid4()),
                "parent_id": None,
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
                    "id": ind.get("id"),
                    "parent_id": ind.get("parent_id"),
                    "values": ind["values"],
                    "fitness": ind["fitness"],
                    "origin": ind["origin"]
                }
                for ind in self.test_suite
            ],
            "hall_of_fame": self.hall_of_fame,
            "config": self.config,
        }

    # ═══════════════════════════════════════════════════════════
    # LẮP RÁP KẾT QUẢ CUỐI CÙNG (CURATED OUTPUT)
    # ═══════════════════════════════════════════════════════════

    def assemble_optimized_dataset(self, original_seeds=None, target_size=None, max_size=None):
        """
        Lắp ráp bộ kết quả tối ưu CUỐI CÙNG một cách "chặt chẽ" thay vì trả về
        nguyên quần thể thô (vốn đầy con lai/đột biến chất lượng thấp).

        Quy trình:
          1. Gom ứng viên = quần thể cuối + Hall of Fame (tốt nhất xuyên các thế hệ)
             + seed F0 gốc (dùng làm SÀN chất lượng).
          2. Khử trùng lặp theo dấu vân tay giá trị.
          3. Sắp theo fitness giảm dần để khâu tinh gọn ưu tiên cá thể tốt.
          4. Lấy LÕI coverage bằng minimize_testcases (giữ phủ biên/âm/dương).
          5. BÙ thêm (top-up) các cá thể tốt nhất còn lại cho tới khi đạt target_size,
             để bộ trả về không bị quá ít so với kích thước quần thể người dùng cấu hình.

        Nhờ Hall of Fame lưu cả thế hệ 0 (chứa seed) nên cá thể tốt nhất trả về
        LUÔN >= seed tốt nhất ban đầu => kết quả không bao giờ tệ hơn dữ liệu LLM.

        Tham số:
          - target_size: số bản ghi mong muốn (mặc định = popSize cấu hình). Bộ trả về
            sẽ được bù lên xấp xỉ giá trị này nếu còn đủ cá thể duy nhất.
          - max_size: trần cứng số bản ghi trả về (nếu cần giới hạn).

        Trả về list dict {"values", "fitness", "origin"} sắp theo fitness giảm dần.
        """
        if target_size is None:
            target_size = self.config.get("popSize")
        raw_values = [ind["values"] for ind in self.test_suite]

        pool = []
        seen = set()

        def _fingerprint(values):
            return str(sorted((k, str(v)) for k, v in values.items()))

        def _add(values, fitness, origin, id_val=None, parent_id_val=None):
            fp = _fingerprint(values)
            if fp in seen:
                return
            seen.add(fp)
            pool.append({"id": id_val or str(uuid.uuid4()), "parent_id": parent_id_val, "values": values, "fitness": fitness, "origin": origin})

        # 1. Quần thể cuối cùng
        for ind in self.test_suite:
            _add(ind["values"], ind["fitness"], ind["origin"], ind.get("id"), ind.get("parent_id"))

        # 2. Hall of Fame
        for hof in self.hall_of_fame:
            _add(hof["values"], hof.get("fitness", 0.0), hof.get("origin", "HallOfFame"), hof.get("id"), hof.get("parent_id"))

        # 3. Seed F0 gốc làm SÀN chất lượng
        if original_seeds:
            for s in original_seeds:
                cleaned = {}
                for field in self.schema:
                    name = field["name"]
                    cleaned[name] = s[name] if name in s else generate_random_field_value(field, "valid")
                fit = self.evaluate_testcase_quality(cleaned, raw_values)
                _add(cleaned, fit, "Seed_F0")

        # Sắp theo fitness giảm dần (minimize ưu tiên cá thể đứng trước trong mỗi nhóm)
        pool.sort(key=lambda x: x["fitness"], reverse=True)

        # 4. Lấy LÕI coverage (giữ phủ biên/âm/dương, loại dư thừa)
        values_list = [p["values"] for p in pool]
        result = self.minimize_testcases(values_list)
        minimized = result["minimized"]

        # Gắn lại fitness/origin theo dấu vân tay
        meta_map = {_fingerprint(p["values"]): p for p in pool}
        enriched = []
        selected_fps = set()
        for tc in minimized:
            fp = _fingerprint(tc)
            selected_fps.add(fp)
            meta = meta_map.get(fp, {"fitness": 0.0, "origin": "Optimized"})
            enriched.append({
                "id": meta.get("id", str(uuid.uuid4())),
                "parent_id": meta.get("parent_id"),
                "values": tc,
                "fitness": meta["fitness"],
                "origin": meta["origin"]
            })

        # 5. BÙ lên target_size từ các cá thể tốt nhất còn lại (pool đã sắp theo fitness,
        #    đã khử trùng) -> tránh trả về quá ít bản ghi.
        if target_size and len(enriched) < target_size:
            for p in pool:
                if len(enriched) >= target_size:
                    break
                fp = _fingerprint(p["values"])
                if fp in selected_fps:
                    continue
                selected_fps.add(fp)
                enriched.append({
                    "id": p.get("id", str(uuid.uuid4())),
                    "parent_id": p.get("parent_id"),
                    "values": p["values"],
                    "fitness": p["fitness"],
                    "origin": p["origin"]
                })

        enriched.sort(key=lambda x: x["fitness"], reverse=True)
        if max_size:
            enriched = enriched[:max_size]

        return enriched

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
                    "id": ind.get("id", str(uuid.uuid4())),
                    "parent_id": ind.get("parent_id"),
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
        return candidates[0]

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
        
        from .policy_registry import resolve_policy

        for field in self.schema:
            name = field["name"]
            policy = resolve_policy(field)
            
            # FREEZE: Không bao giờ mutate
            if policy == "freeze":
                continue
                
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

                elif field["type"] in ["email", "card", "phone"] or field.get("semantic_type") in ["email", "card", "phone"]:
                    ftype = field["type"] if field["type"] in ["email", "card", "phone"] else field.get("semantic_type")
                    if ftype == "email":
                        if rand < 0.45:
                            parts = val_str.split("@")
                            if len(parts) == 2:
                                mutated_tc[name] = parts[0] + str(random.randint(0,9)) + "@" + parts[1]
                            else:
                                mutated_tc[name] = val_str + str(random.randint(0,9))
                        elif rand < 0.80:
                            parts = val_str.split("@")
                            if len(parts) == 2:
                                target = field.get("maxLength")
                                if not target:
                                    target = 50
                                mutated_tc[name] = parts[0][:target].ljust(target, 'a') + "@" + parts[1]
                            else:
                                mutated_tc[name] = val_str.ljust(50, 'a')
                        else:
                            mutated_tc[name] = val_str.replace("@", "") if "@" in val_str else val_str + "@"
                    elif ftype == "phone":
                        if rand < 0.45:
                            mutated_tc[name] = val_str[:-1] + str(random.randint(0,9)) if len(val_str) > 0 else "0987654321"
                        elif rand < 0.80:
                            mutated_tc[name] = val_str.ljust(11, '0')
                        else:
                            mutated_tc[name] = val_str + "a"
                    elif ftype == "card":
                        if rand < 0.45:
                            mutated_tc[name] = val_str[:-1] + str(random.randint(0,9)) if len(val_str) > 0 else "1234567890123456"
                        elif rand < 0.80:
                            mutated_tc[name] = val_str.ljust(16, '0')
                        else:
                            mutated_tc[name] = val_str + "X"

                elif field.get("semantic_type") == "password" or field["type"] == "string":
                    # NÂNG CẤP: DYNAMIC CONSTRAINT-AWARE MUTATION
                    if field.get("allowedValues"):
                        # ENUM-SAFE: luôn chọn giá trị hợp lệ trong allowedValues
                        current_vals = [str(v) for v in field["allowedValues"]]
                        others = [v for v in current_vals if v != val_str]
                        mutated_tc[name] = random.choice(others) if others else val_str
                    elif field.get("regex"):
                        if rand < 0.5:
                            mutated_tc[name] = val_str.swapcase()
                        elif rand < 0.8:
                            mutated_tc[name] = val_str + "@@"
                        else:
                            mutated_tc[name] = val_str.replace("@", "") if "@" in val_str else "!" + val_str
                    else:
                        if rand < 0.3:
                            mutated_tc[name] = val_str[:-1] + ("1" if len(val_str) > 0 and val_str[-1].isalpha() else "a") if len(val_str) > 0 else "a"
                        elif rand < 0.6:
                            target = field.get("maxLength", 20)
                            if len(val_str) < target:
                                repeats = (target // max(1, len(val_str))) + 1
                                mutated_tc[name] = (val_str * repeats)[:target]
                            else:
                                mutated_tc[name] = val_str
                        elif rand < 0.8:
                            target = field.get("maxLength", 20)
                            mutated_tc[name] = val_str.ljust(target + 1, "X")
                        else:
                            mutated_tc[name] = ""
                            
                elif field["type"] == "date":
                    # Đột biến ngày: sinh lại ngày hợp lệ / biên / sai định dạng
                    if rand < 0.45:
                        mutated_tc[name] = generate_random_field_value(field, "valid")
                    elif rand < 0.80:
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
                    elif field.get("regex"):
                        # Bảo vệ Regex: Không đột biến bằng ký tự ngẫu nhiên tránh vỡ format
                        if rand < 0.2:
                            mutated_tc[name] = generate_random_field_value(field, "boundary")
                        else:
                            is_mutated = False # Giữ nguyên gốc
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
                "id": str(uuid.uuid4()),
                "parent_id": None,
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
                "id": self.test_suite[i].get("id", str(uuid.uuid4())),
                "parent_id": self.test_suite[i].get("parent_id"),
                "values": {**self.test_suite[i]["values"]},
                "fitness": self.test_suite[i]["fitness"],
                "origin": "Elite"
            })

        # Track operation counts per generation
        crossover_count = 0
        mutation_count = 0

        # 2. Sinh các Test Cases con thông qua Crossover & Mutation
        while len(next_suite) < self.config["popSize"]:
            p1_ind = self.select_parent()
            p2_ind = self.select_parent()

            c1, c2 = self.mix_testcases(p1_ind["values"], p2_ind["values"])
            c1_mut, m1 = self.tweak_values(c1)
            c2_mut, m2 = self.tweak_values(c2)

            if not m1:
                crossover_count += 1
            else:
                mutation_count += 1

            next_suite.append({
                "id": str(uuid.uuid4()),
                "parent_id": p1_ind.get("id"),
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
                    "id": str(uuid.uuid4()),
                    "parent_id": p2_ind.get("id"),
                    "values": c2_mut,
                    "fitness": 0.0,
                    "origin": "Mutation" if m2 else "Crossover"
                })

        # 3. Thay đổi bộ dữ liệu test và tái chấm điểm
        # 3a. Enum Constraint Repair: đảm bảo các trường Enum không bị biến dạng
        from .enum_constraint_validator import repair_population_enums
        next_suite, enum_violations = repair_population_enums(next_suite, self.schema)
        self._last_enum_violations = enum_violations
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
                {"id": p.get("id"), "parent_id": p.get("parent_id"), "values": p["values"], "fitness": p["fitness"], "origin": p["origin"]}
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
                    elif field["type"] == "date":
                        if is_boundary_date(val_str):
                            boundaries_checked.add(f"{name}_min")
                            boundaries_checked.add(f"{name}_max")
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
            elif field["type"] == "date":
                if not is_valid_iso_date(val_str):
                    return 'invalid'
                if is_boundary_date(val_str):
                    return 'boundary_min'
                return 'valid'
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
            elif field["type"] == "date":
                cats.extend(["invalid", "boundary_min"])
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
            field_regex = field.get("regex")
            if is_valid and field_regex:
                # Regex của đặc tả là ràng buộc cứng (đồng bộ với hàm fitness)
                try:
                    if not re.search(field_regex, val_str):
                        is_valid = False
                except re.error:
                    pass
            elif is_valid and field["type"] == "email":
                if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", val_str):
                    is_valid = False
            elif is_valid and field["type"] == "card":
                if not re.match(r"^\d{16}$", val_str):
                    is_valid = False
            elif is_valid and field["type"] == "phone":
                if not re.match(r"^(03|05|07|08|09)\d{8}$", val_str):
                    is_valid = False
            elif is_valid and field["type"] == "date":
                if not is_valid_iso_date(val_str):
                    is_valid = False
                elif is_boundary_date(val_str):
                    has_boundary = True
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

            if is_valid and field["type"] not in ["number", "date"]:
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
                    elif field["type"] == "date":
                        if is_boundary_date(val_str):
                            boundaries_checked.add(f"{name}_min")
                            boundaries_checked.add(f"{name}_max")
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
