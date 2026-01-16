'use client';

import React, { useState, useEffect } from 'react';
import { Shield, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import { use2FA } from '@/hooks/use2FA';
import { QRCodeDisplay } from './QRCodeDisplay';
import { BackupCodesDisplay } from './BackupCodesDisplay';
import { TwoFactorVerificationInput } from './TwoFactorVerificationInput';

interface TwoFactorSetupWizardProps {
  tokenProvider: () => string | null;
  onComplete?: () => void;
  onCancel?: () => void;
  className?: string;
}

type WizardStep = 'intro' | 'qrcode' | 'verify' | 'backup';

export function TwoFactorSetupWizard({
  tokenProvider,
  onComplete,
  onCancel,
  className = '',
}: TwoFactorSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('intro');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [backupCodesSaved, setBackupCodesSaved] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const {
    setupData,
    backupCodes,
    isGenerating,
    isEnabling,
    error,
    generateSecret,
    enable2FA,
    clearError,
  } = use2FA(tokenProvider);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  };

  const handleNext = async () => {
    clearError();
    setVerificationError(null);

    if (currentStep === 'intro') {
      const data = await generateSecret();
      if (data) {
        setCurrentStep('qrcode');
      } else {
        showToast('error', error || 'Failed to generate secret');
      }
    } else if (currentStep === 'qrcode') {
      setCurrentStep('verify');
    } else if (currentStep === 'verify') {
      if (verificationCode.length !== 6) {
        setVerificationError('Please enter a 6-digit code');
        return;
      }

      const result = await enable2FA(verificationCode);
      if (result) {
        showToast('success', 'Two-factor authentication enabled successfully!');
        setCurrentStep('backup');
      } else {
        setVerificationError(error || 'Invalid verification code');
        showToast('error', error || 'Invalid verification code');
      }
    } else if (currentStep === 'backup') {
      if (!backupCodesSaved) {
        showToast('error', 'Please confirm you have saved your backup codes');
        return;
      }
      onComplete?.();
    }
  };

  const handleBack = () => {
    clearError();
    setVerificationError(null);
    
    if (currentStep === 'qrcode') {
      setCurrentStep('intro');
    } else if (currentStep === 'verify') {
      setCurrentStep('qrcode');
      setVerificationCode('');
    }
  };

  const handleCancel = () => {
    clearError();
    onCancel?.();
  };

  const handleVerificationComplete = (code: string) => {
    setVerificationCode(code);
  };

  const canGoNext = () => {
    if (currentStep === 'intro') return true;
    if (currentStep === 'qrcode') return !!setupData;
    if (currentStep === 'verify') return verificationCode.length === 6;
    if (currentStep === 'backup') return backupCodesSaved;
    return false;
  };

  const canGoBack = () => {
    return currentStep === 'qrcode' || currentStep === 'verify';
  };

  const steps: { id: WizardStep; label: string; number: number }[] = [
    { id: 'intro', label: 'Introduction', number: 1 },
    { id: 'qrcode', label: 'Setup', number: 2 },
    { id: 'verify', label: 'Verify', number: 3 },
    { id: 'backup', label: 'Backup Codes', number: 4 },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  const isLastStep = currentStep === 'backup';

  return (
    <div className={`max-w-2xl mx-auto ${className}`}>
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800'
                : 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800'
            }`}
          >
            {toast.type === 'success' ? (
              <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <X className="w-5 h-5 text-red-600 dark:text-red-400" />
            )}
            <span
              className={`text-sm font-medium ${
                toast.type === 'success'
                  ? 'text-green-900 dark:text-green-100'
                  : 'text-red-900 dark:text-red-100'
              }`}
            >
              {toast.message}
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
              <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Enable Two-Factor Authentication
            </h2>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close wizard"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center gap-2">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
                    index <= currentStepIndex
                      ? 'bg-blue-600 text-white dark:bg-blue-500'
                      : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  {index < currentStepIndex ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className={`text-sm font-medium transition-colors hidden sm:inline ${
                    index <= currentStepIndex
                      ? 'text-gray-900 dark:text-gray-100'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 transition-colors ${
                    index < currentStepIndex
                      ? 'bg-blue-600 dark:bg-blue-500'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700 p-6 min-h-[400px]">
        {currentStep === 'intro' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                What is Two-Factor Authentication?
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Two-factor authentication (2FA) adds an extra layer of security to your account 
                by requiring a verification code from your phone in addition to your password.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                Why enable 2FA?
              </h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mt-0.5">
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      Enhanced Security
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Protects your account even if your password is compromised
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mt-0.5">
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      Prevent Unauthorized Access
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Blocks attackers from accessing your account without your phone
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mt-0.5">
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      Industry Standard
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Recommended security practice used by major platforms
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>What you&apos;ll need:</strong> An authenticator app like Google Authenticator, 
                Authy, or any TOTP-compatible app installed on your phone.
              </p>
            </div>
          </div>
        )}

        {currentStep === 'qrcode' && setupData && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Scan QR Code
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Open your authenticator app and scan this QR code
              </p>
            </div>
            <QRCodeDisplay
              qrCodeDataUrl={setupData.qrCodeDataUrl}
              secret={setupData.secret}
            />
          </div>
        )}

        {currentStep === 'verify' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Verify Setup
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>
            <TwoFactorVerificationInput
              value={verificationCode}
              onChange={setVerificationCode}
              onComplete={handleVerificationComplete}
              loading={isEnabling}
              error={!!verificationError}
              errorMessage={verificationError || undefined}
              className="py-4"
            />
          </div>
        )}

        {currentStep === 'backup' && backupCodes && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Save Your Backup Codes
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Use these codes to access your account if you lose your phone
              </p>
            </div>
            <BackupCodesDisplay
              codes={backupCodes}
              onConfirmSaved={() => setBackupCodesSaved(true)}
              requireConfirmation
            />
          </div>
        )}

        {isGenerating && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin dark:border-blue-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Generating setup code...</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={handleCancel}
          className="px-4 py-2 text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 transition-colors"
        >
          Cancel
        </button>

        <div className="flex gap-3">
          {canGoBack() && (
            <button
              onClick={handleBack}
              disabled={isGenerating || isEnabling}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="font-medium text-gray-700 dark:text-gray-300">Back</span>
            </button>
          )}

          <button
            onClick={handleNext}
            disabled={!canGoNext() || isGenerating || isEnabling}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="font-medium">
              {isLastStep ? 'Complete' : 'Next'}
            </span>
            {!isLastStep && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
