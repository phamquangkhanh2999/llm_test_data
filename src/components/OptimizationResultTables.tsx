import { Activity, Download, FileDiff, Search, X } from 'lucide-react';
import React, { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import * as XLSX from 'xlsx';
import type { ComparisonData, OptimizationSnapshot } from '../types/testcase';

interface Props {
  snapshot?: OptimizationSnapshot;
  schema: any[];
}

export const OptimizationResultTables: React.FC<Props> = ({ snapshot, schema }) => {
  const [searchText, setSearchText] = useState('');
  const [filterMode, setFilterMode] = useState<'All' | 'Improved' | 'NotImproved'>('All');
  const [selectedTcId, setSelectedTcId] = useState<string | null>(null);

  // Expand rows state
  const [expandedRowIdT1, setExpandedRowIdT1] = useState<string | null>(null);
  const [expandedRowIdT2, setExpandedRowIdT2] = useState<string | null>(null);

  // Tabs state per row for Table 2
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>({});

  const toggleRowT1 = (id: string) => {
    setExpandedRowIdT1(prev => prev === id ? null : id);
  };

  const toggleRowT2 = (id: string) => {
    setExpandedRowIdT2(prev => {
      if (prev !== id && !activeTabs[id]) {
        setActiveTabs(prevTabs => ({ ...prevTabs, [id]: 'Data Comparison' }));
      }
      return prev === id ? null : id;
    });
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [customPageSize, setCustomPageSize] = useState('');

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchText, filterMode]);

  if (!snapshot || !snapshot.comparisonData) {
    return <div className="text-muted">Chưa có dữ liệu so sánh từ hệ thống.</div>;
  }

  // Filter list of comparison data
  const filteredData = snapshot.comparisonData.filter((data: ComparisonData) => {
    const matchSearch = data.tcId.toLowerCase().includes(searchText.toLowerCase());
    if (!matchSearch) return false;

    const finalF = data.final?.finalFitness ?? 0;
    const llmF = data.llm?.llmFitness ?? 0;

    if (filterMode === 'Improved') {
      return finalF > llmF;
    } else if (filterMode === 'NotImproved') {
      return finalF <= llmF;
    }
    return true; // 'All'
  });

  const selectedData = snapshot.comparisonData.find(d => d.tcId === selectedTcId);
  const totalPages = Math.ceil(filteredData.length / pageSize);

  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleCustomPageSizeChange = (val: string) => {
    setCustomPageSize(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setPageSize(parsed);
      setCurrentPage(1);
    }
  };

  const handleExport = (type: 'json' | 'excel' | 'csv', source: 'GA' | 'HC' | 'Final') => {
    let exportData: any[] = [];

    if (source === 'GA') {
      exportData = filteredData.map(d => ({ tcId: d.tcId, ...d.ga?.values }));
    } else if (source === 'HC') {
      exportData = filteredData.map(d => ({ tcId: d.tcId, ...d.hc?.values }));
    } else if (source === 'Final') {
      exportData = filteredData.map(d => ({ tcId: d.tcId, ...d.final?.values }));
    }

    if (type === 'json') {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dataset_${source.toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (type === 'excel' || type === 'csv') {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Dataset");

      if (type === 'excel') {
        XLSX.writeFile(workbook, `dataset_${source.toLowerCase()}.xlsx`);
      } else {
        XLSX.writeFile(workbook, `dataset_${source.toLowerCase()}.csv`);
      }
    }
  };

  const ExportButtonGroup = ({ source }: { source: 'GA' | 'HC' | 'Final' }) => (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <Download size={14} color="var(--text-secondary)" />
      <button onClick={() => handleExport('json', source)} style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)', cursor: 'pointer', color: 'var(--text-primary)' }}>JSON</button>
      <button onClick={() => handleExport('excel', source)} style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)', cursor: 'pointer', color: 'var(--text-primary)' }}>Excel</button>
      <button onClick={() => handleExport('csv', source)} style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)', cursor: 'pointer', color: 'var(--text-primary)' }}>CSV</button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Tìm theo Mã Kịch Bản (TC_ID)..." 
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '10px 12px 10px 36px', 
              borderRadius: '6px', 
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-subtle)',
              fontSize: '14px',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', background: 'var(--surface-subtle)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          {['All', 'Improved', 'NotImproved'].map(mode => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode as any)}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: filterMode === mode ? 'bold' : '500',
                cursor: 'pointer',
                border: 'none',
                background: filterMode === mode ? 'var(--color-teal)' : 'transparent',
                color: filterMode === mode ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s',
                boxShadow: filterMode === mode ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              {mode === 'All' ? 'Tất cả' : mode === 'Improved' ? 'Đã cải thiện' : 'Không cải thiện'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
        <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Tổng Kịch Bản</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{snapshot.summary.total}</div>
        </div>
        <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Đã Cải Thiện</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-teal)' }}>{snapshot.summary.improved}</div>
        </div>
        <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Thay Đổi Dữ Liệu</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#3b82f6' }}>{snapshot.summary.changed}</div>
        </div>
        <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Thuật Toán HC</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#8b5cf6' }}>{snapshot.summary.hcSelected ?? 0}</div>
        </div>
        <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Thuật Toán GA</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f59e0b' }}>{snapshot.summary.gaSelected ?? 0}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* GA RESULT */}
        <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={16} className="text-violet" />
              Tiến Hóa Di Truyền (GA Evolution)
            </h3>
            <ExportButtonGroup source="GA" />
          </div>
          <div style={{ overflowY: 'auto', overflowX: 'auto', maxHeight: '70vh' }}>
            <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-subtle)', zIndex: 1 }}>
                <tr style={{ borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 16px', width: '40px', textAlign: 'center' }}></th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', width: '120px', textAlign: 'left' }}>Mã Kịch Bản (TC)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', width: '120px', textAlign: 'right' }}>Điểm Đầu (Fitness F0)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', width: '120px', textAlign: 'right' }}>Điểm Cuối (Fitness GA)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', width: '100px', textAlign: 'right' }}>Độ Lệch (Δ)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', width: '150px', textAlign: 'center' }}>Số Trường Đổi (Changed)</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map(data => {
                  const f0Fit = (data.llm?.llmFitness ?? 0) / 100;
                  const gaFit = (data.ga?.gaFitness ?? 0) / 100;
                  const delta = gaFit - f0Fit;
                  const isExpanded = expandedRowIdT1 === data.tcId;

                  let changedCount = 0;
                  const fieldDiffs: { field: string, f0: string, ga: string }[] = [];
                  schema.forEach(f => {
                    const f0Val = String(data.llm?.values?.[f.name] ?? '-');
                    const gaVal = String(data.ga?.values?.[f.name] ?? '-');
                    if (f0Val !== gaVal) {
                      changedCount++;
                      fieldDiffs.push({ field: f.name, f0: f0Val, ga: gaVal });
                    }
                  });

                  return (
                    <React.Fragment key={`t1-${data.tcId}`}>
                      <tr
                        onClick={() => toggleRowT1(data.tcId)}
                        style={{
                          borderBottom: isExpanded ? 'none' : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          background: isExpanded ? 'var(--surface-subtle)' : 'transparent',
                          transition: 'background 0.2s'
                        }}
                      >
                        <td style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          {isExpanded ? '▼' : '▶'}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 'bold', color: 'var(--color-teal)' }}>{data.tcId}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {f0Fit.toFixed(3)}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--color-violet)' }}>
                          {gaFit.toFixed(3)}
                        </td>
                        <td style={{ 
                          padding: '14px 16px', 
                          textAlign: 'right', 
                          fontFamily: 'var(--font-mono)', 
                          fontWeight: 'bold',
                          color: delta > 0 ? 'var(--color-teal)' : delta < 0 ? '#ef4444' : 'var(--text-muted)' 
                        }}>
                          {delta > 0 ? '+' : ''}{delta.toFixed(3)}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span style={{ fontWeight: 'bold', color: changedCount > 0 ? '#3b82f6' : 'var(--text-muted)' }}>
                            {changedCount}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)' }}>
                          <td colSpan={6} style={{ padding: '16px 24px' }}>
                            <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                              <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)' }}>Đối Chiếu Dữ Liệu (Field Diff)</h4>
                              {fieldDiffs.length > 0 ? (
                                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '12px' }}>
                                  <thead>
                                    <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', width: '25%' }}>Trường (Field)</th>
                                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)', width: '37.5%' }}>F0</th>
                                      <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)', width: '37.5%' }}>GA</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {fieldDiffs.map(diff => (
                                      <tr key={diff.field}>
                                        <td style={{ padding: '8px', fontWeight: 'bold', borderBottom: '1px solid var(--border-subtle)', color: 'var(--color-teal)', wordBreak: 'break-all' }}>{diff.field}</td>
                                        <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{diff.f0}</td>
                                        <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)', color: '#3b82f6', fontWeight: 'bold', wordBreak: 'break-all' }}>{diff.ga}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Không có trường dữ liệu nào thay đổi.</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* GA + HC RESULT */}
        <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={16} className="text-violet" />
              Tối Ưu Cục Bộ (HC Local Optimization)
            </h3>
            <ExportButtonGroup source="HC" />
          </div>
          <div style={{ overflowY: 'auto', overflowX: 'auto', maxHeight: '70vh' }}>
            <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-subtle)', zIndex: 1 }}>
                <tr style={{ borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 16px', width: '40px', textAlign: 'center' }}></th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', width: '100px', textAlign: 'left' }}>Mã Kịch Bản (TC)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', width: '80px', textAlign: 'center' }}>Nguồn (Origin)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', width: '100px', textAlign: 'right' }}>Điểm Đầu (Fitness GA)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', width: '100px', textAlign: 'right' }}>Điểm Cuối (Fitness Final)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', width: '100px', textAlign: 'right' }}>Độ Lệch (Δ Fitness)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', width: '80px', textAlign: 'center' }}>Số Trường Đổi</th>
                  <th style={{ padding: '12px 16px', width: '100px', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map(data => {
                  const gaFit = (data.ga?.gaFitness ?? 0) / 100;
                  const finalFit = (data.final?.finalFitness ?? 0) / 100;
                  const delta = finalFit - gaFit;
                  const origin = data.final?.origin || 'GA';
                  const isExpanded = expandedRowIdT2 === data.tcId;
                  const currentTab = activeTabs[data.tcId] || 'Data Comparison';

                  // Count changed fields between GA and HC
                  let changedFieldsCount = 0;
                  schema.forEach(f => {
                    const gaVal = String(data.ga?.values?.[f.name] ?? '-');
                    const hcVal = String(data.final?.values?.[f.name] ?? '-');
                    if (gaVal !== hcVal) changedFieldsCount++;
                  });

                  return (
                    <React.Fragment key={`t2-${data.tcId}`}>
                      <tr
                        onClick={() => toggleRowT2(data.tcId)}
                        style={{
                          borderBottom: isExpanded ? 'none' : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          background: isExpanded ? 'var(--surface-subtle)' : 'transparent',
                          transition: 'background 0.2s'
                        }}
                      >
                        <td style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          {isExpanded ? '▼' : '▶'}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 'bold', color: 'var(--color-teal)' }}>{data.tcId}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span style={{ 
                            fontSize: '10px', 
                            padding: '2px 6px', 
                            borderRadius: '4px', 
                            background: origin === 'GA' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            color: origin === 'GA' ? '#8b5cf6' : 'var(--color-teal)',
                            fontWeight: 'bold'
                          }}>
                            {origin}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {gaFit.toFixed(3)}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--color-teal)' }}>
                          {finalFit.toFixed(3)}
                        </td>
                        <td style={{ 
                          padding: '14px 16px', 
                          textAlign: 'right', 
                          fontFamily: 'var(--font-mono)', 
                          fontWeight: 'bold',
                          color: delta > 0 ? 'var(--color-teal)' : delta < 0 ? '#ef4444' : 'var(--text-muted)' 
                        }}>
                          {delta > 0 ? '+' : ''}{delta.toFixed(3)}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span style={{ color: changedFieldsCount > 0 ? '#3b82f6' : 'var(--text-muted)', fontWeight: changedFieldsCount > 0 ? 'bold' : 'normal' }}>
                            {changedFieldsCount}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTcId(data.tcId);
                            }}
                            style={{
                              padding: '6px 12px',
                              background: 'var(--surface-subtle)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              color: 'var(--text-primary)',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--border-subtle)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'var(--surface-subtle)';
                            }}
                          >
                            Xem Chi Tiết
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)' }}>
                          <td colSpan={8} style={{ padding: '0 24px 24px 24px' }}>
                            <div style={{ background: 'var(--bg-card)', borderRadius: '0 0 8px 8px', border: '1px solid var(--border-subtle)', borderTop: 'none', overflow: 'hidden' }}>

                              {/* TABS HEADER */}
                              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.02)' }}>
                                {['Data Comparison', 'Fitness'].map(tab => {
                                  const tabLabels: Record<string, string> = {
                                    'Data Comparison': 'Đối Chiếu Dữ Liệu (Data Comparison)',
                                    'Fitness': 'Điểm Số Đánh Giá (Fitness)'
                                  };
                                  return (
                                    <button
                                      key={tab}
                                      onClick={() => setActiveTabs(prev => ({ ...prev, [data.tcId]: tab }))}
                                      style={{
                                        padding: '12px 20px',
                                        fontSize: '13px',
                                        fontWeight: 'bold',
                                        color: currentTab === tab ? 'var(--color-teal)' : 'var(--text-secondary)',
                                        background: currentTab === tab ? 'var(--bg-card)' : 'transparent',
                                        border: 'none',
                                        borderBottom: currentTab === tab ? '2px solid var(--color-teal)' : '2px solid transparent',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                      }}
                                    >
                                      {tabLabels[tab]}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* TABS CONTENT */}
                              <div style={{ padding: '20px' }}>

                                {currentTab === 'Data Comparison' && (
                                  <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                                    <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '12px' }}>
                                      <thead>
                                        <tr style={{ background: 'rgba(0,0,0,0.02)' }}>
                                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', width: '22%' }}>Trường (Field)</th>
                                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)', width: '26%' }}>F0</th>
                                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)', width: '26%' }}>GA</th>
                                          <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)', width: '26%' }}>HC (Kết quả cuối)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {schema.map(f => {
                                          const f0Val = String(data.llm?.values?.[f.name] ?? '-');
                                          const gaVal = String(data.ga?.values?.[f.name] ?? '-');
                                          const finalVal = String(data.final?.values?.[f.name] ?? '-');
                                          const gaDiff = f0Val !== gaVal;
                                          const finalDiff = gaVal !== finalVal;

                                          return (
                                            <tr key={f.name}>
                                              <td style={{ padding: '8px', fontWeight: 'bold', borderBottom: '1px solid var(--border-subtle)', color: 'var(--color-teal)', wordBreak: 'break-all' }}>{f.name}</td>
                                              <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{f0Val}</td>
                                              <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)', color: gaDiff ? '#3b82f6' : 'var(--text-primary)', fontWeight: gaDiff ? 'bold' : 'normal', background: gaDiff ? 'rgba(59,130,246,0.05)' : 'transparent', wordBreak: 'break-all' }}>{gaVal}</td>
                                              <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)', color: finalDiff ? '#8b5cf6' : 'var(--text-primary)', fontWeight: finalDiff ? 'bold' : 'normal', background: finalDiff ? 'rgba(139,92,246,0.05)' : 'transparent', wordBreak: 'break-all' }}>{finalVal}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}





                                {currentTab === 'Fitness' && (
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: '1px solid var(--border-subtle)', borderRadius: '8px', overflow: 'hidden' }}>
                                    <thead>
                                      <tr style={{ background: 'var(--surface-subtle)' }}>
                                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>Chỉ Số (Metric)</th>
                                        <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)' }}>F0</th>
                                        <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)' }}>GA</th>
                                        <th style={{ padding: '10px', textAlign: 'right', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)' }}>HC</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={{ padding: '10px', fontWeight: 'bold' }}>Validation</td>
                                        <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', borderLeft: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{((data.llm?.validationScore ?? 0) / 100).toFixed(3)}</td>
                                        <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', borderLeft: '1px solid var(--border-subtle)' }}>{((data.ga?.validationScore ?? 0) / 100).toFixed(3)}</td>
                                        <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', borderLeft: '1px solid var(--border-subtle)' }}>{((data.hc?.validationScore ?? 0) / 100).toFixed(3)}</td>
                                      </tr>
                                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={{ padding: '10px', fontWeight: 'bold' }}>Boundary</td>
                                        <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', borderLeft: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{((data.llm?.boundaryScore ?? 0) / 100).toFixed(3)}</td>
                                        <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', borderLeft: '1px solid var(--border-subtle)' }}>{((data.ga?.boundaryScore ?? 0) / 100).toFixed(3)}</td>
                                        <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', borderLeft: '1px solid var(--border-subtle)' }}>{((data.hc?.boundaryScore ?? 0) / 100).toFixed(3)}</td>
                                      </tr>
                                      <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={{ padding: '10px', fontWeight: 'bold' }}>Negative / Diversity</td>
                                        <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', borderLeft: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{((data.llm?.negativeScore ?? 0) / 100).toFixed(3)}</td>
                                        <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', borderLeft: '1px solid var(--border-subtle)' }}>{((data.ga?.negativeScore ?? 0) / 100).toFixed(3)}</td>
                                        <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', borderLeft: '1px solid var(--border-subtle)' }}>{((data.hc?.negativeScore ?? 0) / 100).toFixed(3)}</td>
                                      </tr>
                                      <tr style={{ background: 'rgba(13,148,136,0.05)' }}>
                                        <td style={{ padding: '10px', fontWeight: 'bold', color: 'var(--color-teal)' }}>Total</td>
                                        <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', borderLeft: '1px solid var(--border-subtle)', fontWeight: 'bold', color: 'var(--text-secondary)' }}>{((data.llm?.llmFitness ?? 0) / 100).toFixed(3)}</td>
                                        <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', borderLeft: '1px solid var(--border-subtle)', fontWeight: 'bold' }}>{gaFit.toFixed(3)}</td>
                                        <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'var(--font-mono)', borderLeft: '1px solid var(--border-subtle)', fontWeight: 'bold', color: '#8b5cf6' }}>{((data.hc?.hcFitness ?? 0) / 100).toFixed(3)}</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination controls */}
        {filteredData.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            {/* Page Size Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span>Số dòng/trang:</span>
              {[30, 60, 100].map(size => (
                <button
                  key={size}
                  onClick={() => {
                    setPageSize(size);
                    setCustomPageSize('');
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-subtle)',
                    background: pageSize === size && !customPageSize ? 'var(--color-teal)' : 'transparent',
                    color: pageSize === size && !customPageSize ? '#fff' : 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {size}
                </button>
              ))}
              <input
                type="number"
                placeholder="Khác..."
                value={customPageSize}
                onChange={(e) => handleCustomPageSizeChange(e.target.value)}
                min="1"
                max="500"
                style={{
                  width: '65px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-subtle)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  textAlign: 'center'
                }}
              />
            </div>

            {/* Pagination Navigation */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    background: 'transparent',
                    color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Trước
                </button>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Trang <strong>{currentPage}</strong> / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    background: 'transparent',
                    color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  Sau
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* MODAL DETAIL */}
      {selectedTcId && selectedData && (
        <DetailModal
          data={selectedData}
          schema={schema}
          onClose={() => setSelectedTcId(null)}
        />
      )}
    </div>
  );
};

