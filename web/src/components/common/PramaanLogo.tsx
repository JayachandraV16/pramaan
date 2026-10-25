import React from 'react';

interface PramaanLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  theme?: 'dark' | 'light';
  showSubtitle?: boolean;
}

export const PramaanLogo: React.FC<PramaanLogoProps> = ({
  className = '',
  size = 'md',
  theme = 'light',
  showSubtitle = true,
}) => {
  const isDark = theme === 'dark';

  const sizeStyles = {
    sm: { title: 'text-base', sub: 'text-[10px]' },
    md: { title: 'text-xl', sub: 'text-[11px]' },
    lg: { title: 'text-2xl', sub: 'text-xs' },
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className={`font-extrabold tracking-tight ${sizeStyles[size].title} ${isDark ? 'text-white' : 'text-[#1a1a2e]'}`}>
            PRAMAAN
          </span>
          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#FFAA17] text-[#1a1a2e]">
            CLMS
          </span>
        </div>
        {showSubtitle && (
          <span className={`${sizeStyles[size].sub} font-medium tracking-wide ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Legal Metrology Portal
          </span>
        )}
      </div>
    </div>
  );
};
