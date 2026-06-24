import React, { useEffect, useState } from 'react';
import {
  Database, RefreshCw, FileSpreadsheet, FileJson, ArrowLeft, Trash2,
  FileInput, Gauge, Zap, CheckCircle2, ShieldAlert, AlertTriangle, ListChecks, FileText,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { toast } from '../store/useToastStore';

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

const STEPS = [
  { n: 1, label: 'Đầu vào', icon: <FileInput size={15} /> },
  { n: 2, label: 'Phân tích', icon: <Database size={15} /> },
  { n: 3, label: 'Đánh giá', icon: <Gauge size={15} /> },
  { n: 4, label: 'Tối ưu GA/HC', icon: <Zap size={15} /> },
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
    // Tối ưu: Chỉ tự động fetch nếu danh sách đang rỗng
    if (generationHistory.length === 0) {
      fetchGenerationHistory();
    }
  }, [fetchGenerationHistory, generationHistory.length]);

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
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
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
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Quy mô: {h.total_testcases ?? 0} TCs</div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <b style={{ color: 'var(--color-emerald)', fontSize: 16 }}>{Math.round((h.coverage_rate || 0) * 100)}%</b>
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
          {activeStep === 1 && <StepInputView data={{ raw_text: snapshot.step1_raw_text }} />}
          {activeStep === 2 && <StepAnalysisView data={{
            fields: snapshot.step2_schema?.fields,
            initial_seeds: snapshot.step3_seeds?.seeds,
            constraints: snapshot.step2_schema?.constraints,
            businessRules: snapshot.step2_schema?.business_rules
          }} />}
          {activeStep === 3 && <StepEvaluationView data={{
            evaluation: snapshot.step3_seeds?.evaluation,
            metrics: snapshot.step3_seeds?.metrics
          }} />}
          {activeStep === 4 && (
            <StepOptimizedView
              rows={snapshot.step4_optimized_data || []}
              coverage={snapshot.coverage_rate}
              progressHistory={snapshot.step4_progress_history || []}
              maStats={snapshot.step4_ma_stats}
              onExportCSV={handleExportCSV}
              onExportJSON={handleExportJSON}
              onExportPDF={handleExportPDF}
            />
          )}
        </div>
      )}
      <LocalStyles />
    </div>
  );
};

// ─── BƯỚC 1: Đầu vào ────────────────────────────────────────────────────────
const StepInputView: React.FC<{ data: any }> = ({ data }) => {
  if (!data) return <Empty text="Không có dữ liệu đầu vào." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionTitle icon={<FileInput size={18} />} text="Đặc tả yêu cầu đầu vào (Bước 1)" />
      <div style={{ background: 'var(--surface-subtle)', padding: 16, borderRadius: 8, border: '1px solid var(--border-subtle)', whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 13.5 }}>
        {data.raw_text || '—'}
      </div>
    </div>
  );
};

