import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("TestForge Error Boundary caught:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--bg-space, #F8FCFC)',
          color: 'var(--text-primary, #1F2937)',
          padding: '40px 24px',
          gap: '20px',
          fontFamily: 'Inter, sans-serif',
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px',
          }}>
            ⚠️
          </div>

          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            Đã xảy ra lỗi không mong muốn
          </h1>

          <p style={{
            fontSize: '14px', color: 'var(--text-secondary, #6B7280)',
            textAlign: 'center', maxWidth: '480px', lineHeight: 1.6, margin: 0,
          }}>
            Ứng dụng gặp sự cố khi render giao diện. Dữ liệu của bạn vẫn an toàn.
            Vui lòng thử tải lại trang.
          </p>

          {this.state.error && (
            <pre style={{
              background: '#FFFFFF',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '8px',
              padding: '12px 16px',
              fontSize: '12px',
              color: 'var(--error, #EF4444)',
              maxWidth: '520px',
              overflowX: 'auto',
              fontFamily: 'var(--font-mono, monospace)',
              boxShadow: 'var(--shadow-sm)',
              margin: 0,
            }}>
              {this.state.error.message}
            </pre>
          )}

          <button
            onClick={this.handleRetry}
            style={{
              padding: '12px 28px', borderRadius: '10px',
              background: 'var(--color-teal, #0D9488)',
              border: 'none', color: '#fff', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(13,148,136,0.25)',
            }}
          >
            🔄 Thử tải lại
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
