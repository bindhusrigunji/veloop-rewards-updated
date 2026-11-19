import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  api,
  WithdrawalRecord,
  User,
  WalletBalances,
  AuditLogItem,
  PayoutOption,
  formatPayoutDetails,
  getPayoutCurrencySymbol
} from '../services/api';
import { AdminAnalyticsTab } from '../components/AdminAnalyticsTab';
import { 
  ShieldCheck, 
  Database, 
  CheckCircle2, 
  Clock, 
  Coins, 
  Users, 
  PlusCircle, 
  MinusCircle, 
  RefreshCw, 
  Search, 
  AlertTriangle,
  Gift,
  Shield,
  BarChart3
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const { user, dbStatus, refreshDbStatus } = useAuth();
  const [activeTab, setActiveTab] = useState<'analytics' | 'withdrawals' | 'users' | 'wallet_action' | 'payout_options' | 'audit_logs'>('analytics');

  // Database reconnection state
  const [isReconnectingDb, setIsReconnectingDb] = useState(false);
  const [reconnectResult, setReconnectResult] = useState<string | null>(null);

  // Withdrawals tab state
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [withdrawalFilter, setWithdrawalFilter] = useState<string>('PENDING');
  const [selectedWithdrawalForReject, setSelectedWithdrawalForReject] = useState<WithdrawalRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [approvalNote, setApprovalNote] = useState<string>('');
  const [processingWithdrawalId, setProcessingWithdrawalId] = useState<string | null>(null);

  // Users tab state
  const [usersList, setUsersList] = useState<Array<User & { createdAt: string; wallet: WalletBalances }>>([]);
  const [searchUser, setSearchUser] = useState<string>('');

  // Manual Credit / Debit tab state
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [actionType, setActionType] = useState<'credit' | 'debit'>('credit');
  const [actionCurrency, setActionCurrency] = useState<string>('ves');
  const [actionAmount, setActionAmount] = useState<string>('500');
  const [actionReason, setActionReason] = useState<string>('');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState<boolean>(false);

  // Payout options tab state
  const [payoutOptions, setPayoutOptions] = useState<PayoutOption[]>([]);
  const [newOptionForm, setNewOptionForm] = useState({
    name: '',
    type: 'UPI',
    currency: 'INR',
    payoutValue: 500,
    requiredAmount: 1000
  });

  // Audit logs tab state
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadAllAdminData = async () => {
    setIsLoading(true);
    try {
      const [wRes, uRes, pRes, aRes] = await Promise.all([
        api.adminGetWithdrawals(withdrawalFilter),
        api.adminGetUsers(),
        api.getPayoutOptions(),
        api.adminGetAuditLogs(50)
      ]);
      if (wRes.success) setWithdrawals(wRes.withdrawals);
      if (uRes.success) setUsersList(uRes.users);
      if (pRes.success) setPayoutOptions(pRes.options);
      if (aRes.success) setAuditLogs(aRes.logs);
    } catch (err: any) {
      console.log('Admin data load error:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllAdminData();
  }, [withdrawalFilter]);

  const handleReconnectDb = async () => {
    setIsReconnectingDb(true);
    setReconnectResult(null);
    try {
      const res = await api.adminReconnectDb();
      setReconnectResult(res.message || 'Database reconnect attempt finished.');
      await refreshDbStatus();
    } catch (err: any) {
      setReconnectResult(`Reconnect notice: ${err.message}`);
    } finally {
      setIsReconnectingDb(false);
    }
  };

  const handleApproveWithdrawal = async (withdrawal: WithdrawalRecord) => {
    setProcessingWithdrawalId(withdrawal.withdrawalId);
    try {
      const res = await api.adminApproveWithdrawal(
        withdrawal.withdrawalId,
        approvalNote || 'Approved by admin in sandbox (simulated payout — no real cash transfer)'
      );
      if (res.success) {
        setApprovalNote('');
        await loadAllAdminData();
      }
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setProcessingWithdrawalId(null);
    }
  };

  const handleRejectWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWithdrawalForReject) return;
    if (!rejectionReason.trim()) {
      alert('A rejection reason is required for compliance audit logs.');
      return;
    }

    setProcessingWithdrawalId(selectedWithdrawalForReject.withdrawalId);
    try {
      const res = await api.adminRejectWithdrawal(
        selectedWithdrawalForReject.withdrawalId,
        rejectionReason.trim()
      );
      if (res.success) {
        setSelectedWithdrawalForReject(null);
        setRejectionReason('');
        await loadAllAdminData();
      }
    } catch (err: any) {
      alert(`Rejection error: ${err.message}`);
    } finally {
      setProcessingWithdrawalId(null);
    }
  };

  const handleExecuteWalletAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId || !actionAmount) return;

    setIsExecutingAction(true);
    setActionFeedback(null);

    const amountNum = Number(actionAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setActionFeedback({ type: 'error', message: 'Amount must be greater than zero.' });
      setIsExecutingAction(false);
      return;
    }

    try {
      if (actionType === 'credit') {
        const res = await api.adminCreditWallet({
          targetUserId,
          currency: actionCurrency,
          amount: amountNum,
          reason: actionReason || 'Manual administrative credit'
        });
        setActionFeedback({ type: 'success', message: res.message });
      } else {
        const res = await api.adminDebitWallet({
          targetUserId,
          currency: actionCurrency,
          amount: amountNum,
          reason: actionReason || 'Manual administrative debit'
        });
        setActionFeedback({ type: 'success', message: res.message });
      }
      await loadAllAdminData();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Operation failed' });
    } finally {
      setIsExecutingAction(false);
    }
  };

  const handleCreatePayoutOption = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.adminCreatePayoutOption({
        name: newOptionForm.name,
        type: newOptionForm.type,
        currency: newOptionForm.currency,
        payoutValue: Number(newOptionForm.payoutValue),
        requiredAmount: Number(newOptionForm.requiredAmount),
        active: true
      });
      if (res.success) {
        alert('Payout voucher created successfully!');
        setNewOptionForm({
          name: '',
          type: 'UPI',
          currency: 'INR',
          payoutValue: 500,
          requiredAmount: 1000
        });
        await loadAllAdminData();
      }
    } catch (err: any) {
      alert(`Error creating option: ${err.message}`);
    }
  };

  const filteredUsers = usersList.filter(
    (u) =>
      u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.email.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.userId.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Admin Header */}
      <div className="bg-[#172554] rounded-2xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-blue-900">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#800020] text-amber-200 uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Administrative Control Console
            </span>
            <span className="text-xs text-blue-300">Logged in as {user?.email}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            VELoop Admin & Disbursement Management
          </h1>
          <p className="text-sm text-blue-200 mt-1 max-w-2xl">
            Review pending withdrawal requests with automated user refunds upon rejection, perform atomic manual balance adjustments, manage payout options, and audit immutable system logs.
          </p>
        </div>

        <button
          onClick={loadAllAdminData}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-900/80 hover:bg-blue-800 text-white font-medium text-xs border border-blue-700/60 shadow-sm transition-all cursor-pointer self-start md:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh All Datasets</span>
        </button>
      </div>

      {/* Database Diagnostic & Whitelist Card */}
      <div className={`p-5 rounded-2xl border shadow-xs transition-all ${
        dbStatus?.mode === 'atlas' && dbStatus.connected
          ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
          : 'bg-amber-50 border-amber-300 text-amber-950'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl ${
              dbStatus?.mode === 'atlas' && dbStatus.connected ? 'bg-emerald-200/60' : 'bg-amber-200/60'
            }`}>
              <Database className="w-6 h-6 text-[#172554]" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">
                  Active Database Engine: {dbStatus?.mode === 'atlas' ? 'MongoDB Atlas Cloud' : 'Embedded MongoDB Storage'}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                  dbStatus?.connected ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                }`}>
                  {dbStatus?.connected ? 'Online' : 'Failover Active'}
                </span>
              </div>
              <p className="text-xs opacity-90 max-w-2xl leading-relaxed">
                {dbStatus?.mode === 'atlas' && dbStatus.connected
                ? `Connected to live MongoDB Atlas replica set (${dbStatus.uriMasked}).`
                : dbStatus?.error
                ? `Atlas Connection Error: ${dbStatus.error}`
                : dbStatus?.whitelistNotice || 'Currently running embedded MongoDB engine.'}
              </p>
              {reconnectResult && (
                <p className="text-xs font-semibold text-blue-900 mt-1">
                  Result: {reconnectResult}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleReconnectDb}
            disabled={isReconnectingDb}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#172554] hover:bg-blue-900 text-white font-bold text-xs shadow-xs transition-all cursor-pointer self-start md:self-center disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReconnectingDb ? 'animate-spin' : ''}`} />
            <span>{isReconnectingDb ? 'Testing Connection...' : 'Test / Reconnect DB'}</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-[#172554] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-[#F4C542]" />
          <span>Analytics & KPIs</span>
        </button>

        <button
          onClick={() => setActiveTab('withdrawals')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'withdrawals'
              ? 'bg-[#172554] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-[#F4C542]" />
          <span>Withdrawals Review ({withdrawals.filter(w => w.status === 'PENDING').length})</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'bg-[#172554] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-blue-400" />
          <span>Users & Wallets ({usersList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('wallet_action')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'wallet_action'
              ? 'bg-[#172554] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <span>Manual Credit / Debit</span>
        </button>

        <button
          onClick={() => setActiveTab('payout_options')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'payout_options'
              ? 'bg-[#172554] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Gift className="w-3.5 h-3.5 text-purple-400" />
          <span>Payout Options</span>
        </button>

        <button
          onClick={() => setActiveTab('audit_logs')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'audit_logs'
              ? 'bg-[#172554] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Audit Trail</span>
        </button>
      </div>

      {/* Tab 0: Interactive Analytics & KPIs */}
      {activeTab === 'analytics' && <AdminAnalyticsTab />}

      {/* Tab 1: Withdrawals Review */}
      {activeTab === 'withdrawals' && (
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#4169E1] flex-shrink-0" />
            <span>
              <strong>Sandbox Simulation Notice:</strong> Approving a request updates its database status to <code className="font-mono">APPROVED</code> only. No live UPI, PayPal, bank transfer, or gift-card payment gateway is executed.
            </span>
          </div>

          <div className="flex items-center gap-2">
            {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((st) => (
              <button
                key={st}
                onClick={() => setWithdrawalFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  withdrawalFilter === st ? 'bg-[#800020] text-white' : 'bg-white border text-slate-700'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            {withdrawals.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No withdrawals in {withdrawalFilter} status.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#172554] text-white uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-6">ID & Date</th>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Voucher Method</th>
                      <th className="py-3 px-4">Payout Value</th>
                      <th className="py-3 px-4">Reserved VEs</th>
                      <th className="py-3 px-4">Recipient Details</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-6 text-right">Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {withdrawals.map((w) => (
                      <tr key={w.withdrawalId} className="hover:bg-slate-50">
                        <td className="py-3.5 px-6">
                          <div className="font-mono font-bold text-slate-900">{w.withdrawalId}</div>
                          <div className="text-[10px] text-slate-400">{new Date(w.requestedAt).toLocaleString()}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{w.user?.name || w.userId}</div>
                          <div className="text-[10px] text-slate-400">{w.user?.email}</div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">{w.method}</td>
                        <td className="py-3.5 px-4 font-black text-emerald-700">
                          {getPayoutCurrencySymbol(w.method, w.currency, w.optionId)}{w.payoutAmount}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-[#800020]">
                          {w.currencyAmount.toLocaleString()} VEs
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 truncate max-w-xs">
                          {formatPayoutDetails(w.payoutDetails)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            w.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : w.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {w.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          {w.status === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApproveWithdrawal(w)}
                                disabled={processingWithdrawalId === w.withdrawalId}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setSelectedWithdrawalForReject(w)}
                                disabled={processingWithdrawalId === w.withdrawalId}
                                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                              >
                                Reject & Refund
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Processed on {w.processedAt ? new Date(w.processedAt).toLocaleDateString() : 'N/A'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Rejection Modal with Automatic Refund */}
          {selectedWithdrawalForReject && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
                <div className="bg-[#800020] p-5 text-white flex items-center justify-between">
                  <h3 className="font-bold text-base text-white">Reject Withdrawal & Refund VEs</h3>
                  <button
                    onClick={() => setSelectedWithdrawalForReject(null)}
                    className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <form onSubmit={handleRejectWithdrawal} className="p-6 space-y-4 text-xs bg-[#FFF9F0]">
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                    <strong className="block mb-1 font-bold">Automatic Ledger Reversal Warning:</strong>
                    Rejecting this withdrawal will immediately refund{' '}
                    <strong className="text-[#800020]">
                      {selectedWithdrawalForReject.currencyAmount.toLocaleString()} VEs
                    </strong>{' '}
                    back to user <strong>{selectedWithdrawalForReject.userId}</strong> and create a corresponding credit ledger entry.
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Reason for Rejection (Audit Compliance) <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="e.g. Invalid UPI handle, verification failure, account mismatch..."
                      required
                      className="w-full p-3 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#800020] text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedWithdrawalForReject(null)}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={processingWithdrawalId === selectedWithdrawalForReject.withdrawalId}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer disabled:opacity-50"
                    >
                      Confirm Rejection & Refund
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Users & Wallets */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Search user by name, email, or user ID..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#172554]"
              />
            </div>
            <span className="text-xs text-slate-500">
              Total registered accounts: <strong className="text-slate-900">{usersList.length}</strong>
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#172554] text-white uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-6">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Spendable (VEs)</th>
                    <th className="py-3 px-4">Staked (SVEs)</th>
                    <th className="py-3 px-4">Gems</th>
                    <th className="py-3 px-4">Tokens</th>
                    <th className="py-3 px-4">Spins</th>
                    <th className="py-3 px-6 text-right">Quick Select</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredUsers.map((u) => (
                    <tr key={u.userId} className="hover:bg-slate-50">
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-slate-900">{u.name}</div>
                        <div className="text-[10px] text-slate-400">{u.email}</div>
                        <div className="text-[10px] font-mono text-slate-500">{u.userId}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.role === 'admin' ? 'bg-[#800020] text-amber-200' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {u.accountStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#800020]">
                        {u.wallet?.ves?.toLocaleString() ?? 0}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-blue-700">
                        {u.wallet?.sves?.toLocaleString() ?? 0}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-purple-700">
                        {u.wallet?.gems?.toLocaleString() ?? 0}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-amber-700">
                        {u.wallet?.tokens?.toLocaleString() ?? 0}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {u.wallet?.spins ?? 0}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <button
                          onClick={() => {
                            setTargetUserId(u.userId);
                            setActiveTab('wallet_action');
                          }}
                          className="px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs cursor-pointer"
                        >
                          Credit / Debit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Manual Credit / Debit */}
      {activeTab === 'wallet_action' && (
        <div className="max-w-2xl bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div>
            <h3 className="font-extrabold text-[#172554] text-base flex items-center gap-2">
              <Coins className="w-5 h-5 text-[#800020]" />
              <span>Administrative Balance Adjustment</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Atomic ledger mutation with double-entry before/after snapshots and immutable audit logging
            </p>
          </div>

          {actionFeedback && (
            <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
              actionFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}>
              {actionFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
              <span>{actionFeedback.message}</span>
            </div>
          )}

          <form onSubmit={handleExecuteWalletAction} className="space-y-4 text-xs">
            {/* Target User */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Target User ID <span className="text-red-500">*</span>
              </label>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                required
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-[#172554]"
              >
                <option value="">Select a user...</option>
                {usersList.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.name} ({u.email}) — ID: {u.userId}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Type */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setActionType('credit')}
                className={`py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  actionType === 'credit'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Credit (+)</span>
              </button>

              <button
                type="button"
                onClick={() => setActionType('debit')}
                className={`py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  actionType === 'debit'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                <MinusCircle className="w-4 h-4" />
                <span>Debit (-)</span>
              </button>
            </div>

            {/* Currency & Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Currency</label>
                <select
                  value={actionCurrency}
                  onChange={(e) => setActionCurrency(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-[#172554]"
                >
                  <option value="ves">VEs (Spendable)</option>
                  <option value="sves">SVEs (Staked)</option>
                  <option value="gems">Gems</option>
                  <option value="tokens">Tokens</option>
                  <option value="spins">Spins</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Amount</label>
                <input
                  type="number"
                  min="1"
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-[#172554]"
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Reason / Description</label>
              <input
                type="text"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="e.g. Community promotion award, contest bonus, bug bounty..."
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:outline-hidden focus:ring-2 focus:ring-[#172554]"
              />
            </div>

            <button
              type="submit"
              disabled={isExecutingAction || !targetUserId}
              className={`w-full py-3 rounded-xl font-bold text-white shadow-md transition-all cursor-pointer disabled:opacity-50 ${
                actionType === 'credit' ? 'bg-[#800020] hover:bg-[#9a0027]' : 'bg-rose-700 hover:bg-rose-800'
              }`}
            >
              {isExecutingAction
                ? 'Processing Mutation...'
                : `Execute ${actionType.toUpperCase()} of ${actionAmount} ${actionCurrency.toUpperCase()}`}
            </button>
          </form>
        </div>
      )}

      {/* Tab 4: Payout Options Management */}
      {activeTab === 'payout_options' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Option Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-[#172554] text-sm flex items-center gap-2">
              <Gift className="w-4 h-4 text-[#800020]" />
              <span>Add New Payout Voucher</span>
            </h3>

            <form onSubmit={handleCreatePayoutOption} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Voucher Title</label>
                <input
                  type="text"
                  value={newOptionForm.name}
                  onChange={(e) => setNewOptionForm({ ...newOptionForm, name: e.target.value })}
                  placeholder="e.g. $100 Amazon Gift Card"
                  required
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Method Type</label>
                <select
                  value={newOptionForm.type}
                  onChange={(e) => setNewOptionForm({ ...newOptionForm, type: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300"
                >
                  <option value="UPI">UPI Direct</option>
                  <option value="PAYPAL">PayPal Cash</option>
                  <option value="AMAZON_GIFT_CARD">Amazon Gift Card</option>
                  <option value="GOOGLE_PLAY_GIFT_CARD">Google Play Gift Card</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Currency</label>
                  <select
                    value={newOptionForm.currency}
                    onChange={(e) => setNewOptionForm({ ...newOptionForm, currency: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payout Cash Value</label>
                  <input
                    type="number"
                    value={newOptionForm.payoutValue}
                    onChange={(e) => setNewOptionForm({ ...newOptionForm, payoutValue: Number(e.target.value) })}
                    required
                    className="w-full p-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Required VEs</label>
                <input
                  type="number"
                  value={newOptionForm.requiredAmount}
                  onChange={(e) => setNewOptionForm({ ...newOptionForm, requiredAmount: Number(e.target.value) })}
                  required
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#172554] hover:bg-blue-900 text-white font-bold cursor-pointer"
              >
                Create Payout Option
              </button>
            </form>
          </div>

          {/* Existing Options List */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="font-bold text-[#172554] text-sm">Active Payout Vouchers ({payoutOptions.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {payoutOptions.map((opt) => (
                <div key={opt.optionId} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">{opt.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {opt.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex justify-between">
                    <span>Value: <strong className="text-slate-900">{opt.currency === 'INR' ? '₹' : '$'}{opt.payoutValue}</strong></span>
                    <span>Cost: <strong className="text-[#800020]">{opt.requiredAmount.toLocaleString()} VEs</strong></span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 truncate">ID: {opt.optionId}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Audit Trail */}
      {activeTab === 'audit_logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-[#172554] text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>Immutable System Audit Trail (Last 50 Events)</span>
            </h3>
            <span className="text-xs text-slate-400">Read-only regulatory compliance logs</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#172554] text-white uppercase font-semibold">
                <tr>
                  <th className="py-3 px-6">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor ID</th>
                  <th className="py-3 px-4">Target Type</th>
                  <th className="py-3 px-4">Target / Ref ID</th>
                  <th className="py-3 px-6">Metadata Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {auditLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50">
                    <td className="py-3 px-6 text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-700">{log.actorId}</td>
                    <td className="py-3 px-4 text-slate-600">{log.targetType || 'N/A'}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {log.targetUserId || log.referenceId || 'N/A'}
                    </td>
                    <td className="py-3 px-6 font-mono text-[10px] text-slate-600 truncate max-w-xs">
                      {log.metadata ? JSON.stringify(log.metadata) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
