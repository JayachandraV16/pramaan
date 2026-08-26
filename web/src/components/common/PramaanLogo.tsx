import React from 'react';
import emblemImg from '@/emaap_extracted_resources/static/media/logon1.5dbace7d080abd5e3d46.png';

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
    sm: { img: 'h-8', title: 'text-base', sub: 'text-[10px]' },
    md: { img: 'h-11', title: 'text-xl', sub: 'text-[11px]' },
    lg: { img: 'h-14', title: 'text-2xl', sub: 'text-xs' },
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Official Emblem Logo */}
      <img
        src={emblemImg}
        alt="Government of India Emblem"
        className={`${sizeStyles[size].img} w-auto object-contain shrink-0`}
      />

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
