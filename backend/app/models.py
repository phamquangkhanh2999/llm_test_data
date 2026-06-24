import uuid
from sqlalchemy import Column, String, Integer, Float, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .core.database import Base

# Hàm helper tự sinh chuỗi UUID ngẫu nhiên làm Khóa chính (Primary Key) cho các bảng
def generate_uuid():
    return str(uuid.uuid4())

class Project(Base):
    """
    Bảng PROJECTS: Quản lý các Dự án kiểm thử.
    Một Dự án có thể chứa nhiều lượt viết Đặc tả nghiệp vụ khác nhau.
    """
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False) # Tên dự án (Ví dụ: "Cổng thanh toán thẻ")
    description = Column(String(255), nullable=True) # Mô tả sơ lược
    created_at = Column(DateTime, default=datetime.utcnow) # Thời gian khởi tạo

    # Thiết lập mối quan hệ 1 - Nhiều (1 Project chứa nhiều Specifications)
    specifications = relationship("Specification", back_populates="project", cascade="all, delete-orphan")


class Specification(Base):
    """
    Bảng SPECIFICATIONS: Lưu trữ các mô tả đặc tả nghiệp vụ dạng thô
    và cấu trúc quy tắc (JSON Schema) sau khi được OpenAI API trích xuất.
    """
    __tablename__ = "specifications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False)
    raw_text = Column(String(2000), nullable=False) # Văn bản mô tả nghiệp vụ bằng chữ thường
    extracted_rules = Column(Text, nullable=True) # Lưu trữ các Business Rules sau khi được chuẩn hóa ID
    extracted_constraints = Column(Text, nullable=True) # Lưu trữ các ràng buộc logic chéo (Cross-field constraints)
    parsed_schema = Column(Text, nullable=False) # Cấu trúc JSON Schema dạng text (dùng Text thay vì String để tránh truncate)
    initial_seeds = Column(Text, nullable=True) # Dữ liệu hạt giống F0 ban đầu
    created_at = Column(DateTime, default=datetime.utcnow)

    # Mối quan hệ ngược về Project
    project = relationship("Project", back_populates="specifications")
    # Mối quan hệ 1 - Nhiều (1 Specification có thể chạy nhiều lượt tiến hóa Jobs)
    jobs = relationship("Job", back_populates="specification", cascade="all, delete-orphan")


class Job(Base):
    """
    Bảng JOBS: Ghi lại từng phiên chạy tối ưu hóa dữ liệu.
    Nó lưu lại kết quả đánh giá cuối cùng về độ phủ và tỉ lệ trùng lặp.
    """
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    specification_id = Column(String(36), ForeignKey("specifications.id"), nullable=False)
    status = Column(String(20), default="PENDING") # PENDING | RUNNING | COMPLETE | FAILED
    algorithm_config = Column(Text, nullable=True) # Tham số cấu hình GA/HC dưới dạng chuỗi JSON
    final_coverage = Column(Float, default=0.0) # Độ bao phủ cuối cùng đạt được (%)
    final_duplicate_rate = Column(Float, default=0.0) # Tỉ lệ trùng lặp cuối cùng (%)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Mối quan hệ ngược về Specification
    specification = relationship("Specification", back_populates="jobs")
    # Mối quan hệ 1 - Nhiều (1 Job sinh ra nhiều dòng dữ liệu Test Cases)
    test_cases = relationship("GeneratedData", back_populates="job", cascade="all, delete-orphan")
    # Mối quan hệ 1 - Nhiều (1 Job lưu vết nhiều thế hệ tiến hóa)
    evolution_history = relationship("EvolutionStats", back_populates="job", cascade="all, delete-orphan")


class GeneratedData(Base):
    """
    Bảng GENERATED_DATA: Lưu trữ các Test Cases cụ thể đã được tối ưu hóa.
    Mỗi dòng chứa dữ liệu dạng JSON đại diện cho các giá trị test thực tế.
    """
    __tablename__ = "generated_data"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("jobs.id"), nullable=False)
    parent_id = Column(String(36), nullable=True) # Lưu vết phả hệ để tạo Bảng Đối Chiếu Tiến Hóa
    
    # payload giá trị test (Ví dụ: '{"username": "admin", "password": "Pass123!"}')
    # Lưu dưới dạng String, Client sẽ tự parse thành JSON object khi hiển thị
    test_case_values = Column(Text, nullable=False) 
    
    fitness_score = Column(Float, nullable=False) # Điểm số chất lượng Test Case của hàm đánh giá
    source_algorithm = Column(String(30), nullable=False) # Nguồn gốc: "RANDOM" | "LLM" | "GA" | "HC"
    is_edge_case = Column(Boolean, default=False) # Đánh dấu xem có phải ca kiểm thử biên/mã độc không

    # Mối quan hệ ngược về Job
    job = relationship("Job", back_populates="test_cases")


class EvolutionStats(Base):
    """
    Bảng EVOLUTION_STATS: Lưu vết tiến hóa qua từng thế hệ.
    Mỗi dòng ghi lại số liệu của một thế hệ trong một phiên chạy GA.
    Dùng để vẽ biểu đồ tiến trình và phân tích hiệu quả thuật toán.
    """
    __tablename__ = "evolution_stats"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    job_id = Column(String(36), ForeignKey("jobs.id"), nullable=False)
    generation = Column(Integer, nullable=False)
    max_fitness = Column(Float, default=0.0)
    avg_fitness = Column(Float, default=0.0)
    coverage_score = Column(Float, default=0.0)
    duplicate_rate = Column(Float, default=0.0)
    mutation_rate = Column(Float, nullable=True)  # adaptive mutation rate at this generation
    population_diversity = Column(Float, nullable=True)  # diversity metric
    recorded_at = Column(DateTime, default=datetime.utcnow)

    # Mối quan hệ ngược về Job
    job = relationship("Job", back_populates="evolution_history")


