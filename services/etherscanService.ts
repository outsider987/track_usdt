import { Transaction, TransactionType, WalletProfile } from '../types';

const API_KEY = process.env.ETHERSCAN_API_KEY || 'YourApiKeyToken';
const BASE_URL = 'https://api.etherscan.io/v2/api';

interface EtherscanTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  transactionIndex: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress: string;
  cumulativGasUsed: string;
  gasUsed: string;
  confirmations: string;
  methodId: string;
  functionName: string;
}

const determineTransactionType = (tx: EtherscanTx): TransactionType => {
  const input = tx.input?.toLowerCase() || '';
  const funcName = tx.functionName?.toLowerCase() || '';

  // Etherscan often identifies the function name
  if (funcName.includes('approve')) return TransactionType.APPROVAL;
  if (funcName.includes('swap') || funcName.includes('exact')) return TransactionType.SWAP;
  if (funcName.includes('mint')) return TransactionType.MINT;
  if (funcName.includes('transfer')) return TransactionType.TRANSFER;

  // Fallback to Method ID checks
  if (tx.methodId === '0x095ea7b3') return TransactionType.APPROVAL;
  if (tx.methodId === '0xa9059cbb') return TransactionType.TRANSFER;

  // If value is 0 and there is input data, it's likely a contract interaction
  if (tx.value === '0' && input.length > 2) return TransactionType.CONTRACT_INTERACTION;

  // Default to transfer for standard ETH sends (value > 0, empty or simple input)
  return TransactionType.TRANSFER;
};

const determineAsset = (tx: EtherscanTx): string => {
  if (tx.value !== '0') return 'ETH';
  if (tx.functionName?.toLowerCase().includes('usdt')) return 'USDT';
  if (tx.functionName?.toLowerCase().includes('usdc')) return 'USDC';
  return 'ETH (or Token)';
};

export const fetchRealTransactions = async (address: string): Promise<Transaction[]> => {
  try {
    const url = `${BASE_URL}?chainid=1&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${API_KEY}&page=1&offset=50`;
    
    const response = await fetch(url);
    const data = await response.json();

    // Check for API errors
    if (data.status !== '1') {
      // Status 0 with "No transactions found" is a valid state for a new wallet
      if (data.message === 'No transactions found') return [];
      
      // Status 0 with other messages (like "Invalid API Key") is an error
      throw new Error(data.result || data.message || 'Etherscan API Error');
    }

    const rawTxs: EtherscanTx[] = data.result || [];

    if (!Array.isArray(rawTxs)) {
      throw new Error('Invalid data format received from Etherscan');
    }

    return rawTxs.map(tx => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to || tx.contractAddress || 'Contract Creation',
      value: (parseFloat(tx.value) / 1e18).toFixed(4),
      timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
      type: determineTransactionType(tx),
      asset: determineAsset(tx)
    }));
  } catch (error) {
    console.error("Etherscan Fetch Error:", error);
    throw error;
  }
};

export const fetchRealWalletProfile = async (address: string): Promise<WalletProfile> => {
  try {
    const balanceUrl = `${BASE_URL}?chainid=1&module=account&action=balance&address=${address}&tag=latest&apikey=${API_KEY}`;
    const balanceRes = await fetch(balanceUrl);
    const balanceData = await balanceRes.json();
    
    // Default values
    let balanceEth = '0.0000';
    let txCount = 0;
    let firstSeen = new Date().toISOString();

    if (balanceData.status === '1') {
      balanceEth = (parseFloat(balanceData.result) / 1e18).toFixed(4);
    } else if (balanceData.message?.includes('API Key')) {
        throw new Error(balanceData.result || 'Invalid API Key');
    }

    // Try to get first transaction for 'firstSeen'
    const firstTxUrl = `${BASE_URL}?chainid=1&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&page=1&offset=1&apikey=${API_KEY}`;
    const firstTxRes = await fetch(firstTxUrl);
    const firstTxData = await firstTxRes.json();

    if (firstTxData.status === '1' && Array.isArray(firstTxData.result) && firstTxData.result.length > 0) {
      firstSeen = new Date(parseInt(firstTxData.result[0].timeStamp) * 1000).toISOString();
    }

    // Try to get tx count
    const countUrl = `${BASE_URL}?chainid=1&module=proxy&action=eth_getTransactionCount&address=${address}&tag=latest&apikey=${API_KEY}`;
    const countRes = await fetch(countUrl);
    const countData = await countRes.json();
    
    if (countData.result && typeof countData.result === 'string') {
      txCount = parseInt(countData.result, 16);
    }

    return {
      address,
      balance: balanceEth,
      txCount,
      firstSeen
    };

  } catch (error) {
    console.error("Profile Fetch Error:", error);
    throw error; 
  }
};