# VELoop Rewards – Wallet Balance Integrity, Transaction Handling & Withdrawal Security Audit

> **Verification Scope:** Every technical claim below was verified directly by inspecting the backend source files (`/server/services/walletService.ts`, `/server/services/payoutService.ts`, `/server/models/Wallet.ts`, `/server/models/WalletTransaction.ts`, `/server/models/Withdrawal.ts`, `/server/models/PayoutOption.ts`, `/server/models/AuditLog.ts`, `/server/routes/walletRoutes.ts`, `/server/routes/withdrawalRoutes.ts`, `/server/routes/adminRoutes.ts`, `/server/routes/authRoutes.ts`, `/server/middleware/auth.ts`, and `/server/middleware/rateLimiter.ts`). Following the initial read-only audit, `/server/services/payoutService.ts` was updated to enforce atomic conditional withdrawal state transitions and single-refund guards, verified by `/test/runTests.ts` and `/test/withdrawalSecurityTests.ts`. Other findings in Section 5 remain unimplemented limitations.

---

## 1. Wallet Balance Integrity

### 1.1 Pre-Mutation Balance & Input Validation
- **Service-Layer Amount Guards (`WalletService.creditWallet` & `WalletService.debitWallet` in `/server/services/walletService.ts`):**
  - Both methods reject non-positive or `NaN` amounts (`if (amount <= 0 || isNaN(amount)) throw new Error(...)`) prior to issuing any database mutation.
  - Note: `Number.isFinite(amount)` is not currently used, so `Infinity` is not blocked at the `isNaN` guard, and `currency` relies on TypeScript typing rather than a runtime allowlist inside `WalletService`.
- **Schema-Level Constraints (`/server/models/Wallet.ts`):**
  - Each wallet is uniquely bound 1:1 to a user (`userId: { type: String, required: true, unique: true, index: true }`).
  - All five isolated currencies (`ves`, `sves`, `gems`, `tokens`, `spins`) enforce `type: Number, required: true, default: 0, min: 0`.
- **Balance Read Helper (`WalletService.validateBalance`):**
  - Exists as a read-only check (`wallet[currency] >= requiredAmount`), while true concurrency protection during debits comes from the atomic query filter in `debitWallet()`.

### 1.2 Insufficient Balance Protection
- **`WalletService.debitWallet()` (`/server/services/walletService.ts`, lines 99–111):**
  - Executes a conditional atomic update:
    ```ts
    Wallet.findOneAndUpdate(
      { userId, [currency]: { $gte: amount } },
      { $inc: { [currency]: -amount } },
      { returnDocument: 'after' }
    )
    ```
  - If the user lacks sufficient balance (or the wallet does not exist), MongoDB matches zero documents and returns `null`. `debitWallet()` then reads the wallet balance only to construct a descriptive `Insufficient <CURRENCY> balance` error and throws without modifying any balance.

### 1.3 Atomic Single-Document MongoDB Updates & Limitations
- **What Is Protected:** MongoDB guarantees atomicity on single-document operations. Concurrent credits (`$inc: { [currency]: amount }`) and concurrent debits (`{ [currency]: { $gte: amount } }` + `$inc: { [currency]: -amount }`) on the same `Wallet` document are serialized at the document level, preventing lost-update anomalies and negative balances from parallel debit requests.
- **Verified Limitations:**
  1. **No Multi-Document ACID Transactions (`ClientSession`):** `WalletService`, `PayoutService`, and route handlers do **not** use `mongoose.startSession()` / `session.withTransaction()`. Multi-collection operations update `Wallet` first and insert `WalletTransaction`, `Withdrawal`, and `AuditLog` sequentially afterwards. If an error or crash occurs after `Wallet.findOneAndUpdate()`, the balance mutation is **not** automatically rolled back.
  2. **Standalone `MongoMemoryServer` Constraint:** In the sandbox fallback (`/server/db.ts`), `MongoMemoryServer` runs as a single standalone `mongod` node rather than a replica set, which does not support MongoDB multi-document transactions without changing deployment topology.
  3. **Wallet Auto-Provision Race (`WalletService.creditWallet`):** Calls `await this.getWallet(userId)` before `findOneAndUpdate`; concurrent first-time calls for a brand-new `userId` without a wallet can race on `Wallet.create()` (mitigated from duplicates by `userId: { unique: true }`, though one call could throw a `11000` duplicate-key error).

