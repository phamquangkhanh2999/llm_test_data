import { Download } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import type { CoverageBreakdown } from '../types/testcase';
import { TruncatedText } from './TruncatedText';

export interface SeedData {
  tcId?: string;
  method?: string;
  scenario?: string;
  expectedResult?: string;
  errorDescription?: string;
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
  fitnessRecords?: any[];
  coverageBreakdown?: CoverageBreakdown;
  coverageSummary?: any;
  onDownload?: () => void;
  onAnalyze?: () => void;
  sanityRecords?: any[];
}

export const SeedsTable: React.FC<SeedsTableProps> = ({
  data = [],
  fields = [],
  fitnessRecords = [],
  coverageBreakdown,
  coverageSummary,
  onDownload,
  onAnalyze: _onAnalyze,
  sanityRecords: _sanityRecords,
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
            'tcId', 'method', 'scenario', 'expectedResult', 'errorDescription',
            'desc', 'description', 'isMock', 'engine', 'fitness',
            'llmFitness', 'gaFitness', 'hcFitness', 'origin', 'category',
          ].includes(key)
        ) {
          keys.add(key);
        }
      });
    });

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

  // Sort data by field name it tests
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const fieldNames = fields?.map(f => f.name.toLowerCase()) || [];
    return [...data].sort((a, b) => {
      const getTargetField = (scenario: string) => {
        if (!scenario) return 'zz_unknown';
        const s = scenario.toLowerCase();
        for (const f of fieldNames) {
          if (s.includes(f) || s.includes(`trường ${f}`)) return f;
        }
        return 'zz_unknown';
      };
      const fieldA = getTargetField(a.scenario || a.desc || a.description || '');
      const fieldB = getTargetField(b.scenario || b.desc || b.description || '');
      if (fieldA !== fieldB) return fieldA.localeCompare(fieldB);
      return (a.scenario || '').localeCompare(b.scenario || '');
    });
  }, [data, fields]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [customPageSize, setCustomPageSize] = useState('');

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = useMemo(() => {
    return sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleCustomPageSizeChange = (val: string) => {
    setCustomPageSize(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setPageSize(parsed);
      setCurrentPage(1);
    }
  };

  return (
    <div
      className='glass-card'
      style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-card)' }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '12px',
        }}
      >
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase' }}>
            DANH SÁCH LLM SINH ({data.length} TEST CASES)
          </h2>
        </div>

        {/* Coverage Panel — 3 loại */}
        {coverageSummary ? (
          <div
            style={{
              background: 'rgba(13,148,136,0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '10px 14px',
              minWidth: '260px',
              fontSize: '11px',
            }}
          >
            <div style={{ fontWeight: 'bold', color: 'var(--color-teal)', marginBottom: '6px', fontSize: '11.5px' }}>
              📊 Hợp Đồng Độ Phủ (Coverage Contract)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '10px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '2px 4px' }}>Loại kịch bản</th>
                  <th style={{ padding: '2px 4px', textAlign: 'center' }}>Yêu cầu</th>
                  <th style={{ padding: '2px 4px', textAlign: 'center' }}>Sinh được</th>
                  <th style={{ padding: '2px 4px', textAlign: 'right' }}>Tỷ lệ</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(coverageSummary).map(([key, val]: [string, any]) => {
                  const req = val?.required ?? 0;
                  const act = val?.actual ?? 0;
                  const pct = req > 0 ? Math.round((act / req) * 100) : 100;
                  const label = key.charAt(0).toUpperCase() + key.slice(1);
                  const pctColor = pct === 100 ? 'var(--success)' : pct >= 70 ? 'var(--color-violet)' : 'var(--error)';
                  return (
                    <tr key={key} style={{ borderBottom: '1px solid rgba(0,0,0,0.02)' }}>
                      <td style={{ padding: '3px 4px', fontWeight: '500' }}>{label}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'center' }}>{req}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'center', fontWeight: 'bold', color: pctColor }}>{act}</td>
                      <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 'bold', color: pctColor }}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          coverageBreakdown && (
            <div
              style={{
                background: 'rgba(13,148,136,0.06)',
                border: '1px solid rgba(13,148,136,0.2)',
                borderRadius: '10px',
                padding: '10px 14px',
                minWidth: '220px',
                fontSize: '11px',
              }}
            >
              <div style={{ fontWeight: 'bold', color: 'var(--color-teal)', marginBottom: '6px', fontSize: '11.5px' }}>
                📊 Coverage Breakdown
              </div>
              {[
                { label: 'Functional', value: coverageBreakdown.functional, color: '#10b981' },
                { label: 'Boundary', value: coverageBreakdown.boundary, color: '#8b5cf6' },
                { label: 'Negative', value: coverageBreakdown.negative, color: '#f59e0b' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ marginBottom: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    <span style={{ fontWeight: 'bold', color }}>{Math.round(value * 100)}%</span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--border-subtle)', borderRadius: '2px' }}>
                    <div style={{ height: '100%', width: `${Math.round(value * 100)}%`, background: color, borderRadius: '2px', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <button
            onClick={onDownload}
            className='btn'
            style={{
              background: '#3b82f6',
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

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)' }}>
        <table
          style={{ width: '100%', minWidth: 'max-content', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left', wordBreak: 'break-word' }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '8px 8px', fontWeight: 'bold', width: '50px' }}>STT</th>
              <th style={{ padding: '8px 8px', fontWeight: 'bold', width: '90px' }}>Mã test data</th>
              <th style={{ padding: '8px 8px', fontWeight: 'bold', width: '250px' }}>Kịch bản</th>
              <th style={{ padding: '8px 8px', fontWeight: 'bold', width: '110px' }}>Phương pháp</th>
              {/* Dynamic Fields */}
              {columns.map((col) => (
                <th key={col.name} style={{ padding: '8px 8px', fontWeight: 'bold', color: 'var(--color-teal)' }}>
                  {col.label}
                </th>
              ))}
              <th style={{ padding: '8px 8px', fontWeight: 'bold', width: '220px' }}>Kết quả mong đợi</th>
              <th style={{ padding: '8px 8px', fontWeight: 'bold', width: '180px' }}>Mô tả lỗi</th>
              <th style={{ padding: '8px 8px', fontWeight: 'bold', width: '180px' }}>Lý do sinh TC</th>
              <th style={{ padding: '8px 8px', fontWeight: 'bold', width: '90px', textAlign: 'right' }}>Fitness</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={8 + columns.length}
                  style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}
                >
                  Chưa có dữ liệu hạt giống. Vui lòng chạy phân tích đặc tả bằng AI hoặc tải tệp lên.
                </td>
              </tr>
            ) : (
              paginatedData.map((seed, idx) => {
                const absoluteIdx = (currentPage - 1) * pageSize + idx;
                const fitnessRecord = fitnessRecords[absoluteIdx];
                const fitnessVal = fitnessRecord?.finalFitness ?? fitnessRecord?.hcFitness ?? fitnessRecord?.fitness ?? seed.fitness ?? seed.gaFitness ?? null;
                const tcId = seed.tcId || `TC-${String(absoluteIdx + 1).padStart(4, '0')}`;
                const seedValues = seed.values || seed.data || seed;

                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(0, 0, 0, 0.01)',
                      transition: 'background 0.15s',
                    }}
                  >
                    <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>#{absoluteIdx + 1}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10px',
                          background: 'rgba(13,148,136,0.08)',
                          border: '1px solid rgba(13,148,136,0.2)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          color: 'var(--color-teal)',
                          fontWeight: 'bold',
                        }}
                      >
                        {tcId}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '11.5px', lineHeight: '1.4' }}>
                      {seed.scenario || '-'}
                    </td>
                    <td style={{ padding: '12px 8px', textTransform: 'uppercase', fontWeight: '500', color: 'var(--text-primary)' }}>
                      {seed.method || '-'}
                    </td>
                    {columns.map((col) => {
                      const val = seedValues[col.name];
                      return (
                        <td key={col.name} style={{ padding: '12px 8px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)', maxWidth: '280px' }}>
                          <TruncatedText text={val !== undefined && val !== null ? String(val) : '-'} />
                        </td>
                      );
                    })}
                    <td style={{ padding: '12px 8px', fontSize: '11.5px', fontWeight: '500' }}>
                      <span
                        style={{
                          color:
                            (seed.expectedResult || '').toLowerCase().includes('lỗi') ||
                            (seed.expectedResult || '').toLowerCase().includes('chặn') ||
                            (seed.expectedResult || '').toLowerCase().includes('error') ||
                            (seed.expectedResult || '').toLowerCase().includes('invalid')
                              ? 'var(--error)'
                              : 'var(--success)',
                        }}
                      >
                        {seed.expectedResult || 'Hợp lệ'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      {seed.errorDescription || '-'}
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                      {seed.rationale || '-'}
                    </td>
                    {/* Điểm chất lượng — hiển thị seedQualityScore nếu có, fallback về fitness */}
                    <td style={{ padding: '12px 8px', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                      {(() => {
                        const score = seed.seedQualityScore !== undefined && seed.seedQualityScore !== null
                          ? seed.seedQualityScore / 100
                          : fitnessVal !== null && fitnessVal !== undefined
                            ? (fitnessVal > 1 ? fitnessVal / 100 : fitnessVal)
                            : null;
                        if (score === null) return '-';
                        const color = score >= 0.85
                          ? 'var(--success)'
                          : score >= 0.70
                            ? 'var(--color-violet)'
                            : 'var(--error)';
                        return (
                          <strong style={{ color }}>
                            {score.toFixed(2)}
                          </strong>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {sortedData.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
          {/* Page Size Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <span>Số dòng/trang:</span>
            {[30, 60, 100].map(size => (
              <button
                key={size}
                onClick={() => {
                  setPageSize(size);
                  setCustomPageSize('');
                  setCurrentPage(1);
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-subtle)',
                  background: pageSize === size && !customPageSize ? 'var(--color-teal)' : 'transparent',
                  color: pageSize === size && !customPageSize ? '#fff' : 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {size}
              </button>
            ))}
            <input
              type="number"
              placeholder="Khác..."
              value={customPageSize}
              onChange={(e) => handleCustomPageSizeChange(e.target.value)}
              min="1"
              max="500"
              style={{
                width: '65px',
                padding: '4px 8px',
                fontSize: '12px',
                borderRadius: '4px',
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--text-primary)',
                outline: 'none',
                textAlign: 'center'
              }}
            />
          </div>

          {/* Pagination Navigation */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  background: 'transparent',
                  color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                Trước
              </button>
              <span style={{ color: 'var(--text-secondary)' }}>
                Trang <strong>{currentPage}</strong> / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  background: 'transparent',
                  color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                Sau
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
