import hashlib
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    Incident, IncidentEvent, IncidentComment, User, Application, AuditLog, AIAnalysis
)
from app.schemas import (
    IncidentCreateRequest, IncidentResponse, IncidentStatusUpdateRequest,
    IncidentAssignRequest, IncidentCommentCreateRequest, IncidentCommentResponse,
    IncidentEventResponse
)
from app.dependencies import get_current_tenant, require_role, TenantContext
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/incidents", tags=["Incidents"])

@router.get("", response_model=List[IncidentResponse])
def list_incidents(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    service_name: Optional[str] = None,
    application_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    ctx: TenantContext = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    query = db.query(Incident).filter(Incident.organization_id == ctx.organization.id)
    if status and status.lower() != "all":
        query = query.filter(Incident.status.ilike(status))
    if severity and severity.lower() != "all":
        query = query.filter(Incident.severity.ilike(severity))
    if service_name:
        query = query.filter(Incident.service_name == service_name)
    if application_id:
        query = query.filter(Incident.application_id == application_id)
    if search:
        query = query.filter(Incident.title.ilike(f"%{search}%"))

    incidents = query.order_by(Incident.created_at.desc()).offset(offset).limit(limit).all()

    results = []
    for inc in incidents:
        app_name = inc.application.name if inc.application else "Unknown App"
        assignee_name = inc.assignee.full_name if inc.assignee else None
        has_ai = len(inc.ai_analyses) > 0
        ai_verified = any(a.feedback_status == "correct" for a in inc.ai_analyses)

        results.append({
            "id": inc.id,
            "organization_id": inc.organization_id,
            "application_id": inc.application_id,
            "application_name": app_name,
            "title": inc.title,
            "fingerprint": inc.fingerprint,
            "severity": inc.severity,
            "status": inc.status,
            "service_name": inc.service_name,
            "environment": inc.environment,
            "description": inc.description,
            "trigger_value": inc.trigger_value,
            "assigned_to_user_id": inc.assigned_to_user_id,
            "assignee_name": assignee_name,
            "created_at": inc.created_at,
            "acknowledged_at": inc.acknowledged_at,
            "resolved_at": inc.resolved_at,
            "closed_at": inc.closed_at,
            "updated_at": inc.updated_at,
            "mttd_seconds": inc.mttd_seconds,
            "mttr_seconds": inc.mttr_seconds,
            "ai_status": "verified" if ai_verified else ("analyzed" if has_ai else "available")
        })
    return results

@router.post("", response_model=IncidentResponse)
def create_incident(
    req: IncidentCreateRequest,
    ctx: TenantContext = Depends(require_role(["owner", "admin", "engineer"])),
    db: Session = Depends(get_db)
):
    app = db.query(Application).filter(
        Application.id == req.application_id,
        Application.organization_id == ctx.organization.id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    now = datetime.now(timezone.utc)
    raw_fp = f"{app.id}:{req.service_name}:manual:{req.title}"
    fingerprint = hashlib.sha256(raw_fp.encode("utf-8")).hexdigest()[:24]

    new_inc = Incident(
        organization_id=ctx.organization.id,
        application_id=app.id,
        title=req.title,
        fingerprint=fingerprint,
        severity=req.severity,
        status="Triggered",
        service_name=req.service_name,
        environment=req.environment or "production",
        description=req.description or "Manually reported incident by engineer",
        trigger_value=req.trigger_value or "Manual trigger",
        created_at=now,
        updated_at=now,
        mttd_seconds=0
    )
    db.add(new_inc)
    db.flush()

    event = IncidentEvent(
        incident_id=new_inc.id,
        event_type="manual_creation",
        actor_type="user",
        actor_id=ctx.user.id,
        actor_name=ctx.user.full_name,
        message=f"Incident manually created with severity '{req.severity}' by {ctx.user.full_name}",
        data={"description": req.description}
    )
    db.add(event)

    audit = AuditLog(
        organization_id=ctx.organization.id,
        user_id=ctx.user.id,
        user_email=ctx.user.email,
        action="incident.created",
        resource_type="incident",
        resource_id=new_inc.id,
        details={"title": req.title, "severity": req.severity}
    )
    db.add(audit)
    db.commit()
    db.refresh(new_inc)

    return {
        "id": new_inc.id,
        "organization_id": new_inc.organization_id,
        "application_id": new_inc.application_id,
        "application_name": app.name,
        "title": new_inc.title,
        "fingerprint": new_inc.fingerprint,
        "severity": new_inc.severity,
        "status": new_inc.status,
        "service_name": new_inc.service_name,
        "environment": new_inc.environment,
        "description": new_inc.description,
        "trigger_value": new_inc.trigger_value,
        "assigned_to_user_id": None,
        "assignee_name": None,
        "created_at": new_inc.created_at,
        "acknowledged_at": None,
        "resolved_at": None,
        "closed_at": None,
        "updated_at": new_inc.updated_at,
        "mttd_seconds": 0,
        "mttr_seconds": None,
        "ai_status": "available"
    }

@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(
    incident_id: str,
    ctx: TenantContext = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.organization_id == ctx.organization.id
    ).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    app_name = inc.application.name if inc.application else "Unknown App"
    assignee_name = inc.assignee.full_name if inc.assignee else None
    has_ai = len(inc.ai_analyses) > 0
    ai_verified = any(a.feedback_status == "correct" for a in inc.ai_analyses)

    return {
        "id": inc.id,
        "organization_id": inc.organization_id,
        "application_id": inc.application_id,
        "application_name": app_name,
        "title": inc.title,
        "fingerprint": inc.fingerprint,
        "severity": inc.severity,
        "status": inc.status,
        "service_name": inc.service_name,
        "environment": inc.environment,
        "description": inc.description,
        "trigger_value": inc.trigger_value,
        "assigned_to_user_id": inc.assigned_to_user_id,
        "assignee_name": assignee_name,
        "created_at": inc.created_at,
        "acknowledged_at": inc.acknowledged_at,
        "resolved_at": inc.resolved_at,
        "closed_at": inc.closed_at,
        "updated_at": inc.updated_at,
        "mttd_seconds": inc.mttd_seconds,
        "mttr_seconds": inc.mttr_seconds,
        "ai_status": "verified" if ai_verified else ("analyzed" if has_ai else "available")
    }

@router.put("/{incident_id}/status")
def update_status(
    incident_id: str,
    req: IncidentStatusUpdateRequest,
    ctx: TenantContext = Depends(require_role(["owner", "admin", "engineer"])),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.organization_id == ctx.organization.id
    ).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    old_status = inc.status
    new_status = req.status.capitalize()
    now = datetime.now(timezone.utc)

    inc.status = new_status
    inc.updated_at = now

    if new_status == "Acknowledged" and not inc.acknowledged_at:
        inc.acknowledged_at = now
    elif new_status in ["Resolved", "Closed"] and not inc.resolved_at:
        inc.resolved_at = now
        now_naive = now.replace(tzinfo=None)
        created_naive = inc.created_at.replace(tzinfo=None) if inc.created_at else now_naive
        inc.mttr_seconds = max(1, int((now_naive - created_naive).total_seconds()))
    if new_status == "Closed":
        inc.closed_at = now

    # Add timeline event
    event = IncidentEvent(
        incident_id=inc.id,
        event_type="status_change",
        actor_type="user",
        actor_id=ctx.user.id,
        actor_name=ctx.user.full_name,
        message=f"Status changed from '{old_status}' to '{new_status}' by {ctx.user.full_name}. {req.notes or ''}".strip(),
        data={"old_status": old_status, "new_status": new_status, "notes": req.notes}
    )
    db.add(event)

    audit = AuditLog(
        organization_id=ctx.organization.id,
        user_id=ctx.user.id,
        user_email=ctx.user.email,
        action="incident.status_changed",
        resource_type="incident",
        resource_id=inc.id,
        details={"old_status": old_status, "new_status": new_status}
    )
    db.add(audit)
    db.commit()

    return {"message": f"Incident status updated to {new_status}", "status": new_status, "mttr_seconds": inc.mttr_seconds}

@router.put("/{incident_id}/assign")
def assign_incident(
    incident_id: str,
    req: IncidentAssignRequest,
    ctx: TenantContext = Depends(require_role(["owner", "admin", "engineer"])),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.organization_id == ctx.organization.id
    ).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    target_user = None
    if req.user_id:
        target_user = db.query(User).filter(User.id == req.user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Assignee user not found")

    inc.assigned_to_user_id = req.user_id
    inc.updated_at = datetime.now(timezone.utc)

    assignee_name = target_user.full_name if target_user else "Unassigned"
    event = IncidentEvent(
        incident_id=inc.id,
        event_type="assigned",
        actor_type="user",
        actor_id=ctx.user.id,
        actor_name=ctx.user.full_name,
        message=f"Incident assigned to {assignee_name} by {ctx.user.full_name}",
        data={"assigned_to_user_id": req.user_id, "assignee_name": assignee_name}
    )
    db.add(event)
    db.commit()

    return {"message": f"Incident assigned to {assignee_name}", "assigned_to_user_id": req.user_id, "assignee_name": assignee_name}

@router.get("/{incident_id}/timeline", response_model=List[IncidentEventResponse])
def get_timeline(
    incident_id: str,
    ctx: TenantContext = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.organization_id == ctx.organization.id
    ).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    events = db.query(IncidentEvent).filter(
        IncidentEvent.incident_id == inc.id
    ).order_by(IncidentEvent.created_at.desc()).all()

    return events

@router.post("/{incident_id}/comments", response_model=IncidentCommentResponse)
def add_comment(
    incident_id: str,
    req: IncidentCommentCreateRequest,
    ctx: TenantContext = Depends(require_role(["owner", "admin", "engineer", "viewer"])),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.organization_id == ctx.organization.id
    ).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    comment = IncidentComment(
        incident_id=inc.id,
        user_id=ctx.user.id,
        author_name=ctx.user.full_name,
        content=req.content
    )
    db.add(comment)

    # Timeline event
    event = IncidentEvent(
        incident_id=inc.id,
        event_type="comment",
        actor_type="user",
        actor_id=ctx.user.id,
        actor_name=ctx.user.full_name,
        message=f"{ctx.user.full_name} added an incident investigation note",
        data={"comment_snippet": req.content[:100]}
    )
    db.add(event)
    db.commit()
    db.refresh(comment)

    return comment

@router.get("/{incident_id}/report")
def export_incident_report(
    incident_id: str,
    format: str = Query("markdown", pattern="^(markdown|json)$"),
    ctx: TenantContext = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    analytics = AnalyticsService(db)
    md_content = analytics.generate_report_markdown(ctx.organization.id, incident_id)
    if not md_content:
        raise HTTPException(status_code=404, detail="Incident not found or no report generated")

    if format == "json":
        inc = db.query(Incident).filter(Incident.id == incident_id).first()
        analysis = db.query(AIAnalysis).filter(AIAnalysis.incident_id == incident_id).first()
        return {
            "incident": {
                "id": inc.id,
                "title": inc.title,
                "severity": inc.severity,
                "status": inc.status,
                "service": inc.service_name,
                "created_at": inc.created_at,
                "mttd": inc.mttd_seconds,
                "mttr": inc.mttr_seconds
            },
            "root_cause_analysis": {
                "hypothesis": analysis.root_cause_hypothesis if analysis else None,
                "confidence": analysis.confidence_score if analysis else None,
                "model": analysis.model_name if analysis else None
            },
            "markdown_report": md_content
        }

    return PlainTextResponse(
        content=md_content,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename=incident-{incident_id[:8]}-report.md"}
    )
