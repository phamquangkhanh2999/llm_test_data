import React, { useState, useEffect, useRef } from 'react';
import type { FieldConstraint } from '../algorithms/presets';
import { GeneticEngine } from '../algorithms/genetic';
import type { PopulationStats, Chromosome, GeneticConfig } from '../algorithms/genetic';
import { runHillClimbing } from '../algorithms/hillClimbing';
import type { HillClimbStats } from '../algorithms/hillClimbing';
import { Play, Pause, RotateCcw, SkipForward, Cpu, CheckCircle, TrendingUp, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface VisualizerProps {
  schema: FieldConstraint[];
  initialSeeds: Chromosome[];
  onEvolutionComplete: (results: Chromosome[], stats: PopulationStats[], hcStats?: HillClimbStats) => void;
  specificationId: string; // ID của đặc tả trong SQLite CSDL Backend
  apiKey?: string; // Khóa OpenAI API Key override từ Header
}

export const Visualizer: React.FC<VisualizerProps> = ({
  schema,
  initialSeeds,
  onEvolutionComplete,
  specificationId
}) => {
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
        chromosomes: engine.population.slice(0, 10).map(p => ({
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
        chromosomes: engine.population.slice(0, 10).map(p => ({
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
    best: parseFloat(h.bestFitness.toFixed(3)),
    avg: parseFloat(h.avgFitness.toFixed(3))
  }));

  // Hàm ánh xạ điểm chất lượng sang màu sắc ô lưới test case
  const getCellClass = (fit: number) => {
    if (fit < 0.4) return 'cell-fit-low';
    if (fit < 0.75) return 'cell-fit-mid';
    return 'cell-fit-high';
  };

  // Tính cơ cấu điểm chất lượng của ca test đang soi
  const getBreakdown = () => {
    if (!selectedTestCase || !engineRef.current) return null;
    const rawPop = engineRef.current.population.map(p => p.values);
    const res = engineRef.current.computeFitness(selectedTestCase.values, rawPop);
    return res.scoreBreakdown;
  };

  const breakdown = getBreakdown();

  return (
    <div className="flex flex-col gap-lg" style={{ marginTop: '16px' }}>
      
      {/* 1. CONFIGURATION & WEIGHTS SLIDERS */}
      <div className="grid-2">
        <div className="glass-card flex flex-col gap-md teal-border">
          <div className="flex align-center gap-sm">
            <Cpu size={22} className="text-teal" style={{ color: 'var(--color-teal)' }} />
            <h3>Cấu hình thuật toán di truyền di trú (GA Config)</h3>
          </div>

          <div className="flex flex-col gap-sm" style={{ marginTop: '8px' }}>
            <div className="flex justify-between" style={{ fontSize: '13px' }}>
              <div className="flex flex-col">
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Vòng lặp tối ưu hóa (Generations):</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Số chu kỳ cải tiến; số lớn giúp tìm lỗi biên sâu hơn nhưng chạy lâu hơn.</span>
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
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Kích thước tập ca test (Population Size):</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Số lượng bản ghi dữ liệu kiểm thử được tối ưu hóa trong tập kết quả.</span>
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
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Tỉ lệ trộn tham số (Crossover Rate):</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Xác suất kết hợp các trường từ các ca test tốt để tạo ra bộ giá trị mới.</span>
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
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Tỉ lệ biến đổi dữ liệu (Mutation Rate):</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Xác suất sinh ký tự đặc biệt, chuỗi biên để phát hiện kịch bản lỗi.</span>
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
            <h3>Trọng số đánh giá chất lượng ca kiểm thử (Weights)</h3>
          </div>

          <div className="flex flex-col gap-sm" style={{ marginTop: '8px' }}>
            <div className="flex justify-between" style={{ fontSize: '13px' }}>
              <div className="flex flex-col">
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Khớp định dạng nghiệp vụ (Validation Score):</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Mức độ ưu tiên khớp định dạng ràng buộc như Email, Số điện thoại, v.v.</span>
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
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Độ bao phủ giá trị biên (Boundary Score):</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Mức độ ưu tiên kiểm thử các giá trị cận trên, cận dưới, độ dài max/min.</span>
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
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Độ bao phủ lỗ hổng bảo mật (Security Score):</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Mức độ ưu tiên chèn các payload tấn công nguy hiểm như SQL Injection, XSS.</span>
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
                <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Độ đa dạng tập dữ liệu (Diversity Score):</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Giữ cho các ca kiểm thử khác biệt lẫn nhau, tránh trùng lặp thông tin.</span>
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

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedTestCase(c)}
                        className={`chromosome-cell ${getCellClass(c.fitness)} ${animClass}`}
                        style={{
                          border: isSelected ? '2px solid #fff' : '',
                          boxShadow: isSelected ? '0 0 12px #fff' : '',
                          transform: isSelected ? 'scale(1.1)' : ''
                        }}
                        title={`Quality Score: ${c.fitness.toFixed(3)}`}
                      >
                        {c.fitness.toFixed(2)}
                      </div>
                    );
                  })}
                  
                  {/* Fill empty cells */}
                  {Array(Math.max(0, 100 - history[history.length - 1].chromosomes.length)).fill(0).map((_, i) => (
                    <div key={`empty-${i}`} className="chromosome-cell cell-fit-low" style={{ opacity: 0.1 }}>
                      -
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex gap-md" style={{ fontSize: '12px', justifyContent: 'center', marginTop: 'auto' }}>
                  <span className="flex align-center gap-sm"><span style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'rgba(244,63,94,0.15)', border: '1px solid var(--color-rose)' }}></span> Chất lượng kém (&lt; 0.4)</span>
                  <span className="flex align-center gap-sm"><span style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'rgba(167,139,250,0.15)', border: '1px solid var(--color-violet)' }}></span> Trung bình</span>
                  <span className="flex align-center gap-sm"><span style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'rgba(45,212,191,0.15)', border: '1px solid var(--color-teal)' }}></span> Xuất sắc (&gt; 0.75)</span>
                </div>
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
              <h3>Đồ Thị Chất Lượng Bộ Test (Quality Trend)</h3>
              <div className="flex gap-md" style={{ fontSize: '12px' }}>
                <span className="flex align-center gap-sm"><span style={{ width: '8px', height: '8px', background: 'var(--color-teal)', borderRadius: '50%' }}></span> Chất lượng Max</span>
                <span className="flex align-center gap-sm"><span style={{ width: '8px', height: '8px', background: 'var(--color-violet)', borderRadius: '50%' }}></span> Chất lượng Trung bình</span>
              </div>
            </div>

            <div style={{ flex: 1, width: '100%', minHeight: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="gen" stroke="var(--text-muted)" fontSize={11} />
                  <YAxis domain={[0.0, 1.0]} stroke="var(--text-muted)" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ background: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }}
                    labelFormatter={(label) => `Vòng lặp cải tiến: ${label}`}
                  />
                  <Line type="monotone" dataKey="best" stroke="var(--color-teal)" strokeWidth={2.5} dot={false} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="avg" stroke="var(--color-violet)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
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
        <div className="glass-card flex flex-col gap-md violet-border" style={{ background: 'rgba(15,23,42,0.85)' }}>
          <div className="flex justify-between align-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
            <div className="flex align-center gap-sm">
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
                Giải thuật sinh: {selectedTestCase.origin}
              </span>
              <h4 style={{ fontFamily: 'var(--font-mono)' }}>Chi Tiết Ca Kiểm Thử (Điểm chất lượng: {selectedTestCase.fitness.toFixed(4)})</h4>
            </div>

            {selectedTestCase.fitness > 0.85 && (
              <span className="flex align-center gap-sm" style={{ color: 'var(--color-teal)', fontSize: '12px' }}>
                <CheckCircle size={14} /> Ca kiểm thử biên chất lượng cao
              </span>
            )}
          </div>

          <div className="grid-2" style={{ gap: '16px' }}>
            {/* Left: Payload JSON */}
            <div 
              style={{ 
                background: '#020617', 
                padding: '12px 16px', 
                borderRadius: 'var(--radius-sm)', 
                border: '1px solid rgba(255,255,255,0.05)',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                lineHeight: '1.6',
                maxHeight: '160px',
                overflowY: 'auto'
              }}
            >
              <pre style={{ color: 'var(--color-teal)' }}>
                {JSON.stringify(selectedTestCase.values, null, 2)}
              </pre>
            </div>

            {/* Right: Scores breakdown */}
            {breakdown ? (
              <div className="flex flex-col gap-sm" style={{ fontSize: '13px' }}>
                <div className="flex justify-between align-center">
                  <span style={{ color: 'var(--text-secondary)' }}>Nghiệp vụ (Khớp định dạng ràng buộc):</span>
                  <span style={{ fontWeight: 'bold', color: breakdown.vScore > 0.9 ? 'var(--color-teal)' : 'var(--color-rose)' }}>
                    {(breakdown.vScore * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between align-center">
                  <span style={{ color: 'var(--text-secondary)' }}>Giá trị biên (Cận trên / cận dưới / độ dài):</span>
                  <span style={{ fontWeight: 'bold', color: breakdown.bScore > 0.4 ? 'var(--color-teal)' : '#94a3b8' }}>
                    {(breakdown.bScore * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between align-center">
                  <span style={{ color: 'var(--text-secondary)' }}>Bảo mật (Payload tấn công SQLi/XSS):</span>
                  <span style={{ fontWeight: 'bold', color: breakdown.sScore > 0.0 ? 'var(--color-rose)' : '#94a3b8' }}>
                    {breakdown.sScore > 0 ? `ĐẠT (${(breakdown.sScore * 100).toFixed(0)}%)` : 'Không phát hiện'}
                  </span>
                </div>
                <div className="flex justify-between align-center">
                  <span style={{ color: 'var(--text-secondary)' }}>Độ đa dạng (So với tập dữ liệu):</span>
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

    </div>
  );
};
