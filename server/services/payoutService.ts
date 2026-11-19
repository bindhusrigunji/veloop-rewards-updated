import { randomUUID } from 'crypto';
import { PayoutOption, IPayoutOption } from '../models/PayoutOption.js';
import { Withdrawal, IWithdrawal } from '../models/Withdrawal.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { AuditLog } from '../models/AuditLog.js';
import { WalletService } from './walletService.js';
import { defaultPaymentProvider } from './paymentProvider.js';

export interface CreateWithdrawalDTO {
  userId: string;
  optionId: string;
  payoutDetails: string | Record<string, any>;
  idempotencyKey?: string;
}

export class PayoutService {
  static async getActiveMethods() {
    const options = await PayoutOption.find({ active: true });
    const methodMap = new Map<string, { methodId: string; name: string; type: string; count: number }>();

    for (const opt of options) {
      if (!methodMap.has(opt.type)) {
        methodMap.set(opt.type, {
          methodId: opt.methodId,
          name: opt.type,
          type: opt.type,
          count: 1
        });
      } else {
        const item = methodMap.get(opt.type)!;
        item.count++;
      }
    }

    return Array.from(methodMap.values());
  }

  static async getOptionsForMethod(methodType?: string): Promise<IPayoutOption[]> {
    const filter: Record<string, any> = { active: true };
    if (methodType && methodType !== 'ALL') {
      const escaped = methodType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.type = new RegExp(`^${escaped}$`, 'i');
    }
    return PayoutOption.find(filter).sort({ requiredAmount: 1 });
  }

  static validatePayoutDetails(type: string, details: any): Record<string, any> {
    return defaultPaymentProvider.validateBeneficiary(type, details);
  }

