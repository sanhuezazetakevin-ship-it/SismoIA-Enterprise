# SismoIA Enterprise — Verificación de reproducibilidad ML

## Objetivo
Repetir los cálculos de un experimento histórico guardado, sin crear un experimento nuevo, modificar PostgreSQL ni emitir avisos. Esta comprobación NO mide capacidad para anticipar terremotos.

## Instalación
Extraer el ZIP completo sobre copia de seguridad del proyecto, manteniendo `.env` y `.venv`. No hay migración nueva (Alembic 009).

### Backend
```cmd
cd C:\Users\sanhu\Desktop\SismoIA-Enterprise\backend
python -m pip install -r requirements.txt
python -m alembic current
python -m pytest tests/ -q -ra --tb=short
```
Resultado de referencia de esta entrega: 119 passed (suite ejecutada con SQLite temporal).

### Frontend
```cmd
cd C:\Users\sanhu\Desktop\SismoIA-Enterprise\frontend
npm ci
npm run build
npm run dev
```
No fue posible completar `npm ci` en el entorno de elaboración por paquete npm ausente de caché; comprobar build en Windows.

## Uso
En `/app/ml`, apartado **Comparar dos experimentos guardados**, seleccionar el experimento A y pulsar **Reentrenar y verificar experimento A**. El backend calcula de nuevo con el dataset versionado y la configuración guardada.

Endpoint protegido (permiso `modelos.entrenar`):
`POST /api/v1/ml/studies/{study_id}/verify-reproducibility`

Resultados:
- `identical`: coinciden métricas, baselines, observaciones y evaluación temporal guardada.
- `different`: existe una discrepancia; se indican `metrics_match` y `results_match`.
- `environment_changed`: cambió pandas o scikit-learn respecto al experimento original; no se declara una reproducción idéntica.
- `409`: integridad, configuración o dataset no válidos.

En experimentos de versiones anteriores, puede aparecer `different` debido a cambios de estructura de resultados; esto NO significa necesariamente que el modelo actual esté mal. Se recomienda crear un experimento nuevo con la última versión y verificarlo. Este botón no envía avisos ni modifica el experimento original.
