import React, { useState } from 'react';
import { Code, BookOpen, ShieldCheck, Database, Copy, Check } from 'lucide-react';

export const ApiDocsPage: React.FC = () => {
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(text);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  const endpoints: Array<{
    group: string;
    items: Array<{
      method: string;
      path: string;
      auth: string;
      description: string;
      body?: Record<string, any>;
      response?: Record<string, any>;
    }>;
  }> = [
    {
      group: 'Authentication & Session',
      items: [
        {
          method: 'POST',
          path: '/api/auth/register',
          auth: 'Public',
          description: 'Registers new user and provisions initialized multi-currency wallet with starter rewards (+1,000 VEs, +10 Gems, +50 Tokens, +2 Spins).',
          body: { name: 'Alex Smith', email: 'alex@example.com', password: 'Password123!' },
          response: {
            success: true,
            message: 'Account registered successfully',
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            user: { userId: 'USR-...', name: 'Alex Smith', email: 'alex@example.com', role: 'user' }
          }
        },
        {
          method: 'POST',
          path: '/api/auth/login',
          auth: 'Public',
          description: 'Authenticates user via bcrypt hash comparison and returns signed JWT token.',
          body: { email: 'demo@veloop.test', password: 'Password123!' },
          response: {
            success: true,
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            user: { userId: 'USR-DEMO-001', name: 'Demo User', role: 'user' }
          }
        },
        {
          method: 'GET',
          path: '/api/auth/me',
          auth: 'Bearer JWT',
          description: 'Validates current JWT token and returns authenticated user profile.'
        }
      ]
    },
    {
      group: 'Wallet & Ledger Operations',
      items: [
        {
          method: 'GET',
          path: '/api/wallet',
          auth: 'Bearer JWT',
          description: 'Fetches isolated balances for all 5 reward currencies (VEs, SVEs, Gems, Tokens, Spins).',
          response: {
            success: true,
            wallet: { userId: 'USR-DEMO-001', ves: 2500, sves: 100, gems: 25, tokens: 100, spins: 3 }
          }
        },
        {
          method: 'GET',
          path: '/api/wallet/summary',
          auth: 'Bearer JWT',
          description: 'Returns aggregated wallet metrics including lifetime earned VEs, total withdrawn, and active pending reservations.'
        },
        {
          method: 'GET',
          path: '/api/wallet/transactions?page=1&limit=15&currency=ves&type=CREDIT',
          auth: 'Bearer JWT',
          description: 'Paginated query of immutable transaction ledger with balanceBefore and balanceAfter audit snapshots.'
        },
        {
          method: 'POST',
          path: '/api/wallet/claim-daily',
          auth: 'Bearer JWT',
          description: 'Claims daily login streak bonus (+250 VEs and +1 Spin) with 24-hour cooldown enforcement.'
        },
        {
          method: 'POST',
          path: '/api/wallet/spin',
          auth: 'Bearer JWT',
          description: 'Deducts 1 spin and atomically awards a random prize (VEs, Gems, or Tokens) via the fortune wheel service.'
        }
      ]
    },
    {
      group: 'Payout & Withdrawal Disbursements',
      items: [
        {
          method: 'GET',
          path: '/api/payout/options',
          auth: 'Public',
          description: 'Returns all active payout options (UPI, PayPal, Amazon Gift Card, Google Play).'
        },
        {
          method: 'POST',
          path: '/api/withdrawals',
          auth: 'Bearer JWT',
          description: 'Initiates a withdrawal request with atomic balance reservation. Funds are deducted immediately to prevent double-spending.',
          body: {
            optionId: 'OPT-UPI-500',
            payoutDetails: 'user@okhdfcbank',
            idempotencyKey: 'REQ-1700000-XYZ'
          },
          response: {
            success: true,
            message: 'Withdrawal request submitted successfully! Your funds are reserved.',
            withdrawal: { withdrawalId: 'WDL-...', status: 'PENDING', currencyAmount: 1000, payoutAmount: 500 }
          }
        },
        {
          method: 'GET',
          path: '/api/withdrawals',
          auth: 'Bearer JWT',
          description: 'Retrieves user withdrawal requests and status histories.'
        }
      ]
    },
    {
      group: 'Administrative Control & DB Sync',
      items: [
        {
          method: 'GET',
          path: '/api/admin/withdrawals?status=PENDING',
          auth: 'Admin JWT',
          description: 'Lists pending withdrawal requests requiring review.'
        },
        {
          method: 'PATCH',
          path: '/api/admin/withdrawals/:id/approve',
          auth: 'Admin JWT',
          description: 'Approves withdrawal request, dispatches funds, and updates status to APPROVED.'
        },
        {
          method: 'PATCH',
          path: '/api/admin/withdrawals/:id/reject',
          auth: 'Admin JWT',
          description: 'Rejects withdrawal request with mandatory audit reason and AUTOMATICALLY REFUNDS reserved VEs to the user wallet.',
          body: { rejectionReason: 'Invalid UPI recipient address provided' }
        },
        {
          method: 'POST',
          path: '/api/admin/wallet/credit',
          auth: 'Admin JWT',
          description: 'Executes atomic admin balance credit with audit logging.',
          body: { targetUserId: 'USR-DEMO-001', currency: 'ves', amount: 500, reason: 'Promotional award' }
        },
        {
          method: 'POST',
          path: '/api/admin/db-reconnect',
          auth: 'Admin JWT',
          description: 'Triggers reconnection attempt to MongoDB Atlas cluster if IP whitelist was just updated.'
        }
      ]
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="bg-[#172554] rounded-2xl p-6 sm:p-8 text-white shadow-xl border-b border-blue-900">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#800020] text-amber-200 uppercase">
            Developer Documentation
          </span>
          <span className="text-xs text-blue-300">RESTful JSON APIs</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          VELoop Rewards API Reference & Schema
        </h1>
        <p className="text-sm text-blue-200 mt-1 max-w-2xl">
          Complete endpoint definitions, authentication schemes, double-entry ledger specifications, and administrative management APIs.
        </p>
      </div>

      {/* Endpoints Breakdown */}
      <div className="space-y-8">
        {endpoints.map((group, gIdx) => (
          <div key={gIdx} className="space-y-4">
            <h2 className="text-lg font-bold text-[#172554] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#800020]" />
              <span>{group.group}</span>
            </h2>

            <div className="space-y-3">
              {group.items.map((ep, eIdx) => (
                <div key={eIdx} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-black font-mono ${
                        ep.method === 'GET'
                          ? 'bg-blue-100 text-blue-800'
                          : ep.method === 'POST'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {ep.method}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-900">{ep.path}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ep.auth === 'Public'
                          ? 'bg-slate-100 text-slate-600'
                          : ep.auth === 'Admin JWT'
                          ? 'bg-[#800020] text-amber-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {ep.auth}
                      </span>
                      <button
                        onClick={() => copyToClipboard(ep.path)}
                        title="Copy endpoint"
                        className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {copiedEndpoint === ep.path ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600">{ep.description}</p>

                  {ep.body && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px]">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Request Payload (JSON)</span>
                      <pre className="font-mono text-slate-800 overflow-x-auto">{JSON.stringify(ep.body, null, 2)}</pre>
                    </div>
                  )}

                  {ep.response && (
                    <div className="bg-slate-900 text-emerald-400 p-3 rounded-xl text-[11px] overflow-x-auto">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Sample Response</span>
                      <pre className="font-mono">{JSON.stringify(ep.response, null, 2)}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
