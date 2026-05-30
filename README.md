# 🌟 Hyperion TestForge - Hướng dẫn Cài đặt & Khởi chạy Toàn diện 🌟

Chào mừng bạn đến với **Hyperion TestForge** – Nền tảng sinh và tối ưu hóa bộ dữ liệu ca kiểm thử (Test Cases) thông minh tích hợp **Trí tuệ nhân tạo (LLM)** cùng bộ đôi thuật toán tối ưu tiên tiến **Giải thuật Di truyền (Genetic Algorithm - GA)** và **Thuật toán Leo đồi tinh chỉnh biên cục bộ (Hill Climbing - HC)**.

Dự án này được thiết lập dưới dạng một cấu trúc kết hợp hoàn hảo giữa **FastAPI Backend (Python)** và **React + TypeScript + Vite Frontend (JavaScript)**. Dưới đây là hướng dẫn chi tiết để bạn có thể cài đặt và khởi chạy cả hai dự án một cách nhanh chóng và trơn tru nhất.

---

## 🗺️ Bản đồ Thư mục & Vai trò Thành phần

```text
/llm_test_data
├── backend/                  # 🐍 Thư mục chứa mã nguồn Python FastAPI Backend
│   ├── app/                  # Chứa logic ứng dụng cốt lõi
│   │   ├── algorithms/       # Các bộ lõi thuật toán tối ưu hóa GA & Hill Climbing
│   │   ├── core/             # Cấu hình hệ thống, kết nối cơ sở dữ liệu SQLite
│   │   ├── services/         # Dịch vụ tích hợp LLM (OpenAI API spec parser)
│   │   ├── main.py           # Entrypoint chính của FastAPI, định nghĩa API & WebSocket
│   │   └── models.py         # Định nghĩa các cấu trúc bảng SQLite qua SQLAlchemy
│   ├── .env                  # Tệp tin cấu hình biến môi trường của Backend
│   └── requirements.txt      # Danh sách các thư viện Python phụ thuộc cần cài đặt
├── src/                      # ⚛️ Thư mục chứa mã nguồn React + Vite + TS Frontend
│   ├── components/           # Các thành phần giao diện người dùng (Dashboard, Visualizer, v.v.)
│   ├── App.tsx               # Điểm khởi tạo và điều hướng trạng thái ứng dụng chính
│   └── main.tsx              # Điểm render React DOM vào trang index.html
├── package.json              # Cấu hình và danh sách thư viện phụ thuộc của Frontend
└── README.md                 # Tài liệu hướng dẫn sử dụng này
```

---

## 🛠️ Yêu cầu Hệ thống Cần có (Prerequisites)

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt các công cụ sau:
1. **Node.js** (Phiên bản khuyến nghị: `>= 18.0.0`) và trình quản lý gói `npm` kèm theo.
2. **Python** (Phiên bản khuyến nghị: `>= 3.9.0`) kèm trình quản lý gói `pip`.
3. **SQLite** (Thường đã được tích hợp sẵn trong hầu hết các hệ điều hành macOS/Windows/Linux).

---

## 🚀 Hướng dẫn Khởi chạy Nhanh (Quick Start)

Nếu bạn đã có kinh nghiệm và muốn chạy ứng dụng ngay lập tức, hãy thực hiện các lệnh sau:

| Thao tác | 🐍 Python Backend (Cổng `8000`) | ⚛️ React Frontend (Cổng `5173`) |
| :--- | :--- | :--- |
| **Bước 1** | `cd backend` | *(Đứng tại thư mục gốc)* |
| **Bước 2** | `python -m venv venv` | `npm install` |
| **Bước 3** | `source venv/bin/activate` *(hoặc `venv\Scripts\activate` trên Windows)* | |
| **Bước 4** | `pip install -r requirements.txt` | |
| **Bước 5** | `uvicorn app.main:app --reload` | `npm run dev` |

---

## 📦 Chi tiết Bước Cài đặt & Khởi chạy (Step-by-Step Guide)

---

### 1. 🐍 Hướng dẫn Chạy Python FastAPI Backend

