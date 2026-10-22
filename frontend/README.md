# SismoIA Enterprise — Frontend reconstruido desde cero

Frontend independiente, sin copiar el frontend comercial de SalesIA.

## Requisitos
- Node.js 20.19+ o 22.12+
- npm

## Ejecutar en Windows
```cmd
cd SismoIA-Frontend-Nuevo
npm install
copy .env.example .env.local
npm run dev
```
Abrir http://localhost:5173

## Validación
```cmd
npm run typecheck
npm run build
npm run preview
```

## Rutas
- `/`: landing pública
- `/login`: pantalla visual; **no autentica** hasta Fase 2
- `/app`: dashboard demostrativo
- `/app/mapa`, `/app/eventos`, `/app/estadisticas`, `/app/ml`, `/app/datasets`, `/app/alertas`, `/app/reportes`, `/app/configuracion`: navegación y pantallas preparadas para implementación posterior

## Arquitectura
- `src/app/`: proveedor de tema y layout empresarial.
- `src/components/`: componentes compartidos.
- `src/features/`: páginas y datos ficticios centralizados.
- `src/services/`: cliente HTTP tipado para FastAPI.
- `src/styles/`: estilos y tokens semánticos de color.
- `src/vite-env.d.ts`: tipos de Vite, evitando el error TS2339 de `import.meta.env`.

## Temas
- Claro: vino tinto y fondos blancos cálidos.
- Oscuro: azul petróleo profundo y detalles turquesa.
- Cambio desde el botón de tema. Se guarda preferencia en `localStorage`; si no existe, usa la preferencia del sistema.

## Integración backend
El cliente está preparado para `GET /api/v1/health`. Configurar `VITE_API_BASE_URL` en `.env.local`. El dashboard **no** afirma disponer de datos reales. La ingesta sísmica corresponde a fases posteriores; el login funcional a la Fase 2.

## Seguridad
No incluir credenciales ni tokens privados en variables `VITE_`: su contenido se incluye en la aplicación pública. Las rutas del dashboard son una **demo pública**, no rutas protegidas; el guard de autenticación y RBAC se implementarán con el backend en Fase 2.

## Notas de implementación
- TypeScript strict, TypeScript/Vite declarados expresamente.
- Estructura accesible con etiquetas, roles, foco y movimiento reducido.
- No se copian ni modifican el backend ni la base de datos de SalesIA.