// --- MODAL DETAIL COMPONENT ---
const DetailModal: React.FC<{
  data: ComparisonData;
  schema: any[];
  onClose: () => void;
}> = ({ data, schema, onClose }) => {

  // Chart 1: Fitness Evolution Line/Bar
  const chartFitnessEvolution = [
    { phase: 'LLM', fitness: (data.llm?.llmFitness ?? 0) / 100 },
    { phase: 'GA', fitness: (data.ga?.gaFitness ?? 0) / 100 },
    { phase: 'HC', fitness: (data.hc?.hcFitness ?? 0) / 100 },
    { phase: 'Final', fitness: (data.final?.finalFitness ?? 0) / 100 },
  ];

  // Chart 2: Metric Breakdown Bar Chart
  const chartMetricBreakdown = [
    {
      metric: 'Validation',
      LLM: (data.llm?.validationScore ?? 0) / 100,
      GA: (data.ga?.validationScore ?? 0) / 100,
      HC: (data.hc?.validationScore ?? 0) / 100,
      Final: (data.final?.validationScore ?? 0) / 100,
    },
    {
      metric: 'Boundary',
      LLM: (data.llm?.boundaryScore ?? 0) / 100,
      GA: (data.ga?.boundaryScore ?? 0) / 100,
      HC: (data.hc?.boundaryScore ?? 0) / 100,
      Final: (data.final?.boundaryScore ?? 0) / 100,
    },
    {
      metric: 'Negative',
      LLM: (data.llm?.negativeScore ?? 0) / 100,
      GA: (data.ga?.negativeScore ?? 0) / 100,
      HC: (data.hc?.negativeScore ?? 0) / 100,
      Final: (data.final?.negativeScore ?? 0) / 100,
    }
  ];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)', zIndex: 9999,
      display: 'flex', justifyContent: 'flex-end',
      backdropFilter: 'blur(2px)'
    }}>
      <div
        style={{
          background: 'var(--bg-card)', width: '80vw', maxWidth: '1400px',
          height: '100vh', display: 'flex', flexDirection: 'column',
          boxShadow: '-10px 0 40px rgba(0,0,0,0.2)',
          transform: 'translateX(0)', transition: 'transform 0.3s ease'
        }}
        className="drawer-content"
      >
        {/* HEADER */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-subtle)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <FileDiff size={20} style={{ color: 'var(--color-teal)' }} />
              {data.tcId}
            </h2>
            <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <b>Scenario:</b> {data.llm?.scenario || '-'} | <b>Origin:</b> <span style={{ color: 'var(--color-teal)', fontWeight: 'bold' }}>{data.final?.origin}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={24} />
          </button>
        </div>

        {/* BODY */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '32px' }}>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Chart 1: Fitness Evolution */}
            <div style={{ height: '250px', background: 'var(--surface-subtle)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center', color: 'var(--text-primary)' }}>Tiến Hóa Điểm Số (Fitness Evolution)</div>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={chartFitnessEvolution} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                  <XAxis dataKey="phase" tick={{ fontSize: 12, fontWeight: 'bold' }} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: 'var(--border-subtle)', opacity: 0.5 }} />
                  <Bar dataKey="fitness" fill="var(--color-teal)" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 2: Metric Breakdown */}
            <div style={{ height: '250px', background: 'var(--surface-subtle)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '16px', textAlign: 'center', color: 'var(--text-primary)' }}>Phân Rã Chỉ Số (Metric Breakdown)</div>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={chartMetricBreakdown} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                  <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: 'var(--border-subtle)', opacity: 0.5 }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="LLM" fill="#94a3b8" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="GA" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="HC" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Final" fill="var(--color-teal)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* DATA EVOLUTION */}
          <div>
            <h3 style={{ fontSize: '15px', marginBottom: '12px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>Biến Đổi Dữ Liệu (Data Evolution)</h3>
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-subtle)' }}>
                    <th rowSpan={2} style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>Trường dữ liệu</th>
                    <th rowSpan={2} style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)' }}>
                      <div>1. LLM Thô (F0)</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>Dữ liệu ban đầu</div>
                    </th>
                    <th rowSpan={2} style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)' }}>
                      <div>2. Tối ưu GA</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>Sau thuật toán di truyền</div>
                    </th>
                    <th rowSpan={2} style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)' }}>
                      <div>3. Tinh Chỉnh HC (Cuối)</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>Sau tinh chỉnh cục bộ</div>
                    </th>
                    <th colSpan={3} style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)' }}>Đánh giá Fitness (Fit)</th>

                  </tr>
                  <tr style={{ background: 'var(--surface-subtle)' }}>
                    <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)' }}>LLM Thô (F0)</th>
                    <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)' }}>GA</th>
                    <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)' }}>HC (Cuối)</th>
                  </tr>
                </thead>
                <tbody>
                  {[...schema.map(f => f.name), 'expectedResult'].map(fieldName => {
                    let llmVal, gaVal, hcVal;
                    let llmFit, gaFit, hcFit;

                    if (fieldName === 'expectedResult') {
                      llmVal = data.llm?.expectedResult ?? '-';
                      gaVal = data.ga?.expectedResult ?? '-';
                      hcVal = data.hc?.expectedResult ?? '-';
                      // expectedResult fitness không áp dụng per-field — ẩn
                      llmFit = null;
                      gaFit = null;
                      hcFit = null;
                    } else {
                      llmVal = String(data.llm?.values?.[fieldName] ?? '-');
                      gaVal = String(data.ga?.values?.[fieldName] ?? '-');
                      hcVal = String(data.hc?.values?.[fieldName] ?? '-');

                      // Dùng overall fitness của TC (đã normalize đúng công thức)
                      llmFit = data.llm?.llmFitness ?? 0;
                      gaFit = data.ga?.gaFitness ?? 0;
                      hcFit = data.hc?.hcFitness ?? 0;
                    }

                    const isChanged = llmVal !== hcVal;
                    const gaImproved = gaFit !== null && gaFit > (llmFit ?? 0) + 0.01;
                    const hcImproved = hcFit !== null && hcFit > (gaFit ?? 0) + 0.01;
                    const delta_ga = gaFit !== null && llmFit !== null ? gaFit - llmFit : 0;
                    const delta_hc = hcFit !== null && gaFit !== null ? hcFit - gaFit : 0;

                    return (
                      <tr key={fieldName} style={{ borderBottom: '1px solid var(--border-subtle)', background: isChanged ? 'rgba(13,148,136,0.02)' : 'transparent' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileDiff size={14} style={{ color: 'var(--text-muted)' }} />
                          {fieldName}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)', borderLeft: '1px solid var(--border-subtle)', maxWidth: '200px', wordBreak: 'break-all', fontSize: '11px' }}>{llmVal}</td>
                        <td style={{ padding: '12px', borderLeft: '1px solid var(--border-subtle)', maxWidth: '200px', wordBreak: 'break-all', fontSize: '11px' }}>
                          <div style={{ color: gaVal !== llmVal ? 'var(--color-teal)' : 'var(--text-secondary)' }}>{gaVal}</div>
                          {gaVal !== llmVal && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>↑ đã thay đổi</div>}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-primary)', borderLeft: '1px solid var(--border-subtle)', maxWidth: '200px', wordBreak: 'break-all', fontSize: '11px' }}>
                          <div style={{ color: hcVal !== gaVal ? '#8b5cf6' : 'var(--text-primary)' }}>{hcVal}</div>
                          {hcVal !== gaVal && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>↑ tinh chỉnh HC</div>}
                        </td>
                        {/* Fitness columns */}

                        {llmFit !== null ? (
                          <>
                            <td style={{ padding: '12px', textAlign: 'center', borderLeft: '1px solid var(--border-subtle)' }}>
                              <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>{llmFit.toFixed(1)}</div>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center', borderLeft: '1px solid var(--border-subtle)' }}>
                              <div style={{ fontSize: '13px', fontWeight: 'bold', color: gaImproved ? 'var(--color-teal)' : 'var(--text-secondary)' }}>{gaFit!.toFixed(1)}</div>
                              {gaImproved && <div style={{ fontSize: '10px', color: 'var(--color-teal)' }}>+{delta_ga.toFixed(1)}</div>}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center', borderLeft: '1px solid var(--border-subtle)' }}>
                              <div style={{ fontSize: '13px', fontWeight: 'bold', color: hcImproved ? '#8b5cf6' : (hcFit! < (gaFit ?? 0) - 0.01 ? 'var(--color-danger)' : 'var(--text-secondary)') }}>{hcFit!.toFixed(1)}</div>
                              {hcImproved && <div style={{ fontSize: '10px', color: '#8b5cf6' }}>+{delta_hc.toFixed(1)}</div>}
                            </td>
                          </>
                        ) : (
                          <td colSpan={3} style={{ padding: '12px', textAlign: 'center', borderLeft: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '11px' }}>
                            —
                          </td>
                        )}
                      </tr>
                    );
                  })}

                </tbody>
              </table>
            </div>
          </div>

          {/* FITNESS SUMMARY & COMMENTS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Tổng quan cải thiện Fitness */}
            <div style={{ background: 'var(--surface-subtle)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={16} style={{ color: 'var(--color-teal)' }} /> Tổng Quan Cải Thiện Fitness
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px' }}>
                <div style={{ background: 'var(--surface-sunken)', padding: '12px 16px', borderRadius: '8px', textAlign: 'center', border: '1px solid var(--border-subtle)', flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px' }}>LLM Thô (F0)</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{(data.llm?.llmFitness ?? 0).toFixed(2)}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 12px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-teal)', fontWeight: 'bold', marginBottom: '4px' }}>+{Math.max(0, (data.ga?.gaFitness ?? 0) - (data.llm?.llmFitness ?? 0)).toFixed(2)}</span>
                  <span style={{ color: 'var(--color-teal)' }}>→</span>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '12px 16px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.2)', flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-teal)', marginBottom: '4px' }}>Sau GA</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-teal)' }}>{(data.ga?.gaFitness ?? 0).toFixed(2)}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 12px' }}>
                  <span style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: 'bold', marginBottom: '4px' }}>+{Math.max(0, (data.hc?.hcFitness ?? 0) - (data.ga?.gaFitness ?? 0)).toFixed(2)}</span>
                  <span style={{ color: '#8b5cf6' }}>→</span>
                </div>

                <div style={{ background: 'rgba(139, 92, 246, 0.05)', padding: '12px 16px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(139, 92, 246, 0.2)', flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#8b5cf6', marginBottom: '4px' }}>Sau HC (Cuối)</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#8b5cf6' }}>{(data.hc?.hcFitness ?? 0).toFixed(2)}</div>
                </div>
              </div>
            </div>

            {/* Nhận xét */}
            <div style={{ background: 'var(--surface-subtle)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#8b5cf6', fontSize: '16px' }}>★</span> Nhận Xét Chuyên Môn
              </h3>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.6' }}>
                <p style={{ marginBottom: '12px' }}>
                  Thuật toán Genetic Algorithm đã cải thiện <b>Fitness</b> từ {(data.llm?.llmFitness ?? 0).toFixed(2)} lên {(data.ga?.gaFitness ?? 0).toFixed(2)}
                  &nbsp;(<b>+{Math.max(0, (data.ga?.gaFitness ?? 0) - (data.llm?.llmFitness ?? 0)).toFixed(2)}</b>).
                </p>
                <p>
                  {((data.hc?.hcFitness ?? 0) - (data.ga?.gaFitness ?? 0)) > 0.001
                    ? `Sau bước tinh chỉnh cục bộ (HC), Fitness tiếp tục tăng lên mức ${(data.hc?.hcFitness ?? 0).toFixed(2)} (+${((data.hc?.hcFitness ?? 0) - (data.ga?.gaFitness ?? 0)).toFixed(2)}).`
                    : `Sau bước tinh chỉnh cục bộ (HC), Fitness giữ nguyên ở mức ${(data.hc?.hcFitness ?? 0).toFixed(2)}, không có cải thiện bổ sung.`}
                </p>
              </div>
            </div>
          </div>



        </div>
      </div>
    </div>
  );
};
