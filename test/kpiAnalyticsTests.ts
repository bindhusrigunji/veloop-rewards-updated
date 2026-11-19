import http from 'http';
import { AddressInfo } from 'net';
import bcrypt from 'bcryptjs';
import { connectDB, closeDB } from '../server/db.js';
import { createApp } from '../server/app.js';
import { seedInitialData } from '../server/seed/seedData.js';
import { User } from '../server/models/User.js';
import { Wallet } from '../server/models/Wallet.js';
import { WalletTransaction } from '../server/models/WalletTransaction.js';
import { Withdrawal } from '../server/models/Withdrawal.js';
import { PayoutOption } from '../server/models/PayoutOption.js';
import { AnalyticsService, parseUtcDateBoundary } from '../server/services/analyticsService.js';

interface KpiTestResult {
  testId: string;
  description: string;
  status: 'PASS' | 'FAIL';
  actualResult: string;
  durationMs: number;
}

const results: KpiTestResult[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runCase(
  testId: string,
  description: string,
  fn: () => Promise<string>
) {
  const start = Date.now();
  try {
    const actualResult = await fn();
    const durationMs = Date.now() - start;
    results.push({ testId, description, status: 'PASS', actualResult, durationMs });
    console.log(`✓ [${testId}] ${description} -> PASS (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({
      testId,
      description,
      status: 'FAIL',
      actualResult: `Error: ${err?.message || err}`,
      durationMs
    });
    console.log(`✗ [${testId}] ${description} -> FAIL (${durationMs}ms): ${err?.message || err}`);
  }
}

async function runKpiAnalyticsSuite() {
  console.log('==================================================================');
  console.log('     VELoop Rewards — Schema-Backed KPI & Analytics Test Suite    ');
  console.log('==================================================================\n');

  await connectDB();
  await seedInitialData();

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  let adminToken = '';

  try {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@veloop.test', password: 'AdminSecure123!' })
    });
    const loginData: any = await loginRes.json();
    assert(loginRes.status === 200 && Boolean(loginData.token), 'Seeded admin login must succeed');
    adminToken = loginData.token;

    // KPI-TEST-01: Unmodified seeded baseline calculation accuracy across all 7 new KPIs
    await runCase(
      'KPI-TEST-01',
      'Verify exact values for KPIs 18, 19, 25, 28, 30, 31, 33 and separated VEs/all-currency counts on seeded demo data',
      async () => {
        const res = await fetch(`${baseUrl}/admin/analytics`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        const data: any = await res.json();
        assert(res.status === 200 && data.success, 'Analytics endpoint must return HTTP 200');
        assert(data.dataOrigin.classification === 'SIMULATED_DEMO_DATA', 'Must retain SIMULATED_DEMO_DATA tag');
        assert(data.dataOrigin.productionDataConnected === false, 'productionDataConnected must be false');
        assert(data.dateFilter?.timezone === 'UTC', 'Date filter timezone must be UTC');

        const k = data.kpis;
        assert(k.payoutEligibleUsersCount === 1, `Expected KPI-18=1, got ${k.payoutEligibleUsersCount}`);
        assert(k.minPayoutRequiredVes === 3000, `Expected minPayoutRequiredVes=3000, got ${k.minPayoutRequiredVes}`);
        assert(k.walletToUserCoveragePct === 100, `Expected KPI-19=100, got ${k.walletToUserCoveragePct}`);
        assert(k.dailyRewardVesDistributed === 250, `Expected KPI-25=250, got ${k.dailyRewardVesDistributed}`);
        assert(k.adminManualAdjustmentsSharePct === 0, `Expected KPI-28=0, got ${k.adminManualAdjustmentsSharePct}`);
        assert(k.ledgerArithmeticIntegrityPct === 100, `Expected KPI-30=100, got ${k.ledgerArithmeticIntegrityPct}`);
        assert(k.ledgerRowsCheckedCount === 10, `Expected 10 checked rows, got ${k.ledgerRowsCheckedCount}`);
        assert(k.walletReconciliationDiscrepanciesCount === 0, `Expected KPI-31=0, got ${k.walletReconciliationDiscrepanciesCount}`);
        assert(k.walletReconciliationMatched === true, 'walletReconciliationMatched must be true');
        assert(k.avgVesTransactionSize === 5166.67, `Expected KPI-33=5166.67, got ${k.avgVesTransactionSize}`);

        // Count separation: 5 VEs credits vs 9 all-currency credits
        assert(k.totalCreditsCount === 5, `Expected 5 VEs credits, got ${k.totalCreditsCount}`);
        assert(k.totalDebitsCount === 1, `Expected 1 VEs debit, got ${k.totalDebitsCount}`);
        assert(k.vesTransactionsCount === 6, `Expected 6 VEs txns, got ${k.vesTransactionsCount}`);
        assert(k.allCurrencyCreditsCount === 9, `Expected 9 all-currency credits, got ${k.allCurrencyCreditsCount}`);
        assert(k.allCurrencyDebitsCount === 1, `Expected 1 all-currency debit, got ${k.allCurrencyDebitsCount}`);
        assert(k.allCurrencyTransactionsCount === 10, `Expected 10 all-currency txns, got ${k.allCurrencyTransactionsCount}`);

        return 'KPI-18=1, KPI-19=100%, KPI-25=250, KPI-28=0%, KPI-30=100%, KPI-31=0 diff, KPI-33=5166.67, counts(6 VEs / 10 all)';
      }
    );

    // KPI-TEST-02: Mixed-currency isolation, COMPLETED-only rule, ADMIN_CREDIT, REFUND non-reward/non-payout & ?currency=gems filter
    await runCase(
      'KPI-TEST-02',
      'Enforce mixed-currency isolation, COMPLETED status filter, ADMIN_CREDIT share, and REFUND non-reward/non-payout rules',
      async () => {
        const uid = 'USR-DEMO-001';
        await Wallet.updateOne(
          { userId: uid },
          { $inc: { ves: 5000, tokens: 1000, spins: 5 } }
        );

        await WalletTransaction.insertMany([
          {
            transactionId: 'TXN-TEST-ADM-VES',
            userId: uid,
            currency: 'ves',
            type: 'CREDIT',
            amount: 2000,
            balanceBefore: 25000,
            balanceAfter: 27000,
            source: 'ADMIN_CREDIT',
            status: 'COMPLETED',
            description: 'Admin bonus adjustment'
          },
          {
            transactionId: 'TXN-TEST-ADM-TOK',
            userId: uid,
            currency: 'tokens',
            type: 'CREDIT',
            amount: 1000,
            balanceBefore: 500,
            balanceAfter: 1500,
            source: 'ADMIN_CREDIT',
            status: 'COMPLETED',
            description: 'Non-VE admin credit must not pollute VEs share'
          },
          {
            transactionId: 'TXN-TEST-DLY-SPIN',
            userId: uid,
            currency: 'spins',
            type: 'CREDIT',
            amount: 5,
            balanceBefore: 3,
            balanceAfter: 8,
            source: 'DAILY_REWARD',
            status: 'COMPLETED',
            description: 'Daily spins must not enter KPI-25 VEs'
          },
          {
            transactionId: 'TXN-TEST-DLY-FAIL',
            userId: uid,
            currency: 'ves',
            type: 'CREDIT',
            amount: 500,
            balanceBefore: 27000,
            balanceAfter: 27500,
            source: 'DAILY_REWARD',
            status: 'FAILED',
            description: 'Failed daily reward must not be summed'
          },
          {
            transactionId: 'TXN-TEST-REFUND-VES',
            userId: uid,
            currency: 'ves',
            type: 'CREDIT',
            amount: 3000,
            balanceBefore: 27000,
            balanceAfter: 30000,
            source: 'REFUND',
            status: 'COMPLETED',
            description: 'Rejected withdrawal refund must not count as daily reward, admin credit, or cash payout'
          }
        ]);

        const res = await fetch(`${baseUrl}/admin/analytics`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        const data: any = await res.json();
        const k = data.kpis;

        assert(k.totalCreditsVes === 33000, `Expected 33000 VEs completed credits (FAILED excluded), got ${k.totalCreditsVes}`);
        assert(k.totalCreditsCount === 7, `Expected 7 VEs completed credits, got ${k.totalCreditsCount}`);
        assert(k.allCurrencyCreditsCount === 13, `Expected 13 completed all-currency credits, got ${k.allCurrencyCreditsCount}`);
        assert(k.allCurrencyTransactionsCount === 15, `Expected 15 total matched rows including FAILED, got ${k.allCurrencyTransactionsCount}`);
        assert(k.dailyRewardVesDistributed === 250, `Expected KPI-25=250 (spins & FAILED excluded), got ${k.dailyRewardVesDistributed}`);
        assert(k.adminManualCreditsVes === 2000, `Expected adminManualCreditsVes=2000 (tokens excluded), got ${k.adminManualCreditsVes}`);
        assert(k.adminManualAdjustmentsSharePct === 6.1, `Expected KPI-28=6.1%, got ${k.adminManualAdjustmentsSharePct}`);
        assert(data.withdrawalStats.approvedVes === 3000, `REFUND must not inflate approvedVes; got ${data.withdrawalStats.approvedVes}`);
        assert(k.walletReconciliationDiscrepanciesCount === 0, `Expected KPI-31=0 when wallet + COMPLETED match, got ${k.walletReconciliationDiscrepanciesCount}`);

        // Currency filter = gems must return 0 for VEs metrics without breaking lifetime KPI-31
        const gemsRes = await fetch(`${baseUrl}/admin/analytics?currency=gems`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        const gemsData: any = await gemsRes.json();
        assert(gemsData.kpis.totalCreditsVes === 0, 'Gems filter must have totalCreditsVes=0');
        assert(gemsData.kpis.totalCreditsCount === 0, 'Gems filter must have VEs totalCreditsCount=0');
        assert(gemsData.kpis.avgVesTransactionSize === 0, 'Gems filter must have avgVesTransactionSize=0');
        assert(gemsData.kpis.allCurrencyCreditsCount === 1, 'Gems filter must show 1 Gems credit');
        assert(gemsData.kpis.walletReconciliationDiscrepanciesCount === 0, 'Lifetime reconciliation must stay 0 under ?currency=gems filter');

        return 'Mixed currency & FAILED excluded cleanly; KPI-25=250, KPI-28=6.1%, ?currency=gems isolated VEs to 0 while KPI-31=0';
      }
    );

    // KPI-TEST-03: Zero-balance wallet & missing-wallet cases (KPI-18, KPI-19, KPI-31)
    await runCase(
      'KPI-TEST-03',
      'Verify zero-balance user excluded from KPI-18 and missing-wallet user captured in KPI-19 and KPI-31',
      async () => {
        const hash = await bcrypt.hash('Password123!', 10);
        await User.create({
          userId: 'USR-ZERO-BAL',
          name: 'Zero Balance User',
          email: 'zero@veloop.test',
          passwordHash: hash,
          role: 'user',
          accountStatus: 'active'
        });
        await Wallet.create({
          userId: 'USR-ZERO-BAL',
          ves: 0,
          sves: 0,
          gems: 0,
          tokens: 0,
          spins: 0
        });

        await User.create({
          userId: 'USR-NO-WALLET',
          name: 'Missing Wallet User',
          email: 'nowallet@veloop.test',
          passwordHash: hash,
          role: 'user',
          accountStatus: 'active'
        });
        // Unbacked COMPLETED ledger credit for USR-NO-WALLET creates reconciliation drift
        await WalletTransaction.create({
          transactionId: 'TXN-ORPHAN-LEDGER',
          userId: 'USR-NO-WALLET',
          currency: 'ves',
          type: 'CREDIT',
          amount: 500,
          balanceBefore: 0,
          balanceAfter: 500,
          source: 'BONUS',
          status: 'COMPLETED',
          description: 'Credited ledger without wallet row'
        });

        // Inactive lower-tier option (100 VEs) must be ignored by KPI-18
        await PayoutOption.create({
          optionId: 'OPT-INACTIVE-LOW',
          methodId: 'METHOD-UPI',
          name: 'Inactive ₹10 Tier',
          type: 'UPI',
          currency: 'INR',
          payoutValue: 10,
          requiredAmount: 100,
          active: false
        });

        const res = await fetch(`${baseUrl}/admin/analytics`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        const data: any = await res.json();
        const k = data.kpis;

        assert(k.payoutEligibleUsersCount === 1, `Zero-balance wallet must not be eligible; expected 1, got ${k.payoutEligibleUsersCount}`);
        assert(k.minPayoutRequiredVes === 3000, `Inactive 100 VEs option must be ignored; expected 3000, got ${k.minPayoutRequiredVes}`);
        assert(k.nonAdminUsersCount === 3, `Expected 3 non-admin users, got ${k.nonAdminUsersCount}`);
        assert(k.nonAdminUsersWithWalletCount === 2, `Expected 2 covered consumers, got ${k.nonAdminUsersWithWalletCount}`);
        assert(k.nonAdminUsersWithoutWalletCount === 1, `Expected 1 missing-wallet consumer, got ${k.nonAdminUsersWithoutWalletCount}`);
        assert(k.walletToUserCoveragePct === 66.7, `Expected 66.7% coverage, got ${k.walletToUserCoveragePct}`);
        assert(k.walletReconciliationDiscrepanciesCount === 1, `Expected 1 reconciliation discrepancy for missing wallet, got ${k.walletReconciliationDiscrepanciesCount}`);
        assert(k.walletReconciliationMatched === false, 'walletReconciliationMatched must be false');

        return `KPI-18=1 (zero-bal excluded), KPI-19=66.7% (2/3), KPI-31 detected 1 missing-wallet discrepancy`;
      }
    );

    // KPI-TEST-04: Corrupted ledger arithmetic (KPI-30) and direct unlogged wallet mutation (KPI-31)
    await runCase(
      'KPI-TEST-04',
      'Detect corrupted balanceAfter math in KPI-30 and unlogged wallet balance drift in KPI-31',
      async () => {
        await WalletTransaction.create({
          transactionId: 'TXN-BAD-MATH',
          userId: 'USR-ZERO-BAL',
          currency: 'ves',
          type: 'CREDIT',
          amount: 100,
          balanceBefore: 0,
          balanceAfter: 999, // Corrupted arithmetic
          source: 'BONUS',
          status: 'COMPLETED',
          description: 'Corrupted math test record'
        });

        const res = await fetch(`${baseUrl}/admin/analytics`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        const data: any = await res.json();
        const k = data.kpis;

        assert(k.ledgerInvalidRowsCount === 1, `Expected 1 invalid ledger row, got ${k.ledgerInvalidRowsCount}`);
        assert(k.ledgerArithmeticIntegrityPct < 100, `Expected KPI-30 < 100%, got ${k.ledgerArithmeticIntegrityPct}`);
        // Also USR-ZERO-BAL wallet is 0 while TXN-BAD-MATH credited 100 -> discrepancy count increases
        assert(k.walletReconciliationDiscrepanciesCount === 2, `Expected 2 reconciliation discrepancies, got ${k.walletReconciliationDiscrepanciesCount}`);

        return `Detected 1 invalid math row (KPI-30=${k.ledgerArithmeticIntegrityPct}%) and 2 reconciliation discrepancies`;
      }
    );

    // KPI-TEST-05: Symmetrical UTC date boundary filtering
    await runCase(
      'KPI-TEST-05',
      'Enforce symmetrical UTC 00:00:00.000Z to 23:59:59.999Z boundaries for startDate and endDate',
      async () => {
        const s = parseUtcDateBoundary('2026-11-18', 'start');
        const e = parseUtcDateBoundary('2026-11-18', 'end');
        assert(s?.toISOString() === '2026-11-18T00:00:00.000Z', 'Start boundary must be UTC midnight');
        assert(e?.toISOString() === '2026-11-18T23:59:59.999Z', 'End boundary must be UTC 23:59:59.999Z');

        await WalletTransaction.deleteMany({});
        await WalletTransaction.insertMany([
          {
            transactionId: 'TXN-UTC-BEFORE',
            userId: 'USR-DEMO-001',
            currency: 'ves',
            type: 'CREDIT',
            amount: 100,
            balanceBefore: 0,
            balanceAfter: 100,
            source: 'BONUS',
            status: 'COMPLETED',
            description: '1ms before start UTC',
            createdAt: new Date('2026-11-17T23:59:59.999Z')
          },
          {
            transactionId: 'TXN-UTC-START',
            userId: 'USR-DEMO-001',
            currency: 'ves',
            type: 'CREDIT',
            amount: 200,
            balanceBefore: 100,
            balanceAfter: 300,
            source: 'DAILY_REWARD',
            status: 'COMPLETED',
            description: 'Exact UTC start',
            createdAt: new Date('2026-11-18T00:00:00.000Z')
          },
          {
            transactionId: 'TXN-UTC-END',
            userId: 'USR-DEMO-001',
            currency: 'ves',
            type: 'CREDIT',
            amount: 400,
            balanceBefore: 300,
            balanceAfter: 700,
            source: 'BONUS',
            status: 'COMPLETED',
            description: 'Exact UTC end millisecond',
            createdAt: new Date('2026-11-18T23:59:59.999Z')
          },
          {
            transactionId: 'TXN-UTC-AFTER',
            userId: 'USR-DEMO-001',
            currency: 'ves',
            type: 'CREDIT',
            amount: 800,
            balanceBefore: 700,
            balanceAfter: 1500,
            source: 'BONUS',
            status: 'COMPLETED',
            description: '1ms after end UTC',
            createdAt: new Date('2026-11-19T00:00:00.000Z')
          }
        ]);

        const res = await fetch(`${baseUrl}/admin/analytics?startDate=2026-11-18&endDate=2026-11-18`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        const data: any = await res.json();
        assert(data.dateFilter.startDateUtc === '2026-11-18T00:00:00.000Z', 'Response startDateUtc mismatch');
        assert(data.dateFilter.endDateUtc === '2026-11-18T23:59:59.999Z', 'Response endDateUtc mismatch');
        assert(data.kpis.vesTransactionsCount === 2, `Expected 2 txns inside UTC day, got ${data.kpis.vesTransactionsCount}`);
        assert(data.kpis.totalCreditsVes === 600, `Expected 200+400=600 VEs inside UTC day, got ${data.kpis.totalCreditsVes}`);
        assert(data.kpis.dailyRewardVesDistributed === 200, `Expected KPI-25=200, got ${data.kpis.dailyRewardVesDistributed}`);
        assert(data.kpis.avgVesTransactionSize === 300, `Expected KPI-33=300, got ${data.kpis.avgVesTransactionSize}`);

        return 'UTC boundary included 00:00:00.000Z & 23:59:59.999Z (2 txns = 600 VEs) and excluded ±1ms neighbors';
      }
    );

    // KPI-TEST-06: Empty database / zero-denominator safety
    await runCase(
      'KPI-TEST-06',
      'Return safe zero values without NaN or Infinity on empty collections (HTTP + AnalyticsService)',
      async () => {
        await Promise.all([
          WalletTransaction.deleteMany({}),
          Wallet.deleteMany({}),
          Withdrawal.deleteMany({}),
          PayoutOption.deleteMany({}),
          User.deleteMany({ role: 'user' })
        ]);

        // HTTP check with 1 admin user and empty wallets/txns/options/withdrawals
        const res = await fetch(`${baseUrl}/admin/analytics`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        const httpData: any = await res.json();
        assert(res.status === 200 && httpData.success, 'HTTP call with empty collections must return 200');
        const hk = httpData.kpis;
        assert(hk.walletToUserCoveragePct === 0, 'Empty non-admin user coverage must be 0');
        assert(hk.payoutEligibleUsersCount === 0 && hk.minPayoutRequiredVes === null, 'Empty payout options must yield 0 eligible & null min');
        assert(hk.dailyRewardVesDistributed === 0, 'Empty daily reward must be 0');
        assert(hk.adminManualAdjustmentsSharePct === 0, 'Empty admin share must be 0');
        assert(hk.ledgerArithmeticIntegrityPct === 0 && hk.ledgerRowsCheckedCount === 0, 'Empty ledger integrity must be 0 with 0 checked');
        assert(hk.walletReconciliationDiscrepanciesCount === 0 && hk.walletReconciliationMatched === true, 'Empty reconciliation must have 0 discrepancies');
        assert(hk.avgVesTransactionSize === 0, 'Empty avg tx size must be 0');
        assert(hk.withdrawalApprovalRatePct === 0, 'Empty withdrawal approval rate must be 0');

        // Also delete admin user to verify AnalyticsService with 100% empty DB (0 users)
        await User.deleteMany({});
        const emptyData = await AnalyticsService.getAdminAnalytics({});
        assert(emptyData.kpis.totalUsers === 0 && emptyData.kpis.activeUserRatePct === 0, '0-user activeUserRatePct must be 0');
        assert(!Object.values(emptyData.kpis).some((v) => typeof v === 'number' && !Number.isFinite(v)), 'No NaN/Infinity permitted in kpis');

        return 'All denominators=0 handled cleanly without NaN/Infinity across HTTP & completely empty DB';
      }
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeDB();
  }

  console.log('\n==================================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`TOTAL: ${results.length} | PASS: ${passed} | FAIL: ${failed}`);
  console.log('==================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runKpiAnalyticsSuite().catch((err) => {
  console.log('Fatal KPI analytics suite error:', err?.message || err);
  process.exit(1);
});
