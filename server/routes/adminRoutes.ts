import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Wallet } from '../models/Wallet.js';
import { Withdrawal } from '../models/Withdrawal.js';
import { AuditLog } from '../models/AuditLog.js';
import { PayoutOption } from '../models/PayoutOption.js';
import { WalletService } from '../services/walletService.js';
import { PayoutService } from '../services/payoutService.js';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/users', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    const userIds = users.map((u) => u.userId);
    const wallets = await Wallet.find({ userId: { $in: userIds } });
    const walletMap = new Map(wallets.map((w) => [w.userId, w]));

    const result = users.map((u) => ({
      userId: u.userId,
      name: u.name,
      email: u.email,
      role: u.role,
      accountStatus: u.accountStatus,
      referralCode: u.referralCode,
      referredByUserId: u.referredByUserId,
      createdAt: u.createdAt,
      wallet: walletMap.get(u.userId) || {
        ves: 0,
        sves: 0,
        gems: 0,
        tokens: 0,
        spins: 0
      }
    }));

    res.json({ success: true, users: result });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

router.get('/withdrawals', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string;
    const query: Record<string, any> = {};
    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }

    const withdrawals = await Withdrawal.find(query).sort({ requestedAt: -1 });

    const userIds = Array.from(new Set(withdrawals.map((w) => w.userId)));
    const users = await User.find({ userId: { $in: userIds } });
    const userMap = new Map(users.map((u) => [u.userId, { name: u.name, email: u.email }]));

    const enriched = withdrawals.map((w) => ({
      ...w.toObject(),
      user: userMap.get(w.userId) || { name: 'Unknown User', email: 'N/A' }
    }));

    res.json({ success: true, withdrawals: enriched });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch withdrawals' });
  }
});