---

## 2. Transaction Handling (`WalletTransaction` Ledger)

### 2.1 `balanceBefore` and `balanceAfter` Accounting Records
- **Ledger Creation (`WalletService.creditWallet`, `debitWallet`, `createLedgerEntry` in `/server/services/walletService.ts`):**
  - Immediately after `Wallet.findOneAndUpdate(..., { returnDocument: 'after' })` returns `updatedWallet`:
    - **On Credit:** `balanceAfter = updatedWallet[currency]` and `balanceBefore = balanceAfter - amount`.
    - **On Debit:** `balanceAfter = updatedWallet[currency]` and `balanceBefore = balanceAfter + amount`.
  - `createLedgerEntry()` writes a `WalletTransaction` document (`/server/models/WalletTransaction.ts`) with a unique `transactionId` (`TXN-<timestamp>-<8-char-UUID>`), `currency` (`enum: ['ves', 'sves', 'gems', 'tokens', 'spins']`), `type` (`'CREDIT' | 'DEBIT'`), `amount`, `balanceBefore`, `balanceAfter`, `source`, `referenceId`, `status: 'COMPLETED'`, `description`, and `metadata`.
- **Why Post-Update Snapshots Matter:** Deriving `balanceBefore` from MongoDB's atomic `returnDocument: 'after'` result ensures concurrent requests never record overlapping stale `balanceBefore` snapshots.
- **Limitations:**
  - Sequential write dependency: `createLedgerEntry()` runs outside any database transaction after the `Wallet` update.
  - JavaScript `Number` arithmetic assumes whole/clean precision; non-integer floats would risk IEEE-754 rounding drift.
  - No `referenceType` discriminator accompanies polymorphic `referenceId`.

### 2.2 Reward & Ledger Route Flows (`/server/routes/walletRoutes.ts`)
- **`GET /api/wallet` & `GET /api/wallet/summary`:** Scoped strictly to `req.user!.userId` from the verified JWT.
- **`GET /api/wallet/transactions`:** Scoped to `req.user!.userId` with paginated (`limit` capped at `100` in `WalletService.getTransactions`) filtering by `currency`, `type`, and `source`.
- **`POST /api/wallet/claim-daily`:** Checks for a `DAILY_REWARD` ledger entry in the trailing 24 hours, then calls `creditWallet()` twice sequentially (`+250 ves`, `+1 spins`). *(Race condition gap noted in Section 5.)*
- **`POST /api/wallet/spin`:** Calls `debitWallet()` (`-1 spins`), randomly selects one of 6 prizes (`1/6` uniform weight), and calls `creditWallet()` (`GAME_REWARD`). *(If `creditWallet()` fails after `debitWallet()`, the spin is consumed without a prize credit.)*

---

## 3. Withdrawal Security & Lifecycle

### 3.1 Withdrawal Reservation (`POST /api/withdrawals` -> `PayoutService.requestWithdrawal`)
- **Mapped Code:** `/server/routes/withdrawalRoutes.ts` (lines 9–47) -> `/server/services/payoutService.ts` (lines 83–153) -> `/server/models/Withdrawal.ts`.
- **Flow:**
  1. Enforces `authenticateToken` + in-memory `rateLimiter` (`maxRequests: 5` per `10000ms`), binding ownership to `req.user!.userId` (ignoring any client-supplied `userId`).
  2. Requires `optionId` and `payoutDetails`.
  3. Checks `idempotencyKey` (if provided).
  4. Fetches `PayoutOption.findOne({ optionId })` and verifies existence and `option.active === true`. **Server-authoritative pricing:** `currencyAmount` (`option.requiredAmount`) and `payoutAmount` (`option.payoutValue`) come exclusively from the server-side `PayoutOption` record, never from client request values.
  5. Validates `payoutDetails` format via `PayoutService.validatePayoutDetails()` (checks `@` for UPI; email regex for PayPal, Amazon, and Google Play).
  6. Generates `withdrawalId` (`WTH-<timestamp>-<8-char-UUID>`).
  7. Atomically reserves spendable `'ves'` immediately via `WalletService.debitWallet({ userId, currency: 'ves', amount: option.requiredAmount, source: 'WITHDRAWAL', referenceId: withdrawalId })`.
  8. Inserts `Withdrawal` (`status: 'PENDING'`, `transactionId: debitResult.transaction.transactionId`).
  9. Inserts `AuditLog` (`action: 'WITHDRAWAL_REQUESTED'`).

