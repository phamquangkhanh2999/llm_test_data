import React, { useState } from 'react';
import {
  BarChart3, Trash2, PlusCircle, Sparkles, RefreshCw, Bolt, Wand2,
  ArrowDownToLine, ListChecks, CheckSquare, Network, Zap,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import type { FieldConstraint } from '../algorithms/presets';
import { useAppStore } from '../store/useAppStore';
import { toast } from '../store/useToastStore';
import { LoadingSpinner } from './LoadingSpinner';

// =============================================================================
//  PHÂN TÍCH & THIẾT KẾ TESTCASE — bám sát màn "Bước 2 & 3" của Stitch.
//  Grid 12 cột: trái (7) Requirement Analysis editable + 3 thẻ thống kê;
//  phải (5) Design Techniques (EP/BVA/Decision/State) + Generate Test Suite.
//  Bên dưới: Optimization Tip + AI Assistant is active.
// =============================================================================

const TYPE_OPTIONS: { v: FieldConstraint['type']; label: string }[] = [
  { v: 'string', label: 'String' },
  { v: 'number', label: 'Integer' },
  { v: 'email', label: 'String (Email)' },
  { v: 'card', label: 'Card' },
  { v: 'phone', label: 'Phone' },
];

const TECHNIQUES: { id: string; title: string; desc: string; recommended?: boolean }[] = [
  { id: 'ep', title: 'Phân vùng tương đương (EP)', desc: 'Nhóm dữ liệu đầu vào thành các phân vùng hành xử tương tự để giảm dư thừa.', recommended: true },
  { id: 'bva', title: 'Phân tích giá trị biên (BVA)', desc: 'Kiểm thử các điểm biên của phân vùng — nơi lỗi dễ xuất hiện nhất.' },
  { id: 'random', title: 'Chọn ngẫu nhiên (Random)', desc: 'Sinh ngẫu nhiên các giá trị để kiểm tra độ tin cậy của hệ thống.' },
];

const RenderConstraintBadges: React.FC<{ f: FieldConstraint }> = ({ f }) => {
  const badges: { text: string; bg: string; color: string }[] = [];
  
  if (f.required) {
    badges.push({ text: 'Bắt buộc', bg: 'rgba(239, 68, 68, 0.08)', color: 'var(--color-rose)' });
  }
  
  if (f.type === 'number') {
    if (f.minValue != null || f.maxValue != null) {
      const lo = f.minValue ?? '−∞', hi = f.maxValue ?? '∞';
      badges.push({ text: `Min/Max: ${lo} – ${hi}`, bg: 'rgba(59, 130, 246, 0.08)', color: 'var(--brand-primary)' });
    }
  } else {
    if (f.minLength != null || f.maxLength != null) {
      const lo = f.minLength ?? 0, hi = f.maxLength ?? '∞';
      badges.push({ text: `Len: ${lo} – ${hi}`, bg: 'rgba(16, 185, 129, 0.08)', color: 'var(--color-emerald)' });
    }
  }
  
  if (f.regex) {
    badges.push({ text: 'Regex', bg: 'rgba(139, 92, 246, 0.08)', color: 'var(--color-violet)' });
  }
  
  if (f.allowedValues?.length) {
    badges.push({ text: `Enum: ${f.allowedValues.join(',')}`, bg: 'rgba(6, 182, 212, 0.08)', color: 'var(--color-teal)' });
  }
  
  if (f.successValues?.length) {
    badges.push({ text: `Success: ${f.successValues.join(',')}`, bg: 'rgba(16, 185, 129, 0.08)', color: 'var(--color-emerald)' });
  }
  
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
      {badges.map((b, idx) => (
        <span key={idx} style={{ 
          fontSize: '9.5px', 
          fontWeight: 700, 
          padding: '2px 5px', 
          borderRadius: '4px', 
          background: b.bg, 
          color: b.color,
          whiteSpace: 'nowrap'
        }}>
          {b.text}
        </span>
      ))}
      {f.description && (
        <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.description}>
          {f.description}
        </span>
      )}
    </div>
  );
};

