'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency, formatDate } from '@/lib/utils';

interface BalanceSnapshot {
  date: Date | string;
  balance: number;
}

interface ForecastChartProps {
  balanceSnapshots: BalanceSnapshot[];
}

export default function ForecastChart({ balanceSnapshots }: ForecastChartProps) {
  const data = balanceSnapshots.map(snapshot => ({
    date: typeof snapshot.date === 'string' ? snapshot.date : snapshot.date.toISOString().split('T')[0],
    balance: snapshot.balance,
  }));

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Balance Projection</h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="date" 
            stroke="#9CA3AF"
            tickFormatter={(value) => formatDate(value)}
          />
          <YAxis 
            stroke="#9CA3AF"
            tickFormatter={(value) => formatCurrency(value)}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
            formatter={(value: number) => formatCurrency(value)}
            labelFormatter={(label) => formatDate(label)}
          />
          <Line 
            type="monotone" 
            dataKey="balance" 
            stroke="#3B82F6" 
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
