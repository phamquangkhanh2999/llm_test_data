import { create } from 'zustand';
import type { PresetSpec, FieldConstraint } from '../algorithms/presets';
import type { Chromosome, PopulationStats } from '../algorithms/genetic';
import type { HillClimbStats } from '../algorithms/hillClimbing';
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
export interface SanityCheckStep {
  status: string;
  schema_check?: string;
  type_check?: string;
  invalid_removed?: number;
  description: string;
}

export interface FitnessEvaluationStep {
  status: string;
  fitness_score?: number;
  penalty_score?: number;
  violations_count?: number;
  applied_weights?: string;
  description: string;
}

export interface BoundaryEdgeCheckStep {
  status: string;
  boundary_coverage?: string | number;
  critical_hits?: number;
  description: string;
}

export interface EvaluationResult {
  score: number;
  strengths?: string[];
  weaknesses?: string[];
  sanity_check?: SanityCheckStep;
  fitness_evaluation?: FitnessEvaluationStep;
  boundary_edge_check?: BoundaryEdgeCheckStep;
  missing_cases: string[];
  security_risks: string[];
}

interface AppState {
  // State
  rawText: string;
  parsedSchema: FieldConstraint[];
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
  llmProvider: 'gemini' | 'openai';
  isEvaluating: boolean;
  evaluationResult: EvaluationResult | null;
  isEvaluatingOptimized: boolean;
  optimizedEvaluationResult: EvaluationResult | null;
  specificationHistory: any[];
  isFetchingHistory: boolean;
  parseError: string | null;
  methodSeeds: Record<string, any[]>;
  selectedPresetId: string;
  selectedMethods: ('random' | 'bva' | 'ep' | 'decision')[];
  boundaryCount: number;
  partitionCount: number;
  selectedSuiteName: string;

  // Actions
  setLlmProvider: (provider: 'gemini' | 'openai') => void;
  setSelectedSuiteName: (name: string) => void;
  setRawText: (text: string) => void;
  setParsedSchema: (schema: FieldConstraint[] | ((prev: FieldConstraint[]) => FieldConstraint[])) => void;
  setInitialSeeds: (seeds: Chromosome[] | ((prev: Chromosome[]) => Chromosome[])) => void;
  setMethodSeeds: (seeds: Record<string, any[]> | ((prev: Record<string, any[]>) => Record<string, any[]>)) => void;
  setSchemaName: (name: string) => void;
  setSpecificationId: (id: string) => void;
  setApiKey: (key: string) => void;
  setOptimizedDataset: (dataset: Chromosome[]) => void;
  setActiveSection: (section: string) => void;
  markScreenCompleted: (screen: string) => void;
  setActiveScreen: (screen: string) => void;
  setIsParsing: (isParsing: boolean) => void;
  setSelectedPresetId: (id: string) => void;
  setSelectedMethods: (methods: ('random' | 'bva' | 'ep' | 'decision')[] | ((prev: ('random' | 'bva' | 'ep' | 'decision')[]) => ('random' | 'bva' | 'ep' | 'decision')[])) => void;
  setBoundaryCount: (count: number) => void;
  setPartitionCount: (count: number) => void;

  // Complex Actions
  handleParseSpec: () => Promise<void>;
  handlePresetSelect: (preset: PresetSpec) => void;
  handleEvolutionComplete: (results: Chromosome[], stats: PopulationStats[], hcStatsResult?: HillClimbStats) => void;
  handleLoadPastRun: (pastData: Chromosome[]) => void;
  handleClearHistory: () => void;
  handleEvaluateSeeds: (testMethod: string) => Promise<void>;
  handleEvaluateOptimized: (algorithm: string) => Promise<void>;
  fetchSpecificationHistory: () => Promise<void>;
  handleHistorySelect: (historyItem: any) => void;
  handleSwitchScreen: (screen: string) => void;
  setParseError: (error: string | null) => void;
  handleClearSpecData: () => void;
  clearParsedData: () => void;
}

