import React from 'react';
import { Sparkles, Zap } from 'lucide-react';

interface OptimizationConfigProps {
  activeProfile?: 'fast' | 'balanced' | 'deep';
  onProfileSelect?: (profile: 'fast' | 'balanced' | 'deep') => void;
  isRunning?: boolean;
  progress?: number;
  onStartOptimization?: () => void;
}

export const OptimizationConfig: React.FC<OptimizationConfigProps> = ({
  activeProfile = 'balanced',
  onProfileSelect,
  isRunning = false,
  progress = 0,
  onStartOptimization
}) => {
  const profiles = [
    {
      id: 'fast' as const,
      title: '⚡ Nhanh (Fast)',
      desc: 'Tiết kiệm thời gian, tối ưu cơ bản độ phủ BVA.',
      meta: '30 Gens | Pop 60',
      activeColor: 'var(--color-teal)'
    },
    {
      id: 'balanced' as const,
      title: '⚖️ Cân bằng (Balanced)',
      desc: 'Độ bao phủ tối ưu, tốc độ và phân tích lai ghép ổn định.',
      meta: '60 Gens | Pop 100',
      activeColor: 'var(--color-violet)'
    },
    {
      id: 'deep' as const,
      title: '🔥 Chuyên sâu (Deep)',
      desc: 'Dò quét cực sâu giá trị biên hiểm hóc và payload bảo mật.',
      meta: '120 Gens | Pop 120',
      activeColor: 'var(--color-rose)'
    }
  ];

  // SVG Circular progress details
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="glass-card" style={{ background: 'var(--bg-card)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        <style>{`
          @media (min-width: 768px) {
            .opt-grid-split {
              display: grid !important;
              grid-template-columns: 3fr 2fr !important;
              gap: 24px;
            }
          }
        `}</style>
        
        <div className="opt-grid-split" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Left: Profile options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Sparkles size={16} style={{ color: 'var(--color-violet)' }} />
              Chọn Chế Độ Cấu Hình Tối Ưu
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {profiles.map((p) => {
                const isActive = activeProfile === p.id;
                const activeBg = p.id === 'fast' 
                  ? 'rgba(15, 118, 110, 0.08)' 
                  : p.id === 'balanced' 
                  ? 'rgba(109, 40, 217, 0.08)' 
                  : 'rgba(190, 18, 60, 0.08)';

                return (
                  <button
                    key={p.id}
                    onClick={() => !isRunning && onProfileSelect?.(p.id)}
                    disabled={isRunning}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      textAlign: 'left',
                      cursor: isRunning ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      background: isActive ? activeBg : 'rgba(0, 0, 0, 0.02)',
                      border: `2px solid ${isActive ? p.activeColor : 'var(--border-subtle)'}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      opacity: isRunning && !isActive ? 0.6 : 1
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--text-primary)' }}>
                        {p.title}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {p.desc}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                      {p.meta}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Circular progress and launch button */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            borderLeft: '1px solid var(--border-subtle)',
            minHeight: '220px'
          }}>
            {isRunning || progress > 0 ? (
              <div style={{ position: 'relative', width: '130px', height: '130px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                  {/* Track circle */}
                  <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="transparent"
                    stroke="var(--border-subtle)"
                    strokeWidth="8"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="transparent"
                    stroke="url(#progressGradient)"
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                  />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ec4899" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                </svg>
                {/* Progress Text overlay */}
                <div style={{
                  position: 'absolute',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {progress}%
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                    {isRunning ? 'Đang chạy' : 'Hoàn tất'}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.02)',
                border: '2px dashed var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                color: 'var(--text-muted)'
              }}>
                <Zap size={32} />
              </div>
            )}

            <button
              onClick={onStartOptimization}
              disabled={isRunning}
              className="btn"
              style={{
                width: '100%',
                maxWidth: '240px',
                background: isRunning 
                  ? 'var(--surface-subtle)' 
                  : 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)', // Pink-purple gradient
                color: isRunning ? 'var(--text-muted)' : '#ffffff',
                padding: '14px 24px',
                fontSize: '14px',
                fontWeight: 800,
                borderRadius: '10px',
                boxShadow: isRunning ? 'none' : '0 4px 16px rgba(139, 92, 246, 0.3)',
                border: 'none',
                cursor: isRunning ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.25s'
              }}
              onMouseEnter={(e) => {
                if (!isRunning) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.45)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isRunning) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(139, 92, 246, 0.3)';
                }
              }}
            >
              <Zap size={16} />
              {isRunning ? 'ĐANG TỐI ƯU HÓA...' : 'BẮT ĐẦU TỐI ƯU HÓA'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
