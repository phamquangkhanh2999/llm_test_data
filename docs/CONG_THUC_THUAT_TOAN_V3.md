# TỔNG HỢP CÁC CÔNG THỨC THUẬT TOÁN TRONG DỰ ÁN (PHIÊN BẢN V3)

> Tài liệu này tổng hợp **toàn bộ công thức toán học** được sử dụng trong hệ thống sinh và tối ưu hóa Test Case (LLM Test Data) ở Phiên bản V3 (Sử dụng Memetic Algorithm: GA + HC, NSGA-II, Pareto Local Search, và Fitness Engine mới). Mỗi công thức đều kèm: ý nghĩa, công thức ký hiệu, và đoạn mã nguồn thực tế kèm vị trí file.

---

## MỤC LỤC

1. [Hàm thích nghi tổng hợp (Fitness Engine Aggregator)](#1-hàm-thích-nghi-tổng-hợp-fitness-engine-aggregator)
2. [Chi tiết các điểm thành phần (Schema, Coverage, Boundary)](#2-chi-tiết-các-điểm-thành-phần-schema-coverage-boundary)
3. [Điểm đa dạng tuyến tính (Fast Diversity Score)](#3-điểm-đa-dạng-tuyến-tính-fast-diversity-score)
4. [Lựa chọn Đa Mục Tiêu NSGA-II (NSGA-II Lexicographic Constrained Pareto)](#4-lựa-chọn-đa-mục-tiêu-nsga-ii-nsga-ii-lexicographic-constrained-pareto)
5. [Tối ưu Cục bộ HC & Simulated Annealing (Local Pareto Optimizer)](#5-tối-ưu-cục-bộ-hc--simulated-annealing-local-pareto-optimizer)
6. [Tỷ lệ Đột biến & Lai ghép thích nghi (Adaptive Rates)](#6-tỷ-lệ-đột-biến--lai-ghép-thích-nghi-adaptive-rates)
7. [Đột biến Gauss (Gaussian Mutation)](#7-đột-biến-gauss-gaussian-mutation)
8. [Tournament Selection & Niche Density Distance](#8-tournament-selection--niche-density-distance)
9. [Phát hiện trì trệ (Stagnation Detection)](#9-phát-hiện-trì-trệ-stagnation-detection)
10. [Độ bao phủ tổng hợp (Composite Coverage)](#10-độ-bao-phủ-tổng-hợp-composite-coverage)
11. [Bao phủ cặp đôi (Pairwise Coverage)](#11-bao-phủ-cặp-đôi-pairwise-coverage)

---

## 1. Hàm thích nghi tổng hợp (Fitness Engine Aggregator)

**Vị trí:** `backend/app/algorithms/fitness_engine/aggregator.py` (dòng 58–82)

Đây là cốt lõi của việc chấm điểm Test Case trong V3, phân tách rõ ràng trọng số cho kịch bản Positive (Đúng đắn) và Negative (Tìm lỗi).

### Công thức

**Đối với Negative Test Case (Tìm lỗi, ngoại lệ):**

$$
Raw\_Fitness = (0.25 \cdot S_{schema}) + (0.10 \cdot S_{coverage}) + (0.25 \cdot S_{boundary}) + (0.25 \cdot S_{error\_path}) + (0.15 \cdot S_{semantic})
$$

Hình phạt (Penalty) nếu có quá 3 lỗi vi phạm (trừ mã độc Security):

$$
Penalty_{neg} = \max(0, \text{Violation\_Count} - 3) \times 10.0
$$

**Đối với Positive Test Case (Hợp lệ):**

$$
Raw\_Fitness = (0.25 \cdot S_{schema}) + (0.25 \cdot S_{coverage}) + (0.25 \cdot S_{boundary}) + (0.25 \cdot S_{semantic})
$$

Hình phạt nghiêm ngặt nếu vi phạm dù chỉ 1 lỗi định dạng:

$$
Penalty_{pos} = \begin{cases} 1000.0 & \text{nếu } \text{Violation\_Count} > 0 \\ 0.0 & \text{ngược lại} \end{cases}
$$

**Fitness Cuối cùng:**

$$
Final\_Fitness = \max(0.0, Raw\_Fitness - Penalty)
$$

### Mã nguồn

```python
if is_negative:
    raw_fitness = (
        schema_score * 0.25 + coverage_score * 0.10 +
        boundary_score * 0.25 + expected_result_coverage * 0.25 + semantic_score * 0.15
    )
    if not is_security and violation_count > 3:
        penalty += (violation_count - 3) * 10.0
else:
    raw_fitness = (
        schema_score * 0.25 + coverage_score * 0.25 +
        boundary_score * 0.25 + semantic_score * 0.25
    )
    if violation_count > 0:
        penalty += 1000.0  # Force fitness to 0 for invalid positive tests
        
final_fitness = max(0.0, raw_fitness - penalty)
```

---

## 2. Chi tiết các điểm thành phần (Schema, Coverage, Boundary)

**Vị trí:** Thư mục `backend/app/algorithms/fitness_engine/` (`schema_score.py`, `coverage_score.py`, `boundary_score.py`)

### 2.1. Điểm Schema ($S_{schema}$)

$$
S_{schema} = \left( \frac{1}{N} \sum_{i=1}^{N} (0.2P_{req} + 0.2P_{type} + 0.2P_{format} + 0.2P_{semantic} + 0.2P_{constraint}) \right) \times 100
$$

**Mã nguồn:**
```python
schema_score = (
    (req_pass / total_fields) * 0.20 +
    (type_pass / total_fields) * 0.20 +
    (format_pass / total_fields) * 0.20 +
    (semantic_pass / total_fields) * 0.20 +
    (constraint_pass / total_fields) * 0.20
) * 100
```

### 2.2. Điểm Coverage ($S_{coverage}$)

Tỷ lệ số lượng quy tắc được bao phủ (với ngưỡng dung sai 10% cho số, 20% cho chuỗi):

$$
S_{coverage} = \frac{\text{Số lượng Rule được bao phủ}}{\text{Tổng số Rule}} \times 100
$$

**Mã nguồn:**
```python
margin = max(1.0, abs(min_v)) * 0.1
if num is not None and abs(num - min_v) <= margin:
    covered_rules += 1
...
coverage_score = (covered_rules / total_rules) * 100
```

### 2.3. Điểm Boundary ($S_{boundary}$)

Tính bằng khoảng cách tới biên gần nhất.

$$
Score = \max\left(0, 1.0 - \frac{Distance}{Max\_Possible}\right)
$$

**Mã nguồn:**
```python
distance = min(abs(num - min_v), abs(num - max_v))
max_possible = abs(max_v - min_v) or 1.0
score = max(0.0, 1.0 - (distance / max_possible))
```

---

## 3. Điểm đa dạng tuyến tính (Fast Diversity Score)

**Vị trí:** `backend/app/algorithms/optimizer_engine.py` (dòng 86-102)

Thay vì dùng Levenshtein $O(N^2)$ cho chuỗi dài, V3 dùng xấp xỉ tiền tố (Prefix matching).

### Công thức

$$
D_{fast}(v_1, v_2) =
\begin{cases}
\dfrac{\text{Lev}(v_1, v_2)}{\max(|v_1|, |v_2|, 1)} & \text{nếu } |v_1| \le 12 \text{ và } |v_2| \le 12 \\[2mm]
1.0 - 0.15 \cdot \text{Prefix\_Len} & \text{ngược lại (Prefix\_Len tối đa 4)}
\end{cases}
$$

### Mã nguồn

```python
def fast_distance(v1, v2):
    if v1 == v2: return 0.0
    len1 = len(v1); len2 = len(v2)
    max_len = max(len1, len2, 1)
    if len1 <= 12 and len2 <= 12:
        return levenshtein_distance(v1, v2) / max_len
    
    common_prefix = 0
    for i in range(min(len1, len2, 4)):
        if v1[i] == v2[i]: common_prefix += 1
        else: break
    return 1.0 - (common_prefix * 0.15)
```

---

## 4. Lựa chọn Đa Mục Tiêu NSGA-II (NSGA-II Lexicographic Constrained Pareto)

**Vị trí:** `backend/app/algorithms/nsga2_engine.py` (dòng 38-84)

Cải tiến của V3 là dùng Lexicographic Constrained kết hợp Pareto truyền thống.

### Công thức

**Luật Trội (Domination):**

1. Nếu $Rule_1 > Rule_2 + 0.05 \Rightarrow 1 \succ 2$
2. Nếu $Rule_2 > Rule_1 + 0.05 \Rightarrow 1 \not\succ 2$
3. Nếu $|Rule_1 - Rule_2| \le 0.05$:

$$
1 \succ 2 \iff \begin{cases} B_1 \ge B_2 \land S_1 \ge S_2 \land O_1 \ge O_2 \\ B_1 > B_2 \lor S_1 > S_2 \lor O_1 > O_2 \end{cases}
$$
*(B: Boundary, S: Security, O: Oracle)*

**Crowding Distance:**

$$
CD_i = CD_i + \frac{f_m(i+1) - f_m(i-1)}{f_m^{max} - f_m^{min}}
$$

### Mã nguồn

```python
def dominates(fitness1, fitness2):
    r1, r2 = fitness1.get("rule", 0), fitness2.get("rule", 0)
    if r1 > r2 + 0.05: return True
    if r2 > r1 + 0.05: return False
    
    b1, b2 = fitness1.get("boundary", 0), fitness2.get("boundary", 0)
    s1, s2 = fitness1.get("security", 0), fitness2.get("security", 0)
    o1, o2 = fitness1.get("oracle", 0), fitness2.get("oracle", 0)
    
    better_or_equal = (b1 >= b2 and s1 >= s2 and o1 >= o2)
    strictly_better = (b1 > b2 or s1 > s2 or o1 > o2)
    return better_or_equal and strictly_better
```

---

## 5. Tối ưu Cục bộ HC & Simulated Annealing (Local Pareto Optimizer)

**Vị trí:** `backend/app/algorithms/local_pareto_optimizer.py` (dòng 68-78)

Đây là thuật toán hậu tối ưu (Memetic phase). HC (Leo đồi) kết hợp SA (Luyện kim sa) để chấp nhận kết quả kém hơn nhằm thoát khỏi điểm tối ưu cục bộ.

### Công thức

Xác suất chấp nhận bước đi kém hơn khi $\Delta = Fitness_{new} - Fitness_{current} < 0$:

$$
T = \max\left(0.1, \frac{Temperature\_Base}{Iteration}\right)
$$

$$
Probability = \exp\left(\frac{\Delta}{T}\right)
$$

### Mã nguồn

```python
elif nb_fit_scalar >= current_fit_scalar - self.epsilon:
    # Simulated Annealing Escape
    delta = nb_fit_scalar - current_fit_scalar
    temp = max(0.1, self.temperature_base / iteration)
    prob = math.exp(delta / temp) if delta < 0 else 1.0
    
    if random.random() < prob:
        current, current_vec = nb, nb_vec
        improved = True
        break
```

---

## 6. Tỷ lệ Đột biến & Lai ghép thích nghi (Adaptive Rates)

**Vị trí:** `backend/app/algorithms/optimizer_engine.py` (dòng 525-548)

Tỷ lệ giảm theo thời gian (Decaying Schedule) chuyển từ Khám phá (Exploration) sang Khai thác (Exploitation).

### Công thức

$p = \frac{Generation}{Max\_Generations}$

**Tỷ lệ đột biến (Quadratic Decay - Hàm bậc 2):**
$$ Mutation\_Rate = Initial - (Initial - Min) \times p^2 $$

**Tỷ lệ lai ghép (Polynomial Decay - Hàm mũ 1.5):**
$$ Crossover\_Rate = Initial - (Initial - Min) \times p^{1.5} $$

### Mã nguồn

```python
def get_adaptive_mutation_rate(self):
    p = self._progress_ratio()
    return self._initial_mutation_rate - (self._initial_mutation_rate - self._min_mutation_rate) * (p ** 2)

def get_adaptive_crossover_rate(self):
    p = self._progress_ratio()
    return self._initial_crossover_rate - (self._initial_crossover_rate - self._min_crossover_rate) * (p ** 1.5)
```

---

## 7. Đột biến Gauss (Gaussian Mutation)

**Vị trí:** `optimizer_engine.py` (Thuật toán Di truyền cơ sở)

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

## 8. Tournament Selection & Niche Density Distance

**Vị trí:** `optimizer_engine.py`

Chọn cá thể bố mẹ bằng **Tournament Selection** (kích thước giải đấu = 3). Khi fitness ngang nhau, ưu tiên cá thể ở vùng mật độ thưa thớt hơn trong không gian quyết định (niche density distance lớn) để duy trì đa dạng di truyền.

### Công thức

**Niche Density Distance (NDD)** của cá thể:

$$
\text{NDD} = \frac{1}{3} \sum_{t \in \text{top-3 xa nhất}} \left( \frac{1}{K} \sum_{k=1}^{K} d(v_k, v_{t,k}) \right)
$$

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

## 9. Phát hiện trì trệ (Stagnation Detection)

**Vị trí:** `optimizer_engine.py`

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

## 10. Độ bao phủ tổng hợp (Composite Coverage)

**Vị trí:** `optimizer_engine.py` — `_compute_full_coverage`

Đo độ bao phủ của cả quần thể, kết hợp các yếu tố, sau đó chiết khấu theo tỷ lệ trùng lặp.

### Công thức

$$
\text{Coverage} = \min\Big( 0.60 \cdot f_{val} + 0.20 \cdot f_{bound} + 0.20 \cdot f_{pair},\ 1.0 \Big)
$$

**Chiết khấu trùng lặp:** nếu tỷ lệ trùng `dup_rate > 0.3`:

$$
\text{Coverage} \mathrel{\ast}= \big(1.0 - (\text{dup\_rate} - 0.3) \cdot 0.5\big)
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

---

## 11. Bao phủ cặp đôi (Pairwise Coverage)

**Vị trí:** `optimizer_engine.py` — `_compute_pairwise_coverage`

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

## 12. Tài liệu tham khảo (References)

Để hỗ trợ viết báo cáo khoa học hoặc luận văn, dưới đây là các nguồn tài liệu học thuật và lý thuyết gốc cho các thuật toán được áp dụng trong hệ thống:

1. **Memetic Algorithm (GA + Local Search):**
   - *Moscato, P. (1989).* On Evolution, Search, Optimization, Genetic Algorithms and Martial Arts: Towards Memetic Algorithms. [Wikipedia Reference](https://en.wikipedia.org/wiki/Memetic_algorithm)
2. **NSGA-II (Lựa chọn Đa mục tiêu):**
   - *Deb, K., Pratap, A., Agarwal, S., & Meyarivan, T. (2002).* A fast and elitist multiobjective genetic algorithm: NSGA-II. *IEEE Transactions on Evolutionary Computation*. [DOI: 10.1109/4235.996017](https://ieeexplore.ieee.org/document/996017)
3. **Simulated Annealing (Luyện kim sa):**
   - *Kirkpatrick, S., Gelatt, C. D., & Vecchi, M. P. (1983).* Optimization by Simulated Annealing. *Science*. [DOI: 10.1126/science.220.4598.671](https://www.science.org/doi/10.1126/science.220.4598.671)
4. **Levenshtein Distance (Khoảng cách đa dạng):**
   - *Levenshtein, V. I. (1966).* Binary codes capable of correcting deletions, insertions, and reversals. [Wikipedia Reference](https://en.wikipedia.org/wiki/Levenshtein_distance)
5. **Pairwise Testing (Bao phủ cặp đôi):**
   - Kỹ thuật kiểm thử tổ hợp All-pairs testing giúp giảm thiểu bùng nổ tổ hợp. [Pairwise.org](https://pairwise.org/) | [Wikipedia Reference](https://en.wikipedia.org/wiki/All-pairs_testing)
6. **Tournament Selection (Lựa chọn giải đấu):**
   - Phương pháp lựa chọn cá thể trong giải thuật di truyền dựa trên xác suất chiến thắng của một nhóm ngẫu nhiên. [Wikipedia Reference](https://en.wikipedia.org/wiki/Tournament_selection)
