import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Info } from 'lucide-react';
import React from 'react';
import { useAppStore } from '../store/useAppStore';

// ─── Workflow steps definition ─────────────────────────────────────────────────
export interface WorkflowStep {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  { id: 'input', label: 'Đầu vào', shortLabel: 'Đầu vào', color: '#0891B2' },
  { id: 'analyze', label: 'Phân tích', shortLabel: 'Phân tích', color: '#0891B2' },
  { id: 'evaluate', label: 'Đánh giá', shortLabel: 'Đánh giá', color: '#0891B2' },
  { id: 'ga', label: 'Tối ưu GA', shortLabel: 'GA', color: '#4F46E5' },
  { id: 'hc', label: 'Tối ưu HC', shortLabel: 'HC', color: '#4F46E5' },
  { id: 'charts', label: 'Biểu đồ', shortLabel: 'Biểu đồ', color: '#4F46E5' },
  { id: 'export', label: 'Lịch sử & Xuất', shortLabel: 'Xuất', color: '#10B981' },
];

// ─── Prerequisite definition ───────────────────────────────────────────────────
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
  children: React.ReactNode;
}

const stepIndex = (id: string) => WORKFLOW_STEPS.findIndex((s) => s.id === id);

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

  const unmetPrereqs = (prerequisites ?? []).filter((p) => !p.met);
  const allPrereqsMet = unmetPrereqs.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* ── WORKFLOW PROGRESS BAR ── */}
      {stepId && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 18px',
            boxShadow: 'var(--shadow-sm)',
            overflowX: 'auto',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', minWidth: 'max-content' }}>
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
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: isCurrent ? `linear-gradient(90deg, #a855f7, #7c3aed)` : 'none',
                      border: 'none',
                      borderRadius: '99px',
                      padding: isCurrent ? '6px 16px 6px 6px' : '0 4px',
                      cursor: 'pointer',
                      flexShrink: 0,
                      boxShadow: isCurrent ? `0 4px 12px rgba(124, 58, 237, 0.3)` : 'none',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <div
                      style={{
                        width: isCurrent ? '26px' : '32px',
                        height: isCurrent ? '26px' : '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        fontWeight: 700,
                        background: isCurrent
                          ? '#fff'
                          : isDone || isPast
                            ? 'rgba(13,148,136,0.12)'
                            : 'var(--divider)',
                        color: isCurrent
                          ? '#7c3aed'
                          : isDone || isPast
                            ? 'var(--color-teal)'
                            : 'var(--text-muted)',
                        border: isCurrent
                          ? `none`
                          : isDone || isPast
                            ? '2px solid rgba(13,148,136,0.4)'
                            : '2px solid var(--border-subtle)',
                        transition: 'all 0.3s ease',
                        flexShrink: 0,
                      }}
                    >
                      {isDone || isPast ? <CheckCircle2 size={15} /> : idx + 1}
                    </div>
                    <span
                      style={{
                        fontSize: isCurrent ? '13.5px' : '13px',
                        color: isCurrent
                          ? '#fff'
                          : isDone || isPast
                            ? 'var(--text-secondary)'
                            : 'var(--text-muted)',
                        fontWeight: isCurrent ? 600 : 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {step.label}
                    </span>
                  </button>
                  {idx < WORKFLOW_STEPS.length - 1 && (
                    <div
                      style={{
                        width: '40px',
                        flexShrink: 0,
                        height: '2px',
                        margin: '0 12px',
                        background:
                          isDone || isPast
                            ? 'linear-gradient(90deg, rgba(13,148,136,0.5), rgba(13,148,136,0.15))'
                            : 'var(--border-subtle)',
                        transition: 'background 0.4s ease',
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* ── PAGE HEADER ── */}
      <div
        style={{
          background: `linear-gradient(135deg, ${accentColor}0f 0%, var(--bg-card) 55%)`,
          border: `1px solid var(--border-subtle)`,
          borderLeft: `4px solid ${accentColor}`,
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            width: '46px',
            height: '46px',
            borderRadius: 'var(--radius-sm)',
            background: `${accentColor}1a`,
            border: `1px solid ${accentColor}38`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: accentColor,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <h2
            style={{
              fontSize: '19px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '0 0 5px 0',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </h2>
          <p
            style={{
              fontSize: '13.5px',
              color: 'var(--text-secondary)',
              margin: 0,
              lineHeight: 1.65,
            }}
          >
            {description}
          </p>

          {/* Context note: "Tại sao có màn hình này?" */}
          {contextNote && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(59,130,246,0.06)',
                border: '1px solid rgba(59,130,246,0.2)',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
              }}
            >
              <Info size={14} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
              <p
                style={{
                  fontSize: '12.5px',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  lineHeight: 1.65,
                }}
                dangerouslySetInnerHTML={{ __html: contextNote }}
              />
            </div>
          )}

          {hints && hints.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
              {hints.map((hint, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '11px',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    background: `${accentColor}12`,
                    border: `1px solid ${accentColor}28`,
                    color: accentColor,
                    letterSpacing: '0.03em',
                  }}
                >
                  {hint}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── PREREQUISITE WARNINGS ── */}
      {unmetPrereqs.map((prereq, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
            padding: '14px 18px',
            borderRadius: '10px',
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.28)',
          }}
        >
          <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '1px' }} />
          <div style={{ flex: 1 }}>
            <div
              style={{ fontSize: '13px', color: '#f59e0b', fontWeight: 700, marginBottom: '5px' }}
            >
              Cần hoàn thành bước trước để dùng được màn hình này
            </div>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--text-secondary)',
                margin: '0 0 10px 0',
                lineHeight: 1.6,
              }}
            >
              {prereq.warningText}
            </p>
            {prereq.goBackScreen && (
              <button
                onClick={() => setActiveScreen(prereq.goBackScreen!)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  color: '#f59e0b',
                  cursor: 'pointer',
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
      <div
        style={{
          opacity: !allPrereqsMet ? 0.4 : 1,
          pointerEvents: !allPrereqsMet ? 'none' : 'auto',
          transition: 'opacity 0.3s',
          minWidth: 0,
        }}
      >
        {children}
      </div>

      {/* ── NEXT STEP CTA ── */}
      {nextScreen && nextLabel && allPrereqsMet && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            paddingTop: '8px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <button
            className="btn btn-primary"
            onClick={handleNext}
            style={{
              padding: '12px 28px',
              fontSize: '14.5px',
              borderRadius: 'var(--radius-lg)',
              marginTop: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            {nextIcon && <span style={{ opacity: 0.9 }}>{nextIcon}</span>}
            <span>Tiếp theo: {nextLabel}</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};
