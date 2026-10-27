import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean, DateTime,
    ForeignKey, JSON, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    memberships = relationship("OrganizationMember", back_populates="user", cascade="all, delete-orphan")
    comments = relationship("IncidentComment", back_populates="user")
    assigned_incidents = relationship("Incident", back_populates="assignee", foreign_keys="Incident.assigned_to_user_id")

class Organization(Base):
    __tablename__ = "organizations"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    plan_tier = Column(String(50), default="free")  # free, starter, team, business
    settings_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    members = relationship("OrganizationMember", back_populates="organization", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="organization", cascade="all, delete-orphan")
    incidents = relationship("Incident", back_populates="organization", cascade="all, delete-orphan")
    notification_channels = relationship("NotificationChannel", back_populates="organization", cascade="all, delete-orphan")
    retention_policy = relationship("RetentionPolicy", back_populates="organization", uselist=False, cascade="all, delete-orphan")
    usage_records = relationship("UsageRecord", back_populates="organization", cascade="all, delete-orphan")
    subscription = relationship("OrganizationSubscription", back_populates="organization", uselist=False, cascade="all, delete-orphan")

class OrganizationMember(Base):
    __tablename__ = "organization_members"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), default="engineer")  # owner, admin, engineer, viewer
    joined_at = Column(DateTime, default=utc_now)
    
    organization = relationship("Organization", back_populates="members")
    user = relationship("User", back_populates="memberships")
    
    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_org_member"),
    )

class Application(Base):
    __tablename__ = "applications"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    api_key_hash = Column(String(255), nullable=False, index=True)
    api_key_prefix = Column(String(32), nullable=False)
    environments_json = Column(JSON, default=lambda: ["production", "staging", "qa"])
    status = Column(String(50), default="active")  # active, warning, critical, paused
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    organization = relationship("Organization", back_populates="applications")
    services = relationship("Service", back_populates="application", cascade="all, delete-orphan")
    incidents = relationship("Incident", back_populates="application", cascade="all, delete-orphan")
    detection_rules = relationship("DetectionRule", back_populates="application", cascade="all, delete-orphan")
    
    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_app_org_slug"),
    )

class Service(Base):
    __tablename__ = "services"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    language = Column(String(50), default="python")  # java, python, go, node, rust
    tier = Column(String(50), default="backend")     # frontend, api-gateway, backend, database, queue
    health_status = Column(String(50), default="healthy")  # healthy, degraded, failing
    created_at = Column(DateTime, default=utc_now)
    
    application = relationship("Application", back_populates="services")
    
    __table_args__ = (
        UniqueConstraint("application_id", "name", name="uq_service_app_name"),
    )

class LogEntry(Base):
    __tablename__ = "log_entries"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    environment = Column(String(50), default="production", index=True)
    service_name = Column(String(100), nullable=False, index=True)
    level = Column(String(20), nullable=False, index=True)  # DEBUG, INFO, WARN, ERROR, FATAL
    message = Column(Text, nullable=False)
    raw_message = Column(Text, nullable=True)
    context_data = Column(JSON, default=dict)
    trace_id = Column(String(64), nullable=True, index=True)
    span_id = Column(String(64), nullable=True)
    timestamp = Column(DateTime, default=utc_now, index=True)
    
    __table_args__ = (
        Index("idx_logs_org_app_time", "organization_id", "application_id", "timestamp"),
        Index("idx_logs_level_time", "organization_id", "level", "timestamp"),
    )

class MetricEntry(Base):
    __tablename__ = "metric_entries"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    environment = Column(String(50), default="production", index=True)
    service_name = Column(String(100), nullable=False, index=True)
    metric_name = Column(String(100), nullable=False, index=True)  # http_requests_total, response_time_ms, error_rate_pct, cpu_usage_pct, memory_usage_mb
    value = Column(Float, nullable=False)
    unit = Column(String(30), default="ms")
    tags = Column(JSON, default=dict)
    timestamp = Column(DateTime, default=utc_now, index=True)
    
    __table_args__ = (
        Index("idx_metrics_lookup", "organization_id", "application_id", "metric_name", "timestamp"),
    )

