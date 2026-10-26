# SismoIA Enterprise — actualización UX técnica

## Objetivo
Identidad sobria azul petróleo / vino, comunicación no alarmista, navegación adaptada al rol y lectura inequívoca de eventos observados, resultados experimentales y avisos informativos.

## Implementado en esta entrega
- Tokens centralizados en `frontend/src/styles/tokens.css`, que conservan alias para no romper los estilos históricos.
- Estilos complementarios en `frontend/src/styles/enterprise.css`: foco, drawer móvil, tipografía numérica, modal y marcadores de magnitud monocromáticos.
- Navegación y cabecera en `frontend/src/app/layout.tsx`: rol, usuario, reloj UTC/Lima, salud de *API* (NO es salud USGS), menú móvil y enlace para saltar al contenido.
- Componente tipado `StatusBadge` para OBSERVADO / EXPERIMENTAL / AVISO INFORMATIVO.
- Componente tipado `ChartFooter` con unidad, período, N, fuente, corte UTC y filtros; aplicado a gráficos de estadísticas que ya disponen de esos metadatos.
- Avisos: ficha de evidencia antes de aprobar/enviar, razón >=10 caracteres obligatoria en el formulario y confirmación explícita. No permite aprobar el aviso propio desde la UI. Se conserva RBAC del servidor.
- Escala de magnitudes azul única en el mapa; no utilizar colores de semáforo.
- Preservados módulos y endpoints operativos de las entregas A–D y ML Iteración 2.

## Limitaciones deliberadas / trabajo pendiente
- La aprobación registra la nota en el backend actual; **el endpoint de envío no conserva actualmente la razón ingresada**. Para auditoría completa del motivo de envío hace falta ampliar contrato de API, modelo y pruebas antes de afirmar cumplimiento.
- El indicador de cabecera prueba `/api/v1/health`, NO disponibilidad/frescura USGS; su separación en tres estados específicos de USGS requiere backend.
- Reglas de avisos, Fuentes y Auditoría no son todavía pantallas independientes nuevas; conservan las rutas actuales. Simulación de reglas históricas sin envío está pendiente.
- `StatusBadge` no está integrado en todas las vistas todavía; se incluyó en eventos, mapa y avisos. Terminar integración en ML/reportes requiere adaptar contextos y datos.
- `ChartFooter` no cubre aún todos los gráficos existentes ni conoce filtros de todos los módulos. Se aplicó a estadísticas principales.
- El proyecto actual no tiene Tailwind instalado. Se centralizaron tokens CSS sin añadir dependencia insegura/incompleta; antes de introducir Tailwind, actualizar package.json y package-lock.json juntos y comprobar conflictos con CSS legado.
- El mapa existente carga Leaflet de CDN; para producción se requiere empaquetar Leaflet, respetar atribución y política del proveedor de teselas.
- Aún faltan pruebas de accesibilidad automatizadas, comprobación de contraste 4.5:1 en todas las combinaciones y pruebas E2E en móvil.

## Validación local requerida
1. Preservar `backend/.env` y `backend/.venv` y respaldar proyecto.
2. `cd frontend && npm ci && npm run build && npm run dev`.
3. Probar `/app`, `/app/eventos`, `/app/mapa`, `/app/estadisticas`, `/app/ml`, `/app/alertas`, `/app/reportes`.
4. Comprobar navegación móvil, enfoque teclado, reloj UTC/Lima, información gráfica, motivos del modal, bloqueo propio y NO envío automático.
5. `cd backend && python -m pytest tests/ -q -ra --tb=short` (suite previa: 118 aprobadas; esta entrega no altera backend).

## Seguridad
No usar el aviso informativo como sustituto de INDECI/IGP; no se generan predicciones de terremotos. El bloqueo de autoconfirmación en el frontend es una segunda barrera: el servidor continúa siendo el control de autorización decisivo.
