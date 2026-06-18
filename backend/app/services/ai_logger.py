from sqlalchemy.orm import Session

def log_ai_call(db: Session, endpoint: str, provider: str, model: str, input_summary: str, output_summary: str, status: str, token_count: int = None, error_message: str = None):
    print(f"\n=================== [LLM CALL LOG] ===================")
    print(f"Endpoint:  {endpoint}")
    print(f"Provider:  {provider} ({model})")
    print(f"Status:    {status}")
    if error_message:
        print(f"Error:     {error_message}")
    else:
        input_clean = input_summary.replace('\n', ' ') if input_summary else ""
        output_clean = output_summary.replace('\n', ' ') if output_summary else ""
        print(f"Input:     {input_clean[:120] + '...' if len(input_clean) > 120 else input_clean}")
        print(f"Output:    {output_clean[:120] + '...' if len(output_clean) > 120 else output_clean}")
    print(f"======================================================\n")
    if db is None: return
    try:
        from ..models import AICallLog
        db_log = AICallLog(
            endpoint=endpoint,
            provider=provider,
            model=model,
            input_summary=input_summary,
            output_summary=output_summary,
            token_count_estimate=token_count if token_count is not None else (len(input_summary or "") + len(output_summary or "")) // 4,
            status=status,
            error_message=error_message
        )
        db.add(db_log)
        db.commit()
        db.refresh(db_log)
    except Exception as e:
        print(f">>> ERROR logging AI call to DB: {e}")
