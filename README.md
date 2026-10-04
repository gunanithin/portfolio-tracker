# Portfolio Vault 🛡️

Welcome to **Portfolio Vault**, a military-grade, privacy-first wealth tracker. 

Most portfolio trackers store your financial data in plaintext on their servers, meaning anyone with database access can see exactly how much money you have and where it's invested. **Portfolio Vault is different.** It is designed around a strictly confidential "Vault" architecture where *you* hold the only key.

## 🔐 The Vault & Zero-Knowledge Security

I believe your financial data is your absolute private business. 

- **End-to-End AES-GCM Encryption:** When you add an asset to your Vault, all sensitive information (asset names, holdings, quantities, purchase prices) is instantly encrypted *inside your browser* before it ever leaves your device.
- **Your Master PIN:** You secure your Vault with a custom 6-digit Master PIN. This PIN acts as your decryption key.
- **Zero-Knowledge Architecture:** Your Master PIN is **never** sent to the cloud. The database stores only mathematically unbreakable ciphertext. Even if the server was completely compromised, your financial data would remain completely unreadable. 
- **Absolute Privacy:** No one can see your net worth, no one can see what stocks you own, and your data remains strictly yours. 

## ✨ Key Features
### 📈 Live Market Sync
Stop manually updating your spreadsheet. Portfolio Vault integrates directly with the live Yahoo Finance API to automatically sync the latest prices for your Stocks, ETFs, Mutual Funds, and Cryptocurrencies. 

### 🏛️ Complete Asset Support
Your net worth is more than just stocks. Portfolio Vault natively supports:
- **Equities:** Indian & Global Stocks, ETFs, and Mutual Funds
- **Crypto:** All major cryptocurrencies
- **Fixed Value Assets:** Real Estate, Public Provident Fund (PPF), and National Pension System (NPS)

### 📊 Intelligent Dashboards
Gain immediate insights into your wealth with our interactive dashboards:
- **Net Worth Trend:** Track your historical wealth growth.
- **Asset Allocation:** Visualize your exact portfolio distribution with interactive, auto-calculated percentage breakdowns.
- **Dynamic Grouping:** Organize your vault effortlessly with our intelligent accordion layout, grouped precisely by asset type.

## 🚀 How to Use

1. **Sign In:** Create a secure account to begin.
2. **Set Your Master PIN:** Choose a strong, memorized 6-digit PIN. **Do not lose this PIN.** Because of our Zero-Knowledge architecture, losing your PIN means permanently losing access to your decrypted vault data.
3. **Add Assets:** Click **Add Asset** from the dashboard. For live assets (Stocks, Crypto, Mutual Funds), just search the ticker and the system will auto-populate the data. For fixed assets (PPF, NPS, Real Estate), simply enter your current balance.
4. **Track & Grow:** Sit back and let Portfolio Vault track your live market fluctuations and visualize your true net worth in real-time.

---
*Built with React, Firebase, and impenetrable AES-GCM encryption.*
# portfolio-tracker
