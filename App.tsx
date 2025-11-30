import React, { useState } from 'react';
import { Search, Shield, ShieldAlert, Activity, AlertOctagon, Terminal, Loader2, Info, CheckCircle2 } from 'lucide-react';
import { fetchTronTransactions, fetchTronWalletProfile, analyzeTronRisk } from './services/tronService';
import { fetchMockTransactions, fetchMockWalletProfile } from './services/mockBlockchain';
import { analyzeTransactionsWithGemini } from './services/geminiService';
import { RiskAnalysis, WalletProfile, RiskLevel } from './types';
import TransactionTable from './components/TransactionTable';
import RiskBadge from './components/RiskBadge';
import RiskChart from './components/RiskChart';

function App() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<WalletProfile | null>(null);
  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);
  const [error, setError] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    
    // Tron Address Validation (Starts with T, length 34)
    if (!address.startsWith('T') || address.length !== 34) {
      setError('Invalid Tron address. Must start with "T" and be 34 characters.');
      return;
    }

    setLoading(true);
    setError('');
    setProfile(null);
    setAnalysis(null);
    setIsDemoMode(false);

    let transactions = [];
    let walletProfile: WalletProfile | null = null;

    try {
      // 1. Try Fetch Real Data from TronGrid
      const [realTxs, realProfile] = await Promise.all([
        fetchTronTransactions(address),
        fetchTronWalletProfile(address)
      ]);

      if (realTxs.length === 0 && !realProfile) {
        throw new Error("No data found");
      }

      transactions = realTxs;
      walletProfile = realProfile;

    } catch (err: any) {
      console.warn("TronGrid API failed or empty, falling back to mock:", err);
      // Fallback to Mock Data
      setIsDemoMode(true);
      transactions = fetchMockTransactions(address);
      walletProfile = fetchMockWalletProfile(address);
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    if (walletProfile) {
      setProfile(walletProfile);

      // 2. Run Hybrid Analysis (Frontend Rules + Gemini AI)
      try {
        // Step A: Run Frontend Heuristics
        const heuristicResult = await analyzeTronRisk(address, transactions);
        const rulesTriggered = heuristicResult.ruleMatches || [];

        // Step B: Run Gemini AI with context
        const aiResult = await analyzeTransactionsWithGemini(transactions, address, rulesTriggered);
        
        // Merge results: Use AI score but override if critical heuristics found
        const finalAnalysis = {
            ...aiResult,
            riskScore: Math.max(aiResult.riskScore, heuristicResult.riskScore || 0),
            // Ensure suspicious wallets from both engines are combined
            suspiciousWalletsFound: Array.from(new Set([
                ...(aiResult.suspiciousWalletsFound || []),
                ...(heuristicResult.suspiciousWalletsFound || [])
            ])),
            ruleMatches: rulesTriggered
        };

        setAnalysis(finalAnalysis);
      } catch (aiErr: any) {
        console.error("Analysis Error:", aiErr);
        setError("Analysis failed. Please check your configuration.");
      }
    } else {
        setError("Failed to retrieve transaction data.");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-gray-100 font-sans selection:bg-primary/30">
      
      {/* Header */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/20 p-2 rounded-lg border border-primary/20">
              <ShieldAlert className="text-primary h-6 w-6" />
            </div>
            <span className="text-xl font-bold tracking-tight">SENTINEL <span className="text-gray-500 font-normal text-sm ml-2 hidden sm:inline-block">TRON USDT TRACKER</span></span>
          </div>
          <div className="flex items-center gap-4">
             <span className="text-xs text-gray-500 font-mono hidden md:block">TRON GRID + GEMINI AI</span>
            <button className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Docs</button>
            <button className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors">Connect Wallet</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        
        {/* Hero / Search */}
        <div className="flex flex-col items-center justify-center space-y-8 mb-16">
          <div className="text-center space-y-4 max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-white to-gray-500">
              Trace Tron USDT Risk
            </h1>
            <p className="text-gray-400 text-lg">
              Detect "Pig Butchering" scams, dusting attacks, and fake contracts on the Tron Network using 
              <span className="text-white font-medium ml-1">heuristic rules</span> & <span className="text-white font-medium">AI analysis</span>.
            </p>
          </div>

          <form onSubmit={handleSearch} className="w-full max-w-2xl relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-500" />
            </div>
            <input
              type="text"
              placeholder="Enter Tron Address (T...)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-lg font-mono placeholder:text-gray-600 transition-all shadow-2xl shadow-black/50"
            />
            <button 
              type="submit"
              disabled={loading}
              className="absolute right-2 top-2 bottom-2 bg-primary hover:bg-indigo-500 text-white px-6 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Trace'}
            </button>
          </form>
          {error && <p className="text-red-400 font-mono text-sm">{error}</p>}
          {isDemoMode && !loading && (
            <div className="flex items-center gap-2 text-yellow-500 bg-yellow-500/10 px-4 py-2 rounded-lg border border-yellow-500/20 text-sm">
              <Info size={16} />
              <span>TronGrid API limited or unavailable. Showing <strong>Mock Scenario</strong>.</span>
            </div>
          )}
        </div>

        {/* Dashboard */}
        {loading && (
           <div className="flex flex-col items-center justify-center py-20 space-y-4">
             <Loader2 className="h-12 w-12 text-primary animate-spin" />
             <p className="text-gray-500 font-mono animate-pulse">Fetching TronGrid data & calculating risk vectors...</p>
           </div>
        )}

        {profile && analysis && !loading && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Risk Score Card */}
              <div className="glass-panel p-6 rounded-xl border-l-4 border-l-primary relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Shield className="h-24 w-24 text-primary" />
                 </div>
                 <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Security Score</h3>
                 <div className="flex items-end gap-4">
                    <span className={`text-5xl font-bold font-mono ${
                      analysis.riskLevel === RiskLevel.CRITICAL ? 'text-red-500' : 
                      analysis.riskLevel === RiskLevel.SAFE ? 'text-emerald-500' : 'text-yellow-500'
                    }`}>
                      {analysis.riskScore}
                    </span>
                    <RiskBadge level={analysis.riskLevel} />
                 </div>
                 <p className="mt-4 text-gray-400 text-sm">{analysis.summary}</p>
              </div>

              {/* Wallet Profile */}
              <div className="glass-panel p-6 rounded-xl">
                <div className="flex items-center gap-3 mb-4">
                  <Terminal className="text-gray-500" size={20} />
                  <h3 className="text-gray-200 font-semibold">Wallet Profile (USDT)</h3>
                </div>
                <div className="space-y-3 font-mono text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">USDT Balance</span>
                    <span className="text-white">{profile.balance} USDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Address Type</span>
                    <span className="text-white">EOA (Standard)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">First Seen</span>
                    <span className="text-white">{new Date(profile.firstSeen).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Risk Distribution Chart */}
              <div className="glass-panel p-6 rounded-xl flex flex-col items-center justify-center">
                 <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2 w-full text-left">Risk Distribution</h3>
                 <RiskChart transactions={analysis.analyzedTransactions} />
              </div>
            </div>

            {/* Heuristic Rule Matches (New Section) */}
            {analysis.ruleMatches && analysis.ruleMatches.length > 0 && (
                <div className="p-4 rounded-xl border border-orange-500/20 bg-orange-500/5">
                    <div className="flex items-center gap-2 mb-3">
                         <AlertOctagon className="text-orange-500" />
                         <h4 className="text-orange-400 font-bold text-sm uppercase">Risk Rules Triggered</h4>
                    </div>
                    <ul className="space-y-2">
                        {analysis.ruleMatches.map((rule, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0"></span>
                                {rule}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Suspicious Entities */}
            {analysis.suspiciousWalletsFound.length > 0 && (
              <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-start gap-4">
                <ShieldAlert className="text-red-500 shrink-0 mt-1" />
                <div>
                  <h4 className="text-red-400 font-bold text-sm uppercase mb-1">Suspicious Counterparties Detected</h4>
                  <p className="text-gray-400 text-sm mb-2">This wallet has interacted with known malicious addresses or mixers:</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.suspiciousWalletsFound.map(w => (
                      <span key={w} className="px-2 py-1 bg-black/40 border border-red-500/30 rounded text-xs font-mono text-red-300">
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Transactions Table */}
            <TransactionTable 
              transactions={analysis.analyzedTransactions} 
              suspiciousWallets={analysis.suspiciousWalletsFound}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;