import random

class BoundaryTweakStats:
    """
    DTO đại diện cho thống kê kết quả chạy dò tìm giá trị biên cục bộ (Hill Climbing Stats).
    """
    def __init__(self, original_fitness, optimized_fitness, tweaks_count, edge_cases_discovered, details):
        self.original_fitness = original_fitness
        self.optimized_fitness = optimized_fitness
        self.tweaks_count = tweaks_count
        self.edge_cases_discovered = edge_cases_discovered
        self.details = details

    def to_dict(self):
        return {
            "originalFitness": self.original_fitness,
            "optimizedFitness": self.optimized_fitness,
            "tweaksCount": self.tweaks_count,
            "edgeCasesDiscovered": self.edge_cases_discovered,
            "details": self.details
        }


def optimize_testcase_boundaries(test_case, schema, fitness_evaluator, max_iterations=15):
    """
    BỘ TINH CHỈNH BIÊN CỤC BỘ (Hill Climbing local search).
    Nhận một Test Case tốt nhất và thực hiện các thử nghiệm biến đổi siêu vi (micro tweaks)
    ở mức độ ký tự hoặc số học để dò tìm ra các ca lỗi biên (Edge Cases) khắc nghiệt nhất.
    """
    optimized = {**test_case}
    current_fitness = fitness_evaluator(optimized)
    original_fitness = current_fitness

    tweaks_count = 0
    edge_cases_discovered = 0
    details = []

    # Danh sách các ký tự đặc biệt biên dùng để chạy thử nghiệm chèn
    special_chars = ["!", "@", "#", "$", "%", "^", "&", "*", "'", '"', "<", ">", "/", "\\", ";", "-", " "]
    security_tags = ["' OR 1=1 --", "<script>alert(1)</script>", "<svg/onload=alert(1)>"]

    details.append(f"Khởi động tối ưu hóa biên với điểm thích nghi ban đầu: {original_fitness:.4f}")

    iteration = 0
    improved = True

    while iteration < max_iterations and improved:
        improved = False
        iteration += 1

        # Chạy thử nghiệm tinh chỉnh từng trường dữ liệu một
        for field in schema:
            field_name = field["name"]
            field_type = field["type"]
            current_val = optimized[field_name]
            neighbors = []

            # --- 1. Tạo tập giá trị lân cận (Neighborhood Generation) ---
            if field_type == "number":
                try:
                    num = float(current_val)
                    # Chạy các bước số học nhỏ (micro steps)
                    neighbors.append(num + 1)
                    neighbors.append(num - 1)
                    neighbors.append(num + 0.1)
                    neighbors.append(num - 0.1)
                    # Chạy các giá trị biên đặc biệt
                    neighbors.append(0)
                    if field.get("minValue") is not None:
                        neighbors.append(field["minValue"])
                        neighbors.append(field["minValue"] - 1) # biên lỗi nhỏ hơn min
                    if field.get("maxValue") is not None:
                        neighbors.append(field["maxValue"])
                        neighbors.append(field["maxValue"] + 1) # biên lỗi lớn hơn max
                except ValueError:
                    pass
            else:
                # Đối với kiểu chuỗi và định dạng pattern khác
                str_val = str(current_val)

                # Chạy thử thêm ký tự đặc biệt ở đầu/cuối
                for char in special_chars:
                    neighbors.append(str_val + char)
                    neighbors.append(char + str_val)

                # Chạy thử xóa ký tự ở đầu/cuối
                if len(str_val) > 0:
                    neighbors.append(str_val[:-1])
                    neighbors.append(str_val[1:])
                    neighbors.append("") # chuỗi rỗng

                # Chạy thử nhúng mã độc
                for tag in security_tags:
                    neighbors.append(str_val + tag)
                    neighbors.append(tag)

                # Chạy thử điều chỉnh chính xác theo giới hạn độ dài JSON Schema
                if field.get("minLength") is not None:
                    neighbors.append(str_val[:field["minLength"]])
                if field.get("maxLength") is not None:
                    neighbors.append(str_val.ljust(field["maxLength"], "A")) # vừa khít độ dài max
                    neighbors.append(str_val.ljust(field["maxLength"] + 1, "X")) # tràn độ dài max 1 ký tự

            # --- 2. Đánh giá chất lượng các phương án chạy thử ---
            best_neighbor = None
            best_neighbor_fitness = current_fitness

            for candidate_val in neighbors:
                candidate_testcase = {**optimized, field_name: candidate_val}
                score = fitness_evaluator(candidate_testcase)

                # Nếu phương án mới làm tăng điểm chất lượng, ghi nhận làm đỉnh leo đồi mới
                if score > best_neighbor_fitness:
                    best_neighbor = candidate_val
                    best_neighbor_fitness = score

            # --- 3. Chấp nhận phương án tối ưu cục bộ tốt nhất (Steepest Ascent) ---
            if best_neighbor is not None:
                prev_val = optimized[field_name]
                optimized[field_name] = best_neighbor
                current_fitness = best_neighbor_fitness
                tweaks_count += 1
                improved = True

                # Rút gọn chuỗi dài để in ra log cho đẹp
                prev_str = str(prev_val)[:15] + ("..." if len(str(prev_val)) > 15 else "")
                new_str = str(best_neighbor)[:15] + ("..." if len(str(best_neighbor)) > 15 else "")
                
                details.append(
                    f"Tinh chỉnh [{field_name}] từ '{prev_str}' -> '{new_str}' (Chất lượng tăng: {best_neighbor_fitness:.4f})"
                )

                # Nhận diện xem phương án này có phải là một ca biên hay mã độc đột phá không
                is_sec = any(tag.lower() in str(best_neighbor).lower() for tag in security_tags)
                is_bound = False
                if field_type == "number":
                    try:
                        is_bound = float(best_neighbor) in [field.get("minValue"), field.get("maxValue")]
                    except ValueError:
                        pass
                else:
                    is_bound = (field.get("minLength") is not None and len(str(best_neighbor)) == field["minLength"] or 
                                field.get("maxLength") is not None and len(str(best_neighbor)) == field["maxLength"])

                if is_sec or is_bound or str(best_neighbor) == "":
                    edge_cases_discovered += 1

    details.append(f"Kết thúc dò biên. Điểm tối ưu cuối cùng: {current_fitness:.4f}. Tổng số lượt tinh chỉnh: {tweaks_count}")

    stats = BoundaryTweakStats(
        original_fitness=original_fitness,
        optimized_fitness=current_fitness,
        tweaks_count=tweaks_count,
        edge_cases_discovered=edge_cases_discovered,
        details=details
    )

    return optimized, stats
