# VELoop Rewards – Test Execution Report

**Execution Command:** `npm test` (`tsx test/runTests.ts`)  
**Test Suite Source:** `/test/runTests.ts` (mapped to `/Test_cases.md`)  
**Execution Window (UTC):** `2026-11-19T10:19:40.182Z` – `2026-11-19T10:19:40.907Z`  
**Environment:** Embedded `MongoMemoryServer` (`^11.3.0`, `dbName: 'veloop_rewards'`, `MONGODB_URL / MONGODB_URI configured: false`, `Selected MongoDB variable: NONE`), Express + Mongoose (`^9.12.1`), ephemeral HTTP server on `127.0.0.1`  
**Data Classification:** Simulated / Seeded Sandbox Test Data

---

## 1. Execution Summary

| Metric | Count | Notes |
| :--- | :---: | :--- |
| **Total Defined Test Cases (`TC-01` – `TC-23`)** | **23** | All 23 test cases mapped directly to `/test/runTests.ts` and backend routes/services |
| **PASS** | **21** | Executed cleanly against embedded `MongoMemoryServer` (`TC-01`–`TC-18`, `TC-20`–`TC-22`) |
| **FAIL** | **0** | Zero assertion failures during this run |
| **NOT_TESTABLE** | **2** | `TC-19` (missing `Referral` invite schema), `TC-23` (no external Atlas cluster configured/whitelisted) |
| **NOT_EXECUTED (CLI Runner)** | **0** *(automated)* / **UI Manual Flows Separate** | All 23 backend cases executed via `npm test`; browser-level React UI flows are outside `npm test` (see Section 4) |

---

## 2. Test-to-Implementation Mapping & Execution Evidence (`TC-01` – `TC-23`)

