# IncidentIQ — Local Setup & Development Guide (Windows PowerShell)

This guide provides step-by-step instructions to run, develop, and test **IncidentIQ** locally on Windows using PowerShell.

---

## 1. Prerequisites

- **Python 3.10+** (Python 3.14 verified)
- **Node.js 18+** & **npm** (Node v24.14 verified)
- **PowerShell 5.1+** or **PowerShell 7+**

---

## 2. Directory Structure

Ensure you are located in the IncidentIQ project root directory:
```powershell
Set-Location -Path "C:\Users\HP\.gemini\antigravity\scratch\incidentiq"
```

---

## 3. Environment Configuration

Copy the example environment file:
```powershell
Copy-Item .env.example .env
```
*(Optional)* Add your `GEMINI_API_KEY` or `OPENAI_API_KEY` inside `.env`. If left empty, IncidentIQ automatically activates its built-in intelligent deterministic SRE heuristic engine.

---

## 4. Backend Setup & Database Initialization

### A. Install Python Dependencies
```powershell
Set-Location -Path "backend"
& "C:\Users\HP\AppData\Local\Python\bin\python.exe" -m pip install -r requirements.txt
```

### B. Seed the Database
Seed the database with organizations, applications, microservices, baseline telemetry, and realistic incidents:
```powershell
& "C:\Users\HP\AppData\Local\Python\bin\python.exe" -c "from app.seed import seed_database; seed_database()"
```

### C. Run the Backend API Server
Start the Uvicorn ASGI server on port 8000:
```powershell
& "C:\Users\HP\AppData\Local\Python\bin\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The backend API is now live at:
- **API Root**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive OpenAPI Documentation**: [http://127.0.0.1:8000/api/v1/docs](http://127.0.0.1:8000/api/v1/docs)
- **Prometheus Metrics Endpoint**: [http://127.0.0.1:8000/api/v1/metrics/prometheus](http://127.0.0.1:8000/api/v1/metrics/prometheus)

---

## 5. Frontend Setup & Launch

Open a new PowerShell window:
```powershell
Set-Location -Path "C:\Users\HP\.gemini\antigravity\scratch\incidentiq\frontend"
npm install
npm run dev
```
The React + Vite frontend will be accessible at:
- **Web Dashboard**: [http://localhost:5173](http://localhost:5173)

---

## 6. Pre-Configured Demo Credentials

Use any of the following accounts (available via one-click pre-fill buttons on the login screen):

| Role | Email | Password | Organization | Privileges |
|---|---|---|---|---|
| **Owner** | `admin@incidentiq.io` | `IncidentIQ@2026!` | Acme Financial Cloud | Full platform, GDPR purge, billing |
| **Engineer** | `engineer@incidentiq.io` | `IncidentIQ@2026!` | Acme Financial Cloud | Incident triage, AI analysis, war room |
| **Viewer** | `viewer@incidentiq.io` | `IncidentIQ@2026!` | Acme Financial Cloud | Read-only dashboards & metrics |

---

## 7. Running Automated Test Suites

### A. Backend Pytest Suite (11 Tests)
Validates auth, RBAC, tenant isolation, telemetry ingestion, incident detection, deduplication, AI structured outputs, secret redaction, and audit logging:
```powershell
Set-Location -Path "C:\Users\HP\.gemini\antigravity\scratch\incidentiq"
& "C:\Users\HP\AppData\Local\Python\bin\python.exe" -m pytest tests/test_backend.py -v
```

### B. Frontend Vitest Suite
Validates UI specs, role hierarchy, and incident lifecycle transitions:
```powershell
Set-Location -Path "C:\Users\HP\.gemini\antigravity\scratch\incidentiq\frontend"
npx vitest run
```

---

## 8. Triggering Failure Scenarios

You can trigger deliberate failure scenarios in two ways:
1. **From the Dashboard UI**: Click the **Simulate Incident** button in the top navbar and click **Inject** on any scenario (e.g. *Database Connection Pool Exhaustion*, *NullPointerException 500 Cascade*, or *JVM Heap OutOfMemoryError*).
2. **From the Sample App Script**:
   ```powershell
   & "C:\Users\HP\AppData\Local\Python\bin\python.exe" sample-app/run_simulation.py
   ```
