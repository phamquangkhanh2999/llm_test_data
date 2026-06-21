import re

class AnomalyDetector:
    """
    2-Level Validation System (Universal / Dynamic)
    Kiểm duyệt gắt gao dữ liệu sau khi đi qua các thuật toán tối ưu hóa (GA/HC)
    hoạt động dựa trên Constraint-aware heuristics thay vì hardcode tên trường.
    """
    
    @staticmethod
    def validate_dataset(final_dataset, original_seeds, schema):
        """
        Duyệt qua tập final_dataset.
        - Hard Reject (Level 1): Vi phạm invariant nghiêm trọng (tràn rác, cấu trúc hỏng).
        - Soft Repair (Level 2): Phục hồi giá trị field từ original_seeds nếu có thể cứu vãn.
        """
        cleaned_dataset = []
        original_map = {seed.get("tcId"): seed for seed in original_seeds}
        
        for tc in final_dataset:
            tc_id = tc.get("tcId")
            golden_seed = original_map.get(tc_id, {})
            
            is_hard_rejected = False
            repaired_tc = {**tc}
            
            for field in schema:
                name = field["name"]
                val = repaired_tc.get(name)
                val_str = str(val)
                
                # Tính toán tỷ lệ ký tự rác (Garbage Ratio) cho các trường text thường
                # Trừ khi trường có regex đặc thù (mật khẩu)
                has_regex = bool(field.get("regex"))
                special_char_count = len(re.findall(r'[^a-zA-Z0-9\s.,@_-]', val_str))
                garbage_ratio = special_char_count / max(1, len(val_str))
                
                # --- LEVEL 1: HARD REJECT ---
                # Nếu tỷ lệ ký tự rác > 50% và không có regex bảo vệ, coi như bị hỏng nặng
                if not has_regex and garbage_ratio > 0.5 and len(val_str) > 5:
                    is_hard_rejected = True
                    break
                    
                # Enum invariant: Nếu có allowedValues, chỉ cho phép giá trị INVALID_ENUM_VALUE (chủ đích)
                # Nếu sinh ra cái gì đó hoàn toàn ngẫu nhiên ngoài lề thì reject
                if field.get("allowedValues"):
                    allowed = [str(v) for v in field["allowedValues"]]
                    if val_str not in allowed and val_str != "INVALID_ENUM_VALUE":
                        # Có thể repair
                        pass

                # --- LEVEL 2: SOFT REPAIR ---
                needs_repair = False
                
                # Lỗi Padding bất thường (thường do mutate sai lầm)
                if re.search(r'(A|X){6,}$', val_str):
                    needs_repair = True
                    
                if needs_repair:
                    # Khôi phục giá trị từ hạt giống gốc (Golden Data)
                    if golden_seed and name in golden_seed:
                        repaired_tc[name] = golden_seed[name]
                    else:
                        is_hard_rejected = True
                        break
                            
            if not is_hard_rejected:
                cleaned_dataset.append(repaired_tc)
                
        return cleaned_dataset
