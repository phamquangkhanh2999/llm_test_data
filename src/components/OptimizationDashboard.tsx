// @ts-nocheck
import { Activity, Target, Zap, XCircle } from 'lucide-react';
import React, { useState, useRef } from 'react';
import { config } from '../config';
import { useAppStore } from '../store/useAppStore';
import { toast } from '../store/useToastStore';
import type { OptimizationSnapshot } from '../types/testcase';
import { LoadingSpinner } from './LoadingSpinner';
import { OptimizationResultTables } from './OptimizationResultTables';

export const OptimizationDashboard: React.FC = () => {
  const {
    parsedSchema: schema,
    initialSeeds,
    handleEvolutionComplete: onEvolutionComplete,
    specificationId: activeSpecId,
    setSpecificationId,
    historyRuns,
    optimizedDataset,
    setOptimizedDataset,
    llmProvider,
    apiKey
  } = useAppStore();

  const [isRunning, setIsRunning] = useState(false);
  const hasCompleted = !!(optimizedDataset && (optimizedDataset as any).finalResult && (optimizedDataset as any).finalResult.length > 0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const currentJobIdRef = useRef<string | null>(null);

  // Chạy tối ưu hóa tuyến tính bằng API
  const startOptimization = async () => {
    if (!initialSeeds || initialSeeds.length === 0) {
      toast.error('Chưa có dữ liệu mầm (F0). Vui lòng nhập đặc tả ở Bước 1 trước.');
      return;
    }

    setIsRunning(true);
    // toast.info('Đang tối ưu dữ liệu trên máy chủ...');

    try {
      abortControllerRef.current = new AbortController();
      const jobId = crypto.randomUUID();
      currentJobIdRef.current = jobId;

      const response = await fetch(`${config.API_BASE_URL}/api/optimize`, {
        method: 'POST',
        signal: abortControllerRef.current.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specification_id: activeSpecId || 'local',
          algorithm: 'ga_hc',
          initial_seeds: initialSeeds,
          schema_rules: schema,
          llm_provider: llmProvider,
          api_key_override: apiKey ? apiKey.trim() : null,
          job_id: jobId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Lỗi khi gọi API Optimize');
      }

      const snapshot: OptimizationSnapshot = await response.json();

      setOptimizedDataset(snapshot);
      if (onEvolutionComplete) {
        onEvolutionComplete(snapshot);
      }

      toast.success('Tối ưu hóa hoàn tất!');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        toast.info('Đã hủy quá trình tối ưu hóa.');
      } else {
        console.error(err);
        toast.error(err.message || 'Lỗi trong quá trình tối ưu hóa.');
      }
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {!hasCompleted && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap className="text-violet" size={18} />
                Tối Ưu Hóa Bằng Thuật Toán GA & HC
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                Hệ thống sẽ chạy Di Truyền (GA) để tìm kiếm toàn cục, sau đó dùng Leo Đồi (HC) để tinh chỉnh sát biên.
              </p>
            </div>
            
            <button 
              className="btn btn-primary"
              onClick={startOptimization}
              style={{ padding: '8px 16px', fontSize: '14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
            >
              <Activity size={16} />
              Bắt Đầu Tối Ưu
            </button>
          </div>

          {/* Preview Initial Seeds */}
          <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={16} style={{ color: 'var(--color-violet)' }} />
              Dữ Liệu Đầu Vào F0
            </h3>
            
            {(!initialSeeds || initialSeeds.length === 0) ? (
               <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                 Chưa có dữ liệu gốc (F0). Vui lòng quay lại Bước 1 để Phân tích đặc tả hoặc Tải file lên.
               </div>
            ) : (() => {
              const dataKeys = schema && schema.length > 0 
                ? schema.map((s: any) => s.name) 
                : (initialSeeds[0]?.values ? Object.keys(initialSeeds[0].values) : []);
              return (
                <div style={{ overflowY: 'auto', maxHeight: '60vh', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', minWidth: 'max-content', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-subtle)', zIndex: 1 }}>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <th style={{ padding: '12px', fontWeight: 'bold', width: '50px' }}>STT</th>
                        <th style={{ padding: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Mã test data</th>
                        <th style={{ padding: '12px', fontWeight: 'bold', maxWidth: '250px' }}>Kịch bản</th>
                        <th style={{ padding: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Phương pháp</th>
                        {dataKeys.map((k: string) => (
                          <th key={k} style={{ padding: '12px', fontWeight: 'bold', color: 'var(--color-violet)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={k}>{k}</th>
                        ))}
                        <th style={{ padding: '12px', fontWeight: 'bold', maxWidth: '250px' }}>Kết quả mong đợi</th>
                        <th style={{ padding: '12px', fontWeight: 'bold', maxWidth: '250px' }}>Mô tả lỗi</th>
                        <th style={{ padding: '12px', fontWeight: 'bold', maxWidth: '250px' }}>Lý do sinh TC</th>
                        <th style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Điểm (Fitness)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {initialSeeds.map((seed: any, idx: number) => {
                        const fitness = seed.llmFitness ?? seed.fitness ?? seed.validationScore ?? 0;
                        const tcId = seed.tcId || `TC-${idx+1}`;
                        return (
                          <tr key={tcId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '12px', color: 'var(--text-muted)' }}>#{idx + 1}</td>
                            <td style={{ padding: '12px' }}>
                              <span style={{
                                fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'rgba(13,148,136,0.08)',
                                border: '1px solid rgba(13,148,136,0.2)', borderRadius: '4px', padding: '2px 6px',
                                color: 'var(--color-teal)', fontWeight: 'bold'
                              }}>
                                {tcId}
                              </span>
                            </td>
                            <td style={{ padding: '12px', color: 'var(--text-secondary)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={seed.scenario || ''}>{seed.scenario || '-'}</td>
                            <td style={{ padding: '12px', textTransform: 'uppercase', fontWeight: '500', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{seed.method || '-'}</td>
                            {dataKeys.map((k: string) => {
                              const val = seed.values ? seed.values[k] : seed[k];
                              const valStr = val !== undefined && val !== null ? String(val) : '-';
                              return (
                                <td key={k} style={{ padding: '12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={valStr}>
                                  {valStr}
                                </td>
                              );
                            })}
                            <td style={{ padding: '12px', fontWeight: '500', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={seed.expectedResult || 'Hợp lệ'}>
                              <span style={{ color: (seed.expectedResult || '').toLowerCase().includes('lỗi') || (seed.expectedResult || '').toLowerCase().includes('chặn') ? 'var(--error)' : 'var(--success)' }}>
                                {seed.expectedResult || 'Hợp lệ'}
                              </span>
                            </td>
                            <td style={{ padding: '12px', color: 'var(--text-secondary)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={seed.errorDescription || ''}>{seed.errorDescription || '-'}</td>
                            <td style={{ padding: '12px', color: 'var(--text-secondary)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={seed.rationale || ''}>{seed.rationale || '-'}</td>
                            <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                              {fitness > 1 ? (fitness / 100).toFixed(3) : fitness.toFixed(3)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {hasCompleted && optimizedDataset && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap className="text-violet" size={18} />
                Kết Quả Tối Ưu Hóa
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                Bạn có thể xem lại kết quả tối ưu hoặc chạy lại quá trình tối ưu nếu cần thiết.
              </p>
            </div>
            
            <button 
              className="btn btn-primary"
              onClick={startOptimization}
              disabled={isRunning}
              style={{ padding: '8px 16px', fontSize: '14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
            >
              <Activity size={16} />
              Tối Ưu Lại
            </button>
          </div>
          <OptimizationResultTables snapshot={optimizedDataset} schema={schema} />
        </div>
      )}

      {/* Loading Overlay phủ toàn bộ màn hình chặn click khi đang tối ưu */}
      {isRunning && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          gap: '24px',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            padding: '40px 50px',
            borderRadius: '16px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            border: '1px solid var(--border-subtle)',
            maxWidth: '90%',
            textAlign: 'center'
          }}>
            <LoadingSpinner size={90} outerColor="var(--color-violet)" innerColor="var(--color-teal)" icon="sparkles" iconSize={36} />
            <h3 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, var(--color-violet) 0%, var(--color-teal) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              ĐANG TỐI ƯU HÓA DỮ LIỆU...
            </h3>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: 'var(--text-secondary)',
              maxWidth: '320px',
              lineHeight: 1.5
            }}>
              Hệ thống đang gọi AI và các thuật toán nội bộ để tìm điểm yếu, tạo đột biến và đánh giá chấm điểm lặp lại nhiều lần. Quá trình này có thể mất một vài phút.
            </p>
            <button
              onClick={() => {
                if (abortControllerRef.current) {
                  abortControllerRef.current.abort();
                }
                if (currentJobIdRef.current) {
                  fetch(`${config.API_BASE_URL}/api/cancel-job`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ job_id: currentJobIdRef.current })
                  }).catch(console.error);
                }
                setIsRunning(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                color: 'var(--color-red)',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginTop: '10px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
            >
              <XCircle size={18} />
              Hủy Tối Ưu
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
