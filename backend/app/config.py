from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://sismoia:sismoia@localhost:5432/sismoia"
    cors_origins: str = "http://localhost:5173"
    environment: str = "development"
    jwt_secret: str = ""
    refresh_cookie_secure: bool = False
    push_enabled: bool = False
    monitoring_enabled: bool = False
    monitoring_actor_user_id: str = ""
    ntfy_base_url: str = "https://ntfy.sh"
    ntfy_topic: str = ""
    ntfy_access_token: str = ""
    ntfy_priority: int = 4
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
