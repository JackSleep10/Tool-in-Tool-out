import { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Search, RotateCcw, CheckSquare, Square, UserCheck, QrCode, X } from 'lucide-react';
import { useQrScanner } from '../hooks/useQrScanner';
import { useModal } from '../hooks/useModal';
import { normalizeId } from '../utils/transactions';
import { matchSearch } from '../utils/tools';
import { formatThaiDateTime } from '../utils/date';
import Modal from './Modal';
import './ReturnForm.css';
const ReturnForm = () => {
    const { outstandingTransactions, addBatchTransactions, toolsByIdMap } = useStore();

    // State
    const [receiverName, setReceiverName] = useState(localStorage.getItem('staffReceiverName') || '');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const { modal, showModal, closeModal } = useModal();

    const filteredTransactions = useMemo(
        () =>
            outstandingTransactions.filter((tx) =>
                matchSearch(tx, searchTerm, [
                    'tool_name',
                    'tool_id',
                    'employee_name',
                    'employee_id',
                    'staff_issuer',
                    'remark'
                ])
            ),
        [outstandingTransactions, searchTerm]
    );

    // Selection Logic
    const toggleSelect = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredTransactions.length && filteredTransactions.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredTransactions.map(tx => tx.id));
        }
    };

    const processSearch = (value) => {
        const cleanId = normalizeId(value);
        if (!cleanId) return;

        // Try to identify if this is a tool ID match
        const relevantTxs = outstandingTransactions.filter(tx =>
            normalizeId(tx.tool_id) === cleanId
        );

        if (relevantTxs.length > 0) {
            const newIds = relevantTxs.map(tx => tx.id);
            setSelectedIds(prev => [...new Set([...prev, ...newIds])]);
            setSearchTerm(''); // Clear after successful scan match
        }
    };

    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            processSearch(searchTerm);
        }
    };

    const { isScanning, startScanning, stopScanning } = useQrScanner({
        elementId: 'reader-return',
        onScan: (decodedText, stop) => {
            stop();
            const scannedId = normalizeId(decodedText);
            const relevantTxs = scannedId
                ? outstandingTransactions.filter(tx => normalizeId(tx.tool_id) === scannedId)
                : [];

            if (relevantTxs.length > 0) {
                const newIds = relevantTxs.map(tx => tx.id);
                setSelectedIds(prev => [...new Set([...prev, ...newIds])]);
            } else {
                showModal('error', 'ไม่พบข้อมูล', `ไม่พบรายการค้างส่งสำหรับอุปกรณ์รหัส "${decodedText}"`);
            }
        },
        onError: (err) => {
            showModal('error', 'Camera Error', 'ไม่สามารถเข้าถึงกล้องได้: ' + err);
        }
    });

    const handleReturnClick = (tx) => {
        if (isSubmitting) return;
        if (!receiverName.trim()) {
            showModal('error', 'แจ้งเตือน', 'กรุณาระบุชื่อผู้รับคืน (Staff Receiver)');
            return;
        }

        const remarkText = String(tx.remark ?? '').trim();
        const remarkInfo = remarkText && remarkText !== '-' ? `\n(หมายเหตุตอนยืม: ${remarkText})` : '';
        showModal(
            'confirm',
            'ยืนยันการรับคืน',
            `ต้องการรับคืน "${tx.tool_name}" จาก ${tx.employee_name} ใช่หรือไม่?${remarkInfo}`,
            () => processReturnBatch([tx.id])
        );
    };

    const handleReturnSelected = () => {
        if (isSubmitting) return;
        if (!receiverName.trim()) {
            showModal('error', 'แจ้งเตือน', 'กรุณาระบุชื่อผู้รับคืน (Staff Receiver)');
            return;
        }
        if (selectedIds.length === 0) return;

        showModal(
            'confirm',
            'ยืนยันการรับคืนเป็นกลุ่ม',
            `ต้องการรับคืนอุปกรณ์ทั้งหมด ${selectedIds.length} รายการที่เลือก ใช่หรือไม่?`,
            () => processReturnBatch(selectedIds)
        );
    };

    const processReturnBatch = async (ids) => {
        if (isSubmitting) return;
        const trimmedReceiver = receiverName.trim();
        const idSet = new Set(ids);
        const txsToReturn = outstandingTransactions.filter(tx => idSet.has(tx.id));
        if (txsToReturn.length === 0) return;

        const batchData = txsToReturn.map(tx => ({
            action: 'RETURN',
            tool_id: tx.tool_id,
            tool_name: tx.tool_name,
            employee_id: tx.employee_id,
            employee_name: tx.employee_name,
            quantity: tx.quantity,
            staff_issuer: tx.staff_issuer,
            staff_receiver: trimmedReceiver,
            linked_borrow_id: tx.id,
            remark: '-'
        }));

        setIsSubmitting(true);
        try {
            await addBatchTransactions(batchData);
            localStorage.setItem('staffReceiverName', trimmedReceiver);
            setSelectedIds([]);
            showModal('success', 'สำเร็จ', `ดำเนินการรับคืน ${txsToReturn.length} รายการเรียบร้อยแล้ว`);
        } catch (err) {
            showModal('error', 'รับคืนไม่สำเร็จ', err.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="return-container">
            <Modal
                isOpen={modal.isOpen}
                onClose={closeModal}
                type={modal.type}
                title={modal.title}
                message={modal.message}
                onConfirm={modal.onConfirm}
                confirmText="ยืนยัน"
                cancelText="ยกเลิก"
            />

            <div className="return-header-card">
                <div className="header-grid">
                    <div className="input-field">
                        <label><UserCheck size={16} /> ผู้รับคืน (Staff Receiver)</label>
                        <div className="input-wrapper">
                            <input
                                type="text"
                                placeholder="ระบุชื่อผู้รับเครื่องมือคืน..."
                                value={receiverName}
                                onChange={e => setReceiverName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="input-field">
                        <label><Search size={16} /> ค้นหาพนักงาน/อุปกรณ์ (Search)</label>
                        <div className="input-wrapper">
                            <input
                                type="text"
                                placeholder="ค้นหาชื่อ, รหัสพนักงาน หรือ อุปกรณ์... (สแกน QR ได้)"
                                value={searchTerm}
                                onChange={e => {
                                    setSearchTerm(e.target.value);
                                    setSelectedIds([]);
                                }}
                                onKeyDown={handleSearchKeyDown}
                            />
                            <button
                                type="button"
                                className="scan-btn-inline"
                                onClick={startScanning}
                                title="สแกน QR Code"
                                aria-label="เปิดกล้องสแกน QR Code เพื่อรับคืน"
                            >
                                <QrCode size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {isScanning && (
                    <div className="scanner-overlay">
                        <div className="scanner-container">
                            <div className="scanner-header">
                                <h4>Scan Tool QR Code to Return</h4>
                                <button
                                    type="button"
                                    onClick={() => stopScanning()}
                                    className="close-scanner"
                                    aria-label="ปิดกล้องสแกน QR Code"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div id="reader-return"></div>
                            <p className="scanner-tip">สแกน QR ของอุปกรณ์เพื่อเลือกรายการคืน</p>
                        </div>
                    </div>
                )}

                {selectedIds.length > 0 && (
                    <div className="batch-action-bar">
                        <div className="selection-info">เลือกแล้ว {selectedIds.length} รายการ</div>
                        <button type="button" className="batch-btn primary" onClick={handleReturnSelected} disabled={isSubmitting}>
                            <RotateCcw size={18} />
                            {isSubmitting ? 'กำลังบันทึก...' : 'รับคืนทั้งหมดที่เลือก'}
                        </button>
                    </div>
                )}
            </div>

            <div className="list-section">
                <div className="list-card-header">
                    <h3>รายการค้างส่งทั้งหมด ({outstandingTransactions.length})</h3>
                    {filteredTransactions.length > 0 && (
                        <button type="button" className="text-action-btn" onClick={toggleSelectAll}>
                            {selectedIds.length === filteredTransactions.length ? <CheckSquare size={18} /> : <Square size={18} />}
                            {selectedIds.length === filteredTransactions.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                        </button>
                    )}
                </div>

                <div className="table-responsive">
                    {/* Desktop Table View */}
                    <div className="desktop-table-view">
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th width="50"></th>
                                    <th>ข้อมูลอุปกรณ์</th>
                                    <th>พนักงานผู้ยืม</th>
                                    <th>วัน-เวลาที่ยืม</th>
                                    <th>หมายเหตุ (Remark)</th>
                                    <th width="100">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="empty-state">ไม่พบรายการที่ตรงกับการค้นหา</td>
                                    </tr>
                                ) : (
                                    filteredTransactions.map((tx, idx) => {
                                        const isSelected = selectedIdSet.has(tx.id);
                                        const txToolId = normalizeId(tx.tool_id);
                                        const loc = (txToolId && toolsByIdMap.get(txToolId)?.location) || '-';
                                        const remarkText = String(tx.remark ?? '').trim();
                                        const hasRemark = remarkText !== '' && remarkText !== '-';
                                        return (
                                            <tr key={tx.id || `ret-${idx}`} className={isSelected ? 'row-selected' : ''}>
                                                <td
                                                    className="selection-col"
                                                    role="checkbox"
                                                    aria-checked={isSelected}
                                                    aria-label={`เลือก ${tx.tool_name || tx.tool_id}`}
                                                    tabIndex={0}
                                                    onClick={() => toggleSelect(tx.id)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            toggleSelect(tx.id);
                                                        }
                                                    }}
                                                >
                                                    {isSelected ?
                                                        <CheckSquare size={20} className="icon-active" /> :
                                                        <Square size={20} className="icon-muted" />
                                                    }
                                                </td>
                                                <td>
                                                    <div className="info-cell">
                                                        <span className="main-text font-bold">{tx.tool_name}</span>
                                                        <span className="sub-text">Location: {loc}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="info-cell">
                                                        <span className="main-text">{tx.employee_name}</span>
                                                        <span className="sub-text">ID: {tx.employee_id}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="date-badge">
                                                        {formatThaiDateTime(tx.date)}
                                                    </div>
                                                </td>
                                                <td>
                                                    {hasRemark ? (
                                                        <span className="return-remark-badge">
                                                            📝 {remarkText}
                                                        </span>
                                                    ) : (
                                                        <span className="muted-dash">-</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="inline-return-btn"
                                                        onClick={() => handleReturnClick(tx)}
                                                        disabled={isSubmitting}
                                                    >
                                                        <RotateCcw size={14} />
                                                        คืน
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards View */}
                    <div className="mobile-cards-view">
                        {filteredTransactions.length === 0 ? (
                            <div className="empty-state">ไม่พบรายการที่ตรงกับการค้นหา</div>
                        ) : (
                            filteredTransactions.map((tx, idx) => {
                                const isSelected = selectedIdSet.has(tx.id);
                                const txToolId = normalizeId(tx.tool_id);
                                const loc = (txToolId && toolsByIdMap.get(txToolId)?.location) || '-';
                                const timeStr = formatThaiDateTime(tx.date);
                                const remarkText = String(tx.remark ?? '').trim();
                                const hasRemark = remarkText !== '' && remarkText !== '-';
                                const issuerText = String(tx.staff_issuer ?? '').trim();

                                return (
                                    <div
                                        key={tx.id || `ret-m-${idx}`}
                                        className={`mobile-return-card ${isSelected ? 'is-selected' : ''}`}
                                    >
                                        <div className="m-return-top">
                                            <div
                                                className="m-checkbox-area"
                                                role="checkbox"
                                                aria-checked={isSelected}
                                                aria-label={`เลือก ${tx.tool_name || tx.tool_id}`}
                                                tabIndex={0}
                                                onClick={() => toggleSelect(tx.id)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        toggleSelect(tx.id);
                                                    }
                                                }}
                                            >
                                                {isSelected ? (
                                                    <CheckSquare size={22} className="icon-active" />
                                                ) : (
                                                    <Square size={22} className="icon-muted" />
                                                )}
                                            </div>
                                            <div className="m-return-tool-info">
                                                <span className="m-tool-title">{tx.tool_name}</span>
                                                <span className="m-tool-loc">📍 {loc}</span>
                                            </div>
                                            <button
                                                className="inline-return-btn mobile-return-action"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleReturnClick(tx);
                                                }}
                                                disabled={isSubmitting}
                                            >
                                                <RotateCcw size={14} /> คืน
                                            </button>
                                        </div>

                                        <div className="m-return-details">
                                            <div className="m-row">
                                                <span className="m-label">ผู้ยืม:</span>
                                                <span className="m-val emp-highlight">{tx.employee_name} <span className="id-sub">({tx.employee_id})</span></span>
                                            </div>
                                            <div className="m-row">
                                                <span className="m-label">วันเวลาที่ยืม:</span>
                                                <span className="m-val time-highlight">{timeStr}</span>
                                            </div>
                                            {issuerText && issuerText !== '-' && (
                                                <div className="m-row">
                                                    <span className="m-label">ผู้จ่ายของ:</span>
                                                    <span className="m-val">{issuerText}</span>
                                                </div>
                                            )}
                                            <div className={`m-row ${hasRemark ? 'm-remark-row' : ''}`}>
                                                <span className="m-label">หมายเหตุ:</span>
                                                <span className={hasRemark ? 'm-val m-remark-highlight' : 'm-val'}>
                                                    {hasRemark ? `📝 ${remarkText}` : '-'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

        </div>
    );
};

export default ReturnForm;
