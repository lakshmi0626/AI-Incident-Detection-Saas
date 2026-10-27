# IncidentIQ — System Architecture & Technical Specifications

## 1. High-Level Overview

**IncidentIQ** is an enterprise-grade, multi-tenant AI-powered software incident detection and resolution platform. It continuously ingests structured logs, performance metrics, and distributed traces from microservices, detects anomalies using real-time deterministic evaluation rules, deduplicates incident noise, and leverages structured AI reasoning to generate actionable root-cause hypotheses, unified code diffs, and verification checklists.

```
                              ┌───────────────────────────────────┐
                              │    Monitored Client Services      │
                              │ (Spring Boot, FastAPI, Go, Node)  │
                              └─────────────────┬─────────────────┘
                                                │ OTLP / HTTP REST
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            IncidentIQ Gateway                               │
│  - Application Ingestion Key Authentication & Organization Scoping          │
│  - Real-Time Zero-Leak Secret Redactor (Bearer tokens, credentials, PII)     │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
    ┌───────────────────────────────┐       ┌───────────────────────────────┐
    │    Detection Engine Worker    │       │    Relational Store (SQLite)  │
    │  - Latency & 5xx Burst Rules  │       │  - Organizations & Tenants    │
    │  - Crash & DB Timeout Filters │       │  - Applications & Services    │
    │  - Fingerprint Deduplication  │       │  - Incidents & Timeline Logs  │
    │  - Alert Cooldown & Reopening │       │  - AI Diagnoses & Feedback    │
    └───────────────┬───────────────┘       └───────────────┬───────────────┘
                    │                                       │
                    │ Trigger                               │ Context Retrieval
                    ▼                                       ▼
    ┌───────────────────────────────┐       ┌───────────────────────────────┐
    │   Notification Dispatcher     │       │     AI SRE Investigation      │
    │  - In-App Alert Feed          │       │  - Sanitized Evidence Bundle  │
    │  - Slack / Teams Webhooks     │       │  - Gemini / OpenAI LLM Calls  │
    │  - SMTP Email Routing         │       │  - Deterministic SRE Fallback │
    └───────────────────────────────┘       └───────────────┬───────────────┘
                                                            │ Structured JSON
                                                            ▼
                                            ┌───────────────────────────────┐
                                            │ Human Verification Feedback   │
                                            │  - Correct / Incorrect Status │
                                            │  - Verified Root Cause Store  │
                                            └───────────────────────────────┘
```

---

## 2. Multi-Tenant Data Isolation Architecture

IncidentIQ is built from the ground up as a commercial SaaS product:
1. **Tenant Scoping**: All relational entities (`applications`, `services`, `log_entries`, `metric_entries`, `trace_spans`, `detection_rules`, `incidents`, `incident_events`, `ai_analyses`, `audit_logs`, `notification_channels`) maintain a foreign key to `organizations.id`.
2. **Context Resolution**: The FastAPI dependency `get_current_tenant` parses the active session/JWT token, validates user membership in the requested organization, and extracts their role.
3. **Query Boundary Enforcement**: Every database query filters by `organization_id == ctx.organization.id`. Cross-tenant data leakage is structurally impossible.
4. **Subscription Entitlements**: Plan tiers (`free`, `starter`, `team`, `business`) enforce limits on monitored applications, monthly event ingestion volume, retention days, and AI investigations quota.

---

## 3. Incident Detection & Deduplication Engine

The detection engine evaluates incoming telemetry against active rules and anomaly signatures:
- **Rule Types**:
  - `error_rate`: API error percentage over a sliding evaluation window (e.g. > 5.0% for 60s).
  - `latency`: p95 response time spike (e.g. > 1,500ms).
  - `http_5xx`: Burst of 5xx status codes within a short time frame.
  - `crash`: Fatal application crashes (`OutOfMemoryError`, `SIGSEGV`, panic, unhandled exception).
  - `db_timeout`: Connection pool exhaustion (e.g. HikariCP timeouts > 25,000ms).
  - `cpu_memory`: Resource saturation violations (> 85% CPU / heap).
- **Fingerprinting & Deduplication**:
  - Fingerprint formula: `sha256(f"{app_id}:{service}:{rule_type}:{normalized_error}").hexdigest()[:24]`.
  - When an identical error signature occurs while an incident is open (`Triggered`, `Acknowledged`, `Investigating`, `Mitigated`), it appends an `alert_grouped` event rather than generating a duplicate incident.
  - **Reopening Logic**: If an incident was marked `Resolved` within the cooldown period (15 minutes) and the signature recurs, IncidentIQ reopens the incident and logs a regression alert.

---

## 4. AI-Powered SRE Investigation & Safety Guardrails

When an incident is triaged:
1. **Evidence Retrieval**: Gathers telemetry in a -15m to +5m window surrounding detection (error logs, p95 latency spikes, failing distributed trace spans).
2. **Secret Redaction**: Strips authorization headers, API keys, basic auth, database passwords, credit card numbers, and JWT signatures.
3. **Provider Integration**: Dispatches to configured LLM (Google Gemini or OpenAI). If credentials are unconfigured or the network is offline, IncidentIQ's intelligent deterministic SRE heuristic engine analyzes the exact error trace and produces structured output.
4. **Structured Schema**:
   - `summary`: Concise incident synopsis.
   - `root_cause_hypothesis`: Deep technical root cause explanation.
   - `supporting_evidence`: Correlated logs, metrics, and trace spans.
   - `alternative_causes`: Secondary factors ruled out.
   - `confidence_score`: 0.0 to 1.0 confidence indicator.
   - `recommended_steps`: Step-by-step diagnostic actions.
   - `code_fix_diff`: Unified Git-style code or configuration patch.
   - `verification_steps`: Post-fix verification criteria.
5. **Safety Guardrail**: AI-generated diagnoses are advisory. Code changes or remediation are never executed automatically without human confirmation. Engineers record human verification via the feedback loop.
