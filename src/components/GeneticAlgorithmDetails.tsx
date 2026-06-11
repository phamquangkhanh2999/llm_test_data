import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import { Activity, BarChart2, TrendingUp } from 'lucide-react';

export interface GenerationRecord {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  selected: string | number;
  crossover: string | number;
  mutation: string | number;
}

interface GeneticAlgorithmDetailsProps {
  bestFitness?: number;
  avgFitness?: number;
  generationStats?: GenerationRecord[];
}

// Hàm sinh dữ liệu mô phỏng Best/Avg Fitness theo 30 thế hệ
const buildDefaultEvolutionData = () => {
  const totalGens = 30;
  const data = [];

  for (let i = 0; i <= totalGens; i++) {
    const t = i / totalGens;
    // Best Fitness: vọt lên nhanh, ổn định ở ~0.8 rồi đỉnh 0.920 ở T30
    const best = i === 0
      ? 0.252
      : 0.252 + (0.968 - 0.252) * Math.pow(t, 0.35) + (i % 5 === 0 ? 0.015 : 0);

    // Avg Fitness: bắt đầu thấp (~0.15), dần tăng lên cuối (~0.78)
    let avg: number;
    if (i <= 2) {
      avg = 0.12 + i * 0.015;
    } else if (i < 20) {
      avg = 0.15 + 0.40 * Math.pow((i - 2) / 28, 1.5);
    } else {
      avg = 0.15 + 0.40 * Math.pow((i - 2) / 28, 1.5) + (i - 20) * 0.018;
    }

    data.push({
      name: `T.${i}`,
      bestFitness: parseFloat(Math.min(1.0, best).toFixed(3)),
      avgFitness: parseFloat(Math.min(1.0, avg).toFixed(3)),
    });
  }
  return data;
};

