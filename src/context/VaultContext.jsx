import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const VaultContext = createContext({});

export const useVault = () => useContext(VaultContext);

export const VaultProvider = ({ children }) => {
  const [vaultPin, setVaultPin] = useState(null);

  const lockVault = useCallback(() => {
    setVaultPin(null);
  }, []);

  const unlockVault = (pin) => {
    setVaultPin(pin);
  };

  // Auto-lock after 1 minute of inactivity
  useEffect(() => {
    if (!vaultPin) return; // Only track inactivity if unlocked

    let timeoutId;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lockVault();
      }, 60000); // 1 minute (60,000 ms)
    };

    // Initialize timer
    resetTimer();

    // Event listeners for user activity
    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    
    const handleActivity = () => {
      resetTimer();
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [vaultPin, lockVault]);

  return (
    <VaultContext.Provider value={{ vaultPin, unlockVault, lockVault }}>
      {children}
    </VaultContext.Provider>
  );
};
