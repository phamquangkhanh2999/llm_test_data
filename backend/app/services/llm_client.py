import os
import json
import urllib.request
import time
import ssl
from typing import Dict, Any, Optional, Tuple
from openai import OpenAI

def call_llm_json(system_prompt: str, user_prompt: str, api_key_override: Optional[str] = None, llm_provider: str = "gemini") -> Tuple[Dict[str, Any], str, str]:
    """
    Calls the LLM (Gemini or OpenAI) with the given system and user prompts.
    Automatically detects the appropriate API based on the API key.
    
    Returns:
        tuple: (parsed_json_dict, engine_name, model_name)
        
    Raises:
        ValueError: If API key is missing or invalid.
        Exception: If network or JSON parsing fails.
    """
    # 1. Determine the active API key
    if llm_provider == "openai":
        active_key = api_key_override or os.getenv("OPENAI_API_KEY")
    else:
        active_key = api_key_override or os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")
    
    if not active_key or active_key.strip() == "":
        raise ValueError("API_KEY_MISSING")

    active_key = active_key.strip()
    is_openai = (llm_provider == "openai") or active_key.startswith("sk-")
    is_gemini = not is_openai

    if is_gemini:
        engine_name = "gemini"
        model_name = "gemini-2.5-flash"
        print(f"\n>>> [LLM] Gọi Gemini API ({model_name}) | Prompt: {len(system_prompt)+len(user_prompt)} chars", flush=True)
        t0 = time.time()
        result = _call_gemini_rest(active_key, model_name, system_prompt, user_prompt)
        print(f">>> [LLM] ✓ Gemini phản hồi sau {time.time()-t0:.1f}s", flush=True)
        return result, engine_name, model_name
    else:
        engine_name = "openai"
        model_name = "gpt-4o-2024-08-06"
        print(f"\n>>> [LLM] Gọi OpenAI API ({model_name}) | Prompt: {len(system_prompt)+len(user_prompt)} chars", flush=True)
        t0 = time.time()
        result = _call_openai_sdk(active_key, model_name, system_prompt, user_prompt)
        print(f">>> [LLM] ✓ OpenAI phản hồi sau {time.time()-t0:.1f}s", flush=True)
        return result, engine_name, model_name

def _call_gemini_rest(api_key: str, model_name: str, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": f"{system_prompt}\n\n{user_prompt}"}
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.7
        }
    }
    
    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=req_data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    # Initialize SSL Context
    ssl_context = None
    try:
        import certifi
        ssl_context = ssl.create_default_context(cafile=certifi.where())
    except Exception:
        ssl_context = ssl._create_unverified_context()
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, context=ssl_context, timeout=90) as response:
                return _parse_gemini_response(response)
        except urllib.error.HTTPError as err:
            body = err.read().decode("utf-8", errors="ignore")
            print(f">>> [LLM] ✗ Gemini HTTP {err.code}: {body[:300]}", flush=True)
            if err.code in [503, 500]:
                if attempt < max_retries - 1:
                    wait = 15 * (attempt + 1)
                    print(f">>> [LLM] Server Quá Tải ({err.code}). Retry {attempt+1}/{max_retries} sau {wait}s...", flush=True)
                    time.sleep(wait)
                    continue
            elif err.code == 429:
                print(f">>> [LLM] ⚠ Rate Limit 429! Fail fast to avoid UI hang.", flush=True)
                raise ValueError("API_KEY_ERROR: Bạn đã bị Google khoá Rate Limit (Lỗi 429). Vui lòng chờ 1 phút rồi thử lại!")
            raise err
        except urllib.error.URLError as err:
            if "CERTIFICATE_VERIFY_FAILED" in str(err):
                unverified_context = ssl._create_unverified_context()
                with urllib.request.urlopen(req, context=unverified_context, timeout=90) as response:
                    return _parse_gemini_response(response)
            print(f">>> [LLM] ✗ Network error: {err}", flush=True)
            raise err

def _parse_gemini_response(response) -> Dict[str, Any]:
    resp_data = response.read().decode("utf-8")
    resp_json = json.loads(resp_data)
    # Handle thinking model: find the non-thought part
    parts = resp_json["candidates"][0]["content"]["parts"]
    text_content = None
    for part in parts:
        if not part.get("thought", False):
            text_content = part.get("text", "")
            break
    if text_content is None:
        text_content = parts[0].get("text", "")
    return json.loads(text_content)

def _call_openai_sdk(api_key: str, model_name: str, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
    client = OpenAI(api_key=api_key)
    
    response = client.chat.completions.create(
        model=model_name,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.7,
        max_tokens=4096
    )
    
    return json.loads(response.choices[0].message.content)
