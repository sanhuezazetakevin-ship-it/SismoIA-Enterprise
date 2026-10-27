# SismoIA Enterprise

> **Plataforma Integral de Monitorización Sismológica, Reconciliación Multifuente, Alertas Automatizadas y Machine Learning Reproducible.**

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Alembic](https://img.shields.io/badge/Alembic-Migrations%20001--009-red)](https://alembic.sqlalchemy.org/)
[![Tests](https://img.shields.io/badge/Backend%20Tests-125%2F125%20Passing-success)](file:///backend/tests)
[![Build](https://img.shields.io/badge/Frontend%20Build-Passing-brightgreen)](file:///frontend)

---

## ⚠️ Declaración Institucional y Descargo Científico

> **SismoIA Enterprise NO predice terremotos.**
> 
> En estricto apego al consenso de la comunidad sismológica y geofísica internacional (**USGS**, **IGP**, **IASPEI**), la predicción exacta de la fecha, hora, magnitud y epicentro de un evento sísmico futuro es científicamente inviable con la tecnología y conocimiento actuales.
>
> **SismoIA Enterprise es un sistema post-evento y analítico diseñado para:**
> 1. Ingesta consolidada y continua desde agencias oficiales (**IGP**, **USGS**, **EMSC**).
> 2. Reconciliación sismológica y detección automatizada de discrepancias inter-agencia.
> 3. Evaluación en tiempo real de reglas de notificación con protocolos de **revisión dual**.
> 4. Modelado estadístico y Machine Learning reproducible con **certificación criptográfica SHA-256**.
> 5. Auditoría inmutable de trazabilidad para operaciones de protección civil y monitoreo técnico.

---

## 📋 Tabla de Contenidos

1. [Arquitectura y Stack Tecnológico](#-arquitectura-y-stack-tecnológico)
2. [Módulos Funcionales del Sistema](#-módulos-funcionales-del-sistema)
3. [Requisitos Previos del Entorno](#-requisitos-previos-del-entorno)
4. [Guía de Instalación y Despliegue Local](#-guía-de-instalación-y-despliegue-local)
5. [Credenciales de Demostración (Matriz RBAC)](#-credenciales-de-demostración-matriz-rbac)
6. [Validación y Suite de Pruebas](#-validación-y-suite-de-pruebas)
7. [Guía de Evaluación en Vivo (Script en 9 Pasos)](#-guía-de-evaluación-en-vivo-script-en-9-pasos)
8. [Estructura del Proyecto](#-estructura-del-proyecto)

---

## 🏗 Arquitectura y Stack Tecnológico

El sistema implementa una arquitectura desacoplada y orientada a servicios, optimizada para alta disponibilidad, integridad referencial y auditoría estricta:

```
┌─────────────────────────────────────────────────────────────┐
│                 Frontend SPA (React 19 + Vite)              │
│  - Dashboard Operativo        - Mapa GIS Interactivo Leaflet│
│  - Reconciliación Multifuente - Simulador de Reglas Alerta  │
│  - MLLab Reproducible SHA-256 - Analítica Gutenberg-Richter │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON REST API (JWT)
┌──────────────────────────────▼──────────────────────────────┐
│                  Backend API (FastAPI + Python 3.12)        │
│  - Autenticación y RBAC        - Motor de Ingesta & Sync    │
│  - Reconciliador de Eventos   - Motor de Reglas & Dry-Run   │
│  - Pipeline ML Determinista   - Pistas de Auditoría Append  │
└──────────────────────────────┬──────────────────────────────┘
                               │ SQLAlchemy 2.0 ORM + Psycopg
┌──────────────────────────────▼──────────────────────────────┐
│                 Base de Datos (PostgreSQL 17)               │
│  - 9 Migraciones Alembic      - Catálogo Sísmico Georref.   │
│  - Registro de Auditoría      - Modelos y Datasets SHA-256  │
└─────────────────────────────────────────────────────────────┘
```

### Tecnologías Principales

* **Backend:**
  * **Python 3.12** & **FastAPI** para endpoints asíncronos de alto rendimiento.
  * **SQLAlchemy 2.0** (modelos ORM y consultas optimizadas).
  * **Alembic** (control versionado del esquema relacional: migraciones 001 a 009).
  * **Pydantic v2** para validación estricta de payloads y contratos de datos.
  * **PyJWT & Passlib (Bcrypt)** para autenticación por tokens y hashing de contraseñas.
  * **Scikit-Learn & Joblib** para clustering geoespacial, detección de anomalías y clasificación proxy de intensidad.
  * **HTTPX** para ingesta asíncrona de fuentes externas.

* **Frontend:**
  * **React 19** & **TypeScript 5.7** estructurado bajo arquitectura por componentes y vistas corporativas.
  * **Vite 6** como motor de empaquetado y hot-reloading ultrarrápido.
  * **Recharts** para visualizaciones analíticas sismológicas (Gutenberg-Richter, Benioff, Scatter Plot panorámico).
  * **Leaflet & OpenStreetMap** para el visor cartográfico georreferenciado con filtrado espacial dinámico.
  * **Lucide React** para iconografía de grado empresarial.
  * **Sistema de Tokens CSS Dual**: Tema Oscuro (*Azul Petróleo / Slate*) y Tema Claro (*Borgoña Corporativo*) con soporte de accesibilidad y alto contraste.

* **Base de Datos:**
  * **PostgreSQL 17** con esquema normalizado, claves foráneas estrictas e índices optimizados para coordenadas y marcas temporales.

---

## 🧩 Módulos Funcionales del Sistema

| Módulo | Sección Doc. | Descripción Técnica |
|---|---|---|
| **Control de Acceso (RBAC)** | §6.1 | Autenticación JWT con rotación, sesiones seguras y 5 roles con permisos granulares (**ADMINISTRADOR**, **ANALISTA**, **OPERADOR_ALERTAS**, **AUDITOR**, **CONSULTA**). |
| **Ingesta Multifuente** | §6.2 | Conectores para **USGS**, **IGP** y **EMSC**. Deduplicación espaciotemporal automática en ventana de 16 minutos y 100 km de radio. Generador sintético determinista para pruebas offline. |
| **Reconciliación y Discrepancias** | §6.3 | Detección cruzada de divergencias en magnitud ($\Delta M \ge 0.5$), profundidad ($\Delta Z \ge 30\text{ km}$) y distancia epicentral ($\Delta D \ge 50\text{ km}$) entre agencias. |
| **Visor Cartográfico GIS** | §6.4 | Mapa interactivo Leaflet con marcadores dinámicos por magnitud, codificación de color por rango de profundidad (superficial, intermedia, profunda) y filtros por fecha y coordenadas. |
| **Motor de Reglas y Simulación** | §6.5 | Definición de umbrales condicionales, **simulación histórica (Dry-Run)** sobre catálogo existente para calibrar falsos positivos, y protocolo de **revisión por doble operador** para alertas críticas. |
| **MLLab y Reproducibilidad Criptográfica** | §6.6 | Algoritmos de clustering espacial (K-Means), detección de anomalías (Isolation Forest) y clasificación de intensidad (Random Forest). Congelamiento de hiperparámetros, cálculo de hash SHA-256 del dataset y del artefacto binario, con endpoint de verificación matemática de integridad bit a bit. |
| **Pistas de Auditoría Inmutable** | §6.7 | Registro append-only de todas las mutaciones del sistema con timestamp UTC, IP origen, ID de usuario, acción ejecutada y metadata serializada. Exportación en formatos CSV y JSON. |
| **Analítica Sismológica Avanzada** | §6.8 | Estimación del valor $b$ de la ley Gutenberg-Richter, curva acumulada de liberación de deformación elástica de Benioff y gráfico panorámico de correlación profundidad vs. magnitud. |

---

## 💻 Requisitos Previos del Entorno

Antes de comenzar la instalación, asegúrese de contar con las siguientes herramientas en su estación de trabajo:

1. **Python 3.11 o 3.12** (con `pip` y soporte de `venv`):
   ```bash
   python --version
   ```
2. **Node.js 20+** y **npm 10+**:
   ```bash
   node -v
   npm -v
   ```
3. **PostgreSQL 17** (bien sea instalado como servicio local nativo o mediante **Docker Desktop**):
   ```bash
   psql --version
   # O en caso de usar Docker:
   docker --version
   ```
4. **Git**:
   ```bash
   git --version
   ```

---

## 🚀 Guía de Instalación y Despliegue Local

Siga estos pasos secuenciales para clonar, configurar y levantar la plataforma completa en una máquina nueva.

### Paso 1: Clonar el Repositorio

Abra una terminal y descargue el proyecto:

```bash
git clone https://github.com/tu-organizacion/sismoia-enterprise.git
cd sismoia-enterprise
```

---

### Paso 2: Configurar la Base de Datos PostgreSQL

Puede levantar la base de datos usando **Docker** o mediante su instalación **local de PostgreSQL**:

#### Opción A: Con Docker Compose (Recomendada)
Desde la raíz del proyecto ejecute:
```bash
docker compose up -d db
```
*Esto iniciará un contenedor PostgreSQL 17 en el puerto `5432` con usuario `sismoia`, contraseña `sismoia` y base de datos `sismoia`.*

#### Opción B: Con PostgreSQL Local
Si tiene PostgreSQL instalado localmente en el puerto `5432`:
1. Asegúrese de que el servicio esté en ejecución.
2. Cree la base de datos `sismoia` o ejecute el script automatizado provisto:
   ```powershell
   cd backend
   python scripts/setup_local_db.py
   cd ..
   ```

---

### Paso 3: Configurar y Levantar el Backend

1. **Navegar a la carpeta del backend y crear el entorno virtual:**

   *En Windows (PowerShell):*
   ```powershell
   cd backend
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

   *En Linux / macOS:*
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. **Instalar dependencias:**
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

3. **Configurar variables de entorno (`.env`):**
   Copie el archivo de ejemplo:
   ```bash
   # En Windows PowerShell:
   Copy-Item .env.example .env

   # En Linux/macOS:
   cp .env.example .env
   ```

   Verifique que su archivo `backend/.env` contenga la cadena de conexión correcta a su base de datos. Por ejemplo:
   ```ini
   ENVIRONMENT=development
   DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/sismoia
   JWT_SECRET=super_secret_jwt_key_sismoia_enterprise_2026_dev
   CORS_ORIGINS=http://localhost:5173
   REFRESH_COOKIE_SECURE=false
   PUSH_ENABLED=false
   MONITORING_ENABLED=false
   ```
   *(Ajuste `user:password` según las credenciales de su base de datos local o use `sismoia:sismoia` si usó Docker Compose).*

4. **Ejecutar migraciones de base de datos (Alembic):**
   ```bash
   alembic upgrade head
   ```
   *Esto aplicará secuencialmente las 9 versiones del modelo de datos (`001_initial` hasta `009_report_exports`).*

5. **Sembrar roles, permisos y usuarios de demostración:**
   ```bash
   python scripts/seed_demo_data.py
   ```
   *Salida esperada:*
   ```text
   1. Creando catálogo de permisos y roles...
   -> Roles y permisos listos.
   2. Creando data source inicial (USGS)...
   -> Data source USGS registrada.
   3. Creando usuarios de demostración...
   -> Creado: administrador@example.com [ADMINISTRADOR]
   -> Creado: analista@example.com [ANALISTA]
   -> Creado: operador_alertas@example.com [OPERADOR_ALERTAS]
   -> Creado: auditor@example.com [AUDITOR]
   -> Creado: consulta@example.com [CONSULTA]
   ¡Sembrado completado con éxito!
   ```

6. **Iniciar el servidor backend (FastAPI + Uvicorn):**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   El backend estará disponible en:
   * **API Docs (Swagger UI):** [http://localhost:8000/docs](http://localhost:8000/docs)
   * **Health Check:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

### Paso 4: Configurar y Levantar el Frontend

En una **nueva ventana o pestaña de terminal**:

1. **Navegar a la carpeta del frontend:**
   ```bash
   cd frontend
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno (`.env`):**
   ```bash
   # En Windows PowerShell:
   Copy-Item .env.example .env

   # En Linux/macOS:
   cp .env.example .env
   ```
   El archivo `frontend/.env` debe contener:
   ```ini
   VITE_API_BASE_URL=http://localhost:8000
   ```

4. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

5. **Acceder a la aplicación:**
   Abra su navegador en: **[http://localhost:5173](http://localhost:5173)**

---

## 🔐 Credenciales de Demostración (Matriz RBAC)

La plataforma incluye 5 perfiles precargados para verificar la segregación de funciones exigida por el estándar empresarial:

| Rol del Sistema | Correo Electrónico | Contraseña Unificada | Alcance y Capacidades Principales |
|---|---|---|---|
| **Administrador** | `administrador@example.com` | `Password-for-local-tests-2026!` | Acceso irrestricto, configuración global, gestión de usuarios/roles y auditoría total. |
| **Analista** | `analista@example.com` | `Password-for-local-tests-2026!` | MLLab reproducible, reentrenamiento de modelos, exportación de reportes y análisis de discrepancias. |
| **Operador de Alertas** | `operador_alertas@example.com` | `Password-for-local-tests-2026!` | Creación de reglas de alerta, simulación histórica (Dry-Run) y aprobación dual de avisos críticos. |
| **Auditor** | `auditor@example.com` | `Password-for-local-tests-2026!` | Solo lectura de pistas de auditoría, logs inmutables, trazabilidad criptográfica y exportes de cumplimiento. |
| **Consulta** | `consulta@example.com` | `Password-for-local-tests-2026!` | Vista general de eventos, visor cartográfico GIS y dashboards analíticos (sin permisos de mutación). |

---

## 🧪 Validación y Suite de Pruebas

Para garantizar que el código se mantiene robusto e íntegro frente a modificaciones, ejecute las pruebas oficiales:

### Pruebas Automatizadas del Backend (125 tests)
Con el entorno virtual activado en la carpeta `backend`:
```bash
python -m pytest -q
```
*Resultado esperado:*
```text
......................................................................................... [ 71%]
....................................                                                     [100%]
125 passed in ~35s
```
Las pruebas cubren:
* Autenticación JWT, renovación de tokens y protección de rutas.
* Permisos de la matriz RBAC para los 5 roles.
* Integridad de los conectores de ingesta y deduplicador sismológico.
* Detección de discrepancias sismológicas entre fuentes.
* Simulación histórica de reglas de alerta y flujo de revisión dual.
* Pipeline de Machine Learning con validación de hashes SHA-256.
* Inmutabilidad del log de auditoría y exportaciones de reportes.

### Validación y Compilación del Frontend
En la carpeta `frontend`:
```bash
npm run build
```
*Resultado esperado:*
```text
vite v6.x.x building for production...
✓ built in ~6.5s
```
*Verifica la ausencia total de errores de tipado TypeScript (`tsc -b`) y empaqueta los assets optimizados para producción.*

---

## 🎬 Guía de Evaluación en Vivo (Script en 9 Pasos)

Siga este guion paso a paso (basado en la Sección 15 de la Memoria Técnica) para realizar una demostración completa a evaluadores, clientes o jurados académicos:

### Paso 1: Autenticación y Dashboard Principal
* Ingrese a `http://localhost:5173` y haga clic en **Acceso Corporativo**.
* Inicie sesión con `administrador@example.com` / `Password-for-local-tests-2026!`.
* Observe el **Dashboard Operativo**: indicadores clave de eventos en las últimas 24h, estado de sincronización de fuentes (USGS/IGP/EMSC), estado del backend y selector de tema (Modo Claro Borgoña / Modo Oscuro Azul Petróleo).

### Paso 2: Visor Cartográfico GIS y Catálogo Sísmico
* Ingrese a la pestaña **Eventos Sísmicos**.
* Interactúe con el mapa Leaflet georreferenciado:
  * Los círculos varían en radio según la magnitud y en color según la profundidad (rojo: superficial $<30\text{ km}$, naranja: intermedia, azul: profunda $>300\text{ km}$).
  * Aplique filtros por fecha y magnitud mínima (ej. $M \ge 4.5$).
  * Haga clic en cualquier evento para desplegar su ficha técnica detallada y dictamen analítico.

### Paso 3: Reconciliación Multifuente y Discrepancias
* Ingrese a la pestaña **Discrepancias**.
* Observe los eventos coincidentes captados por más de una agencia.
* Revise los diferenciales calculados ($\Delta \text{Magnitud}$, $\Delta \text{Profundidad}$, $\Delta \text{Distancia}$).
* Compruebe cómo el sistema etiqueta los eventos que superan los umbrales de tolerancia sismológica.

### Paso 4: Configuración de Reglas de Alerta
* Inicie sesión o continúe como `operador_alertas@example.com`.
* Ingrese a **Reglas de Alerta**.
* Cree una nueva regla (ej. "Sismos superficiales en zona costera $M \ge 5.5$, $Z \le 40\text{ km}$").
* Configure los canales de notificación deseados (Push, Correo, Webhook NTFY).

### Paso 5: Simulación Histórica (Dry-Run)
* En la misma regla creada, ejecute el botón **Simular sobre Histórico (Dry-Run)**.
* Especifique una ventana temporal (ej. últimos 30 días).
* El motor evaluará retrospectivamente el catálogo e informará: cuántos eventos habrían disparado la regla, tasa de acierto y distribución temporal, permitiendo calibrar los umbrales antes de activar la regla en producción.

### Paso 6: Despacho de Alertas y Revisión Dual
* Simule una alerta crítica con escalamiento.
* El sistema exigirá que un segundo operador (`administrador` u otro `operador_alertas`) valide y apruebe el despacho para mitigar riesgos de pánico por falsas alarmas.

### Paso 7: Laboratorio de Machine Learning (MLLab) y Verificación SHA-256
* Ingrese como `analista@example.com` a la pestaña **ML Lab**.
* Explore la pestaña **Laboratorio Versionado SHA-256**:
  * Observe el pipeline de tres etapas: congelamiento de datos, entrenamiento determinista y generación de hashes.
  * Inicie un entrenamiento con una semilla fija (`random_state=42`).
  * Al finalizar, copie el hash SHA-256 generado para el dataset y el artefacto binario (`.joblib`).
  * Ejecute la validación con el endpoint `/api/v1/ml/verify` para comprobar la certificación bit a bit.

### Paso 8: Analítica Sismológica Avanzada
* Ingrese a **Analítica Sísmica**.
* Explore el gráfico panorámico **Profundidad vs. Magnitud** ubicado en la columna principal debajo del dictamen.
* Examine el gráfico de la **Ley de Gutenberg-Richter** ($\log N = a - bM$) con cálculo en tiempo real del valor $b$.
* Revise la **Curva de Benioff** que visualiza la tasa de liberación de energía sísmica acumulada ($\sqrt{E}$).

### Paso 9: Pistas de Auditoría y Verificación de RBAC
* Inicie sesión como `auditor@example.com`.
* Ingrese a **Auditoría**: observe la lista cronológica inmutable de todas las acciones ejecutadas durante los pasos anteriores (logins, simulaciones, creaciones de reglas, ejecuciones de ML).
* Descargue el log en formato **JSON** o **CSV**.
* Cierre sesión e intente ingresar con `consulta@example.com`: verifique que las opciones de modificación, creación de reglas y reentrenamiento ML quedan deshabilitadas o restringidas según la matriz RBAC.

---

## 📁 Estructura del Proyecto

```text
SismoIA-Enterprise/
├── backend/
│   ├── alembic/                      # Migraciones versionadas de base de datos
│   │   ├── versions/                 # Scripts 001_initial.py a 009_report_exports.py
│   │   └── env.py
│   ├── app/                          # Código fuente del backend FastAPI
│   │   ├── main.py                   # Punto de entrada de la aplicación FastAPI
│   │   ├── config.py                 # Carga de configuraciones desde .env
│   │   ├── db.py                     # Sesiones SQLAlchemy síncronas y asíncronas
│   │   ├── auth_models.py            # Modelos de usuarios, roles, permisos y auditoría
│   │   ├── models.py                 # Modelos de eventos, fuentes, alertas y reglas
│   │   ├── security.py               # Encriptación bcrypt y manejo de tokens JWT
│   │   ├── services/                 # Lógica de negocio (ingesta, ML, simulador)
│   │   └── routers/                  # Controladores REST (/auth, /events, /alerts, /ml, /audit)
│   ├── scripts/                      # Scripts de utilidad y administración
│   │   ├── setup_local_db.py         # Creación y configuración de DB PostgreSQL
│   │   ├── seed_demo_data.py         # Sembrado de roles, permisos y usuarios demo
│   │   └── bootstrap_auth.py         # Definición del catálogo de permisos RBAC
│   ├── tests/                        # Suite de pruebas automatizadas (125 tests)
│   ├── requirements.txt              # Dependencias Python
│   └── .env.example                  # Plantilla de variables de entorno del backend
│
├── frontend/
│   ├── src/                          # Código fuente del cliente React 19 + TypeScript
│   │   ├── features/                 # Vistas y módulos funcionales
│   │   │   ├── SeismicAnalytics.tsx  # Analítica sismológica (Gutenberg-Richter, Benioff, Scatter)
│   │   │   ├── Events.tsx            # Visor de eventos sísmicos con mapa Leaflet
│   │   │   ├── Discrepancies.tsx     # Reconciliación de catálogos multifuente
│   │   │   ├── Alerts.tsx            # Reglas de alerta, simulación dry-run y revisión dual
│   │   │   ├── MLLab.tsx             # Laboratorio de Machine Learning y benchmarking
│   │   │   ├── MLReproducible.tsx    # Pipeline con certificación criptográfica SHA-256
│   │   │   ├── Audit.tsx             # Pista de auditoría inmutable y exportación
│   │   │   ├── Login.tsx             # Formulario de autenticación con RBAC
│   │   │   └── Landing.tsx           # Landing page institucional informativa
│   │   ├── styles/                   # Sistema de diseño y tokens CSS
│   │   │   ├── tokens.css            # Variables para Dark Mode y Light Corporate Mode
│   │   │   └── enterprise.css        # Clases de diseño empresarial y componentes
│   │   ├── App.tsx                   # Enrutamiento principal y gestión de sesión
│   │   └── main.tsx                  # Entrada DOM de Vite
│   ├── package.json                  # Dependencias y scripts frontend
│   └── .env.example                  # Plantilla de variables de entorno del frontend
│
├── docker-compose.yml                # Configuración de contenedor PostgreSQL 17
└── README.md                         # Documentación técnica oficial del proyecto
```

---

## 📄 Licencia y Términos de Uso

Este proyecto ha sido desarrollado como una solución sismológica y analítica empresarial para evaluación académica y técnica. Todos los algoritmos y códigos se distribuyen bajo fines educativos y de investigación aplicada.

Para reportar incidencias o solicitar soporte sobre este despliegue, contacte al equipo de ingeniería de **SismoIA Enterprise**.
