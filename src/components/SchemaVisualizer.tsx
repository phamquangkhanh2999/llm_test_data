import React from 'react';
import { Table, Tag, Typography, Tooltip, Card } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

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

  const columns = [
    {
      title: 'STT',
      key: 'index',
      width: 60,
      render: (_text: any, _record: any, index: number) => index + 1,
    },
    {
      title: 'Tên trường',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: FieldDefinition) => (
        <div>
          <Text strong>{text}</Text>
          {record.required && <Text type="danger" style={{ marginLeft: 4 }}>*</Text>}
        </div>
      ),
    },
    {
      title: 'Kiểu & Độ dài',
      key: 'type',
      render: (_: any, record: FieldDefinition) => {
        let lengthStr = '';
        if (record.minLength && record.maxLength) {
          lengthStr = `[${record.minLength} - ${record.maxLength}]`;
        } else if (record.maxLength) {
          lengthStr = `[Max: ${record.maxLength}]`;
        } else if (record.minValue !== null && record.maxValue !== null) {
          lengthStr = `[${record.minValue} -> ${record.maxValue}]`;
        }

        return (
          <div>
            <Tag color="blue">{record.type}</Tag>
            {lengthStr && <Text type="secondary" style={{ fontSize: '12px' }}>{lengthStr}</Text>}
          </div>
        );
      },
    },
    {
      title: 'Input Type',
      dataIndex: 'inputType',
      key: 'inputType',
      render: (text: string) => <Tag color="purple">{text || 'textbox'}</Tag>,
    },
    {
      title: 'Ràng buộc & Báo lỗi (Rules)',
      key: 'rules',
      render: (_: any, record: FieldDefinition) => {
        const fieldRules = rules.filter(r => record.mapped_rules.includes(r.rule_id));
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {fieldRules.map(rule => (
              <div key={rule.rule_id} style={{ padding: '4px 8px', background: '#fafafa', borderLeft: '3px solid #ff4d4f', borderRadius: '4px' }}>
                <div>
                  <Text strong style={{ fontSize: '12px' }}>{rule.description}</Text>
                  <Tooltip title={`Toán tử: ${rule.rule_operator} | Trọng số: ${rule.priority}`}>
                    <InfoCircleOutlined style={{ marginLeft: 6, color: '#1890ff' }} />
                  </Tooltip>
                </div>
                {rule.errorMessage && (
                  <div style={{ marginTop: '2px' }}>
                    <Text type="danger" style={{ fontSize: '12px' }}>↳ Lỗi: {rule.errorMessage}</Text>
                  </div>
                )}
              </div>
            ))}
            {record.regex && (
              <Text type="secondary" style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                Regex: {record.regex}
              </Text>
            )}
            {record.allowedValues && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Enum: {Array.isArray(record.allowedValues) ? record.allowedValues.join(', ') : String(record.allowedValues)}
              </Text>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <Card title="Bảng Đặc Tả Màn Hình Chức Năng (Schema Visualizer)" size="small" style={{ marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <Table 
        dataSource={fields} 
        columns={columns} 
        rowKey="name" 
        pagination={false}
        bordered
        size="small"
      />
    </Card>
  );
};
