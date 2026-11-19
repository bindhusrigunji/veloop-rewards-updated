# VELOOP Rewards — Test Evidence Report

**Prepared For:** Technical & Milestone Verification  
**Verification Date (UTC):** `2026-11-19` (`16:20:53Z` – `16:21:29Z`)  
**Runtime Environment:** Node.js `v22.23.2` · npm `10.9.8` · Linux Sandbox Container (`MongoMemoryServer ^11.3.0`, `Mongoose ^9.12.1`, `Express ^4.21.2`)  
**Data Classification:** Simulated / Seeded Sandbox Test Data (`MONGODB_URL` / `MONGODB_URI` not configured; `productionDataConnected: false`)  
**Scope:** Automated execution across core integration, withdrawal state-machine security, KPI validation, platform hardening (referral tracking, payout sandbox provider, DB health checks, input/security hardening), TypeScript static checking, and Vite production bundling.

---

## 1. Executive Summary

| Verification Command | Purpose | Result | Details |
| :--- | :--- | :--- | :--- |
| `npm test` (`tsx test/runTests.ts`) | Primary 23-case core suite | **22 PASS · 0 FAIL · 1 NOT_TESTABLE** | Execution window: `2026-11-19T16:21:26.337Z` – `2026-11-19T16:21:27.353Z` (`TC-19` Referral Conversion KPI now **PASS**; `TC-23` External Atlas DB remains **NOT_TESTABLE**) |
| `npm run test:security` (`tsx test/withdrawalSecurityTests.ts`) | Withdrawal state-machine & race condition suite | **6 PASS · 0 FAIL** | Covers `WS-01`–`WS-06` (`2026-11-19T16:20:53Z` – `16:21:03Z`) |
| `npm run test:kpi` (`tsx test/kpiAnalyticsTests.ts`) | Schema-backed KPI & analytics accuracy suite | **6 PASS · 0 FAIL** | Covers `KPI-TEST-01`–`KPI-TEST-06` (`2026-11-19T16:20:53Z` – `16:21:03Z`) |
| `npm run test:hardening` (`tsx test/platformHardeningTests.ts`) | Referral attribution, payout sandbox, DB health & security suite | **6 PASS · 0 FAIL** | Covers `PH-01`–`PH-06` (`2026-11-19T16:20:53Z` – `16:21:03Z`) |
| `npm run lint` (`tsc --noEmit`) | Strict TypeScript static type check | **PASS (0 errors)** | Clean compilation across backend, tests, and React frontend |
| `npm run build` (`vite build`) | Production client bundle verification | **PASS (`built in 661ms`)** | `1674 modules transformed` $\rightarrow$ `dist/index.html` (`0.95 kB`), `dist/assets/index-5EqRt4vn.css` (`54.09 kB`), `dist/assets/index-BM8hrs0x.js` (`681.81 kB`) |
| Browser / UI E2E Tests | Headless browser DOM & visual click tests | **NOT TESTABLE** | No Chromium/Chrome binary or Playwright/Puppeteer runner is installed in this sandbox container; React UI verified via source inspection, `tsc --noEmit`, `vite build`, and live Express `/api/health` smoke check |

**Aggregate Automated Assertions:** `40 PASS` (`22 + 6 + 6 + 6`), `0 FAIL`, `1 NOT_TESTABLE` (`TC-23`), plus Browser E2E `NOT TESTABLE` in this container.

---

## 2. All 22 Passing Core Test Cases (`npm test` — `test/runTests.ts`)

Every passing case below executed against an in-process Express server bound to `127.0.0.1` (`createApp()`) backed by seeded embedded `MongoMemoryServer` collections (`veloop_rewards`).

