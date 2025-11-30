import React, { useState } from 'react';
import { AnalyzedTransaction, RiskLevel, TransactionType } from '../types';
import RiskBadge from './RiskBadge';
import { ChevronDown, ChevronUp, AlertTriangle, ArrowRight, ExternalLink, ShieldAlert, Filter, X, Copy, Check } from 'lucide-react';

interface TransactionTableProps {
  transactions: AnalyzedTransaction[];
  suspiciousWallets?: string[];
}

const CopyableAddress = ({ address, label }: { address: string, label?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 group w-max">
      <span className="text-gray-300 font-mono text-xs">{label || address}</span>
      <button 
        onClick={handleCopy}
        className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors focus:outline-none"
        title="Copy full address"
      >
        {copied ? (
          <Check size={12} className="text-green-400" />
        ) : (
          <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </button>
    </div>
  );
};

const TransactionTable: React.FC<TransactionTableProps> = ({ transactions, suspiciousWallets = [] }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [assetFilter, setAssetFilter] = useState<string>('ALL');

  const toggleExpand = (hash: string) => {
    setExpandedId(expandedId === hash ? null : hash);
  };

  const truncate = (str: string) => str.length > 12 ? `${str.substring(0, 6)}...${str.substring(str.length - 4)}` : str;

  const getRiskLevel = (score: number): RiskLevel => {
    if (score >= 90) return RiskLevel.CRITICAL;
    if (score >= 70) return RiskLevel.HIGH;
    if (score >= 40) return RiskLevel.MEDIUM;
    if (score >= 10) return RiskLevel.LOW;
    return RiskLevel.SAFE;
  };

  const isSuspicious = (address: string) => {
    return suspiciousWallets.some(w => w.toLowerCase() === address.toLowerCase());
  };

  // Extract unique assets for the filter dropdown
  const uniqueAssets = Array.from(new Set(transactions.map(tx => tx.asset))).sort();

  // Filter logic
  const filteredTransactions = transactions.filter(tx => {
    const riskLevel = getRiskLevel(tx.aiRiskScore);
    
    const typeMatch = typeFilter === 'ALL' || tx.type === typeFilter;
    const riskMatch = riskFilter === 'ALL' || riskLevel === riskFilter;
    const assetMatch = assetFilter === 'ALL' || tx.asset === assetFilter;

    return typeMatch && riskMatch && assetMatch;
  });

  const clearFilters = () => {
    setTypeFilter('ALL');
    setRiskFilter('ALL');
    setAssetFilter('ALL');
  };

  const hasActiveFilters = typeFilter !== 'ALL' || riskFilter !== 'ALL' || assetFilter !== 'ALL';

  return (
    <div className="w-full overflow-hidden rounded-xl glass-panel">
      <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="font-semibold text-gray-200">Transaction History</h3>
          <span className="text-xs text-gray-500 font-mono">
            Showing {filteredTransactions.length} of {transactions.length} analyzed
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-black/20 p-1 rounded-lg border border-white/5">
            <Filter size={14} className="ml-2 text-gray-500" />
            
            {/* Type Filter */}
            <select 
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent text-xs text-gray-300 font-medium py-1 px-2 outline-none border-none cursor-pointer hover:text-white [&>option]:bg-[#18181b] [&>option]:text-gray-300"
            >
              <option value="ALL">All Types</option>
              {Object.values(TransactionType).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="w-px h-4 bg-white/10"></div>

            {/* Risk Filter */}
            <select 
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="bg-transparent text-xs text-gray-300 font-medium py-1 px-2 outline-none border-none cursor-pointer hover:text-white [&>option]:bg-[#18181b] [&>option]:text-gray-300"
            >
              <option value="ALL">All Risks</option>
              {Object.values(RiskLevel).map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="w-px h-4 bg-white/10"></div>

            {/* Asset Filter */}
            <select 
              value={assetFilter}
              onChange={(e) => setAssetFilter(e.target.value)}
              className="bg-transparent text-xs text-gray-300 font-medium py-1 px-2 outline-none border-none cursor-pointer hover:text-white [&>option]:bg-[#18181b] [&>option]:text-gray-300"
            >
              <option value="ALL">All Assets</option>
              {uniqueAssets.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button 
              onClick={clearFilters}
              className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              title="Clear Filters"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      
      <div className="overflow-x-auto min-h-[300px]">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-white/5 text-xs uppercase font-semibold text-gray-300">
            <tr>
              <th className="px-6 py-3">Risk</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Flow</th>
              <th className="px-6 py-3">Value</th>
              <th className="px-6 py-3">Time</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((tx) => {
                const suspicious = isSuspicious(tx.to);
                return (
                <React.Fragment key={tx.hash}>
                  <tr 
                    onClick={() => toggleExpand(tx.hash)}
                    className={`cursor-pointer transition-colors relative
                      ${expandedId === tx.hash ? 'bg-white/[0.07]' : 'hover:bg-white/5'}
                      ${suspicious ? 'bg-red-500/10' : ''}
                    `}
                  >
                    {suspicious && (
                      <td className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <RiskBadge level={getRiskLevel(tx.aiRiskScore)} size="sm" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-300">
                      {tx.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{truncate(tx.from)}</span>
                        <ArrowRight size={12} className="text-gray-600" />
                        <span className={`${suspicious ? 'text-red-400 font-bold' : 'text-gray-300'}`}>
                          {truncate(tx.to)}
                          {suspicious && <ShieldAlert size={12} className="inline ml-1 mb-0.5 text-red-500" />}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                      {tx.value} <span className="text-xs text-gray-500">{tx.asset}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      {new Date(tx.timestamp).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {expandedId === tx.hash ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </td>
                  </tr>
                  
                  {/* Expanded Details Panel */}
                  {expandedId === tx.hash && (
                    <tr className="bg-black/20">
                      <td colSpan={6} className="px-6 py-4">
                        {suspicious && (
                          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded flex items-center gap-2 text-red-200 text-sm">
                            <ShieldAlert size={16} />
                            <span><strong>Warning:</strong> The recipient address has been flagged as suspicious by the analysis engine.</span>
                          </div>
                        )}
                        <div className="flex flex-col md:flex-row gap-6">
                          <div className="flex-1 space-y-3">
                            <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider">AI Security Analysis</h4>
                            <div className={`p-4 rounded-lg border ${
                              tx.aiRiskScore > 50 ? 'border-red-500/20 bg-red-500/5' : 'border-blue-500/20 bg-blue-500/5'
                            }`}>
                              <div className="flex items-start gap-3">
                                <AlertTriangle size={18} className={tx.aiRiskScore > 50 ? 'text-red-400' : 'text-blue-400'} />
                                <div>
                                  <p className="text-gray-200 font-medium text-sm mb-1">{tx.aiRiskLabel}</p>
                                  <p className="text-gray-400 text-xs leading-relaxed">{tx.aiReasoning}</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex-1 space-y-3">
                            <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider">Technical Details</h4>
                            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                              <div className="space-y-1">
                                <span className="block text-gray-500">Tx Hash</span>
                                <a 
                                  href={`https://tronscan.org/#/transaction/${tx.hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-primary hover:text-primary-400 w-max"
                                >
                                  {truncate(tx.hash)} <ExternalLink size={10} />
                                </a>
                              </div>
                              <div className="space-y-1">
                                <span className="block text-gray-500">Block Timestamp</span>
                                <span className="text-gray-300">{new Date(tx.timestamp).toLocaleString()}</span>
                              </div>
                              
                              <div className="space-y-1">
                                <span className="block text-gray-500">From</span>
                                <CopyableAddress address={tx.from} label={truncate(tx.from)} />
                              </div>
                              <div className="space-y-1">
                                <span className="block text-gray-500">To</span>
                                <CopyableAddress address={tx.to} label={truncate(tx.to)} />
                              </div>

                              <div className="space-y-1">
                                <span className="block text-gray-500">Asset</span>
                                <span className="text-gray-300">Tether USD (TRC20)</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )})
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Filter className="h-8 w-8 text-gray-700" />
                    <p>No transactions match your current filters.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionTable;