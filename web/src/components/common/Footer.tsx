import React from 'react';
import { Link } from 'react-router-dom';
import nicLogo from '@/emaap_extracted_resources/assets/footer/NIC.png';
import emblemImg from '@/emaap_extracted_resources/static/media/logon1.5dbace7d080abd5e3d46.png';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full text-white">
      {/* 1. PARTNER GOV LOGO STRIP (Matching Screenshot 11) */}
      <div className="bg-[#F8F9FB] border-t border-b border-slate-200 py-4 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center sm:justify-between gap-6 opacity-80 grayscale hover:grayscale-0 transition-all">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-[#004B87] tracking-tight">Digital India</span>
            <span className="text-[10px] text-slate-500 font-semibold">Power to Empower</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded border border-slate-400 flex items-center justify-center font-bold text-xs text-slate-800">
              BIS
            </div>
            <span className="text-xs font-bold text-slate-700">मानक: पथप्रदर्शक:</span>
          </div>

          <div className="flex items-center gap-2">
            <img src={emblemImg} alt="Dept of Consumer Affairs" className="h-7 w-auto object-contain" />
            <span className="text-[11px] font-bold text-slate-700">Consumer Affairs</span>
          </div>

          <div className="flex items-center gap-1.5 text-center">
            <div className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded font-black text-[10px]">
              JAGO GRAHAK JAGO
            </div>
          </div>

          <div className="flex items-center gap-2">
            <img src={emblemImg} alt="Emblem" className="h-6 w-auto object-contain" />
            <span className="text-[10px] font-bold text-slate-600">Legal Metrology</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-800">
              NCH
            </div>
            <span className="text-[10px] font-semibold text-slate-600">National Consumer Helpline</span>
          </div>
        </div>
      </div>

      {/* 2. MAIN DEEP BLUE FOOTER (Matching Screenshot 11: bg-[#004B87]) */}
      <div className="bg-[#004B87] py-10 px-4 sm:px-6 lg:px-8 text-center space-y-6">
        {/* Centered NIC Logo */}
        <div className="flex justify-center">
          <img src={nicLogo} alt="National Informatics Centre" className="h-10 w-auto object-contain brightness-150" />
        </div>

        {/* Footer Navigation Links */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm font-semibold text-white/90">
          <Link to="/about" className="hover:text-[#FFAA17] transition-colors">
            About Us
          </Link>
          <Link to="/enforcement" className="hover:text-[#FFAA17] transition-colors">
            Enforcement Activities
          </Link>
          <Link to="/judgements" className="hover:text-[#FFAA17] transition-colors">
            Judgements
          </Link>
          <Link to="/act-rules" className="hover:text-[#FFAA17] transition-colors">
            Legal Metrology Acts
          </Link>
          <Link to="/reports" className="hover:text-[#FFAA17] transition-colors">
            Reports
          </Link>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-[#FFAA17] text-[#FFAA17] hover:bg-[#FFAA17] hover:text-[#004B87] transition-colors text-xs font-bold"
          >
            <span>🗺️</span> Site Map
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 hover:text-[#FFAA17] transition-colors text-xs"
          >
            <span>✈</span> Feedback
          </button>
        </div>

        {/* Social Media & Suggestions */}
        <div className="space-y-2 pt-2">
          <p className="text-xs text-white/80">Have suggestions?</p>
          <div className="flex items-center justify-center gap-4 text-white">
            <span className="w-8 h-8 rounded-full border border-white/40 flex items-center justify-center text-xs hover:border-[#FFAA17] hover:text-[#FFAA17] cursor-pointer">
              🌐
            </span>
            <span className="w-8 h-8 rounded-full border border-white/40 flex items-center justify-center text-xs font-bold hover:border-[#FFAA17] hover:text-[#FFAA17] cursor-pointer">
              f
            </span>
            <span className="w-8 h-8 rounded-full border border-white/40 flex items-center justify-center text-xs font-bold hover:border-[#FFAA17] hover:text-[#FFAA17] cursor-pointer">
              in
            </span>
            <span className="w-8 h-8 rounded-full border border-white/40 flex items-center justify-center text-xs hover:border-[#FFAA17] hover:text-[#FFAA17] cursor-pointer">
              📸
            </span>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM BAR (Matching Screenshot 11: bg-[#003866]) */}
      <div className="bg-[#003866] py-3.5 px-4 sm:px-6 lg:px-8 text-[11px] text-white/80 border-t border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left">
          <p>
            Copyright © 2026 pramaan. All rights reserved | Site designed, developed, and maintained by{' '}
            <strong className="text-white underline">National Informatics Centre</strong>, Ministry of Electronics & IT, Govt. of India.
          </p>
          <p className="shrink-0 text-white/70 font-mono text-[10px]">
            Last Updated: {new Date().toLocaleDateString('en-GB')} 04:30:00 pm
          </p>
        </div>
      </div>
    </footer>
  );
};
