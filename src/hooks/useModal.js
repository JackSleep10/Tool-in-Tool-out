import { useState, useCallback } from 'react';

const INITIAL_MODAL = {
  isOpen: false,
  type: 'info',
  title: '',
  message: '',
  onConfirm: null
};

export const useModal = () => {
  const [modal, setModal] = useState(INITIAL_MODAL);

  const showModal = useCallback((type, title, message, onConfirm = null) => {
    setModal({ isOpen: true, type, title, message, onConfirm });
  }, []);

  const closeModal = useCallback(() => {
    setModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return { modal, showModal, closeModal };
};
