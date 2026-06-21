import os
import json
import urllib.request

api_key = os.getenv("GEMINI_API_KEY")
url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

payload = {
    "contents": [{"role": "user", "parts": [{"text": "Write a very long essay."}]}],
    "generationConfig": {
        "maxOutputTokens": 32768
    }
}

req_data = json.dumps(payload).encode("utf-8")
req = urllib.request.Request(url, data=req_data, headers={"Content-Type": "application/json"}, method="POST")

try:
    with urllib.request.urlopen(req) as resp:
        print("Success!", resp.status)
except Exception as e:
    print("Error:", getattr(e, 'code', 'No code'), getattr(e, 'read', lambda: b'')().decode())
