import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { PayoutService } from '../services/payoutService.js';
import { Withdrawal } from '../models/Withdrawal.js';

const router = Router();

router.post(
  '/',
  authenticateToken,
  rateLimiter({
    windowMs: 10000,
    maxRequests: 25,
    namespace: 'withdrawals-create',
    message: 'Please wait a moment between withdrawal requests'
  }),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { optionId, payoutDetails, idempotencyKey } = req.body;

      if (!optionId) {
        res.status(400).json({ success: false, message: 'Please select a payout option voucher' });
        return;
      }

      if (!payoutDetails) {
        res.status(400).json({ success: false, message: 'Payout delivery details are required' });
        return;
      }

      const withdrawal = await PayoutService.requestWithdrawal({
        userId,
        optionId,
        payoutDetails,
        idempotencyKey
      });

      res.status(201).json({
        success: true,
        message: 'Withdrawal request submitted successfully! Your funds are reserved.',
        withdrawal
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        message: err.message || 'Withdrawal could not be processed'
      });
    }
  }
);

router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const rawPage = parseInt(req.query.page as string, 10);
    const rawLimit = parseInt(req.query.limit as string, 10);
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 20;
    const status = req.query.status as string;

    const query: Record<string, any> = { userId };
    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }

    const skip = (page - 1) * limit;

    const [withdrawals, total] = await Promise.all([
      Withdrawal.find(query).sort({ requestedAt: -1 }).skip(skip).limit(limit),
      Withdrawal.countDocuments(query)
    ]);

    res.json({
      success: true,
      withdrawals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch withdrawal records' });
  }
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    const withdrawal = await Withdrawal.findOne({
      $or: [{ withdrawalId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }]
    });

    if (!withdrawal) {
      res.status(404).json({ success: false, message: 'Withdrawal not found' });
      return;
    }

    if (withdrawal.userId !== req.user!.userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Unauthorized access to withdrawal record' });
      return;
    }

    res.json({ success: true, withdrawal });
  } catch {
    res.status(500).json({ success: false, message: 'Server error retrieving withdrawal' });
  }
});

export default router;
