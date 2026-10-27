# IncidentIQ — Security & Compliance Architecture

IncidentIQ is built for commercial IT enterprise compliance, financial services reliability, and secure multi-tenant cloud operations.

---

## 1. Zero-Leak Secret Redaction Engine

Prior to storing incoming telemetry (logs, context payloads, traces) or transmitting evidence to AI models, every payload passes through IncidentIQ's deterministic Secret Redactor (`app.security.redact_secrets`):

- **Bearer & OAuth Tokens**: `Bearer [a-zA-Z0-9_\-\.]+` is sanitized to `Bearer [REDACTED_TOKEN]`.
- **Basic Auth Credentials**: `Basic [a-zA-Z0-9+/=]+` is sanitized to `Basic [REDACTED_BASIC_AUTH]`.
- **Passwords & Keys**: Any key matching `password`, `passwd`, `pwd`, `client_secret`, or `api_secret` is replaced with `"[REDACTED_SECRET]"`.
- **API Keys**: Patterns matching `iq_live_`, `sk_live_`, `ghp_`, `AKIA` are replaced with `[REDACTED_API_KEY]`.
- **Payment Card Data (PCI-DSS)**: 16-digit card number patterns matching Luhn structures are replaced with `[REDACTED_CARD_NUMBER]`.
- **Database Connection Strings**: Credentials in URI formats like `postgres://user:pass@host` are masked to `postgres://user:[REDACTED_DB_PWD]@host`.
- **JWT Signatures**: Raw JSON Web Tokens embedded in logs are replaced with `[REDACTED_JWT_TOKEN]`.

---

## 2. Multi-Tenant Cryptographic & Logical Isolation

- **Scoped Queries**: Every database query in `dependencies.py` and routers filters strictly by `organization_id`.
- **Token Claims**: Access tokens carry the active `org_id` claim, verified against `organization_members` on every request.
- **Cross-Tenant Prevention**: Users cannot query or mutate applications, incidents, logs, traces, or audit logs belonging to another organization. Verified by automated tests in `tests/test_backend.py::test_cross_tenant_isolation`.

---

## 3. Password Hashing & Key Storage

- **Argon2 Password Hashing**: Passwords are saved using Argon2 (memory-hard, resistant to GPU/ASIC cracking) via `argon2-cffi`.
- **Application Ingestion Keys**: Application API keys are generated as high-entropy 32-byte strings (`iq_live_...`). Only a SHA-256 hash is persisted in the database; the raw key is displayed to the user exactly once upon registration or rotation.

---

## 4. Immutable Audit Logs & GDPR Compliance

- **Audit Trail**: Every authentication event, member invitation, role change, incident lifecycle transition, and retention modification is recorded in the `audit_logs` table with timestamp, IP address, actor ID, and delta payload.
- **Configurable Retention Policies**: Logs, metrics, and traces are retained according to the organization's policy (default 30, 90, 14 days) and purged automatically or via manual purge.
- **GDPR Article 17 "Right to Erasure"**: Organization owners can initiate a permanent GDPR erasure request requiring explicit organization name confirmation, purging all telemetry, incidents, and AI analyses permanently.
