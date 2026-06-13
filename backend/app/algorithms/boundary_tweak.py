import random
import math


class BoundaryTweakStats:
    """
    DTO đại diện cho thống kê kết quả chạy dò tìm giá trị biên cục bộ (Hill Climbing Stats).

    NÂNG CẤP: Hỗ trợ khởi động lại ngẫu nhiên (random restarts), mô phỏng luyện kim (simulated annealing), và tìm kiếm cấm (tabu search).
    """
    def __init__(self, original_fitness, optimized_fitness, tweaks_count,
                 edge_cases_discovered, details, restarts_count=0):
        self.original_fitness = original_fitness
        self.optimized_fitness = optimized_fitness
        self.tweaks_count = tweaks_count
        self.edge_cases_discovered = edge_cases_discovered
        self.details = details
        self.restarts_count = restarts_count

    def to_dict(self):
        return {
            "originalFitness": self.original_fitness,
            "optimizedFitness": self.optimized_fitness,
            "tweaksCount": self.tweaks_count,
            "edgeCasesDiscovered": self.edge_cases_discovered,
            "details": self.details,
            "restartsCount": self.restarts_count
        }


# =========================================================================
# [BƯỚC 2: PHÂN TÍCH THUẬT TOÁN - THUẬT TOÁN LEO ĐỒI (HILL CLIMBING - HC)]
# Luồng 3 (HC) và pha 2 của Luồng 4 (Hybrid) trong giao diện Dashboard Bước 2.
# HC thực hiện tìm kiếm cục bộ (local search) để tinh chỉnh các giá trị biên:
#   1. Phát sinh tập lân cận (Neighborhood) bằng cách cộng/trừ sai số nhỏ, lớn, Gauss, 
#      và ép đúng về các biên (BVA) như minValue, maxValue, minLength, maxLength.
#   2. Tìm kiếm cấm (Tabu Search) thông qua danh sách tabu_list để tránh quay lại các giá trị cũ.
#   3. Mô phỏng luyện kim (Simulated Annealing - SA) chấp nhận các bước đi xấu hơn với xác suất giảm dần 
#      để thoát khỏi các cực trị cục bộ.
#   4. Khởi động lại ngẫu nhiên (Random Restarts) từ nhiều điểm xuất phát khác nhau để tìm biên tốt nhất.
# =========================================================================
def optimize_testcase_boundaries(test_case, schema, fitness_evaluator, max_iterations=15):
    """
    BỘ TINH CHỈNH BIÊN CỤC BỘ NÂNG CẤP (Hill Climbing local search).

    NÂNG CẤP TẦNG 1:
    - Khởi động lại ngẫu nhiên: Chạy HC từ N điểm xuất phát khác nhau, giữ kết quả tốt nhất
    - Mô phỏng luyện kim: Chấp nhận bước đi xấu hơn với xác suất exp(-delta/T) để thoát cực trị cục bộ
    - Tìm kiếm cấm Tabu: Bộ nhớ ngắn hạn ngăn quay lại các trạng thái đã khám phá gần đây
    - Kích thước bước thích nghi cho các trường số
    """
    import time
    random.seed(int(time.time() * 1000) % (2**32))

    best_overall_optimized = None
    best_overall_stats = None
    best_overall_fitness = float('-inf')

    # --- KHỞI ĐỘNG LẠI NGẪU NHIÊN: Chạy HC từ nhiều điểm xuất phát khác nhau ---
    num_restarts = 8
    for restart_idx in range(num_restarts):
        # Tạo điểm xuất phát đa dạng cho mỗi lần khởi động lại
        if restart_idx == 0:
            starting_point = {**test_case}
        else:
            starting_point = _generate_restart_point(test_case, schema, restart_idx)

        # Chạy HC được tăng cường bằng SA từ điểm xuất phát này
        optimized, stats = _simulated_annealing_hc(
            starting_point, schema, fitness_evaluator,
            max_iterations=max_iterations,
            restart_idx=restart_idx
        )

        if stats.optimized_fitness > best_overall_fitness:
            best_overall_fitness = stats.optimized_fitness
            best_overall_optimized = optimized
            best_overall_stats = stats

    # Ghi lại tổng số lần khởi động lại
    best_overall_stats.restarts_count = num_restarts

    # Thêm dòng tóm tắt kết quả
    best_overall_stats.details.insert(0,
        f"=== HC Multi-Restart: {num_restarts} lần chạy, giữ kết quả tốt nhất ==="
    )

    return best_overall_optimized, best_overall_stats


