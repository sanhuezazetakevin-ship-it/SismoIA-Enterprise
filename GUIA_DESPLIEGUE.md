# 🚀 Guía de Despliegue en Producción: Vercel & Railway

Esta guía detalla el procedimiento completo y probado para desplegar **SismoIA Enterprise** en la nube con arquitectura desacoplada:

- **Frontend**: Alojado en **Vercel** (Vite + React 19 SPA con soporte de sub-rutas).
- **Backend**: Alojado en **Railway** (FastAPI en contenedor Docker con Postgres 16 gestionado).

---

## 🛠️ Ajustes de Compatibilidad Implementados en el Código

1. **SPA Routing en Vercel (`frontend/vercel.json`)**:
   - Reescrituras hacia `/index.html` para evitar errores 404 al recargar páginas internas (`/dashboard`, `/alerts`, `/analytics`, etc.).
2. **Normalización Automática del Driver de Base de Datos (`backend/app/config.py`)**:
   - Traducción transparente de esquemas `postgres://` y `postgresql://` a `postgresql+psycopg://` (driver `psycopg 3`).
3. **Manejo Seguro de Cookies Cross-Site (`backend/app/auth.py`)**:
   - Compatible con peticiones entre `*.vercel.app` y `*.railway.app` mediante `SameSite=None` y `Secure=True`.
4. **Auto-Migración y Auto-Sembrado en Docker (`backend/Dockerfile` y `backend/railway.json`)**:
   - Al arrancar en Railway, el backend ejecuta automáticamente `alembic upgrade head` y `python scripts/seed_demo_data.py`.

---

## 📋 Paso 1: Subir los Cambios a GitHub

Empuja los últimos commits de tu rama hacia el repositorio remoto:

```powershell
git push origin Frontend_actualizacion
```

---

## 🐘 Paso 2: Despliegue en Railway (Backend + PostgreSQL)

1. Ve a [railway.app](https://railway.app/) e inicia sesión con tu cuenta de GitHub.
2. Haz clic en **"New Project"** -> selecciona **"Provision PostgreSQL"**.
3. En el mismo proyecto, haz clic en **"+ New"** -> selecciona **"GitHub Repo"** -> escoge `SismoIA-Enterprise`.
4. En el servicio del repositorio creado:
   - Ve a **Settings** -> en **Root Directory**, define: `backend`
   - Guarda los cambios (Railway usará `backend/Dockerfile` y `backend/railway.json`).
5. Ve a la pestaña **Variables** y agrega:
   - `DATABASE_URL`: Asigna la referencia `${{Postgres.DATABASE_URL}}` (o selecciona la variable del servicio PostgreSQL).
   - `ENVIRONMENT`: `production`
   - `JWT_SECRET`: Cadena aleatoria segura (ej. genera una con `python -c "import secrets; print(secrets.token_hex(32))"`).
   - `REFRESH_COOKIE_SECURE`: `true`
   - `REFRESH_COOKIE_SAMESITE`: `none`
   - `PUSH_ENABLED`: `false`
   - `MONITORING_ENABLED`: `false`
   - `CORS_ORIGINS`: `http://localhost:5173` *(lo actualizaremos en el paso 4 con la URL de Vercel)*.
6. En **Settings** -> **Networking**, haz clic en **"Generate Domain"** y anota tu dominio público (ej: `https://sismoia-backend-production.up.railway.app`).

---

## ⚡ Paso 3: Despliegue en Vercel (Frontend)

1. Ve a [vercel.com](https://vercel.com/) e inicia sesión con GitHub.
2. Haz clic en **"Add New..."** -> **"Project"** e importa `SismoIA-Enterprise`.
3. En la pantalla de configuración:
   - **Root Directory**: Haz clic en **Edit** y selecciona la carpeta `frontend`.
   - **Framework Preset**: Detectará **Vite**.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. En **Environment Variables**:
   - `VITE_API_BASE_URL`: Ingresa la URL pública de Railway generada en el Paso 2 (ej: `https://sismoia-backend-production.up.railway.app` sin barra final `/`).
5. Haz clic en **"Deploy"**.

---

## 🔗 Paso 4: Enlazar CORS en Railway

1. Cuando Vercel finalice la compilación, copia tu dominio de frontend (ej: `https://sismoia-enterprise.vercel.app`).
2. Regresa a Railway -> servicio backend -> pestaña **Variables**.
3. Actualiza `CORS_ORIGINS`:
   ```env
   CORS_ORIGINS=https://sismoia-enterprise.vercel.app,http://localhost:5173
   ```
4. Railway se reiniciará en segundos aplicando el enlace seguro.

---

## 🔑 Credenciales Demo Disponibles

| Usuario | Contraseña | Rol |
| :--- | :--- | :--- |
| `administrador@example.com` | `Password-for-local-tests-2026!` | Administrador Total |
| `analista@example.com` | `Password-for-local-tests-2026!` | Analista de Datos / ML |
| `operador_alertas@example.com` | `Password-for-local-tests-2026!` | Operador de Alertas |
| `auditor@example.com` | `Password-for-local-tests-2026!` | Auditor de Seguridad |
| `consulta@example.com` | `Password-for-local-tests-2026!` | Consulta General |