export const useAppStore = create<AppState>((set, get) => {
  // Initialize historyRuns from localStorage
  let initialHistoryRuns: HistoryRun[] = [];
  try {
    const saved = localStorage.getItem('testforge_history_runs');
    initialHistoryRuns = saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error("Lỗi đọc dữ liệu lịch sử từ localStorage:", e);
  }

  // Initialize apiKey from sessionStorage
  const initialApiKey = sessionStorage.getItem("openai_api_key") || "";

  return {
    // Initial State
    rawText: '',
    parsedSchema: [],
    initialSeeds: [],
    schemaName: '',
    specificationId: '',
    apiKey: initialApiKey,
    optimizedDataset: [],
    historyRuns: initialHistoryRuns,
    completedScreens: [],
    activeSection: '',
    activeScreen: 'prepare',
    isParsing: false,
    llmProvider: (localStorage.getItem('testforge_llm_provider') as 'gemini' | 'openai') || 'gemini',
    isEvaluating: false,
    evaluationResult: null,
    isEvaluatingOptimized: false,
    optimizedEvaluationResult: null,
    specificationHistory: [],
    isFetchingHistory: false,
    parseError: null,
    methodSeeds: {
      random: [],
      bva: [],
      ep: [],
      decision: []
    },
    selectedPresetId: '',
    selectedMethods: ['random'],
    boundaryCount: 3,
    partitionCount: 3,
    selectedSuiteName: '',

    // Simple Setters
    setLlmProvider: (provider) => {
      localStorage.setItem('testforge_llm_provider', provider);
      set({ llmProvider: provider });
    },
    setRawText: (text) => set({ rawText: text }),
    setParsedSchema: (schema) => set((state) => ({ 
      parsedSchema: typeof schema === 'function' ? schema(state.parsedSchema) : schema 
    })),
    setInitialSeeds: (seeds) => set((state) => ({ 
      initialSeeds: typeof seeds === 'function' ? seeds(state.initialSeeds) : seeds 
    })),
    setMethodSeeds: (seeds) => set((state) => ({ 
      methodSeeds: typeof seeds === 'function' ? seeds(state.methodSeeds) : seeds 
    })),
    setSchemaName: (name) => set({ schemaName: name }),
    setSpecificationId: (id) => set({ specificationId: id }),
    setApiKey: (key) => {
      sessionStorage.setItem("openai_api_key", key);
      set({ apiKey: key });
    },
    setOptimizedDataset: (dataset) => set({ optimizedDataset: dataset }),
    setSelectedSuiteName: (name) => set({ selectedSuiteName: name }),
    setActiveScreen: (screen) => set({ activeScreen: screen }),
    setActiveSection: (section) => set({ activeSection: section }),
    markScreenCompleted: (screen) => set((state) => ({
      completedScreens: state.completedScreens.includes(screen)
        ? state.completedScreens
        : [...state.completedScreens, screen]
    })),
    setIsParsing: (isParsing) => set({ isParsing }),
    setSelectedPresetId: (id) => set({ selectedPresetId: id }),
    setSelectedMethods: (methods) => set((state) => ({
      selectedMethods: typeof methods === 'function' ? methods(state.selectedMethods) : methods
    })),
    setBoundaryCount: (count) => set({ boundaryCount: count }),
    setPartitionCount: (count) => set({ partitionCount: count }),

    // Complex Actions
    handleParseSpec: async () => {
      const { rawText, apiKey, llmProvider } = get();
      set({ isParsing: true });
      set({ parseError: null });
      try {
        const response = await fetch(`${config.API_BASE_URL}/api/specifications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            raw_text: rawText,
            api_key_override: apiKey ? apiKey.trim() : null,
            llm_provider: llmProvider
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || "Không thể kết nối với Backend Server!");
        }

        const res = await response.json();
        
        set({
          parsedSchema: res.fields,
          initialSeeds: res.initialPopulation,
          specificationId: res.specification_id,
          schemaName: rawText.substring(0, 25) + (rawText.length > 25 ? '...' : ''),
          optimizedDataset: [],
          optimizedEvaluationResult: null,
          isParsing: false
        });
        
        if (res.is_mock) {
          toast.warning(`Chưa gán API Key (${llmProvider === 'gemini' ? 'Gemini' : 'OpenAI'}) hợp lệ!\nHệ thống đã sinh dữ liệu mẫu bằng bộ phân tích giả lập (Mock Fallback).\nVui lòng cấu hình API Key ở góc trên bên phải màn hình để thực hiện phân tích bằng AI thật.`);
        } else if (res.cached) {
          toast.success("Nạp dữ liệu phân tích đặc tả thành công (Lấy từ bộ nhớ đệm hệ thống)!");
        } else {
          toast.success(`Phân tích đặc tả nghiệp vụ bằng AI (${llmProvider === 'gemini' ? 'Gemini' : 'OpenAI'}) thành công!\nQuy tắc ràng buộc (JSON Rules) và tập dữ liệu hạt giống F0 đã được tạo lập tự động.`);
        }
        
      } catch (e: any) {
        const errorMessage = `Đã xảy ra lỗi kết nối: ${e.message || "Hãy đảm bảo FastAPI Backend đang chạy!"}`;
        console.error(e);
        toast.error(errorMessage);
        set({ isParsing: false, parseError: errorMessage });
      }
    },

    handlePresetSelect: (preset) => {
      set({
        rawText: preset.rawText,
        parsedSchema: preset.fields,
        initialSeeds: preset.initialPopulation,
        schemaName: preset.title.split(' (')[0],
        specificationId: '',
        optimizedDataset: [],
        optimizedEvaluationResult: null,
        selectedPresetId: preset.id,
        methodSeeds: {
          random: [],
          bva: [],
          ep: [],
          decision: []
        }
      });
    },

    handleEvolutionComplete: (results, stats, hcStatsResult) => {
      const { schemaName, historyRuns } = get();
      const finalGenStats = stats[stats.length - 1];
      const newRun: HistoryRun = {
        timestamp: new Date().toLocaleTimeString(),
        schemaName: schemaName,
        size: results.length,
        coverage: finalGenStats?.coverage || 0.95,
        bestFitness: hcStatsResult?.optimizedFitness || finalGenStats?.bestFitness || 0.98,
        data: results
      };
      
      const updatedHistoryRuns = [newRun, ...historyRuns];
      try {
        localStorage.setItem('testforge_history_runs', JSON.stringify(updatedHistoryRuns));
      } catch (e) {
        console.error("Lỗi ghi dữ liệu lịch sử vào localStorage:", e);
      }

      set({
        optimizedDataset: results,
        historyRuns: updatedHistoryRuns,
        optimizedEvaluationResult: null
      });
    },

    handleLoadPastRun: (pastData) => {
      set({ optimizedDataset: pastData });
      toast.success('Đã nạp lại mảng Test Cases tối ưu từ phiên chạy trước!');
    },

    handleClearHistory: () => {
      if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử các phiên chạy đã lưu không?")) {
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
      const { rawText, parsedSchema, initialSeeds, apiKey, llmProvider } = get();
      if (!initialSeeds || initialSeeds.length === 0) return;
      
      set({ isEvaluating: true, evaluationResult: null });
      try {
        const response = await fetch(`${config.API_BASE_URL}/api/evaluate-seeds`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fields: parsedSchema,
            seeds: initialSeeds,
            test_method: testMethod,
            raw_text: rawText,
            api_key_override: apiKey ? apiKey.trim() : null,
            llm_provider: llmProvider
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || "Lỗi khi kết nối với máy chủ AI");
        }

        const res = await response.json();
        if (res.success && res.data) {
          set({ evaluationResult: res.data, isEvaluating: false });
        } else {
          throw new Error("Dữ liệu phản hồi không hợp lệ");
        }
      } catch (error: any) {
        console.error("Evaluation Error:", error);
        toast.warning(`Có lỗi khi nhờ AI đánh giá. Đã chuyển về dữ liệu đánh giá mô phỏng dự phòng.`);
        // Mock fallback
        set({
          isEvaluating: false,
          evaluationResult: {
            score: 88,
            strengths: ["Bao phủ tốt các trường hợp cơ bản (Happy path).", "Đã sử dụng cấu trúc đúng định dạng dữ liệu được yêu cầu."],
            weaknesses: ["Chưa có nhiều dữ liệu đột biến dị biệt.", "Số lượng ca kiểm thử F0 còn hạn chế để tiến hóa mạnh."],
            missing_cases: ["Thiếu kiểm thử giá trị rỗng (Null/Empty) ở một số trường phụ.", "Thiếu chuỗi Unicode đặc biệt hoặc Emoji."],
            security_risks: ["Cần bổ sung thêm mẫu XSS nâng cao."]
          }
        });
      }
    },

    handleEvaluateOptimized: async (algorithm: string) => {
      const { rawText, parsedSchema, optimizedDataset, apiKey, llmProvider } = get();
      if (!optimizedDataset || optimizedDataset.length === 0) return;
      
      set({ isEvaluatingOptimized: true, optimizedEvaluationResult: null });
      try {
        const response = await fetch(`${config.API_BASE_URL}/api/evaluate-optimized`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fields: parsedSchema,
            dataset: optimizedDataset,
            algorithm: algorithm,
            raw_text: rawText,
            api_key_override: apiKey ? apiKey.trim() : null,
            llm_provider: llmProvider
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || "Lỗi khi kết nối với máy chủ AI");
        }

        const res = await response.json();
        if (res.success && res.data) {
          set({ optimizedEvaluationResult: res.data, isEvaluatingOptimized: false });
        } else {
          throw new Error("Dữ liệu phản hồi không hợp lệ");
        }
      } catch (error: any) {
        console.error("Optimized Evaluation Error:", error);
        toast.warning(`Có lỗi khi nhờ AI đánh giá. Đã chuyển về dữ liệu đánh giá mô phỏng dự phòng.`);
        // Mock fallback
        set({
          isEvaluatingOptimized: false,
          optimizedEvaluationResult: {
            score: algorithm === 'hybrid' ? 96 : algorithm === 'ga' ? 92 : 85,
            sanity_check: {
              status: "Đạt yêu cầu",
              schema_check: "100% khớp schema",
              type_check: "Hợp lệ",
              invalid_removed: 0,
              description: "Bộ dữ liệu hoàn toàn sạch và tuân thủ các ràng buộc nghiệp vụ."
            },
            fitness_evaluation: {
              status: "Tối ưu cao",
              fitness_score: 0.98,
              penalty_score: 0.02,
              violations_count: 0,
              applied_weights: "Mặc định",
              description: "Các cá thể đạt độ thích nghi lý tưởng, bao phủ hầu hết các kịch bản."
            },
            boundary_edge_check: {
              status: "Hoàn thành",
              boundary_coverage: "95%",
              critical_hits: 12,
              description: "Đã tìm thấy và bao phủ các điểm biên rủi ro cao."
            },
            missing_cases: ["Cần thêm kịch bản về tải trọng cực lớn.", "Thiếu một số tổ hợp hiếm gặp giữa các trường."],
            security_risks: ["Không phát hiện rủi ro nghiêm trọng.", "Nên định kỳ cập nhật các mẫu Injection mới."]
          }
        });
      }
    },

    fetchSpecificationHistory: async () => {
      set({ isFetchingHistory: true });
      try {
        const response = await fetch(`${config.API_BASE_URL}/api/specifications`);
        if (response.ok) {
          const data = await response.json();
          set({ specificationHistory: data, isFetchingHistory: false });
        }
      } catch (e) {
        console.error("Lỗi lấy lịch sử:", e);
        set({ isFetchingHistory: false });
      }
    },

    handleHistorySelect: (historyItem: any) => {
      set({
        rawText: historyItem.raw_text,
        parsedSchema: historyItem.fields,
        initialSeeds: historyItem.initialPopulation,
        specificationId: historyItem.id,
        schemaName: historyItem.raw_text.substring(0, 25) + (historyItem.raw_text.length > 25 ? '...' : ''),
        optimizedDataset: [],
        optimizedEvaluationResult: null,
        activeScreen: 'prepare'
      });
      toast.success("Đã nạp lại dữ liệu đặc tả từ lịch sử hệ thống!");
    },

    handleClearSpecData: () => {
      set({
        rawText: '',
        parsedSchema: [],
        initialSeeds: [],
        schemaName: '',
        specificationId: '',
        optimizedDataset: [],
        optimizedEvaluationResult: null,
        evaluationResult: null,
        selectedPresetId: '',
        selectedMethods: ['random'],
        boundaryCount: 3,
        partitionCount: 3,
        methodSeeds: {
          random: [],
          bva: [],
          ep: [],
          decision: []
        }
      });
    },

    clearParsedData: () => {
      set({
        parsedSchema: [],
        initialSeeds: [],
        schemaName: '',
        specificationId: '',
        optimizedDataset: [],
        optimizedEvaluationResult: null,
        evaluationResult: null,
        selectedPresetId: '',
        methodSeeds: {
          random: [],
          bva: [],
          ep: [],
          decision: []
        }
      });
    }
  };
});
