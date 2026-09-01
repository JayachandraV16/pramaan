import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RoleName } from '../types';
import { Button } from '../components/common/Button';
import { ErrorMessage } from '../components/common/ErrorMessage';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [role, setRole] = useState<RoleName>('INSTRUMENT_OWNER');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const demoAccounts: Array<{ role: RoleName; label: string; email: string }> = [
    { role: 'INSTRUMENT_OWNER', label: 'Instrument Owner', email: 'dev.owner@pramaan.local' },
    { role: 'LMO', label: 'Legal Metrology Officer', email: 'dev.lmo@pramaan.local' },
    { role: 'GATC', label: 'GATC / RRSL Lab', email: 'dev.gatc@pramaan.local' },
    { role: 'ADMIN', label: 'Directorate Admin', email: 'dev.admin@pramaan.local' },
  ];

  const handleQuickSelect = (acc: typeof demoAccounts[0]) => {
    setRole(acc.role);
    setIdentifier(acc.email);
    setPassword('DevPassword123!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter your email or phone number.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await login({
        email: identifier,
        password,
        role,
      });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900">Sign In</h2>
        </div>

        {/* Demo Fast Switcher */}
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3">
          <div className="grid grid-cols-2 gap-1.5">
            {demoAccounts.map((acc) => (
              <button
                key={acc.role}
                type="button"
                onClick={() => handleQuickSelect(acc)}
                className={`text-left py-2 px-2.5 rounded-lg border text-xs transition-all ${
                  role === acc.role
                    ? 'bg-white border-amber-500 font-semibold text-amber-900 shadow-xs'
                    : 'bg-amber-100/50 border-amber-200/60 text-amber-900 hover:bg-white'
                }`}
              >
                <div className="font-medium truncate">{acc.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Login Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-gov">
          {error && <ErrorMessage message={error} className="mb-4" />}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Select */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Account Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as RoleName)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800 focus:bg-white"
              >
                <option value="INSTRUMENT_OWNER">Instrument Owner</option>
                <option value="LMO">Legal Metrology Officer (LMO)</option>
                <option value="GATC">GATC Testing Centre / RRSL Lab</option>
                <option value="ADMIN">System / Directorate Administrator</option>
              </select>
            </div>

            {/* Email / Mobile */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address / Registered Mobile
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@organization.gov.in"
                required
                className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Password</label>
                <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Demo password is: Pramaan@2026'); }} className="text-[11px] text-amber-700 hover:underline">
                  Forgot?
                </a>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="w-full mt-2"
            >
              Sign In to Portal
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Don't have a registered account?{' '}
              <Link to="/register" className="font-semibold text-pramaan-gold-700 hover:underline">
                Register here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
