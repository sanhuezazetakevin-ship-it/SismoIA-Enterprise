import hashlib
import secrets
from datetime import datetime, timedelta, timezone
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError
from app.config import settings

hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2)
ALGORITHM = 'HS256'

def hash_password(password: str) -> str:
    if len(password) < 12 or len(password) > 128:
        raise ValueError('La contraseña debe tener entre 12 y 128 caracteres')
    return hasher.hash(password)

def verify_password(password: str, stored: str) -> bool:
    try:
        return hasher.verify(stored, password)
    except (VerifyMismatchError, VerificationError):
        return False

def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

def issue_access(user_id: str, session_id: str) -> str:
    if len(settings.jwt_secret) < 32: raise RuntimeError("JWT_SECRET debe tener al menos 32 caracteres")
    now = datetime.now(timezone.utc)
    return jwt.encode({'sub':user_id, 'sid':session_id, 'iat':now, 'nbf':now, 'exp':now+timedelta(minutes=15), 'typ':'access', 'jti':secrets.token_hex(16)}, settings.jwt_secret, algorithm=ALGORITHM)

def decode_access(token: str) -> dict:
    payload = jwt.decode(token,settings.jwt_secret,algorithms=[ALGORITHM], options={'require':['sub','sid','exp','iat','nbf','typ']})
    if payload.get('typ') != 'access':
        raise jwt.InvalidTokenError('Tipo incorrecto')
    return payload

def new_refresh() -> str:
    return secrets.token_urlsafe(48)
