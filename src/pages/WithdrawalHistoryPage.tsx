import React, { useState, useEffect, useCallback } from 'react';
import { api, WithdrawalRecord, formatPayoutDetails, getPayoutCurrencySymbol } from '../services/api';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  ArrowUpRight, 
  ChevronRight,
  CreditCard
} from 'lucide-react';

interface WithdrawalHistoryPageProps {
  onNavigate: (page: string) => void;
}

export const WithdrawalHistoryPage: React.FC<WithdrawalHistoryPageProps> = ({ onNavigate }) => {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRecord | null>(null);

  const fetchWithdrawals = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.getWithdrawals({ status: statusFilter });
      if (res && res.success) {
        setWithdrawals(Array.isArray(res.withdrawals) ? res.withdrawals : []);
      } else {
        setWithdrawals([]);
      }
    } catch (err: any) {
      setWithdrawals([]);
      setErrorMsg(err?.message || 'Unable to load withdrawal history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Approved (Simulated)
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Rejected & Refunded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#172554] tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#800020]" />
            <span>Withdrawal Requests & History</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track simulated sandbox voucher requests, admin review statuses, and ledger refund confirmations (no live cash transfers)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('payout')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#800020] hover:bg-[#9a0027] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4 text-[#F4C542]" />
            <span>New Withdrawal</span>
          </button>
          <button
            onClick={fetchWithdrawals}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === st
                ? 'bg-[#172554] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {st === 'ALL' ? 'All Requests' : st}
          </button>
        ))}
      </div>

      {/* Withdrawals List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 text-xs bg-white rounded-2xl border border-slate-200">
          <div className="w-6 h-6 border-2 border-[#800020] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading withdrawal records...
        </div>
      ) : errorMsg ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-rose-200 text-rose-800 space-y-3 shadow-xs">
          <AlertCircle className="w-8 h-8 mx-auto text-rose-600" />
          <div className="space-y-1">
            <h3 className="font-bold text-sm text-rose-900">Failed to Load Withdrawals</h3>
            <p className="text-xs text-rose-700">{errorMsg}</p>
          </div>
          <button
            onClick={fetchWithdrawals}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#172554] hover:bg-blue-900 text-white text-xs font-bold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      ) : withdrawals.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 space-y-3">
          <CreditCard className="w-8 h-8 mx-auto text-slate-300" />
          <p className="text-xs font-medium text-slate-600">
            {statusFilter === 'ALL'
              ? 'You have not submitted any withdrawal requests yet.'
              : `No withdrawal records found with status "${statusFilter}".`}
          </p>
          <button
            onClick={() => onNavigate('payout')}
            className="px-4 py-2 rounded-xl bg-[#800020] hover:bg-[#9a0027] text-white text-xs font-bold cursor-pointer"
          >
            Redeem Your First Payout
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {withdrawals.map((w) => {
            const currencySymbol = getPayoutCurrencySymbol(w.method, w.currency, w.optionId);
            const recipientLabel = formatPayoutDetails(w.payoutDetails);
            const requestedDate = w.requestedAt ? new Date(w.requestedAt) : null;

            return (
              <div
                key={w.withdrawalId}
                onClick={() => setSelectedWithdrawal(w)}
                className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-[#800020]/50 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900">{w.withdrawalId}</span>
                    {getStatusBadge(w.status)}
                    {requestedDate && !isNaN(requestedDate.getTime()) && (
                      <span className="text-[11px] text-slate-400">
                        Requested on {requestedDate.toLocaleDateString()} at{' '}
                        {requestedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="font-semibold text-slate-800">
                      Method: <span className="text-[#800020]">{w.method}</span>
                    </div>
                    <div className="text-slate-500">
                      Reserved: <strong className="text-slate-900">{(w.currencyAmount ?? 0).toLocaleString()} VEs</strong>
                    </div>
                    <div className="text-slate-500 truncate max-w-xs">
                      Recipient: <span className="font-mono text-slate-700">{recipientLabel}</span>
                    </div>
                  </div>

                  {/* Rejection / Refund Notice */}
                  {w.status === 'REJECTED' && (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2 mt-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold">Reason:</strong> {w.rejectionReason || 'Rejected by administrator'}
                        <span className="block text-[11px] text-rose-700 mt-0.5 font-semibold">
                          ✓ {(w.currencyAmount ?? 0).toLocaleString()} VEs were automatically refunded to your wallet balance.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Approval Review Note */}
                  {w.status === 'APPROVED' && w.reviewNote && (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                      <strong className="font-bold">Admin Note:</strong> {w.reviewNote}
                    </div>
                  )}
                </div>

                {/* Right Side Amount & Action */}
                <div className="flex md:flex-col items-center md:items-end justify-between border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                  <div className="text-lg font-black text-[#172554]">
                    {currencySymbol}{(w.payoutAmount ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium">Simulated Value</div>
                  <div className="hidden md:flex items-center gap-1 text-xs text-[#800020] font-bold mt-2">
                    <span>Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedWithdrawal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-[#172554] p-5 text-white flex items-center justify-between border-b border-blue-900">
              <h3 className="font-bold text-base text-white">Withdrawal Audit Record</h3>
              <button
                onClick={() => setSelectedWithdrawal(null)}
                className="text-blue-300 hover:text-white p-1 rounded-lg hover:bg-blue-800 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs bg-[#FFF9F0]">
              <div className="flex justify-between items-center pb-2 border-b border-amber-200/50">
                <span className="text-slate-500">Status:</span>
                {getStatusBadge(selectedWithdrawal.status)}
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Withdrawal ID:</span>
                <span className="font-mono font-bold text-slate-900">{selectedWithdrawal.withdrawalId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Voucher Option:</span>
                <span className="font-semibold text-slate-800">{selectedWithdrawal.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Simulated Payout Value:</span>
                <span className="font-extrabold text-slate-900 text-sm">
                  {getPayoutCurrencySymbol(selectedWithdrawal.method, selectedWithdrawal.currency, selectedWithdrawal.optionId)}
                  {(selectedWithdrawal.payoutAmount ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">VEs Deducted / Reserved:</span>
                <span className="font-bold text-[#800020]">{(selectedWithdrawal.currencyAmount ?? 0).toLocaleString()} VEs</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 flex-shrink-0">Recipient Details:</span>
                <span className="font-mono text-slate-800 text-right break-all">
                  {formatPayoutDetails(selectedWithdrawal.payoutDetails)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Requested Timestamp:</span>
                <span className="text-slate-700">
                  {selectedWithdrawal.requestedAt ? new Date(selectedWithdrawal.requestedAt).toLocaleString() : 'N/A'}
                </span>
              </div>
              {selectedWithdrawal.processedAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Processed Timestamp:</span>
                  <span className="text-slate-700">{new Date(selectedWithdrawal.processedAt).toLocaleString()}</span>
                </div>
              )}
              {selectedWithdrawal.rejectionReason && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
                  <span className="font-bold block mb-1">Rejection Reason & Audit Note:</span>
                  <span>{selectedWithdrawal.rejectionReason}</span>
                  <span className="block mt-2 font-semibold text-rose-700">
                    Automatic Ledger Reversal: {selectedWithdrawal.currencyAmount.toLocaleString()} VEs credited back.
                  </span>
                </div>
              )}
              <div className="pt-2">
                <button
                  onClick={() => setSelectedWithdrawal(null)}
                  className="w-full py-2.5 rounded-xl bg-[#172554] hover:bg-blue-900 text-white font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
