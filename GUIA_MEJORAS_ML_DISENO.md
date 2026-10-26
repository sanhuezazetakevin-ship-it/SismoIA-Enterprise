# SismoIA Enterprise — Mejoras ML y diseño (iteración 1)

Base: Entrega D validada (Alembic 009). Se conservan reportes, avisos, geolocalización, autenticación y snapshots. **No hay migración nueva.**

## Implementado
- Pregunta académica explícita para los tres tipos de experimento retrospectivo.
- Lista blanca de features `latitude`, `longitude`, `depth_km`, con prueba parametrizada que rechaza `mag`, `magnitude`, `magType`, `mag_error` y variables derivadas del target.
- Baselines identificados: regresión con media de entrenamiento; clasificación con clase mayoritaria y aleatorio estratificado de semilla fija.
- Métricas `precision`, `recall`, `F1` y soporte por clase en clasificación, más conteos por partición.
- Percentiles empíricos 5/95 de residuos de la prueba en regresión, marcados explícitamente como *descriptivos*, no intervalos predictivos calibrados.
- Registro de versiones de scikit-learn y pandas, y pregunta del experimento en la configuración guardada.
- Interfaz de ML muestra las métricas por clase, comparadores, límites interpretativos y librerías.

## Validación del desarrollo
- Backend: **113 passed** con base temporal SQLite, incluyendo nueve pruebas nuevas respecto de las 104 conocidas.
- Frontend: el entorno actual no dispone de `node_modules`, por lo que **`npm run build` aún no se ha verificado aquí**. Ejecutar en Windows.
- PostgreSQL/Railway: no se alteraron migraciones ni variables; validación de integración queda para el entorno de prueba.

## Instalación
1. Respaldar el proyecto y mantener `.env` y `.venv`.
2. Sustituir las carpetas `backend` y `frontend` por las del ZIP. No modificar la base de producción.
3. En `backend`: `python -m alembic current` (esperado `009 (head)`) y `python -m pytest tests/ -q -ra --tb=short` (esperado **113 passed**).
4. En `frontend`: `npm ci` (si procede), `npm run build`, `npm run dev`.
5. Ir a `/app/ml`, crear **nuevos experimentos** con un dataset versionado. Los experimentos ya guardados no adquieren retrospectivamente las nuevas métricas; permanecen intactos.
6. Abrir el detalle y revisar pregunta, baselines, métricas por clase, versiones de librerías y advertencias.

## Próximas iteraciones, respetando el documento
- **ML 2**: evaluación mediante ventanas cronológicas sucesivas (`TimeSeriesSplit`) con media y desviación de métricas, más análisis de estabilidad y desbalance. Verificar viabilidad con tamaño de dataset.
- **Interfaz 1**: `ChartFooter` con unidad, periodo, N, fuente, corte UTC y filtros; etiquetas OBSERVADO / EXPERIMENTAL / AVISO INFORMATIVO legibles sin depender solo del color.
- **Avisos 1**: ficha de evidencia, motivo obligatorio y confirmación antes de aprobar o enviar; rechazo/cancelación sencillo; conservar separación de operadores y no automatizar envíos.
- **Documentación**: diagrama ramificado de decisión de aviso; tabla de decisiones del profesor; capturas y matriz requisito-prueba.

El sistema analiza eventos observados. Ninguno de estos modelos permite anticipar terremotos ni sustituye información oficial.
