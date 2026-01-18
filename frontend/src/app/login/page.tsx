'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function LoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        router.push('/');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength (basic check - backend will do full validation)
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        router.push('/');
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    resetForm();
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md">
        <div className="flex mb-6 border-b border-gray-700">
          <button
            type="button"
            onClick={() => {
              setIsRegistering(false);
              resetForm();
            }}
            className={`flex-1 py-2 px-4 text-center font-semibold transition-colors ${
              !isRegistering
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegistering(true);
              resetForm();
            }}
            className={`flex-1 py-2 px-4 text-center font-semibold transition-colors ${
              isRegistering
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Sign Up
          </button>
        </div>

        <h1 className="text-2xl font-bold mb-6">
          {isRegistering ? 'Create Account' : 'Login'}
        </h1>

        <form onSubmit={isRegistering ? handleRegister : handleLogin}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              required
            />
            {isRegistering && (
              <p className="text-xs text-gray-400 mt-1">
                Must be at least 8 characters with uppercase, lowercase, and a number
              </p>
            )}
          </div>
          {isRegistering && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
          )}
          {error && <div className="text-red-400 mb-4 text-sm">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading
              ? isRegistering
                ? 'Creating account...'
                : 'Logging in...'
              : isRegistering
              ? 'Sign Up'
              : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
