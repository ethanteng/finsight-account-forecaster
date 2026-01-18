'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePlaidLink } from 'react-plaid-link';
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
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      } else if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('token');
        setToken(null);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const createLinkToken = async () => {
    try {
      const authToken = localStorage.getItem('token');
      if (!authToken) return;

      const response = await fetch(`${API_URL}/api/plaid/create-link-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLinkToken(data.link_token);
      } else {
        setError('Failed to create link token');
      }
    } catch (error) {
      console.error('Error creating link token:', error);
      setError('Failed to connect to bank');
    }
  };

  const onSuccess = useCallback(async (publicToken: string) => {
    setConnecting(true);
    setError(null);
    
    try {
      const authToken = localStorage.getItem('token');
      if (!authToken) {
        setError('Not authenticated');
        return;
      }

      // Exchange public token
      const response = await fetch(`${API_URL}/api/plaid/exchange-public-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ public_token: publicToken }),
      });

      if (response.ok) {
        // Refresh accounts list
        await fetchAccounts(authToken);
        setLinkToken(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to connect account');
      }
    } catch (error) {
      console.error('Error exchanging token:', error);
      setError('Failed to connect account');
    } finally {
      setConnecting(false);
    }
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: (err, metadata) => {
      if (err) {
        setError(err.error_message || 'Connection cancelled');
      }
      setLinkToken(null);
      setConnecting(false);
    },
  });

  const handleConnectAccount = async () => {
    setError(null);
    await createLinkToken();
  };

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

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

  if (loading || connecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>{connecting ? 'Connecting your account...' : 'Loading...'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Account Forecaster</h1>
          <button
            onClick={handleConnectAccount}
            disabled={connecting || !ready}
            className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Connect Account
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {accounts.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <h2 className="text-2xl font-semibold mb-4">No Accounts Connected</h2>
            <p className="text-gray-400 mb-6">
              Connect your bank account to start forecasting your account balance.
            </p>
            <button
              onClick={handleConnectAccount}
              disabled={connecting || !ready}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Connect Your First Account
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Select Account</label>
              <select
                value={selectedAccountId || ''}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="bg-gray-800 text-white px-4 py-2 rounded border border-gray-700 w-full max-w-md focus:border-blue-500 focus:outline-none"
              >
                {accounts.length === 0 ? (
                  <option value="">No accounts available</option>
                ) : (
                  accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.subtype || account.type})
                    </option>
                  ))
                )}
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
                  className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  View Forecast
                </Link>
                <Link
                  href={`/recurring?accountId=${selectedAccountId}`}
                  className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Manage Recurring Patterns
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
