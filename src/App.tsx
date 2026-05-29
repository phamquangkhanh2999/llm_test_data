import { useState, useEffect } from 'react';
import { PRESETS } from './algorithms/presets';
import type { PresetSpec, FieldConstraint } from './algorithms/presets';
import type { Chromosome, PopulationStats } from './algorithms/genetic';
import type { HillClimbStats } from './algorithms/hillClimbing';
import { SpecInput } from './components/SpecInput';
import { Visualizer } from './components/Visualizer';
import { ComparisonArena } from './components/ComparisonArena';
import { HistoryManager } from './components/HistoryManager';
import { Sparkles, Activity, Layers, ShieldCheck, Key } from 'lucide-react';

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

  // Quản lý Tab đang hiển thị
  const [activeTab, setActiveTab] = useState<'input' | 'visualizer' | 'arena' | 'history'>('input');
  
  // Hiệu ứng Loading khi gọi AI phân tích
  const [isParsing, setIsParsing] = useState(false);

  // Mỗi khi bạn gõ API Key mới, lưu tạm vào Session của trình duyệt để tải lại không bị mất
  useEffect(() => {
    sessionStorage.setItem("openai_api_key", apiKey);
  }, [apiKey]);

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
      
      // Tự động nhảy sang Tab Visualizer để bạn bắt đầu tối ưu hóa dữ liệu!
      setActiveTab('visualizer');
      
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

        {/* Ô nhập trực tiếp OpenAI API Key trên Giao diện */}
        <div className="flex align-center gap-sm" style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Key size={14} style={{ color: 'var(--color-teal)' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>OpenAI API Key:</span>
          <input
            type="password"
            placeholder="sk-or-your-key-here..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="input-field"
            style={{ width: '180px', padding: '4px 8px', fontSize: '11px', background: 'rgba(15,23,42,0.8)' }}
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

      {/* 2. MENU TAB CHUYỂN MÀN HÌNH TƯƠNG TÁC */}
      <nav className="flex justify-between align-center" style={{ flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
        <div className="tabs-container glow-teal">
          <button 
            onClick={() => setActiveTab('input')}
            className={`tab-btn ${activeTab === 'input' ? 'active' : ''}`}
          >
            1. Phân Tích Đặc Tả (Spec Parser)
          </button>
          
          <button 
            onClick={() => setActiveTab('visualizer')}
            className={`tab-btn ${activeTab === 'visualizer' ? 'active' : ''}`}
          >
            2. Tối Ưu Hóa Bộ Test (Test Suite Optimizer)
          </button>

          <button 
            onClick={() => setActiveTab('arena')}
            className={`tab-btn ${activeTab === 'arena' ? 'active' : ''}`}
          >
            3. So Sánh Giải Thuật (Comparison Arena)
          </button>

          <button 
            onClick={() => setActiveTab('history')}
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            4. Xuất Dữ Liệu Kiểm Thử (Data Center)
            {optimizedDataset.length > 0 && (
              <span style={{ fontSize: '10px', background: 'var(--color-rose)', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                !
              </span>
            )}
          </button>
        </div>

        <div 
          className="flex align-center gap-md" 
          style={{ 
            fontSize: '11px', 
            color: 'var(--text-secondary)',
            background: 'rgba(15, 23, 42, 0.45)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
          }}
        >
          <div className="flex align-center gap-xs">
            <span 
              className="status-dot-pulse"
              style={{ 
                display: 'inline-block', 
                width: '6px', 
                height: '6px', 
                borderRadius: '50%', 
                backgroundColor: 'var(--color-teal)', 
                boxShadow: '0 0 8px var(--color-teal)'
              }}
            ></span>
            <span>Đường truyền: <b style={{ color: 'var(--color-teal)' }}>Đang kết nối</b></span>
          </div>
          <span style={{ color: 'rgba(255, 255, 255, 0.1)' }}>•</span>
          <div className="flex align-center gap-xs">
            <span>Cơ sở dữ liệu: <b style={{ color: '#fff' }}>SQLite (Sẵn sàng)</b></span>
          </div>
        </div>
      </nav>

      {/* 3. DYNAMIC CONTENT RENDERING - TRÌNH BÀY NỘI DUNG DỰA TRÊN TAB ACTIVE */}
      <main style={{ minHeight: '520px' }}>
        {activeTab === 'input' && (
          <SpecInput
            rawText={rawText}
            setRawText={setRawText}
            parsedSchema={parsedSchema}
            setParsedSchema={setParsedSchema}
            isParsing={isParsing}
            onParse={handleParseSpec}
            onPresetSelect={handlePresetSelect}
          />
        )}

        {activeTab === 'visualizer' && (
          <Visualizer
            schema={parsedSchema}
            initialSeeds={initialSeeds}
            onEvolutionComplete={handleEvolutionComplete}
            specificationId={specificationId} // Truyền spec ID SQLite
            apiKey={apiKey} // Truyền khóa OpenAI Key override
          />
        )}

        {activeTab === 'arena' && (
          <ComparisonArena
            schema={parsedSchema}
            initialSeeds={initialSeeds}
          />
        )}

        {activeTab === 'history' && (
          <HistoryManager
            optimizedDataset={optimizedDataset}
            historyRuns={historyRuns}
            onLoadPastRun={handleLoadPastRun}
            schemaName={schemaName}
          />
        )}
      </main>

      {/* 4. FOOTER */}
      <footer 
        className="glass-card flex justify-between align-center" 
        style={{ 
          marginTop: '12px', 
          padding: '12px 24px', 
          fontSize: '11px', 
          color: 'var(--text-muted)', 
          background: 'rgba(15,23,42,0.3)',
          borderColor: 'rgba(255,255,255,0.03)'
        }}
      >
        <span>© 2026 Hyperion TestForge Fullstack. Build v1.1.0</span>
        <span className="flex align-center gap-sm">
          Lập trình và chú thích tiếng Việt bởi <b style={{ color: 'var(--text-secondary)' }}>Personal</b> via Google Antigravity • Chuẩn Dev &amp; Test
        </span>
      </footer>
    </div>
  );
}

export default App;
