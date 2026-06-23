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
        
        happy_cov = 1.0 if "GENERIC_SUCCESS" in self.coverage_matrix else 0.0
        
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
            "happyPathCoverage": 1.0 if "GENERIC_SUCCESS" in self.coverage_matrix else 0.0,
            "businessRuleCoverage": 1.0 if any("BUSINESS_RULE_" in k for k in self.coverage_matrix) else 0.0
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

    def compute_fitness(self, values, current_pop_values):
        nodes = self._extract_coverage_nodes(values)
        
        # V5.1 Multi-Objective Vector
        rule_score = sum(1 for n in nodes if "REQUIRED" in n or "INVALID_ENUM" in n or "MINUS_1" in n or "PLUS_1" in n) / max(len(self.schema) * 2, 1)
        boundary_score = sum(1 for n in nodes if "MIN" in n or "MAX" in n or "EMPTY_LOCAL" in n) / max(len(self.schema) * 2, 1)
        
        # V5.1 Real Security Effectiveness (not fake count)
        sec_hits = sum(1 for n in nodes if "SECURITY" in n)
        str_all = str(values)
        
        # V6 Soft Penalty Anti-Noise
        noise_score = 0
        if "🫥" in str_all or "💩" in str_all or "🤷" in str_all: noise_score += 0.6
        if "" in str_all: noise_score += 0.5
        if len(str_all) > 500 and "A" * 50 in str_all: noise_score += 0.4
        
        # V6 Security-Aware Execution Validator
        security_score = 0.0
        if sec_hits > 0:
            security_score = min(1.0, sec_hits / 3.0)
            
        # V6 Soft Penalty Anti-Noise
        lambda_weight = 0.5
        security_score = max(0.0, security_score - (lambda_weight * noise_score))
                
        oracle_score = 1.0 # Will be refined by real oracle
        
        vector = {
            "rule": min(rule_score * 5, 1.0),
            "boundary": min(boundary_score * 5, 1.0),
            "security": security_score,
            "oracle": oracle_score
        }
        scalar = sum(vector.values()) / 4.0 * 100
        return scalar, vector, noise_score

    def evaluate_suite(self):
        raw_values = [ind["values"] for ind in self.test_suite]
        for ind in self.test_suite:
            fit_scalar, fit_vector, noise = self.compute_fitness(ind["values"], raw_values)
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
        domain_vocab = extract_domain_vocab(seeds, self.schema)
        
        # 1. Seed Injection (Generation 0) Generic
        injected_seeds = []
        valid_seed = {}
        for field in self.schema:
            valid_seed[field["name"]] = generate_random_field_value(field, "valid", domain_vocab)
            
        # Happy Path
        injected_seeds.append({**valid_seed, "_origin": "Seed_GENERIC_SUCCESS"})
        
        # Business Rule Paths
        for field in self.schema:
            if field.get("allowedValues") and len(field["allowedValues"]) > 1:
                br_seed = {**valid_seed}
                br_seed[field["name"]] = field["allowedValues"][-1]
                br_seed["_origin"] = f"Seed_BR_{field['name'].upper()}"
                injected_seeds.append(br_seed)
                
        # Required Empty Paths
        for field in self.schema:
            if field.get("required"):
                err_seed = {**valid_seed}
                err_seed[field["name"]] = ""
                err_seed["_origin"] = f"Seed_EMPTY_{field['name'].upper()}"
                injected_seeds.append(err_seed)
        
        for inj in injected_seeds:
            rec = {}
            for field in self.schema:
                name = field["name"]
                if name in inj:
                    rec[name] = inj[name]
                else:
                    rec[name] = generate_random_field_value(field, "valid", domain_vocab)
            self.test_suite.append({
                "id": str(uuid.uuid4()),
                "values": rec,
                "origin": inj["_origin"],
                "fitness": 0.0
            })
            
        # Add original LLM seeds
        for s in seeds:
            cleaned = {}
            for field in self.schema:
                name = field["name"]
                cleaned[name] = s["values"][name] if name in s["values"] else generate_random_field_value(field, "valid", domain_vocab)
            self.test_suite.append({
                "id": str(uuid.uuid4()),
                "values": cleaned,
                "origin": "Seed_LLM",
                "fitness": 0.0
            })
            
        modes = ["valid", "boundary", "invalid", "valid"]
        while len(self.test_suite) < self.pop_size:
            rec = {}
            m = modes[len(self.test_suite) % len(modes)]
            for field in self.schema:
                rec[field["name"]] = generate_random_field_value(field, m, domain_vocab)
            self.test_suite.append({
                "id": str(uuid.uuid4()),
                "values": rec,
                "origin": f"Init_{m.upper()}",
                "fitness": 0.0
            })
            
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

    def select_mutation_policy(self, values):
        # V5.1 Enterprise Mutation Scheduler
        str_all = str(values)
        if "🫥" in str_all or "💩" in str_all:
            return "HEALING_POLICY" # Needs immediate repair
        
        # Cycle through policies based on generation
        cycle = self.generation % 5
        if cycle == 0: return "SECURITY_ATTACK_POLICY"
        if cycle == 1: return "BOUNDARY_POLICY"
        if cycle == 2: return "VALID_POLICY"
        if cycle == 3: return "BUSINESS_POLICY"
        return "RANDOM_POLICY"

    def semantic_mutate(self, values):
        mutated = False
        res = {**values}
        
        if random.random() > self.mutation_rate:
            return res, mutated
            
        policy = self.select_mutation_policy(res)
        mutated = True
        
        fields = list(self.schema)
        random.shuffle(fields)
        
        # Only apply ONE mutation to avoid conflicts
        field = fields[0]
        name = field["name"]
        val = res.get(name)
        str_val = str(val) if val is not None else ""
        
        if policy == "HEALING_POLICY" or policy == "VALID_POLICY":
            res[name] = generate_random_field_value(field, "valid", extract_domain_vocab([], self.schema))
        elif policy == "SECURITY_ATTACK_POLICY":
            payloads = ["' OR 1=1 --", "<script>alert(1)</script>", "A" * 200]
            res[name] = random.choice(payloads)
        elif policy == "BOUNDARY_POLICY":
            if field.get("type") == "number":
                res[name] = float(str_val) + 1 if str_val.isnumeric() else 0
            else:
                res[name] = ""
        elif policy == "BUSINESS_POLICY":
            if field.get("allowedValues") and len(field["allowedValues"]) > 1:
                others = [v for v in field["allowedValues"] if str(v) != str_val]
                res[name] = random.choice(others) if others else res[name]
            else:
                res[name] = res[name]
        else:
            # RANDOM_POLICY: fallback
            res[name] = None if random.random() > 0.5 else "INVALID_VAL"
            
        from .oracle_engine import OracleEngine
        res = OracleEngine.align_labels(res, self.schema)
            
        return res, mutated


    def evolve_one_generation(self):
        new_pop = []
        # Elitism
        elite_size = max(1, int(self.pop_size * 0.1))
        for i in range(elite_size):
            new_pop.append({
                "id": str(uuid.uuid4()),
                "values": {**self.test_suite[i]["values"]},
                "fitness": self.test_suite[i]["fitness"],
                "origin": "Elite"
            })
            
        while len(new_pop) < self.pop_size:
            p1 = self.select_parent()
            p2 = self.select_parent()
            c1, c2 = self.mix_testcases(p1, p2)
            
            c1, m1 = self.semantic_mutate(c1)
            c2, m2 = self.semantic_mutate(c2)
            
            new_pop.append({"id": str(uuid.uuid4()), "values": c1, "origin": "Crossover+Mutate" if m1 else "Crossover", "fitness": 0.0})
            if len(new_pop) < self.pop_size:
                new_pop.append({"id": str(uuid.uuid4()), "values": c2, "origin": "Crossover+Mutate" if m2 else "Crossover", "fitness": 0.0})
            
        self.test_suite = new_pop
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
        # Merge population + HoF + seeds
        pool = []
        seen = set()
        
        def _add(ind):
            fp = str(sorted(ind["values"].items()))
            if fp not in seen:
                seen.add(fp)
                pool.append(ind)
                
        for ind in self.test_suite: _add(ind)
        for ind in self.hall_of_fame: _add(ind)
        if original_seeds:
            for s in original_seeds:
                vals = s.get("values", s)
                fit_scalar, fit_vector, noise = self.compute_fitness(vals, [])
                _add({"values": vals, "fitness": fit_scalar, "fitness_vector": fit_vector, "noise_score": noise, "origin": "Seed_F0"})
                
        def get_fit(x):
            f = x.get("fitness", 0.0)
            if isinstance(f, (tuple, list)): return f[0]
            if isinstance(f, dict): return sum(f.values()) / max(len(f), 1)
            return f
            
        pool.sort(key=get_fit, reverse=True)
        if max_size and len(pool) > max_size:
            pool = pool[:max_size]
        return pool
