import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Organization, OrganizationMember, OrganizationSubscription, RetentionPolicy, UsageRecord, AuditLog
from app.security import hash_password, verify_password, create_access_token
from app.schemas import (
    UserRegisterRequest, UserLoginRequest, TokenResponse, 
    UserProfileResponse, PasswordChangeRequest
)
from app.dependencies import get_current_user, TenantContext, get_current_tenant

router = APIRouter(prefix="/auth", tags=["Authentication"])

def record_audit(db: Session, org_id: str, user_id: str, email: str, action: str, details: dict):
    audit = AuditLog(
        organization_id=org_id,
        user_id=user_id,
        user_email=email,
        action=action,
        resource_type="auth",
        details=details
    )
    db.add(audit)
    db.commit()

@router.post("/register", response_model=TokenResponse)
def register(req: UserRegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )

    # 1. Create User
    new_user = User(
        email=req.email.lower(),
        full_name=req.full_name,
        hashed_password=hash_password(req.password),
        is_active=True
    )
    db.add(new_user)
    db.flush()

    # 2. Create Organization
    org_name = req.organization_name or f"{req.full_name}'s Org"
    slug = org_name.lower().replace(" ", "-").replace(".", "") + "-" + uuid.uuid4().hex[:6]
    new_org = Organization(
        name=org_name,
        slug=slug,
        plan_tier="starter"
    )
    db.add(new_org)
    db.flush()

    # 3. Create Membership as Owner
    member = OrganizationMember(
        organization_id=new_org.id,
        user_id=new_user.id,
        role="owner"
    )
    db.add(member)

    # 4. Create Subscription & Retention policy
    now = datetime.now(timezone.utc)
    sub = OrganizationSubscription(
        organization_id=new_org.id,
        plan_tier="starter",
        status="active"
    )
    db.add(sub)

    retention = RetentionPolicy(
        organization_id=new_org.id,
        logs_retention_days=30,
        metrics_retention_days=90,
        traces_retention_days=14,
        auto_clean_enabled=True
    )
    db.add(retention)

    db.commit()
    db.refresh(new_user)
    db.refresh(new_org)

    # Generate token
    token = create_access_token({
        "sub": new_user.id,
        "email": new_user.email,
        "org_id": new_org.id,
        "role": "owner"
    })

    record_audit(db, new_org.id, new_user.id, new_user.email, "user.registered", {"org_name": org_name})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "full_name": new_user.full_name,
            "role": "owner"
        },
        "current_organization": {
            "id": new_org.id,
            "name": new_org.name,
            "slug": new_org.slug,
            "plan_tier": new_org.plan_tier,
            "role": "owner"
        },
        "organizations": [{
            "id": new_org.id,
            "name": new_org.name,
            "slug": new_org.slug,
            "plan_tier": new_org.plan_tier,
            "role": "owner"
        }]
    }

@router.post("/login", response_model=TokenResponse)
def login(req: UserLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower()).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been deactivated"
        )

    # Get user memberships
    memberships = db.query(OrganizationMember).filter(OrganizationMember.user_id == user.id).all()
    if not memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not have an active organization membership"
        )

    primary_member = memberships[0]
    org_list = []
    current_org = None

    for m in memberships:
        org = db.query(Organization).filter(Organization.id == m.organization_id).first()
        if org:
            org_info = {
                "id": org.id,
                "name": org.name,
                "slug": org.slug,
                "plan_tier": org.plan_tier,
                "role": m.role
            }
            org_list.append(org_info)
            if m.organization_id == primary_member.organization_id:
                current_org = org_info

    token = create_access_token({
        "sub": user.id,
        "email": user.email,
        "org_id": current_org["id"],
        "role": current_org["role"]
    })

    record_audit(db, current_org["id"], user.id, user.email, "user.logged_in", {})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": current_org["role"]
        },
        "current_organization": current_org,
        "organizations": org_list
    }

@router.get("/me")
def get_me(
    user: User = Depends(get_current_user),
    ctx: TenantContext = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    memberships = db.query(OrganizationMember).filter(OrganizationMember.user_id == user.id).all()
    org_list = []
    for m in memberships:
        org = db.query(Organization).filter(Organization.id == m.organization_id).first()
        if org:
            org_list.append({
                "id": org.id,
                "name": org.name,
                "slug": org.slug,
                "plan_tier": org.plan_tier,
                "role": m.role
            })

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": ctx.role,
        "is_active": user.is_active,
        "is_superuser": user.is_superuser,
        "created_at": user.created_at,
        "current_organization": {
            "id": ctx.organization.id,
            "name": ctx.organization.name,
            "slug": ctx.organization.slug,
            "plan_tier": ctx.organization.plan_tier,
            "role": ctx.role
        },
        "organizations": org_list
    }

@router.post("/switch-org")
def switch_organization(
    org_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    member = db.query(OrganizationMember).filter(
        OrganizationMember.user_id == user.id,
        OrganizationMember.organization_id == org_id
    ).first()

    if not member and not user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization"
        )

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    role = member.role if member else "owner"
    token = create_access_token({
        "sub": user.id,
        "email": user.email,
        "org_id": org.id,
        "role": role
    })

    return {
        "access_token": token,
        "current_organization": {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "plan_tier": org.plan_tier,
            "role": role
        }
    }

@router.post("/password")
def change_password(
    req: PasswordChangeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(req.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password does not match")

    user.hashed_password = hash_password(req.new_password)
    db.commit()
    return {"message": "Password updated successfully"}