// ─── BƯỚC 2: Phân tích (fields + F0) ────────────────────────────────────────
const StepAnalysisView: React.FC<{ data: any }> = ({ data }) => {
  const fields: any[] = data?.fields || [];
  const seeds: any[] = data?.initial_seeds || [];
  const constraints: any[] = data?.constraints || [];
  const businessRules: any[] = data?.businessRules || [];
  const seedKeys = seeds.length > 0 ? Object.keys(toCleanRow(seeds[0])) : [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <SectionTitle icon={<Database size={18} />} text={`Trường dữ liệu & ràng buộc (${fields.length})`} />
        {fields.length === 0 ? <Empty text="Không có trường dữ liệu." /> : (
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
        )}
      </div>

      <div>
        <SectionTitle icon={<ListChecks size={18} />} text={`Tập hạt giống F0 (${seeds.length})`} />
        {seeds.length === 0 ? <Empty text="Không có hạt giống F0." /> : (
          <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 8, marginTop: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-subtle)' }}>
                <tr>
                  <th style={thS}>#</th>
                  {seedKeys.map(k => <th key={k} style={thS}>{k}</th>)}
                </tr>
              </thead>
              <tbody>
                {seeds.slice(0, 100).map((s: any, i: number) => {
                  const row = toCleanRow(s);
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td style={{ ...tdS, color: 'var(--text-muted)' }}>{i + 1}</td>
                      {seedKeys.map(k => <td key={k} style={tdS}>{String(row[k] ?? '')}</td>)}
                    </tr>
                  );
                })}
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

// ─── BƯỚC 3: Đánh giá ───────────────────────────────────────────────────────
const StepEvaluationView: React.FC<{ data: any }> = ({ data }) => {
  // data = { evaluation: {score, strengths,...} | null, metrics: {coverage,fitness,dupRate,total,validCount} | null }
  // Tương thích ngược: snapshot cũ có thể lưu thẳng evaluation object.
  const evalData = data?.evaluation ?? (data && (data.score != null || data.strengths) ? data : null);
  const metrics = data?.metrics ?? null;
  if (!evalData && !metrics) return <Empty text="Phiên này chưa lưu dữ liệu đánh giá (Bước 3 đã bỏ qua)." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SectionTitle icon={<Gauge size={18} />} text="Đánh giá chất lượng tập F0 (Bước 3)" />

      {/* Thông số định lượng (biểu đồ thanh đơn giản) */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          <MetricCard label="Độ phủ F0" value={`${Number(metrics.coverage ?? 0).toFixed(1)}%`} pct={Number(metrics.coverage ?? 0)} color="var(--color-emerald)" />
          <MetricCard label="Fitness trung bình" value={Number(metrics.fitness ?? 0).toFixed(3)} pct={Number(metrics.fitness ?? 0) * 100} color="var(--color-teal)" />
          <MetricCard label="Tỉ lệ trùng lặp" value={`${(Number(metrics.dupRate ?? 0) * 100).toFixed(1)}%`} pct={Number(metrics.dupRate ?? 0) * 100} color="#f59e0b" />
          <MetricCard label="Quy mô F0" value={`${metrics.total ?? 0}`} sub={`${metrics.validCount ?? 0} hợp lệ · ${(metrics.total ?? 0) - (metrics.validCount ?? 0)} biên/âm`} />
        </div>
      )}

      {/* Đánh giá AI */}
      {evalData ? (
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
      ) : (
        <Empty text="Phiên này không lưu đánh giá AI (chỉ có thông số định lượng)." />
      )}
    </div>
  );
};

