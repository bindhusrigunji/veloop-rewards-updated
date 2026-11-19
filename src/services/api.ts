export interface User {
  userId: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  accountStatus: 'active' | 'suspended' | 'banned';
  referralCode?: string;
  referredByUserId?: string;
}

export interface WalletBalances {
  userId: string;
  ves: number;
  sves: number;
  gems: number;
  tokens: number;
  spins: number;
  updatedAt?: string;
}

export interface WalletSummary {
  currentBalances: {
    ves: number;
    sves: number;
    gems: number;
    tokens: number;
    spins: number;
  };
  totalEarnedVes: number;
  totalWithdrawnVes: number;
  pendingWithdrawals: {
    count: number;
    currencyAmount: number;
  };
}

export interface WalletTransaction {
  transactionId: string;
  userId: string;
  currency: 'ves' | 'sves' | 'gems' | 'tokens' | 'spins';
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  source: string;
  referenceId?: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  description?: string;
  createdAt: string;
}

export interface PayoutOption {
  optionId: string;
  methodId: string;
  name: string;
  type: 'UPI' | 'PAYPAL' | 'AMAZON_GIFT_CARD' | 'GOOGLE_PLAY_GIFT_CARD' | string;
  currency: string;
  payoutValue: number;
  requiredAmount: number;
  active: boolean;
  metadata?: Record<string, any>;
}

export interface WithdrawalRecord {
  withdrawalId: string;
  userId: string;
  method: string;
  optionId: string;
  currency: string;
  payoutCurrency?: string;
  currencyAmount: number;
  payoutAmount: number;
  payoutDetails: string | Record<string, any>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSING' | 'CANCELLED';
  rejectionReason?: string;
  reviewNote?: string;
  transactionId?: string;
  providerMode?: string;
  providerReferenceId?: string;
  requestedAt: string;
  processedAt?: string;
  user?: {
    name: string;
    email: string;
  };
}

export function formatPayoutDetails(details: unknown): string {
  if (!details) return 'N/A';
  if (typeof details === 'string') return details;
  if (typeof details === 'object') {
    const obj = details as Record<string, any>;
    return (
      obj.upiId ||
      obj.paypalEmail ||
      obj.email ||
      obj.deliveryEmail ||
      obj.raw ||
      obj.address ||
      obj.recipientName ||
      JSON.stringify(obj)
    );
  }
  return String(details);
}

export function getPayoutCurrencySymbol(method: string, currency?: string, optionId?: string): string {
  const c = (currency || '').toUpperCase();
  if (c === 'INR') return '₹';
  if (c === 'EUR') return '€';
  if (c === 'USD') return '$';
  const m = (method || '').toLowerCase();
  const o = (optionId || '').toLowerCase();
  if (m.includes('upi') || o.includes('inr')) return '₹';
  return '$';
}

export interface DBStatus {
  mode: 'atlas' | 'embedded';
  connected: boolean;
  persistent?: boolean;
  dataClassification?: 'CONFIGURED_EXTERNAL_DB' | 'SIMULATED_SANDBOX_FALLBACK';
  envSource?: 'MONGODB_URL' | 'MONGODB_URI' | 'NONE';
  uriMasked: string;
  error?: string;
  errorCategory?: string;
  whitelistNotice?: string;
  pingOk?: boolean;
  latencyMs?: number;
}

export interface HealthResponse {
  status: string;
  app: string;
  database: DBStatus;
  timestamp: string;
}

