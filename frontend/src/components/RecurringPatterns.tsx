'use client';

import { useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import Modal from '@/components/Modal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface RecurringPattern {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  transactionType: string;
  endDate: string | null;
  startDate: string;
  confidence: number;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
}

interface Transaction {
  id: string;
  name: string;
  amount: number;
  date: string;
  merchantName?: string;
}

interface RecurringPatternsProps {
  accountId: string;
}

export default function RecurringPatterns({ accountId }: RecurringPatternsProps) {
  const [patterns, setPatterns] = useState<RecurringPattern[]>([]);
  const [availableTransactions, setAvailableTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [endDate, setEndDate] = useState('');
  const [patternEditForm, setPatternEditForm] = useState({
    name: '',
    startDate: '',
    frequency: '',
    dayOfMonth: '',
    dayOfWeek: '',
  });
  const [transactionEditName, setTransactionEditName] = useState('');
  const [showAvailableTransactions, setShowAvailableTransactions] = useState(false);
  const [creatingPattern, setCreatingPattern] = useState<string | null>(null);
  const [patternForm, setPatternForm] = useState({
    frequency: 'monthly',
    dayOfMonth: '',
    dayOfWeek: '',
    amount: '',
    name: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    patternId: string | null;
  }>({
    isOpen: false,
    patternId: null,
  });

  useEffect(() => {
    fetchPatterns();
    fetchAvailableTransactions();
  }, [accountId]);

  const fetchPatterns = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated. Please log in again.');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/recurring/patterns?accountId=${accountId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setPatterns(data.patterns || []);
      } else {
        let errorMessage = 'Failed to fetch patterns';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        console.error('Error fetching patterns:', errorMessage, response.status);
        setError(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error. Please check your connection.';
      console.error('Error fetching patterns:', error);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTransactions = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_URL}/api/recurring/transactions/available?accountId=${accountId}&limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched available transactions:', data.transactions?.length || 0);
        setAvailableTransactions(data.transactions || []);
      } else {
        console.error('Failed to fetch available transactions:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching available transactions:', error);
    }
  };

  const handleDeleteClick = (id: string) => {
    setDeleteConfirm({
      isOpen: true,
      patternId: id,
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.patternId) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/recurring/patterns/${deleteConfirm.patternId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        fetchPatterns();
        fetchAvailableTransactions();
      }
    } catch (error) {
      console.error('Error deleting pattern:', error);
    } finally {
      setDeleteConfirm({
        isOpen: false,
        patternId: null,
      });
    }
  };

  const handleUpdatePattern = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const updateData: any = {};
      
      if (patternEditForm.name && patternEditForm.name.trim()) {
        updateData.name = patternEditForm.name.trim();
      }
      if (endDate !== undefined && endDate !== '') {
        updateData.endDate = endDate || null;
      }
      if (patternEditForm.startDate) {
        updateData.startDate = patternEditForm.startDate;
      }
      if (patternEditForm.frequency) {
        updateData.frequency = patternEditForm.frequency;
        if (patternEditForm.frequency === 'monthly' || patternEditForm.frequency === 'quarterly' || patternEditForm.frequency === 'yearly') {
          if (patternEditForm.dayOfMonth) {
            updateData.dayOfMonth = parseInt(patternEditForm.dayOfMonth, 10);
          }
        } else if (patternEditForm.frequency === 'weekly' || patternEditForm.frequency === 'biweekly') {
          if (patternEditForm.dayOfWeek) {
            updateData.dayOfWeek = parseInt(patternEditForm.dayOfWeek, 10);
          }
        }
      } else {
        // If frequency isn't changing, still allow updating dayOfMonth/dayOfWeek
        if (patternEditForm.dayOfMonth !== '') {
          updateData.dayOfMonth = patternEditForm.dayOfMonth ? parseInt(patternEditForm.dayOfMonth, 10) : null;
        }
        if (patternEditForm.dayOfWeek !== '') {
          updateData.dayOfWeek = patternEditForm.dayOfWeek ? parseInt(patternEditForm.dayOfWeek, 10) : null;
        }
      }

      const response = await fetch(`${API_URL}/api/recurring/patterns/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      if (response.ok) {
        setEditingId(null);
        setEndDate('');
        setPatternEditForm({
          name: '',
          startDate: '',
          frequency: '',
          dayOfMonth: '',
          dayOfWeek: '',
        });
        fetchPatterns();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to update pattern');
      }
    } catch (error) {
      console.error('Error updating pattern:', error);
      alert('Error updating pattern');
    }
  };

  const handleUpdateTransactionName = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Not authenticated. Please log in again.');
        return;
      }
      if (!transactionEditName.trim()) {
        alert('Transaction name cannot be empty');
        return;
      }
      const response = await fetch(`${API_URL}/api/transactions/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: transactionEditName.trim() }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Transaction updated successfully:', data);
        
        // Update the transaction in the local state immediately
        setAvailableTransactions(prev => 
          prev.map(t => t.id === id ? { ...t, name: data.transaction.name } : t)
        );
        
        // Clear editing state
        setEditingTransactionId(null);
        setTransactionEditName('');
        
        // Also refresh from server to ensure consistency
        fetchAvailableTransactions();
      } else {
        let errorMessage = 'Failed to update transaction';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        console.error('Error updating transaction:', errorMessage, response.status);
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Network error updating transaction. Please check your connection.');
    }
  };

  const handleMarkAsRecurring = (transaction: Transaction) => {
    setCreatingPattern(transaction.id);
    setPatternForm({
      frequency: 'monthly',
      dayOfMonth: new Date(transaction.date).getDate().toString(),
      dayOfWeek: '',
      amount: Math.abs(transaction.amount).toString(),
      name: transaction.name || transaction.merchantName || '',
    });
  };

  const handleCreatePattern = async (transactionId: string) => {
    try {
      const token = localStorage.getItem('token');
      const formData: any = {
        transactionId,
        frequency: patternForm.frequency,
        amount: parseFloat(patternForm.amount),
        name: patternForm.name,
      };

      if (patternForm.frequency === 'monthly' || patternForm.frequency === 'quarterly' || patternForm.frequency === 'yearly') {
        if (patternForm.dayOfMonth) {
          formData.dayOfMonth = parseInt(patternForm.dayOfMonth, 10);
        }
      }

      if (patternForm.frequency === 'weekly' || patternForm.frequency === 'biweekly') {
        if (patternForm.dayOfWeek) {
          formData.dayOfWeek = parseInt(patternForm.dayOfWeek, 10);
        }
      }

      const response = await fetch(`${API_URL}/api/recurring/patterns/create-from-transaction`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setCreatingPattern(null);
        setPatternForm({
          frequency: 'monthly',
          dayOfMonth: '',
          dayOfWeek: '',
          amount: '',
          name: '',
        });
        fetchPatterns();
        fetchAvailableTransactions();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to create pattern');
      }
    } catch (error) {
      console.error('Error creating pattern:', error);
      alert('Error creating pattern');
    }
  };

  if (loading) return <div>Loading patterns...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Recurring Patterns</h2>
      
      {error && (
        <div className="p-4 bg-red-900/50 border border-red-600 rounded-lg">
          <p className="text-red-200 font-semibold">Error</p>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {patterns.length === 0 && !error ? (
        <div className="bg-gray-800 rounded-lg p-6">
          <p className="text-gray-400 mb-4">No recurring patterns detected yet.</p>
          <p className="text-sm text-gray-500 mb-4">
            To detect recurring patterns, you need to:
          </p>
          <ol className="text-sm text-gray-500 list-decimal list-inside space-y-2 mb-4">
            <li>Transactions are automatically synced when you connect your account</li>
            <li>Click "Detect Recurring Patterns" button above</li>
          </ol>
          <p className="text-xs text-gray-600">
            Note: You need at least 3 transactions with similar amounts and timing to detect a pattern.
          </p>
        </div>
      ) : patterns.length > 0 ? (
        <div className="space-y-3">
          {patterns.map((pattern) => (
            <div key={pattern.id} className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold">{pattern.name}</h3>
                  <p className="text-sm text-gray-400">
                    {formatCurrency(pattern.amount)} • {pattern.frequency} • {pattern.transactionType}
                  </p>
                  <p className="text-xs text-gray-500">Confidence: {(pattern.confidence * 100).toFixed(0)}%</p>
                  <p className="text-xs text-gray-500">Starts: {new Date(pattern.startDate).toLocaleDateString()}</p>
                  {pattern.endDate && (
                    <p className="text-xs text-yellow-400">Ends: {new Date(pattern.endDate).toLocaleDateString()}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {editingId === pattern.id ? (
                    <div className="flex flex-col gap-2 min-w-[300px]">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Transaction Name</label>
                        <input
                          type="text"
                          value={patternEditForm.name || pattern.name}
                          onChange={(e) => setPatternEditForm({ ...patternEditForm, name: e.target.value })}
                          className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm"
                          placeholder="Pattern name"
                        />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                          <input
                            type="date"
                            value={patternEditForm.startDate}
                            onChange={(e) => setPatternEditForm({ ...patternEditForm, startDate: e.target.value })}
                            className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-400 mb-1">End Date</label>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-400 mb-1">Frequency</label>
                          <select
                            value={patternEditForm.frequency || pattern.frequency}
                            onChange={(e) => setPatternEditForm({ ...patternEditForm, frequency: e.target.value })}
                            className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm"
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="biweekly">Biweekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="yearly">Yearly</option>
                          </select>
                        </div>
                        {(patternEditForm.frequency === 'monthly' || patternEditForm.frequency === 'quarterly' || patternEditForm.frequency === 'yearly' || 
                          (!patternEditForm.frequency && (pattern.frequency === 'monthly' || pattern.frequency === 'quarterly' || pattern.frequency === 'yearly'))) && (
                          <div className="flex-1">
                            <label className="block text-xs text-gray-400 mb-1">Day of Month</label>
                            <input
                              type="number"
                              min="1"
                              max="31"
                              value={patternEditForm.dayOfMonth !== '' ? patternEditForm.dayOfMonth : (pattern.dayOfMonth || '')}
                              onChange={(e) => setPatternEditForm({ ...patternEditForm, dayOfMonth: e.target.value })}
                              className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm"
                              placeholder="1-31"
                            />
                          </div>
                        )}
                        {(patternEditForm.frequency === 'weekly' || patternEditForm.frequency === 'biweekly' || 
                          (!patternEditForm.frequency && (pattern.frequency === 'weekly' || pattern.frequency === 'biweekly'))) && (
                          <div className="flex-1">
                            <label className="block text-xs text-gray-400 mb-1">Day of Week</label>
                            <input
                              type="number"
                              min="0"
                              max="6"
                              value={patternEditForm.dayOfWeek !== '' ? patternEditForm.dayOfWeek : (pattern.dayOfWeek !== null ? pattern.dayOfWeek.toString() : '')}
                              onChange={(e) => setPatternEditForm({ ...patternEditForm, dayOfWeek: e.target.value })}
                              className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm"
                              placeholder="0-6"
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdatePattern(pattern.id)}
                          className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm flex-1"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEndDate('');
                            setPatternEditForm({
                              startDate: '',
                              frequency: '',
                              dayOfMonth: '',
                              dayOfWeek: '',
                            });
                          }}
                          className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm flex-1"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(pattern.id);
                          setEndDate(pattern.endDate ? new Date(pattern.endDate).toISOString().split('T')[0] : '');
                          setPatternEditForm({
                            name: pattern.name,
                            startDate: new Date(pattern.startDate).toISOString().split('T')[0],
                            frequency: '',
                            dayOfMonth: pattern.dayOfMonth !== null ? pattern.dayOfMonth.toString() : '',
                            dayOfWeek: pattern.dayOfWeek !== null ? pattern.dayOfWeek.toString() : '',
                          });
                        }}
                        className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(pattern.id)}
                        className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Available Transactions Section */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Other Transactions</h2>
          <button
            onClick={() => setShowAvailableTransactions(!showAvailableTransactions)}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            {showAvailableTransactions ? 'Hide' : 'Show'} ({availableTransactions.length})
          </button>
        </div>

        {showAvailableTransactions && (
          <div className="space-y-2">
            {availableTransactions.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-4 text-gray-400 text-sm">
                All transactions are already part of recurring patterns.
              </div>
            ) : (
              availableTransactions.map((transaction) => (
                <div key={transaction.id} className="bg-gray-800 rounded-lg p-4">
                  {creatingPattern === transaction.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Transaction Name</label>
                        <input
                          type="text"
                          value={patternForm.name}
                          onChange={(e) => setPatternForm({ ...patternForm, name: e.target.value })}
                          className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
                          placeholder="Pattern name"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Frequency</label>
                          <select
                            value={patternForm.frequency}
                            onChange={(e) => setPatternForm({ ...patternForm, frequency: e.target.value })}
                            className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="biweekly">Biweekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="yearly">Yearly</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Amount (always positive)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={patternForm.amount}
                            onChange={(e) => setPatternForm({ ...patternForm, amount: e.target.value })}
                            className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
                          />
                        </div>
                      </div>
                      {(patternForm.frequency === 'monthly' || patternForm.frequency === 'quarterly' || patternForm.frequency === 'yearly') && (
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Day of Month (1-31)</label>
                          <input
                            type="number"
                            min="1"
                            max="31"
                            value={patternForm.dayOfMonth}
                            onChange={(e) => setPatternForm({ ...patternForm, dayOfMonth: e.target.value })}
                            className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
                            placeholder="e.g., 15"
                          />
                        </div>
                      )}
                      {(patternForm.frequency === 'weekly' || patternForm.frequency === 'biweekly') && (
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Day of Week (0=Sunday, 6=Saturday)</label>
                          <input
                            type="number"
                            min="0"
                            max="6"
                            value={patternForm.dayOfWeek}
                            onChange={(e) => setPatternForm({ ...patternForm, dayOfWeek: e.target.value })}
                            className="w-full bg-gray-700 text-white px-3 py-2 rounded text-sm"
                            placeholder="e.g., 1 (Monday)"
                          />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCreatePattern(transaction.id)}
                          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm"
                        >
                          Create Pattern
                        </button>
                        <button
                          onClick={() => {
                            setCreatingPattern(null);
                            setPatternForm({
                              frequency: 'monthly',
                              dayOfMonth: '',
                              dayOfWeek: '',
                              amount: '',
                              name: '',
                            });
                          }}
                          className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center gap-4">
                      {editingTransactionId === transaction.id ? (
                        <div className="flex gap-2 flex-1">
                          <input
                            type="text"
                            value={transactionEditName}
                            onChange={(e) => setTransactionEditName(e.target.value)}
                            className="flex-1 bg-gray-700 text-white px-3 py-2 rounded text-sm"
                            placeholder="Transaction name"
                          />
                          <button
                            onClick={() => handleUpdateTransactionName(transaction.id)}
                            className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingTransactionId(null);
                              setTransactionEditName('');
                            }}
                            className="bg-gray-600 hover:bg-gray-700 px-3 py-2 rounded text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{transaction.name || transaction.merchantName || 'Unknown'}</p>
                            <p className="text-sm text-gray-400">
                              {formatCurrency(transaction.amount)} • {formatDate(transaction.date)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingTransactionId(transaction.id);
                                setTransactionEditName(transaction.name || transaction.merchantName || '');
                              }}
                              className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm whitespace-nowrap"
                            >
                              Edit Name
                            </button>
                            <button
                              onClick={() => handleMarkAsRecurring(transaction)}
                              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm whitespace-nowrap flex-shrink-0"
                            >
                              Mark as Recurring
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
      <Modal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, patternId: null })}
        title="Delete Pattern"
        message="Are you sure you want to delete this pattern? This action cannot be undone."
        type="confirm"
        onConfirm={handleDeleteConfirm}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
