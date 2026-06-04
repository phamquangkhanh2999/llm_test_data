import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
}

/**
 * Reusable tab bar component. Used to group related sub-screens
 * within a single workflow step (e.g. AI Parse | Upload in step 1).
 */
export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange }) => {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: '6px',
        padding: '5px',
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px',
        marginBottom: '4px',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const color = tab.color ?? 'var(--color-teal)';
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: isActive ? `1px solid ${color}55` : '1px solid transparent',
              background: isActive ? `${color}18` : 'transparent',
              color: isActive ? color : 'var(--text-muted)',
              fontSize: '13.5px',
              fontWeight: isActive ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseOver={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
            }}
            onMouseOut={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            {tab.icon && <span style={{ display: 'flex', flexShrink: 0 }}>{tab.icon}</span>}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
