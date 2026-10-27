import { useEffect, useState } from 'react';
import {
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  MapPin,
  Camera,
  Download,
  CheckCircle2,
  Database,
  Copy
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { authorized, session } from '../services/auth';
import { ExpandableModal } from '../components/ExpandableModal';

type EventItem = {
  id: string;
  external_id: string;
  source: string;
  occurred_at: string;
  place: string | null;
  magnitude: number | null;
  depth_km: number | null;
  latitude: number;
  longitude: number;
  source_url: string | null;
};

type EventPage = {
  total: number;
  page: number;
  page_size: number;
  items: EventItem[];
};

type SnapshotItem = {
  id: string;
  purpose: string;
  queried_at: string;
  event_count: number;
  sha256: string | null;
  status: string;
  error_summary: string | null;
};

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

export function Events() {
  const [data, setData] = useState<EventPage | null>(null);
  const [page, setPage] = useState(1);
  const [activeMinFilter, setActiveMinFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Estados de Snapshot y GeoJSON
  const [capturing, setCapturing] = useState(false);
  const [snapshotMsg, setSnapshotMsg] = useState('');
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [showSnapshotsModal, setShowSnapshotsModal] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const canCapture = Boolean(session.user?.permissions.includes('alertas.configurar'));

  async function fetchEvents() {
    setBusy(true);
    setError('');
    const query = new URLSearchParams({
      page: String(page),
      page_size: '20'
    });
    if (activeMinFilter) query.set('min_magnitude', activeMinFilter);

    try {
      const result = await authorized<EventPage>('/api/v1/events?' + query.toString());
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar catálogo de eventos');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void fetchEvents();
  }, [page, activeMinFilter]);

  async function handleCaptureSnapshot() {
    if (!canCapture) return;
    setCapturing(true);
    setSnapshotMsg('');
    try {
      const res = await authorized<{ id: string; sha256: string; event_count: number }>(
        '/api/v1/snapshots/capture?days=7&minimum=4.0',
        { method: 'POST' }
      );
      setSnapshotMsg(
        `Snapshot archivado exitosamente: ${res.event_count} eventos congelados con SHA-256: ${res.sha256.slice(0, 16)}…`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible capturar el snapshot');
    } finally {
      setCapturing(false);
    }
  }

  async function openSnapshotsHistory() {
    if (!canCapture) return;
    try {
      const list = await authorized<SnapshotItem[]>('/api/v1/snapshots');
      setSnapshots(list);
      setShowSnapshotsModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el historial de snapshots');
    }
  }

  async function downloadGeoJSON() {
    try {
      const res = await fetch(`${API}/api/v1/events/geojson`);
      if (!res.ok) throw new Error('Error al generar la capa GeoJSON');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sismoia_events_${new Date().toISOString().slice(0, 10)}.geojson`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible descargar el archivo GeoJSON');
    }
  }

  function copyToClipboard(text: string) {
    void navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2500);
  }

  function applyPreset(minVal: string) {
    setActiveMinFilter(minVal);
    setPage(1);
  }

  function getMagnitudeClass(mag: number | null) {
    if (mag === null) return 'low';
    if (mag >= 5.5) return 'high';
    if (mag >= 4.2) return 'med';
    return 'low';
  }

  function getStratum(depthKm: number | null) {
    if (depthKm === null) return { label: 'Sin dato', cls: '' };
    if (depthKm < 60) return { label: 'Superficial (<60 km)', cls: 'superficial' };
    if (depthKm <= 300) return { label: 'Intermedio (60-300 km)', cls: 'intermedio' };
    return { label: 'Profundo (>300 km)', cls: 'profundo' };
  }

  const filteredItems = (data?.items || []).filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const place = (item.place || '').toLowerCase();
    const src = item.source.toLowerCase();
    return place.includes(term) || src.includes(term);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Encabezado Corporativo y Acciones Backend */}
      <div className="page-heading">
        <div>
          <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <StatusBadge type="observed" />
            <span>CATÁLOGO OBSERVACIONAL · SINCRONIZADO EN VIVO CON USGS FDSN</span>
          </div>
          <h1>Catálogo de Eventos Sísmicos</h1>
          <p>
            Registro de sismos verificados en el territorio peruano y zonas de subducción aledañas. Permite capturar
            evidencias inmutables con integridad SHA-256 y exportar capas GeoJSON estándar para SIG.
          </p>
        </div>

        {/* Acciones Rápidas del Backend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={downloadGeoJSON}
            title="Exportar capa vectorial para QGIS / ArcGIS"
          >
            <Download size={14} />
            <span>GeoJSON</span>
          </button>

          {canCapture && (
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={openSnapshotsHistory}
                title="Ver historial de evidencias capturadas"
              >
                <Database size={14} />
                <span>Snapshots SHA-256</span>
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCaptureSnapshot}
                disabled={capturing}
                title="Congelar muestra actual con hash inmutable SHA-256"
              >
                <Camera size={14} />
                <span>{capturing ? 'Congelando…' : 'Capturar Snapshot'}</span>
              </button>
            </>
          )}

          <button
            type="button"
            className="icon-action-btn"
            onClick={() => void fetchEvents()}
            disabled={busy}
            title="Actualizar catálogo"
            aria-label="Actualizar catálogo"
          >
            <RefreshCw size={15} className={busy ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {snapshotMsg && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            color: 'var(--success)',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <CheckCircle2 size={16} />
          <span>{snapshotMsg}</span>
        </div>
      )}

      {/* Barra de Filtros, Búsqueda y Presets */}
      <div className="filter-bar">
        <div className="filter-input-wrap">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por localidad o región (ej. Arequipa, Lima, Ica, Camaná)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Magnitud:</span>
          <div className="segmented-control" role="group" aria-label="Filtro de magnitud">
            {[
              { val: '', label: 'Todas' },
              { val: '3.0', label: 'M ≥ 3.0' },
              { val: '4.0', label: 'M ≥ 4.0' },
              { val: '5.0', label: 'M ≥ 5.0' }
            ].map(({ val, label }) => (
              <button
                key={val}
                type="button"
                className={`segment-btn ${activeMinFilter === val ? 'active' : ''}`}
                onClick={() => applyPreset(val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
          Mostrando <strong>{filteredItems.length}</strong> de <strong>{(data?.total ?? 0).toLocaleString()}</strong> eventos
        </div>
      </div>

      {error && (
        <div role="alert" className="sismo-source-error">
          <strong>Error al consultar el catálogo sísmico:</strong> {error}
        </div>
      )}

      {/* Tabla Corporativa de Sismos */}
      <div className="enterprise-panel">
        <div className="panel-header">
          <div className="panel-title">
            <h2>Registros Observacionales Georreferenciados</h2>
            <p>Página {page} · 20 eventos por página · Catálogo oficial USGS</p>
          </div>
          <span className="badge badge-subtle">
            {filteredItems.length} Sismos Visibles
          </span>
        </div>

        <div className="panel-body" style={{ padding: 0 }}>
          {busy ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Consultando catálogo del USGS en tiempo real…
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No se encontraron sismos para los filtros seleccionados.
            </div>
          ) : (
            <div className="table-container">
              <table className="enterprise-table">
                <thead>
                  <tr>
                    <th style={{ width: '90px' }}>Magnitud</th>
                    <th>Localidad / Epicentro</th>
                    <th style={{ width: '180px' }}>Profundidad Focal</th>
                    <th style={{ width: '170px' }}>Coordenadas</th>
                    <th style={{ width: '220px' }}>Momento (Lima / UTC)</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Fuente</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((evt) => {
                    const stratum = getStratum(evt.depth_km);
                    const localDate = new Date(evt.occurred_at).toLocaleDateString('es-PE', {
                      timeZone: 'America/Lima',
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    });
                    const localTime = new Date(evt.occurred_at).toLocaleTimeString('es-PE', {
                      timeZone: 'America/Lima',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false
                    });
                    const utcText = new Date(evt.occurred_at).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

                    return (
                      <tr key={evt.id}>
                        {/* Celda Magnitud */}
                        <td>
                          <span className={`mag-badge ${getMagnitudeClass(evt.magnitude)}`}>
                            {evt.magnitude !== null ? `M ${evt.magnitude.toFixed(1)}` : '—'}
                          </span>
                        </td>

                        {/* Celda Localidad */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <MapPin size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div>
                              <strong style={{ fontSize: '13.5px', color: 'var(--text)' }}>
                                {evt.place || 'Epicentro en mar o sin referencia toponímica'}
                              </strong>
                              <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11px', marginTop: '1px' }}>
                                ID USGS: {evt.external_id}
                              </small>
                            </div>
                          </div>
                        </td>

                        {/* Celda Profundidad con Estrato */}
                        <td>
                          <div>
                            <strong style={{ fontSize: '13px' }}>
                              {evt.depth_km !== null ? `${Math.round(evt.depth_km)} km` : '—'}
                            </strong>
                            <div className={`stratum-tag ${stratum.cls}`}>{stratum.label}</div>
                          </div>
                        </td>

                        {/* Celda Coordenadas */}
                        <td>
                          <code
                            style={{
                              background: 'var(--surface-muted)',
                              padding: '3px 7px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              border: '1px solid var(--border-light, var(--border))'
                            }}
                          >
                            {evt.latitude.toFixed(3)}°, {evt.longitude.toFixed(3)}°
                          </code>
                        </td>

                        {/* Celda Momento (Lima / UTC) */}
                        <td>
                          <div>
                            <strong style={{ fontSize: '12.5px' }}>
                              {localDate} · {localTime}
                            </strong>
                            <small
                              style={{
                                display: 'block',
                                color: 'var(--text-muted)',
                                fontSize: '11px',
                                marginTop: '1px'
                              }}
                            >
                              {utcText}
                            </small>
                          </div>
                        </td>

                        {/* Celda Fuente Oficial */}
                        <td style={{ textAlign: 'right' }}>
                          {evt.source_url ? (
                            <a
                              href={evt.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-outline btn-sm"
                              title="Ver ficha técnica en el portal del USGS FDSN"
                            >
                              <span>USGS</span>
                              <ExternalLink size={11} />
                            </a>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>USGS</span>
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

        {/* Barra de Paginación */}
        <div
          style={{
            padding: '16px 22px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface)'
          }}
        >
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
            Página <strong>{page}</strong> de <strong>{data ? Math.max(1, Math.ceil(data.total / 20)) : 1}</strong>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={page <= 1 || busy}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} />
              <span>Anterior</span>
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={busy || !data || page * 20 >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              <span>Siguiente</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Historial de Snapshots SHA-256 */}
      <ExpandableModal
        isOpen={showSnapshotsModal}
        onClose={() => setShowSnapshotsModal(false)}
        title="Historial de Snapshots Inmutables (SHA-256)"
        subtitle="Capturas registradas en PostgreSQL con firma criptográfica para peritajes y reproducibilidad"
      >
        {snapshots.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            No hay snapshots registrados todavía.
          </p>
        ) : (
          <div className="table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Fecha UTC</th>
                  <th>Propósito</th>
                  <th>Eventos</th>
                  <th>Huella SHA-256</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.id}>
                    <td>{new Date(s.queried_at).toLocaleString('es-PE', { timeZone: 'UTC' })} UTC</td>
                    <td>
                      <strong>{s.purpose}</strong>
                    </td>
                    <td>
                      <span className="badge badge-subtle">{s.event_count} sismos</span>
                    </td>
                    <td>
                      {s.sha256 ? (
                        <code
                          style={{
                            fontSize: '11px',
                            background: 'var(--surface-muted)',
                            padding: '3px 6px',
                            borderRadius: '4px'
                          }}
                        >
                          {s.sha256.slice(0, 16)}…
                        </code>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className={`badge ${s.status === 'ok' ? 'badge-success' : 'badge-danger'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td>
                      {s.sha256 && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => copyToClipboard(s.sha256!)}
                          title="Copiar hash SHA-256 completo"
                        >
                          <Copy size={12} />
                          <span>{copiedHash === s.sha256 ? 'Copiado!' : 'Copiar Hash'}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ExpandableModal>
    </div>
  );
}