router.patch('/withdrawals/:id/approve', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const withdrawalId = req.params.id;
    const { reviewNote } = req.body;
    const adminId = req.user!.userId;

    const withdrawal = await PayoutService.approveWithdrawal(withdrawalId, adminId, reviewNote);

    res.json({
      success: true,
      message: `Withdrawal ${withdrawalId} has been successfully approved!`,
      withdrawal
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.patch('/withdrawals/:id/reject', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const withdrawalId = req.params.id;
    const { rejectionReason } = req.body;
    const adminId = req.user!.userId;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      res.status(400).json({ success: false, message: 'A rejection reason is required for audit compliance' });
      return;
    }

    const withdrawal = await PayoutService.rejectWithdrawal(withdrawalId, adminId, rejectionReason);

    res.json({
      success: true,
      message: `Withdrawal ${withdrawalId} rejected. ${withdrawal.currencyAmount} VEs have been refunded back to user.`,
      withdrawal
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/wallet/credit', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { targetUserId, currency, amount, reason } = req.body;

    if (!targetUserId || !currency || !amount) {
      res.status(400).json({ success: false, message: 'targetUserId, currency, and amount are required' });
      return;
    }

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      res.status(400).json({ success: false, message: 'Amount must be a positive finite number' });
      return;
    }

    const user = await User.findOne({ userId: targetUserId });
    if (!user) {
      res.status(404).json({ success: false, message: 'Target user does not exist' });
      return;
    }

    const result = await WalletService.creditWallet({
      userId: targetUserId,
      currency,
      amount: numAmount,
      source: 'ADMIN_CREDIT',
      description: reason || `Admin credit granted by ${req.user!.name} (${req.user!.email})`
    });

    await AuditLog.create({
      actorId: req.user!.userId,
      action: 'ADMIN_WALLET_CREDIT',
      targetUserId,
      targetType: 'Wallet',
      metadata: { currency, amount: numAmount, reason }
    });

    res.json({
      success: true,
      message: `Successfully credited ${numAmount} ${currency.toUpperCase()} to ${user.name}`,
      wallet: result.wallet,
      transaction: result.transaction
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/wallet/debit', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { targetUserId, currency, amount, reason } = req.body;

    if (!targetUserId || !currency || !amount) {
      res.status(400).json({ success: false, message: 'targetUserId, currency, and amount are required' });
      return;
    }

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      res.status(400).json({ success: false, message: 'Amount must be a positive finite number' });
      return;
    }

    const user = await User.findOne({ userId: targetUserId });
    if (!user) {
      res.status(404).json({ success: false, message: 'Target user does not exist' });
      return;
    }

    const result = await WalletService.debitWallet({
      userId: targetUserId,
      currency,
      amount: numAmount,
      source: 'ADMIN_DEBIT',
      description: reason || `Admin debit processed by ${req.user!.name} (${req.user!.email})`
    });

    await AuditLog.create({
      actorId: req.user!.userId,
      action: 'ADMIN_WALLET_DEBIT',
      targetUserId,
      targetType: 'Wallet',
      metadata: { currency, amount: numAmount, reason }
    });

    res.json({
      success: true,
      message: `Successfully debited ${numAmount} ${currency.toUpperCase()} from ${user.name}`,
      wallet: result.wallet,
      transaction: result.transaction
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/audit-logs', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsedLimit = parseInt(req.query.limit as string, 10);
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(200, parsedLimit)) : 50;
    const logs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(limit);
    res.json({ success: true, logs });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to retrieve audit trail' });
  }
});

router.post('/payout-options', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, type, currency, payoutValue, requiredAmount, active, metadata } = req.body;

    if (!name || !type || !payoutValue || !requiredAmount) {
      res.status(400).json({ success: false, message: 'Missing required payout option parameters' });
      return;
    }

    const numPayout = Number(payoutValue);
    const numRequired = Number(requiredAmount);
    if (!Number.isFinite(numPayout) || numPayout <= 0 || !Number.isFinite(numRequired) || numRequired < 1) {
      res.status(400).json({ success: false, message: 'payoutValue (> 0) and requiredAmount (>= 1) must be finite numbers' });
      return;
    }

    const optionId = `OPT-${type.toUpperCase().replace(/\s+/g, '-')}-${numPayout}-${randomUUID().slice(0, 4)}`;

    const newOption = await PayoutOption.create({
      optionId,
      methodId: `METHOD-${type.toUpperCase().replace(/\s+/g, '-')}`,
      name,
      type,
      currency: currency || 'USD',
      payoutValue: numPayout,
      requiredAmount: numRequired,
      active: active !== undefined ? Boolean(active) : true,
      metadata: metadata || {}
    });

    await AuditLog.create({
      actorId: req.user!.userId,
      action: 'PAYOUT_OPTION_CREATED',
      targetType: 'PayoutOption',
      referenceId: optionId,
      metadata: { name, type, requiredAmount: numRequired }
    });

    res.status(201).json({ success: true, option: newOption });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.patch('/payout-options/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const optionId = req.params.id;
    const body = req.body || {};

    // Strict allowlist prevents mass-assignment of internal keys (_id, optionId, __v)
    const allowedUpdates: Record<string, any> = {};
    if (typeof body.name === 'string' && body.name.trim()) allowedUpdates.name = body.name.trim();
    if (typeof body.type === 'string' && body.type.trim()) allowedUpdates.type = body.type.trim();
    if (typeof body.currency === 'string' && ['INR', 'USD'].includes(body.currency.toUpperCase())) {
      allowedUpdates.currency = body.currency.toUpperCase();
    }
    if (body.payoutValue !== undefined) {
      const pv = Number(body.payoutValue);
      if (!Number.isFinite(pv) || pv <= 0) {
        res.status(400).json({ success: false, message: 'payoutValue must be a positive finite number' });
        return;
      }
      allowedUpdates.payoutValue = pv;
    }
    if (body.requiredAmount !== undefined) {
      const ra = Number(body.requiredAmount);
      if (!Number.isFinite(ra) || ra < 1) {
        res.status(400).json({ success: false, message: 'requiredAmount must be >= 1' });
        return;
      }
      allowedUpdates.requiredAmount = ra;
    }
    if (typeof body.active === 'boolean') allowedUpdates.active = body.active;
    if (body.eligibility && typeof body.eligibility === 'object' && !Array.isArray(body.eligibility)) {
      allowedUpdates.eligibility = body.eligibility;
    }
    if (body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)) {
      allowedUpdates.metadata = body.metadata;
    }

    if (Object.keys(allowedUpdates).length === 0) {
      res.status(400).json({ success: false, message: 'No valid updatable payout option fields provided' });
      return;
    }

    const option = await PayoutOption.findOneAndUpdate(
      { $or: [{ optionId }, { _id: optionId.match(/^[0-9a-fA-F]{24}$/) ? optionId : null }] },
      { $set: allowedUpdates },
      { returnDocument: 'after' }
    );

    if (!option) {
      res.status(404).json({ success: false, message: 'Payout option not found' });
      return;
    }

    await AuditLog.create({
      actorId: req.user!.userId,
      action: 'PAYOUT_OPTION_UPDATED',
      targetType: 'PayoutOption',
      referenceId: option.optionId,
      metadata: allowedUpdates
    });

    res.json({ success: true, option });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/referrals', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ReferralService } = await import('../services/referralService.js');
    const overview = await ReferralService.getAdminReferralsOverview();
    res.json({ success: true, ...overview });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch referrals' });
  }
});

