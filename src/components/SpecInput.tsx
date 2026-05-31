import React, { useState, useEffect } from 'react';
import { PRESETS } from '../algorithms/presets';
import type { FieldConstraint, PresetSpec } from '../algorithms/presets';
import { FileText, Sparkles, Plus, Trash2, Database, Wifi, WifiOff, Zap, CheckCircle, Loader, BrainCircuit } from 'lucide-react';
import { generateRandomValue } from '../algorithms/genetic';

// --- ĐỊNH NGHĨA PHẠM VI DỮ LIỆU ĐẦU VÀO CHO COMPONENT ---
interface SpecInputProps {
  rawText: string;                     // Chuỗi văn bản thô mô tả nghiệp vụ
  setRawText: (text: string) => void;  // Hàm cập nhật văn bản thô
  parsedSchema: FieldConstraint[];     // Danh sách các trường ràng buộc đã phân tích ra
  setParsedSchema: React.Dispatch<React.SetStateAction<FieldConstraint[]>>; // Hàm cập nhật danh sách ràng buộc
  isParsing: boolean;                  // Trạng thái kiểm soát hiệu ứng loading khi gọi AI phân tích
  onParse: () => void;                 // Hàm callback gọi lên API Backend trích xuất dữ liệu
  onPresetSelect: (preset: PresetSpec) => void; // Hàm callback nạp mẫu dữ liệu dựng sẵn
  initialSeeds: any[];                 // Tập dữ liệu F0 mẫu khởi tạo sinh từ AI
  setInitialSeeds?: React.Dispatch<React.SetStateAction<any[]>>; // Hàm cập nhật tập hạt giống F0
  onSwitchTab?: (tab: 'input' | 'visualizer' | 'arena' | 'history') => void; // Hàm chuyển đổi tab thủ công
  hasApiKey?: boolean;                 // True khi người dùng đã nhập Gemini API Key thật
}

