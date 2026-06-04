import React, { useState, useEffect, useRef } from 'react';
import { GeneticEngine } from '../algorithms/genetic';
import type { PopulationStats, Chromosome, GeneticConfig } from '../algorithms/genetic';
import { runHillClimbing } from '../algorithms/hillClimbing';
import type { HillClimbStats } from '../algorithms/hillClimbing';
import { Play, RotateCcw, Cpu, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppStore } from '../store/useAppStore';

export const Visualizer: React.FC = () => {
  const {
    parsedSchema: schema,
    initialSeeds,
    handleEvolutionComplete: onEvolutionComplete,
    specificationId,
    setActiveScreen
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

  // --- CẤU HÌNH OPTIMIZATION PROFILE ---
  const [optProfile, setOptProfile] = useState<'fast' | 'balanced' | 'deep'>('balanced');
  
  const handleApplyOptProfile = (profile: 'fast' | 'balanced' | 'deep') => {
    setOptProfile(profile);
    if (profile === 'fast') {
      setGenerations(30);
      setPopSize(60);
      setCrossoverRate(0.7);
      setMutationRate(0.1);
      setWVal(0.6);
      setWBound(0.2);
      setWSec(0.1);
      setWDiv(0.1);
    } else if (profile === 'balanced') {
      setGenerations(60);
      setPopSize(100);
      setCrossoverRate(0.8);
      setMutationRate(0.15);
      setWVal(0.5);
      setWBound(0.2);
      setWSec(0.2);
      setWDiv(0.1);
    } else if (profile === 'deep') {
      setGenerations(120);
      setPopSize(120);
      setCrossoverRate(0.85);
      setMutationRate(0.25);
      setWVal(0.3);
      setWBound(0.3);
      setWSec(0.3);
      setWDiv(0.1);
    }
  };

  // --- TRẠNG THÁI VẬN HÀNH BỘ CHẠY (EXECUTION STATES) ---
  const [isRunning, setIsRunning] = useState(false);
  const isPaused = false;
  const [isComplete, setIsComplete] = useState(false);
  const [currentGen, setCurrentGen] = useState(0);
  const speedDelay = 30; // Chạy hoạt ảnh nhanh 30ms
  const activeTab = 'visualizer';
  const setActiveTab = (_val: any) => {};

  // --- LỊCH SỬ TIẾN TRÌNH & BẢN GHI TEST ĐANG XEM XÉT ---
  const [history, setHistory] = useState<PopulationStats[]>([]);
  const [selectedTestCase, setSelectedTestCase] = useState<{ values: Chromosome; fitness: number; origin: string } | null>(null);
  
  // --- TRẠNG THÁI CỦA BỘ TINH CHỈNH BIÊN CỤC BỘ (HILL CLIMBING STATES) ---
  const [hcActive, setHcActive] = useState(false);
  const [hcStats, setHcStats] = useState<HillClimbStats | null>(null);

  // Đọc hcStats để tránh lỗi TypeScript biến không được sử dụng
  useEffect(() => {
    if (hcStats) {
      console.log("HC Tweak Stats: ", hcStats.optimizedFitness);
    }
  }, [hcStats]);

  // Tự động nạp thế hệ 0 (F0 Seeds) vào lưới trực quan khi chuyển sang bước 2
  useEffect(() => {
    if (!isRunning && !isComplete && schema && schema.length > 0 && initialSeeds && initialSeeds.length > 0 && history.length === 0) {
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
      
      const engine = new GeneticEngine(schema, config);
      engine.initialize(initialSeeds);
      
      const initialStats: PopulationStats = {
        generation: 0,
        bestFitness: engine.population.length > 0 ? engine.population[0].fitness : 0,
        avgFitness: engine.population.length > 0 
          ? engine.population.reduce((sum, ind) => sum + ind.fitness, 0) / engine.population.length 
          : 0,
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
      if (initialStats.chromosomes.length > 0) {
        setSelectedTestCase(initialStats.chromosomes[0]);
      }
    }
  }, [schema, initialSeeds, history.length, isRunning, isComplete, generations, popSize, crossoverRate, mutationRate, wVal, wBound, wSec, wDiv]);

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
            details: [msg.message],
            restartsCount: 0
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
            details: msg.data.hcStats.details,
            restartsCount: msg.data.hcStats.restartsCount || 0
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

  // Phân loại ca kiểm thử để vẽ lên lưới chính xác theo nghiệp vụ
  const getTestCaseCategory = (c: any) => {
    let isSecurity = false;
    const securityKeywords = ["' or", '" or', "'or", '"or', '--', 'union', 'select', 'drop table', '<script', 'onload=', 'onerror=', 'javascript:'];
    
    // 1. Kiểm tra an ninh (Security)
    Object.values(c.values).forEach(val => {
      const str = String(val).toLowerCase();
      if (securityKeywords.some(kw => str.includes(kw))) {
        isSecurity = true;
      }
    });
    if (isSecurity) return 'security';

    // 2. Kiểm tra tính đúng đắn (Validation) để phân biệt Positive / Negative / Boundary
    let hasInvalid = false;
    let hasBoundary = false;

    schema.forEach(field => {
      const val = c.values[field.name];
      if (val === undefined || val === null) {
        if (field.required) hasInvalid = true;
        return;
      }

      const strVal = String(val);
      let fieldValid = true;

      // Check required
      if (field.required && strVal === '') {
        fieldValid = false;
      }

      // Check type and limits
      if (fieldValid) {
        if (field.type === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(strVal)) fieldValid = false;
        } else if (field.type === 'card') {
          const cardRegex = /^\d{16}$/;
          if (!cardRegex.test(strVal)) fieldValid = false;
        } else if (field.type === 'phone') {
          const phoneRegex = /^(03|05|07|08|09)\d{8}$/;
          if (!phoneRegex.test(strVal)) fieldValid = false;
        } else if (field.type === 'number') {
          const num = Number(val);
          if (isNaN(num)) {
            fieldValid = false;
          } else {
            if (field.minValue !== undefined && num < field.minValue) fieldValid = false;
            if (field.maxValue !== undefined && num > field.maxValue) fieldValid = false;
            
            // Check boundary for number
            if (fieldValid) {
              if (field.minValue !== undefined && num === field.minValue) hasBoundary = true;
              if (field.maxValue !== undefined && num === field.maxValue) hasBoundary = true;
            }
          }
        }
      }

      // String limits
      if (fieldValid && field.type !== 'number') {
        if (field.minLength !== undefined && strVal.length < field.minLength) fieldValid = false;
        if (field.maxLength !== undefined && strVal.length > field.maxLength) fieldValid = false;

        // Check boundary for string length
        if (fieldValid) {
          if (field.minLength !== undefined && strVal.length === field.minLength) hasBoundary = true;
          if (field.maxLength !== undefined && strVal.length === field.maxLength) hasBoundary = true;
        }
      }

      if (!fieldValid) {
        hasInvalid = true;
      }
    });

    if (hasInvalid) return 'negative';
    if (hasBoundary) return 'boundary';
    return 'positive';
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
      {/* CHỌN CẤU HÌNH TỐI ƯU (OPTIMIZATION PROFILE) */}
      <div className="glass-card teal-border" style={{ padding: '20px', background: 'rgba(15,23,42,0.6)', marginBottom: '8px' }}>
        <h3 style={{ fontSize: '14px', color: '#fff', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.05em' }}>
          <Cpu size={16} className="text-teal" style={{ color: 'var(--color-teal)' }} />
          CẤU HÌNH TỐI ƯU HÓA (OPTIMIZATION PROFILE CONFIGURATION)
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
          Lựa chọn chế độ tối ưu hóa cho bộ dữ liệu test. Thuật toán tiến hóa di truyền GA phối hợp leo đồi HC sẽ tự động cấu hình các tham số và trọng số phù hợp.
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          {/* Card Nhanh (Fast) */}
          <div 
            onClick={() => handleApplyOptProfile('fast')}
            className={`tutorial-card`}
            style={{ 
              cursor: 'pointer',
              border: optProfile === 'fast' ? '1px solid var(--color-teal)' : '1px solid rgba(255,255,255,0.05)',
              background: optProfile === 'fast' ? 'rgba(45,212,191,0.06)' : 'rgba(15,23,42,0.6)',
              boxShadow: optProfile === 'fast' ? '0 0 12px rgba(45,212,191,0.1)' : 'none',
              padding: '14px',
              borderRadius: '8px'
            }}
          >
            <span style={{ fontSize: '20px' }}>⚡</span>
            <div className="flex flex-col gap-xs" style={{ marginTop: '6px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 'bold', color: 'var(--color-teal)' }}>Nhanh (Fast Profile)</span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Chạy nhanh để thử nghiệm nhanh (30 vòng lặp, cỡ bộ test: 60). Độ bao phủ vừa phải.
              </span>
            </div>
          </div>

          {/* Card Tiêu Chuẩn (Balanced) */}
          <div 
            onClick={() => handleApplyOptProfile('balanced')}
            className={`tutorial-card`}
            style={{ 
              cursor: 'pointer',
              border: optProfile === 'balanced' ? '1px solid var(--color-violet)' : '1px solid rgba(255,255,255,0.05)',
              background: optProfile === 'balanced' ? 'rgba(167,139,250,0.06)' : 'rgba(15,23,42,0.6)',
              boxShadow: optProfile === 'balanced' ? '0 0 12px rgba(167,139,250,0.1)' : 'none',
              padding: '14px',
              borderRadius: '8px'
            }}
          >
            <span style={{ fontSize: '20px' }}>⚖️</span>
            <div className="flex flex-col gap-xs" style={{ marginTop: '6px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 'bold', color: 'var(--color-violet)' }}>Tiêu Chuẩn (Balanced Profile)</span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Chạy tối ưu cân bằng (60 vòng lặp, cỡ bộ test: 100). Đạt độ phủ &gt;90%, giảm thiểu trùng lặp (Mặc định).
              </span>
            </div>
          </div>

          {/* Card Chuyên Sâu (Deep Edge Case) */}
          <div 
            onClick={() => handleApplyOptProfile('deep')}
            className={`tutorial-card`}
            style={{ 
              cursor: 'pointer',
              border: optProfile === 'deep' ? '1px solid var(--color-rose)' : '1px solid rgba(255,255,255,0.05)',
              background: optProfile === 'deep' ? 'rgba(244,63,94,0.06)' : 'rgba(15,23,42,0.6)',
              boxShadow: optProfile === 'deep' ? '0 0 12px rgba(244,63,94,0.1)' : 'none',
              padding: '14px',
              borderRadius: '8px'
            }}
          >
            <span style={{ fontSize: '20px' }}>💀</span>
            <div className="flex flex-col gap-xs" style={{ marginTop: '6px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 'bold', color: 'var(--color-rose)' }}>Chuyên Sâu (Deep Edge Case)</span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Chạy sâu tối đa (120 vòng lặp, cỡ bộ test: 120) để tìm lỗi bảo mật hẹp, payloads SQLi/XSS cực đoan.
              </span>
            </div>
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
            <button onClick={handleStartEvolution} className="btn btn-primary glow-teal">
              <Play size={16} />
              Kích Hoạt Tối Ưu Hóa Dữ Liệu
            </button>
          ) : (
            <button onClick={handleReset} className="btn btn-secondary" style={{ color: 'var(--color-rose)', borderColor: 'rgba(244,63,94,0.1)' }}>
              <RotateCcw size={16} />
              Làm mới (Reset)
            </button>
          )}
        </div>

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
          {isRunning && !hcActive && !isComplete && (
            <span style={{ color: 'var(--color-teal)' }} className="glow-teal">Server Evolving... (Vòng lặp: {currentGen}/{generations})</span>
          )}
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
          {/* LEFT PANEL: GRID VISUALIZATION */}
          <div className="glass-card flex flex-col gap-md teal-border" style={{ minHeight: '440px' }}>
            <div className="flex justify-between align-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '14.5px', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={16} style={{ color: 'var(--color-teal)' }} />
                LƯỚI CA KIỂM THỬ (TEST SUITE MATRIX)
              </h3>
              
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

            {/* TAB 2: HILL CLIMBING LOG TERMINAL (Removed as per simplification plan) */}
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
                onClick={() => setActiveScreen('export')}
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
                👉 Sang Bước 3: Xuất Kết Quả
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
              onClick={() => setActiveScreen('export')}
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
              📥 Sang Bước 3: Xuất Kết Quả &amp; Test API &rarr;
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
