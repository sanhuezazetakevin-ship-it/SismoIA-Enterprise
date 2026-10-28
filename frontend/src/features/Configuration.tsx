import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Bell,
  ShieldCheck,
  Users,
  Palette,
  ExternalLink,
  UserPlus,
  Clock,
  Filter
} from 'lucide-react';
import { useAuth } from '../app/auth';
import { useTheme } from '../app/theme';
import { authorized } from '../services/auth';
import { ExpandableModal } from '../components/ExpandableModal';
import './Configuration.css';

type Tab = 'fuentes' | 'avisos' | 'preferencias' | 'seguridad';
type MonitorStatus = {
  enabled: boolean;
  push_enabled: boolean;
  automatic_send: boolean;
  min_magnitude_default: number;
  maximum_days: number;
};
type Rule = {
  id: string;
  name: string;
  min_magnitude: number;
  cooldown_minutes: number;
  enabled: boolean;
};
type UserSummary = {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  roles: string[];
};
type AuditEntry = {
  id: string;
  action: string;
  result: string;
  occurred_at: string;
  actor_id: string | null;
};

const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

const AVAILABLE_ROLES = [
  'ADMINISTRADOR',
  'ANALISTA',
  'OPERADOR_ALERTAS',
  'AUDITOR',
  'CONSULTA'
];

function dateBoth(date: string) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'Fecha no disponible';
  return `${d.toLocaleString('es-PE', { timeZone: 'America/Lima' })} Lima (${d.toISOString().slice(11, 19)} UTC)`;
}

function SectionLink({ to, children }: { to: string; children: string }) {
  return (
    <Link className="config-link" to={to}>
      {children}
      <ExternalLink size={15} aria-hidden="true" />
    </Link>
  );
}

