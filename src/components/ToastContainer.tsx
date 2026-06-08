import React from 'react';
import { useToastStore } from '../store/useToastStore';
import { X, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';

const ICON_MAP = {
  success: { icon: CheckCircle2, color: 'var(--success)', bg: 'rgba(34,197,94,0.08)' },
  error: { icon: XCircle, color: 'var(--error)', bg: 'rgba(239,68,68,0.08)' },
  warning: { icon: AlertTriangle, color: 'var(--warning)', bg: 'rgba(245,158,11,0.08)' },
  info: { icon: Info, color: 'var(--info)', bg: 'rgba(59,130,246,0.08)' },
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '440px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => {
        const { icon: Icon, color, bg } = ICON_MAP[toast.type];

        return (
          <div
            key={toast.id}
            role="alert"
            className="toast-enter"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              background: '#FFFFFF',
              border: `1px solid var(--border-subtle)`,
              borderLeft: `4px solid ${color}`,
              boxShadow: 'var(--shadow-lg)',
              pointerEvents: 'auto',
              animation: 'toastSlideIn 0.35s cubic-bezier(0.21, 1.02, 0.73, 1)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Color accent background */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: bg,
                opacity: 0.6,
                pointerEvents: 'none',
              }}
            />

            <div style={{ flexShrink: 0, position: 'relative', zIndex: 1 }}>
              <Icon size={20} style={{ color }} />
            </div>

            <div
              style={{
                flex: 1,
                fontSize: '13px',
                color: 'var(--text-primary)',
                lineHeight: 1.55,
                whiteSpace: 'pre-line',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {toast.message}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              aria-label="Đóng thông báo"
              style={{
                flexShrink: 0,
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                position: 'relative',
                zIndex: 1,
                transition: 'all 0.15s',
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLElement).style.background = '#EEF1F4';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--surface-subtle)';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
              }}
            >
              <X size={14} />
            </button>

            {/* Auto-dismiss progress bar */}
            {toast.duration && toast.duration > 0 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: '3px',
                  background: color,
                  opacity: 0.5,
                  borderRadius: '0 0 0 4px',
                  animation: `toastProgress ${toast.duration}ms linear forwards`,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
