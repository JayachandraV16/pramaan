import React from 'react';
import { Button } from './Button';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title = 'Failed to load data',
  message,
  onRetry,
  className = '',
}) => {
  return (
    <div className={`p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 text-rose-500 mt-0.5">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-rose-900">{title}</h4>
          <p className="text-xs text-rose-700 mt-1">{message}</p>
          {onRetry && (
            <div className="mt-3">
              <Button variant="danger" size="sm" onClick={onRetry}>
                Try Again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
