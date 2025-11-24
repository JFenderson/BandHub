import React from 'react';
import Link from 'next/link';

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  disabled?: boolean;
}

interface QuickActionsProps {
  actions: QuickAction[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  const getVariantClasses = (variant: string = 'secondary') => {
    switch (variant) {
      case 'primary':
        return 'border-primary-300 hover:border-primary-500 hover:bg-primary-50';
      case 'success':
        return 'border-green-300 hover:border-green-500 hover:bg-green-50';
      case 'danger':
        return 'border-red-300 hover:border-red-500 hover:bg-red-50';
      default:
        return 'border-gray-200 hover:border-gray-400 hover:bg-gray-50';
    }
  };

  const renderAction = (action: QuickAction, index: number) => {
    const baseClasses = `flex items-center space-x-3 p-4 border-2 rounded-lg transition-all ${getVariantClasses(action.variant)} ${
      action.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
    }`;

    const content = (
      <>
        <div className="flex-shrink-0">{action.icon}</div>
        <span className="font-medium text-gray-900">{action.label}</span>
      </>
    );

    if (action.href && !action.disabled) {
      return (
        <Link key={index} href={action.href} className={baseClasses}>
          {content}
        </Link>
      );
    }

    return (
      <button
        key={index}
        onClick={action.onClick}
        disabled={action.disabled}
        className={baseClasses}
      >
        {content}
      </button>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action, index) => renderAction(action, index))}
      </div>
    </div>
  );
}
