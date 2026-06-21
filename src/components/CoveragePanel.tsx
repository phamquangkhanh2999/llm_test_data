import React from 'react';
import { ShieldCheck, Crosshair, Target, AlertCircle } from 'lucide-react';
import type { CoverageBreakdown } from '../types/testcase';

interface CoveragePanelProps {
  coverage: CoverageBreakdown;
}

export const CoveragePanel: React.FC<CoveragePanelProps> = ({ coverage }) => {
  const renderBar = (label: string, icon: React.ReactNode, value: number, color: string, bgCol: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 'bold' }}>
          {icon} {label}
        </span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>{Math.round(value)}%</span>
      </div>
      <div style={{ width: '100%', height: '8px', background: bgCol, borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, Math.round(value)))}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 1s ease-in-out' }} />
      </div>
    </div>
  );

  return (
    <div className="glass-card flex flex-col gap-md" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px' }}>
      <div className="flex justify-between align-center" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <h3 className="flex align-center gap-sm" style={{ margin: 0, color: 'var(--text-primary)', fontSize: '16px' }}>
          <ShieldCheck size={18} style={{ color: 'var(--color-teal)' }} /> 
          Tổng quan độ phủ kiểm thử (Coverage Overview)
        </h3>
        <span style={{ fontSize: '12px', background: 'rgba(13, 148, 136, 0.1)', color: 'var(--color-teal)', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
          Tổng quát: {Math.round(coverage.overall || 0)}%
        </span>
      </div>

      <div className="grid-3" style={{ gap: '24px', marginTop: '8px' }}>
        {renderBar('Functional Coverage', <Crosshair size={14} />, coverage.functional || 0, '#3b82f6', 'rgba(59, 130, 246, 0.1)')}
        {renderBar('Boundary Coverage', <Target size={14} />, coverage.boundary || 0, '#10b981', 'rgba(16, 185, 129, 0.1)')}
        {renderBar('Negative Coverage', <AlertCircle size={14} />, coverage.negative || 0, '#f59e0b', 'rgba(245, 158, 11, 0.1)')}
      </div>
    </div>
  );
};
