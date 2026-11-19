# VELoop Rewards – Production Integration Roadmap

> **Readiness Disclaimer:** This application currently operates strictly in a **Simulated / Embedded Sandbox Environment** (`MongoMemoryServer` seeded demo data, `productionDataConnected: false`). Production MongoDB Atlas connectivity, live VELOOP user data, payment gateway payouts, and proposed schema extensions are **Planned / Not Yet Implemented**. This document makes **no claim** of production readiness, live VELOOP data access, or live payment gateway integration.

---

## Environment Comparison

| Capability | Verified Current Sandbox State | Target VELOOP Production State (**Planned / Not Yet Implemented**) |
| :--- | :--- | :--- |
| **Database** | Embedded `MongoMemoryServer` fallback (`connectDB()` supports `MONGODB_URL`/`MONGODB_URI`, live `pingDB()`, `persistent: false`, URI credential masking) | Dedicated Managed **MongoDB Atlas** Replica Set (M10+ with VPC peering, TLS, and PITR backups) — *Planned / Not Yet Implemented* |
| **Data Origin** | Seeded demo users (`demo@veloop.test`) & automated verification suites (`TC-01`–`TC-23`, `WS-01`–`WS-06`, `KPI-TEST-01`–`06`, `PH-01`–`06`) | Authenticated VELOOP user base + live partner reward streams tagged with `dataOrigin: 'production'` — *Planned / Not Yet Implemented* |
| **Payout Rails** | Simulated status transitions (`PENDING -> APPROVED / REJECTED`), `Withdrawal.payoutCurrency` snapshot, partial unique `{userId, idempotencyKey}`, and `SandboxPaymentProvider` (`SBX-*` refs) | Live IMPS/UPI (RazorpayX/Cashfree), PayPal Payouts API, and Gift Voucher provider APIs — *Planned / Not Yet Implemented* |
| **Referrals & Fraud Controls** | `Referral` schema, `User.referralCode`/`referredByUserId`, invite & signup attribution, self-referral/duplicate locks (`TC-19` `PASS`), `rewardAmountVes: 0` pending rules | Business-rule reward payouts + **Proposed / Optional** device fingerprinting (requires VELOOP privacy/legal approval and retention rules) — *Planned / Not Yet Implemented* |
| **Conflict & Health Endpoints** | Existing in repo: `GET /api/admin/user-conflicts`, `GET /api/admin/referrals`, `GET /api/admin/analytics`, `GET /api/health` (with live ping latency) | Extended pre-ingestion reconciliation against staged production exports (`user_reconciliation_queue`) and production monitoring alerts — *Planned / Not Yet Implemented* |

---

## Phased Implementation Plan

### Phase 1: Production Data Sources & Database Connection (`Planned / Not Yet Implemented`)

- **Dependencies:** VELOOP Cloud/Atlas account provisioning, secret-manager access, architecture sign-off on authoritative upstream systems.
- **Responsible Owner Roles:** `DevOps / Cloud Infrastructure Lead`, `Backend Engineering Lead`, `Security / AppSec Lead`.
- **Implementation Tasks:**
  1. **Provision Dedicated Production MongoDB Atlas Cluster (`Planned / Not Yet Implemented`):**
     - Provision a production replica set (M10+ isolated from staging and sandbox), enable automated continuous/point-in-time backups, and enforce VPC Peering / private endpoint IP allowlisting (never `0.0.0.0/0` in production).
     - Inject `MONGODB_URI`, `JWT_SECRET`, and `NODE_ENV=production` strictly via Cloud Secret Manager (zero `.env` secrets committed to Git).
  2. **Map External Production Data Feeds (`Planned / Not Yet Implemented`):**
     - Establish contracts, schemas, and S2S credentials for authoritative sources:
       - **User Identity:** VELOOP Core Auth / SSO Provider
       - **Ad Rewards:** Ad Mediation S2S Postback Webhooks
       - **Games/Wheel:** Game Server Event Bus
       - **Payout Settlements:** Payment Gateway Settlement & Reversal Webhooks
- **Measurable Acceptance Criteria:**
  - **Future Staging/Production Criterion:** Staging & Production Atlas clusters pass TLS connectivity check (`isAtlasConnected === true`), enabling `TC-23` to transition from `NOT_TESTABLE` to `PASS` in future staging runs.
  - Zero credentials present in source repository or client bundle; 100% of secrets loaded via secret manager.
  - Written API/webhook payload specifications signed off for all 4 external data feeds.

