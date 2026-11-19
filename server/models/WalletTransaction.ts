import mongoose, { Schema, Document } from 'mongoose';
import { CurrencyType } from './Wallet.js';

export type TransactionType = 'CREDIT' | 'DEBIT';
export type TransactionStatus = 'COMPLETED' | 'PENDING' | 'FAILED' | 'REVERSED';
export type TransactionSource =
  | 'REWARD'
  | 'BONUS'
  | 'REFERRAL'
  | 'DAILY_REWARD'
  | 'AD_REWARD'
  | 'GAME_REWARD'
  | 'ADMIN_CREDIT'
  | 'EXCHANGE_CREDIT'
  | 'WITHDRAWAL'
  | 'EXCHANGE_DEBIT'
  | 'ADMIN_DEBIT'
  | 'CORRECTION'
  | 'REFUND';

export interface IWalletTransaction extends Document {
  transactionId: string;
  userId: string;
  currency: CurrencyType;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  source: TransactionSource;
  referenceId?: string;
  status: TransactionStatus;
  description: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const WalletTransactionSchema: Schema = new Schema(
  {
    transactionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    currency: {
      type: String,
      required: true,
      enum: ['ves', 'sves', 'gems', 'tokens', 'spins']
    },
    type: { type: String, required: true, enum: ['CREDIT', 'DEBIT'] },
    amount: { type: Number, required: true, min: 0 },
    balanceBefore: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },
    source: { type: String, required: true },
    referenceId: { type: String },
    status: {
      type: String,
      required: true,
      enum: ['COMPLETED', 'PENDING', 'FAILED', 'REVERSED'],
      default: 'COMPLETED'
    },
    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: true
  }
);

WalletTransactionSchema.index({ userId: 1, createdAt: -1 });
WalletTransactionSchema.index({ currency: 1 });
WalletTransactionSchema.index({ source: 1 });
WalletTransactionSchema.index({ status: 1 });

export const WalletTransaction = mongoose.model<IWalletTransaction>(
  'WalletTransaction',
  WalletTransactionSchema
);
