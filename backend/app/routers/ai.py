from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Incident, AIAnalysis, IncidentEvent, UsageRecord, SubscriptionPlan, AuditLog
from app.schemas import AIAnalysisResponse, AIFeedbackRequest
from app.dependencies import get_current_tenant, require_role, TenantContext
from app.services.ai_investigator import AIInvestigator

router = APIRouter(prefix="/ai", tags=["AI Investigation"])

@router.post("/investigate/{incident_id}", response_model=AIAnalysisResponse)
def trigger_investigation(
    incident_id: str,
    force_refresh: bool = Query(False),
    ctx: TenantContext = Depends(require_role(["owner", "admin", "engineer"])),
    db: Session = Depends(get_db)
):
    inc = db.query(Incident).filter(
        Incident.id == incident_id,
        Incident.organization_id == ctx.organization.id
    ).first()
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")

    # 1. Enforce AI Investigation Monthly Usage Quota
    now = datetime.now(timezone.utc)
    period_ym = now.strftime("%Y-%m")
    usage = db.query(UsageRecord).filter(
        UsageRecord.organization_id == ctx.organization.id,
        UsageRecord.period_ym == period_ym
    ).first()

    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.tier == ctx.organization.plan_tier).first()
    max_quota = plan.max_ai_investigations_monthly if plan else 50

    if usage and usage.ai_investigations_used >= max_quota:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"AI Investigation quota reached for your '{ctx.organization.plan_tier}' tier ({usage.ai_investigations_used}/{max_quota}). Upgrade plan to run more AI investigations."
        )

    # 2. Run investigation
    investigator = AIInvestigator(db)
    analysis = investigator.investigate(inc, force_refresh=force_refresh)

    # 3. Update usage
    if not usage:
        usage = UsageRecord(
            organization_id=ctx.organization.id,
            period_ym=period_ym,
            events_ingested=0,
            ai_investigations_used=1,
            apps_count=len(ctx.organization.applications)
        )
        db.add(usage)
    else:
        usage.ai_investigations_used += 1
    db.commit()

    return analysis

@router.get("/investigate/{incident_id}", response_model=AIAnalysisResponse)
def get_investigation(
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

    analysis = db.query(AIAnalysis).filter(
        AIAnalysis.incident_id == inc.id
    ).order_by(AIAnalysis.created_at.desc()).first()

    if not analysis:
        # If no analysis yet, automatically run it for seamless UX
        investigator = AIInvestigator(db)
        analysis = investigator.investigate(inc)

    return analysis

@router.post("/feedback/{analysis_id}")
def submit_feedback(
    analysis_id: str,
    req: AIFeedbackRequest,
    ctx: TenantContext = Depends(require_role(["owner", "admin", "engineer"])),
    db: Session = Depends(get_db)
):
    analysis = db.query(AIAnalysis).filter(
        AIAnalysis.id == analysis_id,
        AIAnalysis.organization_id == ctx.organization.id
    ).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="AI Analysis record not found")

    analysis.feedback_status = req.feedback_status.lower()
    if req.verified_root_cause:
        analysis.verified_root_cause = req.verified_root_cause
    if req.feedback_notes:
        analysis.feedback_notes = req.feedback_notes
    analysis.updated_at = datetime.now(timezone.utc)

    # Add timeline event to incident
    event = IncidentEvent(
        incident_id=analysis.incident_id,
        event_type="ai_feedback",
        actor_type="user",
        actor_id=ctx.user.id,
        actor_name=ctx.user.full_name,
        message=f"Engineer {ctx.user.full_name} marked AI diagnosis as '{req.feedback_status.upper()}'. Verified cause: {req.verified_root_cause or 'N/A'}",
        data={
            "feedback_status": req.feedback_status,
            "verified_cause": req.verified_root_cause,
            "notes": req.feedback_notes
        }
    )
    db.add(event)

    audit = AuditLog(
        organization_id=ctx.organization.id,
        user_id=ctx.user.id,
        user_email=ctx.user.email,
        action="ai.feedback_submitted",
        resource_type="ai_analysis",
        resource_id=analysis.id,
        details={"status": req.feedback_status, "verified_cause": req.verified_root_cause}
    )
    db.add(audit)
    db.commit()

    return {
        "message": "Feedback recorded successfully. Verified root cause stored for future model correlation.",
        "feedback_status": analysis.feedback_status,
        "verified_root_cause": analysis.verified_root_cause
    }
