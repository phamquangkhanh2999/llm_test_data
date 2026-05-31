import React, { useRef, useState } from 'react';
import { Upload, Database, CheckCircle2, FileJson, ChevronDown, Activity, Zap } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Visualizer } from './Visualizer';
import type { FieldConstraint } from '../algorithms/presets';

export const DataImport: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [recordCount, setRecordCount] = useState<number>(0);
  const [isImported, setIsImported] = useState(false);

  const {
    setRawText,
    setParsedSchema,
    setInitialSeeds,
    parsedSchema,
    initialSeeds,
    markScreenCompleted,
  } = useAppStore();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);

        if (!Array.isArray(data) || data.length === 0) {
          alert('File JSON không hợp lệ. Vui lòng cung cấp một mảng chứa các đối tượng dữ liệu (Array of Objects).');
          return;
        }

        const sampleRow = data[0];
        const inferredSchema: FieldConstraint[] = Object.keys(sampleRow).map(key => {
          const value = sampleRow[key];
          let type: 'string' | 'number' | 'email' | 'card' | 'phone' = 'string';
          if (typeof value === 'number') type = 'number';
          else if (typeof value === 'string') {
            if (value.includes('@') && value.includes('.')) type = 'email';
          }
          return {
            name: key,
            type,
            required: true,
            description: `Tự nhận diện từ file (cột: ${key})`,
          };
        });

        setRawText(`[DỮ LIỆU NHẬP TỪ FILE]\nTên file: ${file.name}\nSố lượng bản ghi: ${data.length}`);
        setParsedSchema(inferredSchema);
        setInitialSeeds(data);
        setFileName(file.name);
        setRecordCount(data.length);
        setIsImported(true);
        markScreenCompleted('data-import');

        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        console.error('Lỗi khi đọc file JSON:', err);
        alert('Lỗi khi đọc file JSON. Vui lòng kiểm tra lại định dạng — file phải là mảng các đối tượng: [{ ... }, { ... }]');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── UPLOAD ZONE ── */}
      <div
        className="glass-card"
        style={{
          border: isImported ? '1px solid rgba(45,212,191,0.4)' : '2px dashed rgba(250,204,21,0.35)',
          borderRadius: '16px',
          padding: '36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          cursor: isImported ? 'default' : 'pointer',
          transition: 'all 0.3s ease',
          background: isImported
            ? 'rgba(45,212,191,0.04)'
            : 'rgba(250,204,21,0.03)',
        }}
        onClick={() => !isImported && fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); }}
        onDrop={e => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file && fileInputRef.current) {
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInputRef.current.files = dt.files;
            fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }}
      >
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        {!isImported ? (
          <>
            <div style={{
              width: '72px', height: '72px', borderRadius: '20px',
              background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Upload size={36} style={{ color: '#facc15' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ color: '#facc15', margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700 }}>
                Kéo thả hoặc click để chọn file JSON
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>
                File phải là mảng JSON: <code style={{ color: '#facc15', background: 'rgba(250,204,21,0.1)', padding: '2px 8px', borderRadius: '4px' }}>[&#123; ... &#125;, &#123; ... &#125;]</code><br />
                Hệ thống sẽ tự nhận diện cấu trúc cột và chuẩn bị dữ liệu đầu vào cho thuật toán.
              </p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
              style={{
                padding: '12px 32px', borderRadius: '30px',
                background: '#facc15', color: '#000', border: 'none',
                fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(250,204,21,0.3)',
              }}
            >
              📁 Chọn file dữ liệu (.JSON)
            </button>
          </>
        ) : (
          /* ── ĐÃ IMPORT XONG: hiện summary ── */
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', width: '100%' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '16px',
              background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <CheckCircle2 size={32} style={{ color: '#2dd4bf' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                Đọc file thành công
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <span>
                  <FileJson size={13} style={{ display: 'inline', marginRight: '4px', color: '#facc15' }} />
                  <b style={{ color: '#facc15' }}>{fileName}</b>
                </span>
                <span>
                  <Database size={13} style={{ display: 'inline', marginRight: '4px', color: '#2dd4bf' }} />
                  <b style={{ color: '#2dd4bf' }}>{recordCount}</b> bản ghi
                </span>
                <span>
                  <Activity size={13} style={{ display: 'inline', marginRight: '4px', color: '#a78bfa' }} />
                  <b style={{ color: '#a78bfa' }}>{parsedSchema.length}</b> cột dữ liệu
                </span>
              </div>
            </div>
            <button
              onClick={() => { setIsImported(false); setFileName(''); setRecordCount(0); }}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '12px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-secondary)', cursor: 'pointer',
              }}
            >
              Đổi file khác
            </button>
          </div>
        )}
      </div>

      {/* ── SAU KHI IMPORT: PHÂN TÍCH NGAY TẠI CHỖ ── */}
      {isImported && initialSeeds.length > 0 && (
        <>
          {/* Divider với label */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(167,139,250,0.2)' }} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 16px', borderRadius: '20px',
              background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)',
            }}>
              <Zap size={14} style={{ color: '#a78bfa' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#a78bfa', letterSpacing: '0.05em' }}>
                THUẬT TOÁN TỐI ƯU — CHẠY NGAY VỚI DỮ LIỆU VỪA TẢI LÊN
              </span>
              <ChevronDown size={14} style={{ color: '#a78bfa' }} />
            </div>
            <div style={{ flex: 1, height: '1px', background: 'rgba(167,139,250,0.2)' }} />
          </div>

          {/* Banner giải thích */}
          <div style={{
            padding: '14px 20px', borderRadius: '10px',
            background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)',
            fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6,
          }}>
            <b style={{ color: '#a78bfa' }}>Dữ liệu của bạn đã sẵn sàng.</b>{' '}
            Bên dưới là bộ tối ưu hóa Genetic Algorithm + Hill Climbing — bấm <b style={{ color: '#fff' }}>▶ Bắt đầu</b> để sinh ra bộ test cases tối ưu từ {recordCount} bản ghi vừa tải lên.
          </div>

          {/* Inline Visualizer — không cần chuyển tab */}
          <Visualizer />
        </>
      )}
    </div>
  );
};