| Test ID | Category | Test Mode | Mapped Backend Implementation | Expected Result | Actual Executed Result | Status | Executed At (UTC) | Duration |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- | :---: |
| **TC-01** | Authentication | Automated HTTP API | `POST /api/auth/register` (`/server/routes/authRoutes.ts`), `User`, `Wallet`, `AuditLog` | HTTP 201 with JWT token, user object, and wallet seeded with 1000 VEs, 0 SVEs, 10 Gems, 50 Tokens, 2 Spins | `HTTP 201; userId=USR-1795083580329-21C3D1; wallet=(1000 VEs, 0 SVEs, 10 Gems, 50 Tokens, 2 Spins)` | **PASS** | `2026-11-19T10:19:40.182Z` | 164ms |
| **TC-02** | Authentication | Automated HTTP API | `POST /api/auth/register` (`/server/routes/authRoutes.ts`), `User.email` unique index | HTTP 409 Conflict with duplicate email error message | `HTTP 409: An account with this email already exists` | **PASS** | `2026-11-19T10:19:40.346Z` | 6ms |
| **TC-03** | Authentication | Automated HTTP API | `POST /api/auth/login` (`/server/routes/authRoutes.ts`), `bcryptjs` | Valid admin credentials return HTTP 200 + JWT; bad password returns HTTP 401 | `Bad password -> HTTP 401; Admin login -> HTTP 200 (role=admin)` | **PASS** | `2026-11-19T10:19:40.352Z` | 178ms |
| **TC-04** | Authentication | Automated HTTP API | `POST /api/auth/login` (`/server/routes/authRoutes.ts`), `User.accountStatus` | HTTP 403 Forbidden for suspended account | `HTTP 403 returned for suspended user USR-SUSP-1795083580531` | **PASS** | `2026-11-19T10:19:40.531Z` | 182ms |
| **TC-05** | Authentication & RBAC | Automated HTTP API | `authenticateToken` & `requireAdmin` (`/server/middleware/auth.ts`), `GET /api/wallet`, `GET /api/admin/users` | Missing/tampered token -> HTTP 401; regular user on admin route -> HTTP 403 | `Unauth -> 401; Invalid JWT -> 401; Non-admin on /admin/users -> 403` | **PASS** | `2026-11-19T10:19:40.713Z` | 13ms |
| **TC-06** | User Records | Automated Service + HTTP API | `User` schema (`lowercase`, `trim`), `GET /api/admin/user-conflicts` (`/server/routes/adminRoutes.ts`) | Uppercase/whitespace email normalized to lowercase; conflict endpoint returns `auditSummary` without mutating records | `Email normalized (upper_1795083580726@veloop.test); conflict scan scanned 5 users -> 0 duplicates` | **PASS** | `2026-11-19T10:19:40.726Z` | 12ms |
| **TC-07** | Wallet Balances | Automated Service/Mongoose | `WalletService.creditWallet()` & `getWallet()` (`/server/services/walletService.ts`), `Wallet` | Crediting Gems does not alter VEs, SVEs, Tokens, or Spins | `Gems=45 while VEs=100, SVEs=200, Tokens=40, Spins=5` | **PASS** | `2026-11-19T10:19:40.738Z` | 9ms |
| **TC-08** | Wallet Balances | Automated Service/Mongoose | `WalletService.creditWallet()` & `debitWallet()` (`/server/services/walletService.ts`) | Throws validation error and leaves balance intact | `Negative credit rejected; Zero debit rejected; balance preserved at 500 VEs` | **PASS** | `2026-11-19T10:19:40.747Z` | 1ms |
| **TC-09** | Rewards | Automated HTTP API | `POST /api/wallet/claim-daily` (`/server/routes/walletRoutes.ts`), `WalletService` | Credits `+250 VEs` and `+1 Spin` atomically with ledger entries | `HTTP 200; wallet updated to 1250 VEs and 3 Spins` | **PASS** | `2026-11-19T10:19:40.748Z` | 16ms |
| **TC-10** | Rewards | Automated HTTP API | `POST /api/wallet/claim-daily` (`/server/routes/walletRoutes.ts`), `WalletTransaction` cooldown check | Second claim within 24h returns HTTP 400 and does not double-credit | `HTTP 400 cooldown active: Daily reward already claimed today. Next reward available in 24h 0m.` | **PASS** | `2026-11-19T10:19:40.764Z` | 6ms |
| **TC-11** | Rewards | Automated HTTP API | `POST /api/wallet/spin` (`/server/routes/walletRoutes.ts`), `WalletService` | Deducts 1 spin and awards one of the defined prizes cleanly | `Won 100 Staked VEs; Spins 3 -> 2` | **PASS** | `2026-11-19T10:19:40.770Z` | 11ms |
| **TC-12** | Transactions | Automated Service/Mongoose | `WalletTransaction` ledger records (`/server/models/WalletTransaction.ts`, `WalletService`) | Every CREDIT has `balanceAfter = balanceBefore + amount`; every DEBIT has `balanceAfter = balanceBefore - amount` | `Verified 4 ledger rows for exact before/after arithmetic` | **PASS** | `2026-11-19T10:19:40.781Z` | 2ms |
| **TC-13** | Transactions | Automated HTTP API | `GET /api/wallet/transactions` (`/server/routes/walletRoutes.ts`), `WalletService.getTransactions()` | Returns paginated data matching currency & type query parameters | `Returned 1 filtered VEs CREDIT records (total=1)` | **PASS** | `2026-11-19T10:19:40.783Z` | 8ms |
| **TC-14** | Withdrawals | Automated Service/Mongoose | `PayoutService.requestWithdrawal()` (`/server/services/payoutService.ts`), `WalletService.debitWallet()` | Valid withdrawal deducts VEs & creates PENDING withdrawal; insufficient balance throws error | `Reserved 3000 VEs (5000 -> 2000); second request rejected on insufficient funds` | **PASS** | `2026-11-19T10:19:40.791Z` | 14ms |
| **TC-15** | Withdrawals | Automated Service/Mongoose | `PayoutService.requestWithdrawal()` idempotency check (`/server/services/payoutService.ts`) | Returns original withdrawal record without deducting VEs twice | `Both requests returned WTH-1795083580808-AF3B4E33; wallet debited once (6000 -> 3000)` | **PASS** | `2026-11-19T10:19:40.805Z` | 10ms |
| **TC-16** | Withdrawals & Admin | Automated HTTP API | `PATCH /api/admin/withdrawals/:id/approve` (`/server/routes/adminRoutes.ts`), `PayoutService.approveWithdrawal()` | Status changes to APPROVED with `processedAt` timestamp and `AuditLog` entry | `Withdrawal WTH-1795083580817-5FEC984B -> APPROVED with reviewNote` | **PASS** | `2026-11-19T10:19:40.815Z` | 19ms |
| **TC-17** | Withdrawals & Admin | Automated HTTP API | `PATCH /api/admin/withdrawals/:id/reject` (`/server/routes/adminRoutes.ts`), `PayoutService.rejectWithdrawal()` | Status changes to REJECTED; reserved VEs refunded 100%; REFUND credit ledger entry created | `Rejected WTH-1795083580836-0CFF0446; refunded 3000 VEs back to 4000 VEs with REFUND ledger entry` | **PASS** | `2026-11-19T10:19:40.834Z` | 22ms |
| **TC-18** | Referrals | Automated Service + HTTP API | `WalletService.creditWallet()`, `GET /api/admin/analytics?source=REFERRAL` (`/server/routes/adminRoutes.ts`) | Referral transaction recorded with `source=REFERRAL` and counted in `referralPerformance` KPIs | `Referral VEs awarded=6500 across 2 txns` | **PASS** | `2026-11-19T10:19:40.856Z` | 21ms |
| **TC-19** | Referrals | Schema/Capability Check (Not Executable) | Missing `Referral` Mongoose model (only `WalletTransaction.source='REFERRAL'` exists) | Requires Referral/Invite entity with `inviteSentAt`, `referrerId`, `refereeId`, `convertedAt` | `NOT TESTABLE: Current schema lacks a Referral collection/invite tracking model (only completed REFERRAL credit entries exist in WalletTransaction).` | **NOT_TESTABLE** | `2026-11-19T10:19:40.877Z` | 0ms |
| **TC-20** | KPIs & Analytics | Automated HTTP API | `GET /api/admin/analytics` (`/server/routes/adminRoutes.ts`) | HTTP 200 with `kpis`, `withdrawalStats`, `dailyTrends`, `sourceBreakdown`, and `productionDataConnected=false` | `HTTP 200; users=5, active=4, VEsCredits=32750, classification=SIMULATED_DEMO_DATA` | **PASS** | `2026-11-19T10:19:40.877Z` | 10ms |
| **TC-21** | Database & ER | Automated Service/Mongoose | `User`, `Wallet`, `WalletTransaction`, `Withdrawal`, `PayoutOption` (`/server/models/*.ts`) | Demo user wallet, transactions, and withdrawal references resolve cleanly to existing parent entities | `User(1)->Wallet(1), User(1)->Tx(N), User(1)->Withdrawal(N), Withdrawal->PayoutOption resolved` | **PASS** | `2026-11-19T10:19:40.887Z` | 9ms |
| **TC-22** | Database & ER | Automated HTTP API | `POST /api/admin/wallet/credit` (`/server/routes/adminRoutes.ts`), `AuditLog` | HTTP 200 wallet credit + `AuditLog` record with `action=ADMIN_WALLET_CREDIT` | `Credited +25 tokens to USR-1795083580329-21C3D1; AuditLog recorded (6afecd3c182e028b13bab943)` | **PASS** | `2026-11-19T10:19:40.896Z` | 11ms |
| **TC-23** | Production Integration | Environment Check (Requires External Atlas) | `connectDB()` & `getDBStatus()` (`/server/db.ts`) | Connected to Atlas replica set when `MONGODB_URL` / `MONGODB_URI` is configured and whitelisted | `NOT TESTABLE: Running in embedded mode (External MONGODB_URL/MONGODB_URI not configured or IP not whitelisted in sandbox container).` | **NOT_TESTABLE** | `2026-11-19T10:19:40.907Z` | 1ms |