export const AnalysisDesign: React.FC = () => {
  const {
    rawText, parsedSchema, parsedBusinessRules, parsedConstraints, setParsedSchema, handleParseSpec, isParsing,
    schemaName, setActiveScreen, markScreenCompleted, setSelectedMethods,
    handleGenerateTestSuite, handleEvaluateSeeds,
  } = useAppStore();

  const [techniques, setTechniques] = useState<string[]>(['ep', 'bva']);
  const [newName, setNewName] = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const hasSchema = parsedSchema.length > 0;
  const constraintCount = parsedSchema.filter(f => f.minValue != null || f.maxValue != null || f.minLength != null || f.maxLength != null || f.regex || f.allowedValues?.length).length;
  const estimated = Math.max(parsedSchema.length, parsedSchema.length * Math.max(1, techniques.length) * 2 + 4);

  const updateField = (i: number, patch: Partial<FieldConstraint>) => {
    setParsedSchema((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  };
  const removeField = (i: number) => setParsedSchema((prev) => prev.filter((_, idx) => idx !== i));
  const addField = () => {
    const name = newName.trim();
    if (!name) return;
    if (parsedSchema.some(f => f.name.toLowerCase() === name.toLowerCase())) { toast.warning('Tên trường đã tồn tại.'); return; }
    setParsedSchema((prev) => [...prev, { name, type: 'string', required: true, description: '' } as FieldConstraint]);
    setNewName('');
  };

  const toggleTech = (id: string) => setTechniques((prev) => (prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]));

  const handleGenerate = async () => {
    if (!hasSchema) {
      if (!rawText.trim()) { toast.warning('Chưa có đặc tả. Hãy nhập ở bước Đầu vào, hoặc bấm "Phân tích bằng AI".'); return; }
      await handleParseSpec();
    }
    // Ánh xạ kỹ thuật đã chọn sang phương pháp sinh F0
    const map: Record<string, 'random' | 'bva' | 'ep' | 'decision'> = { ep: 'ep', bva: 'bva', decision: 'decision', state: 'random' };
    const methods = techniques.map(t => map[t]).filter(Boolean) as ('random' | 'bva' | 'ep' | 'decision')[];
    
    if (methods.length) {
      setSelectedMethods(methods);
    }
    
    // Gọi API để sinh tập test suite (seeds) dựa trên kỹ thuật đã chọn
    await handleGenerateTestSuite();

    markScreenCompleted('analyze');

    // Tự động gọi API đánh giá tập F0
    const method = methods[0] || 'bva';
    await handleEvaluateSeeds(method);

    setActiveScreen('evaluate');
  };

  return (
    <div className="fade-in-up">
      {/* Breadcrumb header */}
      <div style={{ marginBottom: 16 }}>
        {/* <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
          <span>Step 2 &amp; 3</span><span>›</span><span>Workflow Configuration</span>
        </div> */}
      </div>

      {/* Grid 12 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 7fr) minmax(300px, 5fr)', gap: 20, alignItems: 'start' }} className="analysis-grid">

        {/* ─── TRÁI: Requirement Analysis ─── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {/* header */}
            <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <h4 style={{ fontSize: 15, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={17} style={{ color: 'var(--brand-primary)' }} /> Phân tích yêu cầu
              </h4>
              <span style={{ background: 'rgba(8,145,178,0.1)', color: 'var(--color-teal)', padding: '3px 9px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                {schemaName ? '' : 'Chờ phân tích'}
              </span>
            </div>

            <div style={{ padding: 18 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 8 }}>
                Function: {schemaName ? schemaName.replace(/\s+/g, '_').slice(0, 28) : 'PENDING_PIPELINE'}
              </div>

              {isParsing && !hasSchema ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px 20px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: 16,
                  background: 'rgba(8, 145, 178, 0.02)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px dashed rgba(8, 145, 178, 0.25)',
                }}>
                  <LoadingSpinner size={70} icon="sparkles" outerColor="var(--brand-primary)" innerColor="var(--color-teal)" />
                  <div>
                    <h5 style={{ fontSize: 14.5, fontWeight: 600, margin: '0 0 6px', color: 'var(--brand-primary)' }}>Đang phân tích đặc tả bằng AI...</h5>
                    <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, maxWidth: 320, lineHeight: 1.5 }}>
                      Hệ thống đang xử lý ngôn ngữ tự nhiên để tự động trích xuất các quy tắc ràng buộc logic & hạt giống dữ liệu.
                    </p>
                  </div>
                </div>
              ) : !hasSchema ? (
                <div style={{ textAlign: 'center', padding: '28px 10px', color: 'var(--text-muted)' }}>
                  <Wand2 size={26} style={{ opacity: 0.5, marginBottom: 8 }} />
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    {rawText.trim() ? 'Đặc tả đã sẵn sàng — phân tích để trích xuất ràng buộc.' : 'Chưa có đặc tả. Hãy nhập ở bước Đầu vào.'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button className="btn btn-primary" onClick={() => handleParseSpec(false)} disabled={isParsing || !rawText.trim()}>
                      {isParsing ? <RefreshCw size={15} className="tech-spinner" /> : <Sparkles size={15} />}
                      {isParsing ? 'Đang phân tích…' : 'Phân tích bằng AI'}
                    </button>
                    {hasSchema && (
                       <button className="btn btn-secondary" onClick={() => handleParseSpec(true)} disabled={isParsing || !rawText.trim()} title="Bỏ qua cache và phân tích mới hoàn toàn từ AI">
                        <RefreshCw size={14} />
                        <span>Phân tích lại (No Cache)</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Table Header */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '32px 3fr 2.5fr 5fr 36px 36px', 
                    gap: 8, 
                    padding: '6px 0', 
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    <span />
                    <span>Tên trường</span>
                    <span>Kiểu dữ liệu</span>
                    <span>Mô tả / Ràng buộc</span>
                    <span style={{ textAlign: 'center' }}>Sửa</span>
                    <span style={{ textAlign: 'center' }}>Xóa</span>
                  </div>

                  {/* Rows */}
                  <div>
                    {parsedSchema.map((f, i) => (
                      <div key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <div className="param-row"
                          style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '32px 3fr 2.5fr 5fr 36px 36px', 
                            gap: 8, 
                            alignItems: 'center', 
                            padding: '8px 0',
                          }}>
                          {/* 1. Toggle button */}
                          <button 
                            onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Chi tiết ràng buộc"
                          >
                            {expandedRow === i ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                          
                          {/* 2. Name */}
                          <input value={f.name} onChange={(e) => updateField(i, { name: e.target.value })}
                            style={{ background: 'transparent', border: 'none', outline: 'none', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', minWidth: 0 }} />
                          
                          {/* 3. Type */}
                          <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value as FieldConstraint['type'] })}
                            style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '5px 8px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', minWidth: 0 }}>
                            {TYPE_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                          </select>
                          
                          {/* 4. Description / Badges */}
                          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
                            <RenderConstraintBadges f={f} />
                          </div>
                          
                          {/* 5. Edit detail button */}
                          <button 
                            onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              cursor: 'pointer', 
                              color: expandedRow === i ? 'var(--brand-primary)' : 'var(--text-muted)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center' 
                            }} 
                            title="Chi tiết"
                          >
                            <Bolt size={15} />
                          </button>

                          {/* 6. Delete button */}
                          <button onClick={() => removeField(i)} title="Xóa trường"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Trash2 size={15} />
                          </button>
                        </div>

                        {/* Collapsible detail panel */}
                        {expandedRow === i && (
                          <div style={{ 
                            background: 'var(--surface-subtle)', 
                            borderRadius: 'var(--radius-md)', 
                            padding: '12px 16px', 
                            marginBottom: 10,
                            marginLeft: 32,
                            border: '1px solid var(--border-subtle)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                          }} className="fade-in-up">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                              {/* 1. Required Checkbox */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input 
                                  type="checkbox" 
                                  id={`req-${i}`}
                                  checked={f.required ?? false}
                                  onChange={(e) => updateField(i, { required: e.target.checked })}
                                  style={{ width: 15, height: 15, accentColor: 'var(--brand-primary)' }}
                                />
                                <label htmlFor={`req-${i}`} style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer' }}>
                                  Bắt buộc (Required)
                                </label>
                              </div>

                              {/* Type specific inputs */}
                              {f.type === 'number' && (
                                <>
                                  {/* Min Value */}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>GIÁ TRỊ TỐI THIỂU (MIN)</span>
                                    <input 
                                      type="number"
                                      value={f.minValue ?? ''}
                                      onChange={(e) => updateField(i, { minValue: e.target.value === '' ? undefined : Number(e.target.value) })}
                                      placeholder="Không giới hạn"
                                      style={{
                                        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 4,
                                        padding: '5px 8px', fontSize: 12, color: 'var(--text-primary)', outline: 'none'
                                      }}
                                    />
                                  </div>
                                  
                                  {/* Max Value */}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>GIÁ TRỊ TỐI ĐA (MAX)</span>
                                    <input 
                                      type="number"
                                      value={f.maxValue ?? ''}
                                      onChange={(e) => updateField(i, { maxValue: e.target.value === '' ? undefined : Number(e.target.value) })}
                                      placeholder="Không giới hạn"
                                      style={{
                                        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 4,
                                        padding: '5px 8px', fontSize: 12, color: 'var(--text-primary)', outline: 'none'
                                      }}
                                    />
                                  </div>
                                </>
                              )}

                              {f.type !== 'number' && (
                                <>
                                  {/* Min Length */}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>ĐỘ DÀI TỐI THIỂU (MIN LEN)</span>
                                    <input 
                                      type="number"
                                      value={f.minLength ?? ''}
                                      onChange={(e) => updateField(i, { minLength: e.target.value === '' ? undefined : Number(e.target.value) })}
                                      placeholder="Mặc định"
                                      style={{
                                        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 4,
                                        padding: '5px 8px', fontSize: 12, color: 'var(--text-primary)', outline: 'none'
                                      }}
                                    />
                                  </div>
                                  
                                  {/* Max Length */}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>ĐỘ DÀI TỐI ĐA (MAX LEN)</span>
                                    <input 
                                      type="number"
                                      value={f.maxLength ?? ''}
                                      onChange={(e) => updateField(i, { maxLength: e.target.value === '' ? undefined : Number(e.target.value) })}
                                      placeholder="Mặc định"
                                      style={{
                                        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 4,
                                        padding: '5px 8px', fontSize: 12, color: 'var(--text-primary)', outline: 'none'
                                      }}
                                    />
                                  </div>
                                </>
                              )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                              {/* Regex pattern */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>MẪU BIỂU THỨC CHÍNH QUY (REGULAR EXPRESSION)</span>
                                <input 
                                  type="text"
                                  value={f.regex ?? ''}
                                  onChange={(e) => updateField(i, { regex: e.target.value === '' ? undefined : e.target.value })}
                                  placeholder="Ví dụ: ^[A-Za-z0-9]+$"
                                  style={{
                                    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 4,
                                    padding: '6px 8px', fontSize: 12, color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-mono)'
                                  }}
                                />
                              </div>

                              {/* Allowed values (Enum) */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>DANH SÁCH GIÁ TRỊ CHO PHÉP (ENUM - PHÂN TÁCH BẰNG DẤU PHẨY)</span>
                                <input 
                                  type="text"
                                  value={f.allowedValues?.join(', ') ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const list = val ? val.split(',').map(s => s.trim()).filter(Boolean) : undefined;
                                    updateField(i, { allowedValues: list });
                                  }}
                                  placeholder="Ví dụ: USD, VND, EUR"
                                  style={{
                                    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 4,
                                    padding: '6px 8px', fontSize: 12, color: 'var(--text-primary)', outline: 'none'
                                  }}
                                />
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                              {/* Success values */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>CÁC GIÁ TRỊ MẪU HỢP LỆ (SUCCESS VALUES)</span>
                                <input 
                                  type="text"
                                  value={f.successValues?.join(', ') ?? ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const list = val ? val.split(',').map(s => s.trim()).filter(Boolean) : undefined;
                                    updateField(i, { successValues: list });
                                  }}
                                  placeholder="Ví dụ: active, approved"
                                  style={{
                                    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 4,
                                    padding: '6px 8px', fontSize: 12, color: 'var(--text-primary)', outline: 'none'
                                  }}
                                />
                              </div>

                              {/* Failure values (JSON Edit) */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>CÁC GIÁ TRỊ MẪU LỖI KÈM LÝ DO (FAILURE VALUES - JSON)</span>
                                <input 
                                  type="text"
                                  value={f.failureValues ? JSON.stringify(f.failureValues) : ''}
                                  onChange={(e) => {
                                    try {
                                      const val = e.target.value;
                                      const parsed = val ? JSON.parse(val) : undefined;
                                      updateField(i, { failureValues: parsed });
                                    } catch(err) {
                                      // Ignore parse error while typing
                                    }
                                  }}
                                  placeholder='Ví dụ: {"inactive": "Tài khoản bị khóa"}'
                                  style={{
                                    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 4,
                                    padding: '6px 8px', fontSize: 12, color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-mono)'
                                  }}
                                />
                              </div>
                            </div>

                            {/* Description input */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>MÔ TẢ CHI TIẾT (DESCRIPTION)</span>
                              <input 
                                type="text"
                                value={f.description ?? ''}
                                onChange={(e) => updateField(i, { description: e.target.value })}
                                placeholder="Nhập mô tả của tham số..."
                                style={{
                                  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 4,
                                  padding: '6px 8px', fontSize: 12, color: 'var(--text-primary)', outline: 'none'
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Add row */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '32px 3fr 2.5fr 5fr 36px 36px', 
                      gap: 8, 
                      alignItems: 'center', 
                      padding: '8px 0', 
                      background: 'var(--surface-subtle)',
                      borderRadius: 'var(--radius-sm)'
                    }}>
                      <span />
                      <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addField()}
                        placeholder="Thêm tham số..." style={{ background: 'transparent', border: 'none', outline: 'none', fontStyle: 'italic', fontSize: 13, color: 'var(--text-muted)', minWidth: 0 }} />
                      <span />
                      <span />
                      <span />
                      <button onClick={addField} title="Thêm trường" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-primary)', display: 'flex', justifyContent: 'center' }}>
                        <PlusCircle size={17} />
                      </button>
                    </div>
                  </div>

                  {/* Expected results */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 8 }}>Expected Results &amp; Logic</div>
                    <div style={{ background: 'var(--surface-subtle)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-subtle)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      1. Nếu dữ liệu hợp lệ &amp; thỏa ràng buộc → <b style={{ color: 'var(--color-emerald)' }}>SUCCESS</b><br />
                      2. Nếu vi phạm biên/định dạng → <b style={{ color: 'var(--color-rose)' }}>VALIDATION_ERROR</b>
                    </div>
                  </div>

                  {/* Hiển thị Business Rules & Constraints nếu có */}
                  {(parsedBusinessRules.length > 0 || parsedConstraints.length > 0) && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 8 }}>Luật nghiệp vụ (Business Rules)</div>
                      <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px dashed rgba(59, 130, 246, 0.2)', fontSize: 13, color: 'var(--text-secondary)' }}>
                        {parsedBusinessRules.map((br, idx) => {
                          const fieldName = br.field || 'General';
                          const ruleDesc = br.description || br.rule_id || JSON.stringify(br);
                          const errMsg = br.errorMessage || '';
                          return (
                            <div key={`br-${idx}`} style={{ marginBottom: 6 }}>
                              <strong style={{ color: 'var(--brand-primary)' }}>Quy tắc ({fieldName}):</strong> {ruleDesc}
                              {errMsg && <span style={{ color: 'var(--color-rose)', marginLeft: 4 }}>(Lỗi: {errMsg})</span>}
                            </div>
                          );
                        })}
                        {Array.from(new Map(parsedConstraints.map(c => [c.rule || c.description || JSON.stringify(c), c])).values()).map((c: any, idx) => {
                          const ruleDesc = c.rule || c.description || JSON.stringify(c);
                          let label = c.constraint_id || 'Logic';
                          if (label.startsWith('C_')) label = label.substring(2);
                          return (
                            <div key={`c-${idx}`} style={{ marginBottom: 6 }}>
                              <strong style={{ color: 'var(--color-violet)' }}>Ràng buộc chéo ({label}):</strong> {ruleDesc}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 3 thẻ thống kê */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <StatChip icon={<ArrowDownToLine size={16} />} label="Inputs" value={`${parsedSchema.length} Params`} />
            <StatChip icon={<ListChecks size={16} />} label="Constraints" value={`${constraintCount} Nodes`} />
            <StatChip icon={<CheckSquare size={16} />} label="Outputs" value="2 States" />
          </div>
        </section>

        {/* ─── PHẢI: Design Techniques ─── */}
        <section style={{ minWidth: 0 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 18 }}>
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 15, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Network size={17} style={{ color: 'var(--brand-primary)' }} /> Kỹ thuật kiểm thử
              </h4>
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '4px 0 0' }}>Chọn một hoặc nhiều kỹ thuật để sinh dữ liệu kiểm thử.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {TECHNIQUES.map((t) => {
                const sel = techniques.includes(t.id);
                return (
                  <div key={t.id} onClick={() => toggleTech(t.id)}
                    style={{
                      border: `1px solid ${sel ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                      background: sel ? 'var(--surface-subtle)' : 'var(--bg-card)',
                      borderRadius: 'var(--radius-md)', padding: '12px 14px', cursor: 'pointer',
                      display: 'flex', alignItems: 'flex-start', gap: 12, transition: 'all 0.14s',
                    }}>
                    <input type="checkbox" checked={sel} readOnly style={{ marginTop: 2, width: 16, height: 16, accentColor: 'var(--brand-primary)' }} />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{t.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.5 }}>{t.desc}</div>
                      {t.recommended && (
                        <span style={{ display: 'inline-block', marginTop: 7, background: 'rgba(16,185,129,0.12)', color: 'var(--color-emerald)', padding: '2px 7px', borderRadius: 4, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase' }}>Recommended</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                <span>Ước lượng số test case:</span><b style={{ color: 'var(--brand-primary)' }}>~{estimated} Cases</b>
              </div>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={isParsing}
                style={{ width: '100%', padding: '13px', fontSize: 15, justifyContent: 'center' }}>
                {isParsing ? <RefreshCw size={16} className="tech-spinner" /> : <Bolt size={16} />}
                <span>Generate Test Suite</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Bento dưới */}
      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }} className="analysis-grid">
        {/* <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 18, position: 'relative', overflow: 'hidden' }}>
          <h6 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>Optimization Tip</h6>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6, position: 'relative', zIndex: 1 }}>
            Kết hợp BVA với Equivalence Partitioning cho 80% độ phủ chỉ với 20% công sức.
          </p>
          <Lightbulb size={110} style={{ position: 'absolute', bottom: -18, right: -18, color: 'rgba(15,23,42,0.05)' }} />
        </div> */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 46, height: 46, borderRadius: 999, background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
              <Zap size={20} />
            </div>
            <div>
              <h6 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>AI Assistant đang hoạt động</h6>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '2px 0 0' }}>Theo dõi các chỉnh sửa thủ công�a bạn để tối ưu gợi ý về sau.</p>
            </div>
          </div>
          <button className="btn btn-secondary" style={{ fontSize: 12.5 }} onClick={() => setActiveScreen('evaluate')}>Xem Đánh Giá Dữ Liệu</button>
        </div>
      </div>

      <style>{`
        .param-row:hover { background: var(--surface-subtle); }
        @media (max-width: 980px){ .analysis-grid{ grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
};

const StatChip: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 3 }}>
    <span style={{ color: 'var(--brand-primary)' }}>{icon}</span>
    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
    <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
  </div>
);

export default AnalysisDesign;
