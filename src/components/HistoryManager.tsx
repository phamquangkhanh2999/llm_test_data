import React, { useState } from 'react';
import type { Chromosome } from '../algorithms/genetic';
import { Download, FileSpreadsheet, FileJson, History, Database, AlertCircle, Trash2, Clock, ShieldAlert } from 'lucide-react';

// --- ĐỊNH NGHĨA PHẠM VI DỮ LIỆU ĐẦU VÀO CHO COMPONENT ---
interface HistoryManagerProps {
  optimizedDataset: Chromosome[]; // Mảng dữ liệu test case (bản ghi tốt nhất) đã tối ưu hóa thành công
  historyRuns: { 
    timestamp: string; 
    schemaName: string; 
    size: number; 
    coverage: number; 
    bestFitness: number; 
    data: Chromosome[] 
  }[]; // Nhật ký lưu trữ danh sách các phiên chạy thành công trong phiên làm việc hiện tại
  onLoadPastRun: (data: Chromosome[]) => void; // Hàm callback nạp lại dữ liệu cũ khi click nút
  onClearHistory?: () => void; // Hàm callback xóa sạch lịch sử đã lưu
  schemaName: string; // Tên của schema đặc tả nghiệp vụ hiện tại
}

export const HistoryManager: React.FC<HistoryManagerProps> = ({
  optimizedDataset,
  historyRuns,
  onLoadPastRun,
  onClearHistory,
  schemaName
}) => {
  // Trạng thái (state) hiển thị thông báo đã sao chép chuỗi JSON vào bộ nhớ đệm
  const [copied, setCopied] = useState(false);
  // Trạng thái lọc loại ca kiểm thử trong bảng xem trước
  const [filterType, setFilterType] = useState<'all' | 'happy' | 'boundary' | 'security'>('all');

  // --- HÀM TRỢ GIÚP: TẠO TỆP TIN VÀ BẮT TRÌNH DUYỆT TẢI XUỐNG ---
  const downloadFile = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
  };

  // --- HÀM XUẤT FILE CSV/EXCEL (ĐỊNH DẠNG BẢNG BIỂU) ---
  const handleExportCSV = () => {
    if (optimizedDataset.length === 0) return;
    
    const headers = Object.keys(optimizedDataset[0]);
    const csvRows = [headers.join(',')];

    optimizedDataset.forEach(row => {
      const values = headers.map(header => {
        const escaped = ('' + row[header]).replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    });

    const csvContent = csvRows.join('\n');
    downloadFile(
      csvContent, 
      `${schemaName.toLowerCase().replace(/ /g, '_')}_dataset.csv`, 
      'text/csv;charset=utf-8;'
    );
  };

  // --- HÀM XUẤT FILE JSON ---
  const handleExportJSON = () => {
    if (optimizedDataset.length === 0) return;
    
    const jsonContent = JSON.stringify(optimizedDataset, null, 2);
    downloadFile(
      jsonContent, 
      `${schemaName.toLowerCase().replace(/ /g, '_')}_dataset.json`, 
      'application/json'
    );
  };

  // --- HÀM SAO CHÉP NHANH CHUỖI JSON ---
  const handleCopyClipboard = () => {
    if (optimizedDataset.length === 0) return;
    
    const jsonContent = JSON.stringify(optimizedDataset, null, 2);
    navigator.clipboard.writeText(jsonContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // --- PHÂN LOẠI CA KIỂM THỬ ĐỂ HỖ TRỢ BỘ LỌC ---
  const getRowCategory = (row: Chromosome): 'happy' | 'boundary' | 'security' => {
    let isEdge = false;
    let isSecurity = false;
    Object.values(row).forEach(val => {
      const str = String(val);
      if (str.includes("'") || str.includes("<script") || str.includes("--")) isSecurity = true;
      if (str === '' || str === '0') isEdge = true;
    });
    if (isSecurity) return 'security';
    if (isEdge) return 'boundary';
    return 'happy';
  };

  // Áp dụng phân loại và lọc
  const categorizedDataset = optimizedDataset.map((row, idx) => ({
    row,
    idx,
    category: getRowCategory(row)
  }));

  const filteredDataset = categorizedDataset.filter(item => {
    if (filterType === 'all') return true;
    return item.category === filterType;
  });

  // Đếm số lượng ca test cho từng tab bộ lọc
  const totalCount = optimizedDataset.length;
  const happyCount = categorizedDataset.filter(i => i.category === 'happy').length;
  const boundaryCount = categorizedDataset.filter(i => i.category === 'boundary').length;
  const securityCount = categorizedDataset.filter(i => i.category === 'security').length;

  return (
    <div className="grid-2" style={{ marginTop: '16px', gap: '20px' }}>
      
      {/* CỘT BÊN TRÁI: KHÔNG GIAN ĐIỀU KHIỂN XUẤT DỮ LIỆU & LỊCH SỬ PHIÊN CHẠY */}
      <div className="glass-card flex flex-col gap-md teal-border" style={{ background: 'rgba(15, 23, 42, 0.4)' }}>
        <div className="flex align-center gap-sm" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
          <History className="text-teal" size={22} style={{ color: 'var(--color-teal)' }} />
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', letterSpacing: '0.03em' }}>TRUNG TÂM XUẤT DỮ LIỆU &amp; LỊCH SỬ</h2>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5' }}>
          Tải xuống trực tiếp tập ca kiểm thử tối ưu hóa đã sinh dưới định dạng CSV/Excel hoặc JSON để đưa trực tiếp vào các công cụ tự động hóa như Selenium, Playwright, Postman.
        </p>

        {/* NÚT XUẤT FILE CHỈ HIỂN THỊ KHI ĐÃ CÓ DỮ LIỆU TỐI ƯU HÓA */}
        {optimizedDataset.length > 0 ? (
          <div className="flex flex-col gap-sm" style={{ margin: '6px 0' }}>
            <div className="flex gap-sm">
              <button 
                onClick={handleExportCSV} 
                className="btn btn-primary" 
                style={{ 
                  flex: 1, 
                  fontSize: '13px', 
                  padding: '10px 14px',
                  background: 'linear-gradient(135deg, var(--color-teal) 0%, #0d9488 100%)', 
                  border: 'none',
                  color: '#fff',
                  fontWeight: '600'
                }}
              >
                <FileSpreadsheet size={16} /> Xuất CSV / Excel
              </button>
              
              <button 
                onClick={handleExportJSON} 
                className="btn btn-secondary" 
                style={{ 
                  flex: 1, 
                  fontSize: '13px', 
                  padding: '10px 14px',
                  borderColor: 'rgba(255,255,255,0.1)',
                  fontWeight: '600'
                }}
              >
                <FileJson size={16} /> Xuất File JSON
              </button>
            </div>
            
            <button 
              onClick={handleCopyClipboard} 
              className="btn btn-secondary" 
              style={{ 
                fontSize: '13px', 
                padding: '10px 14px', 
                background: copied ? 'rgba(45,212,191,0.06)' : 'rgba(255,255,255,0.01)',
                borderColor: copied ? 'var(--color-teal)' : 'rgba(255,255,255,0.08)',
                color: copied ? 'var(--color-teal)' : '#94a3b8',
                fontWeight: '600',
                transition: 'all 0.3s'
              }}
            >
              <Download size={16} /> 
              {copied ? 'Đã sao chép chuỗi JSON!' : 'Sao chép chuỗi JSON nhanh'}
            </button>
          </div>
        ) : (
          <div className="flex align-center gap-sm" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: '13px', justifyContent: 'center' }}>
            <AlertCircle size={16} /> Hãy chạy tối ưu hóa ở Tab "Tối Ưu Hóa Bộ Test" để xuất dữ liệu.
          </div>
        )}

        {/* DANH SÁCH LỊCH SỬ CÁC LƯỢT CHẠY TRONG PHIÊN */}
        <div className="flex flex-col gap-sm" style={{ marginTop: '10px' }}>
          <div className="flex justify-between align-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
              Lịch sử các phiên chạy đã lưu
            </h4>
            {historyRuns.length > 0 && onClearHistory && (
              <button 
                onClick={onClearHistory}
                className="btn btn-secondary flex align-center gap-xs" 
                style={{ padding: '2px 8px', fontSize: '11px', color: 'var(--color-rose)', borderColor: 'rgba(244,63,94,0.1)' }}
              >
                <Trash2 size={12} /> Xóa sạch
              </button>
            )}
          </div>
          
          <div className="flex flex-col gap-sm" style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
            {historyRuns.length === 0 ? (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', border: '1px dashed rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)' }}>
                Chưa có lượt chạy thành công nào được lưu trữ.
              </span>
            ) : (
              historyRuns.map((run, idx) => (
                <div 
                  key={idx} 
                  className="flex justify-between align-center card-hover-animation"
                  style={{ 
                    background: 'rgba(255,255,255,0.02)', 
                    border: '1px solid rgba(255,255,255,0.05)', 
                    padding: '10px 14px', 
                    borderRadius: '8px',
                    fontSize: '12px',
                    transition: 'all 0.3s'
                  }}
                >
                  <div className="flex flex-col gap-xs">
                    <span style={{ fontWeight: 'bold', color: 'var(--color-teal)', fontSize: '12.5px' }}>{run.schemaName}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={10} /> {run.timestamp}
                    </span>
                  </div>
                  <div className="flex align-center gap-md">
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: '#fff' }}>{(run.coverage * 100).toFixed(0)}%</span>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Độ phủ</div>
                    </div>
                    <button 
                      onClick={() => onLoadPastRun(run.data)}
                      className="btn btn-secondary" 
                      style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', borderColor: 'rgba(45,212,191,0.2)', color: 'var(--color-teal)' }}
                    >
                      Nạp lại
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
 
      {/* CỘT BÊN PHẢI: BẢNG XEM TRƯỚC BẢN GHI DỮ LIỆU CHI TIẾT */}
      <div className="glass-card flex flex-col gap-md violet-border" style={{ background: 'rgba(15, 23, 42, 0.4)' }}>
        <div className="flex justify-between align-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
          <div className="flex align-center gap-sm">
            <Database className="text-violet" size={22} style={{ color: 'var(--color-violet)' }} />
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', letterSpacing: '0.03em' }}>XEM TRƯỚC BỘ CA KIỂM THỬ</h2>
          </div>
          {optimizedDataset.length > 0 && (
            <span style={{ fontSize: '11px', background: 'rgba(167,139,250,0.1)', color: 'var(--color-violet)', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
              Tổng cộng: {optimizedDataset.length} ca test
            </span>
          )}
        </div>

        {optimizedDataset.length > 0 ? (
          <div className="flex flex-col gap-md" style={{ flex: 1 }}>
            
            {/* THANH BỘ LỌC THÔNG MINH (QA CATEGORY FILTERS) */}
            <div className="flex gap-xs" style={{ flexWrap: 'wrap', background: 'rgba(15, 23, 42, 0.4)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <button 
                onClick={() => setFilterType('all')}
                style={{ 
                  flex: 1, minWidth: '80px', padding: '6px 8px', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
                  background: filterType === 'all' ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: filterType === 'all' ? '#fff' : 'var(--text-muted)'
                }}
              >
                Tất cả ({totalCount})
              </button>
              <button 
                onClick={() => setFilterType('happy')}
                style={{ 
                  flex: 1, minWidth: '95px', padding: '6px 8px', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
                  background: filterType === 'happy' ? 'rgba(45,212,191,0.08)' : 'transparent',
                  color: filterType === 'happy' ? 'var(--color-teal)' : 'var(--text-muted)'
                }}
              >
                🟢 Positive ({happyCount})
              </button>
              <button 
                onClick={() => setFilterType('boundary')}
                style={{ 
                  flex: 1, minWidth: '95px', padding: '6px 8px', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
                  background: filterType === 'boundary' ? 'rgba(167,139,250,0.08)' : 'transparent',
                  color: filterType === 'boundary' ? 'var(--color-violet)' : 'var(--text-muted)'
                }}
              >
                🟡 Rìa Biên ({boundaryCount})
              </button>
              <button 
                onClick={() => setFilterType('security')}
                style={{ 
                  flex: 1, minWidth: '95px', padding: '6px 8px', border: 'none', borderRadius: '6px', fontSize: '11.5px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
                  background: filterType === 'security' ? 'rgba(244,63,94,0.08)' : 'transparent',
                  color: filterType === 'security' ? 'var(--color-rose)' : 'var(--text-muted)'
                }}
              >
                🔴 An Ninh ({securityCount})
              </button>
            </div>

            {/* BẢNG DỮ LIỆU HIỂN THỊ SAU KHI LỌC */}
            <div style={{ flex: 1, width: '100%', overflowX: 'auto', maxHeight: '310px', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              {filteredDataset.length === 0 ? (
                <div style={{ padding: '48px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '13px' }}>
                  Không tìm thấy ca kiểm thử nào khớp với bộ lọc này.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(15,23,42,0.8)', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px 12px', width: '80px' }}>Phân Loại</th>
                      {Object.keys(optimizedDataset[0]).map(k => (
                        <th key={k} style={{ padding: '10px 12px' }}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDataset.slice(0, 15).map(({ row, idx, category }) => {
                      return (
                        <tr 
                          key={idx} 
                          style={{ 
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            background: category === 'security' ? 'rgba(244,63,94,0.03)' : category === 'boundary' ? 'rgba(167,139,250,0.03)' : 'none'
                          }}
                        >
                          {/* Render badge phân loại */}
                          <td style={{ padding: '10px 12px' }}>
                            <span 
                              style={{ 
                                padding: '2px 6px', 
                                borderRadius: '4px', 
                                fontSize: '9.5px', 
                                fontWeight: 'bold',
                                background: category === 'security' ? 'rgba(244,63,94,0.15)' : category === 'boundary' ? 'rgba(167,139,250,0.15)' : 'rgba(45,212,191,0.15)',
                                color: category === 'security' ? 'var(--color-rose)' : category === 'boundary' ? 'var(--color-violet)' : 'var(--color-teal)'
                              }}
                            >
                              {category === 'security' ? 'AN NINH' : category === 'boundary' ? 'RÌA BIÊN' : 'POSITIVE'}
                            </span>
                          </td>
                          {Object.keys(row).map(k => {
                            const valStr = String(row[k]);
                            const isSpecial = valStr.includes("'") || valStr.includes("<script") || valStr === "" || valStr === "0";
                            return (
                              <td 
                                key={k} 
                                title={valStr} // Tooltip khi hover xem đầy đủ payload
                                style={{ 
                                  padding: '10px 12px', 
                                  fontFamily: 'var(--font-mono)',
                                  color: category === 'security' && (valStr.includes("'") || valStr.includes("<script") || valStr.includes("--")) ? 'var(--color-rose)' : 'inherit',
                                  fontWeight: isSpecial ? 'bold' : 'normal',
                                  // Giới hạn độ dài, tránh vỡ cột bảng
                                  maxWidth: '180px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {valStr === '' ? <i style={{ color: 'var(--text-muted)' }}>(Chuỗi rỗng / Empty)</i> : valStr}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              
              {/* THÔNG BÁO GIỚI HẠN HIỂN THỊ */}
              {filteredDataset.length > 15 && (
                <div style={{ textAlign: 'center', padding: '8px', fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(15,23,42,0.4)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  Hiển thị tối đa 15 trong số {filteredDataset.length} ca test thỏa mãn bộ lọc. Hãy xuất file để kiểm duyệt toàn bộ.
                </div>
              )}
            </div>
            
            {/* LƯU Ý BẢO MẬT DƯỚI ĐÁY */}
            <div className="flex align-center gap-sm" style={{ padding: '8px 12px', background: 'rgba(244,63,94,0.04)', border: '1px solid rgba(244,63,94,0.1)', borderRadius: '6px', fontSize: '11px', color: 'var(--color-rose)', marginTop: 'auto' }}>
              <ShieldAlert size={14} style={{ flexShrink: 0 }} />
              <span><b>Lưu ý an toàn:</b> Các chuỗi XSS/SQLi tấn công được sinh ra nhằm mục đích dò quét an ninh phần mềm. Đã mã hóa HTML khi render, tránh dán trực tiếp vào DB sản xuất của bạn.</span>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.01)', padding: '80px 0', color: 'var(--text-muted)' }}>
            Chưa có tập dữ liệu tối ưu hóa nào được sinh ra.
          </div>
        )}
      </div>
    </div>
  );
};
