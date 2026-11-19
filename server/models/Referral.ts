import mongoose, { Schema, Document } from 'mongoose';

export type ReferralStatus =
  | 'INVITED'
  | 'REGISTERED'
  | 'REWARD_PENDING_RULE'
  | 'BLOCKED'
  | 'EXPIRED';

export type ReferralRewardRuleStatus =
  | 'PENDING_BUSINESS_RULE'
  | 'NOT_APPLICABLE'
  | 'APPROVED_BY_RULE';

export interface IReferral extends Document {
  referralId: string;
  referrerUserId: string;
  referralCode: string;
  refereeEmail: string;
  refereeUserId?: string;
  status: ReferralStatus;
  rewardAmountVes: number;
  rewardRuleStatus: ReferralRewardRuleStatus;
  blockedReason?: string;
  invitedAt: Date;
  convertedAt?: Date;
  rewardedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema: Schema = new Schema(
  {
    referralId: { type: String, required: true, unique: true, index: true },
    referrerUserId: { type: String, required: true, index: true },
    referralCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    refereeEmail: { type: String, required: true, lowercase: true, trim: true },
    refereeUserId: { type: String },
    status: {
      type: String,
      required: true,
      enum: ['INVITED', 'REGISTERED', 'REWARD_PENDING_RULE', 'BLOCKED', 'EXPIRED'],
      default: 'INVITED',
      index: true
    },
    rewardAmountVes: { type: Number, required: true, default: 0, min: 0 },
    rewardRuleStatus: {
      type: String,
      required: true,
      enum: ['PENDING_BUSINESS_RULE', 'NOT_APPLICABLE', 'APPROVED_BY_RULE'],
      default: 'PENDING_BUSINESS_RULE'
    },
    blockedReason: { type: String },
    invitedAt: { type: Date, default: Date.now, index: true },
    convertedAt: { type: Date },
    rewardedAt: { type: Date }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate referral attribution or reward claims for the same registered user
ReferralSchema.index(
  { refereeUserId: 1 },
  {
    unique: true,
    partialFilterExpression: { refereeUserId: { $type: 'string' } }
  }
);

// Prevent duplicate conversion records for the same email
ReferralSchema.index(
  { refereeEmail: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['REGISTERED', 'REWARD_PENDING_RULE'] } }
  }
);

// Prevent spam-inviting the exact same email from the same referrer
ReferralSchema.index({ referrerUserId: 1, refereeEmail: 1 }, { unique: true });

export const Referral = mongoose.model<IReferral>('Referral', ReferralSchema);
