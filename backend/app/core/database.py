import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Bước 1: Nạp các biến môi trường từ tệp tin .env cục bộ
load_dotenv()

# Bước 2: Đảm bảo DB luôn được lưu trong thư mục 'backend' thay vì thư mục hiện hành khi gọi uvicorn từ ngoài vào
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
db_path = os.path.join(BASE_DIR, "testforge.db")

# Lấy DATABASE_URL từ .env, nếu là đường dẫn tương đối mặc định thì ghi đè bằng đường dẫn tuyệt đối để tránh lỗi tạo sai thư mục
env_db_url = os.getenv("DATABASE_URL")
if not env_db_url or env_db_url == "sqlite:///./testforge.db":
    DATABASE_URL = f"sqlite:///{db_path}"
else:
    DATABASE_URL = env_db_url


# Bước 3: Khởi tạo Engine SQLAlchemy. 
# Tham số "connect_args={'check_same_thread': False}" là bắt buộc đối với SQLite 
# để cho phép nhiều tiến trình/luồng (threads) truy cập CSDL SQLite cùng một lúc mà không bị khóa.
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

# Bước 4: Tạo một lớp SessionLocal đại diện cho các phiên làm việc (transactions) của CSDL.
# Mỗi khi API tiếp nhận một request, một session sẽ được mở từ lớp SessionLocal này.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Bước 5: Tạo lớp Base cơ sở. Tất cả các Model (Bảng dữ liệu) sau này sẽ kế thừa từ lớp Base này
# để SQLAlchemy tự động hiểu cấu trúc và sinh bảng (migrations).
Base = declarative_base()

# Bước 6: Dependency Helper phục vụ API
# Hàm này sẽ được truyền vào các Endpoint của FastAPI để cung cấp kết nối CSDL cho từng Request.
# Sau khi Request hoàn tất, nó sẽ tự động đóng kết nối (Session.close()) ở khối "finally" để tránh rò rỉ bộ nhớ.
def get_db():
    db = SessionLocal()
    try:
        yield db  # Trả phiên kết nối về cho API sử dụng
    finally:
        db.close() # Đảm bảo luôn đóng kết nối CSDL sau khi xử lý xong Request
