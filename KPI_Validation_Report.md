# VELoop Rewards – Validation Report of All 46 KPIs

**Inspection Basis:** Audited directly against existing Mongoose schemas (`User`, `Wallet`, `WalletTransaction`, `Withdrawal`, `PayoutOption`, `AuditLog`), API endpoints (`/api/wallet/*`, `/api/admin/analytics`), and current seeded sandbox records.  
**Classification Key:**
- **Validated**: Formula, source fields, and calculation logic verified cleanly against implemented codebase & tested endpoints.
- **Needs Business Confirmation**: Calculable or partially backed by schema, but exact business rule (time window, eligibility threshold, currency FX rate, or exclusion criteria) requires explicit confirmation from VELOOP stakeholders.
- **Not Testable**: Required source fields, external webhooks, or tables (e.g., `Referral` invites, `AdEvents`, `SessionLogs`, `PayoutGatewaySettlements`) do not exist in the current repository.

---

## Domain A: User & Engagement KPIs (KPI-01 to KPI-10)

| KPI ID | KPI Name | Business Meaning | Formula | Source Fields | Expected Output | VELOOP Alignment & Issues | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **KPI-01** | Total Registered Users | Count of all user accounts in system | `COUNT(User.userId)` | `User.userId` | Integer (`>= 0`) | Verified in `GET /api/admin/analytics` (`kpis.totalUsers`). Note: clarify if `role='admin'` should be excluded from consumer totals. | **Validated** |
| **KPI-02** | Active Users Count | Accounts permitted to transact | `COUNT(User WHERE accountStatus == 'active')` | `User.accountStatus` | Integer (`<= totalUsers`) | Verified (`kpis.activeUsers`). Note: measures *account status active*, not *behavioral DAU/MAU*. | **Needs Business Confirmation** |
| **KPI-03** | Active Account Rate (%) | Share of accounts in active status | `(Active Users / Total Users) * 100` | `User.accountStatus` | Percentage (`0–100%`) | Verified in `kpis.activeUserRatePct`. | **Validated** |
| **KPI-04** | Suspended / Locked Users | Accounts blocked from wallet actions | `COUNT(User WHERE accountStatus IN ['suspended','locked'])` | `User.accountStatus` | Integer (`>= 0`) | Verified (`kpis.suspendedUsers`). | **Validated** |
| **KPI-05** | New User Registrations (Period) | Signups within selected date window | `COUNT(User WHERE createdAt BETWEEN start AND end)` | `User.createdAt` | Integer (`>= 0`) | Filterable in DB via `User.createdAt`; verify UTC vs IST timezone boundary with VELOOP. | **Needs Business Confirmation** |
| **KPI-06** | Daily Active Users (DAU) | Distinct users performing an app/wallet session today | `COUNT(DISTINCT userId IN SessionLogs WHERE date = today)` | Missing `SessionLog` / `lastLoginAt` | Integer | **Missing field**: `User` model does not track `lastLoginAt` or session events (only ledger transactions exist). | **Not Testable** |
| **KPI-07** | Monthly Active Users (MAU) | Distinct active users in trailing 30 days | `COUNT(DISTINCT userId IN SessionLogs WHERE last 30d)` | Missing `SessionLog` | Integer | Same schema gap as KPI-06; cannot proxy accurately from ledger alone if users browse without transacting. | **Not Testable** |
| **KPI-08** | DAU / MAU Stickiness Ratio | Engagement frequency ratio | `(DAU / MAU) * 100` | Derived from KPI-06, KPI-07 | Percentage | Blocked until session telemetry exists. | **Not Testable** |
| **KPI-09** | Daily Streak Claim Rate (%) | % of active users claiming daily reward per day | `(COUNT(DISTINCT userId WHERE source='DAILY_REWARD' today) / Active Users) * 100` | `WalletTransaction.source`, `createdAt`, `User` | Percentage | Calculable for active status denominator; confirm if denominator should be DAU instead of total active accounts. | **Needs Business Confirmation** |
| **KPI-10** | User Retention Rate (Day-7 / Day-30) | Cohort retention after signup | `(Cohort users active on Day N / Cohort signups on Day 0) * 100` | `User.createdAt`, missing `ActivityLogs` | Percentage | Requires daily activity/login events not currently stored. | **Not Testable** |

---

## Domain B: Wallet & Multi-Currency Balance KPIs (KPI-11 to KPI-20)

| KPI ID | KPI Name | Business Meaning | Formula | Source Fields | Expected Output | VELOOP Alignment & Issues | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **KPI-11** | Total Spendable VEs Liability | Outstanding unredeemed spendable VEs across all wallets | `SUM(Wallet.ves)` | `Wallet.ves` | Integer (VEs) | Verified in `kpis.walletLiability.ves`. Represents maximum theoretical payout exposure. | **Validated** |
| **KPI-12** | Total Staked SVEs Balance | Locked/staked VEs held across wallets | `SUM(Wallet.sves)` | `Wallet.sves` | Integer (SVEs) | Verified in `kpis.walletLiability.sves`. Confirm APY unlock/conversion rules to VEs. | **Validated** |
| **KPI-13** | Total Gems Circulation | Aggregate prestige Gems held by users | `SUM(Wallet.gems)` | `Wallet.gems` | Integer (Gems) | Verified in `kpis.walletLiability.gems`. | **Validated** |
| **KPI-14** | Total Utility Tokens Circulation | Aggregate utility Tokens held by users | `SUM(Wallet.tokens)` | `Wallet.tokens` | Integer (Tokens) | Verified in `kpis.walletLiability.tokens`. | **Validated** |
| **KPI-15** | Total Unspent Spins Balance | Aggregate Fortune Wheel spins remaining | `SUM(Wallet.spins)` | `Wallet.spins` | Integer (Spins) | Verified in `kpis.walletLiability.spins`. | **Validated** |
| **KPI-16** | Average VEs Balance per User | Mean spendable balance per wallet | `SUM(Wallet.ves) / COUNT(Wallet)` | `Wallet.ves`, `Wallet.userId` | Decimal (VEs) | Simple derivation; confirm whether 0-balance or admin wallets are excluded. | **Needs Business Confirmation** |
| **KPI-17** | Estimated USD Liability Exposure | Fiat equivalent liability of unspent VEs | `SUM(Wallet.ves) * FX_RATE_USD_PER_VE` | `Wallet.ves`, missing config FX table | USD Currency | **Ambiguous FX rate**: UI displays `100 VEs = $1.00`, while seeded payout options vary (`3000 VEs = ₹250 INR`, `5000 VEs = $5 USD`, `9500 VEs = $10 USD`). Needs official accounting valuation rule. | **Needs Business Confirmation** |
| **KPI-18** | Payout-Eligible Users Count | Users holding enough VEs for lowest active voucher | `COUNT(Wallet WHERE ves >= MIN(PayoutOption.requiredAmount WHERE active=true))` | `Wallet.ves`, `PayoutOption.requiredAmount` | Integer | Formula unambiguous once minimum active option (`3000 VEs`) is confirmed as threshold. | **Validated** |
| **KPI-19** | Wallet-to-User Coverage (%) | Share of non-admin users provisioned with a wallet | `(COUNT(Wallet) / COUNT(User WHERE role='user')) * 100` | `Wallet.userId`, `User.role` | Percentage (`100%` target) | Audited live via `GET /api/admin/user-conflicts`. | **Validated** |
| **KPI-20** | Staked-to-Spendable Ratio | Proportion of VEs ecosystem staked vs liquid | `SUM(Wallet.sves) / NULLIF(SUM(Wallet.ves), 0)` | `Wallet.sves`, `Wallet.ves` | Ratio | Validated arithmetically; confirm business target band. | **Needs Business Confirmation** |

---

## Domain C: Rewards & Earning Source KPIs (KPI-21 to KPI-28)

