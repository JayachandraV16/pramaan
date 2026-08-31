import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  label = 'Loading data...',
  className = '',
}) => {
  const sizeMap = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <div className="relative">
        <div className={`${sizeMap[size]} border-3 border-slate-200 border-t-pramaan-navy-800 rounded-full animate-spin`} />
      </div>
      {label && <p className="mt-3 text-xs font-medium text-slate-500 animate-pulse">{label}</p>}
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => {
  return (
    <div className="w-full animate-pulse">
      <div className="h-10 bg-slate-100 rounded-t-lg mb-2" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 p-3 bg-white border border-slate-100 rounded-lg">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="h-4 bg-slate-100 rounded flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-4 w-1/3 bg-slate-200 rounded" />
        <div className="h-5 w-16 bg-slate-100 rounded-full" />
      </div>
      <div className="h-8 w-1/2 bg-slate-200 rounded" />
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <div className="h-3 w-4/5 bg-slate-100 rounded" />
        <div className="h-3 w-3/5 bg-slate-100 rounded" />
      </div>
    </div>
  );
};
