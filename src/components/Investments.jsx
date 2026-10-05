import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVault } from '../context/VaultContext';
import { useSettings } from '../context/SettingsContext';
import { useDialog } from '../context/DialogContext';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { encryptData, decryptData } from '../utils/encryption';
import { fetchLivePrices } from '../utils/marketData';
import { COMMON_STOCKS, COMMON_CRYPTO, COMMON_ETFS, COMMON_MUTUAL_FUNDS } from '../utils/tickers';
import { Plus, TrendingUp, TrendingDown, Trash2, ShieldCheck, RefreshCw, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';

const Investments = () => {
  const { currentUser } = useAuth();
  const { vaultPin } = useVault();
  const { formatCurrency, currency } = useSettings();
  const { showAlert, showConfirm } = useDialog();
  const [investments, setInvestments] = useState([]);
  const [livePrices, setLivePrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [fetchingPrices, setFetchingPrices] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({
    'Stock': true,
    'ETF': true,
    'Mutual Fund': true,
    'Crypto': true,
    'Real Estate': true,
    'PPF': true,
    'NPS': true
  });
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  
  // Form State
  const getBrokerOptions = (assetType) => {
    switch (assetType) {
      case 'Stock':
      case 'ETF':
        return ['Zerodha Kite', 'Groww', 'Upstox', 'Angel One', 'ICICI Direct', 'HDFC Sky', 'Other'];
      case 'Mutual Fund':
        return ['Coin by Zerodha', 'Groww', 'Kuvera', 'ET Money', 'Direct AMC', 'Other'];
      case 'Crypto':
        return ['CoinDCX', 'WazirX', 'Binance', 'CoinSwitch', 'Hardware Wallet', 'Other'];
      case 'Real Estate':
        return ['Self-Managed', 'Property Manager', 'Other'];
      case 'PPF':
        return ['Post Office', 'SBI', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Other'];
      case 'NPS':
        return ['NSDL e-Gov', 'KFintech', 'SBI Pension Funds', 'HDFC Pension', 'ICICI Pru Pension', 'Other'];
      default:
        return ['Other'];
    }
  };

  const [broker, setBroker] = useState('Zerodha Kite');
  const [exchange, setExchange] = useState('NSE'); // NSE or BSE
  const [type, setType] = useState('Stock');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live Search State
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!currentUser || !vaultPin) return;

    const q = query(collection(db, 'investments'), where('userId', '==', currentUser.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedData = [];
      snapshot.forEach((docSnap) => {
        try {
          const rawData = docSnap.data();
          // The actual portfolio data is stored as encrypted ciphertext in 'encryptedPayload'
          const decryptedAsset = decryptData(rawData.encryptedPayload, vaultPin);
          loadedData.push({
            id: docSnap.id,
            ...decryptedAsset,
            createdAt: rawData.createdAt
          });
        } catch (err) {
          console.error("Could not decrypt document", docSnap.id);
          // If PIN is wrong or data corrupted, we can't show it.
        }
      });
      setInvestments(loadedData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching data:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, vaultPin]);

  useEffect(() => {
    if (investments.length > 0) {
      setFetchingPrices(true);
      fetchLivePrices(investments, currency).then(prices => {
        setLivePrices(prices);
        setFetchingPrices(false);
      });
    }
  }, [investments, currency]);

  // Live Autocomplete Effect via Yahoo Finance
  useEffect(() => {
    if (symbol.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/yahoo-finance/v1/finance/search?q=${encodeURIComponent(symbol)}`);
        if (!response.ok) return;
        
        const data = await response.json();
        if (data.quotes && data.quotes.length > 0) {
          const results = data.quotes
            .filter(q => q.quoteType === 'EQUITY' || q.quoteType === 'CRYPTOCURRENCY' || q.quoteType === 'ETF' || q.quoteType === 'MUTUALFUND')
            .filter(q => {
              if (type === 'Crypto') return q.quoteType === 'CRYPTOCURRENCY';
              if (type === 'Mutual Fund') return q.quoteType === 'MUTUALFUND';
              if (type === 'Stock') {
                if (q.quoteType !== 'EQUITY' && q.quoteType !== 'ETF') return false;
                if (exchange === 'NSE') return q.exchange === 'NSI' || q.symbol.endsWith('.NS');
                if (exchange === 'BSE') return q.exchange === 'BSE' || q.exchange === 'BOM' || q.symbol.endsWith('.BO');
                return true;
              }
              if (type === 'ETF') {
                if (q.quoteType !== 'ETF' && q.quoteType !== 'EQUITY') return false;
                if (exchange === 'NSE') return q.exchange === 'NSI' || q.symbol.endsWith('.NS');
                if (exchange === 'BSE') return q.exchange === 'BSE' || q.exchange === 'BOM' || q.symbol.endsWith('.BO');
                return true;
              }
              return false;
            })
            .map(q => ({
              symbol: q.symbol, // Raw Yahoo symbol (e.g., AAPL, RELIANCE.NS)
              name: q.longname || q.shortname || q.symbol,
              exchange: q.exchDisp || q.exchange || ''
            }));
          setSearchResults(results);
        }
      } catch (err) {
        console.error("Yahoo search failed", err);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [symbol, exchange, type]);

  const handleSaveAsset = async (e) => {
    e.preventDefault();
    const isFixedType = ['Real Estate', 'PPF', 'NPS'].includes(type);
    if (!isFixedType && !symbol) return;
    
    const finalQuantity = isFixedType ? 1 : parseFloat(quantity);
    if (!finalQuantity || !purchasePrice) return;
    
    setIsSubmitting(true);
    try {
      const assetData = {
        name: name.trim() || (isFixedType ? type : symbol.toUpperCase()),
        symbol: isFixedType ? '' : symbol.toUpperCase(),
        type,
        broker,
        quantity: finalQuantity,
        purchasePrice: parseFloat(purchasePrice),
        exchange: type === 'Crypto' ? 'Crypto' : exchange,
      };

      // ZERO-KNOWLEDGE ENCRYPTION: 
      // We encrypt the asset details BEFORE sending to Firebase
      const ciphertext = encryptData(assetData, vaultPin);

      if (editingAssetId) {
        await updateDoc(doc(db, 'investments', editingAssetId), {
          encryptedPayload: ciphertext
        });
      } else {
        await addDoc(collection(db, 'investments'), {
          userId: currentUser.uid,
          encryptedPayload: ciphertext,
          createdAt: serverTimestamp()
        });
      }

      setShowModal(false);
      setEditingAssetId(null);
      setName('');
      setSymbol('');
      setQuantity('');
      setPurchasePrice('');
    } catch (err) {
      console.error("Failed to save asset", err);
      showAlert("Encryption Error", "Error saving asset. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (inv) => {
    setEditingAssetId(inv.id);
    setType(inv.type || 'Stock');
    setBroker(inv.broker || getBrokerOptions(inv.type || 'Stock')[0]);
    setExchange(inv.exchange || 'NSE');
    setSymbol(inv.symbol || '');
    setName(inv.name || '');
    setQuantity(inv.quantity.toString());
    setPurchasePrice(inv.purchasePrice.toString());
    setShowModal(true);
  };

  const openAddModal = () => {
    setEditingAssetId(null);
    setType('Stock');
    setBroker(getBrokerOptions('Stock')[0]);
    setExchange('NSE');
    setSymbol('');
    setName('');
    setQuantity('');
    setPurchasePrice('');
    setShowModal(true);
  };

  const handleDelete = (id) => {
    showConfirm(
      "Delete Asset",
      "Are you sure you want to delete this asset?",
      async () => {
        try {
          await deleteDoc(doc(db, 'investments', id));
        } catch (err) {
          console.error("Error deleting", err);
        }
      }
    );
  };

  // Calculate Total Value (assuming current price == purchase price for MVP)
  const totalInvested = investments.reduce((acc, curr) => acc + (curr.quantity * curr.purchasePrice), 0);
  const totalNetWorth = investments.reduce((acc, curr) => {
    const currentPrice = livePrices[curr.symbol] || curr.purchasePrice;
    return acc + (curr.quantity * currentPrice);
  }, 0);

  const groupedInvestments = investments.reduce((acc, inv) => {
    const type = inv.type || 'Other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(inv);
    return acc;
  }, {});

  Object.keys(groupedInvestments).forEach(type => {
    groupedInvestments[type].sort((a, b) => {
      let aValue, bValue;
      switch (sortConfig.key) {
        case 'name':
          aValue = (a.name || a.symbol).toLowerCase();
          bValue = (b.name || b.symbol).toLowerCase();
          break;
        case 'quantity':
          aValue = a.quantity;
          bValue = b.quantity;
          break;
        case 'purchasePrice':
          aValue = a.purchasePrice;
          bValue = b.purchasePrice;
          break;
        case 'livePrice':
          aValue = livePrices[a.symbol] || a.purchasePrice;
          bValue = livePrices[b.symbol] || b.purchasePrice;
          break;
        case 'totalValue':
          aValue = a.quantity * (livePrices[a.symbol] || a.purchasePrice);
          bValue = b.quantity * (livePrices[b.symbol] || b.purchasePrice);
          break;
        default:
          aValue = (a.name || a.symbol).toLowerCase();
          bValue = (b.name || b.symbol).toLowerCase();
      }
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  });

  const toggleGroup = (type) => {
    setExpandedGroups(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  if (loading) {
    return (
      <div style={{ height: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div className="loading-spinner" style={{ width: '40px', height: '40px', marginBottom: '24px' }}></div>
        <h2 className="heading-gradient" style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Loading Vault...</h2>
        <p className="text-muted" style={{ fontSize: '0.9rem', opacity: 0.7 }}>Decrypting your investments</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', width: '100%' }}>
      <div className="flex justify-between items-center" style={{ marginBottom: '32px' }}>
        <div>
          <h1 className="heading-gradient" style={{ fontSize: '2rem', marginBottom: '8px' }}>Your Vault</h1>
          <p className="text-muted flex items-center gap-2">
            <ShieldCheck size={16} color="var(--success)" /> 
            End-to-End Encrypted
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={openAddModal}>
          <Plus size={18} /> Add Asset
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px' }}>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-muted" style={{ fontSize: '0.9rem' }}>Live Net Worth</h3>
          {fetchingPrices && <RefreshCw size={14} color="var(--accent)" className="animate-spin" />}
        </div>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>
          {formatCurrency(totalNetWorth)}
        </h2>
      </div>

      <div className="glass-panel" style={{ padding: '0', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--panel-border)', background: 'rgba(0,0,0,0.2)' }}>
              <th onClick={() => handleSort('name')} style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>
                <div className="flex items-center gap-1">Asset {renderSortIcon('name')}</div>
              </th>
              <th style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 500 }}>Type</th>
              <th onClick={() => handleSort('quantity')} style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>
                <div className="flex items-center gap-1">Quantity {renderSortIcon('quantity')}</div>
              </th>
              <th onClick={() => handleSort('purchasePrice')} style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>
                <div className="flex items-center gap-1">Avg Buy Price {renderSortIcon('purchasePrice')}</div>
              </th>
              <th onClick={() => handleSort('livePrice')} style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>
                <div className="flex items-center gap-1">Live Price {renderSortIcon('livePrice')}</div>
              </th>
              <th onClick={() => handleSort('totalValue')} style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}>
                <div className="flex items-center gap-1">Total Value {renderSortIcon('totalValue')}</div>
              </th>
              <th style={{ padding: '16px 24px' }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Decrypting Vault...
                </td>
              </tr>
            ) : investments.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Your vault is empty. Add an asset to begin.
                </td>
              </tr>
            ) : (
              Object.keys(groupedInvestments).map(type => (
                <React.Fragment key={type}>
                  <tr 
                    onClick={() => toggleGroup(type)} 
                    style={{ 
                      background: 'rgba(255,255,255,0.02)', 
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--panel-border)'
                    }}
                  >
                    <td colSpan="7" style={{ padding: '12px 24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                      <div className="flex items-center gap-2">
                        <ChevronRight 
                          size={16} 
                          style={{ 
                            transform: expandedGroups[type] ? 'rotate(90deg)' : 'rotate(0deg)', 
                            transition: 'transform 0.2s' 
                          }} 
                        />
                        {type}s <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>({groupedInvestments[type].length})</span>
                      </div>
                    </td>
                  </tr>
                  {expandedGroups[type] && groupedInvestments[type].map(inv => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--panel-border)', background: 'rgba(0,0,0,0.1)' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontWeight: '600' }}>{inv.name || inv.symbol}</div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                          {inv.name && inv.name !== inv.symbol && (
                             <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{inv.symbol}</span>
                          )}
                          {inv.broker && (
                            <span style={{ 
                              fontSize: '0.7rem', 
                              background: 'rgba(255,255,255,0.05)', 
                              border: '1px solid rgba(255,255,255,0.1)', 
                              padding: '2px 8px', 
                              borderRadius: '6px', 
                              color: 'var(--text-muted)' 
                            }}>
                              {inv.broker}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ 
                          background: 'rgba(56, 189, 248, 0.1)', 
                          color: 'var(--accent)', 
                          padding: '4px 10px', 
                          borderRadius: '12px',
                          fontSize: '0.8rem'
                        }}>
                          {inv.type}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        {['Real Estate', 'PPF', 'NPS'].includes(inv.type) ? '-' : inv.quantity}
                      </td>
                      <td style={{ padding: '16px 24px' }}>{formatCurrency(inv.purchasePrice)}</td>
                      <td style={{ padding: '16px 24px' }}>
                        {['Real Estate', 'PPF', 'NPS'].includes(inv.type) ? (
                          <span className="text-muted">Fixed</span>
                        ) : livePrices[inv.symbol] ? (
                          <div className="flex items-center gap-1">
                            {formatCurrency(livePrices[inv.symbol])}
                            {livePrices[inv.symbol] >= inv.purchasePrice ? 
                              <TrendingUp size={14} color="var(--success)"/> : 
                              <TrendingUp size={14} color="var(--danger)" style={{transform: 'rotate(180deg)'}}/>
                            }
                          </div>
                        ) : fetchingPrices ? (
                          <span className="text-muted">Syncing...</span>
                        ) : (
                          <span className="text-muted" title="Price unavailable">N/A</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 24px', fontWeight: 'bold' }}>
                        {formatCurrency(
                          ['Real Estate', 'PPF', 'NPS'].includes(inv.type) 
                            ? inv.purchasePrice 
                            : inv.quantity * (livePrices[inv.symbol] || inv.purchasePrice)
                        )}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button 
                          onClick={() => handleEdit(inv)}
                          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '8px', marginRight: '4px' }}
                          title="Edit Asset"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button 
                          onClick={() => handleDelete(inv.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '8px' }}
                          title="Delete Asset"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Asset Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="heading-gradient" style={{ fontSize: '1.5rem', marginBottom: '24px' }}>
              {editingAssetId ? 'Edit Asset' : 'Add New Asset'}
            </h2>
            
            <form onSubmit={handleSaveAsset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div>
                <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Asset Type</label>
                <select 
                  value={type}
                  onChange={e => {
                    const newType = e.target.value;
                    setType(newType);
                    setBroker(getBrokerOptions(newType)[0]);
                    if (['Real Estate', 'PPF', 'NPS'].includes(newType)) setSymbol(''); // Clear symbol for non-live assets
                  }}
                  style={{
                    width: '100%', padding: '12px',
                    background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)',
                    borderRadius: '8px', color: 'var(--text-primary)', outline: 'none',
                    appearance: 'none'
                  }}
                >
                  <option value="Stock">Stock</option>
                  <option value="ETF">ETF</option>
                  <option value="Mutual Fund">Mutual Fund</option>
                  <option value="Crypto">Crypto</option>
                  <option value="Real Estate">Real Estate</option>
                  <option value="PPF">PPF</option>
                  <option value="NPS">NPS</option>
                </select>
              </div>

              <div>
                <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Broker / Platform</label>
                <select 
                  value={broker}
                  onChange={e => setBroker(e.target.value)}
                  style={{
                    width: '100%', padding: '12px',
                    background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)',
                    borderRadius: '8px', color: 'var(--text-primary)', outline: 'none',
                    appearance: 'none'
                  }}
                >
                  {getBrokerOptions(type).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {(type === 'Stock' || type === 'ETF') && (
                <div>
                  <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Exchange</label>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="exchange" 
                        value="NSE" 
                        checked={exchange === 'NSE'} 
                        onChange={(e) => setExchange(e.target.value)} 
                      /> NSE
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="exchange" 
                        value="BSE" 
                        checked={exchange === 'BSE'} 
                        onChange={(e) => setExchange(e.target.value)} 
                      /> BSE
                    </label>
                  </div>
                </div>
              )}

              {!['Real Estate', 'PPF', 'NPS'].includes(type) && (
              <div style={{ position: 'relative' }}>
                <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Asset Code / Ticker</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    placeholder="Search Yahoo Finance (e.g. AAPL, RELIANCE.NS)" 
                    value={symbol}
                    onChange={e => {
                      setSymbol(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    required
                    style={{
                      width: '100%', padding: '12px',
                      background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)',
                      borderRadius: '8px', color: 'var(--text-primary)', outline: 'none'
                    }}
                  />
                  {/* Dropdown Caret Icon */}
                  <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                </div>

                {/* Custom Floating Dropdown */}
                {showDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    right: 0,
                    background: '#1e1e24',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    zIndex: 50,
                    maxHeight: '240px',
                    overflowY: 'auto',
                    padding: '8px 0'
                  }}>
                    {/* Tooltip pointer arrow */}
                    <div style={{
                      position: 'absolute',
                      top: '-6px',
                      left: '24px',
                      width: '12px',
                      height: '12px',
                      background: '#1e1e24',
                      borderLeft: '1px solid rgba(255,255,255,0.1)',
                      borderTop: '1px solid rgba(255,255,255,0.1)',
                      transform: 'rotate(45deg)'
                    }}></div>

                    <div style={{ position: 'relative', zIndex: 2 }}>
                      {symbol.length < 2 ? (
                        <div style={{ padding: '16px', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', textAlign: 'center' }}>
                          Start typing to search live assets...
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div style={{ padding: '16px', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', textAlign: 'center' }}>
                          No assets found.
                        </div>
                      ) : (
                        searchResults.map(t => (
                          <div 
                            key={t.symbol}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSymbol(t.symbol);
                              if (!name) setName(t.name);
                              setShowDropdown(false);
                            }}
                            style={{
                              padding: '10px 16px',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              borderBottom: '1px solid rgba(255,255,255,0.05)'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#ffffff' }}>{t.symbol}</span>
                            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                              {t.name} {t.exchange && `(${t.exchange})`}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              )}

              <div>
                <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Asset Alias Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. My Apple Shares" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  style={{
                    width: '100%', padding: '12px',
                    background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)',
                    borderRadius: '8px', color: 'var(--text-primary)', outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                {!['Real Estate', 'PPF', 'NPS'].includes(type) && (
                <div style={{ flex: 1 }}>
                  <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Quantity</label>
                  <input 
                    type="number" 
                    step="any"
                    min="0"
                    placeholder="0.00" 
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    required
                    style={{
                      width: '100%', padding: '12px',
                      background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)',
                      borderRadius: '8px', color: 'var(--text-primary)', outline: 'none'
                    }}
                  />
                </div>
                )}
                <div style={{ flex: 1 }}>
                  <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>
                    {['Real Estate', 'PPF', 'NPS'].includes(type) ? `Current Value (${currency})` : `Avg Buy Price (${currency})`}
                  </label>
                  <input 
                    type="number" 
                    step="any"
                    min="0"
                    placeholder="0.00" 
                    value={purchasePrice}
                    onChange={e => setPurchasePrice(e.target.value)}
                    required
                    style={{
                      width: '100%', padding: '12px',
                      background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)',
                      borderRadius: '8px', color: 'var(--text-primary)', outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-4" style={{ marginTop: '16px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  style={{ 
                    flex: 1, padding: '12px', 
                    background: 'transparent', border: '1px solid var(--panel-border)', 
                    color: 'var(--text-primary)', borderRadius: '8px', cursor: 'pointer' 
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="btn-primary" 
                  style={{ flex: 1, padding: '12px' }}
                >
                  {isSubmitting ? 'Encrypting...' : (editingAssetId ? 'Update Asset' : 'Save Securely')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Investments;
