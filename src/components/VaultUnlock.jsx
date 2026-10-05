import React, { useState } from 'react';
import { useVault } from '../context/VaultContext';
import { Lock, KeyRound, ArrowRight, ShieldAlert } from 'lucide-react';

const VaultUnlock = () => {
  const [pin, setPin] = useState('');
  const { unlockVault } = useVault();

  const handleUnlock = (e) => {
    e.preventDefault();
    if (pin.length === 4) {
      unlockVault(pin);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100%', 
      width: '100%',
      padding: '24px'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '40px', textAlign: 'center' }}>
        <div style={{ 
          background: 'rgba(56, 189, 248, 0.1)', 
          padding: '16px', 
          borderRadius: '50%',
          display: 'inline-block',
          marginBottom: '20px'
        }}>
          <Lock size={40} color="var(--accent)" />
        </div>
        
        <h2 className="heading-gradient" style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Vault Locked</h2>
        <p className="text-muted" style={{ marginBottom: '24px' }}>
          Enter your Secure Vault PIN to decrypt your financial data.
        </p>

        <div style={{ 
          background: 'rgba(239, 68, 68, 0.1)', 
          padding: '12px', 
          borderRadius: '8px', 
          display: 'flex', 
          alignItems: 'flex-start',
          gap: '12px',
          marginBottom: '24px',
          border: '1px solid rgba(239, 68, 68, 0.2)'
        }}>
          <ShieldAlert size={20} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'left', margin: 0 }}>
            <strong>Zero-Knowledge:</strong> We do not store your PIN. If you forget it, your data cannot be recovered.
          </p>
        </div>

        <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <KeyRound size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="password" 
              inputMode="numeric"
              placeholder="Enter 4-Digit PIN" 
              value={pin}
              autoFocus
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d{0,4}$/.test(val)) {
                  setPin(val);
                }
              }}
              required
              maxLength={4}
              minLength={4}
              style={{
                width: '100%',
                padding: '14px 14px 14px 44px',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--panel-border)',
                borderRadius: '12px',
                color: 'var(--text-primary)',
                outline: 'none',
                fontFamily: 'inherit',
                fontSize: '1rem',
                letterSpacing: '0.1em',
                transition: 'border-color 0.3s ease'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--panel-border)'}
            />
          </div>
          
          <button type="submit" className="btn-primary flex justify-center items-center gap-2" style={{ width: '100%', padding: '14px' }}>
            Decrypt & Unlock <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default VaultUnlock;
