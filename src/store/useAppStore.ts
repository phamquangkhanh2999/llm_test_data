import { create } from 'zustand';
import { PRESETS } from '../algorithms/presets';
import type { PresetSpec, FieldConstraint } from '../algorithms/presets';
import type { Chromosome, PopulationStats } from '../algorithms/genetic';
import type { HillClimbStats } from '../algorithms/hillClimbing';

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
  initialSeeds: Chromosome[];
  schemaName: string;
  specificationId: string;
  apiKey: string;
  optimizedDataset: Chromosome[];
  historyRuns: HistoryRun[];
  showGuide: boolean;
  completedScreens: string[];
  activeSection: string;
  activeScreen: string;
  isParsing: boolean;
  isEvaluating: boolean;
  evaluationResult: EvaluationResult | null;
  specificationHistory: any[];
  isFetchingHistory: boolean;

  // Actions
  setRawText: (text: string) => void;
  setParsedSchema: (schema: FieldConstraint[] | ((prev: FieldConstraint[]) => FieldConstraint[])) => void;
  setInitialSeeds: (seeds: Chromosome[] | ((prev: Chromosome[]) => Chromosome[])) => void;
  setSchemaName: (name: string) => void;
  setSpecificationId: (id: string) => void;
  setApiKey: (key: string) => void;
  setOptimizedDataset: (dataset: Chromosome[]) => void;
  setShowGuide: (show: boolean) => void;
  setActiveSection: (section: string) => void;
  markScreenCompleted: (screen: string) => void;
  setActiveScreen: (screen: string) => void;
  setIsParsing: (isParsing: boolean) => void;

  // Complex Actions
  handleParseSpec: () => Promise<void>;
  handlePresetSelect: (preset: PresetSpec) => void;
  handleEvolutionComplete: (results: Chromosome[], stats: PopulationStats[], hcStatsResult?: HillClimbStats) => void;
  handleLoadPastRun: (pastData: Chromosome[]) => void;
  handleClearHistory: () => void;
  handleEvaluateSeeds: (testMethod: string) => Promise<void>;
  fetchSpecificationHistory: () => Promise<void>;
  handleHistorySelect: (historyItem: any) => void;
  handleSwitchScreen: (screen: string) => void;
}

const defaultPreset = PRESETS[0];

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
    rawText: defaultPreset.rawText,
    parsedSchema: defaultPreset.fields,
    initialSeeds: defaultPreset.initialPopulation,
    schemaName: defaultPreset.title.split(' (')[0],
    specificationId: '',
    apiKey: initialApiKey,
    optimizedDataset: [],
    historyRuns: initialHistoryRuns,
    showGuide: true,
    completedScreens: [],
    activeSection: '',
    activeScreen: 'dashboard',
    isParsing: false,
    isEvaluating: false,
    evaluationResult: null,
    specificationHistory: [],
    isFetchingHistory: false,

    // Simple Setters
    setRawText: (text) => set({ rawText: text }),
    setParsedSchema: (schema) => set((state) => ({ 
      parsedSchema: typeof schema === 'function' ? schema(state.parsedSchema) : schema 
    })),
    setInitialSeeds: (seeds) => set((state) => ({ 
      initialSeeds: typeof seeds === 'function' ? seeds(state.initialSeeds) : seeds 
    })),
    setSchemaName: (name) => set({ schemaName: name }),
    setSpecificationId: (id) => set({ specificationId: id }),
    setApiKey: (key) => {
      sessionStorage.setItem("openai_api_key", key);
      set({ apiKey: key });
    },
    setOptimizedDataset: (dataset) => set({ optimizedDataset: dataset }),
    setShowGuide: (show) => set({ showGuide: show }),
    setActiveScreen: (screen) => set({ activeScreen: screen }),
    setActiveSection: (section) => set({ activeSection: section }),
    markScreenCompleted: (screen) => set((state) => ({
      completedScreens: state.completedScreens.includes(screen)
        ? state.completedScreens
        : [...state.completedScreens, screen]
    })),
    setIsParsing: (isParsing) => set({ isParsing }),

    // Complex Actions
    handleParseSpec: async () => {
      const { rawText, apiKey } = get();
      set({ isParsing: true });
      try {
        const response = await fetch("http://localhost:8000/api/specifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            raw_text: rawText,
            api_key_override: apiKey ? apiKey.trim() : null
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
          isParsing: false
        });
        
        alert("Phân tích đặc tả nghiệp vụ bằng AI thành công!\n\nQuy tắc ràng buộc (JSON Rules) và tập dữ liệu hạt giống F0 đã được tạo lập tự động ở phía dưới.\nBạn có thể tự do thêm bớt trường hoặc tinh chỉnh các giá trị Max/Min, Regex ngay tại đây, sau đó bấm nút 'Tiếp tục' ở cuối trang để tiến hành bước tối ưu hóa bộ test!");
        
      } catch (e: any) {
        console.error(e);
        alert(`Đã xảy ra lỗi kết nối: ${e.message || "Hãy đảm bảo FastAPI Backend đang chạy ở cổng 8000!"}`);
        set({ isParsing: false });
      }
    },

    handlePresetSelect: (preset) => {
      set({
        rawText: preset.rawText,
        parsedSchema: preset.fields,
        initialSeeds: preset.initialPopulation,
        schemaName: preset.title.split(' (')[0],
        specificationId: '',
        optimizedDataset: []
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
        historyRuns: updatedHistoryRuns
      });
    },

    handleLoadPastRun: (pastData) => {
      set({ optimizedDataset: pastData });
      alert('Đã nạp lại mảng Test Cases tối ưu từ phiên chạy trước!');
    },

    handleClearHistory: () => {
      if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử các phiên chạy đã lưu không?")) {
        set({ historyRuns: [] });
        localStorage.removeItem('testforge_history_runs');
      }
    },

    handleSwitchScreen: (screen) => {
      set({ activeScreen: screen });
    },

    handleEvaluateSeeds: async (testMethod: string) => {
      const { rawText, parsedSchema, initialSeeds, apiKey } = get();
      if (!initialSeeds || initialSeeds.length === 0) return;
      
      set({ isEvaluating: true, evaluationResult: null });
      try {
        const response = await fetch("http://localhost:8000/api/evaluate-seeds", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fields: parsedSchema,
            seeds: initialSeeds,
            test_method: testMethod,
            raw_text: rawText,
            api_key_override: apiKey ? apiKey.trim() : null
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
        alert(`Có lỗi xảy ra trong quá trình nhờ AI đánh giá: ${error.message}. Đã chuyển về dữ liệu đánh giá mô phỏng dự phòng.`);
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

    fetchSpecificationHistory: async () => {
      set({ isFetchingHistory: true });
      try {
        const response = await fetch("http://localhost:8000/api/specifications");
        if (response.ok) {
          const data = await response.json();
          set({ specificationHistory: data });
        }
      } catch (error) {
        console.error("Lỗi khi tải lịch sử đặc tả:", error);
      } finally {
        set({ isFetchingHistory: false });
      }
    },

    handleHistorySelect: (historyItem) => {
      set({
        rawText: historyItem.raw_text,
        parsedSchema: historyItem.fields,
        initialSeeds: historyItem.initialPopulation,
        schemaName: historyItem.raw_text.substring(0, 25) + (historyItem.raw_text.length > 25 ? '...' : ''),
        specificationId: historyItem.id,
        optimizedDataset: []
      });
      alert("Đã nạp thành công đặc tả từ lịch sử!");
    }
  };
});
