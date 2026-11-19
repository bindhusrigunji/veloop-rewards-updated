import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, User, ArrowRight, Gift, CheckCircle2, Share2 } from 'lucide-react';

interface RegisterPageProps {
  onNavigate: (page: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('ref') || '').toUpperCase();
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      await register(name, email, password, referralCode.trim() || undefined);
      onNavigate('wallet');
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed. Email might already exist.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-[#800020] p-8 text-center text-white relative">
          <div className="w-14 h-14 rounded-2xl bg-white/10 mx-auto flex items-center justify-center mb-3 shadow-lg border border-white/20">
            <Gift className="w-7 h-7 text-[#F4C542]" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Create Your Account</h2>
          <p className="text-xs text-amber-200 mt-1">
            Get instant +1,000 VEs, 10 Gems & 2 Lucky Spins!
          </p>
        </div>

        {/* Form Body */}
        <div className="p-8 space-y-6 bg-[#FFF9F0]">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs text-center font-medium">
              {errorMsg}
            </div>
          )}

          {/* Welcome Bonus Callout */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-amber-950">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Welcome Starter Package Included:
            </span>
            <div className="flex flex-wrap gap-2 text-[11px] pt-1">
              <span className="px-2 py-0.5 rounded bg-white font-bold text-[#800020] border border-amber-200">
                +1,000 VEs
              </span>
              <span className="px-2 py-0.5 rounded bg-white font-bold text-purple-700 border border-amber-200">
                +10 Gems
              </span>
              <span className="px-2 py-0.5 rounded bg-white font-bold text-amber-800 border border-amber-200">
                +50 Tokens
              </span>
              <span className="px-2 py-0.5 rounded bg-white font-bold text-slate-900 border border-amber-200">
                +2 Spins
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Morgan"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#800020] text-xs font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#800020] text-xs font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Password (min 6 characters)</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#800020] text-xs font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Referral Code <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              <div className="relative">
                <Share2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="e.g. VEL-DEMO01"
                  maxLength={32}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#800020] text-xs font-mono uppercase"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-[#800020] hover:bg-[#9a0027] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating Account & Provisioning Wallet...</span>
                </>
              ) : (
                <>
                  <span>Claim Rewards & Register</span>
                  <ArrowRight className="w-4 h-4 text-[#F4C542]" />
                </>
              )}
            </button>
          </form>

          {/* Login Link */}
          <div className="text-center text-xs text-slate-600 pt-2 border-t border-slate-200">
            Already registered?{' '}
            <button
              onClick={() => onNavigate('login')}
              className="font-bold text-[#172554] hover:underline cursor-pointer"
            >
              Sign in to your account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
