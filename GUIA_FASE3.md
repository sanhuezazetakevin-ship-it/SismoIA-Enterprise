# SismoIA Enterprise — Fase 3 (ingesta de eventos)

## Estado

- Conserva la autenticación JWT, RBAC, auditoría y el frontend de fases anteriores.
- Incluye **conector USGS FDSN** con parámetros controlados para Perú y océano cercano, sincronización **manual** autorizada, historial de sincronizaciones, registro/actualización de eventos existentes, endpoints de lectura y vista de catálogo.
- **IGP pendiente**: se identificó el servicio `SismosReportados/MapServer/0`, pero no se activa extracción automática mientras se verifican términos de uso, identificadores, fechas y campos. No hay alerta temprana ni estimaciones ML.
- El dashboard principal permanece demostrativo y está identificado como tal. La ruta `/app/eventos` consulta registros reales almacenados.

## Instalar en Windows

1. Guarda una copia de `SismoIA-Enterprise` y extrae las carpetas `frontend` y `backend` del ZIP en una nueva carpeta. No reemplaces tu `.env` de trabajo, ni copies `.venv`, `node_modules`, `dist`.
2. En `backend`, conserva el `.env` de Supabase (proyecto **SismoIA**, nunca SalesIA) y JWT_SECRET. Activa `.venv` e instala dependencias con `python -m pip install -r requirements.txt`.
3. Comprueba que la base está en `002`: `python -m alembic current`, que `python -m alembic heads` informa `003`.
4. Haz una copia/backup y revisa `alembic/versions/003_ingestion.py`. Ejecuta `python -m alembic upgrade head` y `python -m alembic current` (esperado `003`). La migración agrega `ingestion_runs` y campos de trazabilidad a tablas existentes, sin cambiar usuarios ni eliminar datos.
5. Comprueba que las **nuevas tablas y permisos** no estén expuestos a `anon`/`authenticated` en Supabase. Revisa RLS y permisos efectivos antes de cualquier despliegue público; no reutilices credenciales del frontend para acceder directamente a PostgreSQL.
6. Inicia FastAPI: `uvicorn app.main:app --reload`. Abre `http://localhost:8000/docs`.
7. Inicia sesión como administrador. En Swagger, autoriza con el **access token** de desarrollo y ejecuta `POST /api/v1/sources/usgs/sync?days=7&limit=250` (permiso `fuentes.administrar`). La consulta hace una petición al USGS; requiere conexión a Internet. No hagas sincronización repetida para probar carga sin respetar límites del proveedor.
8. En `frontend`: `npm ci` y `npm run build`, luego `npm run dev`. Inicia sesión y visita `/app/eventos`.

## Endpoints

- `GET /api/v1/events?page=1&page_size=25`: registros con paginación y filtros `min_magnitude`, `max_magnitude`, `from_date`, `to_date`; requiere `eventos.ver`.
- `GET /api/v1/events/geojson?limit=500`: GeoJSON de eventos existentes.
- `GET /api/v1/events/{id}`: detalle.
- `GET /api/v1/sources`: estado de fuentes.
- `GET /api/v1/ingestion/runs`: historial, solo permiso `fuentes.administrar`.
- `POST /api/v1/sources/usgs/sync?days=7&limit=250`: sincronización manual; `fuentes.administrar`.

**Nota:** el catálogo inicial usa un rectángulo geográfico (latitud −22..1, longitud −84..−68), incluye sismos fuera de límites políticos peruanos. Los datos son eventos **observados** por USGS, no pronósticos ni señales oficiales peruanas. Puede haber magnitudes ausentes y profundidades negativas de USGS: estas últimas se guardan como `NULL`, conservando el valor bruto. La base almacena registros de proveedores separadamente; no deduplica entre IGP y USGS.

## Pruebas automatizadas

En `backend`, con el entorno virtual activo:

```
python -m pytest tests/test_security_automated.py tests/test_ingestion_phase3.py -q -ra
```

Resultado en entorno de construcción: **23 passed**. Se usa SQLite temporal y respuestas HTTP simuladas; no se conecta a Supabase ni a USGS real durante pytest. **Quedan pendientes** compilación del frontend en Windows, ejecución de migración en tu Supabase, prueba HTTP real USGS y prueba de listado de eventos con PostgreSQL.

## Configuración / mantenimiento

- No ejecutes `bootstrap_auth` si ya tienes el administrador. Nunca compartas `.env` o tokens.
- En entorno de producción usa HTTPS, secretos externos, control de exposición Data API y roles de DB mínimos.
- Si USGS no responde, la API reporta fallo 502 al usuario autorizado y el historial marca `failed`.
- No hay scheduler automático en esta entrega. La planificación periódica solo se habilitará tras validar frecuencia/limites y controles de operación.
