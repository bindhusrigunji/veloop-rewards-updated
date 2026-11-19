# VELoop Rewards – Database Design, MongoDB Architecture & Conflicting User Records Strategy

> **Scope Note:** All technical statements in this document are verified directly against `/server/db.ts`, `/server.ts`, `/server/models/*.ts`, `/server/services/*.ts`, `/server/seed/seedData.ts`, and `/server/routes/adminRoutes.ts`. Embedded sandbox storage is active by default when an external Atlas cluster is not connected; live production integration is **not** yet active.

---

## 1. MongoDB, Mongoose & Embedded Database Architecture

### 1.1 What MongoDB Is
MongoDB is a **NoSQL, document-oriented database** that stores application records as flexible BSON/JSON-like documents grouped into collections rather than rigid SQL tables with database-enforced foreign keys. In VELoop Rewards, MongoDB stores six core collections: `users`, `wallets`, `wallettransactions`, `withdrawals`, `payoutoptions`, and `auditlogs`.

### 1.2 What Mongoose Does in This Project
The backend uses **Mongoose (`^9.12.1`)** as its Object Data Modeling (ODM) layer between Express/TypeScript services and MongoDB:
- **Schema & Data Validation (`/server/models/*.ts`):** Enforces field types, required attributes, enum values (e.g., `role`, `accountStatus`, `currency`, `type`, `status`), numeric lower bounds (`min: 0`, `min: 1`), string normalization (`email: { lowercase: true, trim: true }`), and automatic lifecycle timestamps (`createdAt`, `updatedAt`).
- **Indexing:** Defines unique indexes on business keys (`userId`, `email`, `transactionId`, `withdrawalId`, `optionId`) and compound query indexes (`{ userId: 1, createdAt: -1 }` on transactions; `{ userId: 1, requestedAt: -1 }` on withdrawals).
- **Atomic Single-Document Operations (`/server/services/walletService.ts`):** Uses `Wallet.findOneAndUpdate({ userId, [currency]: { $gte: amount } }, { $inc: { [currency]: -amount } }, { returnDocument: 'after' })` so balance sufficiency checks and balance deductions occur atomically on a single `Wallet` document.

### 1.3 How `MongoMemoryServer` Is Used
The project includes **`mongodb-memory-server` (`^11.3.0`)** in `/server/db.ts` to run an embedded, in-memory `mongod` engine (`dbName: 'veloop_rewards'`) inside the Node.js runtime:
- **Zero-Setup Sandbox Runtime:** Allows the full Express + Mongoose + React stack to boot immediately for internship evaluation and local development even without external MongoDB credentials or network access.
- **Demo Seeding (`/server/seed/seedData.ts`):** After `connectDB()` establishes a connection, `server.ts` calls `seedInitialData()`. When `User.countDocuments() === 0`, it seeds demo users (`demo@veloop.test`, `admin@veloop.test`), starter wallet balances, 10 ledger transactions, 1 historical approved withdrawal, 11 payout options, and 1 system bootstrap `AuditLog`.
- **Automated Testing (`/test/runTests.ts`):** The 23-case automated test suite (`npm test`) runs directly against `MongoMemoryServer` via `connectDB()` for fast, isolated, reproducible verification.

### 1.4 When the Application Uses an External MongoDB Connection
In `/server/db.ts` (`connectDB()`), the server inspects `process.env.MONGODB_URL || process.env.MONGODB_URI` (prioritizing `MONGODB_URL` if both are set). It attempts an external MongoDB / Atlas connection **only** when all three conditions hold:
1. `MONGODB_URL` or `MONGODB_URI` is present and non-empty after trimming.
2. The URI does **not** contain template/sample placeholders (`<db_password>`, `<password>`, `MY_MONGODB_URI`, `MY_MONGODB_URL`, or `user:password@cluster0`).
3. The external cluster responds within `serverSelectionTimeoutMS: 5000` and `connectTimeoutMS: 5000` (valid credentials + Atlas Network Access IP allowlist permission).

When successful, `mongoose.connect()` attaches to the external cluster, `dbStatus.mode` becomes `'atlas'` (`connected: true`), passwords are masked in `uriMasked` (`:****@`), and any previously running `MongoMemoryServer` instance is stopped.