---

## 3. Detailed Explanation & Required Evidence for `NOT_TESTABLE` Cases

1. **`TC-19` — Calculate Referral Invite-to-Signup Conversion Rate KPI (`NOT_TESTABLE`)**
   - **Reason:** `/server/models` contains no `Referral` / invite-tracking schema storing sent invitations, invite timestamps (`inviteSentAt`), `referrerId`, `refereeId`, or `convertedAt`. Only completed `REFERRAL` reward credit entries in `WalletTransaction` are implemented.
   - **Required Evidence to Unblock:** Implement a `Referral` Mongoose model and invite/conversion endpoints, seed/create invite + signup test records, and execute automated assertions calculating `(Converted Referrals / Total Invites Sent) * 100`.

2. **`TC-23` — Verify Live Connection to External VELOOP Production MongoDB Atlas Cluster (`NOT_TESTABLE`)**
   - **Reason:** In the isolated sandbox runtime, neither `MONGODB_URL` nor `MONGODB_URI` is configured (`MONGODB_URL / MONGODB_URI configured: false`) and dynamic container egress IPs cannot pass Atlas Network Access allowlisting. `connectDB()` therefore falls back to embedded `MongoMemoryServer`.
   - **Required Evidence to Unblock:** Configure valid staging/production `MONGODB_URI` credentials in secret management with Atlas IP/VPC allowlist access, run `npm test`, and capture `dbStatus.mode === 'atlas'` and `dbStatus.connected === true`.

---

## 4. Remaining Verification Gaps & Manual / UI Scope (`NOT_EXECUTED` by CLI Runner)

To keep test reporting strictly honest and avoid over-claiming coverage:

1. **Frontend Browser / UI Flows (`NOT_EXECUTED` in `npm test`):**
   - `npm test` (`tsx test/runTests.ts`) tests Express API endpoints and Mongoose services directly. Interactive React UI workflows in `/src/pages/*` (`LoginPage`, `RegisterPage`, `WalletDashboardPage`, `PayoutPage`, `TransactionHistoryPage`, `WithdrawalHistoryPage`, `AdminDashboardPage`, `AdminAnalyticsTab`, CSV export clicks, and client-side routing/error states) do **not** have automated browser/E2E tests (e.g., Playwright/Cypress) and were **NOT_EXECUTED** during this `npm test` CLI run.
   - **Required Evidence:** Manual browser verification checklist (or automated Playwright E2E suite) exercising every route in Chrome/Chromium with zero console/page errors.

