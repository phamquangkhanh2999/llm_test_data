import React, { useState } from 'react';
import type { Chromosome } from '../algorithms/genetic';
import { Download, FileSpreadsheet, FileJson, History, Database, AlertCircle } from 'lucide-react';

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
  schemaName: string; // Tên của schema đặc tả nghiệp vụ hiện tại
}

export const HistoryManager: React.FC<HistoryManagerProps> = ({
  optimizedDataset,
  historyRuns,
  onLoadPastRun,
  schemaName
}) => {
  // Trạng thái (state) hiển thị thông báo đã sao chép chuỗi JSON vào bộ nhớ đệm
  const [copied, setCopied] = useState(false);

  // --- HÀM TRỢ GIÚP: TẠO TỆP TIN VÀ BẮT TRÌNH DUYỆT TẢI XUỐNG ---
  const downloadFile = (content: string, filename: string, contentType: string) => {
    // Tạo đối tượng Blob lưu trữ dữ liệu tệp tin dưới dạng nhị phân/văn bản
    const blob = new Blob([content], { type: contentType });
    // Sinh URL đại diện tạm thời cho Blob vừa tạo
    const url = URL.createObjectURL(blob);
    
    // Tạo động một thẻ HTML <a> để thực hiện hành vi click tải xuống tự động
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    // Thu hồi URL tạm thời để tránh rò rỉ tài nguyên bộ nhớ (memory leak)
    URL.revokeObjectURL(url);
  };

  // --- HÀM XUẤT FILE CSV/EXCEL (ĐỊNH DẠNG BẢNG BIỂU) ---
  const handleExportCSV = () => {
    // Nếu mảng dữ liệu trống, dừng xử lý ngay lập tức
    if (optimizedDataset.length === 0) return;
    
    // Lấy tiêu đề các cột dựa trên khóa thuộc tính của bản ghi đầu tiên
    const headers = Object.keys(optimizedDataset[0]);
    const csvRows = [headers.join(',')]; // Dòng đầu tiên chứa các tên cột ngăn cách bằng dấu phẩy

    // Duyệt qua tất cả bản ghi dữ liệu kiểm thử
    optimizedDataset.forEach(row => {
      const values = headers.map(header => {
        // Xử lý loại bỏ hoặc chuyển đổi các dấu ngoặc kép bên trong dữ liệu để tránh lỗi cú pháp CSV
        const escaped = ('' + row[header]).replace(/"/g, '\\"');
        return `"${escaped}"`; // Bao bọc giá trị mỗi ô dữ liệu bằng dấu nháy kép
      });
      csvRows.push(values.join(','));
    });

    // Gom các dòng lại và chèn ký tự ngắt dòng xuống dòng (\n)
    const csvContent = csvRows.join('\n');
    
    // Kích hoạt hành vi tải xuống tệp tin đuôi .csv
    downloadFile(
      csvContent, 
      `${schemaName.toLowerCase().replace(/ /g, '_')}_dataset.csv`, 
      'text/csv;charset=utf-8;'
    );
  };

  // --- HÀM XUẤT FILE JSON (ĐỊNH DẠNG CẤU TRÚC LOGIC CHO API/DEVELOPER) ---
  const handleExportJSON = () => {
    if (optimizedDataset.length === 0) return;
    
    // Chuyển mảng Javascript thành chuỗi văn bản JSON thụt lề 2 dấu cách cho đẹp mắt
    const jsonContent = JSON.stringify(optimizedDataset, null, 2);
    
    // Tải tệp tin định dạng JSON
    downloadFile(
      jsonContent, 
      `${schemaName.toLowerCase().replace(/ /g, '_')}_dataset.json`, 
      'application/json'
    );
  };

  // --- HÀM SAO CHÉP NHANH CHUỖI JSON VÀO CLIPBOARD ---
  const handleCopyClipboard = () => {
    if (optimizedDataset.length === 0) return;
    
    const jsonContent = JSON.stringify(optimizedDataset, null, 2);
    
    // Sử dụng API Clipboard hiện đại của trình duyệt
    navigator.clipboard.writeText(jsonContent).then(() => {
      setCopied(true);
      // Hiển thị dòng chữ "Đã sao chép" trong 2 giây rồi tự reset về mặc định
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="grid-2" style={{ marginTop: '16px' }}>
      
      {/* CỘT BÊN TRÁI: KHÔNG GIAN ĐIỀU KHIỂN XUẤT DỮ LIỆU & LỊCH SỬ PHIÊN CHẠY */}
      <div className="glass-card flex flex-col gap-md teal-border">
        <div className="flex align-center gap-sm">
          <History className="text-teal" size={24} style={{ color: 'var(--color-teal)' }} />
          <h2>Lịch Sử &amp; Trung Tâm Xuất Dữ Liệu</h2>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Tải xuống trực tiếp tập dữ liệu kiểm thử tối ưu hóa đã sinh ở các định dạng CSV/Excel hoặc JSON để đưa trực tiếp vào các framework Automation Testing (e.g. Selenium, Playwright, Postman, JMeter).
        </p>

        {/* NÚT XUẤT FILE CHỈ HIỂN THỊ KHI ĐÃ CÓ DỮ LIỆU TỐI ƯU HÓA */}
        {optimizedDataset.length > 0 ? (
          <div className="flex flex-col gap-sm" style={{ margin: '8px 0' }}>
            <div className="flex gap-sm">
              {/* Nút bấm xuất file CSV */}
              <button onClick={handleExportCSV} className="btn btn-primary" style={{ flex: 1, fontSize: '13px' }}>
                <FileSpreadsheet size={16} /> Xuất File CSV / Excel
              </button>
              
              {/* Nút bấm xuất file JSON */}
              <button onClick={handleExportJSON} className="btn btn-secondary" style={{ flex: 1, fontSize: '13px' }}>
                <FileJson size={16} /> Xuất File JSON
              </button>
            </div>
            
            {/* Nút bấm sao chép nhanh JSON */}
            <button onClick={handleCopyClipboard} className="btn btn-secondary" style={{ fontSize: '13px' }}>
              <Download size={16} /> 
              {copied ? 'Đã sao chép JSON vào bộ nhớ tạm!' : 'Sao chép chuỗi JSON nhanh'}
            </button>
          </div>
        ) : (
          // CẢNH BÁO KHI CHƯA CÓ BẤT KỲ DỮ LIỆU NÀO ĐƯỢC TIẾN HÓA
          <div className="flex align-center gap-sm" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: '13px', justifyContent: 'center' }}>
            <AlertCircle size={16} /> Hãy kích hoạt và chạy xong tiến trình tối ưu hóa bộ test ở Tab "Tối Ưu Hóa Bộ Test" để tải dữ liệu.
          </div>
        )}

        {/* DANH SÁCH LỊCH SỬ CÁC LƯỢT CHẠY TRONG PHIÊN */}
        <div className="flex flex-col gap-sm" style={{ marginTop: '12px' }}>
          <h4 style={{ fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
            Lịch sử phiên chạy trong phiên (Runs in Session)
          </h4>
          
          <div className="flex flex-col gap-sm" style={{ maxHeight: '180px', overflowY: 'auto' }}>
            {historyRuns.length === 0 ? (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                Chưa có lượt chạy thành công nào được lưu trong phiên này.
              </span>
            ) : (
              // Map ra danh sách lịch sử, nhấn nạp lại để đổ dữ liệu cũ ra bảng xem trước
              historyRuns.map((run, idx) => (
                <div 
                  key={idx} 
                  className="flex justify-between align-center"
                  style={{ 
                    background: 'rgba(255,255,255,0.02)', 
                    border: '1px solid rgba(255,255,255,0.04)', 
                    padding: '8px 12px', 
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px'
                  }}
                >
                  <div className="flex flex-col">
                    <span style={{ fontWeight: 'bold', color: 'var(--color-teal)' }}>{run.schemaName}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{run.timestamp}</span>
                  </div>
                  <div className="flex align-center gap-md">
                    {/* Tỷ lệ phủ sóng các quy tắc logic biên */}
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Độ phủ: {(run.coverage * 100).toFixed(0)}%</span>
                    <button 
                      onClick={() => onLoadPastRun(run.data)}
                      className="btn btn-secondary" 
                      style={{ padding: '4px 8px', fontSize: '10px' }}
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
      <div className="glass-card flex flex-col gap-md violet-border">
        <div className="flex align-center gap-sm">
          <Database className="text-violet" size={24} style={{ color: 'var(--color-violet)' }} />
          <h2>Xem Trước Tập Bản Ghi Tối Ưu Hóa</h2>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Xem trước danh sách các ca kiểm thử tốt nhất đã được tối ưu hóa độ bao phủ và tinh chỉnh giá trị biên.
        </p>

        {optimizedDataset.length > 0 && (
          <div className="flex align-center gap-sm" style={{ padding: '8px 12px', background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.15)', borderRadius: 'var(--radius-sm)', fontSize: '11px', color: 'var(--color-rose)' }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span><b>Lưu ý An toàn:</b> Các chuỗi XSS/SQLi bên dưới được sinh ra phục vụ mục đích kiểm thử và đã được mã hóa an toàn trên giao diện. Tránh thực thi trực tiếp các payload này trên cơ sở dữ liệu thật của bạn.</span>
          </div>
        )}

        {optimizedDataset.length > 0 ? (
          <div style={{ flex: 1, width: '100%', overflowX: 'auto', maxHeight: '310px', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(15,23,42,0.8)', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 10px' }}>#</th>
                  {Object.keys(optimizedDataset[0]).map(k => (
                    <th key={k} style={{ padding: '8px 10px' }}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {optimizedDataset.slice(0, 15).map((row, idx) => {
                  // Phân loại các trường hợp đặc trưng xem có chứa ký tự SQL Injection hay chuỗi rỗng lỗi biên không
                  let isEdge = false;
                  let isSecurity = false;
                  Object.values(row).forEach(val => {
                    const str = String(val);
                    if (str.includes("'") || str.includes("<script") || str.includes("--")) isSecurity = true;
                    if (str === '' || str === '0') isEdge = true;
                  });

                  return (
                    <tr 
                      key={idx} 
                      style={{ 
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        // Highlight màu sắc sinh động: Hồng cho chuỗi tấn công bảo mật, tím nhạt cho lỗi biên
                        background: isSecurity ? 'rgba(244,63,94,0.03)' : isEdge ? 'rgba(167,139,250,0.03)' : 'none'
                      }}
                    >
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                      {Object.keys(row).map(k => (
                        <td 
                          key={k} 
                          style={{ 
                            padding: '8px 10px', 
                            fontFamily: 'var(--font-mono)',
                            // Đổi màu đỏ nổi bật cho các dữ liệu SQL Injection nguy hiểm
                            color: String(row[k]).includes("'") || String(row[k]).includes("<script") ? 'var(--color-rose)' : 'inherit'
                          }}
                        >
                          {String(row[k])}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {/* THÔNG BÁO GIỚI HẠN HIỂN THỊ */}
            {optimizedDataset.length > 15 && (
              <div style={{ textAlign: 'center', padding: '8px', fontSize: '11px', color: 'var(--text-muted)', background: 'rgba(15,23,42,0.4)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                Hiển thị tối đa 15 trong số {optimizedDataset.length} bản ghi tốt nhất. Xuất file để tải và kiểm duyệt toàn bộ.
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.01)', padding: '64px 0', color: 'var(--text-muted)' }}>
            Chưa có tập dữ liệu tối ưu hóa nào được sinh ra.
          </div>
        )}
      </div>
    </div>
  );
};