### 1.5 What Happens When the External Connection Is Unavailable
When an external Atlas connection cannot be established, `connectDB()` in `/server/db.ts` handles the failure gracefully without crashing the application:
1. **Unconfigured / Sample URI:** Directly skips Atlas and starts `MongoMemoryServer`.
2. **Template Password Placeholder (`<db_password>` / `<password>`):** Logs a notice, stores a diagnostic message in `dbStatus.error` and `dbStatus.whitelistNotice`, and starts `MongoMemoryServer`.
3. **Network, Whitelist, or Auth Failure (e.g., `MongooseServerSelectionError`):** Catches the connection error after the 5-second timeout, logs `ATLAS ERROR DIAGNOSTIC` (without exposing credentials), calls `mongoose.disconnect()` to clean up failed connection state, records the diagnostic error in `dbStatus`, and starts/connects to `MongoMemoryServer` (`mode: 'embedded'`, `connected: true`).

Administrators can inspect the current database mode and diagnostic notices via `GET /api/admin/db-status` or manually retry connecting via `POST /api/admin/db-reconnect` (`/server/routes/adminRoutes.ts`).

### 1.6 Persistence Behavior After Server Restarts
- **Embedded `MongoMemoryServer` Mode:** **Data does NOT persist after the server stops or restarts.** In `/server/db.ts`, `MongoMemoryServer.create({ instance: { dbName: 'veloop_rewards' } })` runs in ephemeral temporary/memory storage with no persistent `dbPath`, and `closeDB()` stops the instance. On every restart, runtime user registrations, reward claims, wheel spins, withdrawals, and admin edits created in embedded mode are wiped, and `seedInitialData()` re-seeds the initial baseline demo dataset because `User.countDocuments() === 0`.
- **External MongoDB Atlas Mode:** Data persists normally on Atlas disk storage across application restarts, provided a valid, IP-whitelisted external cluster is connected.

### 1.7 Current Demo Environment vs. Planned Production Database

| Aspect | Current Demo / Sandbox Environment (Implemented) | Planned Production Database (Not Yet Implemented) |
| :--- | :--- | :--- |
| **Database Engine** | Embedded `MongoMemoryServer` standalone process (`dbName: 'veloop_rewards'`) | Managed **MongoDB Atlas** Replica Set (M10+ with TLS & VPC peering) |
| **Persistence** | **Ephemeral** (lost on every server restart; re-seeded on boot) | Persistent replicated SSD storage + automated point-in-time backups |
| **Data Origin** | Simulated demo records (`demo@veloop.test`, `SIMULATED_DEMO`) | Live VELOOP user, reward, and settlement records (`dataOrigin: 'production'`) |
| **Connection Trigger** | Automatic fallback when `MONGODB_URL`/`MONGODB_URI` is unset or unreachable | Secret Manager-injected `MONGODB_URI` with strict IP/VPC allowlist |
| **Payout & Partner Feeds** | Simulated withdrawal approval/rejection and manual/demo credits | Live UPI/PayPal payout gateway APIs + Ad Mediation & Game Server webhooks |

### 1.8 Actual Limitations of the Current Implementation
1. **No Persistence in Embedded Mode:** Any changes made while running in `MongoMemoryServer` vanish on server restart or container recycle.
2. **No Multi-Document ACID Transactions (`ClientSession`):** `WalletService`, `PayoutService`, and `authRoutes` perform multi-collection writes sequentially (e.g., updating `Wallet` via `$inc`, then inserting `WalletTransaction`, `Withdrawal`, and `AuditLog`) without Mongoose `startSession()` / `withTransaction()`. Single-document balance updates are atomic, but a failure between steps could leave a wallet mutation without its matching ledger or withdrawal row; additionally, standalone single-node `MongoMemoryServer` does not run as a replica set.
3. **Application-Enforced Relationships Only:** MongoDB does not enforce relational `FOREIGN KEY` constraints. Cross-collection references (`userId`, `optionId`, `transactionId`) rely on service-layer checks rather than database constraints or cascade protections, and `Withdrawal.currency` currently stores `'ves'` instead of snapshotting fiat `payoutCurrency` (`INR`/`USD`).
4. **Auto-Seeding on Any Empty Database (`server.ts`):** `seedInitialData()` checks only `User.countDocuments() === 0`—without verifying `mode === 'embedded'`—so pointing the app at a brand-new empty Atlas database would automatically insert demo accounts (`demo@veloop.test`, `admin@veloop.test`) unless explicitly disabled or pre-populated.
5. **No Data Migration on `POST /api/admin/db-reconnect`:** Reconnecting to Atlas at runtime stops `MongoMemoryServer` (`mongoMemoryServer.stop()`), discarding any records created during the prior in-memory session rather than migrating them.
6. **Atlas Reachability in Sandbox Containers:** Cloud sandbox environments without static outbound IP allowlisting in MongoDB Atlas fail server selection (`MongooseServerSelectionError`) and fall back to embedded mode (`TC-23` remains `NOT_TESTABLE`).
7. **Missing Production Schemas:** `Referral`, `SessionLogs`, `TaskEvents`, `FeatureEvents`, and `AdRevenue` collections do not exist yet, and polymorphic `referenceId` fields in `WalletTransaction` and `AuditLog` lack a `referenceType` discriminator.

