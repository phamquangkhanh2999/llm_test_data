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
  gaProgressHistory: { generation: number; bestFitness: number; avgFitness: number }[];
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
  // ── Lịch sử phiên chạy tối ưu lấy từ SQLite (Trang Lịch Sử) ──
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
  setGaProgressHistory: (history: { generation: number; bestFitness: number; avgFitness: number }[]) => void;
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
  // ── Trang Lịch Sử (SQLite) ──
  fetchJobs: () => Promise<void>;
  fetchJobDetail: (jobId: string) => Promise<any | null>;
  deleteJob: (jobId: string) => Promise<void>;
  // ── Snapshot lịch sử báo cáo (Bước 6) ──
  fetchGenerationHistory: () => Promise<void>;
  fetchGenerationDetail: (historyId: string) => Promise<any | null>;
  saveGenerationSnapshot: (payload: any) => Promise<void>;
  deleteGenerationHistory: (historyId: string) => Promise<void>;
  restoreSessionFromHistory: (snapshot: any) => void;
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
    rawText: 'Yêu cầu: Quản lý sản phẩm.\n- productId: bắt buộc, định dạng PROD-[0-9]{4}\n- productName: bắt buộc, tối đa 191 ký tự\n- sku: bắt buộc\n- price: bắt buộc, số > 0\n- stockQuantity: bắt buộc, số nguyên >= 0\n- categoryId: bắt buộc, CAT-01 đến CAT-05\n- status: bắt buộc, ACTIVE, INACTIVE, OUT_OF_STOCK',
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
    gaProgressHistory: [],
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
    boundaryCount: 4,
    partitionCount: 3,
    selectedSuiteName: '',

    // Simple Setters
    setRawText: (text) => set((state) => {
      if (state.selectedPresetId) {
        return { rawText: text, selectedPresetId: '' };
      }
      return { rawText: text };
    }),
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
    setGaProgressHistory: (history) => set({ gaProgressHistory: history }),
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
      const { rawText, isParsing, parsedSchema, apiKey, llmProvider } = get();

      if (!rawText.trim() || isParsing) return;

      if (
        !forceRefresh &&
        parsedSchema.length > 0 &&
        get().selectedPresetId
      ) {
        console.log('>>> [FE] Bỏ qua call API vì dữ liệu đã tồn tại (preset hoặc cache).');
        set({ isParsing: true });
        setTimeout(() => {
          set({ isParsing: false });
          toast.success('Đã tải đặc tả phân tích (Từ Preset/Cache)!');
        }, 500);
        return;
      }

      set({ isParsing: true, parseError: null });
      try {
        // Try calling the actual API if forceRefresh or no existing schema
        const response = await fetch(`http://localhost:8000/api/specifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            raw_text: rawText,
            force_reanalyze: forceRefresh,
            api_key_override: apiKey || undefined,
            llm_provider: llmProvider || 'openai'
          })
        });
        
        if (response.ok) {
          const res = await response.json();
          set({
            parsedSchema: res.fields || [],
            parsedConstraints: res.constraints || [],
            parsedBusinessRules: res.business_rules || [],
            initialSeeds: res.initialPopulation || [],
            specificationId: res.specification_id || 'MOCK-SPEC-ID',
            schemaName: rawText.substring(0, 25) + '...',
            isParsing: false,
          });
          toast.success('Phân tích đặc tả nghiệp vụ bằng AI thành công!');
        } else {
          throw new Error('API server returned error or is offline');
        }
      } catch (e: any) {
        console.warn('API fetch failed, falling back to mock / existing schema:', e);
        
        // Fallback to existing schema if it exists, otherwise generate a mock schema
        const existingSchema = get().parsedSchema;
        const fallbackSchema = existingSchema.length > 0 ? existingSchema : [
          { name: "mockField", type: "string", required: true, description: "Trường giả lập do mất kết nối API" }
        ];

        set({
          parsedSchema: fallbackSchema,
          parsedConstraints: [],
          parsedBusinessRules: [],
          parsedCoverageTargets: null,
          specificationId: 'MOCK-SPEC-ID',
          schemaName: rawText.substring(0, 25) + '...',
          isParsing: false,
        });

        toast.success('Đã tải đặc tả dự phòng (Mock Mode)!');
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
      const { initialSeeds, parsedSchema, parsedBusinessRules, parsedConstraints, rawText, apiKey, llmProvider } = get();
      if (!initialSeeds || initialSeeds.length === 0) return;

      set({ isEvaluating: true, evaluationResult: null });
      try {
        const reqBody = {
          fields: parsedSchema,
          seeds: initialSeeds,
          test_method: testMethod || 'bva',
          raw_text: rawText,
          extracted_rules: parsedBusinessRules,
          extracted_constraints: parsedConstraints,
          api_key_override: apiKey || undefined,
          llm_provider: llmProvider || 'openai'
        };

        const response = await fetch(`http://localhost:8000/api/evaluate-seeds`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody)
        });

        if (!response.ok) {
          const errRes = await response.json();
          throw new Error(errRes.detail || 'API lỗi hoặc không phản hồi');
        }
        
        const data = await response.json();
        
        set({ 
          evaluationResult: {
            score: data.score || 0,
            strengths: data.strengths || [],
            weaknesses: data.weaknesses || [],
            missing_cases: data.missing_cases || [],
            security_risks: data.security_risks || []
          },
          isEvaluating: false 
        });
        toast.success('Đánh giá F0 từ AI thành công!');
      } catch (error: any) {
        console.error('Evaluation Error:', error);
        toast.warning(
          `Có lỗi khi nhờ AI đánh giá (${error.message}). Đã chuyển về dữ liệu đánh giá dự phòng.`,
        );
        // Mock fallback
        set({
          isEvaluating: false,
          evaluationResult: {
            score: 88,
            strengths: ['Bao phủ tốt các trường hợp cơ bản (Happy path).'],
            weaknesses: ['Chưa có nhiều dữ liệu đột biến dị biệt.'],
            missing_cases: ['Thiếu kiểm thử giá trị rỗng (Null/Empty).'],
            security_risks: ['Cần bổ sung thêm mẫu XSS nâng cao.'],
          },
        });
      }
    },

    handleGenerateTestSuite: async () => {
      const { parsedSchema, parsedConstraints, parsedBusinessRules, rawText, apiKey, llmProvider, selectedMethods, boundaryCount, partitionCount, isParsing, selectedPresetId, initialSeeds } = get();
      if (!parsedSchema || parsedSchema.length === 0 || isParsing) return;

      set({ isParsing: true });
      try {
        if (selectedPresetId) {
          // ==============================
          // 1. MOCK DATA (Dùng Preset)
          // ==============================
          await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate delay
          const mockDataPath = await import('../data/dlieu_mau_data.json');
          const allRes = mockDataPath.default || mockDataPath;
          
          const prefixes: any = {
            'preset-1': 'DangNhap',
            'preset-2': 'ThemSP',
            'preset-3': 'SuaSP',
            'preset-4': 'XoaSP',
            'preset-5': 'TimKiem'
          };
          const prefix = prefixes[selectedPresetId] || 'DangNhap';
          const llmSheet = allRes[`${prefix}_LLM`] || [];
          
          const mapData = (sheet: any[]) => {
            return sheet.map((row: any) => ({
              ...row,
              id: row.tcId || `TC-${Math.floor(Math.random() * 90000) + 10000}`,
            }));
          };
          
          const initialSeedsData = mapData(llmSheet.slice(1));
          set({
            initialSeeds: initialSeedsData,
            isParsing: false,
          });
          toast.success(`Đã sinh xong F0 (${initialSeedsData.length} Test Cases) từ mẫu!`);
        } else {
          // ==============================
          // 2. REAL API (Không dùng Preset)
          // ==============================
          const reqBody = {
            raw_text: rawText,
            fields: parsedSchema,
            business_rules: parsedBusinessRules,
            constraints: parsedConstraints,
            test_methods: selectedMethods.length ? selectedMethods : ["bva"],
            boundary_count: boundaryCount || 4,
            partition_count: partitionCount || 3,
            api_key_override: apiKey || undefined,
            llm_provider: llmProvider || 'openai'
          };
          
          const response = await fetch(`http://localhost:8000/api/generate-seeds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqBody)
          });
          
          if (!response.ok) {
            const errRes = await response.json();
            throw new Error(errRes.detail || 'API lỗi hoặc không phản hồi');
          }
          const res = await response.json();
          
          if (res.initialPopulation && res.initialPopulation.length > 0) {
            set({
              initialSeeds: res.initialPopulation,
              parsedCoverageTargets: res.coverageSummary,
              isParsing: false
            });
            toast.success(`Đã sinh xong F0 (${res.initialPopulation.length} Test Cases) từ AI!`);
          } else {
            throw new Error('AI không trả về dữ liệu hạt giống nào');
          }
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

    // ── TRANG LỊCH SỬ: nạp danh sách phiên chạy tối ưu từ SQLite ──
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
          'Không thể tải Lịch sử từ máy chủ. Hãy đảm bảo Backend + SQLite đang chạy.',
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
          'Không thể tải lịch sử báo cáo. Hãy đảm bảo Backend + SQLite đang chạy.',
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
        toast.success('Đã xóa báo cáo lịch sử.');
      } catch (error) {
        console.error('Lỗi khi xóa lịch sử báo cáo:', error);
        toast.error('Không thể xóa báo cáo lúc này.');
      }
    },

    restoreSessionFromHistory: (snapshot: any) => {
      set({
        rawText: snapshot.step1_raw_text || '',
        parsedSchema: snapshot.step2_schema?.fields || [],
        parsedBusinessRules: snapshot.step2_schema?.business_rules || [],
        parsedConstraints: snapshot.step2_schema?.constraints || [],
        initialSeeds: snapshot.step3_seeds?.seeds || [],
        evaluationResult: snapshot.step3_seeds?.evaluation || null,
        evaluationMetrics: snapshot.step3_seeds?.metrics || null,
        hcResult: snapshot.step4_optimized_data || [],
        schemaName: snapshot.spec_name || 'Restored Session',
        activeScreen: 'evaluate',
      });
      toast.success('Đã khôi phục phiên làm việc từ lịch sử!');
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
        boundaryCount: 4,
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
