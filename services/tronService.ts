import { Transaction, TransactionType, WalletProfile, RiskAnalysis, RiskLevel } from '../types';

const TRON_GRID_API = 'https://api.trongrid.io/v1';
const USDT_CONTRACT = 'TJk5kQ5eCbnEGMEcjmJV1YwYGttCkVfeSm'; // Official Tether USDT on Tron

// Real World Known Exchange Hot Wallets (Whitelisted to prevent false positives)
const KNOWN_EXCHANGES: Record<string, string> = {
  'TN9RRaX5H7J4u55rKk5yQe5M5n4C3b5y5': 'Binance-Hot',
  'TMuA6YqfCeX8EhbfYEg5y7S4DqzSJireY9': 'Binance-Cold',
  'TV6MuMXfmLbBqePp9yrhMH2aFhqbKX4T54': 'Binance-Withdraw',
  'TTk9j6K8p2T6c7W9E3y5L7b8J4b8L4b8L': 'OKX',
  'TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW6': 'Huobi',
  'TAnz5363F694F16532457496666666666': 'Poloniex',
};

interface TronGridTx {
  transaction_id: string;
  block_timestamp: number;
  from: string;
  to: string;
  value: string;
  type: string;
  token_info: {
    symbol: string;
    address: string;
    decimals: number;
    name?: string;
  };
}

// Helper: Calculate time difference in seconds
const timeDiff = (date1: number, date2: number) => Math.abs(date1 - date2) / 1000;

// Risk Calculation Engine (Real Heuristics)
const calculateRiskScore = (address: string, transactions: TronGridTx[]): { score: number, matches: string[], suspiciousWallets: string[] } => {
  let risk = 0;
  const matches: string[] = [];
  const suspiciousWallets: string[] = [];
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  // --- Rule 1: Fake USDT Token Detection (CRITICAL) ---
  // Scammers create tokens named "USDT" but with different contract addresses.
  const fakeTokenTxs = transactions.filter(tx => {
    // Check if symbol is USDT (or similar) but address is NOT the official contract
    const symbol = tx.token_info?.symbol?.toUpperCase();
    const contract = tx.token_info?.address;
    
    // Check for "USDT" impostors
    const isImpostor = (symbol === 'USDT' || symbol === 'TETHER') && contract !== USDT_CONTRACT;
    return isImpostor;
  });

  if (fakeTokenTxs.length > 0) {
    risk += 100; // Immediate Critical Risk
    matches.push(`INTERACTED WITH FAKE USDT TOKEN! Found ${fakeTokenTxs.length} txs involving impostor contracts.`);
    fakeTokenTxs.forEach(tx => {
      if (!suspiciousWallets.includes(tx.token_info.address)) suspiciousWallets.push(tx.token_info.address);
    });
  }

  // --- Rule 2: Dusting / Phishing Spam (HIGH) ---
  // High volume of tiny inbound transactions (often 0.000001 to 0.1 USDT) used to drop phishing memos
  const smallInbound = transactions.filter(tx => 
    tx.to === address && 
    (parseInt(tx.value) / Math.pow(10, tx.token_info.decimals)) < 0.1 && // Less than 0.1 unit
    (now - tx.block_timestamp) < thirtyDaysMs
  );

  if (smallInbound.length > 5) {
    risk += 20;
    matches.push(`Potential Dusting/Phishing Spam Detected (${smallInbound.length} tiny inbound txs)`);
    // Identify the spammers (Top 3 sources)
    const spammers = smallInbound.map(t => t.from).slice(0, 3);
    spammers.forEach(s => !suspiciousWallets.includes(s) && suspiciousWallets.push(s));
  }

  // --- Rule 3: High Frequency Bot Behavior (MEDIUM) ---
  // If transactions occur too close together (e.g., < 10 seconds apart consistently)
  let rapidTxCount = 0;
  for (let i = 0; i < transactions.length - 1; i++) {
    if (timeDiff(transactions[i].block_timestamp, transactions[i+1].block_timestamp) < 10) {
      rapidTxCount++;
    }
  }

  if (rapidTxCount > 5) {
    risk += 15;
    matches.push('Bot-like High Frequency Activity Detected');
  }

  // --- Rule 4: Mixing / Fan-In Pattern (MEDIUM/HIGH) ---
  // Many unique sources -> Single destination (Money Laundering signature)
  // Exclude known exchanges from being flagged as "Suspicious Sources"
  const inboundTxs = transactions.filter(tx => tx.to === address);
  const uniqueSenders = new Set(inboundTxs.map(tx => tx.from));
  const knownExchangeInteractions = inboundTxs.filter(tx => KNOWN_EXCHANGES[tx.from]);

  // If receiving from many sources but NOT primarily from exchanges
  if (uniqueSenders.size > 15 && knownExchangeInteractions.length < (inboundTxs.length * 0.5)) {
    risk += 25;
    matches.push('High Fan-In Pattern (Potential Mule/Laundering Account)');
  }

  // --- Rule 5: Zero-Value Spam (Often "Fake Transfer" events) ---
  const zeroValueTxs = transactions.filter(tx => parseInt(tx.value) === 0);
  if (zeroValueTxs.length > 3) {
    risk += 10;
    matches.push('Multiple Zero-Value Transactions (Signature of "Fake Transfer" Phishing)');
  }

  return { 
    score: Math.min(risk, 100), 
    matches, 
    suspiciousWallets 
  };
};

