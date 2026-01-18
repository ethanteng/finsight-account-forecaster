'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface RecurringPattern {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  transactionType: string;
  endDate: string | null;
  confidence: number;
}

interface RecurringPatternsProps {
  accountId: string;
}

export default function RecurringPatterns({ accountId }: RecurringPatternsProps) {
  const [patterns, setPatterns] = useState<RecurringPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchPatterns();
  }, [accountId]);

  const fetchPatterns = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/recurring/patterns?accountId=${accountId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPatterns(data.patterns || []);
      }
    } catch (error) {
      console.error('Error fetching patterns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pattern?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/recurring/patterns/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        fetchPatterns();
      }
    } catch (error) {
      console.error('Error deleting pattern:', error);
    }
  };

  const handleUpdateEndDate = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/recurring/patterns/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ endDate: endDate || null }),
      });
      if (response.ok) {
        setEditingId(null);
        setEndDate('');
        fetchPatterns();
      }
    } catch (error) {
      console.error('Error updating pattern:', error);
    }
  };

  if (loading) return <div>Loading patterns...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Recurring Patterns</h2>
      {patterns.length === 0 ? (
        <p className="text-gray-400">No recurring patterns detected yet.</p>
      ) : (
        <div className="space-y-3">
          {patterns.map((pattern) => (
            <div key={pattern.id} className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{pattern.name}</h3>
                  <p className="text-sm text-gray-400">
                    {formatCurrency(Math.abs(pattern.amount))} • {pattern.frequency} • {pattern.transactionType}
                  </p>
                  <p className="text-xs text-gray-500">Confidence: {(pattern.confidence * 100).toFixed(0)}%</p>
                  {pattern.endDate && (
                    <p className="text-xs text-yellow-400">Ends: {new Date(pattern.endDate).toLocaleDateString()}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {editingId === pattern.id ? (
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-gray-700 text-white px-2 py-1 rounded text-sm"
                      />
                      <button
                        onClick={() => handleUpdateEndDate(pattern.id)}
                        className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEndDate('');
                        }}
                        className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(pattern.id);
                          setEndDate(pattern.endDate || '');
                        }}
                        className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm"
                      >
                        Set End Date
                      </button>
                      <button
                        onClick={() => handleDelete(pattern.id)}
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
      )}
    </div>
  );
}
