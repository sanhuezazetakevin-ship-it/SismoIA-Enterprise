# SismoIA — Mejora de avisos supervisados

## Cambios principales
- `GET /api/v1/alerts/{id}/evidence`: agrega los metadatos de la última captura USGS que contenga el evento, si existe, e historial de decisiones. Requiere `alertas.aprobar`.
- Aprobar, rechazar, cancelar y confirmar un envío requieren un motivo de 10 a 500 caracteres. La aprobación continúa exigiendo una persona diferente del creador.
- El envío explícito incorpora un `AlertReview` con decisión `send_confirmed` y motivo. No hay envío automático; con `PUSH_ENABLED=false` la llamada devuelve 503.
- `GET /api/v1/alert-rules/{rule_id}/simulate?snapshot_id=<UUID>`: aplica una regla sobre eventos archivados de un snapshot completo, ordenados por fecha, y calcula eventos elegibles y excluidos por cooldown. No crea candidatos, avisos, entregas ni cambia reglas.
- La vista `/app/alertas` muestra evidencia y motivos, y ofrece un simulador histórico.

## Importante para operaciones
- La evidencia proviene de snapshots persistidos, no es una validación en vivo ni sustituye la revisión manual de USGS.
- La simulación es una aproximación histórica del comportamiento de UNA regla; no representa toda la deduplicación global ni simultaneidad de reglas en producción.
- El acceso a una URL externa no prueba que sea una fuente oficial de alerta temprana.
- El proveedor `ntfy.sh` público no ofrece privacidad por tener un tema largo. Para una demostración con información no pública, utilizar una instancia autenticada y un tema protegido; mantener `PUSH_ENABLED=false` hasta validar ese control.
- No se añadieron migraciones nuevas: se reutiliza la tabla `alert_reviews` existente.

## Instalación Windows
1. Respalda el proyecto y conserva `.env` y `.venv`.
2. Extrae el ZIP completo.
3. Desde `backend`, ejecuta `python -m alembic current` (esperado `009 (head)`) y `python -m pytest tests/ -q -ra --tb=short` (esperado 121 tests).
4. Desde `frontend`, ejecuta `npm ci`, `npm run build`, `npm run dev`.
5. En `/app/alertas`, abre un candidato pendiente, consulta la evidencia y prueba motivo corto (debe rechazarse); otro operador autorizado puede aprobar con una justificación de 10+ caracteres.
6. Selecciona regla y UUID de snapshot archivado en el simulador y comprueba `messages_sent: 0`, `candidates_created: 0`.
7. Al actualizar `/app/alertas`, los avisos deben mantener sus estados; consulta `/api/v1/alerts/{id}/evidence` para revisar motivos archivados.

## Pruebas de esta entrega
- 119 pruebas de regresión existentes (adaptadas al nuevo contrato de motivos).
- 2 nuevas pruebas: obligación de motivo/evidencia/RBAC y simulación histórica de solo lectura.
- Total `121 passed` en el entorno de preparación.
- El frontend NO se compiló aquí: `npm ci --offline` falla al no encontrar `yallist@3.1.1` en caché. Requiere verificación local.

## Próxima revisión
- Pruebas end-to-end del flujo de aviso con dos usuarios y un proveedor ntfy privado.
- Pruebas de accesibilidad de diálogo, carga de evidencia y estados.
- Verificar que la simulación histórica coincide con el algoritmo real de cooldown en casos extremos y en varias reglas.
