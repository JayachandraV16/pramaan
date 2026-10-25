import React from 'react';

export type BadgeVariant = 
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'secondary';

interface BadgeProps {
  children?: React.ReactNode;
  variant?: BadgeVariant;
  status?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant,
  status,
  size = 'md',
  className = '',
}) => {
  // Infer variant from status string if not explicitly supplied
  let computedVariant: BadgeVariant = variant || 'default';

  if (!variant && status) {
    const s = status.toUpperCase();
    if (['ACTIVE', 'PASS', 'VALID', 'COMPLETED', 'ACCEPTED'].includes(s)) {
      computedVariant = 'success';
    } else if (['SCHEDULED', 'UNDER_REVIEW', 'ASSIGNED', 'SUBMITTED', 'PENDING'].includes(s)) {
      computedVariant = 'warning';
    } else if (['REJECTED', 'CANCELLED', 'FAIL', 'INVALID', 'EXPIRED', 'REVOKED', 'DECOMMISSIONED', 'SUSPENDED'].includes(s)) {
      computedVariant = 'danger';
    } else if (['IN_PROGRESS', 'REGISTERED', 'DRAFT'].includes(s)) {
      computedVariant = 'info';
    } else if (['GATC', 'LMO'].includes(s)) {
      computedVariant = 'purple';
    }
  }

  const variantStyles: Record<BadgeVariant, string> = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium',
    warning: 'bg-amber-50 text-amber-800 border-amber-200 font-medium',
    danger: 'bg-rose-50 text-rose-700 border-rose-200 font-medium',
    info: 'bg-sky-50 text-sky-700 border-sky-200 font-medium',
    purple: 'bg-indigo-50 text-indigo-700 border-indigo-200 font-medium',
    secondary: 'bg-slate-200 text-slate-800 border-slate-300',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-1.5 py-0.5',
    md: 'text-xs px-2.5 py-0.5',
    lg: 'text-sm px-3 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${sizeStyles[size]} ${variantStyles[computedVariant]} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75"></span>
      {children || status}
    </span>
  );
};
