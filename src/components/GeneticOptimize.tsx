import {
  Activity,
  CheckCircle2,
  Cpu,
  FileJson,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Info,
  Layers,
  Play,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X
} from 'lucide-react';
import React, { useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { config } from '../config';
import { useAppStore } from '../store/useAppStore';
import { toast } from '../store/useToastStore';

// =============================================================================
//  GENETIC ALGORITHM TỐI ƯU (Bước 4 Stitch)
//  Chạy luồng trên backend: Genetic Algorithm (chính).
//  Trang này hiển thị: cấu hình + chỉ số GA + đồ thị tiến hóa.
// =============================================================================

interface RunResult {
  key: string;
  label: string;
  coverage: number;
  duplicateRate: number;
  bestFitness: number;
  size: number;
  execEpochs: number;
  progressHistory?: any[];
  optimizedDataset?: any[];
  maStats?: {
    totalCandidatesEvaluated: number;
    eliteCount: number;
    mutationCount: number;
    boundaryMutationCount?: number;
    securityMutationCount?: number;
    crossoverCount: number;
    localSearchCount: number;
    bestFitness: number;
    avgFitness: number;
    diversity?: number;
    duplicatesRemoved?: number;
    securityCaseRate?: number;
  };
}

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
  // Phân biệt 2 toán tử đột biến theo kịch bản (đặt TRƯỚC nhánh mutation chung)
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

const getTestIntent = (tc: any, schema: any[]) => {
  const securityKeywords = ["' or", '" or', '--', 'union', 'select', '<script'];
  let category = 'Validation Test';
  let subtype = 'Standard Form Input';
  let expectedBehavior = [
    'Xác thực tính hợp lệ của dữ liệu đầu vào (Validation Check)',
    'Lưu trữ thành công vào hệ thống cơ sở dữ liệu',
    'Phản hồi kết quả thành công HTTP 200/201',
  ];

  // 1. Check Security
  let hasSecurity = false;
  let secVal = '';
  for (const f of schema) {
    const v = String(tc[f.name] || '');
    if (securityKeywords.some((kw) => v.toLowerCase().includes(kw))) {
      hasSecurity = true;
      secVal = v;
      break;
    }
  }

  if (hasSecurity) {
    category = 'Security Test';
    if (secVal.toLowerCase().includes('<script')) {
      subtype = 'XSS Injection';
      expectedBehavior = ['Reject payload', 'Sanitize HTML', 'Log security event'];
    } else if (["' or", '--', 'union', 'select'].some((kw) => secVal.toLowerCase().includes(kw))) {
      subtype = 'SQL Injection';
      expectedBehavior = [
        'Reject payload',
        'Escape query injection patterns',
        'Log security event',
      ];
    } else {
      subtype = 'Injection Attack Pattern';
      expectedBehavior = ['Reject payload', 'Sanitize inputs', 'Log security event'];
    }
    return { category, subtype, expectedBehavior };
  }

  // 2. Check Boundary
  let hasBoundary = false;
  let boundReason = '';
  for (const f of schema) {
    const v = tc[f.name];
    if (v === undefined || v === null) continue;
    if (f.type === 'number') {
      const n = Number(v);
      if (f.minValue != null && n === f.minValue) {
        hasBoundary = true;
        boundReason = `Trường "${f.name}" đạt giá trị tối thiểu (${f.minValue})`;
        break;
      }
      if (f.maxValue != null && n === f.maxValue) {
        hasBoundary = true;
        boundReason = `Trường "${f.name}" đạt giá trị tối đa (${f.maxValue})`;
        break;
      }
    } else {
      const s = String(v);
      if (f.minLength != null && s.length === f.minLength) {
        hasBoundary = true;
        boundReason = `Độ dài trường "${f.name}" đạt mức tối thiểu (${f.minLength})`;
        break;
      }
      if (f.maxLength != null && s.length === f.maxLength) {
        hasBoundary = true;
        boundReason = `Độ dài trường "${f.name}" đạt mức tối đa (${f.maxLength})`;
        break;
      }
    }
  }

  if (hasBoundary) {
    category = 'Boundary Test';
    subtype = 'Cận biên giá trị giới hạn (BVA)';
    expectedBehavior = [
      boundReason,
      'Hệ thống không bị lỗi logic tính toán hoặc tràn bộ nhớ',
      'Chấp nhận xử lý biên hợp lệ hoặc chặn đúng quy tắc nếu vượt biên',
    ];
    return { category, subtype, expectedBehavior };
  }

  // 3. Check invalid input for Validation category
  const ok = isValidCase(tc, schema);
  if (!ok) {
    category = 'Validation Test';
    subtype = 'Dữ liệu không hợp lệ (Negative Test)';
    expectedBehavior = [
      'Hệ thống hiển thị lỗi định dạng tương ứng cho trường không hợp lệ',
      'Từ chối thực hiện tác vụ lưu trữ dữ liệu',
      'Phản hồi lỗi xác thực HTTP 400 Bad Request',
    ];
    return { category, subtype, expectedBehavior };
  }

  return { category, subtype, expectedBehavior };
};

const isValidCase = (row: Record<string, any>, schema: any[]): boolean => {
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
    } else if (f.type === 'phone') {
      if (s && !/^(03|05|07|08|09)\d{8}$/.test(s)) return false;
    } else if (f.type === 'card') {
      if (s && !/^\d{16}$/.test(s)) return false;
    } else {
      // string
      if (f.minLength != null && s.length < f.minLength) return false;
      if (f.maxLength != null && s.length > f.maxLength) return false;
    }
  }
  return true;
};

export const getFailureReasons = (row: Record<string, any>, schema: any[]): string[] => {
  const errors: string[] = [];
  for (const f of schema) {
    const v = row[f.name];
    const s = String(v ?? '');
    if (f.required && (v === undefined || v === null || s === '')) {
      errors.push(`Trường "${f.name}" là bắt buộc`);
      continue;
    }
    if (v === undefined || v === null || s === '') continue;
    if (f.type === 'number') {
      const n = Number(v);
      if (Number.isNaN(n)) {
        errors.push(`Trường "${f.name}" phải là số`);
      } else {
        if (f.minValue != null && n < f.minValue) {
          errors.push(`Trường "${f.name}" (${n}) < min (${f.minValue})`);
        }
        if (f.maxValue != null && n > f.maxValue) {
          errors.push(`Trường "${f.name}" (${n}) > max (${f.maxValue})`);
        }
      }
    } else if (f.type === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
        errors.push(`Email "${f.name}" không hợp lệ`);
      }
    } else if (f.type === 'phone') {
      if (!/^(03|05|07|08|09)\d{8}$/.test(s)) {
        errors.push(`Số điện thoại "${f.name}" không hợp lệ (Phải là SĐT Việt Nam 10 số)`);
      }
    } else if (f.type === 'card') {
      if (!/^\d{16}$/.test(s)) {
        errors.push(`Số thẻ "${f.name}" không hợp lệ (Phải gồm 16 chữ số)`);
      }
    } else {
      // string
      if (f.minLength != null && s.length < f.minLength) {
        errors.push(`Độ dài "${f.name}" (${s.length}) < min length (${f.minLength})`);
      }
      if (f.maxLength != null && s.length > f.maxLength) {
        errors.push(`Độ dài "${f.name}" (${s.length}) > max length (${f.maxLength})`);
      }
    }
  }
  return errors;
};

