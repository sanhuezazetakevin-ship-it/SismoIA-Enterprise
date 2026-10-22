from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://sismoia:sismoia@localhost:5432/sismoia"
    cors_origins: str = "http://localhost:5173"
    environment: str = "development"
    jwt_secret: str = ""
    refresh_cookie_secure: bool = False
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
