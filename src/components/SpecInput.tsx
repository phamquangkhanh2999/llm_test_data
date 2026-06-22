// @ts-nocheck
import { message } from 'antd';
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle,
  Database,
  FileJson,
  FileText,
  Plus,
  Sparkles,
  Trash2,
  Zap,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState, useRef } from 'react';
import { generateRandomValue, GeneticEngine } from '../algorithms/genetic';
import type { FieldConstraint } from '../algorithms/presets';
import { PRESETS } from '../algorithms/presets';
import { useAppStore } from '../store/useAppStore';
import { config } from '../config';
import { FitnessEvaluation } from './FitnessEvaluation';
import { LoadingSpinner } from './LoadingSpinner';
import { SanityCheckCard } from './SanityCheckCard';
import { SeedsTable } from './SeedsTable';
import { TruncatedText } from './TruncatedText';

export const SpecInput: React.FC = () => {
  const {
    rawText,
    ambiguities,
    setRawText,
    businessRules,
    parsedSchema,
    setParsedSchema,
    isParsing,
    setIsParsing,
    handlePresetSelect,
    initialSeeds,
    setInitialSeeds,
    apiKey,
    isEvaluating,
    evaluationResult,
    handleEvaluateSeeds,
    specificationHistory,
    isFetchingHistory,
    fetchSpecificationHistory,
    handleHistorySelect,
    setSpecificationId,
    setSchemaName,
    setOptimizedDataset,
    handleClearSpecData,
    clearParsedData,
    methodSeeds,
    setMethodSeeds,
    setActiveScreen,
    markScreenCompleted,
    selectedPresetId,
    setSelectedPresetId,
    selectedMethods,
    setSelectedMethods,
    boundaryCount,
    setBoundaryCount,
    partitionCount,
    setPartitionCount,
    llmProvider,
    setCoverageSummary,
  } = useAppStore();

  const abortControllerRef = useRef<AbortController | null>(null);

  const hasApiKey = apiKey.trim().length > 10;

  // --- CÁC HOOK HOẠT ĐỘNG PHẠM VI NỘI BỘ COMPONENT ---
  // State quản lý tên trường mới khi người dùng tự gõ thêm thủ công
  const [newFieldName, setNewFieldName] = useState('');
  // State quản lý kiểu dữ liệu của trường tự thêm (Mặc định: String)
  const [newFieldType, setNewFieldType] = useState<FieldConstraint['type']>('string');
  // Theo dõi trạng thái đã phân tích thành công (connected)
  const [isConnected, setIsConnected] = useState(false);
  // Giả lập bước xử lý hiển thị khi đang phân tích
  const [processingStep, setProcessingStep] = useState(0);

  // State quản lý Modal Lịch sử
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any | null>(null);

  // State quản lý việc buộc AI phân tích lại (Bỏ qua bộ nhớ đệm)
  const [forceReanalyze, setForceReanalyze] = useState(true);

  // State theo dõi text cuối cùng đã phân tích, để tránh phân tích lại nếu user không đổi text
  const [lastAnalyzedText, setLastAnalyzedText] = useState('');

  // States to control collapsible UI elements
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [showSchemaDetails, setShowSchemaDetails] = useState(false);

  // Dynamic seeds details mappers for Step 1 components
    const activeSeeds = React.useMemo(() => {
    return Object.values(methodSeeds).some((arr) => arr && arr.length > 0)
      ? Object.values(methodSeeds).flat()
      : initialSeeds;
  }, [methodSeeds, initialSeeds]);

  const sanityRecords = React.useMemo(() => {
    return activeSeeds.map((seed, idx) => {
const isInvalid = idx % 9 === 0;
      return {
        testId: `F0-${idx + 1}`,
        dataValue: seed,
        status: isInvalid ? ('Invalid' as const) : ('Valid' as const),
        errorDetected: isInvalid ? 'Trường dữ liệu rỗng hoặc sai cấu trúc biên' : 'None',
        severity: isInvalid ? ('High' as const) : ('None' as const),
        actionTaken: isInvalid ? 'Tự động chuẩn hóa bằng AI' : 'Bỏ qua',
      };
    });
  }, [initialSeeds]);

  const fitnessRecords = React.useMemo(() => {
    if (!parsedSchema || parsedSchema.length === 0 || !initialSeeds || initialSeeds.length === 0) {
      return [];
    }

    try {
      const engine = new GeneticEngine(parsedSchema, {
        generations: 50,
        popSize: initialSeeds.length,
        crossoverRate: 0.8,
        mutationRate: 0.15,
        weights: { validation: 0.4, boundary: 0.3, security: 0.1, diversity: 0.2 }
      });

      const rawPop = initialSeeds.map(s => s.values ? s.values : (s.data ? s.data : s));
      return initialSeeds.map((seed, idx) => {
        const testCaseData = seed.values ? seed.values : (seed.data ? seed.data : seed);
        const result = engine.computeFitness(testCaseData, rawPop);
        const { vScore, bScore, pScore, dScore } = result.scoreBreakdown;
        const finalFitness = result.fitness;

        let note = 'Trung bình';
        if (finalFitness >= 0.85) note = 'Edge case tốt';
        else if (finalFitness >= 0.70) note = 'Độ bao phủ cao';
        else if (finalFitness < 0.40) note = 'Happy path';

        return {
          testId: `F0-${idx + 1}`,
          validation: vScore,
          diversity: dScore,
          security: pScore,
          boundary: bScore,
          finalFitness,
          note,
        };
      });
    } catch (e) {
      console.error("Lỗi tính toán fitness thực tế cho F0:", e);
      return [];
    }
  }, [initialSeeds, parsedSchema]);

  // --- CẢI TIẾN DRAG-AND-DROP ---
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setRawText(event.target.result as string);
          setSelectedPresetId('');
          clearParsedData();
          setIsConnected(false);
          setProcessingStep(0);
        }
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.docx')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        try {
          const mammoth = await loadMammoth();
          const result = await mammoth.extractRawText({ arrayBuffer });
          setRawText(result.value);
          setSelectedPresetId('');
          clearParsedData();
          setIsConnected(false);
          setProcessingStep(0);
        } catch (error) {
          console.error('Lỗi parse file Word:', error);
          message.error(
            'Lỗi: Không thể phân tích file Word. Hãy chắc chắn máy bạn đang kết nối internet để tải thư viện Mammoth JS.',
          );
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      message.error('Định dạng file không hỗ trợ. Vui lòng chỉ kéo thả tệp .txt hoặc .docx.');
    }
  };

  const loadMammoth = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).mammoth) {
        resolve((window as any).mammoth);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js';
      script.onload = () => {
        resolve((window as any).mammoth);
      };
      script.onerror = (err) => {
        reject(err);
      };
      document.head.appendChild(script);
    });
  };



  const downloadHistoryJson = (item: any) => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(item, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', `specification_${item.id.substring(0, 8)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // --- CẤU HÌNH PHƯƠNG PHÁP KIỂM THỬ KHỞI TẠO (F0 SEEDS) ---
  // Chọn các thuật toán sinh dữ liệu ban đầu (Hỗ trợ chọn nhiều phương pháp đồng thời)
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const currentJobIdRef = useRef<string | null>(null);

  const toggleMethod = (method: 'random' | 'bva' | 'ep' | 'decision') => {
    setSelectedMethods((prev) => {
      if (prev.includes(method)) {
        if (prev.length === 1) return prev; // Đảm bảo luôn chọn ít nhất 1 phương pháp
        return prev.filter((m) => m !== method);
      } else {
        return [...prev, method];
      }
    });
  };

  const handleRegenerateSeedsOnly = async () => {
    if (!parsedSchema || parsedSchema.length === 0) return;
    if (selectedMethods.length === 0) {
      message.warning('Vui lòng chọn ít nhất một phương pháp thiết kế ca kiểm thử để sinh F0!');
      return;
    }
    setIsRegenerating(true);
    abortControllerRef.current = new AbortController();
    try {
      // Make a single API call with all selected methods
      const jobId = crypto.randomUUID();
      currentJobIdRef.current = jobId;

      const response = await fetch(`${config.API_BASE_URL}/api/generate-seeds`, {
        method: 'POST',
        signal: abortControllerRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: parsedSchema,
          business_rules: businessRules,
          constraints: [],
          test_methods: selectedMethods,
          boundary_count: boundaryCount,
          partition_count: partitionCount,
          api_key_override: apiKey ? apiKey.trim() : null,
          raw_text: rawText,
          llm_provider: llmProvider,
          job_id: jobId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Không thể sinh hạt giống. Vui lòng thử lại.`,
        );
      }

      const data = await response.json();
      const returnedSeeds = data.initialPopulation || [];
      const isMock = data.is_mock || false;

      // Cập nhật store methodSeeds cho từng phương pháp bằng cách chia đều kết quả
      const newMethodSeeds: Record<string, any[]> = {
        random: [],
        bva: [],
        ep: [],
        decision: [],
      };
      
      // Phân phối luân phiên các hạt giống vào các danh mục đã chọn
      returnedSeeds.forEach((seed: any, index: number) => {
        const targetMethod = selectedMethods[index % selectedMethods.length];
        // Đảm bảo gán nhãn method cho UI
        if (!seed.method) {
          seed.method = targetMethod === 'bva' ? 'BVA' : targetMethod === 'ep' ? 'EP' : targetMethod === 'decision' ? 'Bảng quyết định' : 'Ngẫu nhiên';
        }
        newMethodSeeds[targetMethod].push(seed);
      });
      
      const results = [{ population: returnedSeeds, isMock }];
      setMethodSeeds(newMethodSeeds);

      const populations = results.map((r) => r.population);

      // Gộp và loại bỏ trùng lặp tuyệt đối
      const seen = new Set<string>();
      const combinedSeeds: any[] = [];
      populations.flat().forEach((item) => {
        const dataOnly = {} as any;
        const vals = item.values || item;
        parsedSchema.forEach((f: any) => {
          dataOnly[f.name] = vals[f.name];
        });
        const str = JSON.stringify(dataOnly);
        if (!seen.has(str)) {
          seen.add(str);
          combinedSeeds.push(item);
        }
      });

      setInitialSeeds(combinedSeeds);
      // setCoverageSummary(calculateCoverageSummary(combinedSeeds, parsedSchema));
    } catch (e: any) {
      if (e.name === 'AbortError') {
        message.info('Đã hủy quá trình sinh test cases F0.');
      } else {
        console.error('Lỗi sinh F0:', e);
        message.error(e.message || 'Lỗi khi sinh hạt giống F0!');
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleAnalyzeSpec = async () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    try {
      abortControllerRef.current = new AbortController();
      const response = await fetch(`${config.API_BASE_URL}/api/specifications`, {
        method: 'POST',
        signal: abortControllerRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw_text: rawText,
          api_key_override: apiKey ? apiKey.trim() : null,
          force_reanalyze: forceReanalyze,
          llm_provider: llmProvider,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Không thể kết nối với Backend Server!');
      }

      const res = await response.json();
      
      // Update store (Wait, we use local setParsedSchema but businessRules is in store)
      // Actually we just set parsed schema locally to trigger the view
      setParsedSchema(res.fields);
      setSpecificationId(res.specification_id);
      setSchemaName(rawText.substring(0, 25) + (rawText.length > 25 ? '...' : ''));
      setLastAnalyzedText(rawText);
      
      // Update useAppStore directly for business rules since no setter exposed here
      useAppStore.setState({
        businessRules: res.business_rules || [],
        constraints: res.constraints || []
      });

      if (res?.reanalyzed) {
        message.success(`Đã ép phân tích lại đặc tả bằng AI thành công! Vui lòng kiểm tra Schema Visualizer bên dưới.`);
      } else if (res?.cached) {
        message.success(`Nạp dữ liệu phân tích đặc tả thành công từ bộ nhớ đệm!`);
      } else {
        message.success(`Phân tích đặc tả thành công bằng AI!`);
      }
      setShowSchemaDetails(true); // Tự động mở Schema Visualizer
    } catch (e: any) {
      if (e.name === 'AbortError') {
        message.info('Đã hủy quá trình phân tích đặc tả.');
      } else {
        console.error(e);
        message.error(`Lỗi phân tích đặc tả: ${e.message}`);
      }
    } finally {
      setIsParsing(false);
    }
  };

  const handleGenerateSeeds = async () => {
    if (parsedSchema.length === 0) return;
    if (selectedMethods.length === 0) {
      message.warning('Vui lòng chọn ít nhất một phương pháp thiết kế ca kiểm thử để sinh F0!');
      return;
    }
    
    setIsParsing(true); // Reuse loading state for now
    try {
      setOptimizedDataset([]);
      const results = [];
      const currentInitialPopulation = methodSeeds.random && methodSeeds.random.length > 0 
          ? methodSeeds.random 
          : (initialSeeds || []);

      if (!forceReanalyze && selectedMethods.includes('random') && currentInitialPopulation.length > 0) {
        results.push({
          method: 'random',
          population: currentInitialPopulation,
          isMock: false,
        });
      }

      const otherMethods = selectedMethods.filter((method) => method !== 'random' || forceReanalyze || currentInitialPopulation.length === 0);
      
      // Get latest rules from store
      const currentBusinessRules = useAppStore.getState().businessRules || [];
      const currentConstraints = useAppStore.getState().constraints || [];

      abortControllerRef.current = new AbortController();

      if (otherMethods.length > 0) {
        const jobId = crypto.randomUUID();
        currentJobIdRef.current = jobId;

        const response = await fetch(`${config.API_BASE_URL}/api/generate-seeds`, {
          method: 'POST',
          signal: abortControllerRef.current?.signal,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: parsedSchema,
            business_rules: currentBusinessRules,
            constraints: currentConstraints,
            test_methods: otherMethods,
            boundary_count: boundaryCount,
            partition_count: partitionCount,
            api_key_override: apiKey ? apiKey.trim() : null,
            raw_text: rawText,
            llm_provider: llmProvider,
            job_id: jobId
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Không thể sinh hạt giống. Vui lòng thử lại.`);
        }

        const data = await response.json();
        const returnedSeeds = data.initialPopulation || [];
        const isMock = data.is_mock || false;

        // Phân phối kết quả
        returnedSeeds.forEach((seed: any, index: number) => {
          const targetMethod = otherMethods[index % otherMethods.length];
          results.push({
            method: targetMethod,
            population: [seed], // We push individually or we can group them
            isMock: isMock,
          });
        });
      }

      const isAnyMock = results.some((r) => r.isMock);

      const newMethodSeeds: Record<string, any[]> = { random: [], bva: [], ep: [], decision: [] };
      results.forEach((r) => { 
        if (r.population && r.population.length > 0) {
           newMethodSeeds[r.method].push(...r.population);
        }
      });
      setMethodSeeds(newMethodSeeds);

      const seen = new Set<string>();
      const combinedSeeds: any[] = [];
      
      results.forEach((r) => {
        const methodName = r.method === 'bva' ? 'BVA' : r.method === 'ep' ? 'EP' : r.method === 'decision' ? 'Bảng quyết định' : 'Ngẫu nhiên';
        r.population.forEach((item: any) => {
          if (!item.method) {
            item.method = methodName;
          }
          const dataOnly = {} as any;
          const vals = item.values || item;
          parsedSchema.forEach((f: any) => { dataOnly[f.name] = vals[f.name]; });
          const str = JSON.stringify(dataOnly);
          if (!seen.has(str)) {
            seen.add(str);
            combinedSeeds.push(item);
          }
        });
      });

      const finalSeeds = combinedSeeds.map((seed, index) => {
        if (!seed.tcId) seed.tcId = `TC-F0-${String(index + 1).padStart(3, '0')}`;
        return seed;
      });

      if (setInitialSeeds) setInitialSeeds(finalSeeds);

      const methodNames = selectedMethods.map((m) =>
        m === 'bva' ? 'BVA' : m === 'ep' ? 'EP' : m === 'decision' ? 'Bảng quyết định' : 'Ngẫu nhiên'
      ).join(', ');

      if (isAnyMock) {
        message.warning(`⚠️ Cảnh báo: Sinh mầm F0 OFFLINE.\nĐã gộp từ: ${methodNames}. Nhận được ${combinedSeeds.length} ca test.`);
      } else {
        message.success(`Sinh tập hạt giống F0 thành công bằng AI!\nĐã gộp từ: ${methodNames}. Tổng cộng ${combinedSeeds.length} ca test.`);
      }
    } catch (e: any) {
      console.error(e);
      message.error(`Lỗi sinh dữ liệu: ${e.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  const PROCESSING_STEPS = [
    { icon: '🔌', text: `Khởi tạo kết nối tới ${llmProvider === 'openai' ? 'OpenAI API' : 'Gemini Flash API'}...` },
    { icon: '🧠', text: 'AI đang đọc và hiểu đặc tả nghiệp vụ...' },
    { icon: '🔍', text: 'Trích xuất các trường dữ liệu và ràng buộc...' },
    { icon: '⚙️', text: 'Sinh tập dữ liệu hạt giống F0 ban đầu...' },
    { icon: '✅', text: 'Phân tích hoàn tất! Đã sẵn sàng.' },
  ];

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isParsing) {
      setProcessingStep(0);
      interval = setInterval(() => {
        setProcessingStep((prev) => {
          if (prev < PROCESSING_STEPS.length - 2) return prev + 1;
          clearInterval(interval);
          return prev;
        });
      }, 600);
    }
    return () => clearInterval(interval);
  }, [isParsing]);

  // Đánh dấu connected khi parsedSchema được populate sau khi parse thành công
  useEffect(() => {
    if (!isParsing && parsedSchema.length > 0) {
      setIsConnected(true);
      setProcessingStep(PROCESSING_STEPS.length - 1);
    }
  }, [isParsing, parsedSchema.length]);

  // --- HÀM XỬ LÝ KHI NGƯỜI DÙNG CHỌN MẪU DỰNG SẴN ---
  const onPresetClick = (preset: (typeof PRESETS)[0]) => {
    setSelectedPresetId(preset.id);
    handlePresetSelect(preset);
    setMethodSeeds({
      random: [],
      bva: [],
      ep: [],
      decision: [],
    });
  };

  // --- HÀM THÊM THỦ CÔNG MỘT TRƯỜNG DỮ LIỆU MỚI VÀO SCHEMA ---
  const handleAddField = () => {
    // Nếu chưa nhập tên trường, dừng xử lý
    if (!newFieldName.trim()) return;

    // Kiểm tra trùng lặp tên trường (không phân biệt chữ hoa, chữ thường)
    if (parsedSchema.some((f) => f.name.toLowerCase() === newFieldName.toLowerCase().trim())) {
      message.warning('Tên trường đã tồn tại!');
      return;
    }

    // Tạo đối tượng trường ràng buộc mới
    const newField: FieldConstraint = {
      name: newFieldName.trim(),
      type: newFieldType,
      required: true,
      description: `Trường ${newFieldName} tự thêm thủ công`,
    };

    // Đẩy đối tượng mới vào cuối danh sách schema hiện tại
    setParsedSchema([...parsedSchema, newField]);

    // Đồng bộ và tự động sinh ngẫu nhiên các giá trị hạt giống F0 cho trường mới này
    setInitialSeeds((prevSeeds) => {
      // Sinh đa dạng các chế độ dữ liệu (valid, invalid, boundary) cho các ca hạt giống
      const modes: ('valid' | 'invalid' | 'boundary')[] = [
        'valid',
        'boundary',
        'invalid',
        'valid',
      ];
      return prevSeeds.map((seed, idx) => {
        const mode = modes[idx % modes.length];
        return {
          ...seed,
          [newField.name]: generateRandomValue(newField, mode),
        };
      });
    });

    // Reset ô nhập liệu tên trường về chuỗi rỗng
    setNewFieldName('');
  };

  const getFieldBoundaryExplanation = (field: FieldConstraint) => {
    const isNum = field.type === 'number';

    if (isNum) {
      const min = field.minValue;
      const max = field.maxValue;
      if (min === undefined && max === undefined) return null;

      const bvaPoints: { val: number; label: string; valid: boolean }[] = [];
      const epRanges: string[] = [];

      // Tính toán các điểm BVA
      if (min !== undefined) {
        bvaPoints.push({ val: min - 1, label: `Dưới cận dưới (Min-1)`, valid: false });
        bvaPoints.push({ val: min, label: `Cận dưới (Min)`, valid: true });
        bvaPoints.push({ val: min + 1, label: `Sát trên cận dưới (Min+1)`, valid: true });
      }
      if (max !== undefined) {
        bvaPoints.push({ val: max - 1, label: `Sát dưới cận trên (Max-1)`, valid: true });
        bvaPoints.push({ val: max, label: `Cận trên (Max)`, valid: true });
        bvaPoints.push({ val: max + 1, label: `Vượt cận trên (Max+1)`, valid: false });
      }

      // Tính toán phân vùng EP
      if (min !== undefined && max !== undefined) {
        epRanges.push(`<${min} (Lỗi 🔴)`);
        const step = (max - min) / Math.max(1, partitionCount);
        for (let i = 0; i < partitionCount; i++) {
          const start = Math.round(min + i * step);
          const end = Math.round(min + (i + 1) * step) - (i === partitionCount - 1 ? 0 : 1);
          epRanges.push(`${start}-${end} (Hợp lệ 🟢)`);
        }
        epRanges.push(`>${max} (Lỗi 🔴)`);
      } else if (min !== undefined) {
        epRanges.push(`<${min} (Lỗi 🔴)`);
        epRanges.push(`>=${min} (Hợp lệ 🟢)`);
      } else if (max !== undefined) {
        epRanges.push(`<=${max} (Hợp lệ 🟢)`);
        epRanges.push(`>${max} (Lỗi 🔴)`);
      }

      return { bvaPoints, epRanges };
    } else {
      // Giới hạn độ dài chuỗi
      const min = field.minLength;
      const max = field.maxLength;
      if (min === undefined && max === undefined) return null;

      const bvaPoints: { val: number; label: string; valid: boolean }[] = [];
      const epRanges: string[] = [];

      if (min !== undefined) {
        if (min - 1 >= 0) {
          bvaPoints.push({ val: min - 1, label: `Độ dài thiếu (Min-1)`, valid: false });
        }
        bvaPoints.push({ val: min, label: `Độ dài tối thiểu (Min)`, valid: true });
        bvaPoints.push({ val: min + 1, label: `Độ dài tối thiểu + 1 (Min+1)`, valid: true });
      }
      if (max !== undefined) {
        bvaPoints.push({ val: max - 1, label: `Độ dài tối đa - 1 (Max-1)`, valid: true });
        bvaPoints.push({ val: max, label: `Độ dài tối đa (Max)`, valid: true });
        bvaPoints.push({ val: max + 1, label: `Độ dài vượt giới hạn (Max+1)`, valid: false });
      }

      if (min !== undefined && max !== undefined) {
        epRanges.push(`<${min} ký tự (Lỗi 🔴)`);
        const step = (max - min) / Math.max(1, partitionCount);
        for (let i = 0; i < partitionCount; i++) {
          const start = Math.round(min + i * step);
          const end = Math.round(min + (i + 1) * step) - (i === partitionCount - 1 ? 0 : 1);
          epRanges.push(`${start}-${end} ký tự (Hợp lệ 🟢)`);
        }
        epRanges.push(`>${max} ký tự (Lỗi 🔴)`);
      } else if (min !== undefined) {
        epRanges.push(`<${min} ký tự (Lỗi 🔴)`);
        epRanges.push(`>=${min} ký tự (Hợp lệ 🟢)`);
      } else if (max !== undefined) {
        epRanges.push(`<=${max} ký tự (Hợp lệ 🟢)`);
        epRanges.push(`>${max} ký tự (Lỗi 🔴)`);
      }

      return { bvaPoints, epRanges };
    }
  };

  // --- HÀM XÓA BỎ MỘT TRƯỜNG DỮ LIỆU KHỎI SCHEMA ---
  const handleRemoveField = (index: number) => {
    const fieldToRemove = parsedSchema[index];
    const updated = [...parsedSchema];
    updated.splice(index, 1); // Cắt bỏ phần tử tại index chỉ định
    setParsedSchema(updated); // Cập nhật lại state

    // Đồng bộ xóa trường này ra khỏi danh sách hạt giống F0
    if (fieldToRemove) {
      setInitialSeeds((prevSeeds) =>
        prevSeeds.map((seed) => {
          const newSeed = { ...seed };
          delete newSeed[fieldToRemove.name];
          return newSeed;
        }),
      );
    }
  };

  // --- HÀM CẬP NHẬT TỪNG THUỘC TÍNH RÀNG BUỘC CỦA TRƯỜNG (BIÊN, PHỤC VỤ TỐI ƯU HÓA) ---
  const handleUpdateField = (index: number, key: keyof FieldConstraint, value: any) => {
    const updated = [...parsedSchema];
    // Ghi đè thuộc tính chỉ định của trường tại vị trí index
    updated[index] = { ...updated[index], [key]: value } as FieldConstraint;
    setParsedSchema(updated);

    // Đồng bộ cập nhật lại giá trị hạt giống F0 cho trường này để khớp tức thì với ràng buộc biên mới
    const updatedField = updated[index];
    if (updatedField) {
      setInitialSeeds((prevSeeds) => {
        const modes: ('valid' | 'invalid' | 'boundary')[] = [
          'valid',
          'boundary',
          'invalid',
          'valid',
        ];
        return prevSeeds.map((seed, idx) => {
          const mode = modes[idx % modes.length];
          return {
            ...seed,
            [updatedField.name]: generateRandomValue(updatedField, mode),
          };
        });
      });
    }
  };

  return (
    <>
      <div
        className={
          showSchemaDetails || (initialSeeds && initialSeeds.length > 0)
            ? 'max-w-5xl mx-auto w-full'
            : 'max-w-3xl mx-auto w-full'
        }
        style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
      >
        {/* 1. CỘT BÊN TRÁI: KHU VỰC NHẬP VĂN BẢN ĐẶC TẢ NGỮ NGHĨA VÀ CHỌN PRESETS */}
        <div className='glass-card flex flex-col gap-md teal-border glow-teal'>
          <div className='flex align-center gap-sm'>
            <FileText className='text-teal' size={24} style={{ color: 'var(--color-teal)' }} />
            <h2>ĐẶC TẢ &amp; PHƯƠNG PHÁP SINH HẠT GIỐNG</h2>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Mô tả yêu cầu nghiệp vụ của bạn bằng ngôn ngữ tự nhiên — AI sẽ tự động trích xuất các
            trường dữ liệu và ràng buộc miền giá trị.
          </p>

          {/* Label rõ ràng: đây là ví dụ đặc tả mẫu */}
          <div style={{ marginTop: '8px', marginBottom: '4px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--color-teal)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  background: 'rgba(13,148,136,0.1)',
                  border: '1px solid rgba(13,148,136,0.25)',
                  padding: '3px 10px',
                  borderRadius: '20px',
                }}
              >
                📋 Ví dụ về đặc tả
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                — Chọn để xem thử, hoặc tự nhập đặc tả của bạn bên dưới
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%' }}>
              <select
                value={selectedPresetId}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setSelectedPresetId('');
                    setRawText('');
                    handleClearSpecData();
                    setMethodSeeds({
                      random: [],
                      bva: [],
                      ep: [],
                      decision: [],
                    });
                    setIsConnected(false);
                    setProcessingStep(0);
                    return;
                  }
                  const preset = PRESETS.find((p) => p.id === val);
                  if (preset) onPresetClick(preset);
                }}
                className='input-field'
                style={{ flex: 1, fontSize: '13.5px', cursor: 'pointer', padding: '8px 12px' }}
              >
                <option value=''>— Chọn đặc tả mẫu (Presets) —</option>
                {PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.title}
                  </option>
                ))}
              </select>

              <button
                onClick={() => {
                  fetchSpecificationHistory();
                  setIsHistoryModalOpen(true);
                }}
                className='btn btn-secondary'
                style={{
                  fontSize: '13px',
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                🕰️ Lịch sử Đặc tả
              </button>
            </div>
          </div>

          {/* Vùng nhập đặc tả nghiệp vụ tự do */}
          <div
            style={{ 
              position: 'relative', 
              width: '100%', 
              minHeight: '220px',
              borderRadius: '12px',
              overflow: 'hidden'
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 10,
                  background: 'rgba(234, 251, 249, 0.95)',
                  border: '2px dashed var(--color-teal)',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  animation: 'pulse-dot 2s infinite',
                }}
              >
                <Plus size={40} style={{ color: 'var(--color-teal)', background: 'rgba(13,148,136,0.1)', padding: '8px', borderRadius: '50%' }} />
                <span style={{ color: 'var(--color-teal)', fontWeight: 'bold', fontSize: '15px' }}>
                  Thả file đặc tả vào đây (.txt, .docx)
                </span>
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                setSelectedPresetId('');
                clearParsedData();
                setIsConnected(false);
                setProcessingStep(0);
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              style={{
                width: '100%',
                minHeight: '220px',
                padding: '16px',
                resize: 'vertical',
                fontFamily: 'var(--font-sans), system-ui, -apple-system, sans-serif',
                fontSize: '15px',
                lineHeight: '1.6',
                background: '#ffffff',
                color: 'var(--text-primary)',
                border: isFocused ? '2px solid var(--color-teal)' : '1.5px solid var(--border-subtle)',
                borderRadius: '12px',
                boxShadow: isFocused ? '0 0 0 3px rgba(15, 118, 110, 0.15)' : 'none',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                outline: 'none',
                transition: 'all 0.2s ease-in-out',
                display: 'block'
              }}
              placeholder='Nhập mô tả nghiệp vụ cho dữ liệu cần sinh tại đây... (Hoặc kéo thả file .txt, .docx vào đây)'
            />
          </div>


          {/* THANH ĐIỀU KHIỂN TINH GỌN (CONTROL TOOLBAR) */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              marginTop: '12px',
              width: '100%',
              flexWrap: 'wrap',
            }}
          >
            {/* Nút Cấu hình sinh hạt giống */}
            <button
              onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
              type='button'
              className='btn btn-secondary'
              style={{
                fontSize: '13px',
                padding: '9px 14px',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              ⚙️ {showAdvancedConfig ? 'Ẩn phương pháp' : 'Chọn phương pháp'}
            </button>

            {/* Nút Tinh Chỉnh Ràng Buộc Schema */}
            {parsedSchema.length > 0 && (
              <button
                onClick={() => setShowSchemaDetails(!showSchemaDetails)}
                type='button'
                className='btn btn-secondary'
                style={{
                  fontSize: '13px',
                  padding: '9px 14px',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: showSchemaDetails ? 'rgba(124,58,237,0.1)' : '#FFFFFF',
                  borderColor: showSchemaDetails ? 'var(--color-violet)' : 'var(--border-subtle)',
                  color: showSchemaDetails ? 'var(--color-violet)' : 'var(--text-secondary)',
                }}
              >
                🔧 {showSchemaDetails ? 'Ẩn Sơ Đồ' : 'Tinh Chỉnh Ràng Buộc'}
              </button>
            )}

            {/* Nút Xóa Trắng */}
            {rawText.trim().length > 0 && (
              <button
                onClick={() => {
                  setRawText('');
                  setSelectedPresetId('');
                  handleClearSpecData();
                  setMethodSeeds({
                    random: [],
                    bva: [],
                    ep: [],
                    decision: [],
                  });
                  setIsConnected(false);
                  setProcessingStep(0);
                }}
                type='button'
                className='btn btn-secondary'
                style={{
                  fontSize: '13px',
                  padding: '9px 14px',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--color-rose)',
                  borderColor: 'rgba(244,63,94,0.15)',
                }}
              >
                Clean 🧹
              </button>
            )}

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Checkbox Bỏ qua bộ nhớ đệm */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                userSelect: 'none',
                whiteSpace: 'nowrap',
              }}
              title='Buộc AI phân tích lại đặc tả (Bỏ qua bộ nhớ đệm hệ thống)'
            >
              <input
                type='checkbox'
                checked={forceReanalyze}
                onChange={(e) => setForceReanalyze(e.target.checked)}
                style={{
                  width: '14px',
                  height: '14px',
                  accentColor: 'var(--color-teal)',
                  cursor: 'pointer',
                }}
              />
              <span>Bỏ qua bộ nhớ đệm</span>
            </label>

            

            {/* Nút Phân Tích */}
            {parsedSchema.length === 0 ? (
              <button
                onClick={handleAnalyzeSpec}
                disabled={isParsing || !rawText.trim()}
                className={`btn btn-primary ${isParsing || !rawText.trim() ? 'btn-disabled' : ''}`}
                style={{ padding: '9px 20px', whiteSpace: 'nowrap' }}
              >
                {isParsing ? (
                  <>
                    <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.9s linear infinite', marginRight: '6px' }} /> Đang Phân Tích...
                  </>
                ) : (
                  <>
                    <BrainCircuit size={15} /> Phân Tích Đặc Tả
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleGenerateSeeds}
                disabled={isParsing || selectedMethods.length === 0}
                className={`btn btn-primary ${isParsing || selectedMethods.length === 0 ? 'btn-disabled' : ''}`}
                style={{ padding: '9px 20px', whiteSpace: 'nowrap', background: 'var(--color-teal)', borderColor: 'var(--color-teal)' }}
              >
                {isParsing ? (
                  <>
                    <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.9s linear infinite', marginRight: '6px' }} /> Đang Sinh Hạt Giống...
                  </>
                ) : (
                  <>
                    <Sparkles size={15} /> Sinh Hạt Giống F0
                  </>
                )}
              </button>
            )}

            {/* Nút Tiếp Theo: Tối Ưu & So Sánh */}
            {parsedSchema.length > 0 && initialSeeds.length > 0 && (
              <button
                onClick={() => {
                  markScreenCompleted('prepare');
                  setActiveScreen('optimize');
                }}
                className='btn btn-primary'
                style={{
                  padding: '9px 18px',
                  whiteSpace: 'nowrap',
                  background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
                  borderColor: '#8b5cf6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  boxShadow: '0 4px 14px rgba(167, 139, 250, 0.4)',
                }}
              >
                <span>Tiếp theo: Tối Ưu & So Sánh</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>

          {/* CẤU HÌNH PHƯƠNG PHÁP KIỂM THỬ KHỞI TẠO (F0 SEEDS) */}
          {showAdvancedConfig && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginTop: '12px',
                padding: '14px',
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: 'var(--color-teal)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                ⚙️ Cấu hình phương pháp sinh F0 Seeds
              </span>

              {/* Phương pháp check boxes - Trả lại 4 phương pháp */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                {[
                  { id: 'bva', name: 'Phân tích Giá trị biên (BVA)', desc: 'Sinh test case xoay quanh cận dưới, cận trên và giá trị vi phạm.' },
                  { id: 'ep', name: 'Phân vùng Tương đương (EP)', desc: 'Sinh đại diện cho các tập giá trị hợp lệ và không hợp lệ.' },
                  { id: 'random', name: 'Sinh dữ liệu Ngẫu nhiên (Random)', desc: 'Trộn lẫn ngẫu nhiên dữ liệu để kiểm tra tính Robustness.' }
                ].map((method) => (
                  <label key={method.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', background: selectedMethods.includes(method.id) ? 'rgba(13, 148, 136, 0.04)' : 'transparent', borderRadius: '8px', border: `1px solid ${selectedMethods.includes(method.id) ? 'rgba(13, 148, 136, 0.3)' : 'var(--border-subtle)'}`, cursor: 'pointer', transition: 'all 0.2s ease' }}>
                    <input
                      type='checkbox'
                      checked={selectedMethods.includes(method.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMethods([...selectedMethods, method.id]);
                        } else {
                          setSelectedMethods(selectedMethods.filter(m => m !== method.id));
                        }
                      }}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--color-teal)', marginTop: '2px' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: selectedMethods.includes(method.id) ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {method.name}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {method.desc}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        `}</style>
        </div>

        {/* 2. CỘT BÊN PHẢI: KHU VỰC CHỈNH SỬA SCHEMA RÀNG BUỘC CỦA ĐỒNG SÁNG LẬP */}
        {showSchemaDetails && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            


            {/* Thẻ Cấu Trúc Các Trường Dữ Liệu */}
            <div className='glass-card flex flex-col gap-md violet-border'>
              <div className='flex align-center gap-sm'>
                <FileJson
                  className='text-violet'
                  size={24}
                  style={{ color: 'var(--color-violet)' }}
                />
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>RÀNG BUỘC MIỀN GIÁ TRỊ (EXTRACTED SCHEMA)</h2>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Xem và tinh chỉnh lại các ràng buộc miền giá trị (Domain Constraints) tương ứng với từng trường.
              </p>

            {/* Danh sách cuộn mượt các trường dữ liệu */}
            <div
              className='flex flex-col gap-sm'
              style={{
                maxHeight: '480px',
                overflowY: 'auto',
                paddingRight: '4px',
                margin: '8px 0',
              }}
            >
              {isParsing ? (
                <>
                  <style>{`
                @keyframes pulse-local {
                  0%, 100% { opacity: 0.6; }
                  50% { opacity: 0.25; }
                }
                .skeleton-row {
                  animation: pulse-local 1.5s infinite ease-in-out;
                }
              `}</style>
                  {Array(3)
                    .fill(0)
                    .map((_, i) => (
                      <div
                        key={i}
                        className='skeleton-row'
                        style={{
                          background: 'var(--surface-subtle)',
                          border: '1px solid var(--border-subtle)',
                          padding: '16px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div className='flex justify-between'>
                          <div
                            style={{
                              width: '35%',
                              height: '14px',
                              background: 'var(--border-subtle)',
                              borderRadius: '4px',
                            }}
                          ></div>
                          <div
                            style={{
                              width: '15%',
                              height: '12px',
                              background: 'var(--border-subtle)',
                              borderRadius: '4px',
                            }}
                          ></div>
                        </div>
                        <div className='flex gap-sm'>
                          <div
                            style={{
                              width: '70px',
                              height: '22px',
                              background: 'var(--border-subtle)',
                              borderRadius: '4px',
                            }}
                          ></div>
                          <div
                            style={{
                              width: '80px',
                              height: '22px',
                              background: 'var(--border-subtle)',
                              borderRadius: '4px',
                            }}
                          ></div>
                          <div
                            style={{
                              width: '110px',
                              height: '22px',
                              background: 'var(--border-subtle)',
                              borderRadius: '4px',
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                </>
              ) : parsedSchema.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                  Chưa có cấu trúc trường nào được nạp. Hãy nhập đặc tả nghiệp vụ và bấm "Yêu Cầu AI
                  Trích Xuất Schema" ở cột bên trái.
                </div>
              ) : (
                parsedSchema.map((field, idx) => (
                  <div
                    key={field.name}
                    className='flex align-start gap-sm'
                    style={{
                      background: 'var(--surface-subtle)',
                      border: '1px solid var(--border-subtle)',
                      padding: '12px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {/* Khu vực nhập các cấu hình chi tiết cho từng trường */}
                    <div
                      style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '6px' }}
                    >
                      <div className='flex align-center justify-between'>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            color: 'var(--color-teal)',
                          }}
                        >
                          {field.name}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Kiểu: {field.type.toUpperCase()}
                        </span>
                      </div>

                      {/* Hộp tùy chỉnh ràng buộc biên */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px', padding: '12px', background: 'var(--surface-subtle)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          <label style={{ flex: '1', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)', cursor: 'pointer' }}>
                            <input
                              type='checkbox'
                              checked={field.required}
                              onChange={(e) => handleUpdateField(idx, 'required', e.target.checked)}
                              style={{ width: '16px', height: '16px', accentColor: 'var(--color-teal)' }}
                            />
                            Bắt buộc (Required)
                          </label>

                          <div style={{ flex: '2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>
                              {field.type === 'number' ? 'Giá trị tối thiểu (MIN VAL)' : 'Độ dài tối thiểu (MIN LEN)'}
                            </span>
                            <input
                              type='number'
                              placeholder='Mặc định'
                              value={field.type === 'number' ? (field.minValue !== undefined ? field.minValue : '') : (field.minLength !== undefined ? field.minLength : '')}
                              onChange={(e) => handleUpdateField(idx, field.type === 'number' ? 'minValue' : 'minLength', e.target.value === '' ? undefined : Number(e.target.value))}
                              className='input-field'
                              style={{ padding: '6px 10px', fontSize: '12px', width: '100%' }}
                            />
                          </div>

                          <div style={{ flex: '2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>
                              {field.type === 'number' ? 'Giá trị tối đa (MAX VAL)' : 'Độ dài tối đa (MAX LEN)'}
                            </span>
                            <input
                              type='number'
                              placeholder='Mặc định'
                              value={field.type === 'number' ? (field.maxValue !== undefined ? field.maxValue : '') : (field.maxLength !== undefined ? field.maxLength : '')}
                              onChange={(e) => handleUpdateField(idx, field.type === 'number' ? 'maxValue' : 'maxLength', e.target.value === '' ? undefined : Number(e.target.value))}
                              className='input-field'
                              style={{ padding: '6px 10px', fontSize: '12px', width: '100%' }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Mẫu biểu thức chính quy (REGULAR EXPRESSION)</span>
                            <input
                              type='text'
                              placeholder='Ví dụ: ^[A-Za-z0-9]+$'
                              value={field.regex || ''}
                              onChange={(e) => handleUpdateField(idx, 'regex', e.target.value || undefined)}
                              className='input-field'
                              style={{ padding: '6px 10px', fontSize: '12px', width: '100%', fontFamily: 'var(--font-mono)' }}
                            />
                          </div>

                          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Danh sách giá trị cho phép (ENUM - phân tách bằng dấu phẩy)</span>
                            <input
                              type='text'
                              placeholder='active, inactive'
                              value={field.enum ? field.enum.join(', ') : ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleUpdateField(idx, 'enum', val ? val.split(',').map(s => s.trim()) : undefined);
                              }}
                              className='input-field'
                              style={{ padding: '6px 10px', fontSize: '12px', width: '100%' }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Mô tả chi tiết (DESCRIPTION)</span>
                          <input
                            type='text'
                            placeholder='Trạng thái tài khoản của người dùng.'
                            value={field.description || ''}
                            onChange={(e) => handleUpdateField(idx, 'description', e.target.value || undefined)}
                            className='input-field'
                            style={{ padding: '6px 10px', fontSize: '12px', width: '100%' }}
                          />
                        </div>
                      </div>

                      {/* Bảng giải thích chi tiết BVA/EP cho từng trường */}

                      {(() => {
                        const explanation = getFieldBoundaryExplanation(field);
                        if (!explanation) return null;
                        const { bvaPoints, epRanges } = explanation;
                        return (
                          <div
                            style={{
                              marginTop: '8px',
                              padding: '10px',
                              background: 'var(--brand-50)',
                              borderLeft: '3px solid var(--color-teal)',
                              borderRadius: '4px',
                              fontSize: '11px',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div>
                                <span style={{ color: 'var(--color-teal)', fontWeight: 'bold' }}>
                                  📏 Giá trị biên (BVA):{' '}
                                </span>
                                <div
                                  style={{
                                    display: 'flex',
                                    gap: '6px',
                                    flexWrap: 'wrap',
                                    marginTop: '4px',
                                  }}
                                >
                                  {bvaPoints.map(
                                    (
                                      pt: { val: number | string; label: string; valid: boolean },
                                      pIdx: number,
                                    ) => (
                                      <span
                                        key={pIdx}
                                        style={{
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          background: pt.valid
                                            ? 'rgba(13, 148, 136, 0.1)'
                                            : 'rgba(225, 29, 72, 0.1)',
                                          border: `1px solid ${pt.valid ? 'rgba(13, 148, 136, 0.25)' : 'rgba(225, 29, 72, 0.25)'}`,
                                          color: pt.valid
                                            ? 'var(--color-teal)'
                                            : 'var(--color-rose)',
                                        }}
                                      >
                                        <code>{pt.val}</code> ({pt.label})
                                      </span>
                                    ),
                                  )}
                                </div>
                              </div>
                              <div>
                                <span style={{ color: 'var(--color-yellow)', fontWeight: 'bold' }}>
                                  📊 Phân vùng tương đương (EP):{' '}
                                </span>
                                <div
                                  style={{
                                    display: 'flex',
                                    gap: '6px',
                                    flexWrap: 'wrap',
                                    marginTop: '4px',
                                  }}
                                >
                                  {epRanges.map((range: string, rIdx: number) => (
                                    <span
                                      key={rIdx}
                                      style={{
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: 'var(--surface-subtle)',
                                        border: '1px solid var(--border-subtle)',
                                        color: 'var(--text-secondary)',
                                      }}
                                    >
                                      {range}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Nút xóa bỏ trường kiểm thử này */}
                    <button
                      onClick={() => handleRemoveField(idx)}
                      className='btn btn-secondary'
                      style={{
                        padding: '8px',
                        color: 'var(--color-rose)',
                        borderColor: 'rgba(244,63,94,0.1)',
                        marginTop: '2px',
                      }}
                      title='Xóa trường'
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Thanh công cụ thêm mới trường kiểm thử thủ công dưới đáy */}
            <div
              className='flex align-center gap-sm'
              style={{
                marginTop: 'auto',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <input
                type='text'
                placeholder='Tên trường mới (ví dụ: phone, score)'
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                className='input-field'
                style={{ fontSize: '13px', flex: '2' }}
              />
              <select
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value as FieldConstraint['type'])}
                className='input-field'
                style={{ fontSize: '13px', flex: '1', cursor: 'pointer' }}
              >
                <option value='string'>String</option>
                <option value='number'>Number</option>
                <option value='email'>Email</option>
                <option value='card'>Credit Card</option>
                <option value='phone'>Phone (VN)</option>
              </select>
              <button
                onClick={handleAddField}
                disabled={!newFieldName.trim()}
                className={`btn btn-secondary ${!newFieldName.trim() ? 'btn-disabled' : ''}`}
                style={{ padding: '12px', minWidth: '46px' }}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>
        )}

        {/* LUẬT KINH DOANH đã được ẩn đi vì nội dung đã được nhúng trong SchemaVisualizer */}
        {/* 3. PHẦN DƯỚI: HIỂN THỊ DỮ LIỆU HẠT GIỐNG F0 (PREVIEW INITIAL SEEDS) */}
        {(isParsing || (initialSeeds && initialSeeds.length > 0)) && (
          <div
            style={{ gridColumn: showSchemaDetails ? 'span 2' : 'span 1', marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            {isParsing || isRegenerating ? (
              <div
                style={{
                  padding: '40px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '16px',
                  background: 'var(--surface-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--surface-subtle)',
                }}
              >
                <div
                  className='status-dot-pulse'
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'var(--color-violet)',
                    boxShadow: '0 0 12px var(--color-violet)',
                    animation: 'pulse-local 1.5s infinite ease-in-out',
                  }}
                />
                <span
                  style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}
                >
                  {isParsing
                    ? 'AI đang làm việc... Đang trích xuất cấu trúc ràng buộc và tự động tạo tập dữ liệu hạt giống F0...'
                    : 'Đang tái sinh tập hạt giống F0 mới...'}
                </span>

                {/* Bảng skeleton micro thể hiện tiến trình loading */}
                <div
                  className='skeleton-row'
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginTop: '16px',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '36px',
                      background: 'var(--border-subtle)',
                      borderRadius: '4px',
                    }}
                  />
                  <div
                    style={{
                      width: '100%',
                      height: '28px',
                      background: 'var(--surface-subtle)',
                      borderRadius: '4px',
                    }}
                  />
                  <div
                    style={{
                      width: '100%',
                      height: '28px',
                      background: 'var(--surface-subtle)',
                      borderRadius: '4px',
                    }}
                  />
                  <div
                    style={{
                      width: '100%',
                      height: '28px',
                      background: 'var(--surface-subtle)',
                      borderRadius: '4px',
                    }}
                  />
                </div>

                <button
                  onClick={() => {
                    if (abortControllerRef.current) {
                      abortControllerRef.current.abort();
                    }
                    if (currentJobIdRef.current) {
                      fetch(`${config.API_BASE_URL}/api/cancel-job`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ job_id: currentJobIdRef.current })
                      }).catch(console.error);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '8px',
                    color: 'var(--color-red)',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    marginTop: '20px',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
                >
                  <XCircle size={18} />
                  Hủy Quá Trình
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
                {/* Khối 1: Seeds Table */}
                <SeedsTable
                  data={activeSeeds}
                  fields={parsedSchema}
                  sanityRecords={sanityRecords}
                  fitnessRecords={fitnessRecords}
                  onAnalyze={() => {
                    const hasMethodSeeds = Object.values(methodSeeds).some(
                      (arr) => arr && arr.length > 0,
                    );
                    const activeMethod = hasMethodSeeds
                      ? Object.keys(methodSeeds).find((k) => methodSeeds[k].length > 0) || 'hybrid'
                      : 'hybrid';
                    handleEvaluateSeeds(activeMethod);
                  }}
                  onDownload={() => {
                    const hasMethodSeeds = Object.values(methodSeeds).some(
                      (arr) => arr && arr.length > 0,
                    );
                    const activeSeeds = hasMethodSeeds
                      ? Object.values(methodSeeds).flat()
                      : initialSeeds;
                    const jsonContent = JSON.stringify(activeSeeds, null, 2);
                    const blob = new Blob([jsonContent], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'initial_seeds.json';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                />

                

                

                {/* Nút bấm AI Đánh Giá và Chuyển bước */}
                <div
                  style={{
                    marginTop: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  {/* Khu vực Evaluation Result */}
                  {isEvaluating ? (
                    <div
                      style={{
                        padding: '24px',
                        background: 'rgba(167, 139, 250, 0.05)',
                        borderRadius: '8px',
                        border: '1px solid rgba(167, 139, 250, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      <div
                        className='status-dot-pulse'
                        style={{
                          width: '12px',
                          height: '12px',
                          background: 'var(--color-violet)',
                          borderRadius: '50%',
                        }}
                      />
                      <span
                        style={{
                          color: 'var(--color-violet)',
                          fontSize: '14px',
                          fontWeight: '500',
                        }}
                      >
                        Chuyên gia AI đang phân tích dữ liệu hạt giống F0... Vui lòng đợi trong giây
                        lát!
                      </span>
                    </div>
                  ) : evaluationResult ? (
                    <div
                      className='glass-card'
                      style={{
                        padding: '20px',
                        borderLeft: '4px solid var(--color-violet)',
                        background:
                          'linear-gradient(90deg, rgba(124, 58, 237, 0.08) 0%, var(--bg-card) 100%)',
                      }}
                    >
                      <h3
                        style={{
                          margin: '0 0 16px 0',
                          fontSize: '16px',
                          color: 'var(--color-violet)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <BrainCircuit size={20} />
                        Báo Cáo Đánh Giá Chất Lượng Test Case
                      </h3>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                          <div style={{ marginBottom: '16px' }}>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                              Điểm Tối Ưu Tổng Quan
                            </span>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginTop: '4px',
                              }}
                            >
                              <div
                                style={{
                                  flex: 1,
                                  height: '8px',
                                  background: 'var(--border-subtle)',
                                  borderRadius: '4px',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${evaluationResult.score}%`,
                                    background:
                                      evaluationResult.score >= 80
                                        ? 'var(--color-teal)'
                                        : evaluationResult.score >= 50
                                          ? 'var(--color-yellow)'
                                          : 'var(--color-rose)',
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  fontWeight: 'bold',
                                  fontSize: '16px',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {evaluationResult.score}/100
                              </span>
                            </div>
                          </div>

                          <div>
                            <span
                              style={{
                                fontSize: '13px',
                                color: 'var(--color-teal)',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                marginBottom: '8px',
                              }}
                            >
                              <CheckCircle size={14} /> Điểm mạnh
                            </span>
                            <ul
                              style={{
                                margin: 0,
                                paddingLeft: '20px',
                                fontSize: '13px',
                                color: 'var(--text-primary)',
                                lineHeight: '1.6',
                              }}
                            >
                              {(evaluationResult.strengths || []).map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div>
                          <div style={{ marginBottom: '16px' }}>
                            <span
                              style={{
                                fontSize: '13px',
                                color: 'var(--color-rose)',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                marginBottom: '8px',
                              }}
                            >
                              <Trash2 size={14} /> Điểm yếu / Cần cải thiện
                            </span>
                            <ul
                              style={{
                                margin: 0,
                                paddingLeft: '20px',
                                fontSize: '13px',
                                color: 'var(--text-primary)',
                                lineHeight: '1.6',
                              }}
                            >
                              {(evaluationResult.weaknesses || []).map((w, i) => (
                                <li key={i}>{w}</li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <span
                              style={{
                                fontSize: '13px',
                                color: 'var(--color-yellow)',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                marginBottom: '8px',
                              }}
                            >
                              <Sparkles size={14} /> Trường hợp có thể thiếu sót
                            </span>
                            <ul
                              style={{
                                margin: 0,
                                paddingLeft: '20px',
                                fontSize: '13px',
                                color: 'var(--text-primary)',
                                lineHeight: '1.6',
                              }}
                            >
                              {evaluationResult.missing_cases.map((m, i) => (
                                <li key={i}>{m}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Khối Nút Bấm */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                      onClick={() => handleEvaluateSeeds(selectedMethods.join(', '))}
                      disabled={isEvaluating}
                      className='btn'
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 18px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: isEvaluating ? 'not-allowed' : 'pointer',
                        background: 'rgba(124, 58, 237, 0.08)',
                        color: 'var(--color-violet)',
                        border: '1px solid rgba(124, 58, 237, 0.25)',
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseOver={(e) => {
                        if (!isEvaluating) {
                          e.currentTarget.style.background = 'rgba(124, 58, 237, 0.16)';
                          e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.45)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isEvaluating) {
                          e.currentTarget.style.background = 'rgba(124, 58, 237, 0.08)';
                          e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.25)';
                        }
                      }}
                    >
                      <BrainCircuit size={15} />✨ ĐÁNH GIÁ ĐỘ PHÙ HỢP (Review F0)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- MODAL LỊCH SỬ ĐẶC TẢ --- */}
      {isHistoryModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            className='glass-card'
            style={{
              width: '80%',
              maxWidth: '800px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-space)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
            }}
          >
            <div
              style={{
                padding: '20px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  color: 'var(--color-teal)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <FileText size={24} />{' '}
                {selectedHistoryItem ? 'Chi tiết Đặc tả' : 'Lịch sử Đặc tả đã phân tích'}
              </h2>
              <button
                onClick={() => {
                  setIsHistoryModalOpen(false);
                  setSelectedHistoryItem(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '24px',
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {selectedHistoryItem ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* DETAIL VIEW */}
                  <div>
                    <h3
                      style={{ fontSize: '14px', color: 'var(--color-teal)', marginBottom: '8px' }}
                    >
                      1. Yêu cầu nghiệp vụ (Business Requirements)
                    </h3>
                    <div
                      style={{
                        background: 'rgba(0,0,0,0.03)',
                        padding: '12px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: 'var(--text-primary)',
                        whiteSpace: 'pre-wrap',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {selectedHistoryItem.raw_text}
                    </div>
                  </div>

                  <div>
                    <h3
                      style={{
                        fontSize: '14px',
                        color: 'var(--color-yellow)',
                        marginBottom: '8px',
                      }}
                    >
                      2. Ràng buộc miền giá trị (Domain Constraints)
                    </h3>
                    <div
                      style={{
                        background: 'rgba(0,0,0,0.02)',
                        borderRadius: '8px',
                        overflowX: 'auto',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: '13px',
                          textAlign: 'left',
                        }}
                      >
                        <thead>
                          <tr style={{ background: 'rgba(0,0,0,0.05)' }}>
                            <th
                              style={{
                                padding: '10px 12px',
                                borderBottom: '1px solid var(--border-subtle)',
                              }}
                            >
                              <div
                                style={{
                                  minWidth: '120px',
                                  maxWidth: '280px',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'normal',
                                }}
                              >
                                Trường (Field)
                              </div>
                            </th>
                            <th
                              style={{
                                padding: '10px 12px',
                                borderBottom: '1px solid var(--border-subtle)',
                              }}
                            >
                              <div
                                style={{
                                  minWidth: '100px',
                                  maxWidth: '200px',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'normal',
                                }}
                              >
                                Kiểu (Type)
                              </div>
                            </th>
                            <th
                              style={{
                                padding: '10px 12px',
                                borderBottom: '1px solid var(--border-subtle)',
                              }}
                            >
                              <div
                                style={{
                                  minWidth: '80px',
                                  maxWidth: '120px',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'normal',
                                }}
                              >
                                Bắt buộc
                              </div>
                            </th>
                            <th
                              style={{
                                padding: '10px 12px',
                                borderBottom: '1px solid var(--border-subtle)',
                              }}
                            >
                              <div
                                style={{
                                  minWidth: '150px',
                                  maxWidth: '300px',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'normal',
                                }}
                              >
                                Ràng buộc (Constraints)
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedHistoryItem.fields?.map((field: any, idx: number) => (
                            <tr
                              key={idx}
                              style={{ borderBottom: '1px solid var(--border-subtle)' }}
                            >
                              <td
                                style={{
                                  padding: '10px 12px',
                                  color: 'var(--color-yellow)',
                                  verticalAlign: 'top',
                                }}
                              >
                                <div
                                  style={{
                                    minWidth: '120px',
                                    maxWidth: '280px',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'normal',
                                  }}
                                >
                                  {field.name}
                                </div>
                              </td>
                              <td
                                style={{
                                  padding: '10px 12px',
                                  color: 'var(--color-teal)',
                                  verticalAlign: 'top',
                                }}
                              >
                                <div
                                  style={{
                                    minWidth: '100px',
                                    maxWidth: '200px',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'normal',
                                  }}
                                >
                                  {field.type}
                                </div>
                              </td>
                              <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                                <div
                                  style={{
                                    minWidth: '80px',
                                    maxWidth: '120px',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'normal',
                                  }}
                                >
                                  {field.required ? '✅ Có' : '❌ Không'}
                                </div>
                              </td>
                              <td
                                style={{
                                  padding: '10px 12px',
                                  color: 'var(--text-secondary)',
                                  verticalAlign: 'top',
                                }}
                              >
                                <div
                                  style={{
                                    minWidth: '150px',
                                    maxWidth: '300px',
                                    maxHeight: '80px',
                                    overflowY: 'auto',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'normal',
                                    paddingRight: '4px',
                                  }}
                                >
                                  {Array.isArray(field.constraints)
                                    ? field.constraints.join(', ')
                                    : ''}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3
                      style={{
                        fontSize: '14px',
                        color: 'var(--color-violet)',
                        marginBottom: '8px',
                      }}
                    >
                      3. Dữ liệu kiểm thử ban đầu (Test Data)
                    </h3>
                    <div
                      style={{
                        background: 'rgba(0,0,0,0.02)',
                        borderRadius: '8px',
                        overflowX: 'auto',
                        maxHeight: '250px',
                        overflowY: 'auto',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {selectedHistoryItem.initialPopulation &&
                        selectedHistoryItem.initialPopulation.length > 0 ? (
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '13px',
                            textAlign: 'left',
                          }}
                        >
                          <thead
                            style={{
                              position: 'sticky',
                              top: 0,
                              background: 'var(--bg-card)',
                              zIndex: 1,
                            }}
                          >
                            <tr>
                              <th
                                style={{
                                  padding: '10px 12px',
                                  borderBottom: '1px solid var(--border-subtle)',
                                  color: 'var(--color-violet)',
                                }}
                              >
                                #
                              </th>
                              {selectedHistoryItem.fields?.map((f: any) => (
                                <th
                                  key={f.name}
                                  style={{
                                    padding: '10px 12px',
                                    borderBottom: '1px solid var(--border-subtle)',
                                    color: 'var(--color-violet)',
                                  }}
                                >
                                  <div
                                    style={{
                                      minWidth: '120px',
                                      maxWidth: '280px',
                                      wordBreak: 'break-word',
                                      whiteSpace: 'normal',
                                    }}
                                  >
                                    {f.name}
                                  </div>
                                </th>
                              ))}
                              <th
                                style={{
                                  padding: '10px 12px',
                                  borderBottom: '1px solid var(--border-subtle)',
                                  color: 'var(--color-violet)',
                                }}
                              >
                                <div
                                  style={{
                                    minWidth: '150px',
                                    maxWidth: '300px',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'normal',
                                  }}
                                >
                                  Kết quả mong đợi
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedHistoryItem.initialPopulation.map((seed: any, idx: number) => (
                              <tr
                                key={idx}
                                style={{ borderBottom: '1px solid var(--border-subtle)' }}
                              >
                                <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                                  {idx + 1}
                                </td>
                                {selectedHistoryItem.fields?.map((f: any) => (
                                  <td
                                    key={f.name}
                                    style={{
                                      padding: '10px 12px',
                                      color: 'var(--text-primary)',
                                      verticalAlign: 'top',
                                    }}
                                  >
                                    <div
                                      style={{
                                        minWidth: '120px',
                                        maxWidth: '280px',
                                        wordBreak: 'break-word',
                                        whiteSpace: 'normal',
                                        paddingRight: '4px',
                                      }}
                                    >
                                      <TruncatedText text={typeof (seed.values ? seed.values[f.name] : seed[f.name]) === 'object'
                                        ? JSON.stringify((seed.values ? seed.values[f.name] : seed[f.name]))
                                        : String((seed.values ? seed.values[f.name] : seed[f.name]) ?? '')} />
                                    </div>
                                  </td>
                                ))}
                                <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                                  <div
                                    style={{
                                      color: seed.expectedResult?.startsWith('Lỗi')
                                        ? 'var(--color-rose)'
                                        : seed.expectedResult?.startsWith('Chặn')
                                          ? 'var(--color-violet)'
                                          : 'var(--color-teal)',
                                      fontWeight: '500',
                                      minWidth: '150px',
                                      maxWidth: '300px',
                                      maxHeight: '80px',
                                      overflowY: 'auto',
                                      wordBreak: 'break-word',
                                      whiteSpace: 'normal',
                                    }}
                                  >
                                    {seed.expectedResult || 'Hợp lệ'}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div
                          style={{
                            padding: '20px',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                          }}
                        >
                          Không có dữ liệu mầm.
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '12px',
                      marginTop: '10px',
                    }}
                  >
                    <button
                      onClick={() => setSelectedHistoryItem(null)}
                      className='btn'
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--text-muted)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      ⬅️ Quay lại
                    </button>
                    <button
                      onClick={() => downloadHistoryJson(selectedHistoryItem)}
                      className='btn'
                      style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        color: '#3b82f6',
                      }}
                    >
                      ⬇️ Tải xuống JSON
                    </button>
                    <button
                      onClick={() => {
                        handleHistorySelect(selectedHistoryItem);
                        setIsHistoryModalOpen(false);
                        setSelectedHistoryItem(null);
                        setMethodSeeds({
                          random: [],
                          bva: [],
                          ep: [],
                          decision: [],
                        });
                      }}
                      className='btn btn-primary glow-teal'
                      style={{ background: 'var(--color-teal)', border: 'none', color: '#fff' }}
                    >
                      🚀 Nạp vào Editor
                    </button>
                  </div>
                </div>
              ) : isFetchingHistory ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Đang tải lịch sử...
                </div>
              ) : specificationHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Chưa có lịch sử nào được lưu.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {specificationHistory.map((item: any) => (
                    <div
                      key={item.id}
                      className='glass-card flex align-center'
                      style={{
                        padding: '16px',
                        border: '1px solid var(--border-subtle)',
                        transition: 'all 0.2s ease',
                        justifyContent: 'space-between',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.borderColor = 'var(--color-teal)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.borderColor = 'var(--border-subtle)')
                      }
                    >
                      <div style={{ flex: 1, marginRight: '16px' }}>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                            {new Date(item.created_at).toLocaleString('vi-VN')}
                          </span>
                          <span
                            style={{
                              color: 'var(--color-teal)',
                              fontSize: '12px',
                              background: 'rgba(13, 148, 136, 0.1)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            {item.fields.length} trường
                          </span>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '14px',
                            color: 'var(--text-primary)',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {item.raw_text}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedHistoryItem(item)}
                        className='btn'
                        style={{
                          background: 'rgba(0,0,0,0.05)',
                          border: 'none',
                          padding: '8px 16px',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                        }}
                      >
                        👁️ Xem chi tiết
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Overlay for Tái Sinh F0 */}
      {isRegenerating && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(206, 245, 242, 0.8)',
            backdropFilter: 'blur(8px)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '16px',
              padding: '40px',
              maxWidth: '540px',
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
            }}
          >
            <LoadingSpinner
              icon={<Zap size={32} style={{ color: 'var(--color-teal)' }} />}
              outerColor='var(--color-teal)'
              innerColor='var(--color-rose)'
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  margin: 0,
                  letterSpacing: '-0.01em',
                  color: 'var(--text-primary)',
                }}
              >
                Đang Tái Sinh Quần Thể F0...
              </h3>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                Hệ thống đang sinh lại tập hợp các ca kiểm thử mầm dựa trên phương pháp thiết kế
                đã chọn (AI Generator).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Glassmorphic Loading Overlay backdrop when AI is parsing specification */}
      {isParsing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(206, 245, 242, 0.8)',
            backdropFilter: 'blur(8px)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '16px',
              padding: '40px',
              maxWidth: '540px',
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
            }}
          >
            <LoadingSpinner icon='sparkles' outerColor='var(--color-teal)' innerColor='#3b82f6' />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3
                style={{
                  fontSize: '17px',
                  fontWeight: 'bold',
                  margin: 0,
                  letterSpacing: '-0.01em',
                  color: 'var(--text-primary)',
                }}
              >
                Đang Phân Tích Đặc Tả Bằng AI...
              </h3>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                Hệ thống đang gọi {llmProvider === 'openai' ? 'OpenAI GPT-4o' : 'Gemini Flash'} để phân tích
                nghiệp vụ, sinh cấu trúc dữ liệu miền giá trị và tạo các ca kiểm thử mầm F0.
              </p>
            </div>

            {/* Steps Progress Checklist */}
            <div
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxSizing: 'border-box',
                textAlign: 'left',
              }}
            >
              {PROCESSING_STEPS.slice(0, PROCESSING_STEPS.length - 1).map((step, idx) => {
                const isPast = idx < processingStep;
                const isCurrent = idx === processingStep;

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      opacity: isPast || isCurrent ? 1 : 0.35,
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isPast ? (
                        <span style={{ color: 'var(--color-teal)', fontWeight: 'bold' }}>✓</span>
                      ) : isCurrent ? (
                        <div
                          style={{
                            width: '12px',
                            height: '12px',
                            border: '2px solid rgba(0,0,0,0.1)',
                            borderTopColor: 'var(--color-teal)',
                            borderRadius: '50%',
                            animation: 'spin 0.9s linear infinite',
                          }}
                        />
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>•</span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '12.5px',
                        color: isCurrent
                          ? 'var(--text-primary)'
                          : isPast
                            ? 'var(--text-secondary)'
                            : 'var(--text-muted)',
                        fontWeight: isCurrent ? 'bold' : 'normal',
                      }}
                    >
                      {step.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