| Test ID | Category | Test Case Description | Observed Actual Result | Duration | Timestamp (UTC) |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **TC-01** | Authentication | Register new user via `POST /api/auth/register` and initialize 5-currency wallet | `HTTP 201; userId=USR-1795105286520-0E8855; wallet=(1000 VEs, 0 SVEs, 10 Gems, 50 Tokens, 2 Spins)` | `204ms` | `2026-11-19T16:21:26.337Z` |
| **TC-02** | Authentication | Reject duplicate email registration via `POST /api/auth/register` | `HTTP 409: An account with this email already exists` | `8ms` | `2026-11-19T16:21:26.541Z` |
| **TC-03** | Authentication | Authenticate seeded admin and reject invalid password on `POST /api/auth/login` | `Bad password -> HTTP 401; Admin login -> HTTP 200 (role=admin)` | `207ms` | `2026-11-19T16:21:26.549Z` |
| **TC-04** | Authentication | Block suspended user login and authenticated endpoints | `HTTP 403 returned for suspended user USR-SUSP-1795105286757` | `181ms` | `2026-11-19T16:21:26.757Z` |
| **TC-05** | Authentication & RBAC | Enforce JWT authentication and prevent regular user from accessing `/api/admin/users` | `Unauth -> 401; Invalid JWT -> 401; Non-admin on /admin/users -> 403` | `16ms` | `2026-11-19T16:21:26.938Z` |
| **TC-06** | User Records | Normalize email casing on creation and audit conflicting user records via `GET /api/admin/user-conflicts` | `Email normalized (upper_1795105286954@veloop.test); conflict scan scanned 5 users -> 0 duplicates` | `14ms` | `2026-11-19T16:21:26.954Z` |
| **TC-07** | Wallet Balances | Verify multi-currency isolation across `ves`, `sves`, `gems`, `tokens`, `spins` | `Gems=45 while VEs=100, SVEs=200, Tokens=40, Spins=5` | `16ms` | `2026-11-19T16:21:26.968Z` |
| **TC-08** | Wallet Balances | Reject negative or zero credit/debit amounts in `WalletService` | `Negative credit rejected; Zero debit rejected; balance preserved at 500 VEs` | `2ms` | `2026-11-19T16:21:26.984Z` |
| **TC-09** | Rewards | Claim daily reward via `POST /api/wallet/claim-daily` | `HTTP 200; wallet updated to 1250 VEs and 3 Spins` | `18ms` | `2026-11-19T16:21:26.986Z` |
| **TC-10** | Rewards | Enforce 24h cooldown on second `POST /api/wallet/claim-daily` attempt | `HTTP 400 cooldown active: Daily reward already claimed today. Next reward available in 24h 0m.` | `8ms` | `2026-11-19T16:21:27.004Z` |
| **TC-11** | Rewards | Spin Fortune Wheel via `POST /api/wallet/spin` | `Won 15 Gems; Spins 3 -> 2` | `13ms` | `2026-11-19T16:21:27.012Z` |
| **TC-12** | Transactions | Verify double-entry `balanceBefore` and `balanceAfter` math across transactions | `Verified 4 ledger rows for exact before/after arithmetic` | `2ms` | `2026-11-19T16:21:27.025Z` |
| **TC-13** | Transactions | Filter & paginate ledger via `GET /api/wallet/transactions` | `Returned 1 filtered VEs CREDIT records (total=1)` | `8ms` | `2026-11-19T16:21:27.027Z` |
| **TC-14** | Withdrawals | Reserve VEs atomically on withdrawal and reject insufficient balance | `Reserved 3000 VEs (5000 -> 2000); second request rejected on insufficient funds` | `18ms` | `2026-11-19T16:21:27.036Z` |
| **TC-15** | Withdrawals | Prevent duplicate deductions when identical `idempotencyKey` is submitted within 60s | `Both requests returned WTH-1795105287058-E4DDDCE9; wallet debited once (6000 -> 3000)` | `11ms` | `2026-11-19T16:21:27.055Z` |
| **TC-16** | Withdrawals & Admin | Approve pending withdrawal via `PATCH /api/admin/withdrawals/:id/approve` | `Withdrawal WTH-1795105287068-EDEAD621 -> APPROVED with reviewNote` | `19ms` | `2026-11-19T16:21:27.066Z` |
| **TC-17** | Withdrawals & Admin | Reject withdrawal via `PATCH /api/admin/withdrawals/:id/reject` and verify automatic VEs refund | `Rejected WTH-1795105287087-1D8D5037; refunded 3000 VEs back to 4000 VEs with REFUND ledger entry` | `24ms` | `2026-11-19T16:21:27.085Z` |
| **TC-18** | Referrals | Credit `REFERRAL` source reward and verify referral metrics in `GET /api/admin/analytics` | `Referral VEs awarded=6500 across 2 txns` | `37ms` | `2026-11-19T16:21:27.110Z` |
| **TC-19** | Referrals | Calculate Referral Invite-to-Signup Conversion Rate KPI | `Invite + signup tracked (VEL-TC08C5BA6); converted=1/2 (50%, rewardRuleStatus=PENDING_BUSINESS_RULE)` | `171ms` | `2026-11-19T16:21:27.148Z` |
| **TC-20** | KPIs & Analytics | Verify `GET /api/admin/analytics` aggregations, date filtering, and simulated `dataOrigin` labeling | `HTTP 200; users=6, active=5, VEsCredits=32750, classification=SIMULATED_DEMO_DATA` | `13ms` | `2026-11-19T16:21:27.319Z` |
| **TC-21** | Database & ER | Validate ER referential integrity across `Users`, `Wallets`, `Transactions`, `Withdrawals`, and `PayoutOptions` | `User(1)->Wallet(1), User(1)->Tx(N), User(1)->Withdrawal(N), Withdrawal->PayoutOption resolved` | `7ms` | `2026-11-19T16:21:27.332Z` |
| **TC-22** | Database & ER | Verify admin manual credit creates `AuditLog` entry via `POST /api/admin/wallet/credit` | `Credited +25 tokens to USR-1795105286520-0E8855; AuditLog recorded (6aff22073d2a5a7b15d284f9)` | `14ms` | `2026-11-19T16:21:27.339Z` |

