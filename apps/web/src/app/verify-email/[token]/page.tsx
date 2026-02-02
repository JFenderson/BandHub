'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { userApiClient } from '@/lib/api/users';
import { useUser } from '@/contexts/UserContext';

type VerificationStatus = 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  const params = useParams();
  const token = params?.token as string;
  const { isAuthenticated, refreshUser } = useUser();

  const [status, setStatus] = useState<VerificationStatus>('verifying');
  const [error, setError] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        await userApiClient.verifyEmail(token);
        setStatus('success');
        
        // Refresh user data if authenticated
        if (isAuthenticated) {
          await refreshUser();
        }
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to verify email');
      }
    };

    if (token) {
      verifyEmail();
    }
  }, [token, isAuthenticated, refreshUser]);

  const handleResendVerification = async () => {
    if (!isAuthenticated) {
      return;
    }

    setIsResending(true);
    setResendSuccess(false);

    try {
      await userApiClient.resendVerification();
      setResendSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend verification email');
    } finally {
      setIsResending(false);
    }
  };

  if (status === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying your email</h2>
          <p className="text-gray-600">Please wait while we verify your email address...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h2>
          <p className="text-gray-600 mb-6">
            Your email has been successfully verified. You now have full access to all features.
          </p>
          <div className="space-y-3">
            {isAuthenticated ? (
              <Link
                href="/profile"
                className="block w-full px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Go to Profile
              </Link>
            ) : (
              <Link
                href="/login"
                className="block w-full px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Sign in
              </Link>
            )}
            <Link
              href="/"
              className="block w-full px-6 py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h2>
        <p className="text-gray-600 mb-6">
          {error || 'The verification link is invalid or has expired.'}
        </p>

        {resendSuccess && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded mb-4 text-left">
            <p className="text-sm text-green-700">
              A new verification email has been sent. Please check your inbox.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {isAuthenticated && (
            <button
              onClick={handleResendVerification}
              disabled={isResending}
              className="block w-full px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {isResending ? 'Sending...' : 'Resend verification email'}
            </button>
          )}
          <Link
            href="/login"
            className="block w-full px-6 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg transition-colors"
          >
            {isAuthenticated ? 'Go to Profile' : 'Sign in'}
          </Link>
          <Link
            href="/"
            className="block w-full px-6 py-2 text-gray-500 hover:text-gray-700 transition-colors"
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