router.get('/analytics', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { AnalyticsService } = await import('../services/analyticsService.js');
    const analytics = await AnalyticsService.getAdminAnalytics({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      currency: (req.query.currency as string) || 'ALL',
      source: (req.query.source as string) || 'ALL',
      search: (req.query.search as string) || undefined
    });
    res.json(analytics);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to compute analytics' });
  }
});

router.get('/user-conflicts', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [users, wallets] = await Promise.all([
      User.find({}).lean(),
      Wallet.find({}).lean()
    ]);

    const emailGroups = new Map<string, typeof users>();
    for (const u of users) {
      const canonicalEmail = (u.email || '').trim().toLowerCase();
      if (!emailGroups.has(canonicalEmail)) emailGroups.set(canonicalEmail, []);
      emailGroups.get(canonicalEmail)!.push(u);
    }

    const duplicateEmails = Array.from(emailGroups.entries())
      .filter(([, list]) => list.length > 1)
      .map(([email, list]) => ({
        canonicalEmail: email,
        count: list.length,
        userIds: list.map((u) => u.userId)
      }));

    const userIdsSet = new Set(users.map((u) => u.userId));
    const walletUserIdsSet = new Set(wallets.map((w) => w.userId));

    const usersWithoutWallets = users
      .filter((u) => !walletUserIdsSet.has(u.userId) && u.role !== 'admin')
      .map((u) => ({ userId: u.userId, email: u.email, role: u.role }));

    const orphanWallets = wallets
      .filter((w) => !userIdsSet.has(w.userId))
      .map((w) => ({ userId: w.userId, ves: w.ves }));

    res.json({
      success: true,
      auditSummary: {
        totalUsersScanned: users.length,
        totalWalletsScanned: wallets.length,
        duplicateEmailsCount: duplicateEmails.length,
        usersWithoutWalletsCount: usersWithoutWallets.length,
        orphanWalletsCount: orphanWallets.length,
        status:
          duplicateEmails.length === 0 && orphanWallets.length === 0
            ? 'CLEAN_IN_SANDBOX'
            : 'REVIEW_REQUIRED'
      },
      duplicateEmails,
      usersWithoutWallets,
      orphanWallets
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to run user conflict check' });
  }
});

router.get('/db-status', async (_req: AuthRequest, res: Response): Promise<void> => {
  const { getDBStatus } = await import('../db.js');
  res.json({ success: true, database: getDBStatus() });
});

router.post('/db-reconnect', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { connectDB, getDBStatus } = await import('../db.js');
    await connectDB();
    res.json({ success: true, message: 'Database reconnect attempt completed', database: getDBStatus() });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
