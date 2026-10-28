from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://sismoia:sismoia@localhost:5432/sismoia"
    cors_origins: str = "http://localhost:5173"
    environment: str = "development"
    jwt_secret: str = ""
    refresh_cookie_secure: bool = False
    refresh_cookie_samesite: str = "lax"
    push_enabled: bool = False
    monitoring_enabled: bool = False
    monitoring_actor_user_id: str = ""
    ntfy_base_url: str = "https://ntfy.sh"
    ntfy_topic: str = ""
    ntfy_access_token: str = ""
    ntfy_priority: int = 4
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("database_url", mode="before")
    @classmethod
    def assemble_db_url(cls, v: str) -> str:
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+psycopg://", 1)
            if v.startswith("postgresql://") and not v.startswith("postgresql+"):
                return v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v

settings = Settings()
