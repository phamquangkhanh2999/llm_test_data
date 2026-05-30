# 🐍 Hyperion TestForge - Hướng dẫn Khởi chạy FastAPI Backend 🐍

Tài liệu này cung cấp hướng dẫn cài đặt, thiết lập và vận hành chi tiết đối với thành phần **Python FastAPI Backend** của dự án Hyperion TestForge.

Backend đảm nhận nhiệm vụ:
1. **AI Spec Parser**: Tích hợp trí tuệ nhân tạo (hỗ trợ cả **Gemini API** và **OpenAI API**) để phân tích ngôn ngữ tự nhiên từ đặc tả nghiệp vụ, tự sinh Schema kiểm thử (JSON rules) và tập dữ liệu mẫu ban đầu F0.
2. **Genetic Algorithm Core**: Bộ lõi tối ưu di truyền tiến hóa di trú chạy đa luồng để liên tục cải tiến chất lượng bộ ca kiểm thử.
3. **Hill Climbing Optimizer**: Bộ tinh chỉnh leo đồi cục bộ chuyên sâu để tìm ra các lỗ hổng biên đặc biệt và nhúng mã độc hại tấn công (SQL Injection, XSS).
4. **Real-time WebSockets**: Truyền dữ liệu tiến trình tối ưu hóa thế hệ thời gian thực về màn hình React Frontend.
5. **SQLite Database**: Tự động lưu trữ thông tin dự án, đặc tả, lịch sử chạy job tối ưu hóa và dữ liệu test sinh ra thông qua SQLAlchemy ORM.

---

## 📂 Cấu trúc Thư mục Backend

```text
/backend
├── app/
│   ├── algorithms/       # Lõi thuật toán tối ưu hóa di truyền (GA) & Leo đồi (HC)
│   │   ├── optimizer_engine.py  # Động cơ di truyền điều phối thế hệ GA
│   │   └── boundary_tweak.py    # Thuật toán leo đồi HC tinh chỉnh biên độc hại
│   ├── core/             # Cấu hình cốt lõi & Cơ sở dữ liệu SQLite
│   │   └── database.py          # Kết nối engine SQLAlchemy và dependency session
│   ├── services/         # Dịch vụ tích hợp API ngôn ngữ lớn (LLM Connector)
│   │   └── ai_parser.py         # Hàm gọi Gemini/OpenAI trích xuất quy tắc nghiệp vụ
│   ├── main.py           # Entrypoint chính của FastAPI, định nghĩa REST API & WebSockets
│   └── models.py         # Cấu trúc các bảng dữ liệu ánh xạ SQLite qua SQLAlchemy
├── .env                  # Tệp cấu hình biến môi trường cục bộ (API Keys, DB URL)
├── requirements.txt      # Danh sách thư viện phụ thuộc (Đã tối ưu hóa cho Python 3.13)
└── README.md             # Hướng dẫn sử dụng này
```

---

## 🛠️ Hướng dẫn Khởi chạy Từng bước (Step-by-Step)

### **Bước 1: Di chuyển vào thư mục backend**
Mở Terminal trên máy tính của bạn và điều hướng tới thư mục chứa backend:
```bash
cd backend
```

### **Bước 2: Thiết lập Môi trường ảo (Virtual Environment)**
Việc tạo môi trường ảo giúp cách ly các gói thư viện Python của dự án này, tránh gây xung đột với hệ thống:
* **Trên macOS và Linux:**
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```
* **Trên Windows:**
  ```cmd
  python -m venv venv
  venv\Scripts\activate
  ```
*(Sau khi kích hoạt thành công, bạn sẽ thấy ký hiệu `(venv)` xuất hiện ở đầu dòng lệnh trong Terminal)*

### **Bước 3: Cài đặt các thư viện phụ thuộc**
Sử dụng công cụ `pip` để cài đặt tự động tất cả các gói phụ thuộc. 

> [!NOTE]
> Danh sách thư viện trong `requirements.txt` đã được nâng cấp lên các phiên bản an toàn hơn (`pydantic>=2.9.0` và `pydantic-settings>=2.5.0`) để **tương thích 100% với Python 3.13** (tránh triệt để lỗi biên dịch `pydantic-core` cũ) và bổ sung sẵn `websockets` phục vụ truyền dữ liệu thời gian thực.

```bash
pip install -r requirements.txt
```

### **Bước 4: Cấu hình biến môi trường (`.env`)**
Tạo hoặc chỉnh sửa tệp tin `.env` nằm trực tiếp trong thư mục `backend/` với nội dung mẫu như sau:

```env
# CẤU HÌNH MÔI TRƯỜNG PYTHON BACKEND

# 1. Nếu sử dụng Gemini API (Khuyên dùng nhờ tốc độ cao và chi phí tối ưu)
# Điền khóa Gemini API của bạn vào đây (khóa thường bắt đầu bằng AIzaSy...)
GEMINI_API_KEY=your_gemini_api_key_here

# 2. Hoặc nếu bạn muốn sử dụng OpenAI API
OPENAI_API_KEY=your_openai_api_key_here

