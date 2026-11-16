import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Search, Printer, Download, QrCode, Loader2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';

const QRManagement = () => {
  const { tools, loading } = useStore();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTools = tools.filter(tool => {
    const name = (tool.name || '').toString().toLowerCase();
    const id = (tool.id || '').toString().toLowerCase();
    const search = searchTerm.toLowerCase();
    return name.includes(search) || id.includes(search);
  });

  const handlePrint = () => {
    window.print();
  };

  const sanitizeFilenamePart = (val, fallback = 'unknown') => {
    const cleaned = String(val ?? '').trim().replace(/[\\/:*?"<>|]+/g, '_');
    return cleaned || fallback;
  };

  const downloadQR = (toolId, toolName) => {
    if (!toolId) return;
    const canvas = document.getElementById(`qr-${toolId}`);
    if (!canvas) return;
    const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    let downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `QR_${sanitizeFilenamePart(toolId, 'id')}_${sanitizeFilenamePart(toolName, 'tool')}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  if (loading) {
    return (
      <div className="loading-state">
        <Loader2 size={48} className="animate-spin" />
        <p>กำลังโหลดข้อมูลอุปกรณ์...</p>
      </div>
    );
  }

  return (
    <div className="qr-mgmt-container">
      {/* Search and Actions */}
      <div className="action-bar no-print">
        <div className="search-box">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Search tools by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn-print" onClick={handlePrint}>
          <Printer size={20} />
          <span>Print All QR Codes</span>
        </button>
      </div>

      {/* QR Code Grid */}
      <div className="qr-grid">
        {filteredTools.map((tool, idx) => (
          <div key={tool.id || `missing-${idx}`} className="qr-card">
            <div className="qr-display">
              {tool.id ? (
                <QRCodeCanvas
                  id={`qr-${tool.id}`}
                  value={tool.id.toString()}
                  size={128}
                  level={"H"}
                  includeMargin={true}
                />
              ) : (
                <div className="qr-error-placeholder">
                  <span className="error-text">Missing ID</span>
                </div>
              )}
            </div>
            <div className="qr-info">
              <span className="print-label no-print-visible">Tool Label (Thai Lion Air)</span>
              <h3>{tool.name || 'Unknown Tool'}</h3>
              <p className={`tool-id ${!tool.id ? 'id-error' : ''}`}>
                ID: {tool.id || 'MISSING'}
              </p>
              <p className="tool-loc">Location: {tool.location || '-'}</p>
            </div>
            <div className="qr-actions no-print">
              <button
                className="btn-icon"
                onClick={() => downloadQR(tool.id, tool.name)}
                disabled={!tool.id}
                title={tool.id ? 'Download PNG' : 'Cannot download without Tool ID'}
              >
                <Download size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredTools.length === 0 && (
        <div className="empty-state">
          <QrCode size={48} />
          <p>No tools found matching your search.</p>
        </div>
      )}

      <style>{`
        .qr-mgmt-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .action-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }

        .search-box {
          position: relative;
          flex: 1;
          max-width: 400px;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-secondary);
        }

        .search-box input {
          width: 100%;
          padding: 12px 12px 12px 40px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-family: inherit;
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.2s;
        }

        .search-box input:focus {
          border-color: var(--primary-color);
        }

        .btn-print {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background-color: var(--primary-color);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-print:hover {
          background-color: #9f1239;
        }

        .qr-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 20px;
        }

        .qr-card {
          background: white;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .qr-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }

        .qr-display {
          background: white;
          padding: 10px;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .qr-info h3 {
          margin: 0 0 4px 0;
          font-size: 1rem;
          color: var(--text-main);
        }

        .tool-id {
          margin: 0;
          font-weight: 700;
          color: var(--primary-color);
          font-size: 0.9rem;
        }

        .tool-id.id-error {
          color: var(--danger-color);
          background: #fee2e2;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .tool-loc {
          margin: 4px 0 0 0;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .qr-actions {
          margin-top: 16px;
          display: flex;
          gap: 8px;
        }

        .btn-icon {
          padding: 8px;
          background: #f8fafc;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-icon:hover {
          background: #f1f5f9;
          color: var(--primary-color);
          border-color: var(--primary-color);
        }

        .empty-state {
          padding: 60px;
          text-align: center;
          color: var(--text-secondary);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          color: var(--text-secondary);
          gap: 16px;
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .no-print-visible {
          display: none;
        }

        .qr-error-placeholder {
          width: 128px;
          height: 128px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fee2e2;
          border: 1px dashed var(--danger-color);
          border-radius: 8px;
        }

        .error-text {
          color: var(--danger-color);
          font-size: 0.75rem;
          font-weight: bold;
        }

        /* Print Optimization */
        @media print {
          .no-print {
            display: none !important;
          }
          
          .qr-mgmt-container {
            margin: 0;
            padding: 0;
          }

          .qr-grid {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .qr-card {
            display: flex;
            flex-direction: row !important;
            align-items: center;
            text-align: left !important;
            border: 1px solid #000;
            border-radius: 4px;
            padding: 12px;
            break-inside: avoid;
            gap: 24px;
            width: 100%;
            margin-bottom: 8px;
            background: white !important;
            transition: none !important;
            box-shadow: none !important;
          }

          .qr-display {
            margin: 0 !important;
            padding: 0 !important;
          }

          .qr-display canvas {
            width: 80px !important;
            height: 80px !important;
          }

          .qr-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .no-print-visible {
            display: block;
          }

          .print-label {
            font-size: 10px;
            color: #666;
            margin-bottom: 2px;
            font-weight: bold;
            text-transform: uppercase;
          }

          .qr-info h3 {
            font-size: 16px;
            margin: 0;
            color: black !important;
          }

          .tool-id {
            font-size: 13px;
            color: #000 !important;
            font-weight: 700;
          }

          .tool-loc {
            font-size: 11px;
            margin: 0;
            color: #444 !important;
          }

          body {
            background: white !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
};

export default QRManagement;
