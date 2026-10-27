# IncidentIQ — AI-Powered Software Incident Detection & Resolution Platform

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%200.115+-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript-61DAFB.svg?style=flat&logo=react)](https://reactjs.org)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC.svg?style=flat&logo=tailwind-css)](https://tailwindcss.com)
[![OpenTelemetry](https://img.shields.io/badge/Observability-OpenTelemetry%20%2B%20Prometheus-F5A800.svg?style=flat&logo=opentelemetry)](https://opentelemetry.io)
[![SaaS](https://img.shields.io/badge/Architecture-Multi--Tenant%20Commercial%20SaaS-4F46E5.svg?style=flat)](https://github.com)

**IncidentIQ** is an enterprise-grade commercial SaaS platform engineered for IT organizations, DevOps teams, and Site Reliability Engineers to monitor distributed applications, detect software incidents in real time, automate root-cause investigation using AI, and resolve service outages significantly faster.

---

## 30 Core Features Checklist

### Module A: User and Organization Management
- [x] **1. User registration and login with secure authentication** (Argon2 password hashing, JWT bearer tokens).
- [x] **2. Role-based permissions (RBAC)** for Organization Owners, Administrators, Engineers, and Viewers.
- [x] **3. Organization creation and management** with slug generation, metadata, and custom settings.
- [x] **4. Multi-tenant organization isolation** (enforced at API dependency & database query layers).
- [x] **5. Secure session management**, password complexity, token expiration, and organization switching.

### Module B: Application Monitoring and Data Collection
- [x] **6. Register and manage multiple monitored applications** with environment tags (`production`, `staging`, `qa`).
- [x] **7. Collect, validate, and sanitize application logs** with zero-leak secret redaction.
- [x] **8. Collect real-time metrics** (RPS throughput, error rate %, CPU usage, memory usage, p50/p95 latency).
- [x] **9. Support distributed traces** and span waterfalls with OpenTelemetry (OTLP) compatibility.
- [x] **10. Filter and organize telemetry** by application, environment, service, severity level, and time range.

### Module C: Incident Detection and Management
- [x] **11. Automatically detect incidents** using configurable evaluation rules and metric thresholds.
- [x] **12. Classify incidents into Critical, High, Medium, and Low** severity tiers.
- [x] **13. Group duplicate alerts and recurring incidents** using SHA-256 fingerprint deduplication & cooldowns.
- [x] **14. Assign incidents to engineers** and track acknowledgment, investigation, mitigation, and resolution.
- [x] **15. Maintain incident timelines**, event history, engineer comments, and lifecycle updates.

### Module D: AI-Powered Investigation
- [x] **16. Analyze logs, metrics, traces, and timelines** to generate structured root-cause hypotheses.
- [x] **17. Explain supporting evidence** linking specific logs, metric spikes, and trace span IDs.
- [x] **18. Recommend actionable troubleshooting steps** and unified Git-style code/configuration diffs.
- [x] **19. Correlate related incidents** and identify recurring failure patterns across services.
- [x] **20. Provide confidence indicators (0-100%)**, human feedback loop (correct/incorrect/unresolved), and verified root-cause recording with strict SRE safety guardrails.

### Module E: Dashboard, Notifications, and Reporting
- [x] **21. Real-time incident dashboard** with System Health Index, active incidents, and MTTD/MTTR stats.
- [x] **22. Recharts performance visualizers** (RPS throughput, p50/p95 latency, error rates, CPU/memory).
- [x] **23. In-app notification center** and configurable webhook alerts (Slack, Microsoft Teams, Email).
- [x] **24. Searchable incident history** and downloadable Post-Mortem incident reports (Markdown & JSON).
- [x] **25. Analytics reports** for MTTD, MTTR, incident frequency by service, and recurring error clusters.

### Module F: Commercial SaaS Capabilities
- [x] **26. Multi-tenant data isolation** enforced across all REST API endpoints and database models.
- [x] **27. Subscription-plan tiers**: Free ($0), Starter ($79), Team ($249), and Enterprise Business ($899).
- [x] **28. Usage limits & entitlements enforcement** for monitored applications, telemetry volume, and AI quotas.
- [x] **29. Immutable audit logs** for authentication, permissions changes, and incident status updates.
- [x] **30. Data retention policies**, automated purge routines, secret redaction, and GDPR permanent data erasure.

---

## Navigable Product Pages (17 Pages)

1. **Login & Registration** (`/login`) — Sign in, create organization, and one-click demo credentials.
2. **Overview Dashboard** (`/dashboard`) — System Health Index, active incidents, golden signals, and recent alerts.
3. **Applications Inventory** (`/applications`) — Application cards, environments, health status, and ingestion keys.
4. **Application Details** (`/applications/:id`) — Microservices roster, throughput charts, and telemetry streams.
5. **Incident Management** (`/incidents`) — Filterable incident table by severity/status, search, and manual reporting.
6. **Incident Details & Timeline** (`/incidents/:id`) — Lifecycle state buttons, chronological event log, and comments.
7. **AI Investigation Console** (`/ai-investigation`) — AI root-cause hypotheses, evidence links, code diffs, and verification loop.
8. **Structured Logs Explorer** (`/logs`) — Full-text log search, severity filter pills, and live log stream.
9. **Metrics & Performance** (`/metrics`) — Interactive Recharts timeseries for throughput, latency, and error rates.
10. **Distributed Tracing** (`/traces`) — Waterfall Gantt chart visualization of spans, durations, and error root nodes.
11. **Analytics & Reports** (`/analytics`) — MTTD & MTTR benchmarks, service breakdown, and recurring clusters.
12. **Notification Center** (`/notifications`) — In-app activity feed and Slack/Teams/Email alert channel configs.
13. **Team Members & Permissions** (`/team`) — Member roster, invite dialog, role updates, and RBAC matrix.
14. **Organization Settings** (`/settings/organization`) — Organization name, unique tenant slug, and timezone.
15. **Subscription & Usage** (`/settings/billing`) — Plan tiers, entitlement usage gauges, and one-click plan upgrade.
16. **Security & Audit Logs** (`/settings/security`) — Immutable audit logs, interactive secret redactor, and GDPR erasure.
17. **User Profile** (`/profile`) — Account information, password change form, and personal assigned queue.

---

## Quick Start Instructions (Windows PowerShell)

### Step 1: Initialize Database & Seed Demo Data
```powershell
Set-Location -Path "C:\Users\HP\.gemini\antigravity\scratch\incidentiq\backend"
& "C:\Users\HP\AppData\Local\Python\bin\python.exe" -c "from app.seed import seed_database; seed_database()"
```

### Step 2: Start the FastAPI Backend
```powershell
& "C:\Users\HP\AppData\Local\Python\bin\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Docs: [http://127.0.0.1:8000/api/v1/docs](http://127.0.0.1:8000/api/v1/docs)
- Prometheus Metrics: [http://127.0.0.1:8000/api/v1/metrics/prometheus](http://127.0.0.1:8000/api/v1/metrics/prometheus)

### Step 3: Start the React Frontend
In a new terminal:
```powershell
Set-Location -Path "C:\Users\HP\.gemini\antigravity\scratch\incidentiq\frontend"
npm run dev
```
- Web Application: [http://localhost:5173](http://localhost:5173)

---

## Demo Credentials (Pre-Configured)

| Role | Email | Password | Organization | Capabilities |
|---|---|---|---|---|
| **Owner** | `admin@incidentiq.io` | `IncidentIQ@2026!` | Acme Financial Cloud | Full platform, GDPR purge, billing |
| **Engineer** | `engineer@incidentiq.io` | `IncidentIQ@2026!` | Acme Financial Cloud | Incident triage, AI analysis, war room |
| **Viewer** | `viewer@incidentiq.io` | `IncidentIQ@2026!` | Acme Financial Cloud | Read-only dashboards & metrics |

---

## Automated Test Verification

### Backend Pytest Suite (11 Tests Passing)
```powershell
Set-Location -Path "C:\Users\HP\.gemini\antigravity\scratch\incidentiq"
& "C:\Users\HP\AppData\Local\Python\bin\python.exe" -m pytest tests/test_backend.py -v
```
Verifies authentication, cross-tenant isolation prevention, telemetry ingestion, incident detection, fingerprint deduplication, status transitions, AI fallback, secret redaction, audit logging, and Prometheus exporter.

### Frontend Vitest Suite
```powershell
Set-Location -Path "C:\Users\HP\.gemini\antigravity\scratch\incidentiq\frontend"
npx vitest run
```
Verifies page routing definitions, RBAC role hierarchy, and incident lifecycle status states.

---

## Live Failure Simulation Suite

Trigger simulated incidents on demand:
- **From UI**: Click **Simulate Incident** in the top navbar and click **Inject** on any scenario.
- **From CLI**: Run the Spring Boot failure simulator:
  ```powershell
  & "C:\Users\HP\AppData\Local\Python\bin\python.exe" sample-app/run_simulation.py
  ```

---

## Docker Deployment

To launch the complete platform with Docker Compose:
```powershell
docker-compose up --build
```
Orchestrates FastAPI Backend, React Frontend (Nginx), OpenTelemetry Collector (ports 4317/4318), and Prometheus (port 9090).
