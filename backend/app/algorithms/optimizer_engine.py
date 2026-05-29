import random
import re
import string

# Helper: Tính khoảng cách Levenshtein giữa 2 chuỗi để đo lường tính đa dạng (Diversity)
def levenshtein_distance(s1, s2):
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
            if v1 != v2:
                max_len = max(len(v1), len(v2), 1)
                diffs += levenshtein_distance(v1, v2) / max_len
        total_dist += diffs / len(keys)
        
    return min(total_dist / len(subset), 1.0)


# Helper: Tự động sinh giá trị ngẫu nhiên theo quy định trường dữ liệu
def generate_random_field_value(field, mode="valid"):
    special_chars = ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "-", "_", "+", "=", "[", "]", "{", "}", ";", ":", "'", '"', "<", ">", "/", "?", "\\", "|", "`", "~"]
    security_payloads = [
        "' OR '1'='1",
        "' OR 1=1 --",
        "admin' --",
        "' UNION SELECT NULL --",
        "<script>alert(1)</script>",
        "<svg/onload=alert(1)>",
        "\" onerror=\"alert(1)",
        "../../etc/passwd",
        "1; DROP TABLE users; --"
    ]

    if mode == "security":
        if field["type"] in ["string", "email"]:
            return random.choice(security_payloads)
        if field["type"] == "number":
            return 999999 # gây tràn số biên

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
        min_v = field.get("minValue", 0)
        max_v = field.get("maxValue", 1000)
        if mode == "invalid":
            return min_v - 5 if random.random() > 0.5 else max_v + 5
        if mode == "boundary":
            return min_v if random.random() > 0.5 else max_v
        return random.randint(min_v, max_v)
        
    else: # type == string
        if field.get("allowedValues"):
            if mode == "invalid":
                return "INVALID_VAL"
            return random.choice(field["allowedValues"])
            
        min_l = field.get("minLength", 3)
        max_l = field.get("maxLength", 20)
        
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


