import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import payoutRoutes from './routes/payoutRoutes.js';
import withdrawalRoutes from './routes/withdrawalRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import referralRoutes from './routes/referralRoutes.js';
import { getDBStatus, pingDB } from './db.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  });

  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  app.get('/api/health', async (_req, res) => {
    const dbStatus = getDBStatus();
    const ping = await pingDB();
    const isHealthy = dbStatus.connected && ping.ok;
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'degraded',
      app: 'VELoop Rewards - Wallet & Payout System',
      database: {
        ...dbStatus,
        pingOk: ping.ok,
        latencyMs: ping.latencyMs,
        readyState: ping.readyState
      },
      timestamp: new Date().toISOString()
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/payout', payoutRoutes);
  app.use('/api/withdrawals', withdrawalRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/referrals', referralRoutes);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.log('Handled server error:', err.message);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  });

  return app;
}
