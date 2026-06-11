import React from 'react';
import {
  ArrowRight, CheckCircle2, AlertTriangle, Info,
  ArrowLeft
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
  { id: 'prepare', label: 'Phân Tích & Chuẩn Bị', shortLabel: 'Chuẩn Bị', color: '#1d4ed8' },
  { id: 'optimize', label: 'Tối Ưu & So Sánh', shortLabel: 'Tối Ưu', color: '#6d28d9' },
  { id: 'export', label: 'Lịch Sử & Xuất Kết Quả', shortLabel: 'Xuất Bản', color: '#0f766e' },
];

// ─── Prerequisite definition ──────────────────────────────────────────────────
export interface Prerequisite {
  met: boolean;
  warningText: string;
  goBackScreen?: string;
  goBackLabel?: string;
}


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
          background: 'var(--bg-card)',
          border: '1.5px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 18px',
          boxShadow: 'var(--shadow-sm)',
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
                      background: isCurrent ? step.color : isDone || isPast ? 'rgba(15,118,110,0.12)' : 'var(--divider)',
                      color: isCurrent ? '#fff' : isDone || isPast ? 'var(--color-teal)' : 'var(--text-muted)',
                      border: isCurrent ? `2.5px solid ${step.color}` : isDone || isPast ? '2.5px solid rgba(15,118,110,0.45)' : '2.5px solid var(--border-subtle)',
                      boxShadow: isCurrent ? `0 4px 12px ${step.color}40` : 'none',
                      transition: 'all 0.3s ease', flexShrink: 0,
                    }}>
                      {isDone || isPast ? <CheckCircle2 size={15} /> : idx + 1}
                    </div>
                    <span style={{
                      fontSize: '13px',
                      color: isCurrent ? step.color : isDone || isPast ? 'var(--text-secondary)' : 'var(--text-muted)',
                      fontWeight: isCurrent ? 700 : 600, whiteSpace: 'nowrap',
                    }}>
                      {step.label}
                    </span>
                  </button>
                  {idx < WORKFLOW_STEPS.length - 1 && (
                    <div style={{
                      flex: 1, height: '2.5px', margin: '0 12px',
                      background: isDone || isPast
                        ? 'linear-gradient(90deg, rgba(15,118,110,0.6), rgba(15,118,110,0.25))'
                        : 'var(--border-subtle)',
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
        background: `linear-gradient(135deg, ${accentColor}0f 0%, var(--bg-card) 60%)`,
        border: `1.5px solid var(--border-subtle)`,
        borderLeft: `5px solid ${accentColor}`,
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        display: 'flex', alignItems: 'flex-start', gap: '14px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{
          width: '46px', height: '46px', borderRadius: 'var(--radius-sm)',
          background: `${accentColor}1a`, border: `1px solid ${accentColor}38`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, color: accentColor,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 5px 0', letterSpacing: '-0.02em' }}>
            {title}
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.65 }}>
            {description}
          </p>

          {/* Context note: "Tại sao có màn hình này?" */}
          {contextNote && (
            <div style={{
              marginTop: '12px', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
              background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)',
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
          background: 'rgba(180,83,9,0.08)', border: '1.5px solid rgba(180,83,9,0.4)',
        }}>
          <AlertTriangle size={18} style={{ color: '#b45309', flexShrink: 0, marginTop: '1px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13.5px', color: '#b45309', fontWeight: 700, marginBottom: '5px' }}>
              Cần hoàn thành bước trước để dùng được màn hình này
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 10px 0', lineHeight: 1.6, fontWeight: 500 }}>
              {prereq.warningText}
            </p>
            {prereq.goBackScreen && (
              <button
                onClick={() => setActiveScreen(prereq.goBackScreen!)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700,
                  background: 'rgba(180,83,9,0.12)', border: '1.5px solid rgba(180,83,9,0.45)',
                  color: '#b45309', cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseOver={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(180,83,9,0.18)';
                }}
                onMouseOut={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(180,83,9,0.12)';
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
          paddingTop: '8px', borderTop: '1px solid var(--border-subtle)',
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