| KPI ID | KPI Name | Business Meaning | Formula | Source Fields | Expected Output | VELOOP Alignment & Issues | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **KPI-21** | Total VEs Earned (Gross Credits) | Sum of all VEs credited in window | `SUM(amount WHERE type='CREDIT' AND currency='ves' AND status='COMPLETED')` | `WalletTransaction.*` | Integer (VEs) | Verified in `kpis.totalCreditsVes`. Issue: clarify if `REFUND` credits should be excluded from *new rewards earned*! | **Needs Business Confirmation** |
| **KPI-22** | Total VEs Redeemed / Debited | Sum of VEs deducted in window | `SUM(amount WHERE type='DEBIT' AND currency='ves' AND status='COMPLETED')` | `WalletTransaction.*` | Integer (VEs) | Verified in `kpis.totalDebitsVes`. Includes `WITHDRAWAL`, `ADMIN_DEBIT`, `CORRECTION`. | **Validated** |
| **KPI-23** | Net VEs Issuance Flow | Net wallet expansion/contraction | `Total VEs Credits - Total VEs Debits` | `WalletTransaction.*` | Signed Integer (VEs) | Verified in `kpis.netVesFlow`. | **Validated** |
| **KPI-24** | Reward Volume by Source | Breakdown of credits by `BONUS`, `DAILY_REWARD`, `AD_REWARD`, `GAME_REWARD`, `REFERRAL` | `GROUP BY source -> SUM(amount), COUNT(*)` | `WalletTransaction.source`, `amount` | Breakdown Table | Verified in `sourceBreakdown` endpoint. | **Validated** |
| **KPI-25** | Daily Reward VEs Distributed | Total VEs issued via daily login claims | `SUM(amount WHERE source='DAILY_REWARD' AND currency='ves')` | `WalletTransaction.*` | Integer (VEs) | Verified cleanly (`250 VEs` per claim). | **Validated** |
| **KPI-26** | Fortune Wheel RTP / Avg Payout | Average VEs value awarded per spin | `SUM(GameRewardVEs) / COUNT(SpinDebits)` | `WalletTransaction.source='GAME_REWARD'` | Decimal (VEs/spin) | Note: Prize weights are uniform `1/6` in code (`walletRoutes.ts`) and include Gems/Tokens/SVEs, complicating single-currency RTP without FX weights. | **Needs Business Confirmation** |
| **KPI-27** | Ad-Watch eCPM / Ad Revenue Yield | Net profit per `AD_REWARD` view | `(AdNetworkRevenueUSD - AdRewardCostUSD) / (AdViews / 1000)` | Missing `AdRevenue` external table | USD / 1k views | External ad mediation revenue (AdMob/AppLovin) is absent from DB. | **Not Testable** |
| **KPI-28** | Admin Manual Adjustments Share (%) | % of credits issued manually by admins | `(SUM(ADMIN_CREDIT) / SUM(ALL CREDITS)) * 100` | `WalletTransaction.source` | Percentage | Helps detect operational abuse or promo over-reliance. | **Validated** |

---

## Domain D: Transaction & Ledger Integrity KPIs (KPI-29 to KPI-34)

| KPI ID | KPI Name | Business Meaning | Formula | Source Fields | Expected Output | VELOOP Alignment & Issues | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **KPI-29** | Total Ledger Transactions Count | Activity volume across credits and debits | `COUNT(WalletTransaction.transactionId)` | `WalletTransaction.transactionId` | Integer | Verified (`totalCreditsCount + totalDebitsCount`). | **Validated** |
| **KPI-30** | Ledger Arithmetic Integrity Rate (%) | % of rows satisfying exact double-entry math | `(COUNT(valid before/after rows) / Total Rows) * 100` | `balanceBefore`, `balanceAfter`, `amount`, `type` | `100.0%` | Verified in `TC-12`. Must strictly equal `100%`. | **Validated** |
| **KPI-31** | Wallet-to-Ledger Balance Reconciliation | Verification that wallet balance equals sum of completed ledger credits minus debits | `Wallet[c] == SUM(CREDITS[c]) - SUM(DEBITS[c])` | `Wallet.*`, `WalletTransaction.*` | `0` discrepancies |Note: Direct `seedData.ts` initial balances match the 10 seeded ledger rows (`15000+5000+500+250-3000+7250 = 25000 VEs`). Ensure future migrations never seed wallets without ledger rows. | **Validated** |
| **KPI-32** | Failed / Reversed Transaction Rate (%) | Proportion of non-completed ledger mutations | `(COUNT(status IN ['FAILED','REVERSED']) / Total) * 100` | `WalletTransaction.status` | Percentage | Trackable in schema; verify when `REVERSED` vs separate `REFUND` credit entry is preferred by accounting. | **Needs Business Confirmation** |
| **KPI-33** | Average Transaction Size (VEs) | Mean VEs per VEs ledger event | `AVG(amount WHERE currency='ves')` | `WalletTransaction.amount` | Decimal (VEs) | Supported by schema. | **Validated** |
| **KPI-34** | Duplicate Idempotency Prevention Count | Count of blocked double-submissions | `COUNT(IdempotencyHits)` | Missing counter field | Integer | Currently `PayoutService` silently returns existing withdrawal without logging a `DUPLICATE_BLOCKED` metric. | **Not Testable** |

---

## Domain E: Withdrawal & Payout Funnel KPIs (KPI-35 to KPI-41)

| KPI ID | KPI Name | Business Meaning | Formula | Source Fields | Expected Output | VELOOP Alignment & Issues | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **KPI-35** | Total Withdrawal Requests | Total payout requests created | `COUNT(Withdrawal.withdrawalId)` | `Withdrawal.withdrawalId` | Integer | Verified in `withdrawalStats.totalCount`. | **Validated** |
| **KPI-36** | Pending Withdrawals Queue & VEs | Count & VEs value awaiting admin review | `COUNT/SUM(Withdrawal WHERE status IN ['PENDING','PROCESSING'])` | `Withdrawal.status`, `currencyAmount` | Count + VEs | Verified (`withdrawalStats.pendingCount`, `pendingVes`). | **Validated** |
| **KPI-37** | Approved Withdrawals Count & VEs | Successfully approved payouts | `COUNT/SUM(Withdrawal WHERE status='APPROVED')` | `Withdrawal.status`, `currencyAmount` | Count + VEs | Verified (`withdrawalStats.approvedCount`, `approvedVes`). | **Validated** |
| **KPI-38** | Rejected Withdrawals & Refunded VEs | Rejected payouts automatically refunded | `COUNT/SUM(Withdrawal WHERE status='REJECTED')` | `Withdrawal.status`, `currencyAmount` | Count + VEs | Verified in `TC-17` and `withdrawalStats`. | **Validated** |
| **KPI-39** | Withdrawal Approval Rate (%) | Share of decided withdrawals approved | `(Approved / (Approved + Rejected)) * 100` | `Withdrawal.status` | Percentage | Verified in `kpis.withdrawalApprovalRatePct`. Confirm whether `CANCELLED` counts in denominator. | **Needs Business Confirmation** |
| **KPI-40** | Total Cash Disbursed by Currency (INR/USD) | Actual fiat payout obligation approved | `GROUP BY PayoutOption.currency -> SUM(payoutAmount WHERE status='APPROVED')` | `Withdrawal.payoutAmount`, `PayoutOption.currency` | INR & USD totals | **Schema flaw found**: `Withdrawal.currency` stores `'ves'` (debit currency), NOT fiat currency (`INR`/`USD`). Requires joining `PayoutOption` until `payoutCurrency` is persisted on `Withdrawal`. | **Needs Business Confirmation** |
| **KPI-41** | Average Withdrawal Processing SLA | Mean duration from request to admin decision | `AVG(processedAt - requestedAt WHERE processedAt != null)` | `Withdrawal.requestedAt`, `processedAt` | Hours / Minutes | Validated schema fields exist; confirm SLA target threshold (e.g., `< 24h`) with operations team. | **Needs Business Confirmation** |

---

## Domain F: Referral Program KPIs (KPI-42 to KPI-46)

| KPI ID | KPI Name | Business Meaning | Formula | Source Fields | Expected Output | VELOOP Alignment & Issues | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **KPI-42** | Total Referral Reward Credits | Count of referral bonus payouts issued | `COUNT(WalletTransaction WHERE source='REFERRAL' AND type='CREDIT')` | `WalletTransaction.source` | Integer | Verified in `TC-18` (`referralPerformance.totalReferralTransactions`). | **Validated** |
| **KPI-43** | Total Referral VEs Distributed | Aggregate VEs cost of referral program | `SUM(amount WHERE source='REFERRAL' AND currency='ves')` | `WalletTransaction.amount` | Integer (VEs) | Verified (`referralPerformance.totalReferralVesAwarded`). | **Validated** |
| **KPI-44** | Unique Referrers Rewarded | Distinct users earning referral bonuses | `COUNT(DISTINCT userId WHERE source='REFERRAL')` | `WalletTransaction.userId` | Integer | Verified (`referralPerformance.uniqueReferrersCount`). | **Validated** |
| **KPI-45** | Referral Invite-to-Signup Conversion Rate (%) | % of sent invites resulting in verified signups | `(Converted Referrals / Total Invites Sent) * 100` | `Referral.{status, referralId, invitedAt, convertedAt}` | Percentage | Implemented in `GET /api/admin/analytics` (`referralPerformance.conversionRatePct`; verified in `TC-19` & `PH-03`). Automated reward payouts remain `0 VEs` (`PENDING_BUSINESS_RULE`) pending Q6 sign-off. | **Validated** |
| **KPI-46** | Referred User LTV vs Organic LTV | Long-term revenue/retention lift of referred users | `AVG(Value(Referred)) vs AVG(Value(Organic))` | `User.referredByUserId` + missing `AdRevenue` | Comparison | `User.referredByUserId` is implemented, but downstream `AdRevenue` / net monetization feed is absent. | **Not Testable** |