class TestSuiteOptimizer:
    """
    BỘ TỐI ƯU HÓA TEST SUITE (Genetic Algorithm Engine in Python).
    Đảm nhận việc nhân bản, hoán đổi trường dữ liệu và tinh chỉnh giá trị ngẫu nhiên
    để lọc ra bộ Test Cases có độ bao phủ biên tốt nhất.
    """
    def __init__(self, schema, config):
        self.schema = schema # JSON Schema các trường dữ liệu
        self.config = config # Cấu hình GA (Generations, PopSize, v.v.)
        self.test_suite = [] # Danh sách active Test Cases: [{"values": TC, "fitness": score, "origin": type}]
        self.generation = 0

    def evaluate_testcase_quality(self, test_case, current_suite_values):
        """
        Đánh giá chất lượng của một Test Case (Hàm Fitness).
        Trả về điểm số từ 0.01 đến 1.0 và cơ cấu điểm chi tiết.
        """
        validation_score = 0
        boundary_score = 0
        security_score = 0
        
        num_fields = len(self.schema)
        
        # Duyệt từng trường quy tắc
        for field in self.schema:
            name = field["name"]
            val = test_case.get(name)
            if val is None:
                continue
                
            val_str = str(val)
            is_valid = True
            is_boundary = False
            is_security = False
            
            # --- 1. Kiểm tra tính đúng đắn (Validation) ---
            # Bắt buộc
            if field.get("required") and (val is None or val_str == ""):
                is_valid = False
                
            # Định dạng kiểu
            if is_valid:
                if field["type"] == "email":
                    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", val_str):
                        is_valid = False
                elif field["type"] == "card":
                    if not re.match(r"^\d{16}$", val_str):
                        is_valid = False
                elif field["type"] == "phone":
                    if not re.match(r"^(03|05|07|08|09)\d{8}$", val_str):
                        is_valid = False
                elif field["type"] == "number":
                    try:
                        float(val)
                    except ValueError:
                        is_valid = False
                        
            # Giới hạn số/độ dài
            if is_valid:
                if field["type"] == "number":
                    num = float(val)
                    if field.get("minValue") is not None and num < field["minValue"]:
                        is_valid = False
                    if field.get("maxValue") is not None and num > field["maxValue"]:
                        is_valid = False
                else:
                    if field.get("minLength") is not None and len(val_str) < field["minLength"]:
                        is_valid = False
                    if field.get("maxLength") is not None and len(val_str) > field["maxLength"]:
                        is_valid = False

            # Regex tùy chọn
            if is_valid and field.get("regex"):
                try:
                    if not re.search(field["regex"], val_str):
                        is_valid = False
                except Exception:
                    pass

            if is_valid:
                validation_score += 1
                
                # --- 2. Kiểm tra biên (Boundary) ---
                if field["type"] == "number":
                    num = float(val)
                    if field.get("minValue") is not None and num == field["minValue"]:
                        is_boundary = True
                    if field.get("maxValue") is not None and num == field["maxValue"]:
                        is_boundary = True
                else:
                    if field.get("minLength") is not None and len(val_str) == field["minLength"]:
                        is_boundary = True
                    if field.get("maxLength") is not None and len(val_str) == field["maxLength"]:
                        is_boundary = True
                if is_boundary:
                    boundary_score += 1

            # --- 3. Kiểm tra nhúng mã độc (Security Payloads) ---
            security_keywords = ["' or", '" or', "--", "union", "select", "drop table", "<script", "onload=", "onerror="]
            val_lower = val_str.lower()
            if any(kw in val_lower for kw in security_keywords):
                is_security = True
            if is_security:
                security_score += 1

        # Chuẩn hóa điểm
        v_score = validation_score / num_fields
        b_score = min(boundary_score / num_fields, 1.0)
        s_score = min(security_score / num_fields, 1.0)

        # --- 4. Đo lường tính đa dạng (Diversity) ---
        sample_size = min(5, len(current_suite_values))
        sample_subset = random.sample(current_suite_values, sample_size) if sample_size > 0 else []
        d_score = calculate_diversity_score(test_case, sample_subset)

        # --- 5. Điểm phạt trùng lặp (Duplicate Penalty) ---
        dup_count = sum(1 for other in current_suite_values if all(str(test_case[k]) == str(other.get(k, "")) for k in test_case.keys()))
        penalty = min(0.15 * (dup_count - 1), 0.6) if dup_count > 1 else 0.0

        # Tổng hợp điểm chất lượng dựa trên Trọng số cấu hình
        w = self.config["weights"]
        fitness = (w["validation"] * v_score) + (w["boundary"] * b_score) + (w["security"] * s_score) + (w["diversity"] * d_score) - penalty
        fitness = max(0.01, min(fitness, 1.0))
        
        return fitness

    def initialize_suite(self, seeds):
        """
        Khởi tạo Bộ dữ liệu kiểm thử thế hệ F0.
        """
        self.test_suite = []
        self.generation = 0

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

        # 2. Nhân bản ngẫu nhiên thêm các bộ test biên/bảo mật để lấp đầy kích thước (PopSize)
        modes = ["valid", "boundary", "security", "valid"]
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

    def evaluate_suite(self):
        """
        Chấm điểm toàn bộ các Test Cases trong bộ dữ liệu hiện tại
        """
        raw_values = [ind["values"] for ind in self.test_suite]
        for ind in self.test_suite:
            ind["fitness"] = self.evaluate_testcase_quality(ind["values"], raw_values)

        # Sắp xếp danh sách Test Cases giảm dần theo điểm chất lượng (fitness)
        self.test_suite.sort(key=lambda x: x["fitness"], reverse=True)

    def select_parent(self):
        """
        Lọc lựa chất lượng (Tournament Selection):
        Chọn ngẫu nhiên 3 Test Cases, trả về bản ghi có chất lượng tốt nhất làm Cha/Mẹ.
        """
        tour_size = 3
        candidates = random.sample(self.test_suite, tour_size)
        candidates.sort(key=lambda x: x["fitness"], reverse=True)
        return candidates[0]["values"]

    def mix_testcases(self, p1, p2):
        """
        Hoán đổi trường dữ liệu (Crossover):
        Trộn lẫn các thuộc tính giữa 2 Test Cases cha mẹ để sinh ra 2 Test Cases con mới.
        """
        child1 = {}
        child2 = {}
        for field in self.schema:
            name = field["name"]
            if random.random() < self.config["crossoverRate"]:
                # Swap thuộc tính
                child1[name] = p2[name]
                child2[name] = p1[name]
            else:
                # Giữ nguyên thuộc tính
                child1[name] = p1[name]
                child2[name] = p2[name]
        return child1, child2

    def tweak_values(self, test_case):
        """
        Đột biến giá trị (Mutation):
        Tự động biến đổi ngẫu nhiên giá trị của trường để sinh thêm biên lỗi.
        """
        mutated_tc = {**test_case}
        is_mutated = False

        for field in self.schema:
            name = field["name"]
            if random.random() < self.config["mutationRate"]:
                is_mutated = True
                val_str = str(mutated_tc[name])
                rand = random.random()
                
                if field["type"] == "number":
                    try:
                        num = float(mutated_tc[name])
                        if rand < 0.3:
                            mutated_tc[name] = num + (1 if random.random() > 0.5 else -1) # tăng giảm 1 số
                        elif rand < 0.6:
                            mutated_tc[name] = generate_random_field_value(field, "boundary")
                        else:
                            mutated_tc[name] = generate_random_field_value(field, "security")
                    except ValueError:
                        mutated_tc[name] = generate_random_field_value(field, "valid")
                        
                elif field["type"] in ["email", "card", "phone"]:
                    if rand < 0.4:
                        if len(val_str) > 3:
                            # xóa bớt 1 ký tự ngẫu nhiên
                            idx = random.randint(0, len(val_str) - 1)
                            mutated_tc[name] = val_str[:idx] + val_str[idx+1:]
                        else:
                            mutated_tc[name] = generate_random_field_value(field, "valid")
                    elif rand < 0.7:
                        mutated_tc[name] = generate_random_field_value(field, "boundary")
                    else:
                        mutated_tc[name] = generate_random_field_value(field, "security")
                        
                else: # string
                    if rand < 0.3:
                        # chèn 1 ký tự đặc biệt biên
                        char = random.choice("!@#$%'\"<>")
                        idx = random.randint(0, len(val_str))
                        mutated_tc[name] = val_str[:idx] + char + val_str[idx:]
                    elif rand < 0.6:
                        # đảo hoa thường
                        mutated_tc[name] = val_str.upper() if random.random() > 0.5 else val_str.lower()
                    elif rand < 0.8:
                        mutated_tc[name] = generate_random_field_value(field, "boundary")
                    else:
                        mutated_tc[name] = generate_random_field_value(field, "security")

        return mutated_tc, is_mutated

    def evolve_one_generation(self):
        """
        Tiến hóa bộ dữ liệu test thêm 1 thế hệ (Generation Loop).
        """
        self.generation += 1
        next_suite = []

        # 1. Elitism: Giữ nguyên 5% các Test Cases xuất sắc nhất sang thế hệ sau
        elite_size = max(1, int(self.config["popSize"] * 0.05))
        for i in range(elite_size):
            next_suite.append({
                "values": {**self.test_suite[i]["values"]},
                "fitness": self.test_suite[i]["fitness"],
                "origin": "Elite"
            })

        # 2. Sinh các Test Cases con thông qua Crossover & Mutation
        while len(next_suite) < self.config["popSize"]:
            p1 = self.select_parent()
            p2 = self.select_parent()

            c1, c2 = self.mix_testcases(p1, p2)
            c1_mut, m1 = self.tweak_values(c1)
            c2_mut, m2 = self.tweak_values(c2)

            next_suite.append({
                "values": c1_mut,
                "fitness": 0.0,
                "origin": "Tweak_Mutation" if m1 else "Mix_Crossover"
            })

            if len(next_suite) < self.config["popSize"]:
                next_suite.append({
                    "values": c2_mut,
                    "fitness": 0.0,
                    "origin": "Tweak_Mutation" if m2 else "Mix_Crossover"
                })

        # 3. Thay đổi bộ dữ liệu test hoạt động và tái chấm điểm
        self.test_suite = next_suite
        self.evaluate_suite()

        # 4. Tính toán thống kê lượt tiến hóa
        best_fit = self.test_suite[0]["fitness"]
        avg_fit = sum(ind["fitness"] for ind in self.test_suite) / len(self.test_suite)

        # Tính toán tỉ lệ trùng lặp thực tế
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
        dup_rate = dup_count / self.config["popSize"]

        # Tính độ phủ (Coverage) tổng hợp
        total_valid = 0
        boundaries_checked = set()
        security_checked = set()
        top_cases = self.test_suite[:10]

        for ind in top_cases:
            tc = ind["values"]
            for field in self.schema:
                name = field["name"]
                val = tc.get(name)
                val_str = str(val)
                
                # Check validation đơn giản
                is_ok = True
                if field.get("required") and (val is None or val_str == ""):
                    is_ok = False
                if is_ok:
                    total_valid += 1
                    
                    # Boundary check
                    if field["type"] == "number":
                        try:
                            num = float(val)
                            if field.get("minValue") is not None and num == field["minValue"]:
                                boundaries_checked.add(f"{name}_min")
                            if field.get("maxValue") is not None and num == field["maxValue"]:
                                boundaries_checked.add(f"{name}_max")
                        except ValueError:
                            pass
                    else:
                        if field.get("minLength") is not None and len(val_str) == field["minLength"]:
                            boundaries_checked.add(f"{name}_min")
                        if field.get("maxLength") is not None and len(val_str) == field["maxLength"]:
                            boundaries_checked.add(f"{name}_max")

                # Security check
                security_keywords = ["' or", '" or', "--", "union", "select", "<script"]
                if any(kw in val_str.lower() for kw in security_keywords):
                    security_checked.add(f"{name}_security")

        max_valid = len(top_cases) * len(self.schema)
        val_factor = total_valid / max_valid if max_valid > 0 else 0
        
        possible_bounds = len(self.schema) * 2
        bound_factor = len(boundaries_checked) / possible_bounds if possible_bounds > 0 else 0

        possible_sec = len(self.schema)
        sec_factor = len(security_checked) / possible_sec if possible_sec > 0 else 0

        coverage = min((val_factor * 0.7) + (bound_factor * 0.15) + (sec_factor * 0.15), 1.0)

        return {
            "generation": self.generation,
            "bestFitness": best_fit,
            "avgFitness": avg_fit,
            "coverage": coverage,
            "duplicateRate": dup_rate,
            "test_cases": [
                {"values": p["values"], "fitness": p["fitness"], "origin": p["origin"]}
                for p in self.test_suite[:10]
            ]
        }
