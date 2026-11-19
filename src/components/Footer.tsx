import React from 'react';
import { Shield, Database, Coins, Code, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Footer: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { dbStatus } = useAuth();

  return (
    <footer className="bg-[#172554] text-blue-200 text-sm border-t border-blue-900/60 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand & mission */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#800020] to-[#4169E1] flex items-center justify-center">
                <Coins className="w-4 h-4 text-[#F4C542]" />
              </div>
              <span className="font-bold text-lg text-white">VELoop Rewards</span>
              <span className="text-[10px] bg-[#800020] text-amber-200 px-1.5 py-0.5 rounded uppercase font-semibold">
                Fintech Engine
              </span>
            </div>
            <p className="text-xs text-blue-300/80 leading-relaxed max-w-md">
              Enterprise rewards wallet and multi-method payout disbursement system. Built with atomic ledger transactions, double-entry balance snapshots, and concurrency-safe withdrawal reservation.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-blue-900/80 text-blue-200 border border-blue-800">
                MongoDB & Mongoose
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-900/80 text-blue-200 border border-blue-800">
                Express.js & Node.js
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-900/80 text-blue-200 border border-blue-800">
                JWT & Bcrypt
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-900/80 text-blue-200 border border-blue-800">
                Tailwind & React 19
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Quick Navigation</h4>
            <ul className="space-y-1.5 text-xs">
              <li>
                <button onClick={() => onNavigate('wallet')} className="hover:text-white transition-colors cursor-pointer">
                  Wallet Dashboard
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('payout')} className="hover:text-white transition-colors cursor-pointer">
                  Redeem & Payouts
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('transactions')} className="hover:text-white transition-colors cursor-pointer">
                  Transaction Ledger
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('withdrawals')} className="hover:text-white transition-colors cursor-pointer">
                  Withdrawal Status
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('api-docs')} className="hover:text-white transition-colors cursor-pointer">
                  REST API Docs & Specs
                </button>
              </li>
            </ul>
          </div>

          {/* Database & Security Info */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-[#F4C542]" />
              Database Engine
            </h4>
            <div className="p-2.5 rounded-lg bg-blue-950/80 border border-blue-800/60 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-blue-300">Active Mode:</span>
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                  dbStatus?.mode === 'atlas' && dbStatus.connected
                    ? 'bg-emerald-900 text-emerald-300'
                    : 'bg-amber-900 text-amber-300'
                }`}>
                  {dbStatus?.mode === 'atlas' ? 'MongoDB Atlas' : 'Embedded MongoDB'}
                </span>
              </div>
              <div className="text-[11px] text-blue-300/80 leading-tight">
                {dbStatus?.mode === 'atlas' && dbStatus.connected
                  ? 'Connected to configured MongoDB Atlas cluster.'
                  : 'In-memory sandbox MongoDB active (non-persistent demo environment).'}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-blue-300/70 pt-1">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span>Double-entry ledger & strict JWT auth</span>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-blue-900/60 flex flex-col sm:flex-row items-center justify-between text-xs text-blue-400 gap-2">
          <p>© {new Date().getFullYear()} VELoop Rewards System. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-emerald-400">
              <Shield className="w-3.5 h-3.5" /> ISO 27001 Grade Ledger
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
