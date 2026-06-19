import React from 'react';

interface RubricMetric {
  score: number;
  max: number;
  label: string;
}

interface RubricProps {
  rubric: {
    validation: RubricMetric;
    boundary: RubricMetric;
    diversity: RubricMetric;
    security: RubricMetric;
  };
}

const colorMap: Record<string, string> = {
  validation: 'var(--color-violet)',
  boundary: 'var(--color-yellow)',
  diversity: 'var(--color-teal)',
  security: 'var(--color-orange)',
};

export const RubricBoard: React.FC<RubricProps> = ({ rubric }) => {
  if (!rubric) return null;

  return (
    <div className="flex flex-col gap-sm">
      {Object.entries(rubric).map(([key, metric]) => {
        const percentage = Math.round((metric.score / metric.max) * 100) || 0;
        const color = colorMap[key] || 'var(--color-teal)';
        return (
          <div key={key}>
            <div className="flex justify-between" style={{ fontSize: '12px', marginBottom: '4px' }}>
              <span>{metric.label}</span>
              <span>{metric.score}/{metric.max}đ</span>
            </div>
            <div style={{ width: '100%', background: 'var(--surface-subtle)', height: '6px', borderRadius: '3px' }}>
              <div
                style={{
                  width: `${percentage}%`,
                  background: color,
                  height: '100%',
                  borderRadius: '3px',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
