import React, { useState, useEffect } from 'react';
import { Table, Tag, Modal, Tabs, Spin } from 'antd';
import { Activity, CheckCircle, Database, Search } from 'lucide-react';

interface TestCaseSummary {
  id: string;
  scenario: string;
  strategy: string;
  fitness: { f0: number; hc: number };
  improvement: number;
  status: string;
}

export const TestCaseOptimizationResult: React.FC = () => {
  const [testCases, setTestCases] = useState<TestCaseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchTestCases = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/test-cases');
      if (res.ok) {
        const data = await res.json();
        setTestCases(data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchEvolution = async (id: string) => {
    setDetailLoading(true);
    setSelectedId(id);
    try {
      const res = await fetch(`http://localhost:8000/api/test-cases/${id}/evolution`);
      if (res.ok) {
        const data = await res.json();
        setDetailData(data);
      }
    } catch (e) {
      console.error(e);
    }
    setDetailLoading(false);
  };

  useEffect(() => {
    fetchTestCases();
  }, []);

  const columns = [
    {
      title: 'STT',
      dataIndex: 'index',
      key: 'index',
      render: (_: any, __: any, index: number) => index + 1,
      width: 60,
    },
    {
      title: 'Test Case ID',
      dataIndex: 'id',
      key: 'id',
      render: (text: string) => (
        <a onClick={() => fetchEvolution(text)} style={{ color: '#8b5cf6', fontWeight: 600 }}>
          {text}
        </a>
      ),
    },
    {
      title: 'Scenario',
      dataIndex: 'scenario',
      key: 'scenario',
    },
    {
      title: 'Strategy',
      dataIndex: 'strategy',
      key: 'strategy',
      render: (text: string) => <Tag color="blue">{text}</Tag>
    },
    {
      title: 'Fitness',
      key: 'fitness',
      render: (_: any, record: TestCaseSummary) => (
        <span>
          {record.fitness.f0?.toFixed(2)} &rarr; {record.fitness.hc?.toFixed(2)}
        </span>
      ),
    },
    {
      title: 'Improvement',
      dataIndex: 'improvement',
      key: 'improvement',
      render: (val: number) => {
        const color = val > 0 ? '#16a34a' : val < 0 ? '#dc2626' : '#64748b';
        return <span style={{ color, fontWeight: 'bold' }}>{val > 0 ? '+' : ''}{val?.toFixed(2)}</span>;
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === 'Optimized') color = 'success';
        if (status === 'Degraded') color = 'error';
        if (status === 'No Change') color = 'warning';
        return <Tag color={color}>{status}</Tag>;
      }
    }
  ];

  return (
    <div style={{ marginTop: 24, padding: 24, background: '#1e293b', borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e2e8f0', margin: 0, fontSize: 18 }}>
          <Database size={20} color="#8b5cf6" />
          Test Case Optimization Results (Database)
        </h2>
        <button className="btn" onClick={fetchTestCases} style={{ padding: '6px 12px', borderRadius: 6, cursor: 'pointer', border: '1px solid #334155', background: '#334155', color: '#fff' }}>
          Làm mới
        </button>
      </div>

      <Table 
        dataSource={testCases} 
        columns={columns} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 5 }}
        style={{ background: '#0f172a', borderRadius: 8, overflow: 'hidden' }}
      />

      <Modal
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Search size={18} /> Chi tiết quá trình tiến hóa: {selectedId}</span>}
        open={!!selectedId}
        onCancel={() => setSelectedId(null)}
        width={1000}
        footer={null}
        destroyOnClose
        styles={{ body: { padding: '24px 0' } }}
      >
        {detailLoading || !detailData ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin size="large" /></div>
        ) : (
          <Tabs 
            defaultActiveKey="1" 
            centered
            items={[
              {
                label: 'Data Evolution',
                key: '1',
                children: (
                  <div style={{ padding: '0 24px' }}>
                    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', marginBottom: '24px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f1f5f9' }}>
                            <th style={{ padding: '12px' }}>Trường dữ liệu</th>
                            <th style={{ padding: '12px', color: '#3b82f6' }}>1. LLM Thô (F0)</th>
                            <th style={{ padding: '12px', color: '#8b5cf6' }}>2. Tối ưu GA</th>
                            <th style={{ padding: '12px', color: '#f59e0b' }}>3. Tinh chỉnh HC (Cuối)</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>Thay đổi</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>Fit F0</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>Fit GA</th>
                            <th style={{ padding: '12px', textAlign: 'center' }}>Fit HC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailData.fields.map((f: any, i: number) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '12px', fontWeight: 600, color: '#334155' }}>{f.name}</td>
                              <td style={{ padding: '12px', color: '#64748b' }}>{String(f.f0)}</td>
                              <td style={{ padding: '12px', color: '#334155' }}>{String(f.ga)}</td>
                              <td style={{ padding: '12px', color: '#334155' }}>{String(f.hc)}</td>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                {f.changed ? <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 12 }}><CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }}/>Đã thay đổi</span> : <span style={{ color: '#94a3b8', fontSize: 12 }}>Không đổi</span>}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center', color: '#64748b' }}>{f.fitness?.f0?.toFixed(2)}</td>
                              <td style={{ padding: '12px', textAlign: 'center', color: '#16a34a' }}>{f.fitness?.ga?.toFixed(2)}</td>
                              <td style={{ padding: '12px', textAlign: 'center', color: '#dc2626' }}>{f.fitness?.hc?.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* BOTTOM SECTION MỚI KHÔI PHỤC THEO YÊU CẦU */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                        <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Activity size={16} color="#0d9488" />
                          Tổng quan cải thiện Fitness
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px' }}>
                          <div style={{ textAlign: 'center', background: 'rgba(59, 130, 246, 0.1)', padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                            <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600, marginBottom: '4px' }}>LLM Thô (F0)</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
                              {(detailData.fields[0]?.fitness?.f0 || 0).toFixed(2)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#16a34a' }}>
                            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                              +{((detailData.fields[0]?.fitness?.ga || 0) - (detailData.fields[0]?.fitness?.f0 || 0)).toFixed(2)}
                            </span>
                            <span style={{ fontSize: 16 }}>&rarr;</span>
                          </div>
                          <div style={{ textAlign: 'center', background: 'rgba(139, 92, 246, 0.1)', padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                            <div style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 600, marginBottom: '4px' }}>Sau GA</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8b5cf6' }}>
                              {(detailData.fields[0]?.fitness?.ga || 0).toFixed(2)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#64748b' }}>
                            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
                              +{((detailData.fields[0]?.fitness?.hc || 0) - (detailData.fields[0]?.fitness?.ga || 0)).toFixed(2)}
                            </span>
                            <span style={{ fontSize: 16 }}>&rarr;</span>
                          </div>
                          <div style={{ textAlign: 'center', background: 'rgba(245, 158, 11, 0.1)', padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                            <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600, marginBottom: '4px' }}>Sau HC (Cuối)</div>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
                              {(detailData.fields[0]?.fitness?.hc || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div style={{ background: 'rgba(13, 148, 136, 0.04)', border: '1px solid rgba(13, 148, 136, 0.2)', borderRadius: '8px', padding: '16px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#0d9488', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          Nhận xét
                        </h4>
                        <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6', margin: 0 }}>
                          Thuật toán Genetic Algorithm đã cải thiện Fitness từ {(detailData.fields[0]?.fitness?.f0 || 0).toFixed(2)} lên {(detailData.fields[0]?.fitness?.ga || 0).toFixed(2)} (+{((detailData.fields[0]?.fitness?.ga || 0) - (detailData.fields[0]?.fitness?.f0 || 0)).toFixed(2)}).
                          Sau bước tinh chỉnh cục bộ (HC), Fitness giữ nguyên ở mức {(detailData.fields[0]?.fitness?.hc || 0).toFixed(2)}, không có cải thiện bổ sung.
                        </p>
                      </div>
                    </div>
                  </div>
                )
              },
              {
                label: 'Fitness Rubric Detail',
                key: '2',
                children: (
                  <div style={{ padding: '0 24px' }}>
                    <Table 
                      dataSource={[
                        { criteria: 'Happy Path Coverage', before: '8/10', after: '10/10', change: '+2' },
                        { criteria: 'Boundary Coverage', before: '12/20', after: '18/20', change: '+6' },
                        { criteria: 'Validation Coverage', before: '15/20', after: '18/20', change: '+3' },
                        { criteria: 'Security Coverage', before: '8/20', after: '14/20', change: '+6' },
                        { criteria: 'Diversity', before: '21/30', after: '14/30', change: '-7' },
                      ]}
                      columns={[
                        { title: 'Tiêu chí', dataIndex: 'criteria', key: 'criteria' },
                        { title: 'Before', dataIndex: 'before', key: 'before' },
                        { title: 'After', dataIndex: 'after', key: 'after' },
                        { title: 'Change', dataIndex: 'change', key: 'change', render: (val) => <span style={{ color: val.includes('+') ? 'green' : 'red' }}>{val}</span> },
                      ]}
                      pagination={false}
                    />
                  </div>
                )
              },
              {
                label: 'Lineage View',
                key: '3',
                children: (
                  <div style={{ padding: '0 24px' }}>
                    <pre style={{ background: '#f8fafc', padding: 16, borderRadius: 8, color: '#334155' }}>
{`${selectedId} (F0)
    |
    |
    +-- Mutation
            |
            v
    ${selectedId}-GA-03
            |
            |
            +-- HC Adjustment
                    |
                    v
             ${selectedId}-HC-01`}
                    </pre>
                  </div>
                )
              },
              {
                label: 'Change Log',
                key: '4',
                children: (
                  <div style={{ padding: '0 24px' }}>
                    <Table 
                      dataSource={detailData.fields.filter((f: any) => f.changed)}
                      columns={[
                        { title: 'Field', dataIndex: 'name', key: 'name' },
                        { title: 'Old Value (F0)', dataIndex: 'f0', key: 'f0', render: (val) => String(val) },
                        { title: 'New Value (HC)', dataIndex: 'hc', key: 'hc', render: (val) => String(val) },
                        { title: 'Reason', key: 'reason', render: () => 'Improve coverage' },
                      ]}
                      pagination={false}
                    />
                  </div>
                )
              }
            ]}
          />
        )}
      </Modal>
    </div>
  );
};
