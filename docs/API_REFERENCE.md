# IncidentIQ — REST API Reference (v1)

Base URL: `http://localhost:8000/api/v1`  
Interactive OpenAPI Documentation: `http://localhost:8000/api/v1/docs`

All protected tenant endpoints require `Authorization: Bearer <token>` and optional `X-Organization-Id: <org_id>` header.  
All ingestion endpoints require `X-API-Key: <iq_live_...>` or `Authorization: Bearer <iq_live_...>`.

---

## 1. Authentication & Profiles (`/auth`)

### `POST /auth/register`
Creates a new user account, initializes their primary organization, and assigns the `owner` role.
```json
{
  "email": "engineer@company.com",
  "password": "SecurePassword123!",
  "full_name": "Alex Mercer",
  "organization_name": "Acme Cloud"
}
```

### `POST /auth/login`
Authenticates user credentials and returns JWT token and organization memberships.
```json
{
  "email": "admin@incidentiq.io",
  "password": "IncidentIQ@2026!"
}
```

### `GET /auth/me`
Returns authenticated user details, active tenant, and all memberships.

### `POST /auth/switch-org?org_id={id}`
Switches active organization context and returns a scoped access token.

---

## 2. Monitored Applications (`/applications`)

### `GET /applications`
Lists all registered applications in active tenant with service count and active incident count.

### `POST /applications`
Registers a new application and returns a one-time raw Ingestion API Key (`iq_live_...`).
```json
{
  "name": "Payment Processing Gateway",
  "description": "Core checkout transaction router",
  "environments": ["production", "staging", "qa"]
}
```

### `POST /applications/{id}/api-key`
Rotates the application API key and invalidates the previous hash.

### `POST /applications/{id}/services`
Registers a microservice component (`api-gateway`, `backend`, `database`, `queue`).

---

## 3. Telemetry Ingestion (`/telemetry`)

### `POST /telemetry/logs`
Ingests structured logs. Automatically strips secrets and evaluates detection rules.
```json
{
  "logs": [
    {
      "service_name": "payment-gateway",
      "level": "ERROR",
      "message": "HikariPool-1 - Connection timed out after 30000ms",
      "environment": "production",
      "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
      "span_id": "00f067aa0ba902b7"
    }
  ]
}
```

### `POST /telemetry/metrics`
Ingests numerical metrics (latency, RPS, error rates, CPU/memory).
```json
{
  "metrics": [
    {
      "service_name": "order-api",
      "metric_name": "error_rate_pct",
      "value": 14.8,
      "unit": "%"
    }
  ]
}
```

### `POST /telemetry/traces`
Ingests distributed trace spans.
```json
{
  "spans": [
    {
      "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
      "span_id": "00f067aa0ba902b7",
      "service_name": "payment-gateway",
      "name": "POST /api/v1/charge",
      "duration_ms": 30150.0,
      "status_code": "ERROR",
      "status_message": "SQLTransientConnectionException"
    }
  ]
}
```

### `POST /telemetry/v1/traces` & `POST /telemetry/v1/logs`
OpenTelemetry Collector OTLP JSON-compatible receivers.

---

## 4. Incidents & AI Investigation (`/incidents` & `/ai`)

### `GET /incidents`
Filterable incident listing. Supports `status`, `severity`, `service_name`, `search`, and pagination.

### `PUT /incidents/{id}/status`
Transitions incident state (`Acknowledged`, `Investigating`, `Mitigated`, `Resolved`, `Closed`). Calculates MTTR on resolve and logs timeline event.

### `POST /ai/investigate/{incident_id}`
Triggers AI root cause investigation. Synthesizes correlated logs, metrics, and trace waterfall, returning hypotheses, code diffs, confidence score, and verification steps.

### `POST /ai/feedback/{analysis_id}`
Records engineer feedback (`correct`, `incorrect`, `unresolved`), verified root cause, and PR references.

### `GET /incidents/{id}/report`
Exports a comprehensive post-mortem report in Markdown or JSON format.

---

## 5. Security, Audit & Retention (`/security`)

### `GET /security/audit-logs`
Searchable immutable audit log of all mutations, logins, and settings changes.

### `POST /security/redaction-preview`
Interactive test endpoint for the Zero-Leak Secret Redactor.

### `POST /security/retention/cleanup`
Executes data retention purge according to configured days.

### `POST /security/gdpr-delete`
Executes verified GDPR permanent data erasure for the tenant.

---

## 6. Prometheus Metrics Scrape (`/metrics/prometheus`)
Standard Prometheus exporter endpoint exporting active incidents by severity, total ingested telemetry, and platform operational health.
