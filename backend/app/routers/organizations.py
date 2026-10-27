from datetime import datetime, timezone
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Organization, OrganizationMember, User, AuditLog
from app.schemas import (
    OrganizationResponse, MemberInviteRequest, MemberResponse, MemberRoleUpdateRequest
)
from app.dependencies import get_current_tenant, require_role, TenantContext
from app.security import hash_password

router = APIRouter(prefix="/organizations", tags=["Organizations"])

@router.get("/current", response_model=OrganizationResponse)
def get_current_org(
    ctx: TenantContext = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    member_count = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == ctx.organization.id
    ).count()

    return {
        "id": ctx.organization.id,
        "name": ctx.organization.name,
        "slug": ctx.organization.slug,
        "plan_tier": ctx.organization.plan_tier,
        "settings_json": ctx.organization.settings_json or {},
        "created_at": ctx.organization.created_at,
        "role": ctx.role,
        "member_count": member_count,
        "app_count": len(ctx.organization.applications)
    }

@router.put("/current/settings")
def update_org_settings(
    payload: Dict[str, Any],
    ctx: TenantContext = Depends(require_role(["owner", "admin"])),
    db: Session = Depends(get_db)
):
    if "name" in payload and payload["name"]:
        ctx.organization.name = payload["name"]
    if "settings" in payload and isinstance(payload["settings"], dict):
        ctx.organization.settings_json = {**(ctx.organization.settings_json or {}), **payload["settings"]}
    
    # Audit log
    audit = AuditLog(
        organization_id=ctx.organization.id,
        user_id=ctx.user.id,
        user_email=ctx.user.email,
        action="organization.settings_updated",
        resource_type="organization",
        resource_id=ctx.organization.id,
        details={"updated_fields": list(payload.keys())}
    )
    db.add(audit)
    db.commit()
    return {"message": "Organization settings updated successfully"}

@router.get("/current/members", response_model=List[MemberResponse])
def list_members(
    ctx: TenantContext = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    members = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == ctx.organization.id
    ).all()

    result = []
    for m in members:
        u = db.query(User).filter(User.id == m.user_id).first()
        if u:
            result.append({
                "id": m.id,
                "user_id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": m.role,
                "joined_at": m.joined_at
            })
    return result

@router.post("/current/members", response_model=MemberResponse)
def invite_member(
    req: MemberInviteRequest,
    ctx: TenantContext = Depends(require_role(["owner", "admin"])),
    db: Session = Depends(get_db)
):
    target_user = db.query(User).filter(User.email == req.email.lower()).first()
    if not target_user:
        # Create user account with temporary password
        target_user = User(
            email=req.email.lower(),
            full_name=req.email.split("@")[0].capitalize(),
            hashed_password=hash_password("IncidentIQ@2026!"),
            is_active=True
        )
        db.add(target_user)
        db.flush()

    existing_member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == ctx.organization.id,
        OrganizationMember.user_id == target_user.id
    ).first()

    if existing_member:
        raise HTTPException(status_code=400, detail="User is already a member of this organization")

    new_member = OrganizationMember(
        organization_id=ctx.organization.id,
        user_id=target_user.id,
        role=req.role.lower()
    )
    db.add(new_member)

    # Audit log
    audit = AuditLog(
        organization_id=ctx.organization.id,
        user_id=ctx.user.id,
        user_email=ctx.user.email,
        action="member.invited",
        resource_type="member",
        resource_id=new_member.id,
        details={"invited_email": target_user.email, "role": req.role}
    )
    db.add(audit)
    db.commit()

    return {
        "id": new_member.id,
        "user_id": target_user.id,
        "email": target_user.email,
        "full_name": target_user.full_name,
        "role": new_member.role,
        "joined_at": new_member.joined_at
    }

@router.put("/current/members/{member_id}")
def update_member_role(
    member_id: str,
    req: MemberRoleUpdateRequest,
    ctx: TenantContext = Depends(require_role(["owner", "admin"])),
    db: Session = Depends(get_db)
):
    member = db.query(OrganizationMember).filter(
        OrganizationMember.id == member_id,
        OrganizationMember.organization_id == ctx.organization.id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if member.user_id == ctx.user.id and req.role != "owner":
        raise HTTPException(status_code=400, detail="Cannot downgrade your own owner role")

    member.role = req.role.lower()
    
    audit = AuditLog(
        organization_id=ctx.organization.id,
        user_id=ctx.user.id,
        user_email=ctx.user.email,
        action="member.role_updated",
        resource_type="member",
        resource_id=member.id,
        details={"new_role": req.role}
    )
    db.add(audit)
    db.commit()
    return {"message": "Member role updated successfully", "role": member.role}

@router.delete("/current/members/{member_id}")
def remove_member(
    member_id: str,
    ctx: TenantContext = Depends(require_role(["owner", "admin"])),
    db: Session = Depends(get_db)
):
    member = db.query(OrganizationMember).filter(
        OrganizationMember.id == member_id,
        OrganizationMember.organization_id == ctx.organization.id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if member.user_id == ctx.user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself from the organization")

    db.delete(member)
    audit = AuditLog(
        organization_id=ctx.organization.id,
        user_id=ctx.user.id,
        user_email=ctx.user.email,
        action="member.removed",
        resource_type="member",
        resource_id=member_id,
        details={}
    )
    db.add(audit)
    db.commit()
    return {"message": "Member removed from organization"}
