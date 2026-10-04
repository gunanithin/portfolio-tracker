import React from 'react';
import { useVault } from '../context/VaultContext';
import VaultUnlock from './VaultUnlock';

const VaultGuard = ({ children }) => {
  const { vaultPin } = useVault();

  if (!vaultPin) {
    return <VaultUnlock />;
  }

  return children;
};

export default VaultGuard;
