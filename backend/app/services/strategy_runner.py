from typing import Dict, List
from ..algorithms.optimizer_engine import TestSuiteOptimizer
from ..algorithms.boundary_tweak import optimize_testcase_boundaries
from ..engines.fitness_engine import evaluate_individual_fitness

def _run_hc_on_dataset(dataset: list, schema: list, rules: list, constraints: list, max_iterations: int = 5) -> list:
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
            max_iterations=max_iterations
        )
        hc_results.append(optimized_tc)
        
    return hc_results

def run_all_strategies(schema: list, rules: list, constraints: list, initial_seeds: list) -> Dict[str, list]:
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
    ga_engine = TestSuiteOptimizer(schema, random_seeds, generations=5)
    ga_engine.rules = rules
    ga_engine.constraints = constraints
    ga_result = ga_engine.run()
    results["GA"] = [ind["values"] for ind in ga_result]
    
    # 3. Strategy: HC (Hill Climbing on random seeds)
    results["HC"] = _run_hc_on_dataset(
        [tc.get("data", tc) for tc in random_seeds],
        schema, rules, constraints, max_iterations=5
    )
    
    # 4. Strategy: LLM + GA
    llm_ga_engine = TestSuiteOptimizer(schema, initial_seeds, generations=10)
    llm_ga_engine.rules = rules
    llm_ga_engine.constraints = constraints
    llm_ga_result = llm_ga_engine.run()
    results["LLM_GA"] = [ind["values"] for ind in llm_ga_result]
    
    # 5. Strategy: LLM + HC
    results["LLM_HC"] = _run_hc_on_dataset(
        [tc.get("data", tc) for tc in initial_seeds],
        schema, rules, constraints, max_iterations=10
    )
    
    # 6. Strategy: LLM + GA + HC
    # Takes the output of LLM+GA and refines it with HC
    results["LLM_GA_HC"] = _run_hc_on_dataset(
        results["LLM_GA"],
        schema, rules, constraints, max_iterations=15
    )
    
    return results
