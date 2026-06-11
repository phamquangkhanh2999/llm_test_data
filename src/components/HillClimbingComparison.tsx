import React, { useState, useMemo } from 'react';
import { Scale, Sparkles, Cpu, Zap, BarChart2, ChevronDown, ChevronUp, Database } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export interface ComparisonRecord {
  testId: string;
  llmValue: any;
  gaValue: any;
  hcValue: any;
  llmFitness: number;
  gaFitness: number;
  hcFitness: number;
}

interface HillClimbingComparisonProps {
  comparisons?: ComparisonRecord[];
  schema?: any[];
}

interface CollapsibleJsonProps {
  value: any;
  isHighlighted?: boolean;
}

const CollapsibleJson: React.FC<CollapsibleJsonProps> = ({ value, isHighlighted = false }) => {
  const [expanded, setExpanded] = useState(false);
  
  const jsonString = useMemo(() => {
    try {
      if (typeof value === 'string') return value;
      return JSON.stringify(value, null, 2);
    } catch (e) {
      return '-';
    }
  }, [value]);
  
  const compactString = useMemo(() => {
    try {
      if (typeof value === 'string') return value;
      const keys = Object.keys(value).filter(k => k !== 'expectedResult');
      return keys.map(k => `${k}: ${JSON.stringify(value[k])}`).join(', ');
    } catch (e) {
      return '-';
    }
  }, [value]);

  const isLong = compactString.length > 28 || Object.keys(value || {}).length > 2;

  const textColor = isHighlighted ? 'var(--color-teal)' : 'var(--text-secondary)';
  const bgColor = isHighlighted ? 'rgba(13, 148, 136, 0.06)' : 'rgba(0, 0, 0, 0.15)';
  const borderColor = isHighlighted ? 'rgba(13, 148, 136, 0.2)' : 'rgba(255, 255, 255, 0.03)';

  if (!isLong) {
    return (
      <code style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: textColor }}>
        {compactString}
      </code>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {expanded ? (
        <pre style={{
          margin: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: textColor,
          whiteSpace: 'pre-wrap',
          background: bgColor,
          padding: '6px 10px',
          borderRadius: '6px',
          border: `1px solid ${borderColor}`,
          maxHeight: '120px',
          overflowY: 'auto'
        }}>
          {jsonString}
        </pre>
      ) : (
        <div style={{
          fontSize: '11.5px',
          fontFamily: 'var(--font-mono)',
          color: textColor,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '200px'
        }}>
          {compactString}
        </div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        style={{
          alignSelf: 'flex-start',
          background: 'transparent',
          border: 'none',
          color: isHighlighted ? 'var(--color-rose)' : 'var(--color-teal)',
          fontSize: '10px',
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
          marginTop: '2px',
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          outline: 'none'
        }}
      >
        {expanded ? 'Thu gọn ▲' : 'Xem chi tiết ▼'}
      </button>
    </div>
  );
};

export const HillClimbingComparison: React.FC<HillClimbingComparisonProps> = ({
  comparisons = []
}) => {
  const [activeTab, setActiveTab] = useState<'llm' | 'ga' | 'hc_only' | 'hc' | 'comparison'>('comparison');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleTabChange = (tab: 'llm' | 'ga' | 'hc_only' | 'hc' | 'comparison') => {
    setActiveTab(tab);
    setIsExpanded(false);
  };

  const visibleComparisons = useMemo(() => {
    return isExpanded ? comparisons : comparisons.slice(0, 4);
  }, [comparisons, isExpanded]);


  // Helper xác định ca kiểm thử là Hợp lệ (Positive) hay Lỗi/Bảo mật (Negative)
  const getExpectedResult = (val: any) => {
    if (!val) return 'Hợp lệ';
    if (val.expectedResult) return val.expectedResult;
    const str = JSON.stringify(val).toLowerCase();
    if (str.includes('<script') || str.includes('select') || str.includes('union') || str.includes('1=1')) {
      return 'Kiểm thử bảo mật (XSS/SQLi)';
    }
    if (str.includes('-') || str.includes('null') || str.includes('undefined')) {
      return 'Kiểm thử lỗi (Negative)';
    }
    return 'Hợp lệ (Positive)';
  };

  // Helper xác định thuộc tính nào đã được HC tinh chỉnh biên và mô tả
  const getTweakType = (ga: any, hc: any) => {
    if (!ga || !hc) return 'Không đổi';
    const tweakedFields: string[] = [];
    for (const key in hc) {
      if (ga[key] !== hc[key] && key !== 'expectedResult') {
        tweakedFields.push(key);
      }
    }
    if (tweakedFields.length === 0) return 'Tối ưu toàn cục';
    const fieldName = tweakedFields[0];
    const val = hc[fieldName];
    if (typeof val === 'number') {
      return `Biên số số học (${fieldName}: ${val})`;
    }
    if (typeof val === 'string') {
      if (val.length === 0) return `Biên chuỗi rỗng (${fieldName})`;
      if (val.includes('<script') || val.includes("'")) return `Biên SQLi/XSS (${fieldName})`;
      return `Biên độ dài chuỗi (${fieldName}: ${val.length} ký tự)`;
    }
    return `Tinh chỉnh biên (${fieldName})`;
  };

  // Tính toán các chỉ số thống kê trung bình
  const stats = useMemo(() => {
    if (comparisons.length === 0) return { avgLlm: 0, avgGa: 0, avgHc: 0, improvement: 0 };
    const avgLlm = comparisons.reduce((sum, c) => sum + c.llmFitness, 0) / comparisons.length;
    const avgGa = comparisons.reduce((sum, c) => sum + c.gaFitness, 0) / comparisons.length;
    const avgHc = comparisons.reduce((sum, c) => sum + c.hcFitness, 0) / comparisons.length;
    const improvement = ((avgHc - avgLlm) / (avgLlm || 1)) * 100;
    return { avgLlm, avgGa, avgHc, improvement };
  }, [comparisons]);

  // Chuyển đổi dữ liệu cho biểu đồ Recharts
  const chartData = useMemo(() => {
    return comparisons.slice(0, 8).map((c) => ({
      name: c.testId.replace('TC-OPT-', 'TC-'),
      'LLM thô (F0)': parseFloat(c.llmFitness.toFixed(3)),
      'Tối ưu GA': parseFloat(c.gaFitness.toFixed(3)),
      'Tinh chỉnh HC': parseFloat(c.hcFitness.toFixed(3)),
    }));
  }, [comparisons]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1.5px solid rgba(255, 255, 255, 0.1)',
          padding: '12px 16px',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          fontSize: '12px',
          backdropFilter: 'blur(8px)'
        }}>
          <p style={{ margin: '0 0 8px', fontWeight: 'bold', color: '#f8fafc', fontSize: '13px' }}>{label}</p>
          {payload.map((entry: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0', color: entry.color }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color }} />
              <span style={{ color: '#94a3b8' }}>{entry.name}:</span>
              <span style={{ fontWeight: 'bold' }}>{entry.value.toFixed(3)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
      
      {/* Header chính */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Scale size={20} style={{ color: 'var(--color-teal)' }} />
          Kết Quả Khảo Sát & Đối Chiếu Thuật Toán Thực Nghiệm
        </h3>
        <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0, lineHeight: 1.5 }}>
          Khảo sát chi tiết sự biến đổi dữ liệu kiểm thử và điểm thích nghi (Fitness) qua từng chặng tối ưu Memetic: LLM thô (F0) &rarr; Giải thuật di truyền (GA) &rarr; Tinh chỉnh biên leo đồi (HC).
        </p>
      </div>

      {/* Tabs Menu */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-subtle)',
        gap: '4px',
        overflowX: 'auto',
        paddingBottom: '1px'
      }}>
        {[
          { id: 'llm',        label: 'LLM',        icon: Sparkles, color: 'var(--color-teal)'   },
          { id: 'ga',         label: 'GA',          icon: Cpu,      color: 'var(--color-violet)' },
          { id: 'hc_only',    label: 'HC',          icon: Database, color: '#f59e0b'              },
          { id: 'hc',         label: 'GA + HC',     icon: Zap,      color: 'var(--color-rose)'   },
          { id: 'comparison', label: 'So sánh',     icon: Scale,    color: 'var(--color-teal)'   },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: isActive ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '12.5px',
                fontWeight: isActive ? 600 : 500,
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
                outline: 'none'
              }}
              onMouseOver={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseOut={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <Icon size={14} style={{ color: isActive ? tab.color : 'var(--text-secondary)' }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Nội dung theo Tab active */}
      
      {/* 1. TAB KẾT QUẢ LLM */}
      {activeTab === 'llm' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            padding: '12px 16px',
            background: 'rgba(13, 148, 136, 0.02)',
            borderLeft: '4px solid var(--color-teal)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
            borderRadius: '0 8px 8px 0'
          }}>
            <strong>Đặc tả thực nghiệm F0:</strong> Kết quả đầu tiên của hệ thống là tập test data F0 được sinh sau khi LLM phân tích đặc tả yêu cầu. So với phương pháp sinh ngẫu nhiên, dữ liệu do LLM tạo ra có ý nghĩa nghiệp vụ rõ ràng hơn vì bám sát các trường dữ liệu và ràng buộc trong đặc tả. Tuy nhiên, tập F0 ban đầu vẫn có thể chưa tối ưu hoàn toàn, chứa một số bản ghi trùng lặp hoặc chưa bao phủ hết các cận biên hóc búa của biểu mẫu đầu vào.
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600, width: '100px' }}>Mã Ca Test</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Giá Trị Dữ Liệu Sinh Thô (F0 từ LLM)</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, width: '120px' }}>Điểm Thích Nghi</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, width: '220px' }}>Phân Loại Nghiệp Vụ</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có dữ liệu F0. Hãy chạy tối ưu hóa để lấy kết quả.</td>
                  </tr>
                ) : (
                  visibleComparisons.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>{row.testId.replace('TC-OPT-', 'TC-LLM-')}</td>
                      <td style={{ padding: '12px', verticalAlign: 'top' }}>
                        <CollapsibleJson value={row.llmValue} />
                      </td>
                      <td style={{ padding: '12px', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'var(--color-teal)', fontWeight: 'bold' }}>{row.llmFitness.toFixed(3)}</span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          background: getExpectedResult(row.llmValue).includes('Lỗi') ? 'rgba(244, 63, 94, 0.1)' : getExpectedResult(row.llmValue).includes('bảo mật') ? 'rgba(139, 92, 246, 0.1)' : 'rgba(13, 148, 136, 0.1)',
                          color: getExpectedResult(row.llmValue).includes('Lỗi') ? 'var(--color-rose)' : getExpectedResult(row.llmValue).includes('bảo mật') ? 'var(--color-violet)' : 'var(--color-teal)',
                          border: getExpectedResult(row.llmValue).includes('Lỗi') ? '1px solid rgba(244, 63, 94, 0.15)' : getExpectedResult(row.llmValue).includes('bảo mật') ? '1px solid rgba(139, 92, 246, 0.15)' : '1px solid rgba(13, 148, 136, 0.15)'
                        }}>
                          {getExpectedResult(row.llmValue)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {comparisons.length > 4 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '20px',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  outline: 'none'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {isExpanded ? (
                  <>
                    Thu gọn <ChevronUp size={13} />
                  </>
                ) : (
                  <>
                    Xem thêm ({comparisons.length - 4} ca) <ChevronDown size={13} />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. TAB KẾT QUẢ GA */}
      {activeTab === 'ga' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            padding: '12px 16px',
            background: 'rgba(139, 92, 246, 0.02)',
            borderLeft: '4px solid var(--color-violet)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
            borderRadius: '0 8px 8px 0'
          }}>
            <strong>Tối ưu hóa đa mục tiêu bằng GA:</strong> Sau khi có tập F0, hệ thống áp dụng GA để tối ưu toàn cục. GA tiến hóa quần thể thông qua các pha: chọn lọc tự nhiên (Tournament Selection), lai ghép chéo (Crossover), đột biến thích ứng (Adaptive Mutation) và phạt trùng lặp. Tập dữ liệu sau GA có xu hướng đa dạng hóa vượt bậc, loại trừ các ca trùng lặp dư thừa và đẩy điểm thích nghi (Fitness) tổng thể lên mức rất cao.
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600, width: '100px' }}>Mã Ca Test</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Giá Trị Dữ Liệu Sau Tối Ưu GA</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, width: '120px' }}>Fitness GA</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, width: '140px' }}>Độ Cải Tiến</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có dữ liệu tối ưu GA.</td>
                  </tr>
                ) : (
                  visibleComparisons.map((row, idx) => {
                    const diff = row.gaFitness - row.llmFitness;
                    const pct = row.llmFitness > 0 ? (diff / row.llmFitness) * 100 : 0;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>{row.testId.replace('TC-OPT-', 'TC-GA-')}</td>
                        <td style={{ padding: '12px', verticalAlign: 'top' }}>
                          <CollapsibleJson value={row.gaValue} />
                        </td>
                        <td style={{ padding: '12px', fontFamily: 'var(--font-mono)' }}>
                          <span style={{ color: 'var(--color-violet)', fontWeight: 'bold' }}>{row.gaFitness.toFixed(3)}</span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          {diff > 0 ? (
                            <span style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              &uarr; +{pct.toFixed(0)}%
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Tối ưu sẵn</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {comparisons.length > 4 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '20px',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  outline: 'none'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {isExpanded ? (
                  <>
                    Thu gọn <ChevronUp size={13} />
                  </>
                ) : (
                  <>
                    Xem thêm ({comparisons.length - 4} ca) <ChevronDown size={13} />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. TAB KẾT QUẢ HC ONLY */}
      {activeTab === 'hc_only' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            padding: '12px 16px',
            background: 'rgba(245, 158, 11, 0.04)',
            borderLeft: '4px solid #f59e0b',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
            borderRadius: '0 8px 8px 0'
          }}>
            <strong>Tinh chỉnh cận biên Leo Đồi (HC Only):</strong> Sau giai đoạn GA, thuật toán Leo Đồi (Hill Climbing) tinh chỉnh từng test case tốt nhất bằng cách thử các giá trị lân cận của từng trường — đặc biệt là các biên số học (min/max) và biên độ dài chuỗi (maxLength). HC phát hiện lỗi off-by-one và kịch bản biên nhạy cảm mà GA có thể bỏ qua do tìm kiếm diện rộng.
          </div>

          {/* Stats nhanh */}
          {comparisons.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { label: 'Avg Fitness HC',   val: stats.avgHc.toFixed(3),   color: '#f59e0b', desc: 'Sau tinh chỉnh biên' },
                { label: 'Avg Fitness GA',   val: stats.avgGa.toFixed(3),   color: 'var(--color-violet)', desc: 'Trước khi HC' },
                { label: 'Cải thiện HC/GA',  val: `+${((stats.avgHc - stats.avgGa) / Math.max(stats.avgGa, 0.001) * 100).toFixed(1)}%`, color: '#22c55e', desc: 'HC so với GA' },
              ].map((card, idx) => (
                <div key={idx} style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-subtle)',
                  padding: '12px 14px', borderRadius: '8px', textAlign: 'center'
                }}>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: card.color, margin: '5px 0' }}>{card.val}</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{card.desc}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600, width: '110px' }}>Mã Ca Test</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Giá Trị Tối Ưu Cận Biên (HC)</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, width: '120px' }}>Fitness HC</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, width: '130px' }}>Δ So với GA</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, width: '230px' }}>Phân Tích Cận Biên (BVA)</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có dữ liệu HC. Hãy chạy tối ưu hóa để lấy kết quả.</td>
                  </tr>
                ) : (
                  visibleComparisons.map((row, idx) => {
                    const hasImproved = row.hcFitness > row.gaFitness;
                    const delta = row.hcFitness - row.gaFitness;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                          {row.testId.replace('TC-OPT-', 'TC-HC-')}
                        </td>
                        <td style={{ padding: '12px', verticalAlign: 'top' }}>
                          <CollapsibleJson value={row.hcValue} isHighlighted={hasImproved} />
                        </td>
                        <td style={{ padding: '12px', fontFamily: 'var(--font-mono)' }}>
                          <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>
                            {row.hcFitness.toFixed(3)}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          {delta > 0 ? (
                            <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '12.5px' }}>
                              ↑ +{(delta * 100).toFixed(1)}%
                            </span>
                          ) : delta < 0 ? (
                            <span style={{ color: 'var(--color-rose)', fontSize: '12px' }}>
                              ↓ {(delta * 100).toFixed(1)}%
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Không đổi</span>
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '10.5px',
                            fontWeight: 600,
                            background: hasImproved ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
                            color: hasImproved ? '#f59e0b' : 'var(--text-secondary)',
                            border: hasImproved ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.06)'
                          }}>
                            {getTweakType(row.gaValue, row.hcValue)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {comparisons.length > 4 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '20px',
                  color: 'var(--text-primary)',
                  fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)', outline: 'none'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseOut={(e)  => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {isExpanded ? <>Thu gọn <ChevronUp size={13} /></> : <>Xem thêm ({comparisons.length - 4} ca) <ChevronDown size={13} /></>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. TAB KẾT QUẢ GA + HC */}
      {activeTab === 'hc' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            padding: '12px 16px',
            background: 'rgba(244, 63, 94, 0.02)',
            borderLeft: '4px solid var(--color-rose)',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
            borderRadius: '0 8px 8px 0'
          }}>
            <strong>Tinh chỉnh cận biên leo đồi (HC):</strong> Giai đoạn lai ghép Memetic (GA + HC) là bộ test data cuối cùng sau khi đã trải qua cả hai giai đoạn tối ưu. GA đảm nhiệm vai trò tìm kiếm rộng và cải thiện chất lượng tổng thể của tập dữ liệu. HC tiếp tục tinh chỉnh chi tiết các test case tốt nhất, đặc biệt là các giá trị tại biên hoặc gần biên. Nhờ đó, các lỗi off-by-one và các trường hợp lỗi biên nhạy cảm được quét sạch và phát hiện nhanh chóng.
          </div>

          <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600, width: '100px' }}>Mã Ca Test</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Giá Trị Tối Ưu Cận Biên Cuối Cùng (GA + HC)</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, width: '120px' }}>Fitness HC</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, width: '220px' }}>Phân Tích Cận Biên (BVA)</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có dữ liệu tối ưu HC.</td>
                  </tr>
                ) : (
                  visibleComparisons.map((row, idx) => {
                    const hasImproved = row.hcFitness > row.gaFitness;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>{row.testId}</td>
                        <td style={{ padding: '12px', verticalAlign: 'top' }}>
                          <CollapsibleJson value={row.hcValue} isHighlighted={hasImproved} />
                        </td>
                        <td style={{ padding: '12px', fontFamily: 'var(--font-mono)' }}>
                          <span style={{ color: 'var(--color-rose)', fontWeight: 'bold' }}>
                            {row.hcFitness.toFixed(3)}
                            {hasImproved && (
                              <span style={{ fontSize: '10.5px', color: '#16a34a', marginLeft: '4px', fontWeight: 'normal' }}>
                                (+{((row.hcFitness - row.gaFitness) * 100).toFixed(0)}%)
                              </span>
                            )}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '10.5px',
                            fontWeight: 600,
                            background: hasImproved ? 'rgba(236, 72, 153, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                            color: hasImproved ? 'var(--color-rose)' : 'var(--text-secondary)',
                            border: hasImproved ? '1px solid rgba(236, 72, 153, 0.15)' : '1px solid rgba(255, 255, 255, 0.08)'
                          }}>
                            {getTweakType(row.gaValue, row.hcValue)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {comparisons.length > 4 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '20px',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  outline: 'none'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {isExpanded ? (
                  <>
                    Thu gọn <ChevronUp size={13} />
                  </>
                ) : (
                  <>
                    Xem thêm ({comparisons.length - 4} ca) <ChevronDown size={13} />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. TAB SO SÁNH & ĐÁNH GIÁ (CHỨA BIỂU ĐỒ VÀ BẢNG SIDE-BY-SIDE) */}
      {activeTab === 'comparison' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Dashboard mini & Thống kê */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            {[
              { label: 'LLM Khởi Tạo (F0)', val: stats.avgLlm.toFixed(3), color: 'var(--color-teal)', desc: 'Tập mầm thô ban đầu' },
              { label: 'Tối Ưu GA', val: stats.avgGa.toFixed(3), color: 'var(--color-violet)', desc: 'Sau tiến hóa di truyền' },
              { label: 'M Memetic (GA + HC)', val: stats.avgHc.toFixed(3), color: 'var(--color-rose)', desc: 'Sau tinh chỉnh leo đồi' },
              {
                label: 'Cải Thiện Tổng Thể',
                val: `+${stats.improvement.toFixed(1)}%`,
                color: '#16a34a',
                desc: 'Memetic so với LLM F0',
                isHighlight: true
              }
            ].map((card, idx) => (
              <div key={idx} style={{
                background: 'rgba(255,255,255,0.01)',
                border: card.isHighlight ? '1.5px solid rgba(22, 163, 74, 0.25)' : '1px solid var(--border-subtle)',
                padding: '14px 16px',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: card.color, margin: '6px 0' }}>{card.val}</div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{card.desc}</div>
              </div>
            ))}
          </div>

          {/* KHU VỰC VẼ BIỂU ĐỒ CỘT RECHARTS */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.12)',
            border: '1px solid var(--border-subtle)',
            padding: '20px 16px 12px',
            borderRadius: '10px',
            width: '100%',
            height: '320px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingLeft: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BarChart2 size={15} style={{ color: 'var(--color-teal)' }} />
                Biểu đồ 3.3. So sánh trực tiếp điểm thích nghi (Fitness) giữa các thuật toán
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(Khảo sát 8 mẫu test tiêu biểu)</span>
            </div>
            
            {chartData.length === 0 ? (
              <div style={{ display: 'flex', height: '80%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Chưa có dữ liệu để vẽ biểu đồ.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="85%">
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                  barGap={3}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    fontSize={11}
                    domain={[0, 1.0]}
                    tickLine={false}
                  />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    iconSize={10}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}
                  />
                  <Bar dataKey="LLM thô (F0)" fill="var(--color-teal)" radius={[4, 4, 0, 0]} opacity={0.7} />
                  <Bar dataKey="Tối ưu GA" fill="var(--color-violet)" radius={[4, 4, 0, 0]} opacity={0.8} />
                  <Bar dataKey="Tinh chỉnh HC" fill="var(--color-rose)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Bảng so sánh đối chiếu side-by-side đầy đủ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '2px' }}>
              <Scale size={15} style={{ color: 'var(--color-violet)' }} />
              Bảng đối chiếu cấu trúc trường và tiến trình thay đổi giá trị
            </div>
            
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '2.5px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '8px 12px', fontWeight: 600, width: '75px' }}>Mã Test</th>
                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>1. LLM Thô (F0)</th>
                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>2. Tối Ưu GA</th>
                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>3. Tinh Chỉnh HC (Cuối)</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, width: '70px', textAlign: 'center' }}>Fit LLM</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, width: '70px', textAlign: 'center' }}>Fit GA</th>
                    <th style={{ padding: '8px 10px', fontWeight: 600, width: '70px', textAlign: 'center' }}>Fit HC</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa chạy thuật toán để lấy kết quả.</td>
                    </tr>
                  ) : (
                    visibleComparisons.map((row, idx) => {
                      const hasImproved = row.hcFitness > row.gaFitness;
                      return (
                        <tr key={idx} style={{
                          borderBottom: '1px solid rgba(255,255,255,0.02)',
                          background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'
                        }}>
                          <td style={{ padding: '12px 10px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>{row.testId}</td>
                          <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
                            <CollapsibleJson value={row.llmValue} />
                          </td>
                          <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
                            <CollapsibleJson value={row.gaValue} />
                          </td>
                          <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
                            <CollapsibleJson value={row.hcValue} isHighlighted={hasImproved} />
                          </td>
                          <td style={{ padding: '12px 5px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textAlign: 'center' }}>{row.llmFitness.toFixed(2)}</td>
                          <td style={{ padding: '12px 5px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', textAlign: 'center' }}>{row.gaFitness.toFixed(2)}</td>
                          <td style={{ padding: '12px 5px', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                            <span style={{ fontWeight: 'bold', color: hasImproved ? 'var(--color-rose)' : 'var(--text-primary)' }}>
                              {row.hcFitness.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {comparisons.length > 4 && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '20px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    outline: 'none'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {isExpanded ? (
                    <>
                      Thu gọn <ChevronUp size={13} />
                    </>
                  ) : (
                    <>
                      Xem thêm ({comparisons.length - 4} ca) <ChevronDown size={13} />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HillClimbingComparison;

