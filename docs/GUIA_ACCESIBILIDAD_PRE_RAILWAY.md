# SismoIA — Accesibilidad y estados: entrega de consolidación 1

## Cambios aplicados
- Diálogo de revisión de avisos: foco inicial en motivo, navegación Tab contenida, tecla Escape para cancelar y retorno del foco al elemento activador. La autorización y persistencia siguen siendo responsabilidad del backend.
- Gráficas estadísticas: se elimina la paleta naranja/roja codificada en el componente, utilizando tokens azules de la identidad corporativa.
- Consulta USGS: estados `loading` y `error` con mensajes distintos y accesibles (`role=status` y `role=alert`); un error de fuente nunca se representa como ausencia confirmada de sismos.
- Estilos globales de foco visible y preferencia de movimiento reducido.

## Verificación realizada
- `python -m pytest tests/ -q --tb=short`: 121 passed (base SQLite temporal de test).
- No se ha ejecutado `npm run build`: falta `yallist@3.1.1` en la caché npm de este entorno.
- No se modificaron migraciones, variables de entorno, endpoints, procedimientos de envío ni modelo ML.

## Comprobación en Windows
1. Conserva una copia del proyecto, `.env` y `.venv`; extrae el ZIP y reemplaza el código.
2. En `frontend`: `npm ci`, `npm run build` y `npm run dev`.
3. En `/app/alertas`, abre una revisión: el foco debe estar en el motivo, Tab permanece dentro del cuadro, Escape cierra y devuelve el foco al botón original.
4. En `/app/estadisticas`, verifica la paleta azul y los metadatos de las gráficas.
5. Simula indisponibilidad de USGS desde las herramientas de red de tu navegador, sin modificar la base: debe aparecer un error de fuente distinto de “sin eventos”.
6. Vuelve a comprobar el flujo de permisos con roles diferentes y ejecución de 121 tests de backend.

## Pendientes antes de Railway
- Auditoría integral WCAG de todas las pantallas y componentes; revisión con lector de pantalla y móvil real.
- Comprobar el contraste real de tokens y componentes del modo claro y oscuro.
- Evaluación de rendimiento del mapa y eliminación del CDN de Leaflet en producción.
- Auditoría de secretos y CI, copias de seguridad y restauración, separación de Supabase dev/prod y configuración segura de ntfy.
- Verificación de salud real de fuentes: el estado actual de barra superior corresponde a la API y NO prueba disponibilidad de USGS.
