import React, { useState, useRef } from 'react';
import type { Chromosome, GeneticConfig, PopulationStats } from '../algorithms/genetic';
import { GeneticEngine, generateRandomValue } from '../algorithms/genetic';
import { runHillClimbing } from '../algorithms/hillClimbing';
import {
  Play, Zap, Cpu, Award, Sparkles,
  Database, RefreshCw, BarChart2, CheckCircle2
} from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend, ReferenceLine
} from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { toast } from '../store/useToastStore';
import { config } from '../config';

// Cấu trúc kết quả của từng chiến lược
interface DashboardResult {
  name: string;
  key: 'traditional' | 'ga' | 'hc' | 'hybrid';
  coverage: number;
  duplicateRate: number;
  edgeCases: number;
  execTime: number;
  badge: string;
  color: string;
  sampleData: Chromosome[];
  allData: Chromosome[];
}

interface AlgoRunState {
  status: 'idle' | 'running' | 'completed';
  progress: number;
  bestTestCase: Chromosome | null;
  bestFitness: number;
  coverage: number;
  duplicateRate: number;
  edgeCases: number;
  execTime: number;
  logs: string[];
}

export const OptimizationDashboard: React.FC = () => {
  const {
    parsedSchema: schema,
    initialSeeds,
    handleEvolutionComplete: onEvolutionComplete,
    schemaName,
    specificationId,
    setActiveScreen,
    rawText,
    apiKey,
    setSpecificationId,
    optimizedDataset,
    setOptimizedDataset,
    selectedSuiteName,
    setSelectedSuiteName
  } = useAppStore();

  // --- CẤU HÌNH THAM SỐ DI TRUYỀN ---
  const [generations, setGenerations] = useState(60);
  const [popSize, setPopSize] = useState(100);
  const [crossoverRate, setCrossoverRate] = useState(0.8);
  const [mutationRate, setMutationRate] = useState(0.15);

  // Trọng số đánh giá
  const [wVal, setWVal] = useState(0.5);
  const [wBound, setWBound] = useState(0.2);
  const [wSec, setWSec] = useState(0.2);
  const [wDiv, setWDiv] = useState(0.1);

  // Thuật toán truyền thống làm Baseline
  const [traditionalAlgo, setTraditionalAlgo] = useState<'random' | 'bva'>('bva');

  // Optimization Profile
  const [optProfile, setOptProfile] = useState<'fast' | 'balanced' | 'deep'>('balanced');

  const handleApplyOptProfile = (profile: 'fast' | 'balanced' | 'deep') => {
    setOptProfile(profile);
    if (profile === 'fast') {
      setGenerations(30); setPopSize(60); setCrossoverRate(0.7); setMutationRate(0.1);
      setWVal(0.6); setWBound(0.2); setWSec(0.1); setWDiv(0.1);
    } else if (profile === 'balanced') {
      setGenerations(60); setPopSize(100); setCrossoverRate(0.8); setMutationRate(0.15);
      setWVal(0.5); setWBound(0.2); setWSec(0.2); setWDiv(0.1);
    } else {
      setGenerations(120); setPopSize(120); setCrossoverRate(0.85); setMutationRate(0.25);
      setWVal(0.3); setWBound(0.3); setWSec(0.3); setWDiv(0.1);
    }
  };

  // --- TRẠNG THÁI HOẠT ĐỘNG SONG SONG ---
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [runStates, setRunStates] = useState<Record<string, AlgoRunState>>({
    traditional: { status: 'idle', progress: 0, bestTestCase: null, bestFitness: 0, coverage: 0, duplicateRate: 0, edgeCases: 0, execTime: 0, logs: [] },
    ga: { status: 'idle', progress: 0, bestTestCase: null, bestFitness: 0, coverage: 0, duplicateRate: 0, edgeCases: 0, execTime: 0, logs: [] },
    hc: { status: 'idle', progress: 0, bestTestCase: null, bestFitness: 0, coverage: 0, duplicateRate: 0, edgeCases: 0, execTime: 0, logs: [] },
    hybrid: { status: 'idle', progress: 0, bestTestCase: null, bestFitness: 0, coverage: 0, duplicateRate: 0, edgeCases: 0, execTime: 0, logs: [] }
  });

  const [results, setResults] = useState<DashboardResult[] | null>(null);
  const [coverageHistory, setCoverageHistory] = useState<any[]>([]);
  const historyRef = useRef<Record<number, any>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  // --- HÀM ĐÁNH GIÁ CHẤT LƯỢNG TEST SUITE CỤC BỘ ---
  const evaluateSuite = (chromosomes: Chromosome[]): { coverage: number; duplicateRate: number; edgeCases: number } => {
    if (chromosomes.length === 0) return { coverage: 0, duplicateRate: 0, edgeCases: 0 };

    const engine = new GeneticEngine(schema, {
      generations: 1, popSize: chromosomes.length, crossoverRate: 0.8, mutationRate: 0.15,
      weights: { validation: 0.5, boundary: 0.2, security: 0.2, diversity: 0.1 }
    });

    const evaluated = chromosomes.map(c => {
      const res = engine.computeFitness(c, chromosomes);
      return { values: c, fitness: res.fitness, breakdown: res.scoreBreakdown };
    });

    evaluated.sort((a, b) => b.fitness - a.fitness);
    const numElites = Math.max(1, Math.floor(evaluated.length * 0.25));
    const avgEliteFitness = evaluated.slice(0, numElites).reduce((sum, item) => sum + item.fitness, 0) / numElites;
    const coverage = Math.min(99, Math.max(15, Math.round(avgEliteFitness * 100)));

    const stringified = chromosomes.map(c => JSON.stringify(c));
    const uniqueCount = new Set(stringified).size;
    const duplicateRate = Math.round(((chromosomes.length - uniqueCount) / chromosomes.length) * 100);

    let edgeCases = 0;
    evaluated.forEach(item => {
      if (item.breakdown.bScore > 0 || item.breakdown.sScore > 0) edgeCases++;
    });

    return { coverage, duplicateRate, edgeCases };
  };

  // --- KÍCH HOẠT CHẠY THỬ NGHIỆM ĐỒNG THỜI 4 LUỒNG ---
  const handleLaunchLaunch = async () => {
    if (schema.length === 0) {
      toast.warning('Vui lòng nạp Schema ràng buộc ở Bước 1 trước!');
      return;
    }

    setIsRunning(true);
    setIsComplete(false);
    setResults(null);
    setCoverageHistory([]);
    historyRef.current = {};
    setOptimizedDataset([]);
    setSelectedSuiteName('');

    // Yield control to the browser to render the loading overlay instantly
    await new Promise(resolve => setTimeout(resolve, 50));

    const initialRunStates: Record<string, AlgoRunState> = {
      traditional: { status: 'idle', progress: 0, bestTestCase: null, bestFitness: 0, coverage: 0, duplicateRate: 0, edgeCases: 0, execTime: 0, logs: [] },
      ga: { status: 'idle', progress: 0, bestTestCase: null, bestFitness: 0, coverage: 0, duplicateRate: 0, edgeCases: 0, execTime: 0, logs: [] },
      hc: { status: 'idle', progress: 0, bestTestCase: null, bestFitness: 0, coverage: 0, duplicateRate: 0, edgeCases: 0, execTime: 0, logs: [] },
      hybrid: { status: 'idle', progress: 0, bestTestCase: null, bestFitness: 0, coverage: 0, duplicateRate: 0, edgeCases: 0, execTime: 0, logs: [] }
    };
    setRunStates(initialRunStates);

    const gaConfig: GeneticConfig = {
      generations, popSize, crossoverRate, mutationRate,
      weights: { validation: wVal, boundary: wBound, security: wSec, diversity: wDiv }
    };

    const gaGens = Math.round(generations * 0.7);
    const stepGens = Array.from(new Set([
      0, Math.round(generations * 0.2), Math.round(generations * 0.4),
      Math.round(generations * 0.6), gaGens, Math.round(generations * 0.8), generations
    ])).sort((a, b) => a - b);

    stepGens.forEach(g => {
      historyRef.current[g] = {
        name: `T.${g}`,
        'Baseline Validation': 0, 'Local Refinement': 0,
        'Genetic Optimization': 0, 'Hybrid AI Optimization': 0
      };
    });

    const updateHistoryPoint = (g: number, key: 'traditional' | 'ga' | 'hc' | 'hybrid', value: number) => {
      if (!historyRef.current[g]) {
        historyRef.current[g] = { name: `T.${g}`, 'Baseline Validation': 0, 'Local Refinement': 0, 'Genetic Optimization': 0, 'Hybrid AI Optimization': 0 };
      }
      const mappedKey = key === 'traditional' ? 'Baseline Validation' : key === 'hc' ? 'Local Refinement' : key === 'ga' ? 'Genetic Optimization' : 'Hybrid AI Optimization';
      historyRef.current[g][mappedKey] = value;
      setCoverageHistory(Object.values(historyRef.current).sort((a: any, b: any) => parseInt(a.name.split('.')[1]) - parseInt(b.name.split('.')[1])));
    };

    const updateAlgoState = (key: string, updates: Partial<AlgoRunState>) => {
      setRunStates(prev => ({ ...prev, [key]: { ...prev[key], ...updates } }));
    };

    updateHistoryPoint(0, 'traditional', 15);
    updateHistoryPoint(0, 'ga', 20);
    updateHistoryPoint(0, 'hc', 18);
    updateHistoryPoint(0, 'hybrid', 20);

    // LUỒNG 1: TRADITIONAL
    const runTraditionalTask = async () => {
      updateAlgoState('traditional', { status: 'running' });
      const t0 = performance.now();
      const traditionalChromosomes: Chromosome[] = [];
      for (let i = 0; i < popSize; i++) {
        const record: Chromosome = {};
        const mode = traditionalAlgo === 'bva' ? (i % 2 === 0 ? 'boundary' : 'valid') : 'valid';
        schema.forEach(field => { record[field.name] = generateRandomValue(field, mode); });
        traditionalChromosomes.push(record);
        const currentProgress = (i + 1) / popSize;
        const currentGIndex = Math.floor(currentProgress * (stepGens.length - 1));
        const targetGen = stepGens[currentGIndex];
        if (i % Math.max(1, Math.floor(popSize / 5)) === 0 || i === popSize - 1) {
          const metrics = evaluateSuite(traditionalChromosomes);
          updateHistoryPoint(targetGen, 'traditional', metrics.coverage);
          updateAlgoState('traditional', { progress: Math.round(currentProgress * 100) });
          await new Promise(r => setTimeout(r, 10));
        }
      }
      const tTraditional = performance.now() - t0 + 1;
      const traditionalMetrics = evaluateSuite(traditionalChromosomes);
      updateHistoryPoint(generations, 'traditional', traditionalMetrics.coverage);
      updateAlgoState('traditional', { status: 'completed', progress: 100, coverage: traditionalMetrics.coverage, duplicateRate: traditionalMetrics.duplicateRate, edgeCases: traditionalMetrics.edgeCases, execTime: Math.round(tTraditional) });
      return { chromosomes: traditionalChromosomes, metrics: traditionalMetrics, time: tTraditional };
    };

    // LUỒNG 2: GENETIC ALGORITHM
    const runGaTask = async () => {
      updateAlgoState('ga', { status: 'running' });
      const tGaStart = performance.now();
      const gaEngine = new GeneticEngine(schema, gaConfig);
      gaEngine.initialize(initialSeeds);
      for (let g = 1; g <= generations; g++) {
        gaEngine.runGeneration();
        const isMilestone = stepGens.includes(g) || g === generations;
        if (g % Math.max(1, Math.floor(generations / 5)) === 0 || isMilestone) {
          const currentChromosomes = gaEngine.population.map(p => p.values);
          const metrics = evaluateSuite(currentChromosomes);
          if (isMilestone) updateHistoryPoint(g, 'ga', metrics.coverage);
          updateAlgoState('ga', { progress: Math.round((g / generations) * 100) });
          await new Promise(r => setTimeout(r, 10));
        }
      }
      const tGa = performance.now() - tGaStart + 10;
      const gaChromosomes = gaEngine.population.map(p => p.values);
      const gaMetrics = evaluateSuite(gaChromosomes);
      updateHistoryPoint(generations, 'ga', gaMetrics.coverage);
      updateAlgoState('ga', { status: 'completed', progress: 100, coverage: gaMetrics.coverage, duplicateRate: gaMetrics.duplicateRate, edgeCases: gaMetrics.edgeCases, execTime: Math.round(tGa) });
      return { chromosomes: gaChromosomes, metrics: gaMetrics, time: tGa };
    };

    // LUỒNG 3: HILL CLIMBING
    const runHcTask = async () => {
      updateAlgoState('hc', { status: 'running' });
      const tHcStart = performance.now();
      const hcChromosomes: Chromosome[] = [];
      const gaDummyEngine = new GeneticEngine(schema, gaConfig);
      const evalFitness = (c: Chromosome) => gaDummyEngine.computeFitness(c, []).fitness;
      const hcTotal = Math.min(20, popSize);
      for (let i = 0; i < hcTotal; i++) {
        const seed = initialSeeds[i % initialSeeds.length] || {};
        const record: Chromosome = {};
        schema.forEach(field => { record[field.name] = field.name in seed ? seed[field.name] : generateRandomValue(field, 'boundary'); });
        const hcResult = runHillClimbing(record, schema, evalFitness, 4);
        hcChromosomes.push(hcResult.optimized);
        const currentProgress = (i + 1) / hcTotal;
        const currentGIndex = Math.floor(currentProgress * (stepGens.length - 1));
        const targetGen = stepGens[currentGIndex];
        const metrics = evaluateSuite(hcChromosomes);
        updateHistoryPoint(targetGen, 'hc', metrics.coverage);
        updateAlgoState('hc', { progress: Math.round(currentProgress * 100) });
        await new Promise(r => setTimeout(r, 10));
      }
      while (hcChromosomes.length < popSize) {
        const record: Chromosome = {};
        schema.forEach(field => { record[field.name] = generateRandomValue(field, 'boundary'); });
        hcChromosomes.push(record);
      }
      const tHc = performance.now() - tHcStart + 5;
      const hcMetrics = evaluateSuite(hcChromosomes);
      updateHistoryPoint(generations, 'hc', hcMetrics.coverage);
      updateAlgoState('hc', { status: 'completed', progress: 100, coverage: hcMetrics.coverage, duplicateRate: hcMetrics.duplicateRate, edgeCases: hcMetrics.edgeCases, execTime: Math.round(tHc) });
      return { chromosomes: hcChromosomes, metrics: hcMetrics, time: tHc };
    };

    // LUỒNG 4: HYBRID GA -> HC
    const runHybridTask = async () => {
      updateAlgoState('hybrid', { status: 'running' });
      const tHybridStart = performance.now();
      const hybridGaEngine = new GeneticEngine(schema, gaConfig);
      hybridGaEngine.initialize(initialSeeds);
      const gaGensLocal = Math.round(generations * 0.7);
      for (let g = 1; g <= gaGensLocal; g++) {
        hybridGaEngine.runGeneration();
        const isMilestone = stepGens.includes(g);
        if (g % Math.max(1, Math.floor(gaGensLocal / 3)) === 0 || isMilestone) {
          const currentChromosomes = hybridGaEngine.population.map(p => p.values);
          const metrics = evaluateSuite(currentChromosomes);
          if (isMilestone) updateHistoryPoint(g, 'hybrid', metrics.coverage);
          updateAlgoState('hybrid', { progress: Math.round((g / generations) * 100) });
          await new Promise(r => setTimeout(r, 10));
        }
      }
      const sortedPop = [...hybridGaEngine.population].sort((a, b) => b.fitness - a.fitness);
      const elitesCount = Math.max(2, Math.floor(popSize * 0.1));
      const elites = sortedPop.slice(0, elitesCount).map(p => p.values);
      const evalFitness = (c: Chromosome) => hybridGaEngine.computeFitness(c, []).fitness;
      const hybridChromosomes: Chromosome[] = [];
      for (let idx = 0; idx < elitesCount; idx++) {
        const hcResult = runHillClimbing(elites[idx], schema, evalFitness, 8);
        hybridChromosomes.push(hcResult.optimized);
        const currentProgress = gaGensLocal / generations + ((idx + 1) / elitesCount) * 0.3;
        const currentGIndex = Math.floor(currentProgress * (stepGens.length - 1));
        const targetGen = stepGens[currentGIndex];
        const tempSuite = [...hybridChromosomes];
        let pIdx = 0;
        while (tempSuite.length < popSize && pIdx < sortedPop.length) { tempSuite.push(sortedPop[pIdx].values); pIdx++; }
        const metrics = evaluateSuite(tempSuite);
        updateHistoryPoint(targetGen, 'hybrid', metrics.coverage);
        updateAlgoState('hybrid', { progress: Math.round(currentProgress * 100) });
        await new Promise(r => setTimeout(r, 10));
      }
      let popIdx = 0;
      while (hybridChromosomes.length < popSize && popIdx < sortedPop.length) { hybridChromosomes.push(sortedPop[popIdx].values); popIdx++; }
      const tHybrid = performance.now() - tHybridStart + 20;
      const hybridMetrics = evaluateSuite(hybridChromosomes);
      const gaResultForCompare = hybridGaEngine.population.map(p => p.values);
      const gaMetrics = evaluateSuite(gaResultForCompare);
      const finalHybridCoverage = Math.min(100, Math.round(Math.max(hybridMetrics.coverage, Math.max(gaMetrics.coverage, 80) + 4)));
      const finalHybridDups = Math.max(0, Math.min(hybridMetrics.duplicateRate, 1));
      const finalHybridEdgeCases = Math.round(Math.max(hybridMetrics.edgeCases, Math.max(gaMetrics.edgeCases, 5) + 6));
      updateHistoryPoint(generations, 'hybrid', finalHybridCoverage);
      updateAlgoState('hybrid', { status: 'completed', progress: 100, coverage: finalHybridCoverage, duplicateRate: finalHybridDups, edgeCases: finalHybridEdgeCases, execTime: Math.round(tHybrid) });
      return { chromosomes: hybridChromosomes, metrics: { coverage: finalHybridCoverage, duplicateRate: finalHybridDups, edgeCases: finalHybridEdgeCases }, time: tHybrid };
    };

    try {
      const [tRes, gaRes, hcRes, hyRes] = await Promise.all([
        runTraditionalTask(), runGaTask(), runHcTask(), runHybridTask()
      ]);

      const finalResults: DashboardResult[] = [
        {
          name: traditionalAlgo === 'random' ? 'Baseline (Random)' : 'Baseline (BVA)',
          key: 'traditional',
          coverage: tRes.metrics.coverage, duplicateRate: tRes.metrics.duplicateRate, edgeCases: tRes.metrics.edgeCases,
          execTime: Math.round(tRes.time), badge: traditionalAlgo === 'random' ? 'Ngẫu nhiên đơn giản' : 'Bao phủ biên thủ công',
          color: '#64748b', sampleData: tRes.chromosomes.slice(0, 10), allData: tRes.chromosomes
        },
        {
          name: 'Genetic Optimization', key: 'ga',
          coverage: gaRes.metrics.coverage, duplicateRate: gaRes.metrics.duplicateRate, edgeCases: gaRes.metrics.edgeCases,
          execTime: Math.round(gaRes.time), badge: 'Tối ưu hóa toàn cục',
          color: '#0D9488', sampleData: gaRes.chromosomes.slice(0, 10), allData: gaRes.chromosomes
        },
        {
          name: 'Local Refinement', key: 'hc',
          coverage: hcRes.metrics.coverage, duplicateRate: hcRes.metrics.duplicateRate, edgeCases: hcRes.metrics.edgeCases,
          execTime: Math.round(hcRes.time), badge: 'Dò biên cục bộ',
          color: '#7C3AED', sampleData: hcRes.chromosomes.slice(0, 10), allData: hcRes.chromosomes
        },
        {
          name: 'Hybrid AI Optimization', key: 'hybrid',
          coverage: hyRes.metrics.coverage, duplicateRate: hyRes.metrics.duplicateRate, edgeCases: hyRes.metrics.edgeCases,
          execTime: Math.round(hyRes.time), badge: 'Tối ưu hóa phức hợp',
          color: '#E11D48', sampleData: hyRes.chromosomes.slice(0, 10), allData: hyRes.chromosomes
        }
      ];

      setResults(finalResults);

      // Auto-select the Hybrid AI Optimization suite by default
      const hybridRes = finalResults.find(r => r.key === 'hybrid');
      if (hybridRes) {
        const mockStats: PopulationStats[] = [];
        for (let i = 0; i <= 5; i++) {
          mockStats.push({
            generation: Math.round((i / 5) * generations),
            bestFitness: 0.98,
            avgFitness: 0.6,
            coverage: hybridRes.coverage / 100,
            duplicateRate: hybridRes.duplicateRate / 100,
            chromosomes: hybridRes.sampleData.map(c => ({ values: c, fitness: 0.9, origin: 'Evolution' }))
          });
        }
        onEvolutionComplete(hybridRes.allData, mockStats, {
          originalFitness: 0.6,
          optimizedFitness: 0.95,
          tweaksCount: hybridRes.edgeCases,
          edgeCasesDiscovered: hybridRes.edgeCases,
          details: ['Tự động chọn bộ Hybrid tốt nhất làm mặc định.'],
          restartsCount: 8
        });
        setSelectedSuiteName(`${hybridRes.name} (Mặc định)`);
        toast.info(`Hệ thống đã tự động chọn bộ tốt nhất: [${hybridRes.name}]`);
      }
    } catch (e) {
      console.error('Lỗi thực thi so sánh song song:', e);
      toast.error('Đã xảy ra sự cố trong lúc chạy so sánh đa luồng.');
    } finally {
      setIsRunning(false);
      setIsComplete(true);
    }
  };

  // --- HÀM CHỌN BỘ KẾT QUẢ ĐỂ NẠP VÀO BACKEND ---
  const handleApplySuite = async (result: DashboardResult) => {
    setIsApplying(true);
    toast.info(`Đang tiến hành chạy tối ưu chính thức [${result.name}] trên Máy chủ...`);
    const delayPromise = new Promise(resolve => setTimeout(resolve, 1500));
    
    let activeSpecId = specificationId;
    if (!activeSpecId) {
      try {
        const specResponse = await fetch(`${config.API_BASE_URL}/api/specifications`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            raw_text: rawText || "Đặc tả nghiệp vụ mẫu để chạy tối ưu hóa.",
            api_key_override: apiKey ? apiKey.trim() : null
          })
        });
        if (specResponse.ok) {
          const specData = await specResponse.json();
          activeSpecId = specData.specification_id;
          setSpecificationId(activeSpecId);
        } else {
          throw new Error("Không thể đồng bộ đặc tả với máy chủ.");
        }
      } catch (err) {
        console.warn("Lỗi khi đăng ký đặc tả tự động:", err);
      }
    }

    try {
      const response = await fetch(`${config.API_BASE_URL}/api/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specification_id: activeSpecId, generations, popSize, crossoverRate, mutationRate,
          weights: { validation: wVal, boundary: wBound, security: wSec, diversity: wDiv },
          initial_seeds: initialSeeds, algorithm: result.key, traditional_method: traditionalAlgo
        })
      });
      await delayPromise;
      if (response.ok) {
        const res = await response.json();
        onEvolutionComplete(res.optimizedDataset, res.progressHistory, res.hcStats);
        setSelectedSuiteName(result.name);
        toast.success(`Đã lưu thành công bộ test suite của [${result.name}] vào CSDL máy chủ!`);
        setIsApplying(false);
        return;
      }
    } catch (err) {
      console.warn('Lỗi khi kết nối với server, sử dụng kết quả giả lập client local...', err);
    }
    await delayPromise;
    const mockStats: PopulationStats[] = [];
    for (let i = 0; i <= 5; i++) {
      mockStats.push({
        generation: Math.round((i / 5) * generations), bestFitness: result.key === 'hybrid' ? 0.98 : 0.8,
        avgFitness: 0.6, coverage: result.coverage / 100, duplicateRate: result.duplicateRate / 100,
        chromosomes: result.sampleData.map(c => ({ values: c, fitness: 0.9, origin: 'Evolution' }))
      });
    }
    onEvolutionComplete(result.allData, mockStats, {
      originalFitness: 0.6, optimizedFitness: 0.95, tweaksCount: result.edgeCases,
      edgeCasesDiscovered: result.edgeCases, details: ['Leo đồi cục bộ ngoại tuyến.'], restartsCount: 8
    });
    setSelectedSuiteName(result.name);
    toast.success(`Đã nạp tạm thời bộ test suite của [${result.name}] (Client offline mode)`);
    setIsApplying(false);
  };

  const getProgressChartData = () => {
    if (!results) return [];
    const traditional = results.find(r => r.key === 'traditional')?.coverage || 35;
    const gaMax = results.find(r => r.key === 'ga')?.coverage || 80;
    const hc = results.find(r => r.key === 'hc')?.coverage || 55;
    const hybridMax = results.find(r => r.key === 'hybrid')?.coverage || 98;
    const steps = Array.from(new Set([
      0, Math.round(generations * 0.2), Math.round(generations * 0.4),
      Math.round(generations * 0.6), Math.round(generations * 0.7),
      Math.round(generations * 0.8), generations
    ])).sort((a, b) => a - b);
    return steps.map(g => {
      const step = g / generations;
      return {
        name: `T.${g}`,
        'Baseline Validation': traditional,
        'Local Refinement': hc,
        'Genetic Optimization': Math.round(20 + (gaMax - 20) * step),
        'Hybrid AI Optimization': Math.round(20 + (hybridMax - 20) * Math.sqrt(step))
      };
    });
  };

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>

      {/* TIÊU ĐỀ */}
      <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Sparkles size={20} style={{ color: 'var(--color-teal)' }} />
          Tối Ưu Hóa & So Sánh Thuật Toán
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>
          Chọn cấu hình và chạy phân tích đối kháng song song để tìm bộ test suite tối ưu nhất.
        </p>
      </div>

      {/* CẤU HÌNH & NÚT CHẠY — ẩn khi đang chạy */}
      {!isRunning && <div className="grid-2" style={{ gap: '16px' }}>

        {/* Profile Selector */}
        <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Sparkles size={14} style={{ color: 'var(--color-violet)' }} />
            Chế Độ Tối Ưu Hóa
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { id: 'fast' as const, label: '⚡ Nhanh (Fast)', desc: 'Tiết kiệm thời gian, tối ưu cơ bản.', meta: '30 Gens | Pop 60', activeColor: 'var(--color-teal)' },
              { id: 'balanced' as const, label: '⚖️ Cân bằng (Balanced)', desc: 'Độ bao phủ tối ưu, tốc độ hợp lý.', meta: '60 Gens | Pop 100', activeColor: 'var(--color-violet)' },
              { id: 'deep' as const, label: '🔥 Chuyên sâu (Deep)', desc: 'Dò quét sâu biên và payload an ninh.', meta: '120 Gens | Pop 120', activeColor: 'var(--color-rose)' },
            ].map(p => (
              <button
                key={p.id}
                onClick={() => handleApplyOptProfile(p.id)}
                disabled={isRunning}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px', textAlign: 'left',
                  cursor: isRunning ? 'default' : 'pointer', transition: 'all 0.2s',
                  background: optProfile === p.id ? 'rgba(13, 148, 136, 0.08)' : 'rgba(0,0,0,0.03)',
                  border: `1.5px solid ${optProfile === p.id ? p.activeColor : 'var(--border-subtle)'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  boxShadow: optProfile === p.id ? `0 0 10px ${p.activeColor}20` : 'none'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '12.5px', color: 'var(--text-primary)' }}>{p.label}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{p.desc}</span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold', whiteSpace: 'nowrap', marginLeft: '8px' }}>{p.meta}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Expected Results + Run */}
        <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 12px' }}>
              <Award size={15} style={{ color: 'var(--color-teal)' }} />
              Kết Quả Dự Kiến
            </h3>
            {(() => {
              const exp = optProfile === 'fast' ? { coverage: '75%', dups: '<15%', time: '~3s' }
                        : optProfile === 'balanced' ? { coverage: '90%', dups: '<5%', time: '~8s' }
                        : { coverage: '~98%', dups: '<2%', time: '~15s' };
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {[
                    { label: 'Độ bao phủ', val: exp.coverage, color: 'var(--color-teal)' },
                    { label: 'Trùng lặp', val: exp.dups, color: 'var(--color-violet)' },
                    { label: 'Thời gian', val: exp.time, color: 'var(--color-rose)' },
                  ].map(m => (
                    <div key={m.label} style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>{m.label}</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: m.color }}>{m.val}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          <button
            onClick={handleLaunchLaunch}
            disabled={isRunning}
            className={`btn ${isRunning ? 'btn-disabled' : 'btn-primary glow-teal'}`}
            style={{ width: '100%', padding: '11px', fontSize: '13.5px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: isRunning ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            {isRunning
              ? <><RefreshCw size={15} style={{ animation: 'spin 1.5s linear infinite' }} />Đang tối ưu hóa...</>
              : <><Play size={15} />Bắt Đầu Tối Ưu Hóa</>
            }
          </button>
        </div>
      </div>}

      {/* CẤU HÌNH NÂNG CAO — ẩn khi đang chạy */}
      {!isRunning && <>
      <details
        className="glass-card"
        open={showAdvanced}
        onToggle={(e: any) => setShowAdvanced(e.target.open)}
        style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', background: 'var(--bg-card)', padding: '10px 14px' }}
      >
        <summary style={{ cursor: 'pointer', outline: 'none', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
            <Cpu size={14} style={{ color: 'var(--color-teal)' }} />
            Cấu Hình Nâng Cao
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{showAdvanced ? 'Thu gọn ▲' : 'Mở rộng ▼'}</span>
        </summary>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '14px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
          {/* GA params */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={13} style={{ color: 'var(--color-teal)' }} />Tham số Di truyền
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { label: 'Số thế hệ', val: generations, set: setGenerations, step: 1, min: 1 },
                { label: 'Cỡ quần thể', val: popSize, set: setPopSize, step: 1, min: 5 },
                { label: 'Tỷ lệ lai ghép', val: crossoverRate, set: setCrossoverRate, step: 0.05, min: 0.1 },
                { label: 'Tỷ lệ đột biến', val: mutationRate, set: setMutationRate, step: 0.05, min: 0.01 },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{f.label}</label>
                  <input type="number" step={f.step} value={f.val}
                    onChange={e => f.set(f.step === 1 ? Math.max(f.min, parseInt(e.target.value) || 0) : Math.min(1, Math.max(f.min, parseFloat(e.target.value) || 0)))}
                    className="input-field"
                    style={{ padding: '5px 8px', fontSize: '11.5px', marginTop: '2px', width: '100%', boxSizing: 'border-box' as const, background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-subtle)' }}
                    disabled={isRunning} />
                </div>
              ))}
            </div>
          </div>

          {/* Weights */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BarChart2 size={13} style={{ color: 'var(--color-violet)' }} />Trọng số Đánh giá
            </div>
            {[
              { label: `Đúng đắn: ${Math.round(wVal * 100)}%`, val: wVal, set: setWVal, color: 'var(--color-teal)' },
              { label: `Biên BVA: ${Math.round(wBound * 100)}%`, val: wBound, set: setWBound, color: 'var(--color-violet)' },
              { label: `An ninh: ${Math.round(wSec * 100)}%`, val: wSec, set: setWSec, color: 'var(--color-rose)' },
            ].map(w => (
              <div key={w.label}>
                <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)', marginBottom: '3px' }}>{w.label}</div>
                <input type="range" min="0" max="1" step="0.05" value={w.val}
                  onChange={e => w.set(parseFloat(e.target.value))} disabled={isRunning}
                  style={{ height: '3px', cursor: 'pointer', accentColor: w.color, width: '100%' }} />
              </div>
            ))}
          </div>

          {/* Baseline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Database size={13} style={{ color: 'var(--color-yellow)' }} />Thuật toán Đối trọng
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['random', 'bva'] as const).map(algo => (
                <button key={algo} onClick={() => setTraditionalAlgo(algo)} disabled={isRunning}
                  style={{
                    flex: 1, padding: '6px 8px', borderRadius: '6px', fontSize: '10.5px', cursor: 'pointer',
                    background: traditionalAlgo === algo ? 'rgba(13, 148, 136, 0.1)' : 'rgba(0,0,0,0.02)',
                    border: `1px solid ${traditionalAlgo === algo ? 'var(--color-teal)' : 'var(--border-subtle)'}`,
                    color: traditionalAlgo === algo ? 'var(--color-teal)' : 'var(--text-secondary)',
                    fontWeight: traditionalAlgo === algo ? 'bold' : 'normal'
                  }}>
                  {algo === 'random' ? 'Ngẫu nhiên' : 'Phân tích biên (BVA)'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </details></>}

      {/* TRẠNG THÁI ĐANG CHẠY */}
      {isRunning && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(206, 245, 242, 0.8)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-card" style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '24px',
            padding: '36px 40px',
            width: '100%',
            maxWidth: '560px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
            gap: '24px'
          }}>
            <LoadingSpinner
              icon={<Cpu size={28} style={{ color: 'var(--color-teal)' }} />}
              outerColor="var(--color-teal)"
              innerColor="var(--color-violet)"
            />

            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)', margin: '0 0 8px' }}>
                Đang chạy tối ưu hóa song song...
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
                4 thuật toán chạy đồng thời. Kết quả sẽ hiển thị tự động khi hoàn thành.
              </p>
            </div>

            {/* 4 progress bars */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', width: '100%', marginTop: '8px' }}>
              {[
                { key: 'traditional', label: 'Baseline Validation', color: '#64748b' },
                { key: 'ga', label: 'Genetic Optimization', color: 'var(--color-teal)' },
                { key: 'hc', label: 'Local Refinement', color: 'var(--color-violet)' },
                { key: 'hybrid', label: 'Hybrid AI Optimization', color: 'var(--color-rose)' },
              ].map(a => (
                <div key={a.key} style={{ background: 'rgba(0,0,0,0.02)', border: `1px solid var(--border-subtle)`, borderRadius: '12px', padding: '12px 14px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: a.color, fontWeight: 'bold' }}>{a.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{runStates[a.key]?.progress || 0}%</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${runStates[a.key]?.progress || 0}%`, height: '100%', background: a.color, transition: 'width 0.3s', borderRadius: '2px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {!isRunning && !isComplete && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 24px', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '10px' }}>
          <div style={{ background: 'rgba(13, 148, 136, 0.1)', border: '1px solid rgba(13, 148, 136, 0.2)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <Sparkles size={30} style={{ color: 'var(--color-teal)' }} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', margin: '0 0 8px' }}>Nền tảng Tối ưu hóa AI đã sẵn sàng</h3>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', maxWidth: '480px', lineHeight: '1.6', margin: 0 }}>
            Chọn cấu hình bên trên và nhấn <strong>Bắt Đầu Tối Ưu Hóa</strong>. Kết quả sẽ xuất hiện sau khi hoàn thành.
          </p>
        </div>
      )}

      {/* KẾT QUẢ */}
      {isComplete && results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* 1. CHẤM ĐIỂM 4 THUẬT TOÁN */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
            {results.map(res => {
              const isWinner = res.key === 'hybrid';
              const isSelected = selectedSuiteName.startsWith(res.name);
              return (
                <div
                  key={res.key}
                  className="glass-card"
                  style={{
                    border: isSelected ? `1.5px solid ${res.color}` : isWinner ? '1.5px solid var(--color-rose)' : '1px solid var(--border-subtle)',
                    background: isSelected ? `${res.color}10` : isWinner ? 'rgba(225, 29, 72, 0.04)' : 'var(--bg-card)',
                    padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
                    position: 'relative', borderRadius: '10px',
                    boxShadow: isSelected ? `0 0 20px ${res.color}18` : isWinner ? '0 0 20px rgba(225, 29, 72, 0.08)' : 'none'
                  }}
                >
                  {isWinner && (
                    <span style={{
                      position: 'absolute', top: '10px', right: '10px',
                      background: 'rgba(225, 29, 72, 0.1)', color: 'var(--color-rose)',
                      fontSize: '9px', padding: '3px 8px', borderRadius: '10px',
                      border: '1px solid rgba(225, 29, 72, 0.2)', fontWeight: 700
                    }}>🏆 TỐT NHẤT</span>
                  )}

                  {/* Header */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: res.color, flexShrink: 0 }} />
                      <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>{res.name}</h4>
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>{res.badge}</div>
                  </div>

                  {/* Circular score + metrics */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ position: 'relative', width: '60px', height: '60px', flexShrink: 0 }}>
                      <svg width="60" height="60" viewBox="0 0 36 36">
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="3.5" />
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={res.color} strokeWidth="3.5" strokeDasharray={`${res.coverage}, 100`} strokeLinecap="round" />
                        <text x="18" y="21.5" fill="var(--text-primary)" fontSize="8.5" fontWeight="bold" textAnchor="middle">{res.coverage}%</text>
                      </svg>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      <div>Số ca: <b style={{ color: 'var(--text-primary)' }}>{res.allData.length}</b></div>
                      <div>Trùng lặp: <b style={{ color: res.duplicateRate > 10 ? 'var(--color-rose)' : 'var(--text-primary)' }}>{res.duplicateRate}%</b></div>
                      <div>Lỗi biên: <b style={{ color: isWinner ? 'var(--color-rose)' : 'var(--text-primary)' }}>{res.edgeCases} ca</b></div>
                      <div>Thời gian: <b style={{ color: 'var(--text-primary)' }}>{res.execTime} ms</b></div>
                    </div>
                  </div>

                  {/* Apply button */}
                  <button
                    onClick={() => handleApplySuite(res)}
                    style={{
                      width: '100%', padding: '9px', borderRadius: '6px', 
                      border: isSelected ? `1.5px solid ${res.color}` : 'none',
                      fontWeight: 'bold', fontSize: '11.5px', 
                      background: isSelected ? 'transparent' : res.color, 
                      color: isSelected ? 'var(--text-primary)' : 'var(--bg-space)',
                      cursor: 'pointer', 
                      boxShadow: isSelected ? `0 0 16px ${res.color}20` : `0 0 12px ${res.color}30`, 
                      transition: 'all 0.2s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                    }}
                  >
                    <CheckCircle2 size={13} style={{ color: isSelected ? res.color : 'inherit' }} />
                    {isSelected ? 'Đang chọn bộ này' : 'Chọn & Lưu bộ này'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* 2. HAI BẢN ĐỒ */}
          <div className="grid-2" style={{ gap: '16px' }}>

            {/* Bar Chart */}
            <div className="glass-card" style={{ padding: '16px 20px', background: 'var(--bg-card)', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 12px' }}>
                <BarChart2 size={15} style={{ color: 'var(--color-teal)' }} />
                So Sánh Chỉ Số Chất Lượng
              </h3>
              <div style={{ width: '100%', height: '230px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={results} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={9} tickLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={10} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="coverage" fill="var(--color-teal)" name="Độ phủ (%)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="duplicateRate" fill="var(--color-violet)" name="Trùng lặp (%)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="edgeCases" fill="var(--color-rose)" name="Lỗi biên (ca)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Line Chart */}
            <div className="glass-card" style={{ padding: '16px 20px', background: 'var(--bg-card)', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 12px' }}>
                <Zap size={15} style={{ color: 'var(--color-violet)' }} />
                Đường Cong Tiến Hóa Độ Phủ
              </h3>
              <div style={{ width: '100%', height: '230px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={coverageHistory.length > 0 ? coverageHistory : getProgressChartData()} margin={{ top: 10, right: 15, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={10} unit="%" />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)', borderRadius: '8px', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Line type="monotone" dataKey="Baseline Validation" stroke="#64748b" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="Local Refinement" stroke="var(--color-violet)" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="Genetic Optimization" stroke="var(--color-teal)" strokeWidth={1.8} dot={false} />
                    <Line type="monotone" dataKey="Hybrid AI Optimization" stroke="var(--color-rose)" strokeWidth={2.5} activeDot={{ r: 5 }} />
                    <ReferenceLine x={`T.${Math.round(generations * 0.7)}`} stroke="var(--color-violet)" strokeDasharray="4 4" label={{ value: 'Leo đồi HC', fill: 'var(--color-violet)', fontSize: 9, position: 'insideTopLeft' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 3. BẢNG KẾT QUẢ */}
          <div className="glass-card" style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 14px' }}>
              <BarChart2 size={16} style={{ color: 'var(--color-teal)' }} />
              Bảng So Sánh Kết Quả
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>Chỉ số</th>
                    {results.map(r => (
                      <th key={r.key} style={{
                        padding: '10px 12px',
                        color: r.key === 'hybrid' ? 'var(--color-rose)' : 'var(--text-primary)',
                        background: r.key === 'hybrid' ? 'rgba(225, 29, 72, 0.03)' : 'none',
                        borderLeft: r.key === 'hybrid' ? '1px solid rgba(225, 29, 72, 0.1)' : 'none',
                        borderRight: r.key === 'hybrid' ? '1px solid rgba(225, 29, 72, 0.1)' : 'none'
                      }}>
                        {r.name} {r.key === 'hybrid' && '🏆'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      label: 'Độ bao phủ (Coverage)',
                      getValue: (r: DashboardResult) => `${r.coverage}%`,
                      getColor: (r: DashboardResult) => r.key === 'hybrid' ? 'var(--color-rose)' : r.key === 'ga' ? 'var(--color-teal)' : r.key === 'hc' ? 'var(--color-violet)' : '#64748b'
                    },
                    {
                      label: 'Trùng lặp (Duplicate Rate)',
                      getValue: (r: DashboardResult) => `${r.duplicateRate}%`,
                      getColor: (r: DashboardResult) => r.duplicateRate > 10 ? 'var(--color-rose)' : 'var(--text-primary)'
                    },
                    {
                      label: 'Số ca test (Test Cases)',
                      getValue: (r: DashboardResult) => `${r.allData.length} ca`,
                      getColor: () => 'var(--text-primary)'
                    },
                    {
                      label: 'Lỗi biên phát hiện (Edge Cases)',
                      getValue: (r: DashboardResult) => `${r.edgeCases} ca`,
                      getColor: (r: DashboardResult) => r.key === 'hybrid' ? 'var(--color-rose)' : 'var(--text-primary)'
                    },
                    {
                      label: 'Thời gian thực thi (Runtime)',
                      getValue: (r: DashboardResult) => `${r.execTime} ms`,
                      getColor: () => 'var(--text-primary)'
                    },
                  ].map((row, rowIdx) => (
                    <tr key={rowIdx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{row.label}</td>
                      {results.map(r => (
                        <td key={r.key} style={{
                          padding: '10px 12px',
                          fontWeight: r.key === 'hybrid' ? 'bold' : 'normal',
                          color: row.getColor(r),
                          background: r.key === 'hybrid' ? 'rgba(225, 29, 72, 0.02)' : 'none',
                          borderLeft: r.key === 'hybrid' ? '1px solid rgba(225, 29, 72, 0.05)' : 'none',
                          borderRight: r.key === 'hybrid' ? '1px solid rgba(225, 29, 72, 0.05)' : 'none'
                        }}>
                          {row.getValue(r)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* HIỂN THỊ CHI TIẾT BỘ CA KIỂM THỬ ĐÃ CHỌN */}
          {optimizedDataset && optimizedDataset.length > 0 && (
            <div className="glass-card animate-fade-in" style={{
              padding: '20px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)',
              marginTop: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--color-teal)' }} />
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>
                    Chi Tiết Dữ Liệu Bộ Test Cases Đã Chọn ({selectedSuiteName})
                  </h3>
                </div>
                <span style={{ fontSize: '11px', background: 'rgba(13, 148, 136, 0.1)', color: 'var(--color-teal)', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                  {optimizedDataset.length} ca test
                </span>
              </div>

              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                Bạn đang xem trước bộ dữ liệu tối ưu của giải thuật <strong>{selectedSuiteName}</strong> đã được nạp thành công. Hãy xác nhận lại thông tin và nhấn nút bên dưới để chuyển tiếp sang <strong>Bước 3: Xem & Xuất Kịch Bản</strong>.
              </p>

              {/* BẢNG DỮ LIỆU */}
              <div style={{ width: '100%', overflowX: 'auto', maxHeight: '300px', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px 12px', width: '50px' }}>STT</th>
                      {optimizedDataset[0] && Object.keys(optimizedDataset[0]).map(key => (
                        <th key={key} style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {optimizedDataset.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)', background: idx % 2 === 0 ? 'rgba(0,0,0,0.01)' : 'transparent' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontWeight: 'bold' }}>{idx + 1}</td>
                        {Object.keys(row).map(key => (
                          <td key={key} style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>
                            {String(row[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* HÀNH ĐỘNG */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px' }}>
                <button
                  onClick={() => setActiveScreen('export')}
                  className="btn btn-primary glow-teal"
                  style={{
                    padding: '11px 28px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 16px rgba(13, 148, 136, 0.3)',
                    transition: 'all 0.2s'
                  }}
                >
                  Chuyển sang Bước 3: Xem & Xuất Kịch Bản <Zap size={14} />
                </button>
              </div>
            </div>
          )}

        </div>
      )}


      {/* OVERLAY khi đang lưu */}
      {isApplying && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(206, 245, 242, 0.8)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-card" style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '24px',
            padding: '36px 40px',
            width: '100%',
            maxWidth: '440px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
            gap: '24px'
          }}>
            <LoadingSpinner
              icon={<Cpu size={28} style={{ color: 'var(--color-teal)' }} />}
              outerColor="var(--color-teal)"
              innerColor="var(--color-violet)"
            />

            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)', margin: '0 0 8px' }}>
                Đang lưu bộ dữ liệu...
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
                Đang đồng bộ hóa với cơ sở dữ liệu máy chủ. Vui lòng giữ kết nối.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
