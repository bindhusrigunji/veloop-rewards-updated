import { Router, Response } from 'express';
import { authenticateToken, AuthRequest, requireAdmin } from '../middleware/auth.js';
import { WalletService } from '../services/walletService.js';
import { Withdrawal } from '../models/Withdrawal.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { CurrencyType } from '../models/Wallet.js';

const router = Router();

router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const wallet = await WalletService.getWallet(userId);

    res.json({
      success: true,
      wallet: {
        userId: wallet.userId,
        ves: wallet.ves,
        sves: wallet.sves,
        gems: wallet.gems,
        tokens: wallet.tokens,
        spins: wallet.spins,
        updatedAt: wallet.updatedAt
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Could not fetch wallet data' });
  }
});

router.get('/summary', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const wallet = await WalletService.getWallet(userId);

    const creditAgg = await WalletTransaction.aggregate([
      { $match: { userId, currency: 'ves', type: 'CREDIT', status: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalEarnedVes = creditAgg.length > 0 ? creditAgg[0].total : wallet.ves;

    const debitAgg = await WalletTransaction.aggregate([
      { $match: { userId, currency: 'ves', type: 'DEBIT', source: 'WITHDRAWAL', status: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalWithdrawnVes = debitAgg.length > 0 ? debitAgg[0].total : 0;

    const pendingWithdrawals = await Withdrawal.find({ userId, status: 'PENDING' });
    const pendingCount = pendingWithdrawals.length;
    const pendingVes = pendingWithdrawals.reduce((sum, item) => sum + item.currencyAmount, 0);

    res.json({
      success: true,
      summary: {
        currentBalances: {
          ves: wallet.ves,
          sves: wallet.sves,
          gems: wallet.gems,
          tokens: wallet.tokens,
          spins: wallet.spins
        },
        totalEarnedVes,
        totalWithdrawnVes,
        pendingWithdrawals: {
          count: pendingCount,
          currencyAmount: pendingVes
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Could not generate wallet summary' });
  }
});

router.get('/transactions', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const rawPage = parseInt(req.query.page as string, 10);
    const rawLimit = parseInt(req.query.limit as string, 10);
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 15;
    const currency = (req.query.currency as string) || 'ALL';
    const type = (req.query.type as string) || 'ALL';
    const source = (req.query.source as string) || 'ALL';

    const result = await WalletService.getTransactions(userId, {
      page,
      limit,
      currency,
      type,
      source
    });

    res.json({
      success: true,
      data: result.transactions,
      pagination: {
        page: result.page,
        limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Could not fetch transaction history' });
  }
});

router.post('/claim-daily', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const lastDaily = await WalletTransaction.findOne({
      userId,
      source: 'DAILY_REWARD',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).sort({ createdAt: -1 });

    if (lastDaily) {
      const waitMinutes = Math.ceil(
        (lastDaily.createdAt.getTime() + 24 * 60 * 60 * 1000 - Date.now()) / (60 * 1000)
      );
      res.status(400).json({
        success: false,
        message: `Daily reward already claimed today. Next reward available in ${Math.floor(waitMinutes / 60)}h ${waitMinutes % 60}m.`
      });
      return;
    }

    const vesCredit = await WalletService.creditWallet({
      userId,
      currency: 'ves',
      amount: 250,
      source: 'DAILY_REWARD',
      description: 'Daily login streak reward (+250 VEs)'
    });

    await WalletService.creditWallet({
      userId,
      currency: 'spins',
      amount: 1,
      source: 'DAILY_REWARD',
      description: 'Daily bonus lucky spin (+1 Spin)'
    });

    res.json({
      success: true,
      message: 'Daily reward claimed! +250 VEs and +1 Spin added to your wallet.',
      wallet: vesCredit.wallet
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to claim daily reward' });
  }
});

router.post('/spin', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    await WalletService.debitWallet({
      userId,
      currency: 'spins',
      amount: 1,
      source: 'GAME_REWARD',
      description: 'Spun the VELoop Fortune Wheel (-1 Spin)'
    });

    const prizes: Array<{ currency: CurrencyType; amount: number; label: string }> = [
      { currency: 'ves', amount: 300, label: '300 VEs' },
      { currency: 'ves', amount: 500, label: '500 VEs' },
      { currency: 'ves', amount: 1000, label: '1,000 VEs Super Prize!' },
      { currency: 'gems', amount: 15, label: '15 Gems' },
      { currency: 'tokens', amount: 50, label: '50 Tokens' },
      { currency: 'sves', amount: 100, label: '100 Staked VEs' }
    ];

    const won = prizes[Math.floor(Math.random() * prizes.length)];

    const creditResult = await WalletService.creditWallet({
      userId,
      currency: won.currency,
      amount: won.amount,
      source: 'GAME_REWARD',
      description: `Fortune Wheel Won: ${won.label}`
    });

    res.json({
      success: true,
      prize: won,
      message: `Congratulations! You won ${won.label}!`,
      wallet: creditResult.wallet
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Wheel spin failed' });
  }
});

router.post('/credit', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { targetUserId, currency, amount, description } = req.body;
    const numAmount = Number(amount);
    if (!targetUserId || !currency || !Number.isFinite(numAmount) || numAmount <= 0) {
      res.status(400).json({ success: false, message: 'targetUserId, valid currency, and positive finite amount required' });
      return;
    }

    const result = await WalletService.creditWallet({
      userId: String(targetUserId),
      currency,
      amount: numAmount,
      source: 'ADMIN_CREDIT',
      description: description || `Admin manual credit by ${req.user!.email}`
    });

    res.json({
      success: true,
      message: `Credited ${numAmount} ${String(currency).toUpperCase()} to user ${targetUserId}`,
      wallet: result.wallet,
      transaction: result.transaction
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/debit', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { targetUserId, currency, amount, description } = req.body;
    const numAmount = Number(amount);
    if (!targetUserId || !currency || !Number.isFinite(numAmount) || numAmount <= 0) {
      res.status(400).json({ success: false, message: 'targetUserId, valid currency, and positive finite amount required' });
      return;
    }

    const result = await WalletService.debitWallet({
      userId: String(targetUserId),
      currency,
      amount: numAmount,
      source: 'ADMIN_DEBIT',
      description: description || `Admin manual debit by ${req.user!.email}`
    });

    res.json({
      success: true,
      message: `Debited ${numAmount} ${String(currency).toUpperCase()} from user ${targetUserId}`,
      wallet: result.wallet,
      transaction: result.transaction
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