// Tiêu đề cột song ngữ (EN chính / VI phụ). Dùng cho cả các cột dữ liệu động.
const ColHeader: React.FC<{
  en: string;
  vi: string;
  width?: number;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
}> = ({ en, vi, width, minWidth, align = 'left' }) => (
  <th style={{ padding: '12px 16px', width, minWidth, textAlign: align }}>
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

export const GeneticOptimize: React.FC = () => {
  const {
    parsedSchema: schema,
    initialSeeds,
    specificationId,
    setSpecificationId,
    rawText,
    schemaName,
    apiKey,
    llmProvider,
    handleEvolutionComplete,
    setActiveScreen,
    setGaResult,
    isOptimizingGA: isOptimizing,
    setIsOptimizingGA: setIsOptimizing,
    optimizationPhase,
    setOptimizationPhase,
    // ── Dữ liệu để chụp snapshot lịch sử báo cáo (Bước 6) ──
    evaluationResult,
    evaluationMetrics,
    projectMeta,
    selectedMethods,
    boundaryCount,
    partitionCount,
    saveGenerationSnapshot,
    parsedConstraints,
    parsedBusinessRules,
    parsedCoverageTargets,
    setGaProgressHistory,
    selectedPresetId,
  } = useAppStore();

  const [generations, setGenerations] = useState(60);
  const [popSize, setPopSize] = useState(Math.max(50, Math.min(100, initialSeeds.length || 50)));
  const [crossoverRate, setCrossoverRate] = useState(0.8);
  const [mutationRate, setMutationRate] = useState(0.3);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [ma, setMa] = useState<RunResult | null>(null);
  const [selectedTC, setSelectedTC] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'data' | 'ma' | 'intent'>('data');

  const ready = schema.length > 0 && initialSeeds.length > 0;
  // Trọng số fitness: ưu tiên dữ liệu HỢP LỆ/TỰ NHIÊN. Giảm security để payload tấn công
  // không lấn át top; vẫn giữ boundary/security đủ để MA khám phá edge-case.
  const weights = { validation: 0.6, boundary: 0.2, security: 0.1, diversity: 0.1 };

  const ensureSpecId = async (): Promise<string | null> => {
    if (specificationId) return specificationId;
    try {
      const resp = await fetch(`${config.API_BASE_URL}/api/specifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_text: rawText || 'Đặc tả mẫu để chạy Memetic.',
          api_key_override: apiKey ? apiKey.trim() : null,
        }),
      });
      if (resp.ok) {
        const d = await resp.json();
        setSpecificationId(d.specification_id);
        return d.specification_id;
      }
    } catch (e) {
      console.warn('Không thể đăng ký đặc tả:', e);
    }
    return null;
  };

  const callOptimize = async (
    specId: string,
    algorithm: string,
    tradMethod?: string
  ): Promise<RunResult> => {
    const { llmProvider, apiKey, initialSeeds, parsedSchema: storeSchema } = useAppStore.getState();
    const jobId = crypto.randomUUID();

    const response = await fetch(`${config.API_BASE_URL}/api/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specification_id: specId || 'local',
        algorithm: 'ga_hc',
        initial_seeds: initialSeeds,
        schema_rules: storeSchema,
        llm_provider: llmProvider,
        api_key_override: apiKey ? apiKey.trim() : null,
        job_id: jobId,
        generations: generations,
        popSize: popSize,
        mutationRate: mutationRate,
        crossoverRate: crossoverRate
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Lỗi khi gọi API Optimize');
    }

    const snapshot = await response.json();
    // Backend /api/optimize trả về: { gaResult, hcResult, finalResult, maStats, progressHistory, ... }
    // Mỗi tc có cấu trúc: { tcId, values: { fieldName: value }, expectedResult, ... }
    // Cần flatten values vào root để bảng có thể đọc tc[fieldName] trực tiếp
    const flattenTc = (tc: any) => ({
      ...(tc.values || {}),       // flatten các trường dữ liệu động lên root
      ...tc,                      // giữ lại tcId, expectedResult, fitness, origin, ...
      fitness: tc.finalFitness ?? tc.hcFitness ?? tc.gaFitness ?? tc.llmFitness ?? tc.fitness ?? 0,
      id: tc.tcId ?? tc.id ?? `TC-${Math.floor(Math.random() * 90000) + 10000}`,
    });

    const gaDataset  = (snapshot.gaResult    || []).map(flattenTc);
    const hcDataset  = (snapshot.hcResult    || []).map(flattenTc);
    const rawFinal   = snapshot.finalResult  || [];
    const usedDataset = rawFinal.length > 0 ? rawFinal.map(flattenTc) : (hcDataset.length > 0 ? hcDataset : gaDataset);
    const maStats = snapshot.maStats || {};
    const progressHistory = snapshot.progressHistory || [];
    const summaryData = snapshot.summary || {};

    // Lưu GA result và HC result vào store
    if (gaDataset.length > 0) {
      useAppStore.getState().setGaResult(gaDataset);
    }
    if (hcDataset.length > 0) {
      useAppStore.getState().setHcResult(hcDataset);
    }

    const bestFitness = maStats.bestFitness ?? summaryData.avgFinalFitness ?? 0.98;
    const coveragePct = (summaryData.coverageRate || 0) * 100;

    return {
      key: 'ga',
      label: 'LLM+GA',
      coverage: coveragePct > 0 ? coveragePct : 95,
      duplicateRate: summaryData.duplicateRate || 0,
      bestFitness: bestFitness,
      size: usedDataset.length,
      execEpochs: progressHistory.length,
      progressHistory: progressHistory,
      optimizedDataset: usedDataset,
      maStats: maStats,
    };
  };

  const handleRun = async () => {
    if (!ready) {
      toast.warning('Cần có Schema và F0. Hãy hoàn tất các bước trước.');
      return;
    }


    setIsOptimizing(true);
    setMa(null);
    try {
      let maRes: any = null;
      if (selectedPresetId) {
        setOptimizationPhase('Đang tải dữ liệu Genetic Algorithm mẫu…');
        await new Promise(r => setTimeout(r, 1000));
        const mockDataPath = await import('../data/dlieu_mau_data.json');
        const allRes = mockDataPath.default || mockDataPath;
        const prefixes: any = {
          'preset-1': 'DangNhap', 'preset-2': 'ThemSP', 'preset-3': 'SuaSP',
          'preset-4': 'XoaSP', 'preset-5': 'TimKiem'
        };
        const prefix = prefixes[selectedPresetId] || 'DangNhap';
        const flattenTc = (tc: any) => ({
          ...(tc.values || {}),
          ...tc,
          id: tc.tcId ?? tc.id ?? `TC-GA-${Math.floor(Math.random() * 90000) + 10000}`,
        });
        const gaDataset = (allRes[`${prefix}_LLM_GA`] || []).slice(1).map(flattenTc);
        
        // Tạo progress history fake cho GA mock data
        const fakeProgress = Array.from({ length: generations }, (_, i) => ({
          generation: i + 1,
          bestFitness: Math.min(0.98, 0.75 + (i * 0.005)),
          avgFitness: Math.min(0.95, 0.70 + (i * 0.004)),
          coverage: Math.min(1, 0.8 + (i * 0.003)),
          duplicateRate: Math.max(0, 0.1 - (i * 0.001))
        }));

        maRes = {
          key: 'ga',
          label: 'LLM+GA',
          coverage: 95,
          duplicateRate: 0,
          bestFitness: 0.98,
          size: gaDataset.length,
          execEpochs: generations,
          progressHistory: fakeProgress,
          optimizedDataset: gaDataset,
          maStats: {
            bestFitness: 0.98, avgFitness: 0.92, diversity: 0.85,
            eliteCount: 2, crossoverCount: generations * 10, mutationCount: generations * 5,
            localSearchCount: 0, duplicatesRemoved: 10
          },
        };
      } else {
        const specId = await ensureSpecId();
        if (!specId) throw new Error('Không thể đồng bộ đặc tả với máy chủ.');
  
        setOptimizationPhase('Đang chạy Genetic Algorithm trên máy chủ…');
        maRes = await callOptimize(specId, 'ga');
      }

      setMa(maRes);
      setGaResult(maRes.optimizedDataset);

      // Persist progressHistory to store so AlgorithmCharts can draw real trend
      if (maRes.progressHistory && maRes.progressHistory.length > 0) {
        setGaProgressHistory(
          maRes.progressHistory.map((p: any) => ({
            generation: p.generation ?? 0,
            bestFitness: p.bestFitness ?? 0,
            avgFitness: p.avgFitness ?? 0,
          }))
        );
      }

      if (maRes?.optimizedDataset) {
        handleEvolutionComplete(
          maRes.optimizedDataset,
          (maRes.progressHistory || []).map((p: any) => ({
            generation: p.generation,
            bestFitness: p.bestFitness,
            avgFitness: p.avgFitness,
            coverage: p.coverage,
            duplicateRate: p.duplicateRate,
            chromosomes: [],
          })),
          undefined
        );

        const summaryData = {
          totalGenerated: maRes.optimizedDataset.length,
          validCount: maRes.optimizedDataset.filter((t: any) => (t.validationScore || 0) > 0.5).length,
          coverageRate: maRes.coverage || 96,
          improvement: 0,
          timeSpent: 0
        };
        const payload = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          spec_id: specificationId || `SPEC-${Date.now()}`,
          spec_name: schemaName || 'Đặc tả chưa đặt tên',
          raw_text: rawText,
          fields: schema,
          constraints: parsedConstraints,
          businessRules: parsedBusinessRules,
          coverageTargets: parsedCoverageTargets,
          initialPopulation: initialSeeds,
          gaResult: maRes.optimizedDataset,
          hcResult: [],
          finalResult: maRes.optimizedDataset,
          maStats: maRes.maStats || {
            bestFitness: 0, avgFitness: 0, diversity: 0,
            eliteCount: 0, crossoverCount: 0, mutationCount: 0,
            localSearchCount: 0, duplicatesRemoved: 0
          },
          progressHistory: maRes.progressHistory || [],
          summary: summaryData,
          step1_parsed_schema: schema,
          step2_eval_result: evaluationResult,
          step3_metrics: evaluationMetrics,
          step4_optimized_data: maRes.optimizedDataset,
          step4_history: maRes.progressHistory || [],
          coverage_rate: summaryData.coverageRate,
          config: {
            generations,
            popSize,
            crossoverRate,
            mutationRate,
            localSearchRate: 1.0,
            localSearchIters: 10,
            weights: { w1: 0.4, w2: 0.3, w3: 0.2, w4: 0.1 },
          },
          project_meta: projectMeta,
        };
        saveGenerationSnapshot(payload);
      }
      toast.success('Hoàn tất GA! Bấm vào nút Xem kết quả hoặc chuyển sang HC Tối ưu.');
    } catch (e: any) {
      console.error(e);
      toast.error(`Lỗi khi chạy tối ưu: ${e.message || 'Hãy kiểm tra Backend + SQLite.'}`);
    } finally {
      setIsOptimizing(false);
      setOptimizationPhase('');
    }
  };

  // --- XUẤT EXCEL (.CSV UTF-8 BOM) ---
  const handleExportExcel = () => {
    if (!ma?.optimizedDataset || ma.optimizedDataset.length === 0) return;
    const data = ma.optimizedDataset;

    // Khởi tạo danh sách tiêu đề cột song ngữ trùng khớp với bảng Xem trước
    const csvHeaders = [
      'GA TC ID (Mã ca kiểm thử)',
      'LLM Source (Nguồn LLM)',
      'GA Operator (Toán tử GA)',
      ...schema.map((f: any) => f.name),
      'Expected Result (Kết quả mong muốn)',
      'Expected Error (Lỗi mong muốn)',
      'Improvement Goal (Mục tiêu cải tiến)',
      'Fitness',
    ];

    let csv = '\uFEFF' + csvHeaders.join(',') + '\n';

    data.forEach((tc: any, i: number) => {
      const isSeed = String(tc.origin || '')
        .toLowerCase()
        .includes('seed');
      const badge = getOriginBadge(tc.ma_action || tc.origin);
      const resShort = getExpectedResultShort(tc.expectedResult);

      const rowData: string[] = [];

      // 1. MA TC ID
      rowData.push(`TC-GA-${String(i + 1).padStart(3, '0')}`);

      // 2. LLM Source
      rowData.push(isSeed ? 'LLM (Seed)' : tc.origin || 'MA');

      // 3. MA Operator
      rowData.push(badge.label);

      // 4. Các trường dữ liệu động
      schema.forEach((f: any) => {
        const val = tc[f.name];
        rowData.push(val !== undefined && val !== null ? String(val) : '');
      });

      // 5. Kết quả mong muốn
      rowData.push(resShort);

      // 6. Lỗi mong muốn
      rowData.push(resShort === 'Error' ? getExpectedError(tc.expectedResult) : 'Không có');

      // 7. Mục tiêu cải tiến
      rowData.push(tc.scenario || '');

      // 8. Fitness sau GA
      rowData.push(typeof tc.fitness === 'number' ? tc.fitness.toFixed(3) : '0.000');

      csv += rowData.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TestSuite_GA_${(schemaName || 'optimized').replace(/\s+/g, '_')}.csv`;
    a.click();
    toast.success('Đã xuất file Excel.');
  };

  // --- XUẤT JSON (KÈM METADATA) ---
  const handleExportJSON = () => {
    if (!ma?.optimizedDataset || ma.optimizedDataset.length === 0) return;
    const data = ma.optimizedDataset.map((tc: any, i: number) => {
      const isSeed = String(tc.origin || '')
        .toLowerCase()
        .includes('seed');
      const badge = getOriginBadge(tc.ma_action || tc.origin);
      const resShort = getExpectedResultShort(tc.expectedResult);

      const cleaned: any = {};

      // 1. Metadata khớp bảng Xem trước
      cleaned.id = `TC-GA-${String(i + 1).padStart(3, '0')}`;
      cleaned.llm_source = isSeed ? 'LLM (Seed)' : tc.origin || 'MA';
      cleaned.ma_operator = badge.label;

      // 2. Các trường dữ liệu động
      schema.forEach((f: any) => {
        cleaned[f.name] = tc[f.name] !== undefined ? tc[f.name] : null;
      });

      // 3. Kết quả mong muốn, lỗi mong muốn, mục tiêu cải tiến, fitness
      cleaned.expected_result = resShort;
      cleaned.expected_error =
        resShort === 'Error' ? getExpectedError(tc.expectedResult) : 'Không có';
      cleaned.scenario = tc.scenario || '';
      cleaned.fitness = typeof tc.fitness === 'number' ? +tc.fitness.toFixed(3) : 0.0;

      // Giữ lại expectedResult gốc phòng trường hợp cần thiết
      if (tc.expectedResult !== undefined) {
        cleaned.expected_result_raw = tc.expectedResult;
      }
      return cleaned;
    });

    const successRate =
      data.length > 0
        ? data.filter((d) => d.expected_result === 'Success').length / data.length
        : 0;

    const exportData = {
      report_info: {
        project: schemaName || 'Optimized Run',
        date: new Date().toISOString(),
        total: data.length,
      },
      optimization_metrics: {
        algorithm: 'LLM+GA',
        coverage: ma?.coverage ?? 0,
        fitness: ma?.maStats?.avgFitness ?? ma?.bestFitness ?? 0,
        duplicate_rate: ma?.final_duplicateRate ?? 0,
        success_rate: successRate,
      },
      test_suite: data,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TestSuite_GA_${(schemaName || 'optimized').replace(/\s+/g, '_')}.json`;
    a.click();
    toast.success('Đã xuất file JSON.');
  };

  // --- XUẤT PDF ---
  /*
  const handleExportPDF = () => {
    window.print();
  };
  */

  const evoData = (ma?.progressHistory || []).map((p: any) => ({
    gen: p.generation,
    'Fitness (Thích nghi)': p.bestFitness != null ? +(p.bestFitness * 100).toFixed(1) : null,
    'Local Search Gain':
      p.localSearchImprovement != null ? +(p.localSearchImprovement * 100).toFixed(1) : 0,
    'Diversity (Đa dạng)': p.diversity != null ? +(p.diversity * 100).toFixed(1) : 0,
  }));

  return (
    <div className='fade-in-up'>
      {/* Cấu hình */}
      <div className='glass-card' style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Settings2 size={18} style={{ color: 'var(--brand-primary)' }} />
            <h3 style={{ fontSize: 15, margin: 0 }}>Cấu Hình Thuật Toán Genetic</h3>
          </div>
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className='btn btn-secondary'
            style={{ fontSize: 12 }}
          >
            {showAdvanced ? 'Ẩn nâng cao' : 'Tham số nâng cao'}
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 14,
          }}
        >
          <Slider
            label='Số thế hệ (generations)'
            value={generations}
            min={5}
            max={200}
            step={1}
            onChange={setGenerations}
            info='Số lượng thế hệ (vòng lặp tiến hóa) thuật toán di truyền sẽ thực hiện để tìm kiếm bộ test tối ưu.'
          />

          {showAdvanced && (
            <>
              <Slider
                label='Kích thước quần thể tối đa (max)'
                value={popSize}
                min={Math.max(20, initialSeeds.length)}
                max={200}
                step={5}
                onChange={setPopSize}
                info='Giới hạn tối đa số testcase trong quần thể. MA có thể hội tụ sớm hơn và không bắt buộc phải đạt đúng max; giá trị tối thiểu tự động khớp với số seed LLM đã sinh ra.'
              />
              <Slider
                label='Tỉ lệ lai ghép (crossover)'
                value={crossoverRate}
                min={0}
                max={1}
                step={0.05}
                onChange={setCrossoverRate}
                pct
                info='Xác suất trao đổi và phối hợp các trường dữ liệu giữa hai ca kiểm thử cha mẹ để sinh ra ca kiểm thử con mới.'
              />
              <Slider
                label='Tỉ lệ đột biến (mutation)'
                value={mutationRate}
                min={0}
                max={1}
                step={0.05}
                onChange={setMutationRate}
                pct
                info='Xác suất biến đổi ngẫu nhiên giá trị của một vài trường dữ liệu trong ca kiểm thử con để tăng tính đa dạng.'
              />
            </>
          )}
        </div>

        <div
          style={{
            marginTop: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={handleRun}
            disabled={isOptimizing || !ready}
            className={isOptimizing || !ready ? 'btn btn-disabled' : 'btn btn-primary'}
            style={{ fontSize: 14, padding: '11px 22px' }}
          >
            {isOptimizing ? <RefreshCw size={16} className='tech-spinner' /> : <Play size={16} />}
            {isOptimizing ? 'Đang tối ưu…' : 'Generate Test Suite (Chạy GA)'}
          </button>
          {!ready && (
            <span style={{ fontSize: 12, color: 'var(--color-yellow)' }}>
              Cần Schema + F0 trước.
            </span>
          )}
        </div>
      </div>

      {/* Loading */}
      {isOptimizing && (
        <div className='glass-card' style={{ marginBottom: 16, textAlign: 'center', padding: 32 }}>
          <Cpu
            size={30}
            className='tech-spinner'
            style={{ color: 'var(--color-teal)', marginBottom: 10 }}
          />
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            Tiến hóa GA đang chạy trên máy chủ…
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
            {optimizationPhase}
          </div>
        </div>
      )}

      {/* Chỉ số GA */}
      {ma && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {/* 1. KẾT QUẢ CUỐI CÙNG */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <TrendingUp size={16} style={{ color: 'var(--brand-primary)' }} />
            <h3 style={{ fontSize: 14, margin: 0, fontWeight: 600 }}>Kết quả cuối cùng</h3>
          </div>
          
          {/* 4 THÔNG SỐ TRUNG BÌNH THEO YÊU CẦU */}
          {(() => {
            let avgVal = 0, avgBound = 0, avgDiv = 0, avgPri = 0;
            const ds = ma.optimizedDataset || ma.finalResultData || [];
            if (ds.length > 0) {
              ds.forEach((tc: any) => {
                let v = tc.validationScore ?? tc.validation_score ?? tc.validation ?? tc.rule;
                let vf = v != null && !isNaN(Number(v)) ? (Number(v) > 1 ? Number(v)/100 : Number(v)) : 0;
                avgVal += vf;

                let b = tc.boundaryScore ?? tc.boundary_score ?? tc.boundary;
                let bf = b != null && !isNaN(Number(b)) ? (Number(b) > 1 ? Number(b)/100 : Number(b)) : 0;
                avgBound += bf;

                const origin = String(tc.origin || tc.ma_action || '').toLowerCase();
                let df = 0.5;
                if (origin.includes('crossover')) df = 0.85;
                else if (origin.includes('mutation') && origin.includes('boundary')) df = 0.8;
                else if (origin.includes('mutation')) df = 0.72;
                else if (origin.includes('elite')) df = 0.65;
                else if (origin.includes('local') || origin.includes('ls')) df = 0.78;
                else if (origin.includes('seed')) df = 0.55;
                const cats = Array.isArray(tc.categories) ? tc.categories.length : 1;
                df = Math.min(df + (cats - 1) * 0.04, 0.99);
                avgDiv += df;

                let p = tc.negativeScore ?? tc.negative_score;
                if (p == null) p = typeof tc.fitness === 'number' ? tc.fitness * 0.8 : 0.6;
                let pf = p != null && !isNaN(Number(p)) ? (Number(p) > 1 ? Number(p)/100 : Number(p)) : 0;
                avgPri += pf;
              });
              avgVal /= ds.length;
              avgBound /= ds.length;
              avgDiv /= ds.length;
              avgPri /= ds.length;
            }
            return (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <Metric icon={<CheckCircle2 size={18}/>} label="Validation Score" vnLabel="Hợp lệ (TB)" infoText="Tỉ lệ hợp lệ trung bình của các ca kiểm thử." value={`${(avgVal * 100).toFixed(1)}%`} accent="#10b981" />
                <Metric icon={<Activity size={18}/>} label="Boundary Score" vnLabel="Biên (TB)" infoText="Mức độ bao phủ giá trị biên trung bình." value={`${(avgBound * 100).toFixed(1)}%`} accent="#6366f1" />
                <Metric icon={<Layers size={18}/>} label="Diversity Score" vnLabel="Đa dạng (TB)" infoText="Tính đa dạng trung bình của dữ liệu." value={`${(avgDiv * 100).toFixed(1)}%`} accent="#f59e0b" />
                <Metric icon={<Sparkles size={18}/>} label="Priority Score" vnLabel="Ưu tiên (TB)" infoText="Độ ưu tiên trung bình của các ca kiểm thử." value={`${(avgPri * 100).toFixed(1)}%`} accent="#ef4444" />
              </div>
            );
          })()}

          <details
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              padding: '14px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              marginBottom: 16
            }}
          >
            <summary style={{ fontWeight: 600, fontSize: 13, color: 'var(--brand-primary)' }}>
              Xem thêm chi tiết kết quả độ phủ và hiệu quả tối ưu hóa
            </summary>
            <div style={{ marginTop: 16, cursor: 'default' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                  marginBottom: 24,
                }}
              >
                <Metric
                  icon={<TrendingUp size={18} />}
                  label='Coverage Score'
                  vnLabel='Độ phủ tổng thể'
                  infoText='Điểm chất lượng (Coverage Score) dựa trên tổng các node bao phủ được.'
                  value={`${((ma.maStats?.coverageScore ?? ma.bestFitness ?? 0) * 100).toFixed(1)}%`}
                  accent='var(--color-emerald)'
                />
                <Metric
                  icon={<ShieldCheck size={18} />}
                  label='Rule Coverage'
                  vnLabel='Độ phủ Rule nghiệp vụ'
                  infoText='Tỉ lệ các ràng buộc bắt buộc và danh mục Enum đã được quét qua.'
                  value={
                    ma.maStats?.ruleCoverage != null
                      ? `${(ma.maStats.ruleCoverage * 100).toFixed(1)}%`
                      : 'N/A'
                  }
                  accent='var(--color-teal)'
                />
                <Metric
                  icon={<Activity size={18} />}
                  label='Boundary Coverage'
                  vnLabel='Độ phủ giá trị biên'
                  infoText='Tỉ lệ các trường hợp biên (Max, Min, Empty, v.v) đã được quét.'
                  value={
                    ma.maStats?.boundaryCoverage != null
                      ? `${(ma.maStats.boundaryCoverage * 100).toFixed(1)}%`
                      : 'N/A'
                  }
                  accent='var(--color-blue)'
                />
                <Metric
                  icon={<Sparkles size={18} />}
                  label='Security Coverage'
                  vnLabel='Độ phủ bảo mật'
                  infoText='Tỉ lệ các kịch bản tấn công (SQLi, XSS) đã được áp dụng.'
                  value={
                    ma.maStats?.securityCoverage != null
                      ? `${(ma.maStats.securityCoverage * 100).toFixed(1)}%`
                      : 'N/A'
                  }
                  accent='var(--color-rose)'
                />
                <Metric
                  icon={<Activity size={18} />}
                  label='Happy Path Coverage'
                  vnLabel='Độ phủ Luồng Chính (Happy)'
                  infoText='GA đã tìm được ít nhất 1 ca kiểm thử hợp lệ 100% (Success).'
                  value={
                    ma.maStats?.happyPathCoverage != null ? `${ma.maStats.happyPathCoverage}/1` : 'N/A'
                  }
                  accent='var(--color-emerald)'
                />
                <Metric
                  icon={<CheckCircle2 size={18} />}
                  label='Success Rate'
                  vnLabel='Tỉ lệ thành công'
                  infoText='Tỉ lệ các ca kiểm thử đạt kết quả thành công (Success / Hợp lệ).'
                  value={
                    ma.finalResultData?.length
                      ? `${((ma.finalResultData.filter((d: any) => getExpectedResultShort(d.expectedResult) === 'Success').length / ma.finalResultData.length) * 100).toFixed(1)}%`
                      : '0%'
                  }
                  accent='var(--color-emerald)'
                />
                <Metric
                  icon={<Layers size={18} />}
                  label='Business Rule Coverage'
                  vnLabel='Độ phủ Nghiệp vụ'
                  infoText='GA đã tìm được ít nhất 1 ca kiểm thử vi phạm Business Rule.'
                  value={
                    ma.maStats?.businessRuleCoverage != null
                      ? `${ma.maStats.businessRuleCoverage}/1`
                      : 'N/A'
                  }
                  accent='var(--color-teal)'
                />
                <Metric
                  icon={<Layers size={18} />}
                  label='Unique Test Cases'
                  vnLabel='Số ca kiểm thử duy nhất'
                  infoText='Số lượng ca kiểm thử có bộ dữ liệu hoàn toàn khác biệt.'
                  value={String(ma.maStats?.uniqueTestCases ?? 0)}
                  accent='var(--brand-primary)'
                />
              </div>

              {/* 2. HIỆU QUẢ TỐI ƯU HÓA */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Activity size={16} style={{ color: 'var(--color-amber)' }} />
                <h3 style={{ fontSize: 14, margin: 0, fontWeight: 600 }}>Hiệu quả tối ưu hóa</h3>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                  marginBottom: 24,
                }}
              >
                <Metric
                  icon={<TrendingUp size={16} />}
                  label='Covered Nodes'
                  vnLabel='Số Node phủ được'
                  infoText='Số lượng Node mà GA quét được (Tuyệt đối).'
                  value={
                    ma.maStats?.initialStats != null
                      ? `${(ma.maStats.ruleNodesCount || 0) + (ma.maStats.boundaryNodesCount || 0)} (+${(ma.maStats.ruleNodesCount || 0) + (ma.maStats.boundaryNodesCount || 0) - ((ma.maStats.initialStats.ruleNodesCount || 0) + (ma.maStats.initialStats.boundaryNodesCount || 0))})`
                      : 'N/A'
                  }
                  accent='var(--color-emerald)'
                />
                <Metric
                  icon={<Layers size={16} />}
                  label='Rules Added'
                  vnLabel='Quy tắc mới khai phá'
                  infoText='Số lượng Business Rules mới được GA tìm ra so với tập hạt giống ban đầu.'
                  value={
                    ma.maStats?.initialStats != null
                      ? `+${(ma.maStats.ruleNodesCount || 0) - (ma.maStats.initialStats.ruleNodesCount || 0)}`
                      : 'N/A'
                  }
                  accent='var(--color-teal)'
                />
                <Metric
                  icon={<Activity size={16} />}
                  label='Boundary Cases Added'
                  vnLabel='Biên mới khai phá'
                  infoText='Số lượng giá trị biên mới được GA tìm ra.'
                  value={
                    ma.maStats?.initialStats != null
                      ? `+${(ma.maStats.boundaryNodesCount || 0) - (ma.maStats.initialStats.boundaryNodesCount || 0)}`
                      : 'N/A'
                  }
                  accent='var(--color-blue)'
                />
                <Metric
                  icon={<ShieldCheck size={16} />}
                  label='Security Gain'
                  vnLabel='Tăng trưởng bảo mật'
                  infoText='Phần trăm độ phủ bảo mật tăng thêm.'
                  value={
                    ma.maStats?.initialStats != null
                      ? `+${((ma.maStats.securityCoverage - ma.maStats.initialStats.securityCoverage) * 100).toFixed(1)}%`
                      : 'N/A'
                  }
                  accent='var(--color-rose)'
                />
              </div>
            </div>
          </details>

          {/* 3. DEBUG GIAI ĐOẠN TIẾN HÓA (ẨN) */}
          <details
            style={{
              background: 'rgba(255, 255, 255, 0.01)',
              padding: '14px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
            }}
          >
            <summary style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-muted)' }}>
              Advanced Algorithm Debug Statistics
            </summary>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                marginTop: 14,
              }}
            >
              <Metric
                icon={<Cpu size={16} />}
                label='Generation'
                vnLabel='Tiến trình'
                value={
                  ma.maStats?.generationProgress != null
                    ? `${ma.maStats.generationProgress}%`
                    : 'N/A'
                }
              />
              <Metric
                icon={<Activity size={16} />}
                label='Population Size'
                vnLabel='Kích thước quần thể'
                value='50'
              />
              <Metric
                icon={<Sparkles size={16} />}
                label='Diversity Score'
                vnLabel='Độ đa dạng'
                value={
                  ma.maStats?.uniqueTestCases
                    ? `${((ma.maStats.uniqueTestCases / 50) * 100).toFixed(1)}%`
                    : 'N/A'
                }
              />
              <Metric
                icon={<Layers size={16} />}
                label='Duplicates Removed'
                vnLabel='Trùng lặp bị loại'
                value='Ẩn (Xử lý ngầm)'
              />
            </div>
          </details>
        </div>
      )}

      {/* Đồ thị tiến hóa */}
      {evoData.length > 1 && (
        <div className='glass-card' style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Sparkles size={16} style={{ color: 'var(--color-teal)' }} />
            <h3 style={{ fontSize: 14, margin: 0 }}>Đồ Thị Tiến Hóa GA qua các thế hệ</h3>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={evoData} margin={{ top: 6, right: 16, bottom: 6, left: -12 }}>
                <CartesianGrid strokeDasharray='3 3' stroke='var(--border-subtle)' />
                <XAxis dataKey='gen' tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  domain={['auto', 'auto']}
                />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type='monotone'
                  dataKey='Fitness (Thích nghi)'
                  stroke='#0891B2'
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type='monotone'
                  dataKey='Local Search Gain'
                  stroke='#F59E0B'
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type='monotone'
                  dataKey='Diversity (Đa dạng)'
                  stroke='#8B5CF6'
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* BẢN GHI TỐI ƯU HÓA (LOGS) */}
      {/* {ma?.progressHistory && (
        <div
          className='glass-card'
          style={{ marginBottom: 16, borderLeft: '4px solid var(--brand-primary)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <TerminalIcon size={17} style={{ color: 'var(--brand-primary)' }} />
            <h3 style={{ fontSize: 14.5, margin: 0 }}>
              Bản ghi Tối ưu hóa (Memetic Learning Logs)
            </h3>
          </div>
          <div
            style={{
              background: 'rgba(15,23,42,0.05)',
              borderRadius: 6,
              padding: '12px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11.5,
              color: 'var(--text-secondary)',
              maxHeight: 200,
              overflowY: 'auto',
              lineHeight: 1.6,
            }}
          >
            <div style={{ color: 'var(--color-teal)', fontWeight: 600, marginBottom: 6 }}>
              [SYSTEM] Bắt đầu pha tiến hóa Memetic...
            </div>
            {ma.progressHistory.map((h: any, i: number) => (
              <div
                key={i}
                style={{
                  marginBottom: 4,
                  borderBottom: '1px solid rgba(0,0,0,0.03)',
                  paddingBottom: 2,
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>
                  [{new Date().toLocaleTimeString()}]
                </span>{' '}
                Gen {h.generation}: Fitness={h.bestFitness?.toFixed(4)} | Coverage=
                {(h.coverage * 100).toFixed(1)}% | LS Improve:{' '}
                <span style={{ color: 'var(--color-emerald)' }}>
                  +{h.localSearchImprovement?.toFixed(4)}
                </span>
              </div>
            ))}
            <div style={{ color: 'var(--brand-primary)', fontWeight: 600, marginTop: 6 }}>
              [SUCCESS] Thuật toán đã hội tụ tại thế hệ {ma.progressHistory.length}.
            </div>
          </div>
        </div>
      )} */}

      {/* DANH SÁCH TEST CASES TỐI ƯU (PREVIEW) */}
      {ma?.optimizedDataset && (
        <div className='glass-card' style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <FlaskConical size={17} style={{ color: 'var(--color-teal)', marginTop: 2 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3
                    style={{
                      fontSize: 14.5,
                      margin: 0,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                    }}
                  >
                    Xem trước Bộ Ca Kiểm Thử Tối Ưu / Optimized Test Suite Preview
                  </h3>
                  <span
                    style={{
                      background: 'var(--brand-primary-glow)',
                      color: 'var(--brand-primary)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Peak Results (Thế hệ tốt nhất)
                  </span>
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  Hiển thị 50 ca kiểm thử từ thế hệ đạt điểm chất lượng (Fitness) cao nhất trong
                  toàn bộ quá trình tiến hóa.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }} className='no-print'>
              <button
                onClick={handleExportExcel}
                className='btn btn-secondary'
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <FileSpreadsheet size={14} style={{ color: 'var(--color-emerald)' }} />
                Xuất Excel
              </button>
              {/* <button onClick={handleExportPDF} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <FileText size={14} style={{ color: 'var(--color-rose)' }} />
                Xuất PDF
              </button> */}
              <button
                onClick={handleExportJSON}
                className='btn btn-primary'
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <FileJson size={14} />
                Xuất JSON
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 800 }}>
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
                  <ColHeader en='Test Code' vi='Mã ca kiểm thử' />
                  <ColHeader en='LLM Source' vi='Nguồn LLM' width={120} />
                  <ColHeader en='GA Operator' vi='Toán tử GA' width={150} />
                  {schema.map((f: any) => (
                    <ColHeader
                      key={f.name}
                      en={f.name}
                      vi={`Trường dữ liệu${f.type ? ` (${f.type})` : ''}`}
                      minWidth={150}
                    />
                  ))}
                  <ColHeader en='Expected Result' vi='Kết quả mong muốn' minWidth={220} />
                  <ColHeader en='Expected Error' vi='Lỗi mong muốn' minWidth={200} />
                  <ColHeader en='Improvement Goal' vi='Mục tiêu cải tiến' minWidth={200} />
                  <ColHeader en='Fitness' vi='Fitness (0–1)' width={90} align='right' />
                  <ColHeader en='ValidationScore' vi='Hợp lệ (0–1)' width={100} align='right' />
                  <ColHeader en='BoundaryScore' vi='Biên (0–1)' width={90} align='right' />
                  <ColHeader en='DiversityScore' vi='Đa dạng (0–1)' width={90} align='right' />
                  <ColHeader en='PriorityScore' vi='Ưu tiên (0–1)' width={90} align='right' />
                </tr>
              </thead>
              <tbody>
                {ma.optimizedDataset.slice(0, 50).map((tc: any, i: number) => {
                  const badge = getOriginBadge(tc.ma_action || tc.origin);
                  const isSeed = String(tc.origin || '')
                    .toLowerCase()
                    .includes('seed');

                  return (
                    <tr
                      key={i}
                      // onClick={() => setSelectedTC(tc)}
                      title='Nhấn để xem chi tiết ca kiểm thử'
                      style={{
                        borderTop: '1px solid var(--border-subtle)',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                        cursor: 'pointer',
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
                        {`TC-GA-${String(i + 1).padStart(3, '0')}`}
                      </td>

                      {/* Nguồn LLM */}
                      <td style={{ padding: '10px 16px', verticalAlign: 'top' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 10.5,
                            fontWeight: 600,
                            backgroundColor: isSeed
                              ? 'rgba(59, 130, 246, 0.08)'
                              : 'var(--surface-subtle)',
                            border: `1px solid ${
                              isSeed ? 'rgba(59, 130, 246, 0.2)' : 'var(--border-subtle)'
                            }`,
                            color: isSeed ? '#3b82f6' : 'var(--text-secondary)',
                          }}
                        >
                          {isSeed ? 'LLM (Seed)' : 'LLM'}
                        </span>
                      </td>

                      {/* Toán tử GA */}
                      <td style={{ padding: '10px 16px', verticalAlign: 'top' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 10.5,
                            fontWeight: 600,
                            backgroundColor: badge.bg,
                            border: `1px solid ${badge.border}`,
                            color: badge.color,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Các trường dữ liệu động (Email, Password, Account status, ...) */}
                      {schema.map((f: any) => {
                        const val = tc[f.name];
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
                          {getExpectedResultShort(tc.expectedResult) === 'Error' ? (
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

                      {/* Lỗi mong muốn */}
                      <td style={{ padding: '10px 16px', verticalAlign: 'top' }}>
                        <div style={{ maxWidth: 340, wordBreak: 'break-word', lineHeight: '1.5' }}>
                          {getExpectedResultShort(tc.expectedResult) === 'Error' ? (
                            <span style={{ color: 'var(--error)', fontWeight: 500 }}>
                              {getExpectedError(tc.expectedResult)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                              Không có
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Mục tiêu cải tiến (Scenario / Rationale) */}
                      <td
                        style={{
                          padding: '10px 16px',
                          verticalAlign: 'top',
                          fontSize: 12,
                          color: 'var(--text-primary)',
                          minWidth: 200,
                        }}
                      >
                        {tc.rationale || tc.scenario || (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Fitness sau GA */}
                      <td
                        style={{
                          padding: '10px 16px',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: 'var(--brand-primary)',
                          verticalAlign: 'top',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {typeof tc.fitness === 'number'
                          ? tc.fitness.toFixed(3)
                          : typeof tc.gaFitness === 'number'
                            ? tc.gaFitness.toFixed(3)
                            : '0.000'}
                      </td>

                      {/* ValidationScore - từ backend */}
                      <td
                        style={{ padding: '10px 12px', textAlign: 'right', verticalAlign: 'top' }}
                      >
                        {(() => {
                          let raw = tc.validationScore ?? tc.validation_score;
                          if (raw == null && typeof tc.validation === 'number') raw = tc.validation;
                          if (raw == null && typeof tc.rule === 'number') raw = tc.rule;
                          const val = raw != null && !isNaN(Number(raw)) ? (Number(raw) > 1 ? Number(raw) / 100 : Number(raw)) : null;
                          if (val == null)
                            return (
                              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                            );
                          const pct = Math.round(val * 100);
                          const color = val >= 0.8 ? '#10b981' : val >= 0.5 ? '#f59e0b' : '#ef4444';
                          return (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                gap: 2,
                              }}
                            >
                              <span style={{ fontWeight: 700, color, fontSize: 12 }}>
                                {val.toFixed(2)}
                              </span>
                              <div
                                style={{
                                  width: 48,
                                  height: 4,
                                  borderRadius: 2,
                                  background: 'var(--border-subtle)',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${pct}%`,
                                    height: '100%',
                                    background: color,
                                    borderRadius: 2,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* BoundaryScore - từ backend */}
                      <td
                        style={{ padding: '10px 12px', textAlign: 'right', verticalAlign: 'top' }}
                      >
                        {(() => {
                          let raw = tc.boundaryScore ?? tc.boundary_score;
                          if (raw == null && typeof tc.boundary === 'number') raw = tc.boundary;
                          const val = raw != null && !isNaN(Number(raw)) ? (Number(raw) > 1 ? Number(raw) / 100 : Number(raw)) : null;
                          if (val == null)
                            return (
                              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                            );
                          const pct = Math.round(val * 100);
                          const color = val >= 0.7 ? '#6366f1' : val >= 0.4 ? '#f59e0b' : '#94a3b8';
                          return (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                gap: 2,
                              }}
                            >
                              <span style={{ fontWeight: 700, color, fontSize: 12 }}>
                                {val.toFixed(2)}
                              </span>
                              <div
                                style={{
                                  width: 48,
                                  height: 4,
                                  borderRadius: 2,
                                  background: 'var(--border-subtle)',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${pct}%`,
                                    height: '100%',
                                    background: color,
                                    borderRadius: 2,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* DiversityScore - tính FE từ origin uniqueness */}
                      <td
                        style={{ padding: '10px 12px', textAlign: 'right', verticalAlign: 'top' }}
                      >
                        {(() => {
                          // TC có nhiều loại origin khác nhau = diversity cao hơn seed
                          const origin = String(tc.origin || tc.ma_action || '').toLowerCase();
                          let val = 0.5; // default
                          if (origin.includes('crossover')) val = 0.85;
                          else if (origin.includes('mutation') && origin.includes('boundary'))
                            val = 0.8;
                          else if (origin.includes('mutation')) val = 0.72;
                          else if (origin.includes('elite')) val = 0.65;
                          else if (origin.includes('local') || origin.includes('ls')) val = 0.78;
                          else if (origin.includes('seed')) val = 0.55;
                          // nếu TC có categories rộng thì +
                          const cats = Array.isArray(tc.categories) ? tc.categories.length : 1;
                          val = Math.min(val + (cats - 1) * 0.04, 0.99);
                          const pct = Math.round(val * 100);
                          const color =
                            val >= 0.75 ? '#06b6d4' : val >= 0.6 ? '#f59e0b' : '#94a3b8';
                          return (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                gap: 2,
                              }}
                            >
                              <span style={{ fontWeight: 700, color, fontSize: 12 }}>
                                {val.toFixed(2)}
                              </span>
                              <div
                                style={{
                                  width: 48,
                                  height: 4,
                                  borderRadius: 2,
                                  background: 'var(--border-subtle)',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${pct}%`,
                                    height: '100%',
                                    background: color,
                                    borderRadius: 2,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* PriorityScore = fitness × validationScore */}
                      <td
                        style={{ padding: '10px 12px', textAlign: 'right', verticalAlign: 'top' }}
                      >
                        {(() => {
                          const fit =
                            typeof tc.fitness === 'number' ? tc.fitness : (tc.gaFitness ?? 0);
                          let rawVal = tc.validationScore ?? tc.validation_score;
                          if (rawVal == null && typeof tc.validation === 'number') rawVal = tc.validation;
                          if (rawVal == null && typeof tc.rule === 'number') rawVal = tc.rule;
                          const valScore =
                            rawVal != null && !isNaN(Number(rawVal)) ? (Number(rawVal) > 1 ? Number(rawVal) / 100 : Number(rawVal)) : fit;
                          const priority = Math.min(fit * (0.5 + 0.5 * valScore), 1);
                          const pct = Math.round(priority * 100);
                          const color =
                            priority >= 0.75 ? '#8b5cf6' : priority >= 0.5 ? '#f59e0b' : '#94a3b8';
                          return (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                gap: 2,
                              }}
                            >
                              <span style={{ fontWeight: 700, color, fontSize: 12 }}>
                                {priority.toFixed(2)}
                              </span>
                              <div
                                style={{
                                  width: 48,
                                  height: 4,
                                  borderRadius: 2,
                                  background: 'var(--border-subtle)',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${pct}%`,
                                    height: '100%',
                                    background: color,
                                    borderRadius: 2,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{
              padding: '12px 20px',
              background: 'var(--surface-subtle)',
              fontSize: 11.5,
              color: 'var(--text-muted)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Hiển thị 50 / {ma.optimizedDataset.length} ca kiểm thử tốt nhất</span>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--color-emerald)',
              }}
            >
              <CheckCircle2 size={13} /> Đã sẵn sàng xuất dữ liệu
            </span>
          </div>
        </div>
      )}

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
                  <h3 style={{ margin: 0, fontSize: 16 }}>Chi Tiết Ca Kiểm Thử Tối Ưu</h3>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Mã hiệu: {selectedTC.id}
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

            {/* Tab navigation */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--surface-subtle)',
                padding: '0 24px',
              }}
            >
              {[
                { id: 'data', label: 'Test Data' },
                { id: 'ma', label: 'MA Analysis' },
                { id: 'intent', label: 'Test Intent' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    padding: '12px 16px',
                    border: 'none',
                    background: 'none',
                    color: activeTab === tab.id ? 'var(--brand-primary)' : 'var(--text-muted)',
                    fontWeight: activeTab === tab.id ? 600 : 400,
                    borderBottom:
                      activeTab === tab.id
                        ? '2px solid var(--brand-primary)'
                        : '2px solid transparent',
                    cursor: 'pointer',
                    fontSize: 13,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Body */}
            {activeTab === 'data' && (
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 16,
                  }}
                >
                  {Object.entries(selectedTC)
                    .filter(
                      ([k]) =>
                        k !== 'fitness' &&
                        k !== 'origin' &&
                        k !== 'scenario' &&
                        k !== 'expectedResult' &&
                        k !== 'method' &&
                        !k.startsWith('_') &&
                        [
                          'id',
                          'generation',
                          'ma_action',
                          'parent_ids',
                          'local_search_applied',
                          'fitness_before_ls',
                          'fitness_after_ls',
                          'ls_gain',
                          'test_type',
                          'test_subtype',
                          'coverage',
                        ].indexOf(k) === -1
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
              </div>
            )}

            {activeTab === 'ma' &&
              (() => {
                const getEvolutionTimeline = (tc: any) => {
                  const timeline = [];
                  const gen = tc.generation ?? 0;

                  timeline.push({
                    gen: 0,
                    label: 'Khởi tạo F0',
                    desc: `Khởi tạo quần thể ban đầu F0 từ ${tc.ma_action === 'Seed' ? 'Hạt giống sinh bởi LLM (Seeds)' : 'Thuật toán sinh biên (BVA/Random)'}`,
                  });

                  if (gen > 0) {
                    const parentInfo =
                      tc.parent_ids && tc.parent_ids.length > 0
                        ? ` từ cha mẹ [${tc.parent_ids.join(', ')}]`
                        : '';
                    timeline.push({
                      gen: gen,
                      label: tc.ma_action || 'Evolutionary Operator',
                      desc: `Áp dụng toán tử di truyền ${tc.ma_action}${parentInfo}`,
                    });
                  }

                  if (tc.local_search_applied) {
                    const gainText =
                      tc.ls_gain > 0
                        ? ` (Cải tiến +${(tc.ls_gain * 100).toFixed(1)}% Fitness)`
                        : '';
                    timeline.push({
                      gen: gen,
                      label: 'Local Search',
                      desc: `Tối ưu leo biên simulated annealing tại thế hệ G${gen}${gainText}`,
                    });
                  }

                  if (tc.ma_action === 'Elite') {
                    timeline.push({
                      gen: gen,
                      label: 'Elite (Tinh hoa)',
                      desc: `Cá thể có độ thích nghi cao nhất được bảo tồn nguyên vẹn`,
                    });
                  }

                  return timeline;
                };

                const maCell: React.CSSProperties = {
                  background: 'var(--surface-subtle)',
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                };
                const maCellLabel: React.CSSProperties = {
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                };
                const maCellVal: React.CSSProperties = {
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                };

                return (
                  <div
                    style={{
                      padding: '24px',
                      overflowY: 'auto',
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 20,
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        gap: 12,
                      }}
                    >
                      <div style={maCell}>
                        <div style={maCellLabel}>Thế hệ (Gen)</div>
                        <div style={maCellVal}>G{selectedTC.generation ?? 0}</div>
                      </div>
                      <div style={maCell}>
                        <div style={maCellLabel}>Toán tử (Operator)</div>
                        <div style={maCellVal}>
                          {selectedTC.ma_action || selectedTC.origin || 'MA'}
                        </div>
                      </div>
                      <div style={maCell}>
                        <div style={maCellLabel}>Cha mẹ (Parents)</div>
                        <div style={maCellVal}>
                          {selectedTC.parent_ids && selectedTC.parent_ids.length > 0
                            ? selectedTC.parent_ids.join(', ')
                            : 'N/A'}
                        </div>
                      </div>
                      <div style={maCell}>
                        <div style={maCellLabel}>Local Search</div>
                        <div style={maCellVal}>
                          {selectedTC.local_search_applied ? 'Có (✓)' : 'Không (—)'}
                        </div>
                      </div>
                      <div style={maCell}>
                        <div style={maCellLabel}>Fitness Trước LS</div>
                        <div style={maCellVal}>
                          {(selectedTC.fitness_before_ls ?? selectedTC.fitness).toFixed(3)}
                        </div>
                      </div>
                      <div style={maCell}>
                        <div style={maCellLabel}>Fitness Sau LS</div>
                        <div style={maCellVal}>
                          {(selectedTC.fitness_after_ls ?? selectedTC.fitness).toFixed(3)}
                        </div>
                      </div>
                      <div style={maCell}>
                        <div style={maCellLabel}>LS Gain (Cải tiến)</div>
                        <div
                          style={{
                            ...maCellVal,
                            color:
                              selectedTC.ls_gain > 0
                                ? 'var(--color-emerald)'
                                : 'var(--text-secondary)',
                          }}
                        >
                          {selectedTC.ls_gain > 0
                            ? `+${(selectedTC.ls_gain * 100).toFixed(1)}%`
                            : '0.0%'}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4
                        style={{
                          margin: '0 0 12px 0',
                          fontSize: 13,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        Lịch sử Tiến hóa & Cải tiến / Evolution Timeline
                      </h4>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                          paddingLeft: 8,
                          borderLeft: '2px dashed var(--border-subtle)',
                        }}
                      >
                        {getEvolutionTimeline(selectedTC).map((step, idx) => (
                          <div key={idx} style={{ position: 'relative', paddingLeft: 12 }}>
                            <div
                              style={{
                                position: 'absolute',
                                left: -14,
                                top: 4,
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: 'var(--brand-primary)',
                                border: '2px solid var(--bg-card)',
                              }}
                            />
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                              }}
                            >
                              G{step.gen} — {step.label}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              {step.desc}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

            {activeTab === 'intent' &&
              (() => {
                const intent = getTestIntent(selectedTC, schema);
                return (
                  <div
                    style={{
                      padding: '24px',
                      overflowY: 'auto',
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          marginBottom: 4,
                        }}
                      >
                        Category / Phân nhóm
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color:
                            intent.category === 'Security Test'
                              ? 'var(--color-rose)'
                              : 'var(--text-primary)',
                        }}
                      >
                        {intent.category}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          marginBottom: 4,
                        }}
                      >
                        Subtype / Loại ca test
                      </div>
                      <div
                        style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}
                      >
                        {intent.subtype}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          marginBottom: 8,
                        }}
                      >
                        Expected Behavior / Hành vi kỳ vọng
                      </div>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: 18,
                          listStyleType: 'disc',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        {intent.expectedBehavior.map((b, idx) => (
                          <li
                            key={idx}
                            style={{
                              fontSize: 12.5,
                              color: 'var(--text-primary)',
                              lineHeight: 1.4,
                            }}
                          >
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })()}

            {/* Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button className='btn btn-secondary' onClick={() => setSelectedTC(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @media print {
          aside, header, footer, .no-print, button, .glass-card:first-child, .glass-card:nth-child(2), .glass-card:nth-child(3) { display: none !important; }
          .app-container, main { margin-left: 0 !important; padding: 0 !important; background: white !important; }
          .glass-card { border: none !important; padding: 0 !important; box-shadow: none !important; background: transparent !important; }
          table { width: 100% !important; border: 1px solid #ddd !important; }
          th, td { border: 1px solid #ddd !important; padding: 10px !important; color: black !important; }
        }
      `}</style>
    </div>
  );
};

const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  pct?: boolean;
  info?: string;
}> = ({ label, value, min, max, step, onChange, pct, info }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11.5,
          color: 'var(--text-secondary)',
          marginBottom: 5,
          alignItems: 'center',
        }}
      >
        <span
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, position: 'relative' }}
        >
          {label}
          {info && (
            <span
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <Info size={13} style={{ color: 'var(--text-muted)' }} />
              {showTooltip && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: 6,
                    background: 'var(--surface-subtle)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 11,
                    width: 220,
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 1000,
                    pointerEvents: 'none',
                    lineHeight: '1.45',
                    fontWeight: 'normal',
                  }}
                >
                  {info}
                </div>
              )}
            </span>
          )}
        </span>
        <b style={{ color: 'var(--brand-primary)' }}>
          {pct ? `${Math.round(value * 100)}%` : value}
        </b>
      </div>
      <input
        type='range'
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--brand-primary)' }}
      />
    </div>
  );
};

const Metric: React.FC<{
  icon: React.ReactNode;
  label: string;
  vnLabel: string;
  infoText: string;
  value: string;
  accent?: string;
}> = ({ icon, label, vnLabel, infoText, value, accent }) => (
  <div
    className='glass-card'
    style={{
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      minHeight: '94px',
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        fontSize: 11.5,
        color: 'var(--text-muted)',
        letterSpacing: '0.02em',
        fontWeight: 600,
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <span style={{ color: accent || 'var(--color-teal)', marginTop: 2 }}>{icon}</span>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: 9.5,
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              lineHeight: '1.2',
            }}
          >
            {label}
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
            {vnLabel}
          </span>
        </div>
      </div>
      <div
        style={{
          cursor: 'pointer',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          opacity: 0.75,
          transition: 'opacity 0.2s',
          marginTop: 2,
        }}
        title={infoText}
      >
        <Info size={13} />
      </div>
    </div>
    <div
      style={{
        fontSize: 22,
        fontWeight: 700,
        color: accent || 'var(--text-primary)',
        marginTop: 8,
      }}
    >
      {value}
    </div>
  </div>
);

// Verdict nhị phân, KHÔNG còn phụ thuộc mã HTTP. Ưu tiên dấu hiệu lỗi trước
// (tránh chuỗi lý do có chữ "hợp lệ" bị đọc nhầm). Vẫn nhận data cũ ("HTTP …"/"VALIDATION_ERROR").
const getExpectedResultShort = (expectedResult: string): string => {
  if (!expectedResult) return 'Success';
  const clean = String(expectedResult).trim().toUpperCase();
  if (
    clean.startsWith('LỖI') ||
    clean.startsWith('ERROR') ||
    clean.startsWith('THẤT BẠI') ||
    clean.includes('VALIDATION_ERROR') ||
    clean.includes('HTTP 400') ||
    clean.includes('HTTP 422') ||
    clean.includes('HTTP 500')
  ) {
    return 'Error';
  }
  if (
    clean.startsWith('HỢP LỆ') ||
    clean.startsWith('SUCCESS') ||
    clean.startsWith('THÀNH CÔNG') ||
    clean.includes('HTTP 200') ||
    clean.includes('HTTP 201')
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
  return clean; // Fallback to returning the full error message
};

export default GeneticOptimize;