  static async requestWithdrawal(dto: CreateWithdrawalDTO): Promise<IWithdrawal> {
    const { userId, optionId, payoutDetails } = dto;
    const normalizedIdempotencyKey =
      typeof dto.idempotencyKey === 'string' && dto.idempotencyKey.trim().length > 0
        ? dto.idempotencyKey.trim()
        : undefined;

    if (normalizedIdempotencyKey) {
      const existing = await Withdrawal.findOne({
        idempotencyKey: normalizedIdempotencyKey,
        userId
      });
      if (existing) {
        return existing;
      }
    }

    const option = await PayoutOption.findOne({ optionId });
    if (!option) {
      throw new Error(`Invalid payout option selected: ${optionId}`);
    }
    if (!option.active) {
      throw new Error(`The selected payout option (${option.name}) is currently unavailable`);
    }

    const validatedDetails = this.validatePayoutDetails(option.type, payoutDetails);

    const withdrawalId = `WTH-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

    const debitResult = await WalletService.debitWallet({
      userId,
      currency: 'ves',
      amount: option.requiredAmount,
      source: 'WITHDRAWAL',
      description: `Withdrawal request for ${option.name} (${option.currency} ${option.payoutValue})`,
      referenceId: withdrawalId,
      metadata: {
        optionId: option.optionId,
        method: option.type,
        payoutAmount: option.payoutValue,
        payoutCurrency: option.currency
      }
    });

    let withdrawal: IWithdrawal;
    try {
      withdrawal = await Withdrawal.create({
        withdrawalId,
        userId,
        method: option.type,
        optionId: option.optionId,
        currency: 'ves',
        payoutCurrency: option.currency,
        currencyAmount: option.requiredAmount,
        payoutAmount: option.payoutValue,
        payoutDetails: validatedDetails,
        status: 'PENDING',
        transactionId: debitResult.transaction.transactionId,
        ...(normalizedIdempotencyKey ? { idempotencyKey: normalizedIdempotencyKey } : {}),
        providerMode: defaultPaymentProvider.mode,
        requestedAt: new Date()
      });
    } catch (createErr: any) {
      // Compensate speculative wallet debit if concurrent duplicate idempotencyKey won the unique index race
      if (createErr?.code === 11000 && normalizedIdempotencyKey) {
        await WalletService.creditWallet({
          userId,
          currency: 'ves',
          amount: option.requiredAmount,
          source: 'CORRECTION',
          description: `Rollback duplicate idempotent withdrawal debit (${withdrawalId})`,
          referenceId: withdrawalId
        });
        const winner = await Withdrawal.findOne({
          userId,
          idempotencyKey: normalizedIdempotencyKey
        });
        if (winner) {
          return winner;
        }
      }
      throw createErr;
    }

    await AuditLog.create({
      actorId: userId,
      action: 'WITHDRAWAL_REQUESTED',
      targetUserId: userId,
      targetType: 'Withdrawal',
      referenceId: withdrawalId,
      metadata: {
        currencyAmount: option.requiredAmount,
        payoutAmount: option.payoutValue,
        payoutCurrency: option.currency,
        method: option.type,
        providerMode: defaultPaymentProvider.mode
      }
    });

    return withdrawal;
  }

  static async approveWithdrawal(
    withdrawalId: string,
    adminId: string,
    reviewNote?: string
  ): Promise<IWithdrawal> {
    const resolvedNote = reviewNote || 'Approved by administrator (Sandbox Simulated Settlement)';

    const withdrawal = await Withdrawal.findOneAndUpdate(
      {
        withdrawalId,
        status: { $in: ['PENDING', 'PROCESSING'] }
      },
      {
        $set: {
          status: 'APPROVED',
          processedAt: new Date(),
          reviewNote: resolvedNote,
          providerMode: defaultPaymentProvider.mode
        }
      },
      { returnDocument: 'after' }
    );

    if (!withdrawal) {
      const existing = await Withdrawal.findOne({ withdrawalId });
      if (!existing) {
        throw new Error(`Withdrawal not found: ${withdrawalId}`);
      }
      throw new Error(`Cannot approve withdrawal with status: ${existing.status}`);
    }

    const payoutExecution = await defaultPaymentProvider.executePayout({
      withdrawalId: withdrawal.withdrawalId,
      userId: withdrawal.userId,
      method: withdrawal.method,
      payoutCurrency: withdrawal.payoutCurrency || 'USD',
      payoutAmount: withdrawal.payoutAmount,
      payoutDetails: withdrawal.payoutDetails
    });

    withdrawal.providerReferenceId = payoutExecution.providerReferenceId;
    await withdrawal.save();

    await AuditLog.create({
      actorId: adminId,
      action: 'WITHDRAWAL_APPROVED',
      targetUserId: withdrawal.userId,
      targetType: 'Withdrawal',
      referenceId: withdrawalId,
      metadata: {
        reviewNote: resolvedNote,
        providerMode: payoutExecution.providerMode,
        providerReferenceId: payoutExecution.providerReferenceId,
        simulated: payoutExecution.simulated
      }
    });

    return withdrawal;
  }

  static async rejectWithdrawal(
    withdrawalId: string,
    adminId: string,
    rejectionReason: string
  ): Promise<IWithdrawal> {
    const trimmedReason = (rejectionReason || '').trim();
    if (!trimmedReason) {
      throw new Error('A rejection reason is required for audit compliance');
    }

    const withdrawal = await Withdrawal.findOneAndUpdate(
      {
        withdrawalId,
        status: { $in: ['PENDING', 'PROCESSING'] }
      },
      {
        $set: {
          status: 'REJECTED',
          processedAt: new Date(),
          rejectionReason: trimmedReason
        }
      },
      { returnDocument: 'after' }
    );

    if (!withdrawal) {
      const existing = await Withdrawal.findOne({ withdrawalId });
      if (!existing) {
        throw new Error(`Withdrawal not found: ${withdrawalId}`);
      }
      throw new Error(`Cannot reject withdrawal with terminal or processed status: ${existing.status}`);
    }

    const existingRefund = await WalletTransaction.findOne({
      userId: withdrawal.userId,
      referenceId: withdrawalId,
      source: 'REFUND'
    });
    if (existingRefund) {
      throw new Error(`Refund already exists for withdrawal ${withdrawalId}`);
    }

    try {
      await WalletService.creditWallet({
        userId: withdrawal.userId,
        currency: 'ves',
        amount: withdrawal.currencyAmount,
        source: 'REFUND',
        description: `Reversal for rejected withdrawal ${withdrawalId}: ${trimmedReason}`,
        referenceId: withdrawalId,
        metadata: {
          originalTransactionId: withdrawal.transactionId,
          rejectionReason: trimmedReason
        }
      });
    } catch (refundErr) {
      await Withdrawal.findOneAndUpdate(
        { withdrawalId, status: 'REJECTED' },
        { $set: { status: 'PENDING' }, $unset: { processedAt: '', rejectionReason: '' } }
      );
      throw refundErr;
    }

    await AuditLog.create({
      actorId: adminId,
      action: 'WITHDRAWAL_REJECTED_REFUNDED',
      targetUserId: withdrawal.userId,
      targetType: 'Withdrawal',
      referenceId: withdrawalId,
      metadata: {
        refundedAmount: withdrawal.currencyAmount,
        reason: trimmedReason
      }
    });

    return withdrawal;
  }
}
