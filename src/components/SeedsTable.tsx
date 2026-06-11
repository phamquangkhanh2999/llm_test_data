import { Download } from 'lucide-react';
import React, { useMemo } from 'react';

export interface SeedData {
  method?: string;
  scenario?: string;
  expectedResult?: string;
  [key: string]: any;
}

export interface FieldConstraint {
  name: string;
  type: string;
  [key: string]: any;
}

interface SeedsTableProps {
  data: SeedData[];
  fields?: FieldConstraint[];
  onAnalyze?: () => void;
  onDownload?: () => void;
}

export const SeedsTable: React.FC<SeedsTableProps> = ({
  data = [],
  fields = [],
  onDownload,
}) => {
  // Compute dynamic columns based on parsed fields constraints, falling back to data keys
  const columns = useMemo(() => {
    if (fields && fields.length > 0) {
      return fields.map((f) => ({
        name: f.name,
        label: f.name.charAt(0).toUpperCase() + f.name.slice(1),
        type: f.type,
      }));
    }

    // Fallback if no fields are provided: extract keys from the data object itself
    const keys = new Set<string>();
    data.forEach((item) => {
      Object.keys(item).forEach((key) => {
        if (
          ![
            'method',
            'scenario',
            'expectedResult',
            'desc',
            'description',
            'isMock',
            'engine',
          ].includes(key)
        ) {
          keys.add(key);
        }
      });
    });

    // If no keys could be extracted, use defaults
    if (keys.size === 0) {
      return [
        { name: 'username', label: 'Username', type: 'string' },
        { name: 'password', label: 'Password', type: 'string' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'age', label: 'Age', type: 'number' },
      ];
    }

    return Array.from(keys).map((k) => ({
      name: k,
      label: k.charAt(0).toUpperCase() + k.slice(1),
      type: 'string',
    }));
  }, [fields, data]);

  return (
    <div
      className='glass-card'
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        background: 'var(--bg-card)',
      }}
    >
      {/* Header section with actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '12px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            DANH SÁCH PHÁT SINH TỰ ĐỘNG (INITIAL SEEDS)
          </h2>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              marginTop: '2px',
              marginBottom: 0,
            }}
          >
            Tập dữ liệu mầm ban đầu được tạo ra bằng các phương pháp khác nhau để bắt đầu tiến hóa.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* <button
            onClick={onAnalyze}
            className="btn"
            style={{
              background: '#22c55e', // Green color
              color: '#ffffff',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#16a34a')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#22c55e')}
          >
            <Zap size={14} />
            Phân Tích Dữ Liệu
          </button> */}
          <button
            onClick={onDownload}
            className='btn'
            style={{
              background: '#3b82f6', // Blue color
              color: '#ffffff',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 700,
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#2563eb')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#3b82f6')}
          >
            <Download size={14} />
            Tải Dữ Liệu F0
          </button>
        </div>
      </div>

      {/* Table section */}
      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)' }}>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}
        >
          <thead>
            <tr
              style={{
                borderBottom: '2px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <th style={{ padding: '10px 12px', fontWeight: 'bold', width: '60px' }}>STT</th>
              <th style={{ padding: '10px 12px', fontWeight: 'bold', width: '120px' }}>
                Phương pháp
              </th>
              {columns.map((col) => (
                <th key={col.name} style={{ padding: '10px 12px', fontWeight: 'bold' }}>
                  {col.label}
                </th>
              ))}
              <th style={{ padding: '10px 12px', fontWeight: 'bold', width: '220px' }}>
                Mô tả kịch bản
              </th>
              <th style={{ padding: '10px 12px', fontWeight: 'bold', width: '180px' }}>
                Kết quả mong đợi
              </th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={4 + columns.length}
                  style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}
                >
                  Chưa có dữ liệu hạt giống. Vui lòng chạy phân tích đặc tả bằng AI hoặc tải tệp
                  lên.
                </td>
              </tr>
            ) : (
              data.map((seed, idx) => {
                const methodLabel = seed.method || 'Hybrid';
                const isHybrid = methodLabel.toLowerCase() === 'hybrid';
                const isBva = methodLabel.toLowerCase() === 'bva';
                const isEp = methodLabel.toLowerCase() === 'ep';

                // Color badges matching system styles
                const badgeBg = isHybrid
                  ? 'rgba(13, 148, 136, 0.12)'
                  : isBva
                    ? 'rgba(109, 40, 217, 0.12)'
                    : isEp
                      ? 'rgba(59, 130, 246, 0.12)'
                      : 'rgba(100, 116, 139, 0.12)';
                const badgeColor = isHybrid
                  ? 'var(--brand-600)'
                  : isBva
                    ? 'var(--color-violet)'
                    : isEp
                      ? '#2563eb'
                      : 'var(--text-muted)';

                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(0, 0, 0, 0.01)',
                      transition: 'background 0.15s',
                    }}
                  >
                    <td style={{ padding: '12px 12px', color: 'var(--text-muted)' }}>#{idx + 1}</td>
                    <td style={{ padding: '12px 12px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          background: badgeBg,
                          color: badgeColor,
                          display: 'inline-block',
                        }}
                      >
                        {methodLabel}
                      </span>
                    </td>
                    {columns.map((col) => {
                      const val = seed[col.name];
                      return (
                        <td
                          key={col.name}
                          style={{
                            padding: '12px 12px',
                            fontFamily:
                              col.type === 'number' || col.type === 'card'
                                ? 'var(--font-mono)'
                                : 'inherit',
                          }}
                        >
                          {val !== undefined ? String(val) : '-'}
                        </td>
                      );
                    })}
                    <td
                      style={{
                        padding: '12px 12px',
                        color: 'var(--text-secondary)',
                        fontSize: '12.5px',
                        lineHeight: '1.4',
                      }}
                    >
                      {seed.scenario || seed.desc || seed.description || '-'}
                    </td>
                    <td style={{ padding: '12px 12px', fontSize: '12.5px', fontWeight: '500' }}>
                      <span
                        style={{
                          color:
                            (seed.expectedResult || '').toLowerCase().includes('lỗi') ||
                            (seed.expectedResult || '').toLowerCase().includes('chặn')
                              ? 'var(--error)'
                              : 'var(--success)',
                        }}
                      >
                        {seed.expectedResult || 'Hợp lệ'}
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
