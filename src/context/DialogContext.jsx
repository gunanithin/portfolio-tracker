import React, { createContext, useContext, useState } from 'react';
import { AlertCircle, Info } from 'lucide-react';

const DialogContext = createContext();

export const useDialog = () => useContext(DialogContext);

export const DialogProvider = ({ children }) => {
  const [dialogConfig, setDialogConfig] = useState({
    isOpen: false,
    type: 'alert', // 'alert' | 'confirm'
    title: '',
    message: '',
    onConfirm: null,
  });

  const showAlert = (title, message) => {
    setDialogConfig({
      isOpen: true,
      type: 'alert',
      title,
      message,
      onConfirm: null
    });
  };

  const showConfirm = (title, message, onConfirm) => {
    setDialogConfig({
      isOpen: true,
      type: 'confirm',
      title,
      message,
      onConfirm,
    });
  };

  const closeDialog = () => {
    setDialogConfig(prev => ({ ...prev, isOpen: false }));
  };

  const handleConfirm = () => {
    if (dialogConfig.onConfirm) {
      dialogConfig.onConfirm();
    }
    closeDialog();
  };

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      
      {dialogConfig.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              {dialogConfig.type === 'alert' ? (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '16px', borderRadius: '50%' }}>
                  <AlertCircle size={32} color="var(--danger)" />
                </div>
              ) : (
                <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '16px', borderRadius: '50%' }}>
                  <Info size={32} color="var(--accent)" />
                </div>
              )}
            </div>
            
            <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>{dialogConfig.title}</h3>
            <p className="text-muted" style={{ marginBottom: '24px' }}>{dialogConfig.message}</p>
            
            <div className="flex gap-4">
              {dialogConfig.type === 'confirm' && (
                <button 
                  className="btn-secondary" 
                  style={{ flex: 1 }} 
                  onClick={closeDialog}
                >
                  Cancel
                </button>
              )}
              <button 
                className="btn-primary" 
                style={{ flex: 1, background: dialogConfig.type === 'alert' ? 'var(--danger)' : 'var(--accent)' }} 
                onClick={dialogConfig.type === 'confirm' ? handleConfirm : closeDialog}
              >
                {dialogConfig.type === 'confirm' ? 'Confirm' : 'Okay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};
