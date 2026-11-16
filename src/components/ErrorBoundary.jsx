import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import './ErrorBoundary.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: (error && error.message) ? error.message : String(error || 'Unknown error')
    };
  }

  componentDidCatch(error, info) {
    console.error('UI ErrorBoundary caught an error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-box" role="alert">
          <div className="error-boundary-card">
            <AlertTriangle size={40} className="error-boundary-icon" />
            <h2>เกิดข้อผิดพลาดในการแสดงผล</h2>
            <p className="error-boundary-detail">{this.state.errorMessage}</p>
            <div className="error-boundary-actions">
              <button type="button" className="eb-btn-secondary" onClick={this.handleReset}>
                ลองแสดงหน้านี้ใหม่
              </button>
              <button type="button" className="eb-btn-primary" onClick={this.handleReload}>
                <RotateCcw size={16} />
                รีเฟรชหน้าเว็บ
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
