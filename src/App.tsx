import {
  Activity,
  CheckCircle,
  CheckCircle2,
  Database, Download,
  Key,
  Layers,
  Menu,
  Sparkles,
  Terminal,
  X,
  Zap,
} from 'lucide-react';
import React from 'react';
import { AILogsViewer } from './components/AILogsViewer';
import { DataImport } from './components/DataImport';
import { HistoryManager } from './components/HistoryManager';
import { OptimizationDashboard } from './components/OptimizationDashboard';
import { PageLayout } from './components/PageLayout';
import { SpecInput } from './components/SpecInput';
import { Tabs } from './components/Tabs';
import { ToastContainer } from './components/ToastContainer';
import { useAppStore } from './store/useAppStore';

// ─── Sidebar nav item ─────────────────────────────────────────────────────────
interface NavItemProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  activeColor: string;
  active: boolean;
  done: boolean;
  onClick: () => void;
}
const NavItem: React.FC<NavItemProps> = ({ label, icon, activeColor, active, done, onClick }) => (
  <button
    onClick={onClick}
    style={{
      textAlign: 'left',
      display: 'flex', alignItems: 'center', gap: '9px',
      padding: '11px 14px', fontSize: '13px', borderRadius: '8px',
      background: active ? `${activeColor}16` : 'transparent',
      border: `1.5px solid ${active ? activeColor + '55' : 'transparent'}`, /* 1px -> 1.5px, slightly darker border */
      color: active ? activeColor : done ? 'var(--text-secondary)' : 'var(--text-muted)',
      cursor: 'pointer', transition: 'all 0.16s ease',
      fontWeight: active ? 750 : 600, /* Make text bolder and friendlier */
      width: '100%', position: 'relative',
    }}
  >
    <span style={{ flexShrink: 0 }}>{icon}</span>
    <span style={{ flex: 1 }}>{label}</span>
    {done && !active && (
      <CheckCircle2 size={14} style={{ color: 'var(--color-teal)', flexShrink: 0, opacity: 0.9 }} />
    )}
    {active && (
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: activeColor, flexShrink: 0,
        boxShadow: `0 0 6px ${activeColor}`,
        animation: 'pulse-dot 2s ease-in-out infinite',
      }} />
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

  // Tab state within steps
  const [prepareTab, setPrepareTab] = React.useState<string>('ai');
  const [isAILogsOpen, setIsAILogsOpen] = React.useState(false);

  const {
    schemaName,
    parsedSchema,
    apiKey,
    setApiKey,
    activeScreen,
    setActiveScreen,
    completedScreens,
    initialSeeds,
    historyRuns,
    optimizedDataset,
  } = useAppStore();

  const hasInputData = parsedSchema.length > 0 && initialSeeds.length > 0;
  const hasOptimizedResult = optimizedDataset.length > 0;
  const hasHistory = historyRuns.length > 0;

  const nav = (id: string, label: string, icon: React.ReactNode, color: string) => (
    <NavItem
      id={id} label={label} icon={icon} activeColor={color}
      active={activeScreen === id}
      done={completedScreens.includes(id)}
      onClick={() => { setActiveScreen(id); closeSidebar(); }}
    />
  );

  return (
    <div className="app-container" style={{ display: 'flex', minHeight: '100vh', padding: 0 }}>

      {/* ══════════════ MOBILE OVERLAY ══════════════ */}
      {mobile && sidebarOpen && (
        <div
          onClick={closeSidebar}
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 999,
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* ══════════════ SIDEBAR ══════════════ */}
      <aside style={{
        width: '240px',
        background: 'var(--bg-deep)',
        borderRight: '1.5px solid var(--border-subtle)', /* 1px -> 1.5px */
        padding: '20px 0',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, bottom: 0,
        left: mobile ? (sidebarOpen ? '0' : '-240px') : '0',
        zIndex: 1000,
        boxShadow: 'var(--shadow-sm)',
        transition: mobile ? 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
      }}>
        {/* Logo */}
        <div style={{ padding: '0 18px', marginBottom: '22px' }}>
          <h1 style={{ fontSize: '19px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', margin: 0 }}>
            <Layers size={26} style={{ color: 'var(--color-teal)' }} />
            TESTFORGE
          </h1>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '3px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
            LLM · GA · HILL CLIMBING
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '0 8px', flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '6px 12px 6px', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 750 }}>
            Quy Trình 3 Bước
          </div>
          {nav('prepare', '1 · Chuẩn Bị Dữ Liệu', <Database size={16} />, '#1d4ed8')}
          {nav('optimize', '2 · Tối Ưu & So Sánh', <Activity size={16} />, '#6d28d9')}
          {nav('export', '3 · Xuất Kết Quả', <Download size={16} />, '#0f766e')}
        </nav>

        {/* Footer hint */}
        <div style={{ padding: '12px 16px 0', borderTop: '1.5px solid var(--border-subtle)', marginTop: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5, fontWeight: 600 }}>
            <CheckCircle2 size={11} style={{ display: 'inline', marginRight: '4px', color: 'var(--color-teal)' }} />
            {completedScreens.length} / 3 bước hoàn thành
          </div>
        </div>
      </aside>

      {/* ══════════════ MAIN CONTENT ══════════════ */}
      <main style={{ marginLeft: mobile ? '0' : '240px', flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-space)', minWidth: 0 }}>

        {/* HEADER */}
        <header style={{
          padding: '10px 24px',
          background: 'var(--bg-card)',
          borderBottom: '1.5px solid var(--border-subtle)', /* 1px -> 1.5px */
          position: 'sticky', top: 0, zIndex: 90,
          backdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        }}>
          {/* Hamburger button for mobile */}
          {mobile && (
            <button
              onClick={toggleSidebar}
              aria-label={sidebarOpen ? 'Đóng menu' : 'Mở menu'}
              style={{
                background: 'rgba(0,0,0,0.05)',
                border: '1.5px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          )}

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', flexWrap: mobile ? 'wrap' : 'nowrap', fontWeight: 600 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '16px', borderRight: '1.5px solid var(--border-subtle)' }}>
              <Sparkles size={13} style={{ color: 'var(--color-teal)', flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Kịch bản: <b style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{schemaName || '—'}</b></span>
            </div>
            {!mobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={13} style={{ color: 'var(--color-violet)' }} />
                <span>Ràng buộc: <b style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{parsedSchema.length}</b></span>
              </div>
            )}
          </div>

          {/* AI Logs & API Key */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setIsAILogsOpen(true)}
              style={{
                background: 'rgba(0,0,0,0.05)',
                border: '1.5px solid var(--border-subtle)', /* 1px -> 1.5px */
                borderRadius: '8px',
                padding: '7px 12px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12.5px',
                fontWeight: 700,
                transition: 'all 0.16s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
            >
              <Terminal size={14} style={{ color: 'var(--color-teal)' }} />
              <span>Nhật Ký AI</span>
            </button>

            {/* API Key */}
            <div style={{
              background: apiKey.trim().length > 10 ? 'rgba(15, 118, 110, 0.08)' : 'rgba(0,0,0,0.03)',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1.5px solid',
              borderColor: apiKey.trim().length > 10 ? 'rgba(15, 118, 110, 0.45)' : 'var(--border-subtle)',
              display: 'flex', alignItems: 'center', gap: '10px',
              minWidth: mobile ? 'auto' : '260px',
              maxWidth: mobile ? '160px' : undefined,
            }}>
              <Key size={13} style={{ color: apiKey.trim().length > 10 ? 'var(--color-teal)' : 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="password"
                placeholder={mobile ? "API Key..." : "Dán Gemini API Key vào đây..."}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ flex: 1, padding: '2px 6px', fontSize: '12px', background: 'transparent', border: 'none', outline: 'none', color: apiKey.trim().length > 10 ? 'var(--color-teal)' : 'var(--text-primary)', minWidth: 0, fontWeight: 600 }}
              />
              {apiKey.trim().length > 10 && <CheckCircle size={13} style={{ color: 'var(--color-teal)', flexShrink: 0 }} />}
            </div>
          </div>
        </header>

        {/* SCREENS */}
        <div style={{ padding: '20px 24px', flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>

          {/* ══════════ BƯỚC 1: CHUẨN BỊ DỮ LIỆU ══════════ */}
          <div style={{ display: activeScreen === 'prepare' ? 'block' : 'none' }}>
            <PageLayout
              stepId="prepare"
              title="Bước 1: Chuẩn Bị Dữ Liệu Đầu Vào"
              icon={<Database size={24} />}
              description=""
              hints={['AI phân tích đặc tả', 'hoặc Upload JSON/CSV', 'Tự sinh hạt giống F0', 'Chuẩn bị cho thuật toán']}
              accentColor="#3b82f6"
            >
              <Tabs
                tabs={[
                  { id: 'ai', label: 'Phân Tích Bằng AI', icon: <Sparkles size={15} />, color: '#3b82f6' },
                  { id: 'upload', label: 'Tải Lên File (JSON/CSV)', icon: <Database size={15} />, color: '#D97706' },
                ]}
                activeTab={prepareTab}
                onChange={setPrepareTab}
              />
              {prepareTab === 'ai' ? <SpecInput /> : <DataImport />}
            </PageLayout>
          </div>

          {/* ══════════ BƯỚC 2: TỐI ƯU & SO SÁNH ══════════ */}
          <div style={{ display: activeScreen === 'optimize' ? 'block' : 'none' }}>
            <PageLayout
              stepId="optimize"
              title="Bước 2: Tối Ưu Hóa & So Sánh Thuật Toán"
              icon={<Zap size={24} />}
              description="Chạy đồng bộ các giải thuật tối ưu hóa di truyền GA phối hợp leo đồi HC và đối chiếu trực tuyến kết quả với thuật toán truyền thống BVA/Random."
              contextNote="GA (Genetic Algorithm) tìm kiếm toàn cục bằng cách lai ghép, đột biến và chọn lọc các thế hệ test tốt hơn. HC (Hill Climbing) làm tinh chỉnh cục bộ quanh lời giải hiện tại để nâng chất lượng và độ ổn định."
              hints={['GA: tìm kiếm toàn cục', 'HC: tinh chỉnh cục bộ', 'Lai ghép GA -> HC', 'Bao phủ biên & bảo mật']}
              accentColor="#7C3AED"
              prerequisites={[
                {
                  met: hasInputData,
                  warningText: 'Bạn chưa có dữ liệu đầu vào. Vui lòng quay lại Bước 1 để AI phân tích đặc tả hoặc tải lên file dữ liệu.',
                  goBackScreen: 'prepare',
                  goBackLabel: 'Quay lại Bước 1: Chuẩn Bị Dữ Liệu',
                }
              ]}
            >
              <OptimizationDashboard />
            </PageLayout>
          </div>

          {/* ══════════ BƯỚC 3: XUẤT KẾT QUẢ ══════════ */}
          <div style={{ display: activeScreen === 'export' ? 'block' : 'none' }}>
            <PageLayout
              stepId="export"
              title="Bước 3: Xem Lại & Xuất Kết Quả"
              icon={<Download size={24} />}
              description=""
              hints={['Tối giản bộ test', 'Xuất CSV / JSON / SQL', 'Playwright / Cypress / Postman', 'Mô phỏng API validation']}
              accentColor="#0D9488"
              prerequisites={[
                {
                  met: hasHistory || hasOptimizedResult,
                  warningText: 'Chưa có kết quả tối ưu nào. Hãy chạy thuật toán ở Bước 2 ít nhất 1 lần.',
                  goBackScreen: 'optimize',
                  goBackLabel: 'Đến Bước 2: Tối Ưu Hóa',
                }
              ]}
            >
              <HistoryManager />
            </PageLayout>
          </div>

        </div>

        <footer style={{ padding: '14px 28px', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', textAlign: 'right' }}>
          © 2026 Hyperion TestForge — Quy trình 3 bước
        </footer>
      </main>

      <AILogsViewer isOpen={isAILogsOpen} onClose={() => setIsAILogsOpen(false)} />
      <ToastContainer />
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
}

export default App;
