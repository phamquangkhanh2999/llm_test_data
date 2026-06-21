import requests
import json

data = {
    "specification_id": "b0d611ca-cd50-4d43-aca2-a6344d57c790", 
    "generations": 1,
    "popSize": 2,
    "crossoverRate": 0.8,
    "mutationRate": 0.15,
    "algorithm": "ga_hc",
    "initial_seeds": [{"tcId": "1", "scenario": "Test", "values": {"product_name": "iPhone", "price": 100}}]
}

res = requests.post("http://localhost:8000/api/optimize", json=data)
print(res.status_code)
print(res.text[:500])
