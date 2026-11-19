# VELoop Rewards – Wallet & Payout System

A full-stack MERN (MongoDB, Express.js, React 19, Node.js + TypeScript) fintech rewards wallet, double-entry ledger, sandbox payout disbursement workflow, referral attribution engine, and administrative analytics platform.

> **Environment Classification Notice:** When external `MONGODB_URL` / `MONGODB_URI` credentials are not connected or whitelisted, the backend automatically operates on an embedded `MongoMemoryServer` sandbox (`persistent: false`, `dataClassification: 'SIMULATED_SANDBOX_FALLBACK'`) seeded with **simulated/demo data**. No actual VELOOP production records are mixed into the current environment.

---

## 1. Architecture Overview

- **Frontend (`/src`)**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, typed Fetch API client (`/src/services/api.ts`), JWT session context (`/src/context/AuthContext.tsx`).
  - **Pages**: Login (`/login`), Register with optional Referral Code (`/register`), Wallet Dashboard with Referral Attribution card (`/wallet`), Payout Redemption (`/payout`), Transaction Ledger History (`/transactions`), Withdrawal History (`/withdrawals`), Admin Console with Interactive Analytics, Referral Funnel & KPIs (`/admin`), and API Reference (`/api-docs`).
- **Backend (`/server` & `/server.ts`)**: Node.js + Express.js REST API mounted alongside Vite middleware in development (`port 3000`).
  - **Database Layer (`/server/db.ts`)**: Connects **Mongoose (`^9.12.1`)** to an external **MongoDB** cluster when `MONGODB_URL` or `MONGODB_URI` is configured and reachable, or falls back automatically to an embedded **`MongoMemoryServer` (`^11.3.0`)** instance (`dbName: 'veloop_rewards'`). Includes URL-safe credential masking (`maskMongoUri`), categorized diagnostics (`errorCategory`), and live database ping health checks (`pingDB()`, surfaced via `GET /api/health`).
  - **Models (`/server/models`)**: `User` (with unique `referralCode` and optional `referredByUserId`), `Wallet`, `WalletTransaction`, `Withdrawal` (with `payoutCurrency`, `providerMode`, `providerReferenceId`, and partial unique `{ userId, idempotencyKey }` index), `PayoutOption`, `AuditLog`, and `Referral`.
  - **Services (`/server/services`)**:
    - `WalletService`: atomic `$inc` mutations, `$gte` debit guards, strict currency allowlist, finite positive amount checks, double-entry `balanceBefore`/`balanceAfter` ledger snapshots.
    - `PayoutService` + `SandboxPaymentProvider` (`/server/services/paymentProvider.ts`): idempotent withdrawal reservation, beneficiary format validation, atomic conditional state transitions (`WS-01`–`WS-06`), simulated sandbox settlement references (`SBX-*`), and automated full-refund reversals.
    - `ReferralService`: unique referral code generation, invite tracking, pre-validated signup attribution, strict self-referral & duplicate-attribution blocking, and zero auto-credited VEs payouts until VELOOP approves reward rules (`rewardRuleStatus: 'PENDING_BUSINESS_RULE'`).
    - `AnalyticsService`: UTC-normalized date filtering, `COMPLETED`-status gating, `ves` vs all-currency count separation, 27 validated schema-backed KPIs (including `KPI-18, 19, 25, 28, 30, 31, 33, 45`), and conflict hygiene scanning.
  - **Middleware (`/server/middleware`)**: JWT bearer verification (`authenticateToken`, enforcing `JWT_SECRET` in `NODE_ENV=production`), RBAC (`requireAdmin`), route-namespaced IP rate limiting (`rateLimiter`), HTTP security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, disabled `X-Powered-By`), and bounded request payloads (`100kb`).
- **Automated Testing (`/test`)**:
  - `npm test` (`tsx test/runTests.ts`): 23-case core suite (`TC-01`–`TC-23`)
  - `npm run test:security` (`tsx test/withdrawalSecurityTests.ts`): 6-case withdrawal concurrency & state-transition suite (`WS-01`–`WS-06`)
  - `npm run test:kpi` (`tsx test/kpiAnalyticsTests.ts`): 6-case KPI accuracy & UTC boundary suite (`KPI-TEST-01`–`KPI-TEST-06`)
  - `npm run test:hardening` (`tsx test/platformHardeningTests.ts`): 6-case referral, payout sandbox provider, DB health & security hardening suite (`PH-01`–`PH-06`)

### Database & Embedded Storage Behavior (MongoDB, Mongoose & `MongoMemoryServer`)