---

### Phase 2: Data Ingestion, Validation & Cleaning (`Planned / Not Yet Implemented`)

- **Dependencies:** Phase 1 staging Atlas cluster and sample exported data extracts; stakeholder confirmation on FX valuation and opening balance cutover rules.
- **Responsible Owner Roles:** `Data Engineering Lead`, `Backend Engineering Lead`, `Finance / Operations Lead`.
- **Implementation Tasks:**
  1. **Schema Pre-Flight Upgrades:**
     - **Already Implemented in Sandbox:** `Withdrawal.payoutCurrency` (`'INR' | 'USD'`), `Withdrawal.providerMode`, `Withdrawal.providerReferenceId`, `Referral` model, `User.referralCode`, and `User.referredByUserId`.
     - **Remaining Planned Upgrades (`Not Yet Implemented`):** Add `dataOrigin: 'production' | 'simulated'` discriminator across all core collections, `Withdrawal.gatewayTransactionRef`, and `referenceType` discriminators on polymorphic `referenceId` fields.
  2. **Separate Reward vs. Payout Currency Validation Rules (`Planned / Not Yet Implemented`):**
     - **Reward / Virtual Currencies (`'ves'`, `'sves'`, `'gems'`, `'tokens'`, `'spins'`):** Validate strict enum membership on `Wallet` balances and `WalletTransaction.currency`, enforce positive, finite mutation amounts (`amount > 0`) within approved VELOOP currency precision/scale rules, ensure `balanceAfter >= 0`, and restrict payout redemptions strictly to `'ves'`.
     - **Payout / Fiat Currencies (`'INR'`, `'USD'`):** Validate strict ISO-4217 enum membership on `PayoutOption.currency` and `Withdrawal.payoutCurrency`, enforce positive, finite fiat amounts (`payoutAmount > 0`) within approved currency scale rules, verify active payout tier mapping at request time, and keep fiat payout obligations decoupled from wallet debit currency (`Withdrawal.currency === 'ves'`).
     - Apply canonical email normalization (`trim().toLowerCase()`) and reject malformed identifiers into an ingestion quarantine log.
  3. **Complete Wallet-to-Ledger Reconciliation (`Planned / Not Yet Implemented`):**
     - Verify historical balance integrity using the full accounting identity rather than assuming `Credits - Debits` alone equals the current balance:
       `Wallet[c] === OpeningBalance[c] + SUM(VerifiedCredits[c]) - SUM(VerifiedDebits[c]) + NET(ApprovedAdjustments[c])`
     - `OpeningBalance[c]` captures any verified legacy migration/cutover baseline (`0` for accounts created natively under full ledger tracking); `VerifiedCredits[c]` and `VerifiedDebits[c]` cover `COMPLETED` standard reward/withdrawal rows; `NET(ApprovedAdjustments[c])` represents signed approved adjustments—where approved `ADMIN_CREDIT` and upward `CORRECTION` entries are positive (`+`) and approved `ADMIN_DEBIT` and downward `CORRECTION` entries are negative (`-`), all supported by `AuditLog` approval records.
- **Measurable Acceptance Criteria:**
  - `100%` of ingested transactions pass separate reward-currency vs. payout-currency schema validation rules; invalid rows are quarantined without halting batch ingestion.
  - `100%` of `WalletTransaction` rows satisfy `balanceAfter === balanceBefore +/- amount` (`KPI-30 = 100.0%`).
  - `0` unresolved balance variances between `Wallet[c]` and `OpeningBalance[c] + SUM(VerifiedCredits[c]) - SUM(VerifiedDebits[c]) + NET(ApprovedAdjustments[c])` prior to production cutover.

---

### Phase 3: User Identity Reconciliation (`Partially Implemented in Sandbox; Export Queue Planned / Not Yet Implemented`)

