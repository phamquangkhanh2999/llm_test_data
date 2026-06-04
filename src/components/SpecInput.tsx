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
    setIsParsing,
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
    handleHistorySelect,
    setSpecificationId,
    setSchemaName,
    setOptimizedDataset,
    handleClearSpecData,
    methodSeeds,
    setMethodSeeds
  } = useAppStore();

  const hasApiKey = apiKey.trim().length > 10;

  // --- CÁC HOOK HOẠT ĐỘNG PHẠM VI NỘI BỘ COMPONENT ---
  // Theo dõi ID của mẫu preset đang được lựa chọn (Mặc định: trống)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
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

  // State quản lý việc buộc AI phân tích lại (Bypass cache)
  const [forceReanalyze, setForceReanalyze] = useState(false);

  // States to control collapsible UI elements
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [showSchemaDetails, setShowSchemaDetails] = useState(false);

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
  // Chọn các thuật toán sinh dữ liệu ban đầu (Hỗ trợ chọn nhiều phương pháp đồng thời)
  const [selectedMethods, setSelectedMethods] = useState<('random' | 'bva' | 'ep' | 'decision')[]>(['random']);
  // Cấu hình số lượng điểm biên (dành riêng cho phương pháp BVA: 2, 3 hoặc 5 điểm)
  const [boundaryCount, setBoundaryCount] = useState<number>(3);
  // Cấu hình số lượng phân vùng tương đương (dành riêng cho phương pháp EP)
  const [partitionCount, setPartitionCount] = useState<number>(3);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);

  const toggleMethod = (method: 'random' | 'bva' | 'ep' | 'decision') => {
    setSelectedMethods(prev => {
      if (prev.includes(method)) {
        if (prev.length === 1) return prev; // Đảm bảo luôn chọn ít nhất 1 phương pháp
        return prev.filter(m => m !== method);
      } else {
        return [...prev, method];
      }
    });
  };

  const handleRegenerateSeedsOnly = async () => {
    if (!parsedSchema || parsedSchema.length === 0) return;
    if (selectedMethods.length === 0) {
      alert("Vui lòng chọn ít nhất một phương pháp thiết kế ca kiểm thử để sinh F0!");
      return;
    }
    setIsRegenerating(true);
    try {
      const results = [];
      for (const method of selectedMethods) {
        const response = await fetch("http://localhost:8000/api/generate-seeds", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fields: parsedSchema,
            test_method: method,
            boundary_count: boundaryCount,
            partition_count: partitionCount,
            api_key_override: apiKey ? apiKey.trim() : null,
            raw_text: rawText
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Không thể sinh hạt giống bằng phương pháp ${method}`);
        }

        const data = await response.json();
        results.push({
          method,
          population: data.initialPopulation || [],
          isMock: data.is_mock || false
        });

        // Nghỉ ngắn 250ms giữa các lần gọi nếu chọn nhiều phương pháp
        if (selectedMethods.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }

      // Cập nhật store methodSeeds cho từng phương pháp
      const newMethodSeeds: Record<string, any[]> = {
        random: [],
        bva: [],
        ep: [],
        decision: []
      };
      results.forEach(r => {
        newMethodSeeds[r.method] = r.population;
      });
      setMethodSeeds(newMethodSeeds);

      const populations = results.map(r => r.population);
      
      // Gộp và loại bỏ trùng lặp tuyệt đối
      const seen = new Set<string>();
      const combinedSeeds: any[] = [];
      populations.flat().forEach((item) => {
        const sortedObj = Object.keys(item).sort().reduce((acc, key) => {
          acc[key] = item[key];
          return acc;
        }, {} as any);
        const str = JSON.stringify(sortedObj);
        if (!seen.has(str)) {
          seen.add(str);
          combinedSeeds.push(item);
        }
      });

      setInitialSeeds(combinedSeeds);
    } catch (e: any) {
      console.error("Lỗi khi tái sinh F0:", e);
      alert(e.message || "Lỗi khi tái sinh F0");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleParseAndGenerateSeeds = async () => {
    if (!rawText.trim()) return;
    if (selectedMethods.length === 0) {
      alert("Vui lòng chọn ít nhất một phương pháp thiết kế ca kiểm thử để sinh F0!");
      return;
    }
    setIsParsing(true);
    try {
      // 1. Phân tích đặc tả bóc tách Schema
      const response = await fetch("http://localhost:8000/api/specifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          raw_text: rawText,
          api_key_override: apiKey ? apiKey.trim() : null,
          force_reanalyze: forceReanalyze
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Không thể kết nối với Backend Server!");
      }

      const res = await response.json();
      
      setParsedSchema(res.fields);
      setSpecificationId(res.specification_id);
      setSchemaName(rawText.substring(0, 25) + (rawText.length > 25 ? '...' : ''));
      setOptimizedDataset([]);

      // 2. Gọi tuần tự sinh hạt giống F0 cho các phương pháp đã chọn (tránh lỗi Rate Limit 429)
      const results = [];
      
      // Tái sử dụng hạt giống F0 được sinh ra trực tiếp từ bước Phân tích đặc tả cho phương pháp 'random'
      // Việc này giúp tránh gọi LLM hai lần liên tục, tiết kiệm tối đa lượng token tiêu thụ.
      if (selectedMethods.includes('random')) {
        results.push({
          method: 'random',
          population: res.initialPopulation || [],
          isMock: res.is_mock || false
        });
      }

      const otherMethods = selectedMethods.filter(method => method !== 'random');
      for (const method of otherMethods) {
        const response = await fetch("http://localhost:8000/api/generate-seeds", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fields: res.fields,
            test_method: method,
            boundary_count: boundaryCount,
            partition_count: partitionCount,
            api_key_override: apiKey ? apiKey.trim() : null,
            raw_text: rawText
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Không thể sinh hạt giống bằng phương pháp ${method}`);
        }

        const data = await response.json();
        results.push({
          method,
          population: data.initialPopulation || [],
          isMock: data.is_mock || false
        });

        // Nghỉ ngắn 250ms giữa các lần gọi nếu chọn nhiều phương pháp
        if (otherMethods.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }

      const isAnyMock = results.some(r => r.isMock);

      // Cập nhật local state methodSeeds cho từng phương pháp
      const newMethodSeeds: Record<string, any[]> = {
        random: [],
        bva: [],
        ep: [],
        decision: []
      };
      results.forEach(r => {
        newMethodSeeds[r.method] = r.population;
      });
      setMethodSeeds(newMethodSeeds);

      const populations = results.map(r => r.population);

      // Gộp và loại bỏ trùng lặp tuyệt đối để có tập F0 chuẩn hóa tối ưu nhất
      const seen = new Set<string>();
      const combinedSeeds: any[] = [];
      populations.flat().forEach((item) => {
        const sortedObj = Object.keys(item).sort().reduce((acc, key) => {
          acc[key] = item[key];
          return acc;
        }, {} as any);
        const str = JSON.stringify(sortedObj);
        if (!seen.has(str)) {
          seen.add(str);
          combinedSeeds.push(item);
        }
      });

      if (setInitialSeeds) {
        setInitialSeeds(combinedSeeds);
      }

      const methodNames = selectedMethods.map(m => 
        m === 'bva' ? 'BVA' : m === 'ep' ? 'EP' : m === 'decision' ? 'Bảng quyết định' : 'Ngẫu nhiên'
      ).join(', ');

      if (res.is_mock || isAnyMock) {
        alert(`⚠️ Cảnh báo: Chưa gán API Key (Gemini/OpenAI) hợp lệ!\n\nHệ thống đã sinh dữ liệu mẫu F0 ở chế độ OFFLINE bằng thuật toán cục bộ.\nĐã gộp và lọc sạch trùng lặp từ các phương pháp: ${methodNames}.\nNhận được tổng cộng ${combinedSeeds.length} ca test mầm cục bộ.\n\n(Vui lòng cấu hình API Key ở góc trên bên phải màn hình để thực hiện sinh bằng AI thật)`);
      } else if (res.reanalyzed) {
        alert(`Đã ép phân tích lại đặc tả bằng AI thành công (Bypass Cache)!\nTái sinh thành công ${combinedSeeds.length} ca test mầm F0 từ các phương pháp: ${methodNames}.`);
      } else if (res.cached) {
        alert(`Nạp dữ liệu phân tích đặc tả thành công (Lấy từ bộ nhớ cache hệ thống)!\nTái sinh thành công ${combinedSeeds.length} ca test mầm F0 từ các phương pháp: ${methodNames}.`);
      } else {
        alert(`Phân tích đặc tả & Sinh tập hạt giống F0 thành công bằng AI!\n\nĐã gộp và lọc sạch trùng lặp từ các phương pháp: ${methodNames}.\nNhận được tổng cộng ${combinedSeeds.length} ca test mầm chuẩn nhất.`);
      }

    } catch (e: any) {
      console.error(e);
      alert(`Đã xảy ra lỗi kết nối: ${e.message || "Hãy đảm bảo FastAPI Backend đang chạy ở cổng 8000!"}`);
    } finally {
      setIsParsing(false);
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
    setMethodSeeds({
      random: [],
      bva: [],
      ep: [],
      decision: []
    });
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

  const getFieldBoundaryExplanation = (field: FieldConstraint) => {
    const isNum = field.type === 'number';
    
    if (isNum) {
      const min = field.minValue;
      const max = field.maxValue;
      if (min === undefined && max === undefined) return null;
      
      const bvaPoints: { val: number; label: string; valid: boolean }[] = [];
      const epRanges: string[] = [];
      
      // Tính toán các điểm BVA
      if (min !== undefined) {
        bvaPoints.push({ val: min - 1, label: `Dưới cận dưới (Min-1)`, valid: false });
        bvaPoints.push({ val: min, label: `Cận dưới (Min)`, valid: true });
        bvaPoints.push({ val: min + 1, label: `Sát trên cận dưới (Min+1)`, valid: true });
      }
      if (max !== undefined) {
        bvaPoints.push({ val: max - 1, label: `Sát dưới cận trên (Max-1)`, valid: true });
        bvaPoints.push({ val: max, label: `Cận trên (Max)`, valid: true });
        bvaPoints.push({ val: max + 1, label: `Vượt cận trên (Max+1)`, valid: false });
      }
      
      // Tính toán phân vùng EP
      if (min !== undefined && max !== undefined) {
        epRanges.push(`<${min} (Lỗi 🔴)`);
        const step = (max - min) / Math.max(1, partitionCount);
        for (let i = 0; i < partitionCount; i++) {
          const start = Math.round(min + i * step);
          const end = Math.round(min + (i + 1) * step) - (i === partitionCount - 1 ? 0 : 1);
          epRanges.push(`${start}-${end} (Hợp lệ 🟢)`);
        }
        epRanges.push(`>${max} (Lỗi 🔴)`);
      } else if (min !== undefined) {
        epRanges.push(`<${min} (Lỗi 🔴)`);
        epRanges.push(`>=${min} (Hợp lệ 🟢)`);
      } else if (max !== undefined) {
        epRanges.push(`<=${max} (Hợp lệ 🟢)`);
        epRanges.push(`>${max} (Lỗi 🔴)`);
      }
      
      return { bvaPoints, epRanges };
    } else {
      // Giới hạn độ dài chuỗi
      const min = field.minLength;
      const max = field.maxLength;
      if (min === undefined && max === undefined) return null;
      
      const bvaPoints: { val: number; label: string; valid: boolean }[] = [];
      const epRanges: string[] = [];
      
      if (min !== undefined) {
        if (min - 1 >= 0) {
          bvaPoints.push({ val: min - 1, label: `Độ dài thiếu (Min-1)`, valid: false });
        }
        bvaPoints.push({ val: min, label: `Độ dài tối thiểu (Min)`, valid: true });
        bvaPoints.push({ val: min + 1, label: `Độ dài tối thiểu + 1 (Min+1)`, valid: true });
      }
      if (max !== undefined) {
        bvaPoints.push({ val: max - 1, label: `Độ dài tối đa - 1 (Max-1)`, valid: true });
        bvaPoints.push({ val: max, label: `Độ dài tối đa (Max)`, valid: true });
        bvaPoints.push({ val: max + 1, label: `Độ dài vượt giới hạn (Max+1)`, valid: false });
      }
      
      if (min !== undefined && max !== undefined) {
        epRanges.push(`<${min} ký tự (Lỗi 🔴)`);
        const step = (max - min) / Math.max(1, partitionCount);
        for (let i = 0; i < partitionCount; i++) {
          const start = Math.round(min + i * step);
          const end = Math.round(min + (i + 1) * step) - (i === partitionCount - 1 ? 0 : 1);
          epRanges.push(`${start}-${end} ký tự (Hợp lệ 🟢)`);
        }
        epRanges.push(`>${max} ký tự (Lỗi 🔴)`);
      } else if (min !== undefined) {
        epRanges.push(`<${min} ký tự (Lỗi 🔴)`);
        epRanges.push(`>=${min} ký tự (Hợp lệ 🟢)`);
      } else if (max !== undefined) {
        epRanges.push(`<=${max} ký tự (Hợp lệ 🟢)`);
        epRanges.push(`>${max} ký tự (Lỗi 🔴)`);
      }
      
      return { bvaPoints, epRanges };
    }
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
      <div className={showSchemaDetails ? "grid-2" : (initialSeeds && initialSeeds.length > 0) ? "max-w-5xl mx-auto w-full" : "max-w-3xl mx-auto w-full"}>
        {/* 1. CỘT BÊN TRÁI: KHU VỰC NHẬP VĂN BẢN ĐẶC TẢ NGỮ NGHĨA VÀ CHỌN PRESETS */}
      <div className="glass-card flex flex-col gap-md teal-border glow-teal">
        <div className="flex align-center gap-sm">
          <FileText className="text-teal" size={24} style={{ color: 'var(--color-teal)' }} />
          <h2>ĐẶC TẢ &amp; PHƯƠNG PHÁP SINH HẠT GIỐNG</h2>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Mô tả yêu cầu nghiệp vụ của bạn bằng ngôn ngữ tự nhiên — AI sẽ tự động trích xuất các trường dữ liệu và ràng buộc miền giá trị.
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

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%' }}>
            <select
              value={selectedPresetId}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setSelectedPresetId('');
                  setRawText('');
                  handleClearSpecData();
                  setMethodSeeds({
                    random: [],
                    bva: [],
                    ep: [],
                    decision: []
                  });
                  setIsConnected(false);
                  setProcessingStep(0);
                  return;
                }
                const preset = PRESETS.find(p => p.id === val);
                if (preset) onPresetClick(preset);
              }}
              className="input-field"
              style={{ flex: 1, fontSize: '13.5px', cursor: 'pointer', padding: '8px 12px' }}
            >
              <option value="">— Chọn đặc tả mẫu (Presets) —</option>
              {PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.title}
                </option>
              ))}
            </select>
            
            <button
              onClick={() => {
                fetchSpecificationHistory();
                setIsHistoryModalOpen(true);
              }}
              className="btn btn-secondary"
              style={{ fontSize: '13px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
            >
              🕰️ Lịch sử Đặc tả
            </button>
          </div>
        </div>


        {/* Vùng nhập đặc tả nghiệp vụ tự do */}
        <textarea
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
            setSelectedPresetId('');
            handleClearSpecData();
            setMethodSeeds({
              random: [],
              bva: [],
              ep: [],
              decision: []
            });
            setIsConnected(false);
            setProcessingStep(0);
          }}
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

        {/* THANH ĐIỀU KHIỂN TINH GỌN (CONTROL TOOLBAR) */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '12px', width: '100%', flexWrap: 'wrap' }}>
          {/* Nút Cấu hình sinh hạt giống */}
          <button
            onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '13px', padding: '9px 14px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            ⚙️ {showAdvancedConfig ? 'Ẩn Cấu Hình' : 'Cấu Hình Sinh'}
          </button>

          {/* Nút Tinh Chỉnh Ràng Buộc Schema */}
          {parsedSchema.length > 0 && (
            <button
              onClick={() => setShowSchemaDetails(!showSchemaDetails)}
              type="button"
              className="btn btn-secondary"
              style={{
                fontSize: '13px',
                padding: '9px 14px',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: showSchemaDetails ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.03)',
                borderColor: showSchemaDetails ? 'var(--color-violet)' : 'rgba(255,255,255,0.08)',
                color: showSchemaDetails ? 'var(--color-violet)' : 'var(--text-secondary)'
              }}
            >
              🔧 {showSchemaDetails ? 'Ẩn Sơ Đồ' : 'Tinh Chỉnh Ràng Buộc'}
            </button>
          )}

          {/* Nút Xóa Trắng */}
          {rawText.trim().length > 0 && (
            <button
              onClick={() => {
                setRawText('');
                setSelectedPresetId('');
                handleClearSpecData();
                setMethodSeeds({
                  random: [],
                  bva: [],
                  ep: [],
                  decision: []
                });
                setIsConnected(false);
                setProcessingStep(0);
              }}
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '13px', padding: '9px 14px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-rose)', borderColor: 'rgba(244,63,94,0.15)' }}
            >
              Clean 🧹
            </button>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Checkbox Bypass Cache */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }} title="Buộc AI phân tích lại đặc tả (Bypass Cache hệ thống)">
            <input
              type="checkbox"
              checked={forceReanalyze}
              onChange={(e) => setForceReanalyze(e.target.checked)}
              style={{ width: '14px', height: '14px', accentColor: 'var(--color-teal)', cursor: 'pointer' }}
            />
            <span>Bypass Cache</span>
          </label>

          {/* Nút Tái Sinh F0 (chỉ hiện khi đã có Schema được bóc tách) */}
          {parsedSchema.length > 0 && (
            <button
              onClick={handleRegenerateSeedsOnly}
              disabled={isRegenerating || isParsing}
              type="button"
              className="btn btn-secondary"
              style={{
                padding: '9px 16px',
                whiteSpace: 'nowrap',
                color: 'var(--color-teal)',
                borderColor: 'rgba(45,212,191,0.25)',
                background: 'rgba(45,212,191,0.03)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px'
              }}
            >
              {isRegenerating ? (
                <>
                  <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'var(--color-teal)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
                  Đang Tái Sinh...
                </>
              ) : (
                <>
                  <Zap size={14} style={{ color: 'var(--color-teal)' }} />
                  Tái Sinh F0
                </>
              )}
            </button>
          )}

          {/* Nút Phân Tích & Sinh F0 */}
          <button
            onClick={handleParseAndGenerateSeeds}
            disabled={isParsing || !rawText.trim()}
            className={`btn btn-primary ${isParsing || !rawText.trim() ? 'btn-disabled' : ''}`}
            style={{ padding: '9px 20px', whiteSpace: 'nowrap' }}
          >
            {isParsing ? (
              <>
                <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.9s linear infinite', marginRight: '6px' }} />
                Đang Phân Tích...
              </>
            ) : (
              <>
                <Sparkles size={15} />
                {parsedSchema.length > 0 ? 'Phân Tích Lại' : 'Phân Tích & Sinh F0'}
              </>
            )}
          </button>
        </div>

        {/* CẤU HÌNH PHƯƠNG PHÁP KIỂM THỬ KHỞI TẠO (F0 SEEDS) */}
        {showAdvancedConfig && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginTop: '12px',
            padding: '14px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '10px'
          }}>
            <span style={{
              fontSize: '12px',
              fontWeight: 'bold',
              color: 'var(--color-teal)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              ⚙️ Cấu hình phương pháp sinh F0 Seeds
            </span>

            {/* Phương pháp check boxes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedMethods.includes('random')}
                  onChange={() => toggleMethod('random')}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--color-teal)' }}
                />
                <span>Ngẫu Nhiên / Lai Ghép</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedMethods.includes('bva')}
                  onChange={() => toggleMethod('bva')}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--color-teal)' }}
                />
                <span>Phân Tích Biên (BVA)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedMethods.includes('ep')}
                  onChange={() => toggleMethod('ep')}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--color-teal)' }}
                />
                <span>Phân Vùng Tương Đương (EP)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedMethods.includes('decision')}
                  onChange={() => toggleMethod('decision')}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--color-teal)' }}
                />
                <span>Bảng Quyết Định</span>
              </label>
            </div>

            {/* Cấu hình bổ sung cho BVA (nếu được chọn) */}
            {selectedMethods.includes('bva') && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '8px 10px',
                background: 'rgba(45, 212, 191, 0.04)',
                borderLeft: '2px solid var(--color-teal)',
                borderRadius: '4px',
                marginTop: '4px'
              }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Số điểm biên cần kiểm tra (BVA):
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[2, 3, 5].map((num) => (
                    <button
                      key={num}
                      onClick={() => setBoundaryCount(num)}
                      type="button"
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        fontSize: '12px',
                        background: boundaryCount === num ? 'var(--color-teal)' : 'rgba(255,255,255,0.05)',
                        color: boundaryCount === num ? '#000' : 'var(--text-primary)',
                        border: 'none',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {num} biên
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Cấu hình bổ sung cho EP (nếu được chọn) */}
            {selectedMethods.includes('ep') && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '8px 10px',
                background: 'rgba(59, 130, 246, 0.04)',
                borderLeft: '2px solid #3b82f6',
                borderRadius: '4px',
                marginTop: '4px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span>Số phân vùng tương đương:</span>
                  <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{partitionCount} phân vùng</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="6"
                  value={partitionCount}
                  onChange={(e) => setPartitionCount(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
                />
              </div>
            )}
          </div>
        )}

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        `}</style>
      </div>

      {/* 2. CỘT BÊN PHẢI: KHU VỰC CHỈNH SỬA SCHEMA RÀNG BUỘC CỦA ĐỒNG SÁNG LẬP */}
      {showSchemaDetails && (
        <div className="glass-card flex flex-col gap-md violet-border">
          <div className="flex align-center gap-sm">
            <FileJson className="text-yellow" size={24} style={{ color: 'var(--color-yellow)' }} />
            <h2>RÀNG BUỘC MIỀN GIÁ TRỊ (EXTRACTED SCHEMA)</h2>
          </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Xem và tinh chỉnh lại các ràng buộc miền giá trị (Domain Constraints) mà AI đã bóc tách từ yêu cầu nghiệp vụ.
        </p>

        {/* Danh sách cuộn mượt các trường dữ liệu */}
        <div className="flex flex-col gap-sm" style={{ maxHeight: '480px', overflowY: 'auto', paddingRight: '4px', margin: '8px 0' }}>
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
                className="flex align-start gap-sm"
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

                  {/* Bảng giải thích chi tiết BVA/EP cho từng trường */}
                  {(() => {
                    const explanation = getFieldBoundaryExplanation(field);
                    if (!explanation) return null;
                    const { bvaPoints, epRanges } = explanation;
                    return (
                      <div style={{
                        marginTop: '8px',
                        padding: '10px',
                        background: 'rgba(15, 23, 42, 0.4)',
                        borderLeft: '3px solid var(--color-teal)',
                        borderRadius: '4px',
                        fontSize: '11px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div>
                            <span style={{ color: 'var(--color-teal)', fontWeight: 'bold' }}>📏 Giá trị biên (BVA): </span>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                              {bvaPoints.map((pt: { val: number | string; label: string; valid: boolean }, pIdx: number) => (
                                <span key={pIdx} style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: pt.valid ? 'rgba(45, 212, 191, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                                  border: `1px solid ${pt.valid ? 'rgba(45, 212, 191, 0.25)' : 'rgba(244, 63, 94, 0.25)'}`,
                                  color: pt.valid ? 'var(--color-teal)' : 'var(--color-rose)'
                                }}>
                                  <code>{pt.val}</code> ({pt.label})
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span style={{ color: 'var(--color-yellow)', fontWeight: 'bold' }}>📊 Phân vùng tương đương (EP): </span>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                              {epRanges.map((range: string, rIdx: number) => (
                                <span key={rIdx} style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: 'rgba(255, 255, 255, 0.03)',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  color: 'var(--text-secondary)'
                                }}>
                                  {range}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Nút xóa bỏ trường kiểm thử này */}
                <button
                  onClick={() => handleRemoveField(idx)}
                  className="btn btn-secondary"
                  style={{ padding: '8px', color: 'var(--color-rose)', borderColor: 'rgba(244,63,94,0.1)', marginTop: '2px' }}
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
      )}



      {/* 3. PHẦN DƯỚI: HIỂN THỊ DỮ LIỆU HẠT GIỐNG F0 (PREVIEW INITIAL SEEDS) */}
      {(isParsing || (initialSeeds && initialSeeds.length > 0)) && (
        <div className="glass-card flex flex-col gap-md violet-border glow-violet" style={{ gridColumn: showSchemaDetails ? 'span 2' : 'span 1', marginTop: '20px' }}>
          <div className="flex justify-between align-center" style={{ flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '14px', marginBottom: '10px' }}>
            <div className="flex flex-col gap-xs">
              <div className="flex align-center gap-sm">
                <Database className="text-violet" size={20} style={{ color: 'var(--color-violet)' }} />
                <h2 style={{ fontSize: '16px', margin: 0 }}>DANH SÁCH TẬP HẠT GIỐNG F0 (INITIAL SEEDS)</h2>
              </div>
              {parsedSchema.length > 0 && (
                <span style={{ fontSize: '12px', color: 'var(--color-teal)', fontWeight: '500', marginLeft: '26px' }}>
                  ✓ Đã bóc tách {parsedSchema.length} trường &amp; {initialSeeds.length} ca test mầm
                </span>
              )}
            </div>
            
            <div className="flex align-center gap-sm">
              {isRegenerating && (
                <span style={{ fontSize: '12px', color: 'var(--color-violet)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="status-dot-pulse" style={{ width: '6px', height: '6px', background: 'var(--color-violet)', borderRadius: '50%', display: 'inline-block' }} />
                  Đang cập nhật...
                </span>
              )}

            </div>
          </div>

          {/* Bảng giải thích chiến lược kiểm thử */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.4)',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            marginBottom: '10px'
          }}>
            <h3 style={{ fontSize: '14px', color: 'var(--color-teal)', margin: '0 0 12px 0', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} />
              GIẢI THÍCH CHIẾN LƯỢC KIỂM THỬ VÙNG BIÊN (BVA/EP) &amp; PHƯƠNG PHÁP SINH
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                <p style={{ margin: '0 0 8px 0' }}>
                  🎲 <b>Ngẫu nhiên / Lai Ghép (Hybrid):</b> Sinh dữ liệu thông thường kết hợp một số payloads lỗi và tấn công bảo mật để kiểm thử các lỗ hổng hệ thống.
                </p>
                <p style={{ margin: 0 }}>
                  📏 <b>Phân tích biên (BVA):</b> Sinh các giá trị tập trung sát ranh giới rủi ro cao (Min, Max, Min-1, Max+1...) vì đây là nơi lập trình viên dễ làm sai nhất.
                </p>
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                <p style={{ margin: '0 0 8px 0' }}>
                  📊 <b>Phân vùng tương đương (EP):</b> Chia miền giá trị thành các khoảng tương đương và lấy mẫu đại diện để tối ưu số ca test mà vẫn đảm bảo độ phủ.
                </p>
                <p style={{ margin: 0 }}>
                  📋 <b>Bảng quyết định (Logic Table):</b> Kết hợp logic các điều kiện nghiệp vụ nhằm tìm ra lỗ hổng trong cấu trúc điều kiện rẽ nhánh (IF/ELSE logic).
                </p>
              </div>
            </div>
          </div>

          {(isParsing || isRegenerating) ? (
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
                {isParsing 
                  ? 'AI đang làm việc... Đang trích xuất cấu trúc ràng buộc và tự động tạo tập dữ liệu hạt giống F0...'
                  : 'Đang tái sinh tập hạt giống F0 mới...'}
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
              {(() => {
                const hasMethodSeeds = Object.values(methodSeeds).some(arr => arr && arr.length > 0);
                if (!hasMethodSeeds && initialSeeds && initialSeeds.length > 0) {
                  // Hiển thị bảng gộp duy nhất (Ví dụ: khi nạp từ Lịch sử hoặc Preset mà chưa kịp tái sinh)
                  return (
                    <div className="glass-card" style={{ padding: '16px', border: `1px solid rgba(255,255,255,0.06)`, background: 'rgba(255,255,255,0.01)' }}>
                      <h3 style={{ fontSize: '14.5px', color: 'var(--color-violet)', margin: '0 0 12px 0', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Zap size={14} style={{ color: 'var(--color-violet)' }} />
                        Tập Dữ Liệu Hạt Giống F0 (Đã Nạp/Gộp) ({initialSeeds.length} hạt giống)
                      </h3>
                      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                              <th style={{ padding: '10px 16px', color: 'var(--text-muted)', width: '80px' }}>STT</th>
                              {parsedSchema.map((field) => (
                                <th key={field.name} style={{ padding: '10px 16px', color: 'var(--color-teal)', fontWeight: '600' }}>
                                  <div style={{ minWidth: '120px', maxWidth: '280px', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                    {field.name}
                                  </div>
                                </th>
                              ))}
                              <th style={{ padding: '10px 16px', color: 'var(--color-violet)', fontWeight: '600' }}>
                                <div style={{ minWidth: '150px', maxWidth: '300px', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                  Kết quả mong đợi
                                </div>
                              </th>
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
                                <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                                  <div style={{ minWidth: '80px' }}>F0 #{idx + 1}</div>
                                </td>
                                {parsedSchema.map((field) => {
                                  const value = seed[field.name];
                                  const valStr = value !== undefined ? String(value) : '-';
                                  const isAttack = valStr.toLowerCase().includes("' or") ||
                                    valStr.toLowerCase().includes("--") ||
                                    valStr.toLowerCase().includes("<script");

                                  return (
                                    <td
                                      key={field.name}
                                      style={{
                                        padding: '12px 16px',
                                        verticalAlign: 'top'
                                      }}
                                    >
                                      <div
                                        style={{
                                          color: isAttack ? 'var(--color-rose)' : 'var(--text-primary)',
                                          fontWeight: isAttack ? '600' : 'normal',
                                          fontFamily: field.type === 'number' || isAttack ? 'var(--font-mono)' : 'inherit',
                                          minWidth: '120px',
                                          maxWidth: '280px',
                                          maxHeight: '80px',
                                          overflowY: 'auto',
                                          wordBreak: 'break-word',
                                          whiteSpace: 'normal',
                                          paddingRight: '4px'
                                        }}
                                      >
                                        {valStr}
                                      </div>
                                    </td>
                                  );
                                })}
                                <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                                  <div
                                    style={{
                                      color: seed.expectedResult?.startsWith('Lỗi') ? 'var(--color-rose)' :
                                             seed.expectedResult?.startsWith('Chặn') ? 'var(--color-violet)' :
                                             'var(--color-teal)',
                                      fontWeight: '500',
                                      minWidth: '150px',
                                      maxWidth: '300px',
                                      maxHeight: '80px',
                                      overflowY: 'auto',
                                      wordBreak: 'break-word',
                                      whiteSpace: 'normal'
                                    }}
                                  >
                                    {seed.expectedResult || 'Hợp lệ'}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                }

                // Hiển thị từng bảng riêng biệt cho các phương pháp đang chọn
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {selectedMethods.map((method) => {
                      const seeds = methodSeeds[method] || [];
                      const methodName = method === 'bva' ? 'Phân Tích Biên (BVA)' :
                                         method === 'ep' ? 'Phân Vùng Tương Đương (EP)' :
                                         method === 'decision' ? 'Bảng Quyết Định (Decision Table)' :
                                         'Ngẫu Nhiên / Lai Ghép (Hybrid)';
                      
                      const methodColor = method === 'bva' ? 'var(--color-violet)' :
                                          method === 'ep' ? '#3b82f6' :
                                          method === 'decision' ? 'var(--color-rose)' :
                                          'var(--color-teal)';

                      return (
                        <div key={method} className="glass-card" style={{ padding: '16px', border: `1px solid rgba(255,255,255,0.06)`, background: 'rgba(255,255,255,0.01)' }}>
                          <h3 style={{ fontSize: '14.5px', color: methodColor, margin: '0 0 12px 0', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Zap size={14} style={{ color: methodColor }} />
                            {methodName} ({seeds.length} hạt giống)
                          </h3>

                          {seeds.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                              Đang tạo dữ liệu mầm cho phương pháp này...
                            </div>
                          ) : (
                            <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                <thead>
                                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                    <th style={{ padding: '8px 12px', color: 'var(--text-muted)', width: '70px' }}>STT</th>
                                    {parsedSchema.map((field) => (
                                      <th key={field.name} style={{ padding: '8px 12px', color: 'var(--color-teal)', fontWeight: '600' }}>
                                        <div style={{ minWidth: '120px', maxWidth: '280px', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                          {field.name}
                                        </div>
                                      </th>
                                    ))}
                                    <th style={{ padding: '8px 12px', color: 'var(--color-violet)', fontWeight: '600' }}>
                                      <div style={{ minWidth: '150px', maxWidth: '300px', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                        Kết quả mong đợi
                                      </div>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {seeds.map((seed, idx) => (
                                    <tr
                                      key={idx}
                                      style={{
                                        borderBottom: idx < seeds.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                        background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                                        transition: 'background 0.2s'
                                      }}
                                      className="table-row-hover"
                                    >
                                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                                        <div style={{ minWidth: '70px' }}>F0 #{idx + 1}</div>
                                      </td>
                                      {parsedSchema.map((field) => {
                                        const value = seed[field.name];
                                        const valStr = value !== undefined ? String(value) : '-';
                                        const isAttack = valStr.toLowerCase().includes("' or") ||
                                          valStr.toLowerCase().includes("--") ||
                                          valStr.toLowerCase().includes("<script");

                                        return (
                                          <td
                                            key={field.name}
                                            style={{
                                              padding: '10px 12px',
                                              verticalAlign: 'top'
                                            }}
                                          >
                                            <div
                                              style={{
                                                color: isAttack ? 'var(--color-rose)' : 'var(--text-primary)',
                                                fontWeight: isAttack ? '600' : 'normal',
                                                fontFamily: field.type === 'number' || isAttack ? 'var(--font-mono)' : 'inherit',
                                                minWidth: '120px',
                                                maxWidth: '280px',
                                                maxHeight: '80px',
                                                overflowY: 'auto',
                                                wordBreak: 'break-word',
                                                whiteSpace: 'normal',
                                                paddingRight: '4px'
                                              }}
                                            >
                                              {valStr}
                                            </div>
                                          </td>
                                        );
                                      })}
                                      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                                        <div
                                          style={{
                                            color: seed.expectedResult?.startsWith('Lỗi') ? 'var(--color-rose)' :
                                                   seed.expectedResult?.startsWith('Chặn') ? 'var(--color-violet)' :
                                                   'var(--color-teal)',
                                            fontWeight: '500',
                                            minWidth: '150px',
                                            maxWidth: '300px',
                                            maxHeight: '80px',
                                            overflowY: 'auto',
                                            wordBreak: 'break-word',
                                            whiteSpace: 'normal'
                                          }}
                                        >
                                          {seed.expectedResult || 'Hợp lệ'}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

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
                    onClick={() => handleEvaluateSeeds(selectedMethods.join(', '))}
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
                            <th style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}><div style={{ minWidth: '120px', maxWidth: '280px', wordBreak: 'break-word', whiteSpace: 'normal' }}>Trường (Field)</div></th>
                            <th style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}><div style={{ minWidth: '100px', maxWidth: '200px', wordBreak: 'break-word', whiteSpace: 'normal' }}>Kiểu (Type)</div></th>
                            <th style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}><div style={{ minWidth: '80px', maxWidth: '120px', wordBreak: 'break-word', whiteSpace: 'normal' }}>Bắt buộc</div></th>
                            <th style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}><div style={{ minWidth: '150px', maxWidth: '300px', wordBreak: 'break-word', whiteSpace: 'normal' }}>Ràng buộc (Constraints)</div></th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedHistoryItem.fields?.map((field: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '10px 12px', color: 'var(--color-yellow)', verticalAlign: 'top' }}>
                                <div style={{ minWidth: '120px', maxWidth: '280px', wordBreak: 'break-word', whiteSpace: 'normal' }}>{field.name}</div>
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--color-teal)', verticalAlign: 'top' }}>
                                <div style={{ minWidth: '100px', maxWidth: '200px', wordBreak: 'break-word', whiteSpace: 'normal' }}>{field.type}</div>
                              </td>
                              <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                                <div style={{ minWidth: '80px', maxWidth: '120px', wordBreak: 'break-word', whiteSpace: 'normal' }}>{field.required ? '✅ Có' : '❌ Không'}</div>
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', verticalAlign: 'top' }}>
                                <div style={{ minWidth: '150px', maxWidth: '300px', maxHeight: '80px', overflowY: 'auto', wordBreak: 'break-word', whiteSpace: 'normal', paddingRight: '4px' }}>
                                  {Array.isArray(field.constraints) ? field.constraints.join(', ') : ''}
                                </div>
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
                                <th key={f.name} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-violet)' }}>
                                  <div style={{ minWidth: '120px', maxWidth: '280px', wordBreak: 'break-word', whiteSpace: 'normal' }}>{f.name}</div>
                                </th>
                              ))}
                              <th style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--color-violet)' }}>
                                <div style={{ minWidth: '150px', maxWidth: '300px', wordBreak: 'break-word', whiteSpace: 'normal' }}>Kết quả mong đợi</div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedHistoryItem.initialPopulation.map((seed: any, idx: number) => (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                {selectedHistoryItem.fields?.map((f: any) => (
                                  <td key={f.name} style={{ padding: '10px 12px', color: 'var(--text-primary)', verticalAlign: 'top' }}>
                                    <div style={{ minWidth: '120px', maxWidth: '280px', maxHeight: '80px', overflowY: 'auto', wordBreak: 'break-word', whiteSpace: 'normal', paddingRight: '4px' }}>
                                      {typeof seed[f.name] === 'object' ? JSON.stringify(seed[f.name]) : String(seed[f.name] ?? '')}
                                    </div>
                                  </td>
                                ))}
                                <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                                  <div
                                    style={{
                                      color: seed.expectedResult?.startsWith('Lỗi') ? 'var(--color-rose)' :
                                             seed.expectedResult?.startsWith('Chặn') ? 'var(--color-violet)' :
                                             'var(--color-teal)',
                                      fontWeight: '500',
                                      minWidth: '150px',
                                      maxWidth: '300px',
                                      maxHeight: '80px',
                                      overflowY: 'auto',
                                      wordBreak: 'break-word',
                                      whiteSpace: 'normal'
                                    }}
                                  >
                                    {seed.expectedResult || 'Hợp lệ'}
                                  </div>
                                </td>
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
                      setMethodSeeds({
                        random: [],
                        bva: [],
                        ep: [],
                        decision: []
                      });
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

