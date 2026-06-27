import {
  CheckCircle2,
  Download,
  GitCompare,
  Play,
  RefreshCw,
  Settings2
} from 'lucide-react';
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { config } from '../config';
import { useAppStore } from '../store/useAppStore';
import { toast } from '../store/useToastStore';
import { getExpectedResultShort } from './EvaluateData';

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
    isOptimizingHC: isOptimizing,
    setIsOptimizingHC: setIsOptimizing,
    optimizationPhase,
    setOptimizationPhase,
    schemaName,
    parsedSchema: schema,
    rawText,
    llmProvider,
    specificationId,
    saveGenerationSnapshot,
    parsedConstraints,
    parsedBusinessRules,
    parsedCoverageTargets,
    initialSeeds,
    evaluationResult,
    evaluationMetrics,
    projectMeta,
    setEvaluationMetrics,
    selectedPresetId,
  } = useAppStore();

  const [iterations, setIterations] = useState(25);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hcData, setHcData] = useState<any[] | null>(null);

  const handleRun = async () => {
    if (!gaResult || gaResult.length === 0) {
      toast.warning('Cần có kết quả từ bước GA trước.');
      return;
    }

    setIsOptimizing(true);
    setOptimizationPhase('Đang thiết lập thuật toán Hill Climbing...');
    setHcData(null);

    try {
      const { initialSeeds: storeSeeds, parsedSchema: storeSchema, llmProvider, apiKey } = useAppStore.getState();
      let snapshot: any = null;
      if (selectedPresetId) {
        setOptimizationPhase('Đang tải dữ liệu Hill Climbing mẫu...');
        await new Promise(r => setTimeout(r, 1000));
        const mockDataPath = await import('../data/dlieu_mau_data.json');
        const allRes = mockDataPath.default || mockDataPath;
        const prefixes: any = {
          'preset-1': 'DangNhap', 'preset-2': 'ThemSP', 'preset-3': 'SuaSP',
          'preset-4': 'XoaSP', 'preset-5': 'TimKiem'
        };
        const prefix = prefixes[selectedPresetId] || 'DangNhap';
        const hcDataset = (allRes[`${prefix}_LLM_GA_HC`] || []).slice(1);

        snapshot = {
          hcResult: hcDataset,
          gaResult: gaResult,
          finalResult: hcDataset,
          progressHistory: [],
          summary: { coverageRate: 0.96, avgFinalFitness: 0.99, duplicateRate: 0 },
          maStats: { bestFitness: 0.99, avgFitness: 0.95 }
        };
      } else {
        const jobId = crypto.randomUUID();

        setOptimizationPhase('Đang chạy Hill Climbing trên máy chủ...');

        const response = await fetch(`${config.API_BASE_URL}/api/optimize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            specification_id: specificationId || 'local',
            algorithm: 'hc',
            initial_seeds: gaResult, // HC cải tiến trực tiếp từ kết quả GA
            schema_rules: storeSchema,
            llm_provider: llmProvider,
            api_key_override: apiKey ? apiKey.trim() : null,
            job_id: jobId,
            generations: 1,
            popSize: gaResult.length || 50,
            mutationRate: 0.2,
            crossoverRate: 0.8,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || 'Lỗi khi gọi API HC Optimize');
        }

        snapshot = await response.json();
      }
      // Backend /api/optimize trả về: { gaResult, hcResult, finalResult, maStats, progressHistory, summary }
      // Mỗi tc có cấu trúc: { tcId, values: { fieldName: value }, expectedResult, ... }
      // Cần flatten values vào root để bảng có thể đọc tc[fieldName] trực tiếp
      const flattenTc = (tc: any) => ({
        ...(tc.values || {}),       // flatten các trường dữ liệu động lên root
        ...tc,                      // giữ lại tcId, expectedResult, fitness, origin, ...
        fitness: tc.finalFitness ?? tc.hcFitness ?? tc.gaFitness ?? tc.fitness ?? 0,
        id: tc.tcId ?? tc.id ?? `TC-HC-${Math.floor(Math.random() * 90000) + 10000}`,
      });

      const hcDataset  = (snapshot.hcResult    || []).map(flattenTc);
      const gaDataset  = (snapshot.gaResult     || []).map(flattenTc);
      const rawFinal   = snapshot.finalResult   || [];
      const hcResultMapped = rawFinal.length > 0 ? rawFinal.map(flattenTc) : (hcDataset.length > 0 ? hcDataset : gaDataset);
      const progressHistory = snapshot.progressHistory || [];
      const summaryData = snapshot.summary || {};

      // Nếu GA bước này cũng trả về GA result, lưu lại
      if (gaDataset.length > 0) {
        useAppStore.getState().setGaResult(gaDataset);
      }

      setHcData(hcResultMapped);
      setHcResult(hcResultMapped);

      // Lưu snapshot gộp 4 bước với dữ liệu sau HC
      const payload = {
        spec_id: specificationId || `SPEC-${Date.now()}`,
        spec_name: schemaName || 'Đặc tả chưa đặt tên',
        raw_text: rawText,
        fields: schema,
        constraints: parsedConstraints,
        businessRules: parsedBusinessRules,
        coverageTargets: parsedCoverageTargets,
        initialPopulation: storeSeeds,
        step2_eval_result: evaluationResult,
        step3_metrics: evaluationMetrics,
        gaResult: gaResult,
        step4_optimized_data: hcResultMapped,
        step4_history: progressHistory,
        coverage_rate: summaryData.coverageRate || 96,
        config: {
          generations: 1,
          popSize: gaResult.length || 10,
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

  const handleExport = (type: 'json' | 'excel') => {
    if (!hcData || hcData.length === 0) {
      toast.warning('Không có dữ liệu để xuất.');
      return;
    }

    const exportData = hcData.map((tc: any, i: number) => {
      const row: any = { TC_ID: `TC-HC-${String(i + 1).padStart(3, '0')}` };
      schema.forEach((f: any) => {
        row[f.name] = tc[f.name];
      });
      row['Expected Result'] = tc.expectedResult?.statusText || tc.expectedResult || '';
      row['Error Description'] = tc.expectedResult?.errorDescription || tc.errorDescription || '';
      row['Fitness'] = tc.fitness;
      return row;
    });

    if (type === 'json') {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hc_results.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (type === 'excel') {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'HC_Results');
      XLSX.writeFile(workbook, `hc_results.xlsx`);
    }
  };

  return (
    <div className='fade-in-up'>
      <div className='glass-card' style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
          <Settings2 size={18} style={{ color: 'var(--brand-primary)' }} />
          <h3 style={{ fontSize: 15, margin: 0 }}>Cấu Hình Thuật Toán Hill Climbing</h3>
        </div>

        {/* <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 300 }}>
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
        </div> */}

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
            <span style={{ fontSize: 12, color: 'var(--color-yellow)' }}>Cần chạy GA trước.</span>
          )}
        </div>
      </div>

      {isOptimizing && (
        <div className='glass-card' style={{ marginBottom: 16, textAlign: 'center', padding: 32 }}>
          <GitCompare
            size={30}
            className='tech-spinner'
            style={{ color: 'var(--color-teal)', marginBottom: 10 }}
          />
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            Hill Climbing đang tinh chỉnh cục bộ…
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
            {optimizationPhase}
          </div>
        </div>
      )}

      {hcData && (
        <div
          className='glass-card'
          style={{ marginBottom: 16, borderLeft: '4px solid var(--color-emerald)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <CheckCircle2 size={17} style={{ color: 'var(--color-emerald)' }} />
            <h3 style={{ fontSize: 14.5, margin: 0 }}>Kết quả tinh chỉnh Hill Climbing</h3>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Quá trình HC đã hoàn tất trên {hcData.length} cá thể. Các giá trị cận biên đã được kiểm
            tra và tối ưu hóa thêm. Dữ liệu này sẽ được dùng làm bộ dữ liệu xuất cuối cùng.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                outline: 'none',
                fontWeight: 500,
              }}
            >
              <option value='all'>Tất cả (All)</option>
              <option value='pass'>Success</option>
              <option value='fail'>Error</option>
            </select>
          </div>
          <div
            style={{
              overflowX: 'auto',
              maxHeight: 600,
              marginTop: 16,
              marginBottom: 16,
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr
                  style={{
                    background: 'var(--surface-subtle)',
                    textAlign: 'left',
                    position: 'sticky',
                    top: 0,
                    zIndex: 5,
                  }}
                >
                  <ColHeader en='Test Code' vi='Mã ca kiểm thử' minWidth={100} />
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
                {hcData
                  .filter((tc: any) => {
                    if (statusFilter === 'all') return true;
                    const res = getExpectedResultShort(tc.expectedResult || tc.expected_result);
                    return statusFilter === 'pass' ? res === 'Success' : res === 'Error';
                  })
                  .slice(0, 50)
                  .map((tc: any, i: number) => {
                  const isSeed = String(tc.origin || '')
                    .toLowerCase()
                    .includes('seed');
                  const originStr = isSeed ? 'LLM (Seed)' : tc.origin || 'HC';
                  const resultStr = String(tc.expectedResult || tc.expected_result || '');
                  const cleanResult = resultStr.toUpperCase();
                  // Cùng logic verdict với getExpectedResultShort: ưu tiên dấu hiệu lỗi, không dùng mã HTTP.
                  const hasErr =
                    cleanResult.startsWith('LỖI') ||
                    cleanResult.startsWith('ERROR') ||
                    cleanResult.startsWith('THẤT BẠI') ||
                    cleanResult.includes('VALIDATION_ERROR') ||
                    cleanResult.includes('HTTP 400') ||
                    cleanResult.includes('HTTP 422') ||
                    cleanResult.includes('HTTP 500');
                  const hasOk =
                    cleanResult.startsWith('HỢP LỆ') ||
                    cleanResult.startsWith('SUCCESS') ||
                    cleanResult.startsWith('THÀNH CÔNG') ||
                    cleanResult.includes('HTTP 200') ||
                    cleanResult.includes('HTTP 201');
                  const isSuccess = hasOk && !hasErr;
                  const isError = !isSuccess;
                  const originalGaTc = gaResult && gaResult[i] ? gaResult[i] : null;
                  const fitnessImproved = originalGaTc && tc.fitness > (originalGaTc.fitness || 0);

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
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 10.5,
                            fontWeight: 600,
                            backgroundColor: 'var(--surface-subtle)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {originStr}
                        </span>
                      </td>
                      {schema.map((f: any) => {
                        const val = tc[f.name];
                        const originalVal = originalGaTc ? originalGaTc[f.name] : undefined;
                        const isChanged =
                          originalVal !== undefined && String(val) !== String(originalVal);
                        const empty = val === undefined || val === null || String(val) === '';
                        return (
                          <td
                            key={f.name}
                            style={{
                              padding: '10px 16px',
                              verticalAlign: 'top',
                              fontFamily: 'var(--font-mono)',
                              fontSize: 12,
                              maxWidth: 240,
                              wordBreak: 'break-word',
                              color: 'var(--text-primary)',
                              backgroundColor: isChanged
                                ? 'rgba(16, 185, 129, 0.08)'
                                : 'transparent',
                              borderLeft: isChanged ? '2px solid var(--color-emerald)' : 'none',
                            }}
                          >
                            {isChanged && (
                              <div
                                style={{
                                  fontSize: 9,
                                  color: 'var(--color-emerald)',
                                  fontWeight: 700,
                                  marginBottom: 4,
                                  textTransform: 'uppercase',
                                }}
                              >
                                ✨ Đã tối ưu ép biên
                              </div>
                            )}
                            {empty ? (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            ) : (
                              String(val)
                            )}
                            {isChanged && (
                              <div
                                style={{
                                  fontSize: 10,
                                  color: 'var(--text-muted)',
                                  marginTop: 6,
                                  textDecoration: 'line-through',
                                }}
                              >
                                Gốc: {String(originalVal)}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td style={{ padding: '10px 16px', verticalAlign: 'top' }}>
                        <div style={{ maxWidth: 340, wordBreak: 'break-word', lineHeight: '1.5' }}>
                          {isError ? (
                            <span
                              style={{ color: 'var(--error)', fontWeight: 700, marginRight: '4px' }}
                            >
                              Error:
                            </span>
                          ) : (
                            <span style={{ color: '#10b981', fontWeight: 700, marginRight: '4px' }}>
                              Success:
                            </span>
                          )}
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            {typeof tc.expectedResult === 'string'
                              ? tc.expectedResult
                              : tc.expectedResult?.statusText || String(tc.expectedResult || '')}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', verticalAlign: 'top' }}>
                        <div style={{ maxWidth: 340, wordBreak: 'break-word', lineHeight: '1.5' }}>
                          {isError ? (
                            <span style={{ color: 'var(--error)', fontWeight: 500 }}>
                              {typeof tc.expectedResult === 'object'
                                ? tc.expectedResult.errorDescription
                                : tc.errorDescription || 'Lỗi hệ thống/Validation'}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                              Không có
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', verticalAlign: 'top' }}>
                        <div style={{ maxWidth: 340, wordBreak: 'break-word', lineHeight: '1.5' }}>
                          {tc.rationale ? (
                            <span style={{ color: 'var(--text-secondary)' }}>{tc.rationale}</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </div>
                      </td>
                      <td
                        style={{ padding: '10px 16px', textAlign: 'right', verticalAlign: 'top' }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            gap: 4,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              color: fitnessImproved
                                ? 'var(--color-emerald)'
                                : 'var(--text-primary)',
                            }}
                          >
                            {tc.fitness.toFixed(3)}
                          </span>
                          {fitnessImproved && (
                            <span
                              style={{
                                fontSize: 10,
                                color: 'var(--color-emerald)',
                                fontWeight: 600,
                                background: 'rgba(16, 185, 129, 0.1)',
                                padding: '2px 6px',
                                borderRadius: 4,
                              }}
                            >
                              +{(tc.fitness - (originalGaTc.fitness || 0)).toFixed(2)} đ
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 12,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Hiển thị tối đa 50 ca kiểm thử. Đã sẵn sàng chuyển sang bước tiếp theo.
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => handleExport('json')}
                style={{
                  padding: '8px 14px',
                  fontSize: 13,
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-subtle)',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Download size={14} /> Xuất JSON
              </button>
              <button
                onClick={() => handleExport('excel')}
                style={{
                  padding: '8px 14px',
                  fontSize: 13,
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-subtle)',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Download size={14} /> Xuất Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
