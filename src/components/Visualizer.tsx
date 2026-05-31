import React, { useState, useEffect, useRef } from 'react';
import type { FieldConstraint } from '../algorithms/presets';
import { GeneticEngine } from '../algorithms/genetic';
import type { PopulationStats, Chromosome, GeneticConfig } from '../algorithms/genetic';
import { runHillClimbing } from '../algorithms/hillClimbing';
import type { HillClimbStats } from '../algorithms/hillClimbing';
import { Play, Pause, RotateCcw, SkipForward, Cpu, CheckCircle, TrendingUp, AlertTriangle, Sparkles } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppStore } from '../store/useAppStore';

export const Visualizer: React.FC = () => {
  const {
    parsedSchema: schema,
    initialSeeds,
    handleEvolutionComplete: onEvolutionComplete,
    specificationId
  } = useAppStore();

  // --- CẤU HÌNH BỘ TỐI ƯU HÓA DỮ LIỆU TEST (GA CONFIG) ---
  const [generations, setGenerations] = useState(60);
  const [popSize, setPopSize] = useState(100);
  const [crossoverRate, setCrossoverRate] = useState(0.8);
  const [mutationRate, setMutationRate] = useState(0.15);
  
  // --- TRỌNG SỐ ĐÁNH GIÁ CHẤT LƯỢNG TEST CASE (WEIGHTS) ---
  const [wVal, setWVal] = useState(0.5);
  const [wBound, setWBound] = useState(0.2);
  const [wSec, setWSec] = useState(0.2);
  const [wDiv, setWDiv] = useState(0.1);

  // --- CHẾ ĐỘ KIỂM THỬ THÂN THIỆN CHO QA/TESTER PRESSETS ---
  const [qaMode, setQaMode] = useState<'happy' | 'boundary' | 'security' | 'hybrid'>('hybrid');
  
  const handleApplyQAMode = (mode: 'happy' | 'boundary' | 'security' | 'hybrid') => {
    setQaMode(mode);
    if (mode === 'happy') {
      setGenerations(30);
      setPopSize(80);
      setWVal(0.8);
      setWBound(0.0);
      setWSec(0.0);
      setWDiv(0.2);
    } else if (mode === 'boundary') {
      setGenerations(60);
      setPopSize(100);
      setWVal(0.3);
      setWBound(0.5);
      setWSec(0.1);
      setWDiv(0.1);
    } else if (mode === 'security') {
      setGenerations(60);
      setPopSize(100);
      setWVal(0.2);
      setWBound(0.1);
      setWSec(0.6);
      setWDiv(0.1);
    } else if (mode === 'hybrid') {
      setGenerations(60);
      setPopSize(100);
      setWVal(0.5);
      setWBound(0.2);
      setWSec(0.2);
      setWDiv(0.1);
    }
  };

  // --- TRẠNG THÁI VẬN HÀNH BỘ CHẠY (EXECUTION STATES) ---
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [currentGen, setCurrentGen] = useState(0);
  const [speedDelay, setSpeedDelay] = useState(60); // Mili-giây trễ để chạy hoạt ảnh mượt mà 60 FPS
  const [activeTab, setActiveTab] = useState<'visualizer' | 'log'>('visualizer');

  // --- LỊCH SỬ TIẾN TRÌNH & BẢN GHI TEST ĐANG XEM XÉT ---
  const [history, setHistory] = useState<PopulationStats[]>([]);
  const [selectedTestCase, setSelectedTestCase] = useState<{ values: Chromosome; fitness: number; origin: string } | null>(null);
  
  // --- TRẠNG THÁI CỦA BỘ TINH CHỈNH BIÊN CỤC BỘ (HILL CLIMBING STATES) ---
  const [hcActive, setHcActive] = useState(false);
  const [hcStats, setHcStats] = useState<HillClimbStats | null>(null);

  // --- HOẠT ẢNH NHẤP NHÁY Ô LƯỚI TƯƠNG TÁC (GRID ANIMATIONS) ---
  const [mutatedCells, setMutatedCells] = useState<Record<number, boolean>>({});
  const [crossoverCells, setCrossoverCells] = useState<Record<number, boolean>>({});

  // Các con trỏ Refs dùng để quản lý luồng chạy bất đồng bộ (Playback)
  const engineRef = useRef<GeneticEngine | null>(null);
  const timerRef = useRef<any | null>(null);
  const historyRef = useRef<PopulationStats[]>([]);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  // Reset trạng thái về ban đầu khi đổi Schema hoặc bấm Reset
  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRunning(false);
    setIsPaused(false);
    setIsComplete(false);
    setCurrentGen(0);
    setHistory([]);
    historyRef.current = [];
    setSelectedTestCase(null);
    setHcActive(false);
    setHcStats(null);
    setMutatedCells({});
    setCrossoverCells({});
    engineRef.current = null;
  };

  // KÍCH HOẠT QUÁ TRÌNH TỐI ƯU HÓA: KẾT NỐI FASTAPI BACKEND THẬT
  const handleStartEvolution = async () => {
    if (schema.length === 0) {
      alert('Vui lòng chọn hoặc nạp một JSON Schema ràng buộc trước!');
      return;
    }
    
    handleReset();
    setIsRunning(true);

    const config: GeneticConfig = {
      generations,
      popSize,
      crossoverRate,
      mutationRate,
      weights: {
        validation: wVal,
        boundary: wBound,
        security: wSec,
        diversity: wDiv
      }
    };

    // --- ĐĂNG KÝ PHƯƠNG ÁN A: NẾU KHÔNG CÓ DATABASE ID, TỰ ĐỘNG CHẠY OFFLINE TẠI CLIENT ---
    if (!specificationId) {
      console.log(">>> Chạy Offline cục bộ tại Client (Không có Specification ID)...");
      const engine = new GeneticEngine(schema, config);
      engine.initialize(initialSeeds);
      engineRef.current = engine;

      const initialStats: PopulationStats = {
        generation: 0,
        bestFitness: engine.population[0].fitness,
        avgFitness: engine.population.reduce((sum, ind) => sum + ind.fitness, 0) / engine.population.length,
        coverage: 0.2,
        duplicateRate: 0.1,
        chromosomes: engine.population.map(p => ({
          values: p.values,
          fitness: p.fitness,
          origin: p.origin
        }))
      };

      setHistory([initialStats]);
      historyRef.current = [initialStats];
      setSelectedTestCase(initialStats.chromosomes[0]);
      runClientLoop();
      return;
    }

    // --- HÀM HỖ TRỢ CHẠY OFFLINE DỰ PHÒNG TẠI CLIENT KHI LỖI KẾT NỐI BACKEND ---
    const runOfflineFallback = () => {
      console.log(">>> Tự động chuyển sang xử lý Offline tại Client...");
      const engine = new GeneticEngine(schema, config);
      engine.initialize(initialSeeds);
      engineRef.current = engine;

      const initialStats: PopulationStats = {
        generation: 0,
        bestFitness: engine.population[0].fitness,
        avgFitness: engine.population.reduce((sum, ind) => sum + ind.fitness, 0) / engine.population.length,
        coverage: 0.2,
        duplicateRate: 0.1,
        chromosomes: engine.population.map(p => ({
          values: p.values,
          fitness: p.fitness,
          origin: p.origin
        }))
      };

      setHistory([initialStats]);
      historyRef.current = [initialStats];
      setSelectedTestCase(initialStats.chromosomes[0]);
      runClientLoop();
    };

    // --- ĐĂNG KÝ PHƯƠNG ÁN B: KẾT NỐI FASTAPI WEBSOCKET ĐỂ TRUYỀN PHÁT TIẾN TRÌNH THỜI GIAN THỰC ---
    console.log(">>> Thiết lập kết nối WebSockets tới FastAPI Backend...");
    try {
      const ws = new WebSocket(`ws://localhost:8000/ws/jobs/${specificationId}`);
      
      ws.onopen = () => {
        console.log(">>> Kết nối WebSocket thành công! Đang gửi cấu hình...");
        ws.send(JSON.stringify({
          generations,
          popSize,
          crossoverRate,
          mutationRate,
          weights: {
            validation: wVal,
            boundary: wBound,
            security: wSec,
            diversity: wDiv
          },
          initial_seeds: initialSeeds
        }));
      };

      // Mảng lưu trữ động các thế hệ nhận được
      const localHistory: PopulationStats[] = [];

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        
        if (msg.event === 'GA_PROGRESS') {
          const stats: PopulationStats = {
            generation: msg.data.generation,
            bestFitness: msg.data.bestFitness,
            avgFitness: msg.data.avgFitness,
            coverage: msg.data.coverage,
            duplicateRate: msg.data.duplicateRate,
            chromosomes: msg.data.test_cases
          };

          setCurrentGen(stats.generation);

          // Hiệu ứng nhấp nháy ô lưới di truyền
          const mutCells: Record<number, boolean> = {};
          const crossCells: Record<number, boolean> = {};
          stats.chromosomes.forEach((c, idx) => {
            if (c.origin.includes('Mutation') || c.origin.includes('Tweak')) {
              mutCells[idx] = true;
            } else if (c.origin.includes('Crossover') || c.origin.includes('Mix')) {
              crossCells[idx] = true;
            }
          });
          setMutatedCells(mutCells);
          setCrossoverCells(crossCells);

          setTimeout(() => {
            setMutatedCells({});
            setCrossoverCells({});
          }, 350);

          localHistory.push(stats);
          setHistory([...localHistory]);
          historyRef.current = [...localHistory];

          if (stats.chromosomes.length > 0) {
            setSelectedTestCase(stats.chromosomes[0]);
          }
        }
        
        else if (msg.event === 'HC_START') {
          setHcActive(true);
          setActiveTab('log');
          setHcStats({
            originalFitness: 0,
            optimizedFitness: 0,
            tweaksCount: 0,
            edgeCasesDiscovered: 0,
            details: [msg.message]
          });
        }
        
        else if (msg.event === 'HC_PROGRESS') {
          setHcStats((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              details: [...prev.details, msg.data.log]
            };
          });
        }
        
        else if (msg.event === 'COMPLETE') {
          setHcActive(false);
          setIsComplete(true);
          setIsRunning(false);

          // Cập nhật thống kê leo đồi cuối cùng
          const finalHcStats: HillClimbStats = {
            originalFitness: msg.data.hcStats.originalFitness,
            optimizedFitness: msg.data.hcStats.optimizedFitness,
            tweaksCount: msg.data.hcStats.tweaksCount,
            edgeCasesDiscovered: msg.data.hcStats.edgeCasesDiscovered,
            details: msg.data.hcStats.details
          };
          setHcStats(finalHcStats);

          // Kích hoạt callback nghiệm thu dữ liệu ở App.tsx
          onEvolutionComplete(msg.data.optimizedDataset, localHistory, finalHcStats);
          ws.close();
        }
        
        else if (msg.event === 'ERROR') {
          alert(`Lỗi Backend: ${msg.message}`);
          ws.close();
          // Chuyển sang chạy offline dự phòng
          runOfflineFallback();
        }
      };

      ws.onerror = (e) => {
        console.error(">>> WebSocket Error:", e);
        ws.close();
        // Fallback offline
        runOfflineFallback();
      };

      ws.onclose = () => {
        console.log(">>> Kết nối WebSocket đã đóng.");
      };

    } catch (e: any) {
      console.error(e);
      runOfflineFallback();
    }
  };



  // BỘ CHẠY OFFLINE TẠI CLIENT (CHỈ SỬ DỤNG LÀM PHƯƠNG ÁN DỰ PHÒNG THỨ CẤP)
  const runClientLoop = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      if (isPausedRef.current) return;

      const engine = engineRef.current;
      if (!engine) return;

      if (engine.generation >= generations) {
        clearInterval(timerRef.current!);
        triggerClientHillClimbing();
        return;
      }

      // Chạy tiến hóa 1 thế hệ
      const stats = engine.runGeneration();
      setCurrentGen(engine.generation);

      const mutCells: Record<number, boolean> = {};
      const crossCells: Record<number, boolean> = {};
      stats.chromosomes.forEach((c, idx) => {
        if (c.origin === 'Mutation') mutCells[idx] = true;
        else if (c.origin === 'Crossover') crossCells[idx] = true;
      });
      setMutatedCells(mutCells);
      setCrossoverCells(crossCells);

      setTimeout(() => {
        setMutatedCells({});
        setCrossoverCells({});
      }, 350);

      const updatedHistory = [...historyRef.current, stats];
      setHistory(updatedHistory);
      historyRef.current = updatedHistory;

      if (stats.chromosomes.length > 0) {
        setSelectedTestCase(stats.chromosomes[0]);
      }

    }, speedDelay);
  };

  const triggerClientHillClimbing = () => {
    setHcActive(true);
    setActiveTab('log');

    const engine = engineRef.current;
    if (!engine) return;

    const bestChromosome = engine.population[0].values;
    const rawPop = engine.population.map(p => p.values);
    const fitnessEvaluator = (c: Chromosome) => {
      return engine.computeFitness(c, rawPop).fitness;
    };

    setTimeout(() => {
      const hcResult = runHillClimbing(bestChromosome, schema, fitnessEvaluator, 15);
      
      setHcStats(hcResult.stats);
      setHcActive(false);
      setIsComplete(true);
      setIsRunning(false);

      const updatedPopulation = [...engine.population];
      updatedPopulation[0] = {
        values: hcResult.optimized,
        fitness: hcResult.stats.optimizedFitness,
        origin: 'HC_FINE_TUNED'
      };
      
      setSelectedTestCase(updatedPopulation[0]);

      onEvolutionComplete(
        updatedPopulation.map(p => p.values),
        historyRef.current,
        hcResult.stats
      );
    }, 1000);
  };

  // Nút chạy Từng bước (Step-by-step) offline
  const handleStep = () => {
    const engine = engineRef.current;
    if (!engine || isComplete || hcActive) return;

    if (engine.generation >= generations) {
      triggerClientHillClimbing();
      return;
    }

    const stats = engine.runGeneration();
    setCurrentGen(engine.generation);

    const updatedHistory = [...historyRef.current, stats];
    setHistory(updatedHistory);
    historyRef.current = updatedHistory;
    
    if (stats.chromosomes.length > 0) {
      setSelectedTestCase(stats.chromosomes[0]);
    }
  };

  // Đồng bộ nút Pause khi đổi giá trị Delay
  useEffect(() => {
    if (isRunning && !isPaused && !hcActive) {
      if (specificationId) {
        // Backend playback does not need regeneration, timer is handled by React interval
      } else {
        runClientLoop();
      }
    }
  }, [speedDelay]);

  // Cấu hình định dạng biểu đồ tiến trình
  const chartData = history.map(h => ({
    gen: h.generation,
    coverage: parseFloat((h.coverage * 100).toFixed(1)),
    duplicateRate: parseFloat((h.duplicateRate * 100).toFixed(1))
  }));

  // (Removed unused getCellClass)

  // Tính cơ cấu điểm chất lượng của ca test đang soi
  const getBreakdown = () => {
    if (!selectedTestCase || !engineRef.current) return null;
    const rawPop = engineRef.current.population.map(p => p.values);
    const res = engineRef.current.computeFitness(selectedTestCase.values, rawPop);
    return res.scoreBreakdown;
  };

  const breakdown = getBreakdown();

  // Giải mã xuất xứ thuật toán sinh
  const getOriginLabel = (origin: string) => {
    if (!origin) return '🌱 Khởi Tạo';
    const o = origin.toUpperCase();
    if (o.startsWith('SEED')) return '🌱 Bộ Ca Test Cơ Bản (AI Gemini Trích Xuất)';
    if (o.startsWith('ELITE')) return '👑 Ca Test Đạt Chuẩn Cao Nhất (Retained Elites)';
    if (o.startsWith('CROSSOVER') || o.startsWith('MIX')) return '🧬 Phối Hợp Đa Dạng Tham Số (GA Crossover)';
    if (o.startsWith('MUTATION')) return '💥 Sinh Dữ Liệu Dị Thường (GA Mutation)';
    if (o.startsWith('HC') || o.startsWith('TWEAK') || o.includes('FINE_TUNED') || o.includes('FINE-TUNED')) return '🧗‍♂️ Tinh Chỉnh Giá Trị Biên (Hill Climbing)';
    if (o.startsWith('INIT_VALID')) return '🟢 Happy Path (Khớp Quy Tắc Nghiệp Vụ)';
    if (o.startsWith('INIT_BOUNDARY')) return '🟡 Boundary Case (Phân Tích Giá Trị Biên)';
    if (o.startsWith('INIT_SECURITY')) return '🔴 Security Payload (Kiểm Thử An Ninh)';
    return `👾 Tối ưu hóa: ${origin}`;
  };

  // Phân loại ca kiểm thử để vẽ lên lưới
  const getTestCaseCategory = (c: any) => {
    let isSecurity = false;
    Object.values(c.values).forEach(val => {
      const str = String(val);
      if (str.includes("'") || str.includes("<script") || str.includes("--")) isSecurity = true;
    });
    if (isSecurity) return 'security';
    if (c.fitness < 0.4) return 'negative';
    if (c.fitness > 0.75) return 'boundary';
    return 'positive';
  };

  // Phân tích động ca kiểm thử dành cho QA/Tester (QA Explanations & Insights)
  const getTestCaseExplanation = (c: any, schema: FieldConstraint[]) => {
    if (!c) return null;
    const category = getTestCaseCategory(c);
    
    let categoryName = '';
    let objective = '';
    let risk = '';
    let color = '';
    let emoji = '';
    
    switch (category) {
      case 'security':
        categoryName = 'Kiểm Thử Bảo Mật (Security Test Case)';
        emoji = '💀';
        color = 'var(--color-violet)';
        objective = 'Kiểm thử khả năng phòng thủ và lọc đầu vào của hệ thống trước các cuộc tấn công phổ biến như chèn mã SQL (SQL Injection), chèn tập lệnh chéo trang (Cross-Site Scripting - XSS) hoặc cố tình phá vỡ cấu trúc tham số.';
        risk = 'Cực kỳ nguy hiểm. Nếu hệ thống chấp nhận các giá trị độc hại này mà không lọc bỏ (sanitize) hoặc mã hóa dữ liệu (escape), hacker có thể đánh cắp toàn bộ cơ sở dữ liệu hoặc chiếm quyền kiểm soát phiên đăng nhập của người dùng khác.';
        break;
      case 'negative':
        categoryName = 'Kiểm Thử Tiêu Cực (Negative Test Case)';
        emoji = '🔴';
        color = 'var(--color-rose)';
        objective = 'Kiểm thử phản ứng của hệ thống khi nhận giá trị rỗng, giá trị vượt xa giới hạn cho phép hoặc định dạng hoàn toàn sai lệch. Mục đích là đảm bảo hệ thống có bộ chặn lỗi thông minh thay vì bị sập.';
        risk = 'Lỗi hệ thống hoặc lộ thông tin nhạy cảm. Nếu ca kiểm thử này thất bại, hệ thống có thể bị sập (lỗi 500 trắng màn hình), lộ lỗi Stack Trace chi tiết của cơ sở dữ liệu tạo cơ hội cho kẻ tấn công tìm hiểu cấu trúc hệ thống.';
        break;
      case 'boundary':
        categoryName = 'Phân Tích Giá Trị Biên (Boundary Test Case)';
        emoji = '🟢';
        color = 'var(--color-teal)';
        objective = 'Tập trung chính xác vào các ngưỡng ranh giới cực đại hoặc cực tiểu quy định (ví dụ: vừa đủ 18 tuổi, đúng độ dài 8 ký tự mật khẩu...). Thuật toán tinh chỉnh biên để phát hiện sai lệch ở các mốc dấu bằng.';
        risk = 'Lập trình viên rất dễ viết nhầm các toán tử so sánh (ví dụ dùng ">" thay vì ">="). Nếu kiểm thử biên thất bại, hệ thống có thể từ chối các giao dịch hợp lệ hoặc chấp nhận dữ liệu sai biên ở sát nút mốc quy định.';
        break;
      case 'positive':
      default:
        categoryName = 'Kiểm Thử Nghiệp Vụ Hợp Lệ (Happy Path)';
        emoji = '🟡';
        color = '#facc15';
        objective = 'Kiểm tra luồng nghiệp vụ cơ bản hoạt động trơn tru trong điều kiện lý tưởng với dữ liệu đầu vào hoàn toàn hợp lệ và chuẩn xác. Đây là nền tảng để tính năng chạy được.';
        risk = 'Lỗi cốt lõi của tính năng. Nếu một ca kiểm thử Happy Path thông thường cũng thất bại, điều đó đồng nghĩa với việc tính năng chính hoàn toàn không hoạt động, làm gián đoạn mọi trải nghiệm cơ bản của người dùng.';
        break;
    }

    const fieldExplanations: { field: string; val: string; explanation: string }[] = [];
    schema.forEach(field => {
      const val = c.values[field.name];
      const valStr = String(val);
      let exp = '';
      
      if (valStr === '') {
        exp = `Được bỏ trống (${field.required ? '⚠️ Trường này Bắt buộc nhưng hệ thống đang sinh trống để test bộ validate validation' : 'Trường này không bắt buộc'})`;
      } else if (valStr.includes("'") || valStr.includes("--")) {
        exp = `Chèn dấu nháy đơn/gạch nối SQL (${valStr}) để cố gắng phá vỡ câu lệnh SQL dưới database, kiểm tra phòng chống SQL Injection`;
      } else if (valStr.includes("<script") || valStr.includes("<svg") || valStr.includes("onload")) {
        exp = `Chèn mã lệnh script HTML/SVG (${valStr}) nhằm kiểm thử khả năng lọc mã nguồn độc, chống tấn công XSS`;
      } else if (field.type === 'number') {
        const numVal = Number(val);
        if (field.minValue !== undefined && numVal === field.minValue) {
          exp = `Chạm chính xác ngưỡng cận dưới tối thiểu cho phép (Min = ${field.minValue})`;
        } else if (field.maxValue !== undefined && numVal === field.maxValue) {
          exp = `Chạm chính xác ngưỡng cận trên tối đa cho phép (Max = ${field.maxValue})`;
        } else if (field.minValue !== undefined && numVal < field.minValue) {
          exp = `Giá trị nằm ngoài biên dưới tối thiểu (Giá trị ${numVal} < Min ${field.minValue})`;
        } else if (field.maxValue !== undefined && numVal > field.maxValue) {
          exp = `Giá trị nằm ngoài biên trên tối đa (Giá trị ${numVal} > Max ${field.maxValue})`;
        } else {
          exp = `Giá trị số hợp lệ thông thường (${numVal})`;
        }
      } else if (field.type === 'string') {
        const len = valStr.length;
        if (field.minLength !== undefined && len === field.minLength) {
          exp = `Độ dài chuỗi chạm chính xác ngưỡng cận dưới tối thiểu (Độ dài = ${len} ký tự)`;
        } else if (field.maxLength !== undefined && len === field.maxLength) {
          exp = `Độ dài chuỗi chạm chính xác ngưỡng cận trên tối đa (Độ dài = ${len} ký tự)`;
        } else if (field.minLength !== undefined && len < field.minLength) {
          exp = `Độ dài chuỗi quá ngắn, vi phạm ràng buộc (Độ dài ${len} < Min ${field.minLength})`;
        } else if (field.maxLength !== undefined && len > field.maxLength) {
          exp = `Độ dài chuỗi quá dài, vi phạm ràng buộc (Độ dài ${len} > Max ${field.maxLength})`;
        } else if (field.regex) {
          const r = new RegExp(field.regex);
          if (r.test(valStr)) {
            exp = `Khớp biểu thức RegExp định dạng quy định (Độ dài: ${len} ký tự)`;
          } else {
            exp = `⚠️ Vi phạm biểu thức RegExp định dạng quy định để test tính nghiêm ngặt của Regex`;
          }
        } else {
          exp = `Chuỗi thông thường hợp lệ (Độ dài: ${len} ký tự)`;
        }
      } else if (field.type === 'email') {
        if (!valStr.includes('@') || !valStr.includes('.')) {
          exp = `⚠️ Vi phạm định dạng email tiêu chuẩn nhằm kiểm thử xem hệ thống có bắt lỗi định dạng email hay không`;
        } else {
          exp = `Địa chỉ email đúng định dạng tiêu chuẩn`;
        }
      } else if (field.type === 'card') {
        if (valStr.length !== 16 || !/^\d+$/.test(valStr)) {
          exp = `⚠️ Vi phạm định dạng thẻ tín dụng (Không đủ 16 chữ số hoặc chứa ký tự lạ) nhằm kiểm thử bộ lọc thẻ`;
        } else {
          exp = `Số thẻ 16 chữ số hợp chuẩn`;
        }
      } else if (field.type === 'phone') {
        if (!/^(03|05|07|08|09)\d{8}$/.test(valStr)) {
          exp = `⚠️ Số điện thoại vi phạm định dạng nhà mạng Việt Nam nhằm kiểm chứng tính nghiêm ngặt của form nhập`;
        } else {
          exp = `Số điện thoại Việt Nam hợp quy`;
        }
      } else {
        exp = `Dữ liệu hợp lệ thông thường`;
      }
      
      fieldExplanations.push({
        field: field.name,
        val: valStr,
        explanation: exp
      });
    });

    return {
      categoryName,
      emoji,
      color,
      objective,
      risk,
      fieldExplanations
    };
  };

  return (
    <div className="flex flex-col gap-lg" style={{ marginTop: '16px' }}>

      {/* SƠ ĐỒ ĐƯỜNG ĐI THUẬT TOÁN LAI GHÉP PHỨC HỢP (GA + HC) */}
      <div className="glass-card flex flex-col gap-sm" style={{ 
        padding: '16px 20px', 
        background: 'rgba(15,23,42,0.4)', 
        border: '1px solid rgba(255,255,255,0.04)',
        marginTop: '-8px',
        marginBottom: '4px'
      }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-teal)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Cpu size={14} />
          BẢN ĐỒ ĐƯỜNG ĐI THUẬT TOÁN PHỨC HỢP (HYBRID GA + HC PIPELINE MAP)
        </div>
        
        {/* Sơ đồ tuyến tính các khối chức năng */}
        <div className="flex align-center justify-between" style={{ flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
          
          {/* Khối 1: F0 Seeds */}
          <div className="flex align-center gap-sm" style={{ flex: '1', minWidth: '220px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px' }}>
            <span style={{ fontSize: '20px' }}>🌱</span>
            <div className="flex flex-col">
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>1. Bộ Ca Test Cơ Bản</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>AI Gemini trích xuất quy tắc &amp; sinh các ca test biên thô ban đầu (Seeds).</span>
            </div>
          </div>

          <div style={{ color: 'var(--color-teal)', fontSize: '16px', fontWeight: 'bold' }}>&rarr;</div>

          {/* Khối 2: Genetic Algorithm (GA) */}
          <div className="flex align-center gap-sm" style={{ 
            flex: '1.2', 
            minWidth: '260px', 
            background: isRunning && !hcActive ? 'rgba(45,212,191,0.08)' : 'rgba(255,255,255,0.01)', 
            border: isRunning && !hcActive ? '1px solid rgba(45,212,191,0.3)' : '1px solid rgba(255,255,255,0.03)', 
            padding: '10px 14px', 
            borderRadius: '8px',
            boxShadow: isRunning && !hcActive ? '0 0 12px rgba(45,212,191,0.1)' : 'none',
            transition: 'var(--transition-smooth)'
          }}>
            <span style={{ fontSize: '20px', animation: isRunning && !hcActive ? 'neon-glow 1.5s infinite ease-in-out' : 'none' }}>🧬</span>
            <div className="flex flex-col">
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: isRunning && !hcActive ? 'var(--color-teal)' : '#fff' }}>
                2. Tối Ưu Độ Bao Phủ (GA) {isRunning && !hcActive ? `[Vòng lặp: ${currentGen}/${generations}]` : ''}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Phối hợp đa dạng tham số (Crossover) &amp; Sinh dữ liệu dị thường (Mutation) toàn cục.</span>
            </div>
          </div>

          <div style={{ color: 'var(--color-violet)', fontSize: '16px', fontWeight: 'bold' }}>&rarr;</div>

          {/* Khối 3: Hill Climbing (HC) */}
          <div className="flex align-center gap-sm" style={{ 
            flex: '1.2', 
            minWidth: '260px', 
            background: hcActive ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.01)', 
            border: hcActive ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(255,255,255,0.03)', 
            padding: '10px 14px', 
            borderRadius: '8px',
            boxShadow: hcActive ? '0 0 12px rgba(167,139,250,0.1)' : 'none',
            transition: 'var(--transition-smooth)'
          }}>
            <span style={{ fontSize: '20px', animation: hcActive ? 'neon-glow 1.5s infinite ease-in-out' : 'none' }}>🧗‍♂️</span>
            <div className="flex flex-col">
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: hcActive ? 'var(--color-violet)' : '#fff' }}>
                3. Tinh Chỉnh Biên Cực Đoan (HC) {hcActive ? `[Đang tinh chỉnh...]` : ''}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Tự động chèn ký tự lạ, làm rỗng/tràn trường, chèn payload SQLi/XSS để stress test.</span>
            </div>
          </div>

          <div style={{ color: 'var(--color-rose)', fontSize: '16px', fontWeight: 'bold' }}>&rarr;</div>

          {/* Khối 4: Complete */}
          <div className="flex align-center gap-sm" style={{ flex: '1', minWidth: '220px', background: isComplete ? 'rgba(244,63,94,0.08)' : 'rgba(255,255,255,0.01)', border: isComplete ? '1px solid rgba(244,63,94,0.3)' : '1px solid rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px' }}>
            <span style={{ fontSize: '20px' }}>👑</span>
            <div className="flex flex-col">
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: isComplete ? 'var(--color-rose)' : '#fff' }}>4. Xuất Bộ Test Case Đạt Chuẩn</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Đạt độ bao phủ kiểm thử (Test Coverage) &gt;95%, sẵn sàng xuất file CSV/JSON.</span>
            </div>
          </div>

        </div>
      </div>
      <div className="glass-card teal-border" style={{ padding: '20px', background: 'rgba(15,23,42,0.6)', marginBottom: '8px' }}>
        <h3 style={{ fontSize: '14px', color: '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.05em' }}>
          <Cpu size={16} className="text-teal" style={{ color: 'var(--color-teal)' }} />
          CHỌN CHẾ ĐỘ KIỂM THỬ (QA QUICK MODE SELECTOR) - TIÊU CHUẨN THIẾT KẾ CA KIỂM THỬ (ISTQB STANDARDS)
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
          Lựa chọn kỹ thuật thiết kế ca kiểm thử (Test Case Design Technique). Thuật toán AI và GA+HC sẽ tự động thiết lập các tham số tối ưu phù hợp nhất bên dưới.
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {/* Card Happy Path */}
          <div 
            onClick={() => handleApplyQAMode('happy')}
            className={`tutorial-card`}
            style={{ 
              cursor: 'pointer',
              border: qaMode === 'happy' ? '1px solid var(--color-teal)' : '1px solid rgba(255,255,255,0.05)',
              background: qaMode === 'happy' ? 'rgba(45,212,191,0.06)' : 'rgba(15,23,42,0.6)',
              boxShadow: qaMode === 'happy' ? '0 0 12px rgba(45,212,191,0.1)' : 'none',
              padding: '14px'
            }}
          >
            <span style={{ fontSize: '20px' }}>🟢</span>
            <div className="flex flex-col gap-xs" style={{ marginTop: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--color-teal)' }}>Kiểm Thử Luồng Tích Cực (Positive Testing)</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>Happy Path: Tự động tạo bộ dữ liệu hợp lệ để xác minh các Business Rules (Quy tắc nghiệp vụ chuẩn).</span>
            </div>
          </div>

          {/* Card Boundary */}
          <div 
            onClick={() => handleApplyQAMode('boundary')}
            className={`tutorial-card`}
            style={{ 
              cursor: 'pointer',
              border: qaMode === 'boundary' ? '1px solid var(--color-violet)' : '1px solid rgba(255,255,255,0.05)',
              background: qaMode === 'boundary' ? 'rgba(167,139,250,0.06)' : 'rgba(15,23,42,0.6)',
              boxShadow: qaMode === 'boundary' ? '0 0 12px rgba(167,139,250,0.1)' : 'none',
              padding: '14px'
            }}
          >
            <span style={{ fontSize: '20px' }}>🟡</span>
            <div className="flex flex-col gap-xs" style={{ marginTop: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--color-violet)' }}>Phân Tích Giá Trị Biên (Boundary Value Analysis)</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>Boundary Testing: Tự động chèn các giá trị cực hạn (Min, Max, Null, Empty) để tìm lỗi xử lý biên.</span>
            </div>
          </div>

          {/* Card Security */}
          <div 
            onClick={() => handleApplyQAMode('security')}
            className={`tutorial-card`}
            style={{ 
              cursor: 'pointer',
              border: qaMode === 'security' ? '1px solid var(--color-rose)' : '1px solid rgba(255,255,255,0.05)',
              background: qaMode === 'security' ? 'rgba(244,63,94,0.06)' : 'rgba(15,23,42,0.6)',
              boxShadow: qaMode === 'security' ? '0 0 12px rgba(244,63,94,0.1)' : 'none',
              padding: '14px'
            }}
          >
            <span style={{ fontSize: '20px' }}>🔴</span>
            <div className="flex flex-col gap-xs" style={{ marginTop: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--color-rose)' }}>Kiểm Thử An Ninh &amp; Bảo Mật (Security Penetration)</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>Penetration Testing: Tự động nhúng các payload độc hại (SQL Injection, XSS) để quét lỗ hổng bảo mật.</span>
            </div>
          </div>

          {/* Card Hybrid */}
          <div 
            onClick={() => handleApplyQAMode('hybrid')}
            className={`tutorial-card`}
            style={{ 
              cursor: 'pointer',
              border: qaMode === 'hybrid' ? '1px solid #fff' : '1px solid rgba(255,255,255,0.05)',
              background: qaMode === 'hybrid' ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.6)',
              boxShadow: qaMode === 'hybrid' ? '0 0 12px rgba(255,255,255,0.05)' : 'none',
              padding: '14px'
            }}
          >
            <span style={{ fontSize: '20px' }}>🧬</span>
            <div className="flex flex-col gap-xs" style={{ marginTop: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>Tối Ưu Hóa Độ Bao Phủ Phức Hợp (Hybrid Suite)</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>GA + HC Coverage: Kết hợp đồng thời các kỹ thuật trên để tối đa hóa độ bao phủ (Test Coverage) vượt trội &gt;95%.</span>
            </div>
          </div>
        </div>
      </div>

      {/* 1. CONFIGURATION & WEIGHTS SLIDERS */}
      <div className="grid-2">
        <div className="glass-card flex flex-col gap-md teal-border">
          <div className="flex align-center gap-sm">
            <Cpu size={22} className="text-teal" style={{ color: 'var(--color-teal)' }} />
            <h3>Cấu Hình Bộ Tiến Hóa Tối Ưu (Test Suite Optimization Config)</h3>
          </div>

          <div className="flex flex-col gap-sm" style={{ marginTop: '8px' }}>
            <div className="flex justify-between" style={{ fontSize: '13px' }}>
              <div className="flex flex-col">
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Số Vòng Lặp Tối Ưu Hóa (Generations):</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Số chu kỳ thuật toán chạy cải tiến bộ test; số càng lớn độ bao phủ (Coverage) càng cao nhưng sinh lâu hơn.</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', alignSelf: 'flex-start' }}>{generations}</span>
            </div>
            <input 
              type="range" min="10" max="200" step="10" 
              value={generations} onChange={(e) => setGenerations(Number(e.target.value))}
              disabled={isRunning}
              style={{ cursor: 'pointer', accentColor: 'var(--color-teal)' }}
            />

            <div className="flex justify-between" style={{ fontSize: '13px', marginTop: '6px' }}>
              <div className="flex flex-col">
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Kích Thước Bộ Kiểm Thử (Test Suite Size):</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Tổng số lượng ca kiểm thử (Test Cases) tối ưu sẽ được sinh ra trong bộ dữ liệu kết quả.</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', alignSelf: 'flex-start' }}>{popSize}</span>
            </div>
            <input 
              type="range" min="20" max="150" step="10" 
              value={popSize} onChange={(e) => setPopSize(Number(e.target.value))}
              disabled={isRunning}
              style={{ cursor: 'pointer', accentColor: 'var(--color-teal)' }}
            />

            <div className="flex justify-between" style={{ fontSize: '13px', marginTop: '6px' }}>
              <div className="flex flex-col">
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Độ Phối Hợp Tham Số (Crossover Rate):</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Xác suất tự động phối hợp thuộc tính giữa các ca kiểm thử tốt nhất để sinh kịch bản test mới.</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', alignSelf: 'flex-start' }}>{crossoverRate * 100}%</span>
            </div>
            <input 
              type="range" min="0.4" max="1.0" step="0.05" 
              value={crossoverRate} onChange={(e) => setCrossoverRate(Number(e.target.value))}
              disabled={isRunning}
              style={{ cursor: 'pointer', accentColor: 'var(--color-teal)' }}
            />

            <div className="flex justify-between" style={{ fontSize: '13px', marginTop: '6px' }}>
              <div className="flex flex-col">
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Độ Đột Biến Dị Thường (Mutation Rate / Stress Rate):</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Tần suất chèn các giá trị cực đoan, lỗi định dạng phục vụ Kiểm Thử Tiêu Cực (Negative Testing).</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', alignSelf: 'flex-start' }}>{mutationRate * 100}%</span>
            </div>
            <input 
              type="range" min="0.05" max="0.5" step="0.05" 
              value={mutationRate} onChange={(e) => setMutationRate(Number(e.target.value))}
              disabled={isRunning}
              style={{ cursor: 'pointer', accentColor: 'var(--color-teal)' }}
            />
          </div>
        </div>

        <div className="glass-card flex flex-col gap-md violet-border">
          <div className="flex align-center gap-sm">
            <TrendingUp size={22} className="text-violet" style={{ color: 'var(--color-violet)' }} />
            <h3>Trọng Số Chất Lượng Bộ Kiểm Thử (Test Suite Quality Weights)</h3>
          </div>

          <div className="flex flex-col gap-sm" style={{ marginTop: '8px' }}>
            <div className="flex justify-between" style={{ fontSize: '13px' }}>
              <div className="flex flex-col">
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Trọng Số Xác Minh Nghiệp Vụ (Business Rule Validation):</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Mức độ ưu tiên để dữ liệu sinh ra khớp chính xác định dạng chuẩn cơ bản (Email, SĐT, Regex...).</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', alignSelf: 'flex-start' }}>{wVal.toFixed(2)}</span>
            </div>
            <input 
              type="range" min="0.1" max="0.8" step="0.05" 
              value={wVal} onChange={(e) => setWVal(Number(e.target.value))}
              disabled={isRunning}
              style={{ cursor: 'pointer', accentColor: 'var(--color-violet)' }}
            />

            <div className="flex justify-between" style={{ fontSize: '13px', marginTop: '6px' }}>
              <div className="flex flex-col">
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Trọng Số Phân Tích Biên (Boundary Value Analysis):</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Mức độ ưu tiên sinh dữ liệu chạm chính xác mốc cực hạn Min/Max, Null, chuỗi rỗng.</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', alignSelf: 'flex-start' }}>{wBound.toFixed(2)}</span>
            </div>
            <input 
              type="range" min="0.0" max="0.5" step="0.05" 
              value={wBound} onChange={(e) => setWBound(Number(e.target.value))}
              disabled={isRunning}
              style={{ cursor: 'pointer', accentColor: 'var(--color-violet)' }}
            />

            <div className="flex justify-between" style={{ fontSize: '13px', marginTop: '6px' }}>
              <div className="flex flex-col">
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Trọng Số Kiểm Thử Bảo Mật (Security Penetration):</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Mức độ ưu tiên nhúng các payload an ninh mạng phổ biến (SQL Injection, XSS, Bypass Auth).</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', alignSelf: 'flex-start' }}>{wSec.toFixed(2)}</span>
            </div>
            <input 
              type="range" min="0.0" max="0.5" step="0.05" 
              value={wSec} onChange={(e) => setWSec(Number(e.target.value))}
              disabled={isRunning}
              style={{ cursor: 'pointer', accentColor: 'var(--color-violet)' }}
            />

            <div className="flex justify-between" style={{ fontSize: '13px', marginTop: '6px' }}>
              <div className="flex flex-col">
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Trọng Số Độ Đa Dạng Ca Test (Test Case Diversity):</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Mức độ ưu tiên sinh ca test không trùng lặp lẫn nhau, giúp giảm thiểu số lượng ca test dư thừa.</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', alignSelf: 'flex-start' }}>{wDiv.toFixed(2)}</span>
            </div>
            <input 
              type="range" min="0.0" max="0.4" step="0.05" 
              value={wDiv} onChange={(e) => setWDiv(Number(e.target.value))}
              disabled={isRunning}
              style={{ cursor: 'pointer', accentColor: 'var(--color-violet)' }}
            />
          </div>
        </div>
      </div>

      {/* 2. EVO CONTROL BAR */}
      <div 
        className="glass-card flex align-center justify-between" 
        style={{ 
          padding: '16px 24px', 
          background: 'rgba(15,23,42,0.65)', 
          border: '1px solid rgba(45,212,191,0.2)' 
        }}
      >
        <div className="flex align-center gap-md">
          {!isRunning && !isComplete ? (
            <button onClick={handleStartEvolution} className="btn btn-primary">
              <Play size={16} />
              Kích Hoạt Tối Ưu Hóa Dữ Liệu
            </button>
          ) : (
            <>
              <button 
                onClick={() => setIsPaused(!isPaused)} 
                className={`btn ${isPaused ? 'btn-primary' : 'btn-secondary'}`}
                disabled={isComplete || hcActive}
              >
                {isPaused ? <Play size={16} /> : <Pause size={16} />}
                {isPaused ? 'Tiếp tục' : 'Tạm Dừng'}
              </button>
              
              <button 
                onClick={handleStep} 
                className="btn btn-secondary"
                disabled={specificationId !== '' || !isPaused || isComplete || hcActive}
              >
                <SkipForward size={16} />
                Từng Bước (Step)
              </button>
              
              <button onClick={handleReset} className="btn btn-secondary" style={{ color: 'var(--color-rose)', borderColor: 'rgba(244,63,94,0.1)' }}>
                <RotateCcw size={16} />
                Làm mới (Reset)
              </button>
            </>
          )}
        </div>

        {/* Speed delay slider */}
        {isRunning && !hcActive && (
          <div className="flex align-center gap-md">
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Tốc độ hoạt ảnh (Delay):</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 'bold' }}>{speedDelay}ms</span>
            <input 
              type="range" min="10" max="300" step="10" 
              value={speedDelay} onChange={(e) => setSpeedDelay(Number(e.target.value))}
              style={{ width: '120px', cursor: 'pointer', accentColor: 'var(--color-teal)' }}
            />
          </div>
        )}

        {/* Status Indicators */}
        <div className="flex align-center gap-md" style={{ fontSize: '14px', fontWeight: '500' }}>
          {hcActive && (
            <span className="flex align-center gap-sm text-violet" style={{ color: 'var(--color-violet)' }}>
              <Cpu size={16} className="glow-teal" />
              Đang tinh chỉnh dò giá trị biên...
            </span>
          )}
          {isComplete && (
            <span className="flex align-center gap-sm" style={{ color: 'var(--color-teal)' }}>
              <CheckCircle size={16} />
              Đã tối ưu hóa 100% dữ liệu!
            </span>
          )}
          {!isRunning && !isComplete && (
            <span style={{ color: 'var(--text-muted)' }}>Ready</span>
          )}
          {isRunning && !hcActive && !isPaused && (
            <span style={{ color: 'var(--color-teal)' }} className="glow-teal">Server Evolving...</span>
          )}
          {isPaused && <span style={{ color: 'var(--color-violet)' }}>Paused</span>}
        </div>
      </div>

      {/* KHU VỰC HƯỚNG DẪN ĐỌC HIỂU HOẠT ĐỘNG THUẬT TOÁN (QA GUIDE BANNER) */}
      {history.length > 0 && (
        <div 
          className="glass-card flex flex-col gap-sm" 
          style={{ 
            padding: '16px 20px', 
            background: 'rgba(45,212,191,0.03)', 
            border: '1px dashed rgba(45,212,191,0.2)', 
            borderRadius: '8px',
            marginBottom: '8px',
            boxShadow: '0 0 12px rgba(45,212,191,0.05)'
          }}
        >
          <div style={{ fontSize: '13.5px', fontWeight: 'bold', color: 'var(--color-teal)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} />
            HƯỚNG DẪN QA: ĐỌC HIỂU KẾT QUẢ TỐI ƯU HÓA BỘ TEST CASES
          </div>
          <ul style={{ color: 'var(--text-secondary)', fontSize: '12.5px', margin: '4px 0 0 16px', padding: 0, lineHeight: '1.6' }}>
            <li>
              <b>Mỗi ô vuông trong lưới bên dưới đại diện cho 1 Ca Kiểm Thử (Test Case)</b>. Màu 🟢 càng đậm chứng tỏ độ bao phủ biên và độ bảo mật càng tối ưu.
            </li>
            <li>
              <b>👉 Hãy CLICK chọn bất kỳ ô ca test nào</b> để soi chi tiết dữ liệu (Username, Email, Password sinh ra...) ở bảng <b>"BẢNG SOI CHI TIẾT CA KIỂM THỬ"</b> xuất hiện ở ngay phía dưới.
            </li>
            <li>
              <b>Đồ thị bên phải</b> thể hiện xu hướng chất lượng tăng dần của bộ test qua từng vòng cải tiến của thuật toán AI di truyền.
            </li>
            <li>
              Khi ưng ý, hãy nhấn nút <b>"Chuyển Nhanh Đến Tải File (Bước 4)"</b> để tải bộ test dạng <b>CSV/Excel</b> hoặc <b>JSON</b> về máy!
            </li>
          </ul>
        </div>
      )}

      {/* 3. CHART & GRID VISUALIZATION */}
      {history.length > 0 && (
        <div className="grid-2">
          {/* LEFT PANEL: GRID or HILL CLIMB LOG */}
          <div className="glass-card flex flex-col gap-md teal-border" style={{ minHeight: '440px' }}>
            <div className="flex justify-between align-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <div className="flex gap-sm">
                <button 
                  onClick={() => setActiveTab('visualizer')}
                  className={`tab-btn ${activeTab === 'visualizer' ? 'active' : ''}`}
                >
                  Lưới Ca Kiểm Thử (Test Suite Matrix)
                </button>
                <button 
                  onClick={() => setActiveTab('log')}
                  className={`tab-btn ${activeTab === 'log' ? 'active' : ''}`}
                >
                  Nhật Ký Tinh Chỉnh Biên (HC Tweak Log)
                </button>
              </div>
              
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Vòng lặp: <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{currentGen} / {generations}</span>
              </div>
            </div>

            {/* TAB 1: POPULATION MATRIX */}
            {activeTab === 'visualizer' && (
              <div className="flex flex-col gap-md" style={{ flex: 1 }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  Lưới trực quan tập ca kiểm thử. Nhấp chọn ô bất kỳ để xem chi tiết. Ô nhấp nháy <span style={{ color: 'var(--color-rose)', fontWeight: 'bold' }}>Hồng</span> biểu thị Đột biến dữ liệu, <span style={{ color: 'var(--color-teal)', fontWeight: 'bold' }}>Teal</span> biểu thị Trộn tham số.
                </p>

                <div className="visualizer-grid">
                  {history[history.length - 1].chromosomes.map((c, idx) => {
                    const isMutated = mutatedCells[idx];
                    const isCrossover = crossoverCells[idx];
                    
                    let animClass = '';
                    if (isMutated) animClass = 'mutation-flash-anim';
                    else if (isCrossover) animClass = 'crossover-active-anim';

                    const isSelected = selectedTestCase?.values === c.values;
                    const category = getTestCaseCategory(c);
                    
                    let cellBg = 'rgba(250,204,21,0.06)';
                    let cellBorder = '1px solid rgba(250,204,21,0.2)';
                    let cellColor = '#facc15';
                    let cellEmoji = '🟡';

                    if (category === 'security') {
                      cellBg = 'rgba(167,139,250,0.08)';
                      cellBorder = isSelected ? '2px solid #fff' : '1px solid rgba(167,139,250,0.4)';
                      cellColor = 'var(--color-violet)';
                      cellEmoji = '💀';
                    } else if (category === 'negative') {
                      cellBg = 'rgba(244,63,94,0.08)';
                      cellBorder = isSelected ? '2px solid #fff' : '1px solid rgba(244,63,94,0.4)';
                      cellColor = 'var(--color-rose)';
                      cellEmoji = '🔴';
                    } else if (category === 'boundary') {
                      cellBg = 'rgba(45,212,191,0.08)';
                      cellBorder = isSelected ? '2px solid #fff' : '1px solid rgba(45,212,191,0.4)';
                      cellColor = 'var(--color-teal)';
                      cellEmoji = '🟢';
                    } else {
                      cellBorder = isSelected ? '2px solid #fff' : '1px solid rgba(250,204,21,0.3)';
                    }

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedTestCase(c)}
                        className={`chromosome-cell ${animClass}`}
                        style={{
                          background: cellBg,
                          border: cellBorder,
                          color: cellColor,
                          boxShadow: isSelected ? `0 0 12px ${cellColor}` : 'none',
                          transform: isSelected ? 'scale(1.1)' : '',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '2px 0',
                          lineHeight: '1.2',
                          cursor: 'pointer',
                          borderRadius: '6px',
                          transition: 'all 0.2s'
                        }}
                        title={`Ca Kiểm Thử #${idx + 1} - Phân loại: ${category.toUpperCase()} (Độ phủ: ${c.fitness.toFixed(3)})`}
                      >
                        <span style={{ fontSize: '9px', opacity: 0.75 }}>#{idx + 1}</span>
                        <span style={{ fontSize: '12px', marginTop: '1px' }}>{cellEmoji}</span>
                      </div>
                    );
                  })}
                  
                  {/* Fill empty cells */}
                  {Array(Math.max(0, 100 - history[history.length - 1].chromosomes.length)).fill(0).map((_, i) => (
                    <div key={`empty-${i}`} className="chromosome-cell" style={{ opacity: 0.1, border: '1px dashed rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      -
                    </div>
                  ))}
                </div>

                {/* Legend with counts */}
                {(() => {
                  const currentChromosomes = history[history.length - 1].chromosomes;
                  const counts = { positive: 0, boundary: 0, negative: 0, security: 0 };
                  currentChromosomes.forEach(c => {
                    const cat = getTestCaseCategory(c);
                    if (cat === 'boundary') counts.boundary++;
                    else if (cat === 'negative') counts.negative++;
                    else if (cat === 'security') counts.security++;
                    else counts.positive++;
                  });
                  const total = currentChromosomes.length;
                  return (
                    <div className="flex flex-col gap-sm" style={{ fontSize: '11px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '12px', marginTop: 'auto' }}>
                      {/* Quick Stats Bar */}
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                        {[
                          { label: 'Positive', count: counts.positive, color: '#facc15', bg: 'rgba(250,204,21,0.06)', border: 'rgba(250,204,21,0.2)' },
                          { label: 'Boundary', count: counts.boundary, color: 'var(--color-teal)', bg: 'rgba(45,212,191,0.06)', border: 'rgba(45,212,191,0.2)' },
                          { label: 'Negative', count: counts.negative, color: 'var(--color-rose)', bg: 'rgba(244,63,94,0.06)', border: 'rgba(244,63,94,0.2)' },
                          { label: 'Security', count: counts.security, color: 'var(--color-violet)', bg: 'rgba(167,139,250,0.06)', border: 'rgba(167,139,250,0.2)' },
                        ].map(s => (
                          <div key={s.label} style={{ flex: 1, textAlign: 'center', background: s.bg, border: `1px solid ${s.border}`, borderRadius: '6px', padding: '6px 4px' }}>
                            <div style={{ fontSize: '16px', fontWeight: 'bold', color: s.color, fontFamily: 'var(--font-mono)' }}>{s.count}</div>
                            <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '1px' }}>{s.label}</div>
                            <div style={{ fontSize: '9px', color: s.color, opacity: 0.7 }}>{total > 0 ? Math.round(s.count / total * 100) : 0}%</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontWeight: 'bold', color: 'var(--text-secondary)', letterSpacing: '0.03em' }}>🎯 Chú thích màu ô:</div>
                      <div className="flex gap-md" style={{ flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{ background: 'rgba(250,204,21,0.04)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(250,204,21,0.15)', color: '#facc15', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🟡 <b>Positive</b>: Chuẩn nghiệp vụ
                        </span>
                        <span style={{ background: 'rgba(45,212,191,0.04)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(45,212,191,0.15)', color: 'var(--color-teal)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🟢 <b>Boundary</b>: Biên Min/Max
                        </span>
                        <span style={{ background: 'rgba(244,63,94,0.04)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(244,63,94,0.15)', color: 'var(--color-rose)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🔴 <b>Negative</b>: Lỗi/Null/Empty
                        </span>
                        <span style={{ background: 'rgba(167,139,250,0.04)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(167,139,250,0.15)', color: 'var(--color-violet)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          💀 <b>Security</b>: SQLi/XSS Attack
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 2: HILL CLIMBING LOG TERMINAL */}
            {activeTab === 'log' && (
              <div 
                className="flex flex-col" 
                style={{ 
                  flex: 1, 
                  background: '#020617', 
                  borderRadius: 'var(--radius-sm)', 
                  border: '1px solid rgba(255,255,255,0.06)',
                  padding: '12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  color: '#34d399', 
                  maxHeight: '340px',
                  overflowY: 'auto'
                }}
              >
                {!hcStats && !hcActive ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '64px 0' }}>
                    Nhật ký tinh chỉnh biên trống. Tiến trình dò biên cục bộ (Boundary Optimizer) sẽ tự động chạy sau khi GA tối ưu hóa toàn cục xong.
                  </div>
                ) : (
                  <>
                    <div style={{ color: 'var(--color-violet)', fontWeight: 'bold', marginBottom: '8px' }}>
                      [TERMINAL LOG: BOUNDARY TWEAK OPTIMIZER]
                    </div>
                    {hcActive && !hcStats && (
                      <div className="glow-teal" style={{ color: 'var(--color-teal)', marginBottom: '8px' }}>
                        &gt; Đang chạy dò tìm biên Steepest Local Edge trên Test Case xuất sắc nhất F_final...
                      </div>
                    )}
                    {hcStats?.details.map((log, idx) => (
                      <div key={idx} style={{ color: log.includes('tăng') ? 'var(--color-teal)' : log.includes('Khởi động') || log.includes('Kết thúc') ? 'var(--color-violet)' : '#94a3b8' }}>
                        &gt; {log}
                      </div>
                    ))}
                    
                    {hcStats && (
                      <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', marginTop: '12px', paddingTop: '12px', color: 'var(--color-teal)' }}>
                        <div>[KẾT QUẢ DÒ BIÊN HACK / BOUNDARY SEARCH]</div>
                        <div>- Điểm chất lượng trước: {hcStats.originalFitness.toFixed(4)}</div>
                        <div>- Điểm chất lượng sau: {hcStats.optimizedFitness.toFixed(4)}</div>
                        <div>- Số lỗi biên/Mã độc nhúng ra thêm: {hcStats.edgeCasesDiscovered}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* RIGHT PANEL: REAL-TIME FITNESS GRAPH */}
          <div className="glass-card flex flex-col gap-md violet-border" style={{ minHeight: '440px' }}>
            <div className="flex align-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <h3>Đồ Thị Tiến Trình Tối Ưu Hóa (QA Metrics Evolution)</h3>
              <div className="flex gap-md" style={{ fontSize: '12px' }}>
                <span className="flex align-center gap-sm"><span style={{ width: '8px', height: '8px', background: 'var(--color-teal)', borderRadius: '50%' }}></span> Độ phủ kiểm thử (Coverage %)</span>
                <span className="flex align-center gap-sm"><span style={{ width: '8px', height: '8px', background: 'var(--color-rose)', borderRadius: '50%' }}></span> Tỷ lệ trùng lặp (Duplicate %)</span>
              </div>
            </div>

            <div style={{ flex: 1, width: '100%', minHeight: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="gen" stroke="var(--text-muted)" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="var(--text-muted)" fontSize={11} tickFormatter={(val) => `${val}%`} />
                  <Tooltip 
                    contentStyle={{ background: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }}
                    labelFormatter={(label) => `Vòng lặp cải tiến: ${label}`}
                    formatter={(value) => [`${value}%`]}
                  />
                  <Line type="monotone" dataKey="coverage" name="Độ phủ" stroke="var(--color-teal)" strokeWidth={2.5} dot={false} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="duplicateRate" name="Trùng lặp" stroke="var(--color-rose)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Current Stats Overview */}
            {history.length > 0 && (
              <div 
                className="grid-3" 
                style={{ 
                  background: 'rgba(255,255,255,0.01)', 
                  border: '1px solid rgba(255,255,255,0.03)', 
                  padding: '12px', 
                  borderRadius: 'var(--radius-sm)',
                  marginTop: 'auto'
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Chất lượng Tốt nhất</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-teal)', fontFamily: 'var(--font-mono)' }}>
                    {history[history.length - 1].bestFitness.toFixed(3)}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Độ phủ Ràng buộc &amp; Biên</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-violet)', fontFamily: 'var(--font-mono)' }}>
                    {(history[history.length - 1].coverage * 100).toFixed(1)}%
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tỷ lệ trùng lặp</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-rose)', fontFamily: 'var(--font-mono)' }}>
                    {(history[history.length - 1].duplicateRate * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. ACTIVE CHROMOSOME DETAIL INSPECTOR CARD */}
      {selectedTestCase && (
        <div className="glass-card flex flex-col gap-md violet-border animate-glow" style={{ background: 'rgba(15,23,42,0.85)', boxShadow: '0 0 20px rgba(167,139,250,0.15)', border: '1px solid var(--color-violet)' }}>
          <div className="flex justify-between align-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
            <div className="flex align-center gap-sm" style={{ flexWrap: 'wrap' }}>
              <span style={{ fontSize: '16px' }}>🔍</span>
              <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>
                BẢNG SOI CHI TIẾT DỮ LIỆU CA KIỂM THỬ ĐANG CHỌN (TEST CASE INSPECTOR)
              </h4>
              <span 
                className={`cell-fit-high`}
                style={{ 
                  padding: '4px 10px', 
                  borderRadius: '12px', 
                  fontSize: '11px', 
                  fontWeight: 'bold',
                  background: selectedTestCase.origin.includes('Seed') ? 'rgba(255,255,255,0.08)' : selectedTestCase.origin.includes('HC') || selectedTestCase.origin.includes('Tweak') ? 'rgba(167,139,250,0.15)' : 'rgba(45,212,191,0.15)',
                  color: selectedTestCase.origin.includes('Seed') ? '#fff' : selectedTestCase.origin.includes('HC') || selectedTestCase.origin.includes('Tweak') ? 'var(--color-violet)' : 'var(--color-teal)'
                }}
              >
                Nguồn gốc: {getOriginLabel(selectedTestCase.origin)}
              </span>
            </div>

            <div className="flex align-center gap-sm" style={{ marginLeft: 'auto' }}>
              {selectedTestCase.fitness > 0.85 && (
                <span className="flex align-center gap-sm" style={{ color: 'var(--color-teal)', fontSize: '12px', marginRight: '8px' }}>
                  <CheckCircle size={14} /> Ca kiểm thử biên xuất sắc
                </span>
              )}
              <button 
                onClick={() => {
                  const element = document.getElementById('step-data');
                  if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="btn btn-primary"
                style={{ 
                  fontSize: '12px', 
                  padding: '8px 14px', 
                  background: 'linear-gradient(135deg, var(--color-rose) 0%, #be123c 100%)', 
                  border: 'none',
                  color: '#fff',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                👉 Chuyển Nhanh Đến Tải File (Bước 4)
              </button>
            </div>
          </div>

          <div className="grid-2" style={{ gap: '16px' }}>
            {/* Left: Payload JSON */}
            <div 
              style={{ 
                background: '#020617', 
                padding: '12px 16px', 
                borderRadius: 'var(--radius-sm)', 
                border: '1px solid rgba(255,255,255,0.05)',
                maxHeight: '160px',
                overflowY: 'auto'
              }}
            >
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                    <th style={{ textAlign: 'left', paddingBottom: '6px', fontSize: '10px', textTransform: 'uppercase' }}>Trường dữ liệu</th>
                    <th style={{ textAlign: 'left', paddingBottom: '6px', fontSize: '10px', textTransform: 'uppercase' }}>Giá trị sinh ra</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(selectedTestCase.values).map(([key, val]) => (
                    <tr key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '6px 0', fontFamily: 'var(--font-mono)', color: 'var(--color-teal)', fontWeight: 'bold' }}>{key}</td>
                      <td style={{ padding: '6px 0', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ 
                          color: String(val).includes("'") || String(val).includes("<script") || String(val).includes("--") ? 'var(--color-rose)' : 'inherit',
                          fontWeight: String(val).includes("'") || String(val).includes("<script") || String(val).includes("--") ? 'bold' : 'normal'
                        }}>
                          {String(val) === '' ? <i style={{ color: 'var(--text-muted)' }}>(Chuỗi rỗng / Empty)</i> : String(val)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Right: Scores breakdown */}
            {breakdown ? (
              <div className="flex flex-col gap-sm" style={{ fontSize: '13px' }}>
                <div className="flex justify-between align-center">
                  <span style={{ color: 'var(--text-secondary)' }}>Độ hợp lệ nghiệp vụ (Đúng định dạng):</span>
                  <span style={{ fontWeight: 'bold', color: breakdown.vScore > 0.9 ? 'var(--color-teal)' : 'var(--color-rose)' }}>
                    {(breakdown.vScore * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between align-center">
                  <span style={{ color: 'var(--text-secondary)' }}>Độ phủ cận biên (Chạm mốc Min/Max/Length):</span>
                  <span style={{ fontWeight: 'bold', color: breakdown.bScore > 0.4 ? 'var(--color-teal)' : '#94a3b8' }}>
                    {(breakdown.bScore * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between align-center">
                  <span style={{ color: 'var(--text-secondary)' }}>Mức độ bảo mật (Payload SQLi/XSS độc hại):</span>
                  <span style={{ fontWeight: 'bold', color: breakdown.sScore > 0.0 ? 'var(--color-rose)' : '#94a3b8' }}>
                    {breakdown.sScore > 0 ? `ĐẠT (${(breakdown.sScore * 100).toFixed(0)}%)` : 'Không phát hiện'}
                  </span>
                </div>
                <div className="flex justify-between align-center">
                  <span style={{ color: 'var(--text-secondary)' }}>Độ độc đáo (Tránh lặp lại dữ liệu):</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--color-violet)' }}>
                    {(breakdown.dScore * 100).toFixed(0)}%
                  </span>
                </div>
                {breakdown.penalty > 0 && (
                  <div className="flex justify-between align-center" style={{ color: 'var(--color-rose)', fontWeight: 'bold' }}>
                    <span className="flex align-center gap-sm"><AlertTriangle size={14} /> Phạt trùng lặp (Duplicate Penalty):</span>
                    <span>-{breakdown.penalty.toFixed(2)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', alignSelf: 'center', textAlign: 'center' }}>
                Đang chạy chế độ Server Playback. Điểm chất lượng chi tiết đã được tối ưu hóa toàn bộ.
              </div>
            )}
          </div>

          {/* DƯỚI ĐÂY LÀ PHẦN GIẢI THÍCH CHI TIẾT DÀNH CHO QA/TESTER */}
          {(() => {
            const explanation = getTestCaseExplanation(selectedTestCase, schema);
            if (!explanation) return null;
            
            return (
              <div 
                style={{ 
                  borderTop: '1px solid rgba(255,255,255,0.06)', 
                  paddingTop: '16px', 
                  marginTop: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-teal)', fontWeight: 'bold', fontSize: '13px' }}>
                  <Sparkles size={14} />
                  💡 BẢN PHÂN TÍCH CHUYÊN SÂU TỪ QA ANALYST (QA INSIGHTS & PURPOSE)
                </div>
                
                <div className="grid-2" style={{ gap: '16px' }}>
                  {/* Mục tiêu & Rủi ro */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)' }}>
                    <div>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '2px' }}>
                        Phân nhóm Ca Kiểm Thử
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: explanation.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {explanation.emoji} {explanation.categoryName}
                      </span>
                    </div>
                    
                    <div>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '2px' }}>
                        Mục tiêu kỹ thuật (Test Objective)
                      </div>
                      <p style={{ fontSize: '12.5px', color: 'var(--text-primary)', margin: 0, lineHeight: '1.5' }}>
                        {explanation.objective}
                      </p>
                    </div>
                    
                    <div>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-rose)', fontWeight: 'bold', marginBottom: '2px' }}>
                        Hệ quả rủi ro nếu bỏ qua (Potential Business Risk)
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>
                        {explanation.risk}
                      </p>
                    </div>
                  </div>

                  {/* Phân tích dữ liệu thực tế sinh ra */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)', maxHeight: '200px', overflowY: 'auto' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                      Ý nghĩa bộ giá trị sinh ra (Data Breakdown)
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                      {explanation.fieldExplanations.map(fe => (
                        <div key={fe.field} style={{ fontSize: '12px', lineHeight: '1.4' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-teal)', fontWeight: 'bold' }}>{fe.field}</span>
                          <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>=</span>
                          <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '3px', color: '#fff', fontSize: '11.5px', marginRight: '6px', fontFamily: 'var(--font-mono)' }}>
                            {fe.val === '' ? 'chuỗi rỗng' : fe.val}
                          </code>
                          <br />
                          <span style={{ color: 'var(--text-secondary)', fontSize: '11.5px', fontStyle: 'italic', display: 'inline-block', marginTop: '2px', paddingLeft: '8px', borderLeft: '2px solid rgba(45,212,191,0.3)' }}>
                            ↳ {fe.explanation}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 5. ĐÃ HOÀN TẤT TIẾN HÓA: THANH CHUYỂN TIẾP THÂN THIỆN (NEXT-STEP TRANSITION PANEL) */}
      {isComplete && (
        <div 
          className="glass-card flex flex-col gap-md"
          style={{ 
            background: 'linear-gradient(135deg, rgba(45,212,191,0.08) 0%, rgba(167,139,250,0.08) 100%)', 
            border: '1px solid var(--color-teal)',
            boxShadow: '0 0 25px rgba(45,212,191,0.18)',
            padding: '24px',
            borderRadius: '12px',
            marginTop: '20px',
            animation: 'pulse 3s infinite',
            textAlign: 'left'
          }}
        >
          <div className="flex align-center gap-sm">
            <Sparkles className="text-teal" size={24} style={{ color: 'var(--color-teal)' }} />
            <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: '#fff', margin: 0, letterSpacing: '0.02em' }}>
              🎉 TIẾN TRÌNH TIẾN HÓA HOÀN TẤT THÀNH CÔNG! BỘ TEST CASES TỐI ƯU SẴN SÀNG
            </h3>
          </div>
          
          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', margin: 0, lineHeight: '1.6' }}>
            Thuật toán di truyền di trú GA đã phối hợp leo đồi HC gọt giũa thành công <b>{history[history.length - 1]?.chromosomes.length} ca test</b> lý tưởng. Dữ liệu đã phủ kín biên điều kiện đầu vào, chèn payload bảo mật và triệt tiêu trùng lặp. Bạn muốn thực hiện thao tác nào tiếp theo?
          </p>

          <div className="flex gap-md" style={{ flexWrap: 'wrap', marginTop: '6px' }}>
            <button 
              onClick={() => {
                const element = document.getElementById('step-arena');
                if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="btn btn-primary"
              style={{ 
                fontSize: '12.5px', 
                padding: '10px 18px', 
                background: 'linear-gradient(135deg, var(--color-violet) 0%, #7c3aed 100%)',
                border: 'none',
                color: '#fff',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                gap: '6px',
                transition: 'all 0.3s'
              }}
            >
              ⚔️ Sang Đấu Trường Đối Kháng (Bước 3) &rarr;
            </button>

            <button 
              onClick={() => {
                const element = document.getElementById('step-data');
                if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="btn btn-primary glow-teal"
              style={{ 
                fontSize: '12.5px', 
                padding: '10px 18px', 
                background: 'linear-gradient(135deg, var(--color-teal) 0%, #0d9488 100%)',
                border: 'none',
                color: '#fff',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                gap: '6px',
                transition: 'all 0.3s'
              }}
            >
              📥 Đi Tải File &amp; Test API Sandbox (Bước 4) &rarr;
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
