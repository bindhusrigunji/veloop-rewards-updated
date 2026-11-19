import mongoose, { Schema, Document } from 'mongoose';

export type WithdrawalStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export interface IWithdrawal extends Document {
  withdrawalId: string;
  userId: string;
  method: string;
  optionId: string;
  currency: string;
  payoutCurrency: 'INR' | 'USD' | string;
  currencyAmount: number;
  payoutAmount: number;
  payoutDetails: Record<string, any>;
  status: WithdrawalStatus;
  rejectionReason?: string;
  reviewNote?: string;
  transactionId: string;
  idempotencyKey?: string;
  providerMode: 'SANDBOX_SIMULATED' | string;
  providerReferenceId?: string;
  requestedAt: Date;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WithdrawalSchema: Schema = new Schema(
  {
    withdrawalId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    method: { type: String, required: true },
    optionId: { type: String, required: true },
    currency: { type: String, required: true, default: 'ves' },
    payoutCurrency: { type: String, required: true, default: 'USD' },
    currencyAmount: { type: Number, required: true, min: 1 },
    payoutAmount: { type: Number, required: true, min: 0 },
    payoutDetails: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'CANCELLED'],
      default: 'PENDING',
      index: true
    },
    rejectionReason: { type: String },
    reviewNote: { type: String },
    transactionId: { type: String, required: true },
    idempotencyKey: { type: String, index: true },
    providerMode: {
      type: String,
      required: true,
      enum: ['SANDBOX_SIMULATED'],
      default: 'SANDBOX_SIMULATED'
    },
    providerReferenceId: { type: String },
    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date }
  },
  {
    timestamps: true
  }
);

WithdrawalSchema.index({ userId: 1, requestedAt: -1 });
WithdrawalSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: 'string', $gt: '' }
    }
  }
);

export const Withdrawal = mongoose.model<IWithdrawal>(
  'Withdrawal',
  WithdrawalSchema
);
