'use client';

import React, { useMemo } from 'react';
import clsx from 'clsx';

interface PasswordStrengthProps {
  password: string;
}

interface StrengthResult {
  score: number;
  label: string;
  color: string;
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = useMemo((): StrengthResult => {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    const passedChecks = Object.values(checks).filter(Boolean).length;
    
    let score = 0;
    let label = 'Very Weak';
    let color = 'bg-red-500';

    if (passedChecks >= 5) {
      score = 100;
      label = 'Very Strong';
      color = 'bg-green-500';
    } else if (passedChecks >= 4) {
      score = 80;
      label = 'Strong';
      color = 'bg-green-400';
    } else if (passedChecks >= 3) {
      score = 60;
      label = 'Medium';
      color = 'bg-yellow-500';
    } else if (passedChecks >= 2) {
      score = 40;
      label = 'Weak';
      color = 'bg-orange-500';
    } else if (passedChecks >= 1) {
      score = 20;
      label = 'Very Weak';
      color = 'bg-red-500';
    }

    return { score, label, color, checks };
  }, [password]);

  if (!password) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center space-x-2">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={clsx('h-full transition-all duration-300', strength.color)}
            style={{ width: `${strength.score}%` }}
          />
        </div>
        <span className="text-sm font-medium text-gray-600">{strength.label}</span>
      </div>

      {/* Requirements */}
      <ul className="text-xs space-y-1">
        <RequirementItem met={strength.checks.length}>
          At least 8 characters
        </RequirementItem>
        <RequirementItem met={strength.checks.uppercase}>
          One uppercase letter
        </RequirementItem>
        <RequirementItem met={strength.checks.lowercase}>
          One lowercase letter
        </RequirementItem>
        <RequirementItem met={strength.checks.number}>
          One number
        </RequirementItem>
        <RequirementItem met={strength.checks.special}>
          One special character (optional)
        </RequirementItem>
      </ul>
    </div>
  );
}

interface RequirementItemProps {
  met: boolean;
  children: React.ReactNode;
}

function RequirementItem({ met, children }: RequirementItemProps) {
  return (
    <li className={clsx('flex items-center', met ? 'text-green-600' : 'text-gray-500')}>
      {met ? (
        <svg className="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg className="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {children}
    </li>
  );
}

/**
 * Check if password meets minimum requirements
 */
export function isPasswordValid(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  );
}
