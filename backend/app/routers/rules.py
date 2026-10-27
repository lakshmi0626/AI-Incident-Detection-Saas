from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import DetectionRule, Application, AuditLog
from app.schemas import DetectionRuleCreateRequest, DetectionRuleResponse
from app.dependencies import get_current_tenant, require_role, TenantContext

router = APIRouter(prefix="/detection-rules", tags=["Detection Rules"])

@router.get("", response_model=List[DetectionRuleResponse])
def list_rules(
    application_id: Optional[str] = None,
    ctx: TenantContext = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    query = db.query(DetectionRule).filter(DetectionRule.organization_id == ctx.organization.id)
    if application_id:
        query = query.filter((DetectionRule.application_id == application_id) | (DetectionRule.application_id == None))
    return query.order_by(DetectionRule.created_at.desc()).all()

@router.post("", response_model=DetectionRuleResponse)
def create_rule(
    req: DetectionRuleCreateRequest,
    ctx: TenantContext = Depends(require_role(["owner", "admin", "engineer"])),
    db: Session = Depends(get_db)
):
    if req.application_id:
        app = db.query(Application).filter(
            Application.id == req.application_id,
            Application.organization_id == ctx.organization.id
        ).first()
        if not app:
            raise HTTPException(status_code=404, detail="Application not found")

    new_rule = DetectionRule(
        organization_id=ctx.organization.id,
        application_id=req.application_id,
        name=req.name,
        rule_type=req.rule_type,
        severity=req.severity,
        metric_target=req.metric_target,
        threshold_value=req.threshold_value,
        evaluation_window_seconds=req.evaluation_window_seconds or 60,
        cooldown_seconds=req.cooldown_seconds or 300,
        is_enabled=req.is_enabled if req.is_enabled is not None else True
    )
    db.add(new_rule)

    audit = AuditLog(
        organization_id=ctx.organization.id,
        user_id=ctx.user.id,
        user_email=ctx.user.email,
        action="rule.created",
        resource_type="detection_rule",
        resource_id=new_rule.id,
        details={"name": new_rule.name, "rule_type": new_rule.rule_type}
    )
    db.add(audit)
    db.commit()
    db.refresh(new_rule)
    return new_rule

@router.put("/{rule_id}", response_model=DetectionRuleResponse)
def update_rule(
    rule_id: str,
    req: DetectionRuleCreateRequest,
    ctx: TenantContext = Depends(require_role(["owner", "admin", "engineer"])),
    db: Session = Depends(get_db)
):
    rule = db.query(DetectionRule).filter(
        DetectionRule.id == rule_id,
        DetectionRule.organization_id == ctx.organization.id
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Detection rule not found")

    rule.name = req.name
    rule.rule_type = req.rule_type
    rule.severity = req.severity
    rule.metric_target = req.metric_target
    rule.threshold_value = req.threshold_value
    rule.evaluation_window_seconds = req.evaluation_window_seconds
    rule.cooldown_seconds = req.cooldown_seconds
    rule.is_enabled = req.is_enabled

    audit = AuditLog(
        organization_id=ctx.organization.id,
        user_id=ctx.user.id,
        user_email=ctx.user.email,
        action="rule.updated",
        resource_type="detection_rule",
        resource_id=rule.id,
        details={"name": rule.name}
    )
    db.add(audit)
    db.commit()
    db.refresh(rule)
    return rule

@router.delete("/{rule_id}")
def delete_rule(
    rule_id: str,
    ctx: TenantContext = Depends(require_role(["owner", "admin"])),
    db: Session = Depends(get_db)
):
    rule = db.query(DetectionRule).filter(
        DetectionRule.id == rule_id,
        DetectionRule.organization_id == ctx.organization.id
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Detection rule not found")

    db.delete(rule)
    audit = AuditLog(
        organization_id=ctx.organization.id,
        user_id=ctx.user.id,
        user_email=ctx.user.email,
        action="rule.deleted",
        resource_type="detection_rule",
        resource_id=rule_id,
        details={"name": rule.name}
    )
    db.add(audit)
    db.commit()
    return {"message": "Rule deleted"}
