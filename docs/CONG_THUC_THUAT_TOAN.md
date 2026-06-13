# TỔNG HỢP CÁC CÔNG THỨC THUẬT TOÁN TRONG DỰ ÁN

> Tài liệu này tổng hợp **toàn bộ công thức toán học** được sử dụng trong hệ thống sinh và tối ưu hóa Test Case (LLM Test Data). Mỗi công thức đều kèm: ý nghĩa, công thức ký hiệu, và đoạn mã nguồn thực tế kèm vị trí file.

---

## MỤC LỤC

1. [Hàm thích nghi (Fitness Function)](#1-hàm-thích-nghi-fitness-function)
2. [Điểm Validation (Tính hợp lệ)](#2-điểm-validation-tính-hợp-lệ)
3. [Điểm Boundary (Bao phủ biên)](#3-điểm-boundary-bao-phủ-biên)
4. [Điểm Priority (Mức độ ưu tiên)](#4-điểm-priority-mức-độ-ưu-tiên)
5. [Điểm Diversity (Độ đa dạng)](#5-điểm-diversity-độ-đa-dạng)
6. [Penalty (Phạt trùng lặp)](#6-penalty-phạt-trùng-lặp)
7. [Tỷ lệ đột biến & lai ghép thích nghi (Adaptive Rates)](#7-tỷ-lệ-đột-biến--lai-ghép-thích-nghi)
8. [Đột biến Gauss (Gaussian Mutation)](#8-đột-biến-gauss-gaussian-mutation)
9. [Tournament Selection & Niche Density Distance](#9-tournament-selection--niche-density-distance)
10. [Phát hiện trì trệ (Stagnation Detection)](#10-phát-hiện-trì-trệ-stagnation-detection)
11. [Độ bao phủ tổng hợp (Composite Coverage)](#11-độ-bao-phủ-tổng-hợp-composite-coverage)
12. [Bao phủ cặp đôi (Pairwise Coverage)](#12-bao-phủ-cặp-đôi-pairwise-coverage)
13. [Mô phỏng luyện kim (Simulated Annealing)](#13-mô-phỏng-luyện-kim-simulated-annealing)
14. [Bảng tổng hợp tham số mặc định](#14-bảng-tổng-hợp-tham-số-mặc-định)

---

## 1. Hàm thích nghi (Fitness Function)

**Vị trí:** `backend/app/algorithms/optimizer_engine.py` (dòng 409–422)

Đây là công thức trung tâm của Giải thuật Di truyền (GA), dùng để chấm điểm chất lượng mỗi Test Case. Fitness là tổng có trọng số của 4 thành phần, trừ đi hình phạt trùng lặp.

### Công thức

$$
\text{Fitness} = w_v \cdot S_v + w_b \cdot S_b + w_p \cdot S_p + w_d \cdot S_d - P
$$

$$
\text{Fitness} = \max\big(0.01,\ \min(\text{Fitness},\ 1.0)\big)
$$

Trong đó:

| Ký hiệu | Thành phần | Trọng số mặc định |
|---------|-----------|-------------------|
| $S_v$ | Validation/Coverage Score (điểm hợp lệ/bao phủ) | $w_v = 0.4$ |
| $S_b$ | Boundary Score (điểm bao phủ biên) | $w_b = 0.3$ |
| $S_p$ | Priority Score (điểm ưu tiên) | $w_p = 0.1$ |
| $S_d$ | Diversity Score (điểm đa dạng) | $w_d = 0.2$ |
| $P$ | Penalty (phạt trùng lặp, hệ số $0.5$) | — |

Giá trị Fitness luôn được giới hạn (clamp) trong khoảng **[0.01, 1.0]**.

### Mã nguồn

```python
        # Calculate final fitness based on weights
        w1, w2, w3, w4, w5 = 0.4, 0.2, 0.1, 0.3, 0.5
        fitness = (w1 * v_score) + (w2 * d_score) + (w3 * p_score) + (w4 * b_score) - (w5 * penalty)
        fitness = max(0.01, min(fitness, 1.0))
```

---

## 2. Điểm Validation (Tính hợp lệ)

**Vị trí:** `optimizer_engine.py` (dòng 280–418)

Đánh giá mức độ tuân thủ ràng buộc của từng trường. Mỗi trường được phân làm **ràng buộc cứng (Hard)** và **ràng buộc mềm (Soft)**.

### Công thức

Điểm cho từng trường $i$:

$$
s_i =
\begin{cases}
0.00 & \text{nếu vi phạm ràng buộc cứng (Hard fail)} \\
0.70 & \text{nếu qua Hard nhưng vi phạm ràng buộc mềm (Soft fail)} \\
1.00 & \text{nếu qua tất cả}
\end{cases}
$$

Chuẩn hóa trên tổng số trường $N$:

$$
S_v = \frac{1}{N} \sum_{i=1}^{N} s_i
$$

**Ràng buộc cứng (Hard):** trường bắt buộc (required), đúng kiểu dữ liệu (email/card/phone/number), thuộc tập enum (allowedValues).

**Ràng buộc mềm (Soft):** nằm trong khoảng `minValue`–`maxValue` (số), độ dài `minLength`–`maxLength` (chuỗi), khớp regex.

### Mã nguồn

```python
# Scoring validation
if not hard_passed:
    field_val_score = 0.0
elif not soft_passed:
    field_val_score = 0.70
else:
    field_val_score = 1.00

validation_score += field_val_score
...
# Normalize
v_score = validation_score / num_fields
```

Các biểu thức kiểm tra kiểu dữ liệu (regex):

```python
# email
re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", val_str)
# card (16 chữ số liền)
re.match(r"^\d{16}$", val_str)
# phone (đầu số di động VN)
re.match(r"^(03|05|07|08|09)\d{8}$", val_str)
```

---

## 3. Điểm Boundary (Bao phủ biên)

**Vị trí:** `optimizer_engine.py` (dòng 365–419) — chỉ tính cho trường có `field_val_score == 1.0`.

Áp dụng kỹ thuật Phân tích Giá trị Biên (BVA): cho điểm đầy đủ khi **trúng biên**, điểm một phần khi **gần biên**.

### Công thức

Điểm biên cho từng trường $i$:

$$
b_i =
\begin{cases}
1.0 & \text{nếu trúng đúng biên } (\text{value} = \text{min/max hoặc len} = \text{minLen/maxLen}) \\
0.5 & \text{nếu gần biên } (\pm 1 \text{ so với biên}) \\
0.0 & \text{ngược lại}
\end{cases}
$$

Chuẩn hóa và giới hạn ở 1.0:

$$
S_b = \min\left( \frac{1}{N} \sum_{i=1}^{N} b_i,\ 1.0 \right)
$$

### Mã nguồn

```python
# Số: trúng biên min/max, gần biên min+1 / max-1
if min_v is not None:
    if num == min_v:        is_boundary = True
    elif num == min_v + 1:  is_near_boundary = True
if max_v is not None:
    if num == max_v:        is_boundary = True
    elif num == max_v - 1:  is_near_boundary = True

# Chuỗi: trúng độ dài biên min/max, gần biên
if len(val_str) == min_l:       is_boundary = True
elif len(val_str) == min_l + 1: is_near_boundary = True
...
if is_boundary:        boundary_score += 1.0
elif is_near_boundary: boundary_score += 0.5
...
b_score = min(boundary_score / num_fields, 1.0)
```

---

## 4. Điểm Priority (Mức độ ưu tiên)

**Vị trí:** `optimizer_engine.py` (dòng 409–417)

Đánh giá mức độ quan trọng và ưu tiên kiểm thử của Test Case dựa trên phân loại ngữ cảnh.

### Công thức

$$
S_p =
\begin{cases}
1.0 & \text{nếu là ca kiểm thử biên (boundary)} \\
0.7 & \text{nếu là ca kiểm thử lỗi dữ liệu (negative)} \\
0.4 & \text{nếu là ca kiểm thử chuẩn hợp lệ (positive)}
\end{cases}
$$

### Mã nguồn

```python
        # --- 6. Priority (Dynamic, evaluated on the fly) ---
        category = self._categorize_testcase(test_case)
        if category == "boundary":
            p_score = 1.0
        elif category == "negative":
            p_score = 0.7
        else:
            p_score = 0.4
```

---

## 5. Điểm Diversity (Độ đa dạng)

**Vị trí:** `optimizer_engine.py` — hàm `calculate_diversity_score` (dòng 54–68), `fast_distance` (35–51), `levenshtein_distance` (7–25).

Đo độ khác biệt của Test Case so với một mẫu ngẫu nhiên trong quần thể. Dùng khoảng cách Levenshtein chuẩn hóa (với chuỗi ngắn) hoặc xấp xỉ prefix nhanh (chuỗi dài) để tránh độ phức tạp $O(N^2)$.

### Công thức

**Khoảng cách giữa 2 giá trị chuỗi** $v_1, v_2$:

$$
d(v_1, v_2) =
\begin{cases}
\dfrac{\text{Lev}(v_1, v_2)}{\max(|v_1|, |v_2|, 1)} & \text{nếu } |v_1| \le 12 \text{ và } |v_2| \le 12 \\[2mm]
1.0 - 0.15 \cdot c & \text{ngược lại (}c = \text{số ký tự prefix trùng, tối đa 4)}
\end{cases}
$$

**Điểm đa dạng** so với tập mẫu $\text{subset}$ gồm $M$ phần tử, mỗi test case có $K$ trường (keys):

$$
S_d = \min\left( \frac{1}{M} \sum_{j=1}^{M} \frac{1}{K} \sum_{k=1}^{K} d(v_k, v_{j,k}),\ 1.0 \right)
$$

**Kích thước mẫu** lấy động:

$$
\text{sample\_size} = \min\big(20,\ \max(5,\ \lfloor |\text{suite}| / 2 \rfloor)\big)
$$

### Mã nguồn

```python
def fast_distance(v1, v2):
    if v1 == v2: return 0.0
    max_len = max(len(v1), len(v2), 1)
    if len(v1) <= 12 and len(v2) <= 12:
        return levenshtein_distance(v1, v2) / max_len
    # Xấp xỉ prefix nhanh cho chuỗi dài
    common_prefix = 0
    for i in range(min(len(v1), len(v2), 4)):
        if v1[i] == v2[i]: common_prefix += 1
        else: break
    return 1.0 - (common_prefix * 0.15)

def calculate_diversity_score(test_case, subset):
    if not subset: return 1.0
    total_dist = 0.0
    keys = list(test_case.keys())
    for other in subset:
        diffs = 0.0
        for k in keys:
            diffs += fast_distance(str(test_case[k]), str(other.get(k, "")))
        total_dist += diffs / len(keys)
    return min(total_dist / len(subset), 1.0)
```

---

## 6. Penalty (Phạt trùng lặp)

**Vị trí:** `optimizer_engine.py` (dòng 433–435)

Phạt các Test Case trùng lặp để tăng đa dạng quần thể.

### Công thức

Gọi $n$ = số bản sao giống hệt của test case trong quần thể (`dup_count`):

$$
P =
\begin{cases}
\min\big(0.15 \cdot (n - 1),\ 0.6\big) & \text{nếu } n > 1 \\
0 & \text{nếu } n \le 1
\end{cases}
$$

Mỗi bản trùng cộng thêm 0.15 phạt, tối đa 0.6.

### Mã nguồn

```python
dup_count = sum(
    1 for other in current_suite_values
    if all(str(test_case[k]) == str(other.get(k, "")) for k in test_case.keys())
)
penalty = min(0.15 * (dup_count - 1), 0.6) if dup_count > 1 else 0.0
```

---

## 7. Tỷ lệ đột biến & lai ghép thích nghi

**Vị trí:** `optimizer_engine.py` (dòng 234–257)

Tỷ lệ giảm dần theo thế hệ: ban đầu cao (thiên về **khám phá – exploration**), về sau thấp (thiên về **khai thác – exploitation**).

### Công thức

**Tỷ lệ tiến độ** ($p$): với thế hệ hiện tại $g$ và tổng thế hệ $G$:

$$
p = \min\left( \frac{g}{G - 1},\ 1.0 \right)
$$

**Tỷ lệ đột biến** (giảm theo hàm bậc 2):

$$
\text{rate}_{mut} = r_{mut}^{init} - (r_{mut}^{init} - r_{mut}^{min}) \cdot p^2
$$

với $r_{mut}^{init} = 0.15$, $r_{mut}^{min} = 0.02$.

**Tỷ lệ lai ghép** (giảm mềm hơn, mũ 1.5):

$$
\text{rate}_{cross} = r_{cross}^{init} - (r_{cross}^{init} - r_{cross}^{min}) \cdot p^{1.5}
$$

với $r_{cross}^{init} = 0.8$, $r_{cross}^{min} = 0.45$.

### Mã nguồn

```python
def _progress_ratio(self):
    if self.max_generations <= 1: return 0.0
    return min(self.generation / (self.max_generations - 1), 1.0)

def get_adaptive_mutation_rate(self):
    p = self._progress_ratio()
    return self._initial_mutation_rate \
         - (self._initial_mutation_rate - self._min_mutation_rate) * (p ** 2)

def get_adaptive_crossover_rate(self):
    p = self._progress_ratio()
    return self._initial_crossover_rate \
         - (self._initial_crossover_rate - self._min_crossover_rate) * (p ** 1.5)
```

---

## 8. Đột biến Gauss (Gaussian Mutation)

**Vị trí:** `optimizer_engine.py` (dòng 662–670)

Với trường số, giá trị mới được nhiễu loạn theo phân phối chuẩn $N(0, \sigma)$, với $\sigma$ giảm dần qua các thế hệ.

### Công thức

$$
\text{value}_{new} = \text{value} + \mathcal{N}(0, \sigma)
$$

$$
\sigma = \max\left( 0.5,\ \frac{G - g}{G} \cdot 5 \right)
$$

Sau đó kẹp giá trị trong khoảng `[minValue − 2, maxValue + 2]`.

### Mã nguồn

```python
sigma = max(0.5, (self.max_generations - self.generation) / self.max_generations * 5)
mutated_tc[name] = num + random.gauss(0, sigma)
if field.get("minValue") is not None:
    mutated_tc[name] = max(field["minValue"] - 2, mutated_tc[name])
if field.get("maxValue") is not None:
    mutated_tc[name] = min(field["maxValue"] + 2, mutated_tc[name])
```

---

## 9. Tournament Selection & Niche Density Distance

**Vị trí:** `optimizer_engine.py` (dòng 569–611)

Chọn cá thể bố mẹ bằng **Tournament Selection** (kích thước giải đấu = 3). Khi fitness ngang nhau, ưu tiên cá thể ở vùng mật độ thưa thớt hơn trong không gian quyết định (niche density distance lớn) để duy trì đa dạng di truyền.

### Công thức

**Niche Density Distance (NDD)** của cá thể: trung bình của 3 khoảng cách lớn nhất tới các cá thể trong mẫu so sánh ngẫu nhiên (sử dụng khoảng cách kiểu hình trong không gian quyết định thay thế cho Crowding Distance vốn tính trên không gian hàm mục tiêu).

$$
\text{NDD} = \frac{1}{3} \sum_{t \in \text{top-3 xa nhất}} \left( \frac{1}{K} \sum_{k=1}^{K} d(v_k, v_{t,k}) \right)
$$

Tiêu chí sắp xếp ứng viên: ưu tiên fitness cao, sau đó NDD cao.

### Mã nguồn

```python
def select_parent(self):
    tour_size = 3
    candidates = random.sample(self.test_suite, tour_size)
    candidates.sort(key=lambda x: (-x["fitness"], -self._niche_density_distance(x)))
    return candidates[0]["values"]

def _niche_density_distance(self, individual):
    sample = random.sample(self.test_suite, min(10, len(self.test_suite)))
    distances = []
    for other in sample:
        if other is individual: continue
        dist = 0.0
        keys = list(individual["values"].keys())
        for k in keys:
            dist += fast_distance(str(individual["values"].get(k, "")),
                                  str(other["values"].get(k, "")))
        distances.append(dist / len(keys) if keys else 0)
    distances.sort(reverse=True)
    top_k = distances[:3]
    return sum(top_k) / len(top_k)
```

---

## 10. Phát hiện trì trệ (Stagnation Detection)

**Vị trí:** `optimizer_engine.py` (dòng 718–725, 834)

Phát hiện khi quần thể ngừng cải thiện để kích hoạt tái khởi tạo.

### Công thức

Trên cửa sổ $T = 8$ thế hệ gần nhất, quần thể bị coi là **trì trệ** nếu:

$$
\max(\text{fitness}_{recent}) - \min(\text{fitness}_{recent}) < 0.005
$$

**Ngưỡng chọn lọc** (số cá thể "tốt") tăng dần theo thế hệ:

$$
\text{threshold} = 0.40 + \min\left(\frac{g}{G},\ 1.0\right) \cdot 0.20
$$

Khi trì trệ → **tái tạo 80% quần thể**, giữ lại 20% tốt nhất (Elitism giữ 5% top mỗi thế hệ).

### Mã nguồn

```python
def _is_stagnated(self):
    if len(self._best_fitness_history) < self._stagnation_threshold:
        return False
    recent = self._best_fitness_history[-self._stagnation_threshold:]
    return max(recent) - min(recent) < 0.005

# Ngưỡng chọn lọc động
threshold = 0.40 + min(self.generation / self.max_generations, 1.0) * 0.20
selected_count = sum(1 for ind in self.test_suite if ind["fitness"] >= threshold)

# Tái tạo: giữ 20% tốt nhất
preserve_count = max(1, int(self.config["popSize"] * 0.2))
```

---

## 11. Độ bao phủ tổng hợp (Composite Coverage)

**Vị trí:** `optimizer_engine.py` — `_compute_full_coverage` (dòng 860–934)

Đo độ bao phủ của cả quần thể, kết hợp các yếu tố, sau đó chiết khấu theo tỷ lệ trùng lặp.

### Công thức

$$
\text{Coverage} = \min\Big( 0.60 \cdot f_{val} + 0.20 \cdot f_{bound} + 0.20 \cdot f_{pair},\ 1.0 \Big)
$$

Trong đó:

$$
f_{val} = \frac{\text{số trường hợp lệ}}{\text{tổng số test} \times N}, \quad
f_{bound} = \frac{|\text{biên đã chạm}|}{4N}
$$

($4N$ vì mỗi trường có 4 biên: 2 chính xác + 2 gần biên).

**Chiết khấu trùng lặp:** nếu tỷ lệ trùng `dup_rate > 0.3`:

$$
\text{Coverage} \mathrel{\ast}= \big(1.0 - (\text{dup\_rate} - 0.3) \cdot 0.5\big)
$$

**Tỷ lệ trùng lặp:**

$$
\text{dup\_rate} = \frac{\text{số test bị trùng}}{\text{popSize}}
$$

### Mã nguồn

```python
        # --- 3. Composite coverage ---
        # 60% validation + 20% boundary + 20% pairwise
        coverage = min(
            (val_factor * 0.60) + (bound_factor * 0.20) + (pairwise_coverage * 0.20),
            1.0
        )
dup_rate = self._compute_duplicate_rate()
if dup_rate > 0.3:
    coverage *= (1.0 - (dup_rate - 0.3) * 0.5)
return max(coverage, 0.01)
```

> **Lưu ý:** Hàm `_compute_coverage_for_set` (dùng cho minimization) dùng trọng số khác: `0.7 * val + 0.3 * bound` (chỉ 2 biên/trường).

---

## 12. Bao phủ cặp đôi (Pairwise Coverage)

**Vị trí:** `optimizer_engine.py` — `_compute_pairwise_coverage` (dòng 944–1020)

Đếm số tổ hợp cặp (trường $i$ = phân loại, trường $j$ = phân loại) được bao phủ. Mỗi giá trị được phân loại thành các danh mục: `valid`, `boundary_min/max`, `invalid_*`, `empty`.

### Công thức

$$
f_{pair} = \min\left( \frac{|\text{cặp đã bao phủ}|}{\text{tổng cặp khả thi}},\ 1.0 \right)
$$

Tổng số cặp khả thi được tính toán chính xác dựa trên tích Đề-các (Cartesian Product) của số lượng danh mục phân loại khả thi đối với từng cặp trường:

$$
\text{tổng cặp khả thi} = \sum_{i < j} |Cat_i| \times |Cat_j|
$$

### Mã nguồn

```python
# Xác định tập danh mục phân loại khả thi của một trường ràng buộc nghiệp vụ
def get_possible_categories(field):
    cats = ["empty", "valid"]
    if field["type"] == "number":
        cats.append("invalid")
        if field.get("minValue") is not None:
            cats.extend(["boundary_min", "invalid_low"])
        if field.get("maxValue") is not None:
            cats.extend(["boundary_max", "invalid_high"])
    else:
        if field.get("minLength") is not None:
            cats.extend(["boundary_min", "invalid_short"])
        if field.get("maxLength") is not None:
            cats.extend(["boundary_max", "invalid_long"])
    return cats

# Collect all pairs covered
covered_pairs = set()
for i in range(len(self.schema)):
    for j in range(i + 1, len(self.schema)):
        fi = self.schema[i]
        fj = self.schema[j]
        for tc in raw_values:
            cat_i = categorize_value(fi, tc.get(fi["name"], ""))
            cat_j = categorize_value(fj, tc.get(fj["name"], ""))
            covered_pairs.add((fi["name"], cat_i, fj["name"], cat_j))

# Tính toán chính xác tổng số cặp phân loại khả thi dựa trên tích Đề-các (Cartesian Product)
total_possible_pairs = 0
for i in range(len(self.schema)):
    for j in range(i + 1, len(self.schema)):
        cats_i = get_possible_categories(self.schema[i])
        cats_j = get_possible_categories(self.schema[j])
        total_possible_pairs += len(cats_i) * len(cats_j)

return min(len(covered_pairs) / max(total_possible_pairs, 1), 1.0)
```

---

## 13. Mô phỏng luyện kim (Simulated Annealing)

**Vị trí:** `backend/app/algorithms/boundary_tweak.py` — `_simulated_annealing_hc` (dòng 135–358)

Thuộc pha Leo Đồi (Hill Climbing) tinh chỉnh biên cục bộ. SA cho phép chấp nhận bước đi xấu hơn để thoát cực trị cục bộ, có kết hợp Tabu Search và Random Restart.

### Công thức

**Lịch giảm nhiệt độ (cooling) theo hàm mũ:** với $T_0 = 0.15$, $\alpha = 0.85$:

$$
T_k = T_0 \cdot \alpha^{k}
$$

**Xác suất chấp nhận bước xấu** ($\Delta = \text{fitness}_{new} - \text{fitness}_{current} < 0$):

$$
P(\text{chấp nhận}) =
\begin{cases}
1 & \text{nếu } \Delta > 0 \quad (\text{luôn nhận khi cải thiện}) \\
e^{-|\Delta| / T} & \text{nếu } \Delta \le 0 \text{ và } T > 0.001
\end{cases}
$$

**Tham số khác:**
- Số lần khởi động lại ngẫu nhiên (Random Restart): `num_restarts = 8`
- Tabu tenure (số vòng cấm quay lại): `tabu_tenure = 5`

**Sinh lân cận trường số (Neighborhood — BVA):**
- Bước nhỏ: $\pm 1$
- Bước trung bình: $\pm 10\%$ phạm vi $= \max(1, \lfloor 0.1 \cdot \text{range} \rfloor)$
- Bước lớn: $\pm 50\%$ phạm vi $= \max(1, \lfloor 0.5 \cdot \text{range} \rfloor)$
- Nhiễu Gauss: $\mathcal{N}(0, 0.05 \cdot \text{range})$
- Ép biên: `minValue`, `minValue−1`, `maxValue`, `maxValue+1`, `0`

với $\text{range} = \max(|\text{maxValue} - \text{minValue}|, 1)$.

### Mã nguồn

```python
# Tham số SA
initial_temperature = 0.15
alpha = 0.85  # tốc độ làm nguội

# Trong vòng lặp: giảm nhiệt độ
temperature = initial_temperature * (alpha ** iteration)

# Sinh lân cận trường số
field_range = max(abs(max_v - min_v), 1)
neighbors.extend([num + 1, num - 1])                      # bước nhỏ
medium_step = max(1, int(field_range * 0.1))              # bước trung bình
neighbors.extend([num + medium_step, num - medium_step])
large_step = max(1, int(field_range * 0.5))               # bước lớn
neighbors.extend([num + large_step, num - large_step])
sigma = field_range * 0.05                                # nhiễu Gauss
neighbors.append(num + random.gauss(0, sigma))

# Chấp nhận bước đi (SA acceptance)
delta = best_neighbor_fitness - current_fitness
accept_move = False
if delta > 0:
    accept_move = True                       # cải thiện: luôn nhận
elif temperature > 0.001:
    sa_prob = math.exp(-abs(delta) / temperature)
    if random.random() < sa_prob:
        accept_move = True                   # nhận bước xấu theo xác suất
```

---

## 14. Bảng tổng hợp tham số mặc định

| Tham số | Ký hiệu | Giá trị | Vị trí |
|---------|---------|---------|--------|
| Trọng số Coverage | $w_v$ | 0.4 | `main.py:670` |
| Trọng số Boundary | $w_b$ | 0.3 | `main.py:670` |
| Trọng số Priority | $w_p$ | 0.1 | (Cố định trong Engine) |
| Trọng số Diversity | $w_d$ | 0.2 | `main.py:670` |
| Số thế hệ | $G$ | 60 | `optimizer_engine.py:194` |
| Tỷ lệ đột biến ban đầu | $r_{mut}^{init}$ | 0.15 | `optimizer_engine.py:197` |
| Tỷ lệ đột biến tối thiểu | $r_{mut}^{min}$ | 0.02 | `optimizer_engine.py:198` |
| Tỷ lệ lai ghép ban đầu | $r_{cross}^{init}$ | 0.8 | `optimizer_engine.py:199` |
| Tỷ lệ lai ghép tối thiểu | $r_{cross}^{min}$ | 0.45 | `optimizer_engine.py:200` |
| Ngưỡng trì trệ | $T$ | 8 thế hệ | `optimizer_engine.py:204` |
| Kích thước Hall of Fame | — | 20 | `optimizer_engine.py:208` |
| Tỷ lệ Elitism | — | 5% | `optimizer_engine.py:744` |
| Tỷ lệ tái tạo khi trì trệ | — | 80% (giữ 20%) | `optimizer_engine.py:710` |
| Nhiệt độ ban đầu (SA) | $T_0$ | 0.15 | `boundary_tweak.py:154` |
| Tốc độ làm nguội (SA) | $\alpha$ | 0.85 | `boundary_tweak.py:155` |
| Số lần Random Restart | — | 8 | `boundary_tweak.py:60` |
| Tabu tenure | — | 5 | `boundary_tweak.py:160` |
| Phạt mỗi bản trùng | — | 0.50 (tối đa 0.6) | `optimizer_engine.py:419` |
| Kích thước giải đấu (Selection) | — | 3 | `optimizer_engine.py:577` |

---

## PHỤ LỤC: Đồng bộ công thức hiển thị ở Frontend

Hiện tại, giao diện đã được đồng bộ hoàn toàn để hiển thị chính xác công thức toán học và các trọng số thực tế của công cụ tối ưu hóa:

```typescript
Fitness = (0.4 × Coverage) + (0.3 × Boundary) + (0.1 × Priority) + (0.2 × Diversity) - Penalty
```

*Tài liệu sinh từ phân tích mã nguồn — các file chính:*
- `backend/app/algorithms/optimizer_engine.py` (Genetic Algorithm)
- `backend/app/algorithms/boundary_tweak.py` (Hill Climbing + Simulated Annealing)
- `backend/app/main.py` (cấu hình trọng số)
