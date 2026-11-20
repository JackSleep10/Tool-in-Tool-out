import { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Search, ShoppingBasket, User, MapPin, X, AlertTriangle, QrCode, ShieldAlert, Loader2 } from 'lucide-react';
import { useQrScanner } from '../hooks/useQrScanner';
import { useModal } from '../hooks/useModal';
import { normalizeId } from '../utils/transactions';
import { matchSearch, isToolUnserviceable } from '../utils/tools';
import Modal from './Modal';
import './BorrowForm.css';
const BorrowForm = () => {
    const { employees, tools, addBatchTransactions, isToolCurrentlyOut, getToolBorrower } = useStore();

    // Selection State
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [basket, setBasket] = useState([]);

    // Form Inputs
    const [issuerName, setIssuerName] = useState(localStorage.getItem('staffIssuerName') || '');
    const [remark, setRemark] = useState('');
    const [empSearch, setEmpSearch] = useState('');
    const [toolSearch, setToolSearch] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { modal, showModal, closeModal } = useModal();

    // Filtering
    const filteredEmployees = useMemo(() => (
        employees.filter(e =>
            matchSearch(e, empSearch, ['name', 'id', 'department'])
        ).slice(0, 20)
    ), [employees, empSearch]);

    const filteredTools = useMemo(() => (
        tools.filter(t =>
            matchSearch(t, toolSearch, ['name', 'id', 'location'])
        ).slice(0, 20)
    ), [tools, toolSearch]);

    // Handlers

    const addToBasket = (tool) => {
        if (!tool) return false;

        // 0. Block Unserviceable tools
        if (isToolUnserviceable(tool)) {
            showModal('error', '⛔ อุปกรณ์ชำรุด (U/S)', `"${tool.name}" อยู่ในสถานะ Unserviceable ไม่สามารถเบิกได้\nสาเหตุ: ${tool.unserviceable_reason || 'ไม่ระบุ'}`);
            return false;
        }

        // 1. Check if already in basket
        const targetId = normalizeId(tool.id);
        if (basket.some(t => (targetId ? normalizeId(t.id) === targetId : t.id === tool.id))) {
            showModal('error', 'ข้อผิดพลาด', 'อุปกรณ์นี้มีอยู่ในตะกร้าแล้ว');
            return false;
        }

        // 2. Global Availability Check (Quick Return Logic)
        if (isToolCurrentlyOut(tool.id)) {
            const borrower = getToolBorrower(tool.id);
            showModal(
                'confirm',
                'อุปกรณ์ยังไม่ได้คืน',
                `"${tool.name}" อยู่กับ ${borrower?.employee_name || '-'} (${borrower?.employee_id || '-'}) ต้องการ "รับคืนทันที" เพื่อยืมต่อเลยหรือไม่?`,
                async () => {
                    if (isSubmitting) return;
                    const trimmedIssuer = issuerName.trim();
                    const receiver = trimmedIssuer || 'Auto-Return';
                    setIsSubmitting(true);
                    try {
                        await addBatchTransactions([{
                            action: 'RETURN',
                            tool_id: tool.id,
                            tool_name: tool.name,
                            employee_id: borrower?.employee_id || '',
                            employee_name: borrower?.employee_name || '',
                            quantity: 1,
                            staff_issuer: borrower?.staff_issuer || '-',
                            staff_receiver: receiver,
                            linked_borrow_id: borrower?.id || '',
                            remark: 'คืนอัตโนมัติเพื่อยืมต่อ'
                        }]);

                        if (trimmedIssuer) {
                            localStorage.setItem('staffIssuerName', trimmedIssuer);
                        }
                        setBasket(prev => [...prev, tool]);
                        setToolSearch('');
                        showModal('success', 'รับคืนสำเร็จ', `รับคืน "${tool.name}" และเพิ่มลงในตะกร้าแล้ว`);
                    } catch (err) {
                        showModal('error', 'รับคืนไม่สำเร็จ', err.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่');
                    } finally {
                        setIsSubmitting(false);
                    }
                }
            );
            return false;
        }

        setBasket(prev => [...prev, tool]);
        setToolSearch('');
        return true;
    };

    const processToolSearch = (searchValue) => {
        const cleanSearch = normalizeId(searchValue);
        if (!cleanSearch) return;

        // Try to find exact ID match
        const exactMatch = tools.find(t => normalizeId(t.id) === cleanSearch);

        if (exactMatch) {
            addToBasket(exactMatch);
        }
    };

    const handleToolKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            processToolSearch(toolSearch);
        }
    };

    const { isScanning, startScanning, stopScanning } = useQrScanner({
        elementId: 'reader',
        onScan: (decodedText, stop) => {
            stop();
            const scannedId = normalizeId(decodedText);
            const tool = scannedId ? tools.find(t => normalizeId(t.id) === scannedId) : null;

            if (tool) {
                const added = addToBasket(tool);
                if (added) {
                    showModal('success', 'สแกนสำเร็จ', `เพิ่ม "${tool.name}" ลงในตะกร้าแล้ว`);
                }
            } else {
                showModal('error', 'ไม่พบข้อมูล', `ไม่พบอุปกรณ์รหัส "${decodedText}" ในระบบ`);
            }
        },
        onError: (err) => {
            showModal('error', 'Camera Error', 'ไม่สามารถเข้าถึงกล้องได้: ' + err);
        }
    });

    const removeFromBasket = (toolId) => {
        setBasket(prev => prev.filter(t => t.id !== toolId));
    };

    const handleSubmit = () => {
        if (isSubmitting) return;
        const trimmedIssuer = issuerName.trim();
        if (!selectedEmployee) {
            showModal('error', 'แจ้งเตือน', 'กรุณาระบุชื่อพนักงานผู้ยืม');
            return;
        }
        if (basket.length === 0) {
            showModal('error', 'แจ้งเตือน', 'กรุณาเลือกอุปกรณ์อย่างน้อย 1 ชิ้น');
            return;
        }
        if (!trimmedIssuer) {
            showModal('error', 'แจ้งเตือน', 'กรุณาระบุชื่อผู้จ่ายของ (Staff Issuer)');
            return;
        }

        // Check for any unserviceable tools in basket
        const usItem = basket.find(tool => isToolUnserviceable(tool));
        if (usItem) {
            showModal('error', '⛔ อุปกรณ์ชำรุด (U/S)', `อุปกรณ์ "${usItem.name}" อยู่ในสถานะ Unserviceable ไม่สามารถเบิกได้ โปรดนำออกจากตะกร้า`);
            return;
        }

        // Final sanity check for everything in basket (in case data refreshed)
        const unavailable = basket.find(tool => isToolCurrentlyOut(tool.id));
        if (unavailable) {
            const borrower = getToolBorrower(unavailable.id);
            showModal('error', 'พบปัญหาในการบันทึก', `อุปกรณ์ "${unavailable.name}" เพิ่งถูกยืมไปโดย ${borrower?.employee_name || '-'} โปรดนำออกจากตะกร้าก่อนบันทึก`);
            return;
        }

        // Confirm Action
        showModal('confirm', 'ยืนยันการทำรายการ', `ต้องการบันทึกการยืมจำนวน ${basket.length} รายการ?`, async () => {
            if (isSubmitting) return;
            const batchData = basket.map(tool => ({
                action: 'BORROW',
                tool_id: tool.id,
                tool_name: tool.name,
                employee_id: selectedEmployee.id,
                employee_name: selectedEmployee.name,
                quantity: 1,
                staff_issuer: trimmedIssuer,
                staff_receiver: '-',
                remark: remark
            }));

            setIsSubmitting(true);
            try {
                await addBatchTransactions(batchData);
                setBasket([]);
                setSelectedEmployee(null);
                setEmpSearch('');
                setRemark('');
                localStorage.setItem('staffIssuerName', trimmedIssuer);
                showModal('success', 'สำเร็จ', 'บันทึกรายการยืมเรียบร้อยแล้ว');
            } catch (err) {
                showModal('error', 'บันทึกไม่สำเร็จ', err.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่');
            } finally {
                setIsSubmitting(false);
            }
        });
    };

    return (
        <div className="borrow-container">
            <Modal
                isOpen={modal.isOpen}
                onClose={closeModal}
                type={modal.type}
                title={modal.title}
                message={modal.message}
                onConfirm={modal.onConfirm}
                confirmText={modal.type === 'confirm' ? 'ยืนยัน' : 'ตกลง'}
                cancelText='ยกเลิก'
            />

            <div className="form-grid">
                <div className="input-panel">
                    <h3>1. ข้อมูลการยืม (Borrow Info)</h3>

                    <div className="form-group">
                        <label>ผู้จ่ายของ (Staff Issuer)</label>
                        <input
                            type="text"
                            className="full-width"
                            placeholder="ระบุชื่อของคุณ..."
                            value={issuerName}
                            onChange={e => setIssuerName(e.target.value)}
                        />
                    </div>

                    <div className="form-group relative">
                        <label>พนักงานผู้ยืม (Employee)</label>
                        <div className="search-wrap">
                            <User className="icon" size={18} />
                            <input
                                type="text"
                                placeholder="ค้นหาชื่อ หรือ รหัส..."
                                value={selectedEmployee ? selectedEmployee.name : empSearch}
                                disabled={isSubmitting}
                                onChange={e => {
                                    setEmpSearch(e.target.value);
                                    setSelectedEmployee(null);
                                }}
                            />
                        </div>
                        {empSearch && !selectedEmployee && filteredEmployees.length > 0 && (
                            <ul className="suggestions">
                                {filteredEmployees.map((emp, idx) => (
                                    <li key={emp.id || `${emp.name}-${idx}`} onClick={() => {
                                        setSelectedEmployee(emp);
                                        setEmpSearch(emp.name);
                                    }}>
                                        <strong>{emp.name}</strong> <small>({emp.id})</small>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="form-group relative">
                        <label>เลือกอุปกรณ์ (Select Tools)</label>
                        <div className="search-wrap">
                            <Search className="icon" size={18} />
                            <input
                                type="text"
                                placeholder="ค้นหาชื่ออุปกรณ์ หรือ ที่เก็บ... (สแกน QR ได้)"
                                value={toolSearch}
                                disabled={isSubmitting}
                                onChange={e => setToolSearch(e.target.value)}
                                onKeyDown={handleToolKeyDown}
                            />
                            <button
                                type="button"
                                className="scan-btn-inline"
                                onClick={startScanning}
                                disabled={isSubmitting}
                                title="สแกน QR Code"
                                aria-label="เปิดกล้องสแกน QR Code อุปกรณ์"
                            >
                                <QrCode size={18} />
                            </button>
                        </div>
                        {isScanning && (
                            <div className="scanner-overlay">
                                <div className="scanner-container">
                                    <div className="scanner-header">
                                        <h4>Scan Tool QR Code</h4>
                                        <button
                                            type="button"
                                            onClick={() => stopScanning()}
                                            className="close-scanner"
                                            aria-label="ปิดกล้องสแกน QR Code"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <div id="reader"></div>
                                    <p className="scanner-tip">วาง QR Code ให้อยู่ในกรอบเพื่อสแกน</p>
                                </div>
                            </div>
                        )}
                        {toolSearch && filteredTools.length > 0 && (
                            <ul className="suggestions">
                                {filteredTools.map((tool, idx) => {
                                    const isOut = isToolCurrentlyOut(tool.id);
                                    const isUS = isToolUnserviceable(tool);
                                    return (
                                        <li
                                            key={tool.id || `${tool.name}-${idx}`}
                                            onClick={() => addToBasket(tool)}
                                            className={isUS ? 'disabled unserviceable' : isOut ? 'disabled' : ''}
                                        >
                                            <div className="tool-row">
                                                <div className="tool-info-line">
                                                    <span>{tool.name}</span>
                                                    {isUS && <span className="status-label us"><ShieldAlert size={12} /> U/S ชำรุด</span>}
                                                    {!isUS && isOut && <span className="status-label out"><AlertTriangle size={12} /> ถูกยืมอยู่</span>}
                                                </div>
                                                <span className="badge-bin"><MapPin size={12} /> {tool.location}</span>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {/* Remark Field */}
                    <div className="form-group">
                        <label>หมายเหตุ (Remark)</label>
                        <textarea
                            className="full-width remark-area"
                            placeholder="ระบุหมายเหตุการยืม (เช่น ยืมไปใช้งานที่แผนก...)"
                            value={remark}
                            onChange={e => setRemark(e.target.value)}
                            rows="3"
                        ></textarea>
                    </div>
                </div>

                <div className="basket-panel">
                    <h3>
                        <ShoppingBasket size={24} />
                        รายการในตะกร้า ({basket.length})
                    </h3>

                    <div className="basket-list">
                        {basket.length === 0 ? (
                            <div className="empty-state">ยังไม่มีรายการ</div>
                        ) : (
                            basket.map((item, idx) => (
                                <div key={item.id || idx} className="basket-item">
                                    <div className="item-info">
                                        <h4>{item.name}</h4>
                                        <small>{item.location}</small>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeFromBasket(item.id)}
                                        className="remove-btn"
                                        disabled={isSubmitting}
                                        aria-label={`นำ ${item.name || item.id} ออกจากตะกร้า`}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="action-area">
                        <button className="submit-btn" onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={18} className="spin-icon" />
                                    กำลังบันทึก...
                                </>
                            ) : 'บันทึกการยืม'}
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default BorrowForm;