*(Note: Seed `VEsCredits` in `TC-20` varies between runs (`32750` vs `33750`) depending on the prize won in `TC-11` when spinning the randomized Fortune Wheel on the shared demo user wallet.)*

---

## 3. Supplementary Verification Suites (`18 PASS · 0 FAIL`)

### 3.1 Withdrawal State-Machine & Concurrency Suite (`npm run test:security`)
- `✓ [WS-01]` Prevent rejection/refund and re-approval after a withdrawal is `APPROVED` $\rightarrow$ **PASS** (`89ms`)
- `✓ [WS-02]` Prevent repeated rejection (double refund) and subsequent approval after `REJECTED` $\rightarrow$ **PASS** (`110ms`)
- `✓ [WS-03]` Block approval and rejection/refund on `CANCELLED` withdrawal $\rightarrow$ **PASS** (`80ms`)
- `✓ [WS-04]` Serialize concurrent approve and reject requests cleanly across multiple race trials $\rightarrow$ **PASS** (`185ms`)
- `✓ [WS-05]` Prevent double refund under concurrent identical rejection requests across multiple trials $\rightarrow$ **PASS** (`212ms`)
- `✓ [WS-06]` Serialize concurrent double-approval and allow transition from `PROCESSING` status $\rightarrow$ **PASS** (`83ms`)

### 3.2 Schema-Backed KPI & Analytics Suite (`npm run test:kpi`)
- `✓ [KPI-TEST-01]` Verify exact values for KPIs 18, 19, 25, 28, 30, 31, 33 and separated VEs/all-currency counts on seeded demo data $\rightarrow$ **PASS** (`26ms`)
- `✓ [KPI-TEST-02]` Enforce mixed-currency isolation, `COMPLETED` status filter, `ADMIN_CREDIT` share, and `REFUND` non-reward/non-payout rules $\rightarrow$ **PASS** (`61ms`)
- `✓ [KPI-TEST-03]` Verify zero-balance user excluded from KPI-18 and missing-wallet user captured in KPI-19 and KPI-31 $\rightarrow$ **PASS** (`207ms`)
- `✓ [KPI-TEST-04]` Detect corrupted `balanceAfter` math in KPI-30 and unlogged wallet balance drift in KPI-31 $\rightarrow$ **PASS** (`19ms`)
- `✓ [KPI-TEST-05]` Enforce symmetrical UTC `00:00:00.000Z` to `23:59:59.999Z` boundaries for `startDate` and `endDate` $\rightarrow$ **PASS** (`88ms`)
- `✓ [KPI-TEST-06]` Return safe zero values without `NaN` or `Infinity` on empty collections (HTTP + `AnalyticsService`) $\rightarrow$ **PASS** (`16ms`)

