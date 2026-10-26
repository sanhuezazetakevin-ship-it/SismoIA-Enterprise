# SismoIA Enterprise — Entrega A (trazabilidad inicial y auditoría)

## Base verificada

- Repositorio proporcionado: `sismo IA.zip`, revisiones Alembic 001–005.
- SalesIA.zip se utilizó solo como referencia de patrones: **no se copiaron modelos comerciales, credenciales ni datos**.
- Pruebas ejecutadas en este entorno: **83 passed** (79 previas + 4 nuevas); SQLite temporal y respuestas USGS simuladas.
- **No se ha aplicado** la migración en Supabase ni se ha ejecutado un build de frontend en este entorno. El frontend se conserva sin cambios de código.

## Contenido implementado

- Migración incremental `006_usgs_query_snapshots.py`.
- Tablas `usgs_query_snapshots` y `usgs_event_snapshots`: parámetros, ventana UTC, propósito, SHA-256 del contenido canónico, datos de eventos conservados y referencias de procedencia.
- `app/snapshots.py`: servicio de captura, consulta del historial y detalle del snapshot; endpoints protegidos por el permiso existente `alertas.configurar` (temporal para MVP; granularizar permisos en futuras entregas).
- El monitoreo supervisado genera ahora un snapshot de eventos en la misma transacción que los candidatos. **Nunca llama a ntfy.**
- Se conserva la consulta en vivo para dashboard/eventos, sin persistencia masiva de cada visualización.

## Límites pendientes de aprobación/implementación

1. No todas las consultas interactivas al catálogo quedan persistidas: captura explícita y monitoreo sí. La trazabilidad total de lecturas y fallos de proveedor exige una política de volumen/retención y su propio tratamiento de errores.
2. Los snapshots **no están aún vinculados a experimentos ML**, porque el versionado formal de datasets/experimentos pertenece a la Entrega B.
3. La validación completa exige migración PostgreSQL real, comparación de hashes y revisión de privilegios de nuevas tablas (`anon` / `authenticated`).
4. No se registra todavía una ejecución fallida de USGS si el proveedor no devuelve un catálogo validable. Esta evidencia de errores es una ampliación pendiente.
5. `ntfy.sh` público no es un tema privado autenticado; mantener `PUSH_ENABLED=false` y solo contenidos ficticios hasta resolver la privacidad.
6. El nombre interno de «Fase 8 Monitoreo» se conserva para compatibilidad histórica; en la documentación académica se clasifica como complemento de Fases 3/7. La Fase 8 original sigue siendo Reportes y administración.

## Instalación segura (Windows)

1. Haz respaldo de `SismoIA-Enterprise`. Extrae este ZIP en otra carpeta y copia el código conservando tus `.env` locales; no subas secretos a GitHub.
2. Desde `backend`, comprueba `python -m alembic current` y `python -m alembic heads`. Debe verse `005` aplicado y `006` disponible.
3. Confirma que `DATABASE_URL` apunta solo al proyecto de prueba de SismoIA y revisa la migración `006`.
4. Ejecuta `python -m alembic upgrade head` y confirma `006 (head)`.
5. Ejecuta `python -m pytest tests/ -q -ra --tb=short`. Esperado: 83 aprobadas.
6. Con backend iniciado (`python -m uvicorn app.main:app --reload`), autentícate como administrador en `/docs`.
7. Prueba `POST /api/v1/snapshots/capture?days=1&minimum=6.0` y después `GET /api/v1/snapshots`.
8. Prueba un escaneo supervisado y verifica que aparece un snapshot `purpose=monitoring` sin envío externo.
9. Verifica que `anon` y `authenticated` carecen de permisos efectivos sobre las tablas nuevas. Para producción, ampliar revisión a RLS/Data API, backups y segregación de entornos.

## Criterios de aceptación de esta entrega

- 83 pruebas automatizadas aprobadas.
- Captura produce ID y SHA-256 de filas canónicas, y recupera los eventos correspondientes.
- Un usuario sin `alertas.configurar` no puede consultar ni capturar snapshots.
- Un resultado truncado/irregular no produce un snapshot de éxito.
- Monitoreo crea candidatos solo pendientes, con deduplicación y sin envío automático.
- Migración 006 aplicada y verificada por el usuario en Supabase de pruebas.

## Próximo orden aprobado por docente

1. Completar pendientes de evidencia/transparencia de consultas USGS y matriz de pruebas.
2. Mapa real Leaflet/MapLibre + dispersión profundidad–magnitud, fuente, muestra y fecha de corte.
3. Entrega B: datasets versionados, regresión simple/múltiple, clasificación sin fuga de datos, métricas y registro de experimentos.
4. Entrega C: reglas mínimas por magnitud, zona y cooldown; revisión humana obligatoria.
5. Entrega D: CSV/PDF con metadatos y permisos.
6. Entrega E: CI, Docker, Railway API+Cron, PostgreSQL de producción, backup/restauración y pruebas E2E mínimas.
