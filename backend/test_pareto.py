import asyncio
from app.algorithms.local_pareto_optimizer import LocalParetoOptimizer
from app.algorithms.v4_optimizer import V4TestSuiteOptimizer

schema = [{"name": "field", "type": "string"}]
config = {"popSize": 2}
opt = V4TestSuiteOptimizer(schema, config)
opt.test_suite = [{"values": {"field": "A"}}]

def fitness_evaluator(tc):
    return opt.evaluate_testcase_quality(tc, [])

hc = LocalParetoOptimizer(schema, fitness_evaluator)
try:
    hc.optimize([{"field": "A"}])
    print("SUCCESS")
except Exception as e:
    print("ERROR:", type(e).__name__, str(e))
