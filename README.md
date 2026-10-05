# Portfolio Vault 🛡️

**Portfolio Vault** is a sleek, privacy-first, military-grade wealth tracker and transaction ledger. 
It encrypts your financial data directly in your browser before it ever reaches the cloud, ensuring absolute zero-knowledge privacy.

## ✨ Key Features

### 🔐 Zero-Knowledge Security & Auto-Lock
- **End-to-End AES-GCM Encryption:** All sensitive data (asset names, quantities, prices, transaction logs) is encrypted locally using the Web Crypto API.
- **Zero-Knowledge Architecture:** Your Master PIN is never sent to the cloud. Even if the database is compromised, your financial data is mathematically unreadable.
- **Session Auto-Lock:** The vault actively monitors your interactions. If the app is left completely idle for 1 minute, it instantly purges the decryption key from memory and throws you back to the lock screen.

### 📈 Live Market Sync
- **Live Price Integration:** Automatically fetches live, real-time market prices for Stocks, ETFs, Mutual Funds, and Cryptocurrencies, saving you from manual spreadsheet updates.
- **Multi-Asset Support:** Seamlessly track Equities, Crypto, and Fixed Value Assets (Real Estate, PPF, NPS) all in one unified dashboard.

### 📜 Comprehensive Transaction Ledger
- **Chronological History:** Log every Buy, Sell, and Dividend payout with ease.
- **Smart Filtering & Searching:** Instantly filter your ledger using quick-toggle pills (`Buy`, `Sell`, `Dividend`) and a global live-search text box.
- **Interactive Sorting:** Clickable headers allow you to intuitively sort by Date, Asset, Type, Quantity, Price, and dynamically calculated Total Value.

### 🖨️ Professional PDF Exports
- Generate beautiful, structured PDF reports of your transaction ledger.
- PDFs are dynamically generated based on your active UI filters (e.g., specific date ranges, asset searches) allowing you to easily reconcile against your monthly broker statements.

### 📊 Interactive Dashboards
- **Net Worth Trend Line:** Visualize your historical wealth growth.
- **Asset Allocation Chart:** Beautiful auto-calculated pie charts breaking down your portfolio distribution.

## 🛠️ Technology Stack

**Frontend / UI:**
- **React.js (Vite)**
- **Tailwind CSS** (for rapid structural layouts)
- **Vanilla CSS** (for a sleek, custom dark-mode aesthetic, premium glassmorphism, and dynamic UI micro-animations)
- **Lucide React** (for modern, crisp iconography)
- **Recharts** (for interactive data visualization)

**Backend / Cloud:**
- **Firebase Authentication** (Google sign-in and user management)
- **Firebase Firestore** (NoSQL real-time database)

**Security & Utilities:**
- **Web Crypto API** (Browser-native AES-GCM 256-bit encryption)
- **jsPDF & jspdf-autotable** (Client-side PDF generation engine)
- **date-fns** (Date manipulation and formatting)

## 🚀 Getting Started

1. **Clone the repository:** 
   ```bash
   git clone https://github.com/gunanithin/portfolio-tracker.git
   ```
2. **Install dependencies:** 
   ```bash
   npm install
   ```
3. **Configure Firebase:** 
   Ensure you have a Firebase project set up and add your configuration to `src/firebase.js`.
4. **Run the local dev server:** 
   ```bash
   npm run dev
   ```

---
*Built with React, Firebase, and impenetrable AES-GCM encryption.*
