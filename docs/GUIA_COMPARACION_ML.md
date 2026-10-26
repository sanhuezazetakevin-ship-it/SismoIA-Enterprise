# SismoIA Enterprise — Comparación guiada de experimentos

## Alcance
Se incorporó la comparación de dos experimentos ya almacenados. No se entrena nuevamente, no se modifica PostgreSQL ni se cambian las rutas del backend.

En **/app/ml**, elegir dos experimentos diferentes en el bloque "Comparar dos experimentos guardados" y pulsar **Comparar resultados**.

- Si son tareas diferentes, la pantalla advierte que no se pueden comparar directamente las métricas.
- Si tienen datasets distintos, se muestran las métricas con advertencia de que no demuestra superioridad.
- Si comparten dataset y tarea, compara modelo y baseline para cada métrica.
- Si comparten también la configuración completa, comprueba la igualdad exacta de las métricas como evidencia limitada de reproducibilidad.
- MAE y RMSE: menor es mejor; R², precision, recall y F1: mayor es mejor.

**Limitaciones:** los valores presentados pueden coincidir por casualidad; esta verificación comprueba métricas almacenadas, no reproduce íntegramente el entrenamiento. Que un modelo supere un baseline tampoco establece capacidad de predecir terremotos. Los análisis son retrospectivos de eventos ya observados.

## Instalación
Conservar `.env` y `.venv` de la instalación local; respaldar el proyecto antes de sustituir los archivos del ZIP.

Backend: `python -m pytest tests/ -q --tb=short` — 118/118 aprobadas en este entorno.
Frontend: `npm ci`, `npm run build`, `npm run dev` — la compilación completa debe validarse localmente: el entorno de elaboración no cuenta con `node_modules` ni acceso para recuperarlo.

## Guion de validación
1. Revisar dos experimentos guardados del **mismo dataset** y tipo, pero con configuraciones distintas.
2. Revisar dos experimentos guardados del **mismo dataset**, tipo, umbral y semilla, ejecutados en diferentes momentos.
3. Confirmar que aparecen las métricas de ambos modelos y los baselines.
4. Confirmar que la vista rechaza la comparación directa entre regresión y clasificación.
5. Recargar la página y repetir la comparación, verificando la recuperación desde PostgreSQL.
6. Confirmar que los datos de eventos, avisos y reportes no cambian.

## Qué queda pendiente
- Pruebas de navegador y compilación TypeScript en el equipo del usuario.
- Validación científica externa; revisión de sesgos geográficos y cobertura USGS.
- Si se desea una **reproducibilidad verificable fuerte**, incorporar una acción backend que vuelva a entrenar a partir del hash del dataset y compare las métricas con tolerancias explícitas y versiones fijadas de dependencias.
