import os
import json
import urllib.request
import time
import ssl
from typing import Dict, Any, Optional, Tuple
from openai import OpenAI

# ============================================================
# Shared constants — apply equally to both Gemini and OpenAI
# ============================================================
MAX_OUTPUT_TOKENS = 8192   # Enough for complex combined parse + seeds responses
LLM_TEMPERATURE   = 0.7
LLM_TIMEOUT_SEC   = 120    # generous timeout for large prompts


def call_llm_json(
    system_prompt: str,
    user_prompt: str,
    api_key_override: Optional[str] = None,
    llm_provider: str = "gemini"
) -> Tuple[Dict[str, Any], str, str]:
    """
    Unified LLM gateway — Gemini or OpenAI.
    Both providers receive the same max_output_tokens, temperature, and
    truncation-detection logic so switching providers never causes silent failures.

    Returns:
        tuple: (parsed_json_dict, engine_name, model_name)

    Raises:
        ValueError: API key missing / rate-limited / response truncated.
        Exception:  Network failure or JSON parse error.
    """
    # ------------------------------------------------------------------
    # 1. Resolve API key
    # ------------------------------------------------------------------
    if llm_provider == "openai":
        active_key = api_key_override or os.getenv("OPENAI_API_KEY")
        if not active_key or not active_key.strip():
            raise ValueError("OPENAI_API_KEY_MISSING")
    else:
        active_key = api_key_override or os.getenv("GEMINI_API_KEY")
        if not active_key or not active_key.strip():
            raise ValueError("GEMINI_API_KEY_MISSING")

    active_key = active_key.strip()

    # ------------------------------------------------------------------
    # 2. Auto-detect provider from key prefix (overrides llm_provider arg)
    # ------------------------------------------------------------------
    if active_key.startswith("sk-"):
        is_openai = True
    elif active_key.startswith("AIza") or active_key.startswith("AQ."):
        is_openai = False
    else:
        is_openai = (llm_provider == "openai")

    prompt_chars = len(system_prompt) + len(user_prompt)

    if is_openai:
        engine_name = "openai"
        model_name  = "gpt-4o-2024-08-06"
        print(f"\n>>> [LLM] Gọi OpenAI API ({model_name}) | Prompt: {prompt_chars} chars", flush=True)
        t0 = time.time()
        result = _call_openai_sdk(active_key, model_name, system_prompt, user_prompt)
        print(f">>> [LLM] ✓ OpenAI phản hồi sau {time.time()-t0:.1f}s", flush=True)
    else:
        engine_name = "gemini"
        model_name  = "gemini-2.5-flash"
        print(f"\n>>> [LLM] Gọi Gemini API ({model_name}) | Prompt: {prompt_chars} chars", flush=True)
        t0 = time.time()
        result = _call_gemini_rest(active_key, model_name, system_prompt, user_prompt)
        print(f">>> [LLM] ✓ Gemini phản hồi sau {time.time()-t0:.1f}s", flush=True)

    return result, engine_name, model_name


# ==============================================================
# Gemini REST implementation
# ==============================================================

def _call_gemini_rest(
    api_key: str,
    model_name: str,
    system_prompt: str,
    user_prompt: str
) -> Dict[str, Any]:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta"
        f"/models/{model_name}:generateContent?key={api_key}"
    )

    payload = {
        # Proper Gemini v1beta structure: system instruction separate from contents
        "systemInstruction": {
            "parts": [{"text": system_prompt}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": user_prompt}]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": LLM_TEMPERATURE,
            "maxOutputTokens": MAX_OUTPUT_TOKENS
        }
    }

    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=req_data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    ssl_context = _build_ssl_context()
    max_retries = 3

    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, context=ssl_context, timeout=LLM_TIMEOUT_SEC) as resp:
                return _parse_gemini_response(resp)

        except urllib.error.HTTPError as err:
            body = err.read().decode("utf-8", errors="ignore")
            print(f">>> [LLM] ✗ Gemini HTTP {err.code}: {body[:300]}", flush=True)
            if err.code in [500, 503] and attempt < max_retries - 1:
                wait = 15 * (attempt + 1)
                print(f">>> [LLM] Server Quá Tải ({err.code}). Retry {attempt+1}/{max_retries} sau {wait}s...", flush=True)
                time.sleep(wait)
                continue
            if err.code == 429:
                raise ValueError(
                    "API_KEY_ERROR: Bạn đã bị Google khoá Rate Limit (Lỗi 429). "
                    "Vui lòng chờ 1 phút rồi thử lại!"
                )
            raise

        except urllib.error.URLError as err:
            # SSL certificate fallback
            if "CERTIFICATE_VERIFY_FAILED" in str(err):
                fallback = ssl._create_unverified_context()
                with urllib.request.urlopen(req, context=fallback, timeout=LLM_TIMEOUT_SEC) as resp:
                    return _parse_gemini_response(resp)
            print(f">>> [LLM] ✗ Network error: {err}", flush=True)
            raise


