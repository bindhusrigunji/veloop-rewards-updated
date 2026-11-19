import { randomBytes, randomUUID } from 'crypto';
import { User, IUser } from '../models/User.js';
import { Referral, IReferral } from '../models/Referral.js';
import { AuditLog } from '../models/AuditLog.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ReferralService {
  static async generateUniqueReferralCode(seedName?: string): Promise<string> {
    const cleanPrefix = (seedName || 'VEL')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 3)
      .padEnd(3, 'V');

    for (let attempt = 0; attempt < 8; attempt++) {
      const suffix = randomBytes(3).toString('hex').toUpperCase();
      const candidate = `VEL-${cleanPrefix}${suffix}`;
      const exists = await User.exists({ referralCode: candidate });
      if (!exists) {
        return candidate;
      }
    }

    return `VEL-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }

  static async ensureUserReferralCode(userId: string): Promise<string> {
    const user = await User.findOne({ userId });
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    if (user.referralCode) {
      return user.referralCode;
    }

    const code = await this.generateUniqueReferralCode(user.name);
    user.referralCode = code;
    await user.save();
    return code;
  }

  static async validateReferralCode(rawCode: string): Promise<{
    valid: boolean;
    referralCode?: string;
    referrerFirstName?: string;
    reason?: string;
  }> {
    const code = (rawCode || '').trim().toUpperCase();
    if (!code || code.length < 4 || code.length > 32) {
      return { valid: false, reason: 'Referral code format is invalid' };
    }

    const referrer = await User.findOne({ referralCode: code }).lean();
    if (!referrer) {
      return { valid: false, reason: 'Referral code not found' };
    }

    if (referrer.accountStatus !== 'active') {
      return { valid: false, reason: 'Referrer account is not active' };
    }

    return {
      valid: true,
      referralCode: referrer.referralCode,
      referrerFirstName: referrer.name.split(' ')[0]
    };
  }

  static async verifyAttributionEligibility(params: {
    referralCode: string;
    refereeEmail: string;
    refereeUserId?: string;
  }): Promise<{ referrer: IUser; normalizedCode: string; normalizedEmail: string }> {
    const normalizedCode = (params.referralCode || '').trim().toUpperCase();
    const normalizedEmail = (params.refereeEmail || '').trim().toLowerCase();

    if (!normalizedCode) {
      throw new Error('Referral code is required');
    }
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      throw new Error('Valid email address is required for referral attribution');
    }

    const referrer = await User.findOne({ referralCode: normalizedCode });
    if (!referrer) {
      throw new Error(`Invalid referral code: ${normalizedCode}`);
    }
    if (referrer.accountStatus !== 'active') {
      throw new Error('Referral code belongs to an inactive account');
    }

    // Strict self-referral blocks
    if (referrer.email === normalizedEmail) {
      throw new Error('Self-referral is not permitted');
    }
    if (params.refereeUserId && referrer.userId === params.refereeUserId) {
      throw new Error('Self-referral is not permitted');
    }

    // Prevent duplicate attribution for an already converted email or userId
    const existingConverted = await Referral.findOne({
      $or: [
        ...(params.refereeUserId ? [{ refereeUserId: params.refereeUserId }] : []),
        {
          refereeEmail: normalizedEmail,
          status: { $in: ['REGISTERED', 'REWARD_PENDING_RULE'] }
        }
      ]
    });

    if (existingConverted) {
      throw new Error('Referral attribution has already been recorded for this user');
    }

    return { referrer, normalizedCode, normalizedEmail };
  }

  static async createInvite(params: {
    referrerUserId: string;
    refereeEmail: string;
  }): Promise<IReferral> {
    const normalizedEmail = (params.refereeEmail || '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      throw new Error('Please enter a valid email address to send an invite');
    }

    const referrer = await User.findOne({ userId: params.referrerUserId });
    if (!referrer) {
      throw new Error('Referrer account not found');
    }
    if (referrer.accountStatus !== 'active') {
      throw new Error('Account must be active to send referral invites');
    }
    if (referrer.email === normalizedEmail) {
      throw new Error('Self-referral is not permitted: you cannot invite your own email address');
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new Error('This email address is already registered on VELoop');
    }

    const existingInvite = await Referral.findOne({
      referrerUserId: referrer.userId,
      refereeEmail: normalizedEmail
    });
    if (existingInvite) {
      throw new Error('An invite for this email address has already been recorded');
    }

    const referralCode = referrer.referralCode || (await this.ensureUserReferralCode(referrer.userId));
    const referralId = `REF-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

    const referral = await Referral.create({
      referralId,
      referrerUserId: referrer.userId,
      referralCode,
      refereeEmail: normalizedEmail,
      status: 'INVITED',
      rewardAmountVes: 0,
      rewardRuleStatus: 'PENDING_BUSINESS_RULE',
      invitedAt: new Date()
    });

    await AuditLog.create({
      actorId: referrer.userId,
      action: 'REFERRAL_INVITE_CREATED',
      targetUserId: referrer.userId,
      targetType: 'Referral',
      referenceId: referralId,
      metadata: {
        referralCode,
        refereeEmail: normalizedEmail,
        rewardAmountVes: 0,
        rewardRuleStatus: 'PENDING_BUSINESS_RULE'
      }
    });

    return referral;
  }

  static async attributeSignup(params: {
    newUser: IUser;
    referralCode: string;
  }): Promise<IReferral> {
    const { referrer, normalizedCode, normalizedEmail } = await this.verifyAttributionEligibility({
      referralCode: params.referralCode,
      refereeEmail: params.newUser.email,
      refereeUserId: params.newUser.userId
    });

    const now = new Date();

    // Reuse matching INVITED record from this referrer if present, otherwise create a direct signup attribution
    let referral = await Referral.findOneAndUpdate(
      {
        referrerUserId: referrer.userId,
        refereeEmail: normalizedEmail,
        status: 'INVITED'
      },
      {
        $set: {
          refereeUserId: params.newUser.userId,
          status: 'REGISTERED',
          convertedAt: now,
          rewardAmountVes: 0,
          rewardRuleStatus: 'PENDING_BUSINESS_RULE'
        }
      },
      { returnDocument: 'after' }
    );

    if (!referral) {
      const referralId = `REF-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
      referral = await Referral.create({
        referralId,
        referrerUserId: referrer.userId,
        referralCode: normalizedCode,
        refereeEmail: normalizedEmail,
        refereeUserId: params.newUser.userId,
        status: 'REGISTERED',
        rewardAmountVes: 0,
        rewardRuleStatus: 'PENDING_BUSINESS_RULE',
        invitedAt: now,
        convertedAt: now
      });
    }

    params.newUser.referredByUserId = referrer.userId;
    await params.newUser.save();

    await AuditLog.create({
      actorId: params.newUser.userId,
      action: 'REFERRAL_ATTRIBUTED',
      targetUserId: referrer.userId,
      targetType: 'Referral',
      referenceId: referral.referralId,
      metadata: {
        referralCode: normalizedCode,
        refereeUserId: params.newUser.userId,
        rewardAmountVes: 0,
        rewardRuleStatus: 'PENDING_BUSINESS_RULE',
        note: 'Attribution tracked; zero VEs credited until VELOOP approves referral reward rules'
      }
    });

    return referral;
  }

  static async getUserReferralDashboard(userId: string) {
    const referralCode = await this.ensureUserReferralCode(userId);
    const user = await User.findOne({ userId }).lean();
    const invites = await Referral.find({ referrerUserId: userId })
      .sort({ invitedAt: -1 })
      .lean();

    const totalInvites = invites.length;
    const registeredCount = invites.filter(
      (r) => r.status === 'REGISTERED' || r.status === 'REWARD_PENDING_RULE'
    ).length;

    return {
      referralCode,
      referredByUserId: user?.referredByUserId || null,
      rewardRuleStatus: 'PENDING_BUSINESS_RULE',
      rewardRuleNotice:
        'Referral tracking is active in sandbox mode. Automated VEs reward payouts remain paused (0 VEs) pending VELOOP business-rule confirmation.',
      summary: {
        totalInvites,
        registeredCount,
        pendingInvitesCount: invites.filter((r) => r.status === 'INVITED').length,
        conversionRatePct: totalInvites > 0 ? Number(((registeredCount / totalInvites) * 100).toFixed(1)) : 0
      },
      invites: invites.map((inv) => ({
        referralId: inv.referralId,
        refereeEmail: inv.refereeEmail,
        status: inv.status,
        rewardAmountVes: inv.rewardAmountVes,
        rewardRuleStatus: inv.rewardRuleStatus,
        invitedAt: inv.invitedAt,
        convertedAt: inv.convertedAt || null
      }))
    };
  }

  static async getAdminReferralsOverview() {
    const [referrals, users] = await Promise.all([
      Referral.find({}).sort({ invitedAt: -1 }).lean(),
      User.find({}, { userId: 1, name: 1, email: 1, referralCode: 1 }).lean()
    ]);

    const userMap = new Map(users.map((u) => [u.userId, u]));
    const totalInvites = referrals.length;
    const registeredCount = referrals.filter(
      (r) => r.status === 'REGISTERED' || r.status === 'REWARD_PENDING_RULE'
    ).length;
    const blockedCount = referrals.filter((r) => r.status === 'BLOCKED').length;

    return {
      summary: {
        totalInvites,
        registeredCount,
        pendingInvitesCount: referrals.filter((r) => r.status === 'INVITED').length,
        blockedCount,
        conversionRatePct: totalInvites > 0 ? Number(((registeredCount / totalInvites) * 100).toFixed(1)) : 0,
        uniqueReferrersWithInvites: new Set(referrals.map((r) => r.referrerUserId)).size,
        rewardRuleStatus: 'PENDING_BUSINESS_RULE',
        rewardRuleNotice:
          'Automated referral VEs reward payouts are disabled (0 VEs credited) until VELOOP approves qualification and payout amount rules.'
      },
      referrals: referrals.map((r) => ({
        ...r,
        referrerName: userMap.get(r.referrerUserId)?.name || r.referrerUserId,
        refereeName: r.refereeUserId ? userMap.get(r.refereeUserId)?.name || r.refereeUserId : null
      }))
    };
  }
}
