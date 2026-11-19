import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { ReferralService } from '../services/referralService.js';

const router = Router();

router.get('/validate/:code', async (req, res: Response): Promise<void> => {
  try {
    const result = await ReferralService.validateReferralCode(req.params.code);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, valid: false, message: err.message });
  }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const dashboard = await ReferralService.getUserReferralDashboard(req.user!.userId);
    res.json({ success: true, ...dashboard });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load referral profile' });
  }
});

router.post(
  '/invite',
  authenticateToken,
  rateLimiter({ windowMs: 60000, maxRequests: 20, namespace: 'referral-invite' }),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { refereeEmail } = req.body;
      const referral = await ReferralService.createInvite({
        referrerUserId: req.user!.userId,
        refereeEmail
      });

      res.status(201).json({
        success: true,
        message: 'Referral invite tracked. Rewards remain 0 VEs pending VELOOP business-rule approval.',
        referral
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Failed to create referral invite' });
    }
  }
);

export default router;