FastAPI đảm nhận vai trò phân tích nghiệp vụ bằng AI, thực thi các vòng lặp di truyền GA hiệu năng cao, thực hiện thuật toán leo đồi HC và lưu trữ kết quả vào cơ sở dữ liệu SQLite cục bộ thông qua SQLAlchemy.

#### **Bước 1.1: Di chuyển vào thư mục backend**
Mở một cửa sổ Terminal mới và chạy lệnh:
```bash
cd backend
```

#### **Bước 1.2: Khởi tạo và kích hoạt Môi trường ảo (Virtual Environment)**
Việc sử dụng môi trường ảo giúp cô lập các thư viện của dự án này, tránh xung đột hệ thống:
* **Trên macOS và Linux:**
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```
* **Trên Windows (cmd / PowerShell):**
  ```cmd
  python -m venv venv
  venv\Scripts\activate
  ```

#### **Bước 1.3: Cài đặt các thư viện phụ thuộc**
Sử dụng `pip` để tự động tải và cài đặt toàn bộ các thư viện được liệt kê trong `requirements.txt`:
```bash
pip install -r requirements.txt
```

#### **Bước 1.4: Thiết lập Biến môi trường (`.env`)**
Sao chép cấu hình mẫu hoặc chỉnh sửa trực tiếp tệp tin `.env` trong thư mục `backend/`:
```bash
# Trong file backend/.env
# Nếu sử dụng Gemini API:
GEMINI_API_KEY=your_gemini_api_key_here

# Hoặc nếu sử dụng OpenAI API:
OPENAI_API_KEY=your_openai_api_key_here

DATABASE_URL=sqlite:///./testforge.db
```
> [!TIP]
> **Hỗ trợ Đa AI Engine & Chế độ Ngoại tuyến (Fallback/Mock mode):**
> 1. **Gemini API:** Được khuyên dùng nhờ tốc độ cao và chi phí tối ưu. Chỉ cần điền `GEMINI_API_KEY` (khóa có dạng bắt đầu bằng `AIzaSy`). Hệ thống sẽ tự động sử dụng mô hình `gemini-1.5-flash`.
> 2. **OpenAI API:** Điền `OPENAI_API_KEY`, hệ thống sẽ sử dụng mô hình `gpt-3.5-turbo`.
> 3. **Ngoại tuyến:** Nếu bạn để trống cả hai khóa, hệ thống sẽ **tự động kích hoạt bộ giả lập nghiệp vụ thông minh (Mock Fallback)** giúp trải nghiệm đầy đủ tính năng mà không mất phí!

#### **Bước 1.5: Khởi chạy Backend Server**
Thực thi lệnh sau để khởi chạy máy chủ FastAPI dưới chế độ tự động tải lại khi mã thay đổi (`--reload`):
```bash
uvicorn app.main:app --reload
```
Nếu màn hình xuất hiện dòng chữ sau là bạn đã khởi chạy thành công:
```text
INFO:     Started server process [12345]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