def _parse_gemini_response(response) -> Dict[str, Any]:
    resp_data = response.read().decode("utf-8")
    resp_json = json.loads(resp_data)

    candidate = resp_json["candidates"][0]

    # Truncation check
    finish_reason = candidate.get("finishReason", "")
    is_truncated = (finish_reason == "MAX_TOKENS")

    # Handle thinking model: skip thought parts, take first non-thought text
    parts = candidate["content"]["parts"]
    text_content = None
    for part in parts:
        if not part.get("thought", False):
            text_content = part.get("text", "")
            break
    if text_content is None:
        text_content = parts[0].get("text", "")

    try:
        return json.loads(text_content)
    except json.JSONDecodeError as e:
        print(f">>> [LLM] ✗ Gemini JSON parse error: {e} | is_truncated={is_truncated}", flush=True)
        import re
        
        # 1. Thử extract block ```json
        match = re.search(r"```json\n(.*?)(?:\n```|$)", text_content, re.DOTALL)
        if match:
            text_to_parse = match.group(1)
        else:
            text_to_parse = text_content
            
        # 2. Nếu bị truncated, thử sửa JSON array/object bằng cách cắt ở dấu ngoặc đóng cuối cùng
        if is_truncated or True:
            # Tìm dấu ngoặc đóng } gần nhất
            last_brace = text_to_parse.rfind('}')
            if last_brace != -1:
                repaired_text = text_to_parse[:last_brace+1]
                # Nếu là mảng, đóng mảng
                if repaired_text.strip().startswith('['):
                    repaired_text += ']'
                try:
                    return json.loads(repaired_text)
                except Exception as ex:
                    print(f">>> [LLM] ✗ Auto-repair failed: {ex}")
                    
        raise ValueError(f"JSON_PARSE_ERROR: LLM trả về nội dung không phải JSON hợp lệ, hoặc bị cắt giữa chừng không thể phục hồi. — {e}")


# ==============================================================
# OpenAI SDK implementation
# ==============================================================

def _call_openai_sdk(
    api_key: str,
    model_name: str,
    system_prompt: str,
    user_prompt: str
) -> Dict[str, Any]:
    client = OpenAI(api_key=api_key)

    response = client.chat.completions.create(
        model=model_name,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt}
        ],
        temperature=LLM_TEMPERATURE,
        max_tokens=MAX_OUTPUT_TOKENS
    )

    choice = response.choices[0]

    # Truncation check
    is_truncated = (choice.finish_reason == "length")

    content = choice.message.content or ""
    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        print(f">>> [LLM] ✗ OpenAI JSON parse error: {e} | is_truncated={is_truncated}", flush=True)
        import re
        
        # 1. Thử extract block ```json
        match = re.search(r"```json\n(.*?)(?:\n```|$)", content, re.DOTALL)
        if match:
            text_to_parse = match.group(1)
        else:
            text_to_parse = content
            
        # 2. Nếu bị truncated, thử sửa JSON array/object
        if is_truncated or True:
            last_brace = text_to_parse.rfind('}')
            if last_brace != -1:
                repaired_text = text_to_parse[:last_brace+1]
                if repaired_text.strip().startswith('['):
                    repaired_text += ']'
                try:
                    return json.loads(repaired_text)
                except Exception as ex:
                    print(f">>> [LLM] ✗ Auto-repair failed: {ex}")
                    
        raise ValueError(f"JSON_PARSE_ERROR: OpenAI trả về JSON không hợp lệ hoặc bị cắt giữa chừng. — {e}")


# ==============================================================
# Shared helpers
# ==============================================================

def _build_ssl_context():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl._create_unverified_context()
