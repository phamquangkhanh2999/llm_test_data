import React from 'react';
import { Cpu } from 'lucide-react';

export interface AlgorithmMetrics {
  id: string;
  name: string;
  progress: number;
  execTime: number; // in ms
  isActive: boolean;
  isRunning: boolean;
}

interface AlgorithmCardsProps {
  algorithms?: AlgorithmMetrics[];
  onSelect?: (id: string) => void;
}

export const AlgorithmCards: React.FC<AlgorithmCardsProps> = ({
  algorithms = [],
  onSelect
}) => {
  const getColors = (id: string) => {
    switch (id) {
      case 'traditional':
      case 'baseline':
        return {
          color: '#3b82f6', // Blue
          bg: 'rgba(59, 130, 246, 0.05)',
          border: 'rgba(59, 130, 246, 0.35)',
          glow: 'rgba(59, 130, 246, 0.15)'
        };
      case 'ga':
      case 'genetic':
        return {
          color: '#10b981', // Green
          bg: 'rgba(16, 185, 129, 0.05)',
          border: 'rgba(16, 185, 129, 0.35)',
          glow: 'rgba(16, 185, 129, 0.15)'
        };
      case 'hc':
      case 'local':
        return {
          color: '#8b5cf6', // Purple
          bg: 'rgba(139, 92, 246, 0.05)',
          border: 'rgba(139, 92, 246, 0.35)',
          glow: 'rgba(139, 92, 246, 0.15)'
        };
      case 'hybrid':
      default:
        return {
          color: '#ec4899', // Pink
          bg: 'rgba(236, 72, 153, 0.05)',
          border: 'rgba(236, 72, 153, 0.35)',
          glow: 'rgba(236, 72, 153, 0.15)'
        };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>
        Cấu hình thuật toán & Trạng thái chạy song song
      </h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        {algorithms.map((algo) => {
          const styleConfig = getColors(algo.id);
          const isSelected = algo.isActive;
          const statusText = algo.isRunning 
            ? 'Đang chạy' 
            : isSelected 
            ? 'Đã chọn' 
            : 'Đã hoàn tất';

          return (
            <div
              key={algo.id}
              onClick={() => onSelect?.(algo.id)}
              style={{
                background: styleConfig.bg,
                border: `2px solid ${isSelected ? styleConfig.color : 'var(--border-subtle)'}`,
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.25s',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                position: 'relative',
                boxShadow: isSelected ? `0 6px 16px ${styleConfig.glow}` : 'none'
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = styleConfig.border;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {/* Header inside Card */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={16} style={{ color: styleConfig.color }} />
                  <span style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--text-primary)' }}>
                    {algo.name}
                  </span>
                </div>
                {/* Status Badge */}
                <span style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  background: isSelected ? styleConfig.color : 'rgba(0, 0, 0, 0.05)',
                  color: isSelected ? '#ffffff' : 'var(--text-secondary)'
                }}>
                  {statusText}
                </span>
              </div>

              {/* Progress and running time */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span>Tiến trình:</span>
                  <span style={{ fontWeight: 'bold' }}>{algo.progress}%</span>
                </div>
                {/* Progress bar container */}
                <div style={{ height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${algo.progress}%`,
                    background: styleConfig.color,
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              {/* Time display */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11.5px',
                color: 'var(--text-muted)',
                borderTop: '1px solid rgba(0, 0, 0, 0.05)',
                paddingTop: '8px',
                marginTop: '4px'
              }}>
                <span>Thời gian chạy:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                  {algo.execTime > 0 ? `${algo.execTime} ms` : '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