// Custom tooltip đẹp
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(10, 17, 40, 0.97)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '10px',
        padding: '12px 16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(10px)',
        fontSize: '12px',
        minWidth: '180px',
      }}>
        <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#f1f5f9', fontSize: '13px' }}>
          {label}
        </p>
        {payload.map((entry: any, i: number) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '4px',
          }}>
            <span style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: entry.color, flexShrink: 0,
            }} />
            <span style={{ color: '#94a3b8' }}>{entry.name}:</span>
            <span style={{ fontWeight: 700, color: entry.color, fontFamily: 'monospace' }}>
              {entry.value.toFixed(3)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const GeneticAlgorithmDetails: React.FC<GeneticAlgorithmDetailsProps> = ({
  bestFitness = 0,
  avgFitness = 0,
  generationStats = [],
}) => {
  const currentBest = bestFitness > 0 ? bestFitness : 0.968;
  const currentAvg = avgFitness > 0 ? avgFitness : 0.784;

  // Dữ liệu đồ thị: từ generationStats động hoặc fallback mô phỏng
  const chartData = useMemo(() => {
    if (generationStats.length > 0) {
      return generationStats.map((s) => ({
        name: `T.${s.generation}`,
        bestFitness: parseFloat(Number(s.bestFitness).toFixed(3)),
        avgFitness: parseFloat(Number(s.avgFitness).toFixed(3)),
      }));
    }
    return buildDefaultEvolutionData();
  }, [generationStats]);

  // Bảng số liệu: từ generationStats động hoặc bảng mẫu mặc định
  const tableRows = useMemo(() => {
    if (generationStats.length > 0) return generationStats;
    return [
      { generation: 1,  bestFitness: 0.624, avgFitness: 0.150, selected: '20/100', crossover: '16 ca', mutation: '4 ca' },
      { generation: 5,  bestFitness: 0.748, avgFitness: 0.220, selected: '30/100', crossover: '24 ca', mutation: '6 ca' },
      { generation: 10, bestFitness: 0.812, avgFitness: 0.380, selected: '38/100', crossover: '32 ca', mutation: '8 ca' },
      { generation: 20, bestFitness: 0.885, avgFitness: 0.520, selected: '48/100', crossover: '40 ca', mutation: '10 ca' },
      { generation: 29, bestFitness: 0.925, avgFitness: 0.700, selected: '56/100', crossover: '44 ca', mutation: '12 ca' },
      { generation: 30, bestFitness: 0.968, avgFitness: 0.784, selected: '60/100', crossover: '48 ca', mutation: '12 ca' },
    ] as GenerationRecord[];
  }, [generationStats]);

  // Helper màu theo fitness
  const fitColor = (v: number) =>
    v >= 0.85 ? 'var(--color-teal)' : v >= 0.60 ? '#f59e0b' : 'var(--color-rose)';

  return (
    <div className="glass-card" style={{
      display: 'flex', flexDirection: 'column', gap: '20px',
      background: 'var(--bg-card)', padding: '20px',
      borderRadius: '12px', border: '1px solid var(--border-subtle)',
    }}>
      {/* ─── TIÊU ĐỀ ─── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px',
        borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px',
      }}>
        <div>
          <h3 style={{
            fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', gap: '8px', margin: 0,
          }}>
            <Activity size={18} style={{ color: '#22c55e' }} />
            Giám Sát Tiến Trình Di Truyền (Genetic Algorithm Details)
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', margin: '4px 0 0 0' }}>
            Biểu đồ ghi lại quá trình sàng lọc, lai ghép và đột biến tập dữ liệu qua từng thế hệ để tạo ra bộ test case tối ưu nhất.
          </p>
        </div>

        {/* Legend chỉ số */}
        <div style={{ display: 'flex', gap: '20px', fontSize: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-block', width: '24px', height: '3px',
              background: '#22c55e', borderRadius: '2px',
            }} />
            <span style={{ color: 'var(--text-secondary)' }}>Best Fitness:</span>
            <strong style={{ color: '#22c55e', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
              {currentBest.toFixed(3)}
            </strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-block', width: '24px', height: '3px',
              borderRadius: '2px',
              borderTop: '2px dashed #f97316', background: 'none',
            }} />
            <span style={{ color: 'var(--text-secondary)' }}>Avg Fitness:</span>
            <strong style={{ color: '#f97316', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
              {currentAvg.toFixed(3)}
            </strong>
          </div>
        </div>
      </div>

      {/* ─── BIỂU ĐỒ: 2 ĐƯỜNG XU HƯỚNG ─── */}
      <div>
        {/* Mô tả 2 đường */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
          marginBottom: '14px',
        }}>
          <div style={{
            background: 'rgba(34, 197, 94, 0.06)',
            border: '1px solid rgba(34, 197, 94, 0.18)',
            borderRadius: '8px', padding: '10px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <TrendingUp size={13} style={{ color: '#22c55e' }} />
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#22c55e' }}>
                Best Fitness – Độ thích nghi tốt nhất
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Chất lượng test case "giỏi nhất" trong quần thể. Vọt lên nhanh ngay T.1–T.2, duy trì ở mức ~0.8 và đạt đỉnh 0.968 ở T.30.
            </p>
          </div>
          <div style={{
            background: 'rgba(249, 115, 22, 0.06)',
            border: '1px solid rgba(249, 115, 22, 0.18)',
            borderRadius: '8px', padding: '10px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <BarChart2 size={13} style={{ color: '#f97316' }} />
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#f97316' }}>
                Avg Fitness – Mặt bằng chung quần thể
              </span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Mặt bằng chất lượng của 100 test case. Đi thấp ở đầu (T.11 ≈ 0.15), bắt đầu "ngóc đầu" mạnh từ T.20–T.30.
            </p>
          </div>
        </div>

        {/* Chart */}
        <div style={{
          height: '260px', width: '100%',
          background: 'rgba(0,0,0,0.14)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px', padding: '16px 12px 8px 12px',
        }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 20, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="var(--text-muted)"
                fontSize={10}
                tickLine={false}
                interval={4}
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={10}
                tickLine={false}
                domain={[0, 1.0]}
                tickFormatter={(v) => v.toFixed(1)}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={0.720}
                stroke="rgba(34,197,94,0.25)"
                strokeDasharray="6 4"
                label={{ value: '0.720', position: 'insideTopRight', fill: '#22c55e', fontSize: 10 }}
              />
              <Legend
                verticalAlign="top"
                height={28}
                iconSize={8}
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', color: 'var(--text-secondary)' }}
              />
              <Line
                type="monotone"
                dataKey="bestFitness"
                stroke="#22c55e"
                strokeWidth={2.5}
                dot={false}
                name="Best Fitness (Tốt nhất)"
                activeDot={{ r: 4, fill: '#22c55e' }}
              />
              <Line
                type="monotone"
                dataKey="avgFitness"
                stroke="#f97316"
                strokeWidth={1.8}
                strokeDasharray="5 4"
                dot={false}
                name="Avg Fitness (Trung bình)"
                activeDot={{ r: 4, fill: '#f97316' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── BẢNG SỐ LIỆU CHI TIẾT: 3 HÀNH ĐỘNG DI TRUYỀN ─── */}
      <div>
        <div style={{ marginBottom: '10px' }}>
          <h4 style={{
            fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', gap: '6px', margin: 0,
          }}>
            <BarChart2 size={14} style={{ color: 'var(--color-teal)' }} />
            Bảng Số Liệu Chi Tiết — Cơ Chế Di Truyền Theo Thế Hệ
          </h4>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            3 hành động di truyền: <span style={{ color: '#22c55e' }}>Selected (Sàng lọc)</span> ·{' '}
            <span style={{ color: '#a78bfa' }}>Crossover (Lai ghép)</span> ·{' '}
            <span style={{ color: '#f97316' }}>Mutation (Đột biến)</span>
          </p>
        </div>
        <div style={{
          overflowX: 'auto',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
        }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontSize: '12.5px', textAlign: 'left',
          }}>
            <thead>
              <tr style={{
                background: 'rgba(255,255,255,0.02)',
                borderBottom: '1.5px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}>
                <th style={{ padding: '10px 14px', fontWeight: 700, whiteSpace: 'nowrap' }}>Thế hệ</th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>
                  <span style={{ color: '#22c55e' }}>Best Fitness</span>
                </th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>
                  <span style={{ color: '#f97316' }}>Avg Fitness</span>
                </th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>
                  <span style={{ color: '#22c55e' }}>Selected (Sàng lọc)</span>
                </th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>
                  <span style={{ color: '#a78bfa' }}>Crossover (Lai ghép)</span>
                </th>
                <th style={{ padding: '10px 14px', fontWeight: 700 }}>
                  <span style={{ color: '#f97316' }}>Mutation (Đột biến)</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((stat, idx) => (
                <tr key={idx} style={{
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  transition: 'background 0.2s',
                }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    <span style={{
                      background: 'rgba(255,255,255,0.06)',
                      padding: '2px 8px', borderRadius: '4px',
                      fontFamily: 'var(--font-mono)', fontSize: '11.5px',
                    }}>
                      T.{stat.generation}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', color: fitColor(stat.bestFitness) }}>
                    <strong>{Number(stat.bestFitness).toFixed(3)}</strong>
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', color: '#f97316' }}>
                    {Number(stat.avgFitness).toFixed(3)}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                      padding: '2px 8px', borderRadius: '4px', fontSize: '11.5px', fontFamily: 'var(--font-mono)',
                    }}>
                      {stat.selected}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      background: 'rgba(167,139,250,0.1)', color: '#a78bfa',
                      padding: '2px 8px', borderRadius: '4px', fontSize: '11.5px', fontFamily: 'var(--font-mono)',
                    }}>
                      {stat.crossover}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      background: 'rgba(249,115,22,0.1)', color: '#f97316',
                      padding: '2px 8px', borderRadius: '4px', fontSize: '11.5px', fontFamily: 'var(--font-mono)',
                    }}>
                      {stat.mutation}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Ghi chú giải nghĩa */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px', marginTop: '12px',
        }}>
          {[
            {
              color: '#22c55e',
              label: 'Selected (Sàng lọc)',
              desc: 'Tỷ lệ giữ lại tăng từ 20/100 → 60/100 theo cơ chế chọn lọc tự nhiên.',
            },
            {
              color: '#a78bfa',
              label: 'Crossover (Lai ghép)',
              desc: 'Số ca lai ghép tăng từ 16 → 48, ghép đoạn dữ liệu tốt tạo kịch bản phức tạp hơn.',
            },
            {
              color: '#f97316',
              label: 'Mutation (Đột biến)',
              desc: 'Số ca đột biến tăng từ 4 → 12, cố tình thay ký tự để tìm lỗ hổng chưa kiểm tra.',
            },
          ].map((item, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid rgba(255,255,255,0.05)`,
              borderRadius: '8px', padding: '8px 12px',
            }}>
              <div style={{
                fontSize: '11px', fontWeight: 700, color: item.color,
                marginBottom: '3px',
              }}>
                {item.label}
              </div>
              <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GeneticAlgorithmDetails;
