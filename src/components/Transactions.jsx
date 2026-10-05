import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVault } from '../context/VaultContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, writeBatch, doc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { encryptData, decryptData } from '../utils/encryption';
import { ArrowRightLeft, Plus, Calendar, IndianRupee, Trash2, ChevronUp, ChevronDown, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Transactions = () => {
  const { currentUser } = useAuth();
  const { vaultPin } = useVault();
  
  const [investments, setInvestments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [filterType, setFilterType] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [assetSearchTerm, setAssetSearchTerm] = useState('');
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);
  
  const [txType, setTxType] = useState('Buy');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Load Investments (for dropdown) and Transactions (for ledger)
  useEffect(() => {
    if (!currentUser || !vaultPin) return;

    // Fetch Investments
    const invQ = query(collection(db, 'investments'), where('userId', '==', currentUser.uid));
    const unsubInv = onSnapshot(invQ, (snapshot) => {
      const loadedInv = [];
      snapshot.forEach(docSnap => {
        try {
          const raw = docSnap.data();
          const decrypted = decryptData(raw.encryptedPayload, vaultPin);
          loadedInv.push({ id: docSnap.id, ...decrypted });
        } catch (e) {
          console.error("Error decrypting asset", e);
        }
      });
      setInvestments(loadedInv);
    });

    // Fetch Transactions
    const txQ = query(collection(db, 'transactions'), where('userId', '==', currentUser.uid));
    const unsubTx = onSnapshot(txQ, (snapshot) => {
      const loadedTx = [];
      snapshot.forEach(docSnap => {
        try {
          const raw = docSnap.data();
          const decrypted = decryptData(raw.data, vaultPin);
          loadedTx.push({ id: docSnap.id, ...decrypted, createdAt: raw.createdAt });
        } catch (e) {
          console.error("Error decrypting transaction", e);
        }
      });
      
      // Base loaded transactions (sorting handled at render time)
      setTransactions(loadedTx);
      setLoading(false);
    });

    return () => {
      unsubInv();
      unsubTx();
    };
  }, [currentUser, vaultPin]);

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    if (!selectedAssetId || !price || !date) return;
    if ((txType === 'Buy' || txType === 'Sell') && !quantity) return;

    setIsSubmitting(true);
    try {
      const asset = investments.find(inv => inv.id === selectedAssetId);
      if (!asset) throw new Error("Asset not found");

      const qtyNum = parseFloat(quantity) || 0;
      const priceNum = parseFloat(price);

      // 1. Prepare Transaction Data
      const txData = {
        assetId: asset.id,
        assetName: asset.name,
        type: txType,
        quantity: qtyNum,
        price: priceNum,
        date: date
      };

      // 2. Prepare Updated Asset Data (Recalculate Averages)
      const updatedAsset = { ...asset };
      delete updatedAsset.id; // Don't store the document ID inside the payload

      if (txType === 'Buy') {
        const oldTotalValue = asset.quantity * asset.purchasePrice;
        const newTotalValue = qtyNum * priceNum;
        const newQuantity = asset.quantity + qtyNum;
        updatedAsset.quantity = newQuantity;
        updatedAsset.purchasePrice = (oldTotalValue + newTotalValue) / newQuantity;
      } else if (txType === 'Sell') {
        const newQuantity = asset.quantity - qtyNum;
        if (newQuantity < 0) {
          alert("You cannot sell more shares than you own!");
          setIsSubmitting(false);
          return;
        }
        updatedAsset.quantity = newQuantity;
        // Average purchase price does not change when selling
      }
      // If Dividend, we don't change quantity or average price of the asset

      // 3. Execute Batch Write (Atomically update both collections)
      const batch = writeBatch(db);
      
      // Add transaction doc
      const newTxRef = doc(collection(db, 'transactions'));
      batch.set(newTxRef, {
        userId: currentUser.uid,
        data: encryptData(txData, vaultPin),
        createdAt: serverTimestamp()
      });

      // Update investment doc
      const invRef = doc(db, 'investments', asset.id);
      batch.update(invRef, {
        encryptedPayload: encryptData(updatedAsset, vaultPin),
        updatedAt: serverTimestamp()
      });

      await batch.commit();

      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error("Error saving transaction", err);
      alert("Failed to save transaction securely.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (id) => {
    // Note: In a robust app, deleting a transaction would ideally reverse the math on the asset.
    // For simplicity, we just delete the log here.
    if (window.confirm("Are you sure you want to delete this transaction log? (This will NOT undo the quantity changes on the asset)")) {
      await deleteDoc(doc(db, 'transactions', id));
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedTransactions = [...transactions]
    .filter(tx => filterType === 'All' || tx.type === filterType)
    .filter(tx => {
      if (startDate && new Date(tx.date) < new Date(startDate)) return false;
      if (endDate && new Date(tx.date) > new Date(endDate)) return false;
      return true;
    })
    .filter(tx => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (tx.assetName || '').toLowerCase().includes(query);
    })
    .sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    
    // special handling for derived/numeric values
    if (sortConfig.key === 'totalValue') {
      aVal = a.type !== 'Dividend' ? a.quantity * a.price : a.price;
      bVal = b.type !== 'Dividend' ? b.quantity * b.price : b.price;
    } else if (sortConfig.key === 'date') {
      aVal = new Date(a.date).getTime();
      bVal = new Date(b.date).getTime();
    }
    
    // Handle string comparisons
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="inline ml-1" /> : <ChevronDown size={14} className="inline ml-1" />;
  };

  const resetForm = () => {
    setSelectedAssetId('');
    setAssetSearchTerm('');
    setShowAssetDropdown(false);
    setTxType('Buy');
    setQuantity('');
    setPrice('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text('Transaction Ledger', 14, 22);
    
    // Subtitle (Date range if applied)
    doc.setFontSize(11);
    doc.setTextColor(100);
    const dateText = (startDate && endDate) ? `From ${startDate} to ${endDate}` : startDate ? `From ${startDate}` : endDate ? `Up to ${endDate}` : 'All Time';
    const filterText = filterType !== 'All' ? ` | Filter: ${filterType}` : '';
    doc.text(dateText + filterText, 14, 30);
    
    // Prepare table data
    const tableColumn = ["Date", "Asset", "Type", "Quantity", "Price", "Total"];
    const tableRows = [];
    
    filteredAndSortedTransactions.forEach(tx => {
      const txData = [
        new Date(tx.date).toLocaleDateString(),
        tx.assetName,
        tx.type,
        tx.type !== 'Dividend' ? tx.quantity : '-',
        formatCurrency(tx.price).replace('₹', 'Rs. '),
        formatCurrency(tx.type !== 'Dividend' ? tx.quantity * tx.price : tx.price).replace('₹', 'Rs. ')
      ];
      tableRows.push(txData);
    });
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [56, 189, 248], textColor: 255 }
    });
    
    doc.save(`Transactions_${new Date().getTime()}.pdf`);
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="heading-gradient" style={{ fontSize: '2rem' }}>Transactions Ledger</h1>
          <p className="text-muted mt-2">Log and view historical activity across your portfolio.</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowModal(true)}>
          <Plus size={18} />
          Add Transaction
        </button>
      </div>

      {!loading && transactions.length > 0 && (
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex justify-between items-center flex-wrap gap-4 glass-panel" style={{ padding: '16px 20px', borderRadius: '12px' }}>
            
            {/* Date Range & Export */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted font-medium">Date Range:</span>
              <input 
                type="date" 
                className="input-field" 
                style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
              />
              <span className="text-muted text-sm">to</span>
              <input 
                type="date" 
                className="input-field" 
                style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
              />
            </div>
            
            <button onClick={handleDownloadPDF} className="btn-secondary flex items-center gap-2" style={{ padding: '8px 16px' }}>
              <Download size={16} /> Export PDF
            </button>
          </div>

          <div className="flex justify-between items-center flex-wrap gap-4">
            {/* Pills */}
            <div className="flex gap-1 p-1" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
              {['All', 'Buy', 'Sell', 'Dividend'].map(type => (
                <button 
                  key={type}
                  onClick={() => setFilterType(type)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    background: filterType === type ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    color: filterType === type ? 'var(--accent)' : 'var(--text-muted)',
                    transition: 'all 0.2s ease',
                    border: '1px solid',
                    borderColor: filterType === type ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Search */}
            <div style={{ position: 'relative', width: '300px', maxWidth: '100%' }}>
              <input 
                type="text" 
                placeholder="Search by asset name..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field w-full"
                style={{ paddingLeft: '36px' }}
              />
              <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center my-12"><div className="loading-spinner"></div></div>
      ) : transactions.length === 0 ? (
        <div className="glass-panel text-center py-12">
          <ArrowRightLeft size={48} color="var(--text-muted)" style={{ margin: '0 auto', marginBottom: '16px', opacity: 0.5 }} />
          <h3>No Transactions Logged</h3>
          <p className="text-muted mt-2">Start building your history by logging buys, sells, or dividends.</p>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '16px 24px', fontWeight: '500', cursor: 'pointer' }} className="text-muted sortable-header" onClick={() => handleSort('date')}>Date <SortIcon columnKey="date" /></th>
                <th style={{ padding: '16px 24px', fontWeight: '500', cursor: 'pointer' }} className="text-muted sortable-header" onClick={() => handleSort('assetName')}>Asset <SortIcon columnKey="assetName" /></th>
                <th style={{ padding: '16px 24px', fontWeight: '500', cursor: 'pointer' }} className="text-muted sortable-header" onClick={() => handleSort('type')}>Type <SortIcon columnKey="type" /></th>
                <th style={{ padding: '16px 24px', fontWeight: '500', cursor: 'pointer' }} className="text-muted sortable-header" onClick={() => handleSort('quantity')}>Quantity <SortIcon columnKey="quantity" /></th>
                <th style={{ padding: '16px 24px', fontWeight: '500', cursor: 'pointer' }} className="text-muted sortable-header" onClick={() => handleSort('price')}>Price <SortIcon columnKey="price" /></th>
                <th style={{ padding: '16px 24px', fontWeight: '500', cursor: 'pointer' }} className="text-muted sortable-header" onClick={() => handleSort('totalValue')}>Total Value <SortIcon columnKey="totalValue" /></th>
                <th style={{ padding: '16px 24px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedTransactions.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No transactions match your filters.
                  </td>
                </tr>
              ) : (
                filteredAndSortedTransactions.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '16px 24px' }}>
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-muted" />
                      <span>{new Date(tx.date).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 24px', fontWeight: '500' }}>{tx.assetName}</td>
                  <td style={{ padding: '16px 24px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      backgroundColor: tx.type === 'Buy' ? 'rgba(16,185,129,0.1)' : tx.type === 'Sell' ? 'rgba(239,68,68,0.1)' : 'rgba(56,189,248,0.1)',
                      color: tx.type === 'Buy' ? '#10b981' : tx.type === 'Sell' ? '#ef4444' : '#38bdf8'
                    }}>
                      {tx.type}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px' }}>{tx.type !== 'Dividend' ? tx.quantity : '-'}</td>
                  <td style={{ padding: '16px 24px' }}>{formatCurrency(tx.price)}</td>
                  <td style={{ padding: '16px 24px', fontWeight: '500' }}>
                    {formatCurrency(tx.type !== 'Dividend' ? tx.quantity * tx.price : tx.price)}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <button className="btn-icon" onClick={() => handleDeleteTransaction(tx.id)} title="Delete Log">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="mb-6">Log Transaction</h2>
            <form onSubmit={handleSaveTransaction} className="flex flex-col gap-4">
              
              <div className="relative">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm text-muted">Select Asset</label>
                  <Link to="/investments" className="text-sm font-medium" style={{ color: 'var(--accent)', textDecoration: 'none' }} onClick={() => setShowModal(false)}>
                    + Buy New Asset
                  </Link>
                </div>
                
                <div style={{ position: 'relative' }}>
                  <input 
                    type="text" 
                    placeholder="-- Search or Select Asset --"
                    value={assetSearchTerm}
                    onChange={(e) => {
                      setAssetSearchTerm(e.target.value);
                      setShowAssetDropdown(true);
                      setSelectedAssetId(''); // clear ID if they start typing again
                    }}
                    onFocus={() => setShowAssetDropdown(true)}
                    onBlur={() => setTimeout(() => setShowAssetDropdown(false), 200)}
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
                {showAssetDropdown && (
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
                      {investments.length === 0 ? (
                        <div style={{ padding: '16px', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', textAlign: 'center' }}>
                          No assets in your vault.
                        </div>
                      ) : investments.filter(inv => (inv.name || '').toLowerCase().includes((assetSearchTerm || '').toLowerCase()) || (inv.symbol || '').toLowerCase().includes((assetSearchTerm || '').toLowerCase())).length === 0 ? (
                        <div style={{ padding: '16px', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', textAlign: 'center' }}>
                          No assets found matching "{assetSearchTerm}"
                        </div>
                      ) : (
                        investments
                          .filter(inv => (inv.name || '').toLowerCase().includes((assetSearchTerm || '').toLowerCase()) || (inv.symbol || '').toLowerCase().includes((assetSearchTerm || '').toLowerCase()))
                          .map(inv => (
                          <div 
                            key={inv.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSelectedAssetId(inv.id);
                              setAssetSearchTerm(`${inv.name} (${inv.type})`);
                              setShowAssetDropdown(false);
                            }}
                            style={{
                              padding: '10px 16px',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              borderBottom: '1px solid rgba(255,255,255,0.05)'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#ffffff' }}>{inv.name}</div>
                            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>{inv.broker} • {inv.type}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block mb-2 text-sm text-muted">Transaction Type</label>
                <select 
                  className="input-field w-full" 
                  value={txType} 
                  onChange={(e) => setTxType(e.target.value)}
                >
                  <option value="Buy">Buy (Add to holdings)</option>
                  <option value="Sell">Sell (Reduce holdings)</option>
                  <option value="Dividend">Dividend / Interest</option>
                </select>
              </div>

              {txType !== 'Dividend' && (
                <div>
                  <label className="block mb-2 text-sm text-muted">Quantity</label>
                  <input 
                    type="number" 
                    step="any"
                    min="0"
                    className="input-field w-full" 
                    value={quantity} 
                    onChange={(e) => setQuantity(e.target.value)} 
                    required 
                  />
                </div>
              )}

              <div>
                <label className="block mb-2 text-sm text-muted">
                  {txType === 'Dividend' ? 'Total Dividend Received (₹)' : 'Price Per Unit (₹)'}
                </label>
                <div className="relative">
                  <IndianRupee size={16} className="absolute left-3 top-3 text-muted" />
                  <input 
                    type="number" 
                    step="any"
                    min="0"
                    className="input-field w-full pl-10" 
                    value={price} 
                    onChange={(e) => setPrice(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div>
                <label className="block mb-2 text-sm text-muted">Date</label>
                <input 
                  type="date" 
                  className="input-field w-full" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)} 
                  required 
                />
              </div>

              <div className="flex gap-4 mt-4">
                <button type="button" className="btn-secondary flex-1" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Securely'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