# 3. Đường dẫn cơ sở dữ liệu SQLite cục bộ (Tự sinh file database trên ổ đĩa)
DATABASE_URL=sqlite:///./testforge.db
```

> [!TIP]
> **Chế độ Dự phòng thông minh (Smart Mock Fallback):**
> Nếu bạn để trống cả hai mục `GEMINI_API_KEY` và `OPENAI_API_KEY`, hệ thống sẽ **tự động chuyển hướng sang chế độ Mock dữ liệu ngoại tuyến thông minh**. Bạn vẫn có thể kiểm thử toàn bộ tính năng trích xuất, chạy di truyền và leo đồi mượt mà mà không gặp bất kỳ trở ngại nào!

### **Bước 5: Khởi chạy Máy chủ FastAPI**
Chạy ứng dụng bằng máy chủ ASGI Uvicorn ở cổng mặc định `8000`:
```bash
uvicorn app.main:app --reload
```
*Tham số `--reload` giúp máy chủ tự động khởi động lại mỗi khi bạn thực hiện thay đổi mã nguồn.*

Khi màn hình Terminal xuất hiện dòng thông báo sau, máy chủ Backend đã hoạt động:
```text
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

---

## 🔍 Kiểm tra hoạt động & Sử dụng Tài liệu API

* **Kiểm tra sức khỏe hệ thống (Health Check)**:
  Truy cập đường dẫn [http://localhost:8000/health](http://localhost:8000/health). Phản hồi trả về dạng:
  ```json
  {"status": "healthy", "service": "Hyperion TestForge Backend"}
  ```
  
* **Tài liệu API Swagger UI (Tương tác trực tiếp)**:
  FastAPI tự động sinh trang tài liệu vô cùng trực quan. Truy cập [http://localhost:8000/docs](http://localhost:8000/docs) để:
  * Xem danh sách toàn bộ các Endpoint HTTP REST API và WebSocket.
  * Nhấn chọn "Try it out" để kiểm tra, gửi dữ liệu thật lên backend và xem trực tiếp kết quả trả về.

---

## 📡 Chi tiết về các Endpoint quan trọng

1. **`POST /api/specifications`**
   * *Nhiệm vụ*: Nhận văn bản nghiệp vụ, gọi AI trích xuất Schema luật và sinh F0. Tự khởi tạo Dự án và ghi nhận Đặc tả vào SQLite.
2. **`POST /api/optimize`**
   * *Nhiệm vụ*: Thực thi tối ưu hóa GA và leo đồi HC dưới dạng đồng bộ (dành cho các tác vụ HTTP ngắn hạn).
3. **`GET /api/specifications`**
   * *Nhiệm vụ*: Truy vấn danh sách lịch sử các đặc tả nghiệp vụ đã lưu trong CSDL SQLite.
4. **`DELETE /api/specifications/{id}`**
   * *Nhiệm vụ*: Xóa một kịch bản đặc tả nghiệp vụ khỏi CSDL SQLite.
5. **`WS /ws/jobs/{specification_id}`** (WebSocket)
   * *Nhiệm vụ*: Giao thức kết nối song hướng thời gian thực. Nhận cấu hình tham số GA từ client, thực thi vòng lặp tiến hóa và truyền phát trực tiếp (stream) từng thế hệ tiến hóa cùng các bước tinh chỉnh leo đồi biên độc hại về giao diện Frontend.

---
# 1. Di chuyển vào thư mục backend
cd backend

# 2. Tạo môi trường ảo (nếu chưa tạo)
python3 -m venv venv

# 3. Kích hoạt môi trường ảo
source venv/bin/activate

# 4. Cài đặt các thư viện cần thiết từ requirements.txt
pip install -r requirements.txt

# 5. Khởi chạy Backend Server ở cổng 8000
uvicorn app.main:app --reload
## ⚠️ Hướng dẫn xử lý sự cố thường gặp (Troubleshooting)

* **Lỗi `Address already in use` (Cổng 8000 bị chiếm)**:
  Nếu máy bạn có dịch vụ khác đang chạy cổng `8000`, hãy tắt dịch vụ đó hoặc đổi cổng khởi chạy của FastAPI sang cổng khác (ví dụ: `8080`):
  ```bash
  uvicorn app.main:app --reload --port 8080
  ```
* **CSDL SQLite không ghi nhận dữ liệu**:
  SQLite sẽ tự động tạo tệp `testforge.db` ngay khi backend khởi động nhờ lệnh `Base.metadata.create_all(bind=engine)` trong `main.py`. Đảm bảo thư mục dự án của bạn có quyền ghi file (Write Permission).
* **Lỗi kết nối API Thật**:
  Nếu bạn điền khóa Gemini hay OpenAI nhưng gặp lỗi kết nối mạng, hãy kiểm tra lại kết nối Internet hoặc cấu hình Proxy/VPN trên máy của mình. Nếu không kết nối được, hãy tạm thời xóa Key đi để trải nghiệm chế độ offline (Mock) mượt mà.

---
*Chúc bạn phát triển và kiểm thử dự án thành công cùng **Hyperion TestForge Backend**!* 🚀
