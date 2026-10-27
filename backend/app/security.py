import re
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from app.config import settings

password_hasher = PasswordHasher()

def hash_password(password: str) -> str:
    try:
        return password_hasher.hash(password)
    except Exception:
        # Fallback to PBKDF2 if argon2 fails
        salt = secrets.token_hex(16)
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
        return f"pbkdf2:{salt}:{key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if hashed_password.startswith("pbkdf2:"):
        try:
            _, salt, key_hex = hashed_password.split(":")
            key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100_000)
            return secrets.compare_digest(key.hex(), key_hex)
        except Exception:
            return False
    try:
        return password_hasher.verify(hashed_password, plain_password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": now})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except Exception:
        return None

def generate_api_key() -> tuple[str, str, str]:
    """Generates (raw_key, key_hash, prefix)."""
    raw_random = secrets.token_urlsafe(32)
    raw_key = f"iq_live_{raw_random}"
    prefix = raw_key[:12]
    key_hash = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
    return raw_key, key_hash, prefix

def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

# Secret Redaction Engine
REDACTION_PATTERNS = [
    # Bearer tokens
    (re.compile(r"Bearer\s+([A-Za-z0-9_\-\.]{15,})", re.IGNORECASE), "Bearer [REDACTED_TOKEN]"),
    # Basic Auth
    (re.compile(r"Basic\s+([A-Za-z0-9+/=]{10,})", re.IGNORECASE), "Basic [REDACTED_BASIC_AUTH]"),
    # Passwords in JSON / query params / log statements with single or double quotes or colon/equal
    (re.compile(r'(password|passwd|pwd|client_secret|api_secret)\s*[:=]\s*[\'"][^\'"]+[\'"]', re.IGNORECASE), r'\1: "[REDACTED_SECRET]"'),
    (re.compile(r'"(password|passwd|pwd|client_secret|api_secret)"\s*:\s*"[^"]*"', re.IGNORECASE), r'"\1": "[REDACTED_SECRET]"'),
    # API key patterns (iq_live_..., sk_live_..., etc.)
    (re.compile(r"\b(iq_live_|sk_live_|ghp_|xoxb-|AKIA)[A-Za-z0-9_\-]{16,}\b", re.IGNORECASE), "[REDACTED_API_KEY]"),
    # Credit Card numbers (Luhn candidate formats)
    (re.compile(r"\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b"), "[REDACTED_CARD_NUMBER]"),
    # Database connection strings with passwords
    (re.compile(r"(postgres(?:ql)?|mysql|mongodb(?:\\+srv)?)://([^:\s]+):([^@\s]+)@"), r"\1://\2:[REDACTED_DB_PWD]@"),
    # JWT tokens
    (re.compile(r"\beyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b"), "[REDACTED_JWT_TOKEN]")
]

def redact_secrets(text: Optional[str]) -> str:
    """Sanitizes text removing secrets, passwords, bearer tokens, and keys."""
    if not text:
        return ""
    sanitized = text
    for pattern, replacement in REDACTION_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)
    return sanitized

def redact_data_structure(data: Any) -> Any:
    """Recursively redacts secrets in dicts and lists."""
    if isinstance(data, dict):
        new_dict = {}
        for k, v in data.items():
            k_lower = str(k).lower()
            if any(s in k_lower for s in ["password", "secret", "token", "authorization", "apikey", "api_key"]):
                new_dict[k] = "[REDACTED]"
            else:
                new_dict[k] = redact_data_structure(v)
        return new_dict
    elif isinstance(data, list):
        return [redact_data_structure(item) for item in data]
    elif isinstance(data, str):
        return redact_secrets(data)
    else:
        return data
