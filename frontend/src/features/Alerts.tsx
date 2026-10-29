import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Layers,
  ShieldCheck,
  History,
  Compass,
  Send,
  Smartphone
} from 'lucide-react';
import { authorized } from '../services/auth';
import { useAuth } from '../app/auth';
import { StatusBadge } from '../components/StatusBadge';
import { ExpandableModal } from '../components/ExpandableModal';

type AlertRule = {
  id: string;
  name: string;
  min_magnitude: number;
  min_lat: number | null;
  max_lat: number | null;
  min_lon: number | null;
  max_lon: number | null;
  cooldown_minutes: number;
  enabled: boolean;
};

type MonitorRun = {
  id: string;
  started_at: string;
  status: string;
  examined: number;
  created: number;
  duplicates: number;
};

type MonitorStatus = {
  enabled: boolean;
  automatic_send: boolean;
};

type Alert = {
  id: string;
  external_event_id: string;
  title: string;
  body: string;
  status: string;
  created_at: string;
  created_by: string;
  approved_by: string | null;
};

type DeliveryConfig = {
  enabled: boolean;
  provider: string;
  topic_configured: boolean;
};

type PushDeviceItem = {
  id: string;
  platform: string;
  enabled: boolean;
};

type SendResult = {
  status: string;
  accepted_by_ntfy: number;
  failed: number;
  note: string;
};

type SimulationResult = {
  simulation: boolean;
  rule_id: string;
  snapshot_id: string;
  total_events: number;
  eligible: number;
  cooldown_excluded: number;
  sample: { external_id: string; magnitude: number; occurred_at: string; latitude: number; longitude: number }[];
  note: string;
};

type SnapshotItem = {
  id: string;
  purpose: string;
  queried_at: string;
  event_count: number;
  sha256: string | null;
};

