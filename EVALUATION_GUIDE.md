# 📊 Hướng dẫn về Công thức Đánh giá Test Case (Evaluation Formula)

Tài liệu này giải thích cách hệ thống Hyperion TestForge tự động đánh giá chất lượng của các bộ dữ liệu kiểm thử (Test Cases). Công thức này được thiết kế dựa trên sự kết hợp giữa các quy tắc toán học và tiêu chuẩn kiểm thử phần mềm quốc tế.

---

## 1. Mục tiêu của Hàm Đánh giá (Fitness Function)

Trong thuật toán di truyền (Genetic Algorithm), mỗi "cá thể" (một dòng dữ liệu test) cần được chấm điểm để biết nó "tốt" đến mức nào. Điểm số càng cao, dữ liệu đó càng có giá trị trong việc tìm ra lỗi tiềm ẩn của phần mềm.

## 2. Các Thành phần của Công thức

Hệ thống đánh giá dựa trên 4 chỉ số cốt lõi:

### A. Điểm Đúng đắn (Validation Score - $V$)
*   **Mục đích:** Đảm bảo dữ liệu khớp với định dạng yêu cầu (Schema).
*   **Cách tính:**
    *   Khớp hoàn toàn (Email đúng, Số điện thoại đúng, Không trống trường bắt buộc): **1.0 điểm**.
    *   Sai định dạng hoặc thiếu trường bắt buộc: **0 điểm**.
    *   Đối với trường số (Number): Nếu nằm trong khoảng `[min, max]` thì đạt điểm tối đa.

### B. Điểm Phủ biên (Boundary Score - $B$)
*   **Mục đích:** Tập trung vào các giá trị "nhạy cảm" dễ gây lỗi logic (lỗi lệch 1 đơn vị - Off-by-one).
*   **Cách tính:**
    *   Giá trị đúng bằng Biên ($min$ hoặc $max$): **1.0 điểm**.
    *   Giá trị sát biên ($min+1$ hoặc $max-1$): **0.8 điểm**.
    *   Giá trị nằm ngoài biên ($min-1$ hoặc $max+1$): **0.9 điểm** (dành cho Negative Testing).

### C. Điểm Bảo mật (Security Score - $S$)
*   **Mục đích:** Phát hiện khả năng chống tấn công của ứng dụng.
*   **Cách tính:**
    *   Chứa các mẫu mã độc (SQL Injection, XSS) như `' OR 1=1 --` hoặc `<script>`: **1.0 điểm**.
    *   Dữ liệu thông thường: **0 điểm** (trong ngữ cảnh kiểm thử bảo mật).

### D. Điểm Đa dạng (Diversity Score - $D$)
*   **Mục đích:** Tránh việc sinh ra hàng ngàn bản ghi giống hệt nhau, gây lãng phí tài nguyên.
*   **Cách tính:** Sử dụng thuật toán đo khoảng cách văn bản (Levenshtein) để so sánh các bản ghi với nhau. Bản ghi càng khác biệt với phần còn lại của tập dữ liệu thì điểm càng cao.

---

## 3. Công thức Tổng quát

Điểm cuối cùng của một Test Case ($Fitness$) là trung bình có trọng số của các thành phần trên:

$$Fitness = (w_{val} \cdot V) + (w_{bound} \cdot B) + (w_{sec} \cdot S) + (w_{div} \cdot D)$$

**Trong đó các trọng số ($w$) mặc định thường là:**
- $w_{val} = 0.5$ (50%)
- $w_{bound} = 0.2$ (20%)
- $w_{sec} = 0.2$ (20%)
- $w_{div} = 0.1$ (10%)

> **Lưu ý:** Người dùng có thể điều chỉnh các trọng số này trên Dashboard tùy theo mục đích kiểm thử (ví dụ: muốn ưu tiên bảo mật hơn thì tăng $w_{sec}$).

---

## 4. Vai trò của AI trong Đánh giá

Bên cạnh công thức toán học cố định, hệ thống còn sử dụng **LLM (Gemini/GPT)** để đánh giá định tính:
1.  **Phân tích ngữ nghĩa:** AI hiểu được ý nghĩa của các trường (ví dụ: "Họ tên" không nên chứa số).
2.  **Đưa ra nhận xét:** AI chỉ ra các "Điểm yếu" và "Trường hợp còn thiếu" mà công thức toán học có thể bỏ sót.
3.  **Tối ưu hóa hạt giống (F0):** AI giúp tạo ra các bản ghi chất lượng cao ngay từ đầu để thuật toán di truyền có xuất phát điểm tốt hơn.

---
*Tài liệu này được trích xuất từ cấu trúc hệ thống Hyperion TestForge.*

## 🛠️ Phụ lục: Chi tiết Thuật toán (Dành cho Báo cáo)

Dưới đây là các khối mã nguồn quan trọng được sử dụng để tối ưu hóa dữ liệu. Bạn có thể tìm thấy các đánh dấu `[START]` và `[END]` tương ứng trong code.

### 1. Thuật toán Lai ghép (Uniform Crossover)
*   **Vị trí:** `src/algorithms/genetic.ts` -> `crossover()`
*   **Nguyên lý:** Kết hợp các trường dữ liệu từ hai "cha mẹ" để tạo ra "con" mới, giúp giữ lại các tổ hợp dữ liệu tốt đã được khám phá.

### 2. Thuật toán Đột biến (Adaptive Mutation)
*   **Vị trí:** `src/algorithms/genetic.ts` -> `mutate()`
*   **Nguyên lý:** Thay đổi ngẫu nhiên một số trường dữ liệu với tỉ lệ thích ứng (tỉ lệ giảm dần khi quần thể đã ổn định) để khám phá các vùng không gian dữ liệu mới.

### 3. Mô phỏng luyện kim (Simulated Annealing)
*   **Vị trí:** `backend/app/algorithms/boundary_tweak.py` -> `_simulated_annealing_hc()`
*   **Nguyên lý:** Cho phép thuật toán chấp nhận các bước đi "tạm thời xấu hơn" với một xác suất nhất định. Điều này giúp hệ thống không bị mắc kẹt tại các điểm tối ưu cục bộ và có cơ hội tìm thấy điểm biên tốt nhất toàn cục.

### 4. Chấm điểm Biên (Boundary Fitness Scoring)
*   **Vị trí:** `backend/app/algorithms/optimizer_engine.py` -> `evaluate_testcase_quality()`
*   **Nguyên lý:** Sử dụng hàm Fitness dạng bậc thang để "dẫn dắt" các cá thể tiến dần về phía biên nghiệp vụ. Dữ liệu càng gần biên, điểm thưởng càng cao.