---

## 2. MongoDB Collections & Schema Architecture

### 2.1 `users` (`User` Model)
| Field | Type | Constraints & Indexes | Purpose |
| :--- | :--- | :--- | :--- |
| `userId` | `String` | `required`, `unique`, `index` | Canonical application user identifier (`USR-...` / `ADM-...`) |
| `name` | `String` | `required`, `trim: true` | Display name |
| `email` | `String` | `required`, `unique`, `lowercase: true`, `trim: true`, `index` | Normalized primary login email |
| `passwordHash` | `String` | `required` | Bcrypt (cost factor 10) salted password hash |
| `role` | `String` | `enum: ['user', 'admin']`, `default: 'user'`, `index` | Authorization role |
| `accountStatus` | `String` | `enum: ['active', 'suspended', 'locked']`, `default: 'active'` | Account access state |
| `createdAt` / `updatedAt` | `Date` | Mongoose `timestamps: true` | Record lifecycle timestamps |

### 2.2 `wallets` (`Wallet` Model)
| Field | Type | Constraints & Indexes | Purpose |
| :--- | :--- | :--- | :--- |
| `userId` | `String` | `required`, `unique`, `index` | 1:1 owner link to `users.userId` |
| `ves` | `Number` | `required`, `default: 0`, `min: 0` | Spendable reward currency (redeemable for payouts) |
| `sves` | `Number` | `required`, `default: 0`, `min: 0` | Staked VEs (locked yield tier) |
| `gems` | `Number` | `required`, `default: 0`, `min: 0` | Prestige tier currency |
| `tokens` | `Number` | `required`, `default: 0`, `min: 0` | Platform utility credits |
| `spins` | `Number` | `required`, `default: 0`, `min: 0` | Fortune wheel mini-game turns |
| `createdAt` / `updatedAt` | `Date` | Mongoose `timestamps: true` | Balance update timestamps |

### 2.3 `wallettransactions` (`WalletTransaction` Model)
| Field | Type | Constraints & Indexes | Purpose |
| :--- | :--- | :--- | :--- |
| `transactionId` | `String` | `required`, `unique`, `index` | Immutable ledger ID (`TXN-...`) |
| `userId` | `String` | `required`, `index` | Application-enforced reference to `users.userId` |
| `currency` | `String` | `enum: ['ves', 'sves', 'gems', 'tokens', 'spins']`, `index` | Affected currency |
| `type` | `String` | `enum: ['CREDIT', 'DEBIT']` | Ledger direction |
| `amount` | `Number` | `required`, `min: 0` | Positive magnitude |
| `balanceBefore` | `Number` | `required`, `min: 0` | Pre-mutation balance snapshot |
| `balanceAfter` | `Number` | `required`, `min: 0` | Post-mutation balance snapshot |
| `source` | `String` | `required`, `index` | `REWARD`, `BONUS`, `REFERRAL`, `DAILY_REWARD`, `AD_REWARD`, `GAME_REWARD`, `ADMIN_CREDIT`, `WITHDRAWAL`, `ADMIN_DEBIT`, `CORRECTION`, `REFUND` |
| `referenceId` | `String` | optional | Links to `withdrawalId` or campaign ID |
| `status` | `String` | `enum: ['COMPLETED', 'PENDING', 'FAILED', 'REVERSED']`, `index` | Ledger state |
| `description` | `String` | `required` | Human-readable ledger note |
| `metadata` | `Mixed` | default `{}` | Structured context payload |
| **Compound Index** | `{ userId: 1, createdAt: -1 }` | Query optimization | Fast user ledger timeline retrieval |

### 2.4 `withdrawals` (`Withdrawal` Model)
| Field | Type | Constraints & Indexes | Purpose |
| :--- | :--- | :--- | :--- |
| `withdrawalId` | `String` | `required`, `unique`, `index` | Public withdrawal reference (`WTH-...`) |
| `userId` | `String` | `required`, `index` | Requesting user |
| `method` | `String` | `required` | Payout rail (`UPI`, `PayPal`, `Amazon Gift Cards`, `Google Play Gift Cards`) |
| `optionId` | `String` | `required` | Reference to `payoutoptions.optionId` |
| `currency` | `String` | `default: 'ves'` | Debited wallet currency |
| `currencyAmount` | `Number` | `required`, `min: 1` | VEs deducted/reserved |
| `payoutAmount` | `Number` | `required`, `min: 0` | Cash/voucher face value |
| `payoutDetails` | `Mixed` | `required` | Recipient VPA/email payload (object or normalized string wrapper) |
| `status` | `String` | `enum: ['PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'CANCELLED']`, `index` | Workflow state |
| `transactionId` | `String` | `required` | Reservation debit `WalletTransaction.transactionId` |
| `idempotencyKey` | `String` | `index` | 60-second duplicate submission protection |
| `rejectionReason` / `reviewNote` | `String` | optional | Compliance decision record |
| `requestedAt` / `processedAt` | `Date` | timestamps | SLA & turnaround metrics |
| **Compound Index** | `{ userId: 1, requestedAt: -1 }` | Query optimization | Fast withdrawal history listing |

