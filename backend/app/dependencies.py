from typing import Optional, List
from fastapi import Depends, HTTPException, status, Header, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, Organization, OrganizationMember, Application
from app.security import decode_access_token, hash_api_key

security_bearer = HTTPBearer(auto_error=False)

ROLE_HIERARCHY = {
    "viewer": 1,
    "engineer": 2,
    "admin": 3,
    "owner": 4
}

class TenantContext:
    def __init__(self, user: User, organization: Organization, member: OrganizationMember):
        self.user = user
        self.organization = organization
        self.member = member
        self.role = member.role.lower()

    def has_role(self, minimum_role: str) -> bool:
        user_level = ROLE_HIERARCHY.get(self.role, 0)
        req_level = ROLE_HIERARCHY.get(minimum_role.lower(), 99)
        return user_level >= req_level

def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    db: Session = Depends(get_db)
) -> User:
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(auth.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload["sub"]
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or disabled"
        )
    return user

def get_current_tenant(
    user: User = Depends(get_current_user),
    x_organization_id: Optional[str] = Header(None, alias="X-Organization-Id"),
    auth: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    db: Session = Depends(get_db)
) -> TenantContext:
    target_org_id = x_organization_id
    
    # If not in header, check token payload org_id
    if not target_org_id and auth and auth.credentials:
        payload = decode_access_token(auth.credentials)
        if payload and "org_id" in payload:
            target_org_id = payload["org_id"]

    # If still not specified, find user's default/first organization
    if not target_org_id:
        membership = db.query(OrganizationMember).filter(OrganizationMember.user_id == user.id).first()
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not belong to any organization"
            )
        target_org_id = membership.organization_id

    # Validate membership in this organization
    member = db.query(OrganizationMember).filter(
        OrganizationMember.user_id == user.id,
        OrganizationMember.organization_id == target_org_id
    ).first()
    
    if not member and not user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this organization"
        )
        
    organization = db.query(Organization).filter(Organization.id == target_org_id).first()
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    # Superuser fallback role if no member row
    if not member and user.is_superuser:
        member = OrganizationMember(
            id="superuser-synthetic",
            organization_id=organization.id,
            user_id=user.id,
            role="owner"
        )

    return TenantContext(user=user, organization=organization, member=member)

def require_role(allowed_roles: List[str]):
    def role_checker(ctx: TenantContext = Depends(get_current_tenant)) -> TenantContext:
        if ctx.user.is_superuser:
            return ctx
        if ctx.role not in [r.lower() for r in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action requires one of roles: {', '.join(allowed_roles)}. Your role is '{ctx.role}'."
            )
        return ctx
    return role_checker

def verify_app_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    auth: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    db: Session = Depends(get_db)
) -> tuple[Application, Organization]:
    raw_key = x_api_key
    if not raw_key and auth and auth.credentials:
        raw_key = auth.credentials

    if not raw_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing application API key. Pass 'X-API-Key' header or Bearer token."
        )

    key_hash = hash_api_key(raw_key.strip())
    app = db.query(Application).filter(Application.api_key_hash == key_hash).first()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Application API key"
        )
    
    organization = db.query(Organization).filter(Organization.id == app.organization_id).first()
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization associated with this application does not exist"
        )
        
    return app, organization
