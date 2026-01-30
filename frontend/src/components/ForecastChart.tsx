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
  startDate?: Date | string;
  endDate?: Date | string;
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
    // Get the actual date from the payload data
    const payloadData = payload[0].payload;
    
    // Handle timestamp (number) or date string
    let dateValue: Date | string;
    if (payloadData?.dateTimestamp) {
      // Convert timestamp to Date
      dateValue = new Date(payloadData.dateTimestamp);
    } else if (payloadData?.date) {
      dateValue = payloadData.date;
    } else if (typeof label === 'number') {
      // Label is a timestamp
      dateValue = new Date(label);
    } else {
      dateValue = label;
    }
    
    // Normalize to date string for comparison
    const dateStr = normalizeDate(dateValue);
    
    // Ensure transactions is an array
    const transactionsArray = Array.isArray(transactions) ? transactions : [];
    
    // Filter transactions for this date
    const dateTransactions = transactionsArray.filter((t: ForecastTransaction) => {
      const tDate = normalizeDate(t.date);
      return tDate === dateStr;
    });

    const balance = payload[0].value as number;
    const isNegative = balance < 0;

    return (
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 shadow-lg max-w-md">
        <p className="text-white font-semibold mb-2">{formatDate(dateValue)}</p>
        <p className={`font-medium mb-3 ${isNegative ? 'text-red-400' : 'text-blue-400'}`}>
          Balance: {formatCurrency(balance)}
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

export default function ForecastChart({ balanceSnapshots, transactions = [], startDate, endDate }: ForecastChartProps) {
  // Normalize dates for comparison
  const normalizeDateForComparison = (date: any): Date => {
    if (!date) return new Date();
    if (typeof date === 'string') {
      return new Date(date);
    }
    return date instanceof Date ? date : new Date(date);
  };

  // Filter balance snapshots to only include data within the forecast horizon
  // Use strict filtering to ensure no data extends beyond the forecast horizon
  let filteredSnapshots = balanceSnapshots;
  if (startDate || endDate) {
    // Normalize dates to YYYY-MM-DD strings for comparison (timezone-safe)
    const normalizeToDateString = (date: any): string => {
      if (!date) return '';
      const d = normalizeDateForComparison(date);
      return d.toISOString().split('T')[0];
    };
    
    const startStr = startDate ? normalizeToDateString(startDate) : null;
    const endStr = endDate ? normalizeToDateString(endDate) : null;
    
    filteredSnapshots = balanceSnapshots.filter(snapshot => {
      const snapshotDateStr = normalizeToDateString(snapshot.date);
      
      // Strict comparison - exclude anything outside the range
      if (startStr && snapshotDateStr < startStr) return false;
      if (endStr && snapshotDateStr > endStr) return false;
      return true;
    });
    
    // Double-check: ensure we don't have any snapshots beyond the end date
    if (endStr) {
      filteredSnapshots = filteredSnapshots.filter(snapshot => {
        const snapshotDateStr = normalizeToDateString(snapshot.date);
        return snapshotDateStr <= endStr;
      });
    }
  }

  // Convert to data format with both date string and timestamp
  let data = filteredSnapshots.map(snapshot => {
    const dateStr = typeof snapshot.date === 'string' ? snapshot.date : snapshot.date.toISOString().split('T')[0];
    return {
      date: dateStr,
      dateTimestamp: new Date(dateStr).getTime(),
      balance: snapshot.balance,
    };
  });

  // Sort data by date to ensure proper ordering
  data.sort((a, b) => a.dateTimestamp - b.dateTimestamp);

  // Deduplicate by timestamp to avoid duplicate keys in Recharts
  const seenTimestamps = new Set<number>();
  data = data.filter(d => {
    if (seenTimestamps.has(d.dateTimestamp)) {
      return false;
    }
    seenTimestamps.add(d.dateTimestamp);
    return true;
  });

  // Ensure we have data points at the exact start and end dates to constrain the chart
  if (startDate && endDate && data.length > 0) {
    const startStr = normalizeDate(startDate);
    const endStr = normalizeDate(endDate);
    const startTimestamp = new Date(startStr).getTime();
    const endTimestamp = new Date(endStr).getTime();
    const firstDataDate = data[0]?.date;
    const lastDataDate = data[data.length - 1]?.date;
    
    // Add start point if missing (use first balance)
    // Check both date string and timestamp to avoid duplicates
    if (startStr && firstDataDate !== startStr && !seenTimestamps.has(startTimestamp)) {
      const firstBalance = data[0]?.balance ?? 0;
      data = [{ date: startStr, dateTimestamp: startTimestamp, balance: firstBalance }, ...data];
      seenTimestamps.add(startTimestamp);
    }
    
    // Add end point if missing (use last balance)
    // Check both date string and timestamp to avoid duplicates
    if (endStr && lastDataDate !== endStr && !seenTimestamps.has(endTimestamp)) {
      const lastBalance = data[data.length - 1]?.balance ?? 0;
      data = [...data, { date: endStr, dateTimestamp: endTimestamp, balance: lastBalance }];
      seenTimestamps.add(endTimestamp);
    }
  }

  // Ensure data ends exactly at the end date (no extension beyond)
  if (endDate && data.length > 0) {
    const endStr = normalizeDate(endDate);
    const endTimestamp = new Date(endStr).getTime();
    
    // Remove any data points beyond the end date
    data = data.filter(d => d.dateTimestamp <= endTimestamp);
    
    // Re-deduplicate after filtering to ensure no duplicates
    const filteredTimestamps = new Set<number>();
    data = data.filter(d => {
      if (filteredTimestamps.has(d.dateTimestamp)) {
        return false;
      }
      filteredTimestamps.add(d.dateTimestamp);
      return true;
    });
    
    // Ensure we have a point exactly at the end date
    // Check timestamp to avoid duplicates
    const hasEndPoint = filteredTimestamps.has(endTimestamp);
    if (!hasEndPoint && data.length > 0) {
      const lastBalance = data[data.length - 1]?.balance ?? 0;
      data = [...data, { 
        date: endStr, 
        dateTimestamp: endTimestamp,
        balance: lastBalance 
      }];
    }
  }

  // Calculate domain from timestamps for precise control
  const getXAxisDomain = () => {
    if (!data.length) return undefined;
    if (startDate && endDate) {
      const startStr = normalizeDate(startDate);
      const endStr = normalizeDate(endDate);
      const startTs = new Date(startStr).getTime();
      const endTs = new Date(endStr).getTime();
      return [startTs, endTs];
    }
    const timestamps = data.map(d => d.dateTimestamp).sort((a, b) => a - b);
    return [timestamps[0], timestamps[timestamps.length - 1]];
  };

  const xAxisDomain = getXAxisDomain();


  // Create segments for positive/zero and negative balances
  // Include zero-crossing points to maintain line continuity
  const positiveData: any[] = [];
  const negativeData: any[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    const prevPoint = i > 0 ? data[i - 1] : null;
    
    if (point.balance >= 0) {
      // If crossing from negative to positive, add zero point to both segments
      if (prevPoint && prevPoint.balance < 0) {
        // Use the current point's timestamp for zero crossing
        positiveData.push({ dateTimestamp: point.dateTimestamp, balance: 0 });
        negativeData.push({ dateTimestamp: point.dateTimestamp, balance: 0 });
      }
      positiveData.push({ dateTimestamp: point.dateTimestamp, balance: point.balance });
      negativeData.push({ dateTimestamp: point.dateTimestamp, balance: null });
    } else {
      // If crossing from positive to negative, add zero point to both segments
      if (prevPoint && prevPoint.balance >= 0) {
        // Use the previous point's timestamp for zero crossing
        positiveData.push({ dateTimestamp: prevPoint.dateTimestamp, balance: 0 });
        negativeData.push({ dateTimestamp: prevPoint.dateTimestamp, balance: 0 });
      }
      positiveData.push({ dateTimestamp: point.dateTimestamp, balance: null });
      negativeData.push({ dateTimestamp: point.dateTimestamp, balance: point.balance });
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Balance Projection</h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart 
          data={data.map(d => ({ dateTimestamp: d.dateTimestamp, balance: d.balance }))}
          margin={{ top: 5, right: 20, left: 20, bottom: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="dateTimestamp"
            type="number"
            scale="time"
            stroke="#9CA3AF"
            tickFormatter={(value) => {
              if (value == null || value === undefined) return '';
              try {
                const date = new Date(value);
                if (isNaN(date.getTime())) return '';
                const dateStr = date.toISOString().split('T')[0];
                return formatDate(dateStr);
              } catch (e) {
                return '';
              }
            }}
            angle={-45}
            textAnchor="end"
            height={60}
            interval="preserveStartEnd"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            domain={xAxisDomain}
            padding={{ left: 0, right: 0 }}
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
          {/* Line for positive/zero balances (blue) */}
          <Line 
            type="monotone" 
            dataKey="balance" 
            data={positiveData}
            stroke="#3B82F6" 
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          {/* Line for negative balances (red) */}
          <Line 
            type="monotone" 
            dataKey="balance" 
            data={negativeData}
            stroke="#EF4444" 
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
