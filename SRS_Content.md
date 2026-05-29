SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

Project: Intelligent Test Data Generation and Optimization Platform using LLM + Genetic Algorithm + Hill Climbing

1. GIỚI THIỆU
- Hệ thống sinh dữ liệu kiểm thử tự động bằng LLM kết hợp GA + HC.
- Mục tiêu:
  + Sinh test data tự động
  + Tối ưu coverage
  + Giảm duplicate
  + Sinh edge cases
  + Hỗ trợ automation testing

2. FLOW HỆ THỐNG
Functional Specification/Test Cases
        ↓
LLM Parsing
        ↓
Initial Test Data Generation
        ↓
Genetic Algorithm Optimization
        ↓
Hill Climbing Fine Tuning
        ↓
Optimized Test Dataset
        ↓
Export/API/Automation

3. FUNCTIONAL REQUIREMENTS
FR-01 Nhập đặc tả chức năng
FR-02 Sinh test data bằng LLM
FR-03 Tối ưu bằng GA
FR-04 Fine tuning bằng HC
FR-05 Visualization realtime
FR-06 Coverage analysis
FR-07 Export CSV/Excel/JSON
FR-08 API integration
FR-09 History management

4. NON-FUNCTIONAL REQUIREMENTS
- Response dưới 5 giây cho 100 records
- Responsive UI
- Realtime dashboard
- Logging & monitoring

5. INPUT SPECIFICATION
Ví dụ:
- Username required
- Password minimum 8 chars
- Email format validation

Test cases:
TC01 Empty username
TC02 Invalid password
TC03 SQL Injection

6. OUTPUT SPECIFICATION
| Username | Password | Expected | Fitness |
Coverage report:
- Validation coverage
- Boundary coverage
- Security coverage

7. GENETIC ALGORITHM DESIGN
Population Initialization:
- LLM sinh initial population
Chromosome:
(username, password, expected_result)
Fitness Function:
- Coverage score
- Boundary score
- Security score
- Diversity score
- Duplicate penalty
GA Flow:
Selection → Crossover → Mutation → Next Generation

8. HILL CLIMBING DESIGN
Mục tiêu:
- local optimization
- fine tuning
Ví dụ:
1234567
→ 12345678
→ 12345678@

9. THUẬT TOÁN SO SÁNH
Random:
- nhanh nhưng coverage thấp
LLM:
- thông minh nhưng chưa tối ưu
GA:
- global optimization
HC:
- local optimization
GA + HC:
- coverage cao nhất
- tối ưu tốt nhất

10. UI/UX REQUIREMENTS
Dashboard:
- Total test data
- Coverage
- Duplicate rate
- Fitness score
Visualization:
- generations
- mutation
- crossover
- fitness graph
Algorithm Comparison:
- Random
- LLM
- GA
- HC
- GA+HC

11. DATABASE DESIGN
Tables:
- projects
- specifications
- test_cases
- generated_test_data
- algorithm_results

12. API DESIGN
POST /api/specifications
POST /api/generate
POST /api/optimize/ga
POST /api/optimize/hc
GET /api/results
GET /api/export

13. SYSTEM ARCHITECTURE
Frontend:
- Next.js
- TailwindCSS
- Recharts
Backend:
- FastAPI
AI Layer:
- OpenAI API / Local LLM
Optimization:
- PyGAD
- DEAP
Database:
- PostgreSQL

14. RESEARCH EVALUATION
Metrics:
- Coverage %
- Duplicate reduction
- Execution time
- Edge case discovery
- Fitness improvement
Expected:
- Coverage > 90%
- Duplicate < 5%

15. FUTURE ENHANCEMENTS
- Reinforcement Learning
- Self-healing Testing
- Auto Selenium Script Generation
- API Security Testing
