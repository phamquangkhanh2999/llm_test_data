import { ArrowRight, CheckCircle2, GitCompare, Play, RefreshCw, Settings2, Sparkles, Terminal, XCircle } from 'lucide-react';
import React, { useState } from 'react';
import { config } from '../config';
import { useAppStore } from '../store/useAppStore';
import { toast } from '../store/useToastStore';

const ColHeader: React.FC<{
  en: string;
  vi: string;
  width?: number;
  minWidth?: number;
  align?: 'left' | 'center' | 'right';
}> = ({ en, vi, width, minWidth, align = 'left' }) => (
  <th
    style={{
      padding: '12px 16px',
      borderBottom: '2px solid var(--border-subtle)',
      color: 'var(--text-secondary)',
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      textAlign: align,
      width,
      minWidth,
    }}
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ color: 'var(--text-primary)' }}>{en}</span>
      <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{vi}</span>
    </div>
  </th>
);

export const HillClimbingOptimize: React.FC = () => {
  const {
    gaResult,
    setHcResult,
    setActiveScreen,
    isOptimizingHC: isOptimizing,
    setIsOptimizingHC: setIsOptimizing,
    optimizationPhase,
    setOptimizationPhase,
    schemaName,
    parsedSchema: schema,
    rawText,
    apiKey,
    llmProvider,
    specificationId,
    saveGenerationSnapshot,
    parsedConstraints,
    parsedBusinessRules,
    parsedCoverageTargets,
    initialSeeds,
    evaluationResult,
    evaluationMetrics,
    projectMeta
  } = useAppStore();

  const [iterations, setIterations] = useState(10);
  const [hcData, setHcData] = useState<any | null>(null);

  const handleRun = async () => {
    if (!gaResult || gaResult.length === 0) {
      toast.warning('Cần có kết quả từ bước GA trước.');
      return;
    }
    
    setIsOptimizing(true);
    setOptimizationPhase('Đang thiết lập thuật toán Hill Climbing...');
    setHcData(null);

    try {
      const resp = await fetch(`${config.API_BASE_URL}/api/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specification_id: specificationId || '',
          generations: 1,
          popSize: 10,
          crossoverRate: 0.8,
          mutationRate: 0.2,
          localSearchRate: 1.0,
          localSearchIters: iterations,
          weights: { w1: 0.4, w2: 0.3, w3: 0.2, w4: 0.1 },
          initial_seeds: gaResult,
          schema_rules: schema,
          raw_text: rawText || '',
          algorithm: 'hc',
          traditional_method: 'llm',
          api_key_override: apiKey ? apiKey.trim() : null,
          llm_provider: llmProvider,
        }),
      });
      
      if (!resp.ok) throw new Error('API HC thất bại');
      const res = await resp.json();
      
      const mockResult = (res.finalResult || res.hcResult || []).map((tc: any) => ({
        ...(tc.values || tc),
        fitness: tc.finalFitness ?? tc.hcFitness ?? tc.fitness ?? 0,
        origin: tc.origin ?? 'HC',
        id: tc.tcId ?? tc.id ?? `TC-HC-${Math.floor(Math.random() * 90000) + 10000}`,
        expectedResult: tc.expectedResult,
        errorDescription: tc.errorDescription,
        rationale: tc.rationale,
        categories: tc.categories || tc.category ? (Array.isArray(tc.categories) ? tc.categories : [tc.category || tc.categories]) : ['positive'],
      }));

      setHcData(mockResult);
      setHcResult(mockResult);

      // Lưu snapshot gộp 4 bước với dữ liệu sau HC
      const payload = {
        spec_id: specificationId || `SPEC-${Date.now()}`,
        spec_name: schemaName || 'Đặc tả chưa đặt tên',
        raw_text: rawText,
        fields: schema,
        constraints: parsedConstraints,
        businessRules: parsedBusinessRules,
        coverageTargets: parsedCoverageTargets,
        initialPopulation: initialSeeds,
        step2_eval_result: evaluationResult,
        step3_metrics: evaluationMetrics,
        step4_optimized_data: mockResult,
        step4_history: [], // For HC, we might not have generation history
        coverage_rate: res.summary?.improved ? (res.summary.improved / (res.summary.total || 1)) * 100 : 0,
        config: {
          generations: 1,
          popSize: 10,
          crossoverRate: 0.8,
          mutationRate: 0.2,
          localSearchRate: 1.0,
          localSearchIters: iterations,
          weights: { w1: 0.4, w2: 0.3, w3: 0.2, w4: 0.1 },
        },
        project_meta: projectMeta,
      };
      saveGenerationSnapshot(payload);

      toast.success('Hoàn tất HC! Chuyển sang bước Lịch sử & Xuất kết quả.');
    } catch (err: any) {
      toast.error('Lỗi khi chạy HC: ' + err.message);
    } finally {
      setIsOptimizing(false);
      setOptimizationPhase('');
    }
  };

  return (
    <div className='fade-in-up'>
      <div className='glass-card' style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
          <Settings2 size={18} style={{ color: 'var(--brand-primary)' }} />
          <h3 style={{ fontSize: 15, margin: 0 }}>Cấu Hình Thuật Toán Hill Climbing</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 300 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Số lượt leo đồi tối đa (Iterations)</label>
            <input 
              type="number" 
              value={iterations} 
              onChange={e => setIterations(Number(e.target.value))}
              min={1} max={50}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleRun}
            disabled={isOptimizing || !gaResult}
            className={isOptimizing || !gaResult ? 'btn btn-disabled' : 'btn btn-primary'}
            style={{ fontSize: 14, padding: '11px 22px' }}
          >
            {isOptimizing ? <RefreshCw size={16} className='tech-spinner' /> : <Play size={16} />}
            {isOptimizing ? 'Đang tinh chỉnh HC…' : 'Chạy Hill Climbing Optimization'}
          </button>
          {!gaResult && (
            <span style={{ fontSize: 12, color: 'var(--color-yellow)' }}>
              Cần chạy GA trước.
            </span>
          )}
        </div>
      </div>

      {isOptimizing && (
        <div className='glass-card' style={{ marginBottom: 16, textAlign: 'center', padding: 32 }}>
          <GitCompare size={30} className='tech-spinner' style={{ color: 'var(--color-teal)', marginBottom: 10 }} />
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Hill Climbing đang tinh chỉnh cục bộ…</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>{optimizationPhase}</div>
        </div>
      )}

      {hcData && (
        <div className='glass-card' style={{ marginBottom: 16, borderLeft: '4px solid var(--color-emerald)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <CheckCircle2 size={17} style={{ color: 'var(--color-emerald)' }} />
            <h3 style={{ fontSize: 14.5, margin: 0 }}>Kết quả tinh chỉnh Hill Climbing</h3>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Quá trình HC đã hoàn tất trên {hcData.length} cá thể. Các giá trị cận biên đã được kiểm tra và tối ưu hóa thêm.
            Dữ liệu này sẽ được dùng làm bộ dữ liệu xuất cuối cùng.
          </p>
          <div style={{ overflowX: 'auto', maxHeight: 600, marginTop: 16, marginBottom: 16, border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'var(--surface-subtle)', textAlign: 'left', position: 'sticky', top: 0, zIndex: 5 }}>
                  <ColHeader en='Test Code' vi='Mã ca kiểm thử' />
                  <ColHeader en='Origin' vi='Nguồn' width={120} />
                  {schema.map((f: any) => (
                    <ColHeader
                      key={f.name}
                      en={f.name}
                      vi={`Trường dữ liệu${f.type ? ` (${f.type})` : ''}`}
                      minWidth={150}
                    />
                  ))}
                  <ColHeader en='Expected Result' vi='Kết quả mong muốn' minWidth={260} />
                  <ColHeader en='Expected Error' vi='Lỗi mong muốn' minWidth={260} />
                  <ColHeader en='Improvement Goal' vi='Mục tiêu cải tiến' minWidth={260} />
                  <ColHeader en='Fitness' vi='Fitness sau HC' width={100} align='right' />
                </tr>
              </thead>
              <tbody>
                {hcData.slice(0, 50).map((tc: any, i: number) => {
                  const isSeed = String(tc.origin || '').toLowerCase().includes('seed');
                  const originStr = isSeed ? 'LLM (Seed)' : (tc.origin || 'HC');
                  const resultStr = String(tc.expectedResult || tc.expected_result || '');
                  const cleanResult = resultStr.toUpperCase();
                  // Cùng logic verdict với getExpectedResultShort: ưu tiên dấu hiệu lỗi, không dùng mã HTTP.
                  const hasErr = cleanResult.startsWith('LỖI') || cleanResult.startsWith('ERROR') || cleanResult.startsWith('THẤT BẠI') ||
                    cleanResult.includes('VALIDATION_ERROR') ||
                    cleanResult.includes('HTTP 400') || cleanResult.includes('HTTP 422') || cleanResult.includes('HTTP 500');
                  const hasOk = cleanResult.startsWith('HỢP LỆ') || cleanResult.startsWith('SUCCESS') || cleanResult.startsWith('THÀNH CÔNG') ||
                    cleanResult.includes('HTTP 200') || cleanResult.includes('HTTP 201');
                  const isSuccess = hasOk && !hasErr;
                  const isError = !isSuccess;
                  return (
                    <tr
                      key={i}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 0.2s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--surface-subtle)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <td
                        style={{
                          padding: '10px 16px',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-secondary)',
                          verticalAlign: 'top',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {`TC-HC-${String(i + 1).padStart(3, '0')}`}
                      </td>
                      <td style={{ padding: '10px 16px', verticalAlign: 'top' }}>
                        <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 600, backgroundColor: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                          {originStr}
                        </span>
                      </td>
                      {schema.map((f: any) => {
                        const val = tc[f.name];
                        const empty = val === undefined || val === null || String(val) === '';
                        return (
                          <td key={f.name} style={{ padding: '10px 16px', verticalAlign: 'top', fontFamily: 'var(--font-mono)', fontSize: 12, maxWidth: 240, wordBreak: 'break-word', color: 'var(--text-primary)' }}>
                            {empty ? <span style={{ color: 'var(--text-muted)' }}>—</span> : String(val)}
                          </td>
                        );
                      })}
                      <td style={{ padding: '10px 16px', verticalAlign: 'top' }}>
                        <div style={{ maxWidth: 340, wordBreak: 'break-word', lineHeight: '1.5' }}>
                          {isError ? (
                            <span style={{ color: 'var(--error)', fontWeight: 700, marginRight: '4px' }}>
                              Error:
                            </span>
                          ) : (
                            <span style={{ color: '#10b981', fontWeight: 700, marginRight: '4px' }}>
                              Success:
                            </span>
                          )}
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {typeof tc.expectedResult === 'string' ? tc.expectedResult : (tc.expectedResult?.statusText || String(tc.expectedResult || ''))}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', verticalAlign: 'top' }}>
                        <div style={{ maxWidth: 340, wordBreak: 'break-word', lineHeight: '1.5' }}>
                          {isError ? (
                            <span style={{ color: 'var(--error)', fontWeight: 500 }}>
                              {typeof tc.expectedResult === 'object' ? tc.expectedResult.errorDescription : (tc.errorDescription || 'Lỗi hệ thống/Validation')}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Không có</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', verticalAlign: 'top' }}>
                        <div style={{ maxWidth: 340, wordBreak: 'break-word', lineHeight: '1.5' }}>
                          {tc.rationale ? <span style={{ color: 'var(--text-secondary)' }}>{tc.rationale}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', verticalAlign: 'top' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {tc.fitness.toFixed(3)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Hiển thị tối đa 50 ca kiểm thử. Đã sẵn sàng chuyển sang bước tiếp theo.</span>
            <button className='btn btn-primary' onClick={() => setActiveScreen('export')}>
              Lịch sử & Xuất kết quả <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
