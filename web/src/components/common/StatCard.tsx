import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    positive?: boolean;
  };
  variant?: 'default' | 'navy' | 'amber' | 'emerald';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  sublabel,
  icon,
  trend,
  variant = 'default',
  className = '',
}) => {
  const variantStyles = {
    default: 'bg-white border-slate-200/80 text-slate-900',
    navy: 'bg-gradient-to-br from-pramaan-navy-900 to-pramaan-navy-950 border-pramaan-navy-800 text-white shadow-md',
    amber: 'bg-gradient-to-br from-amber-500 to-amber-700 border-amber-600 text-white shadow-md',
    emerald: 'bg-gradient-to-br from-emerald-600 to-emerald-800 border-emerald-700 text-white shadow-md',
  };

  const isDark = variant !== 'default';

  return (
    <div className={`rounded-xl border p-5 transition-all hover:shadow-gov-md ${variantStyles[variant]} ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-white/80' : 'text-slate-500'}`}>
          {label}
        </span>
        {icon && (
          <div className={`p-2 rounded-lg ${isDark ? 'bg-white/10 text-white' : 'bg-slate-100 text-pramaan-navy-800'}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
        </span>
        {trend && (
          <span
            className={`inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded ${
              trend.positive
                ? isDark ? 'bg-emerald-400/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
                : isDark ? 'bg-rose-400/20 text-rose-300' : 'bg-rose-50 text-rose-700'
            }`}
          >
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>

      {sublabel && (
        <p className={`mt-1.5 text-xs ${isDark ? 'text-white/70' : 'text-slate-500'}`}>
          {sublabel}
        </p>
      )}
    </div>
  );
};
