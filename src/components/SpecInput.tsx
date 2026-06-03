import React, { useState, useEffect } from 'react';
import { PRESETS } from '../algorithms/presets';
import type { FieldConstraint } from '../algorithms/presets';
import { FileText, Plus, Trash2, Database, CheckCircle, BrainCircuit, Zap, FileJson, Sparkles } from 'lucide-react';
import { generateRandomValue } from '../algorithms/genetic';
import { useAppStore } from '../store/useAppStore';

export const SpecInput: React.FC = () => {
  const {
    rawText,
    setRawText,
    parsedSchema,
    setParsedSchema,
    isParsing,
    handleParseSpec,
    handlePresetSelect,
    initialSeeds,
    setInitialSeeds,
    apiKey,
    isEvaluating,
    evaluationResult,
    handleEvaluateSeeds,
    specificationHistory,
    isFetchingHistory,
    fetchSpecificationHistory,
    handleHistorySelect
  } = useAppStore();

  const hasApiKey = apiKey.trim().length > 10;

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

  // State quản lý Modal Lịch sử
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any | null>(null);

  const downloadHistoryJson = (item: any) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(item, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `specification_${item.id.substring(0, 8)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // --- CẤU HÌNH PHƯƠNG PHÁP KIỂM THỬ KHỞI TẠO (F0 SEEDS) ---
  // Chọn thuật toán sinh dữ liệu ban đầu
  const [testMethod, setTestMethod] = useState<'random' | 'bva' | 'ep' | 'decision'>('random');
  // Cấu hình số lượng điểm biên (dành riêng cho phương pháp BVA: 2, 3 hoặc 5 điểm)
  const [boundaryCount, setBoundaryCount] = useState<number>(3);
  // Cấu hình số lượng phân vùng tương đương (dành riêng cho phương pháp EP)
  const [partitionCount, setPartitionCount] = useState<number>(3);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);

  const handleRegenerateSeeds = async () => {
    if (!parsedSchema || parsedSchema.length === 0) return;
    setIsRegenerating(true);
    try {
      const response = await fetch("http://localhost:8000/api/generate-seeds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fields: parsedSchema,
          test_method: testMethod,
          boundary_count: boundaryCount,
          partition_count: partitionCount,
          api_key_override: sessionStorage.getItem("openai_api_key") || null,
          raw_text: rawText
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Không thể kết nối tới server tái sinh hạt giống!");
      }

      const data = await response.json();
      if (setInitialSeeds && data.initialPopulation) {
        setInitialSeeds(data.initialPopulation);
        alert(`Tái sinh tập hạt giống F0 thành công bằng phương pháp: ${testMethod === 'bva' ? 'Phân tích giá trị biên (BVA)' :
          testMethod === 'ep' ? 'Phân vùng tương đương (EP)' :
            testMethod === 'decision' ? 'Bảng quyết định' : 'Ngẫu nhiên / Hybrid'
          }!`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Đã xảy ra lỗi khi sinh lại dữ liệu biên: ${e.message}`);
    } finally {
      setIsRegenerating(false);
    }
  };

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
  const onPresetClick = (preset: typeof PRESETS[0]) => {
    setSelectedPresetId(preset.id);
    handlePresetSelect(preset);
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
    setInitialSeeds((prevSeeds) => {
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
    if (fieldToRemove) {
      setInitialSeeds((prevSeeds) =>
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
    if (updatedField) {
      setInitialSeeds((prevSeeds) => {
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
    <>
      <div className="grid-2">
        {/* 1. CỘT BÊN TRÁI: KHU VỰC NHẬP VĂN BẢN ĐẶC TẢ NGỮ NGHĨA VÀ CHỌN PRESETS */}
      <div className="glass-card flex flex-col gap-md teal-border glow-teal">
        <div className="flex align-center gap-sm">
          <FileText className="text-teal" size={24} style={{ color: 'var(--color-teal)' }} />
          <h2>BƯỚC 1: PHÂN TÍCH YÊU CẦU KIỂM THỬ</h2>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Mô tả yêu cầu kiểm thử của bạn bằng ngôn ngữ tự nhiên — AI sẽ tự động trích xuất các trường dữ liệu và ràng buộc miền giá trị.
          Chưa biết bắt đầu từ đâu? Chọn một <b style={{ color: 'var(--color-teal)' }}>ví dụ về đặc tả</b> bên dưới để xem thử.
        </p>

        {/* Label rõ ràng: đây là ví dụ đặc tả mẫu */}
        <div style={{ marginTop: '8px', marginBottom: '4px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px',
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--color-teal)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              background: 'rgba(45,212,191,0.1)',
              border: '1px solid rgba(45,212,191,0.25)',
              padding: '3px 10px',
              borderRadius: '20px',
            }}>
              📋 Ví dụ về đặc tả
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              — Chọn để xem thử, hoặc tự nhập đặc tả của bạn bên dưới
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => onPresetClick(preset)}
                className={`tab-btn ${selectedPresetId === preset.id ? 'active' : ''}`}
                title={preset.description}
                style={{ fontSize: '13px' }}
              >
                {preset.title.split(' (')[0]}
              </button>
            ))}
            <button
              onClick={() => {
                fetchSpecificationHistory();
                setIsHistoryModalOpen(true);
              }}
              className="tab-btn"
              style={{ fontSize: '13px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' }}
            >
              🕰️ Lịch sử Đặc tả
            </button>
          </div>
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
                {hasApiKey ? 'gemini-3.5-flash' : 'mock-ai-local'}
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
          onClick={handleParseSpec}
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
          <FileJson className="text-yellow" size={24} style={{ color: 'var(--color-yellow)' }} />
          <h2>BƯỚC 2: XÁC ĐỊNH RÀNG BUỘC MIỀN GIÁ TRỊ</h2>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Xem và tinh chỉnh lại các ràng buộc miền giá trị (Domain Constraints) mà AI đã bóc tách từ yêu cầu nghiệp vụ.
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

      {/* 3. KHU VỰC CẤU HÌNH & HIỂN THỊ DỮ LIỆU F0 (NẰM DƯỚI CÙNG, TRẢI DÀI 2 CỘT) */}
      {parsedSchema.length > 0 && (
        <div className="glass-card flex flex-col gap-md violet-border glow-violet" style={{ gridColumn: '1 / -1', marginTop: '20px' }}>
          <div className="flex align-center gap-sm">
            <Database className="text-violet" size={24} style={{ color: 'var(--color-violet)' }} />
            <h2>BƯỚC 3: THIẾT KẾ CA KIỂM THỬ CƠ SỞ (BASE TEST CASES)</h2>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Dựa trên cấu trúc đã phân tích, chọn một kỹ thuật thiết kế ca kiểm thử chuẩn (Test Design Techniques) để sinh bộ dữ liệu mầm (Initial Seeds).
          </p>

          <div className="flex align-center justify-between" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div className="flex align-center gap-sm">
              <BrainCircuit className="text-violet" size={24} style={{ color: 'var(--color-violet)' }} />
              <h2 style={{ fontSize: '18px', color: '#fff', margin: 0 }}>
                Kỹ Thuật Thiết Kế Ca Kiểm Thử
              </h2>
            </div>

            <span style={{
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: hasApiKey ? 'rgba(45,212,191,0.1)' : 'rgba(255,255,255,0.03)',
              border: hasApiKey ? '1px solid rgba(45,212,191,0.2)' : '1px solid rgba(255,255,255,0.08)',
              color: hasApiKey ? 'var(--color-teal)' : 'var(--text-muted)'
            }}>
              {hasApiKey ? '✨ Gemini AI hỗ trợ sinh biên' : '💻 Sử dụng sinh cục bộ dự phòng'}
            </span>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', margin: 0 }}>
            Sau khi có cấu trúc trường, bạn hãy chọn phương pháp sinh dữ liệu mẫu F0. Giải thuật di truyền (GA) ở bước sau sẽ thừa hưởng tập dữ liệu hạt giống này để tiến hành tối ưu hóa vượt bậc.
          </p>

          {/* Grid lựa chọn phương pháp */}
          <div className="grid-4" style={{ gap: '12px', marginTop: '8px' }}>
            {/* Phương pháp Random */}
            <div
              onClick={() => setTestMethod('random')}
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-sm)',
                background: testMethod === 'random' ? 'rgba(45, 212, 191, 0.08)' : 'rgba(255,255,255,0.01)',
                border: '1px solid',
                borderColor: testMethod === 'random' ? 'var(--color-teal)' : 'rgba(255,255,255,0.05)',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: testMethod === 'random' ? '0 0 12px rgba(45, 212, 191, 0.2)' : 'none',
                position: 'relative',
                transform: testMethod === 'random' ? 'scale(1.02)' : 'scale(1)'
              }}
            >
              {testMethod === 'random' && (
                <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                  <CheckCircle size={15} style={{ color: 'var(--color-teal)' }} />
                </div>
              )}
              <div style={{ fontWeight: 'bold', fontSize: '14px', color: testMethod === 'random' ? 'var(--color-teal)' : '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🎲 Ngẫu nhiên / Hybrid
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Sinh hỗn hợp ca đúng, ca biên ngẫu nhiên và SQLi/XSS bảo mật.
              </span>
            </div>

            {/* Phương pháp BVA */}
            <div
              onClick={() => setTestMethod('bva')}
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-sm)',
                background: testMethod === 'bva' ? 'rgba(167, 139, 250, 0.08)' : 'rgba(255,255,255,0.01)',
                border: '1px solid',
                borderColor: testMethod === 'bva' ? 'var(--color-violet)' : 'rgba(255,255,255,0.05)',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: testMethod === 'bva' ? '0 0 12px rgba(167, 139, 250, 0.2)' : 'none',
                position: 'relative',
                transform: testMethod === 'bva' ? 'scale(1.02)' : 'scale(1)'
              }}
            >
              {testMethod === 'bva' && (
                <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                  <CheckCircle size={15} style={{ color: 'var(--color-violet)' }} />
                </div>
              )}
              <div style={{ fontWeight: 'bold', fontSize: '14px', color: testMethod === 'bva' ? 'var(--color-violet)' : '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                📏 Phân tích giá trị biên (BVA)
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Tập trung sinh các giá trị sát nút quanh ngưỡng biên giới hạn.
              </span>
            </div>

            {/* Phương pháp EP */}
            <div
              onClick={() => setTestMethod('ep')}
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-sm)',
                background: testMethod === 'ep' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255,255,255,0.01)',
                border: '1px solid',
                borderColor: testMethod === 'ep' ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: testMethod === 'ep' ? '0 0 12px rgba(59, 130, 246, 0.2)' : 'none',
                position: 'relative',
                transform: testMethod === 'ep' ? 'scale(1.02)' : 'scale(1)'
              }}
            >
              {testMethod === 'ep' && (
                <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                  <CheckCircle size={15} style={{ color: '#3b82f6' }} />
                </div>
              )}
              <div style={{ fontWeight: 'bold', fontSize: '14px', color: testMethod === 'ep' ? '#3b82f6' : '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                📊 Phân vùng tương đương (EP)
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Chia nhóm miền dữ liệu để sinh giá trị đại diện từng phân vùng.
              </span>
            </div>

            {/* Phương pháp Decision Table */}
            <div
              onClick={() => setTestMethod('decision')}
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-sm)',
                background: testMethod === 'decision' ? 'rgba(244, 63, 94, 0.08)' : 'rgba(255,255,255,0.01)',
                border: '1px solid',
                borderColor: testMethod === 'decision' ? 'var(--color-rose)' : 'rgba(255,255,255,0.05)',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: testMethod === 'decision' ? '0 0 12px rgba(244, 63, 94, 0.2)' : 'none',
                position: 'relative',
                transform: testMethod === 'decision' ? 'scale(1.02)' : 'scale(1)'
              }}
            >
              {testMethod === 'decision' && (
                <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                  <CheckCircle size={15} style={{ color: 'var(--color-rose)' }} />
                </div>
              )}
              <div style={{ fontWeight: 'bold', fontSize: '14px', color: testMethod === 'decision' ? 'var(--color-rose)' : '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                📋 Bảng quyết định (Logic Table)
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Sinh các ca phối hợp kiểm định logic chéo các trường nghiệp vụ.
              </span>
            </div>
          </div>

          {/* Cấu hình chi tiết cho từng phương pháp */}
          {(testMethod === 'bva' || testMethod === 'ep') && (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                padding: '18px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}
            >
              {/* Slider / Picker */}
              {testMethod === 'bva' && (
                <div className="flex align-center gap-md" style={{ flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', minWidth: '180px' }}>
                    Chọn số lượng biên quanh giới hạn:
                  </div>
                  <div className="flex align-center gap-sm">
                    {/* Các nút chọn số lượng điểm kiểm thử quanh một giá trị biên */}
                    {[2, 3, 5].map((num) => (
                      <button
                        key={num}
                        onClick={() => setBoundaryCount(num)}
                        className={`tab-btn ${boundaryCount === num ? 'active' : ''}`}
                        style={{ padding: '6px 16px', fontSize: '13px' }}
                        title={num === 2 ? 'Biên cơ bản (2 điểm)' : num === 3 ? 'Biên mở rộng (3 điểm)' : 'Biên toàn diện (5 điểm)'}
                      >
                        {num} Biên
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {testMethod === 'ep' && (
                <div className="flex align-center gap-md" style={{ flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', minWidth: '180px' }}>
                    Chọn số phân vùng miền giá trị:
                  </div>
                  <div className="flex align-center gap-sm">
                    {[2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        onClick={() => setPartitionCount(num)}
                        className={`tab-btn ${partitionCount === num ? 'active' : ''}`}
                        style={{ padding: '6px 16px', fontSize: '13px' }}
                      >
                        {num} Phân vùng
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dòng ví dụ minh họa động */}
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--color-teal)',
                  background: 'rgba(45, 212, 191, 0.03)',
                  borderLeft: '3px solid var(--color-teal)',
                  padding: '12px 16px',
                  borderRadius: '0 4px 4px 0',
                  lineHeight: '1.5'
                }}
              >
                {testMethod === 'bva' ? (
                  <>
                    💡 <b>Ví dụ trực quan:</b> Nếu có trường <b>password</b> yêu cầu độ dài tối thiểu là <b>8 ký tự</b>. Chọn <b>{boundaryCount} biên</b> → AI / Thuật toán sẽ tính toán và sinh ra các mật khẩu có độ dài thực tế: <b>{boundaryCount === 2 ? '7, 8' : boundaryCount === 3 ? '7, 8, 9' : '6, 7, 8, 9, 10'}</b> ký tự (gồm đúng biên 8, các độ dài thiếu ký tự lỗi và thừa ký tự hợp lệ).
                  </>
                ) : (
                  <>
                    💡 <b>Ví dụ trực quan:</b> Nếu có trường <b>age</b> từ <b>18 đến 100 tuổi</b>. Chọn <b>{partitionCount} phân vùng</b> → Hệ thống sẽ phân hoạch dải tuổi thành <b>{partitionCount} đoạn hợp lệ bằng nhau</b>, lấy đại diện trung điểm từng đoạn, đồng thời tự động thêm các phân vùng lỗi ngoài biên (như &lt;18 tuổi hoặc &gt;100 tuổi).
                  </>
                )}
              </div>

              {/* BẢNG GIẢI THÍCH CHI TIẾT VỀ VÙNG BIÊN VÀ USECASE TEST */}
              <div 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                  gap: '12px',
                  background: 'rgba(255,255,255,0.01)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  padding: '14px',
                  borderRadius: '6px',
                  marginTop: '8px'
                }}
              >
                <div>
                  <h4 style={{ fontSize: '12.5px', color: 'var(--color-teal)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📏 Giá Trị Vùng Biên (Boundary Value) Là Gì?
                  </h4>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                    Giá trị biên là ranh giới phân cách giữa miền dữ liệu <b>Hợp lệ (Valid)</b> và <b>Không hợp lệ (Invalid)</b>. 
                    Ví dụ, nếu yêu cầu tuổi từ 18-100:
                    <br />
                    - <b>Biên hợp lệ (Valid Boundary):</b> Đúng 18, đúng 100. Hệ thống <b>phải chấp nhận</b> và xử lý đúng dữ liệu.
                    <br />
                    - <b>Biên lỗi (Invalid Boundary):</b> 17 (dưới biên Min), 101 (vượt biên Max). Hệ thống <b>phải từ chối</b> và trả lỗi validation chính xác.
                    <br />
                    <i>Lập trình viên rất dễ viết nhầm toán tử so sánh (nhầm <code>&gt;</code> thành <code>&gt;=</code>), do đó kiểm thử biên giúp bắt các lỗi này hiệu quả nhất.</i>
                  </p>
                </div>
                
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '12px' }}>
                  <h4 style={{ fontSize: '12.5px', color: 'var(--color-violet)', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📋 Kiểm Thử Ca Sử Dụng (Usecase Test) Là Gì?
                  </h4>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                    Usecase Test là kỹ thuật thiết kế ca kiểm thử mô phỏng theo **hành trình nghiệp vụ thực tế** của người dùng (ví dụ: đăng ký tài khoản, thanh toán hóa đơn).
                    <br />
                    - Trong nền tảng này, mỗi Usecase được đại diện bằng văn bản nghiệp vụ thô (raw spec).
                    <br />
                    - AI sẽ phân tích văn bản này để trích xuất các trường dữ liệu và ràng buộc.
                    <br />
                    - Mỗi bản ghi được sinh ra ( Happy Path, Biên, hay Mã độc bảo mật) chính là các ca kiểm thử cụ thể (Test Cases) để <b>quét lỗi thực tế cho Usecase đó</b> khi tích hợp vào Automation Script (Playwright/Cypress).
                  </p>
                </div>
              </div>


              {/* INTERACTIVE COLOR CAPSULES PREVIEW */}
              {testMethod === 'bva' && (
                <div style={{ marginTop: '4px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', letterSpacing: '0.03em' }}>
                    🎯 CÁC ĐỘ DÀI/GIÁ TRỊ CẬN BIÊN BVA SẼ ĐƯỢC TẬP TRUNG SINH (BVA CAPSULES PREVIEW):
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {(boundaryCount === 2 ? [-1, 0] : boundaryCount === 3 ? [-1, 0, 1] : [-2, -1, 0, 1, 2]).map((offset, i) => {
                      const val = 8 + offset;
                      const isInvalid = val < 8;
                      const isExactBoundary = val === 8;
                      return (
                        <div
                          key={i}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            background: isInvalid
                              ? 'rgba(244, 63, 94, 0.08)'
                              : isExactBoundary
                                ? 'rgba(45, 212, 191, 0.12)'
                                : 'rgba(59, 130, 246, 0.06)',
                            border: '1px solid',
                            borderColor: isInvalid
                              ? 'rgba(244, 63, 94, 0.25)'
                              : isExactBoundary
                                ? 'rgba(45, 212, 191, 0.45)'
                                : 'rgba(59, 130, 246, 0.18)',
                            color: isInvalid
                              ? 'var(--color-rose)'
                              : isExactBoundary
                                ? 'var(--color-teal)'
                                : 'rgba(255, 255, 255, 0.8)',
                            fontSize: '11.5px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: isExactBoundary ? '0 0 10px rgba(45, 212, 191, 0.12)' : 'none'
                          }}
                        >
                          <span style={{ fontSize: '9px' }}>{isInvalid ? '🔴' : isExactBoundary ? '🎯' : '🟢'}</span>
                          <span>{val} {isInvalid ? '(Lỗi - Dưới biên)' : isExactBoundary ? '(Biên chuẩn Min)' : '(Hợp lệ)'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {testMethod === 'ep' && (
                <div style={{ marginTop: '4px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', letterSpacing: '0.03em' }}>
                    🎯 CÁC PHÂN VÙNG TƯƠNG ĐƯƠNG ĐẦU VÀO ĐƯỢC CHỌN MẪU (EP CAPSULES PREVIEW):
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Invalid partition 1 */}
                    <div style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      background: 'rgba(244, 63, 94, 0.08)',
                      border: '1px solid rgba(244, 63, 94, 0.25)',
                      color: 'var(--color-rose)',
                      fontSize: '11.5px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span style={{ fontSize: '9px' }}>🔴</span>
                      <span>&lt; 18 (Lỗi dưới)</span>
                    </div>

                    {/* Valid partitions */}
                    {Array.from({ length: partitionCount }, (_, i) => {
                      const step = (100 - 18) / partitionCount;
                      const start = Math.round(18 + i * step);
                      const end = Math.round(18 + (i + 1) * step) - (i === partitionCount - 1 ? 0 : 1);
                      return (
                        <div
                          key={i}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            background: 'rgba(45, 212, 191, 0.06)',
                            border: '1px solid rgba(45, 212, 191, 0.2)',
                            color: 'var(--color-teal)',
                            fontSize: '11.5px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <span style={{ fontSize: '9px' }}>🟢</span>
                          <span>Vùng {i + 1}: {start} - {end} (Hợp lệ)</span>
                        </div>
                      );
                    })}

                    {/* Invalid partition 2 */}
                    <div style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      background: 'rgba(244, 63, 94, 0.08)',
                      border: '1px solid rgba(244, 63, 94, 0.25)',
                      color: 'var(--color-rose)',
                      fontSize: '11.5px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span style={{ fontSize: '9px' }}>🔴</span>
                      <span>&gt; 100 (Lỗi trên)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Nút hành động áp dụng */}
          <div className="flex justify-between align-center" style={{ marginTop: '8px', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              * Sau khi chọn phương pháp, hãy bấm "Áp dụng" để thay thế dữ liệu F0 cũ.
            </span>
            <button
              onClick={handleRegenerateSeeds}
              disabled={isRegenerating}
              className={`btn btn-primary ${isRegenerating ? 'btn-disabled' : ''}`}
              style={{
                background: 'linear-gradient(135deg, var(--color-violet), var(--color-teal))',
                border: 'none',
                boxShadow: '0 4px 12px rgba(167, 139, 250, 0.25)',
                fontWeight: 'bold',
                padding: '10px 20px',
                fontSize: '13.5px'
              }}
            >
              {isRegenerating ? (
                <>
                  <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
                  Đang tái sinh F0 Seeds...
                </>
              ) : (
                <>
                  ⚙️ Áp dụng &amp; Sinh lại F0 Seeds
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 3. PHẦN DƯỚI: HIỂN THỊ DỮ LIỆU HẠT GIỐNG F0 (PREVIEW INITIAL SEEDS) */}
      {(isParsing || (initialSeeds && initialSeeds.length > 0)) && (
        <div className="glass-card flex flex-col gap-md violet-border" style={{ gridColumn: 'span 2', marginTop: '16px' }}>
          <div className="flex justify-between align-center" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div className="flex align-center gap-sm">
              <Database className="text-violet" size={24} style={{ color: 'var(--color-violet)' }} />
              <h2 style={{ fontSize: '18px', margin: 0 }}>Tập Dữ Liệu Hạt Giống F0 (Initial Seeds Dataset)</h2>
            </div>

            {/* Badge Hiển Thị Phương Pháp */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '20px',
              background: testMethod === 'bva' ? 'rgba(167, 139, 250, 0.15)' :
                testMethod === 'ep' ? 'rgba(59, 130, 246, 0.15)' :
                  testMethod === 'decision' ? 'rgba(244, 63, 94, 0.15)' :
                    'rgba(45, 212, 191, 0.15)',
              border: `1px solid ${testMethod === 'bva' ? 'var(--color-violet)' :
                testMethod === 'ep' ? '#3b82f6' :
                  testMethod === 'decision' ? 'var(--color-rose)' :
                    'var(--color-teal)'
                }`
            }}>
              <Zap size={14} style={{
                color:
                  testMethod === 'bva' ? 'var(--color-violet)' :
                    testMethod === 'ep' ? '#3b82f6' :
                      testMethod === 'decision' ? 'var(--color-rose)' :
                        'var(--color-teal)'
              }} />
              <span style={{
                fontSize: '12.5px', fontWeight: 'bold',
                color: testMethod === 'bva' ? 'var(--color-violet)' :
                  testMethod === 'ep' ? '#3b82f6' :
                    testMethod === 'decision' ? 'var(--color-rose)' :
                      'var(--color-teal)'
              }}>
                {testMethod === 'bva' ? `Phân Tích Biên (BVA) - ${boundaryCount} Điểm` :
                  testMethod === 'ep' ? 'Phân Vùng Tương Đương (EP)' :
                    testMethod === 'decision' ? 'Bảng Quyết Định' :
                      'Ngẫu Nhiên / Lai Ghép (Hybrid)'}
              </span>
            </div>
          </div>

          {/* Hộp Insight Box Đẹp Mắt */}
          <div style={{
            padding: '16px',
            background: 'rgba(15, 23, 42, 0.6)',
            borderLeft: `4px solid ${testMethod === 'bva' ? 'var(--color-violet)' :
              testMethod === 'ep' ? '#3b82f6' :
                testMethod === 'decision' ? 'var(--color-rose)' :
                  'var(--color-teal)'
              }`,
            borderRadius: '4px 8px 8px 4px',
            marginTop: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <div style={{ color: '#fff', fontSize: '13.5px', lineHeight: '1.6' }}>
              {testMethod === 'bva' ? (
                <>
                  <span style={{ color: 'var(--color-violet)', fontWeight: 'bold' }}>Chiến lược AI đang áp dụng:</span> Hệ thống đang tự động trích xuất các ranh giới từ đặc tả và sinh ra các ca kiểm thử nhắm chính xác vào cấu hình <b>{boundaryCount} điểm biên</b>. Các giá trị được chọn tập trung vào vùng rủi ro cao nhất: <code style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{boundaryCount === 2 ? '(Min, Max)' : boundaryCount === 3 ? '(Min-1, Min, Max)' : '(Min-1, Min, Min+1, Max-1, Max, Max+1)'}</code>.
                </>
              ) : testMethod === 'ep' ? (
                <>
                  <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>Chiến lược AI đang áp dụng:</span> Hệ thống đang phân tích không gian dữ liệu đầu vào và chia thành các vùng đại diện hợp lệ/không hợp lệ. Thay vì vét cạn toàn bộ, AI lấy ngẫu nhiên 1-2 mẫu đặc trưng từ mỗi vùng để đảm bảo độ bao phủ với số lượng tối thiểu.
                </>
              ) : testMethod === 'decision' ? (
                <>
                  <span style={{ color: 'var(--color-rose)', fontWeight: 'bold' }}>Chiến lược AI đang áp dụng:</span> AI đang lập ma trận các điều kiện nghiệp vụ để tìm ra mọi tổ hợp chéo (Cross-Conditions). Các ca test được sinh ra sẽ quét qua mọi kịch bản rẽ nhánh IF/ELSE phức tạp nhằm phát hiện lỗ hổng logic.
                </>
              ) : (
                <>
                  <span style={{ color: 'var(--color-teal)', fontWeight: 'bold' }}>Chiến lược AI đang áp dụng:</span> Phương pháp lai ghép đa dạng (Hybrid). Trộn lẫn các ca test thông thường (Happy Path), một số điểm lỗi ngẫu nhiên và chèn các kịch bản tấn công (SQLi, XSS) để mô phỏng một luồng dữ liệu tự nhiên nhất.
                </>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              <Sparkles size={16} style={{ color: 'var(--color-teal)', flexShrink: 0, marginTop: '2px' }} />
              <i>Dữ liệu này đóng vai trò là <b>"Hạt giống F0"</b>, sẽ được đưa vào bộ Tiến Hóa Di Truyền (GA) ở bước tiếp theo để lai ghép và đột biến ra hàng ngàn bộ dữ liệu tối ưu hơn.</i>
            </div>
          </div>

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

              {/* Nút bấm AI Đánh Giá và Chuyển bước */}
              <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Khu vực Evaluation Result */}
                {isEvaluating ? (
                  <div style={{ padding: '24px', background: 'rgba(167, 139, 250, 0.05)', borderRadius: '8px', border: '1px solid rgba(167, 139, 250, 0.2)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="status-dot-pulse" style={{ width: '12px', height: '12px', background: 'var(--color-violet)', borderRadius: '50%' }} />
                    <span style={{ color: 'var(--color-violet)', fontSize: '14px', fontWeight: '500' }}>Chuyên gia AI đang phân tích dữ liệu hạt giống F0... Vui lòng đợi trong giây lát!</span>
                  </div>
                ) : evaluationResult ? (
                  <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--color-violet)', background: 'linear-gradient(90deg, rgba(167, 139, 250, 0.08) 0%, rgba(15, 23, 42, 0) 100%)' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--color-violet)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BrainCircuit size={20} />
                      Báo Cáo Đánh Giá Chất Lượng Test Case
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div>
                        <div style={{ marginBottom: '16px' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Điểm Tối Ưu Tổng Quan</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                            <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%',
                                width: `${evaluationResult.score}%`,
                                background: evaluationResult.score >= 80 ? 'var(--color-teal)' : evaluationResult.score >= 50 ? 'var(--color-yellow)' : 'var(--color-rose)'
                              }} />
                            </div>
                            <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#fff' }}>{evaluationResult.score}/100</span>
                          </div>
                        </div>

                        <div>
                          <span style={{ fontSize: '13px', color: 'var(--color-teal)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                            <CheckCircle size={14} /> Điểm mạnh
                          </span>
                          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.6' }}>
                            {evaluationResult.strengths.map((s, i) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                      </div>

                      <div>
                        <div style={{ marginBottom: '16px' }}>
                          <span style={{ fontSize: '13px', color: 'var(--color-rose)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                            <Trash2 size={14} /> Điểm yếu / Cần cải thiện
                          </span>
                          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.6' }}>
                            {evaluationResult.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                          </ul>
                        </div>

                        <div>
                          <span style={{ fontSize: '13px', color: 'var(--color-yellow)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                            <Sparkles size={14} /> Trường hợp có thể thiếu sót
                          </span>
                          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.6' }}>
                            {evaluationResult.missing_cases.map((m, i) => <li key={i}>{m}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Khối Nút Bấm */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    onClick={() => handleEvaluateSeeds(testMethod)}
                    disabled={isEvaluating}
                    className="btn"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: isEvaluating ? 'not-allowed' : 'pointer',
                      background: 'rgba(167, 139, 250, 0.08)', color: 'var(--color-violet)', border: '1px solid rgba(167, 139, 250, 0.25)', borderRadius: '8px',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseOver={e => {
                      if (!isEvaluating) {
                        e.currentTarget.style.background = 'rgba(167, 139, 250, 0.16)';
                        e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.45)';
                      }
                    }}
                    onMouseOut={e => {
                      if (!isEvaluating) {
                        e.currentTarget.style.background = 'rgba(167, 139, 250, 0.08)';
                        e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.25)';
                      }
                    }}
                  >
                    <BrainCircuit size={15} />
                    ✨ Nhờ AI Đánh Giá (Review Hạt Giống F0)
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
    
      {/* --- MODAL LỊCH SỬ ĐẶC TẢ --- */}
      {isHistoryModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="glass-card" style={{
            width: '80%', maxWidth: '800px', maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
            background: 'var(--color-bg)',
            border: '1px solid rgba(45, 212, 191, 0.3)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: 'var(--color-teal)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={24} /> {selectedHistoryItem ? 'Chi tiết Đặc tả' : 'Lịch sử Đặc tả đã phân tích'}
              </h2>
              <button onClick={() => { setIsHistoryModalOpen(false); setSelectedHistoryItem(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
            </div>
            
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {selectedHistoryItem ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* DETAIL VIEW */}
                  <div>
                    <h3 style={{ fontSize: '14px', color: 'var(--color-teal)', marginBottom: '8px' }}>1. Yêu cầu nghiệp vụ (Business Requirements)</h3>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', fontSize: '13px', color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                      {selectedHistoryItem.raw_text}
                    </div>
                  </div>
                  
                  <div>
                    <h3 style={{ fontSize: '14px', color: 'var(--color-yellow)', marginBottom: '8px' }}>2. Ràng buộc miền giá trị (Domain Constraints)</h3>
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <th style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Trường (Field)</th>
                            <th style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Kiểu (Type)</th>
                            <th style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Bắt buộc</th>
                            <th style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Ràng buộc (Constraints)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedHistoryItem.fields?.map((field: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '10px 12px', color: 'var(--color-yellow)' }}>{field.name}</td>
                              <td style={{ padding: '10px 12px', color: 'var(--color-teal)' }}>{field.type}</td>
                              <td style={{ padding: '10px 12px' }}>{field.required ? '✅ Có' : '❌ Không'}</td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                                {Array.isArray(field.constraints) ? field.constraints.join(', ') : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 style={{ fontSize: '14px', color: 'var(--color-violet)', marginBottom: '8px' }}>3. Dữ liệu kiểm thử ban đầu (Test Data)</h3>
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', overflowX: 'auto', maxHeight: '250px', overflowY: 'auto' }}>
                      {selectedHistoryItem.initialPopulation && selectedHistoryItem.initialPopulation.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                          <thead style={{ position: 'sticky', top: 0, background: 'rgba(15, 23, 42, 0.95)', zIndex: 1 }}>
                            <tr>
                              <th style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-violet)' }}>#</th>
                              {selectedHistoryItem.fields?.map((f: any) => (
                                <th key={f.name} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-violet)' }}>{f.name}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {selectedHistoryItem.initialPopulation.map((seed: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                {selectedHistoryItem.fields?.map((f: any) => (
                                  <td key={f.name} style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>
                                    {typeof seed[f.name] === 'object' ? JSON.stringify(seed[f.name]) : String(seed[f.name] ?? '')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Không có dữ liệu mầm.</div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                    <button onClick={() => setSelectedHistoryItem(null)} className="btn" style={{ background: 'transparent', border: '1px solid var(--text-muted)', color: 'var(--text-primary)' }}>
                      ⬅️ Quay lại
                    </button>
                    <button onClick={() => downloadHistoryJson(selectedHistoryItem)} className="btn" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#3b82f6' }}>
                      ⬇️ Tải xuống JSON
                    </button>
                    <button onClick={() => {
                      handleHistorySelect(selectedHistoryItem);
                      setIsHistoryModalOpen(false);
                      setSelectedHistoryItem(null);
                    }} className="btn btn-primary glow-teal" style={{ background: 'var(--color-teal)', border: 'none', color: '#000' }}>
                      🚀 Nạp vào Editor
                    </button>
                  </div>
                </div>
              ) : isFetchingHistory ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Đang tải lịch sử...</div>
              ) : specificationHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Chưa có lịch sử nào được lưu.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {specificationHistory.map((item: any) => (
                    <div key={item.id} className="glass-card flex align-center" style={{
                      padding: '16px',
                      border: '1px solid rgba(255,255,255,0.05)',
                      transition: 'all 0.2s ease',
                      justifyContent: 'space-between'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-teal)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}>
                      <div style={{ flex: 1, marginRight: '16px' }}>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                            {new Date(item.created_at).toLocaleString('vi-VN')}
                          </span>
                          <span style={{ color: 'var(--color-teal)', fontSize: '12px', background: 'rgba(45,212,191,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                            {item.fields.length} trường
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {item.raw_text}
                        </p>
                      </div>
                      <button onClick={() => setSelectedHistoryItem(item)} className="btn" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', padding: '8px 16px', color: '#fff', fontSize: '13px' }}>
                        👁️ Xem chi tiết
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

