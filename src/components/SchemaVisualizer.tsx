import React from 'react';
import { Info, Database } from 'lucide-react';

interface FieldDefinition {
  name: string;
  type: string;
  semantic_type: string;
  required: boolean;
  minLength: number | null;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  regex: string | null;
  allowedValues: string[] | null;
  description: string;
  inputType?: string;
  mapped_rules: string[];
}

interface RuleDefinition {
  rule_id: string;
  field: string;
  rule_operator: string;
  rule_value: string | null;
  description: string;
  errorMessage?: string;
  priority: string;
}

interface SchemaVisualizerProps {
  fields: FieldDefinition[];
  rules: RuleDefinition[];
}

export const SchemaVisualizer: React.FC<SchemaVisualizerProps> = ({ fields, rules }) => {
  if (!fields || fields.length === 0) return null;

  return (
    <div className="glass-card flex flex-col gap-md" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px' }}>
      <div className="flex justify-between align-center" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <h3 className="flex align-center gap-sm" style={{ margin: 0, color: 'var(--text-primary)', fontSize: '16px' }}>
          <Database size={18} style={{ color: 'var(--color-teal)' }} /> 
          Bảng Đặc Tả Màn Hình Chức Năng (Schema Visualizer)
        </h3>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
          <thead>
            <tr style={{ background: 'var(--surface-subtle)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '10px 16px', fontWeight: 'bold', width: '60px' }}>STT</th>
              <th style={{ padding: '10px 16px', fontWeight: 'bold' }}>Tên trường</th>
              <th style={{ padding: '10px 16px', fontWeight: 'bold' }}>Kiểu & Độ dài</th>
              <th style={{ padding: '10px 16px', fontWeight: 'bold' }}>Input Type</th>
              <th style={{ padding: '10px 16px', fontWeight: 'bold' }}>Ràng buộc & Báo lỗi (Rules)</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((record, index) => {
              let lengthStr = '';
              if (record.minLength && record.maxLength) {
                lengthStr = `[${record.minLength} - ${record.maxLength}]`;
              } else if (record.maxLength) {
                lengthStr = `[Max: ${record.maxLength}]`;
              } else if (record.minValue !== null && record.maxValue !== null) {
                lengthStr = `[${record.minValue} -> ${record.maxValue}]`;
              }

              const fieldRules = rules.filter(r => record.mapped_rules.includes(r.rule_id));

              return (
                <tr key={record.name} style={{ borderTop: '1px solid var(--border-subtle)', transition: 'all 0.2s' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{index + 1}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{record.name}</strong>
                      {record.required && <span style={{ color: 'var(--color-rose)', marginLeft: '4px', fontWeight: 'bold' }}>*</span>}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ display: 'inline-block', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', width: 'max-content' }}>
                        {record.type}
                      </span>
                      {lengthStr && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{lengthStr}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-block', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--color-violet)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', width: 'max-content' }}>
                      {record.inputType || 'textbox'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {fieldRules.map(rule => (
                        <div key={rule.rule_id} style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.02)', borderLeft: '3px solid var(--color-rose)', borderRadius: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{rule.description}</strong>
                            <span title={`Toán tử: ${rule.rule_operator} | Trọng số: ${rule.priority}`}>
                              <Info size={12} style={{ color: '#3b82f6', cursor: 'help' }} />
                            </span>
                          </div>
                          {rule.errorMessage && (
                            <div style={{ marginTop: '4px', fontSize: '11.5px', color: 'var(--color-rose)' }}>
                              ↳ Lỗi: {rule.errorMessage}
                            </div>
                          )}
                        </div>
                      ))}
                      {record.regex && (
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          Regex: {record.regex}
                        </div>
                      )}
                      {record.allowedValues && (
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                          Enum: {Array.isArray(record.allowedValues) ? record.allowedValues.join(', ') : String(record.allowedValues)}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