### 3.2 Approval, Rejection & Refund Flows (`/server/routes/adminRoutes.ts` & `PayoutService`)
- **Approval (`PATCH /api/admin/withdrawals/:id/approve` -> `PayoutService.approveWithdrawal`, lines 156–196):**
  - Protected by `authenticateToken` + `requireAdmin`.
  - Executes a single atomic conditional update:
    ```ts
    Withdrawal.findOneAndUpdate(
      { withdrawalId, status: { $in: ['PENDING', 'PROCESSING'] } },
      { $set: { status: 'APPROVED', processedAt: new Date(), reviewNote: resolvedNote } },
      { returnDocument: 'after' }
    )
    ```
  - Only `PENDING` or `PROCESSING` withdrawals can transition to `APPROVED`. If no document matches, it checks whether the withdrawal does not exist or is already in a terminal state (`APPROVED`, `REJECTED`, `CANCELLED`) and throws an error (returned as HTTP `400` by `adminRoutes.ts`).
  - Writes an `AuditLog` (`WITHDRAWAL_APPROVED`) once the atomic state lock succeeds.
- **Rejection & Automated Single-Refund (`PATCH /api/admin/withdrawals/:id/reject` -> `PayoutService.rejectWithdrawal`, lines 198–274):**
  - Protected by `authenticateToken` + `requireAdmin`; both `adminRoutes.ts` (line 95) and `PayoutService.rejectWithdrawal` (lines 203–206) require a non-empty trimmed `rejectionReason`.
  - Executes a single atomic conditional transition **before** issuing any refund:
    ```ts
    Withdrawal.findOneAndUpdate(
      { withdrawalId, status: { $in: ['PENDING', 'PROCESSING'] } },
      { $set: { status: 'REJECTED', processedAt: new Date(), rejectionReason: trimmedReason } },
      { returnDocument: 'after' }
    )
    ```
  - Because `APPROVED`, `REJECTED`, and `CANCELLED` are excluded from the filter, `APPROVED` withdrawals can never be rejected or refunded, and `REJECTED`/`CANCELLED` withdrawals cannot be processed again.
  - Performs an idempotency/defense-in-depth check (`WalletTransaction.findOne({ userId: withdrawal.userId, referenceId: withdrawalId, source: 'REFUND' })`) before calling `WalletService.creditWallet({ source: 'REFUND', referenceId: withdrawalId })`. If an existing `REFUND` ledger entry is present, it aborts without crediting the wallet.
  - Wraps `WalletService.creditWallet()` in a `try/catch` compensating rollback: if crediting the refund throws an error, the `Withdrawal` status is reverted from `REJECTED` back to `PENDING` (unsetting `processedAt` and `rejectionReason`) before rethrowing.
  - Upon successful refund credit, writes an `AuditLog` (`WITHDRAWAL_REJECTED_REFUNDED`).

### 3.3 Idempotency Key Handling & Limitations
- **Implementation (`PayoutService.requestWithdrawal`, lines 86–95; `/server/models/Withdrawal.ts`, line 50):**
  - Checks `Withdrawal.findOne({ idempotencyKey, userId, createdAt: { $gte: new Date(Date.now() - 60 * 1000) } })`. If matched, returns the original `Withdrawal` without calling `debitWallet()`.
