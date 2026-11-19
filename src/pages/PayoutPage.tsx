import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, PayoutOption, WithdrawalRecord, formatPayoutDetails } from '../services/api';
import { 
  ArrowUpRight, 
  Coins, 
  CheckCircle2, 
  AlertCircle, 
  CreditCard, 
  Gift, 
  Smartphone, 
  Globe, 
  ShieldCheck, 
  Clock, 
  ArrowRight,
  ExternalLink
} from 'lucide-react';

interface PayoutPageProps {
  onNavigate: (page: string) => void;
}

export const PayoutPage: React.FC<PayoutPageProps> = ({ onNavigate }) => {
  const { wallet, refreshWallet } = useAuth();
  const [options, setOptions] = useState<PayoutOption[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [selectedOption, setSelectedOption] = useState<PayoutOption | null>(null);
  const [payoutDetails, setPayoutDetails] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successWithdrawal, setSuccessWithdrawal] = useState<WithdrawalRecord | null>(null);

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      const res = await api.getPayoutOptions();
      if (res.success) {
        setOptions(res.options);
      }
    } catch (err: any) {
      console.log('Error loading payout options:', err.message);
    }
  };

  const methods = [
    { id: 'ALL', name: 'All Vouchers', icon: Gift },
    { id: 'UPI', name: 'UPI Direct (India)', icon: Smartphone },
    { id: 'PAYPAL', name: 'PayPal Cash (Global)', icon: Globe },
    { id: 'AMAZON', name: 'Amazon Gift Card', icon: CreditCard },
    { id: 'GOOGLE', name: 'Google Play Gift Card', icon: Gift }
  ];

  const filteredOptions = selectedMethod === 'ALL'
    ? options
    : options.filter((opt) => (opt.type || '').toUpperCase().includes(selectedMethod));

  const userVes = wallet?.ves ?? 0;

  const handleOpenRedeemModal = (opt: PayoutOption) => {
    setSelectedOption(opt);
    setErrorMsg(null);
    setSuccessWithdrawal(null);
    if (opt.type === 'UPI') {
      setPayoutDetails('user@oksbi');
    } else {
      setPayoutDetails('');
    }
  };

  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOption) return;

    if (!payoutDetails.trim()) {
      setErrorMsg('Please enter valid payout recipient details (UPI ID or Email)');
      return;
    }

    if (userVes < selectedOption.requiredAmount) {
      setErrorMsg(`Insufficient VEs balance. You need ${selectedOption.requiredAmount.toLocaleString()} VEs, but only have ${userVes.toLocaleString()} VEs.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const idempotencyKey = `REQ-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const res = await api.requestWithdrawal({
        optionId: selectedOption.optionId,
        payoutDetails: payoutDetails.trim(),
        idempotencyKey
      });

      if (res.success && res.withdrawal) {
        setSuccessWithdrawal(res.withdrawal);
        await refreshWallet();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit withdrawal request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMethodIcon = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('upi')) return <Smartphone className="w-5 h-5 text-purple-600" />;
    if (t.includes('paypal')) return <Globe className="w-5 h-5 text-blue-600" />;
    if (t.includes('amazon')) return <CreditCard className="w-5 h-5 text-amber-600" />;
    return <Gift className="w-5 h-5 text-emerald-600" />;
  };

  const getMethodPlaceholder = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('upi')) return 'Enter UPI ID (e.g. mobile@upi, yourname@okhdfcbank)';
    if (t.includes('paypal')) return 'Enter verified PayPal account email';
    if (t.includes('amazon')) return 'Enter email to receive Amazon Gift Code';
    if (t.includes('google')) return 'Enter email to receive Google Play Code';
    return 'Enter payout recipient address or email';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-[#172554] rounded-2xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-blue-900">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#800020] text-[#FFF9F0]">
              Simulated Sandbox Payout Portal
            </span>
            <span className="text-xs text-blue-200">Demo Ref: 100 VEs = $1.00 USD</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Redeem Rewards & Request Simulated Payout
          </h1>
          <p className="text-sm text-blue-200 mt-1 max-w-2xl">
            Test UPI, PayPal, Amazon, and Google Play voucher request workflows. Your VEs balance is atomically reserved upon submission (sandbox simulation only — no real cash or live gateway payout is issued).
          </p>
        </div>

        {/* Current Balance Card */}
        <div className="bg-[#0e1738] p-4 rounded-xl border border-blue-900/80 min-w-[220px]">
          <span className="text-xs text-blue-300 font-medium block">Your Spendable VEs:</span>
          <div className="flex items-center gap-2 mt-1">
            <Coins className="w-6 h-6 text-[#F4C542]" />
            <span className="text-2xl font-black text-white">{userVes.toLocaleString()}</span>
          </div>
          <span className="text-[11px] text-emerald-400 font-semibold block mt-1">
            ≈ ${(userVes / 100).toFixed(2)} USD (Demo Reference Rate)
          </span>
        </div>
      </div>

      {/* Method Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {methods.map((method) => {
          const Icon = method.icon;
          const isSelected = selectedMethod === method.id;
          return (
            <button
              key={method.id}
              onClick={() => setSelectedMethod(method.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#172554] text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5 text-[#F4C542]" />
              <span>{method.name}</span>
            </button>
          );
        })}
      </div>

      {/* Payout Options Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOptions.map((opt) => {
          const isEligible = userVes >= opt.requiredAmount;
          const needed = opt.requiredAmount - userVes;

          return (
            <div
              key={opt.optionId}
              className={`bg-white rounded-2xl p-6 border transition-all flex flex-col justify-between shadow-xs ${
                isEligible
                  ? 'border-slate-200 hover:border-[#800020] hover:shadow-md'
                  : 'border-slate-200 opacity-90'
              }`}
            >
              <div>
                {/* Method header & Icon */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      {getMethodIcon(opt.type)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{opt.name}</h3>
                      <span className="text-[11px] text-slate-500 uppercase tracking-wider">{opt.type.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isEligible
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {isEligible ? 'Eligible' : `Need ${needed.toLocaleString()} VEs`}
                  </span>
                </div>

                {/* Cash Value Display */}
                <div className="bg-[#FFF9F0] p-4 rounded-xl border border-amber-100 mb-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-slate-600 font-medium">Simulated Value:</span>
                    <span className="text-xl font-black text-[#800020]">
                      {opt.currency === 'INR' ? '₹' : '$'}{opt.payoutValue.toLocaleString()} {opt.currency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-200/50 text-xs">
                    <span className="text-slate-500">Required VEs:</span>
                    <span className="font-bold text-slate-900 flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-[#F4C542]" />
                      {opt.requiredAmount.toLocaleString()} VEs
                    </span>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="space-y-1 text-[11px] text-slate-500 mb-4">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                    <span>Simulated review: Admin approval queue (no real cash payout)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>Ledger reversal guarantee: VEs refund automatically if rejected</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleOpenRedeemModal(opt)}
                disabled={!isEligible}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isEligible
                    ? 'bg-[#800020] hover:bg-[#9a0027] text-white shadow-sm hover:scale-[1.01]'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>{isEligible ? 'Redeem Voucher' : 'Insufficient VEs'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Redemption / Withdrawal Modal Form */}
      {selectedOption && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-[#172554] p-5 text-white flex items-center justify-between border-b border-blue-900">
              <div>
                <h3 className="font-bold text-base text-white">Confirm Payout Request</h3>
                <p className="text-xs text-blue-200">Atomic balance reservation via VELoop Ledger</p>
              </div>
              <button
                onClick={() => setSelectedOption(null)}
                className="text-blue-300 hover:text-white p-1 rounded-lg hover:bg-blue-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 bg-[#FFF9F0]">
              {successWithdrawal ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                    <h4 className="font-extrabold text-base text-emerald-900">Withdrawal Request Submitted!</h4>
                    <p className="text-xs text-emerald-800 mt-1">
                      {selectedOption.requiredAmount.toLocaleString()} VEs have been atomically reserved from your wallet.
                    </p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Withdrawal ID:</span>
                      <span className="font-mono font-bold text-slate-900">{successWithdrawal.withdrawalId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Voucher / Method:</span>
                      <span className="font-semibold text-slate-800">{successWithdrawal.method}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payout Amount:</span>
                      <span className="font-bold text-emerald-700">
                        {selectedOption.currency === 'INR' ? '₹' : '$'}{successWithdrawal.payoutAmount}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Delivery To:</span>
                      <span className="font-mono text-slate-700 text-right break-all">
                        {formatPayoutDetails(successWithdrawal.payoutDetails)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Current Status:</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        {successWithdrawal.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setSelectedOption(null);
                        onNavigate('withdrawals');
                      }}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-[#172554] hover:bg-blue-900 text-white font-bold text-xs cursor-pointer"
                    >
                      View Withdrawal History
                    </button>
                    <button
                      onClick={() => setSelectedOption(null)}
                      className="py-2.5 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitWithdrawal} className="space-y-4">
                  {/* Selected Voucher Summary Card */}
                  <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 font-medium">Selected Voucher:</span>
                      <h4 className="font-bold text-slate-900 text-sm">{selectedOption.name}</h4>
                      <p className="text-xs text-slate-500">{selectedOption.type.replace(/_/g, ' ')}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-[#800020]">
                        {selectedOption.currency === 'INR' ? '₹' : '$'}{selectedOption.payoutValue}
                      </div>
                      <div className="text-xs font-semibold text-amber-700">
                        Cost: {selectedOption.requiredAmount.toLocaleString()} VEs
                      </div>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* Recipient Details Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Payout Destination Details <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={payoutDetails}
                      onChange={(e) => setPayoutDetails(e.target.value)}
                      placeholder={getMethodPlaceholder(selectedOption.type)}
                      required
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-[#800020] bg-white font-medium"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      {selectedOption.type === 'UPI'
                        ? 'Demo UPI VPA format (sandbox simulation only — no real bank or UPI transfer occurs).'
                        : 'Demo recipient email (sandbox simulation only — no live cash payout or gift code is issued).'}
                    </p>
                  </div>

                  {/* Security Notice */}
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#4169E1] flex-shrink-0 mt-0.5" />
                    <span>
                      Atomic Ledger Reservation (SIMULATED_DEMO_DATA): {selectedOption.requiredAmount.toLocaleString()} VEs will be deducted immediately. If an administrator rejects your request, the amount is refunded automatically to your wallet. No external payment rail is triggered.
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedOption(null)}
                      disabled={isSubmitting}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2.5 rounded-xl bg-[#800020] hover:bg-[#9a0027] text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Processing Reservation...</span>
                        </>
                      ) : (
                        <>
                          <ArrowUpRight className="w-4 h-4 text-[#F4C542]" />
                          <span>Confirm Withdrawal</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
