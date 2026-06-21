import requests

data = {
    "fields": [
        {"name": "product_name", "type": "string", "maxLength": 50, "minLength": 5, "description": "Tên sản phẩm"}
    ],
    "test_method": "bva",
    "boundary_count": 4,
    "partition_count": 3
}

res = requests.post("http://localhost:8000/api/generate-seeds", json=data)
print(res.status_code)
print(res.text[:500])
