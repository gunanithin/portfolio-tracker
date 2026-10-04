// Uses Google Finance (via CORS proxy HTML scraping) for Stocks, and CoinGecko for Crypto.

const fetchWithTimeout = async (url, timeout = 5000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

const getStockPrice = async (symbol) => {
  try {
    // Tickers never have spaces. 'COAL INDIA' -> 'COALINDIA'
    let cleanSymbol = symbol.replace(/\s+/g, '').toUpperCase();
    
    // Backwards compatibility for legacy Google Finance symbols already in the user's database
    if (cleanSymbol.endsWith(':NSE')) {
      cleanSymbol = cleanSymbol.replace(':NSE', '.NS');
    } else if (cleanSymbol.endsWith(':BOM')) {
      cleanSymbol = cleanSymbol.replace(':BOM', '.BO');
    } else if (cleanSymbol.endsWith(':LON')) {
      cleanSymbol = cleanSymbol.replace(':LON', '.L');
    } else if (!cleanSymbol.includes('.') && !cleanSymbol.includes(':')) {
      // If legacy asset has no exchange (like "COALINDIA"), default it to Indian NSE just like the old scraper did
      cleanSymbol = cleanSymbol + '.NS';
    }
    
    // 5 second timeout so it never hangs
    const response = await fetchWithTimeout(`/api/yahoo-finance/v8/finance/chart/${encodeURIComponent(cleanSymbol)}?interval=1d`, 5000);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    // Yahoo Finance 'chart' endpoint returns the current price in meta.regularMarketPrice
    if (data && data.chart && data.chart.result && data.chart.result.length > 0) {
      const price = data.chart.result[0].meta.regularMarketPrice;
      if (typeof price === 'number') {
        return price;
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`Yahoo Finance quote sync failed for ${symbol}`, error);
    return null;
  }
};

const getCryptoPrice = async (symbol, currency) => {
  try {
    // CoinGecko needs full IDs (bitcoin, ethereum) but you can search via /search API
    // For simplicity, we map common symbols to CoinGecko IDs
    const cryptoMap = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'SOL': 'solana',
      'DOGE': 'dogecoin',
      'USDT': 'tether',
      'BNB': 'binancecoin',
      'XRP': 'ripple'
    };

    const id = cryptoMap[symbol.toUpperCase()];
    if (!id) return null; // If not in our basic map, fallback to null

    const vsCurrency = currency.toLowerCase();
    
    const response = await fetchWithTimeout(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=${vsCurrency}`, 5000);
    if (!response.ok) return null;
    
    const data = await response.json();
    return data[id]?.[vsCurrency] || null;
  } catch (error) {
    console.error(`Error fetching Crypto price for ${symbol}:`, error);
    return null;
  }
};

export const fetchLivePrices = async (investments, currentCurrency) => {
  const livePrices = {}; // { 'AAPL': 150, 'BTC': 45000 }
  
  // We process these in parallel
  const promises = investments.map(async (inv) => {
    let price = null;
    
    if (inv.type === 'Crypto') {
      price = await getCryptoPrice(inv.symbol, currentCurrency);
    } else if (inv.type !== 'Real Estate' && inv.symbol) {
      price = await getStockPrice(inv.symbol);
    }

    if (price) {
      livePrices[inv.symbol] = price;
    }
  });

  await Promise.allSettled(promises);
  return livePrices;
};
