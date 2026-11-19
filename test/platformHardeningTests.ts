import http from 'http';
import { AddressInfo } from 'net';
import { connectDB, closeDB, maskMongoUri, classifyMongoError, pingDB } from '../server/db.js';
import { createApp } from '../server/app.js';
import { seedInitialData } from '../server/seed/seedData.js';
import { User } from '../server/models/User.js';
import { Wallet } from '../server/models/Wallet.js';
import { Referral } from '../server/models/Referral.js';
import { WalletTransaction } from '../server/models/WalletTransaction.js';
import { Withdrawal } from '../server/models/Withdrawal.js';
import { PayoutOption } from '../server/models/PayoutOption.js';
import { WalletService } from '../server/services/walletService.js';
import { PayoutService } from '../server/services/payoutService.js';
import { SandboxPaymentProvider } from '../server/services/paymentProvider.js';
import { ReferralService } from '../server/services/referralService.js';

interface TestResult {
  testId: string;
  description: string;
  status: 'PASS' | 'FAIL';
  actualResult: string;
  durationMs: number;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runCase(testId: string, description: string, fn: () => Promise<string>) {
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

async function runPlatformHardeningSuite() {
  console.log('==================================================================');
  console.log(' VELoop Rewards — Referral, Payout Sandbox, DB & Security Suite  ');
  console.log('==================================================================\n');

  await connectDB();
  await seedInitialData();

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  let adminToken = '';
  let userToken = '';
  let userId = '';
  let userEmail = '';
  let userReferralCode = '';

  try {
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@veloop.test', password: 'AdminSecure123!' })
    });
    const adminLoginData: any = await adminLoginRes.json();
    assert(adminLoginRes.status === 200 && Boolean(adminLoginData.token), 'Admin login must succeed');
    adminToken = adminLoginData.token;

    // PH-01: Unique referral code generation, public code validation & invite tracking
    await runCase(
      'PH-01',
      'Assign unique referralCode at registration, validate publicly, and track referral invites',
      async () => {
        userEmail = `ph01_${Date.now()}@veloop.test`;
        const regRes = await fetch(`${baseUrl}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Referrer User', email: userEmail, password: 'Password123!' })
        });
        const regData: any = await regRes.json();
        assert(regRes.status === 201 && Boolean(regData.user.referralCode), 'User must receive unique referralCode');
        userToken = regData.token;
        userId = regData.user.userId;
        userReferralCode = regData.user.referralCode;

        const valRes = await fetch(`${baseUrl}/referrals/validate/${encodeURIComponent(userReferralCode)}`);
        const valData: any = await valRes.json();
        assert(valRes.status === 200 && valData.valid === true, 'Valid referral code check must succeed');

        const badValRes = await fetch(`${baseUrl}/referrals/validate/VEL-DOESNOTEXIST`);
        const badValData: any = await badValRes.json();
        assert(badValRes.status === 200 && badValData.valid === false, 'Unknown code must return valid=false');

        const inviteEmail = `ph01_invited_${Date.now()}@veloop.test`;
        const invRes = await fetch(`${baseUrl}/referrals/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
          body: JSON.stringify({ refereeEmail: inviteEmail })
        });
        const invData: any = await invRes.json();
        assert(invRes.status === 201 && invData.referral.status === 'INVITED', 'Invite must be stored as INVITED');
        assert(invData.referral.rewardAmountVes === 0, 'Invite rewardAmountVes must stay 0 pending business rules');

        return `Issued ${userReferralCode}; validate=${valData.valid}; recorded INVITED referral (${invData.referral.referralId})`;
      }
    );

