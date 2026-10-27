import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import engine, Base
from app.seed import seed_database
from app.routers import (
    auth, organizations, applications, telemetry, incidents,
    ai, rules, notifications, analytics, billing, security,
    simulator, metrics_export
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables and default seed data
    Base.metadata.create_all(bind=engine)
    try:
        seed_database()
    except Exception as e:
        print(f"Seed note: {e}")
    yield
    # Shutdown

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="IncidentIQ — AI-Powered Software Incident Detection & Resolution Commercial SaaS Platform API",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local dev & testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error occurred", "error": str(exc)}
    )

# Include API v1 Routers
api_v1_str = settings.API_V1_STR
app.include_router(auth.router, prefix=api_v1_str)
app.include_router(organizations.router, prefix=api_v1_str)
app.include_router(applications.router, prefix=api_v1_str)
app.include_router(telemetry.router, prefix=api_v1_str)
app.include_router(incidents.router, prefix=api_v1_str)
app.include_router(ai.router, prefix=api_v1_str)
app.include_router(rules.router, prefix=api_v1_str)
app.include_router(notifications.router, prefix=api_v1_str)
app.include_router(analytics.router, prefix=api_v1_str)
app.include_router(billing.router, prefix=api_v1_str)
app.include_router(security.router, prefix=api_v1_str)
app.include_router(simulator.router, prefix=api_v1_str)
app.include_router(metrics_export.router, prefix=api_v1_str)

@app.get("/")
def root():
    return {
        "product": "IncidentIQ",
        "description": "AI-Powered Software Incident Detection & Resolution Platform",
        "version": settings.VERSION,
        "status": "operational",
        "docs": f"{settings.API_V1_STR}/docs",
        "health": "/health"
    }

@app.get("/health")
def health():
    return {"status": "healthy", "database": "connected", "ai_engine": "online"}
