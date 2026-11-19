# VELoop Rewards – Test Cases Specification (23 Automated Cases)

**Test Runner:** `tsx test/runTests.ts` (`npm test`)  
**Target Stack:** Express HTTP API (`createApp()`) + Mongoose + MongoDB (`MongoMemoryServer` fallback when external Atlas URI is unavailable)

---

## Test Suite Matrix

| Test ID | Category | Test Case Description | Preconditions | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Authentication | Register a new user via `POST /api/auth/register` and provision initial 5-currency wallet | Unique email not in `users` | HTTP 201, valid JWT returned, User created with `role='user'`, Wallet created with `(1000 ves, 0 sves, 10 gems, 50 tokens, 2 spins)` |
| **TC-02** | Authentication | Reject duplicate email registration via `POST /api/auth/register` | `demo@veloop.test` exists in `users` | HTTP 409 Conflict returned; duplicate record not created |
| **TC-03** | Authentication | Authenticate seeded admin and reject wrong password via `POST /api/auth/login` | Seeded admin account exists | Wrong password -> HTTP 401; valid admin credentials -> HTTP 200 with JWT and `role='admin'` |
| **TC-04** | Authentication | Block login for suspended user account | User exists with `accountStatus='suspended'` | HTTP 403 Forbidden returned; no JWT issued |
| **TC-05** | Authentication & RBAC | Enforce JWT verification and prevent regular users from accessing `/api/admin/users` | Authenticated `user` JWT and invalid JWT | Missing/tampered JWT -> HTTP 401; `user` role calling `/api/admin/users` -> HTTP 403 |
| **TC-06** | User Records | Normalize mixed-case/whitespace email and execute non-destructive duplicate audit via `GET /api/admin/user-conflicts` | Admin JWT; sample user created with uppercase/padded email | Email stored lowercase trimmed; conflict scanner returns `auditSummary` cleanly without mutating user rows |
| **TC-07** | Wallet Balances | Verify multi-currency isolation across `ves`, `sves`, `gems`, `tokens`, `spins` | User wallet exists | Crediting `+15 gems` updates only `gems`; `ves`, `sves`, `tokens`, `spins` remain unchanged |
| **TC-08** | Wallet Balances | Reject negative or zero credit and debit mutations in `WalletService` | User wallet exists with `500 ves` | Negative credit throws error; zero debit throws error; balance stays `500 ves` |
| **TC-09** | Rewards | Claim daily reward via `POST /api/wallet/claim-daily` | User has not claimed in last 24h | HTTP 200; `+250 ves` and `+1 spin` credited with matching `DAILY_REWARD` ledger rows |
| **TC-10** | Rewards | Enforce 24-hour cooldown on repeated `POST /api/wallet/claim-daily` | User claimed daily reward in `TC-09` | HTTP 400 returned with remaining cooldown duration; wallet not double-credited |
| **TC-11** | Rewards | Spin Fortune Wheel via `POST /api/wallet/spin` | User has `spins >= 1` | HTTP 200; `spins` decremented by 1 and valid prize credited atomically |
| **TC-12** | Transactions | Verify double-entry `balanceBefore` and `balanceAfter` arithmetic integrity | Multiple credit/debit ledger entries exist | Every `CREDIT` satisfies `balanceAfter === balanceBefore + amount`; every `DEBIT` satisfies `balanceAfter === balanceBefore - amount` |
| **TC-13** | Transactions | Filter and paginate transactions via `GET /api/wallet/transactions` | Transactions exist across currencies/types | HTTP 200 returning only items matching `currency=ves&type=CREDIT` with accurate pagination metadata |
| **TC-14** | Withdrawals | Atomically reserve VEs on valid withdrawal and reject insufficient balance | Wallet has `5000 ves`; `OPT-UPI-250` requires `3000 ves` | First withdrawal succeeds (`PENDING`, balance `2000 ves`); second withdrawal (`3000 ves` needed) fails without negative balance |
| **TC-15** | Withdrawals | Deduplicate identical `idempotencyKey` submissions within 60s window | Wallet has `6000 ves` | Two requests sharing `idempotencyKey` return same `withdrawalId` and deduct `3000 ves` only once |
| **TC-16** | Withdrawals & Admin | Approve pending withdrawal via `PATCH /api/admin/withdrawals/:id/approve` | Pending withdrawal exists; Admin JWT | HTTP 200; status updates to `APPROVED`, `processedAt` set, `reviewNote` persisted, `AuditLog` recorded |
| **TC-17** | Withdrawals & Admin | Reject pending withdrawal via `PATCH /api/admin/withdrawals/:id/reject` with automatic refund | Pending withdrawal (`3000 ves` from `4000 ves`); Admin JWT | HTTP 200; status updates to `REJECTED`, `4000 ves` restored, `REFUND` credit ledger entry created |
| **TC-18** | Referrals | Record `REFERRAL` reward credit and reflect totals in `GET /api/admin/analytics` | Seeded + new `REFERRAL` credit transactions | Analytics returns aggregated `totalReferralVesAwarded >= 6500` and transaction count |
| **TC-19** | Referrals | Compute Referral Invite-to-Signup Conversion Rate KPI | Current schema inspection | **NOT TESTABLE**: Requires external/missing `Referral` invite tracking table (`inviteSentAt`, `refereeId`, `convertedAt`) |
| **TC-20** | KPIs & Analytics | Verify `GET /api/admin/analytics` aggregations and simulated vs production separation flag | Admin JWT; seeded ledger & withdrawals | HTTP 200 with KPIs, withdrawal stats, daily trends, source breakdown, and `dataOrigin.productionDataConnected === false` |
| **TC-21** | Database & ER | Validate ER referential integrity across `User`, `Wallet`, `WalletTransaction`, `Withdrawal`, `PayoutOption` | Seeded demo records exist | All child foreign identifiers (`userId`, `optionId`) resolve to valid parent documents |
| **TC-22** | Database & ER | Verify admin manual adjustment via `POST /api/admin/wallet/credit` writes immutable `AuditLog` | Admin JWT; target user exists | HTTP 200; target wallet balance updated; `AuditLog` created with `action='ADMIN_WALLET_CREDIT'` |
| **TC-23** | Production Integration | Verify live connection to external VELOOP production MongoDB Atlas cluster | `MONGODB_URL` / `MONGODB_URI` configured and whitelisted | **NOT TESTABLE** in isolated sandbox unless external Atlas URI is provided and IP-whitelisted (connects via embedded fallback) |
