import React from 'react';
import { Award, Calculator } from 'lucide-react';

export interface FitnessRecord {
  testId: string;
  validation: number;
  diversity: number;
  security: number;
  boundary: number;
  finalFitness: number;
  note: string;
}

interface FitnessEvaluationProps {
  results?: FitnessRecord[];
}

export const FitnessEvaluation: React.FC<FitnessEvaluationProps> = ({
  results = []
}) => {
  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-card)' }}>
      {/* Title */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Award size={18} style={{ color: 'var(--color-violet)' }} />
          Fitness Evaluation - Đánh giá độ thích nghi
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', marginBottom: 0 }}>
          Độ đo chất lượng của từng cá thể dựa trên các thuộc tính bao phủ biên, tính đa dạng, độ bao phủ yêu cầu (Coverage) và mức độ ưu tiên (Priority).
        </p>
      </div>
 
      {/* Formula Alert Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 16px',
        background: 'rgba(124, 58, 237, 0.06)',
        border: '1px dashed var(--color-violet)',
        borderRadius: '10px',
        color: 'var(--color-violet)',
        fontSize: '13px',
        fontWeight: '600'
      }}>
        <Calculator size={16} />
        <span>Công thức tính điểm: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-violet)', background: 'rgba(124, 58, 237, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>Fitness = (0.4 × Coverage) + (0.3 × Boundary) + (0.1 × Priority) + (0.2 × Diversity) - Penalty</code></span>
      </div>
 
      {/* Evaluation Table */}
      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '8px 12px', fontWeight: 'bold', width: '100px' }}>Test ID</th>
              <th style={{ padding: '8px 12px', fontWeight: 'bold' }}>Coverage</th>
              <th style={{ padding: '8px 12px', fontWeight: 'bold' }}>Diversity</th>
              <th style={{ padding: '8px 12px', fontWeight: 'bold' }}>Priority</th>
              <th style={{ padding: '8px 12px', fontWeight: 'bold' }}>Boundary</th>
              <th style={{ padding: '8px 12px', fontWeight: 'bold', width: '120px' }}>Final Fitness</th>
              <th style={{ padding: '8px 12px', fontWeight: 'bold', width: '150px' }}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Chưa có dữ liệu đánh giá độ thích nghi.
                </td>
              </tr>
            ) : (
              results.map((record, index) => {
                const noteLower = record.note.toLowerCase();
                const isEdge = noteLower.includes('edge') || noteLower.includes('tốt') || noteLower.includes('xuất sắc');
                const isAvg = noteLower.includes('trung bình') || noteLower.includes('ổn');
                
                // Note badge colors
                const badgeBg = isEdge ? 'rgba(13, 148, 136, 0.12)' : isAvg ? 'rgba(180, 83, 9, 0.12)' : 'rgba(100, 116, 139, 0.12)';
                const badgeColor = isEdge ? 'var(--color-teal)' : isAvg ? 'var(--color-yellow)' : 'var(--text-muted)';

                return (
                  <tr
                    key={index}
                    style={{
                      borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                      background: index % 2 === 0 ? 'transparent' : 'rgba(0, 0, 0, 0.01)'
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                      {record.testId}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {(record.validation * 100).toFixed(0)}%
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {(record.diversity * 100).toFixed(0)}%
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {(record.security * 100).toFixed(0)}%
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {(record.boundary * 100).toFixed(0)}%
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <strong style={{
                        fontSize: '14px',
                        color: record.finalFitness >= 0.85 ? 'var(--color-rose)' : record.finalFitness >= 0.7 ? 'var(--color-violet)' : 'var(--color-teal)',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        {record.finalFitness.toFixed(3)}
                      </strong>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        background: badgeBg,
                        color: badgeColor,
                        display: 'inline-block'
                      }}>
                        {record.note}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
