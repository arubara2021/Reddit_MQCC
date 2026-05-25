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
            background: 'var(--bg-base, #08090d)',
            color: 'var(--text-primary, #f1f5f9)',
            fontFamily: "var(--font-display, 'Space Grotesk', 'Inter', -apple-system, sans-serif)",
            padding: 24,
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 'var(--radius-xl, 12px)',
                background: 'var(--critical-bg, rgba(244, 63, 94, 0.08))',
                border: '1px solid var(--critical-border, rgba(244, 63, 94, 0.2))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                boxShadow: '0 0 20px rgba(244, 63, 94, 0.08)',
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--critical, #f43f5e)"
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
                fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 8,
                lineHeight: 1.3,
                letterSpacing: '-0.01em',
              }}
            >
              Something went wrong
            </h2>

            <p
              style={{
                fontSize: 12,
                color: 'var(--text-muted, #52525b)',
                lineHeight: 1.6,
                marginBottom: 24,
                fontFamily: "var(--font-sans, 'Inter', -apple-system, sans-serif)",
              }}
            >
              The dashboard encountered an unexpected error. Reloading the page should fix it.
            </p>

            {this.state.error && (
              <div
                style={{
                  background: 'var(--critical-bg, rgba(244, 63, 94, 0.06))',
                  border: '1px solid var(--critical-border, rgba(244, 63, 94, 0.15))',
                  borderRadius: 'var(--radius-lg, 8px)',
                  padding: '12px 16px',
                  marginBottom: 20,
                  textAlign: 'left',
                }}
              >
                <code
                  style={{
                    fontSize: 11,
                    color: 'var(--critical, #f43f5e)',
                    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                    wordBreak: 'break-all',
                    lineHeight: 1.5,
                    opacity: 0.8,
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
                padding: '10px 24px',
                borderRadius: 'var(--radius-lg, 8px)',
                background: 'var(--accent, #8b5cf6)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px var(--accent-glow, rgba(139, 92, 246, 0.25))',
                transition: 'all 0.15s ease',
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