export function Configuration() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<Tab>('fuentes');
  const [status, setStatus] = useState<MonitorStatus | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Creación interactiva de usuario
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('Password-for-local-tests-2026!');
  const [newRole, setNewRole] = useState('ANALISTA');

  // Filtro de logs
  const [logFilter, setLogFilter] = useState('');

  const perms = new Set(user?.permissions || []);
  const canMonitor = perms.has('alertas.configurar');
  const canUsers = perms.has('usuarios.ver');
  const canCreateUsers = perms.has('usuarios.crear');
  const canEditUsers = perms.has('usuarios.editar');
  const canAudit = perms.has('auditoria.ver');

  async function loadData() {
    setLoading(true);
    setError('');
    const operations: Promise<unknown>[] = [
      fetch(`${apiBase}/api/v1/health`)
        .then((r) => setApiOk(r.ok))
        .catch(() => setApiOk(false))
    ];
    if (canMonitor) {
      operations.push(authorized<MonitorStatus>('/api/v1/monitoring/status').then(setStatus));
      operations.push(authorized<Rule[]>('/api/v1/alert-rules').then(setRules));
    }
    if (canUsers) {
      operations.push(authorized<UserSummary[]>('/api/v1/users').then(setUsers));
    }
    if (canAudit) {
      operations.push(authorized<AuditEntry[]>('/api/v1/audit-logs?limit=50').then(setLogs));
    }
    try {
      await Promise.allSettled(operations);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [canMonitor, canUsers, canAudit]);

  async function handleToggleUserStatus(u: UserSummary) {
    if (!canEditUsers) return;
    try {
      await authorized(`/api/v1/users/${u.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !u.is_active })
      });
      setMsg(`Estado de ${u.full_name} actualizado.`);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cambiar estado');
    }
  }

  async function handleChangeUserRole(userId: string, role: string) {
    if (!canEditUsers) return;
    try {
      await authorized(`/api/v1/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role })
      });
      setMsg('Rol actualizado con éxito.');
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar rol');
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreateUsers) return;
    try {
      await authorized('/api/v1/users', {
        method: 'POST',
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          full_name: newName.trim(),
          password: newPassword,
          role: newRole
        })
      });
      setMsg(`Usuario ${newName} creado con éxito.`);
      setShowCreateUserModal(false);
      setNewEmail('');
      setNewName('');
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear usuario');
    }
  }

  const filteredLogs = logs.filter((l) => {
    if (!logFilter.trim()) return true;
    const term = logFilter.toLowerCase();
    return l.action.toLowerCase().includes(term) || l.result.toLowerCase().includes(term);
  });

  const tabs: { id: Tab; title: string; icon: typeof Activity }[] = [
    { id: 'fuentes', title: 'Fuentes', icon: Activity },
    { id: 'avisos', title: 'Avisos', icon: Bell },
    { id: 'preferencias', title: 'Preferencias', icon: Palette },
    { id: 'seguridad', title: 'Seguridad & RBAC', icon: ShieldCheck }
  ];

  return (
    <div className="config-page">
      <header className="config-heading">
        <div>
          <span className="eyebrow">ADMINISTRACIÓN DEL SISTEMA</span>
          <h1>Configuración y Control de Acceso</h1>
          <p>
            Parámetros operativos de la plataforma, conectores oficiales y administración de usuarios bajo
            el modelo de seguridad RBAC.
          </p>
        </div>
      </header>

      <nav className="config-tabs" aria-label="Secciones de configuración">
        {tabs.map((t) => (
          <button
            type="button"
            key={t.id}
            aria-current={tab === t.id ? 'page' : undefined}
            className={tab === t.id ? 'selected' : ''}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={16} aria-hidden="true" />
            <span>{t.title}</span>
          </button>
        ))}
      </nav>

      {loading && <p className="config-note" role="status">Consultando datos del servidor…</p>}
      {msg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            color: 'var(--success)',
            fontSize: '12px'
          }}
        >
          {msg}
        </div>
      )}
      {error && <p className="config-error" role="alert">{error}</p>}

      {/* Tab: Fuentes */}
      {tab === 'fuentes' && (
        <section className="config-panel" aria-labelledby="config-fuentes">
          <h2 id="config-fuentes">
            <Activity size={20} color="var(--primary)" />
            <span>Fuentes de Ingesta y Monitoreo</span>
          </h2>
          <p className="config-muted">
            Estado de los conectores de catálogos sísmicos observados y parámetros del motor FastAPI.
          </p>
          <dl className="config-facts">
            <div>
              <dt>API SismoIA</dt>
              <dd>{apiOk === null ? 'Comprobando' : apiOk ? 'En línea (OK)' : 'Sin respuesta'}</dd>
            </div>
            <div>
              <dt>Fuente Activa</dt>
              <dd>USGS FDSN (Perú y fronteras)</dd>
            </div>
            <div>
              <dt>Monitoreo Supervisado</dt>
              <dd>{status ? (status.enabled ? 'Habilitado' : 'Deshabilitado') : 'Sin información'}</dd>
            </div>
            <div>
              <dt>Envío Automático</dt>
              <dd>Desactivado por diseño ético</dd>
            </div>
          </dl>
          <div className="config-actions">
            <SectionLink to="/app/eventos">Catálogo de eventos observados</SectionLink>
            <SectionLink to="/app/mapa">Visualización cartográfica</SectionLink>
          </div>
        </section>
      )}

      {/* Tab: Avisos */}
      {tab === 'avisos' && (
        <section className="config-panel" aria-labelledby="config-avisos">
          <h2 id="config-avisos">
            <Bell size={20} color="var(--primary)" />
            <span>Reglas de Avisos y Cooldown</span>
          </h2>
          <p className="config-muted">
            Umbrales geofísicos configurados para la propuesta de candidatos informativos.
          </p>
          {canMonitor ? (
            <>
              <dl className="config-facts">
                <div>
                  <dt>Reglas Registradas</dt>
                  <dd>{rules.length}</dd>
                </div>
                <div>
                  <dt>Reglas Activas</dt>
                  <dd>{rules.filter((r) => r.enabled).length}</dd>
                </div>
                <div>
                  <dt>Canal Notificaciones</dt>
                  <dd>{status?.push_enabled ? 'Habilitado' : 'Deshabilitado'}</dd>
                </div>
              </dl>
              <div className="config-actions">
                <SectionLink to="/app/alertas">Administrar reglas y centro de avisos</SectionLink>
              </div>
            </>
          ) : (
            <p className="config-note">Tu rol no cuenta con permisos para modificar reglas de alerta.</p>
          )}
        </section>
      )}

      {/* Tab: Preferencias */}
      {tab === 'preferencias' && (
        <section className="config-panel" aria-labelledby="config-preferencias">
          <h2 id="config-preferencias">
            <Palette size={20} color="var(--primary)" />
            <span>Preferencias Visuales de Usuario</span>
          </h2>
          <div className="config-setting">
            <div>
              <strong>Tema de la Interfaz</strong>
              <p>Cambia entre el modo claro ejecutivo y el modo oscuro petróleo.</p>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={toggleTheme}>
              Modo {theme === 'light' ? 'Oscuro' : 'Claro'}
            </button>
          </div>
          <div className="config-setting">
            <div>
              <strong>Zonas Horarias de Referencia</strong>
              <p>Visualización sincronizada para eventos sísmicos nacionales e internacionales.</p>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>UTC / America/Lima</span>
          </div>
        </section>
      )}

      {/* Tab: Seguridad & RBAC */}
      {tab === 'seguridad' && (
        <section className="config-panel" aria-labelledby="config-seguridad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <h2 id="config-seguridad" style={{ margin: 0 }}>
              <ShieldCheck size={20} color="var(--primary)" />
              <span>Control de Acceso (RBAC) y Auditoría</span>
            </h2>

            {canCreateUsers && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowCreateUserModal(true)}
              >
                <UserPlus size={14} />
                <span>Nuevo Usuario</span>
              </button>
            )}
          </div>

          <dl className="config-facts" style={{ marginTop: '16px' }}>
            <div>
              <dt>Sesión Activa</dt>
              <dd>{user?.full_name} ({user?.email})</dd>
            </div>
            <div>
              <dt>Rol Actual</dt>
              <dd>{user?.roles?.join(', ')}</dd>
            </div>
            <div>
              <dt>Motor Criptográfico</dt>
              <dd>Argon2 + JWT Seguro</dd>
            </div>
          </dl>

          {/* Tabla Interactiva de Usuarios */}
          {canUsers && (
            <div style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '15px' }}>
                  <Users size={16} /> Usuarios Registrados ({users.length})
                </h3>
              </div>

              <div className="table-container">
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th>Usuario / Correo</th>
                      <th>Rol Asignado</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const primaryRole = u.roles[0] || 'CONSULTA';
                      return (
                        <tr key={u.id}>
                          <td>
                            <strong>{u.full_name}</strong>
                            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                              {u.email}
                            </span>
                          </td>
                          <td>
                            {canEditUsers ? (
                              <select
                                className="filter-select"
                                style={{ padding: '4px 8px', fontSize: '12px' }}
                                value={primaryRole}
                                onChange={(e) => void handleChangeUserRole(u.id, e.target.value)}
                              >
                                {AVAILABLE_ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span style={{ fontSize: '12px' }}>{primaryRole}</span>
                            )}
                          </td>
                          <td>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                backgroundColor: u.is_active ? 'var(--success-bg)' : 'var(--error-bg)',
                                color: u.is_active ? 'var(--success)' : 'var(--error)'
                              }}
                            >
                              {u.is_active ? 'ACTIVO' : 'SUSPENDIDO'}
                            </span>
                          </td>
                          <td>
                            {canEditUsers ? (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => void handleToggleUserStatus(u)}
                                style={{ fontSize: '11px', padding: '3px 8px' }}
                              >
                                {u.is_active ? 'Suspender' : 'Activar'}
                              </button>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Visor de Auditoría Inmutable */}
          {canAudit && (
            <div style={{ marginTop: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '15px' }}>
                  <Clock size={16} /> Bitácora Inmutable de Auditoría
                </h3>
                <div className="filter-input-wrap" style={{ maxWidth: '280px', padding: '4px 10px' }}>
                  <Filter size={14} />
                  <input
                    type="text"
                    placeholder="Filtrar por acción o resultado…"
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value)}
                    style={{ fontSize: '12px' }}
                  />
                </div>
              </div>

              <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th>Acción</th>
                      <th>Resultado</th>
                      <th>Fecha / Hora</th>
                      <th>Actor ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <code>{l.action}</code>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: l.result === 'success' ? 'var(--success)' : 'var(--error)'
                            }}
                          >
                            {l.result.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px' }}>{dateBoth(l.occurred_at)}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {l.actor_id ? l.actor_id.slice(0, 13) + '…' : 'Sistema'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Modal para Crear Nuevo Usuario */}
      <ExpandableModal
        isOpen={showCreateUserModal}
        onClose={() => setShowCreateUserModal(false)}
        title="Crear Nuevo Usuario"
        subtitle="Registra credenciales con rol RBAC asignado de forma inmediata en PostgreSQL"
      >
        <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
              Nombre completo
            </label>
            <input
              type="text"
              required
              className="filter-select"
              style={{ width: '100%' }}
              placeholder="Ej. Ing. Carlos Mendoza"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
              Correo institucional
            </label>
            <input
              type="email"
              required
              className="filter-select"
              style={{ width: '100%' }}
              placeholder="carlos@sismoia.gob.pe"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
              Contraseña inicial (mínimo 12 caracteres)
            </label>
            <input
              type="password"
              required
              minLength={12}
              className="filter-select"
              style={{ width: '100%' }}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
              Rol en el sistema
            </label>
            <select
              className="filter-select"
              style={{ width: '100%' }}
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
            >
              {AVAILABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowCreateUserModal(false)}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Registrar Usuario
            </button>
          </div>
        </form>
      </ExpandableModal>
    </div>
  );
}