- **Dependencies:** Phase 1 Auth/SSO identity export access; Phase 2 staging validation pipeline; stakeholder sign-off on authoritative-source precedence.
- **Responsible Owner Roles:** `Data Engineering Lead`, `Product / Operations Admin Lead`, `Security / Legal & Privacy Lead`.
- **Implementation Tasks:**
  1. **Run Existing Conflict Scanner + Build Staged Export Queue:**
     - **Existing in Current Codebase:** `GET /api/admin/user-conflicts` already exists in `server/routes/adminRoutes.ts` to scan live `User` and `Wallet` collections for canonical email duplicates, non-admin users missing wallets, and orphan wallets.
     - **Required Future Capability (`Planned / Not Yet Implemented`):** Build a staged import scanner and persistent `user_reconciliation_queue` workflow to cross-check external VELOOP Auth/SSO exports against existing MongoDB records prior to production merge.
  2. **Quarantine & Authoritative-Source Reconciliation (`Planned / Not Yet Implemented`):**
     - Quarantine conflicting `email <-> userId` mappings into `user_reconciliation_queue` — **never automatically delete or overwrite accounts with non-zero balances or historical withdrawals**.
     - Apply VELOOP-confirmed precedence rules (e.g., `Auth Provider` authoritative for identity/`accountStatus`; `Rewards Core` authoritative for verified wallet balances) only after signed admin review logged in `AuditLog`.
  3. **Proposed Fraud-Prevention Option — Device Fingerprinting (`Proposed / Not Yet Implemented`):**
     - Any future addition of device fingerprinting for duplicate-account or referral-abuse detection is strictly a **proposed option** and **must not** be implemented until VELOOP Privacy/Legal completes: (a) formal privacy/legal approval (GDPR/DPDP compliance), (b) documented fraud-prevention purpose specification, (c) strict role-based access restrictions and cryptographic signal hashing, and (d) explicit data-retention and deletion schedules.
- **Measurable Acceptance Criteria:**
  - `0` unresolved duplicate canonical emails (`duplicateEmailsCount === 0`) and `0` orphan wallets (`orphanWalletsCount === 0`) before go-live.
  - `100%` of manual identity merges/resolutions carry an `AuditLog` entry with admin actor ID and reason.
  - Written VELOOP legal/privacy sign-off obtained before any device-signal collection is enabled (or explicitly excluded from Phase 3 scope if deferred).

---

### Phase 4: Analytics, KPIs & Dashboard Integration (`Planned / Not Yet Implemented` for Live Production Feeds)

- **Dependencies:** Phases 2–3 reconciled production data; stakeholder business confirmation on the 12 KPIs marked `Needs Business Confirmation` in `KPI_Validation_Report.md`; event-tracking SDK/backend instrumentation.
- **Responsible Owner Roles:** `Analytics Engineering Lead`, `Backend Engineering Lead`, `Product Owner`.
- **Implementation Tasks:**
  1. **Strict Production Data Isolation (`Planned / Not Yet Implemented`):**
     - Update analytics queries (`GET /api/admin/analytics`, currently hardcoded to `SIMULATED_DEMO_DATA` when `productionDataConnected === false`) to enforce explicit `dataOrigin: 'production'` filtering in production dashboards so simulated/QA records can never mix with live VELOOP KPIs.
  2. **Unlock the 7 Remaining `Not Testable` KPIs (`KPI-45` Now Implemented in Sandbox):**
     - `KPI-45`: **Referral Invite-to-Signup Conversion Rate (%)** — *Implemented in sandbox via `Referral` model (`TC-19` `PASS`); automated VEs payout rules still pending VELOOP sign-off.*
     - `KPI-06`: **Daily Active Users (DAU)** *(requires `SessionLogs` / `lastLoginAt`)*
     - `KPI-07`: **Monthly Active Users (MAU)** *(requires `SessionLogs`)*
     - `KPI-08`: **DAU / MAU Stickiness Ratio** *(derived from `KPI-06` and `KPI-07`)*
     - `KPI-10`: **User Retention Rate (Day-7 / Day-30)** *(requires `SessionLogs` / `ActivityLogs` + `User.createdAt`)*
     - `KPI-27`: **Ad-Watch eCPM / Ad Revenue Yield** *(requires external `AdRevenue` / ad-mediation feed)*
     - `KPI-34`: **Duplicate Idempotency Prevention Count** *(requires persisting a `DUPLICATE_BLOCKED` counter/metric in `PayoutService`)*
     - `KPI-46`: **Referred User LTV vs Organic LTV** *(`User.referredByUserId` is now implemented; downstream `AdRevenue` / gross LTV telemetry remains missing)*
     - *(Also instrument `TaskEvents` and `FeatureEvents` per `Analytics_Specification.md` Section 5 for task completion/abandonment and feature adoption.)*
  3. **Materialized Daily KPI Snapshots (`Planned / Not Yet Implemented`):**
     - Configure scheduled nightly rollups (`DailyEngagementRollup` / materialized KPI views) separated strictly by `dataOrigin` and stakeholder-confirmed timezone (`UTC` vs `IST`).
