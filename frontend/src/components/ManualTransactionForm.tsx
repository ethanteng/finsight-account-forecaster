'use client';

import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Helper function to extract UTC date components from YYYY-MM-DD string
// This matches how dates are stored in the backend (UTC noon)
// and ensures dayOfMonth/dayOfWeek are consistent regardless of user timezone
function getUTCDateComponents(dateString: string): { dayOfMonth: number; dayOfWeek: number } {
  // Parse date string in format YYYY-MM-DD
  const parts = dateString.split('-');
  if (parts.length !== 3) {
    // Fallback: create UTC date and extract components
    const date = new Date(dateString + 'T12:00:00Z');
    return {
      dayOfMonth: date.getUTCDate(),
      dayOfWeek: date.getUTCDay(),
    };
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-indexed
  const day = parseInt(parts[2], 10);
  
  // Create date at UTC noon (matching backend parseLocalDate)
  const date = new Date(Date.UTC(year, month, day, 12, 0, 0));
  
  return {
    dayOfMonth: date.getUTCDate(),
    dayOfWeek: date.getUTCDay(),
  };
}

interface ManualTransactionFormProps {
  accountId: string;
  forecastId: string;
  onSuccess: () => void;
}

export default function ManualTransactionForm({ accountId, forecastId, onSuccess }: ManualTransactionFormProps) {
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [dayOfMonth, setDayOfMonth] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      // Calculate amount with correct sign based on transaction type
      // Expenses are negative, income is positive
      const amountValue = parseFloat(amount);
      const signedAmount = transactionType === 'expense' ? -Math.abs(amountValue) : Math.abs(amountValue);

      const requestBody: any = {
        accountId,
        forecastId,
        amount: signedAmount,
        transactionType,
        date,
        name,
        category: category || null,
        note: note || null,
      };

      // If recurring is enabled, add recurring pattern fields
      if (isRecurring) {
        requestBody.isRecurring = true;
        requestBody.frequency = frequency;
        if (frequency === 'monthly' || frequency === 'quarterly' || frequency === 'yearly') {
          if (dayOfMonth) {
            requestBody.dayOfMonth = parseInt(dayOfMonth, 10);
          }
        }
        if (frequency === 'weekly' || frequency === 'biweekly') {
          if (dayOfWeek) {
            requestBody.dayOfWeek = parseInt(dayOfWeek, 10);
          }
        }
        if (recurringEndDate) {
          requestBody.recurringEndDate = recurringEndDate;
        }
      }

      const response = await fetch(`${API_URL}/api/forecasts/transactions/manual`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        setTransactionType('expense');
        setAmount('');
        setDate('');
        setName('');
        setCategory('');
        setNote('');
        setIsRecurring(false);
        setFrequency('monthly');
        setDayOfMonth('');
        setDayOfWeek('');
        setRecurringEndDate('');
        onSuccess();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to create transaction');
      }
    } catch (error) {
      console.error('Error creating manual transaction:', error);
      alert('Error creating transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Transaction Type</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="transactionType"
              value="expense"
              checked={transactionType === 'expense'}
              onChange={(e) => setTransactionType(e.target.value as 'income' | 'expense')}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500"
            />
            <span className="text-sm">Expense</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="transactionType"
              value="income"
              checked={transactionType === 'income'}
              onChange={(e) => setTransactionType(e.target.value as 'income' | 'expense')}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500"
            />
            <span className="text-sm">Income</span>
          </label>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Amount</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-gray-700 text-white px-3 py-2 rounded"
          required
          placeholder="Enter amount"
        />
        <p className="text-xs text-gray-400 mt-1">
          {transactionType === 'expense' 
            ? 'Amount will be recorded as negative (expense)' 
            : 'Amount will be recorded as positive (income)'}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            // Auto-update dayOfMonth/dayOfWeek if recurring is enabled
            // Use UTC methods to match backend date storage (UTC noon)
            if (isRecurring && e.target.value) {
              const { dayOfMonth: dom, dayOfWeek: dow } = getUTCDateComponents(e.target.value);
              setDayOfMonth(dom.toString());
              setDayOfWeek(dow.toString());
            }
          }}
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
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isRecurring"
          checked={isRecurring}
          onChange={(e) => {
            setIsRecurring(e.target.checked);
            // Auto-populate dayOfMonth/dayOfWeek from date when enabling recurring
            // Use UTC methods to match backend date storage (UTC noon)
            if (e.target.checked && date) {
              const { dayOfMonth: dom, dayOfWeek: dow } = getUTCDateComponents(date);
              setDayOfMonth(dom.toString());
              setDayOfWeek(dow.toString());
            }
          }}
          className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
        />
        <label htmlFor="isRecurring" className="text-sm font-medium cursor-pointer">
          Make this transaction recurring
        </label>
      </div>
      {isRecurring && (
        <div className="space-y-3 pl-6 border-l-2 border-gray-700">
          <div>
            <label className="block text-sm font-medium mb-1">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => {
                setFrequency(e.target.value);
                setDayOfMonth('');
                setDayOfWeek('');
              }}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded"
              required={isRecurring}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          {(frequency === 'monthly' || frequency === 'quarterly' || frequency === 'yearly') && (
            <div>
              <label className="block text-sm font-medium mb-1">Day of Month (1-31)</label>
              <input
                type="number"
                min="1"
                max="31"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded"
                placeholder={date ? getUTCDateComponents(date).dayOfMonth.toString() : 'e.g., 15'}
              />
            </div>
          )}
          {(frequency === 'weekly' || frequency === 'biweekly') && (
            <div>
              <label className="block text-sm font-medium mb-1">Day of Week (0=Sunday, 6=Saturday)</label>
              <input
                type="number"
                min="0"
                max="6"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded"
                placeholder={date ? getUTCDateComponents(date).dayOfWeek.toString() : 'e.g., 1 (Monday)'}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">End Date (optional)</label>
            <input
              type="date"
              value={recurringEndDate}
              onChange={(e) => setRecurringEndDate(e.target.value)}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded"
            />
            <p className="text-xs text-gray-400 mt-1">Leave empty for no end date</p>
          </div>
        </div>
      )}
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
