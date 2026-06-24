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
def extract_domain_vocab(seeds, schema):
    vocab = {"product": [], "desc": []}
    if not seeds: return vocab
    for s in seeds:
        vals = s.get("values", s)
        for field in schema:
            fname = field["name"].lower()
            val = vals.get(field["name"])
            if not isinstance(val, str) or not val: continue
            if "product" in fname or "item" in fname: vocab["product"].append(val)
            elif "desc" in fname or "note" in fname: vocab["desc"].append(val)
    vocab["product"] = list(set(vocab["product"]))
    vocab["desc"] = list(set(vocab["desc"]))
    return vocab

def generate_random_field_value(field, mode="valid", domain_vocab=None):
    special_chars = ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "-", "_", "+", "=", "[", "]", "{", "}", ";", ":", "'", '"', "<", ">", "/", "?", "\\", "|", "`", "~"]

    if mode == "security":
        return random.choice([
            "' OR 1=1 --", 
            "<script>alert(1)</script>", 
            "\"><img src=x onerror=prompt(1)>",
            "1; DROP TABLE users"
        ])

    # Sinh dữ liệu theo kiểu
    f_type = field.get("type", "string")

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

        try:
            from faker import Faker
            fake = Faker(['vi_VN', 'en_US'])
            
            # Check for regex/pattern rules first
            pattern = field.get("pattern") or field.get("regex")
            if pattern:
                import rstr
                str_val = rstr.xeger(pattern)
            else:
                # Identify semantic by field name if possible
                fname = field.get("name", "").lower()
                if "product" in fname or "item" in fname:
                    products = domain_vocab.get("product") if domain_vocab and domain_vocab.get("product") else ["Sản phẩm tiêu chuẩn", "Vật phẩm mẫu", "Mặt hàng cao cấp", "Sản phẩm thử nghiệm"]
                    str_val = random.choice(products)
                elif "name" in fname:
                    str_val = fake.name()
                elif "company" in fname:
                    str_val = fake.company()
                elif "address" in fname:
                    str_val = fake.address().replace('\n', ' ')
                elif "phone" in fname:
                    str_val = fake.phone_number()
                elif "desc" in fname or "note" in fname:
                    descs = domain_vocab.get("desc") if domain_vocab and domain_vocab.get("desc") else [
                        "Sản phẩm thiết kế hiện đại, sang trọng và dễ sử dụng trong mọi điều kiện.",
                        "Trang bị công nghệ tiên tiến nhất, mang lại hiệu suất vượt trội và ổn định.",
                        "Chất liệu cao cấp, độ bền bỉ cao, an toàn tuyệt đối cho người sử dụng.",
                        "Giải pháp tối ưu cho công việc và giải trí hàng ngày của bạn.",
                        "Được tích hợp nhiều tính năng thông minh, đem đến trải nghiệm hoàn hảo."
                    ]
                    str_val = random.choice(descs)
                    while len(str_val) < length:
                        str_val += " " + random.choice(descs)
                elif "word" in fname:
                    str_val = fake.word()
                else:
                    str_val = fake.word() + " " + fake.word()
                
            # Ensure length boundary is met perfectly
            if len(str_val) > length:
                str_val = str_val[:length]
            elif len(str_val) < length:
                # Pad to meet length
                padding_words = [" cao cấp", " chính hãng", " tuyệt vời", " mới", " siêu bền", " vip"]
                while len(str_val) < length:
                    str_val += random.choice(padding_words)
                str_val = str_val[:length]
        except:
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

        # Hall of Fame: archive of best unique test cases across ALL generations, grouped by category
        self.hall_of_fame = {
            "POSITIVE": [],
            "BOUNDARY": [],
            "NEGATIVE_FUNCTIONAL": [],
            "NEGATIVE_SECURITY": []
        }
        self._max_hof_size = 20  # Max 20 per category

        # Stats tracking for UI metrics
        self.stats = {
            "total_candidates_evaluated": 0,
            "crossover_count": 0,
            "mutation_count": 0,
            "boundary_mutation_count": 0,
            "security_mutation_count": 0,
            "elite_count": 0,
            "local_search_count": 0,
            "duplicates_removed": 0
        }

        # Static evaluations cache (caching validation, boundary, security scores)
        self.static_cache = {}
        
    def get_stats(self):
        # Calculate dynamic metrics like diversity and avg fitness
        if not self.test_suite:
            return self.stats
        
        avg_fitness = sum(ind["fitness"] for ind in self.test_suite) / len(self.test_suite)
        unique_fingerprints = set(str(sorted(ind["values"].items())) for ind in self.test_suite)
        diversity = len(unique_fingerprints) / len(self.test_suite)
        
        # Count items containing security payloads
        sec_payloads = ["'", "OR", "--", "SELECT", "DROP", "<script>"]
        sec_count = 0
        for ind in self.test_suite:
            is_sec = False
            for v in ind["values"].values():
                val_str = str(v).upper()
                if any(p in val_str for p in sec_payloads):
                    is_sec = True
                    break
            if is_sec: sec_count += 1
            
        return {
            **self.stats,
            "avgFitness": avg_fitness,
            "diversity": diversity,
            "securityCaseRate": sec_count / len(self.test_suite)
        }

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

    def evaluate_testcase_quality(self, test_case, current_suite_values, global_tag_counts=None, categories=None):
        from .fitness_engine.aggregator import FitnessEngine
        if categories is None:
            categories = ["positive"]
        result = FitnessEngine.evaluate(test_case, self.schema, categories)
        fitness = result.fitness
        
        dup_count = sum(
            1 for other in current_suite_values
            if all(str(test_case.get(k["name"])) == str(other.get(k["name"])) for k in self.schema)
        )
        if dup_count > 1:
            fitness -= (dup_count - 1) * 5.0

        return max(0.1, min(fitness, 100.0)), result.weak_points



    def evaluate_suite(self):
        raw_values = [ind["values"] for ind in self.test_suite]
                
        for ind in self.test_suite:
            categories = ind.get("categories", ["positive"])
            fitness, weak_points = self.evaluate_testcase_quality(ind["values"], raw_values, categories=categories)
            ind["fitness"] = fitness
            ind["weak_points"] = weak_points
            ind["coverage_tags"] = []

        self.test_suite.sort(key=lambda x: x["fitness"], reverse=True)
        self._update_hall_of_fame()

    # ═══════════════════════════════════════════════════════════
    # POPULATION INITIALIZATION
    # ═══════════════════════════════════════════════════════════

    def initialize_suite(self, seeds):
        self.test_suite = []
        self.generation = 0
        self.hall_of_fame = {
            "POSITIVE": [],
            "BOUNDARY": [],
            "NEGATIVE_FUNCTIONAL": [],
            "NEGATIVE_SECURITY": []
        }
        self._best_fitness_history = []

        # 1. Đưa các hạt giống thông minh ban đầu vào bộ dữ liệu
        domain_vocab = extract_domain_vocab(seeds, self.schema)
        self.domain_vocab = domain_vocab
        
        def classify_seed(seed):
            c = [x.lower() for x in seed.get("categories", [])]
            if "security" in c or "xss" in c or "sqli" in c: return "NEGATIVE_SECURITY"
            if "negative" in c or "invalid" in c or "error" in c: return "NEGATIVE_FUNCTIONAL"
            if "boundary" in c: return "BOUNDARY"
            return "POSITIVE"

        for s in seeds:
            cleaned_tc = {}
            for field in self.schema:
                name = field["name"]
                cleaned_tc[name] = s["values"][name] if name in s["values"] else generate_random_field_value(field, "valid", domain_vocab)
            
            cat = classify_seed(s)
            self.test_suite.append({
                "id": str(uuid.uuid4()),
                "parent_id": None,
                "values": cleaned_tc,
                "fitness": 0.0,
                "origin": "Seed",
                "categories": [cat]
            })

        # 2. Nhân bản ngẫu nhiên thêm các bộ test biên/lỗi để lấp đầy kích thước (PopSize) theo tỷ lệ
        pop_size = self.config.get("popSize", 50)
        target_counts = {
            "POSITIVE": int(pop_size * 0.50),
            "BOUNDARY": int(pop_size * 0.25),
            "NEGATIVE_FUNCTIONAL": int(pop_size * 0.15),
            "NEGATIVE_SECURITY": pop_size - int(pop_size * 0.50) - int(pop_size * 0.25) - int(pop_size * 0.15)
        }
        
        current_counts = {k: 0 for k in target_counts.keys()}
        for tc in self.test_suite:
            if tc["categories"][0] in current_counts:
                current_counts[tc["categories"][0]] += 1
            
        for cat, target in target_counts.items():
            mode_map = {
                "POSITIVE": "valid",
                "BOUNDARY": "boundary",
                "NEGATIVE_FUNCTIONAL": "invalid",
                "NEGATIVE_SECURITY": "security"
            }
            while current_counts[cat] < target:
                record = {}
                for field in self.schema:
                    record[field["name"]] = generate_random_field_value(field, mode_map[cat], domain_vocab)
                self.test_suite.append({
                    "id": str(uuid.uuid4()),
                    "parent_id": None,
                    "values": record,
                    "fitness": 0.0,
                    "origin": f"Init_{cat}",
                    "categories": [cat]
                })
                current_counts[cat] += 1

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
                    "categories": ind.get("categories", ["POSITIVE"]),
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
        if target_size is None:
            target_size = self.config.get("popSize", 50)
            
        pool = {
            "POSITIVE": [],
            "BOUNDARY": [],
            "NEGATIVE_FUNCTIONAL": [],
            "NEGATIVE_SECURITY": []
        }
        seen = set()

        def _fingerprint(values):
            return str(sorted((k, str(v)) for k, v in values.items()))

        def _add(ind):
            fp = _fingerprint(ind["values"])
            if fp in seen: return
            seen.add(fp)
            cats = ind.get("categories", ["POSITIVE"])
            cat = cats[0] if cats else "POSITIVE"
            if cat not in pool: cat = "POSITIVE"
            pool[cat].append({
                "id": ind.get("id", str(uuid.uuid4())), 
                "parent_id": ind.get("parent_id"), 
                "values": ind["values"], 
                "categories": ind.get("categories", ["POSITIVE"]),
                "fitness": ind.get("fitness", 0.0), 
                "origin": ind.get("origin", "Unknown")
            })

        for ind in self.test_suite: _add(ind)
        
        for cat, hof_list in getattr(self, "hall_of_fame", {}).items():
            if isinstance(hof_list, list):
                for hof in hof_list: _add(hof)

        if original_seeds:
            def classify_seed(seed):
                c = [x.lower() for x in seed.get("categories", [])]
                if "security" in c or "xss" in c or "sqli" in c: return "NEGATIVE_SECURITY"
                if "negative" in c or "invalid" in c or "error" in c: return "NEGATIVE_FUNCTIONAL"
                if "boundary" in c: return "BOUNDARY"
                return "POSITIVE"
                
            domain_vocab = getattr(self, "domain_vocab", None)
            for s in original_seeds:
                cleaned = {}
                for field in self.schema:
                    name = field["name"]
                    cleaned[name] = s["values"][name] if "values" in s and name in s["values"] else generate_random_field_value(field, "valid", domain_vocab)
                
                cat = classify_seed(s)
                _add({
                    "values": cleaned,
                    "categories": [cat],
                    "fitness": 100.0,
                    "origin": "Seed_F0"
                })

        for cat in pool:
            pool[cat].sort(key=lambda x: x["fitness"], reverse=True)

        target_counts = {
            "POSITIVE": int(target_size * 0.50),
            "BOUNDARY": int(target_size * 0.25),
            "NEGATIVE_FUNCTIONAL": int(target_size * 0.15),
            "NEGATIVE_SECURITY": target_size - int(target_size * 0.50) - int(target_size * 0.25) - int(target_size * 0.15)
        }
        
        enriched = []
        for cat, target in target_counts.items():
            cat_list = pool.get(cat, [])
            # Fill the rest randomly if not enough in this category
            if len(cat_list) < target:
                diff = target - len(cat_list)
                for _ in range(diff):
                    mode_map = {"POSITIVE": "valid", "BOUNDARY": "boundary", "NEGATIVE_FUNCTIONAL": "invalid", "NEGATIVE_SECURITY": "security"}
                    record = {}
                    domain_vocab = getattr(self, "domain_vocab", None)
                    for field in self.schema:
                        record[field["name"]] = generate_random_field_value(field, mode_map.get(cat, "valid"), domain_vocab)
                    cat_list.append({
                        "id": str(uuid.uuid4()),
                        "values": record,
                        "categories": [cat],
                        "fitness": 0.0,
                        "origin": f"Fallback_{cat}"
                    })
            enriched.extend(cat_list[:target])
            
        if max_size and len(enriched) > max_size:
            enriched = enriched[:max_size]
            
        return enriched



    def _update_hall_of_fame(self):
        """Archive the best unique test cases found so far grouped by category."""
        for ind in self.test_suite:
            cats = ind.get("categories", ["POSITIVE"])
            cat = cats[0] if cats else "POSITIVE"
            if cat not in self.hall_of_fame:
                self.hall_of_fame[cat] = []
            
            hof_list = self.hall_of_fame[cat]
            tc_str = str(sorted(ind["values"].items()))
            if not any(str(sorted(hof["values"].items())) == tc_str for hof in hof_list):
                hof_list.append({
                    "id": ind.get("id", str(uuid.uuid4())),
                    "parent_id": ind.get("parent_id"),
                    "values": {**ind["values"]},
                    "categories": ind.get("categories", ["POSITIVE"]),
                    "fitness": ind["fitness"],
                    "origin": f"HoF_Gen{self.generation}"
                })
        
        for cat in self.hall_of_fame:
            self.hall_of_fame[cat].sort(key=lambda x: x["fitness"], reverse=True)
            if len(self.hall_of_fame[cat]) > self._max_hof_size:
                self.hall_of_fame[cat] = self.hall_of_fame[cat][:self._max_hof_size]

    # ═══════════════════════════════════════════════════════════
    # SELECTION (with Niche Density Distance tiebreaker)
    # ═══════════════════════════════════════════════════════════

    def select_parent(self):
        """
        Rank-based Selection V3.
        Cá thể có rank càng cao (chỉ số thấp, vì đã sort descending) thì xác suất chọn càng lớn.
        P(i) = (N - i + 1) / sum(1..N)
        """
        pop_size = len(self.test_suite)
        if pop_size == 0:
            return None
            
        weights = [pop_size - i for i in range(pop_size)]
        return random.choices(self.test_suite, weights=weights, k=1)[0]

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
        Uniform Crossover + Arithmetic Crossover (V3) cho các trường số.
        """
        child1 = {}
        child2 = {}
        rate = self.get_adaptive_crossover_rate()

        for field in self.schema:
            name = field["name"]
            ftype = field.get("type")
            if ftype == "number" and random.random() < 0.5:
                # Arithmetic Crossover
                try:
                    v1 = float(p1.get(name, 0))
                    v2 = float(p2.get(name, 0))
                    alpha = random.random()
                    c1_val = v1 * alpha + v2 * (1 - alpha)
                    c2_val = v1 * (1 - alpha) + v2 * alpha
                    
                    if field.get("minValue") is not None and field.get("maxValue") is not None and field["minValue"] == int(field["minValue"]):
                        # Try to keep as int if min/max are ints
                        c1_val = int(round(c1_val))
                        c2_val = int(round(c2_val))
                        
                    child1[name] = c1_val
                    child2[name] = c2_val
                except:
                    if random.random() < rate:
                        child1[name] = p2.get(name)
                        child2[name] = p1.get(name)
                    else:
                        child1[name] = p1.get(name)
                        child2[name] = p2.get(name)
            elif random.random() < rate:
                child1[name] = p2.get(name)
                child2[name] = p1.get(name)
            else:
                child1[name] = p1.get(name)
                child2[name] = p2.get(name)
        def reclassify_child(child_values):
            from .fitness_engine.quality_classifier import classify_quality, InvalidType
            has_security = False
            has_invalid = False
            for field in self.schema:
                val = child_values.get(field["name"])
                val_str = str(val) if val is not None else ""
                status_res = classify_quality(val_str, field)
                if status_res.status in [InvalidType.INVALID_FORMAT, InvalidType.INVALID_TYPE, InvalidType.INVALID_REQUIRED, InvalidType.INVALID_ENUM]:
                    if any(x in val_str.lower() for x in ["<script", "1=1", "drop table", "or 1=", "prompt("]):
                        has_security = True
                    else:
                        has_invalid = True
            if has_security: return "NEGATIVE_SECURITY"
            if has_invalid: return "NEGATIVE_FUNCTIONAL"
            return "POSITIVE"
            
        return {"values": child1, "categories": [reclassify_child(child1)]}, {"values": child2, "categories": [reclassify_child(child2)]}

    # ═══════════════════════════════════════════════════════════
    # MUTATION (adaptive rate + Gaussian + enum-aware)
    # ═══════════════════════════════════════════════════════════

    def tweak_values(self, test_case):
        """
        Đột biến giá trị (Mutation V3) với Mutation Budget.
        """
        is_mutated = False
        rate = self.get_adaptive_mutation_rate()
        
        if random.random() > rate:
            return {**test_case}, False
            
        cats = test_case.get("categories", ["POSITIVE"])
        cat = cats[0] if cats else "POSITIVE"
        
        mutated_tc = {**test_case}
        mutated_tc["values"] = {**test_case["values"]}
        values = mutated_tc["values"]
        
        # Mutation Budget
        if cat in ["POSITIVE", "BOUNDARY"]:
            max_violations = 0
            mode_pool = ["boundary", "ep_valid"]
        elif cat == "NEGATIVE_FUNCTIONAL":
            max_violations = random.randint(1, 2)
            mode_pool = ["invalid", "ep_invalid"]
        elif cat == "NEGATIVE_SECURITY":
            max_violations = random.randint(1, 2)
            mode_pool = ["security"]
        else:
            max_violations = 0
            mode_pool = ["boundary"]
            
        k_val = random.randint(1, len(self.schema)) if self.schema else 0
        fields_to_mutate = random.sample(self.schema, k=k_val)
        violations_applied = 0
        
        for field in fields_to_mutate:
            name = field["name"]
            
            if violations_applied >= max_violations and cat in ["NEGATIVE_FUNCTIONAL", "NEGATIVE_SECURITY"]:
                current_mode = random.choice(["boundary", "ep_valid"])
            else:
                current_mode = random.choice(mode_pool)
                if current_mode in ["invalid", "ep_invalid", "security"]:
                    violations_applied += 1
                    
            new_val = generate_random_field_value(field, current_mode, self.domain_vocab)
            if new_val != values.get(name):
                values[name] = new_val
                is_mutated = True
                
        return mutated_tc, is_mutated

    # ═══════════════════════════════════════════════════════════
    # STAGNATION DETECTION
    # ═══════════════════════════════════════════════════════════

    def _is_stagnated(self):
        """Detect if the population has stopped improving."""
        if len(self._best_fitness_history) < self._stagnation_threshold:
            return False

        recent = self._best_fitness_history[-self._stagnation_threshold:]
        # V3 Early Stopping: Nếu max_fitness > 98, coi như hội tụ
        if max(recent) >= 98.0:
            return True
        # Check if no improvement in the last 5 generations (was self._stagnation_threshold)
        if len(self._best_fitness_history) >= 5:
            last_5 = self._best_fitness_history[-5:]
            if max(last_5) - min(last_5) < 0.5:
                return True
        return max(recent) - min(recent) < 0.5

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
                "origin": "Elite",
                "lineage": self.test_suite[i].get("lineage", {
                    "parents": [],
                    "operations": ["elite_preservation"]
                })
            })

        # Track operation counts per generation
        crossover_count = 0
        mutation_count = 0

        # 2. Sinh các Test Cases con thông qua Crossover và Mutation
        while len(next_suite) < self.config["popSize"]:
            p1_ind = self.select_parent()
            p2_ind = self.select_parent()

            # c1, c2 lúc này có dạng {"values": {...}, "categories": [...]}
            c1, c2 = self.mix_testcases(p1_ind["values"], p2_ind["values"])
            
            # Khởi tạo full cấu trúc cho offspring
            offspring1 = {
                "id": str(uuid.uuid4()),
                "parent_id": p1_ind.get("id"),
                "values": c1["values"],
                "categories": c1["categories"],
                "fitness": 0.0,
                "origin": "Crossover",
                "lineage": {"parents": [p1_ind.get("id"), p2_ind.get("id")], "operations": ["crossover"]}
            }
            
            offspring1, is_mutated1 = self.tweak_values(offspring1)
            if is_mutated1:
                offspring1["origin"] = "Crossover + Mutation"
                offspring1["lineage"]["operations"].append("mutation")
                mutation_count += 1
            
            next_suite.append(offspring1)
            crossover_count += 1
            
            if len(next_suite) < self.config["popSize"]:
                offspring2 = {
                    "id": str(uuid.uuid4()),
                    "parent_id": p2_ind.get("id"),
                    "values": c2["values"],
                    "categories": c2["categories"],
                    "fitness": 0.0,
                    "origin": "Crossover",
                    "lineage": {"parents": [p1_ind.get("id"), p2_ind.get("id")], "operations": ["crossover"]}
                }
                
                offspring2, is_mutated2 = self.tweak_values(offspring2)
                if is_mutated2:
                    offspring2["origin"] = "Crossover + Mutation"
                    offspring2["lineage"]["operations"].append("mutation")
                    mutation_count += 1
                
                next_suite.append(offspring2)
                crossover_count += 1

        # 3. Thay đổi bộ dữ liệu test và tái chấm điểm
        # 3a. Enum Constraint Repair: đảm bảo các trường Enum không bị biến dạng
        from .enum_constraint_validator import repair_population_enums
        next_suite, enum_violations = repair_population_enums(next_suite, self.schema)
        self._last_enum_violations = enum_violations
        self.test_suite = next_suite
        self.evaluate_suite()
        
        # Cập nhật global stats
        self.stats["total_candidates_evaluated"] += len(self.test_suite)
        self.stats["elite_count"] = elite_size
        self.stats["crossover_count"] += crossover_count
        self.stats["mutation_count"] += mutation_count
        self.stats["duplicates_removed"] += getattr(self, "_last_duplicates_removed", 0)

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
        threshold = 40.0 + min(self.generation / self.max_generations, 1.0) * 20.0
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
