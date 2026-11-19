import { User } from '../models/User.js';
import { Wallet, CurrencyType } from '../models/Wallet.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { Withdrawal } from '../models/Withdrawal.js';
import { PayoutOption } from '../models/PayoutOption.js';
import { Referral } from '../models/Referral.js';
import { getDBStatus } from '../db.js';

const ALL_CURRENCIES: CurrencyType[] = ['ves', 'sves', 'gems', 'tokens', 'spins'];
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface AnalyticsFilterParams {
  startDate?: string;
  endDate?: string;
  currency?: string;
  source?: string;
  search?: string;
}

export function parseUtcDateBoundary(dateStr: string, bound: 'start' | 'end'): Date | null {
  const trimmed = (dateStr || '').trim();
  if (!trimmed) return null;

  if (DATE_ONLY_REGEX.test(trimmed)) {
    const suffix = bound === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
    const parsed = new Date(`${trimmed}${suffix}`);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export class AnalyticsService {
  static async getAdminAnalytics(filters: AnalyticsFilterParams = {}) {
    const dbStatus = getDBStatus();

    const startDateStr = filters.startDate;
    const endDateStr = filters.endDate;
    const currencyFilter = (filters.currency || 'ALL').trim();
    const sourceFilter = (filters.source || 'ALL').trim();
    const search = (filters.search || '').trim().toLowerCase();

    const txQuery: Record<string, any> = {};
    const withdrawalQuery: Record<string, any> = {};

    let startDateUtc: string | null = null;
    let endDateUtc: string | null = null;

    if (startDateStr || endDateStr) {
      const dateRange: Record<string, Date> = {};
      if (startDateStr) {
        const start = parseUtcDateBoundary(startDateStr, 'start');
        if (start) {
          dateRange.$gte = start;
          startDateUtc = start.toISOString();
        }
      }
      if (endDateStr) {
        const end = parseUtcDateBoundary(endDateStr, 'end');
        if (end) {
          dateRange.$lte = end;
          endDateUtc = end.toISOString();
        }
      }
      if (Object.keys(dateRange).length > 0) {
        txQuery.createdAt = dateRange;
        withdrawalQuery.requestedAt = dateRange;
      }
    }

    if (currencyFilter && currencyFilter.toUpperCase() !== 'ALL') {
      txQuery.currency = currencyFilter.toLowerCase();
    }

    if (sourceFilter && sourceFilter.toUpperCase() !== 'ALL') {
      txQuery.source = sourceFilter;
    }

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      txQuery.$or = [
        { transactionId: { $regex: escaped, $options: 'i' } },
        { userId: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { source: { $regex: escaped, $options: 'i' } }
      ];
    }

    const [
      users,
      wallets,
      transactions,
      withdrawals,
      activePayoutOptions,
      allCompletedTransactions,
      referrals
    ] = await Promise.all([
      User.find({}).lean(),
      Wallet.find({}).lean(),
      WalletTransaction.find(txQuery).sort({ createdAt: -1 }).lean(),
      Withdrawal.find(withdrawalQuery).sort({ requestedAt: -1 }).lean(),
      PayoutOption.find({ active: true }).lean(),
      WalletTransaction.find({ status: 'COMPLETED' }).lean(),
      Referral.find({}).lean()
    ]);

    const userMap = new Map(users.map((u) => [u.userId, u]));
    const walletMap = new Map(wallets.map((w) => [w.userId, w]));

    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.accountStatus === 'active').length;
    const suspendedUsers = users.filter((u) => u.accountStatus !== 'active').length;
    const activeUserRatePct =
      totalUsers > 0 ? Number(((activeUsers / totalUsers) * 100).toFixed(1)) : 0;

    // KPI-19: Wallet-to-User Coverage (%) across non-admin consumer users
    const nonAdminUsers = users.filter((u) => u.role === 'user');
    const nonAdminUsersCount = nonAdminUsers.length;
    const nonAdminUsersWithWalletCount = nonAdminUsers.filter((u) =>
      walletMap.has(u.userId)
    ).length;
    const nonAdminUsersWithoutWalletCount =
      nonAdminUsersCount - nonAdminUsersWithWalletCount;
    const walletToUserCoveragePct =
      nonAdminUsersCount > 0
        ? Number(((nonAdminUsersWithWalletCount / nonAdminUsersCount) * 100).toFixed(1))
        : 0;

    // Wallet Liabilities (KPI-11 to KPI-15)
    const walletLiability = wallets.reduce(
      (acc, w) => {
        acc.ves += w.ves || 0;
        acc.sves += w.sves || 0;
        acc.gems += w.gems || 0;
        acc.tokens += w.tokens || 0;
        acc.spins += w.spins || 0;
        return acc;
      },
      { ves: 0, sves: 0, gems: 0, tokens: 0, spins: 0 }
    );

    // KPI-18: Payout-Eligible Users Count (wallets holding >= min active requiredAmount)
    const activeRequiredAmounts = activePayoutOptions
      .map((opt) => opt.requiredAmount)
      .filter((amt) => typeof amt === 'number' && Number.isFinite(amt) && amt > 0);
    const minPayoutRequiredVes =
      activeRequiredAmounts.length > 0 ? Math.min(...activeRequiredAmounts) : null;
    const payoutEligibleUsersCount =
      minPayoutRequiredVes !== null
        ? wallets.filter((w) => (w.ves || 0) >= minPayoutRequiredVes).length
        : 0;

    // Transaction Aggregations (separated cleanly by VEs vs all-currency & COMPLETED status)
    let totalCreditsVes = 0;
    let totalDebitsVes = 0;
    let totalCreditsCount = 0; // VEs completed credits
    let totalDebitsCount = 0; // VEs completed debits
    let allCurrencyCreditsCount = 0;
    let allCurrencyDebitsCount = 0;
    let vesAmountVolume = 0;
    let vesCompletedCount = 0;
    let dailyRewardVesDistributed = 0; // KPI-25
    let adminManualCreditsVes = 0; // KPI-28 numerator

    // KPI-30: Ledger Arithmetic Integrity Rate (%) across matched rows
    let ledgerRowsCheckedCount = 0;
    let ledgerValidRowsCount = 0;

    const sourceBreakdownMap = new Map<
      string,
      { source: string; credits: number; debits: number; count: number; allCurrencyCount: number }
    >();
    const dailyTrendMap = new Map<
      string,
      { date: string; credits: number; debits: number; count: number; allCurrencyCount: number }
    >();

    for (const tx of transactions) {
      ledgerRowsCheckedCount += 1;
      const hasFiniteNums =
        typeof tx.amount === 'number' &&
        Number.isFinite(tx.amount) &&
        tx.amount >= 0 &&
        typeof tx.balanceBefore === 'number' &&
        Number.isFinite(tx.balanceBefore) &&
        tx.balanceBefore >= 0 &&
        typeof tx.balanceAfter === 'number' &&
        Number.isFinite(tx.balanceAfter) &&
        tx.balanceAfter >= 0;

      if (hasFiniteNums) {
        const expectedAfter =
          tx.type === 'CREDIT' ? tx.balanceBefore + tx.amount : tx.balanceBefore - tx.amount;
        if (Math.abs(tx.balanceAfter - expectedAfter) < 1e-9) {
          ledgerValidRowsCount += 1;
        }
      }

      // Only COMPLETED transactions are included in balance/reward/trend value metrics
      if (tx.status !== 'COMPLETED') {
        continue;
      }

      const dateKey = new Date(tx.createdAt).toISOString().slice(0, 10);
      if (!dailyTrendMap.has(dateKey)) {
        dailyTrendMap.set(dateKey, {
          date: dateKey,
          credits: 0,
          debits: 0,
          count: 0,
          allCurrencyCount: 0
        });
      }
      const dayEntry = dailyTrendMap.get(dateKey)!;
      dayEntry.allCurrencyCount += 1;

      if (!sourceBreakdownMap.has(tx.source)) {
        sourceBreakdownMap.set(tx.source, {
          source: tx.source,
          credits: 0,
          debits: 0,
          count: 0,
          allCurrencyCount: 0
        });
      }
      const srcEntry = sourceBreakdownMap.get(tx.source)!;
      srcEntry.allCurrencyCount += 1;

      const isVes = tx.currency === 'ves';
      if (isVes) {
        vesCompletedCount += 1;
        vesAmountVolume += tx.amount;
        dayEntry.count += 1;
        srcEntry.count += 1;
      }

      if (tx.type === 'CREDIT') {
        allCurrencyCreditsCount += 1;
        if (isVes) {
          totalCreditsCount += 1;
          totalCreditsVes += tx.amount;
          dayEntry.credits += tx.amount;
          srcEntry.credits += tx.amount;

          if (tx.source === 'DAILY_REWARD') {
            dailyRewardVesDistributed += tx.amount;
          }
          if (tx.source === 'ADMIN_CREDIT') {
            adminManualCreditsVes += tx.amount;
          }
        }
      } else if (tx.type === 'DEBIT') {
        allCurrencyDebitsCount += 1;
        if (isVes) {
          totalDebitsCount += 1;
          totalDebitsVes += tx.amount;
          dayEntry.debits += tx.amount;
          srcEntry.debits += tx.amount;
        }
      }
    }

    const vesTransactionsCount = totalCreditsCount + totalDebitsCount;
    const allCurrencyTransactionsCount = transactions.length;
    const allCurrencyCompletedTransactionsCount =
      allCurrencyCreditsCount + allCurrencyDebitsCount;

    // KPI-28: Admin Manual Adjustments Share (%)
    const adminManualAdjustmentsSharePct =
      totalCreditsVes > 0
        ? Number(((adminManualCreditsVes / totalCreditsVes) * 100).toFixed(1))
        : 0;

    // KPI-30: Ledger Arithmetic Integrity Rate (%)
    const ledgerInvalidRowsCount = ledgerRowsCheckedCount - ledgerValidRowsCount;
    const ledgerArithmeticIntegrityPct =
      ledgerRowsCheckedCount > 0
        ? Number(((ledgerValidRowsCount / ledgerRowsCheckedCount) * 100).toFixed(1))
        : 0;

    // KPI-33: Average Transaction Size (VEs)
    const avgVesTransactionSize =
      vesCompletedCount > 0 ? Number((vesAmountVolume / vesCompletedCount).toFixed(2)) : 0;

    // KPI-31: Lifetime Wallet-to-Ledger Balance Reconciliation (all COMPLETED rows, all 5 currencies)
    const ledgerNetByUser = new Map<string, Record<CurrencyType, number>>();
    for (const tx of allCompletedTransactions) {
      const currency = tx.currency as CurrencyType;
      if (!ALL_CURRENCIES.includes(currency)) continue;

      if (!ledgerNetByUser.has(tx.userId)) {
        ledgerNetByUser.set(tx.userId, { ves: 0, sves: 0, gems: 0, tokens: 0, spins: 0 });
      }
      const userNet = ledgerNetByUser.get(tx.userId)!;
      if (tx.type === 'CREDIT') {
        userNet[currency] += tx.amount;
      } else if (tx.type === 'DEBIT') {
        userNet[currency] -= tx.amount;
      }
    }

    const reconciledUserIds = new Set<string>([
      ...wallets.map((w) => w.userId),
      ...ledgerNetByUser.keys()
    ]);

    let walletReconciliationDiscrepanciesCount = 0;
    for (const uid of reconciledUserIds) {
      const w = walletMap.get(uid);
      const expected = ledgerNetByUser.get(uid) || {
        ves: 0,
        sves: 0,
        gems: 0,
        tokens: 0,
        spins: 0
      };
      for (const cur of ALL_CURRENCIES) {
        const actualBal = w ? Number(w[cur] || 0) : 0;
        const expectedBal = Number(expected[cur] || 0);
        if (Math.abs(actualBal - expectedBal) > 1e-9) {
          walletReconciliationDiscrepanciesCount += 1;
        }
      }
    }
    const walletReconciliationCheckedWallets = wallets.length;
    const walletReconciliationMatched = walletReconciliationDiscrepanciesCount === 0;

    // Withdrawals (KPI-35 to KPI-39; KPI-40 intentionally unchanged/unpopulated pending payoutCurrency)
    const withdrawalStats = {
      totalCount: withdrawals.length,
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      pendingVes: 0,
      approvedVes: 0,
      rejectedVes: 0,
      totalPayoutValueINR: 0,
      totalPayoutValueUSD: 0,
      byMethod: {} as Record<string, { count: number; vesAmount: number }>
    };

    for (const w of withdrawals) {
      if (w.status === 'PENDING' || w.status === 'PROCESSING') {
        withdrawalStats.pendingCount += 1;
        withdrawalStats.pendingVes += w.currencyAmount || 0;
      } else if (w.status === 'APPROVED') {
        withdrawalStats.approvedCount += 1;
        withdrawalStats.approvedVes += w.currencyAmount || 0;
      } else if (w.status === 'REJECTED' || w.status === 'CANCELLED') {
        withdrawalStats.rejectedCount += 1;
        withdrawalStats.rejectedVes += w.currencyAmount || 0;
      }

      if (!withdrawalStats.byMethod[w.method]) {
        withdrawalStats.byMethod[w.method] = { count: 0, vesAmount: 0 };
      }
      withdrawalStats.byMethod[w.method].count += 1;
      withdrawalStats.byMethod[w.method].vesAmount += w.currencyAmount || 0;
    }

    // Referral metrics derived from COMPLETED ledger transactions (KPI-42 to KPI-44) & Referral tracking schema (KPI-45)
    const referralTxs = transactions.filter(
      (t) => t.source === 'REFERRAL' && t.type === 'CREDIT' && t.status === 'COMPLETED'
    );
    const totalInvites = referrals.length;
    const registeredReferrals = referrals.filter(
      (r) => r.status === 'REGISTERED' || r.status === 'REWARD_PENDING_RULE'
    ).length;
    const pendingInvites = referrals.filter((r) => r.status === 'INVITED').length;
    const blockedReferrals = referrals.filter((r) => r.status === 'BLOCKED').length;
    const conversionRatePct =
      totalInvites > 0 ? Number(((registeredReferrals / totalInvites) * 100).toFixed(1)) : 0;

    const referralPerformance = {
      totalReferralTransactions: referralTxs.length,
      totalReferralVesAwarded: referralTxs
        .filter((t) => t.currency === 'ves')
        .reduce((s, t) => s + t.amount, 0),
      uniqueReferrersCount: new Set(referralTxs.map((t) => t.userId)).size,
      totalInvites,
      registeredReferrals,
      pendingInvites,
      blockedReferrals,
      conversionRatePct,
      rewardRuleStatus: 'PENDING_BUSINESS_RULE',
      conversionRateNote:
        'Schema-backed via Referral collection; automated reward payouts remain paused (0 VEs) pending VELOOP business-rule approval'
    };

    const dailyTrends = Array.from(dailyTrendMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const sourceBreakdown = Array.from(sourceBreakdownMap.values()).sort(
      (a, b) => b.credits + b.debits - (a.credits + a.debits)
    );

    const recentTransactionsEnriched = transactions.slice(0, 50).map((tx) => ({
      ...tx,
      userName: userMap.get(tx.userId)?.name || tx.userId,
      userEmail: userMap.get(tx.userId)?.email || 'N/A',
      dataOrigin: 'SIMULATED_DEMO'
    }));

    return {
      success: true,
      dataOrigin: {
        environmentMode: dbStatus.mode,
        classification:
          dbStatus.mode === 'atlas' ? 'ATLAS_CONFIGURED_SANDBOX' : 'SIMULATED_DEMO_DATA',
        productionDataConnected: false,
        notice:
          'All records shown are currently from the seeded/demo sandbox environment. Zero actual VELOOP production records are mixed into these metrics.'
      },
      dateFilter: {
        timezone: 'UTC' as const,
        startDateUtc,
        endDateUtc
      },
      kpis: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        activeUserRatePct,
        walletLiability,
        totalCreditsVes,
        totalDebitsVes,
        netVesFlow: totalCreditsVes - totalDebitsVes,
        totalCreditsCount,
        totalDebitsCount,
        vesTransactionsCount,
        allCurrencyCreditsCount,
        allCurrencyDebitsCount,
        allCurrencyTransactionsCount,
        allCurrencyCompletedTransactionsCount,
        withdrawalApprovalRatePct:
          withdrawalStats.approvedCount + withdrawalStats.rejectedCount > 0
            ? Number(
                (
                  (withdrawalStats.approvedCount /
                    (withdrawalStats.approvedCount + withdrawalStats.rejectedCount)) *
                  100
                ).toFixed(1)
              )
            : 0,
        // 7 Newly Implemented Schema-Backed KPIs
        payoutEligibleUsersCount,
        minPayoutRequiredVes,
        walletToUserCoveragePct,
        nonAdminUsersCount,
        nonAdminUsersWithWalletCount,
        nonAdminUsersWithoutWalletCount,
        dailyRewardVesDistributed,
        adminManualAdjustmentsSharePct,
        adminManualCreditsVes,
        ledgerArithmeticIntegrityPct,
        ledgerRowsCheckedCount,
        ledgerValidRowsCount,
        ledgerInvalidRowsCount,
        walletReconciliationDiscrepanciesCount,
        walletReconciliationCheckedWallets,
        walletReconciliationMatched,
        avgVesTransactionSize
      },
      withdrawalStats,
      referralPerformance,
      dailyTrends,
      sourceBreakdown,
      transactions: recentTransactionsEnriched,
      withdrawals: withdrawals.slice(0, 50).map((w) => ({
        ...w,
        userName: userMap.get(w.userId)?.name || w.userId,
        dataOrigin: 'SIMULATED_DEMO'
      }))
    };
  }
}
