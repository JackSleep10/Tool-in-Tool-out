import { useState, useMemo, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Search, Printer, Download, QrCode, Loader2, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { getLocationGroup } from '../utils/tools';
import Modal from './Modal';
import './QRManagement.css';

const PAGE_SIZE = 24;
const PRINT_WARN_THRESHOLD = 150;

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
    </div>
  );
};

export default QRManagement;
