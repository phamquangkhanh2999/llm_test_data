import {
  CheckCircle2,
  Database,
  FileInput,
  Gauge,
  GitCompare,
  History as HistoryIcon,
  Menu,
  Terminal,
  X,
  Zap,
} from 'lucide-react';
import React from 'react';
import { AILogsViewer } from './components/AILogsViewer';
import { AnalysisDesign } from './components/AnalysisDesign';
import { GeneticOptimize } from './components/GeneticOptimize';
import { HillClimbingOptimize } from './components/HillClimbingOptimize';
import { PageLayout } from './components/PageLayout';
import { ToastContainer } from './components/ToastContainer';
import { useAppStore } from './store/useAppStore';
import { LoadingOverlay } from './components/LoadingOverlay';
import ExportReportCenter from './components/ExportReportCenter';
import { InputRequirement } from './components/InputRequirement';
import { EvaluateData } from './components/EvaluateData';


// ─── Sidebar nav item ─────────────────────────────────────────────────────────
interface NavItemProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  done: boolean;
  onClick: () => void;
}
const NavItem: React.FC<NavItemProps> = ({ label, icon, active, done, onClick }) => (
  <button
    onClick={onClick}
    style={{
      textAlign: 'left',
      display: 'flex',
      alignItems: 'center',
      gap: '11px',
      padding: '10px 12px',
      fontSize: '13.5px',
      borderRadius: '6px',
      background: active ? 'var(--surface-subtle)' : 'transparent',
      border: '1px solid transparent',
      color: active ? 'var(--brand-primary)' : 'var(--text-secondary)',
      cursor: 'pointer',
      transition: 'all 0.14s ease',
      fontWeight: active ? 600 : 500,
      width: '100%',
      position: 'relative',
    }}
    onMouseEnter={(e) => {
      if (!active) e.currentTarget.style.background = 'rgba(15,23,42,0.035)';
    }}
    onMouseLeave={(e) => {
      if (!active) e.currentTarget.style.background = 'transparent';
    }}
  >
    <span style={{ flexShrink: 0, color: active ? 'var(--brand-primary)' : 'var(--text-muted)' }}>
      {icon}
    </span>
    <span style={{ flex: 1 }}>{label}</span>
    {done && !active && (
      <CheckCircle2
        size={14}
        style={{ color: 'var(--color-emerald)', flexShrink: 0, opacity: 0.85 }}
      />
    )}
  </button>
);

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  const [mobile, setMobile] = React.useState(isMobile);

  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  const [isAILogsOpen, setIsAILogsOpen] = React.useState(false);

  const {
    parsedSchema,
    activeScreen,
    setActiveScreen,
    completedScreens,
    initialSeeds,
    historyRuns,
    gaResult,
    hcResult,
    llmProvider,
    setLlmProvider,
  } = useAppStore();

  const hasSchema = parsedSchema.length > 0;
  const hasInputData = parsedSchema.length > 0 && initialSeeds.length > 0;
  const hasOptimizedResult = gaResult && gaResult.length > 0;
  const hasHistory = historyRuns.length > 0;

  const nav = (id: string, label: string, icon: React.ReactNode) => (
    <NavItem
      label={label}
      icon={icon}
      active={activeScreen === id}
      done={completedScreens.includes(id)}
      onClick={() => {
        setActiveScreen(id);
        closeSidebar();
      }}
    />
  );

  return (
    <div className='app-container' style={{ display: 'flex', minHeight: '100vh', padding: 0 }}>
      <LoadingOverlay />

      {/* ══════════════ MOBILE OVERLAY ══════════════ */}
      {mobile && sidebarOpen && (
        <div
          onClick={closeSidebar}
          aria-hidden='true'
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.35)',
            zIndex: 999,
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* ══════════════ SIDEBAR ══════════════ */}
      <aside
        style={{
          width: '256px',
          background: 'var(--bg-deep)',
          borderRight: '1px solid var(--border-subtle)',
          padding: '20px 0',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: mobile ? (sidebarOpen ? '0' : '-256px') : '0',
          zIndex: 1000,
          boxShadow: 'var(--shadow-sm)',
          transition: mobile ? 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: '0 18px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '11px',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              // borderRadius: 8,
              // background: 'var(--brand-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <img style={{ width: 36, height: 36 }} src='/favicon.png' alt='AI Optimizer' />
            {/* <GitBranch size={19} style={{ color: '#fff' }} /> */}
          </div>

          <div>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--brand-primary)',
                letterSpacing: '-0.01em',
                lineHeight: 1.1,
              }}
            >
              AI Optimizer
            </div>
            {/* <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Technical Precision</div> */}
          </div>
        </div>

        <nav
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            padding: '0 10px',
            flex: 1,
            overflowY: 'auto',
          }}
        >
          {nav('input', 'Đầu vào', <FileInput size={17} />)}
          {nav('analyze', 'Phân tích dữ liệu', <Database size={17} />)}
          {nav('evaluate', 'Đánh giá dữ liệu', <Gauge size={17} />)}
          {nav('ga', 'Tối ưu GA', <Zap size={17} />)}
          {nav('hc', 'Tối ưu HC', <GitCompare size={17} />)}
          {nav('export', 'Lịch sử & Xuất kết quả', <HistoryIcon size={17} />)}
        </nav>
      </aside>

      {/* ══════════════ MAIN CONTENT ══════════════ */}
      <main
        style={{
          marginLeft: mobile ? '0' : '256px',
          flex: 1,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-space)',
          minWidth: 0,
        }}
      >
        {/* HEADER */}
        <header
          style={{
            padding: '10px 24px',
            background: 'rgba(255, 255, 255, 0.8)',
            borderBottom: '1px solid var(--border-subtle)',
            position: 'sticky',
            top: 0,
            zIndex: 90,
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            {mobile && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(15,23,42,0.04)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>AI:</span>
                  <select 
                    value={llmProvider} 
                    onChange={(e) => setLlmProvider(e.target.value as 'gemini' | 'openai')}
                    style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', fontWeight: 600, color: 'var(--brand-primary)', cursor: 'pointer' }}
                  >
                    <option value='gemini'>Gemini</option>
                    <option value='openai'>OpenAI</option>
                  </select>
                </div>

                <button
                    onClick={toggleSidebar}
                    aria-label='menu'
                    style={{
                      background: 'rgba(15,23,42,0.04)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '8px',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      flexShrink: 0,
                    }}
                  >
                    {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
                  </button>
              </>
            )}
            <span
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--brand-primary)',
                whiteSpace: 'nowrap',
              }}
            >
              Auto Testcase Generator
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(15,23,42,0.04)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>AI:</span>
              <select 
                value={llmProvider} 
                onChange={(e) => setLlmProvider(e.target.value as 'gemini' | 'openai')}
                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', fontWeight: 600, color: 'var(--brand-primary)', cursor: 'pointer' }}
              >
                <option value='gemini'>Gemini</option>
                <option value='openai'>OpenAI</option>
              </select>
            </div>

            <button
              onClick={() => setIsAILogsOpen(true)}
              style={{
                background: 'rgba(15,23,42,0.04)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '7px 12px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
              }}
            >
              <Terminal size={14} style={{ color: 'var(--color-teal)' }} />
              {!mobile && <span>Nhật Ký AI</span>}
            </button>

            {/* <div style={{
              background: apiKey.trim().length > 10 ? 'var(--color-teal-glow)' : 'rgba(15,23,42,0.03)',
              padding: '6px 10px', borderRadius: '6px', border: '1px solid',
              borderColor: apiKey.trim().length > 10 ? 'rgba(8,145,178,0.3)' : 'var(--border-subtle)',
              display: 'flex', alignItems: 'center', gap: '8px',
              minWidth: mobile ? 'auto' : '210px', maxWidth: mobile ? '120px' : undefined,
            }}>
              <Key size={13} style={{ color: apiKey.trim().length > 10 ? 'var(--color-teal)' : 'var(--text-muted)', flexShrink: 0 }} />
              <input type="password" placeholder={mobile ? 'Key...' : 'Gemini API Key...'} value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ flex: 1, padding: '2px 2px', fontSize: '12px', background: 'transparent', border: 'none', outline: 'none', color: apiKey.trim().length > 10 ? 'var(--color-teal)' : 'var(--text-primary)', minWidth: 0 }} />
              {apiKey.trim().length > 10 && <CheckCircle size={13} style={{ color: 'var(--color-teal)', flexShrink: 0 }} />}
            </div> */}

            {/* Nút Deploy đen (giống Stitch) */}
            {/* 
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(15,23,42,0.04)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>AI:</span>
              <select 
                value={llmProvider} 
                onChange={(e) => setLlmProvider(e.target.value as 'gemini' | 'openai')}
                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', fontWeight: 600, color: 'var(--brand-primary)', cursor: 'pointer' }}
              >
                <option value='gemini'>Gemini</option>
                <option value='openai'>OpenAI</option>
              </select>
            </div>

            <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13, background: 'var(--brand-primary)', color: '#fff' }} onClick={() => setActiveScreen('export')}>
              <Rocket size={14} /> {!mobile && 'Deploy'}
            </button> */}
          </div>
        </header>

        {/* SCREENS */}
        <div
          style={{
            padding: '20px 24px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          {/* ── ĐẦU VÀO ── */}
          <div style={{ display: activeScreen === 'input' ? 'block' : 'none' }}>
            <PageLayout
              stepId='input'
              title='Nhập Yêu Cầu Đầu Vào'
              icon={<FileInput size={24} />}
              description='Nhập đặc tả nghiệp vụ / yêu cầu kỹ thuật. Hệ thống sẽ phân tích để sinh ràng buộc và bộ ca kiểm thử tối ưu.'
            >
              <InputRequirement />
            </PageLayout>
          </div>

          {/* ── PHÂN TÍCH & THIẾT KẾ TESTCASE ── */}
          <div style={{ display: activeScreen === 'analyze' ? 'block' : 'none' }}>
            <PageLayout
              stepId='analyze'
              title='Phân Tích & Thiết Kế Testcase'
              icon={<Database size={24} />}
              description='Bạn có thể CHỈNH SỬA trực tiếp trường, ràng buộc và dữ liệu phân tích trước khi đưa vào LLM.'
              // hints={['AI phân tích đặc tả', 'Chỉnh sửa ràng buộc', 'Chuẩn bị cho Memetic']}
              // accentColor="#0891B2"
              prerequisites={[{ met: true, warningText: '' }]}
            >
              <AnalysisDesign />
            </PageLayout>
          </div>

          {/* ── ĐÁNH GIÁ DỮ LIỆU ── */}
          <div style={{ display: activeScreen === 'evaluate' ? 'block' : 'none' }}>
            <PageLayout
              stepId='evaluate'
              title='Đánh Giá Dữ Liệu Kiểm Thử'
              icon={<Gauge size={24} />}
              description='Phân tích chuyên sâu chất lượng tập F0 do LLM sinh: độ phủ, tính hợp lệ, tỉ lệ trùng lặp — trước khi đưa vào thuật toán Memetic cải tiến.'
              // hints={['Coverage gauge', 'Fitness score', 'Tỉ lệ trùng lặp', 'Test Case Preview']}
              // accentColor="#0891B2"
              prerequisites={[
                {
                  met: hasSchema,
                  warningText: 'Chưa có Schema. Quay lại bước Phân Tích & Thiết Kế.',
                  goBackScreen: 'analyze',
                  goBackLabel: 'Quay lại: Phân Tích',
                },
              ]}
            >
              <EvaluateData />
            </PageLayout>
          </div>

          {/* ── GA TỐI ƯU ── */}
          <div style={{ display: activeScreen === 'ga' ? 'block' : 'none' }}>
            <PageLayout
              stepId='ga'
              title='Bước 4: GA Cải Tiến Dữ Liệu'
              icon={<Zap size={24} />}
              description='Chạy thuật toán Genetic Algorithm. Theo dõi đồ thị tiến hóa và các chỉ số chất lượng.'
              prerequisites={[
                {
                  met: hasInputData,
                  warningText: 'Chưa có F0. Hãy sinh dữ liệu ở bước Đánh Giá Dữ Liệu.',
                  goBackScreen: 'evaluate',
                  goBackLabel: 'Đến: Đánh Giá Dữ Liệu',
                },
              ]}
            >
              <GeneticOptimize />
            </PageLayout>
          </div>

          {/* ── HC TỐI ƯU ── */}
          <div style={{ display: activeScreen === 'hc' ? 'block' : 'none' }}>
            <PageLayout
              stepId='hc'
              title='Bước 5: HC Cải Tiến Dữ Liệu'
              icon={<GitCompare size={24} />}
              description='Nhận dữ liệu từ GA và chạy thuật toán Hill Climbing để tinh chỉnh cục bộ cuối cùng.'
              prerequisites={[
                {
                  met: !!gaResult,
                  warningText: 'Chưa có dữ liệu từ GA. Hãy chạy GA ở bước trước.',
                  goBackScreen: 'ga',
                  goBackLabel: 'Đến: GA Tối Ưu',
                },
              ]}
            >
              <HillClimbingOptimize />
            </PageLayout>
          </div>

          {/* ── LỊCH SỬ & XUẤT KẾT QUẢ (gộp) ── */}
          <div style={{ display: activeScreen === 'export' ? 'block' : 'none' }}>
            <PageLayout
              stepId='export'
              title='Lịch Sử & Xuất Kết Quả'
              icon={<HistoryIcon size={24} />}
              description='Tra cứu lại các phiên chạy đã lưu theo từng yêu cầu, xem lại 4 bước và xuất bộ test ra nhiều định dạng (CSV / JSON / PDF).'
              // hints={['Tối giản bộ test', 'Xuất CSV / JSON / SQL', 'Playwright / Cypress', 'Mô phỏng API']}
              // accentColor="#10B981"
              prerequisites={[
                {
                  met: hasHistory || !!hcResult,
                  warningText: 'Chưa có kết quả. Hãy chạy HC ít nhất 1 lần.',
                  goBackScreen: 'hc',
                  goBackLabel: 'Đến: HC Tối Ưu',
                },
              ]}
            >
              <ExportReportCenter />
            </PageLayout>
          </div>
        </div>

        <footer
          style={{
            padding: '14px 28px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            borderTop: '1px solid var(--border-subtle)',
            textAlign: 'right',
          }}
        >
          © 2026 AI Optimizer — LLM + GA + HC · PostgreSQL
        </footer>
      </main>

      <AILogsViewer isOpen={isAILogsOpen} onClose={() => setIsAILogsOpen(false)} />
      <ToastContainer />
      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:.5;transform:scale(.7);} }
      `}</style>
    </div>
  );
}

export default App;








