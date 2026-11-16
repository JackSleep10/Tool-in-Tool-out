import React from 'react';
import { X, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import './Modal.css';
const Modal = ({ isOpen, onClose, title, message, type = 'info', onConfirm, confirmText = 'ตกลง', cancelText = 'ยกเลิก' }) => {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle style={{color: '#059669'}} size={32} />;
            case 'error': return <AlertCircle style={{color: '#dc2626'}} size={32} />;
            case 'confirm': return <HelpCircle style={{color: '#3b82f6'}} size={32} />;
            default: return <AlertCircle style={{color: '#6b7280'}} size={32} />;
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <button className="close-btn" onClick={onClose}><X size={20} /></button>

                <div className="modal-body">
                    <div className="icon-area">
                        {getIcon()}
                    </div>
                    <h3 className="modal-title">{title}</h3>
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
                            if (onConfirm) onConfirm();
                            onClose();
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
