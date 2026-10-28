import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Activity,
  BellRing,
  BrainCircuit,
  ChartColumnIncreasing,
  Database,
  MapPinned,
  ShieldCheck
} from 'lucide-react';
import { Brand } from '../components/Brand';
import { ThemeToggle } from '../components/ThemeToggle';

const features = [
  {
    icon: MapPinned,
    title: 'Monitoreo Cartográfico en Vivo',
    desc: 'Visualización georreferenciada sobre Leaflet con capas de calor, clustering y cálculo de severidad por magnitud y profundidad.'
  },
  {
    icon: ChartColumnIncreasing,
    title: 'Analítica Descriptiva y Series Temporales',
    desc: 'Gráficos de frecuencia diaria, dispersión magnitud-profundidad e histogramas con trazabilidad auditable y procedencia de datos.'
  },
  {
    icon: BrainCircuit,
    title: 'Laboratorio de Machine Learning Supervisado',
    desc: 'Modelos de clasificación (RandomForest) y regresión lineal con partición temporal estricta y comparación contra baselines.'
  },
  {
    icon: BellRing,
    title: 'Gobernanza y Alertas con Doble Operador',
    desc: 'Motor de reglas con bounding box geográfico y cooldown. Requiere revisión y aprobación justificada por un operador distinto.'
  },
  {
    icon: Database,
    title: 'Integración Oficial con USGS FDSN',
    desc: 'Catálogo de eventos observados en vivo con almacenamiento inmutable de snapshots bajo demanda e integridad SHA-256.'
  },
  {
    icon: ShieldCheck,
    title: 'Seguridad Empresarial y Auditoría RBAC',
    desc: '5 roles jerárquicos (Administrador, Analista, Operador, Auditor, Consulta) con cifrado Argon2, JWT y bitácora de auditoría inmutable.'
  }
];

export function Landing() {
  return (
    <div className="public-page" style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      {/* Barra de Navegación Pública */}
      <header className="public-header container">
        <Brand />
        <div className="header-links">
          <a href="#capacidades">Capacidades</a>
          <a href="#metodologia">Metodología</a>
          <ThemeToggle />
          <Link to="/login" className="btn btn-primary btn-sm">
            <span>Acceder al Sistema</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main>
        {/* Sección Hero */}
        <section className="hero container">
          <div className="hero-copy">
            <span className="hero-pill">
              <Activity size={14} />
              <span>SISTEMA EMPRESARIAL DE MONITOREO SÍSMICO</span>
            </span>

            <h1>
              Inteligencia sísmica, <em>rigor analítico</em> y gobernanza ética.
            </h1>

            <p>
              Centralizamos datos observacionales en tiempo real procedentes de organismos oficiales
              (USGS FDSN), análisis temporal descriptivo y experimentación de Machine Learning sin falsas
              promesas predictivas.
            </p>

            <div className="hero-actions">
              <Link className="btn btn-primary" style={{ padding: '12px 22px', fontSize: '14px' }} to="/login">
                <span>Ingresar a la Plataforma</span>
                <ArrowRight size={17} />
              </Link>
              <a className="btn btn-outline" style={{ padding: '12px 20px', fontSize: '14px' }} href="#capacidades">
                Explorar Capacidades
              </a>
            </div>

            <div className="hero-disclaimer">
              <ShieldCheck size={20} style={{ flexShrink: 0, color: 'var(--primary)' }} />
              <span>
                <strong>Aviso científico fundamental:</strong> Los sismos no se pueden predecir con certeza en fecha,
                hora y lugar. Esta plataforma supervisa eventos ocurridos y modelos experimentales bajo revisión humana.
              </span>
            </div>
          </div>

          <div className="hero-preview">
            <div className="preview-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="preview-live" />
                <span>Monitoreo Activo · Perú</span>
              </span>
              <span>USGS FDSN</span>
            </div>

            <div className="preview-map">
              <div className="preview-rings">
                <span />
                <span />
                <span />
              </div>
              <div className="preview-ping">
                5.8 <small>Magnitud de Referencia</small>
              </div>
            </div>

            <div className="preview-stats">
              <span>
                <strong>100%</strong> Trazabilidad
              </span>
              <span>
                <strong>5 Roles</strong> RBAC Granular
              </span>
              <span>
                <strong>Doble Operador</strong> Aprobación
              </span>
            </div>
          </div>
        </section>

        {/* Sección de Capacidades */}
        <section id="capacidades" className="features-section">
          <div className="container">
            <span className="eyebrow">ARQUITECTURA MODULAR</span>
            <h2>Diseñado para operaciones de alta exigencia</h2>
            <p className="section-sub">
              Separación estricta entre datos observados reales, modelos analíticos experimentales y avisos operativos.
            </p>

            <div className="feature-grid">
              {features.map(({ icon: Icon, title, desc }) => (
                <article className="feature" key={title}>
                  <span className="feature-icon">
                    <Icon size={22} />
                  </span>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Metodología */}
        <section id="metodologia" className="method-section container">
          <div>
            <span className="eyebrow">METODOLOGÍA DE 4 PASOS</span>
            <h2>Del evento registrado a la decisión documentada</h2>
            <p>
              Toda acción dentro del sistema conserva su identificador de actor, timestamp UTC,
              parámetros de consulta y justificación humana antes de cualquier notificación externa.
            </p>
          </div>

          <div className="steps">
            {[
              ['01', 'Ingesta Oficial', 'Consulta verificable a catálogos USGS sin inventar registros.'],
              ['02', 'Control de Calidad', 'Snapshots inmutables, control SHA-256 y detección de duplicados.'],
              ['03', 'Análisis & ML', 'Evaluación supervisada con split temporal estricto (sin fuga hacia el pasado).'],
              ['04', 'Revisión Humana', 'Avisos sujetos a creación por un operador y aprobación obligatoria por otro.']
            ].map(([num, title, desc]) => (
              <div className="step" key={num}>
                <b>{num}</b>
                <span>
                  <strong>{title}</strong>
                  <small>{desc}</small>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Final */}
        <section className="cta-section">
          <div className="container cta-inner">
            <div>
              <span className="eyebrow">ACCESO CORPORATIVO</span>
              <h2>Listo para el despliegue y la demostración institucional.</h2>
              <p>Inicia sesión con cualquiera de los 5 roles preconfigurados para validar los permisos y flujos.</p>
            </div>
            <Link className="btn btn-primary" style={{ padding: '14px 26px', fontSize: '15px' }} to="/login">
              <span>Iniciar Sesión</span>
              <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="public-footer container">
        <span>© 2026 SismoIA Enterprise · Sistema de Monitoreo Sísmico y Analítica</span>
        <span>Avisos informativos supervisados · No reemplaza a organismos de protección civil</span>
      </footer>
    </div>
  );
}
