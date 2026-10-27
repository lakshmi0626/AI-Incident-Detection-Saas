import os
from typing import List

class Settings:
    PROJECT_NAME: str = "IncidentIQ"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Secret and Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "incidentiq-super-secret-production-encryption-key-32bytes!")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./incidentiq.db")
    
    # AI Providers
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    AI_MODEL: str = os.getenv("AI_MODEL", "gemini-1.5-flash")
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]
    
    # Background Telemetry Simulator
    SIMULATOR_ENABLED: bool = os.getenv("SIMULATOR_ENABLED", "true").lower() == "true"
    SIMULATOR_INTERVAL_SECONDS: int = int(os.getenv("SIMULATOR_INTERVAL_SECONDS", "10"))
    
    # Retention
    DEFAULT_LOGS_RETENTION_DAYS: int = 30
    DEFAULT_METRICS_RETENTION_DAYS: int = 90
    DEFAULT_TRACES_RETENTION_DAYS: int = 14

settings = Settings()
