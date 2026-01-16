/**
 * Custom hook for Two-Factor Authentication operations
 */
import { useState, useCallback } from 'react';
import { getTwoFactorApiClient, MfaSetupResponse, MfaEnableResponse, MfaStatusResponse } from '@/lib/api/two-factor';

interface Use2FAReturn {
  // Data
  setupData: MfaSetupResponse | null;
  backupCodes: string[] | null;
  status: MfaStatusResponse | null;
  
  // Loading states
  isGenerating: boolean;
  isEnabling: boolean;
  isDisabling: boolean;
  isVerifying: boolean;
  isRegenerating: boolean;
  isCheckingStatus: boolean;
  
  // Error state
  error: string | null;
  
  // Actions
  generateSecret: () => Promise<MfaSetupResponse | null>;
  enable2FA: (token: string) => Promise<MfaEnableResponse | null>;
  disable2FA: (token: string) => Promise<boolean>;
  verify2FA: (token: string) => Promise<boolean>;
  regenerateBackupCodes: (token: string) => Promise<string[] | null>;
  getStatus: () => Promise<MfaStatusResponse | null>;
  clearError: () => void;
}

export function use2FA(tokenProvider: () => string | null): Use2FAReturn {
  const [setupData, setSetupData] = useState<MfaSetupResponse | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [status, setStatus] = useState<MfaStatusResponse | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  
  const client = getTwoFactorApiClient(tokenProvider);
  
  const generateSecret = useCallback(async (): Promise<MfaSetupResponse | null> => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const data = await client.generateSecret();
      setSetupData(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate secret';
      setError(message);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [client]);
  
  const enable2FA = useCallback(async (token: string): Promise<MfaEnableResponse | null> => {
    setIsEnabling(true);
    setError(null);
    
    try {
      const data = await client.enable2FA(token);
      setBackupCodes(data.backupCodes);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enable 2FA';
      setError(message);
      return null;
    } finally {
      setIsEnabling(false);
    }
  }, [client]);
  
  const disable2FA = useCallback(async (token: string): Promise<boolean> => {
    setIsDisabling(true);
    setError(null);
    
    try {
      await client.disable2FA(token);
      setSetupData(null);
      setBackupCodes(null);
      setStatus(null);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disable 2FA';
      setError(message);
      return false;
    } finally {
      setIsDisabling(false);
    }
  }, [client]);
  
  const verify2FA = useCallback(async (token: string): Promise<boolean> => {
    setIsVerifying(true);
    setError(null);
    
    try {
      const result = await client.verifyToken(token);
      return result.verified;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to verify token';
      setError(message);
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, [client]);
  
  const regenerateBackupCodes = useCallback(async (token: string): Promise<string[] | null> => {
    setIsRegenerating(true);
    setError(null);
    
    try {
      const data = await client.regenerateBackupCodes(token);
      setBackupCodes(data.backupCodes);
      return data.backupCodes;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to regenerate backup codes';
      setError(message);
      return null;
    } finally {
      setIsRegenerating(false);
    }
  }, [client]);
  
  const getStatus = useCallback(async (): Promise<MfaStatusResponse | null> => {
    setIsCheckingStatus(true);
    setError(null);
    
    try {
      const data = await client.getStatus();
      setStatus(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get status';
      setError(message);
      return null;
    } finally {
      setIsCheckingStatus(false);
    }
  }, [client]);
  
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  return {
    setupData,
    backupCodes,
    status,
    isGenerating,
    isEnabling,
    isDisabling,
    isVerifying,
    isRegenerating,
    isCheckingStatus,
    error,
    generateSecret,
    enable2FA,
    disable2FA,
    verify2FA,
    regenerateBackupCodes,
    getStatus,
    clearError,
  };
}