export interface AuditLogItem {
  _id: string;
  actorId: string;
  action: string;
  targetUserId?: string;
  targetType?: string;
  referenceId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface AdminAnalyticsResponse {
  success: boolean;
  dataOrigin: {
    environmentMode: 'atlas' | 'embedded';
    classification: string;
    productionDataConnected: boolean;
    notice: string;
  };
  dateFilter?: {
    timezone: 'UTC';
    startDateUtc: string | null;
    endDateUtc: string | null;
  };
  kpis: {
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    activeUserRatePct: number;
    walletLiability: {
      ves: number;
      sves: number;
      gems: number;
      tokens: number;
      spins: number;
    };
    totalCreditsVes: number;
    totalDebitsVes: number;
    netVesFlow: number;
    totalCreditsCount: number;
    totalDebitsCount: number;
    vesTransactionsCount?: number;
    allCurrencyCreditsCount?: number;
    allCurrencyDebitsCount?: number;
    allCurrencyTransactionsCount?: number;
    allCurrencyCompletedTransactionsCount?: number;
    withdrawalApprovalRatePct: number;
    payoutEligibleUsersCount: number;
    minPayoutRequiredVes: number | null;
    walletToUserCoveragePct: number;
    nonAdminUsersCount: number;
    nonAdminUsersWithWalletCount: number;
    nonAdminUsersWithoutWalletCount: number;
    dailyRewardVesDistributed: number;
    adminManualAdjustmentsSharePct: number;
    adminManualCreditsVes: number;
    ledgerArithmeticIntegrityPct: number;
    ledgerRowsCheckedCount: number;
    ledgerValidRowsCount: number;
    ledgerInvalidRowsCount: number;
    walletReconciliationDiscrepanciesCount: number;
    walletReconciliationCheckedWallets: number;
    walletReconciliationMatched: boolean;
    avgVesTransactionSize: number;
  };
  withdrawalStats: {
    totalCount: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    pendingVes: number;
    approvedVes: number;
    rejectedVes: number;
    byMethod: Record<string, { count: number; vesAmount: number }>;
  };
  referralPerformance: {
    totalReferralTransactions: number;
    totalReferralVesAwarded: number;
    uniqueReferrersCount: number;
    totalInvites?: number;
    registeredReferrals?: number;
    pendingInvites?: number;
    blockedReferrals?: number;
    conversionRatePct?: number;
    rewardRuleStatus?: string;
    conversionRateNote: string;
  };
  dailyTrends: Array<{ date: string; credits: number; debits: number; count: number; allCurrencyCount?: number }>;
  sourceBreakdown: Array<{ source: string; credits: number; debits: number; count: number; allCurrencyCount?: number }>;
  transactions: Array<WalletTransaction & { userName: string; userEmail: string; dataOrigin: string }>;
  withdrawals: Array<WithdrawalRecord & { userName: string; dataOrigin: string }>;
}

export interface UserConflictAuditResponse {
  success: boolean;
  auditSummary: {
    totalUsersScanned: number;
    totalWalletsScanned: number;
    duplicateEmailsCount: number;
    usersWithoutWalletsCount: number;
    orphanWalletsCount: number;
    status: string;
  };
  duplicateEmails: Array<{ canonicalEmail: string; count: number; userIds: string[] }>;
  usersWithoutWallets: Array<{ userId: string; email: string; role: string }>;
  orphanWallets: Array<{ userId: string; ves: number }>;
}

const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('veloop_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export interface ReferralInviteItem {
  referralId: string;
  refereeEmail: string;
  status: string;
  rewardAmountVes: number;
  rewardRuleStatus: string;
  invitedAt: string;
  convertedAt?: string | null;
}

export interface UserReferralDashboardResponse {
  success: boolean;
  referralCode: string;
  referredByUserId: string | null;
  rewardRuleStatus: string;
  rewardRuleNotice: string;
  summary: {
    totalInvites: number;
    registeredCount: number;
    pendingInvitesCount: number;
    conversionRatePct: number;
  };
  invites: ReferralInviteItem[];
}

export const api = {
  // Auth
  register: (body: { name: string; email: string; password: string; referralCode?: string }) =>
    request<{ success: boolean; message: string; token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body)
    }),

  login: (body: { email: string; password: string }) =>
    request<{ success: boolean; message: string; token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body)
    }),

  getMe: () => request<{ success: boolean; user: User }>('/auth/me'),

  // Wallet
  getWallet: () => request<{ success: boolean; wallet: WalletBalances }>('/wallet'),

  getWalletSummary: () => request<{ success: boolean; summary: WalletSummary }>('/wallet/summary'),

  getTransactions: (params: { page?: number; limit?: number; currency?: string; type?: string; source?: string }) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.currency && params.currency !== 'ALL') searchParams.append('currency', params.currency);
    if (params.type && params.type !== 'ALL') searchParams.append('type', params.type);
    if (params.source && params.source !== 'ALL') searchParams.append('source', params.source);
    return request<{
      success: boolean;
      data: WalletTransaction[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/wallet/transactions?${searchParams.toString()}`);
  },

  claimDaily: () =>
    request<{ success: boolean; message: string; wallet: WalletBalances }>('/wallet/claim-daily', {
      method: 'POST'
    }),

  spinWheel: () =>
    request<{
      success: boolean;
      prize: { currency: string; amount: number; label: string };
      message: string;
      wallet: WalletBalances;
    }>('/wallet/spin', { method: 'POST' }),

  // Payout options
  getPayoutMethods: () =>
    request<{
      success: boolean;
      methods: Array<{ methodId: string; name: string; type: string; minAmount: number; active: boolean }>;
    }>('/payout/methods'),

  getPayoutOptions: () =>
    request<{ success: boolean; options: PayoutOption[] }>('/payout/options'),

  // Withdrawals
  requestWithdrawal: (body: { optionId: string; payoutDetails: string; idempotencyKey?: string }) =>
    request<{ success: boolean; message: string; withdrawal: WithdrawalRecord }>('/withdrawals', {
      method: 'POST',
      body: JSON.stringify(body)
    }),

  getWithdrawals: (params: { page?: number; limit?: number; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.status && params.status !== 'ALL') searchParams.append('status', params.status);
    return request<{
      success: boolean;
      withdrawals: WithdrawalRecord[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/withdrawals?${searchParams.toString()}`);
  },

  getWithdrawalById: (id: string) =>
    request<{ success: boolean; withdrawal: WithdrawalRecord }>(`/withdrawals/${id}`),

  // Admin
  adminGetUsers: () =>
    request<{
      success: boolean;
      users: Array<User & { createdAt: string; wallet: WalletBalances }>;
    }>('/admin/users'),

  adminGetWithdrawals: (status?: string) => {
    const url = status && status !== 'ALL' ? `/admin/withdrawals?status=${status}` : '/admin/withdrawals';
    return request<{ success: boolean; withdrawals: WithdrawalRecord[] }>(url);
  },

  adminApproveWithdrawal: (id: string, reviewNote?: string) =>
    request<{ success: boolean; message: string; withdrawal: WithdrawalRecord }>(
      `/admin/withdrawals/${id}/approve`,
      {
        method: 'PATCH',
        body: JSON.stringify({ reviewNote })
      }
    ),

  adminRejectWithdrawal: (id: string, rejectionReason: string) =>
    request<{ success: boolean; message: string; withdrawal: WithdrawalRecord }>(
      `/admin/withdrawals/${id}/reject`,
      {
        method: 'PATCH',
        body: JSON.stringify({ rejectionReason })
      }
    ),

  adminCreditWallet: (body: { targetUserId: string; currency: string; amount: number; reason?: string }) =>
    request<{ success: boolean; message: string; wallet: WalletBalances; transaction: WalletTransaction }>(
      '/admin/wallet/credit',
      {
        method: 'POST',
        body: JSON.stringify(body)
      }
    ),

  adminDebitWallet: (body: { targetUserId: string; currency: string; amount: number; reason?: string }) =>
    request<{ success: boolean; message: string; wallet: WalletBalances; transaction: WalletTransaction }>(
      '/admin/wallet/debit',
      {
        method: 'POST',
        body: JSON.stringify(body)
      }
    ),

  adminGetAuditLogs: (limit = 50) =>
    request<{ success: boolean; logs: AuditLogItem[] }>(`/admin/audit-logs?limit=${limit}`),

  adminCreatePayoutOption: (data: Partial<PayoutOption>) =>
    request<{ success: boolean; option: PayoutOption }>('/admin/payout-options', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  adminUpdatePayoutOption: (id: string, updates: Partial<PayoutOption>) =>
    request<{ success: boolean; option: PayoutOption }>(`/admin/payout-options/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    }),

  adminGetDbStatus: () =>
    request<{ success: boolean; database: DBStatus }>('/admin/db-status'),

  adminReconnectDb: () =>
    request<{ success: boolean; message: string; database: DBStatus }>('/admin/db-reconnect', {
      method: 'POST'
    }),

  adminGetAnalytics: (params?: { startDate?: string; endDate?: string; currency?: string; source?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    if (params?.currency && params.currency !== 'ALL') searchParams.append('currency', params.currency);
    if (params?.source && params.source !== 'ALL') searchParams.append('source', params.source);
    if (params?.search) searchParams.append('search', params.search);
    return request<AdminAnalyticsResponse>(`/admin/analytics?${searchParams.toString()}`);
  },

  adminGetUserConflicts: () => request<UserConflictAuditResponse>('/admin/user-conflicts'),

  adminGetReferrals: () =>
    request<{
      success: boolean;
      summary: {
        totalInvites: number;
        registeredCount: number;
        pendingInvitesCount: number;
        blockedCount: number;
        conversionRatePct: number;
        uniqueReferrersWithInvites: number;
        rewardRuleStatus: string;
        rewardRuleNotice: string;
      };
      referrals: Array<ReferralInviteItem & { referrerUserId: string; referrerName: string; refereeName?: string | null }>;
    }>('/admin/referrals'),

  // Referrals
  validateReferralCode: (code: string) =>
    request<{ success: boolean; valid: boolean; referralCode?: string; referrerFirstName?: string; reason?: string }>(
      `/referrals/validate/${encodeURIComponent(code)}`
    ),

  getMyReferrals: () => request<UserReferralDashboardResponse>('/referrals/me'),

  sendReferralInvite: (refereeEmail: string) =>
    request<{ success: boolean; message: string; referral: ReferralInviteItem }>('/referrals/invite', {
      method: 'POST',
      body: JSON.stringify({ refereeEmail })
    }),

  // Health
  getHealth: () => request<HealthResponse>('/health')
};
