# TỔNG HỢP CÔNG THỨC ĐÃ CHỈNH SỬA CHO MÔ HÌNH LLM–GA–HC

> Tài liệu này là bản đã chỉnh sửa công thức theo hướng **dễ đọc, dễ copy vào báo cáo** và phù hợp với đề tài **sinh dữ liệu kiểm thử / test data generation**.  
> Các công thức được viết theo dạng rõ ràng, hạn chế ký hiệu toán học phức tạp, ưu tiên bảng giải thích và công thức dạng text.

---

## MỤC LỤC

1. [Quy trình tổng quát LLM–GA–HC](#1-quy-trình-tổng-quát-llmgahc)
2. [Ký hiệu chung](#2-ký-hiệu-chung)
3. [Đánh giá dữ liệu ban đầu do LLM sinh ra](#3-đánh-giá-dữ-liệu-ban-đầu-do-llm-sinh-ra)
4. [Hàm thích nghi Fitness](#4-hàm-thích-nghi-fitness)
5. [Validation Score](#5-validation-score)
6. [Boundary Score](#6-boundary-score)
7. [Priority Score](#7-priority-score)
8. [Diversity Score](#8-diversity-score)
9. [Penalty do trùng lặp dữ liệu](#9-penalty-do-trùng-lặp-dữ-liệu)
10. [Đánh giá trong quá trình GA](#10-đánh-giá-trong-quá-trình-ga)
11. [Tỷ lệ đột biến và lai ghép thích nghi](#11-tỷ-lệ-đột-biến-và-lai-ghép-thích-nghi)
12. [Đột biến Gauss cho trường số](#12-đột-biến-gauss-cho-trường-số)
13. [Tournament Selection](#13-tournament-selection)
14. [Niche Density Distance](#14-niche-density-distance)
15. [Phát hiện trì trệ trong GA](#15-phát-hiện-trì-trệ-trong-ga)
16. [Hill Climbing tinh chỉnh cục bộ](#16-hill-climbing-tinh-chỉnh-cục-bộ)
17. [Simulated Annealing trong Hill Climbing](#17-simulated-annealing-trong-hill-climbing)
18. [Đánh giá tập dữ liệu kiểm thử cuối cùng](#18-đánh-giá-tập-dữ-liệu-kiểm-thử-cuối-cùng)
19. [Mức cải thiện sau tối ưu](#19-mức-cải-thiện-sau-tối-ưu)
20. [Bảng tổng hợp tham số](#20-bảng-tổng-hợp-tham-số)
21. [Lưu ý khi đưa vào báo cáo](#21-lưu-ý-khi-đưa-vào-báo-cáo)

---

## 1. Quy trình tổng quát LLM–GA–HC

Trong đề tài, hệ thống sử dụng mô hình kết hợp **LLM–GA–HC** để sinh và tối ưu dữ liệu kiểm thử.

Quy trình tổng quát:

```text
Đặc tả yêu cầu
      ↓
LLM sinh dữ liệu kiểm thử ban đầu
      ↓
Chấm điểm dữ liệu ban đầu bằng Fitness
      ↓
GA tối ưu toàn cục qua nhiều thế hệ
      ↓
HC tinh chỉnh cục bộ các dữ liệu sau GA
      ↓
Đánh giá tập dữ liệu kiểm thử cuối cùng
```

Viết gọn:

```text
Spec → LLM → D_initial → GA → D_GA → HC → D_final
```

Trong đó:

| Ký hiệu | Ý nghĩa |
|---|---|
| `Spec` | Đặc tả yêu cầu đầu vào |
| `D_initial` | Tập dữ liệu kiểm thử ban đầu do LLM sinh ra |
| `D_GA` | Tập dữ liệu sau khi tối ưu bằng Genetic Algorithm |
| `D_final` | Tập dữ liệu kiểm thử cuối cùng sau khi tinh chỉnh bằng Hill Climbing |

---

## 2. Ký hiệu chung

Tập các trường dữ liệu cần kiểm thử:

```text
F = {f1, f2, ..., fn}
```

Trong đó:

| Ký hiệu | Ý nghĩa |
|---|---|
| `F` | Tập trường dữ liệu của chức năng cần kiểm thử |
| `f1, f2, ..., fn` | Các trường dữ liệu cụ thể |
| `n` | Số lượng trường dữ liệu |

Một test data được biểu diễn như sau:

```text
Xi = {xi1, xi2, ..., xin}
```

Trong đó:

| Ký hiệu | Ý nghĩa |
|---|---|
| `Xi` | Test data thứ i |
| `xij` | Giá trị của trường fj trong test data Xi |

Tập dữ liệu kiểm thử gồm `m` test data:

```text
D = {X1, X2, ..., Xm}
```

---

## 3. Đánh giá dữ liệu ban đầu do LLM sinh ra

Sau khi LLM sinh ra tập dữ liệu kiểm thử ban đầu, hệ thống chấm điểm từng test data bằng hàm Fitness.

Công thức:

```text
Initial Score = Tổng Fitness của các test data ban đầu / Số lượng test data ban đầu
```

Viết gọn:

```text
Initial Score = Sum(Fitness(Xi)) / m
```

Trong đó:

| Ký hiệu | Ý nghĩa |
|---|---|
| `Fitness(Xi)` | Điểm chất lượng của test data Xi |
| `m` | Số lượng test data ban đầu |

Ý nghĩa:

- Điểm này cho biết chất lượng ban đầu của dữ liệu do LLM sinh ra.
- Nếu điểm thấp, dữ liệu ban đầu có thể còn thiếu dữ liệu biên, thiếu đa dạng hoặc bị trùng lặp.
- Điểm này dùng làm mốc để so sánh với dữ liệu sau khi tối ưu bằng GA và HC.

---

## 4. Hàm thích nghi Fitness

Fitness là công thức trung tâm dùng để đánh giá chất lượng của từng test data.

### Công thức đã chỉnh sửa

```text
Fitness = 0.4 × Validation Score
        + 0.3 × Boundary Score
        + 0.2 × Diversity Score
        + 0.1 × Priority Score
        − 0.5 × Penalty
```

Viết gọn:

```text
Fitness = 0.4 × Sv + 0.3 × Sb + 0.2 × Sd + 0.1 × Sp − 0.5 × P
```

Trong đó:

| Ký hiệu | Thành phần | Ý nghĩa | Trọng số |
|---|---|---|---:|
| `Sv` | Validation Score | Đánh giá dữ liệu có đúng ràng buộc đặc tả hay không | 0.4 |
| `Sb` | Boundary Score | Đánh giá dữ liệu có bao phủ giá trị biên hay không | 0.3 |
| `Sd` | Diversity Score | Đánh giá dữ liệu có đa dạng, ít trùng lặp hay không | 0.2 |
| `Sp` | Priority Score | Đánh giá mức độ ưu tiên của loại dữ liệu kiểm thử | 0.1 |
| `P` | Penalty | Điểm phạt do trùng lặp dữ liệu | 0.5 |

Sau khi tính, Fitness được giới hạn trong khoảng từ `0.01` đến `1.0`:

```text
Fitness = max(0.01, min(Fitness, 1.0))
```

Ý nghĩa:

- `Validation Score` có trọng số cao nhất vì dữ liệu kiểm thử phải bám sát đặc tả.
- `Boundary Score` có trọng số cao vì dữ liệu biên có khả năng phát hiện lỗi tốt.
- `Diversity Score` giúp tránh sinh nhiều dữ liệu giống nhau.
- `Priority Score` giúp ưu tiên dữ liệu biên và dữ liệu lỗi.
- `Penalty` làm giảm điểm các test data bị trùng lặp.

---

## 5. Validation Score

Validation Score dùng để đánh giá mức độ đáp ứng ràng buộc dữ liệu.

Mỗi trường dữ liệu được kiểm tra theo các ràng buộc như:

- Bắt buộc nhập.
- Kiểu dữ liệu.
- Độ dài tối thiểu, tối đa.
- Giá trị nhỏ nhất, lớn nhất.
- Định dạng email, số điện thoại, số căn cước.
- Tập giá trị cho phép.

### Cách chấm điểm từng trường

| Trường hợp | Điểm |
|---|---:|
| Vi phạm ràng buộc cứng | 0.0 |
| Đúng ràng buộc cứng nhưng sai ràng buộc mềm | 0.7 |
| Đúng tất cả ràng buộc | 1.0 |

Trong đó:

| Loại ràng buộc | Ví dụ |
|---|---|
| Ràng buộc cứng | Required, đúng kiểu dữ liệu, đúng enum, đúng định dạng cơ bản |
| Ràng buộc mềm | MinLength, MaxLength, MinValue, MaxValue, Regex chi tiết |

### Công thức

```text
Validation Score = Tổng điểm validation của các trường / Số lượng trường dữ liệu
```

Viết gọn:

```text
Sv = Sum(sj) / n
```

Trong đó:

| Ký hiệu | Ý nghĩa |
|---|---|
| `sj` | Điểm validation của trường thứ j |
| `n` | Số lượng trường dữ liệu |

Ví dụ:

Một test data có 5 trường, điểm lần lượt là:

```text
1.0, 1.0, 0.7, 1.0, 0.0
```

Khi đó:

```text
Validation Score = (1.0 + 1.0 + 0.7 + 1.0 + 0.0) / 5 = 0.74
```

---

## 6. Boundary Score

Boundary Score dùng để đánh giá mức độ bao phủ giá trị biên của dữ liệu kiểm thử.

Trong kiểm thử phần mềm, lỗi thường xuất hiện tại các vùng biên. Vì vậy, hệ thống cần ưu tiên cả:

- Biên hợp lệ.
- Biên không hợp lệ.

### Công thức đã chỉnh sửa

```text
Boundary Score = 0.6 × Điểm biên hợp lệ + 0.4 × Điểm biên không hợp lệ
```

Viết gọn:

```text
Sb = 0.6 × S_valid_boundary + 0.4 × S_invalid_boundary
```

Cuối cùng giới hạn:

```text
Sb = min(Sb, 1.0)
```

### 6.1. Điểm biên hợp lệ

Biên hợp lệ là các giá trị nằm trong phạm vi cho phép nhưng ở sát ranh giới.

| Loại giá trị | Ví dụ | Điểm |
|---|---|---:|
| Trúng biên hợp lệ | `min`, `max`, `minLength`, `maxLength` | 1.0 |
| Gần biên hợp lệ | `min + 1`, `max − 1`, `minLength + 1`, `maxLength − 1` | 0.5 |
| Không phải biên | Giá trị bình thường trong miền | 0.0 |

Công thức:

```text
Điểm biên hợp lệ = Tổng điểm biên hợp lệ của các trường / Số lượng trường dữ liệu
```

Viết gọn:

```text
S_valid_boundary = Sum(b_valid) / n
```

### 6.2. Điểm biên không hợp lệ

Biên không hợp lệ là các giá trị nằm ngay ngoài phạm vi cho phép.

| Loại giá trị | Ví dụ | Điểm |
|---|---|---:|
| Trúng biên không hợp lệ | `min − 1`, `max + 1`, `minLength − 1`, `maxLength + 1` | 1.0 |
| Không phải biên không hợp lệ | Các giá trị khác | 0.0 |

Công thức:

```text
Điểm biên không hợp lệ = Tổng điểm biên không hợp lệ của các trường / Số lượng trường dữ liệu
```

Viết gọn:

```text
S_invalid_boundary = Sum(b_invalid) / n
```

### Ví dụ

Trường `age` có miền hợp lệ:

```text
18 ≤ age ≤ 60
```

Bảng chấm điểm:

| Giá trị | Loại dữ liệu | Điểm |
|---:|---|---:|
| 18 | Trúng biên hợp lệ | 1.0 |
| 60 | Trúng biên hợp lệ | 1.0 |
| 19 | Gần biên hợp lệ | 0.5 |
| 59 | Gần biên hợp lệ | 0.5 |
| 17 | Biên không hợp lệ | 1.0 |
| 61 | Biên không hợp lệ | 1.0 |
| 30 | Giá trị bình thường | 0.0 |

---

## 7. Priority Score

Priority Score dùng để ưu tiên các loại dữ liệu kiểm thử có khả năng phát hiện lỗi cao hơn.

| Loại test data | Điểm Priority |
|---|---:|
| Dữ liệu biên | 1.0 |
| Dữ liệu không hợp lệ | 0.7 |
| Dữ liệu hợp lệ thông thường | 0.4 |

Ý nghĩa:

- Dữ liệu biên được ưu tiên cao nhất vì lỗi thường xảy ra tại ranh giới miền giá trị.
- Dữ liệu không hợp lệ giúp kiểm tra khả năng validate dữ liệu của hệ thống.
- Dữ liệu hợp lệ thông thường giúp kiểm tra luồng xử lý đúng.

---

## 8. Diversity Score

Diversity Score dùng để đánh giá mức độ khác biệt giữa các test data.

Mục tiêu:

- Tránh sinh nhiều test data giống nhau.
- Tăng khả năng bao phủ nhiều miền giá trị khác nhau.
- Làm cho tập dữ liệu kiểm thử phong phú hơn.

### Công thức tổng quát

```text
Diversity Score = Trung bình khoảng cách giữa test data đang xét với các test data khác
```

Viết gọn:

```text
Sd = Trung bình distance(Xi, Xj)
```

Trong đó:

| Ký hiệu | Ý nghĩa |
|---|---|
| `Xi` | Test data đang xét |
| `Xj` | Test data khác dùng để so sánh |
| `distance(Xi, Xj)` | Khoảng cách giữa hai test data |

### Cách tính khoảng cách theo từng kiểu dữ liệu

| Kiểu dữ liệu | Cách tính khoảng cách |
|---|---|
| Number | Lấy độ chênh lệch giữa hai số, sau đó chia cho khoảng giá trị hợp lệ |
| Enum / Boolean | Giống nhau thì điểm khoảng cách = 0, khác nhau thì điểm khoảng cách = 1 |
| String ngắn | Dùng khoảng cách Levenshtein để đo mức độ khác nhau |
| String dài | Dùng so sánh tiền tố để ước lượng nhanh mức độ khác nhau |

### Công thức dễ đọc theo từng kiểu dữ liệu

#### Kiểu số

```text
Distance = |value1 − value2| / max(maxValue − minValue, 1)
```

Sau đó giới hạn:

```text
Distance = min(Distance, 1.0)
```

#### Kiểu enum hoặc boolean

```text
Distance = 0 nếu hai giá trị giống nhau
Distance = 1 nếu hai giá trị khác nhau
```

#### Kiểu chuỗi ngắn

```text
Distance = Levenshtein(value1, value2) / max(length(value1), length(value2), 1)
```

#### Kiểu chuỗi dài

```text
Distance = 1.0 − 0.15 × số ký tự đầu giống nhau
```

Số ký tự đầu giống nhau được giới hạn tối đa là 4.

### Ví dụ

| Giá trị 1 | Giá trị 2 | Kiểu dữ liệu | Nhận xét |
|---|---|---|---|
| 18 | 19 | Number | Khác ít |
| 18 | 60 | Number | Khác nhiều |
| Nam | Nam | Enum | Không đa dạng |
| Nam | Nữ | Enum | Có đa dạng |
| `abc` | `abd` | String | Khác ít |
| `abc` | `xyz` | String | Khác nhiều |

---

## 9. Penalty do trùng lặp dữ liệu

Penalty dùng để phạt các test data bị trùng lặp.

### Công thức đã chỉnh sửa rõ nghĩa

Gọi `duplicate_count` là số lượng test data giống hệt test data đang xét.

| Trường hợp | Penalty gốc |
|---|---:|
| Không bị trùng hoặc chỉ có 1 bản | 0 |
| Có dữ liệu trùng | Tăng 0.15 cho mỗi bản trùng phát sinh |
| Penalty tối đa | 0.6 |

Công thức:

```text
Nếu duplicate_count ≤ 1:
    Penalty = 0

Nếu duplicate_count > 1:
    Penalty = min(0.15 × (duplicate_count − 1), 0.6)
```

Trong hàm Fitness, penalty được nhân với hệ số 0.5:

```text
Điểm phạt cuối cùng = 0.5 × Penalty
```

Ví dụ:

| duplicate_count | Penalty gốc | Điểm phạt trong Fitness |
|---:|---:|---:|
| 1 | 0.00 | 0.000 |
| 2 | 0.15 | 0.075 |
| 3 | 0.30 | 0.150 |
| 4 | 0.45 | 0.225 |
| 5 trở lên | 0.60 | 0.300 |

Lưu ý:

Không nên viết “phạt mỗi bản trùng là 0.5”. Cách viết đúng là:  
**Penalty gốc tăng 0.15 cho mỗi bản trùng, tối đa 0.6. Khi đưa vào Fitness, penalty được nhân với hệ số 0.5.**

---

## 10. Đánh giá trong quá trình GA

Trong Genetic Algorithm, mỗi test data được xem như một cá thể trong quần thể.

Ở mỗi thế hệ, hệ thống chấm lại Fitness của các cá thể để phục vụ:

- Chọn lọc.
- Lai ghép.
- Đột biến.
- Giữ lại cá thể tốt.
- Loại bỏ cá thể kém hoặc bị trùng lặp.

### Điểm trung bình của một thế hệ

```text
GA Score = Tổng Fitness của các cá thể trong thế hệ / Số lượng cá thể
```

Viết gọn:

```text
GA Score = Sum(Fitness(Xi)) / m
```

### Cá thể tốt nhất của một thế hệ

```text
Best Individual = Cá thể có Fitness cao nhất trong thế hệ
```

Viết gọn:

```text
Best Fitness = max(Fitness(Xi))
```

Ý nghĩa:

- `GA Score` cho biết chất lượng trung bình của quần thể.
- `Best Fitness` cho biết cá thể tốt nhất ở từng thế hệ.
- Nếu GA hoạt động tốt, hai chỉ số này thường tăng dần qua các thế hệ.

---

## 11. Tỷ lệ đột biến và lai ghép thích nghi

Tỷ lệ đột biến và lai ghép được điều chỉnh theo tiến độ của quá trình tiến hóa.

### Cách hiểu đơn giản

| Giai đoạn | Tỷ lệ đột biến | Tỷ lệ lai ghép | Mục đích |
|---|---:|---:|---|
| Đầu quá trình | Cao | Cao | Khám phá nhiều dữ liệu mới |
| Giữa quá trình | Trung bình | Trung bình | Cân bằng khám phá và khai thác |
| Cuối quá trình | Thấp | Thấp hơn | Ổn định kết quả tốt |

### Tỷ lệ tiến độ

```text
progress = thế hệ hiện tại / (tổng số thế hệ − 1)
```

Giới hạn:

```text
progress = min(progress, 1.0)
```

### Tỷ lệ đột biến

```text
Mutation Rate = Initial Mutation Rate
              − (Initial Mutation Rate − Minimum Mutation Rate) × progress²
```

### Tỷ lệ lai ghép

```text
Crossover Rate = Initial Crossover Rate
               − (Initial Crossover Rate − Minimum Crossover Rate) × progress^1.5
```

---

## 12. Đột biến Gauss cho trường số

Đối với trường dữ liệu kiểu số, hệ thống có thể dùng đột biến Gauss để tạo giá trị mới xung quanh giá trị hiện tại.

Công thức:

```text
New Value = Current Value + Gaussian Noise
```

Trong đó:

```text
Gaussian Noise = N(0, sigma)
```

Độ lệch chuẩn `sigma` giảm dần theo thế hệ:

```text
sigma = max(0.5, ((Total Generations − Current Generation) / Total Generations) × 5)
```

Sau khi sinh giá trị mới, hệ thống giới hạn giá trị trong khoảng mở rộng:

```text
[minValue − 2, maxValue + 2]
```

Ý nghĩa:

- Ở giai đoạn đầu, `sigma` lớn hơn để tạo nhiều biến thể dữ liệu.
- Ở giai đoạn cuối, `sigma` nhỏ hơn để tinh chỉnh dữ liệu quanh vùng tốt.

---

## 13. Tournament Selection

Tournament Selection được dùng để chọn cá thể bố mẹ cho quá trình lai ghép.

Cách hoạt động:

1. Chọn ngẫu nhiên một nhóm cá thể.
2. So sánh Fitness của các cá thể trong nhóm.
3. Chọn cá thể có Fitness cao nhất làm bố mẹ.

Công thức dễ đọc:

```text
Winner = Cá thể có Fitness cao nhất trong nhóm tournament
```

Viết gọn:

```text
Winner = argmax(Fitness)
```

Ý nghĩa:

- Cá thể tốt có cơ hội được chọn cao hơn.
- Vẫn giữ được tính ngẫu nhiên trong quá trình tiến hóa.

---

## 14. Niche Density Distance

Niche Density Distance dùng để duy trì độ đa dạng của quần thể.

Khi nhiều cá thể có Fitness gần nhau, hệ thống ưu tiên cá thể nằm ở vùng ít đông đúc hơn trong không gian dữ liệu.

Công thức dễ đọc:

```text
NDD = Trung bình khoảng cách tới các cá thể xa nhất trong mẫu so sánh
```

Trong đó:

```text
Khoảng cách giữa hai test data = Trung bình khoảng cách giữa các trường tương ứng
```

Ý nghĩa:

- Nếu NDD cao, cá thể khác biệt nhiều so với các cá thể khác.
- Khi Fitness gần bằng nhau, cá thể có NDD cao hơn được ưu tiên.
- Cách này giúp giảm nguy cơ quần thể bị giống nhau quá nhiều.

---

## 15. Phát hiện trì trệ trong GA

GA bị xem là trì trệ nếu Fitness tốt nhất không cải thiện đáng kể trong một số thế hệ liên tiếp.

Công thức:

```text
Nếu Best Fitness lớn nhất gần đây − Best Fitness nhỏ nhất gần đây < 0.005
thì quần thể bị coi là trì trệ.
```

Viết gọn:

```text
max(Recent Best Fitness) − min(Recent Best Fitness) < 0.005
```

Khi bị trì trệ, hệ thống có thể:

- Giữ lại một phần cá thể tốt nhất.
- Tái tạo phần còn lại của quần thể.
- Tăng khả năng tìm kiếm dữ liệu mới.

---

## 16. Hill Climbing tinh chỉnh cục bộ

Sau khi GA kết thúc, Hill Climbing được dùng để tinh chỉnh từng test data.

Với một test data hiện tại, hệ thống sinh các biến thể lân cận bằng cách thay đổi nhỏ giá trị của một hoặc một số trường.

### Ví dụ lân cận với trường số

Nếu trường `age` có miền hợp lệ từ 18 đến 60, HC có thể sinh các giá trị:

```text
17, 18, 19, 59, 60, 61
```

### Ví dụ lân cận với trường chuỗi

Nếu trường `password` có độ dài từ 6 đến 20 ký tự, HC có thể sinh chuỗi có độ dài:

```text
5, 6, 7, 19, 20, 21
```

### Quy tắc chọn

```text
Nếu Fitness mới > Fitness cũ:
    Nhận dữ liệu mới

Nếu Fitness mới ≤ Fitness cũ:
    Giữ dữ liệu cũ
```

Ý nghĩa:

- HC giúp tinh chỉnh các test data sau GA.
- HC đặc biệt hữu ích để cải thiện dữ liệu biên.
- Nếu GA tối ưu toàn cục, HC tối ưu cục bộ.

---

## 17. Simulated Annealing trong Hill Climbing

Hill Climbing có thể bị mắc kẹt tại điểm tối ưu cục bộ. Vì vậy, hệ thống có thể kết hợp Simulated Annealing để thỉnh thoảng chấp nhận một bước đi kém hơn.

### Cách hiểu đơn giản

| Trường hợp | Cách xử lý |
|---|---|
| Dữ liệu mới tốt hơn | Luôn chấp nhận |
| Dữ liệu mới kém hơn một chút | Có thể chấp nhận với xác suất nhỏ |
| Càng về cuối quá trình | Khả năng chấp nhận dữ liệu kém hơn giảm dần |

### Công thức nhiệt độ

```text
Temperature = Initial Temperature × alpha^iteration
```

Trong đó:

| Ký hiệu | Ý nghĩa |
|---|---|
| `Initial Temperature` | Nhiệt độ ban đầu |
| `alpha` | Hệ số làm nguội |
| `iteration` | Vòng lặp hiện tại |

### Xác suất chấp nhận bước đi kém hơn

```text
Accept Probability = e^(−|Delta| / Temperature)
```

Trong đó:

```text
Delta = Fitness mới − Fitness cũ
```

Ý nghĩa:

- Nếu dữ liệu mới tốt hơn, hệ thống nhận ngay.
- Nếu dữ liệu mới kém hơn, hệ thống vẫn có thể nhận với xác suất nhỏ.
- Cơ chế này giúp tránh mắc kẹt tại cực trị cục bộ.

---

## 18. Đánh giá tập dữ liệu kiểm thử cuối cùng

Sau khi hoàn thành LLM–GA–HC, hệ thống đánh giá chất lượng tổng thể của tập dữ liệu kiểm thử cuối cùng.

### Công thức đã chỉnh sửa cho đề tài sinh test data

```text
Final Quality = 0.4 × Validation Coverage
              + 0.3 × Boundary Coverage
              + 0.2 × Diversity Coverage
              + 0.1 × Negative Data Coverage
```

Trong đó:

| Thành phần | Ý nghĩa |
|---|---|
| Validation Coverage | Tỷ lệ dữ liệu bám sát đúng đặc tả |
| Boundary Coverage | Tỷ lệ giá trị biên đã được bao phủ |
| Diversity Coverage | Mức độ đa dạng của toàn bộ tập dữ liệu |
| Negative Data Coverage | Tỷ lệ dữ liệu không hợp lệ phục vụ kiểm thử âm |

### Cách tính từng thành phần

| Thành phần | Cách tính |
|---|---|
| Validation Coverage | Số trường dữ liệu đạt yêu cầu / Tổng số trường dữ liệu |
| Boundary Coverage | Số giá trị biên đã sinh ra / Tổng số giá trị biên cần kiểm thử |
| Diversity Coverage | Trung bình Diversity Score của toàn bộ test data |
| Negative Data Coverage | Số test data không hợp lệ / Tổng số test data |

### Tỷ lệ trùng lặp của tập dữ liệu cuối cùng

```text
Duplicate Rate = Số test data bị trùng / Tổng số test data
```

Nếu `Duplicate Rate > 0.3`, điểm chất lượng tổng thể bị giảm:

```text
Final Quality = Final Quality × (1 − (Duplicate Rate − 0.3) × 0.5)
```

Ý nghĩa:

- Final Quality dùng để đánh giá chất lượng cả tập dữ liệu đầu ra.
- Đây là chỉ số dùng để so sánh với tập dữ liệu ban đầu do LLM sinh ra.
- Nếu Final Quality cao hơn Initial Score, quá trình tối ưu được xem là có hiệu quả.

---

## 19. Mức cải thiện sau tối ưu

Để chứng minh hiệu quả của mô hình LLM–GA–HC, hệ thống so sánh chất lượng dữ liệu trước và sau tối ưu.

### Mức cải thiện tuyệt đối

```text
Improvement = Final Quality − Initial Quality
```

### Mức cải thiện theo phần trăm

```text
Improvement Rate = ((Final Quality − Initial Quality) / Initial Quality) × 100%
```

Ý nghĩa:

| Trường hợp | Kết luận |
|---|---|
| Final Quality > Initial Quality | Dữ liệu sau tối ưu tốt hơn dữ liệu ban đầu |
| Final Quality = Initial Quality | Quá trình tối ưu chưa cải thiện rõ |
| Final Quality < Initial Quality | Cần xem lại trọng số hoặc cơ chế tối ưu |

---

## 20. Tối ưu theo mức Tập Dữ Liệu (Suite-Level Optimization) cho Enterprise

Trong thực tế xây dựng hệ thống tự động sinh dữ liệu kiểm thử cấp doanh nghiệp (Enterprise), việc chỉ đánh giá chất lượng từng cá thể (Test Case) là chưa đủ. Một tập dữ liệu có thể gồm toàn các cá thể có Fitness rất cao nhưng lại chồng chéo nhau và bỏ sót nhiều nghiệp vụ (Business Rules). Do đó, cần bổ sung mô hình đánh giá và tối ưu **mức tập dữ liệu (Test Suite)**.

### 20.1. Rule Coverage (Độ phủ nghiệp vụ)

Giả sử hệ thống trích xuất được một tập các quy tắc nghiệp vụ $R = \{r_1, r_2, ..., r_n\}$ từ đặc tả yêu cầu (ví dụ: `email_required`, `password_length`, `status_active`).

Độ phủ cơ bản của một tập test (Test Suite) được tính bằng:

$$Coverage = \frac{\text{Số lượng Rule được bao phủ}}{\text{Tổng số Rule}}$$

### 20.2. Weighted Coverage (Độ phủ có trọng số)

Do các quy tắc có mức độ quan trọng khác nhau, ta gán trọng số $W(r_i)$ cho mỗi quy tắc $r_i$.

$$Weighted\_Coverage = \frac{\sum_{i \in Covered} W(r_i)}{\sum_{j=1}^{n} W(r_j)}$$

*Ví dụ:* Nếu tổng trọng số các rule là 35, và tập test hiện tại cover được các rule có tổng trọng số là 32, thì $Weighted\_Coverage = 32 / 35 \approx 91.4\%$.

### 20.3. Hàm Fitness Mức Tập (Global Suite Fitness) cho GA

Thay vì GA tính Fitness cho từng Test Case riêng lẻ, GA sẽ đánh giá toàn bộ tổ hợp Test Suite:

$$Global\_Fitness(Suite) = 0.55 \times Weighted\_Coverage + 0.15 \times Boundary\_Coverage + 0.15 \times Negative\_Coverage + 0.10 \times Diversity + 0.05 \times Priority - Duplicate\_Penalty - Suite\_Size\_Penalty$$

Trong đó, **Weighted Coverage** đóng vai trò chủ đạo (55%), định hướng GA ưu tiên chọn các tổ hợp test case phủ được nhiều luật nghiệp vụ nhất.

### 20.4. Tiêu chí chấp nhận cho Hill Climbing (HC)

Với mô hình Enterprise, HC thực hiện tìm kiếm cục bộ (Local Search) không chỉ để tăng điểm số đơn thuần, mà mục tiêu tối thượng là **mở rộng độ phủ**.

Điều kiện chấp nhận (Acceptance Criteria) một biến thể mới của HC:
1. **Ưu tiên 1:** $\Delta Coverage > 0$ (Biến thể mới giúp cover thêm một rule mới $\rightarrow$ Chấp nhận ngay).
2. **Ưu tiên 2:** Nếu $Coverage(new) = Coverage(old)$, lúc này mới xét tiếp sự gia tăng của $Diversity, Boundary, Negative$.

### 20.5. Công thức Minimal Test Suite

Mục tiêu cuối cùng của toàn bộ hệ thống là: **Đạt độ phủ cao nhất với số lượng Test Case ít nhất**. Ta đưa thêm hình phạt cho kích thước tập test (Suite Size Penalty):

$$Minimal\_Suite\_Fitness = Weighted\_Coverage - (\lambda \times Suite\_Size)$$

Với $\lambda$ là hệ số phạt kích thước (ví dụ: 0.002).

*Giải thích:*
- Suite A: Coverage = 95%, Size = 100 $\rightarrow$ Fitness = $0.95 - (0.002 \times 100) = 0.75$
- Suite B: Coverage = 95%, Size = 40 $\rightarrow$ Fitness = $0.95 - (0.002 \times 40) = 0.87$
$\Rightarrow$ GA sẽ ưu tiên chọn Suite B vì nó tối ưu và tinh gọn hơn.

Quy trình Enterprise lúc này sẽ là: **Requirement $\rightarrow$ Rule Extraction $\rightarrow$ LLM Seed Generation $\rightarrow$ Coverage Matrix $\rightarrow$ GA Global Optimization $\rightarrow$ HC Local Optimization $\rightarrow$ Minimal High-Coverage Test Suite**.

---

## 20. Bảng tổng hợp tham số

| Tham số | Giá trị đề xuất | Ý nghĩa |
|---|---:|---|
| Trọng số Validation Score | 0.4 | Ưu tiên dữ liệu bám sát đặc tả |
| Trọng số Boundary Score | 0.3 | Ưu tiên dữ liệu biên |
| Trọng số Diversity Score | 0.2 | Tăng độ đa dạng |
| Trọng số Priority Score | 0.1 | Ưu tiên loại test data quan trọng |
| Hệ số phạt Penalty trong Fitness | 0.5 | Giảm điểm dữ liệu trùng |
| Penalty mỗi bản trùng phát sinh | 0.15 | Tăng phạt khi có bản sao |
| Penalty gốc tối đa | 0.6 | Giới hạn mức phạt |
| Tỷ lệ đột biến ban đầu | 0.15 | Tăng khám phá ở giai đoạn đầu |
| Tỷ lệ đột biến tối thiểu | 0.02 | Ổn định ở giai đoạn cuối |
| Tỷ lệ lai ghép ban đầu | 0.8 | Kết hợp dữ liệu tốt |
| Tỷ lệ lai ghép tối thiểu | 0.45 | Duy trì lai ghép ở mức thấp |
| Ngưỡng trì trệ | 0.005 | Phát hiện khi GA ít cải thiện |
| Nhiệt độ ban đầu SA | 0.15 | Điều khiển xác suất nhận bước kém hơn |
| Hệ số làm nguội SA | 0.85 | Giảm dần khả năng nhận bước kém hơn |

---

## 21. Lưu ý khi đưa vào báo cáo

### 21.1. Nên dùng cách viết này

Trong báo cáo, nên viết:

```text
Hệ thống đánh giá chất lượng dữ liệu kiểm thử thông qua các tiêu chí: mức độ tuân thủ ràng buộc, mức độ bao phủ giá trị biên, độ đa dạng của dữ liệu, mức độ ưu tiên của loại dữ liệu kiểm thử và mức độ trùng lặp. Các tiêu chí này được kết hợp trong hàm Fitness để phục vụ quá trình tối ưu bằng GA và HC.
```

### 21.2. Không nên viết

Không nên viết:

```text
Hệ thống chấm điểm bộ test để kiểm thử phần mềm.
```

Vì đề tài là **sinh dữ liệu kiểm thử**, nên cách viết đúng hơn là:

```text
Hệ thống đánh giá chất lượng tập dữ liệu kiểm thử được sinh ra.
```

### 21.3. Cách mô tả số lần đánh giá

Nên mô tả có 4 giai đoạn đánh giá:

| Giai đoạn | Nội dung đánh giá |
|---|---|
| Sau LLM | Đánh giá dữ liệu ban đầu bằng Fitness |
| Trong GA | Chấm Fitness qua từng thế hệ để chọn lọc |
| Trong HC | Chấm Fitness các biến thể lân cận để tinh chỉnh |
| Sau cùng | Đánh giá Final Quality của cả tập dữ liệu |

### 21.4. Lưu ý đồng bộ code

Nếu công thức Boundary Score và Diversity Score trong báo cáo được chỉnh theo bản mới này, phần cài đặt trong code cũng nên được cập nhật tương ứng để tránh lệch giữa báo cáo và chương trình.

Nếu code chưa cập nhật, có thể viết trong báo cáo là:

```text
Các công thức trên là mô hình đánh giá được đề xuất để cải thiện chất lượng dữ liệu kiểm thử. Trong phạm vi cài đặt, hệ thống sử dụng các thành phần tương ứng để tính Fitness và tối ưu tập dữ liệu đầu ra.
```