2. **HTTP-Route vs. Service-Layer Coverage Nuances Inside Passing Automated Tests:**
   - **`TC-07`, `TC-08`, `TC-14`, `TC-15`:** Exercise `WalletService` and `PayoutService` directly in Node.js rather than going through HTTP (`POST /api/withdrawals` rate limiter and request validation middleware in `withdrawalRoutes.ts` are not invoked by `TC-14`/`TC-15`).
   - **`TC-04`:** Verifies `POST /api/auth/login` returns HTTP `403` for suspended accounts; checking an already-issued JWT on a protected endpoint (`authenticateToken` in `/server/middleware/auth.ts`) is not separately asserted in `TC-04`.
   - **`TC-16`:** Verifies HTTP `200` and `status === 'APPROVED'` via `PATCH /api/admin/withdrawals/:id/approve`; `PayoutService.approveWithdrawal` sets `processedAt` and writes an `AuditLog` entry, though `TC-16` does not assert those two database fields explicitly.
   - **`TC-20`:** Verifies `GET /api/admin/analytics` aggregations and `productionDataConnected === false`, though date-range query filtering (`?startDate=...&endDate=...`) and search filtering in `adminRoutes.ts` are not separately asserted inside `TC-20`.

---

## 5. Genuine Console Output Captured From `npm test`

```text
> react-example@0.0.0 test
> tsx test/runTests.ts

==================================================================
       VELoop Rewards — 23-Case Automated Verification Suite       
==================================================================

MONGODB_URL / MONGODB_URI configured: false
Selected MongoDB variable: NONE
Embedded MongoDB engine ready.
VELoop seed data initialization completed successfully.
✓ [TC-01] Register new user via POST /api/auth/register and initialize 5-currency wallet -> PASS (164ms)
✓ [TC-02] Reject duplicate email registration via POST /api/auth/register -> PASS (6ms)
✓ [TC-03] Authenticate seeded admin and reject invalid password on POST /api/auth/login -> PASS (178ms)
✓ [TC-04] Block suspended user login and authenticated endpoints -> PASS (182ms)
✓ [TC-05] Enforce JWT authentication and prevent regular user from accessing /api/admin/users -> PASS (13ms)
✓ [TC-06] Normalize email casing on creation and audit conflicting user records via GET /api/admin/user-conflicts -> PASS (12ms)
✓ [TC-07] Verify multi-currency isolation across ves, sves, gems, tokens, spins -> PASS (9ms)
✓ [TC-08] Reject negative or zero credit/debit amounts in WalletService -> PASS (1ms)
✓ [TC-09] Claim daily reward via POST /api/wallet/claim-daily -> PASS (16ms)
✓ [TC-10] Enforce 24h cooldown on second POST /api/wallet/claim-daily attempt -> PASS (6ms)
✓ [TC-11] Spin Fortune Wheel via POST /api/wallet/spin -> PASS (11ms)
✓ [TC-12] Verify double-entry balanceBefore and balanceAfter math across transactions -> PASS (2ms)
✓ [TC-13] Filter & paginate ledger via GET /api/wallet/transactions -> PASS (8ms)
✓ [TC-14] Reserve VEs atomically on withdrawal and reject insufficient balance -> PASS (14ms)
✓ [TC-15] Prevent duplicate deductions when identical idempotencyKey is submitted within 60s -> PASS (10ms)
✓ [TC-16] Approve pending withdrawal via PATCH /api/admin/withdrawals/:id/approve -> PASS (19ms)
✓ [TC-17] Reject withdrawal via PATCH /api/admin/withdrawals/:id/reject and verify automatic VEs refund -> PASS (22ms)
✓ [TC-18] Credit REFERRAL source reward and verify referral metrics in GET /api/admin/analytics -> PASS (21ms)
⊘ [TC-19] Calculate Referral Invite-to-Signup Conversion Rate KPI -> NOT_TESTABLE (0ms)
✓ [TC-20] Verify GET /api/admin/analytics aggregations, date filtering, and simulated dataOrigin labeling -> PASS (10ms)
✓ [TC-21] Validate ER referential integrity across Users, Wallets, Transactions, Withdrawals, and PayoutOptions -> PASS (9ms)
✓ [TC-22] Verify admin manual credit creates AuditLog entry via POST /api/admin/wallet/credit -> PASS (11ms)
⊘ [TC-23] Verify live connection to external VELOOP production MongoDB Atlas cluster -> NOT_TESTABLE (1ms)

==================================================================
TOTAL: 23 | PASS: 21 | FAIL: 0 | NOT TESTABLE: 2
==================================================================
```