#### **Bước 1.6: Kiểm tra Hoạt động & Xem Tài liệu API trực quan**
* **Kiểm tra sức khỏe (Health Check):** Truy cập đường dẫn [http://localhost:8000/health](http://localhost:8000/health) trên trình duyệt, kết quả trả về sẽ là `{"status": "healthy", ...}`.
* **Tài liệu API Swagger UI:** FastAPI tự động tạo tài liệu API cực kỳ chuyên nghiệp và trực quan. Hãy truy cập [http://localhost:8000/docs](http://localhost:8000/docs) để xem và chạy thử trực tiếp các endpoint!

---

### 2. ⚛️ Hướng dẫn Chạy React TypeScript Frontend

Frontend được phát triển trên nền tảng **React (v19)** cùng công cụ build siêu tốc **Vite**, mang lại trải nghiệm giao diện người dùng mượt mà với hoạt ảnh di truyền thời gian thực thông qua WebSockets.

#### **Bước 2.1: Quay lại thư mục gốc**
Mở một cửa sổ Terminal mới (hoặc thoát khỏi thư mục backend trên Terminal hiện tại) để đứng ở thư mục gốc của dự án:
```bash
cd ..
```

#### **Bước 2.2: Cài đặt các gói phụ thuộc (Dependencies)**
Tải và cài đặt toàn bộ thư viện frontend từ NPM:
```bash
npm install
```

#### **Bước 2.3: Khởi chạy Máy chủ Phát triển Frontend**
Khởi chạy Vite Development Server bằng lệnh:
```bash
npm run dev
```
Sau khi hoàn tất, Vite sẽ cung cấp đường dẫn truy cập cục bộ:
```text
  VITE v8.x.x  ready in 200 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```
Bây giờ, hãy mở trình duyệt và truy cập [http://localhost:5173](http://localhost:5173) để bắt đầu sử dụng ứng dụng!

---

## 🛠️ Luồng hoạt động & Giao thức Kết nối

Để hỗ trợ bạn hiểu rõ hơn cách 2 thành phần này tương tác với nhau:

1. **Cơ sở dữ liệu tự động khởi tạo:**
   Khi bạn chạy lệnh khởi động Backend ở cổng `8000`, SQLAlchemy sẽ kiểm tra và tự động sinh tệp tin cơ sở dữ liệu SQLite có tên là `testforge.db` ở thư mục `backend/`. Bạn không cần phải chạy bất kỳ lệnh khởi tạo CSDL thủ công nào.
   
2. **Giao tiếp API RESTful:**
   Khi bạn nhấn nút phân tích đặc tả trên giao diện Frontend ở cổng `5173`, Frontend sẽ gửi yêu cầu HTTP POST tới cổng `http://localhost:8000/api/specifications` để trích xuất quy tắc trường nghiệp vụ.
   
3. **Kết nối WebSocket thời gian thực (Real-time Stream):**
   Trong suốt tiến trình chạy tối ưu bộ ca kiểm thử bằng Giải thuật Di truyền (GA) và Leo đồi (HC), Frontend sẽ kết nối qua giao thức WebSocket tới địa chỉ `ws://localhost:8000/ws/jobs/{specification_id}`.
   * Backend sẽ liên tục tính toán các thế hệ mới và truyền phát trực tiếp (stream) điểm số chất lượng trung bình, ca tốt nhất, tỉ lệ trùng lặp về Client.
   * Giao diện React sẽ vẽ biểu đồ biến thiên chất lượng thời gian thực bằng thư viện **Recharts** và in nhật ký leo đồi sống động trực tiếp lên màn hình.

---

## ⚠️ Khắc phục Sự cố Thường gặp (Troubleshooting)

* **Lỗi `Address already in use` hoặc Cổng `8000` / `5173` bị chiếm:**
  Đảm bảo không có dịch vụ nào khác đang chạy trên các cổng này. Nếu có, hãy tắt chúng đi hoặc cấu hình đổi cổng chạy của Backend bằng cách khởi chạy:
  ```bash
  uvicorn app.main:app --reload --port 8080
  ```
  *(Lưu ý: Nếu đổi cổng backend, hãy cập nhật lại đường dẫn gọi API và WebSocket tương ứng trong mã nguồn frontend của bạn)*.
  
* **Lỗi kết nối `FastAPI Backend đang chạy ở cổng 8000`:**
  Kiểm tra xem cửa sổ Terminal chạy Backend có đang hiển thị lỗi gì không, hoặc đảm bảo bạn đã chạy uvicorn trước khi nhấn thao tác trên Frontend.
  
* **Lỗi `ModuleNotFoundError` trên Backend:**
  Đảm bảo bạn đã kích hoạt môi trường ảo (venv) trước khi cài đặt và khởi chạy backend. Nếu venv bị lỗi, hãy xóa thư mục `venv/` đi và tạo lại từ đầu.

---

Chúc bạn có những trải nghiệm tuyệt vời cùng **Hyperion TestForge**! Nếu bạn cần thêm bất kỳ sự trợ giúp nào, vui lòng để lại câu hỏi trong phần thảo luận dự án. 🚀
