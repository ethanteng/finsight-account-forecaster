'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ForecastChart from '@/components/ForecastChart';
import ManualTransactionForm from '@/components/ManualTransactionForm';
import { formatCurrency, formatDate } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface ForecastTransaction {
  id: string;
  amount: number;
  date: Date | string;
  name: string;
  category: string | null;
  isManual: boolean;
  note: string | null;
}

export default function ForecastPage() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get('accountId');
  const [forecastId, setForecastId] = useState<string | null>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [transactions, setTransactions] = useState<ForecastTransaction[]>([]);
  const [balanceSnapshots, setBalanceSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState(3);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');

  useEffect(() => {
    if (accountId) {
      generateForecast();
    }
  }, [accountId, months]);

  const generateForecast = async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated. Please log in again.');
        setLoading(false);
        return;
      }

      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + months);

      const response = await fetch(`${API_URL}/api/forecasts/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          endDate: endDate.toISOString(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setForecastId(data.forecast.id);
        setForecast(data.forecast);
        setTransactions(data.transactions || []);
        setBalanceSnapshots(data.balanceSnapshots || []);
        
        // Show message if no transactions were generated
        if (!data.transactions || data.transactions.length === 0) {
          setError('No forecast transactions generated. You need to detect recurring patterns first. Go to "Manage Recurring Patterns" to detect patterns from your transaction history.');
        }
      } else {
        let errorMessage = 'Failed to generate forecast';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        console.error('Forecast generation error:', errorMessage, response.status);
        setError(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error. Please check your connection.';
      console.error('Error generating forecast:', error);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/forecasts/transactions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok && forecastId) {
        // Refresh forecast
        const refreshResponse = await fetch(`${API_URL}/api/forecasts/${forecastId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          setTransactions(data.forecast.forecastTransactions || []);
          setBalanceSnapshots(data.balanceSnapshots || []);
        }
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/forecasts/transactions/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(editAmount),
          date: editDate,
        }),
      });
      if (response.ok && forecastId) {
        setEditingId(null);
        // Refresh forecast
        const refreshResponse = await fetch(`${API_URL}/api/forecasts/${forecastId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          setTransactions(data.forecast.forecastTransactions || []);
          setBalanceSnapshots(data.balanceSnapshots || []);
        }
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
    }
  };

  if (!accountId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>No account selected</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Forecast</h1>
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            Back to Dashboard
          </Link>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Forecast Horizon (months)</label>
          <input
            type="number"
            min="1"
            max="24"
            value={months}
            onChange={(e) => setMonths(parseInt(e.target.value))}
            className="bg-gray-800 text-white px-4 py-2 rounded border border-gray-700 w-32"
          />
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-600 rounded-lg">
            <p className="text-red-200 font-semibold">Error</p>
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div>Generating forecast...</div>
        ) : forecast && balanceSnapshots.length > 0 ? (
          <>
            <div className="mb-6">
              <ForecastChart balanceSnapshots={balanceSnapshots} transactions={transactions} />
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-semibold mb-4">Projected Transactions</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {[...transactions].sort((a, b) => {
                  // Sort by date first
                  const dateA = typeof a.date === 'string' ? new Date(a.date) : a.date;
                  const dateB = typeof b.date === 'string' ? new Date(b.date) : b.date;
                  const dateDiff = dateA.getTime() - dateB.getTime();
                  
                  // If dates are equal, sort by name (description)
                  if (dateDiff === 0) {
                    return (a.name || '').localeCompare(b.name || '');
                  }
                  
                  return dateDiff;
                }).map((transaction) => (
                  <div key={transaction.id} className="bg-gray-800 rounded-lg p-4 flex justify-between items-center">
                    {editingId === transaction.id ? (
                      <div className="flex gap-2 flex-1">
                        <input
                          type="number"
                          step="0.01"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="bg-gray-700 text-white px-2 py-1 rounded w-32"
                        />
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="bg-gray-700 text-white px-2 py-1 rounded"
                        />
                        <button
                          onClick={() => handleUpdate(transaction.id)}
                          className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditAmount('');
                            setEditDate('');
                          }}
                          className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="font-medium">{transaction.name}</div>
                          <div className="text-sm text-gray-400">
                            {formatDate(transaction.date)} • {transaction.category || 'Uncategorized'}
                            {transaction.isManual && <span className="ml-2 text-blue-400">(Manual)</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className={`font-semibold ${transaction.amount < 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {formatCurrency(transaction.amount)}
                          </div>
                          <button
                            onClick={() => {
                              setEditingId(transaction.id);
                              setEditAmount(transaction.amount.toString());
                              setEditDate(typeof transaction.date === 'string' ? transaction.date.split('T')[0] : transaction.date.toISOString().split('T')[0]);
                            }}
                            className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(transaction.id)}
                            className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {forecastId && (
              <ManualTransactionForm
                accountId={accountId}
                forecastId={forecastId}
                onSuccess={() => {
                  if (forecastId) {
                    const token = localStorage.getItem('token');
                    fetch(`${API_URL}/api/forecasts/${forecastId}`, {
                      headers: {
                        'Authorization': `Bearer ${token}`,
                      },
                    })
                      .then(res => res.json())
                      .then(data => {
                        setTransactions(data.forecast.forecastTransactions || []);
                        setBalanceSnapshots(data.balanceSnapshots || []);
                      });
                  }
                }}
              />
            )}
          </>
        ) : (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-4">No forecast data available.</p>
            <p className="text-sm text-gray-500 mb-4">
              To generate a forecast, you need to:
            </p>
            <ol className="text-sm text-gray-500 list-decimal list-inside space-y-2 mb-4">
              <li>Transactions are automatically synced when you connect your account</li>
              <li>Detect recurring patterns (on the Recurring Patterns page)</li>
              <li>Generate a forecast (this page will auto-generate when patterns exist)</li>
            </ol>
            <Link href="/" className="text-blue-400 hover:text-blue-300">
              Go to Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
