import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, WalletSummary, WalletTransaction } from '../services/api';
import { 
  Coins, 
  Sparkles, 
  Gem, 
  CircleDollarSign, 
  Dices, 
  ArrowUpRight, 
  Gift, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  ArrowDownLeft,
  RefreshCw,
  AlertCircle,
  Database,
  ChevronRight,
  Share2,
  Copy,
  Send
} from 'lucide-react';
import type { UserReferralDashboardResponse } from '../services/api';

interface WalletDashboardPageProps {
  onNavigate: (page: string) => void;
}

export const WalletDashboardPage: React.FC<WalletDashboardPageProps> = ({ onNavigate }) => {
  const { user, wallet, refreshWallet, claimDailyReward, setIsWheelModalOpen, dbStatus } = useAuth();
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<WalletTransaction[]>([]);
  const [referralData, setReferralData] = useState<UserReferralDashboardResponse | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFeedback, setInviteFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);
  const [claimFeedback, setClaimFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [sumRes, txRes, refRes] = await Promise.all([
        api.getWalletSummary(),
        api.getTransactions({ limit: 6 }),
        api.getMyReferrals().catch(() => null)
      ]);
      if (sumRes.success) setSummary(sumRes.summary);
      if (txRes.success) setRecentTransactions(txRes.data);
      if (refRes?.success) setReferralData(refRes);
    } catch (err: any) {
      console.log('Error loading dashboard data:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [wallet?.ves, wallet?.spins]);

  const handleClaimDaily = async () => {
    setIsClaiming(true);
    setClaimFeedback(null);
    try {
      const result = await claimDailyReward();
      setClaimFeedback({
        type: 'success',
        message: result.message || 'Daily reward claimed! +250 VEs and +1 Spin added.'
      });
      await loadDashboardData();
    } catch (err: any) {
      setClaimFeedback({
        type: 'error',
        message: err.message || 'Daily reward already claimed today.'
      });
    } finally {
      setIsClaiming(false);
    }
  };

  const handleCopyReferralCode = async () => {
    const code = referralData?.referralCode || user?.referralCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // ignore clipboard errors in restricted iframes
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setIsSendingInvite(true);
    setInviteFeedback(null);
    try {
      const res = await api.sendReferralInvite(inviteEmail.trim());
      setInviteFeedback({ type: 'success', message: res.message });
      setInviteEmail('');
      await loadDashboardData();
    } catch (err: any) {
      setInviteFeedback({ type: 'error', message: err.message || 'Could not record referral invite' });
    } finally {
      setIsSendingInvite(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome & Quick Action Header */}
      <div className="bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#800020] rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(circle,_#F4C542_10%,_transparent_70%)] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-900/80 text-[#F4C542] border border-blue-700/50">
                User ID: {user?.userId || 'N/A'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Ledger Synced
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, <span className="text-[#FFF9F0]">{user?.name}</span>!
            </h1>
            <p className="text-sm text-blue-200 mt-1 max-w-xl">
              Track your reward currencies, claim daily bonuses, spin the fortune wheel, and redeem your VEs for cash vouchers.
            </p>
          </div>

          {/* Quick Actions in Hero */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleClaimDaily}
              disabled={isClaiming}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#F4C542] to-amber-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm shadow-md transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
            >
              <Gift className="w-4 h-4" />
              <span>{isClaiming ? 'Claiming...' : 'Claim Daily (+250 VEs)'}</span>
            </button>

            <button
              onClick={() => setIsWheelModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-900/80 hover:bg-blue-800 text-white font-medium text-sm border border-blue-700/60 shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Dices className="w-4 h-4 text-[#F4C542]" />
              <span>Fortune Wheel</span>
            </button>

            <button
              onClick={() => onNavigate('payout')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#800020] hover:bg-[#9a0027] text-white font-semibold text-sm shadow-md transition-all hover:scale-[1.02] cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4 text-[#F4C542]" />
              <span>Redeem Payout</span>
            </button>
          </div>
        </div>

        {/* Claim Feedback Banner */}
        {claimFeedback && (
          <div className={`mt-4 p-3 rounded-xl text-xs flex items-center justify-between border ${
            claimFeedback.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
              : 'bg-amber-950/80 border-amber-500/50 text-amber-200'
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#F4C542] flex-shrink-0" />
              <span>{claimFeedback.message}</span>
            </div>
            <button
              onClick={() => setClaimFeedback(null)}
              className="text-xs opacity-70 hover:opacity-100 font-bold ml-2 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Atlas Whitelist Notice (if running on fallback embedded engine) */}
      {dbStatus?.mode === 'embedded' && dbStatus.whitelistNotice && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 shadow-xs">
          <Database className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <h4 className="font-bold text-amber-900 mb-0.5">MongoDB Atlas Whitelist Notice</h4>
            <p className="text-amber-800 leading-relaxed">{dbStatus.whitelistNotice}</p>
            {user?.role === 'admin' && (
              <button
                onClick={() => onNavigate('admin')}
                className="mt-2 text-xs font-semibold text-[#800020] hover:underline flex items-center gap-1 cursor-pointer"
              >
                Go to Admin Portal to view DB diagnostic & reconnect →
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5 Reward Currency Balance Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#172554] flex items-center gap-2">
            <Coins className="w-5 h-5 text-[#800020]" />
            <span>Reward Currencies</span>
          </h2>
          <button
            onClick={() => {
              refreshWallet();
              loadDashboardData();
            }}
            className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 font-medium cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 1. VEs (Primary Spendable) */}
          <div className="bg-white rounded-2xl p-5 border-2 border-[#800020]/20 shadow-md relative overflow-hidden group hover:border-[#800020] transition-all">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#800020]/5 rounded-bl-3xl pointer-events-none" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#800020] uppercase tracking-wider">Spendable</span>
              <div className="w-8 h-8 rounded-lg bg-[#800020]/10 flex items-center justify-center text-[#800020]">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[#172554] tracking-tight">
              {wallet?.ves?.toLocaleString() ?? 0}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-1">VEs Balance</div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => onNavigate('payout')}
                className="text-xs font-bold text-[#800020] hover:text-red-800 flex items-center gap-1 cursor-pointer"
              >
                <span>Redeem</span>
                <ChevronRight className="w-3 h-3" />
              </button>
              <span className="text-[10px] text-slate-400">100 VEs = $1.00</span>
            </div>
          </div>

          {/* 2. SVEs (Staked VEs) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-[#4169E1] transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Staked</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#4169E1]">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[#172554] tracking-tight">
              {wallet?.sves?.toLocaleString() ?? 0}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-1">SVEs (Yield)</div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-emerald-600 font-semibold">+8.5% APY</span>
              <span className="text-[10px] text-slate-400">Locked Vault</span>
            </div>
          </div>

          {/* 3. Gems */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-purple-400 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Prestige</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                <Gem className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[#172554] tracking-tight">
              {wallet?.gems?.toLocaleString() ?? 0}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-1">Gems</div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-purple-600 font-medium">VIP Tier Multiplier</span>
              <span className="text-[10px] text-slate-400">1.25x</span>
            </div>
          </div>

          {/* 4. Tokens */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-amber-400 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Utility</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <CircleDollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[#172554] tracking-tight">
              {wallet?.tokens?.toLocaleString() ?? 0}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-1">Tokens</div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Platform Credits</span>
              <span className="text-[10px] text-amber-700 font-medium">Active</span>
            </div>
          </div>

          {/* 5. Spins */}
          <div className="bg-white rounded-2xl p-5 border-2 border-amber-300/80 shadow-md relative overflow-hidden group hover:border-[#F4C542] transition-all bg-gradient-to-br from-white to-amber-50/40">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Mini-Game</span>
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
                <Dices className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[#172554] tracking-tight">
              {wallet?.spins ?? 0}
            </div>
            <div className="text-xs text-slate-500 font-medium mt-1">Spins Available</div>
            <div className="mt-3 pt-3 border-t border-amber-200/60 flex items-center justify-between">
              <button
                onClick={() => setIsWheelModalOpen(true)}
                className="text-xs font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
              >
                <span>Spin Now</span>
                <ChevronRight className="w-3 h-3" />
              </button>
              <span className="text-[10px] text-amber-600 font-semibold">Win Up to 1k</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ledger Metrics & Wallet Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Total Earned (Lifetime)</span>
            <div className="text-xl font-extrabold text-[#172554] mt-0.5">
              {summary ? summary.totalEarnedVes.toLocaleString() : wallet?.ves.toLocaleString()} <span className="text-xs font-normal text-slate-400">VEs</span>
            </div>
            <span className="text-[11px] text-emerald-600 font-medium">Recorded via verified credits</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#4169E1] flex items-center justify-center flex-shrink-0">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Total Withdrawn</span>
            <div className="text-xl font-extrabold text-[#172554] mt-0.5">
              {summary ? summary.totalWithdrawnVes.toLocaleString() : 0} <span className="text-xs font-normal text-slate-400">VEs</span>
            </div>
            <span className="text-[11px] text-blue-600 font-medium">Approved in sandbox (simulated)</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Pending Withdrawals</span>
            <div className="text-xl font-extrabold text-[#172554] mt-0.5">
              {summary ? summary.pendingWithdrawals.currencyAmount.toLocaleString() : 0} <span className="text-xs font-normal text-slate-400">VEs</span>
            </div>
            <span className="text-[11px] text-amber-700 font-medium">
              {summary?.pendingWithdrawals.count || 0} active request(s) awaiting review
            </span>
          </div>
        </div>
      </div>

      {/* Referral Tracking Card */}
      {referralData && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-[#172554] text-base flex items-center gap-2">
                <Share2 className="w-4 h-4 text-[#800020]" />
                <span>Referral Attribution & Invites</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold uppercase">
                  {referralData.rewardRuleStatus}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">{referralData.rewardRuleNotice}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 font-mono text-xs font-bold text-[#172554]">
                {referralData.referralCode}
              </div>
              <button
                onClick={handleCopyReferralCode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#172554] hover:bg-blue-900 text-white text-xs font-bold cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-[#F4C542]" />
                <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <div className="grid grid-cols-3 gap-2 md:col-span-2 text-xs text-center">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-lg font-black text-[#172554]">{referralData.summary.totalInvites}</div>
                <div className="text-[10px] text-slate-500 font-semibold">Total Invites</div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-lg font-black text-emerald-700">{referralData.summary.registeredCount}</div>
                <div className="text-[10px] text-emerald-800 font-semibold">Registered</div>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-lg font-black text-[#172554]">{referralData.summary.conversionRatePct}%</div>
                <div className="text-[10px] text-blue-800 font-semibold">Conversion</div>
              </div>
            </div>

            <form onSubmit={handleSendInvite} className="md:col-span-2 flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="friend@example.com"
                required
                className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-[#800020]"
              />
              <button
                type="submit"
                disabled={isSendingInvite}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#800020] hover:bg-[#9a0027] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-[#F4C542]" />
                <span>{isSendingInvite ? 'Sending...' : 'Record Invite'}</span>
              </button>
            </form>
          </div>

          {inviteFeedback && (
            <div
              className={`p-2.5 rounded-xl text-xs border ${
                inviteFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {inviteFeedback.message}
            </div>
          )}
        </div>
      )}

      {/* Recent Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-[#172554] text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-700" />
              <span>Recent Ledger Transactions</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Double-entry audit snapshots recorded for every balance change
            </p>
          </div>
          <button
            onClick={() => onNavigate('transactions')}
            className="text-xs font-bold text-[#4169E1] hover:text-blue-800 flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No transactions found yet. Claim your daily bonus to record your first ledger entry!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3 px-6">Transaction ID / Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Currency</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-6">Balance Snapshot</th>
                  <th className="py-3 px-6">Description / Source</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {recentTransactions.map((tx) => (
                  <tr key={tx.transactionId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-6">
                      <div className="font-mono text-[11px] font-semibold text-slate-900">{tx.transactionId}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(tx.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        tx.type === 'CREDIT'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 uppercase font-bold text-slate-800">
                      {tx.currency}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`font-bold ${tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {tx.type === 'CREDIT' ? '+' : '-'}{tx.amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 font-mono text-[11px] text-slate-500">
                      <span>{tx.balanceBefore.toLocaleString()}</span>
                      <span className="text-slate-400 mx-1">→</span>
                      <span className="font-semibold text-slate-800">{tx.balanceAfter.toLocaleString()}</span>
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="text-slate-900 font-medium">{tx.description || tx.source}</div>
                      <div className="text-[10px] text-slate-400">{tx.source}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        tx.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : tx.status === 'REVERSED'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
