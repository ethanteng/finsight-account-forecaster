'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import RecurringPatterns from '@/components/RecurringPatterns';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function RecurringPage() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get('accountId');
  const [detecting, setDetecting] = useState(false);

  const handleDetect = async () => {
    if (!accountId) return;
    setDetecting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/recurring/detect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId }),
      });

      if (response.ok) {
        // Patterns will be refreshed by the component
        alert('Pattern detection completed!');
      }
    } catch (error) {
      console.error('Error detecting patterns:', error);
      alert('Error detecting patterns');
    } finally {
      setDetecting(false);
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
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Recurring Patterns</h1>
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            Back to Dashboard
          </Link>
        </div>

        <div className="mb-6">
          <button
            onClick={handleDetect}
            disabled={detecting}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
          >
            {detecting ? 'Detecting...' : 'Detect Recurring Patterns'}
          </button>
        </div>

        <RecurringPatterns accountId={accountId} />
      </div>
    </div>
  );
}
