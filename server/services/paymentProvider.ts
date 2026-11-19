import { randomUUID } from 'crypto';

export interface PayoutExecutionInput {
  withdrawalId: string;
  userId: string;
  method: string;
  payoutCurrency: string;
  payoutAmount: number;
  payoutDetails: Record<string, any>;
}

export interface PayoutExecutionResult {
  accepted: boolean;
  simulated: boolean;
  providerId: string;
  providerMode: 'SANDBOX_SIMULATED';
  providerReferenceId: string;
  processedAt: Date;
  statusNote: string;
}

export interface PaymentProvider {
  readonly providerId: string;
  readonly mode: 'SANDBOX_SIMULATED';
  validateBeneficiary(method: string, details: any): Record<string, any>;
  executePayout(input: PayoutExecutionInput): Promise<PayoutExecutionResult>;
}

const UPI_VPA_REGEX = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z0-9.-]{2,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class SandboxPaymentProvider implements PaymentProvider {
  readonly providerId = 'veloop-sandbox-provider';
  readonly mode = 'SANDBOX_SIMULATED' as const;

  validateBeneficiary(method: string, details: any): Record<string, any> {
    if (!details) {
      throw new Error('Payout details are required');
    }

    let parsed: Record<string, any> = {};
    if (typeof details === 'string') {
      const trimmed = details.trim();
      if (!trimmed || trimmed.length > 200) {
        throw new Error('Payout details must be between 1 and 200 characters');
      }
      parsed = { address: trimmed, raw: trimmed, upiId: trimmed, email: trimmed, paypalEmail: trimmed };
    } else if (typeof details === 'object' && !Array.isArray(details)) {
      parsed = { ...details };
    } else {
      throw new Error('Invalid payout details format');
    }

    const t = (method || '').toLowerCase();
    if (t.includes('upi')) {
      const upiId = String(parsed.upiId || parsed.upi || parsed.raw || parsed.address || '').trim();
      if (!UPI_VPA_REGEX.test(upiId)) {
        throw new Error('Please enter a valid UPI ID (e.g. username@okhdfcbank or phone@upi)');
      }
      parsed.upiId = upiId;
    } else if (t.includes('paypal')) {
      const email = String(parsed.paypalEmail || parsed.email || parsed.raw || parsed.address || '').trim();
      if (!EMAIL_REGEX.test(email)) {
        throw new Error('Please enter a valid PayPal account email address');
      }
      parsed.paypalEmail = email.toLowerCase();
    } else if (t.includes('amazon') || t.includes('google')) {
      const email = String(parsed.email || parsed.deliveryEmail || parsed.raw || parsed.address || '').trim();
      if (!EMAIL_REGEX.test(email)) {
        throw new Error('Please enter a valid email address to receive your e-voucher code');
      }
      parsed.deliveryEmail = email.toLowerCase();
    }

    return parsed;
  }

  async executePayout(input: PayoutExecutionInput): Promise<PayoutExecutionResult> {
    if (!Number.isFinite(input.payoutAmount) || input.payoutAmount <= 0) {
      throw new Error('Payout amount must be a positive finite number');
    }

    this.validateBeneficiary(input.method, input.payoutDetails);

    const methodTag = input.method
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 6) || 'PAYOUT';

    const providerReferenceId = `SBX-${methodTag}-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

    return {
      accepted: true,
      simulated: true,
      providerId: this.providerId,
      providerMode: this.mode,
      providerReferenceId,
      processedAt: new Date(),
      statusNote: `Simulated sandbox ${input.method} settlement (${input.payoutCurrency} ${input.payoutAmount}) — no real fiat transferred`
    };
  }
}

export const defaultPaymentProvider: PaymentProvider = new SandboxPaymentProvider();