export const SpecInput: React.FC<SpecInputProps> = ({
  rawText,
  setRawText,
  parsedSchema,
  setParsedSchema,
  isParsing,
  onParse,
  onPresetSelect,
  initialSeeds,
  setInitialSeeds,
  onSwitchTab,
  hasApiKey = false
}) => {
  // --- CÁC HOOK HOẠT ĐỘNG PHẠM VI NỘI BỘ COMPONENT ---
  // Theo dõi ID của mẫu preset đang được lựa chọn (mặc định là User Sign Up)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('user-signup');
  // State quản lý tên trường mới khi người dùng tự gõ thêm thủ công
  const [newFieldName, setNewFieldName] = useState('');
  // State quản lý kiểu dữ liệu của trường tự thêm (Mặc định: String)
  const [newFieldType, setNewFieldType] = useState<FieldConstraint['type']>('string');
  // Theo dõi trạng thái đã phân tích thành công (connected)
  const [isConnected, setIsConnected] = useState(false);
  // Giả lập bước xử lý hiển thị khi đang phân tích
  const [processingStep, setProcessingStep] = useState(0);

  const PROCESSING_STEPS = [
    { icon: '🔌', text: 'Khởi tạo kết nối tới Gemini Flash 3.5 API...' },
    { icon: '🧠', text: 'AI đang đọc và hiểu đặc tả nghiệp vụ...' },
    { icon: '🔍', text: 'Trích xuất các trường dữ liệu và ràng buộc...' },
    { icon: '⚙️', text: 'Sinh tập dữ liệu hạt giống F0 ban đầu...' },
    { icon: '✅', text: 'Phân tích hoàn tất! Đã sẵn sàng.' },
  ];

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isParsing) {
      setProcessingStep(0);
      interval = setInterval(() => {
        setProcessingStep(prev => {
          if (prev < PROCESSING_STEPS.length - 2) return prev + 1;
          clearInterval(interval);
          return prev;
        });
      }, 600);
    }
    return () => clearInterval(interval);
  }, [isParsing]);

  // Đánh dấu connected khi parsedSchema được populate sau khi parse thành công
  useEffect(() => {
    if (!isParsing && parsedSchema.length > 0) {
      setIsConnected(true);
      setProcessingStep(PROCESSING_STEPS.length - 1);
    }
  }, [isParsing, parsedSchema.length]);

  // --- HÀM XỬ LÝ KHI NGƯỜI DÙNG CHỌN MẪU DỰNG SẴN ---
  const handlePresetClick = (preset: PresetSpec) => {
    setSelectedPresetId(preset.id);
    onPresetSelect(preset); // Kích hoạt callback báo lên App cha để cập nhật toàn bộ state chính
  };

  // --- HÀM THÊM THỦ CÔNG MỘT TRƯỜNG DỮ LIỆU MỚI VÀO SCHEMA ---
  const handleAddField = () => {
    // Nếu chưa nhập tên trường, dừng xử lý
    if (!newFieldName.trim()) return;

    // Kiểm tra trùng lặp tên trường (không phân biệt chữ hoa, chữ thường)
    if (parsedSchema.some(f => f.name.toLowerCase() === newFieldName.toLowerCase().trim())) {
      alert('Tên trường đã tồn tại!');
      return;
    }

    // Tạo đối tượng trường ràng buộc mới
    const newField: FieldConstraint = {
      name: newFieldName.trim(),
      type: newFieldType,
      required: true,
      description: `Trường ${newFieldName} tự thêm thủ công`
    };

    // Đẩy đối tượng mới vào cuối danh sách schema hiện tại
    setParsedSchema([...parsedSchema, newField]);

    // Đồng bộ và tự động sinh ngẫu nhiên các giá trị hạt giống F0 cho trường mới này
    if (setInitialSeeds) {
      setInitialSeeds(prevSeeds => {
        // Sinh đa dạng các chế độ dữ liệu (valid, invalid, boundary, security) cho các ca hạt giống
        const modes: ('valid' | 'invalid' | 'boundary' | 'security')[] = ['valid', 'boundary', 'security', 'valid'];
        return prevSeeds.map((seed, idx) => {
          const mode = modes[idx % modes.length];
          return {
            ...seed,
            [newField.name]: generateRandomValue(newField, mode)
          };
        });
      });
    }

    // Reset ô nhập liệu tên trường về chuỗi rỗng
    setNewFieldName('');
  };

  // --- HÀM XÓA BỎ MỘT TRƯỜNG DỮ LIỆU KHỎI SCHEMA ---
  const handleRemoveField = (index: number) => {
    const fieldToRemove = parsedSchema[index];
    const updated = [...parsedSchema];
    updated.splice(index, 1); // Cắt bỏ phần tử tại index chỉ định
    setParsedSchema(updated); // Cập nhật lại state

    // Đồng bộ xóa trường này ra khỏi danh sách hạt giống F0
    if (setInitialSeeds && fieldToRemove) {
      setInitialSeeds(prevSeeds =>
        prevSeeds.map(seed => {
          const newSeed = { ...seed };
          delete newSeed[fieldToRemove.name];
          return newSeed;
        })
      );
    }
  };

  // --- HÀM CẬP NHẬT TỪNG THUỘC TÍNH RÀNG BUỘC CỦA TRƯỜNG (BIÊN, PHỤC VỤ TỐI ƯU HÓA) ---
  const handleUpdateField = (index: number, key: keyof FieldConstraint, value: any) => {
    const updated = [...parsedSchema];
    // Ghi đè thuộc tính chỉ định của trường tại vị trí index
    updated[index] = { ...updated[index], [key]: value } as FieldConstraint;
    setParsedSchema(updated);

    // Đồng bộ cập nhật lại giá trị hạt giống F0 cho trường này để khớp tức thì với ràng buộc biên mới
    const updatedField = updated[index];
    if (setInitialSeeds && updatedField) {
      setInitialSeeds(prevSeeds => {
        const modes: ('valid' | 'invalid' | 'boundary' | 'security')[] = ['valid', 'boundary', 'security', 'valid'];
        return prevSeeds.map((seed, idx) => {
          const mode = modes[idx % modes.length];
          return {
            ...seed,
            [updatedField.name]: generateRandomValue(updatedField, mode)
          };
        });
      });
    }
  };

  return (
    <div className="grid-2">
      {/* 1. CỘT BÊN TRÁI: KHU VỰC NHẬP VĂN BẢN ĐẶC TẢ NGỮ NGHĨA VÀ CHỌN PRESETS */}
      <div className="glass-card flex flex-col gap-md teal-border glow-teal">
        <div className="flex align-center gap-sm">
          <FileText className="text-teal" size={24} style={{ color: 'var(--color-teal)' }} />
          <h2>BƯỚC 1: PHÂN TÍCH ĐẶC TẢ NGHIỆP VỤ (RAW SPEC INPUT)</h2>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Chọn một mẫu kịch bản nghiệp vụ có sẵn bên dưới hoặc tự biên soạn đặc tả bằng ngôn ngữ tự nhiên tiếng Việt để AI phân tích trích xuất các ràng buộc kiểm thử.
        </p>

        {/* Khay lựa chọn nhanh các Presets nghiệp vụ mẫu */}
        <div className="flex gap-sm" style={{ flexWrap: 'wrap', margin: '8px 0' }}>
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetClick(preset)}
              className={`tab-btn ${selectedPresetId === preset.id ? 'active' : ''}`}
              style={{ fontSize: '13px' }}
            >
              {preset.title.split(' (')[0]}
            </button>
          ))}
        </div>

        {/* Vùng nhập đặc tả nghiệp vụ tự do */}
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          className="input-field"
          style={{ minHeight: '200px', resize: 'vertical', fontFamily: 'inherit', fontSize: '14px', lineHeight: '1.6' }}
          placeholder="Nhập mô tả nghiệp vụ cho dữ liệu cần sinh tại đây..."
        />

        {/* GEMINI API STATUS INDICATOR */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 14px',
          background: isParsing
            ? 'rgba(59, 130, 246, 0.06)'
            : isConnected
              ? 'rgba(45, 212, 191, 0.06)'
              : 'rgba(255, 255, 255, 0.02)',
          border: '1px solid',
          borderColor: isParsing
            ? 'rgba(59, 130, 246, 0.3)'
            : isConnected
              ? 'rgba(45, 212, 191, 0.25)'
              : 'rgba(255, 255, 255, 0.06)',
          borderRadius: '10px',
          transition: 'all 0.4s ease',
          marginTop: '4px',
          marginBottom: '4px',
          boxShadow: isParsing
            ? '0 0 12px rgba(59, 130, 246, 0.1)'
            : isConnected
              ? '0 0 12px rgba(45, 212, 191, 0.08)'
              : 'none'
        }}>
          {/* Icon trạng thái */}
          <div style={{ flexShrink: 0 }}>
            {isParsing ? (
              <div style={{ width: '20px', height: '20px', border: '2.5px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
            ) : isConnected ? (
              <CheckCircle size={20} style={{ color: 'var(--color-teal)' }} />
            ) : (
              <BrainCircuit size={20} style={{ color: 'var(--text-muted)' }} />
            )}
          </div>

          {/* Nội dung trạng thái */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span style={{
                fontSize: '11.5px',
                fontWeight: 'bold',
                color: isParsing ? '#3b82f6' : isConnected ? 'var(--color-teal)' : 'var(--text-secondary)'
              }}>
                {isParsing
                  ? (hasApiKey ? '⏳ Gọi Gemini API thật...' : '⏳ Đang phân tích bằng Mock AI...')
                  : isConnected
                    ? (hasApiKey ? '✅ Gemini Real API - Phân Tích Thành Công' : '✅ Mock AI - Phân Tích Thành Công')
                    : (hasApiKey ? '🧠 Gemini Flash 1.5 - Đã kết nối' : '🤖 Mock AI Mode - Sẵn sàng')}
              </span>
              {/* Model Badge */}
              <span style={{
                fontSize: '9.5px',
                padding: '1px 6px',
                borderRadius: '8px',
                background: hasApiKey ? 'rgba(45,212,191,0.1)' : 'rgba(250,204,21,0.08)',
                border: hasApiKey ? '1px solid rgba(45,212,191,0.25)' : '1px solid rgba(250,204,21,0.2)',
                color: hasApiKey ? 'var(--color-teal)' : '#facc15',
                fontFamily: 'var(--font-mono)',
                fontWeight: 'bold',
                letterSpacing: '0.03em'
              }}>
                {hasApiKey ? 'gemini-1.5-flash' : 'mock-ai-local'}
              </span>
            </div>

            {/* Bước xử lý đang chạy */}
            {isParsing && PROCESSING_STEPS[processingStep] && (
              <div style={{ fontSize: '11px', color: 'rgba(59,130,246,0.8)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span>{PROCESSING_STEPS[processingStep].icon}</span>
                <span>{PROCESSING_STEPS[processingStep].text}</span>
              </div>
            )}
            {isConnected && !isParsing && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {hasApiKey
                  ? `📊 ${parsedSchema.length} trường ràng buộc • Gemini API xử lý thành công`
                  : `📊 ${parsedSchema.length} trường ràng buộc • Mock AI sinh dữ liệu F0 sẵn sàng`
                }
              </div>
            )}
            {!isParsing && !isConnected && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {hasApiKey
                  ? '🔑 API Key hợp lệ → bấm nút để gọi Gemini thật'
                  : 'Nhập đặc tả và bấm nút bên dưới → Mock AI sẽ phân tích nội bộ'
                }
              </div>
            )}
          </div>

          {/* Dot live */}
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isParsing ? '#3b82f6' : isConnected ? 'var(--color-teal)' : 'rgba(255,255,255,0.15)',
            boxShadow: isParsing ? '0 0 8px #3b82f6' : isConnected ? '0 0 8px var(--color-teal)' : 'none',
            animation: isParsing ? 'pulse 1s infinite' : isConnected ? 'pulse 3s infinite' : 'none',
            flexShrink: 0
          }} />
        </div>

        {/* Nút bấm gử yêu cầu lên API Backend AI trích xuất thông tin */}
        <button
          onClick={onParse}
          disabled={isParsing || !rawText.trim()}
          className={`btn btn-primary ${isParsing || !rawText.trim() ? 'btn-disabled' : ''}`}
          style={{ marginTop: '4px', alignSelf: 'flex-start' }}
        >
          {isParsing ? (
            <>
              <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
              AI Đang Phân Tích...
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Yêu Cầu AI (Gemini) Phân Tích Đặc Tả
            </>
          )}
        </button>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        `}</style>
      </div>

      {/* 2. CỘT BÊN PHẢI: KHU VỰC CHỈNH SỬA SCHEMA RÀNG BUỘC CỦA ĐỒNG SÁNG LẬP */}
      <div className="glass-card flex flex-col gap-md violet-border">
        <div className="flex align-center gap-sm">
          <Sparkles className="text-violet" size={24} style={{ color: 'var(--color-violet)' }} />
          <h2>Cấu Trúc Schema Ràng Buộc Kiểm Thử (JSON Rules)</h2>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Dưới đây là các thuộc tính và quy tắc kiểm thử biên do AI phân tích ra. Bạn có thể tự thêm mới hoặc trực tiếp tinh chỉnh các giá trị Max/Min, Regex phục vụ tối ưu hóa chất lượng test suite.
        </p>

        {/* Danh sách cuộn mượt các trường dữ liệu */}
        <div className="flex flex-col gap-sm" style={{ maxHeight: '320px', overflowY: 'auto', paddingRight: '4px', margin: '8px 0' }}>
          {isParsing ? (
            <>
              <style>{`
                @keyframes pulse-local {
                  0%, 100% { opacity: 0.6; }
                  50% { opacity: 0.25; }
                }
                .skeleton-row {
                  animation: pulse-local 1.5s infinite ease-in-out;
                }
              `}</style>
              {Array(3).fill(0).map((_, i) => (
                <div key={i} className="skeleton-row" style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  padding: '16px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div className="flex justify-between">
                    <div style={{ width: '35%', height: '14px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px' }}></div>
                    <div style={{ width: '15%', height: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}></div>
                  </div>
                  <div className="flex gap-sm">
                    <div style={{ width: '70px', height: '22px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}></div>
                    <div style={{ width: '80px', height: '22px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}></div>
                    <div style={{ width: '110px', height: '22px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}></div>
                  </div>
                </div>
              ))}
            </>
          ) : parsedSchema.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
              Chưa có cấu trúc trường nào được nạp. Hãy nhập đặc tả nghiệp vụ và bấm "Yêu Cầu AI Trích Xuất Schema" ở cột bên trái.
            </div>
          ) : (
            parsedSchema.map((field, idx) => (
              <div
                key={field.name}
                className="flex align-center gap-sm"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                {/* Khu vực nhập các cấu hình chi tiết cho từng trường */}
                <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div className="flex align-center justify-between">
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 'bold', color: 'var(--color-teal)' }}>
                      {field.name}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Kiểu: {field.type.toUpperCase()}
                    </span>
                  </div>

                  {/* Hộp tùy chỉnh ràng buộc biên */}
                  <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => handleUpdateField(idx, 'required', e.target.checked)}
                      />
                      Bắt buộc
                    </label>

                    {/* Hiển thị giới hạn số hoặc ký tự tùy theo kiểu dữ liệu để tối ưu hóa biên */}
                    {field.type === 'number' ? (
                      <>
                        <input
                          type="number"
                          placeholder="Min Val"
                          value={field.minValue !== undefined ? field.minValue : ''}
                          onChange={(e) => handleUpdateField(idx, 'minValue', e.target.value === '' ? undefined : Number(e.target.value))}
                          className="input-field"
                          style={{ padding: '4px 8px', fontSize: '11px', width: '80px' }}
                        />
                        <input
                          type="number"
                          placeholder="Max Val"
                          value={field.maxValue !== undefined ? field.maxValue : ''}
                          onChange={(e) => handleUpdateField(idx, 'maxValue', e.target.value === '' ? undefined : Number(e.target.value))}
                          className="input-field"
                          style={{ padding: '4px 8px', fontSize: '11px', width: '80px' }}
                        />
                      </>
                    ) : (
                      <>
                        <input
                          type="number"
                          placeholder="Min Len"
                          value={field.minLength !== undefined ? field.minLength : ''}
                          onChange={(e) => handleUpdateField(idx, 'minLength', e.target.value === '' ? undefined : Number(e.target.value))}
                          className="input-field"
                          style={{ padding: '4px 8px', fontSize: '11px', width: '80px' }}
                        />
                        <input
                          type="number"
                          placeholder="Max Len"
                          value={field.maxLength !== undefined ? field.maxLength : ''}
                          onChange={(e) => handleUpdateField(idx, 'maxLength', e.target.value === '' ? undefined : Number(e.target.value))}
                          className="input-field"
                          style={{ padding: '4px 8px', fontSize: '11px', width: '80px' }}
                        />
                      </>
                    )}

                    {/* Ô nhập biểu thức chính quy (Regex) để so khớp kiểm định định dạng */}
                    <input
                      type="text"
                      placeholder="Regex Pattern"
                      value={field.regex || ''}
                      onChange={(e) => handleUpdateField(idx, 'regex', e.target.value || undefined)}
                      className="input-field"
                      style={{ padding: '4px 8px', fontSize: '11px', width: '130px', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                </div>

                {/* Nút xóa bỏ trường kiểm thử này */}
                <button
                  onClick={() => handleRemoveField(idx)}
                  className="btn btn-secondary"
                  style={{ padding: '8px', color: 'var(--color-rose)', borderColor: 'rgba(244,63,94,0.1)' }}
                  title="Xóa trường"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Thanh công cụ thêm mới trường kiểm thử thủ công dưới đáy */}
        <div
          className="flex align-center gap-sm"
          style={{
            marginTop: 'auto',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          <input
            type="text"
            placeholder="Tên trường mới (ví dụ: phone, score)"
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            className="input-field"
            style={{ fontSize: '13px', flex: '2' }}
          />
          <select
            value={newFieldType}
            onChange={(e) => setNewFieldType(e.target.value as FieldConstraint['type'])}
            className="input-field"
            style={{ fontSize: '13px', flex: '1', cursor: 'pointer' }}
          >
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="email">Email</option>
            <option value="card">Credit Card</option>
            <option value="phone">Phone (VN)</option>
          </select>
          <button
            onClick={handleAddField}
            disabled={!newFieldName.trim()}
            className={`btn btn-secondary ${!newFieldName.trim() ? 'btn-disabled' : ''}`}
            style={{ padding: '12px', minWidth: '46px' }}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* 3. PHẦN DƯỚI: HIỂN THỊ DỮ LIỆU HẠT GIỐNG F0 (PREVIEW INITIAL SEEDS) */}
      {(isParsing || (initialSeeds && initialSeeds.length > 0)) && (
        <div className="glass-card flex flex-col gap-md violet-border" style={{ gridColumn: 'span 2', marginTop: '16px' }}>
          <div className="flex align-center gap-sm">
            <Database className="text-violet" size={24} style={{ color: 'var(--color-violet)' }} />
            <h2>Tập Dữ Liệu Ca Kiểm Thử Mẫu Khởi Tạo (F0 Initial Seeds Dataset)</h2>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Đây là tập dữ liệu ban đầu gồm các ca test thông thường, cận biên nghiệp vụ và kịch bản tấn công bảo mật (SQL Injection, XSS) do AI phân tích tự động sinh ra. Tập dữ liệu này sẽ được dùng làm "hạt giống" thế hệ F0 phục vụ cho thuật toán di truyền di trú ở bước tiếp theo.
          </p>

          {isParsing ? (
            <div style={{
              padding: '40px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              background: 'rgba(255,255,255,0.01)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(255,255,255,0.03)'
            }}>
              <div
                className="status-dot-pulse"
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: 'var(--color-violet)',
                  boxShadow: '0 0 12px var(--color-violet)',
                  animation: 'pulse-local 1.5s infinite ease-in-out'
                }}
              />
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                AI đang làm việc... Đang trích xuất cấu trúc ràng buộc và tự động tạo tập dữ liệu hạt giống F0...
              </span>

              {/* Bảng skeleton micro thể hiện tiến trình loading */}
              <div className="skeleton-row" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                <div style={{ width: '100%', height: '36px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }} />
                <div style={{ width: '100%', height: '28px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }} />
                <div style={{ width: '100%', height: '28px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }} />
                <div style={{ width: '100%', height: '28px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }} />
              </div>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 'var(--radius-sm)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ padding: '10px 16px', color: 'var(--text-muted)', width: '80px' }}>STT</th>
                      {parsedSchema.map((field) => (
                        <th key={field.name} style={{ padding: '10px 16px', color: 'var(--color-teal)', fontWeight: '600' }}>
                          {field.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {initialSeeds.map((seed, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: idx < initialSeeds.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                          transition: 'background 0.2s'
                        }}
                        className="table-row-hover"
                      >
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>F0 #{idx + 1}</td>
                        {parsedSchema.map((field) => {
                          const value = seed[field.name];
                          const valStr = value !== undefined ? String(value) : '-';

                          // Tô đỏ nhẹ các payload bảo mật/độc hại để người dùng nhận ra
                          const isAttack = valStr.toLowerCase().includes("' or") ||
                            valStr.toLowerCase().includes("--") ||
                            valStr.toLowerCase().includes("<script");

                          return (
                            <td
                              key={field.name}
                              style={{
                                padding: '12px 16px',
                                color: isAttack ? 'var(--color-rose)' : 'var(--text-primary)',
                                fontWeight: isAttack ? '600' : 'normal',
                                fontFamily: field.type === 'number' || isAttack ? 'var(--font-mono)' : 'inherit'
                              }}
                            >
                              {valStr}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Nút bấm thủ công để chuyển sang Tab 2 */}
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => onSwitchTab && onSwitchTab('visualizer')}
                  className="btn btn-primary glow-teal"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, var(--color-teal), var(--color-violet))',
                    border: 'none',
                    boxShadow: '0 4px 14px rgba(45,212,191,0.2)'
                  }}
                >
                  <Sparkles size={16} />
                  Tiếp tục: Bắt đầu Tối Ưu Hóa (Chuyển Sang Bước 2)
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