- **Verified Limitations:**
  1. **Optional Field:** Requests omitting `idempotencyKey` have no duplicate-submission protection beyond the IP rate limiter.
  2. **Short 60-Second TTL:** Resubmitting the same key after 60 seconds creates a second withdrawal and debits the wallet again.
  3. **Non-Unique Index + Check-Then-Act Race:** `WithdrawalSchema` has `idempotencyKey: { type: String, index: true }` (not `unique`). Two simultaneous requests with the same `idempotencyKey` can both pass `Withdrawal.findOne()` before either saves the `Withdrawal`, resulting in double deduction.
  4. **No Request-Body Hash Check:** Reusing an `idempotencyKey` within 60s with a different `optionId` or `payoutDetails` silently returns the first withdrawal rather than returning an idempotency mismatch error.

---

## 4. Authentication, JWT & Admin Role Checks

- **JWT Verification & Active-Status Enforcement (`authenticateToken` in `/server/middleware/auth.ts`, lines 11–55):**
  - Extracts `Bearer <token>`, verifies signature with `jwt.verify(token, JWT_SECRET)`, and **queries MongoDB (`User.findOne({ userId: decoded.userId })`) on every request**.
  - Rejects missing/deleted users (`401`) and rejects any account where `user.accountStatus !== 'active'` (`403`), immediately blocking suspended/locked users even if they hold an unexpired JWT.
- **Login & Registration (`/server/routes/authRoutes.ts`):**
  - Normalizes `email` (`trim().toLowerCase()`), hashes passwords with `bcryptjs` (salt rounds `10`), checks `accountStatus !== 'active'` (`403`) on login, signs 7-day JWTs, and applies `rateLimiter` (`20/min` on register, `30/min` on login).
- **Admin RBAC (`requireAdmin` in `/server/middleware/auth.ts`, lines 57–70):**
  - `/server/routes/adminRoutes.ts` (lines 14–15) applies `router.use(authenticateToken)` and `router.use(requireAdmin)` globally to all `/api/admin/*` endpoints.
  - `/server/routes/walletRoutes.ts` attaches `authenticateToken, requireAdmin` explicitly to `POST /api/wallet/credit` and `POST /api/wallet/debit`.
  - `/server/routes/withdrawalRoutes.ts` (`GET /api/withdrawals/:id`, line 95) restricts individual withdrawal lookup to the owner (`withdrawal.userId === req.user!.userId`) or `role === 'admin'`.

---

## 5. Verified Race Conditions, Missing Transactions & Security Gaps

1. **[RESOLVED for State Transitions] Double-Refund & Concurrent State-Transition Race in Admin Approval/Rejection (`PayoutService.approveWithdrawal` & `rejectWithdrawal`):**
   - *Previous Vulnerability:* `rejectWithdrawal()` omitted `'APPROVED'` from its status guard, credited the user's wallet before persisting `status = 'REJECTED'`, and both methods used non-atomic `findOne()` followed by `.save()`.
   - *Implemented Fix (`/server/services/payoutService.ts`):* Replaced read-modify-write with atomic conditional `Withdrawal.findOneAndUpdate({ withdrawalId, status: { $in: ['PENDING', 'PROCESSING'] } }, ...)` state claims prior to issuing a `REFUND` credit, plus a pre-credit `WalletTransaction.findOne({ ..., source: 'REFUND' })` check and compensating revert on `creditWallet()` failure.
   - *Remaining Limitation:* Because sandbox `MongoMemoryServer` runs as a standalone node without multi-document `ClientSession` transactions, claiming `Withdrawal` (`REJECTED`), crediting `Wallet`, inserting the `REFUND` `WalletTransaction`, and writing `AuditLog` remain separate database operations. If the Node process crashes *after* `creditWallet()` succeeds and *before* `AuditLog.create()` finishes, the `Withdrawal` stays `REJECTED` and the refund is applied cleanly, though the audit record would be absent; similarly, if `creditWallet()` itself fails on a withdrawal that was originally `'PROCESSING'`, the compensating rollback resets `status` to `'PENDING'`.

