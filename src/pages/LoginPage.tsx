import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Coins, Lock, Mail, ArrowRight, ShieldCheck, User } from 'lucide-react';

interface LoginPageProps {
  onNavigate: (page: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login, quickLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      await login(email, password);
      onNavigate('wallet');
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuick = async (role: 'user' | 'admin') => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await quickLogin(role);
      onNavigate(role === 'admin' ? 'admin' : 'wallet');
    } catch (err: any) {
      setErrorMsg(err.message || 'Quick login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-[#172554] p-8 text-center text-white relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#800020] to-[#4169E1] mx-auto flex items-center justify-center mb-3 shadow-lg border border-white/20">
            <Coins className="w-7 h-7 text-[#F4C542]" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Sign In to VELoop</h2>
          <p className="text-xs text-blue-200 mt-1">
            Access your rewards wallet, vouchers & transactions
          </p>
        </div>

        {/* Form Container */}
        <div className="p-8 space-y-6 bg-[#FFF9F0]">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs text-center font-medium">
              {errorMsg}
            </div>
          )}

          {/* Quick Demo Login Helpers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <span>1-Click Demo Login</span>
              <span className="text-emerald-700 font-semibold lowercase">instant test</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuick('user')}
                disabled={isLoading}
                className="p-2.5 rounded-xl bg-white border border-slate-300 hover:border-[#172554] hover:bg-blue-50/50 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Demo User</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuick('admin')}
                disabled={isLoading}
                className="p-2.5 rounded-xl bg-white border border-slate-300 hover:border-[#800020] hover:bg-rose-50/50 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#800020]" />
                <span>Demo Admin</span>
              </button>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-[#FFF9F0] px-3 text-[11px] text-slate-400 font-medium">or email credentials</span>
          </div>

          {/* Standard Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="demo@veloop.test"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#172554] text-xs font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#172554] text-xs font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-[#172554] hover:bg-blue-900 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4 text-[#F4C542]" />
                </>
              )}
            </button>
          </form>

          {/* Register Link */}
          <div className="text-center text-xs text-slate-600 pt-2 border-t border-slate-200">
            Don't have an account?{' '}
            <button
              onClick={() => onNavigate('register')}
              className="font-bold text-[#800020] hover:underline cursor-pointer"
            >
              Register here (+1,000 VEs bonus)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
