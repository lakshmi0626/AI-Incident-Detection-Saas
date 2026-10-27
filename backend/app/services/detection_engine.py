import hashlib
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models import (
    Incident, IncidentEvent, DetectionRule, Application, 
    LogEntry, MetricEntry, Notification, NotificationChannel
)

def generate_fingerprint(application_id: str, service_name: str, rule_type: str, error_signature: str) -> str:
    raw = f"{application_id}:{service_name}:{rule_type}:{error_signature.strip().lower()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]

class DetectionEngine:
    def __init__(self, db: Session):
        self.db = db

    def evaluate_metric(self, org_id: str, app_id: str, service: str, metric_name: str, value: float, env: str = "production"):
        """Evaluates incoming metrics against active rules for the app/org."""
        rules = self.db.query(DetectionRule).filter(
            DetectionRule.organization_id == org_id,
            DetectionRule.is_enabled == True,
            (DetectionRule.application_id == app_id) | (DetectionRule.application_id == None),
            DetectionRule.metric_target == metric_name
        ).all()

        for rule in rules:
            if value >= rule.threshold_value:
                # Triggered!
                error_sig = f"{rule.rule_type}:{metric_name}>={rule.threshold_value}"
                title = f"{rule.name}: {metric_name} exceeded {rule.threshold_value} (value: {value:.1f})"
                self.process_trigger(
                    org_id=org_id,
                    app_id=app_id,
                    service=service,
                    rule=rule,
                    title=title,
                    error_sig=error_sig,
                    severity=rule.severity,
                    trigger_val=f"{value:.2f} (threshold: {rule.threshold_value})",
                    env=env
                )

    def evaluate_log(self, org_id: str, app_id: str, service: str, level: str, message: str, env: str = "production"):
        """Checks error logs for crash patterns, DB timeouts, or 5xx storms."""
        level_upper = level.upper()
        msg_lower = message.lower()
        
        rule_type = None
        severity = "High"
        title = None
        error_sig = None

        if "outofmemoryerror" in msg_lower or "fatal" in level_upper or "sigsegv" in msg_lower or "crash" in msg_lower:
            rule_type = "crash"
            severity = "Critical"
            title = f"Fatal Application Crash in {service}"
            error_sig = message[:120]
        elif "hikaricp" in msg_lower or "connection is not available" in msg_lower or "db_timeout" in msg_lower or "lock wait timeout" in msg_lower:
            rule_type = "db_timeout"
            severity = "Critical"
            title = f"Database Connection Pool Exhaustion in {service}"
            error_sig = "db_connection_pool_timeout"
        elif "500 internal server error" in msg_lower or "status_code 500" in msg_lower or level_upper == "FATAL":
            rule_type = "http_5xx"
            severity = "High"
            title = f"HTTP 5xx Server Error Burst in {service}"
            error_sig = message[:100]
        elif level_upper == "ERROR":
            rule_type = "error_rate"
            severity = "Medium"
            title = f"Unhandled Error in {service}"
            error_sig = message[:100]

        if rule_type:
            # Check if there is an explicit detection rule or use built-in default
            rule = self.db.query(DetectionRule).filter(
                DetectionRule.organization_id == org_id,
                DetectionRule.rule_type == rule_type,
                DetectionRule.is_enabled == True
            ).first()

            if rule and rule.severity:
                severity = rule.severity

            self.process_trigger(
                org_id=org_id,
                app_id=app_id,
                service=service,
                rule=rule,
                title=title,
                error_sig=error_sig or message[:80],
                severity=severity,
                trigger_val=message[:150],
                env=env
            )

    def process_trigger(
        self, org_id: str, app_id: str, service: str, 
        rule: Optional[DetectionRule], title: str, 
        error_sig: str, severity: str, trigger_val: str, env: str
    ):
        fingerprint = generate_fingerprint(app_id, service, rule.rule_type if rule else "auto", error_sig)
        now = datetime.now(timezone.utc)

        # Check for open incident with same fingerprint
        open_incident = self.db.query(Incident).filter(
            Incident.organization_id == org_id,
            Incident.fingerprint == fingerprint,
            Incident.status.in_(["Triggered", "Acknowledged", "Investigating", "Mitigated"])
        ).first()

        if open_incident:
            # Deduplicate! Group event into existing incident
            event = IncidentEvent(
                incident_id=open_incident.id,
                event_type="alert_grouped",
                actor_type="system",
                actor_name="Detection Engine",
                message=f"Duplicate alert grouped: {title}. Current reading: {trigger_val}",
                data={"trigger_value": trigger_val, "timestamp": now.isoformat()}
            )
            self.db.add(event)
            open_incident.updated_at = now
            self.db.commit()
            return open_incident

        # Check for recently resolved incident within 15 minutes (Reopening logic)
        recent_threshold = now - timedelta(minutes=15)
        resolved_incident = self.db.query(Incident).filter(
            Incident.organization_id == org_id,
            Incident.fingerprint == fingerprint,
            Incident.status.in_(["Resolved", "Closed"]),
            Incident.resolved_at >= recent_threshold
        ).first()

        if resolved_incident:
            resolved_incident.status = "Triggered"
            resolved_incident.updated_at = now
            event = IncidentEvent(
                incident_id=resolved_incident.id,
                event_type="reopened",
                actor_type="system",
                actor_name="Detection Engine",
                message=f"Incident Reopened: Regression detected within cooldown period. Reading: {trigger_val}",
                data={"regression_trigger": trigger_val, "previous_status": "Resolved"}
            )
            self.db.add(event)
            self.db.commit()
            return resolved_incident

        # Create new incident
        new_incident = Incident(
            organization_id=org_id,
            application_id=app_id,
            title=title,
            fingerprint=fingerprint,
            severity=severity,
            status="Triggered",
            source_rule_id=rule.id if rule else None,
            service_name=service,
            environment=env,
            description=f"Automated incident detected by rule '{rule.name if rule else 'Heuristic Filter'}'. Trigger condition: {trigger_val}",
            trigger_value=trigger_val,
            created_at=now,
            updated_at=now,
            mttd_seconds=35
        )
        self.db.add(new_incident)
        self.db.flush()

        # Add initial detection event
        initial_event = IncidentEvent(
            incident_id=new_incident.id,
            event_type="detected",
            actor_type="system",
            actor_name="Detection Engine",
            message=f"Incident detected with severity {severity} for service '{service}'. Condition: {trigger_val}",
            data={"rule": rule.name if rule else "Auto-Heuristic", "trigger": trigger_val}
        )
        self.db.add(initial_event)

        # Dispatch In-App Notification
        notif = Notification(
            organization_id=org_id,
            incident_id=new_incident.id,
            title=f"[{severity.upper()}] {new_incident.title}",
            message=f"Service '{service}' in {env} triggered an incident: {trigger_val}",
            channel_type="in_app",
            severity=severity,
            status="unread"
        )
        self.db.add(notif)

        # Also queue channel notifications (Slack/Teams/Email)
        channels = self.db.query(NotificationChannel).filter(
            NotificationChannel.organization_id == org_id,
            NotificationChannel.is_active == True
        ).all()
        for ch in channels:
            ch_notif = Notification(
                organization_id=org_id,
                incident_id=new_incident.id,
                title=f"[{severity.upper()}] {new_incident.title}",
                message=f"Service '{service}' in {env} triggered an incident: {trigger_val}",
                channel_type=ch.channel_type,
                severity=severity,
                status="delivered"  # simulated dispatch
            )
            self.db.add(ch_notif)

        self.db.commit()
        return new_incident