2. **Missing Multi-Document Transactions Across Wallet + Ledger/Withdrawal Writes:**
   - Because `WalletService` and `PayoutService` do not use Mongoose `startSession()` / `withTransaction()`, a failure between `Wallet.findOneAndUpdate()` and `WalletTransaction.create()` / `Withdrawal.create()` can desynchronize wallet balances from the ledger or omit a `Withdrawal` document after funds were debited.

3. **Concurrent Double-Claim Race on `POST /api/wallet/claim-daily` (`/server/routes/walletRoutes.ts`, lines 112–149):**
   - Queries `WalletTransaction.findOne({ userId, source: 'DAILY_REWARD', createdAt: ... })` and then credits `+250 ves` and `+1 spin`. Parallel requests submitted simultaneously can both pass the `findOne` cooldown check before either writes the `DAILY_REWARD` transaction, granting multiple daily payouts.

4. **Concurrent Idempotency Race on `POST /api/withdrawals` (`PayoutService.requestWithdrawal`, lines 86–95):**
   - Because `idempotencyKey` is checked with `findOne()` rather than enforced via a unique index, simultaneous requests with the same key can both pass and double-debit.

5. **Hardcoded Fallback `JWT_SECRET` (`/server/middleware/auth.ts`, line 5):**
   - `export const JWT_SECRET = process.env.JWT_SECRET || 'veloop-production-grade-jwt-secret-key-9988'`. If `JWT_SECRET` is omitted from environment secrets in deployment, an attacker can forge valid admin JWTs. No startup check fails fast when `NODE_ENV === 'production'` and `JWT_SECRET` is unset.

6. **Duplicate Admin Credit/Debit Endpoints Bypassing Audit Trail (`POST /api/wallet/credit` & `/debit` vs `/api/admin/wallet/credit` & `/debit`):**
   - `/server/routes/walletRoutes.ts` exposes admin-only `POST /api/wallet/credit` (line 197) and `POST /api/wallet/debit` (line 224) which call `WalletService` **without** verifying `User.exists()` or creating an `AuditLog` record, whereas `/server/routes/adminRoutes.ts` creates `AuditLog` entries (`ADMIN_WALLET_CREDIT`, `ADMIN_WALLET_DEBIT`) and validates user existence. Neither pair enforces runtime `currency` enum checks before `WalletService` or `Number.isFinite(amount)`.

7. **Per-Process In-Memory Rate Limiter (`/server/middleware/rateLimiter.ts`):**
   - `ipRequestMap` stores counters only in local Node memory without periodic expired-key cleanup (unbounded memory growth under traffic/spoofed headers), falls back to `req.headers['x-forwarded-for']`, and does not enforce limits across horizontally scaled server instances.

8. **Unbounded Query Limits & Weak Withdrawal Lookup (`/server/routes/adminRoutes.ts`, `withdrawalRoutes.ts`):**
   - `GET /api/admin/analytics` runs unbounded `.find({}).lean()` across all `User`, `Wallet`, `WalletTransaction`, and `Withdrawal` collections in memory (performance/OOM risk at production scale).
   - `Withdrawal.currency` stores `'ves'` without persisting `payoutCurrency` (`INR`/`USD`), relying on `PayoutOption` joins/metadata.

9. **Session Duration & Missing Auth Hardening:**
   - JWT `expiresIn: '7d'` has no token revocation/blocklist (other than changing `accountStatus` to `'suspended'`), no refresh-token rotation, and no admin MFA enforcement.

---

## 6. Source File Reference Map