class TraceSpan(Base):
    __tablename__ = "trace_spans"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    trace_id = Column(String(64), nullable=False, index=True)
    span_id = Column(String(64), nullable=False, index=True)
    parent_span_id = Column(String(64), nullable=True)
    service_name = Column(String(100), nullable=False, index=True)
    name = Column(String(255), nullable=False)  # e.g., "GET /api/v1/orders/checkout"
    start_time = Column(DateTime, default=utc_now, index=True)
    duration_ms = Column(Float, nullable=False)
    status_code = Column(String(20), default="OK")  # OK, ERROR, UNSET
    status_message = Column(Text, nullable=True)
    attributes = Column(JSON, default=dict)
    events = Column(JSON, default=list)
    
    __table_args__ = (
        Index("idx_traces_org_trace", "organization_id", "trace_id"),
    )

class DetectionRule(Base):
    __tablename__ = "detection_rules"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    rule_type = Column(String(50), nullable=False)  # error_rate, latency, http_5xx, crash, db_timeout, cpu_memory, service_failures
    severity = Column(String(20), default="High")   # Critical, High, Medium, Low
    metric_target = Column(String(100), nullable=False)
    threshold_value = Column(Float, nullable=False)
    evaluation_window_seconds = Column(Integer, default=60)
    cooldown_seconds = Column(Integer, default=300)
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    
    application = relationship("Application", back_populates="detection_rules")

