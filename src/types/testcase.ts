/**
 * TestCase — Data Contract chuẩn duy nhất cho toàn bộ hệ thống TestForge.
 * Dùng interface này ở: SeedsTable, OptimizationDashboard, HistoryManager,
 * ApiSimulator, useAppStore. KHÔNG tạo thêm interface tương tự.
 */

export type TestCaseOrigin =
  | 'LLM'
  | 'GA'
  | 'HC_FINE_TUNED'
  | 'Elite'
  | 'Mutation'
  | 'Crossover'
  | 'Restart'
  | 'HallOfFame'
  | 'Traditional'
  | 'Import'
  | 'HC';

export type TestCategory = 'positive' | 'negative' | 'boundary' | 'equivalence' | 'decision';

export interface CoverageBreakdown {
  functional: number;
  boundary: number;
  negative: number;
  overall: number;
}

export interface TestCase {
  // ── Identity ──────────────────────────────────────────────────
  /** TC-0001, TC-0002… Bất biến từ F0. Không generate lại ở bất kỳ stage nào. */
  tcId: string;

  // ── Test Design ───────────────────────────────────────────────
  /** Phương pháp sinh: bva | ep | random | decision | hybrid */
  method?: string;
  /** Mô tả kịch bản cụ thể (> 15 ký tự, không chung chung) */
  scenario: string;
  /** Kết quả mong đợi, ví dụ "HTTP 200 – Đăng ký thành công" */
  expectedResult: string;
  /** Mô tả lỗi nếu là negative case */
  errorDescription: string;
  /** Lý do sinh TC */
  rationale?: string;
  /** Phân loại: positive | negative | boundary | equivalence | decision */
  categories: TestCategory[];

  // ── Data ──────────────────────────────────────────────────────
  /** Giá trị thực tế của các trường theo schema */
  values: Record<string, any>;

  // ── Fitness theo từng stage ───────────────────────────────────
  /** Điểm số chất lượng */
  validationScore: number;
  boundaryScore: number;
  negativeScore: number;

  /** Fitness của F0 gốc từ LLM */
  llmFitness?: number;
  /** Fitness sau GA evolution */
  gaFitness?: number;
  /** Fitness sau HC fine-tuning */
  hcFitness?: number;
  /** Optional origin of individual */
  origin?: string;
}

export interface FinalTestCase extends TestCase {
  origin: 'GA' | 'HC';
  finalFitness: number;
  changes: ChangeLog[];
}

export interface ChangeLog {
  field: string;
  oldValue: any;
  newValue: any;
  changedBy: 'GA' | 'HC';
  reason: string;
}

export interface TraceItem {
  stage: 'LLM' | 'GA' | 'HC';
  fitness: number;
}

export interface ComparisonData {
  tcId: string;
  llm: TestCase;
  ga: TestCase;
  hc: TestCase;
  final: FinalTestCase;
  changes: ChangeLog[];
  trace: TraceItem[];
}

export interface SummaryMetrics {
  total: number;
  changed: number;
  unchanged: number;
  improved: number;
  fallback: number;
  gaSelected: number;
  hcSelected: number;
}

export interface ExportPackage {
  json: any[];
  csvRows: string[];
  excelRows: any[];
}

/**
 * Snapshot đầy đủ của 1 phiên chạy tối ưu hóa.
 * Đủ để rebuild màn hình compare bất kỳ lúc nào từ History.
 */
export interface OptimizationSnapshot {
  /** ID duy nhất của snapshot (runId) */
  runId: string;
  /** ISO string timestamp */
  createdAt: string;
  /** Tên schema / đặc tả */
  specificationName: string;
  /** ID specification trong DB */
  specificationId: string;
  /** Hash of spec rawText for audit */
  specHash: string;

  /** Summary trả từ Backend */
  summary: SummaryMetrics;

  /** F0 seeds gốc từ LLM */
  llmSeeds: TestCase[];
  /** Kết quả sau GA evolution */
  gaResult: TestCase[];
  /** Kết quả sau HC fine-tuning */
  hcResult: TestCase[];
  /** Kết quả cuối cùng (SOURCE OF TRUTH) */
  finalResult: FinalTestCase[];

  /** Dữ liệu so sánh chi tiết giữa các phiên bản của từng Test Case */
  comparisonData: ComparisonData[];

