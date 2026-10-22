from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.auth import router as auth_router
from app.events import router as events_router

app = FastAPI(title="SismoIA Enterprise API", version="0.1.0", description="Fase 3 — catálogo USGS, sin predicción ni alertas públicas")
app.add_middleware(CORSMiddleware, allow_origins=[x.strip() for x in settings.cors_origins.split(",") if x.strip()], allow_credentials=True, allow_methods=["GET", "POST", "PUT", "PATCH"], allow_headers=["*"])

@app.get("/api/v1/health", tags=["System"])
def health():
    return {"status": "ok", "project": "SismoIA Enterprise", "phase": 3}

@app.get("/api/v1/system/capabilities", tags=["System"])
def capabilities():
    return {"mode": "scaffold", "live_data": True, "external_notifications": False, "ml_predictions": False, "data_sources": ["IGP (pendiente de validación)", "USGS (sincronización manual)"]}

app.include_router(auth_router)
app.include_router(events_router)
