import React from 'react';
import { RiskLevel } from '../types';

interface RiskBadgeProps {
  level: RiskLevel | string;
  score?: number;
  size?: 'sm' | 'md' | 'lg';
}

const RiskBadge: React.FC<RiskBadgeProps> = ({ level, score, size = 'md' }) => {
  let colorClass = 'bg-gray-500/20 text-gray-400 border-gray-500/50';
  
  // Normalize string input to RiskLevel
  const normalizedLevel = typeof level === 'string' ? level.toUpperCase() : level;

  switch (normalizedLevel) {
    case RiskLevel.CRITICAL:
      colorClass = 'bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]';
      break;
    case RiskLevel.HIGH:
      colorClass = 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      break;
    case RiskLevel.MEDIUM:
      colorClass = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      break;
    case RiskLevel.LOW:
      colorClass = 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      break;
    case RiskLevel.SAFE:
      colorClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      break;
  }

  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : size === 'lg' ? 'px-4 py-1.5 text-lg' : 'px-2.5 py-1 text-sm';

  return (
    <div className={`inline-flex items-center gap-2 border rounded-full font-mono font-medium ${colorClass} ${sizeClass}`}>
      <span className="relative flex h-2 w-2">
        {(normalizedLevel === RiskLevel.CRITICAL || normalizedLevel === RiskLevel.HIGH) && (
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current"></span>
        )}
        <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
      </span>
      {normalizedLevel}
      {score !== undefined && <span className="opacity-75 text-[0.9em]">| {score}/100</span>}
    </div>
  );
};

export default RiskBadge;