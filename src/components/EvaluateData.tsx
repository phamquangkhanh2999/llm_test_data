import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileJson,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wand2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useMemo } from 'react';
import type { FieldConstraint } from '../algorithms/presets';
import { useAppStore } from '../store/useAppStore';
import { toast } from '../store/useToastStore';

// =============================================================================
//  BƯỚC 5: ĐÁNH GIÁ DỮ LIỆU KIỂM THỬ — bám sát màn Stitch.
//  Coverage gauge (tròn) + Fitness Score + Duplicate Rate + Processing Time,
//  và bảng "Test Case Preview" với ID / Input Data / Latency / Complexity /
//  Validation Status. Đánh giá tập F0 (LLM sinh) TRƯỚC khi đưa vào MA.
//  Tính client-side từ initialSeeds (chưa cần backend).
// =============================================================================

const METHODS: { id: string; label: string; desc: string }[] = [
  { id: 'ep', label: 'Phân vùng tương đương (Equivalence Partitioning - EP)', desc: 'Đại diện mỗi lớp tương đương' },
  { id: 'bva', label: 'Phân tích giá trị biên (Boundary Value Analysis - BVA)', desc: 'Tập trung các giá trị biên min/max' },
  { id: 'random', label: 'Chọn ngẫu nhiên (Random Testing)', desc: 'Sinh giá trị hợp lệ ngẫu nhiên' },
];

// Kiểm tra 1 ca test có hợp lệ theo schema không (đơn giản hóa)
const isValidCase = (row: Record<string, any>, schema: FieldConstraint[]): boolean => {
  for (const f of schema) {
    const v = row[f.name];
    const s = String(v ?? '');
    if (f.required && (v === undefined || v === null || s === '')) return false;
    if (f.type === 'number') {
      const n = Number(v);
      if (Number.isNaN(n)) return false;
      if (f.minValue != null && n < f.minValue) return false;
      if (f.maxValue != null && n > f.maxValue) return false;
    } else if (f.type === 'email') {
      if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return false;
    } else if (f.regex && s) {
      try {
        const re = new RegExp(f.regex);
        if (!re.test(s)) return false;
      } catch (e) {
        // Ignore invalid regex
      }
    } else if (f.type === 'phone' && !f.regex) {
      if (s && !/^(03|05|07|08|09)\d{8}$/.test(s)) return false;
    } else if (f.type === 'card' && !f.regex) {
      if (s && !/^\d{16}$/.test(s)) return false;
    } else if (f.type !== 'email' && f.type !== 'number' && f.type !== 'phone' && f.type !== 'card') {
      if (f.minLength != null && s.length < f.minLength) return false;
      if (f.maxLength != null && s.length > f.maxLength) return false;
    }
  }
  return true;
};

const getMethodBadgeColor = (method: string) => {
  switch (method) {
    case 'bva':
      return {
        bg: 'rgba(239, 68, 68, 0.08)',
        text: 'var(--error)',
        border: 'rgba(239, 68, 68, 0.2)',
      };
    case 'ep':
      return {
        bg: 'rgba(59, 130, 246, 0.08)',
        text: 'var(--brand-primary)',
        border: 'rgba(59, 130, 246, 0.2)',
      };
    case 'decision':
      return {
        bg: 'rgba(16, 185, 129, 0.08)',
        text: 'var(--color-emerald)',
        border: 'rgba(16, 185, 129, 0.2)',
      };
    case 'random':
      return {
        bg: 'rgba(245, 158, 11, 0.08)',
        text: 'var(--warning)',
        border: 'rgba(245, 158, 11, 0.2)',
      };
    default:
      return {
        bg: 'rgba(100, 116, 139, 0.08)',
        text: 'var(--text-muted)',
        border: 'rgba(100, 116, 139, 0.2)',
      };
  }
};

const Gauge: React.FC<{ value: number }> = ({ value }) => {
  const r = 52,
    c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const off = c - (pct / 100) * c;
  return (
    <div style={{ position: 'relative', width: 140, height: 140 }}>
      <svg width='140' height='140' style={{ transform: 'rotate(-90deg)' }}>
        <circle cx='70' cy='70' r={r} fill='none' stroke='var(--surface-subtle)' strokeWidth='12' />
        <circle
          cx='70'
          cy='70'
          r={r}
          fill='none'
          stroke='var(--color-emerald)'
          strokeWidth='12'
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap='round'
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontSize: 30,
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}
        >
          {pct.toFixed(1)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -2 }}>% phủ</span>
      </div>
    </div>
  );
};

