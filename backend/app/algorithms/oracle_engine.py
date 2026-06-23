class OracleEngine:
    @staticmethod
    def rule_oracle(values, schema):
        # Fast static check
        # Trả về boolean: Hợp lệ hay Không hợp lệ dựa trên rule tĩnh
        import re
        for field in schema:
            name = field["name"]
            val = values.get(name)
            str_val = str(val) if val is not None else ""
            
            if field.get("required") and (val is None or not str_val.strip()):
                return False
            if field.get("allowedValues") and val not in field["allowedValues"]:
                return False
                
            if val is not None and str_val.strip() != "":
                ftype = field.get("type", "string")
                if ftype == "number":
                    try:
                        n = float(val)
                        if field.get("minValue") is not None and n < field["minValue"]: return False
                        if field.get("maxValue") is not None and n > field["maxValue"]: return False
                    except ValueError:
                        return False
                else:
                    if field.get("minLength") is not None and len(str_val) < field["minLength"]: return False
                    if field.get("maxLength") is not None and len(str_val) > field["maxLength"]: return False
                    if field.get("pattern"):
                        try:
                            if not re.search(field["pattern"], str_val): return False
                        except: pass
                        
        return True

    @staticmethod
    def semantic_oracle(values, expected_result, actual_result):
        # Đánh giá Consistency (0.0 đến 1.0)
        if expected_result == "Success" and actual_result == "Success":
            return 1.0
        if expected_result == "Error" and actual_result == "Error":
            return 1.0
            
        # Semantic drift if mismatch
        return 0.0

    @staticmethod
    def security_oracle(values):
        # Đánh giá hiệu quả Security thay vì chỉ đếm token
        str_all = str(values)
        if "<script>alert(1)</script>" in str_all:
            return 1.0  # Real exploit payload
        if "' OR 1=1 --" in str_all:
            return 0.9  # SQLi context
        
    @staticmethod
    def align_labels(values, schema):
        # Tư động sửa Label dựa trên tính hợp lệ của dữ liệu
        is_valid = OracleEngine.rule_oracle(values, schema)
        
        # Nếu có SECURITY_ payload, nó thường là Failed
        str_all = str(values)
        is_security_attack = "<script>" in str_all or "OR 1=1" in str_all or "DROP " in str_all
        
        if is_security_attack:
            values["expectedResult"] = "Failed / Blocked"
            values["errorDescription"] = "Lỗi bảo mật: Dữ liệu chứa mã độc bị hệ thống từ chối"
            values["Expected Result"] = "Failed / Blocked"
            values["Expected Error"] = "Lỗi bảo mật: Dữ liệu chứa mã độc bị hệ thống từ chối"
        elif not is_valid:
            values["expectedResult"] = "Failed"
            values["errorDescription"] = "Lỗi dữ liệu đầu vào không hợp lệ (sai định dạng, độ dài, hoặc ngoài giá trị cho phép)"
            values["Expected Result"] = "Failed"
            values["Expected Error"] = "Lỗi dữ liệu đầu vào không hợp lệ"
        else:
            values["expectedResult"] = "Success"
            values["errorDescription"] = "Không có"
            values["Expected Result"] = "Success"
            values["Expected Error"] = "Không có"
            
        return values
