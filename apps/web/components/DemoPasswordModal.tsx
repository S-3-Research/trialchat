'use client';

import { useState } from 'react';
import { verifyPassword, type DemoId, DEMOS } from '@/lib/demoAuth';

interface DemoPasswordModalProps {
  demoId: DemoId;
  onSuccess: () => void;
  onCancel?: () => void;
}

export default function DemoPasswordModal({
  demoId,
  onSuccess,
  onCancel,
}: DemoPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const demoInfo = DEMOS[demoId];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);

    const result = await verifyPassword(demoId, password);

    setIsVerifying(false);

    if (result.success) {
      onSuccess();
    } else {
      setError(result.error || 'Incorrect password');
      setPassword('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
          {demoInfo.name}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          This demo is password protected. Please enter the password to continue.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter password"
              autoFocus
              disabled={isVerifying}
            />
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!password || isVerifying}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {isVerifying ? 'Verifying...' : 'Unlock'}
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isVerifying}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Tip: You can use the demo password or the master password.
        </p>
      </div>
    </div>
  );
}
