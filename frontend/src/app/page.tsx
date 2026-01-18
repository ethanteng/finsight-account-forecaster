'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Account {
  id: string;
  name: string;
  currentBalance: number | null;
  type: string;
  subtype: string | null;
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    setToken(storedToken);
    if (storedToken) {
      fetchAccounts(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchAccounts = async (authToken: string) => {
    try {
      const response = await fetch(`${API_URL}/api/accounts`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
        if (data.accounts && data.accounts.length > 0) {
          setSelectedAccountId(data.accounts[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Account Forecaster</h1>
          <p className="mb-4">Please log in to continue</p>
          <Link href="/login" className="text-blue-400 hover:text-blue-300">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Account Forecaster</h1>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Select Account</label>
          <select
            value={selectedAccountId || ''}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="bg-gray-800 text-white px-4 py-2 rounded border border-gray-700"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.subtype || account.type})
              </option>
            ))}
          </select>
        </div>

        {selectedAccount && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-2">{selectedAccount.name}</h2>
            <p className="text-2xl font-bold text-green-400">
              {formatCurrency(selectedAccount.currentBalance || 0)}
            </p>
          </div>
        )}

        {selectedAccountId && (
          <div className="flex gap-4">
            <Link
              href={`/forecast?accountId=${selectedAccountId}`}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold"
            >
              View Forecast
            </Link>
            <Link
              href={`/recurring?accountId=${selectedAccountId}`}
              className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-semibold"
            >
              Manage Recurring Patterns
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
