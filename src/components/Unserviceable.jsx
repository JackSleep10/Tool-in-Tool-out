import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { ShieldAlert, CheckCircle, AlertTriangle, Search, User, RefreshCw, X, QrCode, MapPin, Check } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import Modal from './Modal';
import './Unserviceable.css';

// Helper for multi-keyword search
const matchSearch = (item, searchStr, fields = ['name', 'id', 'location']) => {
    if (!searchStr || !searchStr.trim()) return true;
    const tokens = searchStr.trim().toLowerCase().split(/\s+/);
    const text = fields.map(f => (item[f] || '').toString().toLowerCase()).join(' ');
    return tokens.every(token => text.includes(token));
};

const Unserviceable = () => {
    const { tools, markUnserviceable, markServiceable } = useStore();

    // Modal state for marking unserviceable
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedTool, setSelectedTool] = useState(null);
    const [reason, setReason] = useState('');
    const [markedBy, setMarkedBy] = useState(localStorage.getItem('staffIssuerName') || '');
    const [toolSearch, setToolSearch] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [scanner, setScanner] = useState(null);

    // General Modal Notification state
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

    // Filter tools that are currently UNSERVICEABLE
    const unserviceableTools = tools.filter(t =>
        (t.serviceability_status || '').toUpperCase() === 'UNSERVICEABLE'
    );

    // Tools available to mark as unserviceable (only SERVICEABLE ones)
    const serviceableTools = tools.filter(t =>
        (t.serviceability_status || '').toUpperCase() !== 'UNSERVICEABLE'
    );

    const filteredServiceableTools = serviceableTools.filter(t =>
        matchSearch(t, toolSearch, ['name', 'id', 'location'])
    ).slice(0, 30);

    const handleMarkSubmit = (e) => {
        e.preventDefault();
        if (!selectedTool) {
            showModal('error', 'แจ้งเตือน', 'กรุณาเลือกอุปกรณ์ที่ต้องการแจ้งเสีย');
            return;
        }
        if (!reason.trim()) {
            showModal('error', 'แจ้งเตือน', 'กรุณาระบุสาเหตุอาการชำรุด');
            return;
        }
        if (!markedBy.trim()) {
            showModal('error', 'แจ้งเตือน', 'กรุณาระบุชื่อผู้แจ้ง');
            return;
        }

        // Simply process the action without double-confirmation
        localStorage.setItem('staffIssuerName', markedBy);
        markUnserviceable(selectedTool.id, reason, markedBy);
        setIsFormOpen(false);
        setSelectedTool(null);
        setReason('');
        setToolSearch('');
        showModal('success', 'สำเร็จ', 'บันทึกอุปกรณ์ชำรุดเรียบร้อยแล้ว');
    };

    const startScanning = async () => {
        setIsScanning(true);
        setTimeout(() => {
            const html5QrCode = new Html5Qrcode("reader-unserviceable");
            setScanner(html5QrCode);
            html5QrCode.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    if (!decodedText || !decodedText.trim()) return;
                    const scannedId = decodedText.trim().toLowerCase();
                    const tool = serviceableTools.find(t =>
                        (t.id || '').toString().trim().toLowerCase() === scannedId
                    );

                    if (tool) {
                        setSelectedTool(tool);
                        setToolSearch('');
                        stopScanning(html5QrCode);
                        showModal('success', 'สแกนสำเร็จ', `เลือก "${tool.name || tool.id}" เรียบร้อยแล้ว`);
                    } else {
                        showModal('error', 'ไม่พบข้อมูล', `ไม่พบอุปกรณ์รหัส "${decodedText}" ที่พร้อมใช้งาน`);
                    }
                },
                () => {}
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

    const handleRestoreClick = (tool) => {
        showModal(
            'confirm',
            'คืนสภาพพร้อมใช้งาน',
            `ต้องการคืนสภาพอุปกรณ์ "${tool.name || tool.id}" ให้พร้อมใช้งาน ใช่หรือไม่?`,
            () => {
                markServiceable(tool.id);
                showModal('success', 'สำเร็จ', `อุปกรณ์ "${tool.name || tool.id}" เปลี่ยนสถานะเป็นพร้อมใช้งานแล้ว`);
            }
        );
    };

    return (
        <div className="unserviceable-container">
            {/* Content Area */}
            <div className="unserviceable-header-card">
                <div className="header-left">
                    <ShieldAlert size={24} className="icon-shield" />
                    <h2>Unserviceable Tools (อุปกรณ์เสีย)</h2>
                </div>
                <button
                    className="mark-unserviceable-btn"
                    onClick={() => {
                        setIsFormOpen(true);
                        setSelectedTool(null);
                        setToolSearch('');
                    }}
                >
                    <AlertTriangle size={18} />
                    Mark Tool as Unserviceable
                </button>
            </div>

            {/* Content Area */}
            <div className="unserviceable-content">
                {unserviceableTools.length === 0 ? (
                    <div className="empty-unserviceable-card">
                        <CheckCircle size={56} className="check-icon" />
                        <p className="empty-text">ไม่มีอุปกรณ์เสีย — ทุกอย่างพร้อมใช้งาน ✅</p>
                    </div>
                ) : (
                    <div className="unserviceable-list-card">
                        <div className="list-title">
                            <h3>รายการอุปกรณ์ชำรุดทั้งหมด ({unserviceableTools.length})</h3>
                        </div>
                        <div className="table-responsive">
                            {/* Desktop Table View */}
                            <div className="desktop-table-view">
                                <table className="modern-table">
                                    <thead>
                                        <tr>
                                            <th>ข้อมูลอุปกรณ์</th>
                                            <th>สาเหตุการชำรุด / อาการ</th>
                                            <th>ผู้แจ้ง</th>
                                            <th>วันที่แจ้ง</th>
                                            <th width="140">จัดการ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {unserviceableTools.map(tool => (
                                            <tr key={tool.id}>
                                                <td>
                                                    <div className="tool-info-cell">
                                                        <span className="tool-name">{tool.name || 'ไม่ระบุชื่อ'}</span>
                                                        <span className="tool-sub">ID: {tool.id || '-'} | Location: {tool.location || '-'}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="reason-badge">
                                                        {tool.unserviceable_reason || 'ไม่ระบุสาเหตุ'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="marked-by-text">{tool.unserviceable_by || '-'}</span>
                                                </td>
                                                <td>
                                                    <span className="date-text">
                                                        {tool.unserviceable_date
                                                            ? new Date(tool.unserviceable_date).toLocaleDateString('th-TH') + ' ' + new Date(tool.unserviceable_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                                                            : '-'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button
                                                        className="restore-btn"
                                                        onClick={() => handleRestoreClick(tool)}
                                                        title="คืนสภาพพร้อมใช้งาน"
                                                    >
                                                        <RefreshCw size={14} />
                                                        คืนสภาพ
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards View */}
                            <div className="mobile-cards-view">
                                {unserviceableTools.map(tool => {
                                    const dateStr = tool.unserviceable_date
                                        ? new Date(tool.unserviceable_date).toLocaleDateString('th-TH') + ' ' + new Date(tool.unserviceable_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                                        : '-';

                                    return (
                                        <div key={tool.id} className="mobile-us-card">
                                            <div className="m-us-header">
                                                <div className="m-us-tool">
                                                    <span className="m-tool-title">{tool.name || 'ไม่ระบุชื่อ'}</span>
                                                    <span className="m-tool-loc">ID: {tool.id || '-'} | 📍 {tool.location || '-'}</span>
                                                </div>
                                                <button
                                                    className="restore-btn m-restore-btn"
                                                    onClick={() => handleRestoreClick(tool)}
                                                    title="คืนสภาพพร้อมใช้งาน"
                                                >
                                                    <RefreshCw size={14} /> คืนสภาพ
                                                </button>
                                            </div>

                                            <div className="m-us-body">
                                                <div className="m-row">
                                                    <span className="m-label">อาการชำรุด:</span>
                                                    <span className="reason-badge">{tool.unserviceable_reason || 'ไม่ระบุสาเหตุ'}</span>
                                                </div>
                                                <div className="m-row">
                                                    <span className="m-label">ผู้แจ้ง:</span>
                                                    <span className="m-val emp-highlight">{tool.unserviceable_by || '-'}</span>
                                                </div>
                                                <div className="m-row">
                                                    <span className="m-label">วันที่แจ้ง:</span>
                                                    <span className="m-val time-highlight">{dateStr}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Form for Marking Tool Unserviceable */}
            {isFormOpen && (
                <div className="modal-overlay">
                    <div className="modal-content form-modal">
                        <div className="modal-header">
                            <h3><AlertTriangle size={20} className="text-warning" /> แจ้งอุปกรณ์ชำรุด / ส่งซ่อม</h3>
                            <button className="close-btn" onClick={() => setIsFormOpen(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleMarkSubmit} className="modal-body form-body">
                            
                            {/* Smart Autocomplete Tool Search */}
                            <div className="form-group relative">
                                <label>เลือกอุปกรณ์ชำรุด (Select Tool)</label>
                                
                                {selectedTool ? (
                                    <div className="selected-tool-card">
                                        <div className="selected-tool-info">
                                            <div className="selected-tool-name">
                                                <Check size={18} className="text-success" />
                                                <strong>{selectedTool.name || 'อุปกรณ์ไม่ระบุชื่อ'}</strong>
                                            </div>
                                            <div className="selected-tool-sub">
                                                <span>ID: {selectedTool.id || '-'}</span>
                                                {selectedTool.location && <span> | <MapPin size={12} /> {selectedTool.location}</span>}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn-change-tool"
                                            onClick={() => {
                                                setSelectedTool(null);
                                                setToolSearch('');
                                            }}
                                        >
                                            เปลี่ยน
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="search-wrap">
                                            <Search className="icon" size={18} />
                                            <input
                                                type="text"
                                                placeholder="พิมพ์ชื่อ, รหัส (ID) หรือ สถานที่เก็บ (Location)..."
                                                value={toolSearch}
                                                onChange={e => setToolSearch(e.target.value)}
                                                autoFocus
                                            />
                                            <button
                                                type="button"
                                                className="scan-btn-inline"
                                                onClick={startScanning}
                                                title="สแกน QR Code"
                                            >
                                                <QrCode size={18} />
                                            </button>
                                        </div>

                                        {isScanning && (
                                            <div className="scanner-overlay">
                                                <div className="scanner-container">
                                                    <div className="scanner-header">
                                                        <h4>Scan Tool QR Code</h4>
                                                        <button type="button" onClick={() => stopScanning()} className="close-scanner">
                                                            <X size={20} />
                                                        </button>
                                                    </div>
                                                    <div id="reader-unserviceable"></div>
                                                    <p className="scanner-tip">วาง QR Code ให้อยู่ในกรอบเพื่อสแกน</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Live Autocomplete Suggestions */}
                                        <ul className="suggestions tool-suggestions">
                                            {filteredServiceableTools.length > 0 ? (
                                                filteredServiceableTools.map(t => (
                                                    <li
                                                        key={t.id || t.name}
                                                        onClick={() => {
                                                            setSelectedTool(t);
                                                            setToolSearch('');
                                                        }}
                                                    >
                                                        <div className="suggestion-item-row">
                                                            <strong className="suggest-name">{t.name || 'อุปกรณ์ไม่ระบุชื่อ'}</strong>
                                                            <div className="suggest-meta">
                                                                <span className="badge-id">ID: {t.id || '-'}</span>
                                                                {t.location && (
                                                                    <span className="badge-loc">
                                                                        <MapPin size={12} /> {t.location}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </li>
                                                ))
                                            ) : (
                                                <li className="no-suggest">ไม่พบอุปกรณ์ที่ตรงกับการค้นหา</li>
                                            )}
                                        </ul>
                                    </>
                                )}
                            </div>

                            <div className="form-group">
                                <label>ผู้แจ้งเรื่อง (Staff Name)</label>
                                <div className="search-wrap">
                                    <User className="icon" size={18} />
                                    <input
                                        type="text"
                                        placeholder="ระบุชื่อผู้แจ้งเรื่อง..."
                                        value={markedBy}
                                        onChange={e => setMarkedBy(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>สาเหตุ / อาการชำรุด (Reason)</label>
                                <textarea
                                    className="remark-area"
                                    placeholder="ระบุรายละเอียดอาการเสีย เช่น ด้ามจับหัก, สวิตช์เปิดไม่ติด..."
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    rows="3"
                                    required
                                ></textarea>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setIsFormOpen(false)}>
                                    ยกเลิก
                                </button>
                                <button type="submit" className="btn-primary confirm-warning" disabled={!selectedTool}>
                                    บันทึกแจ้งเสีย
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* General Notification Modal (Placed at the end to ensure it is always on top) */}
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
        </div>
    );
};

export default Unserviceable;
