# VELoop Rewards – ER Relationship Validation Report

> **Important Scope & Implementation Notice:** MongoDB/Mongoose does **not** enforce relational database-level foreign key (`FOREIGN KEY`) constraints. Every validated relationship below is **application-enforced** in Express/TypeScript services and Mongoose schema validation, rather than enforced by database-level foreign key constraints. Any proposed schema changes in Section 4 are **recommendations only** and have **not yet been implemented or production-verified**.

---

## 1. Existing Entities & Keys Inspection

The current Mongoose persistence layer (`/server/models/*.ts`) consists of **7 collections**:

| Collection / Model | Primary / Business Key | Application-Level References (No DB-Level FK Constraints) | Indexes Defined |
| :--- | :--- | :--- | :--- |
| `User` | `_id` (ObjectId), `userId` (Unique String) | Optional `referredByUserId` -> `User.userId` | `userId` (unique), `email` (unique), `role`, `referralCode` (unique sparse), `referredByUserId` |
| `Wallet` | `_id` (ObjectId), `userId` (Unique String) | `userId` -> `User.userId` (String match) | `userId` (unique) |
| `WalletTransaction` | `_id` (ObjectId), `transactionId` (Unique String) | `userId` -> `User.userId`; `referenceId` -> polymorphic string (`Withdrawal.withdrawalId`, etc.) | `transactionId` (unique), `userId`, `{userId:1, createdAt:-1}`, `currency`, `source`, `status` |
| `Withdrawal` | `_id` (ObjectId), `withdrawalId` (Unique String) | `userId` -> `User.userId`; `optionId` -> `PayoutOption.optionId`; `transactionId` -> `WalletTransaction.transactionId` | `withdrawalId` (unique), `userId`, `status`, `idempotencyKey`, `{userId:1, requestedAt:-1}`, `{userId:1, idempotencyKey:1}` (partial unique) |
| `PayoutOption` | `_id` (ObjectId), `optionId` (Unique String) | None (`methodId` groups options) | `optionId` (unique), `methodId`, `type`, `active` |
| `AuditLog` | `_id` (ObjectId) | `actorId` -> `User.userId`; `targetUserId` -> `User.userId`; `referenceId` -> polymorphic string | `actorId`, `action`, `targetUserId`, `createdAt` |
| `Referral` | `_id` (ObjectId), `referralId` (Unique String) | `referrerUserId` -> `User.userId`; `refereeUserId` -> `User.userId` (sparse) | `referralId` (unique), `referrerUserId`, `referralCode`, `refereeUserId` (partial unique), `refereeEmail` (partial unique on converted statuses), `{referrerUserId:1, refereeEmail:1}` (unique) |

---

## 2. Entity-Relationship Validation Matrix

Status classifications used below:
- **Validated (application-enforced):** Verified in automated tests (`TC-12`, `TC-14`, `TC-17`, `TC-21`, `TC-22`) and enforced in Express routes/services (`auth.ts`, `WalletService`, `PayoutService`); not backed by MongoDB database-level foreign key constraints.
- **Partial / Weak:** Partially validated at creation time in application code, but lacks immutability snapshots, soft-delete safeguards, or structural integrity protection across lifecycle mutations.
- **Missing / Untestable:** Required entity or reference field does not exist in the current Mongoose models.
- **External integration not testable in sandbox:** Depends on external systems or live production credentials unavailable inside the sandbox container.

