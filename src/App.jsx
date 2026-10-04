import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Wallet, Shield, Settings as SettingsIcon, LogOut, ArrowRightLeft, Sun, Moon } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Investments from './components/Investments';
import Settings from './components/Settings';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import { VaultProvider } from './context/VaultContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import VaultGuard from './components/VaultGuard';

const CurrencySelector = () => {
  const { currency, setCurrency } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const options = [
    { code: 'INR', symbol: '₹', label: 'Rupee' },
    { code: 'USD', symbol: '$', label: 'Dollar' },
    { code: 'EUR', symbol: '€', label: 'Euro' },
    { code: 'CNY', symbol: '¥', label: 'Yuan' }
  ];
  
  const currentOption = options.find(o => o.code === currency);

  return (
    <div style={{ position: 'relative', marginTop: '12px' }}>
      <label className="text-muted" style={{ fontSize: '0.75rem', display: 'block', marginBottom: '6px' }}>Preferred Currency</label>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--panel-border)', borderRadius: '8px',
          color: 'var(--text-primary)', fontSize: '0.85rem', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
          transition: 'all 0.2s ease',
          outline: 'none'
        }}
        onMouseEnter={(e) => e.target.style.borderColor = 'var(--accent)'}
        onMouseLeave={(e) => e.target.style.borderColor = isOpen ? 'var(--accent)' : 'var(--panel-border)'}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{currentOption.symbol}</span>
          {currentOption.code}
        </span>
        <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '8px',
          background: 'var(--bg-secondary)', border: '1px solid var(--panel-border)',
          borderRadius: '12px', overflow: 'hidden', zIndex: 999,
          boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(10px)'
        }}>
          {options.map(opt => (
            <button
              key={opt.code}
              onClick={() => { setCurrency(opt.code); setIsOpen(false); }}
              style={{
                width: '100%', padding: '12px', background: 'transparent',
                border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                color: opt.code === currency ? 'var(--accent)' : 'var(--text-primary)', 
                fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '12px',
                cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
            >
              <span style={{ width: '20px', fontWeight: 600, color: opt.code === currency ? 'var(--accent)' : 'var(--text-secondary)' }}>
                {opt.symbol}
              </span>
              <span>{opt.code} <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>({opt.label})</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Sidebar = ({ theme, toggleTheme }) => {
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const { currency, setCurrency } = useSettings();
  
  const navItems = [
    { path: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { path: '/investments', icon: <Wallet size={20} />, label: 'Investments' },
    { path: '/transactions', icon: <ArrowRightLeft size={20} />, label: 'Transactions' },
    { path: '/insurance', icon: <Shield size={20} />, label: 'Insurance Vault' },
    { path: '/settings', icon: <SettingsIcon size={20} />, label: 'Settings' },
  ];

  return (
    <div className="sidebar">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="heading-gradient" style={{ fontSize: '1.5rem', marginBottom: '4px' }}>PortfoTrack</h2>
          <p className="text-muted" style={{ fontSize: '0.8rem' }}>Secure Wealth Manager</p>
        </div>
        <button className="btn-icon" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <nav className="flex flex-col gap-2" style={{ marginTop: '24px' }}>
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      <div style={{ marginTop: 'auto' }}>
        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
          <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Signed in as</p>
          <p style={{ fontSize: '0.9rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentUser?.displayName || currentUser?.email}
          </p>
          
          <CurrencySelector />
        </div>

        <button 
          onClick={() => logout()}
          className="nav-item w-full flex items-center justify-start border-none" 
          style={{ background: 'transparent', cursor: 'pointer', padding: '12px' }}
        >
          <LogOut size={20} color="#ef4444" />
          <span style={{ color: '#ef4444' }}>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

const AppContent = () => {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <Routes>
      <Route path="/login" element={<Login theme={theme} toggleTheme={toggleTheme} />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <div className="app-container">
            <Sidebar theme={theme} toggleTheme={toggleTheme} />
            <main className="main-content">
              <VaultGuard>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/investments" element={<Investments />} />
                  <Route path="/transactions" element={<div className="glass-panel"><h2>Transactions (Coming Soon)</h2></div>} />
                  <Route path="/insurance" element={<div className="glass-panel"><h2>Insurance Vault (Coming Soon)</h2></div>} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </VaultGuard>
            </main>
          </div>
        </ProtectedRoute>
      } />
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <SettingsProvider>
          <VaultProvider>
            <AppContent />
          </VaultProvider>
        </SettingsProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
