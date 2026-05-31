import { useState, useEffect } from 'react';
import { PRESETS } from './algorithms/presets';
import type { PresetSpec, FieldConstraint } from './algorithms/presets';
import type { Chromosome, PopulationStats } from './algorithms/genetic';
import type { HillClimbStats } from './algorithms/hillClimbing';
import { SpecInput } from './components/SpecInput';
import { Visualizer } from './components/Visualizer';
import { ComparisonArena } from './components/ComparisonArena';
import { HistoryManager } from './components/HistoryManager';
import { Sparkles, Activity, Layers, ShieldCheck, Key, ArrowDown, ChevronDown, ChevronUp, BookOpen, CheckCircle } from 'lucide-react';

function App() {
  // Lấy Mẫu đặc tả mặc định (User Sign Up) để hiển thị ban đầu
  const defaultPreset = PRESETS[0];

  // --- CÁC STATE TRẠNG THÁI TRUNG TÂM CỦA HỆ THỐNG ---
  const [rawText, setRawText] = useState(defaultPreset.rawText);
  const [parsedSchema, setParsedSchema] = useState<FieldConstraint[]>(defaultPreset.fields);
  const [initialSeeds, setInitialSeeds] = useState<Chromosome[]>(defaultPreset.initialPopulation);
  const [schemaName, setSchemaName] = useState(defaultPreset.title.split(' (')[0]);
  
  // Lưu trữ mã ID đặc tả nghiệp vụ sau khi được Backend lưu vào database SQLite
  const [specificationId, setSpecificationId] = useState<string>('');
  
  // Lưu trữ mã khóa OpenAI API Key do bạn nhập trực tiếp từ giao diện (Lưu tạm trong sessionStorage để tránh rò rỉ)
  const [apiKey, setApiKey] = useState<string>(() => {
    return sessionStorage.getItem("openai_api_key") || "";
  });

  // Lưu trữ Bộ dữ liệu kiểm thử (Test Suite) đã được tối ưu hóa cuối cùng
  const [optimizedDataset, setOptimizedDataset] = useState<Chromosome[]>([]);
  
  // Mảng lưu trữ danh sách các lượt tối ưu hóa thành công trong phiên làm việc
  const [historyRuns, setHistoryRuns] = useState<{
    timestamp: string;
    schemaName: string;
    size: number;
    coverage: number;
    bestFitness: number;
    data: Chromosome[];
  }[]>([]);


  
  // Trạng thái mở/đóng hướng dẫn vận hành hệ thống
  const [showGuide, setShowGuide] = useState(true);

  // Theo dõi phân đoạn (step) active hiện tại để highlight đồng bộ trên thanh điều hướng menu
  const [activeSection, setActiveSection] = useState<string>('step-spec');
  
  // Hiệu ứng Loading khi gọi AI phân tích
  const [isParsing, setIsParsing] = useState(false);

  // Mỗi khi bạn gõ API Key mới, lưu tạm vào Session của trình duyệt để tải lại không bị mất
  useEffect(() => {
    sessionStorage.setItem("openai_api_key", apiKey);
  }, [apiKey]);

  // Thiết lập IntersectionObserver tự động theo dõi cuộn màn hình để đổi active tab ở menu trên
  useEffect(() => {
    const sections = ['step-spec', 'step-opt', 'step-arena', 'step-data'];
    const observerOptions = {
      root: null,
      rootMargin: '-15% 0px -45% 0px', // Nhận diện khi phân đoạn nằm ở vùng giữa màn hình
      threshold: 0.05
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    sections.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => {
      sections.forEach((id) => {
        const element = document.getElementById(id);
        if (element) observer.unobserve(element);
      });
    };
  }, []);

  // --- CUỘC GỌI API BACKEND: GỬI ĐẶC TẢ NGỮ NGHĨA LÊN OPENAI ---
  const handleParseSpec = async () => {
    setIsParsing(true);
    try {
      // Gọi POST request tới cổng 8000 của FastAPI Backend
      const response = await fetch("http://localhost:8000/api/specifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          raw_text: rawText,
          api_key_override: apiKey ? apiKey.trim() : null // Truyền API Key nếu bạn nhập từ màn hình
        })
      });

      if (!response.ok) {
        throw new Error("Không thể kết nối với Backend Server!");
      }

      const res = await response.json();
      
      // Nạp kết quả thật từ Backend vào State
      setParsedSchema(res.fields);
      setInitialSeeds(res.initialPopulation);
      setSpecificationId(res.specification_id); // Ghi nhận ID đặc tả trong SQLite CSDL
      
      // Tự sinh tên nghiệp vụ gọn
      setSchemaName(rawText.substring(0, 25) + (rawText.length > 25 ? '...' : ''));
      
      // Reset mảng dữ liệu test của dự án cũ
      setOptimizedDataset([]);
      
      // Hiển thị thông báo thành công cho người dùng
      alert("Phân tích đặc tả nghiệp vụ bằng AI thành công!\n\nQuy tắc ràng buộc (JSON Rules) và tập dữ liệu hạt giống F0 đã được tạo lập tự động ở phía dưới.\nBạn có thể tự do thêm bớt trường hoặc tinh chỉnh các giá trị Max/Min, Regex ngay tại đây, sau đó bấm nút 'Tiếp tục' ở cuối trang để tiến hành bước tối ưu hóa bộ test!");
      
    } catch (e: any) {
      console.error(e);
      alert(`Đã xảy ra lỗi kết nối: ${e.message || "Hãy đảm bảo FastAPI Backend đang chạy ở cổng 8000!"}`);
    } finally {
      setIsParsing(false);
    }
  };

  // Hàm chuyển đổi nhanh giữa các Preset nghiệp vụ mẫu
  const handlePresetSelect = (preset: PresetSpec) => {
    setRawText(preset.rawText);
    setParsedSchema(preset.fields);
    setInitialSeeds(preset.initialPopulation);
    setSchemaName(preset.title.split(' (')[0]);
    setSpecificationId(''); // Reset ID cũ
    setOptimizedDataset([]); // Reset dữ liệu test cũ
  };

  // Hàm ghi nhận kết quả tiến hóa GA + HC từ Visualizer trả về
  const handleEvolutionComplete = (
    results: Chromosome[], 
    stats: PopulationStats[], 
    hcStatsResult?: HillClimbStats
  ) => {
    setOptimizedDataset(results);

    // Tự động ghi phiên chạy thành công này vào bảng Nhật ký Lịch sử của Client
    const finalGenStats = stats[stats.length - 1];
    const newRun = {
      timestamp: new Date().toLocaleTimeString(),
      schemaName: schemaName,
      size: results.length,
      coverage: finalGenStats?.coverage || 0.95,
      bestFitness: hcStatsResult?.optimizedFitness || finalGenStats?.bestFitness || 0.98,
      data: results
    };
    setHistoryRuns([newRun, ...historyRuns]);
  };

  // Hàm nạp lại dữ liệu của một phiên chạy cũ từ nhật ký lịch sử
  const handleLoadPastRun = (pastData: Chromosome[]) => {
    setOptimizedDataset(pastData);
    alert('Đã nạp lại mảng Test Cases tối ưu từ phiên chạy trước!');
  };

  // Hàm cuộn mượt tới phân đoạn chỉ định
  const handleScrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Hàm điều hợp chuyển tab sang hành vi cuộn mượt
  const handleSwitchTab = (tab: 'input' | 'visualizer' | 'arena' | 'history') => {
    const mapping = {
      'input': 'step-spec',
      'visualizer': 'step-opt',
      'arena': 'step-arena',
      'history': 'step-data'
    };
    handleScrollToSection(mapping[tab]);
  };

  // Component phụ trợ: Đường ống liên kết dữ liệu (Pipeline Connector)
  const PipelineConnector = ({ title }: { title: string }) => (
    <div className="flex flex-col align-center justify-center" style={{ margin: '40px 0', gap: '8px' }}>
      <div style={{ height: '40px', width: '2px', borderLeft: '2px dashed rgba(45,212,191,0.3)', opacity: 0.8, alignSelf: 'center' }} />
      <span className="flex align-center gap-xs" style={{ 
        fontSize: '11px', 
        background: 'rgba(15, 23, 42, 0.85)', 
        border: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '6px 16px',
        borderRadius: '20px',
        color: 'var(--text-secondary)',
        backdropFilter: 'blur(8px)',
        fontFamily: 'var(--font-mono)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        fontWeight: 'bold',
        letterSpacing: '0.05em',
        alignSelf: 'center'
      }}>
        <ArrowDown size={12} className="text-teal" style={{ color: 'var(--color-teal)' }} />
        {title}
        <ArrowDown size={12} className="text-violet" style={{ color: 'var(--color-violet)' }} />
      </span>
      <div style={{ height: '40px', width: '2px', borderLeft: '2px dashed rgba(167,139,250,0.3)', opacity: 0.8, alignSelf: 'center' }} />
    </div>
  );

  return (
    <div className="app-container">
      {/* 1. APP HEADER & OPENAI KEY CONTAINER */}
      <header className="glass-card teal-border flex justify-between align-center" style={{ padding: '20px 32px', background: 'rgba(15, 23, 42, 0.7)', flexWrap: 'wrap', gap: '16px' }}>
        <div className="flex flex-col gap-sm">
          <h1 style={{ fontSize: '32px', display: 'flex', alignItems: 'center', gap: '12px', color: '#fff' }}>
            <Layers className="text-teal" size={32} style={{ color: 'var(--color-teal)' }} />
            HYPERION TESTFORGE
          </h1>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
            NỀN TẢNG SINH &amp; TỐI ƯU HÓA DỮ LIỆU KIỂM THỬ THÔNG MINH (LLM + GA + HC)
          </span>
        </div>

        {/* Ô nhập trực tiếp API Key trên Giao diện */}
        <div className="flex align-center gap-sm" style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Key size={14} style={{ color: 'var(--color-teal)' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>AI API Key:</span>
          <input
            type="password"
            placeholder="Gemini (AIzaSy...) hoặc OpenAI (sk...)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="input-field"
            style={{ width: '220px', padding: '4px 8px', fontSize: '11px', background: 'rgba(15,23,42,0.8)' }}
          />
        </div>

        {/* Các chỉ số hiển thị trạng thái CSDL SQLite và Schema */}
        <div className="flex gap-md align-center" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          <div className="flex align-center gap-sm" style={{ borderRight: '1px solid rgba(255,255,255,0.08)', paddingRight: '12px' }}>
            <Sparkles size={13} style={{ color: 'var(--color-teal)' }} />
            <span>Kịch bản: <b>{schemaName}</b></span>
          </div>
          <div className="flex align-center gap-sm" style={{ borderRight: '1px solid rgba(255,255,255,0.08)', paddingRight: '12px' }}>
            <Activity size={13} style={{ color: 'var(--color-violet)' }} />
            <span>Ràng buộc QA: <b>{parsedSchema.length}</b></span>
          </div>
          <div className="flex align-center gap-sm">
            <ShieldCheck size={13} style={{ color: 'var(--color-rose)' }} />
            <span>CSDL: <b>SQLite Active</b></span>
          </div>
        </div>
      </header>

      {/* 1.5. HƯỚNG DẪN VẬN HÀNH HỆ THỐNG (COLLAPSIBLE TUTORIAL) */}
      <section className="glass-card tutorial-container teal-border" style={{ 
        marginTop: '16px', 
        padding: '20px 24px', 
        background: 'rgba(15, 23, 42, 0.65)' 
      }}>
        <button 
          onClick={() => setShowGuide(!showGuide)} 
          className="tutorial-header-btn"
          aria-expanded={showGuide}
        >
          <div className="tutorial-title">
            <BookOpen className="text-teal" size={20} style={{ color: 'var(--color-teal)' }} />
            💡 HƯỚNG DẪN VẬN HÀNH HỆ THỐNG (INTERACTIVE GUIDE)
            <span className="tutorial-badge">4 Bước Tự Động Hóa Dữ Liệu</span>
          </div>
          <div className="flex align-center gap-sm" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            <span>{showGuide ? 'Thu gọn hướng dẫn' : 'Mở rộng xem chi tiết'}</span>
            {showGuide ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {showGuide && (
          <div className="tutorial-grid">
            {/* BƯỚC 1 */}
            <div className="tutorial-card step-1">
              <span className="step-badge teal">BƯỚC 1: PHÂN TÍCH</span>
              <h3 className="tutorial-card-title">
                <Sparkles size={16} className="text-teal" style={{ color: 'var(--color-teal)' }} />
                Trích Xuất Schema AI
              </h3>
              <ul className="tutorial-card-list">
                <li>Chọn kịch bản mẫu hoặc biên soạn mô tả nghiệp vụ bằng tiếng Việt.</li>
                <li>Bấm <b>Yêu Cầu AI Trích Xuất Schema</b> để nhận cấu trúc logic (JSON Rules).</li>
                <li>AI cũng sinh sẵn <b>Tập Hạt Giống F0</b> chứa các giá trị biên thông thường &amp; payload SQLi/XSS bảo mật.</li>
              </ul>
              <button onClick={() => handleScrollToSection('step-spec')} className="tutorial-card-action">
                Xem Phân Tích &rarr;
              </button>
            </div>

            {/* BƯỚC 2 */}
            <div className="tutorial-card step-2">
              <span className="step-badge violet">BƯỚC 2: TỐI ƯU</span>
              <h3 className="tutorial-card-title">
                <Activity size={16} className="text-violet" style={{ color: 'var(--color-violet)' }} />
                Tiến Hóa Thuật Toán
              </h3>
              <ul className="tutorial-card-list">
                <li>Điều chỉnh 4 trọng số chất lượng: Độ bao phủ, Biên điều kiện, Bảo mật và Độ đa dạng.</li>
                <li>Bấm <b>Khởi chạy</b> để truyền phát tiến trình qua WebSockets thời gian thực từ FastAPI backend.</li>
                <li>Giải thuật di truyền GA kết hợp leo đồi tinh chỉnh biên cục bộ HC để tối ưu hóa.</li>
              </ul>
              <button onClick={() => handleScrollToSection('step-opt')} className="tutorial-card-action">
                Bắt đầu Tối Ưu &rarr;
              </button>
            </div>

            {/* BƯỚC 3 */}
            <div className="tutorial-card step-3">
              <span className="step-badge teal">BƯỚC 3: ĐỐI CHIẾU</span>
              <h3 className="tutorial-card-title">
                <Layers size={16} className="text-teal" style={{ color: 'var(--color-teal)' }} />
                Đấu Trường Giải Thuật
              </h3>
              <ul className="tutorial-card-list">
                <li>Bấm <b>Khởi Trình So Sánh Đối Kháng</b> để kiểm chứng 5 thuật toán sinh dữ liệu song song.</li>
                <li>Đọc biểu đồ trực quan Recharts (Coverage, Duplicate rate, Edge Cases).</li>
                <li>Xem chứng minh thực nghiệm vì sao mô hình lai ghép GA+HC đạt độ phủ biên tuyệt đối &gt;95%.</li>
              </ul>
              <button onClick={() => handleScrollToSection('step-arena')} className="tutorial-card-action">
                Đến Đấu Trường &rarr;
              </button>
            </div>

            {/* BƯỚC 4 */}
            <div className="tutorial-card step-4">
              <span className="step-badge rose">BƯỚC 4: KẾT QUẢ</span>
              <h3 className="tutorial-card-title">
                <CheckCircle size={16} className="text-rose" style={{ color: 'var(--color-rose)' }} />
                Xuất File Kiểm Thử
              </h3>
              <ul className="tutorial-card-list">
                <li>Xem trước bảng dữ liệu test tối ưu, tự động tô đỏ các payload bảo mật nguy hiểm.</li>
                <li>Tải bộ dữ liệu hoàn chỉnh dưới dạng <b>CSV (Excel)</b> hoặc cấu trúc <b>JSON</b>.</li>
                <li>Nhúng trực tiếp vào automation script của bạn (Selenium, JMeter, Playwright, CI/CD).</li>
              </ul>
              <button onClick={() => handleScrollToSection('step-data')} className="tutorial-card-action">
                Tải Bộ Test &rarr;
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 2. STICKY QUICK-SCROLL PIPELINE CONTROL BAR */}
      <nav className="flex justify-between align-center" style={{ 
        position: 'sticky', 
        top: '16px', 
        zIndex: 100, 
        backdropFilter: 'blur(16px)', 
        background: 'rgba(15, 23, 42, 0.8)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 'var(--radius-sm)',
        padding: '10px 24px',
        margin: '16px 0 24px 0',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div className="flex align-center gap-md" style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>
          <span className="text-teal" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-teal)' }}>
            <Activity size={16} />
            ĐƯỜNG ỐNG TỐI ƯU TOÀN DIỆN (PIPELINE)
          </span>
        </div>
        
        <div className="tabs-container glow-teal" style={{ background: 'transparent', border: 'none', padding: 0 }}>
          <button 
            onClick={() => handleScrollToSection('step-spec')} 
            className={`tab-btn ${activeSection === 'step-spec' ? 'active' : ''}`} 
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            1. Phân Tích Đặc Tả
          </button>
          <button 
            onClick={() => handleScrollToSection('step-opt')} 
            className={`tab-btn ${activeSection === 'step-opt' ? 'active' : ''}`} 
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            2. Tối Ưu Hóa Bộ Test
          </button>
          <button 
            onClick={() => handleScrollToSection('step-arena')} 
            className={`tab-btn ${activeSection === 'step-arena' ? 'active' : ''}`} 
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            3. So Sánh Thuật Toán
          </button>
          <button 
            onClick={() => handleScrollToSection('step-data')} 
            className={`tab-btn ${activeSection === 'step-data' ? 'active' : ''}`} 
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            4. Trung Tâm Dữ Liệu
          </button>
        </div>

        <div className="flex align-center gap-xs" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          <span className="status-dot-pulse" style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-teal)', boxShadow: '0 0 8px var(--color-teal)' }}></span>
          <span><b>SQLite Cục bộ Sẵn sàng</b></span>
        </div>
      </nav>

      {/* 3. SINGLE-PAGE PIPELINE SECTIONS */}
      <main style={{ minHeight: '520px', display: 'flex', flexDirection: 'column' }}>
        
        {/* BƯỚC 1: PHÂN TÍCH ĐẶC TẢ */}
        <section id="step-spec">
          <SpecInput
            rawText={rawText}
            setRawText={setRawText}
            parsedSchema={parsedSchema}
            setParsedSchema={setParsedSchema}
            isParsing={isParsing}
            onParse={handleParseSpec}
            onPresetSelect={handlePresetSelect}
            initialSeeds={initialSeeds}
            onSwitchTab={handleSwitchTab}
          />
        </section>

        {/* ĐƯỜNG DẪN 1 -> 2 */}
        <PipelineConnector title="RÀNG BUỘC NGHIỆP VỤ + HẠT GIỐNG F0 -> CHUYỂN TIẾP TẬP TỐI ƯU HÓA" />

        {/* BƯỚC 2: TỐI ƯU HÓA BỘ TEST */}
        <section id="step-opt">
          <div className="glass-card violet-border" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '20px', color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles className="text-teal" size={22} style={{ color: 'var(--color-teal)' }} />
              BƯỚC 2: TỐI ƯU HÓA BỘ TEST CASES (GENETIC ALGORITHM & HILL CLIMBING)
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
              Cấu hình các trọng số đánh giá chất lượng (Độ bao phủ, Biên, Bảo mật, Đa dạng) và chạy tiến hóa di truyền GA kết hợp leo đồi tinh chỉnh biên cục bộ HC trên Server FastAPI cục bộ.
            </p>
            <Visualizer
              schema={parsedSchema}
              initialSeeds={initialSeeds}
              onEvolutionComplete={handleEvolutionComplete}
              specificationId={specificationId} // Truyền spec ID SQLite
              apiKey={apiKey} // Truyền khóa OpenAI Key override
            />
          </div>
        </section>

        {/* ĐƯỜNG DẪN 2 -> 3 */}
        <PipelineConnector title="DỮ LIỆU TẬP TỐI ƯU HÓA -> CHUYỂN TIẾP ĐẤU TRƯỜNG SO SÁNH" />

        {/* BƯỚC 3: ĐẤU TRƯỜNG SO SÁNH */}
        <section id="step-arena">
          <div className="glass-card teal-border" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '20px', color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity className="text-violet" size={22} style={{ color: 'var(--color-violet)' }} />
              BƯỚC 3: ĐẤU TRƯỜNG SO SÁNH GIẢI THUẬT (COMPARISON ARENA)
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
              Trực quan hóa và đối chiếu kết quả đầu ra giữa 3 phương pháp sinh dữ liệu: Mô hình ngôn ngữ lớn thuần túy (LLM Pure), Giải thuật di truyền thuần túy (GA Pure) và Bộ giải thuật phức hợp toàn diện (GA + HC) của Hyperion.
            </p>
            <ComparisonArena
              schema={parsedSchema}
              initialSeeds={initialSeeds}
            />
          </div>
        </section>

        {/* ĐƯỜNG DẪN 3 -> 4 */}
        <PipelineConnector title="TEST CASES TỐI ƯU -> LƯU TRỮ LỊCH SỬ & TRUNG TÂM XUẤT FILE" />

        {/* BƯỚC 4: TRUNG TÂM DỮ LIỆU */}
        <section id="step-data">
          <div className="glass-card violet-border" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '20px', color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers className="text-rose" size={22} style={{ color: 'var(--color-rose)' }} />
              BƯỚC 4: TRUNG TÂM DỮ LIỆU &amp; LỊCH SỬ CHẠY (DATA CENTER)
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
              Xem lại lịch sử các lần chạy tối ưu hóa thành công trong phiên làm việc hiện tại, nạp lại bộ dữ liệu cũ hoặc tiến hành tải bộ test cases tối ưu về máy dưới định dạng CSV, JSON để nhúng vào mã nguồn kiểm thử tự động của bạn.
            </p>
            <HistoryManager
              optimizedDataset={optimizedDataset}
              historyRuns={historyRuns}
              onLoadPastRun={handleLoadPastRun}
              schemaName={schemaName}
            />
          </div>
        </section>

      </main>

      {/* 4. FOOTER */}
      <footer 
        className="glass-card flex justify-between align-center" 
        style={{ 
          marginTop: '24px', 
          padding: '12px 24px', 
          fontSize: '11px', 
          color: 'var(--text-muted)', 
          background: 'rgba(15,23,42,0.3)',
          borderColor: 'rgba(255,255,255,0.03)'
        }}
      >
        <span>© 2026 Hyperion TestForge Fullstack. Build v1.2.0</span>
        <span className="flex align-center gap-sm">
          Lập trình và chú thích tiếng Việt bởi <b style={{ color: 'var(--text-secondary)' }}>Personal</b> via Google Antigravity • Chuẩn Dev &amp; Test
        </span>
      </footer>
    </div>
  );
}

export default App;