// Hàm phân tích lý do lỗi chi tiết / Helper function to extract detailed failure reasons
export const getFailureReasons = (
  row: Record<string, any>,
  schema: FieldConstraint[],
): string[] => {
  const target = row.values || row;
  const errors: string[] = [];
  for (const f of schema) {
    const v = target[f.name];
    const s = String(v ?? '');
    if (f.required && (v === undefined || v === null || s === '')) {
      errors.push(`Trường "${f.name}" là bắt buộc / Field "${f.name}" is required`);
      continue;
    }
    if (v === undefined || v === null || s === '') continue;
    if (f.type === 'number') {
      const n = Number(v);
      if (Number.isNaN(n)) {
        errors.push(`Trường "${f.name}" phải là số / Field "${f.name}" must be a number`);
      } else {
        if (f.minValue != null && n < f.minValue) {
          errors.push(
            `Trường "${f.name}" (${n}) < min (${f.minValue}) / Field "${f.name}" (${n}) < min (${f.minValue})`,
          );
        }
        if (f.maxValue != null && n > f.maxValue) {
          errors.push(
            `Trường "${f.name}" (${n}) > max (${f.maxValue}) / Field "${f.name}" (${n}) > max (${f.maxValue})`,
          );
        }
      }
    } else if (f.type === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
        errors.push(`Email "${f.name}" không hợp lệ / Email "${f.name}" is invalid`);
      }
    } else if (f.regex && s) {
      try {
        const re = new RegExp(f.regex);
        if (!re.test(s)) {
          errors.push(`Trường "${f.name}" không khớp định dạng / Field "${f.name}" does not match pattern: ${f.regex}`);
        }
      } catch (e) {
        // Ignore invalid regex
      }
    } else if (f.type === 'phone' && !f.regex) {
      if (!/^(03|05|07|08|09)\d{8}$/.test(s)) {
        errors.push(`Số điện thoại "${f.name}" không hợp lệ (Phải là SĐT Việt Nam 10 số)`);
      }
    } else if (f.type === 'card' && !f.regex) {
      if (!/^\d{16}$/.test(s)) {
        errors.push(`Số thẻ "${f.name}" không hợp lệ (Phải gồm 16 chữ số)`);
      }
    } else if (f.type !== 'email' && f.type !== 'number' && f.type !== 'phone' && f.type !== 'card') {
      if (f.minLength != null && s.length < f.minLength) {
        errors.push(
          `Độ dài "${f.name}" (${s.length}) < min length (${f.minLength}) / Length of "${f.name}" (${s.length}) < min length (${f.minLength})`,
        );
      }
      if (f.maxLength != null && s.length > f.maxLength) {
        errors.push(
          `Độ dài "${f.name}" (${s.length}) > max length (${f.maxLength}) / Length of "${f.name}" (${s.length}) > max length (${f.maxLength})`,
        );
      }
    }
  }
  return errors;
};

