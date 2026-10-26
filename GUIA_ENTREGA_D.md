# SismoIA Enterprise — Entrega D: reportes CSV y PDF

Base: proyecto completo de la **Entrega C** validada (Alembic `008`, 97 tests). Se conserva mapa, laboratorio ML, alertas y aprobación humana.

## Alcance

- `/app/reportes` en React, visible en navegación pero restringido funcionalmente por permiso `reportes.generar`.
- `GET /api/v1/reports/download?category=events|ml|alerts&format=csv|pdf&start=...&end=...`
- `GET /api/v1/reports/exports` historial propio de descargas.
- Exportaciones on-demand con fecha UTC, fuente, usuario solicitante y filtros.
- Historial en tabla `report_exports` (migración `009`), además de `audit_logs`.
- CSV UTF-8 con BOM, escaping de fórmulas para hojas de cálculo. PDFs resumidos con indicadores, gráfico de distribución y hasta 50 filas; CSV hasta 1.000 filas.
- Eventos: **solo snapshots USGS registrados**, no consulta en vivo ni catálogo completo. ML: experimentos persistidos. Avisos: su estado administrativo, no confirmación de recepción del destinatario.
- No hay envíos ntfy, aprobación ni mutación de avisos por exportar.

## Instalación en Windows

1. Copiar el proyecto completo haciendo respaldo previamente. Conservar `backend/.env` y `.venv` anteriores (el ZIP NO incluye secretos ni entornos virtuales).
2. Abrir CMD en `backend` con venv activo y confirmar que DATABASE_URL apunta al entorno **de pruebas**:

   ```cmd
   python -m pip install -r requirements.txt
   python -m alembic current
   python -m alembic upgrade head
   python -m alembic current
   python -m pytest tests/ -q -ra --tb=short
   ```

   Esperado: `009 (head)`, **104 passed**. La advertencia preexistente de Starlette puede continuar.

3. En `frontend`:

   ```cmd
   npm ci
   npm run build
   npm run dev
   ```

4. Iniciar FastAPI:

   ```cmd
   python -m uvicorn app.main:app --reload
   ```

5. Acceder como `ADMINISTRADOR` o `ANALISTA` a `/app/reportes`. Generar CSV y PDF de cada categoría. Comprobar que cambian los filtros y que el historial aparece después de refrescar. Repetir con rol `CONSULTA` (debe negar descarga con HTTP 403).

## Criterios de aceptación

- [ ] Alembic `009 (head)`.
- [ ] 104 pruebas completadas.
- [ ] `npm run build` correcto.
- [ ] CSV con encabezados, fuentes, filtros y fecha de corte.
- [ ] PDF legible y con indicadores/gráfico.
- [ ] Reporte conserva valores de los datos almacenados, no inventa registros.
- [ ] Descarga denegada a usuarios sin permiso `reportes.generar`.
- [ ] Historial propio de solicitudes persistente y registro en auditoría.
- [ ] 97 pruebas anteriores no regresionan.

## Límites y decisiones

- Reportes **síncronos** diseñados para MVP; sin almacén de archivos ni colas.
- El CSV tiene límite de **1.000 filas** y el PDF muestra hasta **50 filas** para mantener respuesta acotada; no deben presentarse como reportes exhaustivos si se alcanza el límite.
- Los filtros se aplican a la fecha de ocurrencia del evento, creación del estudio o creación del aviso, respectivamente; el detalle se muestra en UTC.
- El historial registra generaciones completadas, no reenvío ni entrega de avisos.
- No se modifica el stack de JWT/RBAC de SismoIA.
- **Producción en Railway:** diferir hasta Entrega E. Validar PostgreSQL/Supabase y backups antes de despliegue.

## Verificaciones ejecutadas en el entorno de elaboración

- `python -m pytest tests/ -q --tb=short` con SQLite temporal: **104 passed**.
- Generación PDF programática y revisión visual de render: realizada.
- `python -m compileall` del backend: correcta.
- `npm ci --offline` no pudo instalar una dependencia no presente en caché; por ello **no se certifica** la compilación de React aquí. Ejecutarla en Windows.
- Migración `009` escrita y preparada, pero no aplicada a Supabase del usuario desde este entorno.