### 2.5 `payoutoptions` (`PayoutOption` Model) & `auditlogs` (`AuditLog` Model)
- **`payoutoptions`**: Unique `optionId`, indexed `methodId`, `type`, `active`. Defines voucher face value, `payoutValue`, `currency` (`INR`/`USD`), `requiredAmount` (VEs), and `eligibility` (`minLevel`, `country`).
- **`auditlogs`**: Immutable `actorId`, `action`, `targetUserId`, `targetType`, `referenceId`, `metadata`, `createdAt` (`updatedAt: false`).

---

## 3. Conflicting User Records & Master User Dataset Strategy (Evaluation Point 5)

### 3.1 How Duplicate & Conflicting Records Occur in Production Imports
In the current sandbox (`User` schema), `userId` and `email` both have unique indexes (`lowercase: true`, `trim: true`), resulting in **0 duplicates** in local testing (verified live via `GET /api/admin/user-conflicts`). However, when ingesting historical or multi-system VELOOP production exports, conflicts can arise from:
1. **Case & Whitespace Variance / Email Aliasing**: Legacy exports containing `User@Domain.com` vs `user@domain.com`, or `+alias` variations.
2. **Multi-ID Mapping**: A single human email or phone number associated with multiple legacy `userId` keys across old mobile/web databases.
3. **Conflicting Profile Attributes**: Differing `name`, `accountStatus` (`active` vs `suspended`), or `role` across CRM, Auth0/Firebase, and Rewards DB snapshots.
4. **Orphaned Child Records**: `wallets`, `wallettransactions`, or `withdrawals` referencing a legacy `userId` that was merged or missing in `users`.

### 3.2 Master User Dataset Schema (Target Production Standard)
To unify records safely without data loss, the **Master User Record** (`master_users` / extended `users`) must standardize:
- **`masterUserId` (PK)**: Immutable UUIDv4/ULID generated at canonical creation.
- **`canonicalEmail` (Unique Key)**: Lowercase, trimmed RFC-5322 normalized email.
- **`sourceSystemIds`**: Map of origin IDs (`{ veloopAppId, authProviderSub, legacyWalletUserId }`).
- **`authoritativeSource`**: Enum recording which source verified the record (`AUTH_PROVIDER` / `REWARDS_CORE` / `CRM_MANUAL`).
- **`reconciliationStatus`**: `VERIFIED` | `CONFLICT_PENDING_REVIEW` | `MERGED_ALIAS`.
- **`dataOrigin`**: `'production'` | `'simulated'` (strictly preventing simulated records from entering production KPIs).

### 3.3 Unique User Identification Rules
1. **Primary Match Key**: Exact normalized `canonicalEmail` (trimmed, lowercase).
2. **Secondary Match Key**: Verified external auth subject (`authProviderSub`) or verified mobile number (E.164 format, once captured in production).
3. **Rule of Non-Overwrite**: Never merge two records automatically if they possess non-zero `ves`/`sves` wallet balances or `PENDING` withdrawals — flag both as `CONFLICT_PENDING_REVIEW` for finance/admin review.

### 3.4 Conflict Review & Resolution Policy
1. **Detection (`GET /api/admin/user-conflicts`)**: Non-destructive scanner flags duplicate normalized emails, missing wallets, and orphan wallets without deleting or overwriting any document.
2. **Quarantine Staging**: Incoming records matching an existing email with a different `userId` are staged in a `user_reconciliation_queue` collection instead of overwriting `users`.
3. **Manual Admin Adjudication**: An administrator reviews ledger balances, active withdrawals, and `lastLoginAt`, selects the surviving record, archives the alias mapping into `AuditLog`, and transfers balances via explicit `CORRECTION` ledger entries (preserving 100% double-entry auditability).
4. **Authoritative Source Designation (Requires VELOOP Confirmation)**: Pending VELOOP engineering confirmation, the **Production Auth Identity Store (SSO/JWT Provider)** should be treated as authoritative for `email`, `accountStatus`, and `role`, while the **Rewards Ledger Core (`wallets` + `wallettransactions`)** is strictly authoritative for all financial/currency balances.