---

## Summary Counts Across 46 KPIs

- **Validated:** 27 KPIs (`KPI-01`, `KPI-03`, `KPI-04`, `KPI-11`, `KPI-12`, `KPI-13`, `KPI-14`, `KPI-15`, `KPI-18`, `KPI-19`, `KPI-22`, `KPI-23`, `KPI-24`, `KPI-25`, `KPI-28`, `KPI-29`, `KPI-30`, `KPI-31`, `KPI-33`, `KPI-35`, `KPI-36`, `KPI-37`, `KPI-38`, `KPI-42`, `KPI-43`, `KPI-44`, `KPI-45`)
- **Needs Business Confirmation:** 12 KPIs (`KPI-02`, `KPI-05`, `KPI-09`, `KPI-16`, `KPI-17`, `KPI-20`, `KPI-21`, `KPI-26`, `KPI-32`, `KPI-39`, `KPI-40`, `KPI-41`)
- **Not Testable:** 7 KPIs (`KPI-06`, `KPI-07`, `KPI-08`, `KPI-10`, `KPI-27`, `KPI-34`, `KPI-46`)
- **Total:** 46 KPIs (`27 + 12 + 7 = 46`)

> **Pending Sign-Off Notice:** Formal stakeholder approval has **not** been obtained. All 12 items marked **Needs Business Confirmation** (and referral reward payout rules under Q6) remain pending explicit business confirmation from VELOOP stakeholders, and the 7 **Not Testable** KPIs remain blocked on missing telemetry/external feeds.

---

## Questions Requiring Confirmation from VELOOP Stakeholders

1. **Consumer vs Admin Population (`KPI-01`, `KPI-16`)**: Should internal `role: 'admin'` accounts be excluded from total user counts, average balance calculations, and active-user denominators?
2. **Active User Definition (`KPI-02`, `KPI-06`, `KPI-09`)**: Does VELOOP define an "Active User" strictly by `accountStatus === 'active'`, or by login/transaction recency (e.g., 30-day active window)?
3. **Accounting Valuation / FX Rate (`KPI-17`, `KPI-26`)**: Why do payout tiers vary in implied VEs-to-Fiat rate (`3000 VEs = ₹250 INR` vs `5000 VEs = $5 USD` vs `9500 VEs = $10 USD`), and what official USD liability rate per VE should Finance use for balance-sheet liability reporting?
4. **Gross Earned Rewards vs Refunds (`KPI-21`, `KPI-32`)**: When a rejected withdrawal refunds `3000 VEs` via `source: 'REFUND'`, should `REFUND` credits be excluded from "Total Rewards Earned" so gross earnings are not double-counted?
5. **Time Zone Cutoff (`KPI-05`, `KPI-09`)**: Should daily reward windows and dashboard date aggregations aggregate in **UTC** or **IST (`Asia/Kolkata`)**?
6. **Referral Qualification Trigger (`KPI-45`, `KPI-46`)**: When does a referral qualify for payout — immediately on signup, email verification, or after the referee completes a minimum task/withdrawal?

---

## Detailed Calculation Methods, Filters, Demo Samples & Validation Audit (KPI-01 to KPI-46)

> **Audit Scope & Demo Baseline (`server/seed/seedData.ts`):** All sample calculations below use **only** the unmodified seeded simulated demo baseline (`2` users: `USR-DEMO-001` [`role: 'user'`, `active`] and `ADM-VELOOP-999` [`role: 'admin'`, `active`]; `1` wallet [`ves: 25000, sves: 5000, gems: 100, tokens: 500, spins: 3`]; `10` completed `WalletTransaction` rows totaling `28,000 VEs` credited, `3,000 VEs` debited, `5,000 SVEs`, `100 Gems`, `500 Tokens`, `3 Spins`; `1` approved withdrawal `WTH-HIST-001` [`3,000 VEs` $\rightarrow$ `₹250 INR` via `OPT-UPI-250`, processed in `1h`]; and `11` active `PayoutOption` tiers). Zero production VELOOP records are present (`productionDataConnected: false`), and zero stakeholder approvals are claimed.

### Shared API Date Range & Filter Rules (`GET /api/admin/analytics` -> `AnalyticsService.getAdminAnalytics`)
- **`startDate` & `endDate` (`txQuery.createdAt`, `withdrawalQuery.requestedAt`):** Normalized symmetrically in **UTC** via `parseUtcDateBoundary()`: date-only `YYYY-MM-DD` strings map to `YYYY-MM-DDT00:00:00.000Z` (`startDate`) through `YYYY-MM-DDT23:59:59.999Z` (`endDate`), resolving the prior local-timezone `setHours()` asymmetry. Exact ISO timestamps with time components are preserved verbatim. Exposed in API responses as `dateFilter: { timezone: 'UTC', startDateUtc, endDateUtc }`. `User`, `Wallet`, and `PayoutOption` queries remain unfiltered point-in-time snapshots, and **KPI-31** reconciles wallets against **lifetime** `COMPLETED` ledger rows regardless of date/currency filters.
- **`currency` (`txQuery.currency`):** Applied only to `WalletTransaction` when not `'ALL'` (lowercased). Never counts non-`ves` transactions in `ves` totals or `ves` counts.
- **`source` (`txQuery.source`):** Applied only to `WalletTransaction` when not `'ALL'`.
- **`search` (`txQuery.$or`):** Escaped case-insensitive regex across `transactionId`, `userId`, `description`, and `source` on `WalletTransaction` only.
- **Transaction Status & Count Separation Rule:** Monetary/reward/trend sums (`totalCreditsVes`, `totalDebitsVes`, `dailyRewardVesDistributed`, `adminManualCreditsVes`, `avgVesTransactionSize`, `referralPerformance`, `sourceBreakdown`, `dailyTrends`) include **`status === 'COMPLETED'`** rows only. `kpis.totalCreditsCount` / `kpis.totalDebitsCount` / `vesTransactionsCount` count **VEs** transactions strictly, separated from `allCurrencyCreditsCount`, `allCurrencyDebitsCount`, and `allCurrencyTransactionsCount`.

---

### Group 1: Implemented & Validated KPIs (`19` Prior + `7` Newly Implemented = `26` in `GET /api/admin/analytics`)

1. **KPI-01 — Total Registered Users**
   - **Definition:** Count of all user accounts in the `User` collection.
   - **Formula:** `users.length` (`COUNT(User.userId)`).
   - **Source Collection & Fields:** `User.userId` (loaded via `User.find({}).lean()`).
   - **Date Range & Filters:** Unfiltered (`All Time`); ignores `startDate`, `endDate`, `currency`, `source`, `search`.
   - **Simulated Demo Sample:** `1` consumer (`USR-DEMO-001`) + `1` admin (`ADM-VELOOP-999`) = **`2` users**.
   - **Implementation & Testability:** **Implemented & Testable** (`kpis.totalUsers`; verified in `TC-20`).
   - **Validation & Limitations:** `userId` has a unique index; counts `role: 'admin'` alongside consumers unless excluded in future revisions.

2. **KPI-03 — Active Account Rate (%)**
   - **Definition:** Percentage of registered accounts in `active` status.
   - **Formula:** `totalUsers > 0 ? Number(((activeUsers / totalUsers) * 100).toFixed(1)) : 0`.
   - **Source Collection & Fields:** `User.accountStatus` (`enum: ['active', 'suspended', 'locked']`).
   - **Date Range & Filters:** Unfiltered point-in-time snapshot.
   - **Simulated Demo Sample:** `(2 / 2) * 100` = **`100.0%`**.
   - **Implementation & Testability:** **Implemented & Testable** (`kpis.activeUserRatePct`; verified in `TC-20`).
   - **Validation & Limitations:** Guards against division by zero when `totalUsers === 0`; inherits admin inclusion from KPI-01/KPI-02.

