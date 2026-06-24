import React, { useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Cell
} from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { Activity, TrendingUp, Target, Zap, ShieldCheck, PieChart, Info } from 'lucide-react';

// Custom Tooltip để giao diện xịn xò và tường minh hơn
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card" style={{ padding: '12px 16px', border: '1px solid var(--border-subtle)', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Thế hệ / Vòng lặp: {label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color }}></div>
            <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{entry.name}:</span>
            <span style={{ color: entry.color, fontWeight: 600, fontSize: '14px' }}>{Number(entry.value).toFixed(2)}{entry.name.includes('Nhiệt độ') ? '' : '%'}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const AlgorithmCharts: React.FC = () => {
  const { historyRuns } = useAppStore();

  const chartData = useMemo(() => {
    if (historyRuns && historyRuns.length > 0 && historyRuns[0].stats?.length > 0) {
      return historyRuns[0].stats.map((s: any, idx: number) => ({
        generation: s.generation || idx,
        bestFitness: s.bestFitness * 100,
        avgFitness: s.avgFitness * 100,
        coverage: s.coverage * 100,
        diversity: (1 - (s.duplicateRate || 0)) * 100,
        temperature: Math.max(0.1, 0.15 * Math.pow(0.85, idx)) * 100 
      }));
    }

    const simulated = [];
    const maxGen = 60;
    for (let i = 0; i <= maxGen; i++) {
      const progress = i / maxGen;
      const bestFit = 40 + (60 * (1 - Math.exp(-progress * 5)));
      const avgFit = bestFit * 0.85 + (Math.random() * 5);
      const diversity = 100 - (60 * Math.pow(progress, 1.5));
      const coverage = 30 + (70 * (1 - Math.exp(-progress * 3)));
      const temp = 100 * Math.pow(0.85, i);

      simulated.push({
        generation: i,
        bestFitness: Math.min(100, bestFit),
        avgFitness: Math.min(100, avgFit),
        coverage: Math.min(100, coverage),
        diversity: Math.max(10, diversity),
        temperature: Math.max(1, temp)
      });
    }
    return simulated;
  }, [historyRuns]);

  // Lấy dữ liệu dòng cuối cùng để làm KPI
  const currentStats = chartData[chartData.length - 1] || {};

  return (
    <div className="fade-in-up" style={{ padding: '0px 0px 24px 0px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* HEADER GIỚI THIỆU */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
            <Activity className="text-blue-400" /> Phân Tích Tiến Trình Memetic Algorithm
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', maxWidth: '800px', lineHeight: '1.6' }}>
            Hệ thống đồ thị trực quan hóa quá trình hội tụ của giải thuật lai ghép (Genetic Algorithm + Hill Climbing). Dữ liệu được tính toán dựa trên các hàm mục tiêu đa biến (NSGA-II) và làm nguội luyện kim sa.
            {(!historyRuns || historyRuns.length === 0) && (
              <span style={{ color: 'var(--color-yellow)', display: 'block', marginTop: '4px' }}>
                <Info size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }}/> 
                Đang hiển thị biểu đồ giả lập (Simulated) do chưa có kết quả chạy thực tế.
              </span>
            )}
          </p>
        </div>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '3px solid var(--color-teal)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
            <TrendingUp size={16} /> <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>Đỉnh Thích Nghi (Best Fitness)</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--color-teal)' }}>
            {Number(currentStats.bestFitness || 0).toFixed(1)}%
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '3px solid var(--color-emerald)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
            <Target size={16} /> <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>Bao Phủ Quy Tắc (Coverage)</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--color-emerald)' }}>
            {Number(currentStats.coverage || 0).toFixed(1)}%
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '3px solid var(--color-purple)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
            <PieChart size={16} /> <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>Độ Đa Dạng (Diversity)</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--color-purple)' }}>
            {Number(currentStats.diversity || 0).toFixed(1)}%
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '3px solid var(--color-rose)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
            <Zap size={16} /> <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>Nhiệt Độ Cuối (Temp)</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--color-rose)' }}>
            {Number(currentStats.temperature || 0).toFixed(2)}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(600px, 1fr))', gap: '24px' }}>
        
        {/* CHART 1: FITNESS CONVERGENCE */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ color: 'var(--text-primary)', fontSize: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <TrendingUp size={18} color="var(--color-teal)" /> Biểu Đồ Hội Tụ Thích Nghi (Fitness Convergence)
          </h3>
          <div style={{ width: '100%', height: '320px' }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBestFit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-teal)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--color-teal)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="generation" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tickMargin={10} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '13px', color: 'var(--text-secondary)' }} />
                <Line type="monotone" dataKey="bestFitness" name="Best Fitness" stroke="var(--color-teal)" strokeWidth={4} dot={false} activeDot={{ r: 6, fill: 'var(--color-teal)', stroke: '#fff', strokeWidth: 2 }} />
                <Line type="monotone" dataKey="avgFitness" name="Average Fitness" stroke="var(--color-blue)" strokeWidth={2} dot={false} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 2: COVERAGE VS DIVERSITY */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ color: 'var(--text-primary)', fontSize: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <Target size={18} color="var(--color-emerald)" /> Độ Bao Phủ & Phân Tán (Coverage vs Diversity)
          </h3>
          <div style={{ width: '100%', height: '320px' }}>
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCov" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-emerald)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-emerald)" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorDiv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-purple)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-purple)" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="generation" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tickMargin={10} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '13px', color: 'var(--text-secondary)' }} />
                <Area type="monotone" dataKey="coverage" name="Rule Coverage" stroke="var(--color-emerald)" strokeWidth={3} fillOpacity={1} fill="url(#colorCov)" />
                <Area type="monotone" dataKey="diversity" name="Genetic Diversity" stroke="var(--color-purple)" strokeWidth={3} fillOpacity={1} fill="url(#colorDiv)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 3: SIMULATED ANNEALING TEMPERATURE */}
        <div className="glass-card" style={{ padding: '24px', gridColumn: '1 / -1' }}>
          <h3 style={{ color: 'var(--text-primary)', fontSize: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <Zap size={18} color="var(--color-rose)" /> Hậu Tối Ưu Luyện Kim Sa (Simulated Annealing Fallback)
          </h3>
          <div style={{ width: '100%', height: '350px' }}>
            <ResponsiveContainer>
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-rose)" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="var(--color-rose)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="generation" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tickMargin={10} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickMargin={10} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '13px', color: 'var(--text-secondary)' }} />
                
                {/* Dùng Bar hiển thị Fitness cục bộ đạt được */}
                <Bar yAxisId="left" dataKey="bestFitness" name="Local Pareto Fitness" fill="var(--surface-active)" radius={[4, 4, 0, 0]} maxBarSize={30}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.bestFitness > 80 ? 'var(--color-teal)' : 'var(--color-blue)'} fillOpacity={0.6} />
                  ))}
                </Bar>
                
                {/* Đường cong nhiệt độ giảm dần */}
                <Area yAxisId="right" type="monotone" dataKey="temperature" name="Nhiệt Độ (Temp)" stroke="var(--color-rose)" strokeWidth={3} fill="url(#colorTemp)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: '20px', padding: '16px', background: 'var(--surface-subtle)', borderRadius: '8px', borderLeft: '4px solid var(--color-rose)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0, lineHeight: '1.6' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Nguyên lý hoạt động:</strong> Trong những thế hệ đầu tiên (Nhiệt độ cao), thuật toán cho phép chấp nhận các cá thể xấu (giảm fitness) để dễ dàng thoát khỏi các cực đại cục bộ. Khi tiến về những thế hệ cuối (Nhiệt độ thấp), thuật toán sẽ giảm dần sự nhân nhượng và hội tụ về mặt tối ưu Pareto toàn cục (Pareto Front).
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
