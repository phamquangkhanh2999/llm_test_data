import React from 'react';
import {
  ArrowRight, CheckCircle2, AlertTriangle, Info,
  ArrowLeft, Zap, Archive,
  ChevronRight, Sparkles, Upload
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

// ─── Workflow steps definition ─────────────────────────────────────────────────
export interface WorkflowStep {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  { id: 'prepare', label: 'Chuẩn Bị Dữ Liệu', shortLabel: 'Dữ Liệu', color: '#3b82f6' },
  { id: 'optimize', label: 'Tối Ưu & So Sánh', shortLabel: 'Tối Ưu', color: '#a78bfa' },
  { id: 'export', label: 'Xuất Kết Quả', shortLabel: 'Xuất File', color: '#2dd4bf' },
];

// ─── Prerequisite definition ───────────────────────────────────────────────────
export interface Prerequisite {
  met: boolean;
  warningText: string;
  goBackScreen?: string;
  goBackLabel?: string;
}

// ─── DataFlowPanel: shows data lineage for current screen ─────────────────────
const DataFlowPanel: React.FC<{ currentScreen: string }> = ({ currentScreen }) => {
  const {
    schemaName, parsedSchema, initialSeeds,
    optimizedDataset, historyRuns, setActiveScreen,
  } = useAppStore();

  const hasSchema = parsedSchema.length > 0;
  const hasSeeds = initialSeeds.length > 0;
  const hasOptimized = optimizedDataset.length > 0;
  const hasHistory = historyRuns.length > 0;

  // Each node in the data pipeline
  const nodes: {
    id: string; icon: React.ReactNode; label: string;
    value: string | null; sublabel: string;
    color: string; done: boolean; screen: string;
  }[] = [
      {
        id: 'source',
        icon: hasSeeds && parsedSchema.length > 0 ? <Upload size={14} /> : <Sparkles size={14} />,
        label: 'Nguồn dữ liệu',
        value: hasSchema ? schemaName || 'Đặc tả' : null,
        sublabel: hasSchema
          ? `${parsedSchema.length} trường · ${initialSeeds.length} bản ghi F0`
          : 'Chưa có — cần Phân Tích AI hoặc Upload file',
        color: '#3b82f6',
        done: hasSchema && hasSeeds,
        screen: 'prepare',
      },
      {
        id: 'optimizer',
        icon: <Zap size={14} />,
        label: 'Tối ưu hóa (GA + HC)',
        value: hasOptimized ? `${optimizedDataset.length} test cases` : null,
        sublabel: hasOptimized
          ? `Sinh từ ${initialSeeds.length} hạt giống · GA + Hill Climbing`
          : hasSeeds
            ? 'Sẵn sàng chạy — bấm ▶ ở màn hình Tối Ưu'
            : 'Chờ nguồn dữ liệu từ bước trên',
        color: '#a78bfa',
        done: hasOptimized,
        screen: 'optimize',
      },
      {
        id: 'history',
        icon: <Archive size={14} />,
        label: 'Kết quả lưu trữ',
        value: hasHistory ? `${historyRuns.length} phiên` : null,
        sublabel: hasHistory
          ? `Phiên gần nhất: ${historyRuns[0]?.schemaName ?? '—'}`
          : 'Chưa có — chạy thuật toán ít nhất 1 lần',
        color: '#2dd4bf',
        done: hasHistory,
        screen: 'export',
      },
    ];

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '12px',
      padding: '10px 16px',
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{
        fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em',
        color: 'var(--text-muted)', textTransform: 'uppercase',
        marginBottom: '8px',
      }}>
        📊 Trạng thái dữ liệu trong phiên này
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: '0' }}>
        {nodes.map((node, idx) => {
          const isCurrent =
            (currentScreen === 'prepare') && node.id === 'source'
            || currentScreen === 'optimize' && node.id === 'optimizer'
            || (currentScreen === 'export') && node.id === 'history';

          return (
            <React.Fragment key={node.id}>
              <button
                onClick={() => setActiveScreen(node.screen)}
                style={{
                  flex: 1,
                  background: isCurrent
                    ? `${node.color}12`
                    : node.done
                      ? 'rgba(13,148,136,0.04)'
                      : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${isCurrent ? node.color + '50' : node.done ? 'rgba(13,148,136,0.2)' : 'var(--border-subtle)'}`,
                  borderRadius: '10px',
                  padding: '8px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = `${node.color}60`;
                  (e.currentTarget as HTMLElement).style.background = `${node.color}10`;
                }}
                onMouseOut={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = isCurrent ? `${node.color}50` : node.done ? 'rgba(13,148,136,0.2)' : 'var(--border-subtle)';
                  (e.currentTarget as HTMLElement).style.background = isCurrent ? `${node.color}12` : node.done ? 'rgba(13,148,136,0.04)' : 'rgba(0,0,0,0.02)';
                }}
                onFocus={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = `${node.color}60`;
                  (e.currentTarget as HTMLElement).style.background = `${node.color}10`;
                }}
                onBlur={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = isCurrent ? `${node.color}50` : node.done ? 'rgba(13,148,136,0.2)' : 'var(--border-subtle)';
                  (e.currentTarget as HTMLElement).style.background = isCurrent ? `${node.color}12` : node.done ? 'rgba(13,148,136,0.04)' : 'rgba(0,0,0,0.02)';
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <span style={{
                    color: node.done ? '#0D9488' : isCurrent ? node.color : 'var(--text-muted)',
                  }}>
                    {node.done ? <CheckCircle2 size={14} /> : node.icon}
                  </span>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, letterSpacing: '0.03em',
                    color: isCurrent ? node.color : node.done ? '#0D9488' : 'var(--text-muted)',
                    textTransform: 'uppercase',
                  }}>
                    {node.label}
                  </span>
                </div>

                {/* Value (big) */}
                {node.value ? (
                  <div style={{
                    fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)',
                    letterSpacing: '-0.02em', marginBottom: '4px', lineHeight: 1.1,
                  }}>
                    {node.value}
                  </div>
                ) : (
                  <div style={{
                    fontSize: '13px', fontWeight: 600,
                    color: isCurrent ? node.color + 'cc' : 'var(--text-muted)',
                    marginBottom: '4px',
                  }}>
                    —
                  </div>
                )}

                {/* Sublabel */}
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {node.sublabel}
                </div>
              </button>

              {idx < nodes.length - 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', padding: '0 8px',
                  color: nodes[idx].done ? '#0D9488' : 'rgba(0,0,0,0.15)',
                }}>
                  <ChevronRight size={18} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};


// ─── PageLayout ────────────────────────────────────────────────────────────────
interface PageLayoutProps {
  stepId?: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  /** Giải thích ngắn: màn hình này tồn tại vì lý do gì */
  contextNote?: string;
  hints?: string[];
  prerequisites?: Prerequisite[];
  nextScreen?: string;
  nextLabel?: string;
  nextIcon?: React.ReactNode;
  accentColor?: string;
  /** Ẩn data flow panel (ví dụ: trang dashboard) */
  hideFlowPanel?: boolean;
  children: React.ReactNode;
}

const stepIndex = (id: string) => WORKFLOW_STEPS.findIndex(s => s.id === id);

export const PageLayout: React.FC<PageLayoutProps> = ({
  stepId,
  title,
  icon,
  description,
  contextNote,
  hints,
  prerequisites,
  nextScreen,
  nextLabel,
  nextIcon,
  accentColor = '#2dd4bf',
  hideFlowPanel = false,
  children,
}) => {
  const { setActiveScreen, completedScreens, markScreenCompleted } = useAppStore();

  const currentIdx = stepId ? stepIndex(stepId) : -1;

  const handleNext = () => {
    if (stepId) markScreenCompleted(stepId);
    if (nextScreen) setActiveScreen(nextScreen);
  };

  const unmetPrereqs = (prerequisites ?? []).filter(p => !p.met);
  const allPrereqsMet = unmetPrereqs.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── WORKFLOW PROGRESS BAR ── */}
      {stepId && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '12px',
          padding: '10px 18px',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {WORKFLOW_STEPS.map((step, idx) => {
              const isDone = completedScreens.includes(step.id);
              const isCurrent = step.id === stepId;
              const isPast = idx < currentIdx;

              return (
                <React.Fragment key={step.id}>
                  <button
                    onClick={() => setActiveScreen(step.id)}
                    title={step.label}
                    style={{
                      display: 'flex', alignItems: 'center',
                      gap: '8px', background: 'none', border: 'none',
                      cursor: 'pointer', padding: '0 4px', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', fontWeight: 700,
                      background: isCurrent ? step.color : isDone || isPast ? 'rgba(45,212,191,0.18)' : 'rgba(255,255,255,0.05)',
                      color: isCurrent ? '#000' : isDone || isPast ? '#2dd4bf' : 'var(--text-muted)',
                      border: isCurrent ? `2px solid ${step.color}` : isDone || isPast ? '2px solid rgba(45,212,191,0.4)' : '2px solid rgba(255,255,255,0.09)',
                      boxShadow: isCurrent ? `0 0 14px ${step.color}55` : 'none',
                      transition: 'all 0.3s ease', flexShrink: 0,
                    }}>
                      {isDone || isPast ? <CheckCircle2 size={15} /> : idx + 1}
                    </div>
                    <span style={{
                      fontSize: '13px',
                      color: isCurrent ? step.color : isDone || isPast ? 'var(--text-secondary)' : 'var(--text-muted)',
                      fontWeight: isCurrent ? 700 : 500, whiteSpace: 'nowrap',
                    }}>
                      {step.label}
                    </span>
                  </button>
                  {idx < WORKFLOW_STEPS.length - 1 && (
                    <div style={{
                      flex: 1, height: '2px', margin: '0 12px',
                      background: isDone || isPast
                        ? 'linear-gradient(90deg, rgba(45,212,191,0.5), rgba(45,212,191,0.15))'
                        : 'rgba(255,255,255,0.06)',
                      transition: 'background 0.4s ease',
                    }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DATA FLOW PANEL ── */}
      {/* {!hideFlowPanel && stepId && (
        <DataFlowPanel currentScreen={stepId} />
      )} */}

      {/* ── PAGE HEADER ── */}
      <div style={{
        background: `linear-gradient(135deg, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.5) 100%)`,
        border: `1px solid ${accentColor}28`,
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: '12px',
        padding: '12px 18px',
        display: 'flex', alignItems: 'flex-start', gap: '12px',
      }}>
        <div style={{
          width: '46px', height: '46px', borderRadius: '11px',
          background: `${accentColor}1a`, border: `1px solid ${accentColor}38`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, color: accentColor,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#fff', margin: '0 0 5px 0', letterSpacing: '-0.02em' }}>
            {title}
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.65 }}>
            {description}
          </p>

          {/* Context note: "Tại sao có màn hình này?" */}
          {contextNote && (
            <div style={{
              marginTop: '12px', padding: '10px 14px', borderRadius: '8px',
              background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)',
              display: 'flex', gap: '10px', alignItems: 'flex-start',
            }}>
              <Info size={14} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.65 }}
                dangerouslySetInnerHTML={{ __html: contextNote }}
              />
            </div>
          )}

          {hints && hints.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
              {hints.map((hint, i) => (
                <span key={i} style={{
                  fontSize: '11px', padding: '3px 10px', borderRadius: '20px',
                  background: `${accentColor}12`, border: `1px solid ${accentColor}28`,
                  color: accentColor, letterSpacing: '0.03em',
                }}>
                  {hint}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── PREREQUISITE WARNINGS ── */}
      {unmetPrereqs.map((prereq, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: '14px',
          padding: '14px 18px', borderRadius: '10px',
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.28)',
        }}>
          <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '1px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', color: '#f59e0b', fontWeight: 700, marginBottom: '5px' }}>
              Cần hoàn thành bước trước để dùng được màn hình này
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 10px 0', lineHeight: 1.6 }}>
              {prereq.warningText}
            </p>
            {prereq.goBackScreen && (
              <button
                onClick={() => setActiveScreen(prereq.goBackScreen!)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600,
                  background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                  color: '#f59e0b', cursor: 'pointer',
                }}
              >
                <ArrowLeft size={13} />
                {prereq.goBackLabel ?? 'Quay lại bước trước'}
              </button>
            )}
          </div>
        </div>
      ))}

      {/* ── PAGE CONTENT ── */}
      <div style={{
        opacity: !allPrereqsMet ? 0.4 : 1,
        pointerEvents: !allPrereqsMet ? 'none' : 'auto',
        transition: 'opacity 0.3s',
        minWidth: 0,
      }}>
        {children}
      </div>

      {/* ── NEXT STEP CTA ── */}
      {nextScreen && nextLabel && allPrereqsMet && (
        <div style={{
          display: 'flex', justifyContent: 'flex-end',
          paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)',
        }}>
          <button
            onClick={handleNext}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 24px', borderRadius: '10px',
              background: `linear-gradient(135deg, ${accentColor}cc, ${accentColor}80)`,
              border: `1px solid ${accentColor}55`, color: '#fff',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              boxShadow: `0 4px 20px ${accentColor}30`,
              transition: 'all 0.2s ease',
            }}
            onMouseOver={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 28px ${accentColor}50`;
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 20px ${accentColor}30`;
            }}
            onFocus={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 28px ${accentColor}50`;
            }}
            onBlur={e => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 4px 20px ${accentColor}30`;
            }}
          >
            {nextIcon && <span style={{ opacity: 0.9 }}>{nextIcon}</span>}
            <span>Tiếp theo: {nextLabel}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