3. **KPI-04 — Suspended / Locked Users**
   - **Definition:** Count of user accounts blocked from logging in or transacting.
   - **Formula:** `users.filter(u => u.accountStatus !== 'active').length`.
   - **Source Collection & Fields:** `User.accountStatus`.
   - **Date Range & Filters:** Unfiltered point-in-time snapshot.
   - **Simulated Demo Sample:** Both seeded accounts are `active` $\rightarrow$ **`0` suspended/locked users**.
   - **Implementation & Testability:** **Implemented & Testable** (`kpis.suspendedUsers`; blocking enforced in `TC-04`).
   - **Validation & Limitations:** Combines `'suspended'` and `'locked'` into a single counter rather than separating them.

4. **KPI-11 — Total Spendable VEs Liability**
   - **Definition:** Total unredeemed spendable `ves` held across all wallets.
   - **Formula:** `wallets.reduce((acc, w) => acc + (w.ves || 0), 0)`.
   - **Source Collection & Fields:** `Wallet.ves`.
   - **Date Range & Filters:** Unfiltered current wallet snapshot (reflects current balances, not historical EOD).
   - **Simulated Demo Sample:** `USR-DEMO-001` (`25,000`) = **`25,000 VEs`**.
   - **Implementation & Testability:** **Implemented & Testable** (`kpis.walletLiability.ves`; verified in `TC-20`).
   - **Validation & Limitations:** Schema enforces `min: 0`; unbounded `.find({}).lean()` scan will not scale for millions of wallets without `$group`.

5. **KPI-12 — Total Staked SVEs Balance**
   - **Definition:** Aggregate staked/locked `sves` balance across all wallets.
   - **Formula:** `wallets.reduce((acc, w) => acc + (w.sves || 0), 0)`.
   - **Source Collection & Fields:** `Wallet.sves`.
   - **Date Range & Filters:** Unfiltered current wallet snapshot.
   - **Simulated Demo Sample:** `USR-DEMO-001` (`5,000`) = **`5,000 SVEs`**.
   - **Implementation & Testability:** **Implemented & Testable** (`kpis.walletLiability.sves`).
   - **Validation & Limitations:** No `stakingUnlockAt` or APY maturity schedule exists in schema yet.

6. **KPI-13 — Total Gems Circulation**
   - **Definition:** Aggregate prestige `gems` balance across all wallets.
   - **Formula:** `wallets.reduce((acc, w) => acc + (w.gems || 0), 0)`.
   - **Source Collection & Fields:** `Wallet.gems`.
   - **Date Range & Filters:** Unfiltered current wallet snapshot.
   - **Simulated Demo Sample:** `USR-DEMO-001` (`100`) = **`100 Gems`**.
   - **Implementation & Testability:** **Implemented & Testable** (`kpis.walletLiability.gems`).
   - **Validation & Limitations:** Currency isolation verified in `TC-07`; non-redeemable for cash directly.

7. **KPI-14 — Total Utility Tokens Circulation**
   - **Definition:** Aggregate utility `tokens` balance across all wallets.
   - **Formula:** `wallets.reduce((acc, w) => acc + (w.tokens || 0), 0)`.
   - **Source Collection & Fields:** `Wallet.tokens`.
   - **Date Range & Filters:** Unfiltered current wallet snapshot.
   - **Simulated Demo Sample:** `USR-DEMO-001` (`500`) = **`500 Tokens`**.
   - **Implementation & Testability:** **Implemented & Testable** (`kpis.walletLiability.tokens`).
   - **Validation & Limitations:** Currency isolation verified in `TC-07`; lacks spend sinks in current routes.

8. **KPI-15 — Total Unspent Spins Balance**
   - **Definition:** Aggregate remaining Fortune Wheel `spins` across all wallets.
   - **Formula:** `wallets.reduce((acc, w) => acc + (w.spins || 0), 0)`.
   - **Source Collection & Fields:** `Wallet.spins`.
   - **Date Range & Filters:** Unfiltered current wallet snapshot.
   - **Simulated Demo Sample:** `USR-DEMO-001` (`3`) = **`3 Spins`**.
   - **Implementation & Testability:** **Implemented & Testable** (`kpis.walletLiability.spins`).
   - **Validation & Limitations:** Guaranteed non-negative (`min: 0` + atomic `$gte: 1` spin debit).

9. **KPI-22 — Total VEs Redeemed / Debited**
   - **Definition:** Sum of `ves` debits recorded in the filtered ledger window.
   - **Formula:** `SUM(tx.amount WHERE tx.status === 'COMPLETED' AND tx.type === 'DEBIT' AND tx.currency === 'ves')`.
   - **Source Collection & Fields:** `WalletTransaction.{type, currency, amount, createdAt, source, status}`.
   - **Date Range & Filters:** Filtered by UTC `startDate`–`endDate` (`createdAt`), `currency`, `source`, `search`, and `status === 'COMPLETED'`.
   - **Simulated Demo Sample:** `TXN-INIT-005` (`3,000`, `WITHDRAWAL`) = **`3,000 VEs`**.
   - **Implementation & Testability:** **Implemented & Testable** (`kpis.totalDebitsVes`, matching `totalDebitsCount = 1`).
   - **Validation & Limitations:** Matches `GET /api/wallet/summary` `COMPLETED`-only rule and cleanly separates `totalDebitsCount` (`ves`) from `allCurrencyDebitsCount`.

10. **KPI-23 — Net VEs Issuance Flow**
    - **Definition:** Net expansion or contraction of `ves` over the selected ledger filter window.
    - **Formula:** `kpis.totalCreditsVes - kpis.totalDebitsVes` (both `COMPLETED`, `ves`).
    - **Source Collection & Fields:** `WalletTransaction.{type, currency, amount, status}`.
    - **Date Range & Filters:** Inherits `txQuery` (UTC `startDate`–`endDate`, `currency`, `source`, `search`).
    - **Simulated Demo Sample:** `28,000 - 3,000` = **`+25,000 VEs`**.
    - **Implementation & Testability:** **Implemented & Testable** (`kpis.netVesFlow`).
    - **Validation & Limitations:** Equals current `Wallet.ves` (`25,000`) when unfiltered, matching all seeded transactions.

11. **KPI-24 — Reward Volume by Source**
    - **Definition:** VEs-only credit/debit volume & VEs transaction counts (plus `allCurrencyCount`) grouped by `WalletTransaction.source`.
    - **Formula:** `GROUP BY tx.source (WHERE status === 'COMPLETED') -> { credits: SUM(ves CREDITS), debits: SUM(ves DEBITS), count: COUNT(ves tx), allCurrencyCount: COUNT(tx) }`, sorted descending by `credits + debits`.
    - **Source Collection & Fields:** `WalletTransaction.{source, type, currency, amount, status}`.
    - **Date Range & Filters:** Inherits `txQuery`.
    - **Simulated Demo Sample:**
      - `BONUS`: `+15,000 / -0 VEs` (`1` VE txn; `2` all-currency incl. `5,000 SVEs`)
      - `GAME_REWARD`: `+7,250 / -0 VEs` (`1` VE txn)
      - `REFERRAL`: `+5,000 / -0 VEs` (`1` VE txn)
      - `WITHDRAWAL`: `+0 / -3,000 VEs` (`1` VE txn)
      - `AD_REWARD`: `+500 / -0 VEs` (`1` VE txn)
      - `DAILY_REWARD`: `+250 / -0 VEs` (`1` VE txn; `2` all-currency incl. `3 Spins`)
      - `REWARD`: `+0 / -0 VEs` (`0` VE txns; `2` all-currency for `100 Gems` + `500 Tokens`)
    - **Implementation & Testability:** **Implemented & Testable** (`sourceBreakdown`).
    - **Validation & Limitations:** Now separates VEs count (`count`) from non-VEs counts (`allCurrencyCount`).

12. **KPI-29 — Total Ledger Transactions Count**
    - **Definition:** Total count of ledger transactions matching active filters (`allCurrencyTransactionsCount` across all 5 currencies; `vesTransactionsCount` for VEs-only completed transactions).
    - **Formula:** `transactions.length` (`allCurrencyTransactionsCount`) alongside `vesTransactionsCount = totalCreditsCount + totalDebitsCount`.
    - **Source Collection & Fields:** `WalletTransaction.{transactionId, currency, type, status, createdAt}`.
    - **Date Range & Filters:** Inherits `txQuery`.
    - **Simulated Demo Sample:** `vesTransactionsCount = 6` (`5 credits + 1 debit`), `allCurrencyCreditsCount = 9`, `allCurrencyDebitsCount = 1`, `allCurrencyTransactionsCount = 10`.
    - **Implementation & Testability:** **Implemented & Testable** (`kpis.vesTransactionsCount`, `kpis.allCurrencyTransactionsCount`; verified in `KPI-TEST-01`, `KPI-TEST-02`).
    - **Validation & Limitations:** Fixed previous UI/API coupling where all-currency counts were displayed beneath VEs totals.

