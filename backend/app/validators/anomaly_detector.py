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
        Nếu HC phá hỏng dữ liệu (không thể cứu vãn), rollback về golden_seed (dữ liệu GA gốc) để không bị mất test case.
        """
        cleaned_dataset = []
        
        for i, tc in enumerate(final_dataset):
            # _run_hc_on_dataset preserves index, so we can use i to map
            golden_seed = original_seeds[i] if i < len(original_seeds) else {}
            if isinstance(golden_seed, dict) and "data" in golden_seed:
                golden_seed = golden_seed["data"]
                
            is_hard_rejected = False
            repaired_tc = {**tc}
            
            for field in schema:
                name = field["name"]
                val = repaired_tc.get(name)
                val_str = str(val)
                
                # Tính toán tỷ lệ ký tự rác (Garbage Ratio) cho các trường text thường
                has_regex = bool(field.get("regex") or field.get("pattern"))
                special_char_count = len(re.findall(r'[^a-zA-Z0-9\s.,@_-]', val_str))
                garbage_ratio = special_char_count / max(1, len(val_str))
                
                # --- LEVEL 1: HARD REJECT ---
                if not has_regex and garbage_ratio > 0.8 and len(val_str) > 10:
                    # Chỉ reject nếu tỷ lệ rác quá cao (ví dụ toàn ký tự đặc biệt vô nghĩa)
                    is_hard_rejected = True
                    break
                    
                # Enum invariant
                if field.get("allowedValues"):
                    allowed = [str(v) for v in field["allowedValues"]]
                    # Không reject nếu Enum bị mutate để test Negative case (HC/GA cố tình tạo ra)
                    # Nếu giá trị là rỗng (mà require) thì xử lý ở mức ứng dụng, không ném bỏ test case
                    pass

                # --- LEVEL 2: SOFT REPAIR ---
                needs_repair = False
                
                # Không sửa lỗi padding (A|X){6,} vì đây là testcase biên hợp lệ của HC/GA
                # Chỉ sửa nếu nó là rác sinh ra do format sai
                if val_str == "null" or val_str == "undefined":
                    needs_repair = True
                    
                if needs_repair:
                    # Khôi phục giá trị từ hạt giống gốc (Golden Data)
                    if isinstance(golden_seed, dict) and name in golden_seed:
                        repaired_tc[name] = golden_seed[name]
                            
            if is_hard_rejected:
                # Phục hồi về golden seed thay vì vứt bỏ hoàn toàn
                if isinstance(golden_seed, dict) and len(golden_seed) > 0:
                    cleaned_dataset.append(golden_seed)
                else:
                    cleaned_dataset.append(tc) # Fallback to original tc if no golden seed
            else:
                cleaned_dataset.append(repaired_tc)
                
        return cleaned_dataset
