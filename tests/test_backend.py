import pytest
import os
import sys

# Ensure backend root is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.seed import seed_database
from app.models import User, Organization, OrganizationMember, Application, Incident, LogEntry, MetricEntry
from app.security import hash_password, create_access_token, generate_api_key

client = TestClient(app)

@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    seed_database()
    yield

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_auth_login_valid():
    response = client.post("/api/v1/auth/login", json={
        "email": "admin@incidentiq.io",
        "password": "IncidentIQ@2026!"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "admin@incidentiq.io"
    assert data["current_organization"]["name"] == "Acme Financial Cloud"

def test_auth_login_invalid():
    response = client.post("/api/v1/auth/login", json={
        "email": "admin@incidentiq.io",
        "password": "WrongPassword123!"
    })
    assert response.status_code == 401

def test_cross_tenant_isolation():
    # Login as admin in Acme Financial Cloud
    login_resp = client.post("/api/v1/auth/login", json={
        "email": "admin@incidentiq.io",
        "password": "IncidentIQ@2026!"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch applications in Acme
    acme_apps = client.get("/api/v1/applications", headers=headers).json()
    assert len(acme_apps) >= 2
    app_ids = [a["name"] for a in acme_apps]
    assert "Payment Processing Engine" in app_ids

    # Switch to Apex Cloud Systems
    apex_org_id = next(o["id"] for o in login_resp.json()["organizations"] if o["slug"] == "apex-cloud")
    switch_resp = client.post(f"/api/v1/auth/switch-org?org_id={apex_org_id}", headers=headers)
    assert switch_resp.status_code == 200
    apex_token = switch_resp.json()["access_token"]
    apex_headers = {"Authorization": f"Bearer {apex_token}", "X-Organization-Id": apex_org_id}

    # Apex should have 0 applications initially or isolated from Acme's apps
    apex_apps = client.get("/api/v1/applications", headers=apex_headers).json()
    apex_app_names = [a["name"] for a in apex_apps]
    assert "Payment Processing Engine" not in apex_app_names

def test_telemetry_ingestion_and_incident_detection():
    login_resp = client.post("/api/v1/auth/login", json={
        "email": "admin@incidentiq.io",
        "password": "IncidentIQ@2026!"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    app_resp = client.post("/api/v1/applications", json={
        "name": "Integration Test App",
        "description": "Used for automated detection tests"
    }, headers=headers)
    assert app_resp.status_code == 200
    app_data = app_resp.json()
    raw_api_key = app_data["api_key"]

    # Ingest fatal log with app API key
    ingest_headers = {"X-API-Key": raw_api_key}
    log_resp = client.post("/api/v1/telemetry/logs", json={
        "logs": [{
            "service_name": "checkout-service",
            "level": "FATAL",
            "message": "java.lang.OutOfMemoryError: Java heap space crash in memory pool",
            "environment": "production"
        }]
    }, headers=ingest_headers)
    assert log_resp.status_code == 200

    # Verify incident created
    incidents_resp = client.get("/api/v1/incidents", headers=headers)
    assert incidents_resp.status_code == 200
    incidents = incidents_resp.json()
    crashes = [i for i in incidents if i["service_name"] == "checkout-service"]
    assert len(crashes) >= 1
    target_inc = crashes[0]
    assert target_inc["severity"] == "Critical"

def test_incident_deduplication():
    login_resp = client.post("/api/v1/auth/login", json={
        "email": "admin@incidentiq.io",
        "password": "IncidentIQ@2026!"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    apps = client.get("/api/v1/applications", headers=headers).json()
    test_app = next(a for a in apps if a["name"] == "Integration Test App")

    rotate_resp = client.post(f"/api/v1/applications/{test_app['id']}/api-key", headers=headers)
    raw_key = rotate_resp.json()["api_key"]

    count_before = len(client.get("/api/v1/incidents", headers=headers).json())

    # Send duplicate error
    client.post("/api/v1/telemetry/logs", json={
        "logs": [{
            "service_name": "checkout-service",
            "level": "FATAL",
            "message": "java.lang.OutOfMemoryError: Java heap space crash in memory pool",
            "environment": "production"
        }]
    }, headers={"X-API-Key": raw_key})

    count_after = len(client.get("/api/v1/incidents", headers=headers).json())
    assert count_after == count_before

def test_incident_status_lifecycle():
    login_resp = client.post("/api/v1/auth/login", json={
        "email": "admin@incidentiq.io",
        "password": "IncidentIQ@2026!"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    incidents = client.get("/api/v1/incidents", headers=headers).json()
    assert len(incidents) > 0
    inc_id = incidents[0]["id"]

    res = client.put(f"/api/v1/incidents/{inc_id}/status", json={"status": "Acknowledged", "notes": "On-call investigating"}, headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == "Acknowledged"

    res2 = client.put(f"/api/v1/incidents/{inc_id}/status", json={"status": "Resolved", "notes": "Deployed hotfix"}, headers=headers)
    assert res2.status_code == 200
    assert res2.json()["status"] == "Resolved"
    assert res2.json()["mttr_seconds"] is not None

def test_ai_investigation_and_fallback():
    login_resp = client.post("/api/v1/auth/login", json={
        "email": "admin@incidentiq.io",
        "password": "IncidentIQ@2026!"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    incidents = client.get("/api/v1/incidents", headers=headers).json()
    inc_id = incidents[0]["id"]

    ai_resp = client.post(f"/api/v1/ai/investigate/{inc_id}?force_refresh=true", headers=headers)
    assert ai_resp.status_code == 200
    data = ai_resp.json()
    assert "summary" in data
    assert "root_cause_hypothesis" in data
    assert data["confidence_score"] >= 0.70
    assert len(data["recommended_steps"]) > 0

    analysis_id = data["id"]
    fb_resp = client.post(f"/api/v1/ai/feedback/{analysis_id}", json={
        "feedback_status": "correct",
        "verified_root_cause": "Verified: HikariCP connection pool lock",
        "feedback_notes": "Increased maximumPoolSize to 30 in prod"
    }, headers=headers)
    assert fb_resp.status_code == 200
    assert fb_resp.json()["feedback_status"] == "correct"

def test_secret_redaction_engine():
    login_resp = client.post("/api/v1/auth/login", json={
        "email": "admin@incidentiq.io",
        "password": "IncidentIQ@2026!"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    sample_log = "Error in auth service: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token123 and password: 'SuperSecretPassword123' api_key: iq_live_998877665544332211"
    resp = client.post("/api/v1/security/redaction-preview", json={"text": sample_log}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "SuperSecretPassword123" not in data["redacted_text"]
    assert "Bearer [REDACTED_TOKEN]" in data["redacted_text"]
    assert "[REDACTED_SECRET]" in data["redacted_text"]
    assert "[REDACTED_API_KEY]" in data["redacted_text"]

def test_audit_logs_recorded():
    login_resp = client.post("/api/v1/auth/login", json={
        "email": "admin@incidentiq.io",
        "password": "IncidentIQ@2026!"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v1/security/audit-logs", headers=headers)
    assert resp.status_code == 200
    logs = resp.json()
    assert len(logs) > 0

def test_prometheus_metrics_endpoint():
    resp = client.get("/api/v1/metrics/prometheus")
    assert resp.status_code == 200
    text = resp.text
    assert "incidentiq_active_incidents" in text
    assert "incidentiq_health_status" in text
