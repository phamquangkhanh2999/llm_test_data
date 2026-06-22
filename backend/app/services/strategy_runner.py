from typing import Dict, List
from ..algorithms.optimizer_engine import TestSuiteOptimizer
from ..algorithms.boundary_tweak import optimize_testcase_boundaries
from ..engines.fitness_engine import evaluate_individual_fitness

def _run_hc_on_dataset(dataset: list, schema: list, rules: list, constraints: list, max_iterations: int = 5, llm_provider="gemini", api_key_override=None) -> list:
    """
    Helper function to run Hill Climbing on an entire dataset.
    dataset elements are dictionaries with at least a 'data' key or plain dictionaries of test data.
    """
    hc_results = []
    
    for item in dataset:
        # Extract the actual test data
        test_data = item.get("data", item) if isinstance(item, dict) else item
        
        # We need to wrap the evaluate function so it matches what boundary_tweak expects:
        # fitness_evaluator(testcase_data)
        def evaluator(tc_data):
            return evaluate_individual_fitness(tc_data, rules, constraints)
            
        # Run the hill climbing algorithm
        optimized_tc, stats = optimize_testcase_boundaries(
            test_case=test_data,
            schema=schema,
            fitness_evaluator=evaluator,
            max_iterations=max_iterations,
            llm_provider=llm_provider,
            api_key_override=api_key_override
        )
        hc_results.append(optimized_tc)
        
    return hc_results

def run_all_strategies(schema: list, rules: list, constraints: list, initial_seeds: list, llm_provider="gemini", api_key_override=None) -> Dict[str, list]:
    """
    Executes all 6 strategies and returns a dictionary of datasets.
    """
    results = {}
    
    # 1. Strategy: LLM (Just the initial seeds)
    # We map them to the format the UI expects (array of objects with 'data' or just values)
    # Actually, the fitness_engine expects list of dicts. So we just pass the values.
    results["LLM"] = [tc.get("data", tc) for tc in initial_seeds]
    
    # Generate random seeds for GA/HC pure baseline
    random_seeds = [{"data": tc.get("data", tc)} for tc in initial_seeds]
    
    # 2. Strategy: GA
    ga_config = {"generations": 5, "popSize": 50, "llm_provider": llm_provider, "api_key_override": api_key_override}
    ga_engine = TestSuiteOptimizer(schema, ga_config)
    ga_engine.rules = rules
    ga_engine.constraints = constraints
    ga_engine.initialize_suite(random_seeds)
    for _ in range(ga_config["generations"]):
        ga_engine.evolve_one_generation()
    ga_result = ga_engine.assemble_optimized_dataset(original_seeds=random_seeds, target_size=35, max_size=50)
    results["GA"] = [ind["values"] for ind in ga_result]
    
    # 3. Strategy: HC (Hill Climbing on random seeds)
    results["HC"] = _run_hc_on_dataset(
        [tc.get("data", tc) for tc in random_seeds],
        schema,
        rules,
        constraints,
        max_iterations=5,
        llm_provider=llm_provider,
        api_key_override=api_key_override
    )
    
    # 4. Strategy: LLM + GA
    ga_llm_config = {"generations": 5, "popSize": 50, "llm_provider": llm_provider, "api_key_override": api_key_override}
    ga_llm_engine = TestSuiteOptimizer(schema, ga_llm_config)
    llm_ga_engine = ga_llm_engine
    llm_ga_engine.rules = rules
    llm_ga_engine.constraints = constraints
    llm_ga_engine.initialize_suite(initial_seeds)
    for _ in range(ga_llm_config["generations"]):
        llm_ga_engine.evolve_one_generation()
    llm_ga_result = llm_ga_engine.assemble_optimized_dataset(original_seeds=initial_seeds, target_size=35, max_size=50)
    results["LLM_GA"] = [ind["values"] for ind in llm_ga_result]
    
    # 5. Strategy: LLM + HC
    results["LLM_HC"] = _run_hc_on_dataset(
        [tc.get("data", tc) for tc in initial_seeds],
        schema, rules, constraints, max_iterations=10
    )
    
    # 6. Strategy: LLM + GA + HC
    # Takes the output of LLM+GA and refines it with HC
    llm_ga_hc_raw = _run_hc_on_dataset(
        results["LLM_GA"],
        schema, rules, constraints, max_iterations=15
    )
    
    # [TÍCH HỢP] VALIDATION GATE: Chặn dữ liệu rác từ HC
    from ..validators.anomaly_detector import AnomalyDetector
    
    # Lọc HC thuần
    results["HC"] = AnomalyDetector.validate_dataset(results["HC"], random_seeds, schema)
    # Lọc LLM_HC
    results["LLM_HC"] = AnomalyDetector.validate_dataset(results["LLM_HC"], initial_seeds, schema)
    # Lọc LLM_GA_HC
    llm_ga_hc_validated = AnomalyDetector.validate_dataset(llm_ga_hc_raw, results["LLM_GA"], schema)
    
    # [TÍCH HỢP] SPRINT 1: P2 Semantic-Preserving Merge & Provenance
    from ..algorithms.policy_registry import resolve_policy
    def _apply_merge_and_provenance(dataset):
        final_dataset = []
        for tc in dataset:
            final_tc = {**tc}
            provenance = {}
            for field in schema:
                name = field["name"]
                policy = resolve_policy(field)
                if policy == "freeze":
                    # Đã bị khóa ở GA/HC, nên giá trị này chắc chắn từ LLM
                    provenance[name] = "LLM"
                elif policy in ["format_preserving", "constraint_preserving"]:
                    provenance[name] = "LLM/Refined"
                else:
                    provenance[name] = "GA/HC"
            final_tc["_provenance"] = provenance
            final_dataset.append(final_tc)
        return final_dataset

    results["LLM_GA_HC"] = _apply_merge_and_provenance(llm_ga_hc_validated)
    
    return results
