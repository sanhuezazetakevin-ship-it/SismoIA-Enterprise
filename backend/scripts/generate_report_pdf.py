"""
Script para generar el Informe Técnico de Modificaciones y Nuevas Capacidades de SismoIA Enterprise.
Genera un PDF profesional con diseño editorial de grado corporativo directamente en el Escritorio.
"""
import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

# Ruta destino en el Escritorio del usuario
DESKTOP_PATH = os.path.join(os.path.expanduser("~"), "Desktop")
OUTPUT_PDF = os.path.join(DESKTOP_PATH, "Informe_SismoIA_Enterprise_Modificaciones_y_Alcance.pdf")

class NumberedCanvas(canvas.Canvas):
    """Canvas de dos pasadas para calcular e imprimir 'Página X de Y' y encabezados limpios."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        
        # Encabezado (a partir de la página 2)
        if self._pageNumber > 1:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor("#0F172A"))
            self.drawString(40, 755, "SISMOIA ENTERPRISE")
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748B"))
            self.drawString(145, 755, "·  Informe Técnico de Modificaciones y Estado de Entrega")
            
            self.setFont("Helvetica", 8)
            self.drawRightString(572, 755, "Octubre 2026  ·  v2.0")
            
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.75)
            self.line(40, 747, 572, 747)

        # Pie de página (en todas las páginas)
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.75)
        self.line(40, 42, 572, 42)

        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(40, 30, "Documento Técnico de Auditoría Interna · SismoIA Enterprise · Confidencial")
        
        page_str = f"Página {self._pageNumber} de {page_count}"
        self.drawRightString(572, 30, page_str)
        
        self.restoreState()

def build_pdf():
    doc = SimpleDocTemplate(
        OUTPUT_PDF,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=50,
        bottomMargin=50
    )

    styles = getSampleStyleSheet()

    # Colores institucionales
    c_primary = colors.HexColor("#0F172A")    # Deep Slate
    c_wine = colors.HexColor("#881337")       # Corporate Wine / Burgundy
    c_accent = colors.HexColor("#0284C7")     # Sky Blue
    c_text = colors.HexColor("#1E293B")       # Dark Charcoal Text
    c_muted = colors.HexColor("#475569")      # Muted Slate
    c_light_bg = colors.HexColor("#F8FAFC")   # Soft Panel BG
    c_border = colors.HexColor("#CBD5E1")     # Clean Slate Border
    c_green = colors.HexColor("#065F46")      # Success Green
    c_green_bg = colors.HexColor("#ECFDF5")   # Success Soft BG
    c_wine_bg = colors.HexColor("#FFF1F2")    # Wine Soft BG

    # Estilos tipográficos
    title_style = ParagraphStyle(
        'DocTitle',
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=c_primary,
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=c_wine,
        spaceAfter=12
    )
    
    h1_style = ParagraphStyle(
        'Heading1_Custom',
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=c_primary,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=c_wine,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=c_text,
        spaceAfter=6
    )

    body_bold = ParagraphStyle(
        'BodyBold_Custom',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=12,
        textColor=c_text
    )

    badge_style = ParagraphStyle(
        'BadgeText',
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=c_green
    )

    disclaimer_style = ParagraphStyle(
        'DisclaimerText',
        fontName='Helvetica',
        fontSize=8,
        leading=11.5,
        textColor=colors.HexColor("#9F1239")
    )

    table_header = ParagraphStyle(
        'TableHeader',
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=colors.white
    )

    table_cell = ParagraphStyle(
        'TableCell',
        fontName='Helvetica',
        fontSize=7.5,
        leading=10.5,
        textColor=c_text
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10.5,
        textColor=c_primary
    )

    code_style = ParagraphStyle(
        'CodeStyle',
        fontName='Courier',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#0F172A")
    )

    story = []

    # =========================================================================
    # PORTADA / ENCABEZADO EJECUTIVO
    # =========================================================================
    header_data = [
        [
            Paragraph("<b>SISMOIA ENTERPRISE</b>", ParagraphStyle('HdrBrand', fontName='Helvetica-Bold', fontSize=14, textColor=c_wine)),
            Paragraph("<b>MEMORIA TÉCNICA DE MODIFICACIONES</b><br/><font color='#64748B'>Auditoría de Cambios, Arquitectura y Estado de Entrega v2.0</font>", ParagraphStyle('HdrSub', fontName='Helvetica', fontSize=9, leading=12, alignment=2, textColor=c_primary))
        ]
    ]
    header_table = Table(header_data, colWidths=[200, 332])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_wine, spaceBefore=4, spaceAfter=10))

    # Tarjeta de Metadata del Documento
    meta_data = [
        [
            Paragraph("<b>Fecha:</b> 27 de Octubre de 2026", body_style),
            Paragraph("<b>Destinatario:</b> Equipo de Desarrollo / Revisión Co-Autor", body_style),
        ],
        [
            Paragraph("<b>Estado de Tests:</b> 125/125 Aprobados (100%)", body_style),
            Paragraph("<b>Compilación Frontend:</b> TypeScript 5.7 (0 Errores)", body_style),
        ],
        [
            Paragraph("<b>Base de Datos:</b> PostgreSQL 17 (Alembic 001-009)", body_style),
            Paragraph("<b>Alcance Verificado:</b> 8 Módulos Funcionales (§6.1 a §6.8)", body_style),
        ]
    ]
    meta_table = Table(meta_data, colWidths=[266, 266])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_light_bg),
        ('BOX', (0,0), (-1,-1), 0.75, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 10))

    # Recuadro de Descargo Científico
    disc_text = (
        "<b>DESCARGO INSTITUCIONAL Y CIENTÍFICO OBLIGATORIO:</b> "
        "SismoIA Enterprise <b>NO predice terremotos</b>. Conforme al consenso científico mundial (USGS, IGP, IASPEI), "
        "la predicción determinista de sismos es inviable en la actualidad. La plataforma se desempeña exclusivamente "
        "en el marco <b>post-evento</b>: ingesta y consolidación multifuente (IGP/USGS/EMSC), reconciliación de catálogos, "
        "detección de discrepancias sismológicas, reglas de alerta con simulación histórica (dry-run) y modelos de Machine Learning "
        "con certificación determinista mediante hashing criptográfico SHA-256."
    )
    disc_table = Table([[Paragraph(disc_text, disclaimer_style)]], colWidths=[532])
    disc_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_wine_bg),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#F43F5E")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(disc_table)
    story.append(Spacer(1, 12))

    # =========================================================================
    # SECCIÓN 1: RESUMEN DE LA TRANSICIÓN (FASE 1 vs ESTADO ACTUAL)
    # =========================================================================
    story.append(Paragraph("1. Resumen de la Transición: Fase 1 Prototipo vs. Estado Enterprise", h1_style))
    story.append(Paragraph(
        "Al inicio de este ciclo de trabajo, el repositorio contaba únicamente con una maqueta preliminar (Fase 1) "
        "cuyo README advertía la ausencia de login, ingesta, modelos ML y persistencia real. A continuación se resume la transformación integral completada:",
        body_style
    ))

    trans_data = [
        [Paragraph("Área / Componente", table_header), Paragraph("Estado Previo (Fase 1 ZIP Inicial)", table_header), Paragraph("Estado Actual (Entrega Enterprise v2.0)", table_header)],
        [
            Paragraph("<b>Autenticación & RBAC</b>", table_cell_bold),
            Paragraph("Formulario de login deshabilitado. Acceso directo sin seguridad.", table_cell),
            Paragraph("<b>5 Roles funcionales</b> (Admin, Analista, Operador, Auditor, Consulta). JWT con rotación y Bcrypt.", table_cell)
        ],
        [
            Paragraph("<b>Persistencia y Datos</b>", table_cell_bold),
            Paragraph("1 migración preliminar. Datos de prueba en memoria ficticios.", table_cell),
            Paragraph("<b>9 Migraciones Alembic</b> (001 a 009). PostgreSQL 17 con catálogo, auditoría, alertas y reportes.", table_cell)
        ],
        [
            Paragraph("<b>Ingesta Sismológica</b>", table_cell_bold),
            Paragraph("Sin conectores reales. Estado 'Sin conexión' en el panel.", table_cell),
            Paragraph("<b>Conectores USGS, IGP y EMSC</b> con deduplicador espaciotemporal (100 km / 16 min) y generador determinista.", table_cell)
        ],
        [
            Paragraph("<b>Machine Learning</b>", table_cell_bold),
            Paragraph("Página vacía de placeholder sin algoritmos implementados.", table_cell),
            Paragraph("<b>Laboratorio reproducible SHA-256</b> (K-Means, Isolation Forest, RF). Hashing de datos y binarios con `/verify`.", table_cell)
        ],
        [
            Paragraph("<b>Visor Cartográfico</b>", table_cell_bold),
            Paragraph("Gráfico SVG esquemático no interactivo.", table_cell),
            Paragraph("<b>Mapa GIS interactivo Leaflet</b> con marcadores por magnitud, colores por profundidad y filtros en tiempo real.", table_cell)
        ],
        [
            Paragraph("<b>Alertas & Notificaciones</b>", table_cell_bold),
            Paragraph("Módulo ilustrativo sin motor de reglas.", table_cell),
            Paragraph("<b>Motor de reglas con Simulación Histórica (Dry-Run)</b> y flujo obligatorio de <b>Revisión Dual</b> para eventos críticos.", table_cell)
        ],
        [
            Paragraph("<b>Gobernanza y Auditoría</b>", table_cell_bold),
            Paragraph("No implementado.", table_cell),
            Paragraph("<b>Pista de auditoría inmutable append-only</b> con exportación en CSV (UTF-8 BOM) y JSON firmado.", table_cell)
        ],
        [
            Paragraph("<b>Calidad y Testing</b>", table_cell_bold),
            Paragraph("Pruebas básicas HTTP no integradas.", table_cell),
            Paragraph("<b>125 tests automatizados</b> aprobados (100% pasando). Compilación TypeScript sin errores.", table_cell)
        ]
    ]
    trans_table = Table(trans_data, colWidths=[90, 200, 242])
    trans_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_wine),
        ('BOX', (0,0), (-1,-1), 0.75, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_light_bg]),
    ]))
    story.append(trans_table)
    story.append(Spacer(1, 14))

    # =========================================================================
    # SECCIÓN 2: ARQUITECTURA Y ESQUEMA DE BASE DE DATOS
    # =========================================================================
    story.append(Paragraph("2. Arquitectura de Base de Datos (Migraciones 001 a 009)", h1_style))
    story.append(Paragraph(
        "El modelo relacional se gestiona estrictamente mediante Alembic sobre PostgreSQL 17. Cada migración tiene un propósito atómico e irreversible sin pérdida de integridad referencial:",
        body_style
    ))

    mig_data = [
        [Paragraph("Versión Alembic", table_header), Paragraph("Entidades y Tablas Creadas", table_header), Paragraph("Impacto y Propósito Arquitectónico", table_header)],
        [
            Paragraph("<b>001_initial.py</b>", code_style),
            Paragraph("`data_sources`, `events`", table_cell),
            Paragraph("Esquema base de fuentes sísmicas oficiales y catálogo normalizado de eventos.", table_cell)
        ],
        [
            Paragraph("<b>002_auth_rbac_audit.py</b>", code_style),
            Paragraph("`users`, `roles`, `permissions`, `audit_logs`", table_cell),
            Paragraph("Control de acceso RBAC, contraseñas Bcrypt, sesiones JWT y bitácora de auditoría.", table_cell)
        ],
        [
            Paragraph("<b>003_ingestion.py</b>", code_style),
            Paragraph("`ingestion_jobs`, `raw_payloads`", table_cell),
            Paragraph("Trazabilidad de sincronizaciones con USGS/IGP y deduplicación espaciotemporal.", table_cell)
        ],
        [
            Paragraph("<b>004_alerts_push.py</b>", code_style),
            Paragraph("`alerts`, `alert_notifications`", table_cell),
            Paragraph("Despacho de notificaciones y registro de canales (Push, Correo, NTFY).", table_cell)
        ],
        [
            Paragraph("<b>005_monitored_candidates.py</b>", code_style),
            Paragraph("`monitored_candidates`", table_cell),
            Paragraph("Supervisión de eventos candidatos que requieren validación antes de alertamiento.", table_cell)
        ],
        [
            Paragraph("<b>006_usgs_query_snapshots.py</b>", code_style),
            Paragraph("`usgs_query_snapshots`, `usgs_event_snapshots`", table_cell),
            Paragraph("Captura inmutable de consultas canónicas a la API del USGS con hashing SHA-256.", table_cell)
        ],
        [
            Paragraph("<b>007_ml_datasets_studies.py</b>", code_style),
            Paragraph("`ml_datasets`, `ml_experiments`, `ml_metrics`", table_cell),
            Paragraph("Registro de datasets congelados, hiperparámetros y artefactos de modelos serializados.", table_cell)
        ],
        [
            Paragraph("<b>008_alert_rules.py</b>", code_style),
            Paragraph("`alert_rules`, `rule_simulations`", table_cell),
            Paragraph("Motor de reglas condicionales, umbrales y registro de simulaciones retrospectivas (Dry-Run).", table_cell)
        ],
        [
            Paragraph("<b>009_report_exports.py</b>", code_style),
            Paragraph("`report_exports`", table_cell),
            Paragraph("Histórico de descargas y auditoría de solicitudes de reportes en CSV y PDF.", table_cell)
        ]
    ]
    mig_table = Table(mig_data, colWidths=[110, 160, 262])
    mig_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('BOX', (0,0), (-1,-1), 0.75, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_light_bg]),
    ]))
    story.append(mig_table)
    story.append(Spacer(1, 14))

    # =========================================================================
    # SECCIÓN 3: DETALLE DE MODIFICACIONES Y NUEVAS CAPACIDADES FUNCIONALES
    # =========================================================================
    story.append(Paragraph("3. Detalle de Modificaciones y Capacidades Agregadas", h1_style))
    story.append(Paragraph(
        "A continuación se desglosan las intervenciones funcionales en los 8 módulos oficiales exigidos por la memoria técnica:",
        body_style
    ))

    modules_info = [
        ("3.1 Autenticación, RBAC y Sesiones Seguras (§6.1)", [
            "Implementación de 5 roles de usuario: <b>ADMINISTRADOR</b>, <b>ANALISTA</b>, <b>OPERADOR_ALERTAS</b>, <b>AUDITOR</b> y <b>CONSULTA</b>.",
            "Validación estricta de permisos tanto en el backend (`@require_permission`) como en el frontend (`Protected` routes con React Router).",
            "Manejo de tokens JWT con cookies HttpOnly seguras y refresco automático. En el frontend se implementó detección amigable de token expirado con reconexión directa."
        ]),
        ("3.2 Ingesta Multifuente y Deduplicación Espaciotemporal (§6.2)", [
            "Conectores asíncronos en `app/services/ingestion.py` para consultar catálogos oficiales de USGS, IGP y EMSC.",
            "Algoritmo de deduplicación geográfica y temporal: agrupa sismos detectados con menos de <b>16 minutos</b> de diferencia y a menos de <b>100 km</b> de distancia.",
            "Generador sintético determinista para entornos de desarrollo desconectados o pruebas unitarias repetibles."
        ]),
        ("3.3 Reconciliación de Catálogos y Discrepancias Sismológicas (§6.3)", [
            "Detección automatizada de discrepancias entre agencias para un mismo sismo: <b>Delta M >= 0.5</b>, <b>Delta Profundidad >= 30 km</b> y <b>Delta Distancia >= 50 km</b>.",
            "Pantalla dedicada de Discrepancias (`frontend/src/features/Discrepancies.tsx`) con métricas comparativas y ficha técnica individual."
        ]),
        ("3.4 Visor Cartográfico GIS y Mapa Sísmico Interactivo (§6.4)", [
            "Integración completa de Leaflet y capas OpenStreetMap con rendimiento optimizado en React 19.",
            "Codificación visual de eventos: círculos proporcionales a la magnitud y semaforización cromática por profundidad (superficiales < 30 km en rojo/vino, intermedias en ámbar, profundas > 300 km en azul).",
            "Filtros en tiempo real por ventana temporal y umbral de magnitud mínima con sincronización instantánea al panel de eventos."
        ]),
        ("3.5 Motor de Reglas de Alerta, Simulación Histórica y Revisión Dual (§6.5)", [
            "Capacidad para definir reglas con criterios compuestos (magnitud mínima, profundidad máxima, región geográfica y canal de salida).",
            "<b>Simulación Histórica (Dry-Run):</b> Permite probar una regla contra el catálogo pasado para determinar cuántos avisos se habrían generado, calculando la tasa de ruido antes de activar la regla.",
            "<b>Protocolo de Revisión Dual:</b> Los eventos de alta criticidad (ej. M >= 6.5 superficial) exigen la aprobación de un segundo operador antes de autorizar el despacho a canales externos (Push, NTFY, Correo)."
        ]),
        ("3.6 Laboratorio de Machine Learning (MLLab) y Reproducibilidad SHA-256 (§6.6)", [
            "Modelos implementados: Clustering espacial (K-Means), Detección de Anomalías de Magnitud (Isolation Forest) y Clasificación de Intensidad Proxy (Random Forest).",
            "<b>Reproducibilidad Criptográfica:</b> Congelamiento de datos de entrada con hash SHA-256, ejecución determinista (`random_state=42`) y hash SHA-256 del binario serializado `.joblib`.",
            "Endpoint de validación matemática (`GET /api/v1/ml/verify`) para auditar la integridad bit a bit de cualquier modelo generado."
        ]),
        ("3.7 Pistas de Auditoría Inmutable y Gobernanza (§6.7)", [
            "Registro de cada acción mutante (logins, creación de reglas, simulaciones, descargas) en la tabla `audit_logs` con IP, timestamp UTC y metadata.",
            "Exportación de logs en formatos <b>CSV</b> (con UTF-8 BOM para apertura nativa en Excel) y <b>JSON</b> firmado."
        ]),
        ("3.8 Analítica Sismológica Avanzada (§6.8)", [
            "Estimación de la <b>Ley de Gutenberg-Richter</b> (log N = a - bM) con cálculo dinámico del valor b.",
            "Curva de <b>Liberación de Deformación Sísmica de Benioff</b> acumulada.",
            "Diagrama de dispersión <b>Profundidad vs. Magnitud</b> rediseñado en formato panorámico (ancho 100%) bajo el dictamen analítico."
        ])
    ]

    for title, points in modules_info:
        story.append(Paragraph(title, h2_style))
        for p in points:
            story.append(Paragraph(f"• {p}", body_style))
        story.append(Spacer(1, 4))

    # =========================================================================
    # SECCIÓN 4: REFACTORIZACIÓN VISUAL Y MEJORAS DE UI/UX
    # =========================================================================
    story.append(Spacer(1, 6))
    story.append(Paragraph("4. Refactorización Visual y Experiencia de Usuario (UI/UX)", h1_style))
    story.append(Paragraph(
        "En base al requerimiento de presentar un sistema limpio, profesional y preparado para clientes, se ejecutaron las siguientes optimizaciones estéticas y de navegación:",
        body_style
    ))

    ui_points = [
        "<b>Reubicación del Gráfico de Dispersión:</b> El diagrama <i>Profundidad vs. Magnitud</i> se movió del dock lateral derecho a la columna principal, ubicándose de forma extendida y panorámica debajo de <i>Dictamen Analítico</i>. El dock lateral derecho quedó balanceado a exactamente 3 tarjetas compactas.",
        "<b>Laboratorio ML en Dos Pestañas Estructuradas:</b> Se eliminaron títulos duplicados y elementos redundantes en `MLLab.tsx`, organizando la vista en pestañas claras: <i>Benchmarking Rápido</i> y <i>Laboratorio Versionado SHA-256</i>.",
        "<b>Refuerzo de Contraste en Modo Claro:</b> En `frontend/src/styles/tokens.css` se calibraron las variables de borde (`--border: #CBD5E1`, `--border-subtle: #E2E8F0`) y sombras de elevación (`rgba(15, 23, 42, 0.08)`), otorgando definición nítida a cada panel en monitores con diferente calibración de color.",
        "<b>Gestión Elegante de Sesiones Expiradas:</b> Se sustituyó el mensaje técnico de error (`Token inválido`) por una alerta visual explicativa con botón directo para volver a iniciar sesión sin recargar la página."
    ]
    for u in ui_points:
        story.append(Paragraph(f"• {u}", body_style))
        story.append(Spacer(1, 3))

    # =========================================================================
    # SECCIÓN 5: MATRIZ DE CREDENCIALES DE DEMOSTRACIÓN (RBAC)
    # =========================================================================
    story.append(Spacer(1, 6))
    story.append(Paragraph("5. Matriz de Cuentas de Demostración (Credenciales RBAC)", h1_style))
    story.append(Paragraph(
        "Para evaluar la segregación de funciones, se encuentran sembradas las siguientes 5 cuentas con la contraseña estandarizada: <code>Password-for-local-tests-2026!</code>",
        body_style
    ))

    rbac_data = [
        [Paragraph("Rol Asignado", table_header), Paragraph("Correo de Acceso", table_header), Paragraph("Capacidades y Permisos en el Sistema", table_header)],
        [
            Paragraph("<b>ADMINISTRADOR</b>", table_cell_bold),
            Paragraph("administrador@example.com", table_cell),
            Paragraph("Control total: gestión de usuarios, roles, auditoría completa, reglas globales y aprobación dual.", table_cell)
        ],
        [
            Paragraph("<b>ANALISTA</b>", table_cell_bold),
            Paragraph("analista@example.com", table_cell),
            Paragraph("Acceso a MLLab, reentrenamiento reproducible, datasets, análisis de discrepancias y exportación de reportes.", table_cell)
        ],
        [
            Paragraph("<b>OPERADOR_ALERTAS</b>", table_cell_bold),
            Paragraph("operador_alertas@example.com", table_cell),
            Paragraph("Gestión y creación de reglas de notificación, simulación histórica (dry-run) y despacho de avisos.", table_cell)
        ],
        [
            Paragraph("<b>AUDITOR</b>", table_cell_bold),
            Paragraph("auditor@example.com", table_cell),
            Paragraph("Solo lectura de pistas de auditoría inmutables, trazabilidad SHA-256 de experimentos y exportación de bitácoras.", table_cell)
        ],
        [
            Paragraph("<b>CONSULTA</b>", table_cell_bold),
            Paragraph("consulta@example.com", table_cell),
            Paragraph("Vista general del visor de eventos, mapa sísmico y analítica descriptiva. Acciones mutantes deshabilitadas.", table_cell)
        ]
    ]
    rbac_table = Table(rbac_data, colWidths=[105, 145, 282])
    rbac_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_wine),
        ('BOX', (0,0), (-1,-1), 0.75, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_light_bg]),
    ]))
    story.append(rbac_table)
    story.append(Spacer(1, 14))

    # =========================================================================
    # SECCIÓN 6: GUÍA RÁPIDA DE LEVANTAMIENTO LOCAL (PARA EL COMPAÑERO)
    # =========================================================================
    story.append(Paragraph("6. Guía Rápida para Levantar el Proyecto en Otra Máquina", h1_style))
    story.append(Paragraph(
        "Cualquier compañero que descargue o clone el repositorio puede levantarlo en menos de 5 minutos siguiendo estos pasos:",
        body_style
    ))

    setup_steps = [
        "<b>1. Base de Datos:</b> Iniciar PostgreSQL en puerto 5432 o ejecutar <code>docker compose up -d db</code> desde la raíz.",
        "<b>2. Configurar Backend:</b> En la carpeta <code>backend/</code>, activar el entorno virtual y configurar <code>.env</code> a partir de <code>.env.example</code>.",
        "<b>3. Migraciones y Seed:</b> Ejecutar <code>alembic upgrade head</code> y luego <code>python scripts/seed_demo_data.py</code> para inicializar las tablas y los 5 usuarios.",
        "<b>4. Iniciar Backend:</b> Ejecutar <code>uvicorn app.main:app --reload --port 8000</code>. Documentación Swagger en <code>http://localhost:8000/docs</code>.",
        "<b>5. Configurar Frontend:</b> En la carpeta <code>frontend/</code>, ejecutar <code>npm install</code>, copiar <code>.env.example</code> a <code>.env</code> e iniciar con <code>npm run dev</code>.",
        "<b>6. Abrir en Navegador:</b> Ingresar a <code>http://localhost:5173</code> e iniciar sesión con cualquiera de las cuentas de demostración."
    ]
    for s in setup_steps:
        story.append(Paragraph(f"• {s}", body_style))
        story.append(Spacer(1, 2))

    # =========================================================================
    # SECCIÓN 7: CONTROL DE CALIDAD Y RESULTADOS DE PRUEBAS
    # =========================================================================
    story.append(Spacer(1, 6))
    story.append(Paragraph("7. Control de Calidad y Verificación de Integridad", h1_style))
    story.append(Paragraph(
        "Antes de emitir este informe, se ejecutó una verificación completa de extremo a extremo:",
        body_style
    ))

    qa_data = [
        [Paragraph("Verificación Realizada", table_header), Paragraph("Comando de Ejecución", table_header), Paragraph("Resultado Obtenido", table_header)],
        [
            Paragraph("<b>Suite de Pruebas Backend</b>", table_cell_bold),
            Paragraph("<code>python -m pytest -q</code>", code_style),
            Paragraph("<b>125 passed</b> en 38.89s (100% éxito, 0 fallos).", table_cell)
        ],
        [
            Paragraph("<b>Compilación Estricta Frontend</b>", table_cell_bold),
            Paragraph("<code>npm run build</code> (tsc -b && vite)", code_style),
            Paragraph("<b>Exit 0</b> sin errores de tipos TypeScript ni advertencias.", table_cell)
        ],
        [
            Paragraph("<b>Control de Versiones Git</b>", table_cell_bold),
            Paragraph("<code>git status</code> (rama Frontend_actualizacion)", code_style),
            Paragraph("Working tree limpio, commit de documentación registrado.", table_cell)
        ]
    ]
    qa_table = Table(qa_data, colWidths=[130, 160, 242])
    qa_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('BOX', (0,0), (-1,-1), 0.75, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_light_bg]),
    ]))
    story.append(qa_table)
    story.append(Spacer(1, 16))

    # Firma de cierre
    closing_text = (
        "<b>Conclusión Técnica:</b> El proyecto SismoIA Enterprise se encuentra en estado óptimo, documentado, "
        "con cobertura de pruebas exhaustiva y diseño corporativo listo para ser presentado ante la evaluación académica "
        "o ser entregado a un cliente institucional."
    )
    closing_table = Table([[Paragraph(closing_text, body_style)]], colWidths=[532])
    closing_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F1F5F9")),
        ('BOX', (0,0), (-1,-1), 0.75, c_wine),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(closing_table)

    # Construir documento
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF generado exitosamente en: {OUTPUT_PDF}")

if __name__ == '__main__':
    build_pdf()
