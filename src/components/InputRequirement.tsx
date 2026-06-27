import {
  ArrowRight,
  CheckCircle2,
  Copy,
  FileText,
  Trash2,
  Zap,
  RefreshCw,
  Upload
} from 'lucide-react';
import React, { useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { toast } from '../store/useToastStore';

import { PRESETS } from '../algorithms/presets';

// =============================================================================
//  BƯỚC 1: NHẬP YÊU CẦU ĐẦU VÀO — bám sát màn "Bước 1" của Stitch.
//  Bố cục 2 cột: trái = textarea nội dung yêu cầu; phải = thẻ đen "Gợi ý phân tích" + nút "Tiếp theo".
// =============================================================================

export const InputRequirement: React.FC = () => {
  const { 
    rawText, setRawText, setActiveScreen, markScreenCompleted, 
    handleParseSpec, isParsing, handlePresetSelect, selectedPresetId
  } = useAppStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const charCount = rawText.length;

  const [isDragging, setIsDragging] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(rawText);
    toast.success('Đã sao chép nội dung yêu cầu.');
  };

  const readFileContent = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setRawText(content);
        toast.success(`Đã tải nội dung từ tệp: ${file.name}`);
      }
    };
    reader.onerror = () => {
      toast.error('Lỗi khi đọc tệp tin.');
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    readFileContent(file);
    event.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['txt', 'json', 'md', 'csv'].includes(ext || '')) {
        readFileContent(file);
      } else {
        toast.error('Định dạng tệp không hỗ trợ. Vui lòng dùng .txt, .json, .md hoặc .csv');
      }
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleNext = (forceRefresh: boolean = false) => {
    if (!rawText.trim()) {
      toast.warning('Vui lòng nhập nội dung yêu cầu kỹ thuật trước.');
      return;
    }
    markScreenCompleted('input');
    setActiveScreen('analyze');
    handleParseSpec(forceRefresh); // Pass the refresh flag to AI analysis
  };

  return (
    <div className="fade-in-up">
      {/* Layout chính */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 7fr) minmax(300px, 4fr)', gap: 20, alignItems: 'start' }} className="input-grid">
        {/* Cột trái — nội dung yêu cầu */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={17} style={{ color: 'var(--brand-primary)' }} />
              <h3 style={{ fontSize: 14.5, margin: 0 }}>Nội dung yêu cầu</h3>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                style={{ display: 'none' }} 
                accept=".txt,.json,.md,.csv"
              />
              <IconBtn onClick={triggerFileSelect} title="Tải tệp lên (.txt, .json, .md)"><Upload size={15} /></IconBtn>
              <IconBtn onClick={handleCopy} title="Sao chép"><Copy size={15} /></IconBtn>
              <IconBtn onClick={() => setRawText('')} title="Xóa nội dung"><Trash2 size={15} /></IconBtn>
            </div>
          </div>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            placeholder={`Nhập yêu cầu chi tiết hoặc kéo thả tệp vào đây (.txt, .json, .md, .csv)\nVí dụ:\nBRD-001: Hệ thống xử lý 10,000 requests/giây.\n- Username: bắt buộc, 5–15 ký tự.\n- Email: đúng định dạng.`}
            style={{
              width: '100%', minHeight: 340, resize: 'vertical',
              padding: '14px 16px', borderRadius: 'var(--radius-md)',
              border: isDragging ? '2px dashed var(--brand-primary)' : '1px solid var(--border-subtle)',
              background: isDragging ? 'var(--brand-primary-glow)' : 'var(--surface-subtle)',
              fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)', outline: 'none',
              boxSizing: 'border-box',
              transition: 'all 0.2s ease',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 11.5, color: 'var(--text-muted)' }}>
            <span>{charCount} ký tự · Hệ thống đã sẵn sàng nhận diện dữ liệu</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--color-emerald)' }}>
              <CheckCircle2 size={13} /> Đã lưu bộ đệm
            </span>
          </div>
        </div>

        {/* Cột phải — gợi ý đen + nút tiếp theo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Preset Selector */}
          <div style={{ background: 'var(--surface-subtle)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>
              <Zap size={16} style={{ color: 'var(--color-teal)' }} /> Chọn Đặc Tả (Mẫu)
            </div>
            <select
              value={selectedPresetId || ''}
              onChange={(e) => {
                const preset = PRESETS.find(p => p.id === e.target.value);
                if (preset) handlePresetSelect(preset);
              }}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '6px',
                border: '1px solid var(--border-subtle)', background: 'transparent',
                color: 'var(--text-primary)', outline: 'none', fontSize: 13,
                cursor: 'pointer'
              }}
            >
              <option value="" disabled>-- Chọn một bài đặt tả --</option>
              {PRESETS.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>


          {/* Nút tiếp theo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn btn-primary" onClick={() => handleNext(false)} disabled={isParsing} style={{ width: '100%', padding: '14px', fontSize: 14.5, justifyContent: 'space-between' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {isParsing ? <RefreshCw size={18} className="tech-spinner" /> : <Zap size={18} />}
                Phân Tích Logic
              </span>
              <ArrowRight size={18} />
            </button>
            
            {rawText.trim() && (
              <button 
                className="btn btn-secondary" 
                onClick={() => handleNext(true)} 
                disabled={isParsing}
                style={{ width: '100%', padding: '10px', fontSize: 13, justifyContent: 'center', background: 'transparent', border: '1px dashed var(--border-subtle)' }}
                title="Bỏ qua dữ liệu cũ đã lưu, yêu cầu AI phân tích lại từ đầu"
              >
                <RefreshCw size={14} />
                <span>Phân tích mới (No Cache)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`@media (max-width: 900px){ .input-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
};



// const Hint: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
//   <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
//     <span style={{ color: 'var(--color-teal)' }}>{icon}</span>{text}
//   </div>
// );

const IconBtn: React.FC<{ onClick: () => void; title: string; children: React.ReactNode }> = ({ onClick, title, children }) => (
  <button onClick={onClick} title={title}
    style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 6, cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
    {children}
  </button>
);


export default InputRequirement;
