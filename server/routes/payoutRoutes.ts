import { Router, Request, Response } from 'express';
import { PayoutService } from '../services/payoutService.js';
import { PayoutOption } from '../models/PayoutOption.js';

const router = Router();

router.get('/methods', async (_req: Request, res: Response): Promise<void> => {
  try {
    const methods = await PayoutService.getActiveMethods();
    res.json({ success: true, methods });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch payout methods' });
  }
});

router.get('/options', async (_req: Request, res: Response): Promise<void> => {
  try {
    const options = await PayoutOption.find({ active: true }).sort({ requiredAmount: 1 });
    res.json({ success: true, options });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch payout options' });
  }
});

router.get('/options/:method', async (req: Request, res: Response): Promise<void> => {
  try {
    const methodType = req.params.method;
    const options = await PayoutService.getOptionsForMethod(methodType);
    res.json({ success: true, options });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch options for requested method' });
  }
});

export default router;
