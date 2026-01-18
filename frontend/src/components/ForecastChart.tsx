'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency, formatDate } from '@/lib/utils';

interface BalanceSnapshot {
  date: Date | string;
  balance: number;
}

interface ForecastTransaction {
  id: string;
  amount: number;
  date: Date | string;
  name: string;
  category: string | null;
  isManual: boolean;
}

interface ForecastChartProps {
  balanceSnapshots: BalanceSnapshot[];
  transactions?: ForecastTransaction[];
}

// Helper function to normalize dates to YYYY-MM-DD format
const normalizeDate = (date: any): string => {
  if (!date) return '';
  
  try {
    if (typeof date === 'string') {
      // Handle ISO string (e.g., "2026-02-01T00:00:00.000Z" or "2026-02-01")
      const datePart = date.split('T')[0];
      // Validate it's in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        return datePart;
      }
      // Try parsing as date string
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    // Try to convert to Date and then to string
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch (e) {
    console.error('Error normalizing date:', date, e);
  }
  
  return '';
};

// Custom tooltip component
const CustomTooltip = ({ active, payload, label, transactions }: any) => {
  if (active && payload && payload.length) {
    // Get the actual date from the payload data, not the label
    const payloadData = payload[0].payload;
    const dateStr = normalizeDate(payloadData?.date || label);
    
    // Ensure transactions is an array
    const transactionsArray = Array.isArray(transactions) ? transactions : [];
    
    // Filter transactions for this date
    const dateTransactions = transactionsArray.filter((t: ForecastTransaction) => {
      const tDate = normalizeDate(t.date);
      return tDate === dateStr;
    });

    return (
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 shadow-lg max-w-md">
        <p className="text-white font-semibold mb-2">{formatDate(payloadData?.date || label)}</p>
        <p className="text-blue-400 font-medium mb-3">
          Balance: {formatCurrency(payload[0].value)}
        </p>
        {dateTransactions.length > 0 ? (
          <div className="mt-3 pt-3 border-t border-gray-600">
            <p className="text-gray-300 text-sm font-medium mb-2">Transactions ({dateTransactions.length}):</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {dateTransactions.map((transaction: ForecastTransaction) => (
                <div key={transaction.id} className="text-xs text-gray-400 flex justify-between items-center gap-2">
                  <span className="flex-1 truncate">{transaction.name}</span>
                  <span className={`font-medium ${transaction.amount < 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {formatCurrency(transaction.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-3 pt-3 border-t border-gray-600">
            <p className="text-gray-500 text-xs">No transactions on this date</p>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function ForecastChart({ balanceSnapshots, transactions = [] }: ForecastChartProps) {
  const data = balanceSnapshots.map(snapshot => ({
    date: typeof snapshot.date === 'string' ? snapshot.date : snapshot.date.toISOString().split('T')[0],
    balance: snapshot.balance,
  }));

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Balance Projection</h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart 
          data={data}
          margin={{ top: 5, right: 20, left: 20, bottom: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="date" 
            stroke="#9CA3AF"
            tickFormatter={(value) => formatDate(value)}
            angle={-45}
            textAnchor="end"
            height={60}
            interval="preserveStartEnd"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
          />
          <YAxis 
            stroke="#9CA3AF"
            tickFormatter={(value) => formatCurrency(value)}
            width={100}
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
          />
          <Tooltip
            content={<CustomTooltip transactions={transactions} />}
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
