import React, { useState, useEffect, useCallback } from 'react';
import {
  api,
  AdminAnalyticsResponse,
  UserConflictAuditResponse,
  formatPayoutDetails,
  getPayoutCurrencySymbol
} from '../services/api';
import {
  BarChart3,
  Users,
  Coins,
  TrendingUp,
  ArrowUpRight,
  Share2,
  Download,
  Filter,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Database,
  ShieldAlert
} from 'lucide-react';

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const AdminAnalyticsTab: React.FC = () => {
  const [analytics, setAnalytics] = useState<AdminAnalyticsResponse | null>(null);
  const [conflicts, setConflicts] = useState<UserConflictAuditResponse | null>(null);
  const [referralsOverview, setReferralsOverview] = useState<Awaited<ReturnType<typeof api.adminGetReferrals>> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [datePreset, setDatePreset] = useState<'ALL' | '7D' | '30D' | '90D' | 'CUSTOM'>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currencyFilter, setCurrencyFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const applyDatePreset = (preset: 'ALL' | '7D' | '30D' | '90D') => {
    setDatePreset(preset);
    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
      return;
    }
    const end = new Date();
    const start = new Date(end.getTime());
    const days = preset === '7D' ? 7 : preset === '30D' ? 30 : 90;
    start.setUTCDate(end.getUTCDate() - days);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  };

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [anRes, confRes, refRes] = await Promise.all([
        api.adminGetAnalytics({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          currency: currencyFilter,
          source: sourceFilter,
          search: searchQuery.trim() || undefined
        }),
        api.adminGetUserConflicts(),
        api.adminGetReferrals().catch(() => null)
      ]);
      if (anRes.success) setAnalytics(anRes);
      if (confRes.success) setConflicts(confRes);
      if (refRes?.success) setReferralsOverview(refRes);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load analytics data.');
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, currencyFilter, sourceFilter, searchQuery]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleExportKpisCsv = () => {
    if (!analytics) return;
    const { kpis, withdrawalStats, referralPerformance, dataOrigin } = analytics;
    downloadCsv(
      `veloop_kpis_snapshot_${new Date().toISOString().slice(0, 10)}.csv`,
      ['KPI Metric', 'Value', 'Unit / Notes', 'Data Classification'],
      [
        ['Total Registered Users', kpis.totalUsers, 'users', dataOrigin.classification],
        ['Active Users', kpis.activeUsers, `${kpis.activeUserRatePct}% active rate`, dataOrigin.classification],
        ['Total VEs Earned (Credits)', kpis.totalCreditsVes, 'VEs', dataOrigin.classification],
        ['Total VEs Redeemed/Debited', kpis.totalDebitsVes, 'VEs', dataOrigin.classification],
        ['Net VEs Flow', kpis.netVesFlow, 'VEs', dataOrigin.classification],
        ['Wallet Liability - VEs', kpis.walletLiability.ves, 'VEs', dataOrigin.classification],
        ['Wallet Liability - SVEs', kpis.walletLiability.sves, 'SVEs', dataOrigin.classification],
        ['Wallet Liability - Gems', kpis.walletLiability.gems, 'Gems', dataOrigin.classification],
        ['Wallet Liability - Tokens', kpis.walletLiability.tokens, 'Tokens', dataOrigin.classification],
        ['Wallet Liability - Spins', kpis.walletLiability.spins, 'Spins', dataOrigin.classification],
        ['Withdrawals Pending', withdrawalStats.pendingCount, `${withdrawalStats.pendingVes} VEs`, dataOrigin.classification],
        ['Withdrawals Approved', withdrawalStats.approvedCount, `${withdrawalStats.approvedVes} VEs`, dataOrigin.classification],
        ['Withdrawals Rejected', withdrawalStats.rejectedCount, `${withdrawalStats.rejectedVes} VEs`, dataOrigin.classification],
        ['Withdrawal Approval Rate', kpis.withdrawalApprovalRatePct, '%', dataOrigin.classification],
        ['Payout-Eligible Users Count', kpis.payoutEligibleUsersCount, `>= ${kpis.minPayoutRequiredVes ?? 'N/A'} VEs`, dataOrigin.classification],
        ['Wallet-to-User Coverage', kpis.walletToUserCoveragePct, '%', dataOrigin.classification],
        ['Daily Reward VEs Distributed', kpis.dailyRewardVesDistributed, 'VEs', dataOrigin.classification],
        ['Admin Manual Adjustments Share', kpis.adminManualAdjustmentsSharePct, '%', dataOrigin.classification],
        ['Ledger Arithmetic Integrity Rate', kpis.ledgerArithmeticIntegrityPct, '%', dataOrigin.classification],
        ['Wallet-to-Ledger Reconciliation Discrepancies', kpis.walletReconciliationDiscrepanciesCount, 'discrepancies', dataOrigin.classification],
        ['Average VEs Transaction Size', kpis.avgVesTransactionSize, 'VEs', dataOrigin.classification],
        ['Referral Credits Count', referralPerformance.totalReferralTransactions, 'transactions', dataOrigin.classification],
        ['Referral VEs Awarded', referralPerformance.totalReferralVesAwarded, 'VEs', dataOrigin.classification],
        ['Referral Invites Tracked (KPI-45)', referralPerformance.totalInvites ?? 0, 'invites', dataOrigin.classification],
        ['Referral Signups Converted (KPI-45)', referralPerformance.registeredReferrals ?? 0, 'signups', dataOrigin.classification],
        ['Referral Conversion Rate (KPI-45)', referralPerformance.conversionRatePct ?? 0, '%', dataOrigin.classification]
      ]
    );
  };

  const handleExportTransactionsCsv = () => {
    if (!analytics) return;
    downloadCsv(
      `veloop_transactions_analytics_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Transaction ID', 'User ID', 'User Name', 'Type', 'Currency', 'Amount', 'Before', 'After', 'Source', 'Status', 'Date', 'Data Origin'],
      analytics.transactions.map((tx) => [
        tx.transactionId,
        tx.userId,
        tx.userName,
        tx.type,
        tx.currency,
        tx.amount,
        tx.balanceBefore,
        tx.balanceAfter,
        tx.source,
        tx.status,
        new Date(tx.createdAt).toISOString(),
        tx.dataOrigin
      ])
    );
  };

  const handleExportWithdrawalsCsv = () => {
    if (!analytics) return;
    downloadCsv(
      `veloop_withdrawals_analytics_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Withdrawal ID', 'User ID', 'User Name', 'Method', 'VEs Reserved', 'Payout Amount', 'Recipient', 'Status', 'Requested At', 'Data Origin'],
      analytics.withdrawals.map((w) => [
        w.withdrawalId,
        w.userId,
        w.userName,
        w.method,
        w.currencyAmount,
        w.payoutAmount,
        formatPayoutDetails(w.payoutDetails),
        w.status,
        new Date(w.requestedAt).toISOString(),
        w.dataOrigin
      ])
    );
  };

  const maxTrendValue = analytics
    ? Math.max(1, ...analytics.dailyTrends.map((d) => Math.max(d.credits, d.debits)))
    : 1;

  const maxSourceValue = analytics
    ? Math.max(1, ...analytics.sourceBreakdown.map((s) => s.credits + s.debits))
    : 1;

  return (
    <div className="space-y-6">
      {/* Data Origin & Production Separation Banner */}
      <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-[#4169E1] flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-[#172554]">Dataset Separation Active</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-950 font-bold text-[10px] font-mono uppercase">
                {analytics?.dataOrigin?.classification || 'SIMULATED_DEMO_DATA'}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 font-bold text-[10px] uppercase">
                VELOOP Production DB: {analytics?.dataOrigin?.productionDataConnected ? 'Connected' : 'Not Connected'}
              </span>
              {analytics?.dateFilter && (
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 font-semibold text-[10px] font-mono">
                  {analytics.dateFilter.timezone}:{' '}
                  {analytics.dateFilter.startDateUtc || analytics.dateFilter.endDateUtc
                    ? `${analytics.dateFilter.startDateUtc ? analytics.dateFilter.startDateUtc.slice(0, 10) : '...'} → ${analytics.dateFilter.endDateUtc ? analytics.dateFilter.endDateUtc.slice(0, 10) : '...'}`
                    : 'All Time'}
                </span>
              )}
            </div>
            <p className="text-blue-900/90 leading-relaxed">
              {analytics?.dataOrigin.notice ||
                'Analytics are calculated exclusively from verified MongoDB records in the current sandbox environment. Production VELOOP tables are intentionally isolated until Phase 1 ingestion.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <button
            onClick={handleExportKpisCsv}
            disabled={!analytics}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#172554] hover:bg-blue-900 text-white text-xs font-bold cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-[#F4C542]" />
            <span>Export KPIs CSV</span>
          </button>
        </div>
      </div>

      {/* Interactive Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1 mr-1">
              <Calendar className="w-3.5 h-3.5 text-[#800020]" /> Date Range:
            </span>
            {(['ALL', '7D', '30D', '90D'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => applyDatePreset(preset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  datePreset === preset
                    ? 'bg-[#800020] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {preset === 'ALL' ? 'All Time' : `Last ${preset}`}
              </button>
            ))}
          </div>

          <button
            onClick={loadAnalytics}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Analytics</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-500 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setDatePreset('CUSTOM');
                setStartDate(e.target.value);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-500 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setDatePreset('CUSTOM');
                setEndDate(e.target.value);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-500 mb-1">Currency</label>
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium"
            >
              <option value="ALL">All 5 Currencies</option>
              <option value="ves">VEs (Spendable)</option>
              <option value="sves">SVEs (Staked)</option>
              <option value="gems">Gems</option>
              <option value="tokens">Tokens</option>
              <option value="spins">Spins</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-500 mb-1">Reward Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-medium"
            >
              <option value="ALL">All Sources</option>
              <option value="BONUS">Onboarding / Bonus</option>
              <option value="REFERRAL">Referral Rewards</option>
              <option value="DAILY_REWARD">Daily Streak</option>
              <option value="GAME_REWARD">Games & Spins</option>
              <option value="AD_REWARD">Ad Rewards</option>
              <option value="WITHDRAWAL">Withdrawals</option>
              <option value="ADMIN_CREDIT">Admin Credit</option>
              <option value="REFUND">Refunds</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-500 mb-1">Search Ledger</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tx ID, User ID, note..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50"
              />
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            {errorMsg}
          </span>
          <button onClick={loadAnalytics} className="underline font-bold cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {isLoading && !analytics && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs shadow-xs">
          <div className="w-6 h-6 border-2 border-[#800020] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading sandbox analytics & ledger integrity metrics...
        </div>
      )}

      {!isLoading && !analytics && !errorMsg && (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs shadow-xs">
          No analytics snapshot available yet. Click Refresh Analytics to load data.
        </div>
      )}

      {analytics && (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="font-semibold">Users & Active Rate</span>
                <Users className="w-4 h-4 text-[#4169E1]" />
              </div>
              <div className="text-2xl font-black text-[#172554]">
                {analytics.kpis.activeUsers} <span className="text-xs font-normal text-slate-400">/ {analytics.kpis.totalUsers}</span>
              </div>
              <div className="text-[11px] text-emerald-700 font-semibold mt-1">
                {analytics.kpis.activeUserRatePct}% active accounts
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="font-semibold">Total VEs Earned</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-700">
                +{analytics.kpis.totalCreditsVes.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Across {analytics.kpis.totalCreditsCount} VEs credit(s) ({analytics.kpis.allCurrencyCreditsCount ?? analytics.kpis.totalCreditsCount} all-currency)
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="font-semibold">Total VEs Redeemed</span>
                <ArrowUpRight className="w-4 h-4 text-[#800020]" />
              </div>
              <div className="text-2xl font-black text-[#800020]">
                -{analytics.kpis.totalDebitsVes.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Across {analytics.kpis.totalDebitsCount} VEs debit(s) ({analytics.kpis.allCurrencyDebitsCount ?? analytics.kpis.totalDebitsCount} all-currency)
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="font-semibold">Wallet Liability (VEs)</span>
                <Coins className="w-4 h-4 text-[#F4C542]" />
              </div>
              <div className="text-2xl font-black text-[#172554]">
                {analytics.kpis.walletLiability.ves.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                +{analytics.kpis.walletLiability.sves.toLocaleString()} SVEs · {analytics.kpis.walletLiability.gems} Gems
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="font-semibold">Referral Rewards & Funnel</span>
                <Share2 className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-black text-[#172554]">
                {analytics.referralPerformance.totalReferralVesAwarded.toLocaleString()} <span className="text-xs font-normal text-slate-400">VEs</span>
              </div>
              <div className="text-[11px] text-purple-700 font-semibold mt-1">
                {analytics.referralPerformance.totalReferralTransactions} credit(s) · {analytics.referralPerformance.registeredReferrals ?? 0}/{analytics.referralPerformance.totalInvites ?? 0} invites ({analytics.referralPerformance.conversionRatePct ?? 0}%)
              </div>
            </div>
          </div>

          {/* Newly Implemented Schema-Backed Operational & Integrity KPIs */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#172554]">
                Schema-Backed Economy, Eligibility & Ledger Integrity KPIs
              </h3>
              <span className="text-[11px] text-slate-500">
                VEs Completed Txns: <strong>{analytics.kpis.vesTransactionsCount ?? analytics.kpis.totalCreditsCount + analytics.kpis.totalDebitsCount}</strong> · All-Currency Rows: <strong>{analytics.kpis.allCurrencyTransactionsCount ?? analytics.kpis.totalCreditsCount + analytics.kpis.totalDebitsCount}</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Payout-Eligible Users (KPI-18)</span>
                <strong className="text-base text-[#172554]">{analytics.kpis.payoutEligibleUsersCount}</strong>
                <span className="text-[10px] text-slate-400 block">
                  {analytics.kpis.minPayoutRequiredVes !== null ? `>= ${analytics.kpis.minPayoutRequiredVes.toLocaleString()} VEs` : 'No active option'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Wallet Coverage (KPI-19)</span>
                <strong className="text-base text-[#172554]">{analytics.kpis.walletToUserCoveragePct}%</strong>
                <span className="text-[10px] text-slate-400 block">
                  {analytics.kpis.nonAdminUsersWithWalletCount}/{analytics.kpis.nonAdminUsersCount} users
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Daily Rewards (KPI-25)</span>
                <strong className="text-base text-emerald-700">{analytics.kpis.dailyRewardVesDistributed.toLocaleString()} VEs</strong>
                <span className="text-[10px] text-slate-400 block">COMPLETED DAILY_REWARD</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Admin Share (KPI-28)</span>
                <strong className="text-base text-[#172554]">{analytics.kpis.adminManualAdjustmentsSharePct}%</strong>
                <span className="text-[10px] text-slate-400 block">
                  {analytics.kpis.adminManualCreditsVes.toLocaleString()} admin VEs
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Ledger Integrity (KPI-30)</span>
                <strong className={`text-base ${analytics.kpis.ledgerArithmeticIntegrityPct === 100 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {analytics.kpis.ledgerArithmeticIntegrityPct}%
                </strong>
                <span className="text-[10px] text-slate-400 block">
                  {analytics.kpis.ledgerValidRowsCount}/{analytics.kpis.ledgerRowsCheckedCount} rows valid
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Reconciliation (KPI-31)</span>
                <strong className={`text-base ${analytics.kpis.walletReconciliationMatched ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {analytics.kpis.walletReconciliationDiscrepanciesCount} drift
                </strong>
                <span className="text-[10px] text-slate-400 block">
                  {analytics.kpis.walletReconciliationCheckedWallets} wallets (5 currencies)
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Avg Tx Size (KPI-33)</span>
                <strong className="text-base text-[#172554]">{analytics.kpis.avgVesTransactionSize.toLocaleString()} VEs</strong>
                <span className="text-[10px] text-slate-400 block">COMPLETED VEs mean</span>
              </div>
            </div>
          </div>

          {/* Interactive Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Transaction Trends Chart */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[#172554] flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#800020]" />
                    <span>Daily VEs Credits vs Debits Trend</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">Ledger volume grouped by transaction date</p>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-bold">
                  <span className="flex items-center gap-1 text-emerald-700">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" /> Credits
                  </span>
                  <span className="flex items-center gap-1 text-[#800020]">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#800020] inline-block" /> Debits
                  </span>
                </div>
              </div>

              {analytics.dailyTrends.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                  No trend data for current filter selection.
                </div>
              ) : (
                <div className="h-48 flex items-end gap-2 pt-4 pb-1 overflow-x-auto">
                  {analytics.dailyTrends.map((day) => {
                    const creditHeight = Math.max(4, Math.round((day.credits / maxTrendValue) * 140));
                    const debitHeight = day.debits > 0 ? Math.max(4, Math.round((day.debits / maxTrendValue) * 140)) : 0;
                    return (
                      <div key={day.date} className="flex-1 min-w-[44px] flex flex-col items-center gap-1.5 group">
                        <div className="flex items-end gap-1 h-[145px]">
                          <div
                            title={`Credits: +${day.credits.toLocaleString()} VEs`}
                            className="w-4 rounded-t-md bg-emerald-500 hover:bg-emerald-600 transition-all"
                            style={{ height: `${creditHeight}px` }}
                          />
                          {debitHeight > 0 && (
                            <div
                              title={`Debits: -${day.debits.toLocaleString()} VEs`}
                              className="w-4 rounded-t-md bg-[#800020] hover:bg-red-800 transition-all"
                              style={{ height: `${debitHeight}px` }}
                            />
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">{day.date.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reward Source Breakdown & Withdrawal Funnel */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              <div>
                <h3 className="font-bold text-sm text-[#172554]">Reward & Ledger Volume by Source</h3>
                <p className="text-[11px] text-slate-500">Attribution across bonuses, referrals, games, and payouts</p>
              </div>

              {analytics.sourceBreakdown.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  No source breakdown data for current filter selection.
                </div>
              ) : (
                <div className="space-y-3">
                  {analytics.sourceBreakdown.map((item) => {
                    const total = item.credits + item.debits;
                    const widthPct = Math.max(6, Math.round((total / maxSourceValue) * 100));
                    return (
                      <div key={item.source} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800">{item.source}</span>
                          <span className="text-slate-600 font-mono text-[11px]">
                            +{item.credits.toLocaleString()} / -{item.debits.toLocaleString()} VEs ({item.count} VEs / {item.allCurrencyCount ?? item.count} total txns)
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.debits > item.credits ? 'bg-[#800020]' : 'bg-[#4169E1]'
                            }`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Withdrawal Funnel Summary */}
              <div className="pt-4 border-t border-slate-100 grid grid-cols-3 gap-3 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="font-black text-amber-900 text-base">{analytics.withdrawalStats.pendingCount}</div>
                  <div className="text-[10px] font-semibold text-amber-800">Pending ({analytics.withdrawalStats.pendingVes.toLocaleString()} VEs)</div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="font-black text-emerald-900 text-base">{analytics.withdrawalStats.approvedCount}</div>
                  <div className="text-[10px] font-semibold text-emerald-800">Approved ({analytics.withdrawalStats.approvedVes.toLocaleString()} VEs)</div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                  <div className="font-black text-rose-900 text-base">{analytics.withdrawalStats.rejectedCount}</div>
                  <div className="text-[10px] font-semibold text-rose-800">Rejected ({analytics.withdrawalStats.rejectedVes.toLocaleString()} VEs)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Non-Destructive Identity & ER Hygiene Scanner */}
          {conflicts && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-[#172554]" />
                  <div>
                    <h3 className="font-bold text-sm text-[#172554]">
                      Non-Destructive User Identity & Wallet Integrity Scan
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Read-only verification of canonical email uniqueness and User ↔ Wallet 1:1 referential consistency
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                  conflicts.auditSummary.status === 'CLEAN_IN_SANDBOX'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-900'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {conflicts.auditSummary.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Users Scanned</span>
                  <strong className="text-base text-slate-900">{conflicts.auditSummary.totalUsersScanned}</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Wallets Scanned</span>
                  <strong className="text-base text-slate-900">{conflicts.auditSummary.totalWalletsScanned}</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Duplicate Emails</span>
                  <strong className="text-base text-emerald-700">{conflicts.auditSummary.duplicateEmailsCount}</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Non-Admin Missing Wallet</span>
                  <strong className="text-base text-slate-900">{conflicts.auditSummary.usersWithoutWalletsCount}</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Orphan Wallets</span>
                  <strong className="text-base text-emerald-700">{conflicts.auditSummary.orphanWalletsCount}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Referral Tracking & Attribution Visibility */}
          {referralsOverview && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-sm text-[#172554] flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-purple-600" />
                    <span>Referral Attribution & Conversion Funnel (KPI-45)</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">{referralsOverview.summary.rewardRuleNotice}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900">
                  {referralsOverview.summary.rewardRuleStatus} · {referralsOverview.summary.conversionRatePct}% conversion
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Referral ID</th>
                      <th className="py-2 px-3">Referrer</th>
                      <th className="py-2 px-3">Referee Email</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Reward (VEs)</th>
                      <th className="py-2 px-3 text-right">Invited At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {referralsOverview.referrals.slice(0, 10).map((r) => (
                      <tr key={r.referralId}>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">{r.referralId}</td>
                        <td className="py-2 px-3">{r.referrerName}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{r.refereeEmail}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600">
                          {r.rewardAmountVes} ({r.rewardRuleStatus})
                        </td>
                        <td className="py-2 px-3 text-right text-[11px] text-slate-500">
                          {new Date(r.invitedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {referralsOverview.referrals.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-slate-400">
                          No referral invites recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Exportable Transactions & Withdrawals Tables */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-[#172554]">Filtered Ledger Transactions ({analytics.transactions.length})</h3>
                <p className="text-[11px] text-slate-500">Tagged with dataOrigin classification for production audit clarity</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportTransactionsCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#172554] hover:bg-blue-900 text-white text-xs font-bold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#F4C542]" />
                  <span>Transactions CSV</span>
                </button>
                <button
                  onClick={handleExportWithdrawalsCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#800020] hover:bg-[#9a0027] text-white text-xs font-bold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#F4C542]" />
                  <span>Withdrawals CSV</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#172554] text-white uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Tx ID</th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Type / Currency</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Origin Tag</th>
                    <th className="py-3 px-4 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {analytics.transactions.slice(0, 15).map((tx) => (
                    <tr key={tx.transactionId} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-[11px] font-bold text-slate-900">{tx.transactionId}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{tx.userName}</div>
                        <div className="text-[10px] text-slate-400">{tx.userId}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold mr-1.5 ${
                          tx.type === 'CREDIT' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {tx.type}
                        </span>
                        <span className="uppercase font-bold">{tx.currency}</span>
                      </td>
                      <td className="py-3 px-4 font-bold">
                        <span className={tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}>
                          {tx.type === 'CREDIT' ? '+' : '-'}{tx.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">{tx.source}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                          {tx.dataOrigin}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-[11px] text-slate-500">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {analytics.transactions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No transactions match the current filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Filtered Withdrawals Preview */}
          {analytics.withdrawals.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-bold text-sm text-[#172554]">Withdrawals Summary ({analytics.withdrawals.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-4">Withdrawal ID</th>
                      <th className="py-2.5 px-4">User</th>
                      <th className="py-2.5 px-4">Method</th>
                      <th className="py-2.5 px-4">Recipient</th>
                      <th className="py-2.5 px-4">Reserved VEs</th>
                      <th className="py-2.5 px-4">Payout</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.withdrawals.slice(0, 10).map((w) => (
                      <tr key={w.withdrawalId}>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{w.withdrawalId}</td>
                        <td className="py-2.5 px-4">{w.userName}</td>
                        <td className="py-2.5 px-4 font-semibold">{w.method}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">{formatPayoutDetails(w.payoutDetails)}</td>
                        <td className="py-2.5 px-4 font-bold text-[#800020]">{w.currencyAmount.toLocaleString()} VEs</td>
                        <td className="py-2.5 px-4 font-bold text-emerald-700">
                          {getPayoutCurrencySymbol(w.method, w.payoutCurrency || w.currency, w.optionId)}{w.payoutAmount}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                            {w.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
