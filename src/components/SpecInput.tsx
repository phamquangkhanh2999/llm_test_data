import React, { useState } from 'react';
import { PRESETS } from '../algorithms/presets';
import type { FieldConstraint, PresetSpec } from '../algorithms/presets';
import { FileText, Sparkles, Plus, Trash2 } from 'lucide-react';

// --- ĐỊNH NGHĨA PHẠM VI DỮ LIỆU ĐẦU VÀO CHO COMPONENT ---
interface SpecInputProps {
  rawText: string;                     // Chuỗi văn bản thô mô tả nghiệp vụ
  setRawText: (text: string) => void;  // Hàm cập nhật văn bản thô
  parsedSchema: FieldConstraint[];     // Danh sách các trường ràng buộc đã phân tích ra
  setParsedSchema: React.Dispatch<React.SetStateAction<FieldConstraint[]>>; // Hàm cập nhật danh sách ràng buộc
  isParsing: boolean;                  // Trạng thái kiểm soát hiệu ứng loading khi gọi AI phân tích
  onParse: () => void;                 // Hàm callback gọi lên API Backend trích xuất dữ liệu
  onPresetSelect: (preset: PresetSpec) => void; // Hàm callback nạp mẫu dữ liệu dựng sẵn
}

export const SpecInput: React.FC<SpecInputProps> = ({
  rawText,
  setRawText,
  parsedSchema,
  setParsedSchema,
  isParsing,
  onParse,
  onPresetSelect
}) => {
  // --- CÁC HOOK HOẠT ĐỘNG PHẠM VI NỘI BỘ COMPONENT ---
  // Theo dõi ID của mẫu preset đang được lựa chọn (mặc định là User Sign Up)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('user-signup');
  // State quản lý tên trường mới khi người dùng tự gõ thêm thủ công
  const [newFieldName, setNewFieldName] = useState('');
  // State quản lý kiểu dữ liệu của trường tự thêm (Mặc định: String)
  const [newFieldType, setNewFieldType] = useState<FieldConstraint['type']>('string');

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
    
    // Reset ô nhập liệu tên trường về chuỗi rỗng
    setNewFieldName('');
  };

  // --- HÀM XÓA BỎ MỘT TRƯỜNG DỮ LIỆU KHỎI SCHEMA ---
  const handleRemoveField = (index: number) => {
    const updated = [...parsedSchema];
    updated.splice(index, 1); // Cắt bỏ phần tử tại index chỉ định
    setParsedSchema(updated); // Cập nhật lại state
  };

  // --- HÀM CẬP NHẬT TỪNG THUỘC TÍNH RÀNG BUỘC CỦA TRƯỜNG (BIÊN, PHỤC VỤ TỐI ƯU HÓA) ---
  const handleUpdateField = (index: number, key: keyof FieldConstraint, value: any) => {
    const updated = [...parsedSchema];
    // Ghi đè thuộc tính chỉ định của trường tại vị trí index
    updated[index] = { ...updated[index], [key]: value } as FieldConstraint;
    setParsedSchema(updated);
  };

  return (
    <div className="grid-2">
      {/* 1. CỘT BÊN TRÁI: KHU VỰC NHẬP VĂN BẢN ĐẶC TẢ NGỮ NGHĨA VÀ CHỌN PRESETS */}
      <div className="glass-card flex flex-col gap-md teal-border glow-teal">
        <div className="flex align-center gap-sm">
          <FileText className="text-teal" size={24} style={{ color: 'var(--color-teal)' }} />
          <h2>Nhập Đặc Tả Nghiệp Vụ Chức Năng (Raw Spec Input)</h2>
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

        {/* Nút bấm gửi yêu cầu lên API Backend OpenAI trích xuất thông tin */}
        <button
          onClick={onParse}
          disabled={isParsing || !rawText.trim()}
          className={`btn btn-primary ${isParsing || !rawText.trim() ? 'btn-disabled' : ''}`}
          style={{ marginTop: '8px', alignSelf: 'flex-start' }}
        >
          <Sparkles size={18} />
          {isParsing ? 'AI Đang Phân Tích Hệ Thống...' : 'Yêu Cầu AI (OpenAI) Trích Xuất Schema'}
        </button>
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
          {parsedSchema.length === 0 ? (
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
    </div>
  );
};