- **MongoDB & Mongoose:** Stores seven collections (`users`, `wallets`, `wallettransactions`, `withdrawals`, `payoutoptions`, `auditlogs`, `referrals`). Mongoose enforces TypeScript-backed schemas, field validation, unique/partial indexes, and atomic single-document `$gte` + `$inc` balance checks in `WalletService`.
- **External vs. Embedded Connection (`connectDB()` in `/server/db.ts`):**
  - Checks `process.env.MONGODB_URL || process.env.MONGODB_URI`.
  - Uses external MongoDB only when non-empty, free of template placeholders (`<db_password>`, `<password>`, `MY_MONGODB_URI`, etc.), and reachable within `5000ms`.
  - Otherwise falls back to `MongoMemoryServer` (`mode: 'embedded'`, `persistent: false`, `dataClassification: 'SIMULATED_SANDBOX_FALLBACK'`).
- **Persistence After Restart:** Data in embedded `MongoMemoryServer` does **not** persist across restarts. Persistent storage requires configuring a reachable external `MONGODB_URI` / `MONGODB_URL` with an Atlas/DB IP allowlist and `JWT_SECRET` in production.

See [`Database_design.md`](./Database_design.md) and [`Wallet_Withdrawal_Security.md`](./Wallet_Withdrawal_Security.md) for schema and security audit details.

---

## 2. Core Features

1. **5 Isolated Reward Currencies**: `ves` (Spendable VEs), `sves` (Staked VEs), `gems`, `tokens`, and `spins`.
2. **Double-Entry Wallet Ledger**: Every credit/debit generates a `WalletTransaction` recording `balanceBefore`, `balanceAfter`, `source`, `referenceId`, `status`, and `description`.
3. **Concurrency-Safe Sandbox Payouts & Refunds**:
   - Withdrawals atomically check `{ userId, ves: { $gte: amount } }` and deduct VEs on submission.
   - Partial unique `{ userId, idempotencyKey }` index + rollback compensation prevents parallel duplicate debits.
   - `SandboxPaymentProvider` validates beneficiaries and generates deterministic `SBX-*` simulated references (zero real money transferred).
   - Admin rejections atomically enforce `PENDING/PROCESSING -> REJECTED` once and issue a single `REFUND` credit reversal.
4. **Referral Tracking & Attribution (Zero Unapproved Payouts)**:
   - Every user has a unique `referralCode` (`VEL-...`); signups can optionally link `referredByUserId`.
   - Blocks self-referrals, duplicate attribution, and invalid codes while keeping automatic VEs payouts at `0` (`PENDING_BUSINESS_RULE`) until VELOOP approves reward rules.
5. **Interactive Admin Analytics & KPI Dashboard**:
   - UTC date range presets (`All Time`, `7D`, `30D`, `90D`, custom dates), currency filter, source filter, live search, referral conversion funnel table, user conflict scanner, and CSV exports.

---

## 3. Setup Instructions

### Prerequisites
- Node.js v20+ and npm

### Installation & Local Development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables (do **not** commit `.env` files):
   - `MONGODB_URI` or `MONGODB_URL` (optional for embedded demo sandbox; required for external persistent MongoDB)
   - `JWT_SECRET` (required `>= 32` characters when `NODE_ENV=production`)
3. Start development server (port 3000):
   ```bash
   npm run dev
   ```
4. Run automated verification suites:
   ```bash
   npm test
   npm run test:security
   npm run test:kpi
   npm run test:hardening
   ```
5. Type-check & production build:
   ```bash
   npm run lint
   npm run build
   ```

### Seeded Sandbox Credentials (Demo Only)
- **Demo User**: `demo@veloop.test` / `Password123!` (Referral Code: `VEL-DEMO01`)
- **Demo Admin**: `admin@veloop.test` / `AdminSecure123!`

---

## 4. Deliverables Index

| Deliverable | Description |
| :--- | :--- |
| `README.md` | Project overview, setup instructions, architecture, and deliverables index |
| `Wallet_Withdrawal_Security.md` | Security audit of wallet integrity, withdrawal state transitions, and hardening controls |
| `TEST_EVIDENCE_REPORT.md` | Genuine automated test execution evidence, PASS/FAIL/NOT_TESTABLE counts, and build/lint results |
| `Database_design.md` | MongoDB schemas, indexes, currency isolation rules, and Conflicting User Records strategy |
| `ER_Relationship_Validation.md` | Entity-Relationship audit (`7` collections), PK/FK checks, and remaining roadmap items |
| `KPI_Validation_Report.md` | Validation audit of all 46 KPIs (`27 Validated`, `12 Needs Business Confirmation`, `7 Not Testable`) |
| `Analytics_Specification.md` | Wallet, Rewards, Withdrawal, and Referral analytics separating simulated vs missing production data |
| `Production_Integration_Roadmap.md` | Phased roadmap from current sandbox to live VELOOP production integration |
