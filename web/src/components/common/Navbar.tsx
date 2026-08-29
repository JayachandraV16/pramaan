import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Badge } from './Badge';
import { useAuth } from '../../context/AuthContext';
import { RoleName } from '../../types';
export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout, switchRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [loginDropdownOpen, setLoginDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [actModalOpen, setActModalOpen] = useState(false);

  useEffect(() => {
    if (location.pathname === '/' && location.hash) {
      const id = location.hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [location]);

  const handleNavClick = (anchorId?: string) => {
    setMobileMenuOpen(false);
    if (!anchorId) {
      if (location.pathname === '/') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate('/');
      }
      return;
    }

    if (location.pathname === '/') {
      const el = document.getElementById(anchorId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      navigate(`/#${anchorId}`);
    }
  };

  const navMenuItems = [
    { label: 'Home', anchorId: '' },
    { label: 'About Us', anchorId: 'overview' },
    { label: 'Act & Rules', anchorId: 'rules', action: () => setActModalOpen(true) },
    { label: 'Enforcement Activity', anchorId: 'empower' },
  ];

  const rolesList: Array<{ id: RoleName; label: string; desc: string }> = [
    { id: 'INSTRUMENT_OWNER', label: 'Instrument Owner', desc: 'Traders, Mandi vendors & scale owners' },
    { id: 'LMO', label: 'Legal Metrology Officer', desc: 'Field inspection & verification officer' },
    { id: 'GATC', label: 'GATC / RRSL Lab', desc: 'Govt Approved Test Centre testing lab' },
    { id: 'ADMIN', label: 'System Admin', desc: 'Ministry & Metrology Directorate' },
    { id: 'PUBLIC_USER', label: 'Public Citizen', desc: 'General consumer / citizen' },
  ];

  const handleRoleSelect = async (role: RoleName) => {
    await switchRole(role);
    setRoleDropdownOpen(false);
    navigate('/dashboard');
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#E0E0E0] shadow-xs">
      {/* Top Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between border-b border-slate-100">
        {/* Left: Pramaan Logo */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => handleNavClick()}
            className="flex items-center gap-3 select-none text-left"
          >
            <div className="flex items-center gap-1.5">
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tight text-[#1a1a2e] leading-none">
                  pram<span className="text-[#FFAA17]">aa</span>n
                </span>
                <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                  Legal Metrology Portal
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Right: Accessibility + Language + Quick Actions */}
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => handleNavClick('hero')}
            className="hidden md:inline-flex px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium rounded-md transition-colors"
          >
            Skip to Main Content
          </button>

          <div className="w-6 h-6 rounded-full bg-[#1a1a2e] text-white flex items-center justify-center text-[10px] font-bold">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a2 2 0 100 4 2 2 0 000-4zm-8 7a1 1 0 011-1h14a1 1 0 110 2h-5v12a1 1 0 11-2 0V15h-2v7a1 1 0 11-2 0V10H5a1 1 0 01-1-1z" />
            </svg>
          </div>

          <span className="text-slate-300 hidden sm:inline">|</span>

          <select className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer py-1">
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
          </select>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Main Nav Links (Matching Screenshots 1 & navbar.json) */}
          <nav className="hidden lg:flex items-center space-x-6">
            {navMenuItems.map((item) => {
              const isHome = item.label === 'Home' && location.pathname === '/' && !location.hash;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    if (item.action) {
                      item.action();
                    } else {
                      handleNavClick(item.anchorId);
                    }
                  }}
                  className={`text-sm font-semibold transition-colors relative py-4 ${
                    isHome
                      ? 'text-[#FFAA17] font-bold'
                      : 'text-[#1a1a2e] hover:text-[#FFAA17]'
                  }`}
                >
                  {item.label}
                  {isHome && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFAA17]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Area: Citizen Portal & Login / User Dropdown */}
          <div className="flex items-center gap-3">
            <Link
              to="/verify-public"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#FFAA17] text-[#1a1a2e] shadow-xs hover:bg-[#f8aa24] uppercase tracking-wider"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Verify documents
            </Link>

            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-[#1a1a2e]"
                >
                  <div className="w-6 h-6 rounded-full bg-[#1a1a2e] text-[#FFAA17] flex items-center justify-center text-xs">
                    {user.full_name.charAt(0)}
                  </div>
                  <span>{user.full_name.split(' ')[0]}</span>
                  <Badge status={user.role_id} size="sm" />
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {roleDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setRoleDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in duration-150 space-y-1">
                      <div className="px-3 py-2 border-b border-slate-100 mb-1">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Portal Services</p>
                        <p className="text-xs font-bold text-slate-900">{user.full_name}</p>
                      </div>

                      {/* Portal Links */}
                      <Link
                        to="/dashboard"
                        onClick={() => setRoleDropdownOpen(false)}
                        className="block px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#1a1a2e]"
                      >
                        📊 My Dashboard
                      </Link>
                      {(user.role_id === 'INSTRUMENT_OWNER' || user.role_id === 'ADMIN') && (
                        <Link
                          to="/instruments"
                          onClick={() => setRoleDropdownOpen(false)}
                          className="block px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#1a1a2e]"
                        >
                          ⚖️ Weighing Instruments
                        </Link>
                      )}
                      {(user.role_id === 'INSTRUMENT_OWNER' || user.role_id === 'GATC' || user.role_id === 'ADMIN') && (
                        <Link
                          to="/applications"
                          onClick={() => setRoleDropdownOpen(false)}
                          className="block px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#1a1a2e]"
                        >
                          📝 Verification Applications
                        </Link>
                      )}
                      {(user.role_id === 'LMO' || user.role_id === 'GATC' || user.role_id === 'ADMIN') && (
                        <Link
                          to="/verifications"
                          onClick={() => setRoleDropdownOpen(false)}
                          className="block px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#1a1a2e]"
                        >
                          🔍 Field Verifications
                        </Link>
                      )}
                      {user.role_id === 'ADMIN' && (
                        <Link
                          to="/certificates"
                          onClick={() => setRoleDropdownOpen(false)}
                          className="block px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#1a1a2e]"
                        >
                          📜 Digital Certificates
                        </Link>
                      )}

                      <div className="pt-2 mt-1 border-t border-slate-100">
                        <p className="px-3 py-1 text-[10px] font-bold uppercase text-slate-400">Switch Demo Role</p>
                        <div className="space-y-0.5">
                          {rolesList.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => handleRoleSelect(r.id)}
                              className={`w-full text-left px-3 py-1.5 rounded-md text-xs flex items-center justify-between ${
                                user.role_id === r.id
                                  ? 'bg-amber-50 text-amber-900 font-bold'
                                  : 'hover:bg-slate-50 text-slate-600'
                              }`}
                            >
                              <span>{r.label}</span>
                              {user.role_id === r.id && <span className="text-emerald-600">✓</span>}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 mt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={async () => {
                            await logout();
                            setRoleDropdownOpen(false);
                            navigate('/');
                          }}
                          className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="relative">
                {/* LOGIN button matching Screenshot 1 */}
                <button
                  type="button"
                  onClick={() => setLoginDropdownOpen(!loginDropdownOpen)}
                  className="px-6 py-2 rounded-md border-2 border-[#1a1a2e] text-xs font-bold uppercase tracking-wider text-[#1a1a2e] hover:bg-[#1a1a2e] hover:text-white transition-all flex items-center gap-1.5"
                >
                  <span>LOGIN</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {loginDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setLoginDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in duration-150 space-y-1">
                      <Link
                        to="/login"
                        onClick={() => setLoginDropdownOpen(false)}
                        className="block px-3 py-2 rounded-lg text-xs font-bold text-[#1a1a2e] hover:bg-slate-100"
                      >
                        Officer / Applicant Sign In
                      </Link>
                      <Link
                        to="/register"
                        onClick={() => setLoginDropdownOpen(false)}
                        className="block px-3 py-2 rounded-lg text-xs font-bold text-amber-700 hover:bg-amber-50"
                      >
                        Register New Account
                      </Link>
                      <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 px-3">
                        Switch demo roles easily once signed in.
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2">
          {navMenuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                if (item.action) {
                  setMobileMenuOpen(false);
                  item.action();
                } else {
                  handleNavClick(item.anchorId);
                }
              }}
              className="block w-full text-left px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {item.label}
            </button>
          ))}
          {isAuthenticated && user && (
            <div className="pt-2 border-t border-slate-200 space-y-1">
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-1.5 text-xs font-semibold text-slate-800"
              >
                📊 Dashboard
              </Link>
              {(user.role_id === 'INSTRUMENT_OWNER' || user.role_id === 'ADMIN') && (
                <Link
                  to="/instruments"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-1.5 text-xs font-semibold text-slate-800"
                >
                  ⚖️ Instruments
                </Link>
              )}
              {(user.role_id === 'INSTRUMENT_OWNER' || user.role_id === 'GATC' || user.role_id === 'ADMIN') && (
                <Link
                  to="/applications"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-1.5 text-xs font-semibold text-slate-800"
                >
                  📝 Applications
                </Link>
              )}
              {(user.role_id === 'LMO' || user.role_id === 'GATC' || user.role_id === 'ADMIN') && (
                <Link
                  to="/verifications"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-1.5 text-xs font-semibold text-slate-800"
                >
                  🔍 Field Verifications
                </Link>
              )}
              {user.role_id === 'ADMIN' && (
                <Link
                  to="/certificates"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-1.5 text-xs font-semibold text-slate-800"
                >
                  📜 Digital Certificates
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Act & Rules Statutory Modal */}
      {actModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#FFAA17] tracking-wider">Statutory Framework</span>
                <h3 className="text-lg font-bold text-[#1a1a2e]">Legal Metrology Acts & Rules</h3>
              </div>
              <button
                type="button"
                onClick={() => setActModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-bold text-[#1a1a2e]">1. The Legal Metrology Act, 2009 (Act 1 of 2010)</h4>
                <p className="mt-1 text-slate-600">
                  Enforces standards of weights and measures across commercial transactions, manufacturing, and consumer retail in India. Effective from 1st April, 2011.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-bold text-[#1a1a2e]">2. Legal Metrology (General) Rules, 2011</h4>
                <p className="mt-1 text-slate-600">
                  Prescribes specifications, tolerances, verification intervals, and inspection methodologies for non-automatic weighing instruments, weighbridges, fuel dispensers, and precision laboratory balances.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-bold text-[#1a1a2e]">3. Legal Metrology (Packaged Commodities) Rules, 2011</h4>
                <p className="mt-1 text-slate-600">
                  Mandates standard pack sizes, declarations (MRP, Net Quantity, Unit Sale Price, Best Before, Consumer Care), and registration of pre-packaged goods.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setActModalOpen(false)}
                className="px-4 py-2 bg-[#1a1a2e] text-[#FFAA17] font-bold text-xs rounded-lg hover:bg-black transition-colors"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
