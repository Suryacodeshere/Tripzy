import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import App from './App.jsx';
import './styles/main.scss';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Tripzy Application Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#F9FAFB',
          color: '#111827',
          padding: '24px',
          textAlign: 'center',
          fontFamily: "'Outfit', sans-serif"
        }}>
          <div style={{
            display: 'inline-block',
            background: '#FDB813',
            color: '#111827',
            fontWeight: 900,
            fontSize: '1.5rem',
            padding: '6px 22px',
            borderRadius: '24px',
            marginBottom: '20px',
            boxShadow: '0 4px 15px rgba(253, 184, 19, 0.3)'
          }}>
            tripzy
          </div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '8px', color: '#1F2937' }}>
            Application Recovery
          </h2>
          <p style={{ maxWidth: '420px', color: '#6B7280', fontSize: '0.9rem', marginBottom: '24px', lineHeight: 1.5 }}>
            {this.state.error?.message || 'A temporary interface glitch occurred. Click below to refresh your session.'}
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#FDB813',
                color: '#111827',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Reload Page
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.href = '/';
              }}
              style={{
                background: '#111827',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Reset Session
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