- **Measurable Acceptance Criteria:**
  - `0` cross-contamination between `simulated` and `production` rows in staging/production analytics API responses.
  - All 12 `Needs Business Confirmation` KPIs have written formula sign-off from VELOOP stakeholders.
  - All 8 Not-Testable KPIs (`KPI-06`, `KPI-07`, `KPI-08`, `KPI-10`, `KPI-27`, `KPI-34`, `KPI-45`, `KPI-46`) emit verified non-fabricated outputs in staging when fed test telemetry, and `GET /api/admin/analytics` dashboard queries complete in `< 500ms` under staging load.

---

### Phase 5: Security, Access Control, Testing, Backup Verification & Deployment (`Planned / Not Yet Implemented`)

- **Dependencies:** Phases 1–4 complete in staging; penetration/security review; DR backup cluster available.
- **Responsible Owner Roles:** `Security / AppSec Lead`, `QA / Test Engineering Lead`, `DevOps / Release Engineering Lead`.
- **Implementation Tasks:**
  1. **Security Hardening (`Planned / Not Yet Implemented`):**
     - Upgrade current static JWT auth to short-lived access tokens with refresh token rotation and revocation, strict CORS origin allowlists, Redis-backed distributed rate limiting, and HMAC signature verification on all inbound ad-mediation and payout-gateway webhooks.
     - Restrict Admin Portal (`/api/admin/*`) behind MFA-verified admin accounts, RBAC least-privilege policies, and VPN/office IP allowlists.
  2. **Verification & Backup Restoration Testing (`Planned / Not Yet Implemented`):**
     - **Future Staging Verification Target:** Once `Referral` and Atlas integrations are built, execute the full 23-case automated test suite against Staging Atlas (targeting `TC-19` and `TC-23` passing alongside `TC-01`–`TC-22`) plus end-to-end payment sandbox webhook tests.
     - Perform a documented **Backup Restoration Drill**: restore an encrypted Atlas point-in-time snapshot into an isolated recovery cluster, verify `WalletTransaction` checksum parity (`KPI-30 = 100%`) and wallet reconciliation parity, and record measured RPO/RTO against target SLA.
  3. **Zero-Downtime Deployment & Rollback Procedures (`Planned / Not Yet Implemented`):**
     - Execute blue/green deployment gated by `/api/health` readiness probes (which already exist in `server/app.ts`) and post-deploy smoke checks.
     - Maintain a tested **Rollback Procedure**: ensure all Phase 2 schema additions remain backward-compatible during rollout, document explicit abort triggers (error rate `> 1%`, ledger invariant failure, or payout queue failure), and retain instant blue/green DNS/load-balancer switchback + payout-freeze kill switch without destructive DB down-migrations.
- **Measurable Acceptance Criteria:**
  - **Future Staging Acceptance Criterion:** Achieve `100%` automated test pass rate (`23/23` tests passing with `0` failures, advancing from the current sandbox baseline of `21 PASS / 2 NOT_TESTABLE`) against managed Staging Atlas.
  - Backup restoration test succeeds with `0` corrupted/missing ledger rows and measured RPO/RTO within VELOOP SLA targets.
  - Rollback drill completes successfully in staging within `< 10 minutes` without data loss.
  - External security scan reports `0` Critical/High vulnerabilities before production cutover.

---

### Phase 6: Monitoring, Incident Escalation & Ongoing Maintenance (`Planned / Not Yet Implemented`)

