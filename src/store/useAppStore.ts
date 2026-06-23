import { create } from 'zustand';
import type { Chromosome, PopulationStats } from '../algorithms/genetic';
import type { FieldConstraint, PresetSpec } from '../algorithms/presets';
import { config } from '../config';
import { toast } from './useToastStore';

export interface HistoryRun {
  timestamp: string;
  schemaName: string;
  size: number;
  coverage: number;
  bestFitness: number;
  data: Chromosome[];
}

export interface EvaluationResult {
  score: number;
  strengths: string[];
  weaknesses: string[];
  missing_cases: string[];
  security_risks: string[];
}

interface AppState {
  // State
  rawText: string;
  parsedSchema: FieldConstraint[];
  parsedConstraints: any[];
  parsedBusinessRules: any[];
  parsedCoverageTargets: any;
  initialSeeds: Chromosome[];
  schemaName: string;
  specificationId: string;
  apiKey: string;
  optimizedDataset: Chromosome[];
  historyRuns: HistoryRun[];
  completedScreens: string[];
  activeSection: string;
  activeScreen: string;
  isParsing: boolean;
  isEvaluating: boolean;
  isOptimizingGA: boolean;
  isOptimizingHC: boolean;
  gaResult: any | null;
  hcResult: any | null;
  workflowStatus: {
    input: 'pending' | 'completed';
    analyze: 'pending' | 'completed';
    evaluate: 'pending' | 'completed';
    ga: 'pending' | 'running' | 'completed';
    hc: 'pending' | 'running' | 'completed';
  };
  optimizationPhase: string;
  evaluationResult: EvaluationResult | null;
  evaluationMetrics: any | null; // Thông số định lượng F0 (coverage/fitness/dupRate/total) ở Bước Đánh giá
  specificationHistory: any[];
  isFetchingHistory: boolean;
  // ── Lịch sử phiên chạy tối ưu lấy từ Postgres (Trang Lịch Sử) ──
  jobs: any[];
  isFetchingJobs: boolean;
  // ── Lịch sử SNAPSHOT gộp 4 bước (màn Xuất Kết Quả - Bước 6) ──
  generationHistory: any[];
  isFetchingGenHistory: boolean;
  // ── Metadata dự án (màn Đầu vào kiểu Stitch) ──
  projectMeta: {
    name: string;
    version: string;
    priority: string;
    owner: string;
  };
  // ── Kết quả tối ưu Memetic & so sánh (chia sẻ giữa trang Tối ưu và So sánh) ──
  optimizeResult: any | null; // kết quả Memetic (RunResult)
  comparison: any | null; // { memetic, random, llm }
  parseError: string | null;
  llmProvider: 'gemini' | 'openai';
  methodSeeds: Record<string, any[]>;
  selectedPresetId: string;
  selectedMethods: ('random' | 'bva' | 'ep' | 'decision')[];
  boundaryCount: number;
  partitionCount: number;
  selectedSuiteName: string;

  // Actions
  setSelectedSuiteName: (name: string) => void;
  setRawText: (text: string) => void;
  setParsedSchema: (
    schema:
      | FieldConstraint[]
      | ((prev: FieldConstraint[]) => FieldConstraint[]),
  ) => void;
  setInitialSeeds: (
    seeds: Chromosome[] | ((prev: Chromosome[]) => Chromosome[]),
  ) => void;
  setMethodSeeds: (
    seeds:
      | Record<string, any[]>
      | ((prev: Record<string, any[]>) => Record<string, any[]>),
  ) => void;
  setSchemaName: (name: string) => void;
  setSpecificationId: (id: string) => void;
  setApiKey: (key: string) => void;
  setOptimizedDataset: (dataset: Chromosome[]) => void;
  setActiveSection: (section: string) => void;
  markScreenCompleted: (screen: string) => void;
  setActiveScreen: (screen: string) => void;
  setIsParsing: (isParsing: boolean) => void;
  setEvaluationMetrics: (metrics: any | null) => void;
  setIsOptimizingGA: (val: boolean) => void;
  setIsOptimizingHC: (val: boolean) => void;
  setGaResult: (res: any) => void;
  setHcResult: (res: any) => void;
  setWorkflowStatus: (step: 'input'|'analyze'|'evaluate'|'ga'|'hc', status: 'pending'|'running'|'completed') => void;
  setOptimizationPhase: (phase: string) => void;
  setSelectedPresetId: (id: string) => void;
  setSelectedMethods: (
    methods:
      | ('random' | 'bva' | 'ep' | 'decision')[]
      | ((
          prev: ('random' | 'bva' | 'ep' | 'decision')[],
        ) => ('random' | 'bva' | 'ep' | 'decision')[]),
  ) => void;
  setBoundaryCount: (count: number) => void;
  setPartitionCount: (count: number) => void;

