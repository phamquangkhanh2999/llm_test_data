import React, { useEffect, useState } from 'react';
import {
  Database, RefreshCw, FileSpreadsheet, FileJson, ArrowLeft, Trash2,
  FileInput, Gauge, Zap, CheckCircle2, ShieldAlert, AlertTriangle, ListChecks, FileText, Activity, GitCompare
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { toast } from '../store/useToastStore';
import { AlgorithmCharts } from './AlgorithmCharts';

// =============================================================================
//  TRUNG TÂM XUẤT KẾT QUẢ (BƯỚC 6)
//  - Mặc định: bảng "LỊCH SỬ YÊU CẦU & KẾT QUẢ" đọc từ bảng snapshot gộp 4 bước.
//  - "Xem chi tiết": KHÔNG gọi lại API tính toán — chỉ tải 1 object snapshot theo id,
//    rồi tái dựng UI read-only có stepper 1→4 để duyệt lại từng bước.
//  - Download ở Bước 4 dùng đúng step4_optimized_data của chính phiên đang xem.
// =============================================================================

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('vi-VN', { hour12: false }); } catch { return iso; }
};

// Các key nội bộ/metadata không hiển thị như cột dữ liệu test
const INTERNAL_KEYS = new Set(['fitness', 'origin', 'id', 'generation', 'ma_action',
  'parent_ids', 'local_search_applied', 'improvement', 'coverage', 'fitness_before_ls',
  'fitness_after_ls', 'ls_gain', 'test_type', 'test_subtype']);
const isVisibleKey = (k: string) => !k.startsWith('_') && !INTERNAL_KEYS.has(k);

// Strip metadata, chỉ giữ giá trị test thực
const toCleanRow = (tc: any) => {
  const out: Record<string, any> = {};
  Object.entries(tc || {}).forEach(([k, v]) => { if (isVisibleKey(k)) out[k] = v; });
  return out;
};

const getOriginBadge = (origin: string) => {
  const clean = (origin || 'GA').toLowerCase();
  if (clean.includes('seed'))
    return {
      label: 'Seed / F0 gốc',
      bg: 'rgba(59, 130, 246, 0.08)',
      border: 'rgba(59, 130, 246, 0.2)',
      color: '#3b82f6',
    };
  if (clean.includes('ls') || clean.includes('local') || clean.includes('memetic'))
    return {
      label: 'Cải tiến cục bộ (Local Improvement)',
      bg: 'rgba(16, 185, 129, 0.08)',
      border: 'rgba(16, 185, 129, 0.2)',
      color: 'var(--color-emerald)',
    };
  if (clean.includes('elite'))
    return {
      label: 'Tinh hoa (Elite)',
      bg: 'rgba(139, 92, 246, 0.08)',
      border: 'rgba(139, 92, 246, 0.2)',
      color: '#8b5cf6',
    };
  if (clean.includes('security') && clean.includes('mutation'))
    return {
      label: 'Đột biến bảo mật (Security Mutation)',
      bg: 'rgba(186, 26, 26, 0.08)',
      border: 'rgba(186, 26, 26, 0.2)',
      color: 'var(--color-rose)',
    };
  if (clean.includes('boundary') && clean.includes('mutation'))
    return {
      label: 'Đột biến biên (Boundary Mutation)',
      bg: 'rgba(245, 158, 11, 0.08)',
      border: 'rgba(245, 158, 11, 0.2)',
      color: '#f59e0b',
    };
  if (clean.includes('mutation'))
    return {
      label: 'Đột biến',
      bg: 'rgba(245, 158, 11, 0.08)',
      border: 'rgba(245, 158, 11, 0.2)',
      color: '#f59e0b',
    };
  if (clean.includes('crossover'))
    return {
      label: 'Lai ghép (Crossover)',
      bg: 'rgba(6, 182, 212, 0.08)',
      border: 'rgba(6, 182, 212, 0.2)',
      color: 'var(--color-teal)',
    };
  return {
    label: origin,
    bg: 'var(--surface-subtle)',
    border: 'var(--border-subtle)',
    color: 'var(--text-secondary)',
  };
};

const ColHeader: React.FC<{
  en: string;
  vi: string;
  width?: number;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
}> = ({ en, vi, width, minWidth, align = 'left' }) => (
  <th style={{ padding: '5px 8px', width, minWidth, textAlign: align, background: 'var(--surface-subtle)' }}>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
      }}
    >
      <span style={{ color: 'var(--text-secondary)' }}>{en}</span>
      <span
        style={{
          fontSize: 9.5,
          textTransform: 'none',
          color: 'var(--text-muted)',
          fontWeight: 400,
        }}
      >
        {vi}
      </span>
    </div>
  </th>
);

const STEPS = [
  { n: 1, label: 'Đầu vào', icon: <FileInput size={15} /> },
  { n: 2, label: 'Đánh giá F0', icon: <Gauge size={15} /> },
  { n: 3, label: 'Tối ưu GA', icon: <Zap size={15} /> },
  { n: 4, label: 'Tối ưu HC', icon: <GitCompare size={15} /> },
  { n: 5, label: 'Biểu đồ', icon: <Activity size={15} /> },
];

