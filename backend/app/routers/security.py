from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    AuditLog, RetentionPolicy, LogEntry, MetricEntry, TraceSpan, 
    Incident, IncidentEvent, AIAnalysis
)
from app.schemas import AuditLogResponse, RetentionPolicyUpdateRequest, GDPRDeleteRequest
from app.dependencies import get_current_tenant, require_role, TenantContext
from app.security import redact_secrets

router = APIRouter(prefix="/security", tags=["Security, Audit & Retention"])

@router.get("/audit-logs", response_model=List[AuditLogResponse])
def list_audit_logs(
    action: Optional[str] = None,
    user_email: Optional[str] = None,
    resource_type: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    ctx: TenantContext = Depends(require_role(["owner", "admin"])),
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog).filter(AuditLog.organization_id == ctx.organization.id)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if user_email:
        query = query.filter(AuditLog.user_email.ilike(f"%{user_email}%"))
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)

    return query.order_by(AuditLog.created_at.desc()).limit(limit).all()

@router.get("/retention")
def get_retention_policy(
    ctx: TenantContext = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    policy = db.query(RetentionPolicy).filter(
        RetentionPolicy.organization_id == ctx.organization.id
    ).first()

    if not policy:
        policy = RetentionPolicy(
            organization_id=ctx.organization.id,
            logs_retention_days=30,
            metrics_retention_days=90,
            traces_retention_days=14,
            auto_clean_enabled=True
        )
        db.add(policy)
        db.commit()
        db.refresh(policy)

    return {
        "logs_retention_days": policy.logs_retention_days,
        "metrics_retention_days": policy.metrics_retention_days,
        "traces_retention_days": policy.traces_retention_days,
        "auto_clean_enabled": policy.auto_clean_enabled,
        "last_cleanup_at": policy.last_cleanup_at
    }

@router.put("/retention")
def update_retention_policy(
    req: RetentionPolicyUpdateRequest,
    ctx: TenantContext = Depends(require_role(["owner", "admin"])),
    db: Session = Depends(get_db)
):
    policy = db.query(RetentionPolicy).filter(
        RetentionPolicy.organization_id == ctx.organization.id
    ).first()
    if not policy:
        policy = RetentionPolicy(organization_id=ctx.organization.id)
        db.add(policy)

    policy.logs_retention_days = req.logs_retention_days
    policy.metrics_retention_days = req.metrics_retention_days
    policy.traces_retention_days = req.traces_retention_days
    policy.auto_clean_enabled = req.auto_clean_enabled

    audit = AuditLog(
        organization_id=ctx.organization.id,
        user_id=ctx.user.id,
        user_email=ctx.user.email,
        action="retention.policy_updated",
        resource_type="retention_policy",
        details=req.model_dump()
    )
    db.add(audit)
    db.commit()

    return {"message": "Retention policy updated successfully"}

@router.post("/retention/cleanup")
def run_retention_cleanup(
    ctx: TenantContext = Depends(require_role(["owner", "admin"])),
    db: Session = Depends(get_db)
):
    policy = db.query(RetentionPolicy).filter(
        RetentionPolicy.organization_id == ctx.organization.id
    ).first()
    now = datetime.now(timezone.utc)

    logs_days = policy.logs_retention_days if policy else 30
    metrics_days = policy.metrics_retention_days if policy else 90
    traces_days = policy.traces_retention_days if policy else 14

    logs_cutoff = now - timedelta(days=logs_days)
    metrics_cutoff = now - timedelta(days=metrics_days)
    traces_cutoff = now - timedelta(days=traces_days)

    deleted_logs = db.query(LogEntry).filter(
        LogEntry.organization_id == ctx.organization.id,
        LogEntry.timestamp < logs_cutoff
    ).delete(synchronize_session=False)

    deleted_metrics = db.query(MetricEntry).filter(
        MetricEntry.organization_id == ctx.organization.id,
        MetricEntry.timestamp < metrics_cutoff
    ).delete(synchronize_session=False)

    deleted_traces = db.query(TraceSpan).filter(
        TraceSpan.organization_id == ctx.organization.id,
        TraceSpan.start_time < traces_cutoff
    ).delete(synchronize_session=False)

    if policy:
        policy.last_cleanup_at = now

    audit = AuditLog(
        organization_id=ctx.organization.id,
        user_id=ctx.user.id,
        user_email=ctx.user.email,
        action="retention.cleanup_executed",
        resource_type="retention",
        details={
            "deleted_logs": deleted_logs,
            "deleted_metrics": deleted_metrics,
            "deleted_traces": deleted_traces
        }
    )
    db.add(audit)
    db.commit()

    return {
        "status": "completed",
        "purged_records": {
            "logs": deleted_logs,
            "metrics": deleted_metrics,
            "traces": deleted_traces
        },
        "cleanup_timestamp": now.isoformat()
    }

@router.post("/gdpr-delete")
def execute_gdpr_deletion(
    req: GDPRDeleteRequest,
    ctx: TenantContext = Depends(require_role(["owner"])),
    db: Session = Depends(get_db)
):
    # Require confirmation matching organization name
    if req.confirmation_phrase.strip().lower() != ctx.organization.name.strip().lower():
        raise HTTPException(
            status_code=400,
            detail=f"Confirmation phrase must exactly match organization name: '{ctx.organization.name}'"
        )

    # Purge all tenant telemetry and incident history
    del_logs = db.query(LogEntry).filter(LogEntry.organization_id == ctx.organization.id).delete()
    del_metrics = db.query(MetricEntry).filter(MetricEntry.organization_id == ctx.organization.id).delete()
    del_traces = db.query(TraceSpan).filter(TraceSpan.organization_id == ctx.organization.id).delete()
    del_incidents = db.query(Incident).filter(Incident.organization_id == ctx.organization.id).delete()
    del_ai = db.query(AIAnalysis).filter(AIAnalysis.organization_id == ctx.organization.id).delete()

    audit = AuditLog(
        organization_id=ctx.organization.id,
        user_id=ctx.user.id,
        user_email=ctx.user.email,
        action="gdpr.data_erased",
        resource_type="organization",
        resource_id=ctx.organization.id,
        details={
            "logs_erased": del_logs,
            "metrics_erased": del_metrics,
            "traces_erased": del_traces,
            "incidents_erased": del_incidents
        }
    )
    db.add(audit)
    db.commit()

    return {
        "status": "success",
        "message": f"GDPR data erasure executed for organization '{ctx.organization.name}'. All historical telemetry, incidents, and AI analyses have been permanently purged."
    }

@router.post("/redaction-preview")
def test_secret_redaction(
    payload: Dict[str, str] = Body(...),
    ctx: TenantContext = Depends(get_current_tenant)
):
    raw_text = payload.get("text", "")
    redacted = redact_secrets(raw_text)
    
    redacted_items = []
    if "[REDACTED_TOKEN]" in redacted:
        redacted_items.append("Bearer Authorization Token")
    if "[REDACTED_BASIC_AUTH]" in redacted:
        redacted_items.append("Basic Auth Credentials")
    if "[REDACTED_SECRET]" in redacted:
        redacted_items.append("Password / Secret field")
    if "[REDACTED_API_KEY]" in redacted:
        redacted_items.append("API Key")
    if "[REDACTED_CARD_NUMBER]" in redacted:
        redacted_items.append("Credit Card Number (PCI-DSS)")
    if "[REDACTED_DB_PWD]" in redacted:
        redacted_items.append("Database Connection Password")
    if "[REDACTED_JWT_TOKEN]" in redacted:
        redacted_items.append("JWT Signature / Payload")

    return {
        "original_text": raw_text,
        "redacted_text": redacted,
        "detected_secrets": redacted_items,
        "safe_for_ai": len(redacted_items) > 0 or "safe"
    }