13. **KPI-35 — Total Withdrawal Requests**
    - **Definition:** Total count of withdrawal requests in the date window.
    - **Formula:** `withdrawals.length`.
    - **Source Collection & Fields:** `Withdrawal.{withdrawalId, requestedAt}`.
    - **Date Range & Filters:** Filtered by `startDate`–`endDate` on `Withdrawal.requestedAt` only; ignores `currency`, `source`, `search`.
    - **Simulated Demo Sample:** `WTH-HIST-001` = **`1` withdrawal**.
    - **Implementation & Testability:** **Implemented & Testable** (`withdrawalStats.totalCount`).
    - **Validation & Limitations:** `withdrawalId` unique index prevents duplicate IDs.

14. **KPI-36 — Pending Withdrawals Queue & VEs**
    - **Definition:** Count and reserved `ves` sum of unreviewed/in-flight withdrawals.
    - **Formula:** `COUNT/SUM(w.currencyAmount || 0 WHERE w.status IN ['PENDING', 'PROCESSING'])`.
    - **Source Collection & Fields:** `Withdrawal.{status, currencyAmount, requestedAt}`.
    - **Date Range & Filters:** `startDate`–`endDate` on `requestedAt`.
    - **Simulated Demo Sample:** `0` matching (`WTH-HIST-001` is `APPROVED`) = **`0` requests / `0 VEs`**.
    - **Implementation & Testability:** **Implemented & Testable** (`withdrawalStats.pendingCount`, `withdrawalStats.pendingVes`).
    - **Validation & Limitations:** Admin analytics includes `PROCESSING`, whereas user-facing `GET /api/wallet/summary` checks `status: 'PENDING'` only.

15. **KPI-37 — Approved Withdrawals Count & VEs**
    - **Definition:** Count and reserved `ves` total of approved payouts.
    - **Formula:** `COUNT/SUM(w.currencyAmount || 0 WHERE w.status === 'APPROVED')`.
    - **Source Collection & Fields:** `Withdrawal.{status, currencyAmount, requestedAt}`.
    - **Date Range & Filters:** `startDate`–`endDate` on `requestedAt`.
    - **Simulated Demo Sample:** `WTH-HIST-001` = **`1` request / `3,000 VEs`**.
    - **Implementation & Testability:** **Implemented & Testable** (`withdrawalStats.approvedCount`, `withdrawalStats.approvedVes`; tested in `TC-16`).
    - **Validation & Limitations:** Atomic `findOneAndUpdate` lock prevents post-approval state changes (`WS-01`).

16. **KPI-38 — Rejected Withdrawals & Refunded VEs**
    - **Definition:** Count and VEs value of rejected payouts whose reserved VEs were refunded.
    - **Formula:** Canonical: `WHERE w.status === 'REJECTED'`. Actual code (`adminRoutes.ts` line 417): `WHERE w.status === 'REJECTED' || w.status === 'CANCELLED'`.
    - **Source Collection & Fields:** `Withdrawal.{status, currencyAmount, requestedAt}`.
    - **Date Range & Filters:** `startDate`–`endDate` on `requestedAt`.
    - **Simulated Demo Sample:** **`0` requests / `0 VEs`**.
    - **Implementation & Testability:** **Implemented & Testable** (`withdrawalStats.rejectedCount`, `withdrawalStats.rejectedVes`; tested in `TC-17`, `WS-02`).
    - **Validation & Limitations:** **Known limitation:** `adminRoutes.ts` conflates `CANCELLED` with `REJECTED`, which would overstate rejections if user-cancelled records exist.

17. **KPI-42 — Total Referral Reward Credits**
    - **Definition:** Count of `COMPLETED` `CREDIT` `WalletTransaction` entries with `source === 'REFERRAL'`.
    - **Formula:** `transactions.filter(t => t.source === 'REFERRAL' && t.type === 'CREDIT' && t.status === 'COMPLETED').length`.
    - **Source Collection & Fields:** `WalletTransaction.{source, type, status}`.
    - **Date Range & Filters:** Inherits `txQuery`.
    - **Simulated Demo Sample:** `TXN-INIT-002` = **`1` referral credit**.
    - **Implementation & Testability:** **Implemented & Testable** (`referralPerformance.totalReferralTransactions`; verified in `TC-18`).
    - **Validation & Limitations:** Now explicitly excludes non-`COMPLETED` or `DEBIT` referral adjustments.

18. **KPI-43 — Total Referral VEs Distributed**
    - **Definition:** Total `COMPLETED` `ves` credited for `REFERRAL` payouts.
    - **Formula:** `SUM(t.amount WHERE t.source === 'REFERRAL' AND t.type === 'CREDIT' AND t.status === 'COMPLETED' AND t.currency === 'ves')`.
    - **Source Collection & Fields:** `WalletTransaction.{source, type, status, currency, amount}`.
    - **Date Range & Filters:** Inherits `txQuery`.
    - **Simulated Demo Sample:** `TXN-INIT-002` = **`5,000 VEs`**.
    - **Implementation & Testability:** **Implemented & Testable** (`referralPerformance.totalReferralVesAwarded`; verified in `TC-18`).
    - **Validation & Limitations:** Excludes non-`ves` referral bonuses if introduced later.

19. **KPI-44 — Unique Referrers Rewarded**
    - **Definition:** Distinct `userId` count among users who received a `COMPLETED` `REFERRAL` credit.
    - **Formula:** `new Set(referralTxs.map(t => t.userId)).size`.
    - **Source Collection & Fields:** `WalletTransaction.{source, type, status, userId}`.
    - **Date Range & Filters:** Inherits `txQuery`.
    - **Simulated Demo Sample:** `{ 'USR-DEMO-001' }` = **`1` unique referrer**.
    - **Implementation & Testability:** **Implemented & Testable** (`referralPerformance.uniqueReferrersCount`).
    - **Validation & Limitations:** Measures *rewarded referrers* only; cannot measure zero-conversion referrers without a `Referral` model.

---

### Group 2: Newly Implemented Schema-Backed Validated KPIs (`7` KPIs Added to `GET /api/admin/analytics`)

20. **KPI-18 — Payout-Eligible Users Count**
    - **Definition:** Count of wallets holding spendable `ves` $\ge$ the lowest active payout tier (`PayoutOption.active === true`).
    - **Formula:** `minPayoutRequiredVes = MIN(PayoutOption.requiredAmount WHERE active === true && requiredAmount > 0); COUNT(Wallet WHERE ves >= minPayoutRequiredVes)` (`0` if no active options).
    - **Source Collection & Fields:** `Wallet.ves`, `PayoutOption.{requiredAmount, active}`.
    - **Date Range & Filters:** Current point-in-time snapshot (`active: true` options).
    - **Simulated Demo Sample:** Lowest active `requiredAmount = 3,000 VEs` (`OPT-UPI-250`); `USR-DEMO-001` (`25,000 >= 3,000`) $\rightarrow$ **`1` eligible user**.
    - **Implementation & Testability:** **Implemented & Testable** (`kpis.payoutEligibleUsersCount`, `kpis.minPayoutRequiredVes`; verified in `KPI-TEST-01`, `KPI-TEST-03`, `KPI-TEST-06`).
    - **Validation & Limitations:** Excludes zero-balance wallets and inactive payout options; per-user country/level rules remain unevaluated globally.

21. **KPI-19 — Wallet-to-User Coverage (%)**
    - **Definition:** Percentage of non-admin consumer accounts (`role === 'user'`) that have an associated `Wallet` document.
    - **Formula:** `nonAdminUsersCount > 0 ? Number(((nonAdminUsersWithWalletCount / nonAdminUsersCount) * 100).toFixed(1)) : 0`.
    - **Source Collection & Fields:** `User.{userId, role}`, `Wallet.userId`.
    - **Date Range & Filters:** Unfiltered current snapshot.
    - **Simulated Demo Sample:** `1` non-admin (`USR-DEMO-001`), `1` covered $\rightarrow$ **`100.0%`** (`ADM-VELOOP-999` excluded).
    - **Implementation & Testability:** **Implemented & Testable** (`kpis.walletToUserCoveragePct`, `nonAdminUsersCount`, `nonAdminUsersWithWalletCount`, `nonAdminUsersWithoutWalletCount`; verified in `KPI-TEST-01`, `KPI-TEST-03`, `KPI-TEST-06`).
    - **Validation & Limitations:** Safely returns `0` when `nonAdminUsersCount === 0`; missing consumer wallets drop coverage accurately below `100%`.

