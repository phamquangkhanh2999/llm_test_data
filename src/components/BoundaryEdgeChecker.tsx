import React from 'react';
import { Target, CheckCircle } from 'lucide-react';

export interface BoundaryRecord {
  fieldName: string;
  boundaryType: string;
  testValue: any;
  expectedResult: string;
  status: 'Valid' | 'Invalid';
}

interface BoundaryEdgeCheckerProps {
  totalEdgeCases?: number;
  validCount?: number;
  records?: BoundaryRecord[];
}

export const BoundaryEdgeChecker: React.FC<BoundaryEdgeCheckerProps> = ({
  totalEdgeCases = 0,
  validCount = 0,
  records = []
}) => {
  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-card)' }}>
      {/* Title */}
      <div>
        <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Target size={18} style={{ color: 'var(--color-rose)' }} />
          Boundary/Edge Checker - Kiểm duyệt giá trị biên
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>
          Kiểm duyệt độ bao phủ của các ca biên hiểm hóc (BVA) sát nút biên giới hạn của miền giá trị.
        </p>
      </div>

      {/* Stats Header Bar */}
      <div style={{
        display: 'flex',
        gap: '24px',
        padding: '12px 16px',
        background: 'rgba(225, 29, 72, 0.04)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        fontSize: '13px',
        fontWeight: 'bold'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
          <span>Tổng edge cases:</span>
          <span style={{ color: 'var(--color-rose)', fontSize: '15px' }}>{totalEdgeCases}</span>
        </div>
        <div style={{ width: '1.5px', height: '18px', background: 'var(--border-subtle)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)' }}>
          <CheckCircle size={14} />
          <span>Hợp lệ:</span>
          <span style={{ fontSize: '15px' }}>{validCount}</span>
        </div>
      </div>

      {/* Boundary cases Table */}
      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '8px 12px', fontWeight: 'bold' }}>Tên trường</th>
              <th style={{ padding: '8px 12px', fontWeight: 'bold', width: '140px' }}>Loại biên</th>
              <th style={{ padding: '8px 12px', fontWeight: 'bold' }}>Giá trị kiểm thử</th>
              <th style={{ padding: '8px 12px', fontWeight: 'bold', width: '220px' }}>Expected Result</th>
              <th style={{ padding: '8px 12px', fontWeight: 'bold', width: '120px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Không phát hiện ca biên nào được chạy hoặc kiểm duyệt.
                </td>
              </tr>
            ) : (
              records.map((row, idx) => {
                const isValid = row.status === 'Valid';
                
                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(0, 0, 0, 0.01)',
                      transition: 'background 0.15s'
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: 'var(--color-teal)' }}>
                      {row.fieldName}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        background: 'rgba(0, 0, 0, 0.04)',
                        color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        {row.boundaryType}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)' }}>
                      {row.testValue !== undefined && row.testValue !== null ? String(row.testValue) : 'null'}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                      {row.expectedResult}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        background: isValid ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: isValid ? 'var(--success)' : 'var(--error)',
                        display: 'inline-block'
                      }}>
                        {row.status}
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
