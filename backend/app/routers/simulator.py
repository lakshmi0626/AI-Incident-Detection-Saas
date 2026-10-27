from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Application
from app.dependencies import get_current_tenant, require_role, TenantContext
from app.services.telemetry_simulator import TelemetrySimulator

router = APIRouter(prefix="/simulator", tags=["Telemetry Simulator"])

SCENARIOS = [
    {
        "id": "db_pool_timeout",
        "name": "Database Connection Pool Saturation",
        "service": "payment-gateway",
        "severity": "Critical",
        "description": "Simulates HikariCP connection pool exhaustion with 30,000ms acquisition timeouts and SQLTransientConnectionExceptions."
    },
    {
        "id": "500_cascade",
        "name": "HTTP 500 Unhandled NullPointer Cascade",
        "service": "order-api",
        "severity": "High",
        "description": "Simulates an unhandled NullPointerException in checkout pipeline creating a sudden 68% error rate surge."
    },
    {
        "id": "memory_leak",
        "name": "JVM Heap Saturation & OutOfMemoryError",
        "service": "inventory-service",
        "severity": "Critical",
        "description": "Simulates rapid heap memory leak reaching 99% usage with 4-second Stop-The-World GC pauses."
    },
    {
        "id": "auth_latency",
        "name": "Downstream Token Verification Latency Spike",
        "service": "auth-service",
        "severity": "High",
        "description": "Simulates JWKS provider timeout causing thread pool saturation and p95 latency spike > 4,600ms."
    },
    {
        "id": "partner_503",
        "name": "Third-Party SMS Gateway 503 Outage",
        "service": "notification-worker",
        "severity": "Medium",
        "description": "Simulates third-party provider failure with exponential backoff exhaustion."
    }
]

@router.get("/scenarios")
def get_scenarios():
    return SCENARIOS

@router.post("/trigger")
def trigger_scenario(
    payload: Dict[str, str] = Body(...),
    ctx: TenantContext = Depends(require_role(["owner", "admin", "engineer"])),
    db: Session = Depends(get_db)
):
    scenario_id = payload.get("scenario_id", "db_pool_timeout")
    app_id = payload.get("application_id")

    # Find application
    app = None
    if app_id:
        app = db.query(Application).filter(
            Application.id == app_id,
            Application.organization_id == ctx.organization.id
        ).first()
    if not app:
        app = db.query(Application).filter(
            Application.organization_id == ctx.organization.id
        ).first()

    if not app:
        raise HTTPException(
            status_code=400,
            detail="No applications registered in this organization. Create an application first."
        )

    sim = TelemetrySimulator(db)
    result = sim.trigger_scenario(app, scenario_id)
    return result

@router.post("/heartbeat")
def trigger_heartbeat(
    ctx: TenantContext = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    app = db.query(Application).filter(
        Application.organization_id == ctx.organization.id
    ).first()
    if not app:
        raise HTTPException(status_code=400, detail="No application found to emit baseline telemetry")

    sim = TelemetrySimulator(db)
    sim.generate_heartbeat(app)
    return {"status": "ok", "message": f"Normal operational telemetry generated for app '{app.name}' across 5 services"}
