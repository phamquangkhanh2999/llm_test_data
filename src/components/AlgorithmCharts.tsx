import React from 'react';

export const AlgorithmCharts: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px' }}>
      <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
        <h3 style={{ color: '#fff', marginBottom: '16px', fontSize: '16px' }}>Bước 1: Khởi tạo và Phân loại</h3>
        <img src="/diagrams/image1.png" alt="Bước 1" style={{ width: '100%', maxWidth: '800px', borderRadius: '8px' }} />
      </div>

      <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
        <h3 style={{ color: '#fff', marginBottom: '16px', fontSize: '16px' }}>Bước 2: Quá trình tinh chỉnh (Hill Climbing) - Hình 1</h3>
        <img src="/diagrams/image2.png" alt="Bước 2 Hình 1" style={{ width: '100%', maxWidth: '800px', borderRadius: '8px' }} />
      </div>

      <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
        <h3 style={{ color: '#fff', marginBottom: '16px', fontSize: '16px' }}>Bước 2: Quá trình tinh chỉnh (Hill Climbing) - Hình 2</h3>
        <img src="/diagrams/image3.png" alt="Bước 2 Hình 2" style={{ width: '100%', maxWidth: '800px', borderRadius: '8px' }} />
      </div>
    </div>
  );
};
