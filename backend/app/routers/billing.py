from datetime import datetime, timezone
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import SubscriptionPlan, OrganizationSubscription, UsageRecord, Application, AuditLog
from app.schemas import SubscriptionPlanResponse, UsageResponse, UpgradePlanRequest
from app.dependencies import get_current_tenant, require_role, TenantContext

router = APIRouter(prefix="/billing", tags=["Billing & SaaS Entitlements"])

@router.get("/plans", response_model=List[SubscriptionPlanResponse])
def get_plans(db: Session = Depends(get_db)):
    plans = db.query(SubscriptionPlan).all()
    return plans

@router.get("/usage", response_model=UsageResponse)
def get_usage(
    ctx: TenantContext = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    now = datetime.now(timezone.utc)
    period_ym = now.strftime("%Y-%m")

    usage = db.query(UsageRecord).filter(
        UsageRecord.organization_id == ctx.organization.id,
        UsageRecord.period_ym == period_ym
    ).first()

    plan = db.query(SubscriptionPlan).filter(
        SubscriptionPlan.tier == ctx.organization.plan_tier
    ).first()

    apps_count = db.query(Application).filter(
        Application.organization_id == ctx.organization.id
    ).count()

    events_ingested = usage.events_ingested if usage else 12500
    ai_used = usage.ai_investigations_used if usage else 4

    return {
        "period_ym": period_ym,
        "plan_tier": ctx.organization.plan_tier,
        "apps_count": apps_count,
        "max_apps": plan.max_apps if plan else 5,
        "events_ingested": events_ingested,
        "max_monthly_events": plan.max_monthly_events if plan else 100000,
        "ai_investigations_used": ai_used,
        "max_ai_investigations_monthly": plan.max_ai_investigations_monthly if plan else 50,
        "retention_days": plan.retention_days if plan else 30
    }

@router.post("/upgrade")
def upgrade_plan(
    req: UpgradePlanRequest,
    ctx: TenantContext = Depends(require_role(["owner", "admin"])),
    db: Session = Depends(get_db)
):
    target_tier = req.plan_tier.lower()
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.tier == target_tier).first()
    if not plan:
        raise HTTPException(status_code=400, detail=f"Invalid plan tier '{req.plan_tier}'. Available: free, starter, team, business")

    old_tier = ctx.organization.plan_tier
    ctx.organization.plan_tier = target_tier

    sub = db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == ctx.organization.id
    ).first()
    if sub:
        sub.plan_tier = target_tier
        sub.status = "active"
    else:
        sub = OrganizationSubscription(
            organization_id=ctx.organization.id,
            plan_tier=target_tier,
            status="active"
        )
        db.add(sub)

    audit = AuditLog(
        organization_id=ctx.organization.id,
        user_id=ctx.user.id,
        user_email=ctx.user.email,
        action="subscription.upgraded",
        resource_type="subscription",
        resource_id=sub.id,
        details={"old_tier": old_tier, "new_tier": target_tier}
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"Successfully updated subscription to {plan.name} tier!",
        "plan_tier": target_tier,
        "max_apps": plan.max_apps,
        "retention_days": plan.retention_days
    }
