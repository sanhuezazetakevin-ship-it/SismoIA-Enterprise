# Matriz de cumplimiento — SismoIA Enterprise, versión de trabajo

| Requisito del plan y observación docente | Evidencia / módulo actual | Estado | Pendiente de aceptación |
|---|---|---|---|
| Eventos USGS en vivo (F3) | `app/live_catalog.py`, pruebas de catálogo | Comprobado en desarrollo | Términos USGS y frescura publicados en UI |
| Consultas trazables y snapshots (Entrega A) | `app/snapshots.py`, migración 006, `test_snapshots_entrega_a.py` | Implementado; pruebas locales | Validar contra Supabase de pruebas, errores de fuente |
| Eventos usados en alertas conservados (A/C) | `app/monitoring.py` + `usgs_event_snapshots` | Implementado para escaneos | Probar migración 006 en PostgreSQL real |
| Todas las consultas con trazabilidad/errores | `live_catalog.py` | Parcial | Captura de errores y registros interactivos |
| Mapa geográfico real (F4) | `frontend/src/features/SeismicAnalytics.tsx`, mapa previo | Pendiente | Leaflet/MapLibre y escala/leyenda |
| Dispersión profundidad-magnitud (F4) | `frontend/src/features/SeismicAnalytics.tsx` | Pendiente de verificación | Añadir gráfico y metadatos |
| Datasets versionados (F5) | `app/datasets.py` calidad/CSV/hash | Parcial | Snapshot vinculado a versión inmutable |
| Clasificación con baseline (F6) | `app/ml_lab.py`, tests ML | Parcial | Auditoría de fuga de datos |
| Regresión simple/múltiple (F6) | No acreditada | Pendiente | MAE/RMSE/R², partición temporal |
| Registro de experimentos y estimaciones | No acreditado | Pendiente | Persistencia, limitaciones, gráficos |
| Avisos supervisados (F7) | `app/alerts.py`, ntfy, `monitoring.py` | Funcional en desarrollo | Tema autenticado privado, reglas zona/cooldown |
| Reportes CSV/PDF (F8 original) | CSV en `app/datasets.py` | Parcial | PDF con fuente, fecha de corte y actor |
| Seguridad, CI, recuperación, Railway (F9) | 83 tests locales, estructura Python | Parcial | Docker, CI, secretos, backups, Railway separado |
| Evidencias docentes | `GUIA_ENTREGA_A.md`, esta matriz | Parcial | Demo, capturas y checklist firmado |

No interpretar «implementado» como «validado en producción». La decisión aprobada es consultas USGS en vivo + persistencia selectiva; el alcance de los snapshots se irá ampliando de forma incremental.
