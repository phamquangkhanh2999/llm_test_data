import urllib.request
import urllib.error
import json
import ssl

ssl_context = ssl._create_unverified_context()

url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=AIzaSyFakeKeyJustToSeeErrorFormat"
req_data = {
    "contents": [{"role": "user", "parts": [{"text": "Hello"}]}]
}
req = urllib.request.Request(url, data=json.dumps(req_data).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")

try:
    with urllib.request.urlopen(req, context=ssl_context, timeout=10) as response:
        print(response.read().decode())
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.reason}")
    print("Body:", e.read().decode())
except Exception as e:
    print("Error:", e)
