'use client';

import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface ManualTransactionFormProps {
  accountId: string;
  forecastId: string;
  onSuccess: () => void;
}

export default function ManualTransactionForm({ accountId, forecastId, onSuccess }: ManualTransactionFormProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/forecasts/transactions/manual`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          forecastId,
          amount: parseFloat(amount),
          date,
          name,
          category: category || null,
          note: note || null,
        }),
      });

      if (response.ok) {
        setAmount('');
        setDate('');
        setName('');
        setCategory('');
        setNote('');
        onSuccess();
      }
    } catch (error) {
      console.error('Error creating manual transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-4 space-y-4">
      <h3 className="text-lg font-semibold">Add Manual Transaction</h3>
      <div>
        <label className="block text-sm font-medium mb-1">Amount</label>
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-gray-700 text-white px-3 py-2 rounded"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-gray-700 text-white px-3 py-2 rounded"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-gray-700 text-white px-3 py-2 rounded"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Category (optional)</label>
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-gray-700 text-white px-3 py-2 rounded"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full bg-gray-700 text-white px-3 py-2 rounded"
          rows={2}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-semibold disabled:opacity-50"
      >
        {loading ? 'Adding...' : 'Add Transaction'}
      </button>
    </form>
  );
}