class AICallLog(Base):
    """
    Bảng AI_CALL_LOGS: Lưu nhật ký các cuộc gọi đến AI LLM (Gemini/OpenAI/Mock).
    """
    __tablename__ = "ai_call_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    timestamp = Column(DateTime, default=datetime.utcnow)
    endpoint = Column(String(100), nullable=False) # Endpoint gọi (e.g. "/api/specifications")
    provider = Column(String(50), nullable=False) # e.g. "Gemini", "OpenAI", "Mock"
    model = Column(String(50), nullable=False) # e.g. "gemini-2.5-flash", "gpt-3.5-turbo", "mock"
    input_summary = Column(Text, nullable=True) # Tóm tắt dữ liệu/prompt gửi đi
    output_summary = Column(Text, nullable=True) # Tóm tắt dữ liệu/JSON trả về
    token_count_estimate = Column(Integer, nullable=True) # Ước lượng tokens (chars / 4)
    status = Column(String(20), nullable=False) # "SUCCESS" hoặc "FAILED"
    error_message = Column(Text, nullable=True) # Chi tiết lỗi nếu status là FAILED

# --- NEW MODELS FOR TEST CASE LINEAGE & VISUALIZATION ---

class TestCase(Base):
    """Bảng lưu trữ tổng quan của 1 test case tối ưu"""
    __tablename__ = "test_cases"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    requirement_id = Column(String(36), nullable=True) # ID liên kết về spec (job/specification)
    scenario = Column(String(255), nullable=True)
    strategy = Column(String(50), nullable=True) # F0, GA, HC, Hybrid
    fitness_before = Column(Float, nullable=True)
    fitness_after = Column(Float, nullable=True)
    status = Column(String(50), nullable=True) # Optimized, No Change, Degraded, Failed
    created_at = Column(DateTime, default=datetime.utcnow)

    versions = relationship("TestCaseVersion", back_populates="test_case", cascade="all, delete-orphan")
    fitness_scores = relationship("FitnessScore", back_populates="test_case", cascade="all, delete-orphan")


class TestCaseVersion(Base):
    """Các phiên bản (F0, GA, HC) của 1 test case"""
    __tablename__ = "test_case_versions"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    test_case_id = Column(String(36), ForeignKey("test_cases.id"), nullable=False)
    stage = Column(String(20), nullable=False) # F0, GA, HC
    input_json = Column(Text, nullable=False) # Data fields json
    fitness_score = Column(Float, nullable=True)
    generation = Column(Integer, nullable=True)

    test_case = relationship("TestCase", back_populates="versions")
    changes = relationship("TestCaseChange", back_populates="version", cascade="all, delete-orphan")


class TestCaseChange(Base):
    """Theo dõi thay đổi chi tiết từng trường dữ liệu"""
    __tablename__ = "test_case_changes"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    version_id = Column(String(36), ForeignKey("test_case_versions.id"), nullable=False)
    field = Column(String(100), nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    version = relationship("TestCaseVersion", back_populates="changes")


class FitnessScore(Base):
    """Điểm số đánh giá chi tiết (Rubric) cho test case"""
    __tablename__ = "fitness_scores"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    test_case_id = Column(String(36), ForeignKey("test_cases.id"), nullable=False)
    happy_path = Column(Float, nullable=True)
    boundary = Column(Float, nullable=True)
    validation = Column(Float, nullable=True)
    security = Column(Float, nullable=True)
    diversity = Column(Float, nullable=True)
    total_score = Column(Float, nullable=True)

    test_case = relationship("TestCase", back_populates="fitness_scores")


class Lineage(Base):
    """Bảng theo dõi phả hệ (mối quan hệ cha-con) qua từng thao tác"""
    __tablename__ = "lineage"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    child_id = Column(String(36), ForeignKey("test_case_versions.id"), nullable=False) # Version con
    parent_id = Column(String(36), ForeignKey("test_case_versions.id"), nullable=False) # Version cha
    operation = Column(String(50), nullable=True) # Mutation, HC Adjustment, Crossover...
    mutation_detail = Column(Text, nullable=True) # Chi tiết field nào thay đổi
    created_at = Column(DateTime, default=datetime.utcnow)

    child_version = relationship("TestCaseVersion", foreign_keys=[child_id])
    parent_version = relationship("TestCaseVersion", foreign_keys=[parent_id])

class GenerationHistory(Base):
    """
    Bảng GENERATION_HISTORY: Lưu trữ các bản snapshot của một lần tối ưu hóa.
    Lưu dưới dạng JSON text để dễ dàng khôi phục lại (Restore Session).
    """
    __tablename__ = "generation_history"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    spec_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    coverage_rate = Column(Float, default=0.0)
    total_cases = Column(Integer, default=0)
    
    step1_raw_text = Column(Text, nullable=True)
    step2_schema = Column(Text, nullable=True)
    step3_seeds = Column(Text, nullable=True)
    step4_optimized_data = Column(Text, nullable=True)
