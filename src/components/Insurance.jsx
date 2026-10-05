import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVault } from '../context/VaultContext';
import { useSettings } from '../context/SettingsContext';
import { db, storage } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { encryptData, decryptData, encryptFileBase64, decryptFileBase64 } from '../utils/encryption';
import { Shield, Plus, ShieldCheck, HeartPulse, Car, Home, Trash2, Edit2, FileText, Download, Eye, EyeOff } from 'lucide-react';

const Insurance = () => {
  const { currentUser } = useAuth();
  const { vaultPin } = useVault();
  const { formatCurrency } = useSettings();
  
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFigures, setShowFigures] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState(null);

  // Form State
  const [type, setType] = useState('Term Life');
  const [provider, setProvider] = useState('');
  const [policyName, setPolicyName] = useState('');
  const [insuredPerson, setInsuredPerson] = useState('');
  const [coverAmount, setCoverAmount] = useState('');
  const [premiumAmount, setPremiumAmount] = useState('');
  const [renewalDate, setRenewalDate] = useState('');
  const [pdfBase64, setPdfBase64] = useState(null);
  const [pdfName, setPdfName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    if (!currentUser || !vaultPin) return;

    const q = query(collection(db, 'insurance'), where('userId', '==', currentUser.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedData = [];
      snapshot.forEach((docSnap) => {
        try {
          const encryptedData = docSnap.data().data;
          const decryptedStr = decryptData(encryptedData, vaultPin);
          const policyData = JSON.parse(decryptedStr);
          loadedData.push({ id: docSnap.id, ...policyData });
        } catch (error) {
          console.error("Failed to decrypt policy:", error);
        }
      });
      setPolicies(loadedData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, vaultPin]);

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    if (!vaultPin || !policyName || !coverAmount) return;
    
    setIsSubmitting(true);

    const policyData = {
      type,
      provider,
      policyName,
      insuredPerson,
      coverAmount: parseFloat(coverAmount),
      premiumAmount: parseFloat(premiumAmount) || 0,
      renewalDate
    };

    try {
      if (pdfBase64) {
        const encryptedFile = encryptFileBase64(pdfBase64, vaultPin);
        const fileRef = ref(storage, `insurance_docs/${currentUser.uid}/${Date.now()}_encrypted.dat`);
        await uploadString(fileRef, encryptedFile, 'raw');
        policyData.documentPath = fileRef.fullPath;
        policyData.documentName = pdfName;
      } else if (editingPolicyId) {
        const existingPolicy = policies.find(p => p.id === editingPolicyId);
        if (existingPolicy && existingPolicy.documentPath) {
          policyData.documentPath = existingPolicy.documentPath;
          policyData.documentName = existingPolicy.documentName;
        }
      }

      const encryptedData = encryptData(JSON.stringify(policyData), vaultPin);
      
      if (editingPolicyId) {
        const docRef = doc(db, 'insurance', editingPolicyId);
        await updateDoc(docRef, {
          data: encryptedData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'insurance'), {
          userId: currentUser.uid,
          data: encryptedData,
          createdAt: serverTimestamp()
        });
      }
      
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error("Error saving policy:", error);
      alert("Failed to save policy securely.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large! Please select a PDF under 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setPdfBase64(reader.result);
      setPdfName(file.name);
    };
  };

  const handleDownload = async (policy) => {
    if (!policy.documentPath) return;
    
    setDownloadingId(policy.id);
    try {
      const fileRef = ref(storage, policy.documentPath);
      const url = await getDownloadURL(fileRef);
      const response = await fetch(url);
      const encryptedText = await response.text();
      
      const decryptedBase64 = decryptFileBase64(encryptedText, vaultPin);
      
      const a = document.createElement('a');
      a.href = decryptedBase64;
      a.download = policy.documentName || 'insurance_policy.pdf';
      a.click();
    } catch (err) {
      console.error("Failed to decrypt and download file", err);
      alert("Failed to decrypt document. It may be corrupted or require the original Vault PIN.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this policy from your Vault?')) {
      await deleteDoc(doc(db, 'insurance', id));
    }
  };

  const openEditModal = (policy) => {
    setEditingPolicyId(policy.id);
    setType(policy.type);
    setProvider(policy.provider || '');
    setPolicyName(policy.policyName);
    setInsuredPerson(policy.insuredPerson || '');
    setCoverAmount(policy.coverAmount.toString());
    setPremiumAmount(policy.premiumAmount ? policy.premiumAmount.toString() : '');
    setRenewalDate(policy.renewalDate || '');
    setPdfName(policy.documentName || '');
    setShowModal(true);
  };

  const resetForm = () => {
    setType('Term Life');
    setProvider('');
    setPolicyName('');
    setInsuredPerson('');
    setCoverAmount('');
    setPremiumAmount('');
    setRenewalDate('');
    setPdfBase64(null);
    setPdfName('');
    setEditingPolicyId(null);
    setIsSubmitting(false);
  };

  const getIconForType = (type) => {
    switch(type) {
      case 'Term Life': return <ShieldCheck size={20} color="#38bdf8" />;
      case 'Health': return <HeartPulse size={20} color="#10b981" />;
      case 'Vehicle': return <Car size={20} color="#f59e0b" />;
      case 'Home': return <Home size={20} color="#8b5cf6" />;
      default: return <Shield size={20} color="#94a3b8" />;
    }
  };

  const totalCover = policies.reduce((sum, p) => sum + p.coverAmount, 0);
  const totalPremium = policies.reduce((sum, p) => sum + p.premiumAmount, 0);

  if (loading) {
    return (
      <div style={{ height: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div className="loading-spinner" style={{ width: '40px', height: '40px', marginBottom: '24px' }}></div>
        <h2 className="heading-gradient" style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Loading Insurance...</h2>
        <p className="text-muted" style={{ fontSize: '0.9rem', opacity: 0.7 }}>Fetching your active policies</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="heading-gradient" style={{ fontSize: '2rem' }}>Insurance Vault</h1>
          <p className="text-muted mt-2">Securely track your life, health, and general insurance covers.</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus size={18} />
          Add Policy
        </button>
      </div>

      <div className="dashboard-grid mb-8">
        <div className="glass-panel col-span-6">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-muted m-0">Total Cover</p>
            <button onClick={() => setShowFigures(!showFigures)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0', display: 'flex' }} title="Toggle visibility">
              {showFigures ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <h2 style={{ fontSize: '1.8rem' }}>{showFigures ? formatCurrency(totalCover) : '********'}</h2>
        </div>
        <div className="glass-panel col-span-6">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-muted m-0">Total Annual Premium</p>
            <button onClick={() => setShowFigures(!showFigures)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0', display: 'flex' }} title="Toggle visibility">
              {showFigures ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <h2 style={{ fontSize: '1.8rem' }}>{showFigures ? formatCurrency(totalPremium) : '********'}</h2>
        </div>
      </div>

      {policies.length === 0 ? (
        <div className="glass-panel text-center p-8">
          <Shield size={48} color="rgba(255,255,255,0.2)" style={{ margin: '0 auto 16px' }} />
          <p className="text-muted mb-4">No insurance policies found in your vault.</p>
          <button className="btn-primary" onClick={() => setShowModal(true)}>Add Your First Policy</button>
        </div>
      ) : (
        <div className="dashboard-grid">
          {policies.map(policy => (
            <div key={policy.id} className="glass-panel col-span-6" style={{ position: 'relative' }}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '10px' }}>
                    {getIconForType(policy.type)}
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 600, fontSize: '1.1rem' }}>{policy.policyName}</h3>
                    <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                      {policy.provider} • {policy.type}{policy.insuredPerson ? ` • ${policy.insuredPerson}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {policy.documentPath && (
                    <button 
                      onClick={() => handleDownload(policy)} 
                      style={{ background: 'rgba(56,189,248,0.1)', border: 'none', cursor: 'pointer', color: '#38bdf8', padding: '6px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', marginRight: '8px' }}
                      disabled={downloadingId === policy.id}
                    >
                      {downloadingId === policy.id ? 'Decrypting...' : <><Download size={14} /> Doc</>}
                    </button>
                  )}
                  <button onClick={() => openEditModal(policy)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(policy.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Cover Amount</p>
                  <p style={{ fontWeight: 600 }}>{showFigures ? formatCurrency(policy.coverAmount) : '********'}</p>
                </div>
                <div>
                  <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Annual Premium</p>
                  <p style={{ fontWeight: 600 }}>{showFigures ? formatCurrency(policy.premiumAmount) : '********'}</p>
                </div>
                {policy.renewalDate && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>Renewal Date</p>
                    <p style={{ fontSize: '0.9rem' }}>{new Date(policy.renewalDate).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 className="heading-gradient" style={{ fontSize: '1.5rem', marginBottom: '24px' }}>
              {editingPolicyId ? 'Edit Policy' : 'Add New Policy'}
            </h2>
            
            <form onSubmit={handleSavePolicy} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div>
                <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Policy Type</label>
                <select 
                  value={type}
                  onChange={e => setType(e.target.value)}
                  style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', appearance: 'none' }}
                >
                  <option value="Term Life">Term Life</option>
                  <option value="Health">Health</option>
                  <option value="Vehicle">Vehicle</option>
                  <option value="Home">Home</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Provider</label>
                <input 
                  type="text" 
                  value={provider}
                  onChange={e => setProvider(e.target.value)}
                  placeholder="e.g. HDFC Life, Star Health"
                  style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>

              <div>
                <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Policy Name</label>
                <input 
                  type="text" 
                  value={policyName}
                  onChange={e => setPolicyName(e.target.value)}
                  required
                  placeholder="e.g. Click 2 Protect 3D Plus"
                  style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>

              <div>
                <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Insured Person(s)</label>
                <input 
                  type="text" 
                  value={insuredPerson}
                  onChange={e => setInsuredPerson(e.target.value)}
                  placeholder="e.g. Self, Parents, Family"
                  style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>

              <div>
                <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Cover Amount</label>
                <input 
                  type="number" 
                  value={coverAmount}
                  onChange={e => setCoverAmount(e.target.value)}
                  required
                  min="0"
                  step="0.01"
                  placeholder="e.g. 10000000"
                  style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>

              <div>
                <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Annual Premium</label>
                <input 
                  type="number" 
                  value={premiumAmount}
                  onChange={e => setPremiumAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="e.g. 15000"
                  style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>

              <div>
                <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Next Renewal Date</label>
                <input 
                  type="date" 
                  value={renewalDate}
                  onChange={e => setRenewalDate(e.target.value)}
                  style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', colorScheme: 'dark' }}
                />
              </div>

              <div>
                <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Policy Document (Secure Upload)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    <FileText size={16} />
                    {pdfName ? 'Change File' : 'Select PDF'}
                    <input type="file" accept="application/pdf,image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                  </label>
                  {pdfName && <span style={{ fontSize: '0.85rem', color: 'var(--success)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{pdfName}</span>}
                </div>
                <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '8px' }}>File will be AES-GCM encrypted in your browser before upload. (Max 5MB)</p>
              </div>

              <div className="flex gap-4 mt-4">
                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ flex: 1 }}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ flex: 1 }}
                  disabled={isSubmitting}
                >
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

export default Insurance;
