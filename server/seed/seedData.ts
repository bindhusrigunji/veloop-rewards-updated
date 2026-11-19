import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Wallet } from '../models/Wallet.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { PayoutOption } from '../models/PayoutOption.js';
import { Withdrawal } from '../models/Withdrawal.js';
import { AuditLog } from '../models/AuditLog.js';
import { Referral } from '../models/Referral.js';

export async function seedInitialData() {
  const userCount = await User.countDocuments();
  if (userCount > 0) {
    return;
  }

  const saltRounds = 10;
  const userPasswordHash = await bcrypt.hash('Password123!', saltRounds);
  const adminPasswordHash = await bcrypt.hash('AdminSecure123!', saltRounds);

  const demoUserId = 'USR-DEMO-001';
  await User.create({
    userId: demoUserId,
    name: 'Alex Vance',
    email: 'demo@veloop.test',
    passwordHash: userPasswordHash,
    role: 'user',
    accountStatus: 'active',
    referralCode: 'VEL-DEMO01'
  });

  const adminUserId = 'ADM-VELOOP-999';
  await User.create({
    userId: adminUserId,
    name: 'VELoop Chief Admin',
    email: 'admin@veloop.test',
    passwordHash: adminPasswordHash,
    role: 'admin',
    accountStatus: 'active',
    referralCode: 'VEL-ADM001'
  });

  await Wallet.create({
    userId: demoUserId,
    ves: 25000,
    sves: 5000,
    gems: 100,
    tokens: 500,
    spins: 3
  });

  const transactions = [
    {
      transactionId: 'TXN-INIT-001',
      userId: demoUserId,
      currency: 'ves',
      type: 'CREDIT',
      amount: 15000,
      balanceBefore: 0,
      balanceAfter: 15000,
      source: 'BONUS',
      status: 'COMPLETED',
      description: 'Welcome Tier-3 Onboarding Bonus',
      createdAt: new Date(Date.now() - 7 * 86400000)
    },
    {
      transactionId: 'TXN-INIT-002',
      userId: demoUserId,
      currency: 'ves',
      type: 'CREDIT',
      amount: 5000,
      balanceBefore: 15000,
      balanceAfter: 20000,
      source: 'REFERRAL',
      status: 'COMPLETED',
      description: 'Referral reward for invited user @sarah_k',
      createdAt: new Date(Date.now() - 5 * 86400000)
    },
    {
      transactionId: 'TXN-INIT-003',
      userId: demoUserId,
      currency: 'ves',
      type: 'CREDIT',
      amount: 500,
      balanceBefore: 20000,
      balanceAfter: 20500,
      source: 'AD_REWARD',
      status: 'COMPLETED',
      description: 'Watched sponsored partner video showcase',
      createdAt: new Date(Date.now() - 4 * 86400000)
    },
    {
      transactionId: 'TXN-INIT-004',
      userId: demoUserId,
      currency: 'ves',
      type: 'CREDIT',
      amount: 250,
      balanceBefore: 20500,
      balanceAfter: 20750,
      source: 'DAILY_REWARD',
      status: 'COMPLETED',
      description: 'Day 7 Streak bonus: 250 VEs awarded',
      createdAt: new Date(Date.now() - 3 * 86400000)
    },
    {
      transactionId: 'TXN-INIT-005',
      userId: demoUserId,
      currency: 'ves',
      type: 'DEBIT',
      amount: 3000,
      balanceBefore: 20750,
      balanceAfter: 17750,
      source: 'WITHDRAWAL',
      status: 'COMPLETED',
      description: 'Withdrawal voucher for ₹250 UPI Direct',
      referenceId: 'WTH-HIST-001',
      createdAt: new Date(Date.now() - 2 * 86400000)
    },
    {
      transactionId: 'TXN-INIT-006',
      userId: demoUserId,
      currency: 'ves',
      type: 'CREDIT',
      amount: 7250,
      balanceBefore: 17750,
      balanceAfter: 25000,
      source: 'GAME_REWARD',
      status: 'COMPLETED',
      description: 'Champion Tournament Leaderboard Prize',
      createdAt: new Date(Date.now() - 1 * 86400000)
    },
    {
      transactionId: 'TXN-INIT-007',
      userId: demoUserId,
      currency: 'sves',
      type: 'CREDIT',
      amount: 5000,
      balanceBefore: 0,
      balanceAfter: 5000,
      source: 'BONUS',
      status: 'COMPLETED',
      description: 'Staked VEs seasonal dividend allocation',
      createdAt: new Date(Date.now() - 6 * 86400000)
    },
    {
      transactionId: 'TXN-INIT-008',
      userId: demoUserId,
      currency: 'gems',
      type: 'CREDIT',
      amount: 100,
      balanceBefore: 0,
      balanceAfter: 100,
      source: 'REWARD',
      status: 'COMPLETED',
      description: 'Monthly Diamond Mystery Box unlock',
      createdAt: new Date(Date.now() - 4 * 86400000)
    },
    {
      transactionId: 'TXN-INIT-009',
      userId: demoUserId,
      currency: 'tokens',
      type: 'CREDIT',
      amount: 500,
      balanceBefore: 0,
      balanceAfter: 500,
      source: 'REWARD',
      status: 'COMPLETED',
      description: 'Community activity contribution tokens',
      createdAt: new Date(Date.now() - 3 * 86400000)
    },
    {
      transactionId: 'TXN-INIT-010',
      userId: demoUserId,
      currency: 'spins',
      type: 'CREDIT',
      amount: 3,
      balanceBefore: 0,
      balanceAfter: 3,
      source: 'DAILY_REWARD',
      status: 'COMPLETED',
      description: 'Daily Fortune Wheel lucky spins',
      createdAt: new Date(Date.now() - 1 * 86400000)
    }
  ];

  await WalletTransaction.insertMany(transactions);

  await Withdrawal.create({
    withdrawalId: 'WTH-HIST-001',
    userId: demoUserId,
    method: 'UPI',
    optionId: 'OPT-UPI-250',
    currency: 'ves',
    payoutCurrency: 'INR',
    currencyAmount: 3000,
    payoutAmount: 250,
    payoutDetails: {
      upiId: 'alex.vance@okaxis',
      recipientName: 'Alex Vance',
      note: 'Personal savings'
    },
    status: 'APPROVED',
    reviewNote: 'Processed via simulated IMPS sandbox payout rail',
    transactionId: 'TXN-INIT-005',
    providerMode: 'SANDBOX_SIMULATED',
    providerReferenceId: 'SBX-UPI-HIST-001',
    requestedAt: new Date(Date.now() - 2 * 86400000),
    processedAt: new Date(Date.now() - 2 * 86400000 + 3600000)
  });

  await Referral.create({
    referralId: 'REF-SEED-001',
    referrerUserId: demoUserId,
    referralCode: 'VEL-DEMO01',
    refereeEmail: 'pending.friend@veloop.test',
    status: 'INVITED',
    rewardAmountVes: 0,
    rewardRuleStatus: 'PENDING_BUSINESS_RULE',
    invitedAt: new Date(Date.now() - 2 * 86400000)
  });

  const payoutOptions = [
    {
      optionId: 'OPT-UPI-250',
      methodId: 'METHOD-UPI',
      name: '₹250 UPI Direct Transfer',
      type: 'UPI',
      currency: 'INR',
      payoutValue: 250,
      requiredAmount: 3000,
      active: true,
      eligibility: { minLevel: 1, country: ['IN', 'GLOBAL'] },
      metadata: { processingTime: 'Instant to 2 hours', rails: 'UPI 2.0 / IMPS' }
    },
    {
      optionId: 'OPT-UPI-500',
      methodId: 'METHOD-UPI',
      name: '₹500 UPI Direct Transfer',
      type: 'UPI',
      currency: 'INR',
      payoutValue: 500,
      requiredAmount: 5500,
      active: true,
      eligibility: { minLevel: 1, country: ['IN', 'GLOBAL'] },
      metadata: { processingTime: 'Instant to 2 hours', rails: 'UPI 2.0 / IMPS' }
    },
    {
      optionId: 'OPT-UPI-1000',
      methodId: 'METHOD-UPI',
      name: '₹1,000 UPI Direct Transfer',
      type: 'UPI',
      currency: 'INR',
      payoutValue: 1000,
      requiredAmount: 10500,
      active: true,
      eligibility: { minLevel: 1, country: ['IN', 'GLOBAL'] },
      metadata: { processingTime: 'Instant to 2 hours', rails: 'UPI 2.0 / IMPS' }
    },
    {
      optionId: 'OPT-PP-005',
      methodId: 'METHOD-PAYPAL',
      name: '$5 USD PayPal Cash',
      type: 'PayPal',
      currency: 'USD',
      payoutValue: 5,
      requiredAmount: 5000,
      active: true,
      eligibility: { minLevel: 1, country: ['GLOBAL'] },
      metadata: { processingTime: '12-24 hours', rails: 'PayPal MassPay API' }
    },
    {
      optionId: 'OPT-PP-010',
      methodId: 'METHOD-PAYPAL',
      name: '$10 USD PayPal Cash',
      type: 'PayPal',
      currency: 'USD',
      payoutValue: 10,
      requiredAmount: 9500,
      active: true,
      eligibility: { minLevel: 1, country: ['GLOBAL'] },
      metadata: { processingTime: '12-24 hours', rails: 'PayPal MassPay API' }
    },
    {
      optionId: 'OPT-PP-025',
      methodId: 'METHOD-PAYPAL',
      name: '$25 USD PayPal Cash',
      type: 'PayPal',
      currency: 'USD',
      payoutValue: 25,
      requiredAmount: 23000,
      active: true,
      eligibility: { minLevel: 1, country: ['GLOBAL'] },
      metadata: { processingTime: '12-24 hours', rails: 'PayPal MassPay API' }
    },
    {
      optionId: 'OPT-AMZ-010',
      methodId: 'METHOD-AMAZON',
      name: '$10 Amazon E-Gift Voucher',
      type: 'Amazon Gift Cards',
      currency: 'USD',
      payoutValue: 10,
      requiredAmount: 10000,
      active: true,
      eligibility: { minLevel: 1, country: ['GLOBAL', 'US'] },
      metadata: { processingTime: 'Instant Email Delivery', brand: 'Amazon Global' }
    },
    {
      optionId: 'OPT-AMZ-025',
      methodId: 'METHOD-AMAZON',
      name: '$25 Amazon E-Gift Voucher',
      type: 'Amazon Gift Cards',
      currency: 'USD',
      payoutValue: 25,
      requiredAmount: 24000,
      active: true,
      eligibility: { minLevel: 1, country: ['GLOBAL', 'US'] },
      metadata: { processingTime: 'Instant Email Delivery', brand: 'Amazon Global' }
    },
    {
      optionId: 'OPT-AMZ-INR-500',
      methodId: 'METHOD-AMAZON',
      name: '₹500 Amazon Pay E-Voucher',
      type: 'Amazon Gift Cards',
      currency: 'INR',
      payoutValue: 500,
      requiredAmount: 5500,
      active: true,
      eligibility: { minLevel: 1, country: ['IN'] },
      metadata: { processingTime: 'Instant Code in Email', brand: 'Amazon Pay India' }
    },
    {
      optionId: 'OPT-GPLAY-010',
      methodId: 'METHOD-GOOGLE',
      name: '$10 Google Play Digital Code',
      type: 'Google Play Gift Cards',
      currency: 'USD',
      payoutValue: 10,
      requiredAmount: 10000,
      active: true,
      eligibility: { minLevel: 1, country: ['GLOBAL'] },
      metadata: { processingTime: 'Instant Digital Code', brand: 'Google Play Store' }
    },
    {
      optionId: 'OPT-GPLAY-INR-500',
      methodId: 'METHOD-GOOGLE',
      name: '₹500 Google Play Recharge Code',
      type: 'Google Play Gift Cards',
      currency: 'INR',
      payoutValue: 500,
      requiredAmount: 5500,
      active: true,
      eligibility: { minLevel: 1, country: ['IN'] },
      metadata: { processingTime: 'Instant Digital Code', brand: 'Google Play India' }
    }
  ];

  await PayoutOption.insertMany(payoutOptions);

  await AuditLog.create({
    actorId: adminUserId,
    action: 'SYSTEM_BOOTSTRAP',
    targetType: 'System',
    metadata: {
      seededUsers: 2,
      seededOptions: payoutOptions.length,
      timestamp: new Date()
    }
  });

  console.log('VELoop seed data initialization completed successfully.');
}
