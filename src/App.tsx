import {
  Activity,
  CheckCircle2,
  Database,
  Download,
  Sparkles,
  Zap
} from 'lucide-react';
import React from 'react';
import { AILogsViewer } from './components/AILogsViewer';
import { DataImport } from './components/DataImport';
import { HistoryManager } from './components/HistoryManager';
import { Layout } from './components/Layout';
import { OptimizationDashboard } from './components/OptimizationDashboard';
import { PageLayout } from './components/PageLayout';
import { SpecInput } from './components/SpecInput';
import { Tabs } from './components/Tabs';
import { ToastContainer } from './components/ToastContainer';
import { useAppStore } from './store/useAppStore';

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  // Tab state within steps
  const [prepareTab, setPrepareTab] = React.useState<string>('ai');
  const [isAILogsOpen, setIsAILogsOpen] = React.useState(false);

  const {
    schemaName,
    parsedSchema,
    activeScreen,
    setActiveScreen,
    completedScreens,
    initialSeeds,
    historyRuns,
    optimizedDataset,
    llmProvider,
    setLlmProvider,
  } = useAppStore();

  const hasInputData = parsedSchema.length > 0 && initialSeeds.length > 0;
  const hasOptimizedResult = optimizedDataset.length > 0;
  const hasHistory = historyRuns.length > 0;

  const menuItems = [
    {
      id: 'prepare',
      label: (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <span>1. Phân Tích & Chuẩn Bị</span>
          {completedScreens.includes('prepare') && activeScreen !== 'prepare' && (
            <CheckCircle2 size={13} style={{ color: '#10b981', flexShrink: 0 }} />
          )}
        </div>
      ),
      icon: <Database size={16} />,
    },
    {
      id: 'optimize',
      label: (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <span>2. Tối Ưu & So Sánh</span>
          {completedScreens.includes('optimize') && activeScreen !== 'optimize' && (
            <CheckCircle2 size={13} style={{ color: '#10b981', flexShrink: 0 }} />
          )}
        </div>
      ),
      icon: <Activity size={16} />,
    },
    {
      id: 'export',
      label: (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <span>3. Lịch Sử & Xuất Kết Quả</span>
          {completedScreens.includes('export') && activeScreen !== 'export' && (
            <CheckCircle2 size={13} style={{ color: '#10b981', flexShrink: 0 }} />
          )}
        </div>
      ),
      icon: <Download size={16} />,
    },
  ];

  const headerTitle = (
    <div
      style={{
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          paddingRight: '16px',
          borderRight: '1.5px solid var(--border-subtle)',
        }}
      >
        <Sparkles size={13} style={{ color: 'var(--color-teal)', flexShrink: 0 }} />
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Kịch bản:{' '}
          <b style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{schemaName || '—'}</b>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Activity size={13} style={{ color: 'var(--color-violet)' }} />
        <span>
          Ràng buộc:{' '}
          <b style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{parsedSchema.length}</b>
        </span>
      </div>
    </div>
  );

  const headerRight = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      {/* LLM Provider Selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(0,0,0,0.03)',
          border: '1.5px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '2px',
          gap: '2px',
        }}
      >
        <button
          onClick={() => setLlmProvider('gemini')}
          style={{
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            transition: 'all 0.2s',
            background: llmProvider === 'gemini' ? '#fff' : 'transparent',
            color: llmProvider === 'gemini' ? 'var(--color-teal)' : 'var(--text-muted)',
            boxShadow: llmProvider === 'gemini' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          <Sparkles size={12} style={{ color: llmProvider === 'gemini' ? 'var(--color-teal)' : 'inherit' }} />
          Gemini
        </button>
        <button
          onClick={() => setLlmProvider('openai')}
          style={{
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            transition: 'all 0.2s',
            background: llmProvider === 'openai' ? '#fff' : 'transparent',
            color: llmProvider === 'openai' ? '#10a37f' : 'var(--text-muted)',
            boxShadow: llmProvider === 'openai' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          <Zap size={12} style={{ color: llmProvider === 'openai' ? '#10a37f' : 'inherit' }} />
          OpenAI
        </button>
      </div>

      {/* API Key */}
      {/* <div
        style={{
          background: apiKey.trim().length > 10 ? 'rgba(15, 118, 110, 0.08)' : 'rgba(0,0,0,0.03)',
          padding: '7px 12px',
          borderRadius: '8px',
          border: '1.5px solid',
          borderColor:
            apiKey.trim().length > 10 ? 'rgba(15, 118, 110, 0.45)' : 'var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          minWidth: '220px',
        }}
      >
        <Activity
          size={13}
          style={{
            color: apiKey.trim().length > 10 ? 'var(--color-teal)' : 'var(--text-muted)',
            flexShrink: 0,
          }}
        />
        <input
          type='password'
          placeholder={llmProvider === 'gemini' ? 'Gemini API Key...' : 'OpenAI API Key...'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          style={{
            flex: 1,
            padding: '2px 6px',
            fontSize: '12px',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: apiKey.trim().length > 10 ? 'var(--color-teal)' : 'var(--text-primary)',
            minWidth: 0,
            fontWeight: 600,
          }}
        />
        {apiKey.trim().length > 10 && (
          <CheckCircle2 size={13} style={{ color: 'var(--color-teal)', flexShrink: 0 }} />
        )}
      </div> */}
    </div>
  );

  return (
    <Layout
      activeItemId={activeScreen}
      onItemSelect={setActiveScreen}
      menuItems={menuItems}
      headerTitle={headerTitle}
      headerRight={headerRight}
      user={{ name: 'Minh Thu', role: 'QA Engineer Manager', avatarInitials: 'MT' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
        {/* ══════════ BƯỚC 1: CHUẨN BỊ DỮ LIỆU ══════════ */}
        <div style={{ display: activeScreen === 'prepare' ? 'block' : 'none' }}>
          <PageLayout
            stepId='prepare'
            title='Bước 1: Phân Tích & Chuẩn Bị Dữ Liệu'
            icon={<Database size={24} />}
            description=''
            hints={[
              'AI phân tích đặc tả',
              'hoặc Upload JSON/CSV',
              'Tự sinh hạt giống F0',
              'Chuẩn bị cho thuật toán',
            ]}
            accentColor='#3b82f6'
          >
            <Tabs
              tabs={[
                {
                  id: 'ai',
                  label: 'Phân Tích Bằng AI',
                  icon: <Sparkles size={15} />,
                  color: '#3b82f6',
                },
                {
                  id: 'upload',
                  label: 'Tải Lên File (JSON/CSV)',
                  icon: <Database size={15} />,
                  color: '#D97706',
                },
              ]}
              activeTab={prepareTab}
              onChange={setPrepareTab}
            />
            {prepareTab === 'ai' ? <SpecInput /> : <DataImport />}
          </PageLayout>
        </div>

        {/* ══════════ BƯỚC 2: TỐI ƯU & SO SÁNH ══════════ */}
        <div style={{ display: activeScreen === 'optimize' ? 'block' : 'none' }}>
          <PageLayout
            stepId='optimize'
            title='Bước 2: Tối Ưu Hóa & So Sánh Thuật Toán'
            icon={<Zap size={24} />}
            description='Chạy đồng bộ các giải thuật tối ưu hóa di truyền GA phối hợp leo đồi HC và đối chiếu trực tuyến kết quả với thuật toán truyền thống BVA/Random.'
            contextNote='GA (Genetic Algorithm) tìm kiếm toàn cục bằng cách lai ghép, đột biến và chọn lọc các thế hệ test tốt hơn. HC (Hill Climbing) làm tinh chỉnh cục bộ quanh lời giải hiện tại để nâng chất lượng và độ ổn định.'
            hints={[
              'GA: tìm kiếm toàn cục',
              'HC: tinh chỉnh cục bộ',
              'Lai ghép GA -> HC',
              'Bao phủ biên & bảo mật',
            ]}
            accentColor='#7C3AED'
            prerequisites={[
              {
                met: hasInputData,
                warningText:
                  'Bạn chưa có dữ liệu đầu vào. Vui lòng quay lại Bước 1 để phân tích đặc tả hoặc tải lên dữ liệu.',
                goBackScreen: 'prepare',
                goBackLabel: 'Quay lại Bước 1: Phân Tích & Chuẩn Bị',
              },
            ]}
          >
            <OptimizationDashboard />
          </PageLayout>
        </div>

        {/* ══════════ BƯỚC 3: XUẤT KẾT QUẢ ══════════ */}
        <div style={{ display: activeScreen === 'export' ? 'block' : 'none' }}>
          <PageLayout
            stepId='export'
            title='Bước 3: Lịch Sử & Xuất Kết Quả'
            icon={<Download size={24} />}
            description=''
            hints={[
              'Tối giản bộ test',
              'Xuất CSV / JSON / SQL',
              'Playwright / Cypress / Postman',
              'Mô phỏng API validation',
            ]}
            accentColor='#0D9488'
            prerequisites={[
              {
                met: hasHistory || hasOptimizedResult,
                warningText:
                  'Chưa có kết quả tối ưu nào. Hãy chạy thuật toán ở Bước 2 ít nhất một lần.',
                goBackScreen: 'optimize',
                goBackLabel: 'Đến Bước 2: Tối Ưu & So Sánh',
              },
            ]}
          >
            <HistoryManager />
          </PageLayout>
        </div>

        <footer
          style={{
            padding: '24px 0 8px 0',
            fontSize: '11px',
            color: 'var(--text-muted)',
            borderTop: '1px solid var(--border-subtle)',
            textAlign: 'right',
            marginTop: '16px',
          }}
        >
          © 2026 TESTFORGE — Hệ thống Tối ưu hóa Thiết kế Kịch bản Kiểm thử
        </footer>
      </div>

      <AILogsViewer isOpen={isAILogsOpen} onClose={() => setIsAILogsOpen(false)} />
      <ToastContainer />
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.7); }
        }
      `}</style>
    </Layout>
  );
}

export default App;
