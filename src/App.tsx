import React from 'react';
import { SpecInput } from './components/SpecInput';
import { Visualizer } from './components/Visualizer';
import { ComparisonArena } from './components/ComparisonArena';
import { HistoryManager } from './components/HistoryManager';
import { DataImport } from './components/DataImport';
import { PageLayout } from './components/PageLayout';
import {
  Sparkles, Activity, Layers, ShieldCheck, Key,
  BookOpen, CheckCircle, LayoutDashboard, Database, Download,
  CheckCircle2, ArrowRight, Zap, FlaskConical,
} from 'lucide-react';
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
      border: `1px solid ${active ? activeColor + '38' : 'transparent'}`,
      color: active ? activeColor : done ? 'var(--text-secondary)' : 'var(--text-muted)',
      cursor: 'pointer', transition: 'all 0.16s ease',
      fontWeight: active ? 600 : 400, width: '100%', position: 'relative',
    }}
  >
    <span style={{ flexShrink: 0 }}>{icon}</span>
    <span style={{ flex: 1 }}>{label}</span>
    {done && !active && (
      <CheckCircle2 size={14} style={{ color: '#2dd4bf', flexShrink: 0, opacity: 0.8 }} />
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
      onClick={() => setActiveScreen(id)}
    />
  );

  return (
    <div className="app-container" style={{ display: 'flex', minHeight: '100vh', padding: 0 }}>

      {/* ══════════════ SIDEBAR ══════════════ */}
      <aside style={{
        width: '240px',
        background: 'rgba(8, 13, 28, 0.98)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        padding: '20px 0',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 1000,
        backdropFilter: 'blur(20px)',
      }}>
        {/* Logo */}
        <div style={{ padding: '0 18px', marginBottom: '22px' }}>
          <h1 style={{ fontSize: '19px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', margin: 0 }}>
            <Layers size={26} style={{ color: 'var(--color-teal)' }} />
            TESTFORGE
          </h1>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '3px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            LLM · GA · HILL CLIMBING
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '1px', padding: '0 8px', flex: 1, overflowY: 'auto' }}>
          {/* Overview */}
          {nav('dashboard', 'Tổng Quan', <LayoutDashboard size={16} />, '#2dd4bf')}

          <div style={{ padding: '18px 12px 6px', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Nguồn Dữ Liệu
          </div>
          {nav('step-spec',   'Phân Tích Bằng AI',  <Sparkles size={16} />,   '#3b82f6')}
          {nav('data-import', 'Tải Lên Dữ Liệu',    <Database size={16} />,   '#facc15')}

          <div style={{ padding: '18px 12px 6px', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Thực Thi & Phân Tích
          </div>
          {nav('optimizer',   'Tối Ưu Thuật Toán',  <Activity size={16} />,   '#a78bfa')}
          {nav('arena',       'Đấu Trường',          <ShieldCheck size={16} />, '#f43f5e')}

          <div style={{ padding: '18px 12px 6px', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Kết Quả
          </div>
          {nav('history', 'Lịch Sử & Xuất File', <Download size={16} />, '#2dd4bf')}
        </nav>

        {/* Footer hint */}
        <div style={{ padding: '12px 16px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '8px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <CheckCircle2 size={11} style={{ display: 'inline', marginRight: '4px', color: '#2dd4bf' }} />
            {completedScreens.length} / 5 bước hoàn thành
          </div>
        </div>
      </aside>

      {/* ══════════════ MAIN CONTENT ══════════════ */}
      <main style={{ marginLeft: '240px', flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-space)' }}>

        {/* HEADER */}
        <header style={{
          padding: '10px 24px',
          background: 'rgba(8, 13, 28, 0.95)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          position: 'sticky', top: 0, zIndex: 90,
          backdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '16px', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
              <Sparkles size={13} style={{ color: 'var(--color-teal)' }} />
              <span>Kịch bản: <b style={{ color: '#fff' }}>{schemaName || '—'}</b></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={13} style={{ color: 'var(--color-violet)' }} />
              <span>Ràng buộc: <b style={{ color: '#fff' }}>{parsedSchema.length}</b></span>
            </div>
          </div>

          {/* API Key */}
          <div style={{
            background: apiKey.trim().length > 10 ? 'rgba(45, 212, 191, 0.06)' : 'rgba(0,0,0,0.22)',
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: apiKey.trim().length > 10 ? 'rgba(45, 212, 191, 0.3)' : 'rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center', gap: '10px',
            minWidth: '260px',
          }}>
            <Key size={13} style={{ color: apiKey.trim().length > 10 ? 'var(--color-teal)' : 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="password"
              placeholder="Dán Gemini API Key vào đây..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{ flex: 1, padding: '2px 6px', fontSize: '12px', background: 'transparent', border: 'none', outline: 'none', color: apiKey.trim().length > 10 ? 'var(--color-teal)' : 'var(--text-primary)' }}
            />
            {apiKey.trim().length > 10 && <CheckCircle size={13} style={{ color: 'var(--color-teal)', flexShrink: 0 }} />}
          </div>
        </header>

        {/* SCREENS */}
        <div style={{ padding: '20px 24px', flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── DASHBOARD ── */}
          {activeScreen === 'dashboard' && (
            <PageLayout
              title="Hướng Dẫn Vận Hành Hệ Thống"
              icon={<BookOpen size={24} />}
              description="Chào mừng bạn đến với TestForge. Hệ thống hỗ trợ 2 luồng làm việc để sinh bộ dữ liệu kiểm thử tối ưu bằng AI và thuật toán tiến hóa."
              accentColor="#2dd4bf"
              nextScreen="step-spec"
              nextLabel="Bắt Đầu Phân Tích AI"
              nextIcon={<Sparkles size={16} />}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                {[
                  {
                    step: '01', color: '#3b82f6', screen: 'step-spec',
                    title: 'Phân Tích Bằng AI',
                    desc: 'Mô tả nghiệp vụ bằng tiếng Việt, AI (Gemini) sẽ tự trích xuất ràng buộc dữ liệu (Schema) và sinh tập hạt giống F0.',
                    tag: 'Luồng A',
                  },
                  {
                    step: '01', color: '#facc15', screen: 'data-import',
                    title: 'Tải Lên Dữ Liệu',
                    desc: 'Có sẵn file JSON/CSV thì upload thẳng vào, hệ thống tự nhận diện schema và dùng luôn làm đầu vào thuật toán.',
                    tag: 'Luồng B',
                  },
                  {
                    step: '02', color: '#a78bfa', screen: 'optimizer',
                    title: 'Tối Ưu Thuật Toán',
                    desc: 'Chạy Genetic Algorithm + Hill Climbing để sinh bộ test cases bao phủ tối đa biên miền, giá trị đặc biệt và bảo mật.',
                    tag: 'GA + HC',
                  },
                  {
                    step: '03', color: '#f43f5e', screen: 'arena',
                    title: 'Đấu Trường So Sánh',
                    desc: 'So sánh hiệu quả các chiến lược: Random, GA thuần, GA + Hill Climbing. Đánh giá coverage và fitness.',
                    tag: 'Benchmark',
                  },
                  {
                    step: '04', color: '#2dd4bf', screen: 'history',
                    title: 'Lịch Sử & Xuất File',
                    desc: 'Xem lại các phiên chạy trước, tải bộ test cases dạng JSON/CSV cho hệ thống automation.',
                    tag: 'Export',
                  },
                ].map(({ step, color, screen, title, desc, tag }) => (
                  <button
                    key={screen}
                    onClick={() => setActiveScreen(screen)}
                    style={{
                      background: `linear-gradient(135deg, rgba(15,23,42,0.9) 0%, ${color}08 100%)`,
                      border: `1px solid ${color}30`,
                      borderRadius: '14px',
                      padding: '20px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.22s ease',
                      color: 'inherit',
                    }}
                    onMouseOver={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = `${color}60`;
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 28px ${color}22`;
                    }}
                    onMouseOut={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = `${color}30`;
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <span style={{ fontSize: '28px', fontWeight: 800, color: `${color}55`, letterSpacing: '-0.04em', lineHeight: 1 }}>
                        {step}
                      </span>
                      <span style={{
                        fontSize: '10px', padding: '3px 9px', borderRadius: '20px',
                        background: `${color}18`, border: `1px solid ${color}35`,
                        color: color, fontWeight: 600, letterSpacing: '0.05em',
                      }}>
                        {tag}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: '0 0 8px 0' }}>{title}</h3>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{desc}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '14px', color, fontSize: '12px', fontWeight: 600 }}>
                      Vào trang <ArrowRight size={13} />
                    </div>
                  </button>
                ))}
              </div>
            </PageLayout>
          )}

          {/* ── PHÂN TÍCH AI ── */}
          {activeScreen === 'step-spec' && (
            <PageLayout
              stepId="step-spec"
              title="Phân Tích Đặc Tả Bằng AI (Gemini)"
              icon={<Sparkles size={24} />}
              description="Mô tả yêu cầu kiểm thử của hệ thống bằng ngôn ngữ tự nhiên — AI (Gemini) sẽ tự động trích xuất từng trường dữ liệu, kiểu dữ liệu và ràng buộc giá trị (min/max, regex, bắt buộc...) thành một bảng Schema chuẩn."
              contextNote={'<b>Tại sao có màn hình này?</b> Để chạy thuật toán tối ưu, hệ thống cần biết dữ liệu của bạn có những trường gì và giá trị hợp lệ là gì. Màn hình này dùng AI để tự động phân tích đặc tả nghiệp vụ và tạo ra bảng ràng buộc đó — thay vì bạn phải nhập thủ công.'}
              hints={['Nhập mô tả nghiệp vụ', 'AI trích xuất Schema tự động', 'Kiểm tra & chỉnh sửa tùy ý', 'Kết quả dùng cho bước Tối Ưu']}
              accentColor="#3b82f6"
              nextScreen="optimizer"
              nextLabel="Tối Ưu Thuật Toán"
              nextIcon={<Activity size={16} />}
            >
              <SpecInput />
            </PageLayout>
          )}

          {/* ── TẢI DỮ LIỆU ── */}
          {activeScreen === 'data-import' && (
            <PageLayout
              stepId="data-import"
              title="Tải Lên Dữ Liệu Có Sẵn"
              icon={<Database size={24} />}
              description="Bạn đã có sẵn file dữ liệu test (JSON từ database, export từ hệ thống khác...)? Upload trực tiếp vào đây. Hệ thống sẽ tự nhận diện cột và kiểu dữ liệu — bỏ qua bước AI Parser, chạy thẳng vào thuật toán tối ưu."
              contextNote={'<b>Tại sao có màn hình này?</b> Đây là <b>luồng thay thế</b> cho màn hình Phân Tích AI. Nếu bạn đã có dữ liệu mẫu thực tế (ví dụ: file JSON từ database), bạn không cần mô tả lại bằng văn bản — chỉ cần upload file là hệ thống tự hiểu cấu trúc và chuẩn bị đầu vào cho thuật toán.'}
              hints={['Upload file JSON', 'Tự nhận diện cột & kiểu dữ liệu', 'Không cần API Key', 'Chạy thuật toán ngay sau upload']}
              accentColor="#facc15"
            >
              <DataImport />
            </PageLayout>
          )}

          {/* ── TỐI ƯU THUẬT TOÁN ── */}
          {activeScreen === 'optimizer' && (
            <PageLayout
              stepId="optimizer"
              title="Tối Ưu Hóa Test Cases (GA + Hill Climbing)"
              icon={<Zap size={24} />}
              description="Từ dữ liệu đầu vào (Schema + tập hạt giống F0), thuật toán Genetic Algorithm sẽ tiến hóa qua nhiều thế hệ để sinh ra bộ test cases tối ưu — bao phủ tối đa biên miền, giá trị đặc biệt và rủi ro bảo mật."
              contextNote={'<b>Tại sao có màn hình này?</b> Dữ liệu test thủ công thường thiếu các ca biên (boundary) và ca bảo mật (SQL injection, XSS...). Thuật toán GA + Hill Climbing tự động tiến hóa để tìm ra các bộ dữ liệu khó nhất — những gì con người hay bỏ sót.'}
              hints={['Genetic Algorithm (GA)', 'Hill Climbing (HC)', 'Bao phủ biên miền', 'Rủi ro bảo mật', 'Nhiều thế hệ tiến hóa']}
              accentColor="#a78bfa"
              prerequisites={[
                {
                  met: hasInputData,
                  warningText: `Bạn chưa có dữ liệu đầu vào. Vui lòng quay lại bước "Phân Tích Bằng AI" để mô tả đặc tả và để AI tạo Schema, hoặc sang "Tải Lên Dữ Liệu" nếu bạn có file JSON có sẵn.`,
                  goBackScreen: 'step-spec',
                  goBackLabel: 'Quay lại: Phân Tích Bằng AI',
                }
              ]}
              nextScreen="arena"
              nextLabel="Đấu Trường So Sánh"
              nextIcon={<ShieldCheck size={16} />}
            >
              <Visualizer />
            </PageLayout>
          )}

          {/* ── ĐẤU TRƯỜNG ── */}
          {activeScreen === 'arena' && (
            <PageLayout
              stepId="arena"
              title="Đấu Trường So Sánh Giải Thuật"
              icon={<FlaskConical size={24} />}
              description="Chạy và so sánh trực tiếp 3 chiến lược: Random Search, Genetic Algorithm thuần, và GA + Hill Climbing — trên cùng một bộ dữ liệu đầu vào. Xem biểu đồ fitness và coverage để chọn chiến lược tốt nhất."
              contextNote={'<b>Tại sao có màn hình này?</b> Màn hình Tối Ưu ở trước chỉ chạy một chiến lược (GA+HC). Đấu Trường cho phép bạn <b>so sánh đồng thời</b> nhiều thuật toán — từ đó hiểu được GA+HC vượt trội hơn Random hay GA thuần ở điểm nào, và bao nhiêu.'}
              hints={['Random vs GA vs GA+HC', 'Biểu đồ fitness theo thế hệ', 'So sánh coverage & phân phối', 'Benchmark khách quan']}
              accentColor="#f43f5e"
              prerequisites={[
                {
                  met: hasInputData,
                  warningText: 'Bạn chưa có dữ liệu đầu vào để so sánh. Hãy hoàn thành bước "Phân Tích Bằng AI" hoặc "Tải Lên Dữ Liệu" trước.',
                  goBackScreen: 'step-spec',
                  goBackLabel: 'Quay lại: Phân Tích Bằng AI',
                }
              ]}
              nextScreen="history"
              nextLabel="Lịch Sử & Xuất File"
              nextIcon={<Download size={16} />}
            >
              <ComparisonArena />
            </PageLayout>
          )}

          {/* ── LỊCH SỬ ── */}
          {activeScreen === 'history' && (
            <PageLayout
              stepId="history"
              title="Lịch Sử Phiên Chạy & Xuất Dữ Liệu"
              icon={<Download size={24} />}
              description="Lưu lại toàn bộ các phiên tối ưu hóa đã chạy. Bạn có thể xem lại, so sánh, nạp lại bộ dữ liệu từ phiên cũ, hoặc tải xuống file JSON/CSV để dùng ngay trong hệ thống automation testing."
              contextNote={'<b>Tại sao có màn hình này?</b> Mỗi lần chạy thuật toán, kết quả được tự động lưu lại ở đây. Bạn có thể xuất file để đưa vào Postman, Selenium, JMeter... hoặc nạp lại bộ data cũ để tiếp tục tinh chỉnh mà không phải chạy lại từ đầu.'}
              hints={['Xem tất cả phiên đã chạy', 'Tải JSON / CSV', 'Nạp lại phiên cũ', 'Dùng với Postman / Selenium / JMeter']}
              accentColor="#2dd4bf"
              prerequisites={[
                {
                  met: hasHistory || hasOptimizedResult,
                  warningText: 'Chưa có phiên tối ưu hóa nào được lưu. Hãy chạy thuật toán ở màn hình "Tối Ưu Thuật Toán" ít nhất 1 lần để kết quả xuất hiện tại đây.',
                  goBackScreen: 'optimizer',
                  goBackLabel: 'Đến: Tối Ưu Thuật Toán',
                }
              ]}
            >
              <HistoryManager />
            </PageLayout>
          )}

        </div>

        <footer style={{ padding: '14px 28px', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'right' }}>
          © 2026 Hyperion TestForge — Build v3.0 Multi-Screen
        </footer>
      </main>

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