// ─── BƯỚC 4: Toàn bộ data tối ưu + biểu đồ + thống kê + download ─────────────
const StepOptimizedView: React.FC<{
  rows: any[]; coverage: number; progressHistory: any[]; maStats: any;
  onExportCSV: () => void; onExportJSON: () => void; onExportPDF: () => void;
}> = ({ rows, coverage, progressHistory, maStats, onExportCSV, onExportJSON, onExportPDF }) => {
  const cleanRows = rows.map(toCleanRow);
  const keys = cleanRows.length > 0 ? Object.keys(cleanRows[0]) : [];

  const chartData = (progressHistory || []).map((e: any) => ({
    gen: e.generation,
    'Fitness tốt nhất': e.bestFitness != null ? +(e.bestFitness * 100).toFixed(1) : null,
    'Độ phủ': e.coverage != null ? +(e.coverage * 100).toFixed(1) : null,
    'Đa dạng': e.diversity != null ? +(e.diversity * 100).toFixed(1) : null,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <SectionTitle icon={<Zap size={18} />} text={`Bộ test tối ưu bằng MA (${rows.length} ca)`} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} className="no-print">
          <span style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--color-emerald)', padding: '4px 12px', borderRadius: 20, fontWeight: 700, fontSize: 12 }}>
            Độ phủ: {Math.round((coverage || 0) * 100)}%
          </span>
          <button onClick={onExportCSV} className="btn btn-secondary" style={{ padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <FileSpreadsheet size={14} style={{ color: 'var(--color-emerald)' }} /> Excel (.csv)
          </button>
          <button onClick={onExportPDF} className="btn btn-secondary" style={{ padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <FileText size={14} style={{ color: 'var(--color-rose)' }} /> Xuất PDF
          </button>
          <button onClick={onExportJSON} className="btn btn-primary" style={{ padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'var(--brand-primary)' }}>
            <FileJson size={14} /> Xuất JSON
          </button>
        </div>
      </div>

      {/* Thống kê thuật toán MA */}
      {maStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <MetricCard label="Fitness tốt nhất" value={maStats.bestFitness != null ? `${Math.round(maStats.bestFitness * 100)}%` : '—'} />
          <MetricCard label="Fitness TB" value={maStats.avgFitness != null ? `${Math.round(maStats.avgFitness * 100)}%` : '—'} />
          <MetricCard label="Đa dạng quần thể" value={maStats.diversity != null ? `${Math.round(maStats.diversity * 100)}%` : '—'} />
          <MetricCard label="Cá thể Elite" value={String(maStats.eliteCount ?? '—')} />
          <MetricCard label="Lai ghép" value={String(maStats.crossoverCount ?? '—')} />
          <MetricCard label="Đột biến" value={String(maStats.mutationCount ?? '—')} />
          <MetricCard label="Tìm kiếm cục bộ" value={String(maStats.localSearchCount ?? '—')} />
          <MetricCard label="Trùng đã loại" value={String(maStats.duplicatesRemoved ?? '—')} />
        </div>
      )}

      {/* Biểu đồ tiến hóa qua các thế hệ */}
      {chartData.length > 1 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Đồ thị tiến hóa Memetic qua các thế hệ</div>
          <div style={{ height: 260, background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', padding: '12px 8px 0 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 6, right: 16, bottom: 6, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="gen" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} domain={[0, 100]} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border-subtle)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Fitness tốt nhất" stroke="#0891B2" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Độ phủ" stroke="#10B981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Đa dạng" stroke="#4F46E5" strokeWidth={2} dot={false} strokeDasharray="4 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {rows.length === 0 ? <Empty text="Không có dữ liệu test case." /> : (
        <div style={{ maxHeight: 480, overflow: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-subtle)', zIndex: 2 }}>
              <tr>
                <th style={thS}>#</th>
                {keys.map(k => <th key={k} style={thS}>{k}</th>)}
                <th style={thS}>Fitness</th>
                <th style={thS}>Nguồn</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((tc: any, i: number) => {
                const row = toCleanRow(tc);
                return (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td style={{ ...tdS, color: 'var(--text-muted)' }}>{i + 1}</td>
                    {keys.map(k => <td key={k} style={{ ...tdS, verticalAlign: 'top', maxWidth: 240, wordBreak: 'break-all' }}>{String(row[k] ?? '')}</td>)}
                    <td style={{ ...tdS, fontWeight: 600 }}>{tc.fitness != null ? `${Math.round(tc.fitness * 100)}%` : '—'}</td>
                    <td style={{ ...tdS, color: 'var(--text-muted)', fontSize: 11 }}>{tc.origin ?? tc.ma_action ?? 'MA'}</td>
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
    
    @media print {
      .app-sidebar, header, footer, .no-print, button, .glass-card:first-child, .glass-card:nth-child(2) { display: none !important; }
      .app-container, main { margin-left: 0 !important; padding: 0 !important; background: white !important; }
      .glass-card { border: none !important; padding: 0 !important; box-shadow: none !important; background: transparent !important; }
      table { width: 100% !important; border: 1px solid #ddd !important; }
      th, td { border: 1px solid #ddd !important; padding: 8px !important; color: black !important; }
    }
  `}</style>
);

const thS: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' };
const tdS: React.CSSProperties = { padding: '9px 12px', verticalAlign: 'middle' };

export default ExportReportCenter;
