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
          background: 'var(--bg-space, #030712)',
          color: '#fff',
          padding: '40px 24px',
          gap: '20px',
          fontFamily: 'Inter, sans-serif',
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px',
            background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px',
          }}>
            ⚠️
          </div>

          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            Đã xảy ra lỗi không mong muốn
          </h1>

          <p style={{
            fontSize: '14px', color: 'var(--text-secondary, #94a3b8)',
            textAlign: 'center', maxWidth: '480px', lineHeight: 1.6, margin: 0,
          }}>
            Ứng dụng gặp sự cố khi render giao diện. Dữ liệu của bạn vẫn an toàn.
            Vui lòng thử tải lại trang.
          </p>

          {this.state.error && (
            <pre style={{
              background: 'rgba(15,23,42,0.8)',
              border: '1px solid rgba(244,63,94,0.2)',
              borderRadius: '8px',
              padding: '12px 16px',
              fontSize: '12px',
              color: '#fda4af',
              maxWidth: '520px',
              overflowX: 'auto',
              fontFamily: 'var(--font-mono, monospace)',
              margin: 0,
            }}>
              {this.state.error.message}
            </pre>
          )}

          <button
            onClick={this.handleRetry}
            style={{
              padding: '12px 28px', borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--color-teal, #2dd4bf), #0d9488)',
              border: 'none', color: '#000', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(45,212,191,0.25)',
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
