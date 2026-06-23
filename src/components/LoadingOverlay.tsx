import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { useAppStore } from '../store/useAppStore';

/**
 * Component Loading Overlay toàn màn hình.
 * Tự động hiển thị khi có bất kỳ tiến trình API nào đang chạy (isParsing, isEvaluating, isOptimizing).
 */
export const LoadingOverlay: React.FC = () => {
  const { isParsing, isEvaluating, isOptimizing, optimizationPhase } = useAppStore();

  const isLoading = isParsing || isEvaluating || isOptimizing;

  if (!isLoading) return null;

  let message = 'Đang xử lý dữ liệu…';
  if (isParsing) message = 'AI đang phân tích và sinh dữ liệu…';
  if (isEvaluating) message = 'Đang đánh giá chất lượng bộ test…';
  if (isOptimizing) message = optimizationPhase || 'Thuật toán Memetic đang tiến hóa dữ liệu…';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      transition: 'all 0.3s ease',
    }}>
      <div style={{
        background: 'var(--bg-card)',
        padding: '32px 48px',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        border: '1px solid var(--border-subtle)',
        maxWidth: '90%',
        textAlign: 'center'
      }}>
        <LoadingSpinner size={80} icon="sparkles" outerColor="var(--brand-primary)" innerColor="var(--color-teal)" />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ 
            fontSize: 18, 
            fontWeight: 700, 
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em'
          }}>
            Vui lòng đợi giây lát
          </div>
          <div style={{ 
            fontSize: 14, 
            color: 'var(--text-secondary)',
            maxWidth: 300,
            lineHeight: 1.5
          }}>
            {message}
          </div>
        </div>

        {/* Decorator dots */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--brand-primary)',
              animation: 'pulse-dot 1.4s infinite ease-in-out',
              animationDelay: `${i * 0.2}s`
            }} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;
