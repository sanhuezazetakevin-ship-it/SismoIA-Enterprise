from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.auth import router as auth_router
from app.events import router as events_router
from app.analytics import router as analytics_router
from app.datasets import router as datasets_router
from app.ml_lab import router as ml_router
from app.alerts import router as alerts_router
from app.monitoring import router as monitoring_router
from app.snapshots import router as snapshots_router
from app.ml_reproducible import router as ml_repro_router
from app.alert_rules import router as alert_rules_router
from app.reports.routes import router as reports_router

app = FastAPI(title="SismoIA Enterprise API", version="0.1.0", description="Fase 6 híbrida — consultas USGS sin persistencia de eventos; ML retrospectivo")
app.add_middleware(CORSMiddleware, allow_origins=[x.strip() for x in settings.cors_origins.split(",") if x.strip()], allow_credentials=True, allow_methods=["GET", "POST", "PUT", "PATCH"], allow_headers=["*"])

@app.get("/api/v1/health", tags=["System"])
def health():
    return {"status": "ok", "project": "SismoIA Enterprise", "phase": 6}

@app.get("/api/v1/system/capabilities", tags=["System"])
def capabilities():
    return {"mode": "live_usgs_hybrid", "live_data": True, "external_notifications": False, "ml_predictions": False, "ml_experiments": True, "data_sources": ["IGP (pendiente de validación)", "USGS (consultas bajo demanda; caché temporal)"]}

app.include_router(auth_router)
app.include_router(events_router)
app.include_router(analytics_router)

app.include_router(datasets_router)
app.include_router(ml_router)
app.include_router(alerts_router)
app.include_router(monitoring_router)

app.include_router(snapshots_router)
app.include_router(ml_repro_router)

app.include_router(alert_rules_router)

app.include_router(reports_router)
