# SismoIA Enterprise — Fase 1

Proyecto independiente construido tomando como referencia la arquitectura modular de SalesIA Enterprise. **No se copiaron credenciales, bases de datos ni lógica de ventas.**

## Alcance de este ZIP
- Frontend React + TypeScript + Vite, con dashboard demostrativo responsive.
- Tema claro vino tinto y tema oscuro azul petróleo; preferencia de tema persistida localmente.
- Backend FastAPI con endpoints `/api/v1/health`, `/api/v1/system/capabilities`, OpenAPI `/docs`.
- Configuración PostgreSQL, modelos preliminares de fuentes/eventos y primera migración Alembic.
- Pruebas básicas HTTP de la API.

**No implementado aún:** login/RBAC, conectores IGP/USGS, ingesta real, mapas Leaflet georreferenciados, modelos ML, emisión de alertas, correo y reportes. La Fase 2 incluye autenticación; ingesta en Fase 3. Los datos del dashboard son ficticios. No utilizar para alertas de emergencia.

## Requisitos
Python 3.11+, Node.js 20+, Docker (opcional para PostgreSQL).

## Backend (Windows PowerShell)
```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```
Abrir `http://localhost:8000/docs`.

## Frontend (otra terminal)
```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```
Abrir `http://localhost:5173`. El botón en la cabecera cambia de tema. En el panel, pulsar el estado del backend para verificar su conexión.

## Base de datos (con Docker)
Desde la raíz: `docker compose up -d db`. Configurar `.env` del backend y luego:
```powershell
cd backend
alembic upgrade head
```
Nunca usar la contraseña de ejemplo en un despliegue público.

## Pruebas
```powershell
cd backend
python -m pytest -q
cd ../frontend
npm run build
```

## Integraciones pendientes de Fase 0
Validar las condiciones de uso automatizado del IGP, probar muestras reales, cerrar objetivo científicamente defendible de ML y matriz final de permisos.

## Landing page pública (ampliación Fase 1)
- `/`: landing pública responsive (presentación, funcionalidades, metodología y limitaciones).
- `/login`: vista de acceso **sin autenticación funcional**; el formulario está deshabilitado hasta Fase 2.
- `/app`: dashboard demostrativo existente, accesible sin autenticación **solo en Fase 1**. Proteger la ruta al implementar Fase 2.
- Tema claro borgoña y tema oscuro azul petróleo, compartidos entre las tres pantallas. Preferencia persistente en localStorage.
- Navegación con History API; para publicar la SPA, configurar el hosting con fallback de rutas a `index.html`.
- Ninguna pantalla representa datos sísmicos reales, funciones ML ejecutables ni alertas externas activas.
