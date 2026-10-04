import React, { createContext, useContext, useState } from 'react';

const SettingsContext = createContext({});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
  // Default to INR
  const [currency, setCurrency] = useState('INR');

  const formatCurrency = (amount) => {
    let locale = 'en-US';
    if (currency === 'INR') locale = 'en-IN';
    if (currency === 'EUR') locale = 'en-IE'; // or any euro country
    if (currency === 'CNY') locale = 'zh-CN';

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <SettingsContext.Provider value={{ currency, setCurrency, formatCurrency }}>
      {children}
    </SettingsContext.Provider>
  );
};
