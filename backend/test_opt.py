import requests
import json

data = {
    "specification_id": "b0d611ca-cd50-4d43-aca2-a6344d57c790", 
    "generations": 5,
    "popSize": 10,
    "crossoverRate": 0.8,
    "mutationRate": 0.15,
    "algorithm": "ga_hc"
}

res = requests.post("http://localhost:8000/api/optimize", json=data)
print(res.status_code)
print(res.text[:500])
