'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import RecurringPatterns from '@/components/RecurringPatterns';
import Modal from '@/components/Modal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function RecurringPage() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get('accountId');
  const [detecting, setDetecting] = useState(false);
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
        const data = await response.json();
        const message = data.patterns && data.patterns.length > 0
          ? `Detected ${data.patterns.length} recurring pattern(s)!`
          : `No patterns detected. Found ${data.transactionCount || 0} transactions. You may need more transaction history or transactions with consistent timing.`;
        setModal({
          isOpen: true,
          title: data.patterns && data.patterns.length > 0 ? 'Patterns Detected' : 'No Patterns Found',
          message: message,
          type: data.patterns && data.patterns.length > 0 ? 'success' : 'info',
        });
      } else {
        let errorMessage = 'Failed to detect patterns';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        setModal({
          isOpen: true,
          title: 'Error',
          message: errorMessage,
          type: 'error',
        });
      }
    } catch (error) {
      console.error('Error detecting patterns:', error);
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Error detecting patterns',
        type: 'error',
      });
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
      <Modal
        isOpen={modal.isOpen}
        onClose={() => {
          setModal({ ...modal, isOpen: false });
          // Refresh patterns after modal closes
          if (modal.type === 'success' || modal.type === 'info') {
            window.location.reload();
          }
        }}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </div>
  );
}
