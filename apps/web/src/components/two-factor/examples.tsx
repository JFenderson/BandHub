/**
 * Example usage of Two-Factor Authentication components
 * This file demonstrates how to integrate the 2FA components
 */

'use client';

import { useState } from 'react';
import { TwoFactorSetupWizard } from '@/components/two-factor';

// Example: Using the setup wizard in a settings page
export function SecuritySettingsExample() {
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  // Token provider function - adjust based on your auth implementation
  const tokenProvider = () => {
    // Example: Get from localStorage, context, or cookie
    return localStorage.getItem('authToken');
  };

  const handleSetupComplete = () => {
    setShowSetupWizard(false);
    // Refresh user settings or show success message
    console.log('2FA setup completed successfully!');
  };

  const handleSetupCancel = () => {
    setShowSetupWizard(false);
    console.log('2FA setup cancelled');
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Security Settings</h1>
      
      {!showSetupWizard ? (
        <div className="space-y-4">
          <div className="p-6 bg-white rounded-lg shadow-sm border dark:bg-gray-800 dark:border-gray-700">
            <h2 className="text-lg font-semibold mb-2">Two-Factor Authentication</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Add an extra layer of security to your account
            </p>
            <button
              onClick={() => setShowSetupWizard(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Enable Two-Factor Authentication
            </button>
          </div>
        </div>
      ) : (
        <TwoFactorSetupWizard
          tokenProvider={tokenProvider}
          onComplete={handleSetupComplete}
          onCancel={handleSetupCancel}
        />
      )}
    </div>
  );
}

// Example: Using individual components
import { useEffect } from 'react';
import { use2FA } from '@/hooks/use2FA';
import { QRCodeDisplay, BackupCodesDisplay, TwoFactorVerificationInput } from '@/components/two-factor';

export function CustomSetupExample() {
  const tokenProvider = () => localStorage.getItem('authToken');
  const [step, setStep] = useState<'qr' | 'verify' | 'backup'>('qr');
  const [code, setCode] = useState('');

  const {
    setupData,
    backupCodes,
    isGenerating,
    isEnabling,
    error,
    generateSecret,
    enable2FA,
  } = use2FA(tokenProvider);

  // Initialize on mount
  useEffect(() => {
    generateSecret();
  }, [generateSecret]);

  const handleVerifyComplete = async (token: string) => {
    const result = await enable2FA(token);
    if (result) {
      setStep('backup');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {step === 'qr' && setupData && (
        <div>
          <QRCodeDisplay
            qrCodeDataUrl={setupData.qrCodeDataUrl}
            secret={setupData.secret}
          />
          <button
            onClick={() => setStep('verify')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Next
          </button>
        </div>
      )}

      {step === 'verify' && (
        <div>
          <h2 className="text-xl font-bold mb-4">Verify Your Code</h2>
          <TwoFactorVerificationInput
            value={code}
            onChange={setCode}
            onComplete={handleVerifyComplete}
            loading={isEnabling}
            error={!!error}
            errorMessage={error || undefined}
          />
        </div>
      )}

      {step === 'backup' && backupCodes && (
        <div>
          <h2 className="text-xl font-bold mb-4">Save Your Backup Codes</h2>
          <BackupCodesDisplay
            codes={backupCodes}
            onConfirmSaved={() => console.log('Codes saved!')}
            requireConfirmation
          />
        </div>
      )}
    </div>
  );
}

// Example: Using verification input standalone (e.g., login page)
export function LoginVerificationExample() {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async (token: string) => {
    setIsVerifying(true);
    setError(null);

    try {
      // Call your verification API
      const response = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        // Redirect to dashboard or show success
        console.log('Login successful!');
      } else {
        setError('Invalid verification code');
      }
    } catch (err) {
      setError('Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 text-center">
        Two-Factor Authentication
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">
        Enter the 6-digit code from your authenticator app
      </p>
      <TwoFactorVerificationInput
        value={code}
        onChange={setCode}
        onComplete={handleComplete}
        loading={isVerifying}
        error={!!error}
        errorMessage={error || undefined}
      />
    </div>
  );
}