class Incident(Base):
    __tablename__ = "incidents"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    application_id = Column(String(36), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    fingerprint = Column(String(64), nullable=False, index=True)
    severity = Column(String(20), default="High", index=True)  # Critical, High, Medium, Low
    status = Column(String(30), default="Triggered", index=True)  # Triggered, Acknowledged, Investigating, Mitigated, Resolved, Closed
    source_rule_id = Column(String(36), ForeignKey("detection_rules.id", ondelete="SET NULL"), nullable=True)
    service_name = Column(String(100), nullable=False, index=True)
    environment = Column(String(50), default="production", index=True)
    description = Column(Text, nullable=True)
    trigger_value = Column(String(255), nullable=True)
    assigned_to_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    created_at = Column(DateTime, default=utc_now, index=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    mttd_seconds = Column(Integer, default=45)
    mttr_seconds = Column(Integer, nullable=True)
    
    organization = relationship("Organization", back_populates="incidents")
    application = relationship("Application", back_populates="incidents")
    assignee = relationship("User", back_populates="assigned_incidents", foreign_keys=[assigned_to_user_id])
    events = relationship("IncidentEvent", back_populates="incident", cascade="all, delete-orphan", order_by="IncidentEvent.created_at.desc()")
    comments = relationship("IncidentComment", back_populates="incident", cascade="all, delete-orphan", order_by="IncidentComment.created_at.asc()")
    ai_analyses = relationship("AIAnalysis", back_populates="incident", cascade="all, delete-orphan", order_by="AIAnalysis.created_at.desc()")
    notifications = relationship("Notification", back_populates="incident", cascade="all, delete-orphan")

class IncidentEvent(Base):
    __tablename__ = "incident_events"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    incident_id = Column(String(36), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)  # detected, acknowledged, status_change, assigned, comment, ai_analyzed, alert_sent, resolved
    actor_type = Column(String(30), default="system")  # system, user, ai
    actor_id = Column(String(36), nullable=True)
    actor_name = Column(String(255), default="System Engine")
    message = Column(Text, nullable=False)
    data = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utc_now, index=True)
    
    incident = relationship("Incident", back_populates="events")

class AIAnalysis(Base):
    __tablename__ = "ai_analyses"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    incident_id = Column(String(36), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    model_name = Column(String(100), default="IncidentIQ Engine")
    summary = Column(Text, nullable=False)
    root_cause_hypothesis = Column(Text, nullable=False)
    supporting_evidence = Column(JSON, default=list)  # list of evidence objects {type, id, snippet, timestamp}
    alternative_causes = Column(JSON, default=list)
    confidence_score = Column(Float, default=0.90)    # 0.0 to 1.0
    recommended_steps = Column(JSON, default=list)
    code_fix_diff = Column(Text, nullable=True)       # unified git diff or config patch
    verification_steps = Column(JSON, default=list)
    
    feedback_status = Column(String(30), default="pending")  # pending, correct, incorrect, unresolved
    verified_root_cause = Column(Text, nullable=True)
    feedback_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    incident = relationship("Incident", back_populates="ai_analyses")

class IncidentComment(Base):
    __tablename__ = "incident_comments"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    incident_id = Column(String(36), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    author_name = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utc_now)
    
    incident = relationship("Incident", back_populates="comments")
    user = relationship("User", back_populates="comments")

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    incident_id = Column(String(36), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    channel_type = Column(String(30), default="in_app")  # in_app, email, slack, teams
    severity = Column(String(20), default="High")
    status = Column(String(30), default="unread")        # unread, read, delivered, failed
    error_detail = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, index=True)
    
    incident = relationship("Incident", back_populates="notifications")

class NotificationChannel(Base):
    __tablename__ = "notification_channels"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    channel_type = Column(String(30), nullable=False)  # email, slack, teams, webhook
    name = Column(String(255), nullable=False)
    config = Column(JSON, default=dict)  # webhook_url, recipients, channel_name
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)
    
    organization = relationship("Organization", back_populates="notification_channels")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), nullable=True)
    user_email = Column(String(255), nullable=True)
    action = Column(String(100), nullable=False, index=True)  # user.login, incident.ack, incident.resolve, org.update
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String(36), nullable=True)
    ip_address = Column(String(50), default="127.0.0.1")
    details = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utc_now, index=True)

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    tier = Column(String(50), unique=True, nullable=False)  # free, starter, team, business
    name = Column(String(100), nullable=False)
    max_apps = Column(Integer, default=2)
    max_monthly_events = Column(Integer, default=50000)
    max_ai_investigations_monthly = Column(Integer, default=15)
    retention_days = Column(Integer, default=7)
    price_usd_monthly = Column(Float, default=0.0)
    features = Column(JSON, default=list)

class OrganizationSubscription(Base):
    __tablename__ = "organization_subscriptions"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), unique=True, nullable=False)
    plan_tier = Column(String(50), default="starter")
    status = Column(String(30), default="active")  # active, past_due, canceled
    current_period_start = Column(DateTime, default=utc_now)
    current_period_end = Column(DateTime, nullable=True)
    
    organization = relationship("Organization", back_populates="subscription")

class UsageRecord(Base):
    __tablename__ = "usage_records"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    period_ym = Column(String(7), nullable=False)  # "2026-10"
    events_ingested = Column(Integer, default=0)
    ai_investigations_used = Column(Integer, default=0)
    apps_count = Column(Integer, default=0)
    last_updated = Column(DateTime, default=utc_now, onupdate=utc_now)
    
    organization = relationship("Organization", back_populates="usage_records")
    
    __table_args__ = (
        UniqueConstraint("organization_id", "period_ym", name="uq_org_period_usage"),
    )

class RetentionPolicy(Base):
    __tablename__ = "retention_policies"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), unique=True, nullable=False)
    logs_retention_days = Column(Integer, default=30)
    metrics_retention_days = Column(Integer, default=90)
    traces_retention_days = Column(Integer, default=14)
    auto_clean_enabled = Column(Boolean, default=True)
    last_cleanup_at = Column(DateTime, nullable=True)
    
    organization = relationship("Organization", back_populates="retention_policy")
