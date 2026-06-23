import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Trash2, AlertTriangle, Terminal, Cpu, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { config } from '../config';

interface AICallLog {
  id: string;
  timestamp: string | null;
  endpoint: string;
  provider: string;
  model: string;
  input_summary: string | null;
  output_summary: string | null;
  token_count_estimate: number | null;
  status: string;
  error_message: string | null;
}

interface AILogsViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AILogsViewer: React.FC<AILogsViewerProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<AICallLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/ai-logs`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Lỗi khi tải nhật ký AI:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử nhật ký cuộc gọi AI?')) {
      return;
    }
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/ai-logs`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setLogs([]);
        setExpandedLogId(null);
      }
    } catch (error) {
      console.error('Lỗi khi xóa nhật ký AI:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isOpen && autoRefresh) {
      timer = setInterval(fetchLogs, 5000); // Tự động làm mới mỗi 5 giây
    }
    return () => clearInterval(timer);
  }, [isOpen, autoRefresh]);

  if (!isOpen) return null;

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '560px',
        maxWidth: '100vw',
        background: 'var(--bg-card)',
        borderLeft: '1px solid var(--border-subtle)',
        boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.05)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(20px)',
        animation: 'slide-in 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* HEADER */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(0, 0, 0, 0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Terminal style={{ color: 'var(--color-teal)' }} size={20} />
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)', fontWeight: 600 }}>Nhật Ký Cuộc Gọi LLM</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Theo dõi token &amp; tham số gọi AI thời gian thực</span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          <X size={20} />
        </button>
      </div>

      {/* ACTIONS TOOLBAR */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(0, 0, 0, 0.01)',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ accentColor: 'var(--color-teal)' }}
            />
            <span>Tự động làm mới (5s)</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchLogs}
            disabled={loading}
            style={{
              background: 'rgba(0,0,0,0.02)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.02)')}
          >
            <RefreshCw size={13} className={loading ? 'spin-anim' : ''} />
            <span>Làm mới</span>
          </button>

          <button
            onClick={clearLogs}
            disabled={logs.length === 0}
            style={{
              background: 'rgba(225, 29, 72, 0.05)',
              border: '1px solid rgba(225, 29, 72, 0.15)',
              color: 'var(--color-rose)',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(225, 29, 72, 0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(225, 29, 72, 0.05)')}
          >
            <Trash2 size={13} />
            <span>Xóa hết</span>
          </button>
        </div>
      </div>

      {/* LOGS LIST */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }} className="custom-scrollbar">
        {logs.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '240px',
              color: 'var(--text-muted)',
              gap: '12px',
            }}
          >
            <Terminal size={40} style={{ opacity: 0.3, color: 'var(--color-teal)' }} />
            <span style={{ fontSize: '13px' }}>Chưa có cuộc gọi LLM nào được ghi nhận.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const isSuccess = log.status === 'SUCCESS';
              const isMock = log.provider === 'Mock';

              return (
                <div
                  key={log.id}
                  style={{
                    border: '1px solid',
                    borderColor: isExpanded
                      ? 'rgba(13, 148, 136, 0.3)'
                      : isSuccess
                        ? 'var(--border-subtle)'
                        : 'rgba(225, 29, 72, 0.25)',
                    borderRadius: '8px',
                    background: isExpanded
                      ? 'rgba(13, 148, 136, 0.04)'
                      : isSuccess
                        ? 'rgba(0, 0, 0, 0.01)'
                        : 'rgba(225, 29, 72, 0.02)',
                    transition: 'all 0.2s ease',
                    overflow: 'hidden',
                  }}
                >
                  {/* LOG HEADER */}
                  <div
                    onClick={() => toggleExpand(log.id)}
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                      {/* Status Dot */}
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: isSuccess ? 'var(--color-teal)' : 'var(--color-rose)',
                          boxShadow: isSuccess ? '0 0 6px var(--color-teal)' : '0 0 6px var(--color-rose)',
                          flexShrink: 0,
                        }}
                      />

                      {/* Endpoint Method / Path */}
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '12px',
                          color: 'var(--text-primary)',
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {log.endpoint}
                      </span>

                      {/* Provider Badge */}
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: isMock
                            ? 'rgba(100, 116, 139, 0.1)'
                            : log.provider === 'Gemini'
                              ? 'rgba(59, 130, 246, 0.1)'
                              : 'rgba(124, 58, 237, 0.1)',
                          color: isMock
                            ? 'var(--text-muted)'
                            : log.provider === 'Gemini'
                              ? '#3b82f6'
                              : '#7c3AED',
                          border: '1px solid',
                          borderColor: isMock
                            ? 'rgba(100, 116, 139, 0.2)'
                            : log.provider === 'Gemini'
                              ? 'rgba(59, 130, 246, 0.2)'
                              : 'rgba(124, 58, 237, 0.2)',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {log.model}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                      {/* Chars / Token estimate info */}
                      {log.token_count_estimate !== null && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Cpu size={12} />
                          <span>~{log.token_count_estimate} tk</span>
                        </span>
                      )}

                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        <span>{formatTime(log.timestamp)}</span>
                      </span>

                      {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                    </div>
                  </div>

                  {/* LOG BODY */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: '16px',
                        borderTop: '1px solid var(--border-subtle)',
                        background: 'rgba(0, 0, 0, 0.02)',
                      }}
                    >
                      {/* Error block if failed */}
                      {!isSuccess && log.error_message && (
                        <div
                          style={{
                            padding: '10px 14px',
                            background: 'rgba(225, 29, 72, 0.05)',
                            border: '1px solid rgba(225, 29, 72, 0.2)',
                            borderRadius: '6px',
                            color: 'var(--color-rose)',
                            fontSize: '12px',
                            marginBottom: '12px',
                            display: 'flex',
                            gap: '8px',
                          }}
                        >
                          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <strong style={{ display: 'block', marginBottom: '2px' }}>Lỗi cuộc gọi LLM:</strong>
                            <span style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{log.error_message}</span>
                          </div>
                        </div>
                      )}

                      {/* Request Prompt */}
                      {log.input_summary && (
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span>👉 Request / Input Prompt</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>({log.input_summary.length} ký tự)</span>
                          </div>
                          <pre
                            style={{
                              margin: 0,
                              padding: '12px',
                              background: '#f8fafc',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-primary)',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                              maxHeight: '180px',
                              overflowY: 'auto',
                            }}
                          >
                            {log.input_summary}
                          </pre>
                        </div>
                      )}

                      {/* Response Output */}
                      {log.output_summary && (
                        <div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span>👈 Response / Output JSON</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>({log.output_summary.length} ký tự)</span>
                          </div>
                          <pre
                            style={{
                              margin: 0,
                              padding: '12px',
                              background: '#f8fafc',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--color-teal)',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                              maxHeight: '240px',
                              overflowY: 'auto',
                            }}
                          >
                            {(() => {
                              try {
                                return JSON.stringify(JSON.parse(log.output_summary), null, 2);
                              } catch {
                                return log.output_summary;
                              }
                            })()}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .spin-anim {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
};
