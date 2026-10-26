# SismoIA Enterprise — Auditoría inicial y preparación de producción

**Estado: NO AUTORIZADO A DESPLEGAR TODAVÍA.** Revisión estática del proyecto entregado, no una prueba en Railway/Supabase real.

## Observaciones del código

| Severidad | Hallazgo | Acción |
|---|---|---|
| Alta | El `ENVIRONMENT` anterior no activaba un validador de producción; `REFRESH_COOKIE_SECURE` podía quedar en false. | Se agregó `python -m scripts.preflight_production` para verificar variables de producción antes del despliegue. No modifica `.env` ni fuerza ajustes en desarrollo. |
| Alta | Valor de `DATABASE_URL` de desarrollo por defecto; riesgo de despliegue con DB incorrecta. | Crear Supabase independiente y pasar URL por secretos. Preflight bloquea localhost. |
| Alta | ntfy.sh con tema difícil de adivinar **no equivale a privado**. | Mantener `PUSH_ENABLED=false` hasta disponer de canal con autenticación y revisión de privacidad. |
| Media | No había Dockerfile ni pipeline CI en esta copia. | Se añaden Dockerfile de backend y flujo CI pytest. **Sin build Docker ni ejecución CI verificados aún**. |
| Media | `GET /api/v1/health` retorna valor fijo; no verifica PostgreSQL. | Añadir readiness basado en query SELECT 1 (pendiente, no confundir /health con /ready). |
| Media | El cron utiliza cuenta usuario por UUID. | Configurar cuenta técnica de mínimos permisos, credencial/actor independiente, logs y alertas sobre fallos. |
| Media | CORS usa orígenes de variables y credenciales. | Configurar solo dominio HTTPS del frontend y comprobar cookies cross-site según dominios reales. |
| Media | No se encontraron implementación integrada de backup/restauración ni pruebas de carga/E2E completas. | Probar pg_dump/pg_restore en instancia aislada, política de retención, E2E mínimo. |
| Baja | Descripciones `/health` y `/capabilities` conservan textos de fases antiguas. | Actualizar mensajes después de congelar versiones. |

## Archivos nuevos

- `backend/scripts/preflight_production.py`: comprobación local, sin conexión ni divulgación de secretos.
- `backend/tests/test_preflight_production.py`: pruebas de configuración insegura.
- `backend/Dockerfile` y `.dockerignore`: empaquetado mínimo de API.
- `backend/.env.example`: plantilla sin credenciales reales.
- `.github/workflows/backend.yml`: suite automatizada al enviar cambios.

## Instrucciones de comprobación

1. `cd backend && python -m pytest tests/ -q --tb=short`.
2. `docker build -t sismoia-api -f backend/Dockerfile backend` desde la raíz (requiere Docker).
3. En Railway, crea **dos servicios** desde la misma carpeta `backend`: API con inicio uvicorn (Dockerfile incluido) y cron con comando `python -m scripts.scan_candidates`.
4. Antes de habilitar la API o cron, ejecutar preflight tras definir variables seguras: `python -m scripts.preflight_production`.
5. Cron Schedule: `*/15 * * * *` (UTC); Railway omite ejecuciones si anterior sigue activa.
6. No aplicar Alembic automáticamente en cada arranque; ejecutar migraciones controladas con backup previo.
7. Verificar PostgreSQL con cuenta restringida, RBAC por perfil, rutas anónimas 401/403, refresh cookie, CORS desde dominio real y ausencia de fugas en logs.
8. Confirmar copia y **restauración** en una base aislada antes de considerar producción.
9. Ejecutar E2E mínimo evento observado → candidato → segundo operador → justificación → auditoría, **sin push externo**.

## Pendiente antes de producción

- La configuración actual no prueba que Supabase producción exista ni que sus permisos estén ajustados.
- El chequeo de configuración es una barrera adicional, no sustituye validación de seguridad ni de permisos reales.
- Probar la compilación React, accesibilidad, Docker/CI, conexión real, HTTPS y rollback.
- No habilitar envíos por ntfy público.
