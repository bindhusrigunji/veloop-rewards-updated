import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { User } from '../models/User.js';
import { Wallet } from '../models/Wallet.js';
import { AuditLog } from '../models/AuditLog.js';
import { authenticateToken, AuthRequest, JWT_SECRET } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { ReferralService } from '../services/referralService.js';

const router = Router();

router.post(
  '/register',
  rateLimiter({ windowMs: 60000, maxRequests: 40, namespace: 'auth-register' }),
  async (req, res): Promise<void> => {
    try {
      const { name, email, password, referralCode } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
        res.status(400).json({ success: false, message: 'Valid name is required (2-80 characters)' });
        return;
      }

      if (
        !email ||
        typeof email !== 'string' ||
        email.trim().length > 160 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ) {
        res.status(400).json({ success: false, message: 'Valid email address is required' });
        return;
      }

      if (!password || typeof password !== 'string' || password.length < 6 || password.length > 128) {
        res.status(400).json({ success: false, message: 'Password must be 6-128 characters' });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existing = await User.findOne({ email: normalizedEmail });
      if (existing) {
        res.status(409).json({ success: false, message: 'An account with this email already exists' });
        return;
      }

      const trimmedReferralCode =
        typeof referralCode === 'string' && referralCode.trim().length > 0
          ? referralCode.trim().toUpperCase()
          : undefined;

      // Pre-validate referral attribution before inserting User or Wallet so invalid/self-referral codes fail atomically
      if (trimmedReferralCode) {
        try {
          await ReferralService.verifyAttributionEligibility({
            referralCode: trimmedReferralCode,
            refereeEmail: normalizedEmail
          });
        } catch (refErr: any) {
          res.status(400).json({ success: false, message: refErr.message });
          return;
        }
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const userId = `USR-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
      const ownReferralCode = await ReferralService.generateUniqueReferralCode(name);

      const newUser = await User.create({
        userId,
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: 'user',
        accountStatus: 'active',
        referralCode: ownReferralCode
      });

      await Wallet.create({
        userId,
        ves: 1000,
        sves: 0,
        gems: 10,
        tokens: 50,
        spins: 2
      });

      if (trimmedReferralCode) {
        await ReferralService.attributeSignup({
          newUser,
          referralCode: trimmedReferralCode
        });
      }

      await AuditLog.create({
        actorId: userId,
        action: 'USER_REGISTERED',
        targetUserId: userId,
        targetType: 'User',
        metadata: {
          email: normalizedEmail,
          referralCodeUsed: trimmedReferralCode || null
        }
      });

      const token = jwt.sign(
        { userId: newUser.userId, email: newUser.email, role: newUser.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        success: true,
        message: 'Account registered successfully',
        token,
        user: {
          userId: newUser.userId,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          accountStatus: newUser.accountStatus,
          referralCode: newUser.referralCode,
          referredByUserId: newUser.referredByUserId
        }
      });
    } catch (err: any) {
      console.log('Registration error:', err.message);
      res.status(500).json({ success: false, message: 'Failed to complete registration' });
    }
  }
);

router.post(
  '/login',
  rateLimiter({ windowMs: 60000, maxRequests: 60, namespace: 'auth-login' }),
  async (req, res): Promise<void> => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ success: false, message: 'Email and password are required' });
        return;
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        res.status(401).json({ success: false, message: 'Invalid email or password' });
        return;
      }

      const isMatch = await bcrypt.compare(String(password), user.passwordHash);
      if (!isMatch) {
        res.status(401).json({ success: false, message: 'Invalid email or password' });
        return;
      }

      if (user.accountStatus !== 'active') {
        res.status(403).json({
          success: false,
          message: `Account is ${user.accountStatus}. Please contact support.`
        });
        return;
      }

      const referralCode = user.referralCode || (await ReferralService.ensureUserReferralCode(user.userId));

      const token = jwt.sign(
        { userId: user.userId, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        message: 'Logged in successfully',
        token,
        user: {
          userId: user.userId,
          name: user.name,
          email: user.email,
          role: user.role,
          accountStatus: user.accountStatus,
          referralCode,
          referredByUserId: user.referredByUserId
        }
      });
    } catch (err: any) {
      console.log('Login error:', err.message);
      res.status(500).json({ success: false, message: 'Authentication server error' });
    }
  }
);

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  const referralCode = user.referralCode || (await ReferralService.ensureUserReferralCode(user.userId));
  res.json({
    success: true,
    user: {
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      referralCode,
      referredByUserId: user.referredByUserId
    }
  });
});

export default router;
