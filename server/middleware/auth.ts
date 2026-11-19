import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User.js';

const envSecret = process.env.JWT_SECRET?.trim();
if (
  process.env.NODE_ENV === 'production' &&
  (!envSecret || envSecret.length < 32 || envSecret.includes('CHANGE_ME'))
) {
  throw new Error('FATAL: JWT_SECRET environment variable (>= 32 characters) must be set in production.');
}

export const JWT_SECRET = envSecret || 'veloop-dev-sandbox-secret-key-do-not-use-in-production';

export interface AuthRequest extends Request {
  user?: IUser;
}

export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Authentication token required'
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    const user = await User.findOne({ userId: decoded.userId });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid session or user no longer exists'
      });
      return;
    }

    if (user.accountStatus !== 'active') {
      res.status(403).json({
        success: false,
        message: `Account is currently ${user.accountStatus}. Please contact support.`
      });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired session token'
    });
  }
}

export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Access denied: Administrator privileges required'
    });
    return;
  }
  next();
}