  /** Dữ liệu Export Package đã chuẩn bị sẵn từ Backend */
  exportData?: ExportPackage;
}

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * Gán TC_ID cho danh sách seeds ngay sau khi nhận từ LLM/Mock.
 * Format: TC-0001, TC-0002… (4 chữ số, zero-padded)
 */
export function assignTcIds(seeds: any[]): TestCase[] {
  return seeds.map((seed, idx) => {
    const cats = seed.categories || (seed.category ? [seed.category] : [inferCategory(seed)]);
    return {
      tcId: seed.tcId || `TC-${String(idx + 1).padStart(4, '0')}`,
      method: seed.method || 'hybrid',
      scenario: seed.scenario || seed.desc || seed.description || '',
      expectedResult: seed.expectedResult || '',
      errorDescription: seed.errorDescription || seed.errorDesc || '',
      rationale: seed.rationale || '',
      categories: cats,
      values: extractValues(seed),
      validationScore: seed.validationScore ?? (seed.fitness ? seed.fitness * 100 : 100),
      boundaryScore: seed.boundaryScore ?? 0,
      negativeScore: seed.negativeScore ?? 0,
      llmFitness: seed.fitness ?? seed.llmFitness ?? undefined,
      gaFitness: undefined,
      hcFitness: undefined,
      origin: 'LLM' as TestCaseOrigin,
    };
  });
}

/** Map GA chromosomes về TestCase[], kế thừa TC_ID từ F0 seeds */
export function mapGaToTestCases(
  gaChromosomes: { values: Record<string, any>; fitness: number; origin: string }[],
  llmSeeds: TestCase[],
): TestCase[] {
  // Preserve exact 1:1 mapping with llmSeeds to keep TC_ID immutable.
  // Take the top N chromosomes from GA matching the length of llmSeeds.
  return llmSeeds.map((base, idx) => {
    const chrom = gaChromosomes[idx] || { values: base.values, fitness: base.llmFitness || 0, origin: base.origin };
    return {
      ...base,
      values: chrom.values,
      gaFitness: chrom.fitness,
      origin: (chrom.origin as TestCaseOrigin) || 'GA',
    };
  });
}

/** Map HC chromosomes về TestCase[], kế thừa TC_ID từ GA result */
export function mapHcToTestCases(
  hcChromosomes: { values: Record<string, any>; fitness: number; origin: string }[],
  gaResult: TestCase[],
): TestCase[] {
  // Preserve exact 1:1 mapping with gaResult
  return gaResult.map((base, idx) => {
    const chrom = hcChromosomes[idx] || { values: base.values, fitness: base.gaFitness || 0, origin: base.origin };
    return {
      ...base,
      values: chrom.values,
      hcFitness: chrom.fitness,
      origin: (chrom.origin as TestCaseOrigin) || 'HC_FINE_TUNED',
    };
  });
}

/** Tính avg fitness của một tập TestCase */
export function avgFitness(cases: TestCase[], stage: 'llm' | 'ga' | 'hc'): number {
  if (!cases || cases.length === 0) return 0;
  const key = stage === 'llm' ? 'llmFitness' : stage === 'ga' ? 'gaFitness' : 'hcFitness';
  const vals = cases.map(c => c[key] ?? 0);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function inferCategory(seed: any): TestCategory {
  const result = (seed.expectedResult || '').toLowerCase();
  const scenario = (seed.scenario || seed.desc || '').toLowerCase();
  if (result.includes('lỗi') || result.includes('error') || result.includes('invalid')
    || scenario.includes('không hợp lệ') || scenario.includes('invalid')) {
    return 'negative';
  }
  if (scenario.includes('biên') || scenario.includes('boundary') || scenario.includes('bva')) {
    return 'boundary';
  }
  return 'positive';
}

function extractValues(seed: any): Record<string, any> {
  const excluded = new Set([
    'method', 'scenario', 'desc', 'description', 'expectedResult',
    'errorDescription', 'errorDesc', 'isMock', 'engine', 'fitness',
    'llmFitness', 'gaFitness', 'hcFitness', 'origin', 'tcId', 'category', 'categories', 'rationale'
  ]);
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(seed)) {
    if (!excluded.has(k)) result[k] = v;
  }
  return Object.keys(result).length > 0 ? result : seed.data || seed.values || seed;
}
