import React, { useState, useMemo, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Search, Printer, Download, QrCode, Loader2, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import Modal from './Modal';

const PAGE_SIZE = 24;
const PRINT_WARN_THRESHOLD = 150;

const getLocationGroup = (location) => {
  const raw = String(location ?? '').trim();
  if (!raw || raw === '-') return 'ไม่ระบุตำแหน่ง';
  const noMatch = raw.match(/^(.*?)\s+No\.\s*\d+/i);
  if (noMatch && noMatch[1]) return noMatch[1].trim();
  const prefixMatch = raw.match(/^(Wall\s+\d+(?:\s+Socket)?|GT\s*\d+)/i);
  if (prefixMatch) return prefixMatch[1].trim();
  return raw;
};

const QRManagement = () => {
  const { tools, loading } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [isPrintingFiltered, setIsPrintingFiltered] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '' });

  // Build sorted list of unique location groups (Wall 1, Wall 2, GT1, ...)
  const locationGroups = useMemo(() => {
    const counts = new Map();
    tools.forEach((tool) => {
      const grp = getLocationGroup(tool.location);
      counts.set(grp, (counts.get(grp) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [tools]);

  const filteredTools = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return tools.filter((tool) => {
      if (locationFilter !== 'ALL' && getLocationGroup(tool.location) !== locationFilter) {
        return false;
      }
      if (!search) return true;
      const name = String(tool.name ?? '').toLowerCase();
      const id = String(tool.id ?? '').toLowerCase();
      const loc = String(tool.location ?? '').toLowerCase();
      return name.includes(search) || id.includes(search) || loc.includes(search);
    });
  }, [tools, searchTerm, locationFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTools.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, locationFilter]);

  useEffect(() => {
    if (!isPrintingFiltered) return;
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      setIsPrintingFiltered(false);
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    let fallbackTimer = null;
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        fallbackTimer = setTimeout(cleanup, 1000);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      window.removeEventListener('afterprint', cleanup);
    };
  }, [isPrintingFiltered]);

  const visibleTools = useMemo(() => {
    if (isPrintingFiltered) return filteredTools;
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredTools.slice(start, start + PAGE_SIZE);
  }, [filteredTools, safePage, isPrintingFiltered]);

  const handlePrintPage = () => {
    window.print();
  };

  const handlePrintFiltered = () => {
    if (filteredTools.length === 0) return;
    if (filteredTools.length > PRINT_WARN_THRESHOLD) {
      setConfirmModal({
        isOpen: true,
        message: `กำลังจะพิมพ์ QR Code ทั้งหมด ${filteredTools.length} รายการ อาจทำให้เครื่องมือถือค้างได้ แนะนำให้เลือกกรองตาม Wall / ตำแหน่งก่อน ต้องการดำเนินการต่อหรือไม่?`
      });
      return;
    }
    setIsPrintingFiltered(true);
  };

  const sanitizeFilenamePart = (val, fallback = 'unknown') => {
    const cleaned = String(val ?? '').trim().replace(/[\\/:*?"<>|]+/g, '_');
    return cleaned || fallback;
  };

  const downloadQR = (toolId, toolName) => {
    if (!toolId) return;
    const canvas = document.getElementById(`qr-${toolId}`);
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
    const downloadLink = document.createElement('a');
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
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, message: '' })}
        type="confirm"
        title="ยืนยันการพิมพ์จำนวนมาก"
        message={confirmModal.message}
        confirmText="พิมพ์ทั้งหมด"
        onConfirm={() => setIsPrintingFiltered(true)}
      />

      {/* Search, Wall Filter, and Scoped Print Actions */}
      <div className="action-bar no-print">
        <div className="filter-controls">
          <div className="search-box">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, รหัส, หรือตำแหน่ง..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="location-filter">
            <MapPin size={18} className="filter-icon" />
            <select
              aria-label="กรองตามตำแหน่ง / Wall"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="ALL">ทุกตำแหน่ง ({tools.length})</option>
              {locationGroups.map(([group, count]) => (
                <option key={group} value={group}>
                  {group} ({count})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="print-actions">
          <button
            className="btn-print btn-print-secondary"
            onClick={handlePrintPage}
            disabled={visibleTools.length === 0}
          >
            <Printer size={18} />
            <span>พิมพ์หน้านี้ ({isPrintingFiltered ? Math.min(PAGE_SIZE, filteredTools.length) : visibleTools.length})</span>
          </button>
          <button
            className="btn-print"
            onClick={handlePrintFiltered}
            disabled={filteredTools.length === 0}
          >
            <Printer size={18} />
            <span>พิมพ์ตามตัวกรอง ({filteredTools.length})</span>
          </button>
        </div>
      </div>

      {/* Pagination Bar (Top) */}
      {filteredTools.length > 0 && (
        <div className="qr-pagination no-print">
          <span className="qr-summary-text">
            แสดง {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredTools.length)} จาก {filteredTools.length} รายการ
          </span>
          <div className="pagination-buttons">
            <button
              className="btn-page"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="หน้าก่อนหน้า"
            >
              <ChevronLeft size={18} />
              <span>ก่อนหน้า</span>
            </button>
            <span className="page-indicator">หน้า {safePage} / {totalPages}</span>
            <button
              className="btn-page"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              aria-label="หน้าถัดไป"
            >
              <span>ถัดไป</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* QR Code Grid */}
      <div className="qr-grid">
        {visibleTools.map((tool, idx) => (
          <div key={tool.id || `missing-${idx}`} className="qr-card">
            <div className="qr-display">
              {tool.id ? (
                <QRCodeCanvas
                  id={`qr-${tool.id}`}
                  value={tool.id.toString()}
                  size={128}
                  level="H"
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
                aria-label={tool.id ? `Download QR ${tool.id}` : 'Cannot download without Tool ID'}
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
          gap: 20px;
        }

        .action-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }

        .filter-controls {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          flex: 1;
          min-width: 260px;
        }

        .search-box {
          position: relative;
          flex: 1;
          min-width: 220px;
          max-width: 360px;
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
          padding: 10px 12px 10px 40px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-family: inherit;
          font-size: 0.95rem;
          outline: none;
          transition: border-color 0.2s;
          background: white;
        }

        .search-box input:focus {
          border-color: var(--primary-color);
        }

        .location-filter {
          position: relative;
          display: flex;
          align-items: center;
        }

        .filter-icon {
          position: absolute;
          left: 10px;
          color: var(--text-secondary);
          pointer-events: none;
        }

        .location-filter select {
          padding: 10px 12px 10px 34px;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: white;
          font-family: inherit;
          font-size: 0.92rem;
          color: var(--text-main);
          outline: none;
          cursor: pointer;
        }

        .location-filter select:focus {
          border-color: var(--primary-color);
        }

        .print-actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .btn-print {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background-color: var(--primary-color);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-print:hover:not(:disabled) {
          background-color: #9f1239;
        }

        .btn-print:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-print-secondary {
          background-color: white;
          color: var(--text-main);
          border: 1px solid var(--border-color);
        }

        .btn-print-secondary:hover:not(:disabled) {
          background-color: #f8fafc;
          border-color: var(--primary-color);
          color: var(--primary-color);
        }

        .qr-pagination {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          padding: 10px 14px;
          background: white;
          border: 1px solid var(--border-color);
          border-radius: 8px;
        }

        .qr-summary-text {
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .pagination-buttons {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .btn-page {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border: 1px solid var(--border-color);
          background: white;
          border-radius: 6px;
          font-family: inherit;
          font-size: 0.88rem;
          cursor: pointer;
          color: var(--text-main);
        }

        .btn-page:hover:not(:disabled) {
          background: #f1f5f9;
        }

        .btn-page:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .page-indicator {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-main);
          min-width: 90px;
          text-align: center;
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