| Relationship | Cardinality | Implementation Mechanism | Integrity Status | Verification Evidence / Findings |
| :--- | :---: | :--- | :---: | :--- |
| **ER-01:** `User` ↔ `Wallet` | **1 : 1** | String join on `Wallet.userId === User.userId` (`unique: true` on both) | **Validated (application-enforced)** | Verified in `TC-21` & `/api/admin/user-conflicts`. Admin accounts do not require a wallet by design; regular users receive one at `/register` or `WalletService.getWallet()`. No database-level FK constraint exists. |
| **ER-02:** `User` → `WalletTransaction` | **1 : N** | String reference `WalletTransaction.userId` | **Validated (application-enforced)** | Verified in `TC-12` & `TC-21`. Indexed on `{ userId: 1, createdAt: -1 }`. No DB-level foreign key constraint exists in MongoDB; ownership and existence are enforced via `auth.ts` & `WalletService`. |
| **ER-03:** `User` → `Withdrawal` | **1 : N** | String reference `Withdrawal.userId` | **Validated (application-enforced)** | Verified in `TC-14`, `TC-21`. Ownership strictly verified using verified JWT `req.user.userId` on `/api/withdrawals`. No DB-level foreign key constraint exists. |
| **ER-04:** `Withdrawal` → `PayoutOption` | **N : 1** | `Withdrawal.optionId` matches `PayoutOption.optionId`; `Withdrawal.payoutCurrency` snapshots `PayoutOption.currency` | **Validated (application-enforced)** | `PayoutService.requestWithdrawal()` validates existence/`active` state and snapshots `payoutCurrency` (`INR`/`USD`) + `providerMode: 'SANDBOX_SIMULATED'` on `Withdrawal`. Soft-delete guard against hard-deleting referenced `PayoutOption` rows remains recommended. |
| **ER-05:** `Withdrawal` ↔ `WalletTransaction` | **1 : 1 (Debit) + 0..1 (Refund)** | `Withdrawal.transactionId` & `WalletTransaction.referenceId` | **Validated (application-enforced)** | Verified in `TC-17` & `WS-01`–`WS-06`. Debit reservation sets `Withdrawal.transactionId`; rejection refund sets `WalletTransaction.referenceId = withdrawalId`. |
| **ER-06:** `User` → `AuditLog` (`actorId`, `targetUserId`) | **1 : N** | String IDs `actorId`, `targetUserId` | **Validated (application-enforced)** | Verified in `TC-22`. `AuditLog.referenceId` remains polymorphic without a `referenceType` discriminator field. |
| **ER-07:** `User` → `Referral` (Referrer ↔ Referee) | **1 : N** | `Referral.{referrerUserId, refereeUserId}` & `User.referredByUserId` | **Validated (application-enforced)** | Implemented via `/server/models/Referral.ts` and `ReferralService`. Unique referral codes (`User.referralCode`), self-referral blocks, and partial unique indexes prevent duplicate attribution (`TC-19`, `PH-01`–`PH-03`). Automated reward payouts remain disabled (`0 VEs`, `PENDING_BUSINESS_RULE`) pending stakeholder confirmation. |
| **ER-08:** `WalletTransaction` → `AdNetwork` / `GameSession` / `PayoutGateway` | **N : 1 (External)** | `source` enum + `metadata` | **External integration not testable in sandbox** | External third-party ad-mediation webhooks, game servers, and live UPI/PayPal gateway settlement callbacks are outside the sandbox runtime (`TC-23`). Payout approvals execute `SandboxPaymentProvider` (`SBX-*` simulated references). |

---

## 3. Root Causes & Resolved Items

1. **No Native Relational Foreign Keys in MongoDB**: Relationships rely on string matching (`userId`, `optionId`, `transactionId`, `referrerUserId`, `refereeUserId`) validated at the application layer rather than MongoDB DB-level foreign key constraints.
2. **Referral Tracking (`ER-07` — Implemented in Sandbox):** Resolved by adding `/server/models/Referral.ts`, `User.referralCode`, `User.referredByUserId`, and `ReferralService` with uniqueness/self-referral protections and `PENDING_BUSINESS_RULE` payout lock.
3. **Payout Currency Snapshot (`ER-04` — Implemented):** Resolved by adding `Withdrawal.payoutCurrency` populated from `PayoutOption.currency` during withdrawal creation (`PH-04`).
4. **Remaining Recommendations (`Not Yet Implemented`):**
   - Polymorphic `referenceType` discriminators on `WalletTransaction` and `AuditLog`.
   - Automated soft-delete (`active = false`) enforcement blocking hard deletes on `PayoutOption` rows referenced by historical withdrawals.
   - Pre-analytics orphan-detection gate blocking dirty external data ingestion before production cutover.

---

## 4. Remaining Resolution Roadmap (Open Items)

| Priority | Action Item | Proposed Implementation Details | Target Entities | Status |
| :---: | :--- | :--- | :--- | :---: |
| **P0** | Snapshot `payoutCurrency` on `Withdrawal` | `Withdrawal.payoutCurrency` populated in `PayoutService.requestWithdrawal()` + seed data. | `Withdrawal`, `PayoutOption` | **Implemented in Sandbox** |
| **P1** | Add `Referral` model & attribution | `/server/models/Referral.ts`, `User.referralCode`, `User.referredByUserId`, `ReferralService`. | `Referral`, `User` | **Implemented in Sandbox (`0 VEs` rule pending)** |
| **P1** | Pre-analytics referential integrity gate | Automated check for orphan/invalid string references before production analytics refresh (extends existing `GET /api/admin/user-conflicts`). | All collections | **Open Recommendation** |
| **P2** | Add `referenceType` discriminators | Add deterministic target type enums alongside `referenceId` on `WalletTransaction` and `AuditLog`. | `WalletTransaction`, `AuditLog` | **Open Recommendation** |
| **P2** | Enforce `PayoutOption` soft-delete (`active = false`) | Block hard `deleteOne` when `Withdrawal.exists({ optionId })` is true. | `PayoutOption`, `Withdrawal` | **Open Recommendation** |

