import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVault } from '../context/VaultContext';
import { useSettings } from '../context/SettingsContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { encryptData, decryptData } from '../utils/encryption';
import { fetchLivePrices } from '../utils/marketData';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { ArrowUpRight, TrendingUp, Shield, Wallet, Eye, EyeOff, HeartPulse } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Dashboard = () => {
  const { currentUser } = useAuth();
  const { vaultPin } = useVault();
  const { formatCurrency, currency } = useSettings();
  
  const [investments, setInvestments] = useState([]);
  const [livePrices, setLivePrices] = useState({});
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchingPrices, setFetchingPrices] = useState(false);
  const [showFigures, setShowFigures] = useState(false);
  const [insurancePolicies, setInsurancePolicies] = useState([]);

  useEffect(() => {
    if (!currentUser || !vaultPin) return;

    const q = query(collection(db, 'investments'), where('userId', '==', currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedData = [];
      snapshot.forEach((docSnap) => {
        try {
          const rawData = docSnap.data();
          const decryptedAsset = decryptData(rawData.encryptedPayload, vaultPin);
          loadedData.push({ id: docSnap.id, ...decryptedAsset });
        } catch (err) {
          console.error("Failed to decrypt in Dashboard", docSnap.id);
        }
      });
      setInvestments(loadedData);
      setLoading(false);
    });

    // Also fetch Snapshots
    const qSnapshots = query(collection(db, 'netWorthSnapshots'), where('userId', '==', currentUser.uid));
    const unsubscribeSnapshots = onSnapshot(qSnapshots, (snapshot) => {
      const loadedSnaps = [];
      snapshot.forEach((docSnap) => {
        try {
          const rawData = docSnap.data();
          const decryptedSnap = decryptData(rawData.encryptedPayload, vaultPin);
          loadedSnaps.push({ date: rawData.date, netWorth: decryptedSnap.netWorth });
        } catch(e) {}
      });
      
      loadedSnaps.sort((a, b) => new Date(a.date) - new Date(b.date));
      setSnapshots(loadedSnaps);
    });

    const qInsurance = query(collection(db, 'insurance'), where('userId', '==', currentUser.uid));
    const unsubscribeInsurance = onSnapshot(qInsurance, (snapshot) => {
      const loadedPolicies = [];
      snapshot.forEach((docSnap) => {
        try {
          const encryptedData = docSnap.data().data;
          const decryptedStr = decryptData(encryptedData, vaultPin);
          const policyData = JSON.parse(decryptedStr);
          loadedPolicies.push({ id: docSnap.id, ...policyData });
        } catch (error) {}
      });
      setInsurancePolicies(loadedPolicies);
    });

    return () => {
      unsubscribe();
      unsubscribeSnapshots();
      unsubscribeInsurance();
    };
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

  // Calculations
  const totalNetWorth = investments.reduce((acc, curr) => {
    const currentPrice = livePrices[curr.symbol] || curr.purchasePrice;
    return acc + (curr.quantity * currentPrice);
  }, 0);
  
  const totalInvested = investments.reduce((acc, curr) => acc + (curr.quantity * curr.purchasePrice), 0);
  const totalProfit = totalNetWorth - totalInvested;
  const profitPercentage = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  // Snapshot Engine - Save today's net worth if it doesn't exist
  useEffect(() => {
    if (totalNetWorth > 0 && !fetchingPrices && snapshots !== null) {
      const today = new Date().toISOString().split('T')[0];
      const hasToday = snapshots.some(s => s.date === today);
      
      if (!hasToday) {
        // Save the snapshot securely
        const encryptedPayload = encryptData({ netWorth: totalNetWorth }, vaultPin);
        addDoc(collection(db, 'netWorthSnapshots'), {
          userId: currentUser.uid,
          date: today,
          encryptedPayload,
          timestamp: serverTimestamp()
        }).catch(err => console.error("Snapshot error:", err));
      }
    }
  }, [totalNetWorth, fetchingPrices, snapshots, currentUser, vaultPin]);

  const allocation = investments.reduce((acc, curr) => {
    const currentPrice = livePrices[curr.symbol] || curr.purchasePrice;
    const value = curr.quantity * currentPrice;
    acc[curr.type] = (acc[curr.type] || 0) + value;
    return acc;
  }, {});

  const allocationLabels = Object.keys(allocation).map(key => {
    const percentage = totalNetWorth > 0 ? ((allocation[key] / totalNetWorth) * 100).toFixed(1) : 0;
    return `${key} (${showFigures ? percentage : '**.*'}%)`;
  });
  const allocationValues = Object.values(allocation);

  // REAL Historical Data
  const chartLabels = snapshots.map(s => {
    const date = new Date(s.date);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
  
  const chartData = snapshots.map(s => s.netWorth);

  const netWorthData = {
    labels: chartLabels.length > 0 ? chartLabels : ['Today'],
    datasets: [
      {
        label: 'Net Worth',
        data: chartData.length > 0 ? chartData : [totalNetWorth],
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const allocationData = {
    labels: allocationLabels.length > 0 ? allocationLabels : ['No Assets'],
    datasets: [
      {
        data: allocationValues.length > 0 ? allocationValues : [1],
        backgroundColor: allocationValues.length > 0 ? [
          '#38bdf8', '#a853ba', '#10b981', '#f59e0b', '#e11d48'
        ] : ['#334155'], // Gray if empty
        borderWidth: 0,
        hoverOffset: 4
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#64748b',
          padding: 20,
          font: {
            family: "'Inter', sans-serif",
            size: 13,
            weight: '500'
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null && context.parsed.y !== undefined) {
              label += showFigures ? formatCurrency(context.parsed.y) : '********';
            } else if (context.parsed !== null) {
              label += showFigures ? formatCurrency(context.parsed) : '********';
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
        },
        ticks: {
          color: '#94a3b8',
          callback: function(value) {
            return showFigures ? formatCurrency(value) : '***';
          }
        }
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#94a3b8'
        }
      }
    }
  };

  const lifeCover = insurancePolicies.filter(p => p.type === 'Term Life').reduce((sum, p) => sum + p.coverAmount, 0);
  const healthCover = insurancePolicies.filter(p => p.type === 'Health').reduce((sum, p) => sum + p.coverAmount, 0);

  if (loading) {
    return (
      <div style={{ height: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div className="loading-spinner" style={{ width: '40px', height: '40px', marginBottom: '24px' }}></div>
        <h2 className="heading-gradient" style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Loading Dashboard...</h2>
        <p className="text-muted" style={{ fontSize: '0.9rem', opacity: 0.7 }}>Decrypting your vault</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="heading-gradient" style={{ fontSize: '2rem' }}>Dashboard</h1>
          <p className="text-muted mt-2">Welcome back. Here is your portfolio overview.</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <ArrowUpRight size={18} />
          Import CAS
        </button>
      </div>

      {/* Top Stats Cards */}
      <div className="dashboard-grid mb-8">
        <div className="glass-panel col-span-3">
          <div className="flex items-center gap-3 mb-4">
            <div style={{ background: 'rgba(56,189,248,0.1)', padding: '12px', borderRadius: '12px' }}>
              <Wallet size={20} color="#38bdf8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>Total Net Worth {fetchingPrices && <span style={{fontSize:'0.6rem', color:'var(--accent)'}}> (Live)</span>}</p>
                <button onClick={() => setShowFigures(!showFigures)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0', display: 'flex' }} title="Toggle visibility">
                  {showFigures ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <h2 style={{ fontSize: '1.4rem' }}>{loading ? '...' : showFigures ? formatCurrency(totalNetWorth) : '********'}</h2>
            </div>
          </div>
          <p style={{ color: totalProfit >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {totalProfit >= 0 ? <TrendingUp size={14} /> : <TrendingUp size={14} style={{transform: 'rotate(180deg)'}} />} 
            <span>{showFigures ? `${totalProfit >= 0 ? '+' : ''}${formatCurrency(totalProfit)}` : '********'}</span>
          </p>
        </div>

        <div className="glass-panel col-span-3">
          <div className="flex items-center gap-3 mb-4">
            <div style={{ background: 'rgba(168,83,186,0.1)', padding: '12px', borderRadius: '12px' }}>
              <TrendingUp size={20} color="#a853ba" />
            </div>
            <div>
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>Total Assets</p>
              <h2 style={{ fontSize: '1.4rem' }}>{loading ? '...' : showFigures ? investments.length : '***'}</h2>
            </div>
          </div>
          <p className="text-muted" style={{ fontSize: '0.8rem' }}>
            Active Investments
          </p>
        </div>

        <div className="glass-panel col-span-3">
          <div className="flex items-center gap-3 mb-4">
            <div style={{ background: 'rgba(56,189,248,0.1)', padding: '12px', borderRadius: '12px' }}>
              <Shield size={20} color="#38bdf8" />
            </div>
            <div>
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>Life Cover</p>
              <h2 style={{ fontSize: '1.4rem' }}>{loading ? '...' : showFigures ? formatCurrency(lifeCover) : '********'}</h2>
            </div>
          </div>
          <p className="text-muted" style={{ fontSize: '0.8rem' }}>
            Term Life Protection
          </p>
        </div>

        <div className="glass-panel col-span-3">
          <div className="flex items-center gap-3 mb-4">
            <div style={{ background: 'rgba(16,185,129,0.1)', padding: '12px', borderRadius: '12px' }}>
              <HeartPulse size={20} color="#10b981" />
            </div>
            <div>
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>Health Cover</p>
              <h2 style={{ fontSize: '1.4rem' }}>{loading ? '...' : showFigures ? formatCurrency(healthCover) : '********'}</h2>
            </div>
          </div>
          <p className="text-muted" style={{ fontSize: '0.8rem' }}>
            Medical & Health
          </p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="dashboard-grid">
        <div className="glass-panel col-span-8">
          <h3 className="mb-4">Net Worth Trend</h3>
          <div style={{ height: '300px' }}>
            <Line data={netWorthData} options={chartOptions} />
          </div>
        </div>

        <div className="glass-panel col-span-4">
          <h3 className="mb-4">Asset Allocation</h3>
          <div style={{ height: '300px', display: 'flex', justifyContent: 'center' }}>
            <Doughnut 
              data={allocationData} 
              options={{
                ...chartOptions,
                cutout: '70%',
                scales: undefined
              }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
