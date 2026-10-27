from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, EmailStr, Field

# User & Auth
class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2)
    organization_name: Optional[str] = "Acme Corp"

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]
    current_organization: Dict[str, Any]
    organizations: List[Dict[str, Any]]

class UserProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str
    is_active: bool
    is_superuser: bool
    created_at: datetime
    role: Optional[str] = None

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)

# Organization & Members
class OrganizationCreateRequest(BaseModel):
    name: str
    slug: Optional[str] = None

class OrganizationResponse(BaseModel):
    id: str
    name: str
    slug: str
    plan_tier: str
    settings_json: Dict[str, Any]
    created_at: datetime
    role: Optional[str] = None
    member_count: Optional[int] = None
    app_count: Optional[int] = None

class MemberInviteRequest(BaseModel):
    email: EmailStr
    role: str = "engineer"  # owner, admin, engineer, viewer

class MemberResponse(BaseModel):
    id: str
    user_id: str
    email: str
    full_name: str
    role: str
    joined_at: datetime

class MemberRoleUpdateRequest(BaseModel):
    role: str

# Application & Service
class ApplicationCreateRequest(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    environments: Optional[List[str]] = ["production", "staging", "qa"]

class ApplicationResponse(BaseModel):
    id: str
    organization_id: str
    name: str
    slug: str
    description: Optional[str] = None
    api_key_prefix: str
    api_key: Optional[str] = None  # only returned upon creation
    environments_json: List[str]
    status: str
    created_at: datetime
    services_count: Optional[int] = 0
    active_incidents_count: Optional[int] = 0

class ServiceCreateRequest(BaseModel):
    name: str
    language: str = "python"
    tier: str = "backend"

class ServiceResponse(BaseModel):
    id: str
    application_id: str
    name: str
    language: str
    tier: str
    health_status: str
    created_at: datetime

# Telemetry
class LogIngestItem(BaseModel):
    level: str = "INFO"
    service_name: str
    environment: Optional[str] = "production"
    message: str
    context_data: Optional[Dict[str, Any]] = None
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
    timestamp: Optional[datetime] = None

class LogIngestRequest(BaseModel):
    logs: List[LogIngestItem]

class MetricIngestItem(BaseModel):
    metric_name: str
    service_name: str
    environment: Optional[str] = "production"
    value: float
    unit: Optional[str] = "ms"
    tags: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None

class MetricIngestRequest(BaseModel):
    metrics: List[MetricIngestItem]

class TraceSpanItem(BaseModel):
    trace_id: str
    span_id: str
    parent_span_id: Optional[str] = None
    service_name: str
    name: str
    start_time: Optional[datetime] = None
    duration_ms: float
    status_code: Optional[str] = "OK"
    status_message: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = None
    events: Optional[List[Dict[str, Any]]] = None

class TraceIngestRequest(BaseModel):
    spans: List[TraceSpanItem]

class BatchTelemetryRequest(BaseModel):
    logs: Optional[List[LogIngestItem]] = None
    metrics: Optional[List[MetricIngestItem]] = None
    spans: Optional[List[TraceSpanItem]] = None

# Incidents
class IncidentCreateRequest(BaseModel):
    application_id: str
    title: str
    severity: str = "High"  # Critical, High, Medium, Low
    service_name: str
    environment: Optional[str] = "production"
    description: Optional[str] = None
    trigger_value: Optional[str] = None

class IncidentStatusUpdateRequest(BaseModel):
    status: str  # Triggered, Acknowledged, Investigating, Mitigated, Resolved, Closed
    notes: Optional[str] = None

class IncidentAssignRequest(BaseModel):
    user_id: Optional[str] = None

class IncidentCommentCreateRequest(BaseModel):
    content: str

class IncidentResponse(BaseModel):
    id: str
    organization_id: str
    application_id: str
    application_name: Optional[str] = None
    title: str
    fingerprint: str
    severity: str
    status: str
    service_name: str
    environment: str
    description: Optional[str] = None
    trigger_value: Optional[str] = None
    assigned_to_user_id: Optional[str] = None
    assignee_name: Optional[str] = None
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    updated_at: datetime
    mttd_seconds: Optional[int] = None
    mttr_seconds: Optional[int] = None
    ai_status: Optional[str] = "available"  # available, analyzed, verified

class IncidentEventResponse(BaseModel):
    id: str
    incident_id: str
    event_type: str
    actor_type: str
    actor_name: str
    message: str
    data: Dict[str, Any]
    created_at: datetime

class IncidentCommentResponse(BaseModel):
    id: str
    incident_id: str
    user_id: Optional[str]
    author_name: str
    content: str
    created_at: datetime

# AI Investigation
class AIInvestigateRequest(BaseModel):
    incident_id: str
    force_refresh: Optional[bool] = False

class AIEvidenceItem(BaseModel):
    type: str  # log, metric, trace, timeline
    id: Optional[str] = None
    title: str
    snippet: str
    timestamp: Optional[str] = None
    severity: Optional[str] = None

class AIAnalysisResponse(BaseModel):
    id: str
    incident_id: str
    model_name: str
    summary: str
    root_cause_hypothesis: str
    supporting_evidence: List[Dict[str, Any]]
    alternative_causes: List[str]
    confidence_score: float
    recommended_steps: List[str]
    code_fix_diff: Optional[str] = None
    verification_steps: List[str]
    feedback_status: str
    verified_root_cause: Optional[str] = None
    feedback_notes: Optional[str] = None
    created_at: datetime

class AIFeedbackRequest(BaseModel):
    feedback_status: str  # correct, incorrect, unresolved
    verified_root_cause: Optional[str] = None
    feedback_notes: Optional[str] = None

# Detection Rules
class DetectionRuleCreateRequest(BaseModel):
    application_id: Optional[str] = None
    name: str
    rule_type: str  # error_rate, latency, http_5xx, crash, db_timeout, cpu_memory, service_failures
    severity: str = "High"
    metric_target: str
    threshold_value: float
    evaluation_window_seconds: Optional[int] = 60
    cooldown_seconds: Optional[int] = 300
    is_enabled: Optional[bool] = True

class DetectionRuleResponse(BaseModel):
    id: str
    application_id: Optional[str] = None
    name: str
    rule_type: str
    severity: str
    metric_target: str
    threshold_value: float
    evaluation_window_seconds: int
    cooldown_seconds: int
    is_enabled: bool
    created_at: datetime

# Notifications & Integrations
class NotificationChannelCreateRequest(BaseModel):
    channel_type: str  # email, slack, teams
    name: str
    config: Dict[str, Any]
    is_active: Optional[bool] = True

class NotificationChannelResponse(BaseModel):
    id: str
    channel_type: str
    name: str
    config: Dict[str, Any]
    is_active: bool
    created_at: datetime

class NotificationItemResponse(BaseModel):
    id: str
    incident_id: Optional[str] = None
    title: str
    message: str
    channel_type: str
    severity: str
    status: str
    error_detail: Optional[str] = None
    created_at: datetime

# Security, Audit & Retention
class AuditLogResponse(BaseModel):
    id: str
    user_email: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    ip_address: str
    details: Dict[str, Any]
    created_at: datetime

class RetentionPolicyUpdateRequest(BaseModel):
    logs_retention_days: int = Field(ge=1, le=365)
    metrics_retention_days: int = Field(ge=1, le=730)
    traces_retention_days: int = Field(ge=1, le=90)
    auto_clean_enabled: bool

class GDPRDeleteRequest(BaseModel):
    confirmation_phrase: str  # must match organization name

# Billing & Usage
class SubscriptionPlanResponse(BaseModel):
    id: str
    tier: str
    name: str
    max_apps: int
    max_monthly_events: int
    max_ai_investigations_monthly: int
    retention_days: int
    price_usd_monthly: float
    features: List[str]

class UsageResponse(BaseModel):
    period_ym: str
    plan_tier: str
    apps_count: int
    max_apps: int
    events_ingested: int
    max_monthly_events: int
    ai_investigations_used: int
    max_ai_investigations_monthly: int
    retention_days: int

class UpgradePlanRequest(BaseModel):
    plan_tier: str  # free, starter, team, business