| Mechanism / Area | Verified File & Symbol |
| :--- | :--- |
| Atomic balance updates, `$gte` debit guard, `before`/`after` snapshots | `/server/services/walletService.ts` (`WalletService.creditWallet`, `debitWallet`, `createLedgerEntry`) |
| Wallet currency fields & `min: 0` schema rules | `/server/models/Wallet.ts` (`WalletSchema`) |
| Ledger transaction fields, enums, `{userId, createdAt}` index | `/server/models/WalletTransaction.ts` (`WalletTransactionSchema`) |
| Withdrawal reservation, idempotency, approve, reject/refund | `/server/services/payoutService.ts` (`PayoutService.requestWithdrawal`, `approveWithdrawal`, `rejectWithdrawal`, `validatePayoutDetails`) |
| Withdrawal & PayoutOption schemas | `/server/models/Withdrawal.ts`, `/server/models/PayoutOption.ts` |
| Daily claim cooldown, Fortune Wheel, user ledger, admin credit/debit | `/server/routes/walletRoutes.ts` |
| Withdrawal creation & user-scoped withdrawal history | `/server/routes/withdrawalRoutes.ts` |
| Admin approvals, rejections, audited adjustments, analytics, user-conflicts | `/server/routes/adminRoutes.ts` |
| JWT verification, DB active-user re-check, `requireAdmin`, fallback secret | `/server/middleware/auth.ts` (`authenticateToken`, `requireAdmin`, `JWT_SECRET`) |
| In-memory sliding-window rate limiter | `/server/middleware/rateLimiter.ts` (`rateLimiter`) |
| Registration, login, bcrypt hashing, email normalization | `/server/routes/authRoutes.ts` |
| Core 23-case regression & withdrawal workflow suite | `/test/runTests.ts` (`npm test`) |
| Withdrawal state-transition & concurrency security suite | `/test/withdrawalSecurityTests.ts` (`npm run test:security`) |

---

## 7. Implemented Fix & Automated Test Verification

### 7.1 Regression Verification (`npm test`)
Executed `npm test` (`tsx test/runTests.ts`) against the updated `PayoutService`:
- **Existing Withdrawal & Admin Cases (`TC-14`, `TC-15`, `TC-16`, `TC-17`):** All passed (`PASS`).
- **Suite Summary:** `23 Total` | `21 PASS` | `0 FAIL` | `2 NOT_TESTABLE` (`TC-19` Referral invite conversion rate missing schema; `TC-23` Live external MongoDB Atlas connection unavailable in standalone sandbox container).

### 7.2 Withdrawal State-Transition & Concurrency Suite (`npm run test:security`)
Executed `npm run test:security` (`tsx test/withdrawalSecurityTests.ts`), running live HTTP `PATCH /api/admin/withdrawals/:id/approve` and `PATCH /api/admin/withdrawals/:id/reject` requests and inspecting `Withdrawal`, `Wallet`, `WalletTransaction`, and `AuditLog` documents:

| Test ID | Scenario Verified | Result | Verified Outcome |
| :--- | :--- | :--- | :--- |
| **WS-01** | Approve `PENDING` withdrawal -> attempt `reject` and repeat `approve` | `PASS` | Approval succeeded (`200`); subsequent `reject` and duplicate `approve` blocked (`400`); wallet remained at `1000 VEs` with `0` `REFUND` ledger entries. |
| **WS-02** | Reject `PENDING` withdrawal -> attempt repeat `reject` and subsequent `approve` | `PASS` | First reject refunded once (`1000 -> 4000 VEs`) with `1` valid `REFUND` ledger entry; repeat `reject` and post-reject `approve` blocked (`400`); no double refund. |
| **WS-03** | Attempt `approve` and `reject` on a `CANCELLED` withdrawal | `PASS` | Both blocked (`400`); status remained `CANCELLED`; wallet unchanged (`1000 VEs`); `0` `REFUND` entries. |
| **WS-04** | Concurrent `approve` + `reject` race (`Promise.all`, 3 trials) | `PASS` | Strictly `1` returned `200` and `1` returned `400` in all 3 trials; `AuditLog` count = `1`; zero conflicting refunds. |
| **WS-05** | Concurrent double-rejection race (`Promise.all`, 3 trials) | `PASS` | Strictly `1` returned `200` and `1` returned `400` in all 3 trials; `1` `REFUND` transaction; `1` `AuditLog`; balance refunded strictly once (`4000 VEs`). |
| **WS-06** | Concurrent double-approval & `PROCESSING` transition | `PASS` | `PROCESSING` withdrawal approved once (`200`), duplicate blocked (`400`), `AuditLog` count = `1`. |

- **Security Suite Summary:** `TOTAL: 6 | PASS: 6 | FAIL: 0`.

