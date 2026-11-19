import mongoose, { Schema, Document } from 'mongoose';

export type CurrencyType = 'ves' | 'sves' | 'gems' | 'tokens' | 'spins';

export interface IWallet extends Document {
  userId: string;
  ves: number;
  sves: number;
  gems: number;
  tokens: number;
  spins: number;
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    ves: { type: Number, required: true, default: 0, min: 0 },
    sves: { type: Number, required: true, default: 0, min: 0 },
    gems: { type: Number, required: true, default: 0, min: 0 },
    tokens: { type: Number, required: true, default: 0, min: 0 },
    spins: { type: Number, required: true, default: 0, min: 0 }
  },
  {
    timestamps: true
  }
);

export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);