    // PH-02: Self-referral, duplicate invite, and invalid referralCode rejection
    await runCase(
      'PH-02',
      'Block self-referral invites, self-referral attribution, and invalid referral codes',
      async () => {
        const selfInvRes = await fetch(`${baseUrl}/referrals/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
          body: JSON.stringify({ refereeEmail: userEmail })
        });
        assert(selfInvRes.status === 400, `Self-invite must return 400, got ${selfInvRes.status}`);

        const badRegRes = await fetch(`${baseUrl}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Invalid Code Signup',
            email: `ph02_bad_${Date.now()}@veloop.test`,
            password: 'Password123!',
            referralCode: 'INVALID-CODE-999'
          })
        });
        assert(badRegRes.status === 400, `Invalid referralCode at signup must return 400, got ${badRegRes.status}`);

        let selfAttrBlocked = false;
        try {
          const selfUser = await User.findOne({ userId });
          await ReferralService.attributeSignup({ newUser: selfUser!, referralCode: userReferralCode });
        } catch {
          selfAttrBlocked = true;
        }
        assert(selfAttrBlocked, 'ReferralService must block self-referral attribution');

        return 'Self-invite blocked (400), bad signup referralCode blocked (400), and self-attribution rejected';
      }
    );

    // PH-03: Referred signup attribution with zero unapproved VEs payouts + duplicate attribution lock + admin visibility
    await runCase(
      'PH-03',
      'Attribute referred signup with rewardRuleStatus=PENDING_BUSINESS_RULE (0 auto VEs), prevent duplicates, and expose via admin API',
      async () => {
        const friendEmail = `ph03_friend_${Date.now()}@veloop.test`;
        const regRes = await fetch(`${baseUrl}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Referred Friend',
            email: friendEmail,
            password: 'Password123!',
            referralCode: userReferralCode
          })
        });
        const regData: any = await regRes.json();
        assert(regRes.status === 201, `Referred signup failed: ${regData.message}`);
        assert(regData.user.referredByUserId === userId, 'referredByUserId must reference referrer');

        const referrerWallet = await WalletService.getWallet(userId);
        assert(referrerWallet.ves === 1000, `Referrer VEs must stay 1000 (0 auto referral reward), got ${referrerWallet.ves}`);

        const refDoc = await Referral.findOne({ refereeUserId: regData.user.userId });
        assert(refDoc !== null && refDoc.status === 'REGISTERED', 'Referral doc must record REGISTERED');
        assert(refDoc.rewardAmountVes === 0 && refDoc.rewardRuleStatus === 'PENDING_BUSINESS_RULE', 'Reward must remain unapproved at 0 VEs');

        // Duplicate attribution on already attributed user must throw
        let dupBlocked = false;
        try {
          const refereeDoc = await User.findOne({ userId: regData.user.userId });
          await ReferralService.attributeSignup({ newUser: refereeDoc!, referralCode: userReferralCode });
        } catch {
          dupBlocked = true;
        }
        assert(dupBlocked, 'Duplicate attribution on same user must be blocked');

        const adminRefRes = await fetch(`${baseUrl}/admin/referrals`, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        const adminRefData: any = await adminRefRes.json();
        assert(adminRefRes.status === 200 && adminRefData.summary.registeredCount >= 1, 'Admin referrals endpoint must report registeredCount');

        return `Attributed ${regData.user.userId} -> ${userId} (0 auto VEs); duplicate attribution blocked; admin conversion=${adminRefData.summary.conversionRatePct}%`;
      }
    );

    // PH-04: SandboxPaymentProvider validation, payoutCurrency snapshot, and concurrent duplicate idempotencyKey guard
    await runCase(
      'PH-04',
      'Snapshot Withdrawal.payoutCurrency, record SandboxPaymentProvider reference on approve, and serialize concurrent duplicate idempotencyKey',
      async () => {
        const provider = new SandboxPaymentProvider();
        let badUpiRejected = false;
        try {
          provider.validateBeneficiary('UPI', 'not-a-valid-upi');
        } catch {
          badUpiRejected = true;
        }
        assert(badUpiRejected, 'Invalid UPI ID without valid VPA pattern must fail');

        const uid = `USR-PH04-${Date.now()}`;
        await Wallet.create({ userId: uid, ves: 9000, sves: 0, gems: 0, tokens: 0, spins: 0 });

        const sharedKey = `RACE-IDEM-${Date.now()}`;
        const [wA, wB] = await Promise.all([
          PayoutService.requestWithdrawal({
            userId: uid,
            optionId: 'OPT-UPI-250',
            payoutDetails: 'ph04@okhdfcbank',
            idempotencyKey: sharedKey
          }),
          PayoutService.requestWithdrawal({
            userId: uid,
            optionId: 'OPT-UPI-250',
            payoutDetails: 'ph04@okhdfcbank',
            idempotencyKey: sharedKey
          })
        ]);

        assert(wA.withdrawalId === wB.withdrawalId, 'Parallel requests with identical idempotencyKey must resolve to same withdrawal');
        const walletAfterReq = await WalletService.getWallet(uid);
        assert(walletAfterReq.ves === 6000, `Expected single 3000 VE deduction (9000 -> 6000), got ${walletAfterReq.ves}`);
        assert(wA.payoutCurrency === 'INR', `Expected payoutCurrency=INR, got ${wA.payoutCurrency}`);
        assert(wA.providerMode === 'SANDBOX_SIMULATED', `Expected providerMode=SANDBOX_SIMULATED`);

        const approved = await PayoutService.approveWithdrawal(wA.withdrawalId, 'ADM-VELOOP-999', 'Sandbox test');
        assert(approved.status === 'APPROVED', 'Withdrawal must be approved');
        assert(Boolean(approved.providerReferenceId?.startsWith('SBX-')), `Expected SBX-* providerReferenceId, got ${approved.providerReferenceId}`);

        return `payoutCurrency=INR; parallel idempotency debited once (6000 VEs left); ref=${approved.providerReferenceId}`;
      }
    );

    // PH-05: Security hardening checks (mass assignment, currency injection, Infinity amount, pagination clamp, ReDoS escape, headers)
    await runCase(
      'PH-05',
      'Enforce mass-assignment blocking, currency allowlist, finite bounds, pagination clamping, ReDoS escape, and security headers',
      async () => {
        // 1) Invalid currency & Infinity rejection
        let badCurrencyBlocked = false;
        try {
          await WalletService.creditWallet({
            userId,
            currency: '__proto__' as any,
            amount: 100,
            source: 'BONUS'
          });
        } catch {
          badCurrencyBlocked = true;
        }
        assert(badCurrencyBlocked, 'Invalid currency __proto__ must be rejected');

        let infBlocked = false;
        try {
          await WalletService.creditWallet({
            userId,
            currency: 'ves',
            amount: Infinity,
            source: 'BONUS'
          });
        } catch {
          infBlocked = true;
        }
        assert(infBlocked, 'Infinity credit amount must be rejected');

        // 2) Mass-assignment attempt on PATCH /api/admin/payout-options/:id
        const massAssignRes = await fetch(`${baseUrl}/admin/payout-options/OPT-UPI-250`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ optionId: 'HACKED-ID', __v: 999 })
        });
        assert(massAssignRes.status === 400, `Expected 400 when only non-whitelisted fields sent, got ${massAssignRes.status}`);

        const validPatchRes = await fetch(`${baseUrl}/admin/payout-options/OPT-UPI-250`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ payoutValue: 250, optionId: 'IGNORED-INJECTION' })
        });
        const validPatchData: any = await validPatchRes.json();
        assert(validPatchRes.status === 200 && validPatchData.option.optionId === 'OPT-UPI-250', 'optionId must remain immutable');

        // 3) Negative page & oversized limit clamped cleanly
        const txPagRes = await fetch(`${baseUrl}/wallet/transactions?page=-5&limit=5000`, {
          headers: { Authorization: `Bearer ${userToken}` }
        });
        const txPagData: any = await txPagRes.json();
        assert(txPagRes.status === 200 && txPagData.pagination.page === 1 && txPagData.pagination.limit === 100, 'Pagination must clamp page>=1 & limit<=100');

        // 4) Regex metacharacters on /api/payout/options/:method safely escaped
        const redosRes = await fetch(`${baseUrl}/payout/options/${encodeURIComponent('(.*)+[a-z]')}`);
        const redosData: any = await redosRes.json();
        assert(redosRes.status === 200 && Array.isArray(redosData.options) && redosData.options.length === 0, 'Escaped regex must safely return empty array');

        // 5) Security response headers
        assert(txPagRes.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options header must equal nosniff');
        assert(txPagRes.headers.get('referrer-policy') === 'no-referrer', 'Referrer-Policy header must be set');
        assert(txPagRes.headers.get('x-powered-by') === null, 'X-Powered-By must be disabled');

        return 'Currency allowlist, Infinity guard, optionId immutability, pagination clamp (1..100), ReDoS escape & headers verified';
      }
    );

    // PH-06: Database health diagnostics, live ping & credential masking
    await runCase(
      'PH-06',
      'Report live DB ping, persistent/sandbox classification in /api/health, and mask URI secrets safely',
      async () => {
        const masked = maskMongoUri('mongodb+srv://veloop_admin:Sup3rS3cret!Pass@cluster0.example.mongodb.net/veloop_rewards');
        assert(!masked.includes('Sup3rS3cret'), 'URI masking must strip database password');
        assert(masked.includes('****'), 'URI masking must substitute ****');
        assert(classifyMongoError('Authentication failed.') === 'AUTH_FAILED', 'Error classifier must identify AUTH_FAILED');

        const ping = await pingDB();
        assert(ping.ok === true, 'Live pingDB must succeed');

        const healthRes = await fetch(`${baseUrl}/health`);
        const healthData: any = await healthRes.json();
        assert(healthRes.status === 200 && healthData.status === 'healthy', '/api/health must return 200 healthy');
        assert(healthData.database.pingOk === true, 'database.pingOk must be true');
        assert(healthData.database.persistent === false, 'Embedded sandbox must report persistent=false');
        assert(
          healthData.database.dataClassification === 'SIMULATED_SANDBOX_FALLBACK',
          'Embedded sandbox must report SIMULATED_SANDBOX_FALLBACK'
        );

        return `Health 200 (pingOk=true, latencyMs=${healthData.database.latencyMs}, persistent=false); URI password masked`;
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

runPlatformHardeningSuite().catch((err) => {
  console.log('Fatal platform hardening suite error:', err?.message || err);
  process.exit(1);
});
