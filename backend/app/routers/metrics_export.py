from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Incident, MetricEntry, LogEntry

router = APIRouter(prefix="/metrics", tags=["Metrics Exporter"])

@router.get("/prometheus", response_class=PlainTextResponse)
def prometheus_metrics(db: Session = Depends(get_db)):
    active_critical = db.query(Incident).filter(
        Incident.severity == "Critical",
        Incident.status.in_(["Triggered", "Acknowledged", "Investigating", "Mitigated"])
    ).count()

    active_high = db.query(Incident).filter(
        Incident.severity == "High",
        Incident.status.in_(["Triggered", "Acknowledged", "Investigating", "Mitigated"])
    ).count()

    active_medium = db.query(Incident).filter(
        Incident.severity == "Medium",
        Incident.status.in_(["Triggered", "Acknowledged", "Investigating", "Mitigated"])
    ).count()

    active_low = db.query(Incident).filter(
        Incident.severity == "Low",
        Incident.status.in_(["Triggered", "Acknowledged", "Investigating", "Mitigated"])
    ).count()

    total_logs = db.query(LogEntry).count()
    total_metrics = db.query(MetricEntry).count()

    lines = [
        "# HELP incidentiq_active_incidents Number of currently active incidents by severity",
        "# TYPE incidentiq_active_incidents gauge",
        f'incidentiq_active_incidents{{severity="critical"}} {active_critical}',
        f'incidentiq_active_incidents{{severity="high"}} {active_high}',
        f'incidentiq_active_incidents{{severity="medium"}} {active_medium}',
        f'incidentiq_active_incidents{{severity="low"}} {active_low}',
        "",
        "# HELP incidentiq_telemetry_logs_total Total logs collected across all tenants",
        "# TYPE incidentiq_telemetry_logs_total counter",
        f"incidentiq_telemetry_logs_total {total_logs}",
        "",
        "# HELP incidentiq_telemetry_metrics_total Total metrics datapoints collected across all tenants",
        "# TYPE incidentiq_telemetry_metrics_total counter",
        f"incidentiq_telemetry_metrics_total {total_metrics}",
        "",
        "# HELP incidentiq_health_status Overall platform operational status (1=OK)",
        "# TYPE incidentiq_health_status gauge",
        "incidentiq_health_status 1.0",
        ""
    ]
    return PlainTextResponse(content="\n".join(lines), media_type="text/plain; version=0.0.4")
