import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVault } from '../context/VaultContext';
import { db } from '../firebase';
import { collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { encryptData, decryptData } from '../utils/encryption';
import { Shield, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';

const Settings = () => {
  const { currentUser } = useAuth();
  const { vaultPin, unlockVault } = useVault();
  
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  
  const [isRotating, setIsRotating] = useState(false);
  const [message, setMessage] = useState(null);

  const handlePinChange = async (e) => {
    e.preventDefault();
    setMessage(null);

    // 1. Validation
    if (currentPin !== vaultPin) {
      setMessage({ type: 'error', text: 'Current PIN is incorrect.' });
      return;
    }
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setMessage({ type: 'error', text: 'New PIN must be exactly 4 digits.' });
      return;
    }
    if (newPin === currentPin) {
      setMessage({ type: 'error', text: 'New PIN must be different from current PIN.' });
      return;
    }
    if (newPin !== confirmPin) {
      setMessage({ type: 'error', text: 'New PINs do not match.' });
      return;
    }

    setIsRotating(true);
    
    try {
      // 2. Fetch all encrypted documents for this user
      const q = query(collection(db, 'investments'), where('userId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      
      // 3. Initialize a Firestore Batch (Atomic write - either all succeed or none do)
      const batch = writeBatch(db);
      
      let processedCount = 0;

      querySnapshot.forEach((docSnap) => {
        const rawData = docSnap.data();
        
        try {
          // 4. Decrypt with Old PIN
          const decryptedAsset = decryptData(rawData.encryptedPayload, currentPin);
          
          // 5. Re-Encrypt with New PIN
          const reEncryptedPayload = encryptData(decryptedAsset, newPin);
          
          // 6. Add to Batch update
          batch.update(docSnap.ref, {
            encryptedPayload: reEncryptedPayload
          });
          
          processedCount++;
        } catch (err) {
          console.error("Failed to re-encrypt document ID:", docSnap.id);
          throw new Error("Data corruption detected. Aborting key rotation to prevent data loss.");
        }
      });

      // 7. Commit Batch to Firestore
      await batch.commit();

      // 8. Update in-memory PIN so app continues working flawlessly
      unlockVault(newPin);
      
      setMessage({ type: 'success', text: `Successfully rotated encryption keys for ${processedCount} assets.` });
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      
    } catch (error) {
      console.error("Key Rotation Error:", error);
      setMessage({ type: 'error', text: error.message || 'An error occurred during key rotation.' });
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <div style={{ padding: '24px', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 className="heading-gradient" style={{ fontSize: '2rem', marginBottom: '8px' }}>Security Settings</h1>
        <p className="text-muted">Manage your account security and encryption keys.</p>
      </div>

      <div className="glass-panel" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '12px', borderRadius: '50%' }}>
            <Shield size={28} color="var(--accent)" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>Vault Key Rotation</h2>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              Changing your PIN requires decrypting and re-encrypting all your data. Do not close the app while this is running.
            </p>
          </div>
        </div>

        {message && (
          <div style={{ 
            padding: '16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px',
            background: message.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            border: `1px solid ${message.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
          }}>
            {message.type === 'error' ? <AlertCircle size={20} color="var(--danger)"/> : <CheckCircle2 size={20} color="var(--success)"/>}
            <p style={{ color: message.type === 'error' ? 'var(--danger)' : 'var(--success)', margin: 0, fontWeight: 500 }}>
              {message.text}
            </p>
          </div>
        )}

        <form onSubmit={handlePinChange} style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '400px' }}>
          
          <div>
            <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Current 4-Digit PIN</label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input 
                type="password" inputMode="numeric" maxLength={4}
                value={currentPin} onChange={(e) => {
                  if (/^\d{0,4}$/.test(e.target.value)) setCurrentPin(e.target.value);
                }}
                required
                style={{
                  width: '100%', padding: '12px 12px 12px 40px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)',
                  borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', letterSpacing: '0.1em'
                }}
              />
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--panel-border)', margin: '8px 0' }}></div>

          <div>
            <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>New 4-Digit PIN</label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input 
                type="password" inputMode="numeric" maxLength={4}
                value={newPin} onChange={(e) => {
                  if (/^\d{0,4}$/.test(e.target.value)) setNewPin(e.target.value);
                }}
                required
                style={{
                  width: '100%', padding: '12px 12px 12px 40px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)',
                  borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', letterSpacing: '0.1em'
                }}
              />
            </div>
          </div>

          <div>
            <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Confirm New PIN</label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input 
                type="password" inputMode="numeric" maxLength={4}
                value={confirmPin} onChange={(e) => {
                  if (/^\d{0,4}$/.test(e.target.value)) setConfirmPin(e.target.value);
                }}
                required
                style={{
                  width: '100%', padding: '12px 12px 12px 40px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)',
                  borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', letterSpacing: '0.1em'
                }}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isRotating}
            className="btn-primary" 
            style={{ padding: '14px', marginTop: '8px' }}
          >
            {isRotating ? 'Rotating Keys...' : 'Change Vault PIN'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Settings;