22. **KPI-25 — Daily Reward VEs Distributed**
    - **Definition:** Total `COMPLETED` `ves` credited via `DAILY_REWARD` within the active ledger filters.
    - **Formula:** `SUM(tx.amount WHERE tx.status === 'COMPLETED' AND tx.type === 'CREDIT' AND tx.currency === 'ves' AND tx.source === 'DAILY_REWARD')`.
    - **Source Collection & Fields:** `WalletTransaction.{source, currency, type, status, amount}`.
    - **Date Range & Filters:** Inherits `txQuery` (UTC `startDate`–`endDate`, `currency`, `source`, `search`).
    - **Simulated Demo Sample:** `TXN-INIT-004` = **`250 VEs`** (excludes `TXN-INIT-010` `3 Spins`).
    - **Implementation & Testability:** **Implemented & Testable** (`kpis.dailyRewardVesDistributed`; verified in `KPI-TEST-01`, `KPI-TEST-02`, `KPI-TEST-05`, `KPI-TEST-06`).
    - **Validation & Limitations:** Excludes non-`ves` (`spins`), `FAILED`/`REVERSED`, and `REFUND` credits.

23. **KPI-28 — Admin Manual Adjustments Share (%)**
    - **Definition:** Percentage of `COMPLETED` `ves` credits issued manually via `ADMIN_CREDIT`.
    - **Formula:** `totalCreditsVes > 0 ? Number(((adminManualCreditsVes / totalCreditsVes) * 100).toFixed(1)) : 0` where numerator is `SUM(amount WHERE status==='COMPLETED' && type==='CREDIT' && currency==='ves' && source==='ADMIN_CREDIT')`.
    - **Source Collection & Fields:** `WalletTransaction.{source, currency, type, status, amount}`.
    - **Date Range & Filters:** Inherits `txQuery`.
    - **Simulated Demo Sample:** `0 ADMIN_CREDIT` rows / `28,000 VEs` = **`0.0%`**.
    - **Implementation & Testability:** **Implemented & Testable** (`kpis.adminManualAdjustmentsSharePct`, `kpis.adminManualCreditsVes`; verified in `KPI-TEST-01`, `KPI-TEST-02`, `KPI-TEST-06`).
    - **Validation & Limitations:** Excludes non-`ves` admin credits (e.g., Tokens) and does not count `REFUND` reversals as admin credits. Legacy `/api/wallet/credit` creates `ADMIN_CREDIT` without `AuditLog`, though `WalletTransaction` still captures it.

24. **KPI-30 — Ledger Arithmetic Integrity Rate (%)**
    - **Definition:** Percentage of matched ledger rows across all currencies whose `balanceAfter` equals `balanceBefore + amount` (`CREDIT`) or `balanceBefore - amount` (`DEBIT`).
    - **Formula:** `ledgerRowsCheckedCount > 0 ? Number(((ledgerValidRowsCount / ledgerRowsCheckedCount) * 100).toFixed(1)) : 0`.
    - **Source Collection & Fields:** `WalletTransaction.{type, amount, balanceBefore, balanceAfter}`.
    - **Date Range & Filters:** Evaluated on all matched `txQuery` rows (including non-`COMPLETED` so integrity anomalies are never hidden).
    - **Simulated Demo Sample:** `10 / 10` valid rows = **`100.0%`**.
    - **Implementation & Testability:** **Implemented & Testable** (`kpis.ledgerArithmeticIntegrityPct`, `ledgerRowsCheckedCount`, `ledgerValidRowsCount`, `ledgerInvalidRowsCount`; verified in `TC-12`, `KPI-TEST-01`, `KPI-TEST-04`, `KPI-TEST-06`).
    - **Validation & Limitations:** Safely returns `0` on `0` rows; checks finite non-negative arithmetic with `1e-9` float tolerance.

25. **KPI-31 — Wallet-to-Ledger Balance Reconciliation**
    - **Definition:** Discrepancy count comparing each user's current `Wallet[c]` across all 5 currencies (`ves`, `sves`, `gems`, `tokens`, `spins`) against lifetime net `COMPLETED` `WalletTransaction` sums (`CREDITS[c] - DEBITS[c]`).
    - **Formula:** `COUNT((userId, c) WHERE ABS(COALESCE(Wallet[c], 0) - (SUM(COMPLETED CREDIT[c]) - SUM(COMPLETED DEBIT[c]))) > 1e-9)`.
    - **Source Collection & Fields:** `Wallet.{userId, ves, sves, gems, tokens, spins}`, `WalletTransaction.{userId, currency, type, amount, status}` (`status === 'COMPLETED'`).
    - **Date Range & Filters:** Unfiltered **lifetime** check (unaffected by `startDate`, `endDate`, `currency`, `source`, `search` filters).
    - **Simulated Demo Sample (`USR-DEMO-001`):** `ves: 25000=25000`, `sves: 5000=5000`, `gems: 100=100`, `tokens: 500=500`, `spins: 3=3` $\rightarrow$ **`0` discrepancies** (`walletReconciliationMatched: true`).
    - **Implementation & Testability:** **Implemented & Testable** (`kpis.walletReconciliationDiscrepanciesCount`, `walletReconciliationCheckedWallets`, `walletReconciliationMatched`; verified in `KPI-TEST-01`, `KPI-TEST-02`, `KPI-TEST-03`, `KPI-TEST-04`, `KPI-TEST-06`).
    - **Validation & Limitations:** Detects both unlogged wallet edits and ledger transactions missing a backing `Wallet`. Because no replica-set `ClientSession` binds wallet updates to ledger inserts, this metric remains essential for detecting mid-flight write failures.

26. **KPI-33 — Average Transaction Size (VEs)**
    - **Definition:** Mean `amount` across `COMPLETED`, `ves`-denominated ledger transactions matching active filters.
    - **Formula:** `vesCompletedCount > 0 ? Number((SUM(tx.amount WHERE status==='COMPLETED' && currency==='ves') / vesCompletedCount).toFixed(2)) : 0`.
    - **Source Collection & Fields:** `WalletTransaction.{currency, status, amount}`.
    - **Date Range & Filters:** Inherits `txQuery`.
    - **Simulated Demo Sample:** `31,000 / 6` = **`5,166.67 VEs`**.
    - **Implementation & Testability:** **Implemented & Testable** (`kpis.avgVesTransactionSize`; verified in `KPI-TEST-01`, `KPI-TEST-02`, `KPI-TEST-05`, `KPI-TEST-06`).
    - **Validation & Limitations:** Strictly excludes non-`ves` currencies and non-`COMPLETED` rows.

---

### Group 3: Needs Business Confirmation KPIs (12 KPIs — Pending VELOOP Stakeholder Rules)

27. **KPI-02 — Active Users Count** *(Implemented in `GET /api/admin/analytics`)*
    - **Definition:** Accounts permitted to transact (`accountStatus === 'active'`).
    - **Formula:** `users.filter(u => u.accountStatus === 'active').length`.
    - **Source Collection & Fields:** `User.accountStatus`.
    - **Date Range & Filters:** Unfiltered point-in-time snapshot.
    - **Simulated Demo Sample:** **`2` active accounts** (`USR-DEMO-001` + `ADM-VELOOP-999`).
    - **Implementation & Testability:** **Implemented (`kpis.activeUsers`) & Testable**; classification remains **Needs Business Confirmation**.
    - **Validation & Limitations:** Measures account permission status rather than behavioral session activity and includes `role: 'admin'`.

28. **KPI-05 — New User Registrations (Period)** *(Missing in Analytics API)*
    - **Definition:** New accounts created within the selected date window.
    - **Formula:** `COUNT(User WHERE createdAt BETWEEN startDate AND endDate)`.
    - **Source Collection & Fields:** `User.createdAt`.
    - **Date Range & Filters:** Currently **not applied** in `adminRoutes.ts` (`User.find({})` ignores `startDate`/`endDate`).
    - **Simulated Demo Sample:** `2` users seeded at sandbox initialization timestamp $\rightarrow$ **`2` new registrations** in current seed window.
    - **Implementation & Testability:** **Missing from `GET /api/admin/analytics`**; schema-backed & testable via query.
    - **Validation & Limitations:** Requires VELOOP confirmation on UTC vs IST (`Asia/Kolkata`) day boundaries and admin exclusion.