  // Complex Actions
  handleParseSpec: (forceRefresh?: boolean) => Promise<void>;
  handlePresetSelect: (preset: PresetSpec) => void;
  handleEvolutionComplete: (
    results: Chromosome[],
    stats: PopulationStats[],
    hcStatsResult?: { optimizedFitness?: number },
  ) => void;
  handleLoadPastRun: (pastData: Chromosome[]) => void;
  handleClearHistory: () => void;
  handleEvaluateSeeds: (testMethod: string) => Promise<void>;
  handleGenerateTestSuite: () => Promise<void>;
  fetchSpecificationHistory: () => Promise<void>;
  // ── Trang Lịch Sử (Postgres) ──
  fetchJobs: () => Promise<void>;
  fetchJobDetail: (jobId: string) => Promise<any | null>;
  deleteJob: (jobId: string) => Promise<void>;
  // ── Snapshot lịch sử báo cáo (Bước 6) ──
  fetchGenerationHistory: () => Promise<void>;
  fetchGenerationDetail: (historyId: string) => Promise<any | null>;
  saveGenerationSnapshot: (payload: any) => Promise<void>;
  deleteGenerationHistory: (historyId: string) => Promise<void>;
  handleHistorySelect: (historyItem: any) => void;
  // ── Setters bổ sung ──
  setProjectMeta: (
    meta: Partial<{
      name: string;
      version: string;
      priority: string;
      owner: string;
    }>,
  ) => void;
  setLlmProvider: (provider: 'gemini' | 'openai') => void;
  setOptimizeResult: (r: any | null) => void;
  setComparison: (c: any | null) => void;
  handleSwitchScreen: (screen: string) => void;
  setParseError: (error: string | null) => void;
  handleClearSpecData: () => void;
}

