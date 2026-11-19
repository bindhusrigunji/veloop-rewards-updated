import { randomUUID } from 'crypto';
import { Wallet, IWallet, CurrencyType } from '../models/Wallet.js';
import {
  WalletTransaction,
  IWalletTransaction,
  TransactionType,
  TransactionSource,
  TransactionStatus
} from '../models/WalletTransaction.js';

export interface CreditDebitParams {
  userId: string;
  currency: CurrencyType;
  amount: number;
  source: TransactionSource;
  description?: string;
  referenceId?: string;
  metadata?: Record<string, any>;
}

const VALID_CURRENCIES = new Set<CurrencyType>(['ves', 'sves', 'gems', 'tokens', 'spins']);

function assertValidCurrency(currency: string): asserts currency is CurrencyType {
  if (!VALID_CURRENCIES.has(currency as CurrencyType)) {
    throw new Error(`Invalid currency: ${String(currency)}. Must be one of ves, sves, gems, tokens, spins`);
  }
}

export class WalletService {
  static async getWallet(userId: string): Promise<IWallet> {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        ves: 0,
        sves: 0,
        gems: 0,
        tokens: 0,
        spins: 0
      });
    }
    return wallet;
  }

  static async validateBalance(
    userId: string,
    currency: CurrencyType,
    requiredAmount: number
  ): Promise<boolean> {
    assertValidCurrency(currency);
    if (typeof requiredAmount !== 'number' || !Number.isFinite(requiredAmount)) {
      return false;
    }
    if (requiredAmount <= 0) return true;
    const wallet = await this.getWallet(userId);
    return wallet[currency] >= requiredAmount;
  }

  static async creditWallet(params: CreditDebitParams): Promise<{
    wallet: IWallet;
    transaction: IWalletTransaction;
  }> {
    const { userId, currency, amount, source, description, referenceId, metadata } = params;

    assertValidCurrency(currency);
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw new Error('Credit amount must be a positive finite number');
    }

    await this.getWallet(userId);

    const updatedWallet = await Wallet.findOneAndUpdate(
      { userId },
      { $inc: { [currency]: amount } },
      { returnDocument: 'after' }
    );

    if (!updatedWallet) {
      throw new Error(`Failed to credit wallet for user ${userId}`);
    }

    const balanceAfter = updatedWallet[currency];
    const balanceBefore = balanceAfter - amount;

    const transaction = await this.createLedgerEntry({
      userId,
      currency,
      type: 'CREDIT',
      amount,
      balanceBefore,
      balanceAfter,
      source,
      status: 'COMPLETED',
      description: description || `${source} credit (+${amount} ${currency.toUpperCase()})`,
      referenceId,
      metadata
    });

    return { wallet: updatedWallet, transaction };
  }

  static async debitWallet(params: CreditDebitParams): Promise<{
    wallet: IWallet;
    transaction: IWalletTransaction;
  }> {
    const { userId, currency, amount, source, description, referenceId, metadata } = params;

    assertValidCurrency(currency);
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw new Error('Debit amount must be a positive finite number');
    }

    const updatedWallet = await Wallet.findOneAndUpdate(
      { userId, [currency]: { $gte: amount } },
      { $inc: { [currency]: -amount } },
      { returnDocument: 'after' }
    );

    if (!updatedWallet) {
      const current = await Wallet.findOne({ userId });
      const currentBal = current ? current[currency] : 0;
      throw new Error(
        `Insufficient ${currency.toUpperCase()} balance: required ${amount}, available ${currentBal}`
      );
    }

    const balanceAfter = updatedWallet[currency];
    const balanceBefore = balanceAfter + amount;

    const transaction = await this.createLedgerEntry({
      userId,
      currency,
      type: 'DEBIT',
      amount,
      balanceBefore,
      balanceAfter,
      source,
      status: 'COMPLETED',
      description: description || `${source} debit (-${amount} ${currency.toUpperCase()})`,
      referenceId,
      metadata
    });

    return { wallet: updatedWallet, transaction };
  }

  static async createLedgerEntry(entry: {
    userId: string;
    currency: CurrencyType;
    type: TransactionType;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    source: TransactionSource;
    status: TransactionStatus;
    description: string;
    referenceId?: string;
    metadata?: Record<string, any>;
  }): Promise<IWalletTransaction> {
    const transactionId = `TXN-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

    const record = await WalletTransaction.create({
      transactionId,
      ...entry
    });

    return record;
  }

  static async getTransactions(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      currency?: string;
      type?: string;
      source?: string;
    } = {}
  ): Promise<{
    transactions: IWalletTransaction[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = { userId };
    if (options.currency && options.currency !== 'ALL') {
      query.currency = options.currency.toLowerCase();
    }
    if (options.type && options.type !== 'ALL') {
      query.type = options.type.toUpperCase();
    }
    if (options.source && options.source !== 'ALL') {
      query.source = options.source;
    }

    const [transactions, total] = await Promise.all([
      WalletTransaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      WalletTransaction.countDocuments(query)
    ]);

    return {
      transactions,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1
    };
  }
}
