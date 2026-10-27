import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Application, Service, Incident, SubscriptionPlan, AuditLog
from app.schemas import (
    ApplicationCreateRequest, ApplicationResponse, ServiceCreateRequest, ServiceResponse
)
from app.dependencies import get_current_tenant, require_role, TenantContext
from app.security import generate_api_key

router = APIRouter(prefix="/applications", tags=["Applications"])

@router.get("", response_model=List[ApplicationResponse])
def list_applications(
    ctx: TenantContext = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    apps = db.query(Application).filter(Application.organization_id == ctx.organization.id).all()
    results = []
    for a in apps:
        active_inc_count = db.query(Incident).filter(
            Incident.application_id == a.id,
            Incident.status.in_(["Triggered", "Acknowledged", "Investigating", "Mitigated"])
        ).count()

        results.append({
            "id": a.id,
            "organization_id": a.organization_id,
            "name": a.name,
            "slug": a.slug,
            "description": a.description,
            "api_key_prefix": a.api_key_prefix,
            "api_key": None,
            "environments_json": a.environments_json or ["production", "staging", "qa"],
            "status": "critical" if active_inc_count > 0 else a.status,
            "created_at": a.created_at,
            "services_count": len(a.services),
            "active_incidents_count": active_inc_count
        })
    return results

@router.post("", response_model=ApplicationResponse)
def create_application(
    req: ApplicationCreateRequest,
    ctx: TenantContext = Depends(require_role(["owner", "admin", "engineer"])),
    db: Session = Depends(get_db)
):
    # Check Plan Entitlements limit
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.tier == ctx.organization.plan_tier).first()
    max_apps = plan.max_apps if plan else 5
    current_count = db.query(Application).filter(Application.organization_id == ctx.organization.id).count()

    if current_count >= max_apps:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Application limit reached for your '{ctx.organization.plan_tier}' tier ({current_count}/{max_apps}). Please upgrade your subscription."
        )

    slug = req.slug or req.name.lower().replace(" ", "-").replace(".", "")
    # Check slug collision in same org
    collision = db.query(Application).filter(
        Application.organization_id == ctx.organization.id,
        Application.slug == slug
    ).first()
    if collision:
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"

    raw_key, key_hash, prefix = generate_api_key()

    new_app = Application(
        organization_id=ctx.organization.id,
        name=req.name,
        slug=slug,
        description=req.description,
        api_key_hash=key_hash,
        api_key_prefix=prefix,
        environments_json=req.environments or ["production", "staging", "qa"],
        status="active"
    )
    db.add(new_app)
    db.flush()

    # Pre-populate default services
    default_services = [
        ("api-gateway", "go", "api-gateway"),
        ("backend-service", "python", "backend"),
        ("database", "postgresql", "database")
    ]
    for s_name, s_lang, s_tier in default_services:
        svc = Service(
            application_id=new_app.id,
            name=s_name,
            language=s_lang,
            tier=s_tier,
            health_status="healthy"
        )
        db.add(svc)

    audit = AuditLog(
        organization_id=ctx.organization.id,
        user_id=ctx.user.id,
        user_email=ctx.user.email,
        action="application.created",
        resource_type="application",
        resource_id=new_app.id,
        details={"name": new_app.name, "slug": new_app.slug}
    )
    db.add(audit)
    db.commit()
    db.refresh(new_app)

    return {
        "id": new_app.id,
        "organization_id": new_app.organization_id,
        "name": new_app.name,
        "slug": new_app.slug,
        "description": new_app.description,
        "api_key_prefix": new_app.api_key_prefix,
        "api_key": raw_key,  # Returned only upon creation
        "environments_json": new_app.environments_json,
        "status": new_app.status,
        "created_at": new_app.created_at,
        "services_count": 3,
        "active_incidents_count": 0
    }

@router.get("/{app_id}")
def get_application(
    app_id: str,
    ctx: TenantContext = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    app = db.query(Application).filter(
        Application.id == app_id,
        Application.organization_id == ctx.organization.id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    services = db.query(Service).filter(Service.application_id == app.id).all()
    active_incidents = db.query(Incident).filter(
        Incident.application_id == app.id,
        Incident.status.in_(["Triggered", "Acknowledged", "Investigating", "Mitigated"])
    ).all()

    return {
        "id": app.id,
        "name": app.name,
        "slug": app.slug,
        "description": app.description,
        "api_key_prefix": app.api_key_prefix,
        "environments_json": app.environments_json,
        "status": "critical" if active_incidents else app.status,
        "created_at": app.created_at,
        "services": [
            {"id": s.id, "name": s.name, "language": s.language, "tier": s.tier, "health_status": s.health_status}
            for s in services
        ],
        "active_incidents_count": len(active_incidents)
    }

@router.post("/{app_id}/api-key")
def rotate_api_key(
    app_id: str,
    ctx: TenantContext = Depends(require_role(["owner", "admin"])),
    db: Session = Depends(get_db)
):
    app = db.query(Application).filter(
        Application.id == app_id,
        Application.organization_id == ctx.organization.id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    raw_key, key_hash, prefix = generate_api_key()
    app.api_key_hash = key_hash
    app.api_key_prefix = prefix

    audit = AuditLog(
        organization_id=ctx.organization.id,
        user_id=ctx.user.id,
        user_email=ctx.user.email,
        action="application.api_key_rotated",
        resource_type="application",
        resource_id=app.id,
        details={"prefix": prefix}
    )
    db.add(audit)
    db.commit()

    return {
        "message": "API Key rotated successfully. Copy it now, it will not be shown again.",
        "api_key": raw_key,
        "api_key_prefix": prefix
    }

@router.delete("/{app_id}")
def delete_application(
    app_id: str,
    ctx: TenantContext = Depends(require_role(["owner", "admin"])),
    db: Session = Depends(get_db)
):
    app = db.query(Application).filter(
        Application.id == app_id,
        Application.organization_id == ctx.organization.id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    db.delete(app)
    audit = AuditLog(
        organization_id=ctx.organization.id,
        user_id=ctx.user.id,
        user_email=ctx.user.email,
        action="application.deleted",
        resource_type="application",
        resource_id=app_id,
        details={"name": app.name}
    )
    db.add(audit)
    db.commit()
    return {"message": "Application deleted successfully"}

@router.post("/{app_id}/services", response_model=ServiceResponse)
def add_service(
    app_id: str,
    req: ServiceCreateRequest,
    ctx: TenantContext = Depends(require_role(["owner", "admin", "engineer"])),
    db: Session = Depends(get_db)
):
    app = db.query(Application).filter(
        Application.id == app_id,
        Application.organization_id == ctx.organization.id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    existing = db.query(Service).filter(
        Service.application_id == app.id,
        Service.name == req.name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Service with this name already exists in this application")

    svc = Service(
        application_id=app.id,
        name=req.name,
        language=req.language,
        tier=req.tier,
        health_status="healthy"
    )
    db.add(svc)
    db.commit()
    db.refresh(svc)
    return svc
