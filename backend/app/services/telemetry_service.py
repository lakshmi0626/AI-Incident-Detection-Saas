from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models import (
    LogEntry, MetricEntry, TraceSpan, Application, 
    Organization, UsageRecord, SubscriptionPlan
)
from app.security import redact_secrets, redact_data_structure
from app.services.detection_engine import DetectionEngine

class TelemetryService:
    def __init__(self, db: Session):
        self.db = db
        self.detection_engine = DetectionEngine(db)

    def _check_and_increment_usage(self, org_id: str, count: int = 1):
        now = datetime.now(timezone.utc)
        period_ym = now.strftime("%Y-%m")
        
        usage = self.db.query(UsageRecord).filter(
            UsageRecord.organization_id == org_id,
            UsageRecord.period_ym == period_ym
        ).first()

        if not usage:
            usage = UsageRecord(
                organization_id=org_id,
                period_ym=period_ym,
                events_ingested=0,
                ai_investigations_used=0,
                apps_count=1
            )
            self.db.add(usage)

        usage.events_ingested += count
        usage.last_updated = now

    def ingest_logs(self, app: Application, logs: List[Dict[str, Any]]) -> int:
        self._check_and_increment_usage(app.organization_id, len(logs))
        created_count = 0
        now = datetime.now(timezone.utc)

        for item in logs:
            sanitized_msg = redact_secrets(item.get("message", ""))
            raw_msg = item.get("raw_message", item.get("message", ""))
            sanitized_context = redact_data_structure(item.get("context_data", {}))
            level = item.get("level", "INFO").upper()
            service = item.get("service_name", "app-service")
            env = item.get("environment", "production")

            entry = LogEntry(
                organization_id=app.organization_id,
                application_id=app.id,
                environment=env,
                service_name=service,
                level=level,
                message=sanitized_msg,
                raw_message=raw_msg[:1000] if raw_msg else None,
                context_data=sanitized_context,
                trace_id=item.get("trace_id"),
                span_id=item.get("span_id"),
                timestamp=item.get("timestamp") or now
            )
            self.db.add(entry)
            created_count += 1

            # Real-time incident detection evaluation
            self.detection_engine.evaluate_log(
                org_id=app.organization_id,
                app_id=app.id,
                service=service,
                level=level,
                message=sanitized_msg,
                env=env
            )

        self.db.commit()
        return created_count

    def ingest_metrics(self, app: Application, metrics: List[Dict[str, Any]]) -> int:
        self._check_and_increment_usage(app.organization_id, len(metrics))
        created_count = 0
        now = datetime.now(timezone.utc)

        for item in metrics:
            metric_name = item.get("metric_name")
            val = float(item.get("value", 0.0))
            service = item.get("service_name", "app-service")
            env = item.get("environment", "production")

            entry = MetricEntry(
                organization_id=app.organization_id,
                application_id=app.id,
                environment=env,
                service_name=service,
                metric_name=metric_name,
                value=val,
                unit=item.get("unit", "ms"),
                tags=item.get("tags", {}),
                timestamp=item.get("timestamp") or now
            )
            self.db.add(entry)
            created_count += 1

            # Real-time incident detection evaluation
            self.detection_engine.evaluate_metric(
                org_id=app.organization_id,
                app_id=app.id,
                service=service,
                metric_name=metric_name,
                value=val,
                env=env
            )

        self.db.commit()
        return created_count

    def ingest_traces(self, app: Application, spans: List[Dict[str, Any]]) -> int:
        self._check_and_increment_usage(app.organization_id, len(spans))
        created_count = 0
        now = datetime.now(timezone.utc)

        for s in spans:
            sanitized_attrs = redact_data_structure(s.get("attributes", {}))
            entry = TraceSpan(
                organization_id=app.organization_id,
                application_id=app.id,
                trace_id=s.get("trace_id"),
                span_id=s.get("span_id"),
                parent_span_id=s.get("parent_span_id"),
                service_name=s.get("service_name", "app-service"),
                name=s.get("name", "operation"),
                start_time=s.get("start_time") or now,
                duration_ms=float(s.get("duration_ms", 0.0)),
                status_code=s.get("status_code", "OK"),
                status_message=redact_secrets(s.get("status_message")),
                attributes=sanitized_attrs,
                events=s.get("events", [])
            )
            self.db.add(entry)
            created_count += 1

        self.db.commit()
        return created_count
