from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_tenant, TenantContext
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["Analytics & Reports"])

@router.get("/overview")
def get_analytics_overview(
    ctx: TenantContext = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    analytics = AnalyticsService(db)
    return analytics.get_overview(ctx.organization.id)

@router.get("/clusters")
def get_recurring_clusters(
    ctx: TenantContext = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    analytics = AnalyticsService(db)
    return analytics.get_clusters(ctx.organization.id)