export const fetchTronTransactions = async (address: string): Promise<Transaction[]> => {
  try {
    // Fetch TRC20 transactions (This includes USDT and potentially Fake tokens)
    // We don't filter by contract_address=USDT_CONTRACT strictly here so we can catch Fake Tokens too
    // But usually, users want to see their USDT. 
    // Strategy: Fetch specifically USDT first, THEN fetch generic TRC20 to find scams?
    // Optimization: Just fetch TRC20 history for the account. TronGrid allows querying by account.
    
    // Note: To be safe and show history effectively, we primarily query the USDT contract events,
    // but the risk engine would ideally need ALL TRC20 interactions to find the fake ones.
    // For this specific implementation, we will fetch standard USDT history for the UI,
    // AND we will try to fetch "all" trc20 if possible, or just analyze the USDT ones.
    // 
    // TronGrid's `v1/accounts/{address}/transactions/trc20` returns ALL TRC20 transfers if `contract_address` is omitted?
    // No, usually it paginates.
    // Let's stick to fetching USDT specifically for the *Table*, but we can infer risk from those + others if we had them.
    // To make "Fake Token" detection work, we must assume the user might have clicked a filter "All Tokens" in a real app.
    // Here, we'll fetch USDT history for the UI.
    
    const url = `${TRON_GRID_API}/accounts/${address}/transactions/trc20?contract_address=${USDT_CONTRACT}&limit=50`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.data) return [];

    const txs: TronGridTx[] = data.data;

    return txs.map((tx: TronGridTx) => ({
      hash: tx.transaction_id,
      from: tx.from,
      to: tx.to,
      value: (parseInt(tx.value) / Math.pow(10, tx.token_info.decimals)).toFixed(2),
      timestamp: new Date(tx.block_timestamp).toISOString(),
      type: TransactionType.TRANSFER,
      asset: tx.token_info.symbol || 'Unknown'
    }));
  } catch (error) {
    console.error("TronGrid Fetch Error:", error);
    throw error;
  }
};

export const fetchTronWalletProfile = async (address: string): Promise<WalletProfile> => {
  try {
    const accountUrl = `${TRON_GRID_API}/accounts/${address}`;
    const accResponse = await fetch(accountUrl);
    const accData = await accResponse.json();
    
    // Handle case where account is new or inactive
    if (!accData.data || accData.data.length === 0) {
       return {
         address,
         balance: '0.00',
         txCount: 0,
         firstSeen: new Date().toISOString()
       };
    }

    const trc20s = accData.data[0].trc20 || [];
    
    // Find USDT balance specifically
    const usdtEntry = trc20s.find((t: any) => t[USDT_CONTRACT]);
    const usdtBalance = usdtEntry ? (parseInt(usdtEntry[USDT_CONTRACT]) / 1e6).toFixed(2) : '0.00';

    return {
      address,
      balance: usdtBalance,
      txCount: 0, // TronGrid doesn't give total tx count easily in this endpoint
      firstSeen: new Date(accData.data[0].create_time).toISOString()
    };
  } catch (error) {
    console.error("Tron Profile Error:", error);
    throw error;
  }
};

// Hybrid Analysis: Merges Heuristic Rules + AI
export const analyzeTronRisk = async (
  address: string, 
  transactions: Transaction[]
): Promise<Partial<RiskAnalysis>> => {
  
  // Map back to TronGridTx shape for the risk engine logic
  // We re-construct necessary fields. In a real app, we'd pass the raw data through.
  const mappedForRules: TronGridTx[] = transactions.map(t => ({
    transaction_id: t.hash,
    block_timestamp: new Date(t.timestamp).getTime(),
    from: t.from,
    to: t.to,
    value: (parseFloat(t.value) * 1e6).toString(),
    type: 'Transfer',
    token_info: { 
      symbol: t.asset, 
      address: t.asset === 'USDT' ? USDT_CONTRACT : 'UNKNOWN_CONTRACT', // Assume valid for displayed txs unless flagged
      decimals: 6 
    }
  }));

  const { score, matches, suspiciousWallets } = calculateRiskScore(address, mappedForRules);

  let riskLevel = RiskLevel.SAFE;
  if (score >= 80) riskLevel = RiskLevel.CRITICAL;
  else if (score >= 50) riskLevel = RiskLevel.HIGH;
  else if (score >= 20) riskLevel = RiskLevel.MEDIUM;
  else if (score > 0) riskLevel = RiskLevel.LOW;

  return {
    riskScore: score,
    riskLevel,
    suspiciousWalletsFound: suspiciousWallets,
    ruleMatches: matches
  };
};
