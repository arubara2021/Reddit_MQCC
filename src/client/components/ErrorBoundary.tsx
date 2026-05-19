// FILE 11: src/client/components/ErrorBoundary.tsx

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-base, #0a0c10)',
            color: 'var(--text-primary, #e8ecf4)',
            fontFamily: "var(--font-sans, 'Inter', -apple-system, sans-serif)",
            padding: 24,
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 8,
                lineHeight: 1.3,
              }}
            >
              Something went wrong
            </h2>

            <p
              style={{
                fontSize: 12,
                color: 'var(--text-muted, #4a5568)',
                lineHeight: 1.5,
                marginBottom: 24,
              }}
            >
              The dashboard encountered an unexpected error. Reloading the page should fix it.
            </p>

            {this.state.error && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  borderRadius: 6,
                  padding: '10px 14px',
                  marginBottom: 20,
                  textAlign: 'left',
                }}
              >
                <code
                  style={{
                    fontSize: 11,
                    color: '#fca5a5',
                    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                    wordBreak: 'break-all',
                    lineHeight: 1.5,
                  }}
                >
                  {this.state.error.message}
                </code>
              </div>
            )}

            <button
              onClick={this.handleReload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontWeight: 600,
                fontSize: 12,
                padding: '8px 20px',
                borderRadius: 6,
                background: 'var(--accent, #4f8ff7)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
