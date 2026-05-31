import os
from pathlib import Path

# Resolve path tương đối so với vị trí của script này — chạy được trên mọi máy
SCRIPT_DIR = Path(__file__).resolve().parent

app_content = """import React from 'react';
import { SpecInput } from './components/SpecInput';
import { Visualizer } from './components/Visualizer';
import { ComparisonArena } from './components/ComparisonArena';
import { HistoryManager } from './components/HistoryManager';
import { DataImport } from './components/DataImport';
import { Sparkles, Activity, Layers, ShieldCheck, Key, ChevronDown, ChevronUp, BookOpen, CheckCircle, LayoutDashboard, Database, Download } from 'lucide-react';
import { useAppStore } from './store/useAppStore';

function App() {
  const {
    schemaName,
    parsedSchema,
    apiKey,
    setApiKey,
    showGuide,
    setShowGuide,
    activeScreen,
    setActiveScreen
  } = useAppStore();

  return (
    <div className="app-container" style={{ display: 'flex', minHeight: '100vh', padding: 0 }}>
      {/* SIDEBAR */}
      <aside style={{ 
        width: '280px', 
        background: 'rgba(15, 23, 42, 0.95)', 
        borderRight: '1px solid rgba(255,255,255,0.08)', 
        padding: '24px 0', 
        display: 'flex', 
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 1000
      }}>
        <div style={{ padding: '0 24px', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '22px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', margin: 0 }}>
            <Layers className="text-teal" size={28} style={{ color: 'var(--color-teal)' }} />
            TESTFORGE
          </h1>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', letterSpacing: '0.05em' }}>
            LLM + GA + HC OPTIMIZER
          </div>
        </div>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 12px' }}>
          {/* Dashboard */}
          <button 
            onClick={() => setActiveScreen('dashboard')} 
            className={`tab-btn ${activeScreen === 'dashboard' ? 'active' : ''}`}
            style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '12px 16px', fontSize: '14px', borderRadius: '8px', background: activeScreen === 'dashboard' ? 'rgba(45, 212, 191, 0.1)' : 'transparent', border: 'none', color: activeScreen === 'dashboard' ? 'var(--color-teal)' : 'var(--text-secondary)' }}
          >
            <LayoutDashboard size={18} /> Tổng Quan
          </button>
          
          <div style={{ padding: '24px 12px 8px 12px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Nguồn Dữ Liệu</div>
          
          <button 
            onClick={() => setActiveScreen('step-spec')} 
            className={`tab-btn ${activeScreen === 'step-spec' ? 'active' : ''}`}
            style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '12px 16px', fontSize: '14px', borderRadius: '8px', background: activeScreen === 'step-spec' ? 'rgba(59, 130, 246, 0.1)' : 'transparent', border: 'none', color: activeScreen === 'step-spec' ? '#3b82f6' : 'var(--text-secondary)' }}
          >
            <Sparkles size={18} /> Phân Tích Bằng AI
          </button>
          
          <button 
            onClick={() => setActiveScreen('data-import')} 
            className={`tab-btn ${activeScreen === 'data-import' ? 'active' : ''}`}
            style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '12px 16px', fontSize: '14px', borderRadius: '8px', background: activeScreen === 'data-import' ? 'rgba(250, 204, 21, 0.1)' : 'transparent', border: 'none', color: activeScreen === 'data-import' ? '#facc15' : 'var(--text-secondary)' }}
          >
            <Database size={18} /> Tải Lên Dữ Liệu
          </button>
          
          <div style={{ padding: '24px 12px 8px 12px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Thực Thi & Phân Tích</div>
          
          <button 
            onClick={() => setActiveScreen('optimizer')} 
            className={`tab-btn ${activeScreen === 'optimizer' ? 'active' : ''}`}
            style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '12px 16px', fontSize: '14px', borderRadius: '8px', background: activeScreen === 'optimizer' ? 'rgba(167, 139, 250, 0.1)' : 'transparent', border: 'none', color: activeScreen === 'optimizer' ? 'var(--color-violet)' : 'var(--text-secondary)' }}
          >
            <Activity size={18} /> Tối Ưu Thuật Toán
          </button>
          
          <button 
            onClick={() => setActiveScreen('arena')} 
            className={`tab-btn ${activeScreen === 'arena' ? 'active' : ''}`}
            style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '12px 16px', fontSize: '14px', borderRadius: '8px', background: activeScreen === 'arena' ? 'rgba(244, 63, 94, 0.1)' : 'transparent', border: 'none', color: activeScreen === 'arena' ? 'var(--color-rose)' : 'var(--text-secondary)' }}
          >
            <ShieldCheck size={18} /> Đấu Trường
          </button>
          
          <div style={{ padding: '24px 12px 8px 12px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>Kết Quả</div>
          
          <button 
            onClick={() => setActiveScreen('history')} 
            className={`tab-btn ${activeScreen === 'history' ? 'active' : ''}`}
            style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '12px 16px', fontSize: '14px', borderRadius: '8px', background: activeScreen === 'history' ? 'rgba(45, 212, 191, 0.1)' : 'transparent', border: 'none', color: activeScreen === 'history' ? 'var(--color-teal)' : 'var(--text-secondary)' }}
          >
            <Download size={18} /> Lịch Sử & Xuất File
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main style={{ marginLeft: '280px', flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)' }}>
        
        {/* HEADER */}
        <header className="glass-card flex justify-between align-center" style={{ 
          padding: '16px 32px', 
          background: 'rgba(15, 23, 42, 0.9)', 
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 90,
          backdropFilter: 'blur(12px)'
        }}>
          {/* Cấu trúc ngắn gọn */}
          <div className="flex gap-md align-center" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <div className="flex align-center gap-sm" style={{ borderRight: '1px solid rgba(255,255,255,0.08)', paddingRight: '16px' }}>
              <Sparkles size={14} style={{ color: 'var(--color-teal)' }} />
              <span>Kịch bản: <b style={{ color: '#fff' }}>{schemaName}</b></span>
            </div>
            <div className="flex align-center gap-sm" style={{ borderRight: '1px solid rgba(255,255,255,0.08)', paddingRight: '16px' }}>
              <Activity size={14} style={{ color: 'var(--color-violet)' }} />
              <span>Ràng buộc: <b style={{ color: '#fff' }}>{parsedSchema.length}</b></span>
            </div>
          </div>

          {/* Ô nhập API Key */}
          <div style={{
            background: apiKey.trim().length > 10 ? 'rgba(45, 212, 191, 0.05)' : 'rgba(0,0,0,0.25)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid',
            borderColor: apiKey.trim().length > 10 ? 'rgba(45, 212, 191, 0.35)' : 'rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            minWidth: '300px'
          }}>
            <Key size={14} style={{ color: apiKey.trim().length > 10 ? 'var(--color-teal)' : 'var(--text-muted)' }} />
            <input
              type="password"
              placeholder="Dán Gemini API Key vào đây..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="input-field"
              style={{ flex: 1, padding: '4px 8px', fontSize: '12px', background: 'transparent', border: 'none', color: apiKey.trim().length > 10 ? 'var(--color-teal)' : 'var(--text-primary)' }}
            />
          </div>
        </header>

        {/* CÁC MÀN HÌNH CHÍNH (SCREENS) */}
        <div style={{ padding: '32px', flex: 1 }}>
          
          {/* MÀN HÌNH DASHBOARD TỔNG QUAN */}
          {activeScreen === 'dashboard' && (
             <section className="glass-card tutorial-container teal-border" style={{ padding: '32px', background: 'rgba(15, 23, 42, 0.65)' }}>
               <h2 style={{ fontSize: '24px', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                 <BookOpen className="text-teal" size={24} style={{ color: 'var(--color-teal)' }} />
                 HƯỚNG DẪN VẬN HÀNH HỆ THỐNG
               </h2>
               <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '15px', lineHeight: '1.6' }}>
                 Chào mừng bạn đến với TestForge. Bạn có thể chọn cách lấy dữ liệu kiểm thử từ 2 nguồn: <br/>
                 1. <b>Phân Tích Bằng AI</b>: Gõ văn bản mô tả tiếng Việt, AI sẽ tự động lập bảng ràng buộc (Schema).<br/>
                 2. <b>Tải Lên Dữ Liệu</b>: Upload file JSON có sẵn, hệ thống tự nhận diện và chạy tối ưu.<br/>
                 Sau đó, chuyển sang màn hình <b>Tối Ưu Thuật Toán</b> để sinh bộ dữ liệu Test Cases an toàn và chính xác nhất.
               </p>
               
               <div className="tutorial-grid">
                  <div className="tutorial-card step-1">
                    <span className="step-badge teal">BƯỚC 1</span>
                    <h3 className="tutorial-card-title"><Sparkles size={16} style={{ color: 'var(--color-teal)' }} /> Trích Xuất AI</h3>
                    <ul className="tutorial-card-list">
                      <li>Biên soạn mô tả nghiệp vụ</li>
                      <li>Sinh Schema & Dữ liệu F0</li>
                    </ul>
                  </div>
                  <div className="tutorial-card step-2">
                    <span className="step-badge violet">BƯỚC 2</span>
                    <h3 className="tutorial-card-title"><Activity size={16} style={{ color: 'var(--color-violet)' }} /> Tối Ưu Hóa</h3>
                    <ul className="tutorial-card-list">
                      <li>Thiết lập trọng số biên/bảo mật</li>
                      <li>Tiến hóa bằng Genetic Algorithm</li>
                    </ul>
                  </div>
                  <div className="tutorial-card step-3">
                    <span className="step-badge rose">BƯỚC 3</span>
                    <h3 className="tutorial-card-title"><CheckCircle size={16} style={{ color: 'var(--color-rose)' }} /> Xuất Dữ Liệu</h3>
                    <ul className="tutorial-card-list">
                      <li>Xem xét Payload tự động sinh</li>
                      <li>Tải file JSON/CSV cho Automation</li>
                    </ul>
                  </div>
               </div>
             </section>
          )}

          {/* CÁC COMPONENT TÍNH NĂNG */}
          {activeScreen === 'step-spec' && <SpecInput />}
          {activeScreen === 'data-import' && <DataImport />}
          {activeScreen === 'optimizer' && (
            <div className="glass-card violet-border" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '20px', color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles className="text-teal" size={22} style={{ color: 'var(--color-teal)' }} />
                TỐI ƯU HÓA BỘ TEST CASES (GENETIC & HILL CLIMBING)
              </h2>
              <Visualizer />
            </div>
          )}
          {activeScreen === 'arena' && (
             <div className="glass-card teal-border" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '20px', color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck className="text-violet" size={22} style={{ color: 'var(--color-violet)' }} />
                ĐẤU TRƯỜNG SO SÁNH GIẢI THUẬT
              </h2>
              <ComparisonArena />
            </div>
          )}
          {activeScreen === 'history' && (
             <div className="glass-card violet-border" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '20px', color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers className="text-rose" size={22} style={{ color: 'var(--color-rose)' }} />
                TRUNG TÂM LỊCH SỬ &amp; XUẤT FILE
              </h2>
              <HistoryManager />
            </div>
          )}

        </div>
        
        {/* FOOTER */}
        <footer style={{ padding: '16px 32px', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'right' }}>
          © 2026 Hyperion TestForge Fullstack. Build v2.0 Dashboard
        </footer>
      </main>
    </div>
  );
}

export default App;
"""

target_path = SCRIPT_DIR / "src" / "App.tsx"
target_path.parent.mkdir(parents=True, exist_ok=True)

with open(target_path, "w", encoding="utf-8") as f:
    f.write(app_content)

print(f"App.tsx has been rewritten! -> {target_path}")