### 3.3 Referral, Payout Sandbox, DB & Security Hardening Suite (`npm run test:hardening`)
- `✓ [PH-01]` Assign unique `referralCode` at registration, validate publicly, and track referral invites $\rightarrow$ **PASS** (`129ms`)
- `✓ [PH-02]` Block self-referral invites, self-referral attribution, and invalid referral codes $\rightarrow$ **PASS** (`17ms`)
- `✓ [PH-03]` Attribute referred signup with `rewardRuleStatus=PENDING_BUSINESS_RULE` (`0` auto VEs), prevent duplicates, and expose via admin API $\rightarrow$ **PASS** (`131ms`)
- `✓ [PH-04]` Snapshot `Withdrawal.payoutCurrency`, record `SandboxPaymentProvider` reference on approve, and serialize concurrent duplicate `idempotencyKey` $\rightarrow$ **PASS** (`22ms`)
- `✓ [PH-05]` Enforce mass-assignment blocking, currency allowlist, finite bounds, pagination clamping, ReDoS escape, and security headers $\rightarrow$ **PASS** (`31ms`)
- `✓ [PH-06]` Report live DB ping, persistent/sandbox classification in `/api/health`, and mask URI secrets safely $\rightarrow$ **PASS** (`5ms`)

---

## 4. Detailed Analysis of `NOT_TESTABLE` Items (`TC-23` & Browser E2E)

### 4.1 `TC-23` — Verify Live Connection to External VELOOP Production MongoDB Atlas Cluster
- **Status:** `NOT_TESTABLE` (`2026-11-19T16:21:27.353Z`, `0ms`)
- **Observed Output:** `NOT TESTABLE: Running in embedded mode (External MONGODB_URL/MONGODB_URI not configured or IP not whitelisted in sandbox container).`
- **Why It Cannot Be Tested Currently:**
  1. Neither `MONGODB_URL` nor `MONGODB_URI` is set in this sandbox container (`MONGODB_URL / MONGODB_URI configured: false`).
  2. Ephemeral preview/build containers use dynamic outbound IPs that cannot satisfy MongoDB Atlas IP Access Lists or private VPC peering, and production credentials must never be committed to repository files.
- **How to Verify Outside Sandbox:** Configure `MONGODB_URI` in a staging/local environment whose IP is allowlisted on a staging Atlas cluster and check `GET /api/health` (`database.mode === 'atlas'`, `database.persistent === true`, `database.pingOk === true`).

### 4.2 Browser / UI E2E Execution
- **Status:** `NOT TESTABLE` in this container.
- **Why:** Checked binary availability (`which chromium chromium-browser google-chrome npx playwright`): no headless Chromium binary, Playwright, or Cypress package is installed in the container.
- **Verification Completed Instead:** `tsc --noEmit` across all `/src` TSX files (`0` errors) and `npm run build` (`vite build` $\rightarrow$ `661ms`).

---

## 5. Build & TypeScript Outputs Captured During Verification

```text
> react-example@0.0.0 lint
> tsc --noEmit
(exit code 0 — 0 errors)

> react-example@0.0.0 build
> vite build
✓ 1674 modules transformed.
dist/index.html                   0.95 kB │ gzip:   0.42 kB
dist/assets/index-5EqRt4vn.css   54.09 kB │ gzip:   9.66 kB
dist/assets/index-BM8hrs0x.js   681.81 kB │ gzip: 172.41 kB
✓ built in 661ms
```
