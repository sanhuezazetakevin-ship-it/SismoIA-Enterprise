import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LockKeyhole,
  Mail,
  ShieldCheck,
  Activity,
  ArrowRight,
  UserCheck,
  Database,
  BrainCircuit,
  Bell
} from 'lucide-react';
import { Brand } from '../components/Brand';
import { ThemeToggle } from '../components/ThemeToggle';
import { login } from '../services/auth';

const DEMO_PRESETS = [
  { role: 'Administrador', email: 'administrador@example.com', badge: 'Acceso Total' },
  { role: 'Analista', email: 'analista@example.com', badge: 'ML & Datos' },
  { role: 'Operador Alertas', email: 'operador_alertas@example.com', badge: 'Aprobaciones' },
  { role: 'Auditor', email: 'auditor@example.com', badge: 'Solo Auditoría' },
  { role: 'Consulta', email: 'consulta@example.com', badge: 'Observador' }
];

const DEFAULT_DEMO_PASSWORD = 'Password-for-local-tests-2026!';

export function Login() {
  const [email, setEmail] = useState('administrador@example.com');
  const [password, setPassword] = useState(DEFAULT_DEMO_PASSWORD);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await login(email, password);
      navigate((location.state as { from?: string } | null)?.from || '/app', { replace: true });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error al autenticar credenciales');
    } finally {
      setBusy(false);
    }
  }

  function selectPreset(presetEmail: string) {
    setEmail(presetEmail);
    setPassword(DEFAULT_DEMO_PASSWORD);
    setMessage('');
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header Superior */}
      <header
        style={{
          height: '70px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Brand />
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link
            to="/"
            style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              textDecoration: 'none'
            }}
          >
            Portal público
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Contenedor Principal en 2 Columnas */}
      <main
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          maxWidth: '1100px',
          width: '100%',
          margin: 'auto',
          padding: '40px 24px',
          gap: '40px',
          alignItems: 'center'
        }}
      >
        {/* Columna Izquierda: Información Corporativa */}
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--primary-glow)',
              color: 'var(--primary)',
              fontSize: '12px',
              fontWeight: 700,
              marginBottom: '16px'
            }}
          >
            <Activity size={15} />
            <span>SISTEMA EMPRESARIAL VERSIÓN 1.0</span>
          </div>

          <h1
            style={{
              fontSize: '32px',
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: '-0.8px',
              color: 'var(--text)',
              margin: '0 0 16px'
            }}
          >
            Control Operativo Sísmico y Analítica Avanzada
          </h1>

          <p
            style={{
              fontSize: '14px',
              color: 'var(--text-muted)',
              lineHeight: 1.6,
              marginBottom: '28px'
            }}
          >
            Acceso unificado para analistas, operadores y auditores. Plataforma diseñada para la
            exploración rigurosa de eventos observados, entrenamiento reproducible y gobierno de alertas.
          </p>

          <div style={{ display: 'grid', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0
                }}
              >
                <Database size={16} />
              </div>
              <div>
                <strong style={{ fontSize: '13px', display: 'block' }}>Datos Observados Reales</strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Ingesta bajo demanda desde USGS con almacenamiento de snapshots trazables.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--warning-bg)',
                  color: 'var(--warning)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0
                }}
              >
                <Bell size={16} />
              </div>
              <div>
                <strong style={{ fontSize: '13px', display: 'block' }}>
                  Supervisión Humana Obligatoria
                </strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Flujo de doble operador: ningún aviso informativo se despacha sin autorización auditada.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--highlight)',
                  color: 'var(--primary)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0
                }}
              >
                <BrainCircuit size={16} />
              </div>
              <div>
                <strong style={{ fontSize: '13px', display: 'block' }}>Rigor Científico en ML</strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Split temporal para evitar fugas y comparación obligatoria con modelos basales.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Tarjeta de Acceso */}
        <div
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            padding: '36px 32px'
          }}
        >
          <div style={{ marginBottom: '20px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '1px',
                color: 'var(--primary)'
              }}
            >
              AUTENTICACIÓN CORPORATIVA
            </span>
            <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '6px 0 4px', color: 'var(--text)' }}>
              Iniciar Sesión
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              Ingresa tus credenciales o selecciona un rol para pruebas.
            </p>
          </div>

          {/* Selector Rápido de Roles para Evaluación / Cliente */}
          <div style={{ marginBottom: '22px' }}>
            <span
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: '8px'
              }}
            >
              Seleccionar cuenta de prueba rápida:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {DEMO_PRESETS.map((p) => (
                <button
                  key={p.email}
                  type="button"
                  onClick={() => selectPreset(p.email)}
                  className={`btn btn-sm ${email === p.email ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '11px', padding: '4px 9px' }}
                >
                  <UserCheck size={12} />
                  <span>{p.role}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  marginBottom: '6px',
                  color: 'var(--text)'
                }}
              >
                Correo institucional
              </label>
              <div className="filter-input-wrap" style={{ width: '100%' }}>
                <Mail size={16} />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="usuario@organizacion.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  marginBottom: '6px',
                  color: 'var(--text)'
                }}
              >
                Contraseña
              </label>
              <div className="filter-input-wrap" style={{ width: '100%' }}>
                <LockKeyhole size={16} />
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {message && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--error-bg)',
                  border: '1px solid var(--error-border)',
                  color: 'var(--error)',
                  fontSize: '12px'
                }}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '6px' }}
            >
              <span>{busy ? 'Validando sesión…' : 'Acceder a la plataforma'}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <div
            style={{
              marginTop: '22px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: 'var(--text-muted)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} color="var(--success)" />
              <span>Cifrado Argon2 + JWT</span>
            </div>
            <span>PostgreSQL v17</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          padding: '16px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: 'var(--text-muted)',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <span>© 2026 SismoIA Enterprise. Todos los derechos reservados.</span>
        <span>Avisos sujetos a revisión humana · No sustituye alertas oficiales del IGP/INDECI</span>
      </footer>
    </div>
  );
}