29. **KPI-09 — Daily Streak Claim Rate (%)** *(Missing in Analytics API)*
    - **Definition:** Percentage of eligible active users claiming a daily reward on a target day.
    - **Formula:** `(COUNT(DISTINCT userId IN WalletTransaction WHERE source === 'DAILY_REWARD' AND date === targetDay) / NULLIF(DenominatorUsers, 0)) * 100`.
    - **Source Collection & Fields:** `WalletTransaction.{userId, source, createdAt}`, `User.{accountStatus, role}`.
    - **Date Range & Filters:** Target 24h calendar window.
    - **Simulated Demo Sample:** `USR-DEMO-001` has `TXN-INIT-004` (`250 VEs`, `T-3d`) and `TXN-INIT-010` (`3 Spins`, `T-1d`):
      - For `T-3d` (using `2` active accounts): `(1 / 2) * 100 = 50.0%` (or `1 / 1 = 100.0%` for consumer-only active accounts).
      - For `today` (no claim today in seed): **`0.0%`**.
    - **Implementation & Testability:** **Missing from `GET /api/admin/analytics`** (`claim-daily` cooldown tested in `TC-09`/`TC-10`).
    - **Validation & Limitations:** Requires stakeholder confirmation on denominator (DAU vs active consumer accounts vs all active accounts) and timezone.

30. **KPI-16 — Average VEs Balance per User** *(Missing in Analytics API)*
    - **Definition:** Mean spendable `ves` balance per wallet or per user.
    - **Formula:** `SUM(Wallet.ves) / NULLIF(COUNT(Wallet or User), 0)`.
    - **Source Collection & Fields:** `Wallet.{userId, ves}`, `User.{userId, role}`.
    - **Date Range & Filters:** Unfiltered wallet snapshot.
    - **Simulated Demo Sample:** `25,000 / 1 wallet` = **`25,000.0 VEs`** (per wallet / consumer), or `25,000 / 2 users` = `12,500.0 VEs` (if admin without wallet is included).
    - **Implementation & Testability:** **Missing from `GET /api/admin/analytics`**; schema-backed.
    - **Validation & Limitations:** Requires confirmation on zero-balance and admin account exclusion.

31. **KPI-17 — Estimated USD Liability Exposure** *(Missing in Analytics API & Config)*
    - **Definition:** Estimated fiat USD liability represented by unredeemed `Wallet.ves`.
    - **Formula:** `SUM(Wallet.ves) * FX_RATE_USD_PER_VE`.
    - **Source Collection & Fields:** `Wallet.ves`; **missing** official FX configuration collection.
    - **Date Range & Filters:** Unfiltered wallet snapshot.
    - **Simulated Demo Sample (`25,000 VEs`):**
      - At UI display hint (`100 VEs = $1.00`): **`$250.00`**.
      - At PayPal $5 tier (`5,000 VEs = $5`): **`$25.00`**.
      - At PayPal $10 tier (`9,500 VEs = $10`): **`$26.32`**.
    - **Implementation & Testability:** **Missing from `GET /api/admin/analytics`**; requires Finance FX valuation rule before calculation is authoritative.
    - **Validation & Limitations:** Seeded payout tiers exhibit non-uniform implied VEs-to-fiat ratios (`3,000 VEs = ₹250` vs `5,000 VEs = $5` vs `9,500 VEs = $10`).

32. **KPI-20 — Staked-to-Spendable Ratio** *(Missing in Analytics API)*
    - **Definition:** Ratio of locked `sves` to liquid `ves` in user wallets.
    - **Formula:** `SUM(Wallet.sves) / NULLIF(SUM(Wallet.ves), 0)`.
    - **Source Collection & Fields:** `Wallet.{sves, ves}`.
    - **Date Range & Filters:** Unfiltered wallet snapshot.
    - **Simulated Demo Sample:** `5,000 / 25,000` = **`0.20` (`20.0%`)**.
    - **Implementation & Testability:** **Missing as a dedicated KPI field** (inputs exist in `kpis.walletLiability`).
    - **Validation & Limitations:** Target ratio band requires stakeholder confirmation.

33. **KPI-21 — Total VEs Earned (Gross Credits)** *(Implemented in `GET /api/admin/analytics`)*
    - **Definition:** Sum of `ves` credits in the selected filter window.
    - **Formula:** `SUM(tx.amount WHERE tx.type === 'CREDIT' AND tx.currency === 'ves')` (admin endpoint omits `status === 'COMPLETED'`, unlike `/api/wallet/summary`).
    - **Source Collection & Fields:** `WalletTransaction.{type, currency, amount, source, status, createdAt}`.
    - **Date Range & Filters:** Inherits `txQuery`.
    - **Simulated Demo Sample:** `15,000 + 5,000 + 500 + 250 + 7,250` = **`28,000 VEs`**.
    - **Implementation & Testability:** **Implemented (`kpis.totalCreditsVes`) & Testable**; classification remains **Needs Business Confirmation**.
    - **Validation & Limitations:** Includes `source: 'REFUND'` and `ADMIN_CREDIT` unless filtered; requires VELOOP sign-off on excluding `REFUND` reversals from gross earned rewards.

34. **KPI-26 — Fortune Wheel RTP / Avg Payout** *(Missing in Analytics API)*
    - **Definition:** Average reward payout issued per Fortune Wheel spin consumed.
    - **Formula:** `SUM(SpinPrizeValue) / NULLIF(COUNT(WalletTransaction WHERE currency === 'spins' AND type === 'DEBIT' AND source === 'GAME_REWARD'), 0)`.
    - **Source Collection & Fields:** `WalletTransaction.{currency, type, source, amount, metadata}`, spin prize table in `/server/routes/walletRoutes.ts`.
    - **Date Range & Filters:** `txQuery`.
    - **Simulated Demo Sample:** `0` Fortune Wheel spin debits exist in the base seed (`TXN-INIT-006` `7,250 VEs` is a tournament prize, not a wheel spin) $\rightarrow$ **Empirical sample = `N/A` (`0` spins)**; theoretical uniform `1/6` table VEs-only mean = `(300 + 500 + 1000) / 6 = 300.0 VEs/spin` (plus `15/6 Gems`, `50/6 Tokens`, `100/6 SVEs`).
    - **Implementation & Testability:** **Missing from `GET /api/admin/analytics`**.
    - **Validation & Limitations:** `GAME_REWARD` is shared by Fortune Wheel and tournament rewards without a `subSource` / `spinId` discriminator, preventing automatic separation without parsing `description`.

35. **KPI-32 — Failed / Reversed Transaction Rate (%)** *(Missing in Analytics API)*
    - **Definition:** Share of ledger transactions in `FAILED` or `REVERSED` status.
    - **Formula:** `(COUNT(WalletTransaction WHERE status IN ['FAILED', 'REVERSED']) / NULLIF(COUNT(WalletTransaction), 0)) * 100`.
    - **Source Collection & Fields:** `WalletTransaction.status`.
    - **Date Range & Filters:** `txQuery` (`createdAt`, `currency`, `source`).
    - **Simulated Demo Sample:** All `10` seeded rows are `COMPLETED` $\rightarrow$ `(0 / 10) * 100` = **`0.0%`**.
    - **Implementation & Testability:** **Missing from `GET /api/admin/analytics`**.
    - **Validation & Limitations:** Current code records withdrawal reversals as `COMPLETED` `REFUND` credits rather than mutating original debits to `REVERSED`; accounting policy needs confirmation.

36. **KPI-39 — Withdrawal Approval Rate (%)** *(Implemented in `GET /api/admin/analytics`)*
    - **Definition:** Percentage of finalized withdrawal decisions that were approved.
    - **Formula:** `approvedCount + rejectedCount > 0 ? Number(((approvedCount / (approvedCount + rejectedCount)) * 100).toFixed(1)) : 0`.
    - **Source Collection & Fields:** `Withdrawal.{status, requestedAt}`.
    - **Date Range & Filters:** `startDate`–`endDate` on `Withdrawal.requestedAt`.
    - **Simulated Demo Sample:** `1 approved`, `0 rejected` $\rightarrow$ `(1 / 1) * 100` = **`100.0%`**.
    - **Implementation & Testability:** **Implemented (`kpis.withdrawalApprovalRatePct`) & Testable**; classification remains **Needs Business Confirmation**.
    - **Validation & Limitations:** Because `adminRoutes.ts` line 417 adds `CANCELLED` withdrawals to `rejectedCount`, user cancellations dilute the approval rate unless separated.

