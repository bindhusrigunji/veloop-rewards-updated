import http from 'http';
import { AddressInfo } from 'net';
import { connectDB, closeDB } from '../server/db.js';
import { createApp } from '../server/app.js';
import { seedInitialData } from '../server/seed/seedData.js';
import { Wallet } from '../server/models/Wallet.js';
import { WalletTransaction } from '../server/models/WalletTransaction.js';
import { Withdrawal } from '../server/models/Withdrawal.js';
import { AuditLog } from '../server/models/AuditLog.js';
import { WalletService } from '../server/services/walletService.js';
import { PayoutService } from '../server/services/payoutService.js';

interface SecurityTestResult {
  testId: string;
  description: string;
  status: 'PASS' | 'FAIL';
  actualResult: string;
  durationMs: number;
}

const results: SecurityTestResult[] = [];

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

async function runWithdrawalSecuritySuite() {
  console.log('==================================================================');
  console.log('   VELoop Rewards — Withdrawal State & Concurrency Security Suite ');
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

    // WS-01: Approved withdrawal cannot be rejected, refunded, or re-approved
    await runCase(
      'WS-01',
      'Prevent rejection/refund and re-approval after a withdrawal is APPROVED',
      async () => {
        const uid = `USR-WS01-${Date.now()}`;
        await Wallet.create({ userId: uid, ves: 4000, sves: 0, gems: 0, tokens: 0, spins: 0 });
        const wdl = await PayoutService.requestWithdrawal({
          userId: uid,
          optionId: 'OPT-UPI-250',
          payoutDetails: 'ws01@upi'
        });

        const approveRes = await fetch(`${baseUrl}/admin/withdrawals/${wdl.withdrawalId}/approve`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ reviewNote: 'Payout settled' })
        });
        assert(approveRes.status === 200, `Expected 200 on initial approve, got ${approveRes.status}`);

        const rejectAfterApproveRes = await fetch(`${baseUrl}/admin/withdrawals/${wdl.withdrawalId}/reject`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ rejectionReason: 'Attempt late reversal' })
        });
        const rejectData: any = await rejectAfterApproveRes.json();
        assert(rejectAfterApproveRes.status === 400, `Expected 400 on reject after approve, got ${rejectAfterApproveRes.status}`);

        const reApproveRes = await fetch(`${baseUrl}/admin/withdrawals/${wdl.withdrawalId}/approve`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ reviewNote: 'Duplicate approval attempt' })
        });
        assert(reApproveRes.status === 400, `Expected 400 on duplicate approve, got ${reApproveRes.status}`);

        const finalWdl = await Withdrawal.findOne({ withdrawalId: wdl.withdrawalId });
        const wallet = await WalletService.getWallet(uid);
        const refundCount = await WalletTransaction.countDocuments({
          userId: uid,
          referenceId: wdl.withdrawalId,
          source: 'REFUND'
        });

        assert(finalWdl?.status === 'APPROVED', `Expected APPROVED, got ${finalWdl?.status}`);
        assert(wallet.ves === 1000, `Expected balance to stay 1000 VEs, got ${wallet.ves}`);
        assert(refundCount === 0, `Expected 0 REFUND transactions, got ${refundCount}`);

        return `APPROVED blocked reject (400: "${rejectData.message}") & re-approve (400); balance=1000 VEs; refunds=0`;
      }
    );

    // WS-02: Rejected withdrawal cannot be rejected again (no double refund) or approved later
    await runCase(
      'WS-02',
      'Prevent repeated rejection (double refund) and subsequent approval after REJECTED',
      async () => {
        const uid = `USR-WS02-${Date.now()}`;
        await Wallet.create({ userId: uid, ves: 4000, sves: 0, gems: 0, tokens: 0, spins: 0 });
        const wdl = await PayoutService.requestWithdrawal({
          userId: uid,
          optionId: 'OPT-UPI-250',
          payoutDetails: 'ws02@upi'
        });

        const firstRejectRes = await fetch(`${baseUrl}/admin/withdrawals/${wdl.withdrawalId}/reject`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ rejectionReason: 'Beneficiary VPA invalid' })
        });
        assert(firstRejectRes.status === 200, `Expected 200 on first reject, got ${firstRejectRes.status}`);

        const secondRejectRes = await fetch(`${baseUrl}/admin/withdrawals/${wdl.withdrawalId}/reject`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ rejectionReason: 'Duplicate reject attempt' })
        });
        const secondRejectData: any = await secondRejectRes.json();
        assert(secondRejectRes.status === 400, `Expected 400 on repeated reject, got ${secondRejectRes.status}`);

        const approveAfterRejectRes = await fetch(`${baseUrl}/admin/withdrawals/${wdl.withdrawalId}/approve`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ reviewNote: 'Should not approve rejected' })
        });
        assert(approveAfterRejectRes.status === 400, `Expected 400 on approve after reject, got ${approveAfterRejectRes.status}`);

        const finalWdl = await Withdrawal.findOne({ withdrawalId: wdl.withdrawalId });
        const wallet = await WalletService.getWallet(uid);
        const refundTxs = await WalletTransaction.find({
          userId: uid,
          referenceId: wdl.withdrawalId,
          source: 'REFUND'
        });

        assert(finalWdl?.status === 'REJECTED', `Expected REJECTED, got ${finalWdl?.status}`);
        assert(wallet.ves === 4000, `Expected 4000 VEs (refunded once), got ${wallet.ves}`);
        assert(refundTxs.length === 1, `Expected 1 REFUND transaction, got ${refundTxs.length}`);
        assert(refundTxs[0].balanceBefore === 1000 && refundTxs[0].balanceAfter === 4000, 'Refund ledger math mismatch');

        return `First reject refunded once (1000 -> 4000 VEs); repeat reject (400: "${secondRejectData.message}") & post-reject approve (400) blocked`;
      }
    );

    // WS-03: CANCELLED withdrawal cannot be approved or rejected/refunded
    await runCase(
      'WS-03',
      'Block approval and rejection/refund on CANCELLED withdrawal',
      async () => {
        const uid = `USR-WS03-${Date.now()}`;
        await Wallet.create({ userId: uid, ves: 4000, sves: 0, gems: 0, tokens: 0, spins: 0 });
        const wdl = await PayoutService.requestWithdrawal({
          userId: uid,
          optionId: 'OPT-UPI-250',
          payoutDetails: 'ws03@upi'
        });
        await Withdrawal.updateOne({ withdrawalId: wdl.withdrawalId }, { $set: { status: 'CANCELLED' } });

        const approveRes = await fetch(`${baseUrl}/admin/withdrawals/${wdl.withdrawalId}/approve`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ reviewNote: 'Try approve cancelled' })
        });
        const rejectRes = await fetch(`${baseUrl}/admin/withdrawals/${wdl.withdrawalId}/reject`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ rejectionReason: 'Try reject cancelled' })
        });

        assert(approveRes.status === 400, `Expected 400 approving CANCELLED, got ${approveRes.status}`);
        assert(rejectRes.status === 400, `Expected 400 rejecting CANCELLED, got ${rejectRes.status}`);

        const finalWdl = await Withdrawal.findOne({ withdrawalId: wdl.withdrawalId });
        const wallet = await WalletService.getWallet(uid);
        const refundCount = await WalletTransaction.countDocuments({
          userId: uid,
          referenceId: wdl.withdrawalId,
          source: 'REFUND'
        });

        assert(finalWdl?.status === 'CANCELLED', `Expected CANCELLED, got ${finalWdl?.status}`);
        assert(wallet.ves === 1000, `Expected balance unchanged at 1000 VEs, got ${wallet.ves}`);
        assert(refundCount === 0, `Expected 0 REFUND transactions, got ${refundCount}`);

        return `CANCELLED withdrawal blocked both approve (400) and reject (400); balance stayed 1000 VEs; refunds=0`;
      }
    );

    // WS-04: Concurrent approve vs reject race (strictly one winner, zero conflicting refunds)
    await runCase(
      'WS-04',
      'Serialize concurrent approve and reject requests cleanly across multiple race trials',
      async () => {
        const winners: string[] = [];

        for (let i = 0; i < 3; i++) {
          const uid = `USR-WS04-${i}-${Date.now()}`;
          await Wallet.create({ userId: uid, ves: 4000, sves: 0, gems: 0, tokens: 0, spins: 0 });
          const wdl = await PayoutService.requestWithdrawal({
            userId: uid,
            optionId: 'OPT-UPI-250',
            payoutDetails: `ws04-${i}@upi`
          });

          const [approveRes, rejectRes] = await Promise.all([
            fetch(`${baseUrl}/admin/withdrawals/${wdl.withdrawalId}/approve`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
              body: JSON.stringify({ reviewNote: 'Concurrent approve' })
            }),
            fetch(`${baseUrl}/admin/withdrawals/${wdl.withdrawalId}/reject`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
              body: JSON.stringify({ rejectionReason: 'Concurrent reject' })
            })
          ]);

          const statuses = [approveRes.status, rejectRes.status].sort();
          assert(
            statuses[0] === 200 && statuses[1] === 400,
            `Trial ${i}: expected exactly one 200 and one 400, got [${approveRes.status}, ${rejectRes.status}]`
          );

          const finalWdl = await Withdrawal.findOne({ withdrawalId: wdl.withdrawalId });
          const wallet = await WalletService.getWallet(uid);
          const refundCount = await WalletTransaction.countDocuments({
            userId: uid,
            referenceId: wdl.withdrawalId,
            source: 'REFUND'
          });
          const auditCount = await AuditLog.countDocuments({
            referenceId: wdl.withdrawalId,
            action: { $in: ['WITHDRAWAL_APPROVED', 'WITHDRAWAL_REJECTED_REFUNDED'] }
          });

          assert(auditCount === 1, `Trial ${i}: expected 1 terminal AuditLog, got ${auditCount}`);

          if (approveRes.status === 200) {
            assert(finalWdl?.status === 'APPROVED', `Trial ${i}: status must be APPROVED`);
            assert(wallet.ves === 1000, `Trial ${i}: balance must stay 1000 VEs`);
            assert(refundCount === 0, `Trial ${i}: refundCount must be 0`);
            winners.push('APPROVED');
          } else {
            assert(finalWdl?.status === 'REJECTED', `Trial ${i}: status must be REJECTED`);
            assert(wallet.ves === 4000, `Trial ${i}: balance must refund to 4000 VEs`);
            assert(refundCount === 1, `Trial ${i}: refundCount must be 1`);
            winners.push('REJECTED');
          }
        }

        return `3/3 concurrent approve+reject trials had strictly 1 winner & 1 HTTP 400 rejection (winners: ${winners.join(', ')})`;
      }
    );

    // WS-05: Concurrent double-rejection race (no double refund)
    await runCase(
      'WS-05',
      'Prevent double refund under concurrent identical rejection requests across multiple trials',
      async () => {
        for (let i = 0; i < 3; i++) {
          const uid = `USR-WS05-${i}-${Date.now()}`;
          await Wallet.create({ userId: uid, ves: 4000, sves: 0, gems: 0, tokens: 0, spins: 0 });
          const wdl = await PayoutService.requestWithdrawal({
            userId: uid,
            optionId: 'OPT-UPI-250',
            payoutDetails: `ws05-${i}@upi`
          });

          const [r1, r2] = await Promise.all([
            fetch(`${baseUrl}/admin/withdrawals/${wdl.withdrawalId}/reject`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
              body: JSON.stringify({ rejectionReason: 'Concurrent reject A' })
            }),
            fetch(`${baseUrl}/admin/withdrawals/${wdl.withdrawalId}/reject`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
              body: JSON.stringify({ rejectionReason: 'Concurrent reject B' })
            })
          ]);

          const statuses = [r1.status, r2.status].sort();
          assert(
            statuses[0] === 200 && statuses[1] === 400,
            `Trial ${i}: expected [200, 400], got [${r1.status}, ${r2.status}]`
          );

          const finalWdl = await Withdrawal.findOne({ withdrawalId: wdl.withdrawalId });
          const wallet = await WalletService.getWallet(uid);
          const refundCount = await WalletTransaction.countDocuments({
            userId: uid,
            referenceId: wdl.withdrawalId,
            source: 'REFUND'
          });
          const auditCount = await AuditLog.countDocuments({
            referenceId: wdl.withdrawalId,
            action: 'WITHDRAWAL_REJECTED_REFUNDED'
          });

          assert(finalWdl?.status === 'REJECTED', `Trial ${i}: status must be REJECTED`);
          assert(wallet.ves === 4000, `Trial ${i}: expected single refund to 4000 VEs, got ${wallet.ves}`);
          assert(refundCount === 1, `Trial ${i}: expected 1 REFUND ledger entry, got ${refundCount}`);
          assert(auditCount === 1, `Trial ${i}: expected 1 WITHDRAWAL_REJECTED_REFUNDED audit log, got ${auditCount}`);
        }

        return `3/3 concurrent double-reject trials succeeded once (200), blocked once (400), refunded strictly once to 4000 VEs`;
      }
    );

    // WS-06: Concurrent double-approval & PROCESSING state support
    await runCase(
      'WS-06',
      'Serialize concurrent double-approval and allow transition from PROCESSING status',
      async () => {
        const uid = `USR-WS06-${Date.now()}`;
        await Wallet.create({ userId: uid, ves: 4000, sves: 0, gems: 0, tokens: 0, spins: 0 });
        const wdl = await PayoutService.requestWithdrawal({
          userId: uid,
          optionId: 'OPT-UPI-250',
          payoutDetails: 'ws06@upi'
        });
        await Withdrawal.updateOne({ withdrawalId: wdl.withdrawalId }, { $set: { status: 'PROCESSING' } });

        const [a1, a2] = await Promise.all([
          fetch(`${baseUrl}/admin/withdrawals/${wdl.withdrawalId}/approve`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ reviewNote: 'Concurrent approve 1' })
          }),
          fetch(`${baseUrl}/admin/withdrawals/${wdl.withdrawalId}/approve`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ reviewNote: 'Concurrent approve 2' })
          })
        ]);

        const statuses = [a1.status, a2.status].sort();
        assert(statuses[0] === 200 && statuses[1] === 400, `Expected [200, 400], got [${a1.status}, ${a2.status}]`);

        const finalWdl = await Withdrawal.findOne({ withdrawalId: wdl.withdrawalId });
        const auditCount = await AuditLog.countDocuments({
          referenceId: wdl.withdrawalId,
          action: 'WITHDRAWAL_APPROVED'
        });
        assert(finalWdl?.status === 'APPROVED', `Expected APPROVED, got ${finalWdl?.status}`);
        assert(auditCount === 1, `Expected 1 WITHDRAWAL_APPROVED audit log, got ${auditCount}`);

        return `PROCESSING withdrawal approved once (200), duplicate approve blocked (400), AuditLog count=1`;
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

runWithdrawalSecuritySuite().catch((err) => {
  console.log('Fatal withdrawal security suite error:', err?.message || err);
  process.exit(1);
});
