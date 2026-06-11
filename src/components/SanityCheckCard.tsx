import React from 'react';
import { AlertCircle, CheckCircle, ShieldAlert } from 'lucide-react';

export interface SanityRecord {
  testId: string;
  status: 'Valid' | 'Invalid';
  errorDetected: string;
  severity: 'High' | 'None';
  actionTaken: string;
}

interface SanityCheckCardProps {
  total?: number;
  valid?: number;
  invalid?: number;
  results?: SanityRecord[];
}

export const SanityCheckCard: React.FC<SanityCheckCardProps> = ({
  total = 0,
  valid = 0,
  invalid = 0,
  results = []
}) => {
  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)' }}>
      {/* Title */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <ShieldAlert size={18} style={{ color: 'var(--color-teal)' }} />
          Data Sanity Check - Kiểm tra dữ liệu hợp lệ
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', marginBottom: 0 }}>
          Đảm bảo các kịch bản sinh ra đáp ứng cấu trúc và kiểu dữ liệu trước khi tiến hành tối ưu hóa.
        </p>
      </div>

      {/* Stats Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '12px',
        background: 'var(--brand-50)',
        borderRadius: '12px',
        border: '1px solid var(--border-subtle)',
        fontSize: '14px',
        fontWeight: 'bold'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <span>Tổng F0:</span>
          <span style={{ fontSize: '16px', color: 'var(--color-violet)' }}>{total}</span>
        </div>
        <div style={{ height: '20px', width: '1.5px', background: 'var(--border-subtle)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)' }}>
          <CheckCircle size={16} />
          <span>Hợp lệ:</span>
          <span style={{ fontSize: '16px' }}>{valid}</span>
        </div>
        <div style={{ height: '20px', width: '1.5px', background: 'var(--border-subtle)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--error)' }}>
          <AlertCircle size={16} />
          <span>Bị loại:</span>
          <span style={{ fontSize: '16px' }}>{invalid}</span>
        </div>
      </div>

      {/* Results Table */}
      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '8px 12px', fontWeight: 'bold', width: '100px' }}>Test ID</th>
              <th style={{ padding: '8px 12px', fontWeight: 'bold', width: '110px' }}>Trạng thái</th>
              <th style={{ padding: '8px 12px', fontWeight: 'bold' }}>Lỗi phát hiện</th>
              <th style={{ padding: '8px 12px', fontWeight: 'bold', width: '100px' }}>Mức độ</th>
              <th style={{ padding: '8px 12px', fontWeight: 'bold', width: '200px' }}>Cách xử lý</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Không có bản ghi kiểm tra dữ liệu nào bị lỗi hoặc đang trống.
                </td>
              </tr>
            ) : (
              results.map((record, index) => {
                const isValid = record.status === 'Valid';
                const isHigh = record.severity === 'High';
                
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
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        background: isValid ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: isValid ? 'var(--success)' : 'var(--error)',
                        display: 'inline-block'
                      }}>
                        {isValid ? 'Valid' : 'Invalid'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>
                      {record.errorDetected || 'None'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        color: isHigh ? 'var(--error)' : 'var(--text-muted)',
                        fontWeight: isHigh ? 'bold' : 'normal'
                      }}>
                        {record.severity}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                      {record.actionTaken}
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