- **Dependencies:** Phase 5 production deployment and observability stack (metrics, log aggregation, paging/alerting).
- **Responsible Owner Roles:** `SRE / Platform Operations Lead`, `Backend Engineering Lead`, `Operations / Finance On-Call Lead`.
- **Implementation Tasks:**
  1. **Post-Deployment Monitoring & Ledger Anomaly Alerts (`Planned / Not Yet Implemented`):**
     - Automated continuous monitors checking: (a) `WalletTransaction` arithmetic invariant (`balanceAfter === balanceBefore +/- amount`), (b) `Withdrawal` SLA breaches (`status === 'PENDING'` past stakeholder SLA, e.g., `> 24h`), (c) sudden spikes in failed webhooks or API `5xx` error rates, and (d) scheduled post-deployment synthetic health checks (`/api/health` + read-only KPI sanity checks).
  2. **Production Incident Escalation Workflow (`Planned / Not Yet Implemented`):**
     - **Severity 1 (Critical — Ledger mismatch, unauthorized admin access, or payout rail misrouting):** Immediate automated/on-call payout-queue freeze, page `SRE Lead` + `Backend Engineering Lead` + `Security Lead` within `< 15 minutes`, preserve audit logs, initiate rollback or containment.
     - **Severity 2 (High — Ad webhook DLQ backlog or delayed gateway settlements):** Page `Backend On-Call` + `Operations Lead` within `< 1 hour`, replay dead-letter queue after root-cause fix.
     - **Severity 3 (Medium — Non-blocking dashboard latency or slow queries):** Triage next business day via engineering backlog with root-cause tracking.
  3. **Infrastructure & Cost Maintenance (`Planned / Not Yet Implemented`):**
     - Monitor Atlas index hit ratios (`> 99%`), slow query profiler (`> 100ms`), dead-letter queues for failed external webhooks, and quarterly backup-restore + key-rotation drills.
- **Measurable Acceptance Criteria:**
  - Synthetic `/api/health` + ledger-invariant alerts trigger end-to-end test notifications within `< 2 minutes` of simulated fault injection.
  - P1/P2 escalation runbooks and payout kill-switch tested in staging tabletop exercise.
  - P95 API response latency `< 300ms` and DLQ unprocessed age `< 1 hour` during post-deployment hypercare window.

---

## Current Project Readiness and External Dependencies

| Workstream | Status | Notes |
| :--- | :---: | :--- |
| **Core Sandbox App, Referral Tracking & Security Hardening** | **Completed in Sandbox** | Express API, 7 Mongoose models (`User`, `Wallet`, `WalletTransaction`, `Withdrawal`, `PayoutOption`, `AuditLog`, `Referral`), `WalletService`, `PayoutService` + `SandboxPaymentProvider`, `ReferralService`, `/api/health`, `/api/admin/analytics`, `/api/admin/referrals`, `/api/admin/user-conflicts`, security headers, and React UI verified in embedded `MongoMemoryServer`. |
| **Automated Test Suites & Documentation** | **Completed in Sandbox** | 41 automated checks across 4 suites (`TC-01`–`TC-23`: `22 PASS`, `1 NOT_TESTABLE` (`TC-23`); `WS-01`–`06`: `6 PASS`; `KPI-TEST-01`–`06`: `6 PASS`; `PH-01`–`06`: `6 PASS`); KPI audit (`27 Validated`, `12 Needs Business Confirmation`, `7 Not Testable`), ER audit, and security docs updated. |
| **VELOOP External Access & Secrets** | **External Dependency (Blocked)** | Requires VELOOP-provisioned MongoDB Atlas production/staging URI, IP/VPC allowlisting, Core Auth/SSO exports, Ad Mediation postbacks, and live payment gateway credentials (RazorpayX/Cashfree/PayPal). |
| **VELOOP Stakeholder Approvals** | **Approval Pending** | Requires formal sign-off on 12 KPI business definitions (`KPI-02, 05, 09, 16, 17, 20, 21, 26, 32, 39, 40, 41`), referral reward payout rules, authoritative conflict-precedence rules, FX valuation rates, UTC vs IST cutoff, and privacy/legal approval before any device fingerprinting. |
| **Production Engineering Build-Out** | **Planned / Not Yet Implemented** | Requires `dataOrigin` separation across models, `SessionLogs`, `TaskEvents`, `FeatureEvents`, `referenceType` discriminators, `PayoutOption` soft-delete guards, MFA/HMAC/Redis hardening, backup-restore drills, and alerting. |