def _generate_restart_point(original, schema, restart_idx):
    """
    Sinh điểm xuất phát đa dạng cho mỗi lần khởi động lại bằng cách áp dụng
    các chiến lược nhiễu loạn khác nhau dựa trên chỉ số lần khởi động.
    """
    import random as _random
    point = {**original}

    for field in schema:
        name = field["name"]
        val = point.get(name)
        val_str = str(val)

        if field["type"] == "number":
            try:
                num = float(val)
                # Áp dụng nhiễu loạn khác nhau cho mỗi lần khởi động
                if restart_idx % 3 == 0:
                    # Đẩy về giá trị biên dưới
                    if field.get("minValue") is not None:
                        point[name] = field["minValue"]
                elif restart_idx % 3 == 1:
                    # Đẩy về giá trị biên trên đối diện
                    if field.get("maxValue") is not None:
                        point[name] = field["maxValue"]
                else:
                    # Nhiễu loạn ngẫu nhiên
                    sigma = (restart_idx + 1) * 2
                    point[name] = num + _random.gauss(0, sigma)
            except (ValueError, TypeError):
                pass
        else:
            # Trường chuỗi: thay đổi độ dài hoặc nhúng mẫu ký tự đặc biệt
            if restart_idx % 4 == 0 and field.get("minLength") is not None:
                point[name] = 'A' * field["minLength"]
            elif restart_idx % 4 == 1 and field.get("maxLength") is not None:
                point[name] = 'X' * field["maxLength"]
            elif restart_idx % 4 == 2:
                point[name] = ''
            # else: giữ nguyên giá trị ban đầu

    return point


