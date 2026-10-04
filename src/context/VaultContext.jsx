import React, { createContext, useContext, useState } from 'react';

const VaultContext = createContext({});

export const useVault = () => useContext(VaultContext);

export const VaultProvider = ({ children }) => {
  const [vaultPin, setVaultPin] = useState(null);

  const unlockVault = (pin) => {
    setVaultPin(pin);
  };

  const lockVault = () => {
    setVaultPin(null);
  };

  return (
    <VaultContext.Provider value={{ vaultPin, unlockVault, lockVault }}>
      {children}
    </VaultContext.Provider>
  );
};
