'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePlaidLink } from 'react-plaid-link';
import { formatCurrency } from '@/lib/utils';
import Modal from '@/components/Modal';

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
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'confirm';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const fetchAccounts = useCallback(async (authToken: string) => {
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
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    setToken(storedToken);
    if (storedToken) {
      fetchAccounts(storedToken);
    } else {
      setLoading(false);
    }
  }, [fetchAccounts]);

  const createLinkToken = async () => {
    try {
      const authToken = localStorage.getItem('token');
      if (!authToken) {
        setError('Not authenticated. Please log in again.');
        setConnecting(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/plaid/create-link-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.link_token) {
          setLinkToken(data.link_token);
        } else {
          setError('Invalid response from server');
          setConnecting(false);
        }
      } else {
        let errorMessage = 'Failed to create link token';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
          console.error('Link token creation error:', errorData);
        } catch (e) {
          console.error('Link token creation failed:', response.status, response.statusText);
          if (response.status === 401) {
            errorMessage = 'Authentication failed. Please log in again.';
            localStorage.removeItem('token');
            setToken(null);
          } else if (response.status === 500) {
            errorMessage = 'Server error. Please check if Plaid credentials are configured.';
          }
        }
        setError(errorMessage);
        setConnecting(false);
      }
    } catch (error) {
      console.error('Error creating link token:', error);
      setError('Network error. Please check your connection and try again.');
      setConnecting(false);
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
        const data = await response.json();
        // Refresh accounts list
        await fetchAccounts(authToken);
        setLinkToken(null);
        
        // Show success message with sync info
        if (data.accountsSynced > 0) {
          const successfulSyncs = data.transactionSyncResults?.filter((r: any) => r.success).length || 0;
          if (successfulSyncs > 0) {
            setModal({
              isOpen: true,
              title: 'Account Connected',
              message: `Account connected successfully! Synced transactions for ${successfulSyncs} account(s).`,
              type: 'success',
            });
          } else {
            setModal({
              isOpen: true,
              title: 'Account Connected',
              message: 'Account connected successfully! Transaction sync will happen automatically.',
              type: 'success',
            });
          }
        }
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
  }, [fetchAccounts]);

  const onExit = useCallback((err: any, metadata: any) => {
    if (err) {
      setError(err.error_message || 'Connection cancelled');
    }
    setLinkToken(null);
    setConnecting(false);
  }, []);

  // Initialize Plaid Link - hook must be called unconditionally
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: linkToken ? onSuccess : () => {},
    onExit: linkToken ? onExit : () => {},
  });

  const handleConnectAccount = async () => {
    if (connecting) return;
    setError(null);
    setConnecting(true);
    try {
      await createLinkToken();
    } catch (error) {
      setError('Failed to create connection');
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  const handleSyncTransactions = async () => {
    if (!selectedAccountId) return;
    setSyncing(true);
    setError(null);

    try {
      const authToken = localStorage.getItem('token');
      if (!authToken) {
        setError('Not authenticated. Please log in again.');
        setSyncing(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/transactions/sync/${selectedAccountId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const message = `Successfully synced transactions! Added: ${data.added || 0}` +
          (data.patternsDetected > 0 ? `\nDetected ${data.patternsDetected} recurring pattern(s).` : 
           '\nNo recurring patterns detected. You may need more transaction history.');
        setModal({
          isOpen: true,
          title: 'Sync Complete',
          message: message,
          type: 'success',
        });
      } else {
        let errorMessage = 'Failed to sync transactions';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        setError(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error. Please check your connection.';
      console.error('Error syncing transactions:', error);
      setError(errorMessage);
    } finally {
      setSyncing(false);
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
            disabled={connecting}
            className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
              disabled={connecting}
              className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {connecting ? 'Connecting...' : 'Connect Your First Account'}
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Select Account</label>
              <div className="flex gap-4 items-end">
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
                {selectedAccountId && (
                  <Link
                    href={`/forecast?accountId=${selectedAccountId}`}
                    className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap"
                  >
                    View Forecast
                  </Link>
                )}
              </div>
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
                <button
                  onClick={handleSyncTransactions}
                  disabled={syncing}
                  className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {syncing ? 'Syncing...' : 'Sync Transactions'}
                </button>
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
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </div>
  );
}
