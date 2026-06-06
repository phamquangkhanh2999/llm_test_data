import React from 'react';
import { Cpu, Sparkles } from 'lucide-react';

/**
 * Component spinner xoay động 2 vòng dùng chung toàn ứng dụng.
 * 
 * Props:
 * - size: kích thước vòng ngoài (mặc định 80px)
 * - outerColor: màu vòng ngoài (mặc định teal)
 * - innerColor: màu vòng trong (mặc định violet)
 * - icon: icon ở giữa - 'cpu' | 'sparkles' | ReactNode (mặc định 'cpu')
 * - iconSize: kích thước icon giữa (mặc định 28)
 */
interface LoadingSpinnerProps {
  size?: number;
  outerColor?: string;
  innerColor?: string;
  icon?: 'cpu' | 'sparkles' | React.ReactNode;
  iconSize?: number;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 80,
  outerColor = 'var(--color-teal)',
  innerColor = 'var(--color-violet)',
  icon = 'cpu',
  iconSize = 28,
  className,
}) => {
  const outerColorRgba = outerColor.startsWith('var')
    ? 'rgba(45, 212, 191, 0.1)'
    : `${outerColor}1a`;
  const innerColorRgba = innerColor.startsWith('var')
    ? 'rgba(167, 139, 250, 0.1)'
    : `${innerColor}1a`;

  const renderIcon = () => {
    if (icon === 'cpu') return <Cpu size={iconSize} style={{ color: outerColor }} />;
    if (icon === 'sparkles') return (
      <Sparkles
        size={iconSize}
        className="force-animate"
        style={{ color: outerColor, animation: 'spinner-pulse 2s infinite ease-in-out' }}
      />
    );
    return icon as React.ReactNode;
  };

  const inset = Math.round(size * 0.1);

  return (
    <>
      <style>{`
        @keyframes spinner-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes spinner-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        .spinner-layer {
          position: absolute;
          border-radius: 50%;
          box-sizing: border-box;
        }
        .force-animate {
          animation-duration: inherit;
        }
      `}</style>
      <div
        className={`${className || ''} force-animate`}
        style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
      >
        {/* Vòng ngoài — xoay thuận */}
        <div
          className="spinner-layer force-animate"
          style={{
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            border: `4px solid ${outerColorRgba}`,
            borderTop: `4px solid ${outerColor}`,
            animation: 'spinner-spin 2s linear infinite',
          }}
        />
        {/* Vòng trong — xoay ngược */}
        <div
          className="spinner-layer force-animate"
          style={{
            top: inset,
            left: inset,
            right: inset,
            bottom: inset,
            border: `4px solid ${innerColorRgba}`,
            borderBottom: `4px solid ${innerColor}`,
            animation: 'spinner-spin 1.5s linear infinite reverse',
          }}
        />
        {/* Icon trung tâm */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {renderIcon()}
        </div>
      </div>
    </>
  );
};
