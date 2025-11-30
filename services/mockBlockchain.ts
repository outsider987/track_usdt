import { Transaction, TransactionType, WalletProfile } from '../types';

// Helper to generate a random Tron address (Starts with T, length 34)
const randomTronAddr = () => {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let res = 'T';
  for (let i = 0; i < 33; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
  return res;
};

const randomHash = () => Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');

export const fetchMockTransactions = (walletAddress: string): Transaction[] => {
  const txs: Transaction[] = [];
  const now = Date.now();
  
  // Known Pattern Addresses for Demo
  const SCAM_ADDRESS = "TX9Q...PigButcheringScam";
  const MIXER_ADDRESS = "TJ...TornadoProxy";
  const FAKE_CONTRACT = "T...FakeWithdrawal";

  // Generate 20 realistic USDT transactions
  for (let i = 0; i < 20; i++) {
    let isOutbound = Math.random() > 0.45;
    let type = TransactionType.TRANSFER;
    let asset = 'USDT';
    let to = isOutbound ? randomTronAddr() : walletAddress;
    let from = isOutbound ? walletAddress : randomTronAddr();
    let value = (Math.random() * 500).toFixed(2);

    // Inject Specific Scenarios for Heuristic Detection

    // 1. Dusting Attack Pattern (Multiple small inbound from randoms)
    if (i < 5) {
      isOutbound = false;
      to = walletAddress;
      from = randomTronAddr();
      value = "0.5"; // Small amount
    }

    // 2. Scam Interaction
    if (i === 8) {
      isOutbound = true;
      from = walletAddress;
      to = SCAM_ADDRESS;
      value = "5000.00"; // Large loss
    }

    // 3. Approval Scam (Fake USDT approval)
    if (i === 12) {
      type = TransactionType.APPROVAL;
      to = randomTronAddr(); // Unknown contract
      value = "0"; // Unlimited
    }

    // 4. Fake Withdrawal Contract (Fee Payment)
    if (i === 16) {
      isOutbound = true;
      type = TransactionType.CONTRACT_INTERACTION;
      from = walletAddress;
      to = FAKE_CONTRACT;
      value = "50.00"; // Verification Fee
    }

    txs.push({
      hash: randomHash(),
      from,
      to,
      value,
      timestamp: new Date(now - (i * 1000 * 60 * 60 * 2)).toISOString(),
      type,
      asset
    });
  }
  return txs;
};

export const fetchMockWalletProfile = (address: string) => {
  return {
    address,
    balance: "14250.50", // USDT Balance
    txCount: 89,
    firstSeen: '2023-01-15T08:32:00Z'
  };
};