export enum RiskLevel {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  SAFE = 'SAFE'
}

export enum TransactionType {
  TRANSFER = 'Transfer',
  SWAP = 'Swap',
  APPROVAL = 'Approval',
  CONTRACT_INTERACTION = 'Contract Interaction',
  MINT = 'Mint'
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: string;
  type: TransactionType;
  asset: string;
}

export interface RiskAnalysis {
  riskScore: number; // 0-100
  riskLevel: RiskLevel;
  summary: string;
  analyzedTransactions: AnalyzedTransaction[];
  suspiciousWalletsFound: string[];
  ruleMatches?: string[]; // New: List of specific heuristic rules triggered
}

export interface AnalyzedTransaction extends Transaction {
  aiRiskLabel: string;
  aiRiskScore: number;
  aiReasoning: string;
}

export interface WalletProfile {
  address: string;
  balance: string;
  txCount: number;
  firstSeen: string;
}