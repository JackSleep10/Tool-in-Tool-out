import { X, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import './Modal.css';
const Modal = ({ isOpen, onClose, title, message, type = 'info', onConfirm, confirmText = 'ตกลง', cancelText = 'ยกเลิก' }) => {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle className="modal-icon-success" size={32} />;
            case 'error': return <AlertCircle className="modal-icon-error" size={32} />;
            case 'confirm': return <HelpCircle className="modal-icon-confirm" size={32} />;
            default: return <AlertCircle className="modal-icon-info" size={32} />;
        }
    };

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title-heading">
            <div className="modal-content">
                <button type="button" className="close-btn" onClick={onClose} aria-label="ปิดหน้าต่าง">
                    <X size={20} />
                </button>

                <div className="modal-body">
                    <div className="icon-area">
                        {getIcon()}
                    </div>
                    <h3 id="modal-title-heading" className="modal-title">{title}</h3>
                    <p className="modal-message">{message}</p>
                </div>

                <div className="modal-footer">
                    {type === 'confirm' && (
                        <button className="btn-secondary" onClick={onClose}>
                            {cancelText}
                        </button>
                    )}
                    <button
                        className={`btn-primary ${type}`}
                        onClick={() => {
                            const confirmCallback = onConfirm;
                            onClose();
                            if (confirmCallback) confirmCallback();
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>

        </div>
    );
};

export default Modal;
