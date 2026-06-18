import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { Activity, Award, AlertTriangle, Play, Loader } from 'lucide-react';

export const BenchmarkDashboard: React.FC = () => {
  const {
    isBenchmarking,
    benchmarkResults,
    handleRunBenchmark,
    specificationId,
    initialSeeds
  } = useAppStore();

  const canRun = !!specificationId && initialSeeds.length > 0;

  return (
    <div className="flex flex-col gap-lg fade-in" style={{ padding: '16px' }}>
      <div className="flex justify-between align-center">
        <div>
          <h2 style={{ fontSize: '24px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity className="text-violet" size={28} />
            BENCHMARK 6 CHIẾN LƯỢC TỐI ƯU
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            So sánh điểm Fitness & Coverage của 6 thuật toán sinh dữ liệu tự động.
          </p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={handleRunBenchmark}
          disabled={!canRun || isBenchmarking}
          style={{ padding: '12px 24px', fontSize: '16px', fontWeight: 600 }}
        >
          {isBenchmarking ? (
            <><Loader className="spin" size={18} /> ĐANG CHẠY BENCHMARK...</>
          ) : (
            <><Play size={18} /> BẮT ĐẦU THI ĐẤU</>
          )}
        </button>
      </div>

      {!canRun && !isBenchmarking && !benchmarkResults && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
          <AlertTriangle size={48} style={{ color: 'var(--color-yellow)', margin: '0 auto 16px' }} />
          <h3>Chưa đủ dữ liệu Benchmark</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Bạn cần phải Phân tích Yêu cầu (Parse Spec) để có Hệ thống Luật (Rules) và Hạt giống F0 trước khi cho các thuật toán thi đấu.
          </p>
        </div>
      )}

      {isBenchmarking && (
        <div className="glass-card flex flex-col align-center justify-center gap-md" style={{ padding: '60px' }}>
          <Loader className="spin text-violet" size={48} />
          <h3 className="pulse-text text-violet">HỆ THỐNG ĐANG CHẠY CÙNG LÚC 6 ENGINE...</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Quá trình này có thể mất từ 10 - 30 giây để hoàn thành. Xin vui lòng đợi!
          </p>
        </div>
      )}

      {benchmarkResults && !isBenchmarking && (
        <>
          {/* AI Analysis Card */}
          <div className="glass-card violet-border">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-violet)', marginBottom: '16px' }}>
              <Award size={24} />
              PHÂN TÍCH TỪ CHUYÊN GIA AI
            </h3>
            <div style={{ background: 'var(--surface-subtle)', padding: '16px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <strong style={{ fontSize: '18px' }}>Chiến lược vô địch:</strong>
                <span style={{ background: 'var(--color-yellow)', color: '#000', padding: '4px 12px', borderRadius: '16px', fontWeight: 'bold' }}>
                  {benchmarkResults.ai_analysis?.winner || 'Chưa xác định'}
                </span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <strong style={{color: 'var(--color-teal)'}}>Xếp hạng chiến lược:</strong>
                  <ol style={{paddingLeft: '20px', margin: '8px 0'}}>
                    {benchmarkResults.ai_analysis?.ranking?.map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ol>
                </div>
                <div>
                  <strong style={{color: 'var(--color-orange)'}}>Điểm đánh giá AI:</strong>
                  <ul style={{paddingLeft: '20px', margin: '8px 0'}}>
                    {benchmarkResults.ai_analysis?.strategy_scores && Object.entries(benchmarkResults.ai_analysis.strategy_scores).map(([k,v]: any) => (
                      <li key={k}>{k}: <strong>{v}</strong></li>
                    ))}
                  </ul>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <strong style={{color: 'var(--color-teal)'}}>Điểm mạnh:</strong>
                <ul style={{paddingLeft: '20px', margin: '4px 0'}}>{benchmarkResults.ai_analysis?.strengths?.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <strong style={{color: 'var(--color-orange)'}}>Điểm yếu:</strong>
                <ul style={{paddingLeft: '20px', margin: '4px 0'}}>{benchmarkResults.ai_analysis?.weaknesses?.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <strong style={{color: 'var(--color-violet)'}}>Khuyến nghị:</strong>
                <ul style={{paddingLeft: '20px', margin: '4px 0'}}>{benchmarkResults.ai_analysis?.recommendations?.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
              </div>

              <div style={{ padding: '12px', background: 'var(--bg-card)', borderLeft: '4px solid var(--color-violet)' }}>
                <strong>Kết luận:</strong> {benchmarkResults.ai_analysis?.research_conclusion}
              </div>
            </div>
          </div>

          {/* Leaderboard Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {Object.entries(benchmarkResults.benchmark_data).sort((a: any, b: any) => b[1].score - a[1].score).map(([strategy, data]: any, index) => (
              <div key={strategy} className="glass-card" style={{ position: 'relative', overflow: 'hidden' }}>
                {index === 0 && (
                  <div style={{ position: 'absolute', top: 0, right: 0, background: 'var(--color-yellow)', color: '#000', padding: '4px 24px', transform: 'rotate(45deg) translate(20px, -15px)', fontWeight: 'bold', fontSize: '12px' }}>
                    TOP 1
                  </div>
                )}
                
                <h3 style={{ fontSize: '20px', margin: '0 0 16px 0', color: index === 0 ? 'var(--color-yellow)' : 'var(--text-primary)' }}>
                  {strategy}
                </h3>
                
                <div style={{ display: 'flex', alignItems: 'end', gap: '8px', marginBottom: '24px' }}>
                  <span style={{ fontSize: '36px', fontWeight: '900', lineHeight: 1, color: 'var(--color-teal)' }}>
                    {(data.score * 100).toFixed(1)}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', paddingBottom: '4px' }}>điểm</span>
                </div>

                <div className="flex flex-col gap-sm">
                  <div>
                    <div className="flex justify-between" style={{ fontSize: '12px', marginBottom: '4px' }}>
                      <span>Rule Coverage</span>
                      <span>{(data.details.rule_score * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ width: '100%', background: 'var(--surface-subtle)', height: '6px', borderRadius: '3px' }}>
                      <div style={{ width: `${data.details.rule_score * 100}%`, background: 'var(--color-violet)', height: '100%', borderRadius: '3px' }} />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between" style={{ fontSize: '12px', marginBottom: '4px' }}>
                      <span>Boundary Edge</span>
                      <span>{(data.details.boundary_score * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ width: '100%', background: 'var(--surface-subtle)', height: '6px', borderRadius: '3px' }}>
                      <div style={{ width: `${data.details.boundary_score * 100}%`, background: 'var(--color-yellow)', height: '100%', borderRadius: '3px' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between" style={{ fontSize: '12px', marginBottom: '4px' }}>
                      <span>Constraints</span>
                      <span>{(data.details.constraint_score * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ width: '100%', background: 'var(--surface-subtle)', height: '6px', borderRadius: '3px' }}>
                      <div style={{ width: `${data.details.constraint_score * 100}%`, background: 'var(--color-teal)', height: '100%', borderRadius: '3px' }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
