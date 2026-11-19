import React, { useState, useEffect } from 'react';
import { api, WalletTransaction } from '../services/api';
import { History, Filter, ArrowUpRight, ArrowDownLeft, RefreshCw, ChevronLeft, ChevronRight, Search } from 'lucide-react';

export const TransactionHistoryPage: React.FC = () => {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currencyFilter, setCurrencyFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const res = await api.getTransactions({
        page,
        limit: 15,
        currency: currencyFilter,
        type: typeFilter,
        source: sourceFilter
      });
      if (res.success) {
        setTransactions(res.data);
        setTotalPages(res.pagination.totalPages || 1);
        setTotalCount(res.pagination.total || 0);
      }
    } catch (err: any) {
      console.log('Error fetching transactions:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [page, currencyFilter, typeFilter, sourceFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#172554] tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-[#800020]" />
            <span>Transaction Ledger History</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete cryptographic audit trail showing balance snapshots before and after every transaction
          </p>
        </div>
        <button
          onClick={fetchTransactions}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs self-start cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Currency Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Currency</label>
            <select
              value={currencyFilter}
              onChange={(e) => {
                setCurrencyFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-[#800020]"
            >
              <option value="ALL">All Currencies</option>
              <option value="ves">VEs (Spendable)</option>
              <option value="sves">SVEs (Staked)</option>
              <option value="gems">Gems</option>
              <option value="tokens">Tokens</option>
              <option value="spins">Spins</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-[#800020]"
            >
              <option value="ALL">All Types</option>
              <option value="CREDIT">Credits (+)</option>
              <option value="DEBIT">Debits (-)</option>
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-[#800020]"
            >
              <option value="ALL">All Sources</option>
              <option value="DAILY_REWARD">Daily Reward</option>
              <option value="WITHDRAWAL">Withdrawal</option>
              <option value="GAME_REWARD">Game / Spin</option>
              <option value="ADMIN_CREDIT">Admin Credit</option>
              <option value="ADMIN_DEBIT">Admin Debit</option>
              <option value="SIGNUP_BONUS">Signup Bonus</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Showing <strong className="text-slate-800">{transactions.length}</strong> of <strong className="text-slate-800">{totalCount}</strong> records
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <div className="w-6 h-6 border-2 border-[#800020] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading transaction records...
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No transactions match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#172554] text-white uppercase font-semibold">
                <tr>
                  <th className="py-3 px-6">Tx ID & Timestamp</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Currency</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-6">Balance Snapshot</th>
                  <th className="py-3 px-6">Source & Description</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {transactions.map((tx) => (
                  <tr key={tx.transactionId} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-6">
                      <div className="font-mono text-[11px] font-bold text-slate-900">{tx.transactionId}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(tx.createdAt).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        tx.type === 'CREDIT'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 uppercase font-bold text-slate-900">
                      {tx.currency}
                    </td>
                    <td className="py-3.5 px-4 font-bold">
                      <span className={tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}>
                        {tx.type === 'CREDIT' ? '+' : '-'}{tx.amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 font-mono text-[11px]">
                      <span className="text-slate-500">{tx.balanceBefore.toLocaleString()}</span>
                      <span className="text-slate-400 mx-1.5">→</span>
                      <span className="font-bold text-slate-900">{tx.balanceAfter.toLocaleString()}</span>
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="text-slate-900 font-medium">{tx.description || tx.source}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{tx.source} {tx.referenceId ? `(${tx.referenceId})` : ''}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        tx.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : tx.status === 'REVERSED'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
