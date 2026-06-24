import random
import uuid
import math
from .optimizer_engine import generate_random_field_value, extract_domain_vocab, fast_distance

class V4TestSuiteOptimizer:
    """
    Coverage-Driven Genetic Algorithm V4.1
    """
    def __init__(self, schema, config):
        self.schema = schema
        self.config = config
        self.test_suite = []
        self.generation = 0
        self.max_generations = config.get("generations", 60)
        self.pop_size = config.get("popSize", 50)
        self.mutation_rate = config.get("mutationRate", 0.15)
        self.crossover_rate = config.get("crossoverRate", 0.7)

        self.coverage_matrix = {}
        self.hall_of_fame = []
        
        self.stagnation_counter = 0
        self.last_best_fitness = 0.0
        
        self.stats = {}
        self.initial_stats = None
        self.fitness_history = []
        self.domain_vocab = {"product": [], "desc": []}

    # ═══════════════════════════════════════════════════════════
    # ORACLE & CATEGORY HELPERS
    # ═══════════════════════════════════════════════════════════
    CATEGORIES = ["POSITIVE", "BOUNDARY", "NEGATIVE_FUNCTIONAL", "NEGATIVE_SECURITY"]
    _MODE_BY_CAT = {
        "POSITIVE": "valid",
        "BOUNDARY": "boundary",
        "NEGATIVE_FUNCTIONAL": "invalid",
        "NEGATIVE_SECURITY": "security",
    }

    def _oracle(self, values):
        """Suy diễn HTTP status thật từ schema (khớp định nghĩa Success của UI)."""
        from ..services.ai_service import derive_expected_result
        try:
            return derive_expected_result(values, self.schema)
        except Exception:
            return {"http_status": 200, "violated_fields": []}

    def _is_valid(self, values):
        return self._oracle(values).get("http_status") == 200

    def _category_quotas(self, n):
        """Phân bổ ~70% POSITIVE / 12% BOUNDARY / 9% NEG_FUNC / 9% NEG_SEC."""
        pos = int(n * 0.70)
        bnd = int(n * 0.12)
        nf = int(n * 0.09)
        return {
            "POSITIVE": pos,
            "BOUNDARY": bnd,
            "NEGATIVE_FUNCTIONAL": nf,
            "NEGATIVE_SECURITY": max(0, n - pos - bnd - nf),
        }

    def _mk_ind(self, values, origin, category):
        return {
            "id": str(uuid.uuid4()),
            "values": values,
            "origin": origin,
            "category": category,
            "fitness": 0.0,
        }

    def _gen_record(self, mode):
        return {f["name"]: generate_random_field_value(f, mode, self.domain_vocab) for f in self.schema}

    def _make_valid_record(self, max_tries=10):
        """Sinh một record HỢP LỆ đảm bảo (oracle HTTP 200), tự sửa field vi phạm nếu cần."""
        for _ in range(max_tries):
            rec = self._gen_record("valid")
            if self._is_valid(rec):
                return rec
        # Sửa từng field vi phạm bằng giá trị chuẩn (ep_valid) cho tới khi hợp lệ
        rec = self._gen_record("ep_valid")
        for _ in range(max_tries):
            res = self._oracle(rec)
            if res.get("http_status") == 200:
                return rec
            for vf in res.get("violated_fields", []):
                fdef = next((f for f in self.schema if f["name"] == vf), None)
                if fdef:
                    rec[vf] = generate_random_field_value(fdef, "ep_valid", self.domain_vocab)
        return rec

    def _repair_to_valid(self, values, max_tries=6):
        res = {**values}
        for _ in range(max_tries):
            r = self._oracle(res)
            if r.get("http_status") == 200:
                return res
            for vf in r.get("violated_fields", []):
                fdef = next((f for f in self.schema if f["name"] == vf), None)
                if fdef:
                    res[vf] = generate_random_field_value(fdef, "ep_valid", self.domain_vocab)
        return res

    def evaluate_testcase_quality(self, values, current_pop_values=None, categories=None):
        """
        Tương thích HC (boundary_tweak): trả (scalar_fitness, weak_points).
        Tự suy category từ `categories` truyền vào hoặc từ oracle nếu không có.
        """
        category = None
        if categories:
            up = [str(x).upper() for x in categories]
            if any("SECURITY" in x or x in ("XSS", "SQLI") for x in up):
                category = "NEGATIVE_SECURITY"
            elif any("NEGATIVE" in x or x in ("INVALID", "ERROR") for x in up):
                category = "NEGATIVE_FUNCTIONAL"
            elif any("BOUNDARY" in x for x in up):
                category = "BOUNDARY"
            elif any("POSITIVE" in x or x == "VALID" for x in up):
                category = "POSITIVE"
        if category is None:
            category = self._classify_record({}, values)
        scalar, _vector, _noise = self.compute_fitness(values, category)
        return scalar, []

    def _classify_record(self, seed, values):
        """Phân loại category cho một record dựa trên nhãn LLM (nếu có) + oracle thật."""
        cats = [str(x).lower() for x in (seed.get("categories") or [])] if isinstance(seed, dict) else []
        str_all = str(values).lower()
        if any(x in cats for x in ("security", "xss", "sqli")) or "<script>" in str_all or "or 1=1" in str_all or "drop table" in str_all:
            return "NEGATIVE_SECURITY"
        if self._is_valid(values):
            return "POSITIVE"
        if "boundary" in cats:
            return "BOUNDARY"
        return "NEGATIVE_FUNCTIONAL"

    def get_stats(self):
        if not self.test_suite:
            return {}
            
        # Calculate unique test cases
        unique_fps = set()
        for ind in self.test_suite:
            unique_fps.add(str(sorted(ind["values"].items())))
            
        # Calculate rule/boundary/security coverage based on coverage_matrix
        total_rules = len(self.schema) * 2  # Estimate
        rule_cov = min(1.0, len([k for k in self.coverage_matrix if "REQUIRED" in k or "ENUM" in k]) / max(total_rules, 1))
        
        boundary_nodes = [k for k in self.coverage_matrix if "MIN" in k or "MAX" in k or "EMPTY" in k or "LEN" in k]
        total_boundaries = len(self.schema) * 4 # Estimate
        boundary_cov = min(1.0, len(boundary_nodes) / max(total_boundaries, 1))
        
        # V6.0 Enterprise Security Pattern Calculation
        security_patterns = {"SECURITY_SQLI", "SECURITY_XSS", "SECURITY_OVERFLOW"}
        covered_sec_patterns = len(security_patterns.intersection(self.coverage_matrix.keys()))
        security_cov = covered_sec_patterns / max(len(security_patterns), 1)
        
        # Validity thật của quần thể hiện tại (khớp định nghĩa Success của UI)
        valid_count = sum(1 for ind in self.test_suite if self._is_valid(ind["values"]))
        has_business_rule = any(
            self._is_valid(ind["values"]) and any(
                f.get("allowedValues") and len(f["allowedValues"]) > 1
                and str(ind["values"].get(f["name"])) != str(f["allowedValues"][0])
                for f in self.schema
            )
            for ind in self.test_suite
        )
        happy_cov = 1.0 if valid_count > 0 else 0.0

        # V6.0 Weighted Coverage Formula
        coverageScore = (0.4 * rule_cov) + (0.3 * boundary_cov) + (0.2 * security_cov) + (0.1 * happy_cov)
        coverageScore = min(max(coverageScore, 0.0), 1.0)
        
        if self.test_suite:
            fitness_list = [ind.get("fitness", 0.0) for ind in self.test_suite]
        else:
            fitness_list = []
            
        avg_fitness = sum(fitness_list) / max(len(fitness_list), 1)
        best_fitness = max(fitness_list) if fitness_list else 0.0
        
        current_stats = {
            "coverageScore": coverageScore,
            "bestFitness": best_fitness,
            "avgFitness": avg_fitness,
            "ruleCoverage": rule_cov,
            "boundaryCoverage": boundary_cov,
            "securityCoverage": security_cov,
            "uniqueTestCases": len(unique_fps),
            "generationProgress": min(100, int((self.generation / self.max_generations) * 100)),
            "fitnessHistory": self.fitness_history,

            # Raw counts for Gain calculation
            "ruleNodesCount": len([k for k in self.coverage_matrix if "REQUIRED" in k or "ENUM" in k]),
            "boundaryNodesCount": len(boundary_nodes),
            "validCaseCount": valid_count,
            "successRate": round(valid_count / max(len(self.test_suite), 1), 4),
            "happyPathCoverage": happy_cov,
            "businessRuleCoverage": 1.0 if has_business_rule else 0.0
        }
        
        if self.initial_stats is not None:
            current_stats["initialStats"] = self.initial_stats
            
        return current_stats

    def _extract_coverage_nodes(self, values):
        nodes = []
        for field in self.schema:
            name = field["name"]
            val = values.get(name)
            str_val = str(val) if val is not None else ""
            
            # Required
            if field.get("required"):
                if val is None:
                    nodes.append(f"{name}_REQUIRED_NULL")
                elif str_val.strip() == "":
                    nodes.append(f"{name}_REQUIRED_EMPTY")
                else:
                    nodes.append(f"{name}_REQUIRED_FULFILLED")
            
            if val is not None and str_val.strip() != "":
                # Number bounds
                if field.get("type") == "number":
                    try:
                        num = float(val)
                        if "minValue" in field and field["minValue"] is not None:
                            if num == float(field["minValue"]): nodes.append(f"{name}_MIN")
                            if num == float(field["minValue"]) - 1: nodes.append(f"{name}_MIN_MINUS_1")
                        if "maxValue" in field and field["maxValue"] is not None:
                            if num == float(field["maxValue"]): nodes.append(f"{name}_MAX")
                            if num == float(field["maxValue"]) + 1: nodes.append(f"{name}_MAX_PLUS_1")
                    except ValueError:
                        nodes.append(f"{name}_NAN")
                else:
                    # Length bounds
                    l = len(str_val)
                    if "minLength" in field and field["minLength"] is not None:
                        if l == int(field["minLength"]): nodes.append(f"{name}_MIN_LEN")
                        if l == int(field["minLength"]) - 1: nodes.append(f"{name}_MIN_LEN_MINUS_1")
                    if "maxLength" in field and field["maxLength"] is not None:
                        if l == int(field["maxLength"]): nodes.append(f"{name}_MAX_LEN")
                        if l == int(field["maxLength"]) + 1: nodes.append(f"{name}_MAX_LEN_PLUS_1")
                
                # Enums
                if "allowedValues" in field and field["allowedValues"]:
                    if val not in field["allowedValues"]:
                        nodes.append(f"{name}_INVALID_ENUM")
                    else:
                        nodes.append(f"{name}_ENUM_{val}")
                        
        import re
        
        # Generic Validation Check (No error nodes)
        invalid_nodes = [n for n in nodes if "INVALID" in n or "NULL" in n or "EMPTY" in n or "MINUS_1" in n or "PLUS_1" in n or "NAN" in n]
        
        if not invalid_nodes:
            nodes.append("GENERIC_SUCCESS")
            # If any enum is not the first allowed value, treat it as a Business Rule
            for field in self.schema:
                if field.get("allowedValues") and len(field["allowedValues"]) > 1:
                    val = values.get(field["name"])
                    if val != field["allowedValues"][0]:
                        nodes.append(f"BUSINESS_RULE_{field['name'].upper()}_{str(val).upper()}")
                
        # Specialized Regex & Security Nodes (Applicable if fields look like email/password)
        str_all = str(values)
        for field in self.schema:
            name = field["name"]
            val = str(values.get(name, ""))
            
            if "email" in name.lower() and val != "":
                if "@" not in val: nodes.append(f"{name.upper()}_NO_AT")
                if "." not in val: nodes.append(f"{name.upper()}_NO_DOMAIN")
                if " " in val: nodes.append(f"{name.upper()}_HAS_SPACE")
                if val.startswith("@"): nodes.append(f"{name.upper()}_EMPTY_LOCAL")
                
            if ("password" in name.lower() or field.get("pattern")) and val != "":
                if not re.search(r'[A-Z]', val): nodes.append(f"{name.upper()}_NO_UPPER")
                if not re.search(r'[a-z]', val): nodes.append(f"{name.upper()}_NO_LOWER")
                if not re.search(r'\d', val): nodes.append(f"{name.upper()}_NO_DIGIT")
                if not re.search(r'[^a-zA-Z0-9]', val): nodes.append(f"{name.upper()}_NO_SPECIAL")
                
        # V6 Security-Aware Execution Validator
        for field in self.schema:
            name = field["name"]
            ftype = field.get("type", "string")
            val = str(values.get(name, ""))
            
            # Only reward XSS/SQLi if the field is a string. If it's a number, the system will reject it as a type error anyway, so it's not a real security threat.
            if ftype == "string":
                if "OR 1=1" in val or "DROP TABLE" in val: nodes.append(f"SECURITY_SQLI_{name.upper()}")
                if "<script>" in val or "javascript:" in val: nodes.append(f"SECURITY_XSS_{name.upper()}")
                
        if any(len(str(v)) > 100 for v in values.values()): nodes.append("SECURITY_OVERFLOW")
                
        return nodes

    def _update_coverage_matrix(self, values):
        nodes = self._extract_coverage_nodes(values)
        for node in nodes:
            if node not in self.coverage_matrix:
                self.coverage_matrix[node] = {
                    "id": node,
                    "hitCount": 0
                }
            self.coverage_matrix[node]["hitCount"] += 1

    def compute_fitness(self, values, category="POSITIVE"):
        """
        Hàm thích nghi theo VAI TRÒ (role-aware).
        Mỗi cá thể được chấm điểm theo đúng mục tiêu của category mà nó đại diện:
          - POSITIVE: thưởng MẠNH cho tính hợp lệ (oracle HTTP 200) — case pass là ưu tiên hàng đầu.
          - BOUNDARY: thưởng khi chạm đúng cận min/max.
          - NEGATIVE_FUNCTIONAL / NEGATIVE_SECURITY: thưởng khi thực sự bị hệ thống từ chối (oracle != 200)
            và khi khai phá được mẫu lỗi/bảo mật.
        Vector trả về dùng các khóa NSGA chuẩn (rule/boundary/security/oracle) để tương thích
        với NSGA2Engine.dominates; khóa "oracle" mang ý nghĩa "mức độ hoàn thành vai trò".
        """
        nodes = self._extract_coverage_nodes(values)

        rule_raw = sum(1 for n in nodes if "REQUIRED" in n or "INVALID_ENUM" in n or "MINUS_1" in n or "PLUS_1" in n) / max(len(self.schema) * 2, 1)
        boundary_raw = sum(1 for n in nodes if "MIN" in n or "MAX" in n or "EMPTY_LOCAL" in n) / max(len(self.schema) * 2, 1)
        sec_hits = sum(1 for n in nodes if "SECURITY" in n)
        str_all = str(values)

        # V6 Soft Penalty Anti-Noise
        noise_score = 0
        if "🫥" in str_all or "💩" in str_all or "🤷" in str_all: noise_score += 0.6
        if len(str_all) > 500 and "A" * 50 in str_all: noise_score += 0.4

        security_score = min(1.0, sec_hits / 3.0) if sec_hits > 0 else 0.0
        security_score = max(0.0, security_score - 0.5 * noise_score)

        rule_n = min(rule_raw * 5, 1.0)
        boundary_n = min(boundary_raw * 5, 1.0)

        # Oracle thật — định nghĩa "thành công" giống hệt cách UI đếm Success Rate.
        is_valid = self._oracle(values).get("http_status") == 200

        if category == "POSITIVE":
            validity = 1.0 if is_valid else 0.0
            vector = {"rule": rule_n, "boundary": boundary_n * 0.3, "security": 0.0, "oracle": validity}
            scalar = (validity * 0.7 + rule_n * 0.2 + boundary_n * 0.1) * 100
        elif category == "BOUNDARY":
            vector = {"rule": rule_n, "boundary": boundary_n, "security": 0.0, "oracle": 0.5}
            scalar = (boundary_n * 0.6 + rule_n * 0.4) * 100
        elif category == "NEGATIVE_SECURITY":
            rejected = 0.0 if is_valid else 1.0
            vector = {"rule": rule_n, "boundary": boundary_n, "security": security_score, "oracle": rejected}
            scalar = (security_score * 0.6 + rejected * 0.3 + boundary_n * 0.1) * 100
        else:  # NEGATIVE_FUNCTIONAL
            rejected = 0.0 if is_valid else 1.0
            vector = {"rule": rule_n, "boundary": boundary_n, "security": 0.0, "oracle": rejected}
            scalar = (rejected * 0.5 + rule_n * 0.3 + boundary_n * 0.2) * 100

        return scalar, vector, noise_score

    def evaluate_suite(self):
        for ind in self.test_suite:
            fit_scalar, fit_vector, noise = self.compute_fitness(ind["values"], ind.get("category", "POSITIVE"))
            ind["fitness"] = fit_scalar
            ind["fitness_vector"] = fit_vector
            ind["noise_score"] = noise
            
        # V6: Soft Penalty only, remove Hard Reject
        # We keep all population to maintain diversity
            
        # Cập nhật matrix
        for ind in self.test_suite:
            self._update_coverage_matrix(ind["values"])
            
        from .nsga2_engine import NSGA2Engine
        fronts = NSGA2Engine.fast_nondominated_sort(self.test_suite)
        for i, front in enumerate(fronts):
            NSGA2Engine.calculate_crowding_distance(front)
            for p in front:
                p["pareto_front"] = i + 1
                
        # Sort by rank and crowding distance
        self.test_suite.sort(key=lambda x: (x.get("rank", 0), -x.get("crowding_distance", 0)))
        
        self._update_hall_of_fame()
        
        # V6.0 Enterprise Tracking Fitness History (Scalar projection for compatibility)
        if self.test_suite:
            fitness_list = [ind.get("fitness", 0.0) for ind in self.test_suite]
            avg = sum(fitness_list) / max(len(fitness_list), 1)
            best = self.test_suite[0].get("fitness", 0.0)
            self.fitness_history.append({"generation": self.generation, "avgFitness": avg, "bestFitness": best})

    def _update_hall_of_fame(self):
        # Keep cases with rare nodes
        for ind in self.test_suite:
            nodes = self._extract_coverage_nodes(ind["values"])
            if any(self.coverage_matrix.get(n, {}).get("hitCount", 0) < 3 for n in nodes):
                # Duplicate check
                is_dup = False
                for h in self.hall_of_fame:
                    if fast_distance(str(ind["values"]), str(h["values"])) < 0.1:
                        is_dup = True
                        break
                if not is_dup:
                    self.hall_of_fame.append({
                        "id": ind.get("id", str(uuid.uuid4())),
                        "values": {**ind["values"]},
                        "fitness": ind["fitness"],
                        "origin": "HoF"
                    })
        self.hall_of_fame.sort(key=lambda x: x.get("fitness", 0.0), reverse=True)
        if len(self.hall_of_fame) > 30:
            self.hall_of_fame = self.hall_of_fame[:30]

    def initialize_suite(self, seeds):
        self.test_suite = []
        self.domain_vocab = extract_domain_vocab(seeds, self.schema)
        pop_size = self.pop_size

        # 1. Happy Path HỢP LỆ đảm bảo (oracle HTTP 200) — case pass luôn tồn tại.
        happy = self._make_valid_record()
        self.test_suite.append(self._mk_ind(happy, "Seed_GENERIC_SUCCESS", "POSITIVE"))

        # 2. Business Rule Paths — vẫn hợp lệ nhưng chọn giá trị enum khác mặc định.
        for field in self.schema:
            if field.get("allowedValues") and len(field["allowedValues"]) > 1:
                br = {**happy, field["name"]: field["allowedValues"][-1]}
                if self._is_valid(br):
                    self.test_suite.append(self._mk_ind(br, f"Seed_BR_{field['name'].upper()}", "POSITIVE"))

        # 3. Required-Empty Paths — case âm có chủ đích.
        for field in self.schema:
            if field.get("required"):
                err = {**happy, field["name"]: ""}
                self.test_suite.append(self._mk_ind(err, f"Seed_EMPTY_{field['name'].upper()}", "NEGATIVE_FUNCTIONAL"))

        # 4. Hạt giống LLM — phân loại bằng oracle thật.
        for s in seeds:
            cleaned = {}
            for field in self.schema:
                name = field["name"]
                cleaned[name] = s["values"][name] if name in s.get("values", {}) else generate_random_field_value(field, "valid", self.domain_vocab)
            cat = self._classify_record(s, cleaned)
            self.test_suite.append(self._mk_ind(cleaned, "Seed_LLM", cat))

        # 5. Lấp đầy quần thể theo hạn ngạch category (POSITIVE chiếm đa số).
        quotas = self._category_quotas(pop_size)
        current = {c: 0 for c in self.CATEGORIES}
        for ind in self.test_suite:
            c = ind.get("category", "POSITIVE")
            if c in current:
                current[c] += 1

        for cat in self.CATEGORIES:
            while current[cat] < quotas[cat] and len(self.test_suite) < pop_size:
                if cat == "POSITIVE":
                    rec = self._make_valid_record()
                else:
                    rec = self._gen_record(self._MODE_BY_CAT[cat])
                self.test_suite.append(self._mk_ind(rec, f"Init_{cat}", cat))
                current[cat] += 1

        self.test_suite = self.test_suite[:pop_size]
        self.evaluate_suite()
        self.initial_stats = self.get_stats()

    def select_parent(self):
        # V5.1 NSGA-II Tournament Selection
        candidates = random.sample(self.test_suite, min(5, len(self.test_suite)))
        candidates.sort(key=lambda x: (x.get("rank", 0), -x.get("crowding_distance", 0)))
        return candidates[0]["values"]

    def mix_testcases(self, p1, p2):
        c1, c2 = {}, {}
        for f in self.schema:
            name = f["name"]
            if random.random() < self.crossover_rate:
                c1[name] = p2.get(name)
                c2[name] = p1.get(name)
            else:
                c1[name] = p1.get(name)
                c2[name] = p2.get(name)
        return c1, c2

    def semantic_mutate(self, values, category="POSITIVE"):
        """
        Đột biến TÔN TRỌNG vai trò: POSITIVE chỉ đột biến trong không gian HỢP LỆ
        (không bao giờ nhồi payload/giá trị sai), nên case pass không bị phá.
        """
        res = {**values}
        if random.random() > self.mutation_rate:
            return res, False

        field = random.choice(self.schema)
        name = field["name"]

        if category == "POSITIVE":
            res[name] = generate_random_field_value(field, random.choice(["valid", "ep_valid"]), self.domain_vocab)
            if not self._is_valid(res):
                res = self._repair_to_valid(res)
        elif category == "BOUNDARY":
            res[name] = generate_random_field_value(field, "boundary", self.domain_vocab)
        elif category == "NEGATIVE_SECURITY":
            res[name] = random.choice(["' OR 1=1 --", "<script>alert(1)</script>", "A" * 200])
        else:  # NEGATIVE_FUNCTIONAL
            res[name] = generate_random_field_value(field, random.choice(["invalid", "ep_invalid"]), self.domain_vocab)

        return res, True


    def evolve_one_generation(self):
        # Tiến hóa PHÂN TẦNG theo category: mỗi thế hệ giữ nguyên hạn ngạch
        # (≈70% POSITIVE) nên case hợp lệ không bị quần thể âm/bảo mật lấn át.
        quotas = self._category_quotas(self.pop_size)

        buckets = {c: [] for c in self.CATEGORIES}
        for ind in self.test_suite:
            buckets.get(ind.get("category", "POSITIVE"), buckets["POSITIVE"]).append(ind)

        def tournament(pool, k=4):
            cands = random.sample(pool, min(k, len(pool)))
            cands.sort(key=lambda x: (x.get("rank", 0), -x.get("crowding_distance", 0)))
            return cands[0]

        new_pop = []
        for cat in self.CATEGORIES:
            target = quotas[cat]
            if target <= 0:
                continue
            pool = buckets[cat]

            # Elitism trong từng category (giữ ~20% xuất sắc nhất của category đó)
            elite_n = min(len(pool), max(1, int(target * 0.2))) if pool else 0
            produced = 0
            for ind in pool[:elite_n]:
                elite = self._mk_ind({**ind["values"]}, "Elite", cat)
                elite["fitness"] = ind.get("fitness", 0.0)
                new_pop.append(elite)
                produced += 1

            # Sinh con TRONG CÙNG category (cha mẹ cùng vai trò, con kế thừa vai trò)
            while produced < target:
                if len(pool) >= 2:
                    p1 = tournament(pool)
                    p2 = tournament(pool)
                    c1, c2 = self.mix_testcases(p1["values"], p2["values"])
                    child = c1 if produced % 2 == 0 else c2
                    if cat == "POSITIVE" and not self._is_valid(child):
                        child = self._repair_to_valid(child)
                elif pool:
                    child = {**pool[0]["values"]}
                else:
                    child = self._make_valid_record() if cat == "POSITIVE" else self._gen_record(self._MODE_BY_CAT[cat])

                child, mutated = self.semantic_mutate(child, cat)
                new_pop.append(self._mk_ind(child, "Crossover+Mutate" if mutated else "Crossover", cat))
                produced += 1

        self.test_suite = new_pop[:self.pop_size]
        self.evaluate_suite()
        
        # V6.0 Enterprise Adaptive Mutation based on Diversity
        unique_fps = set(str(sorted(ind["values"].items())) for ind in self.test_suite)
        diversity = len(unique_fps) / max(len(self.test_suite), 1)
        
        if diversity < 0.3:
            # Low diversity (Stagnation) -> Increase mutation to escape local optimum
            self.mutation_rate = min(0.5, self.mutation_rate + 0.1)
        elif diversity > 0.8:
            # High diversity -> Decrease mutation to exploit good regions
            self.mutation_rate = max(0.1, self.mutation_rate - 0.05)
        
        self.generation += 1

    def assemble_optimized_dataset(self, original_seeds=None, target_size=None, max_size=None):
        """
        Lắp ráp output cuối theo HẠN NGẠCH category: ~70% POSITIVE hợp lệ xếp ĐẦU,
        phần còn lại phủ BOUNDARY/NEGATIVE/SECURITY. Nếu thiếu POSITIVE, sinh thêm
        case hợp lệ đảm bảo (oracle 200) để Success Rate luôn đạt mục tiêu.
        """
        target = max_size or target_size or self.pop_size
        field_names = [f["name"] for f in self.schema]

        def clean(vals):
            return {k: vals.get(k) for k in field_names}

        pool = {c: [] for c in self.CATEGORIES}
        seen = set()

        def _add(ind):
            vals = clean(ind.get("values", {}))
            fp = str(sorted((k, str(v)) for k, v in vals.items()))
            if fp in seen:
                return
            seen.add(fp)
            cat = ind.get("category") or self._classify_record(ind, vals)
            if cat not in pool:
                cat = "POSITIVE"
            pool[cat].append({
                "id": ind.get("id", str(uuid.uuid4())),
                "values": vals,
                "category": cat,
                "fitness": ind.get("fitness", 0.0),
                "origin": ind.get("origin", "GA"),
            })

        for ind in self.test_suite:
            _add(ind)
        for h in self.hall_of_fame:
            _add(h)
        if original_seeds:
            for s in original_seeds:
                _add({"values": s.get("values", s), "categories": s.get("categories"), "origin": "Seed_F0"})

        for cat in pool:
            pool[cat].sort(key=lambda x: x["fitness"], reverse=True)

        quotas = self._category_quotas(target)
        enriched = []
        # POSITIVE trước tiên → case hợp lệ đứng đầu danh sách hiển thị.
        for cat in self.CATEGORIES:
            q = quotas[cat]
            lst = pool[cat]
            attempts = 0
            while len(lst) < q and attempts < q * 20 + 50:
                attempts += 1
                if cat == "POSITIVE":
                    rec = self._make_valid_record()
                else:
                    rec = self._gen_record(self._MODE_BY_CAT[cat])
                fp = str(sorted((k, str(v)) for k, v in rec.items()))
                if fp in seen:
                    continue
                seen.add(fp)
                lst.append({"id": str(uuid.uuid4()), "values": rec, "category": cat, "fitness": 0.0, "origin": f"Fill_{cat}"})
            enriched.extend(lst[:q])

        return enriched[:target]