export function Alerts() {
  const { user } = useAuth();
  const [items, setItems] = useState<Alert[]>([]);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'sent' | 'rejected' | 'all'>('pending');
  const [delivery, setDelivery] = useState<DeliveryConfig | null>(null);
  const [devices, setDevices] = useState<PushDeviceItem[]>([]);
  const [topic, setTopic] = useState('');
  const [sending, setSending] = useState<Alert | null>(null);
  const [sendReason, setSendReason] = useState('');
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [runs, setRuns] = useState<MonitorRun[]>([]);
  const [monitor, setMonitor] = useState<MonitorStatus | null>(null);

  // Estados de revisión y doble operador
  const [decision, setDecision] = useState<{ alert: Alert; action: 'approve' | 'reject' } | null>(null);
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState<{
    external_id: string;
    magnitude: number;
    depth_km: number;
    place: string;
    latitude: number;
    longitude: number;
    source_url: string;
  } | null>(null);

  // Estados de simulación histórica
  const [selectedRule, setSelectedRule] = useState('');
  const [selectedSnapshot, setSelectedSnapshot] = useState('');
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [showSimModal, setShowSimModal] = useState(false);

  // Nueva regla
  const [ruleName, setRuleName] = useState('Perú — Umbral Crítico');
  const [ruleMag, setRuleMag] = useState('5.0');
  const [ruleCooldown, setRuleCooldown] = useState('60');

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setItems(await authorized<Alert[]>('/api/v1/alerts'));
    } catch (e) {
      setMessage(String(e));
    }
  }

  useEffect(() => {
    void load();
    void authorized<MonitorStatus>('/api/v1/monitoring/status').then(setMonitor).catch(() => {});
    void authorized<MonitorRun[]>('/api/v1/monitoring/runs').then(setRuns).catch(() => {});
    void authorized<AlertRule[]>('/api/v1/alert-rules').then(setRules).catch(() => {});
    void authorized<SnapshotItem[]>('/api/v1/snapshots').then(setSnapshots).catch(() => {});
    void loadDelivery();
  }, []);

  async function loadDelivery() {
    void authorized<DeliveryConfig>('/api/v1/alerts/delivery/config').then(setDelivery).catch(() => {});
    void authorized<PushDeviceItem[]>('/api/v1/alerts/devices/mine').then(setDevices).catch(() => {});
  }

  async function registerDevice(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await authorized('/api/v1/alerts/devices', {
        method: 'POST',
        body: JSON.stringify({ token: topic.trim(), platform: 'ntfy' })
      });
      setTopic('');
      setMessage('Dispositivo registrado. Suscribe tu celular a ese mismo tema en la app ntfy.');
      await loadDelivery();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitSend() {
    if (!sending || sendReason.trim().length < 10) {
      setMessage('El motivo del envío es obligatorio (mínimo 10 caracteres).');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const r = await authorized<SendResult>(`/api/v1/alerts/${sending.id}/send`, {
        method: 'POST',
        body: JSON.stringify({ note: sendReason.trim() })
      });
      setMessage(
        r.status === 'sent'
          ? `Aviso enviado a ntfy (${r.accepted_by_ntfy} aceptado). ${r.note}`
          : `El envío falló (${r.failed} error). Revisa que haya un dispositivo registrado y que NTFY_TOPIC sea válido.`
      );
      setSending(null);
      setSendReason('');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function scan() {
    setBusy(true);
    setMessage('');
    try {
      const r = await authorized<{ examined: number; created: number; duplicates: number }>(
        '/api/v1/monitoring/scan?days=2&minimum=4.0',
        { method: 'POST' }
      );
      setMessage(
        `Escaneo finalizado: ${r.examined} sismos examinados, ${r.created} nuevos candidatos propuestos, ${r.duplicates} repetidos.`
      );
      await load();
      setRuns(await authorized<MonitorRun[]>('/api/v1/monitoring/runs'));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function openReview(alert: Alert, action: 'approve' | 'reject') {
    setReason('');
    setEvidence(null);
    setDecision({ alert, action });
    try {
      setEvidence(await authorized(`/api/v1/alerts/${alert.id}/evidence`));
    } catch (e) {
      setMessage('No se pudo cargar la evidencia: ' + String(e));
    }
  }

  async function submitDecision() {
    if (!decision || !reason.trim()) {
      setMessage('La justificación es obligatoria según la política de doble operador.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await authorized(`/api/v1/alerts/${decision.alert.id}/${decision.action}`, {
        method: 'POST',
        body: JSON.stringify({ note: reason.trim() })
      });
      setMessage(
        `Aviso ${decision.action === 'approve' ? 'aprobado' : 'rechazado'} con éxito y registrado en auditoría.`
      );
      setDecision(null);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runSimulation() {
    if (!selectedRule || !selectedSnapshot) {
      setMessage('Selecciona una regla y un snapshot para simular.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const sim = await authorized<SimulationResult>(
        `/api/v1/alert-rules/${selectedRule}/simulate?snapshot_id=${encodeURIComponent(selectedSnapshot)}`
      );
      setSimulation(sim);
      setShowSimModal(true);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveRule(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const body = {
        name: ruleName,
        min_magnitude: Number(ruleMag),
        cooldown_minutes: Number(ruleCooldown),
        enabled: true
      };
      await authorized('/api/v1/alert-rules', { method: 'POST', body: JSON.stringify(body) });
      setRules(await authorized<AlertRule[]>('/api/v1/alert-rules'));
      setMessage('Regla configurada y activada exitosamente.');
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }

  const filteredAlerts = items.filter((a) => {
    if (filterStatus === 'all') return true;
    return a.status === filterStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Encabezado */}
      <div className="page-header">
        <div className="page-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <StatusBadge type="informational" />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Principio de Doble Operador Activo
            </span>
          </div>
          <h1>Centro de Avisos y Supervisión Humana</h1>
          <p>
            Constructor de reglas de disparo, escáner activo bajo demanda y bandeja de aprobación por un
            segundo operador. Ninguna notificación se emite sin validación justificada.
          </p>
        </div>

        {/* Botón de Escaneo Activo Bajo Demanda */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          <button
            className="btn btn-primary"
            onClick={() => void scan()}
            disabled={busy || !monitor?.enabled}
            title="Interrogar sismos recientes y detectar candidatos"
          >
            <Play size={15} />
            <span>{busy ? 'Escaneando…' : 'Escanear candidatos ahora'}</span>
          </button>
          {runs.length > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {runs.length} escaneos registrados
            </span>
          )}
        </div>
      </div>

      {message && (
        <div
          role="alert"
          style={{
            padding: '12px 18px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderLeft: '4px solid var(--primary)',
            color: 'var(--text)',
            fontSize: '13px'
          }}
        >
          {message}
        </div>
      )}

      {/* Fila Operativa: Simulador de Reglas (Costado Izq) y Constructor de Reglas (Costado Der) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px'
        }}
      >
        {/* Simulador Histórico de Reglas */}
        <div className="enterprise-panel" style={{ margin: 0 }}>
          <div className="panel-header">
            <div className="panel-title">
              <h2>Simulador Histórico de Reglas</h2>
              <p>Evalúa el impacto de una regla sobre snapshots del pasado</p>
            </div>
            <Compass size={17} color="var(--primary)" />
          </div>

          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Regla a evaluar
              </label>
              <select
                className="filter-select"
                style={{ width: '100%' }}
                value={selectedRule}
                onChange={(e) => setSelectedRule(e.target.value)}
              >
                <option value="">Selecciona una regla…</option>
                {rules.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} (M ≥ {r.min_magnitude})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Snapshot histórico de prueba
              </label>
              <select
                className="filter-select"
                style={{ width: '100%' }}
                value={selectedSnapshot}
                onChange={(e) => setSelectedSnapshot(e.target.value)}
              >
                <option value="">Selecciona un snapshot…</option>
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.queried_at).toLocaleDateString()} — {s.event_count} eventos ({s.purpose})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn btn-outline"
              disabled={busy || !selectedRule || !selectedSnapshot}
              onClick={() => void runSimulation()}
              style={{ marginTop: '4px' }}
            >
              <Play size={14} />
              <span>Ejecutar Simulación Retrospectiva</span>
            </button>
          </div>
        </div>

        {/* Configuración Rápida de Reglas */}
        <div className="enterprise-panel" style={{ margin: 0 }}>
          <div className="panel-header">
            <div className="panel-title">
              <h2>Crear Regla de Detección</h2>
              <p>Define umbrales geofísicos para proponer candidatos</p>
            </div>
            <ShieldCheck size={17} color="var(--primary)" />
          </div>

          <form onSubmit={saveRule} className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Nombre identificador
              </label>
              <input
                type="text"
                className="filter-select"
                style={{ width: '100%' }}
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Magnitud mínima
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="3.5"
                  max="9.9"
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={ruleMag}
                  onChange={(e) => setRuleMag(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                  Espera (Cooldown min)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={ruleCooldown}
                  onChange={(e) => setRuleCooldown(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: '6px' }}>
              <span>Guardar Regla Activa</span>
            </button>
          </form>
        </div>
      </div>

      {/* Canal de entrega ntfy y registro de dispositivo */}
      <div className="enterprise-panel" style={{ margin: 0 }}>
        <div className="panel-header">
          <div className="panel-title">
            <h2>Canal de Entrega al Celular (ntfy)</h2>
            <p>
              {delivery?.enabled
                ? 'Envío habilitado en el backend.'
                : 'Envío deshabilitado: define PUSH_ENABLED=true en el backend para poder enviar.'}
              {delivery && !delivery.topic_configured && ' Falta configurar NTFY_TOPIC.'}
            </p>
          </div>
          <Smartphone size={17} color="var(--primary)" />
        </div>

        <form onSubmit={registerDevice} className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
              Tema ntfy (debe ser idéntico a NTFY_TOPIC y al tema suscrito en la app ntfy)
            </label>
            <input
              type="text"
              className="filter-select"
              style={{ width: '100%' }}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              minLength={8}
              maxLength={64}
              pattern="[A-Za-z0-9_\-]{8,64}"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy || !topic.trim()}>
            <span>Registrar dispositivo</span>
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {devices.filter((d) => d.enabled).length > 0
              ? `${devices.filter((d) => d.enabled).length} dispositivo(s) activo(s) registrado(s).`
              : 'Aún no hay dispositivos registrados: sin uno, el envío falla.'}
          </span>
        </form>
      </div>

      {/* Bandeja de Avisos y Flujo de Doble Operador */}
      <div className="enterprise-panel" style={{ margin: 0 }}>
        <div className="panel-header">
          <div className="panel-title">
            <h2>Bandeja de Avisos Informativos ({filteredAlerts.length})</h2>
            <p>Revisión colegiada: un operador propone y otro aprueba con justificación</p>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {(['pending', 'approved', 'sent', 'rejected', 'all'] as const).map((st) => (
              <button
                key={st}
                type="button"
                className={`btn btn-sm ${filterStatus === st ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setFilterStatus(st)}
              >
                {st === 'pending'
                  ? 'Pendientes'
                  : st === 'approved'
                  ? 'Aprobados'
                  : st === 'sent'
                  ? 'Enviados'
                  : st === 'rejected'
                  ? 'Rechazados'
                  : 'Todos'}
              </button>
            ))}
          </div>
        </div>

        <div className="panel-body" style={{ padding: 0 }}>
          {filteredAlerts.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No hay avisos en estado "{filterStatus}".
            </div>
          ) : (
            <div className="table-container">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th>Estado</th>
                    <th>Título / Descripción</th>
                    <th>ID Evento</th>
                    <th>Fecha Registro</th>
                    <th>Creado Por</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlerts.map((alt) => {
                    const isAuthor = alt.created_by === user?.id;
                    return (
                      <tr key={alt.id}>
                        <td>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '4px',
                              backgroundColor:
                                alt.status === 'approved'
                                  ? 'var(--success-bg)'
                                  : alt.status === 'rejected'
                                  ? 'var(--error-bg)'
                                  : 'var(--warning-bg)',
                              color:
                                alt.status === 'approved'
                                  ? 'var(--success)'
                                  : alt.status === 'rejected'
                                  ? 'var(--error)'
                                  : 'var(--warning)',
                              border: '1px solid currentColor'
                            }}
                          >
                            {alt.status.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontSize: '13px', display: 'block' }}>{alt.title}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{alt.body}</span>
                        </td>
                        <td>
                          <code style={{ fontSize: '11px', background: 'var(--surface-muted)', padding: '2px 5px', borderRadius: '4px' }}>
                            {alt.external_event_id}
                          </code>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px' }}>
                            {new Date(alt.created_at).toLocaleString('es-PE', { timeZone: 'America/Lima' })}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px' }}>
                            {isAuthor ? <strong style={{ color: 'var(--primary)' }}>Tú (Autor)</strong> : 'Otro operador'}
                          </span>
                        </td>
                        <td>
                          {alt.status === 'pending' ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                style={{ borderColor: 'var(--success)', color: 'var(--success)' }}
                                onClick={() => void openReview(alt, 'approve')}
                                title="Revisar evidencia y aprobar aviso"
                              >
                                <CheckCircle2 size={13} />
                                <span>Aprobar</span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
                                onClick={() => void openReview(alt, 'reject')}
                                title="Rechazar aviso"
                              >
                                <XCircle size={13} />
                                <span>Rechazar</span>
                              </button>
                            </div>
                          ) : alt.status === 'approved' ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              disabled={busy || !delivery?.enabled}
                              onClick={() => {
                                setSendReason('');
                                setSending(alt);
                              }}
                              title={
                                delivery?.enabled
                                  ? 'Enviar este aviso aprobado a ntfy'
                                  : 'Envío deshabilitado: configura PUSH_ENABLED=true en el backend'
                              }
                            >
                              <Send size={13} />
                              <span>Enviar</span>
                            </button>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Auditado</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Revisión por Doble Operador con Evidencia */}
      <ExpandableModal
        isOpen={Boolean(decision)}
        onClose={() => setDecision(null)}
        title={decision?.action === 'approve' ? 'Aprobación de Aviso Informativo' : 'Rechazo de Aviso'}
        subtitle="Principio de doble operador: se requiere justificación escrita y revisión de evidencia física"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {decision?.alert.created_by === user?.id && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--warning-bg)',
                border: '1px solid var(--warning-border)',
                color: 'var(--warning)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertTriangle size={18} />
              <span>
                <strong>Atención:</strong> Tú registraste este candidato. La regla de control de SismoIA
                impedirá que apruebes tu propio aviso para garantizar la separación de funciones.
              </span>
            </div>
          )}

          {/* Ficha de Evidencia del Sismo */}
          {evidence && (
            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--surface-muted)',
                border: '1px solid var(--border)',
                display: 'grid',
                gap: '10px'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                EVIDENCIA FÍSICA ASOCIADA (USGS):
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div>
                  <small style={{ color: 'var(--text-muted)' }}>Magnitud:</small>
                  <strong style={{ display: 'block', fontSize: '15px' }}>M {evidence.magnitude}</strong>
                </div>
                <div>
                  <small style={{ color: 'var(--text-muted)' }}>Profundidad:</small>
                  <strong style={{ display: 'block', fontSize: '15px' }}>{evidence.depth_km} km</strong>
                </div>
                <div>
                  <small style={{ color: 'var(--text-muted)' }}>Localidad:</small>
                  <strong style={{ display: 'block', fontSize: '14px' }}>{evidence.place}</strong>
                </div>
                <div>
                  <small style={{ color: 'var(--text-muted)' }}>Coordenadas:</small>
                  <span style={{ display: 'block', fontSize: '12px' }}>
                    {evidence.latitude}°, {evidence.longitude}°
                  </span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Justificación de la decisión (Obligatoria para auditoría):
            </label>
            <textarea
              rows={3}
              className="filter-select"
              style={{ width: '100%', padding: '10px', resize: 'vertical' }}
              placeholder="Escribe la razón fundamentada (ej. 'Contraste con catálogo USGS verificado y límites de afectación confirmados')..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-outline" onClick={() => setDecision(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !reason.trim()}
              onClick={() => void submitDecision()}
            >
              <span>Confirmar {decision?.action === 'approve' ? 'Aprobación' : 'Rechazo'}</span>
            </button>
          </div>
        </div>
      </ExpandableModal>

      {/* Modal de confirmación de envío */}
      <ExpandableModal
        isOpen={Boolean(sending)}
        onClose={() => setSending(null)}
        title="Enviar aviso aprobado a ntfy"
        subtitle="Aviso informativo; no es una alerta sísmica temprana oficial"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {sending && (
            <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
              <strong style={{ display: 'block', fontSize: '13px' }}>{sending.title}</strong>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sending.body}</span>
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Motivo del envío (obligatorio, mínimo 10 caracteres):
            </label>
            <textarea
              rows={3}
              className="filter-select"
              style={{ width: '100%', padding: '10px', resize: 'vertical' }}
              value={sendReason}
              onChange={(e) => setSendReason(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-outline" onClick={() => setSending(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || sendReason.trim().length < 10}
              onClick={() => void submitSend()}
            >
              <Send size={14} />
              <span>Confirmar envío</span>
            </button>
          </div>
        </div>
      </ExpandableModal>

      {/* Modal de Simulación Histórica de Reglas */}
      <ExpandableModal
        isOpen={showSimModal}
        onClose={() => setShowSimModal(false)}
        title="Resultados de la Simulación Retrospectiva"
        subtitle="Evaluación virtual sobre el snapshot histórico seleccionado (sin generación de alertas reales)"
      >
        {simulation && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-label">Eventos Evaluados</span>
                  <History size={16} />
                </div>
                <div className="kpi-number">{simulation.total_events}</div>
                <div className="kpi-trend">En el snapshot analizado</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-label">Alertas Potenciales</span>
                  <CheckCircle2 size={16} color="var(--success)" />
                </div>
                <div className="kpi-number">{simulation.eligible}</div>
                <div className="kpi-trend">Cumplieron la regla</div>
              </div>

              <div className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-label">Excluidos por Cooldown</span>
                  <Layers size={16} color="var(--warning)" />
                </div>
                <div className="kpi-number">{simulation.cooldown_excluded}</div>
                <div className="kpi-trend">Evitaron spam / duplicación</div>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 8px' }}>
                Muestra de Sismos que Habrían Disparado la Alerta:
              </h3>
              {simulation.sample.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  Ningún sismo del período cumplió las condiciones de la regla.
                </p>
              ) : (
                <div className="table-container">
                  <table className="enterprise-table">
                    <thead>
                      <tr>
                        <th>Magnitud</th>
                        <th>Fecha Ocurrencia (UTC)</th>
                        <th>Coordenadas</th>
                        <th>ID Externo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulation.sample.map((s) => (
                        <tr key={s.external_id}>
                          <td>
                            <strong style={{ color: 'var(--mag-high)' }}>M {s.magnitude.toFixed(1)}</strong>
                          </td>
                          <td>{new Date(s.occurred_at).toUTCString()}</td>
                          <td>
                            {s.latitude.toFixed(2)}°, {s.longitude.toFixed(2)}°
                          </td>
                          <td>
                            <code>{s.external_id}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </ExpandableModal>
    </div>
  );
}