def _simulated_annealing_hc(test_case, schema, fitness_evaluator,
                             max_iterations=15, restart_idx=0):
    """
    Leo đồi (Hill Climbing) được tăng cường bằng Mô phỏng luyện kim (Simulated Annealing) và Tìm kiếm cấm (Tabu Search).

    SA: P(chấp_nhận_xấu) = exp(-delta / nhiệt_độ)
    Nhiệt độ giảm dần theo hàm mũ: T_k = T_0 * alpha^k

    Tabu: Các cặp (tên_trường, giá_trị) đã khám phá gần đây bị cấm trong tabu_tenure vòng lặp.
    """
    optimized = {**test_case}
    current_fitness = fitness_evaluator(optimized)
    original_fitness = current_fitness

    tweaks_count = 0
    edge_cases_discovered = 0
    details = []

    # Tham số SA (Mô phỏng luyện kim)
    initial_temperature = 0.15
    alpha = 0.85  # tốc độ làm nguội
    temperature = initial_temperature

    # Tìm kiếm cấm Tabu
    tabu_list = []  # danh sách các cặp (tên_trường, giá_trị_hash)
    tabu_tenure = 5  # số vòng lặp mà một trạng thái bị cấm

    # Định nghĩa lân cận (Neighborhood)
    special_chars = ["!", "@", "#", "$", "%", "^", "&", "*", "'", '"', "<", ">", "/", "\\", ";", "-", " "]

    if restart_idx == 0:
        details.append(f"Khởi động tối ưu hóa biên SA+Tabu (điểm gốc): {original_fitness:.4f}")
    else:
        details.append(f"Restart #{restart_idx}: bắt đầu với fitness={original_fitness:.4f}, T={temperature:.4f}")

    iteration = 0
    improved_global = True

    while iteration < max_iterations and (improved_global or temperature > 0.001):
        improved_global = False
        iteration += 1

        # Giảm dần nhiệt độ (cooling)
        temperature = initial_temperature * (alpha ** iteration)

        # --- Thử tinh chỉnh từng trường dữ liệu ---
        for field in schema:
            field_name = field["name"]
            field_type = field["type"]
            current_val = optimized[field_name]
            neighbors = []

            # =========================================================================
            # [BVA] SINH TẬP CÁC PHƯƠNG ÁN LÂN CẬN (NEIGHBORHOOD GENERATION FOR LOCAL SEARCH)
            # Nhằm dò tìm các điểm biên cục bộ xung quanh giải pháp hiện tại.
            # Tận dụng các phép biến đổi giá trị số học và độ dài chuỗi để tiệm cận các biên.
            # =========================================================================
            if field_type == "number":
                try:
                    num = float(current_val)
                    # Kích thước bước thích nghi dựa trên phạm vi trường
                    min_v = field.get("minValue", 0)
                    max_v = field.get("maxValue", 1000)
                    field_range = max(abs(max_v - min_v), 1)

                    # --- Lân cận bước nhỏ (chênh lệch ±1 đơn vị) ---
                    neighbors.extend([num + 1, num - 1])
                    # --- Lân cận bước trung bình (10% phạm vi miền giá trị) ---
                    medium_step = max(1, int(field_range * 0.1))
                    neighbors.extend([num + medium_step, num - medium_step])
                    # --- Lân cận bước lớn (50% phạm vi miền giá trị) ---
                    large_step = max(1, int(field_range * 0.5))
                    neighbors.extend([num + large_step, num - large_step])
                    # --- Nhiễu loạn ngẫu nhiên phân phối Gauss ---
                    sigma = field_range * 0.05
                    neighbors.append(num + random.gauss(0, sigma))
                    
                    # --- [BVA] Ép giá trị về các điểm biên đặc tả ---
                    neighbors.extend([0])
                    if field.get("minValue") is not None:
                        # Điểm biên dưới (Min) và điểm vi phạm dưới biên (Min - 1)
                        neighbors.extend([field["minValue"], field["minValue"] - 1])
                    if field.get("maxValue") is not None:
                        # Điểm biên trên (Max) và điểm vi phạm trên biên (Max + 1)
                        neighbors.extend([field["maxValue"], field["maxValue"] + 1])
                except (ValueError, TypeError):
                    pass
            else:
                str_val = str(current_val)

                # --- Biến đổi ký tự (Thêm/Bớt/Nhúng mã độc để kiểm tra robustness) ---
                for char in special_chars[:8]:  # tập con để giới hạn số lân cận
                    neighbors.append(str_val + char)
                    neighbors.append(char + str_val)

                # Xóa ký tự để thay đổi độ dài chuỗi
                if len(str_val) > 0:
                    neighbors.append(str_val[:-1])
                    neighbors.append(str_val[1:])
                    neighbors.append("")



                # --- [BVA] Tinh chỉnh độ dài chuỗi tiệm cận biên đặc tả ---
                if field.get("minLength") is not None:
                    target = field["minLength"]
                    if len(str_val) > target:
                        # Cắt chuỗi để bằng đúng độ dài tối thiểu (Min Length)
                        neighbors.append(str_val[:target])
                    else:
                        # Đệm thêm ký tự để đạt độ dài tối thiểu (Min Length)
                        neighbors.append(str_val.ljust(target, "A"))
                if field.get("maxLength") is not None:
                    target = field["maxLength"]
                    if len(str_val) < target:
                        # Đệm thêm ký tự để đạt đúng độ dài tối đa (Max Length)
                        neighbors.append(str_val.ljust(target, "A"))
                    # Đệm thêm ký tự vượt quá độ dài tối đa 1 đơn vị để tạo ca kiểm thử vi phạm biên trên (Max Length + 1)
                    neighbors.append(str_val.ljust(target + 1, "X"))

            # --- 2. Đánh giá các lân cận (có lọc Tabu) ---
            best_neighbor = None
            best_neighbor_fitness = float('-inf')
            all_neighbor_results = []

            for candidate_val in neighbors:
                # Chuyển float->int nếu cần thiết
                if isinstance(candidate_val, float) and candidate_val == int(candidate_val):
                    candidate_val = int(candidate_val)

                # Kiểm tra Tabu: bỏ qua các trạng thái đã khám phá gần đây
                val_hash = str(candidate_val)[:50]  # hash rút gọn
                tabu_key = (field_name, val_hash)
                if tabu_key in tabu_list:
                    continue

                candidate_testcase = {**optimized, field_name: candidate_val}
                score = fitness_evaluator(candidate_testcase)
                all_neighbor_results.append((candidate_val, score))

                if score > best_neighbor_fitness:
                    best_neighbor = candidate_val
                    best_neighbor_fitness = score

            # [START: SIMULATED_ANNEALING_ACCEPTANCE]
            # --- 3. Chấp nhận bước đi (SA hoặc Leo dốc đứng) ---
            if best_neighbor is not None:
                delta = best_neighbor_fitness - current_fitness

                accept_move = False
                if delta > 0:
                    # Cải thiện: luôn chấp nhận
                    accept_move = True
                elif temperature > 0.001:
                    # SA: chấp nhận bước xấu hơn với xác suất exp(-|delta|/T)
                    sa_prob = math.exp(-abs(delta) / temperature)
                    if random.random() < sa_prob:
                        accept_move = True
                        details.append(
                            f"  [SA] Chấp nhận bước xấu (delta={delta:.4f}, T={temperature:.4f}, P={sa_prob:.3f})"
                        )
            # [END: SIMULATED_ANNEALING_ACCEPTANCE]

                if accept_move:
                    prev_val = optimized[field_name]
                    if isinstance(prev_val, float) and prev_val == int(prev_val):
                        prev_val = int(prev_val)
                    optimized[field_name] = best_neighbor
                    current_fitness = best_neighbor_fitness
                    tweaks_count += 1
                    improved_global = True

                    # Thêm vào danh sách Tabu
                    tabu_list.append((field_name, str(best_neighbor)[:50]))
                    if len(tabu_list) > tabu_tenure * len(schema):
                        tabu_list = tabu_list[-(tabu_tenure * len(schema)):]

                    # Ghi log tinh chỉnh
                    prev_str = str(prev_val)[:15] + ("..." if len(str(prev_val)) > 15 else "")
                    new_str = str(best_neighbor)[:15] + ("..." if len(str(best_neighbor)) > 15 else "")
                    direction = "↑" if delta > 0 else "↓"
                    details.append(
                        f"Tinh chỉnh [{field_name}] '{prev_str}' -> '{new_str}' {direction}{abs(delta):.4f} (T={temperature:.3f})"
                    )

                    # Theo dõi phát hiện các ca biên
                    is_bound = False
                    if field_type == "number":
                        try:
                            is_bound = float(best_neighbor) in [field.get("minValue"), field.get("maxValue")]
                        except (ValueError, TypeError):
                            pass
                    else:
                        is_bound = (
                            (field.get("minLength") is not None and len(str(best_neighbor)) == field["minLength"]) or
                            (field.get("maxLength") is not None and len(str(best_neighbor)) == field["maxLength"])
                        )

                    if is_bound or str(best_neighbor) == "":
                        edge_cases_discovered += 1

    # --- Kiểm tra trì trệ: nếu không cải thiện được, ghi chú vào log ---
    if not improved_global:
        details.append(f"HC dừng: không thể cải thiện thêm (T_final={temperature:.6f})")

    details.append(
        f"Kết thúc HC. Fitness: {original_fitness:.4f} → {current_fitness:.4f}. "
        f"Tinh chỉnh: {tweaks_count}, Edge cases: {edge_cases_discovered}"
    )

    stats = BoundaryTweakStats(
        original_fitness=original_fitness,
        optimized_fitness=current_fitness,
        tweaks_count=tweaks_count,
        edge_cases_discovered=edge_cases_discovered,
        details=details
    )

    return optimized, stats
