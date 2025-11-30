import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { AnalyzedTransaction, RiskLevel } from '../types';

interface RiskChartProps {
  transactions: AnalyzedTransaction[];
}

const RiskChart: React.FC<RiskChartProps> = ({ transactions }) => {
  const data = [
    { name: 'Critical', value: 0, color: '#ef4444' },
    { name: 'High', value: 0, color: '#f97316' },
    { name: 'Medium', value: 0, color: '#eab308' },
    { name: 'Safe', value: 0, color: '#10b981' },
  ];

  transactions.forEach(tx => {
    if (tx.aiRiskScore >= 90) data[0].value++;
    else if (tx.aiRiskScore >= 70) data[1].value++;
    else if (tx.aiRiskScore >= 40) data[2].value++;
    else data[3].value++;
  });

  // Filter out zero values for cleaner chart
  const activeData = data.filter(d => d.value > 0);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={activeData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {activeData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: '#18181b', borderColor: '#333', borderRadius: '8px', color: '#fff' }}
            itemStyle={{ color: '#fff' }}
          />
          <Legend verticalAlign="bottom" height={36}/>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RiskChart;