export const ExportReportCenter: React.FC = () => {
  const {
    generationHistory, isFetchingGenHistory,
    fetchGenerationHistory, fetchGenerationDetail, deleteGenerationHistory, restoreSessionFromHistory,
    hcResult, schemaName
  } = useAppStore();

  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(1);

  useEffect(() => {
    // Luôn fetch mới nhất khi vào màn lịch sử & xuất kết quả
    fetchGenerationHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mở chi tiết: chỉ 1 GET snapshot, KHÔNG tính toán lại
  const handleViewDetail = async (id: string) => {
    setLoadingDetail(true);
    setViewMode('detail');
    setActiveStep(1);
    const data = await fetchGenerationDetail(id);
    setSnapshot(data);
    setLoadingDetail(false);
  };

  const handleBack = () => { setViewMode('list'); setSnapshot(null); };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Xóa vĩnh viễn bản ghi báo cáo này?')) {
      await deleteGenerationHistory(id);
    }
  };

  // ── DOWNLOAD: dùng đúng step4_optimized_data của snapshot đang xem ──
  const buildReport = () => {
    const rows = (snapshot?.step4_optimized_data || []).map(toCleanRow);
    return {
      report_info: {
        project: snapshot?.spec_name,
        date: snapshot?.created_at,
        total: rows.length,
      },
      optimization_metrics: {
        algorithm: 'GA & HC Algorithm',
        coverage: snapshot?.coverage_rate ?? 0,
      },
      test_suite: rows,
    };
  };

  const downloadBlob = (content: string, type: string, ext: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TestSuite_${String(snapshot?.spec_name || 'report').replace(/\s+/g, '_').slice(0, 40)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const report = buildReport();
    if (report.test_suite.length === 0) return;
    downloadBlob(JSON.stringify(report, null, 2), 'application/json', 'json');
    toast.success('Đã xuất file JSON.');
  };

  const handleExportCSV = () => {
    const rows = (snapshot?.step4_optimized_data || []).map(toCleanRow);
    if (rows.length === 0) return;
    
    // Đảm bảo thứ tự cột: các trường dữ liệu trước, scenario và expectedResult sau cùng
    const allKeys = Object.keys(rows[0]);
    const mainKeys = allKeys.filter(k => k !== 'scenario' && k !== 'expectedResult');
    const finalHeaders = [...mainKeys];
    if (allKeys.includes('scenario')) finalHeaders.push('scenario');
    if (allKeys.includes('expectedResult')) finalHeaders.push('expectedResult');

    let csv = '\uFEFF' + finalHeaders.join(',') + '\n';
    rows.forEach((row: any) => {
      csv += finalHeaders.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',') + '\n';
    });
    downloadBlob(csv, 'text/csv;charset=utf-8;', 'csv');
    toast.success('Đã xuất file Excel (.csv).');
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleExportCurrentJSON = () => {
    if (!hcResult || hcResult.length === 0) return;
    const report = {
      report_info: { project: schemaName || 'Current Session', date: new Date().toISOString(), total: hcResult.length },
      optimization_metrics: { algorithm: 'LLM+GA+HC' },
      test_suite: hcResult.map(toCleanRow),
    };
    downloadBlob(JSON.stringify(report, null, 2), 'application/json', 'json');
    toast.success('Đã xuất file JSON hiện tại.');
  };

  const handleExportCurrentCSV = () => {
    if (!hcResult || hcResult.length === 0) return;
    const rows = hcResult.map(toCleanRow);
    const allKeys = Object.keys(rows[0] || {});
    const mainKeys = allKeys.filter(k => k !== 'scenario' && k !== 'expectedResult');
    const finalHeaders = [...mainKeys];
    if (allKeys.includes('scenario')) finalHeaders.push('scenario');
    if (allKeys.includes('expectedResult')) finalHeaders.push('expectedResult');

    let csv = '\uFEFF' + finalHeaders.join(',') + '\n';
    rows.forEach((row: any) => {
      csv += finalHeaders.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',') + '\n';
    });
    downloadBlob(csv, 'text/csv;charset=utf-8;', 'csv');
    toast.success('Đã xuất file Excel hiện tại.');
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  VIEW: DANH SÁCH LỊCH SỬ
  // ═══════════════════════════════════════════════════════════════════════
  if (viewMode === 'list') {
    return (
      <div className="fade-in-up" style={{ marginTop: 16 }}>
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden', borderLeft: '4px solid var(--brand-primary)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.01)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Database size={20} style={{ color: 'var(--brand-primary)' }} />
              <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>LỊCH SỬ YÊU CẦU & KẾT QUẢ</h2>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {hcResult && hcResult.length > 0 && (
                <>
                  <button onClick={handleExportCurrentCSV} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
                    <FileSpreadsheet size={14} /> Xuất CSV hiện tại
                  </button>
                  <button onClick={handleExportCurrentJSON} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }}>
                    <FileJson size={14} /> Xuất JSON hiện tại
                  </button>
                </>
              )}
              <button onClick={() => fetchGenerationHistory()} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
                <RefreshCw size={14} className={isFetchingGenHistory ? 'tech-spinner' : ''} /> Làm mới
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            {isFetchingGenHistory && generationHistory.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={26} className="tech-spinner" style={{ marginBottom: 12 }} />
                <div>Đang tải lịch sử báo cáo…</div>
              </div>
            ) : generationHistory.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                <Database size={32} style={{ marginBottom: 12, opacity: 0.25 }} />
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Chưa có phiên chạy nào được lưu</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Hãy hoàn tất bước "Tối ưu (GA/HC)" để hệ thống tự lưu báo cáo tại đây.</div>
              </div>
            ) : (
              <table className="premium-table">
                <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--surface-subtle)', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                  <tr>
                    <th style={{ padding: '12px 20px', textAlign: 'left' }}>Tên bộ test</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left' }}>Độ phủ</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left' }}>Ngày chạy</th>
                    <th style={{ padding: '12px 20px', textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {generationHistory.map((h: any) => (
                    <tr key={h.id} style={{ borderTop: '1px solid var(--border-subtle)' }} className="row-hover">
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 700 }}>{h.spec_name || 'Báo cáo tối ưu'}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Quy mô: {h.total_testcases || h.total_test_cases || h.total_cases || h.testcases || h.step4_optimized_data?.length || 0} TCs</div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <b style={{ color: 'var(--color-emerald)', fontSize: 16 }}>
                          {Math.round((h.coverage_rate > 1 ? h.coverage_rate : (h.coverage_rate || 0) * 100))}%
                        </b>
                      </td>
                      <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>{fmtDate(h.created_at)}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button onClick={() => handleViewDetail(h.id)} className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 12 }}>Xem chi tiết</button>
                          <button onClick={(e) => handleDelete(e, h.id)} className="icon-btn-danger" title="Xóa bản ghi" style={{ padding: 6 }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <LocalStyles />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  VIEW: CHI TIẾT (tái dựng read-only Bước 1→4)
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="fade-in-up" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Thanh điều hướng quay lại + tên phiên */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <button onClick={handleBack} className="btn btn-secondary" style={{ padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={15} /> Quay lại danh sách
        </button>
        {snapshot && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Đang xem lại: <b style={{ color: 'var(--text-primary)' }}>{snapshot.spec_name}</b> · {fmtDate(snapshot.created_at)}
            </div>
            <button onClick={() => {
              restoreSessionFromHistory(snapshot);
            }} className="btn btn-primary" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={15} /> Khôi phục phiên này
            </button>
          </div>
        )}
      </div>

      {/* Mini-stepper 1→4 (độc lập với workflow stepper 6 bước) */}
      <div className="glass-card" style={{ padding: '12px 18px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', minWidth: 'max-content' }}>
          {STEPS.map((s, idx) => {
            const isCurrent = activeStep === s.n;
            const isDone = activeStep > s.n;
            return (
              <React.Fragment key={s.n}>
                <button
                  onClick={() => setActiveStep(s.n)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    background: isCurrent ? 'var(--brand-primary)' : isDone ? 'rgba(13,148,136,0.12)' : 'var(--divider)',
                    color: isCurrent ? '#fff' : isDone ? 'var(--color-teal)' : 'var(--text-muted)',
                    border: isCurrent ? '2px solid var(--brand-primary)' : isDone ? '2px solid rgba(13,148,136,0.4)' : '2px solid var(--border-subtle)',
                    transition: 'all 0.3s ease',
                  }}>
                    {isDone ? <CheckCircle2 size={15} /> : s.n}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? 'var(--brand-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {s.label}
                  </span>
                </button>
                {idx < STEPS.length - 1 && (
                  <div style={{ width: 40, flexShrink: 0, height: 2, margin: '0 12px', background: isDone ? 'rgba(13,148,136,0.4)' : 'var(--border-subtle)' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Nội dung snapshot theo bước */}
      {loadingDetail || !snapshot ? (
        <div className="glass-card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={26} className="tech-spinner" style={{ marginBottom: 12 }} />
          <div>Đang tải dữ liệu snapshot…</div>
        </div>
      ) : (
        <div className="glass-card" style={{ padding: 20 }}>
          {activeStep === 1 && <StepInputView data={{ raw_text: snapshot.raw_text || snapshot.step1_raw_text }} />}
          {activeStep === 2 && <StepEvaluationView data={{
            evaluation: snapshot.step2_eval_result || snapshot.step3_seeds?.evaluation,
            metrics: snapshot.step3_metrics || snapshot.step3_seeds?.metrics,
            seeds: snapshot.initialPopulation || snapshot.step3_seeds?.seeds || [],
            fields: snapshot.fields || snapshot.step2_schema?.fields,
            constraints: snapshot.constraints || snapshot.step2_schema?.constraints,
            businessRules: snapshot.businessRules || snapshot.step2_schema?.business_rules
          }} />}
          {activeStep === 3 && (
            <StepOptimizedView
              forceTab="ga"
              rows={snapshot.gaResult || snapshot.step3_seeds?.gaResult || snapshot.step4_history?.[snapshot.step4_history.length - 1]?.best_solution || snapshot.step3_seeds?.step4_history?.[snapshot.step3_seeds?.step4_history?.length - 1]?.best_solution || []}
              coverage={snapshot.coverage_rate || snapshot.step4_history?.[snapshot.step4_history.length - 1]?.coverage || snapshot.step3_seeds?.step4_history?.[snapshot.step3_seeds?.step4_history?.length - 1]?.coverage}
              progressHistory={snapshot.step4_history || snapshot.step3_seeds?.step4_history || snapshot.step4_progress_history || []}
              maStats={snapshot.step4_ma_stats || snapshot.maStats}
              snapshot={snapshot}
              onExportCSV={handleExportCSV}
              onExportJSON={handleExportJSON}
              onExportPDF={handleExportPDF}
            />
          )}
          {activeStep === 4 && (
            <StepOptimizedView
              forceTab="hc"
              rows={snapshot.step4_optimized_data || snapshot.hcResult || []}
              coverage={snapshot.coverage_rate}
              progressHistory={snapshot.step4_history || snapshot.step3_seeds?.step4_history || snapshot.step4_progress_history || []}
              maStats={snapshot.step4_ma_stats || snapshot.maStats}
              snapshot={snapshot}
              onExportCSV={handleExportCSV}
              onExportJSON={handleExportJSON}
              onExportPDF={handleExportPDF}
            />
          )}
          {activeStep === 5 && (
            <div className="fade-in-up">
              <AlgorithmCharts snapshotData={snapshot} />
            </div>
          )}
        </div>
      )}
      <LocalStyles />
    </div>
  );
};

// ─── BƯỚC 1: Đầu vào ────────────────────────────────────────────────────────
const StepInputView: React.FC<{ data: any }> = ({ data }) => {
  const text = data?.raw_text || data?.step1_raw_text || data?.rawText || '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionTitle icon={<FileInput size={18} />} text="Đặc tả yêu cầu đầu vào (Bước 1)" />
      <div style={{
        background: 'var(--surface-subtle)', padding: '16px 20px', borderRadius: 8,
        border: '1px solid var(--border-subtle)', whiteSpace: 'pre-wrap',
        lineHeight: 1.8, fontSize: 13.5, color: 'var(--text-primary)',
        maxHeight: 520, overflowY: 'auto', fontFamily: 'var(--font-mono, monospace)'
      }}>
        {text ? text : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>(Không có văn bản đặc tả - Phiên chạy này sử dụng mẫu Preset hoặc cấu hình trực tiếp)</span>}
      </div>
    </div>
  );
};

// ─── BƯỚC 2: Phân tích (fields + F0) ────────────────────────────────────────
const StepAnalysisView: React.FC<{ data: any }> = ({ data }) => {
  const fields: any[] = data?.fields || data?.step1_parsed_schema || data?.step2_schema?.fields || [];
  const seeds: any[] = data?.initial_seeds || data?.initialPopulation || data?.step3_seeds?.seeds || [];
  const constraints: any[] = data?.constraints || data?.step1_constraints || data?.step2_schema?.constraints || [];
  const businessRules: any[] = data?.businessRules || data?.step1_business_rules || data?.step2_schema?.business_rules || [];

  const flattenSeed = (s: any) => ({ ...(s.values || {}), ...s });
  const flatSeeds = seeds.map(flattenSeed);
  const META_KEYS_EVAL = new Set(['values', 'id', 'tcid', 'rationale', 'origin', 'fitness', 'llmfitness', 'gafitness', 'hcfitness', 'finalfitness', 'categories', 'validationscore', 'boundaryscore', 'negativescore', 'errordescription', 'expectedresult', 'scenario', 'method', 'expected_result', 'error_description']);
  const seedKeys = flatSeeds.length > 0
    ? Object.keys(flatSeeds[0]).filter(k => !META_KEYS_EVAL.has(k.trim().toLowerCase()) && !k.startsWith('_'))
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Chỉ hiển thị fields nếu có */}
      {fields.length > 0 && (
        <div>
          <SectionTitle icon={<Database size={18} />} text={`Trường dữ liệu & ràng buộc (${fields.length})`} />
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden', marginTop: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead style={{ background: 'var(--surface-subtle)', color: 'var(--text-muted)' }}>
                <tr>
                  <th style={thS}>Tên trường</th><th style={thS}>Kiểu</th>
                  <th style={thS}>Bắt buộc</th><th style={thS}>Ràng buộc</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f: any, i: number) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td style={{ ...tdS, fontWeight: 600 }}>{f.name}</td>
                    <td style={tdS}><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--color-teal)' }}>{f.type}</span></td>
                    <td style={tdS}>{f.required ? 'Có' : 'Không'}</td>
                    <td style={{ ...tdS, color: 'var(--text-muted)', fontSize: 11.5 }}>{describeConstraints(f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tập hạt giống F0 */}
      <div>
        <SectionTitle icon={<ListChecks size={18} />} text={`Tập hạt giống F0 (${flatSeeds.length} ca)`} />
        {flatSeeds.length === 0 ? <Empty text="Không có hạt giống F0." /> : (
          <div style={{ maxHeight: 360, overflow: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 8, marginTop: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-subtle)', zIndex: 2 }}>
                <tr>
                  <th style={thS}>#</th>
                  {seedKeys.map(k => <th key={k} style={thS}>{k}</th>)}
                  <th style={thS}>Expected Result</th>
                  <th style={thS}>Fitness</th>
                </tr>
              </thead>
              <tbody>
                {flatSeeds.slice(0, 100).map((s: any, i: number) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td style={{ ...tdS, color: 'var(--text-muted)' }}>{i + 1}</td>
                    {seedKeys.map(k => <td key={k} style={{ ...tdS, maxWidth: 200, wordBreak: 'break-word' }}>{String(s[k] ?? '')}</td>)}
                    <td style={{ ...tdS, fontSize: 11.5, color: 'var(--text-secondary)' }}>{
                      typeof s.expectedResult === 'string' ? s.expectedResult :
                      s.expectedResult?.statusText || String(s.expectedResult || '')
                    }</td>
                    <td style={{ ...tdS, fontWeight: 600 }}>{s.fitness != null ? `${Math.round(s.fitness * 100)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(businessRules.length > 0 || constraints.length > 0) && (
        <div>
          <SectionTitle icon={<ListChecks size={18} />} text="Ràng buộc & Quy tắc nghiệp vụ (Business Rules)" />
          <div style={{ background: 'var(--surface-subtle)', padding: 16, borderRadius: 8, border: '1px solid var(--border-subtle)', marginTop: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
            {businessRules.map((br, idx) => (
              <div key={`br-${idx}`} style={{ marginBottom: 6 }}>
                <strong style={{ color: 'var(--brand-primary)' }}>ĐK: {br.condition}</strong>
                {br.expectedAction && <span> → <span style={{color: br.expectedAction === 'allow' ? 'var(--color-emerald)' : 'var(--color-rose)'}}>{br.expectedAction.toUpperCase()}</span></span>}
                {br.errorMessage && <span> (Lỗi: {br.errorMessage})</span>}
              </div>
            ))}
            {constraints.map((c, idx) => {
              const fieldName = c.field || (c.when && c.when.field) || c.constraint_id || 'Unknown';
              const ruleDesc = c.rule || c.description || JSON.stringify(c);
              return (
                <div key={`c-${idx}`} style={{ marginBottom: 6 }}>
                  <strong style={{ color: 'var(--color-violet)' }}>Ràng buộc ({fieldName}):</strong> {ruleDesc}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const StepEvaluationView: React.FC<{ data: any }> = ({ data }) => {
  const evalData = data?.evaluation ?? (data && (data.score != null || data.strengths) ? data : null);
  const metrics = data?.metrics ?? null;
  const seeds: any[] = data?.seeds || data?.f0 || [];
  const fields: any[] = data?.fields || [];
  const constraints: any[] = data?.constraints || [];
  const businessRules: any[] = data?.businessRules || [];

  if (!evalData && !metrics && fields.length === 0) return <Empty text="Phiên này chưa lưu dữ liệu đánh giá (Bước 2 đã bỏ qua)." />;

  const flattenSeed = (s: any) => ({ ...(s.values || {}), ...s });
  const flatSeeds = seeds.map(flattenSeed);
  const seedKeys = flatSeeds.length > 0
    ? Object.keys(flatSeeds[0]).filter(k => !['values', 'id', 'tcId', 'rationale', 'origin', 'fitness', 'llmFitness', 'gaFitness', 'hcFitness', 'finalFitness', 'categories', 'validationScore', 'boundaryScore', 'negativeScore'].includes(k) && !k.startsWith('_'))
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Chỉ hiển thị fields nếu có */}
      {fields.length > 0 && (
        <div>
          <SectionTitle icon={<Database size={18} />} text={`Trường dữ liệu & ràng buộc (${fields.length})`} />
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden', marginTop: 10 }}>
            <table className="premium-table" style={{ fontSize: 12.5 }}>
              <thead style={{ background: 'var(--surface-subtle)', color: 'var(--text-muted)' }}>
                <tr>
                  <th style={thS}>Tên trường</th><th style={thS}>Kiểu</th>
                  <th style={thS}>Bắt buộc</th><th style={thS}>Ràng buộc</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f: any, i: number) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td style={{ ...tdS, fontWeight: 600 }}>{f.name}</td>
                    <td style={tdS}><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--color-teal)' }}>{f.type}</span></td>
                    <td style={tdS}>{f.required ? 'Có' : 'Không'}</td>
                    <td style={{ ...tdS, color: 'var(--text-muted)', fontSize: 11.5 }}>{describeConstraints(f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(businessRules.length > 0 || constraints.length > 0) && (
        <div>
          <SectionTitle icon={<ListChecks size={18} />} text="Quy tắc nghiệp vụ & Ràng buộc chéo" />
          <div style={{ background: 'var(--surface-subtle)', padding: 16, borderRadius: 8, border: '1px solid var(--border-subtle)', marginTop: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
            {businessRules.map((br, idx) => (
              <div key={`br-${idx}`} style={{ marginBottom: 6 }}>
                <strong style={{ color: 'var(--brand-primary)' }}>ĐK: {br.condition}</strong>
                {br.expectedAction && <span> → <span style={{color: br.expectedAction === 'allow' ? 'var(--color-emerald)' : 'var(--color-rose)'}}>{br.expectedAction.toUpperCase()}</span></span>}
                {br.errorMessage && <span> (Lỗi: {br.errorMessage})</span>}
              </div>
            ))}
            {constraints.map((c, idx) => {
              const fieldName = c.field || (c.when && c.when.field) || c.constraint_id || 'Unknown';
              const ruleDesc = c.rule || c.description || JSON.stringify(c);
              return (
                <div key={`c-${idx}`} style={{ marginBottom: 6 }}>
                  <strong style={{ color: 'var(--color-violet)' }}>Ràng buộc ({fieldName}):</strong> {ruleDesc}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <SectionTitle icon={<Gauge size={18} />} text="Đánh giá chất lượng tập F0" />

      {/* KPI Cards (Tạm ẩn theo yêu cầu) */}
      {/* {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <MetricCard label="Coverage Rate" value={`${Number(metrics.coverage ?? 0).toFixed(1)}%`} pct={Number(metrics.coverage ?? 0)} color="var(--color-emerald)" />
          <MetricCard label="Fitness Score" value={Number(metrics.fitness ?? 0).toFixed(3)} pct={Number(metrics.fitness ?? 0) * 100} color="var(--color-teal)" />
          <MetricCard label="Duplicate Rate" value={`${(Number(metrics.dupRate ?? 0) * 100).toFixed(1)}%`} pct={Number(metrics.dupRate ?? 0) * 100} color="#f59e0b" />
          <MetricCard label="Tập F0" value={`${metrics.total ?? 0}`} sub={`${metrics.validCount ?? 0} hợp lệ`} />
          {metrics.securityRate != null && (
            <MetricCard label="Security Case Rate" value={`${(Number(metrics.securityRate) * 100).toFixed(1)}%`} pct={Number(metrics.securityRate) * 100} color="var(--color-rose)" />
          )}
        </div>
      )} */}

      {/* AI Evaluation */}
      {evalData && (evalData.score > 0 || (evalData.strengths && evalData.strengths.length > 0)) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Điểm AI tổng quan:</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-emerald)' }}>{evalData.score ?? '—'}<span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/100</span></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <EvalList title="Điểm mạnh" items={evalData.strengths} color="var(--color-emerald)" icon={<CheckCircle2 size={14} />} />
            <EvalList title="Điểm yếu" items={evalData.weaknesses} color="#f59e0b" icon={<AlertTriangle size={14} />} />
            <EvalList title="Ca còn thiếu" items={evalData.missing_cases} color="var(--color-teal)" icon={<ListChecks size={14} />} />
            <EvalList title="Rủi ro bảo mật" items={evalData.security_risks} color="var(--color-rose)" icon={<ShieldAlert size={14} />} />
          </div>
        </div>
      )}

      {/* Bảng F0 seeds nếu có */}
      {flatSeeds.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>Tập F0 ({flatSeeds.length} ca)</div>
          <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
            <table className="premium-table" style={{ fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-subtle)', zIndex: 2 }}>
                <tr>
                  <ColHeader en="Test Code" vi="Mã ca kiểm thử" minWidth={100} />
                  {seedKeys.map(k => <ColHeader key={k} en={k} vi="Trường dữ liệu" minWidth={250} />)}
                  <ColHeader en="Expected Result" vi="Kết quả mong muốn" minWidth={250} />
                  <ColHeader en="Expected Error" vi="Lỗi mong muốn" minWidth={250} />
                  <ColHeader en="Fitness" vi="Fitness" align="right" minWidth={80} />
                </tr>
              </thead>
              <tbody>
                {flatSeeds.slice(0, 100).map((s: any, i: number) => {
                  const isSeed = String(s.origin || '').toLowerCase().includes('seed');
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 600 }}>{s.tcId || s.id || `TC-${String(i + 1).padStart(3, '0')}`}</div>
                        <div style={{ marginTop: 5 }}>
                          <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, backgroundColor: isSeed ? 'rgba(59, 130, 246, 0.08)' : 'var(--surface-subtle)', border: `1px solid ${isSeed ? 'rgba(59, 130, 246, 0.2)' : 'var(--border-subtle)'}`, color: isSeed ? '#3b82f6' : 'var(--text-secondary)', textTransform: 'uppercase' }}>
                            {isSeed ? 'LLM (Seed)' : 'LLM'}
                          </span>
                        </div>
                      </td>
                      {seedKeys.map(k => <td key={k} style={{ padding: '5px 8px', maxWidth: 350, wordBreak: 'break-word', fontFamily: 'var(--font-mono)', fontSize: 12, verticalAlign: 'top' }}>{String(s[k] ?? '')}</td>)}
                      <td style={{ padding: '5px 8px', verticalAlign: 'top', maxWidth: 350, wordBreak: 'break-word', color: 'var(--text-primary)' }}>
                        {typeof s.expectedResult === 'string' ? s.expectedResult : s.expectedResult?.statusText || ''}
                      </td>
                      <td style={{ padding: '5px 8px', verticalAlign: 'top', color: 'var(--text-muted)', fontSize: 11, maxWidth: 350, wordBreak: 'break-word' }}>
                        {s.errorDescription || 'Không có'}
                      </td>
                      <td style={{ padding: '5px 8px', fontWeight: 600, color: 'var(--color-emerald)', textAlign: 'right', verticalAlign: 'top' }}>
                        {s.fitness != null ? Number(s.fitness > 1 ? s.fitness / 100 : s.fitness).toFixed(3) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── BƯỚC 4: Tối ưu GA & HC (tab) ──────────────────────────────────────────
const StepOptimizedView: React.FC<{
  rows: any[]; coverage: number; progressHistory: any[]; maStats: any;
  snapshot: any;
  forceTab?: 'ga' | 'hc';
  onExportCSV: () => void; onExportJSON: () => void; onExportPDF: () => void;
}> = ({ rows, coverage, progressHistory, maStats, snapshot, forceTab, onExportCSV, onExportJSON, onExportPDF }) => {
  const [tab, setTab] = useState<'ga' | 'hc'>('ga');
  const activeTab = forceTab || tab;

  // Flatten tc để đọc trực tiếp các trường
  const flattenTc = (tc: any) => ({
    ...(tc.values || {}), ...tc,
    fitness: tc.finalFitness ?? tc.hcFitness ?? tc.gaFitness ?? tc.fitness ?? 0,
  });

  const gaRows = (snapshot?.gaResult || snapshot?.step3_seeds?.gaResult || (forceTab === 'ga' ? rows : []) || []).map(flattenTc);
  const hcRows = (snapshot?.hcResult || snapshot?.step4_optimized_data || (forceTab === 'hc' ? rows : []) || []).map(flattenTc);
  const activeRows = activeTab === 'ga' ? gaRows : hcRows;

  const META_KEYS = new Set(['values', 'id', 'tcid', 'rationale', 'origin', 'fitness', 'llmfitness',
    'gafitness', 'hcfitness', 'finalfitness', 'categories', 'validationscore', 'boundaryscore',
    'negativescore', 'errordescription', 'expectedresult', 'ma_action', 'generation',
    'parent_ids', 'local_search_applied', 'improvement', 'coverage', 'changes', 'covers',
    'llm_values', 'ga_values', 'hc_values', 'scenario', 'method', 'expected_result', 'error_description']);
  const dataKeys = activeRows.length > 0
    ? Object.keys(activeRows[0]).filter(k => !META_KEYS.has(k.trim().toLowerCase()) && !k.startsWith('_'))
    : [];

  const chartData = (progressHistory || []).map((e: any) => ({
    gen: e.generation,
    'Fitness tốt nhất': e.bestFitness != null ? +(e.bestFitness * 100).toFixed(1) : null,
    'Độ phủ': e.coverage != null ? +(e.coverage * 100).toFixed(1) : null,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <SectionTitle icon={<Zap size={18} />} text={activeTab === 'ga' ? "Bộ test tối ưu (GA)" : "Bộ test tối ưu (HC)"} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} className="no-print">
          <span style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--color-emerald)', padding: '4px 12px', borderRadius: 20, fontWeight: 700, fontSize: 12 }}>
            Độ phủ: {Math.round((coverage || 0) > 1 ? (coverage || 0) : (coverage || 0) * 100)}%
          </span>
          <button onClick={onExportCSV} className="btn btn-secondary" style={{ padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <FileSpreadsheet size={14} style={{ color: 'var(--color-emerald)' }} /> Excel
          </button>
          <button onClick={onExportPDF} className="btn btn-secondary" style={{ padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <FileText size={14} style={{ color: 'var(--color-rose)' }} /> PDF
          </button>
          <button onClick={onExportJSON} className="btn btn-primary" style={{ padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'var(--brand-primary)' }}>
            <FileJson size={14} /> JSON
          </button>
        </div>
      </div>

      {/* Tab switcher GA / HC (ẩn nếu forceTab) */}
      {!forceTab && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setTab('ga')}
            style={{
              padding: '7px 20px', fontSize: 13, fontWeight: tab === 'ga' ? 700 : 500,
              borderRadius: 6, border: 'none', cursor: 'pointer',
              background: tab === 'ga' ? 'var(--brand-primary)' : 'var(--surface-subtle)',
              color: tab === 'ga' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.2s',
            }}
          >Tối ưu GA ({gaRows.length})</button>
          <button
            onClick={() => setTab('hc')}
            style={{
              padding: '7px 20px', fontSize: 13, fontWeight: tab === 'hc' ? 700 : 500,
              borderRadius: 6, border: 'none', cursor: 'pointer',
              background: tab === 'hc' ? 'var(--brand-primary)' : 'var(--surface-subtle)',
              color: tab === 'hc' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.2s',
            }}
          >Tối ưu HC ({hcRows.length})</button>
        </div>
      )}

      {/* MA Stats */}
      {maStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <MetricCard label="Fitness tốt nhất" value={maStats.bestFitness != null ? Number(maStats.bestFitness > 1 ? maStats.bestFitness / 100 : maStats.bestFitness).toFixed(3) : '—'} color="var(--color-emerald)" />
          <MetricCard label="Fitness TB" value={maStats.avgFitness != null ? Number(maStats.avgFitness > 1 ? maStats.avgFitness / 100 : maStats.avgFitness).toFixed(3) : '—'} color="var(--color-teal)" />
          <MetricCard label="Đa dạng" value={maStats.diversity != null ? `${Math.round(maStats.diversity * 100)}%` : '—'} />
          <MetricCard label="Elite" value={String(maStats.eliteCount ?? '—')} />
          <MetricCard label="Lai ghép" value={String(maStats.crossoverCount ?? '—')} />
          <MetricCard label="Đột biến" value={String(maStats.mutationCount ?? '—')} />
          <MetricCard label="Local Search" value={String(maStats.localSearchCount ?? '—')} />
          <MetricCard label="Trùng đã loại" value={String(maStats.duplicatesRemoved ?? '—')} />
        </div>
      )}

      {/* Biểu đồ tiến hóa (chỉ hiện với tab GA) */}
      {tab === 'ga' && chartData.length > 1 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Đồ thị tiến hóa qua các thế hệ</div>
          <div style={{ height: 220, background: 'var(--surface-subtle)', borderRadius: 8, border: '1px solid var(--border-subtle)', padding: '12px 8px 0 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 6, right: 16, bottom: 6, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="gen" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} domain={[0, 100]} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Fitness tốt nhất" stroke="#0891B2" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Độ phủ" stroke="#10B981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Bảng dữ liệu */}
      {activeRows.length === 0 ? (
        <Empty text={`Không có dữ liệu ${tab === 'ga' ? 'GA' : 'HC'} trong snapshot này.`} />
      ) : (
        <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 8, background: 'var(--surface-default)' }}>
          <table className="premium-table" style={{ fontSize: 12, minWidth: 1400 }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-subtle)', zIndex: 2 }}>
              <tr>
                <ColHeader en="Test Code" vi="Mã ca kiểm thử" />
                <ColHeader en="LLM Source" vi="Nguồn LLM" width={120} />
                <ColHeader en="GA Operator" vi="Toán tử GA" width={150} />
                {dataKeys.map(k => <ColHeader key={k} en={k} vi="Trường dữ liệu" minWidth={150} />)}
                <ColHeader en="Expected Result" vi="Kết quả mong muốn" minWidth={220} />
                <ColHeader en="Expected Error" vi="Lỗi mong muốn" minWidth={200} />
                <ColHeader en="Improvement Goal" vi="Mục tiêu cải tiến" minWidth={200} />
                <ColHeader en="Fitness" vi="Fitness (0-1)" width={90} align="right" />
                <ColHeader en="ValidationScore" vi="Hợp lệ (0-1)" width={100} align="right" />
                <ColHeader en="BoundaryScore" vi="Biên (0-1)" width={90} align="right" />
                <ColHeader en="DiversityScore" vi="Đa dạng (0-1)" width={90} align="right" />
                <ColHeader en="PriorityScore" vi="Ưu tiên (0-1)" width={90} align="right" />
              </tr>
            </thead>
            <tbody>
              {activeRows.map((tc: any, i: number) => {
                const isSeed = String(tc.origin || '').toLowerCase().includes('seed');
                const badge = getOriginBadge(tc.ma_action || tc.origin || (tab === 'ga' ? 'GA' : 'HC'));
                return (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)', background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                    <td style={{ ...tdS, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {tc.tcId || tc.id || `TC-${String(i + 1).padStart(3, '0')}`}
                    </td>
                    <td style={{ ...tdS }}>
                      <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 600, backgroundColor: isSeed ? 'rgba(59, 130, 246, 0.08)' : 'var(--surface-subtle)', border: `1px solid ${isSeed ? 'rgba(59, 130, 246, 0.2)' : 'var(--border-subtle)'}`, color: isSeed ? '#3b82f6' : 'var(--text-secondary)' }}>
                        {isSeed ? 'LLM (Seed)' : 'LLM'}
                      </span>
                    </td>
                    <td style={{ ...tdS }}>
                      <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 600, backgroundColor: badge.bg, border: `1px solid ${badge.border}`, color: badge.color }}>
                        {badge.label}
                      </span>
                    </td>
                    {dataKeys.map(k => {
                      const val = tc[k];
                      const empty = val === undefined || val === null || String(val) === '';
                      return (
                        <td key={k} style={{ ...tdS, verticalAlign: 'top', maxWidth: 350, wordBreak: 'break-word', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>
                          {empty ? <span style={{ color: 'var(--text-muted)' }}>—</span> : String(val)}
                        </td>
                      );
                    })}
                    <td style={{ ...tdS, verticalAlign: 'top', maxWidth: 350, wordBreak: 'break-word' }}>
                      {typeof tc.expectedResult === 'string' ? tc.expectedResult : tc.expectedResult?.statusText || String(tc.expectedResult || '')}
                    </td>
                    <td style={{ ...tdS, verticalAlign: 'top', color: 'var(--text-muted)', fontSize: 11, maxWidth: 350, wordBreak: 'break-word' }}>
                      {tc.errorDescription || 'Không có'}
                    </td>
                    <td style={{ ...tdS, verticalAlign: 'top', fontSize: 11.5 }}>
                      {tc.rationale || tc.scenario || '—'}
                    </td>
                    <td style={{ ...tdS, fontWeight: 600, color: 'var(--color-emerald)', textAlign: 'right' }}>
                      {tc.fitness != null ? Number(tc.fitness > 1 ? tc.fitness / 100 : tc.fitness).toFixed(3) : '—'}
                    </td>
                    <td style={{ ...tdS, fontSize: 11 }}>{tc.validationScore != null ? tc.validationScore.toFixed(2) : '—'}</td>
                    <td style={{ ...tdS, fontSize: 11 }}>{tc.boundaryScore != null ? tc.boundaryScore.toFixed(2) : '—'}</td>
                    <td style={{ ...tdS, fontSize: 11 }}>{tc.diversityScore != null ? tc.diversityScore.toFixed(2) : '—'}</td>
                    <td style={{ ...tdS, fontSize: 11 }}>{tc.priorityScore != null ? tc.priorityScore.toFixed(2) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};



// ─── Sub-components dùng chung ──────────────────────────────────────────────
const SectionTitle: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--brand-primary)' }}>
    {icon}<h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)' }}>{text}</h3>
  </div>
);

const MetricCard: React.FC<{ label: string; value: string; sub?: string; pct?: number; color?: string }> = ({ label, value, sub, pct, color }) => (
  <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 12px' }}>
    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 700, color: color || 'var(--text-primary)', marginTop: 3, wordBreak: 'break-word' }}>{value}</div>
    {sub && <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    {pct != null && (
      <div style={{ marginTop: 6, height: 4, borderRadius: 4, background: 'var(--border-subtle)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: color || 'var(--brand-primary)' }} />
      </div>
    )}
  </div>
);

const EvalList: React.FC<{ title: string; items?: string[]; color: string; icon: React.ReactNode }> = ({ title, items, color, icon }) => (
  <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{icon}{title}</div>
    {(!items || items.length === 0) ? (
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</div>
    ) : (
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it, i) => <li key={i} style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{it}</li>)}
      </ul>
    )}
  </div>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{text}</div>
);

const describeConstraints = (f: any): string => {
  const parts: string[] = [];
  if (f.minLength != null || f.maxLength != null) parts.push(`độ dài ${f.minLength ?? '?'}–${f.maxLength ?? '?'}`);
  if (f.minValue != null || f.maxValue != null) parts.push(`giá trị ${f.minValue ?? '?'}–${f.maxValue ?? '?'}`);
  if (f.pattern) parts.push(`pattern: ${f.pattern}`);
  if (Array.isArray(f.enum) && f.enum.length) parts.push(`enum: ${f.enum.join('|')}`);
  return parts.join(' · ') || '—';
};

const LocalStyles: React.FC = () => (
  <style>{`
    .row-hover:hover { background: rgba(0,0,0,0.015); }
    .icon-btn-danger { background: transparent; border: 1px solid transparent; color: var(--color-rose); border-radius: 6px; cursor: pointer; display: flex; transition: 0.2s; }
    .icon-btn-danger:hover { background: rgba(225,29,72,0.08); border-color: rgba(225,29,72,0.2); }
    
    .premium-table { width: 100%; border-collapse: separate; border-spacing: 0; }
    .premium-table thead { background: var(--surface-subtle); position: sticky; top: 0; z-index: 2; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .premium-table th { padding: 5px 8px; text-align: left; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--border-subtle); white-space: nowrap; }
    .premium-table td { padding: 5px 8px; color: var(--text-primary); border-bottom: 1px solid var(--border-subtle); vertical-align: middle; }
    .premium-table tbody tr { transition: all 0.2s ease; background: var(--surface-default); }
    .premium-table tbody tr:hover { background: var(--surface-subtle); }
    .premium-table tbody tr:last-child td { border-bottom: none; }
    
    @media print {
      .app-sidebar, header, footer, .no-print, button, .glass-card:first-child, .glass-card:nth-child(2) { display: none !important; }
      .app-container, main { margin-left: 0 !important; padding: 0 !important; background: white !important; }
      .glass-card { border: none !important; padding: 0 !important; box-shadow: none !important; background: transparent !important; }
      table { width: 100% !important; border: 1px solid #ddd !important; }
      th, td { border: 1px solid #ddd !important; padding: 8px !important; color: black !important; }
    }
  `}</style>
);

const thS: React.CSSProperties = {};
const tdS: React.CSSProperties = {};

export default ExportReportCenter;
