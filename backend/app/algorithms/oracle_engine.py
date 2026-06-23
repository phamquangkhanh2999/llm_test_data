class OracleEngine:
    @staticmethod
    def rule_oracle(values, schema):
        # Fast static check
        # Trả về boolean: Hợp lệ hay Không hợp lệ dựa trên rule tĩnh
        for field in schema:
            name = field["name"]
            val = values.get(name)
            str_val = str(val) if val is not None else ""
            
            if field.get("required") and not str_val.strip():
                return False
            if field.get("allowedValues") and val not in field["allowedValues"]:
                return False
                
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
        
        # Noise or harmless strings
        return 0.1