export const EvaluateData: React.FC = () => {
  const {
    initialSeeds,
    parsedSchema,
    setActiveScreen,
    setInitialSeeds,
    isParsing,
    isEvaluating,
    selectedMethods,
    setSelectedMethods,
    handleGenerateTestSuite,
    handleEvaluateSeeds,
    evaluationResult,
    setEvaluationMetrics,
    boundaryCount,
    setBoundaryCount,
  } = useAppStore();

  const [selectedTC, setSelectedTC] = React.useState<any | null>(null);
  const [methodFilter, setMethodFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  const handleGenerate = async () => {
    if (parsedSchema.length === 0) {
      toast.warning('Chưa có Schema. Hãy hoàn tất bước Phân Tích & Thiết Kế Testcase trước.');
      return;
    }
    await handleGenerateTestSuite();
    // Auto evaluate immediately after F0 generation finishes!
    const methodsStr = useAppStore.getState().selectedMethods.join(', ');
    await handleEvaluateSeeds(methodsStr);
  };

  const toggleMethod = (id: string) => {
    setSelectedMethods((prev: any) => {
      const arr = Array.isArray(prev) ? prev : [prev];
      if (arr.includes(id)) {
        if (arr.length === 1) {
          toast.warning('Phải chọn ít nhất một phương pháp thiết kế!');
          return arr;
        }
        return arr.filter((m: any) => m !== id);
      } else {
        return [...arr, id];
      }
    });
  };

  const metrics = useMemo(() => {
    const seeds = initialSeeds || [];
    const total = seeds.length;
    if (total === 0) return null;

    const SEC_KW = ["' or", '--', 'union', '<script', 'javascript:', '../..'];
    const hasSecurity = (row: Record<string, any>) =>
      Object.values(row.values || row).some((v) => SEC_KW.some((kw) => String(v).toLowerCase().includes(kw)));

    // Đồng bộ thước đo với backend (_compute_full_coverage):
    //   coverage = 0.5·val_cov + 0.35·bound_cov + 0.15·sec_cov
    // — chỉ tính biên CÓ THẬT (field email/phone/card/enum không vào mẫu số).
    const possibleBounds = new Set<string>();
    for (const f of parsedSchema) {
      if (f.type === 'number') {
        if (f.minValue != null) possibleBounds.add(`${f.name}_min`);
        if (f.maxValue != null) possibleBounds.add(`${f.name}_max`);
      } else {
        if (f.minLength != null) possibleBounds.add(`${f.name}_minL`);
        if (f.maxLength != null) possibleBounds.add(`${f.name}_maxL`);
      }
    }

    const coveredBounds = new Set<string>();
    let suiteHasSecurity = false;
    let validCount = 0;
    let securityCases = 0;

    for (const row of seeds) {
      if (isValidCase(row, parsedSchema)) validCount += 1;
      if (hasSecurity(row)) {
        suiteHasSecurity = true;
        securityCases += 1;
      }
      const target = row.values || row;
      for (const f of parsedSchema) {
        const v = target[f.name];
        const s = String(v ?? '');
        if (f.type === 'number') {
          const n = Number(v);
          if (!Number.isNaN(n)) {
            if (f.minValue != null && n === f.minValue) coveredBounds.add(`${f.name}_min`);
            if (f.maxValue != null && n === f.maxValue) coveredBounds.add(`${f.name}_max`);
          }
        } else {
          if (f.minLength != null && s.length === f.minLength) coveredBounds.add(`${f.name}_minL`);
          if (f.maxLength != null && s.length === f.maxLength) coveredBounds.add(`${f.name}_maxL`);
        }
      }
    }

    const uniq = new Set(seeds.map((s) => JSON.stringify(s))).size;
    const dupRate = total ? (total - uniq) / total : 0;
    const valCov = total ? validCount / total : 0;
    const boundCov = parsedSchema.length ? coveredBounds.size / parsedSchema.length : 1;
    const secCov = suiteHasSecurity ? 1 : 0;
    const securityCaseRate = total ? securityCases / total : 0;

    const coverage =
      Math.round(Math.min(0.5 * valCov + 0.35 * boundCov + 0.15 * secCov, 1) * 1000) / 10;
    // Fitness F0 theo trọng số mặc định MA {val .5, bound .2, sec .2, div .1}
    const fitness =
      Math.round((0.5 * valCov + 0.2 * boundCov + 0.2 * secCov + 0.1 * (uniq / total)) * 1000) /
      1000;

    return { total, validCount, dupRate, coverage, fitness, securityCaseRate };
  }, [initialSeeds, parsedSchema]);

  // Đồng bộ thông số định lượng F0 lên store để snapshot Bước 6 chụp lại được
  React.useEffect(() => {
    setEvaluationMetrics(metrics);
  }, [metrics, setEvaluationMetrics]);

  const filteredSeeds = useMemo(() => {
    let list = initialSeeds || [];
    if (methodFilter !== 'all') {
      list = list.filter((s) => s.method === methodFilter);
    }
    if (statusFilter !== 'all') {
      list = list.filter((s) => {
        const ok = isValidCase(s, parsedSchema);
        return statusFilter === 'pass' ? ok : !ok;
      });
    }
    return list;
  }, [initialSeeds, parsedSchema, methodFilter, statusFilter]);

  const preview = filteredSeeds.slice(0, 100);

  // --- XUẤT EXCEL (.CSV UTF-8 BOM) ---
  const handleExportExcel = () => {
    const data = filteredSeeds;
    if (data.length === 0) return;

    // Khởi tạo danh sách tiêu đề cột song ngữ trùng khớp với bảng Test Case Preview
    const csvHeaders = [
      'Test Case (Mã ca kiểm thử)',
      'Method (Phương pháp)',
      ...parsedSchema.map((f: any) => f.name),
      'Expected Result (Kết quả mong muốn)',
      'Expected Error (Lỗi mong muốn)',
      'Fitness',
    ];

    let csv = '\uFEFF' + csvHeaders.join(',') + '\n';

    data.forEach((row: any, i: number) => {
      const resShort = getExpectedResultShort(row.expectedResult);
      const rowData: string[] = [];

      // 1. Mã ca kiểm thử
      rowData.push(`TC-${String(124 + i).padStart(5, '0')}`);

      // 2. Phương pháp
      rowData.push(row.method || '');

      // 3. Các trường dữ liệu động
      parsedSchema.forEach((f: any) => {
        const val = (row.values || row)[f.name];
        rowData.push(val !== undefined && val !== null ? String(val) : '');
      });

      // 4. Kết quả mong muốn
      rowData.push(resShort);

      // 5. Lỗi mong muốn
      rowData.push(resShort === 'Error' ? getExpectedError(row.expectedResult) : 'Không có');

      // 6. Fitness
      rowData.push(typeof row.fitness === 'number' ? row.fitness.toFixed(3) : '—');

      csv += rowData.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TestSuite_F0_${(useAppStore.getState().schemaName || 'preview').replace(/\s+/g, '_')}.csv`;
    a.click();
    toast.success('Đã xuất file Excel.');
  };

  // --- XUẤT JSON (KÈM METADATA) ---
  const handleExportJSON = () => {
    const data = filteredSeeds;
    if (data.length === 0) return;

    const exportTestSuite = data.map((row: any, i: number) => {
      const resShort = getExpectedResultShort(row.expectedResult);
      const cleaned: any = {};

      // 1. Metadata khớp bảng Xem trước
      cleaned.id = `TC-${String(124 + i).padStart(5, '0')}`;
      cleaned.method = row.method || null;

      // 2. Các trường dữ liệu động
      const target = row.values || row;
      parsedSchema.forEach((f: any) => {
        cleaned[f.name] = target[f.name] !== undefined ? target[f.name] : null;
      });

      // 3. Kết quả, lỗi, fitness
      cleaned.expected_result = resShort;
      cleaned.expected_error =
        resShort === 'Error' ? getExpectedError(row.expectedResult) : 'Không có';
      cleaned.fitness = typeof row.fitness === 'number' ? +row.fitness.toFixed(3) : null;

      // Giữ lại expectedResult gốc phòng trường hợp cần thiết
      if (row.expectedResult !== undefined) {
        cleaned.expected_result_raw = row.expectedResult;
      }

      return cleaned;
    });

    const exportData = {
      report_info: {
        project: useAppStore.getState().schemaName || 'F0 Preview',
        date: new Date().toISOString(),
        total: exportTestSuite.length,
      },
      optimization_metrics: {
        algorithm: 'LLM F0 Generation',
        coverage: metrics?.coverage || 0,
        fitness: metrics?.fitness || 0,
      },
      test_suite: exportTestSuite,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TestSuite_F0_${(useAppStore.getState().schemaName || 'preview').replace(/\s+/g, '_')}.json`;
    a.click();
    toast.success('Đã xuất file JSON.');
  };

  return (
    <div className='fade-in-up'>
      {/* 1. CẤU HÌNH SINH F0 (Chuyển từ LlmGenerate sang) */}
      <div className='glass-card teal-border' style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <Wand2 size={18} style={{ color: 'var(--color-teal)' }} />
          <h3 style={{ fontSize: 15, margin: 0 }}>Sinh Dữ Liệu Ban Đầu F0 bằng LLM</h3>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Chọn phương pháp thiết kế ca kiểm thử để LLM sinh tập hạt giống F0 cho thuật toán Memetic
          tiến hóa.
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 10,
            marginBottom: 16,
          }}
        >
          {METHODS.map((m) => {
            const isSelected = selectedMethods.includes(m.id as any);
            return (
              <button
                key={m.id}
                onClick={() => toggleMethod(m.id)}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--color-teal-glow)' : 'var(--bg-card)',
                  border: `1px solid ${isSelected ? 'var(--color-teal)' : 'var(--border-subtle)'}`,
                  transition: 'var(--transition-fast)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 600,
                    fontSize: 13,
                    color: isSelected ? 'var(--color-teal)' : 'var(--text-primary)',
                  }}
                >
                  {isSelected ? (
                    <CheckCircle2 size={14} style={{ color: 'var(--color-teal)' }} />
                  ) : (
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        border: '1px solid var(--text-muted)',
                      }}
                    />
                  )}
                  {m.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                  {m.desc}
                </div>
              </button>
            );
          })}
        </div>

        {selectedMethods.includes('bva') && (
          <div style={{ marginBottom: 16, padding: '12px', background: 'var(--brand-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-primary)', marginBottom: 8 }}>
              Cấu hình Cận biên (BVA)
            </div>
            <select 
              value={boundaryCount}
              onChange={(e) => setBoundaryCount(Number(e.target.value))}
              style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', fontSize: 12.5, outline: 'none', color: 'var(--text-primary)' }}
            >
              <option value={2}>2 Biên (min, max) - Nhanh chóng</option>
              <option value={4}>4 Biên (min-1, min, max, max+1) - Khuyên dùng</option>
              <option value={6}>6 Biên (min-1, min, min+1, max-1, max, max+1) - Dò quét sâu</option>
            </select>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={isParsing || isEvaluating || parsedSchema.length === 0}
          className={
            isParsing || isEvaluating || parsedSchema.length === 0
              ? 'btn btn-disabled'
              : 'btn btn-primary'
          }
          style={{ fontSize: 14, padding: '11px 22px' }}
        >
          {isParsing ? <RefreshCw size={16} className='tech-spinner' /> : <Sparkles size={16} />}
          {isParsing
            ? 'Đang sinh F0…'
            : isEvaluating
              ? 'Đang đánh giá…'
              : initialSeeds.length > 0
                ? 'Sinh Lại & Đánh Giá F0'
                : 'Sinh & Đánh Giá Dữ Liệu F0'}
        </button>
      </div>

      {/* 2. KẾT QUẢ ĐÁNH GIÁ VÀ PREVIEW */}
      {isEvaluating ? (
        <div
          className='glass-card'
          style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}
        >
          <RefreshCw
            size={28}
            className='tech-spinner'
            style={{ color: 'var(--color-teal)', marginBottom: 10 }}
          />
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
            AI đang đánh giá chất lượng tập F0...
          </div>
          <div style={{ fontSize: 12.5, marginTop: 4 }}>
            Vui lòng đợi trong giây lát, hệ thống đang tính toán độ bao phủ và tối ưu mẫu.
          </div>
        </div>
      ) : !metrics ? (
        <div
          className='glass-card'
          style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}
        >
          <Activity size={28} style={{ marginBottom: 10, opacity: 0.5 }} />
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
            Chưa có dữ liệu F0 để đánh giá
          </div>
          <div style={{ fontSize: 12.5, marginTop: 4 }}>
            Hãy chọn phương pháp ở trên và bấm "Sinh & Đánh Giá Dữ Liệu F0" để bắt đầu.
          </div>
        </div>
      ) : (
        <>
          {/* 4 thẻ chỉ số */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: 14,
              marginBottom: 16,
            }}
          >
            <div
              className='glass-card'
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: '16px',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 600,
                }}
              >
                Coverage Rate
              </div>
              <Gauge value={metrics.coverage} />
              <div style={{ fontSize: 11.5, color: 'var(--color-emerald)', fontWeight: 600 }}>
                ↑ tập F0 sẵn sàng tiến hóa
              </div>
            </div>

            <div
              className='glass-card'
              style={{
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                Fitness Score
              </div>
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.03em',
                }}
              >
                {metrics.fitness.toFixed(3)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Độ tin cậy so với ground-truth
              </div>
              <div
                style={{
                  height: 4,
                  background: 'var(--surface-subtle)',
                  borderRadius: 999,
                  marginTop: 10,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${metrics.fitness * 100}%`,
                    height: '100%',
                    background: 'var(--brand-primary)',
                  }}
                />
              </div>
            </div>

            <div className='glass-card' style={{ padding: '18px 20px' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 600,
                  }}
                >
                  Duplicate Rate
                </div>
                <ShieldCheck
                  size={15}
                  style={{
                    color: metrics.dupRate < 0.15 ? 'var(--color-emerald)' : 'var(--warning)',
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  marginTop: 8,
                }}
              >
                {(metrics.dupRate * 100).toFixed(1)}%
              </div>
              <span
                style={{
                  display: 'inline-block',
                  marginTop: 8,
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background:
                    metrics.dupRate < 0.15 ? 'rgba(16,185,129,0.12)' : 'rgba(217,119,6,0.12)',
                  color: metrics.dupRate < 0.15 ? 'var(--color-emerald)' : 'var(--warning)',
                }}
              >
                {metrics.dupRate < 0.15 ? 'Optimal' : 'Cần GA tối ưu'}
              </span>
            </div>

            <div className='glass-card' style={{ padding: '18px 20px' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 600,
                  }}
                >
                  Tập F0
                </div>
                <Clock size={15} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  marginTop: 8,
                }}
              >
                {metrics.total}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {metrics.validCount} hợp lệ · {metrics.total - metrics.validCount} biên/âm
              </div>
            </div>

            <div className='glass-card' style={{ padding: '18px 20px', display: 'none' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 600,
                  }}
                >
                  Security Case Rate
                </div>
                <ShieldCheck size={15} style={{ color: 'var(--error)' }} />
              </div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  marginTop: 8,
                }}
              >
                {(metrics.securityCaseRate * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Tỉ lệ ca chứa payload SQLi/XSS
              </div>
            </div>
          </div>

          {/* AI Quality Report Panel */}
          {evaluationResult && (
            <div
              className='glass-card teal-border'
              style={{ marginBottom: 16, padding: '18px 20px' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 14,
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} style={{ color: 'var(--color-teal)' }} />
                  <h3 style={{ fontSize: 14.5, margin: 0, fontWeight: 700 }}>
                    AI Quality &amp; Security Report (Đánh giá F0)
                  </h3>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--color-teal)',
                    background: 'var(--color-teal-glow)',
                    padding: '3px 10px',
                    borderRadius: 999,
                  }}
                >
                  Điểm AI: {evaluationResult.score}/100
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 16,
                }}
              >
                <div>
                  <h4
                    style={{
                      fontSize: 12,
                      margin: '0 0 6px 0',
                      color: 'var(--color-emerald)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <CheckCircle2 size={13} /> Ưu điểm (Strengths)
                  </h4>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 16,
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                    }}
                  >
                    {evaluationResult.strengths?.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4
                    style={{
                      fontSize: 12,
                      margin: '0 0 6px 0',
                      color: 'var(--warning)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <AlertTriangle size={13} /> Điểm yếu / Thiếu sót (Weaknesses)
                  </h4>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 16,
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                    }}
                  >
                    {evaluationResult.weaknesses?.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                    {evaluationResult.missing_cases?.map((m, idx) => (
                      <li key={`m-${idx}`}>{m}</li>
                    ))}
                  </ul>
                </div>

                {evaluationResult.security_risks && evaluationResult.security_risks.length > 0 && (
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      borderTop: '1px dotted var(--border-subtle)',
                      paddingTop: 10,
                    }}
                  >
                    <h4
                      style={{
                        fontSize: 12,
                        margin: '0 0 6px 0',
                        color: 'var(--error)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <ShieldCheck size={13} style={{ color: 'var(--error)' }} /> Cảnh báo bảo mật
                      (Security Risks)
                    </h4>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 16,
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
                      }}
                    >
                      {evaluationResult.security_risks.map((r, idx) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Test Case Preview */}
          <div className='glass-card' style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '13px 18px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <h3 style={{ fontSize: 14.5, margin: 0 }}>
                Test Case Preview{' '}
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>
                  · Hiển thị {preview.length}/{filteredSeeds.length} (Tổng {metrics.total})
                </span>
              </h3>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 6 }} className='no-print'>
                  <button
                    onClick={handleExportExcel}
                    className='btn btn-secondary'
                    style={{
                      padding: '5px 10px',
                      fontSize: 12,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <FileSpreadsheet size={13} style={{ color: 'var(--color-emerald)' }} />
                    Xuất Excel
                  </button>
                  <button
                    onClick={handleExportJSON}
                    className='btn btn-primary'
                    style={{
                      padding: '5px 10px',
                      fontSize: 12,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <FileJson size={13} />
                    Xuất JSON
                  </button>
                </div>

                {/* Bộ lọc trạng thái */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    padding: '5px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    outline: 'none',
                    fontWeight: 500,
                  }}
                >
                  <option value='all'>Tất cả trạng thái</option>
                  <option value='pass'>Đạt</option>
                  <option value='fail'>Lỗi</option>
                </select>

                {/* Bộ lọc phương pháp */}
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    padding: '5px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    outline: 'none',
                    fontWeight: 500,
                  }}
                >
                  <option value='all'>Tất cả phương pháp</option>
                  <option value='ep'>Phân vùng tương đương (EP)</option>
                  <option value='bva'>Phân tích giá trị biên (BVA)</option>
                  <option value='random'>Chọn ngẫu nhiên (Random)</option>
                </select>
              </div>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 500, background: 'var(--bg-card)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                  <tr
                    style={{
                      background: 'var(--surface-subtle)',
                      textAlign: 'left',
                      position: 'sticky',
                      top: 0,
                      zIndex: 5,
                    }}
                  >
                    <ColHeader en='Test Code' vi='Mã ca kiểm thử' />
                    {parsedSchema.map((f: any) => (
                      <ColHeader
                        key={f.name}
                        en={f.name}
                        vi={`Trường dữ liệu${f.type ? ` (${f.type})` : ''}`}
                        minWidth={150}
                      />
                    ))}
                    <ColHeader en='Expected Result' vi='Kết quả mong muốn' minWidth={260} />
                    <ColHeader en='Expected Error' vi='Lỗi mong muốn' minWidth={260} />
                    <ColHeader en='Fitness' vi='Fitness' align='right' />
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => {
                    return (
                      <tr
                        key={i}
                        // onClick={() => setSelectedTC(row)}
                        title='Nhấn để xem chi tiết ca kiểm thử'
                        style={{
                          borderTop: '1px solid var(--border-subtle)',
                          background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                          cursor: 'pointer',
                        }}
                      >
                        {/* Test Case ID */}
                        <td
                          style={{
                            padding: '10px 16px',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-secondary)',
                            verticalAlign: 'top',
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>
                            TC-{String(124 + i).padStart(5, '0')}
                          </div>
                          {row.method && (
                            <div style={{ marginTop: 5 }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  textTransform: 'uppercase',
                                  backgroundColor: getMethodBadgeColor(row.method).bg,
                                  color: getMethodBadgeColor(row.method).text,
                                  border: `1px solid ${getMethodBadgeColor(row.method).border}`,
                                }}
                              >
                                {row.method}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Các trường dữ liệu động */}
                        {parsedSchema.map((f: any) => {
                          const val = (row.values || row)[f.name];
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
                              }}
                            >
                              {empty ? (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          );
                        })}

                        {/* Kết quả mong muốn */}
                        <td style={{ padding: '10px 16px', verticalAlign: 'top' }}>
                          <div style={{ maxWidth: 340, wordBreak: 'break-word', lineHeight: '1.5' }}>
                            {getExpectedResultShort(row.expectedResult) === 'Error' ? (
                              <span style={{ color: 'var(--error)', fontWeight: 700, marginRight: '4px' }}>
                                Error:
                              </span>
                            ) : (
                              <span style={{ color: '#10b981', fontWeight: 700, marginRight: '4px' }}>
                                Success:
                              </span>
                            )}
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              {typeof row.expectedResult === 'string' ? row.expectedResult : (row.expectedResult?.statusText || String(row.expectedResult || ''))}
                            </span>
                          </div>
                        </td>

                        {/* Lỗi mong muốn */}
                        <td style={{ padding: '10px 16px', verticalAlign: 'top' }}>
                          <div style={{ maxWidth: 340, wordBreak: 'break-word', lineHeight: '1.5' }}>
                            {getExpectedResultShort(row.expectedResult) === 'Error' ? (
                              <span style={{ color: 'var(--error)', fontWeight: 500 }}>
                                {getExpectedError(row.expectedResult)}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                                Không có
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Fitness */}
                        <td
                          style={{
                            padding: '10px 16px',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: 'var(--brand-primary)',
                            verticalAlign: 'top',
                          }}
                        >
                          {typeof row.fitness === 'number' ? row.fitness.toFixed(3) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div
              style={{
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Hiển thị 1–{preview.length} / {filteredSeeds.length} (Tổng {metrics.total})
              </span>
            </div>
          </div>
        </>
      )}

      {/* MODAL CHI TIẾT CA KIỂM THỬ */}
      {selectedTC && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            className='glass-card fade-in-up'
            style={{
              maxWidth: 650,
              width: '100%',
              padding: 0,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    background: 'var(--brand-primary-glow)',
                    padding: 8,
                    borderRadius: 8,
                    color: 'var(--brand-primary)',
                    display: 'flex',
                  }}
                >
                  <FileText size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Chi Tiết Ca Kiểm Thử</h3>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Mã hiệu: TC-{Math.floor(Math.random() * 90000) + 10000}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedTC(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                {Object.entries(selectedTC)
                  .filter(
                    ([k]) =>
                      k !== 'fitness' &&
                      k !== 'origin' &&
                      k !== 'scenario' &&
                      k !== 'expectedResult' &&
                      k !== 'method',
                  )
                  .map(([k, v]) => (
                    <div
                      key={k}
                      style={{
                        background: 'var(--surface-subtle)',
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          marginBottom: 4,
                        }}
                      >
                        {k}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 13,
                          wordBreak: 'break-all',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {String(v)}
                      </div>
                    </div>
                  ))}
              </div>

              {/* Metadata */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-subtle)',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Phương pháp sinh dữ liệu
                  </span>
                  {selectedTC.method ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        textTransform: 'uppercase',
                        backgroundColor: getMethodBadgeColor(selectedTC.method).bg,
                        color: getMethodBadgeColor(selectedTC.method).text,
                        border: `1px solid ${getMethodBadgeColor(selectedTC.method).border}`,
                      }}
                    >
                      {selectedTC.method}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Không rõ
                    </span>
                  )}
                </div>

                <h4 style={{ margin: '8px 0 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                  Báo cáo Validation
                </h4>
                {parsedSchema.map((field) => {
                  const val = selectedTC[field.name];
                  const valStr = String(val ?? '');
                  let isFieldOk = true;
                  let errorMsg = '';

                  if (field.required && !valStr) {
                    isFieldOk = false;
                    errorMsg = 'Thiếu trường bắt buộc';
                  } else if (field.type === 'number') {
                    const n = Number(val);
                    if (isNaN(n)) {
                      isFieldOk = false;
                      errorMsg = 'Không phải định dạng số';
                    } else if (field.minValue != null && n < field.minValue) {
                      isFieldOk = false;
                      errorMsg = `Nhỏ hơn mức tối thiểu (${field.minValue})`;
                    } else if (field.maxValue != null && n > field.maxValue) {
                      isFieldOk = false;
                      errorMsg = `Lớn hơn mức tối đa (${field.maxValue})`;
                    }
                  } else {
                    if (field.minLength != null && valStr.length < field.minLength) {
                      isFieldOk = false;
                      errorMsg = `Ngắn hơn độ dài tối thiểu (${field.minLength})`;
                    }
                    if (field.maxLength != null && valStr.length > field.maxLength) {
                      isFieldOk = false;
                      errorMsg = `Dài hơn độ dài tối đa (${field.maxLength})`;
                    }
                  }

                  return (
                    <div
                      key={field.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: '1px solid var(--border-subtle)',
                        background: isFieldOk ? 'transparent' : 'rgba(225, 29, 72, 0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isFieldOk ? (
                          <CheckCircle2 size={14} style={{ color: 'var(--color-emerald)' }} />
                        ) : (
                          <AlertTriangle size={14} style={{ color: 'var(--error)' }} />
                        )}
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{field.name}</span>
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          color: isFieldOk ? 'var(--text-muted)' : 'var(--error)',
                        }}
                      >
                        {isFieldOk ? 'Hợp lệ' : errorMsg}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 12,
              }}
            >
              <button
                className='btn btn-danger'
                style={{ background: 'var(--error)', color: 'white' }}
                onClick={() => {
                  const idx = initialSeeds.indexOf(selectedTC);
                  if (idx !== -1) {
                    if (window.confirm('Bạn có chắc muốn xóa ca kiểm thử này?')) {
                      setInitialSeeds((prev) => prev.filter((_, i) => i !== idx));
                      setSelectedTC(null);
                    }
                  }
                }}
              >
                Xóa ca kiểm thử
              </button>
              <button className='btn btn-secondary' onClick={() => setSelectedTC(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ColHeader: React.FC<{
  en: string;
  vi: string;
  width?: number;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
}> = ({ en, vi, width, minWidth, align = 'left' }) => (
  <th style={{ padding: '12px 14px', width, minWidth, textAlign: align, fontWeight: 600 }}>
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
// Verdict nhị phân, KHÔNG còn phụ thuộc mã HTTP. Ưu tiên dấu hiệu lỗi trước
// (tránh chuỗi lý do có chữ "hợp lệ" bị đọc nhầm). Vẫn nhận data cũ ("HTTP …"/"VALIDATION_ERROR").
const getExpectedResultShort = (expectedResult: string): string => {
  if (!expectedResult) return 'Success';
  const clean = String(expectedResult).trim().toUpperCase();
  if (
    clean.startsWith('LỖI') || clean.startsWith('ERROR') || clean.startsWith('THẤT BẠI') ||
    clean.includes('VALIDATION_ERROR') ||
    clean.includes('HTTP 400') || clean.includes('HTTP 422') || clean.includes('HTTP 500')
  ) {
    return 'Error';
  }
  if (
    clean.startsWith('HỢP LỆ') || clean.startsWith('SUCCESS') || clean.startsWith('THÀNH CÔNG') ||
    clean.includes('HTTP 200') || clean.includes('HTTP 201')
  ) {
    return 'Success';
  }
  return 'Error';
};

const getExpectedError = (expectedResult: string): string => {
  if (!expectedResult) return 'Không có';
  const clean = String(expectedResult).trim();
  if (getExpectedResultShort(clean) === 'Success') return 'Không có';
  const upper = clean.toUpperCase();

  // Format mới: "Lỗi: <lý do>"
  if (upper.startsWith('LỖI')) {
    return clean.replace(/^lỗi\s*:?\s*/i, '').trim() || clean;
  }
  // Format cũ: "HTTP 4xx - <lý do>"
  if (upper.includes('HTTP 400') || upper.includes('HTTP 422') || upper.includes('HTTP 500')) {
    const parts = clean.split('-');
    if (parts.length > 1) {
      return parts.slice(1).join('-').trim();
    }
  }

  if (upper.includes('THẤT BẠI') || upper.includes('ERROR') || upper.includes('FAIL')) {
    let errorPart = clean;
    const splitIndex = clean.indexOf(' Kỳ vọng');
    if (splitIndex !== -1) {
      errorPart = clean.slice(0, splitIndex);
    }
    errorPart = errorPart.replace(/^(THẤT BẠI|ERROR|FAIL)\s*(\([^)]+\))?:\s*/i, '');
    return errorPart;
  }
  return clean;
};

export default EvaluateData;
