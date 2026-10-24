import React from 'react';
import { Link } from 'react-router-dom';

/** Site footer. Only links to pages that exist; no third-party logos. */
export const Footer: React.FC = () => (
  <footer className="w-full bg-[#1a3a5c] text-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid gap-6 sm:grid-cols-3">
      <div>
        <p className="text-lg font-extrabold tracking-tight">Pramaan</p>
        <p className="mt-1 text-xs text-white/75 leading-relaxed">
          Online verification and digital certification of weighing and measuring instruments under the Legal Metrology Act, 2009.
        </p>
      </div>
      <nav aria-label="Footer" className="text-sm space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-wider text-[#FFAA17]">Quick links</p>
        <Link to="/verify-public" className="block text-white/90 hover:text-[#FFAA17]">Verify a certificate</Link>
        <Link to="/login" className="block text-white/90 hover:text-[#FFAA17]">Sign in</Link>
        <Link to="/register" className="block text-white/90 hover:text-[#FFAA17]">Register</Link>
      </nav>
      <div className="text-xs text-white/75 space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-wider text-[#FFAA17]">About this system</p>
        <p>Prototype built by team Fulcrum for Smart India Hackathon, problem statement 26036.</p>
        <p>Certificates carry a SHA-256 fingerprint and a signed QR link, so any alteration can be detected.</p>
      </div>
    </div>
    <div className="border-t border-white/15 py-3 text-center text-[11px] text-white/60">
      © {new Date().getFullYear()} Team Fulcrum · Pramaan prototype
    </div>
  </footer>
);