export const useAppStore = create<AppState>((set, get) => {
  // Initialize historyRuns from localStorage
  let initialHistoryRuns: HistoryRun[] = [];
  try {
    const saved = localStorage.getItem('testforge_history_runs');
    initialHistoryRuns = saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error('Lỗi đọc dữ liệu lịch sử từ localStorage:', e);
  }

  // Initialize apiKey from sessionStorage
  const initialApiKey = sessionStorage.getItem('openai_api_key') || '';

  return {
    // Initial State
    rawText: '',
    parsedSchema: [],
    parsedConstraints: [],
    parsedBusinessRules: [],
    parsedCoverageTargets: null,
    initialSeeds: [],
    schemaName: '',
    specificationId: '',
    apiKey: initialApiKey,
    optimizedDataset: [],
    historyRuns: initialHistoryRuns,
    completedScreens: [],
    activeSection: '',
    activeScreen: 'input',
    isParsing: false,
    isEvaluating: false,
    isOptimizingGA: false,
    isOptimizingHC: false,
    gaResult: null,
    hcResult: null,
    workflowStatus: {
      input: 'pending',
      analyze: 'pending',
      evaluate: 'pending',
      ga: 'pending',
      hc: 'pending',
    },
    optimizationPhase: '',
    evaluationResult: null,
    evaluationMetrics: null,
    specificationHistory: [],
    isFetchingHistory: false,
    jobs: [],
    isFetchingJobs: false,
    generationHistory: [],
    isFetchingGenHistory: false,
    projectMeta: {
      name: 'Alpha AI Optimization',
      version: 'v1.0.4-rc',
      priority: 'Medium',
      owner: 'Trần Duy Anh',
    },
    optimizeResult: null,
    comparison: null,
    parseError: null,
    llmProvider: 'openai',
    methodSeeds: {
      random: [],
      bva: [],
      ep: [],
      decision: [],
    },
    selectedPresetId: '',
    selectedMethods: ['random'],
    boundaryCount: 3,
    partitionCount: 3,
    selectedSuiteName: '',

    // Simple Setters
    setRawText: (text) => set({ rawText: text }),
    setParsedSchema: (schema) =>
      set((state) => {
        const nextSchema =
          typeof schema === 'function' ? schema(state.parsedSchema) : schema;
        return {
          parsedSchema: nextSchema,
          initialSeeds: [], // Clear old initial seeds so user is forced to regenerate matching new constraints
        };
      }),
    setParsedConstraints: (constraints: any[]) => set({ parsedConstraints: constraints }),
    setParsedBusinessRules: (rules: any[]) => set({ parsedBusinessRules: rules }),
    setParsedCoverageTargets: (targets: any) => set({ parsedCoverageTargets: targets }),
    setInitialSeeds: (seeds) =>
      set((state) => ({
        initialSeeds:
          typeof seeds === 'function' ? seeds(state.initialSeeds) : seeds,
      })),
    setMethodSeeds: (seeds) =>
      set((state) => ({
        methodSeeds:
          typeof seeds === 'function' ? seeds(state.methodSeeds) : seeds,
      })),
    setSchemaName: (name) => set({ schemaName: name }),
    setSpecificationId: (id) => set({ specificationId: id }),
    setApiKey: (key) => {
      sessionStorage.setItem('openai_api_key', key);
      set({ apiKey: key });
    },
    setOptimizedDataset: (dataset) => set({ optimizedDataset: dataset }),
    setSelectedSuiteName: (name) => set({ selectedSuiteName: name }),
    setActiveScreen: (screen) => set({ activeScreen: screen }),
    setActiveSection: (section) => set({ activeSection: section }),
    markScreenCompleted: (screen) =>
      set((state) => ({
        completedScreens: state.completedScreens.includes(screen)
          ? state.completedScreens
          : [...state.completedScreens, screen],
      })),
    setIsParsing: (isParsing) => set({ isParsing }),
    setEvaluationMetrics: (metrics) => set({ evaluationMetrics: metrics }),
    setIsOptimizingGA: (val) => set({ isOptimizingGA: val }),
    setIsOptimizingHC: (val) => set({ isOptimizingHC: val }),
    setGaResult: (res) => set({ gaResult: res }),
    setHcResult: (res) => set({ hcResult: res }),
    setWorkflowStatus: (step, status) => set((state) => ({
      workflowStatus: { ...state.workflowStatus, [step]: status }
    })),
    setOptimizationPhase: (phase) => set({ optimizationPhase: phase }),
    setSelectedPresetId: (id) => set({ selectedPresetId: id }),
    setSelectedMethods: (methods) =>
      set((state) => ({
        selectedMethods:
          typeof methods === 'function'
            ? methods(state.selectedMethods)
            : methods,
      })),
    setBoundaryCount: (count) => set({ boundaryCount: count }),
    setPartitionCount: (count) => set({ partitionCount: count }),

    // Complex Actions
    handleParseSpec: async (forceRefresh: boolean = false) => {
      const { rawText, apiKey, llmProvider, isParsing, parsedSchema } = get();

      // Tối ưu: Nếu đang phân tích hoặc nội dung thô rỗng thì bỏ qua
      if (!rawText.trim() || isParsing) return;

      // Tối ưu: Nếu không forceRefresh và đã có schema cho văn bản này (so sánh sơ bộ) thì bỏ qua
      if (
        !forceRefresh &&
        parsedSchema.length > 0 &&
        get().schemaName ===
          rawText.substring(0, 25) + (rawText.length > 25 ? '...' : '')
      ) {
        console.log(
          '>>> [FE] Bỏ qua call API Specifications vì dữ liệu đã tồn tại.',
        );
        return;
      }

      set({ isParsing: true, parseError: null });
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 65000);
        
        const response = await fetch(
          `${config.API_BASE_URL}/api/specifications`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              raw_text: rawText,
              llm_provider: llmProvider,
              api_key_override: apiKey ? apiKey.trim() : null,
              force_reanalyze: forceRefresh,
            }),
            signal: controller.signal,
          },
        );
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.detail || 'Không thể kết nối với Backend Server!',
          );
        }

        const res = await response.json();

        set({
          parsedSchema: res.fields,
          parsedConstraints: res.constraints || [],
          parsedBusinessRules: res.businessRules || [],
          parsedCoverageTargets: res.coverageTargets || null,
          initialSeeds: res.initialPopulation,
          specificationId: res.specification_id,
          schemaName:
            rawText.substring(0, 25) + (rawText.length > 25 ? '...' : ''),
          optimizedDataset: [],
          isParsing: false,
        });

        if (res.is_mock) {
          toast.warning(
            'Chưa gán API Key (Gemini/OpenAI) hợp lệ!\nHệ thống đã sinh dữ liệu mẫu bằng bộ phân tích giả lập (Mock Fallback).\nVui lòng cấu hình API Key ở góc trên bên phải màn hình để thực hiện phân tích bằng AI thật.',
          );
        } else if (res.cached) {
          toast.success(
            'Nạp dữ liệu phân tích đặc tả thành công (Lấy từ bộ nhớ đệm hệ thống)!',
          );
        } else {
          toast.success(
            'Phân tích đặc tả nghiệp vụ bằng AI thành công!\nQuy tắc ràng buộc (JSON Rules) và tập dữ liệu hạt giống F0 đã được tạo lập tự động.',
          );
        }
      } catch (e: any) {
        const errorMessage = `Đã xảy ra lỗi kết nối: ${e.message || 'Hãy đảm bảo FastAPI Backend đang chạy!'}`;
        console.error(e);
        toast.error(errorMessage);
        set({ isParsing: false, parseError: errorMessage });
      }
    },

    handlePresetSelect: (preset) => {
      set({
        rawText: preset.rawText,
        parsedSchema: preset.fields,
        parsedConstraints: (preset as any).constraints || [],
        parsedBusinessRules: (preset as any).businessRules || [],
        parsedCoverageTargets: (preset as any).coverageTargets || null,
        initialSeeds: preset.initialPopulation,
        schemaName: preset.title.split(' (')[0],
        specificationId: '',
        optimizedDataset: [],
        selectedPresetId: preset.id,
        methodSeeds: {
          random: [],
          bva: [],
          ep: [],
          decision: [],
        },
      });
    },

    handleEvolutionComplete: (results, stats, hcStatsResult) => {
      const { schemaName, historyRuns } = get();

      // Chuẩn hóa: Làm phẳng mảng kết quả (loại bỏ wrapper "values")
      const flattenedResults = results.map((ind: any) => ({
        ...(ind.values || ind), // Trường hợp đã phẳng thì lấy luôn, nếu chưa thì lấy .values
        fitness: ind.fitness,
        origin: ind.origin,
      }));

      const finalGenStats = stats[stats.length - 1];
      const newRun: HistoryRun = {
        timestamp: new Date().toLocaleTimeString(),
        schemaName: schemaName,
        size: flattenedResults.length,
        coverage: finalGenStats?.coverage || 0.95,
        bestFitness:
          hcStatsResult?.optimizedFitness || finalGenStats?.bestFitness || 0.98,
        data: flattenedResults,
      };

      const updatedHistoryRuns = [newRun, ...historyRuns];
      try {
        localStorage.setItem(
          'testforge_history_runs',
          JSON.stringify(updatedHistoryRuns),
        );
      } catch (e) {
        console.error('Lỗi ghi dữ liệu lịch sử vào localStorage:', e);
      }

      set({
        optimizedDataset: flattenedResults,
        historyRuns: updatedHistoryRuns,
      });
    },

    handleLoadPastRun: (pastData) => {
      set({ optimizedDataset: pastData });
      toast.success('Đã nạp lại mảng Test Cases tối ưu từ phiên chạy trước!');
    },

    handleClearHistory: () => {
      if (
        window.confirm(
          'Bạn có chắc chắn muốn xóa toàn bộ lịch sử các phiên chạy đã lưu không?',
        )
      ) {
        set({ historyRuns: [] });
        localStorage.removeItem('testforge_history_runs');
        toast.info('Đã xóa toàn bộ lịch sử phiên chạy.');
      }
    },

    handleSwitchScreen: (screen) => {
      set({ activeScreen: screen });
    },

    setParseError: (error) => set({ parseError: error }),

    handleEvaluateSeeds: async (testMethod: string) => {
      const { rawText, parsedSchema, initialSeeds, apiKey, llmProvider } =
        get();
      if (!initialSeeds || initialSeeds.length === 0) return;

      set({ isEvaluating: true, evaluationResult: null });
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 65000);

        const response = await fetch(
          `${config.API_BASE_URL}/api/evaluate-seeds`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fields: parsedSchema,
              seeds: initialSeeds,
              test_method: testMethod,
              raw_text: rawText,
              llm_provider: llmProvider,
              api_key_override: apiKey ? apiKey.trim() : null,
            }),
            signal: controller.signal,
          },
        );
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || 'Lỗi khi kết nối với máy chủ AI');
        }

        const res = await response.json();
        if (res.success && res.data) {
          set({ evaluationResult: res.data, isEvaluating: false });
        } else {
          throw new Error('Dữ liệu phản hồi không hợp lệ');
        }
      } catch (error: any) {
        console.error('Evaluation Error:', error);
        toast.warning(
          `Có lỗi khi nhờ AI đánh giá. Đã chuyển về dữ liệu đánh giá mô phỏng dự phòng.`,
        );
        // Mock fallback
        set({
          isEvaluating: false,
          evaluationResult: {
            score: 88,
            strengths: [
              'Bao phủ tốt các trường hợp cơ bản (Happy path).',
              'Đã sử dụng cấu trúc đúng định dạng dữ liệu được yêu cầu.',
            ],
            weaknesses: [
              'Chưa có nhiều dữ liệu đột biến dị biệt.',
              'Số lượng ca kiểm thử F0 còn hạn chế để tiến hóa mạnh.',
            ],
            missing_cases: [
              'Thiếu kiểm thử giá trị rỗng (Null/Empty) ở một số trường phụ.',
              'Thiếu chuỗi Unicode đặc biệt hoặc Emoji.',
            ],
            security_risks: ['Cần bổ sung thêm mẫu XSS nâng cao.'],
          },
        });
      }
    },

    handleGenerateTestSuite: async () => {
      const {
        parsedSchema,
        selectedMethods,
        apiKey,
        rawText,
        boundaryCount,
        partitionCount,
        isParsing,
        llmProvider,
      } = get();
      if (!parsedSchema || parsedSchema.length === 0 || isParsing) return;

      set({ isParsing: true });
      try {
        let allSeeds: Chromosome[] = [];
        const sanitizedFields = (parsedSchema || []).map((field: any) => {
          const cleaned = { ...field };
          if (cleaned.minLength === 0) delete cleaned.minLength;
          if (cleaned.maxLength === 0) delete cleaned.maxLength;
          if (cleaned.minValue === 0) delete cleaned.minValue;
          if (cleaned.maxValue === 0) delete cleaned.maxValue;
          return cleaned;
        });

        const fetchPromises = selectedMethods.map(async (method) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 65000);
          
          try {
            const response = await fetch(
              `${config.API_BASE_URL}/api/generate-seeds`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  fields: sanitizedFields,
                  test_method: method,
                  boundary_count: boundaryCount,
                  partition_count: partitionCount,
                  api_key_override: apiKey ? apiKey.trim() : null,
                  raw_text: rawText,
                  llm_provider: llmProvider,
                }),
                signal: controller.signal,
              },
            );
            clearTimeout(timeoutId);

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(
                errorData.detail ||
                  `Lỗi khi sinh test suite với phương pháp ${method}`,
              );
            }

            const res = await response.json();
            return res.initialPopulation || [];
          } catch (e: any) {
            clearTimeout(timeoutId);
            throw e;
          }
        });

        // Run all selected methods in parallel
        const results = await Promise.all(fetchPromises);
        results.forEach(population => {
          allSeeds = [...allSeeds, ...population];
        });

        if (allSeeds.length > 0) {
          set({ initialSeeds: allSeeds, isParsing: false });
          toast.success(
            `Đã sinh thành công ${allSeeds.length} ca kiểm thử hạt giống bằng AI!`,
          );
        } else {
          set({ isParsing: false });
          toast.warning('Không có test case nào được sinh ra.');
        }
      } catch (error: any) {
        console.error('Generate Test Suite Error:', error);
        toast.error(`Lỗi: ${error.message || 'Không thể sinh test suite'}`);
        set({ isParsing: false });
      }
    },

    fetchSpecificationHistory: async () => {
      const { isFetchingHistory, specificationHistory } = get();
      // Tối ưu: Chỉ fetch nếu chưa có dữ liệu hoặc không đang trong quá trình fetch
      if (isFetchingHistory) return;
      if (specificationHistory.length > 0) {
        // Có thể chọn refresh ngầm hoặc bỏ qua. Ở đây ta cho phép refresh nhưng tránh song song.
      }

      set({ isFetchingHistory: true });
      try {
        const response = await fetch(
          `${config.API_BASE_URL}/api/specifications`,
        );
        if (response.ok) {
          const data = await response.json();
          set({ specificationHistory: data });
        }
      } catch (error) {
        console.error('Lỗi khi tải lịch sử đặc tả:', error);
      } finally {
        set({ isFetchingHistory: false });
      }
    },

    // ── TRANG LỊCH SỬ: nạp danh sách phiên chạy tối ưu từ Postgres ──
    fetchJobs: async () => {
      const { isFetchingJobs } = get();
      if (isFetchingJobs) return;
      // if (jobs.length > 0) return; // Cho phép refresh nhưng tránh song song

      set({ isFetchingJobs: true });
      try {
        const response = await fetch(`${config.API_BASE_URL}/api/jobs`);
        if (response.ok) {
          const data = await response.json();
          set({ jobs: data });
        } else {
          throw new Error('Không tải được lịch sử phiên chạy');
        }
      } catch (error) {
        console.error('Lỗi khi tải lịch sử phiên chạy (jobs):', error);
        toast.error(
          'Không thể tải Lịch sử từ máy chủ. Hãy đảm bảo Backend + Postgres đang chạy.',
        );
      } finally {
        set({ isFetchingJobs: false });
      }
    },

    fetchJobDetail: async (jobId: string) => {
      try {
        const response = await fetch(
          `${config.API_BASE_URL}/api/jobs/${jobId}`,
        );
        if (!response.ok) throw new Error('Không tải được chi tiết phiên chạy');
        return await response.json();
      } catch (error) {
        console.error('Lỗi khi tải chi tiết phiên chạy:', error);
        toast.error('Không thể tải chi tiết phiên chạy này.');
        return null;
      }
    },

    setProjectMeta: (meta) =>
      set((state: AppState) => ({
        projectMeta: { ...state.projectMeta, ...meta },
      })),
    setLlmProvider: (provider) => set({ llmProvider: provider }),
    setOptimizeResult: (r) => set({ optimizeResult: r }),
    setComparison: (c) => set({ comparison: c }),

    deleteJob: async (jobId: string) => {
      try {
        const response = await fetch(
          `${config.API_BASE_URL}/api/jobs/${jobId}`,
          { method: 'DELETE' },
        );
        if (!response.ok) throw new Error('Xóa thất bại');
        set((state: AppState) => ({
          jobs: state.jobs.filter((j: any) => j.id !== jobId),
        }));
        toast.info('Đã xóa phiên chạy khỏi lịch sử.');
      } catch (error) {
        console.error('Lỗi khi xóa phiên chạy:', error);
        toast.error('Không thể xóa phiên chạy này.');
      }
    },

    // ── SNAPSHOT BÁO CÁO (Bước 6): danh sách lịch sử gộp 4 bước ──
    fetchGenerationHistory: async () => {
      const { isFetchingGenHistory } = get();
      if (isFetchingGenHistory) return;
      // if (generationHistory.length > 0) return;

      set({ isFetchingGenHistory: true });
      try {
        const response = await fetch(
          `${config.API_BASE_URL}/api/generation-history`,
        );
        if (response.ok) {
          const data = await response.json();
          set({ generationHistory: data });
        } else {
          throw new Error('Không tải được lịch sử báo cáo');
        }
      } catch (error) {
        console.error(
          'Lỗi khi tải lịch sử báo cáo (generation-history):',
          error,
        );
        toast.error(
          'Không thể tải lịch sử báo cáo. Hãy đảm bảo Backend + Postgres đang chạy.',
        );
      } finally {
        set({ isFetchingGenHistory: false });
      }
    },

    fetchGenerationDetail: async (historyId: string) => {
      try {
        const response = await fetch(
          `${config.API_BASE_URL}/api/generation-history/${historyId}`,
        );
        if (!response.ok) throw new Error('Không tải được chi tiết báo cáo');
        return await response.json();
      } catch (error) {
        console.error('Lỗi khi tải chi tiết báo cáo:', error);
        toast.error('Không thể tải chi tiết báo cáo này.');
        return null;
      }
    },

    // Lưu snapshot gộp 4 bước (best-effort: lỗi không chặn luồng tối ưu chính)
    saveGenerationSnapshot: async (payload) => {
      try {
        const response = await fetch(
          `${config.API_BASE_URL}/api/generation-history`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        );
        if (!response.ok) throw new Error('Lưu snapshot thất bại');
        // Làm mới danh sách nếu đang mở màn Xuất Kết Quả
        get().fetchGenerationHistory();
      } catch (error) {
        console.error('Lỗi khi lưu snapshot báo cáo:', error);
      }
    },

    deleteGenerationHistory: async (historyId: string) => {
      try {
        const response = await fetch(
          `${config.API_BASE_URL}/api/generation-history/${historyId}`,
          { method: 'DELETE' },
        );
        if (!response.ok) throw new Error('Xóa thất bại');
        set((state: AppState) => ({
          generationHistory: state.generationHistory.filter(
            (h: any) => h.id !== historyId,
          ),
        }));
        toast.info('Đã xóa bản ghi lịch sử báo cáo.');
      } catch (error) {
        console.error('Lỗi khi xóa lịch sử báo cáo:', error);
        toast.error('Không thể xóa bản ghi này.');
      }
    },

    handleHistorySelect: (historyItem) => {
      set({
        rawText: historyItem.raw_text,
        parsedSchema: historyItem.fields,
        parsedConstraints: historyItem.constraints || [],
        parsedBusinessRules: historyItem.businessRules || [],
        parsedCoverageTargets: historyItem.coverageTargets || null,
        initialSeeds: historyItem.initialPopulation,
        schemaName:
          historyItem.raw_text.substring(0, 25) +
          (historyItem.raw_text.length > 25 ? '...' : ''),
        specificationId: historyItem.id,
        optimizedDataset: [],
        selectedPresetId: '',
        methodSeeds: {
          random: [],
          bva: [],
          ep: [],
          decision: [],
        },
      });
      toast.success('Đã nạp thành công đặc tả từ lịch sử!');
    },

    handleClearSpecData: () => {
      set({
        parsedSchema: [],
        parsedConstraints: [],
        parsedBusinessRules: [],
        parsedCoverageTargets: null,
        initialSeeds: [],
        schemaName: '',
        specificationId: '',
        optimizedDataset: [],
        evaluationResult: null,
        parseError: null,
        llmProvider: 'openai',
        selectedPresetId: '',
        selectedMethods: ['random'],
        boundaryCount: 3,
        partitionCount: 3,
        methodSeeds: {
          random: [],
          bva: [],
          ep: [],
          decision: [],
        },
      });
    },
  };
});
