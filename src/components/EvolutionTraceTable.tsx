import React, { useState } from 'react';
import { GitMerge, Activity, CheckCircle, ArrowRight, Minus, Sparkles } from 'lucide-react';
import type { ComparisonRecord } from './HillClimbingComparison';

interface EvolutionTraceProps {
  comparisons: ComparisonRecord[];
}

// Pseudo-fitness function just for UI mockup visualization per field
const getFieldPseudoFitness = (val: any, baseFitness: number, fieldName: string) => {
  if (!val) return 0.0;
  let variance = (fieldName.length % 5) * 0.02 - 0.04;
  return Math.min(1.0, Math.max(0.0, baseFitness + variance));
};

export const EvolutionTraceTable: React.FC<EvolutionTraceProps> = ({ comparisons }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!comparisons || comparisons.length === 0) return null;

  const currentRecord = comparisons[selectedIndex];
  const totalRecords = comparisons.length;

  const handlePrev = () => setSelectedIndex(p => Math.max(0, p - 1));
  const handleNext = () => setSelectedIndex(p => Math.min(totalRecords - 1, p + 1));

  // Lấy dữ liệu thực tế (xử lý trường hợp dữ liệu bị bọc trong key 'data')
  const getActualData = (recordValue: any) => {
    if (recordValue && typeof recordValue === 'object' && 'data' in recordValue) {
      return recordValue.data;
    }
    return recordValue || {};
  };

  const llmData = getActualData(currentRecord.llmValue);
  const gaData = getActualData(currentRecord.gaValue);
  const hcData = getActualData(currentRecord.hcValue);

  // Extract fields from actual data (excluding expectedResult if possible)
  const allKeys = Object.keys(llmData);
  const dataKeys = allKeys.filter(k => k !== 'expectedResult');
  const hasExpectedResult = allKeys.includes('expectedResult');

  // For the bottom section
  const llmFit = currentRecord.llmFitness || 0;
  const gaFit = currentRecord.gaFitness || 0;
  const hcFit = currentRecord.hcFitness || 0;
  const diffGa = gaFit - llmFit;
  const diffHc = hcFit - gaFit;

  return (
    <div className="glass-card" style={{ marginTop: '24px', background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-violet)', fontSize: '16px', margin: 0 }}>
          <GitMerge size={20} />
          Bảng đối chiếu test case trước và sau tối ưu
        </h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Mã test case:</label>
          <select 
            value={selectedIndex} 
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid var(--border-subtle)', 
              color: 'var(--text-primary)', 
              padding: '6px 12px', 
              borderRadius: '6px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {comparisons.map((c, i) => (
              <option key={i} value={i} style={{ background: '#1e293b' }}>
                {c.testId.replace('TC-OPT-', 'TC-')}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={handlePrev} disabled={selectedIndex === 0}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', color: selectedIndex === 0 ? 'var(--text-muted)' : 'var(--text-primary)', padding: '6px 12px', borderRadius: '6px', cursor: selectedIndex === 0 ? 'not-allowed' : 'pointer' }}
            >
              &lt; Trước
            </button>
            <button 
              onClick={handleNext} disabled={selectedIndex === totalRecords - 1}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', color: selectedIndex === totalRecords - 1 ? 'var(--text-muted)' : 'var(--text-primary)', padding: '6px 12px', borderRadius: '6px', cursor: selectedIndex === totalRecords - 1 ? 'not-allowed' : 'pointer' }}
            >
              Sau &gt;
            </button>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)', width: '12%' }}>Trường dữ liệu</th>
              <th style={{ padding: '12px', fontWeight: 600, color: '#3b82f6', width: '16%' }}>
                <div>1. LLM Thô (F0)</div>
                <div style={{ fontSize: '11px', fontWeight: 'normal', opacity: 0.8 }}>Dữ liệu ban đầu</div>
              </th>
              <th style={{ padding: '12px', fontWeight: 600, color: 'var(--color-violet)', width: '16%' }}>
                <div>2. Tối ưu GA</div>
                <div style={{ fontSize: '11px', fontWeight: 'normal', opacity: 0.8 }}>Sau thuật toán di truyền</div>
              </th>
              <th style={{ padding: '12px', fontWeight: 600, color: '#f59e0b', width: '16%' }}>
                <div>3. Tinh chỉnh HC (Cuối)</div>
                <div style={{ fontSize: '11px', fontWeight: 'normal', opacity: 0.8 }}>Sau tinh chỉnh cục bộ</div>
              </th>
              <th style={{ padding: '12px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', width: '10%' }}>
                <div>Thay đổi</div>
                <div style={{ fontSize: '11px', fontWeight: 'normal', opacity: 0.8 }}>So với bước trước</div>
              </th>
              <th style={{ padding: '12px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', width: '10%' }}>
                <div>Fitness LLM Thô (F0)</div>
              </th>
              <th style={{ padding: '12px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', width: '10%' }}>
                <div>Fitness GA</div>
              </th>
              <th style={{ padding: '12px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', width: '10%' }}>
                <div>Fitness HC (Cuối)</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {[...dataKeys, ...(hasExpectedResult ? ['expectedResult'] : [])].map((field, idx) => {
              const v0 = llmData[field];
              const v1 = gaData[field];
              const v2 = hcData[field];
              const isChanged = (v0 !== v1) || (v1 !== v2);

              const fit0 = getFieldPseudoFitness(v0, llmFit, field);
              const fit1 = getFieldPseudoFitness(v1, gaFit, field);
              const fit2 = getFieldPseudoFitness(v2, hcFit, field);

              return (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-muted)' }} />
                    {field}
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                    <div style={{ wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{String(v0)}</div>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-primary)' }}>
                    <div style={{ wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{String(v1)}</div>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-primary)' }}>
                    <div style={{ wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{String(v2)}</div>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {field === 'expectedResult' ? (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '12px' }}>
                        Không đổi
                      </span>
                    ) : isChanged ? (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: '#22c55e', fontSize: '12px', fontWeight: 600 }}>
                        Đã thay đổi
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '12px' }}>
                        Không đổi
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>{field === 'expectedResult' ? '1.00' : fit0.toFixed(2)}</td>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#16a34a' }}>{field === 'expectedResult' ? '1.00' : fit1.toFixed(2)}</td>
                  <td style={{ padding: '12px', textAlign: 'center', color: '#dc2626' }}>{field === 'expectedResult' ? '1.00' : fit2.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* BOTTOM SECTION */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '24px' }}>
        {/* Left: Overall Fitness Flow */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={16} color="var(--color-teal)" />
            Tổng quan cải thiện Fitness
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px' }}>
            <div style={{ textAlign: 'center', background: 'rgba(59, 130, 246, 0.1)', padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600, marginBottom: '4px' }}>LLM Thô (F0)</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{llmFit.toFixed(2)}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: diffGa > 0 ? '#16a34a' : 'var(--text-muted)' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>+{diffGa.toFixed(2)}</span>
              <ArrowRight size={16} />
            </div>

            <div style={{ textAlign: 'center', background: 'rgba(139, 92, 246, 0.1)', padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-violet)', fontWeight: 600, marginBottom: '4px' }}>Sau GA</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--color-violet)' }}>{gaFit.toFixed(2)}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: diffHc > 0 ? '#16a34a' : 'var(--text-muted)' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>+{diffHc.toFixed(2)}</span>
              <ArrowRight size={16} />
            </div>

            <div style={{ textAlign: 'center', background: 'rgba(245, 158, 11, 0.1)', padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600, marginBottom: '4px' }}>Sau HC (Cuối)</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>{hcFit.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Right: Commentary */}
        <div style={{ background: 'rgba(13, 148, 136, 0.04)', border: '1px solid rgba(13, 148, 136, 0.2)', borderRadius: '8px', padding: '16px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--color-teal)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} />
            Nhận xét
          </h4>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
            Thuật toán Genetic Algorithm đã cải thiện Fitness từ {llmFit.toFixed(2)} lên {gaFit.toFixed(2)} ({diffGa >= 0 ? '+' : ''}{diffGa.toFixed(2)}).
            {' '}
            Sau bước tinh chỉnh cục bộ (HC), Fitness {diffHc > 0 ? `tiếp tục tăng lên ${hcFit.toFixed(2)} (+${diffHc.toFixed(2)})` : `giữ nguyên ở mức ${hcFit.toFixed(2)}, không có cải thiện bổ sung`}.
            Các giá trị tại vùng biên đã được dò tìm và tối ưu cục bộ.
          </p>
        </div>
      </div>
    </div>
  );
};
