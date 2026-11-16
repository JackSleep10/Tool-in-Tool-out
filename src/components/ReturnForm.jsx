import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Search, RotateCcw, CheckSquare, Square, UserCheck, QrCode, X } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import Modal from './Modal';
import './ReturnForm.css';
const ReturnForm = () => {
    const { outstandingTransactions, addBatchTransactions, tools } = useStore();

    // State
    const [receiverName, setReceiverName] = useState(localStorage.getItem('staffReceiverName') || '');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [scanner, setScanner] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal State
    const [modal, setModal] = useState({
        isOpen: false,
        type: 'info',
        title: '',
        message: '',
        onConfirm: null
    });

    const showModal = (type, title, message, onConfirm = null) => {
        setModal({ isOpen: true, type, title, message, onConfirm });
    };

    const closeModal = () => {
        setModal(prev => ({ ...prev, isOpen: false }));
    };

    const filteredTransactions = outstandingTransactions.filter(tx => {
        if (!searchTerm || !searchTerm.trim()) return true;
        const tokens = searchTerm.trim().toLowerCase().split(/\s+/);
        const text = [
            tx.tool_name, tx.tool_id, tx.employee_name, tx.employee_id, tx.staff_issuer, tx.remark
        ].map(val => (val || '').toString().toLowerCase()).join(' ');
        return tokens.every(token => text.includes(token));
    });

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
        const cleanId = value.trim().toLowerCase();
        if (!cleanId) return;

        // Try to identify if this is a tool ID match
        const relevantTxs = outstandingTransactions.filter(tx =>
            (tx.tool_id || '').toString().trim().toLowerCase() === cleanId
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

    const startScanning = async () => {
        setIsScanning(true);
        setTimeout(() => {
            const html5QrCode = new Html5Qrcode("reader-return");
            setScanner(html5QrCode);
            html5QrCode.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 }
                },
                (decodedText) => {
                    // Success callback: Find all transactions for this tool ID
                    if (!decodedText || !decodedText.trim()) return;

                    const scannedId = decodedText.trim().toLowerCase();
                    const relevantTxs = outstandingTransactions.filter(tx =>
                        tx.tool_id.toString().trim().toLowerCase() === scannedId
                    );

                    if (relevantTxs.length > 0) {
                        const newIds = relevantTxs.map(tx => tx.id);
                        setSelectedIds(prev => {
                            const combined = [...new Set([...prev, ...newIds])];
                            return combined;
                        });
                        stopScanning(html5QrCode);
                    } else {
                        showModal('error', 'ไม่พบข้อมูล', `ไม่พบรายการค้างส่งสำหรับอุปกรณ์รหัส "${decodedText}"`);
                    }
                },
                (errorMessage) => {
                    // console.log(errorMessage);
                }
            ).catch(err => {
                showModal('error', 'Camera Error', 'ไม่สามารถเข้าถึงกล้องได้: ' + err);
                setIsScanning(false);
            });
        }, 100);
    };

    const stopScanning = (scannerInstance = scanner) => {
        if (scannerInstance && scannerInstance.isScanning) {
            scannerInstance.stop().then(() => {
                scannerInstance.clear();
                setIsScanning(false);
                setScanner(null);
            }).catch(err => console.error(err));
        } else {
            setIsScanning(false);
            setScanner(null);
        }
    };

    const handleReturnClick = (tx) => {
        if (isSubmitting) return;
        if (!receiverName) {
            showModal('error', 'แจ้งเตือน', 'กรุณาระบุชื่อผู้รับคืน (Staff Receiver)');
            return;
        }

        const remarkInfo = tx.remark && tx.remark !== '-' ? `\n(หมายเหตุตอนยืม: ${tx.remark})` : '';
        showModal(
            'confirm',
            'ยืนยันการรับคืน',
            `ต้องการรับคืน "${tx.tool_name}" จาก ${tx.employee_name} ใช่หรือไม่?${remarkInfo}`,
            () => processReturnBatch([tx.id])
        );
    };

    const handleReturnSelected = () => {
        if (isSubmitting) return;
        if (!receiverName) {
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
        const txsToReturn = outstandingTransactions.filter(tx => ids.includes(tx.id));
        if (txsToReturn.length === 0) return;

        const batchData = txsToReturn.map(tx => ({
            action: 'RETURN',
            tool_id: tx.tool_id,
            tool_name: tx.tool_name,
            employee_id: tx.employee_id,
            employee_name: tx.employee_name,
            quantity: tx.quantity,
            staff_issuer: tx.staff_issuer,
            staff_receiver: receiverName,
            linked_borrow_id: tx.id,
            remark: '-'
        }));

        setIsSubmitting(true);
        try {
            await addBatchTransactions(batchData);
            localStorage.setItem('staffReceiverName', receiverName);
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
                                className="scan-btn-inline"
                                onClick={startScanning}
                                title="สแกน QR Code"
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
                                <button onClick={() => stopScanning()} className="close-scanner">
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
                        <button className="batch-btn primary" onClick={handleReturnSelected} disabled={isSubmitting}>
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
                        <button className="text-action-btn" onClick={toggleSelectAll}>
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
                                    filteredTransactions.map(tx => {
                                        const isSelected = selectedIds.includes(tx.id);
                                        const hasRemark = tx.remark && tx.remark !== '-' && tx.remark.trim() !== '';
                                        return (
                                            <tr key={tx.id} className={isSelected ? 'row-selected' : ''}>
                                                <td className="selection-col" onClick={() => toggleSelect(tx.id)}>
                                                    {isSelected ?
                                                        <CheckSquare size={20} className="icon-active" /> :
                                                        <Square size={20} className="icon-muted" />
                                                    }
                                                </td>
                                                <td>
                                                    <div className="info-cell">
                                                        <span className="main-text font-bold">{tx.tool_name}</span>
                                                        <span className="sub-text">Location: {tools.find(t => t.id?.toString().toLowerCase() === tx.tool_id?.toString().toLowerCase())?.location || '-'}</span>
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
                                                        {new Date(tx.date).toLocaleDateString('th-TH') + ' ' + new Date(tx.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </td>
                                                <td>
                                                    {hasRemark ? (
                                                        <span className="return-remark-badge">
                                                            📝 {tx.remark}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: '#94a3b8' }}>-</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <button
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
                            filteredTransactions.map(tx => {
                                const isSelected = selectedIds.includes(tx.id);
                                const loc = tools.find(t => t.id?.toString().toLowerCase() === tx.tool_id?.toString().toLowerCase())?.location || '-';
                                const timeStr = new Date(tx.date).toLocaleDateString('th-TH') + ' ' + new Date(tx.date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

                                return (
                                    <div
                                        key={tx.id}
                                        className={`mobile-return-card ${isSelected ? 'is-selected' : ''}`}
                                    >
                                        <div className="m-return-top">
                                            <div
                                                className="m-checkbox-area"
                                                onClick={() => toggleSelect(tx.id)}
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
                                            {tx.staff_issuer && tx.staff_issuer !== '-' && (
                                                <div className="m-row">
                                                    <span className="m-label">ผู้จ่ายของ:</span>
                                                    <span className="m-val">{tx.staff_issuer}</span>
                                                </div>
                                            )}
                                            <div className={`m-row ${tx.remark && tx.remark !== '-' ? 'm-remark-row' : ''}`}>
                                                <span className="m-label">หมายเหตุ:</span>
                                                <span className={tx.remark && tx.remark !== '-' ? 'm-val m-remark-highlight' : 'm-val'}>
                                                    {tx.remark && tx.remark !== '-' ? `📝 ${tx.remark}` : '-'}
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
