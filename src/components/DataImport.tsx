import React, { useRef, useState } from 'react';
import { Upload, Database, CheckCircle2, FileJson, Activity, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { FieldConstraint } from '../algorithms/presets';
import { toast } from '../store/useToastStore';

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
    setActiveScreen,
  } = useAppStore();

  // Parse CSV line (handles quoted values)
  const parseCSV = (text: string): Record<string, any>[] => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) throw new Error('File CSV cần ít nhất 1 dòng header + 1 dòng dữ liệu');

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows: Record<string, any>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length === 0 || (values.length === 1 && values[0] === '')) continue;
      const row: Record<string, any> = {};
      headers.forEach((h, idx) => {
        const val = values[idx] ?? '';
        // Auto-detect numbers
        if (/^-?\d+(\.\d+)?$/.test(val) && val !== '') {
          row[h] = val.includes('.') ? parseFloat(val) : parseInt(val, 10);
        } else {
          row[h] = val;
        }
      });
      rows.push(row);
    }

    return rows;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isCSV = file.name.toLowerCase().endsWith('.csv');
    const isJSON = file.name.toLowerCase().endsWith('.json');

    if (!isCSV && !isJSON) {
      toast.error('Chỉ hỗ trợ file .json hoặc .csv. Vui lòng chọn file đúng định dạng.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        let data: Record<string, any>[];
        let fileType: string;

        if (isCSV) {
          data = parseCSV(text);
          fileType = 'CSV';
        } else {
          data = JSON.parse(text);
          fileType = 'JSON';
        }

        if (!Array.isArray(data) || data.length === 0) {
          toast.error(`File ${fileType} không hợp lệ hoặc rỗng.`);
          return;
        }

        const sampleRow = data[0];
        const inferredSchema: FieldConstraint[] = Object.keys(sampleRow).map(key => {
          const value = sampleRow[key];
          let type: FieldConstraint['type'] = 'string';
          if (typeof value === 'number') type = 'number';
          else if (typeof value === 'string') {
            if (value.includes('@') && value.includes('.')) type = 'email';
          }
          return {
            name: key,
            type,
            required: true,
            description: `Tự nhận diện từ file ${fileType} (cột: ${key})`,
          };
        });

        setRawText(`[DỮ LIỆU NHẬP TỪ FILE ${fileType}]\nTên file: ${file.name}\nSố lượng bản ghi: ${data.length}`);
        setParsedSchema(inferredSchema);
        setInitialSeeds(data);
        setFileName(file.name);
        setRecordCount(data.length);
        setIsImported(true);
        markScreenCompleted('prepare');

        if (fileInputRef.current) fileInputRef.current.value = '';
        toast.success(`Đã import thành công ${data.length} bản ghi từ file ${fileType}!`);
      } catch (err) {
        console.error('Lỗi khi đọc file:', err);
        toast.error(`Lỗi khi đọc file. Vui lòng kiểm tra lại định dạng.`);
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
          border: isImported ? '1px solid rgba(13, 148, 136, 0.4)' : '2px dashed rgba(217, 119, 6, 0.35)',
          borderRadius: '16px',
          padding: '36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          cursor: isImported ? 'default' : 'pointer',
          transition: 'all 0.3s ease',
          background: isImported
            ? 'rgba(13, 148, 136, 0.04)'
            : 'rgba(217, 119, 6, 0.03)',
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
          accept=".json,.csv"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        {!isImported ? (
          <>
            <div style={{
              width: '72px', height: '72px', borderRadius: '20px',
              background: 'rgba(217, 119, 6, 0.1)', border: '1px solid rgba(217, 119, 6, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Upload size={36} style={{ color: 'var(--color-yellow)' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ color: 'var(--color-yellow)', margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700 }}>
                Kéo thả hoặc click để chọn file JSON
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>
                Hỗ trợ file JSON (mảng object) hoặc CSV (có header).<br />
                <code style={{ color: 'var(--color-yellow)', background: 'rgba(217, 119, 6, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>[&#123; ... &#125;, &#123; ... &#125;]</code> hoặc <code style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: '4px' }}>name,email,age...</code><br />
                Hệ thống sẽ tự nhận diện cấu trúc cột và chuẩn bị dữ liệu đầu vào.
              </p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
              style={{
                padding: '12px 32px', borderRadius: '30px',
                background: 'var(--color-yellow)', color: 'var(--bg-space)', border: 'none',
                fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(217, 119, 6, 0.3)',
              }}
            >
              📁 Chọn file dữ liệu (.JSON / .CSV)
            </button>
          </>
        ) : (
          /* ── ĐÃ IMPORT XONG: hiện summary ── */
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', width: '100%' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '16px',
              background: 'rgba(13, 148, 136, 0.12)', border: '1px solid rgba(13, 148, 136, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <CheckCircle2 size={32} style={{ color: 'var(--color-teal)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Đọc file thành công
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <span>
                  <FileJson size={13} style={{ display: 'inline', marginRight: '4px', color: 'var(--color-yellow)' }} />
                  <b style={{ color: 'var(--color-yellow)' }}>{fileName}</b>
                </span>
                <span>
                  <Database size={13} style={{ display: 'inline', marginRight: '4px', color: 'var(--color-teal)' }} />
                  <b style={{ color: 'var(--color-teal)' }}>{recordCount}</b> bản ghi
                </span>
                <span>
                  <Activity size={13} style={{ display: 'inline', marginRight: '4px', color: 'var(--color-violet)' }} />
                  <b style={{ color: 'var(--color-violet)' }}>{parsedSchema.length}</b> cột dữ liệu
                </span>
              </div>
            </div>
            <button
              onClick={() => { setIsImported(false); setFileName(''); setRecordCount(0); }}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '12px',
                background: 'rgba(0,0,0,0.05)', border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)', cursor: 'pointer',
                marginRight: '8px'
              }}
            >
              Đổi file khác
            </button>
            <button
              onClick={() => {
                markScreenCompleted('prepare');
                setActiveScreen('optimize');
              }}
              style={{
                padding: '8px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                background: 'linear-gradient(135deg, var(--color-violet), #8b5cf6)', border: '1px solid #8b5cf6',
                color: 'var(--bg-space)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)'
              }}
            >
              <span>Tiếp theo</span>
              <ArrowRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* ── SAU KHI IMPORT: XÁC NHẬN SẴN SÀNG ── */}
      {isImported && initialSeeds.length > 0 && (
        <div style={{
          padding: '16px 20px', borderRadius: '12px',
          background: 'rgba(13, 148, 136, 0.06)', border: '1px solid rgba(13, 148, 136, 0.25)',
          display: 'flex', alignItems: 'center', gap: '14px',
        }}>
          <CheckCircle2 size={28} style={{ color: 'var(--color-teal)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>
              Dữ liệu đã sẵn sàng để tối ưu
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Đã nạp <b style={{ color: 'var(--color-teal)' }}>{recordCount}</b> bản ghi với <b style={{ color: 'var(--color-violet)' }}>{parsedSchema.length}</b> cột.
              Chuyển sang <b style={{ color: 'var(--text-primary)' }}>Bước 2: Tối Ưu &amp; So Sánh</b> để chạy thuật toán GA + Hill Climbing.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
