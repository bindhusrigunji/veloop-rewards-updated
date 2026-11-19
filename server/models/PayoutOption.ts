import mongoose, { Schema, Document } from 'mongoose';

export interface IPayoutOption extends Document {
  optionId: string;
  methodId: string;
  name: string;
  type: string;
  currency: string;
  payoutValue: number;
  requiredAmount: number;
  active: boolean;
  eligibility: {
    minLevel?: number;
    country?: string[];
  };
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const PayoutOptionSchema: Schema = new Schema(
  {
    optionId: { type: String, required: true, unique: true, index: true },
    methodId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, required: true, index: true },
    currency: { type: String, required: true, default: 'USD' },
    payoutValue: { type: Number, required: true, min: 0 },
    requiredAmount: { type: Number, required: true, min: 1 },
    active: { type: Boolean, default: true, index: true },
    eligibility: {
      minLevel: { type: Number, default: 1 },
      country: { type: [String], default: ['GLOBAL'] }
    },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: true
  }
);

export const PayoutOption = mongoose.model<IPayoutOption>(
  'PayoutOption',
  PayoutOptionSchema
);