37. **KPI-40 — Total Cash Disbursed by Currency (INR/USD)** *(Stubbed Pending Stakeholder Consolidation Rules)*
    - **Definition:** Total approved fiat disbursement obligation grouped by payout currency (`INR`, `USD`).
    - **Formula:** Canonical: `GROUP BY Withdrawal.payoutCurrency -> SUM(Withdrawal.payoutAmount WHERE Withdrawal.status === 'APPROVED')`. Current API code (`analyticsService.ts`): initializes `totalPayoutValueINR: 0, totalPayoutValueUSD: 0` pending stakeholder accounting sign-off.
    - **Source Collection & Fields:** `Withdrawal.{payoutCurrency, optionId, payoutAmount, status, requestedAt}`.
    - **Date Range & Filters:** `startDate`–`endDate` on `Withdrawal.requestedAt`.
    - **Simulated Demo Sample:** `Withdrawal.payoutCurrency` is now persisted (`WTH-HIST-001` = `'INR'`, `payoutAmount: 250`), while `totalPayoutValueINR` / `totalPayoutValueUSD` intentionally remain withheld (`0`) until Finance confirms settlement FX/consolidation rules.
    - **Implementation & Testability:** **`Withdrawal.payoutCurrency` Schema Implemented**; API aggregation withheld pending VELOOP Finance sign-off.
    - **Validation & Limitations:** Legacy pre-upgrade records (if imported externally) still require joining `PayoutOption.currency`.

38. **KPI-41 — Average Withdrawal Processing SLA** *(Missing in Analytics API)*
    - **Definition:** Mean elapsed time from withdrawal request to admin decision.
    - **Formula:** `AVG(Withdrawal.processedAt - Withdrawal.requestedAt WHERE processedAt != null)`.
    - **Source Collection & Fields:** `Withdrawal.{requestedAt, processedAt, status}`.
    - **Date Range & Filters:** `startDate`–`endDate` on `Withdrawal.requestedAt`.
    - **Simulated Demo Sample (`WTH-HIST-001`):** `processedAt - requestedAt = 3,600,000 ms` = **`1.0 hour` (`60 minutes`)**.
    - **Implementation & Testability:** **Missing from `GET /api/admin/analytics`**; testable via query.
    - **Validation & Limitations:** Requires VELOOP target SLA confirmation (e.g., `< 24h`) to compute SLA breach rates.

---

### Group 4: Not Testable KPIs (7 KPIs — Blocked by Missing Schemas / Telemetry)

39. **KPI-06 — Daily Active Users (DAU):** Missing `SessionLogs` / `User.lastLoginAt`. Formula: `COUNT(DISTINCT SessionLogs.userId ON date)`. Demo sample: **Not Testable (`N/A`)** (cannot be fabricated from ledger rows alone).
40. **KPI-07 — Monthly Active Users (MAU):** Missing `SessionLogs`. Formula: `COUNT(DISTINCT SessionLogs.userId IN trailing 30d)`. Demo sample: **Not Testable (`N/A`)**.
41. **KPI-08 — DAU / MAU Stickiness Ratio:** Derived from `KPI-06 / KPI-07 * 100`. Blocked on `SessionLogs`. Demo sample: **Not Testable (`N/A`)**.
42. **KPI-10 — User Retention Rate (Day-7 / Day-30):** Denominator `User.createdAt` exists, but numerator `ActivityLogs`/`SessionLogs` is missing. Demo sample: **Not Testable (`N/A`)**.
43. **KPI-27 — Ad-Watch eCPM / Ad Revenue Yield:** `AD_REWARD` cost (`500 VEs` in `TXN-INIT-003`) exists, but external ad-mediation revenue (`AdRevenue`) is absent. Demo sample: **Not Testable (`N/A`)**.
44. **KPI-34 — Duplicate Idempotency Prevention Count:** `PayoutService.requestWithdrawal` enforces idempotency atomically via partial unique index & lookup without persisting a `DUPLICATE_BLOCKED` analytics counter. Demo sample: **Not Testable (`N/A`)**.
45. **KPI-46 — Referred User LTV vs Organic LTV:** `User.referredByUserId` attribution field is implemented, but downstream `AdRevenue` / gross monetization telemetry is missing. Demo sample: **Not Testable (`N/A`)**.

*(Note on KPI-45 — Newly Implemented):* **KPI-45 — Referral Invite-to-Signup Conversion Rate (%)** is now implemented via `/server/models/Referral.ts` and `AnalyticsService.getAdminAnalytics()` (`referralPerformance.totalInvites`, `registeredReferrals`, `conversionRatePct`). Base seed contains 1 `INVITED` record (`REF-SEED-001`) $\rightarrow$ `0/1 = 0.0%`; interactive invite + signup conversion is verified in `TC-19` & `PH-03`, while referral VEs payouts stay paused at `0 VEs` (`PENDING_BUSINESS_RULE`).

---

## Complete 46-KPI Summary & Missing Calculations Inventory

### Classification Breakdown (`27 + 12 + 7 = 46`)
- **Validated (`27`):** `KPI-01`, `KPI-03`, `KPI-04`, `KPI-11`, `KPI-12`, `KPI-13`, `KPI-14`, `KPI-15`, `KPI-18`, `KPI-19`, `KPI-22`, `KPI-23`, `KPI-24`, `KPI-25`, `KPI-28`, `KPI-29`, `KPI-30`, `KPI-31`, `KPI-33`, `KPI-35`, `KPI-36`, `KPI-37`, `KPI-38`, `KPI-42`, `KPI-43`, `KPI-44`, `KPI-45`
- **Needs Business Confirmation (`12`):** `KPI-02`, `KPI-05`, `KPI-09`, `KPI-16`, `KPI-17`, `KPI-20`, `KPI-21`, `KPI-26`, `KPI-32`, `KPI-39`, `KPI-40`, `KPI-41`
- **Not Testable (`7`):** `KPI-06`, `KPI-07`, `KPI-08`, `KPI-10`, `KPI-27`, `KPI-34`, `KPI-46`

### Implementation Coverage & Verified Test Evidence
- **Implemented directly in `GET /api/admin/analytics` (`30` of `46` KPIs):**
  - **All `27` Validated KPIs (`100%` of Validated):** `KPI-01`, `03`, `04`, `11`, `12`, `13`, `14`, `15`, `18`, `19`, `22`, `23`, `24`, `25`, `28`, `29`, `30`, `31`, `33`, `35`, `36`, `37`, `38`, `42`, `43`, `44`, `45`.
  - **Needs Business Confirmation (`3`):** `KPI-02`, `21`, `39` (preserved without altering stakeholder-dependent definitions; `KPI-21` enforces `status === 'COMPLETED'`).
- **Remaining Pending-Confirmation Calculations (`9` Schema-Backed / Stubbed KPIs intentionally withheld until VELOOP rules are confirmed):**
  - **Stubbed at `0` (`1` KPI):** `KPI-40` (`totalPayoutValueINR` and `totalPayoutValueUSD` remain `0` pending VELOOP Finance currency consolidation rules; `Withdrawal.payoutCurrency` snapshot is now stored).
  - **Unimplemented Pending Stakeholder Definitions (`8` KPIs):** `KPI-05`, `KPI-09`, `KPI-16`, `KPI-17`, `KPI-20`, `KPI-26`, `KPI-32`, `KPI-41`.
- **Not Testable (`7` KPIs — Missing Telemetry / External Feeds):** `KPI-06`, `07`, `08`, `10`, `27`, `34`, `46`.
- **Executed Automated Verification Evidence (Sandbox `MongoMemoryServer`):**
  - `npm test` (`tsx test/runTests.ts`): **`TOTAL: 23 | PASS: 22 | FAIL: 0 | NOT TESTABLE: 1`** (`TC-19` now `PASS`; `TC-23` remains `NOT_TESTABLE`).
  - `npm run test:security` (`tsx test/withdrawalSecurityTests.ts`): **`TOTAL: 6 | PASS: 6 | FAIL: 0`**.
  - `npm run test:kpi` (`tsx test/kpiAnalyticsTests.ts`): **`TOTAL: 6 | PASS: 6 | FAIL: 0`**.
  - `npm run test:hardening` (`tsx test/platformHardeningTests.ts`): **`TOTAL: 6 | PASS: 6 | FAIL: 0`**.
  - `npm run build` (`vite build`) & `tsc --noEmit`: both completed with exit code `0`.
- **Remaining Limitations:**
  - `GET /api/admin/analytics` loads collections into Node memory via `.lean()` rather than native MongoDB `$group` aggregation pipelines.
  - `withdrawalStats.rejectedCount` / `rejectedVes` (`KPI-38`, `KPI-39`) continue to group `CANCELLED` alongside `REJECTED` pending stakeholder confirmation.
  - Sandbox metrics strictly represent `SIMULATED_DEMO_DATA`; production VELOOP database and missing telemetry collections remain disconnected and unimplemented.

