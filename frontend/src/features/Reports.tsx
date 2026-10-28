import { useCallback, useEffect, useState } from 'react';
import {
  FileDown,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { authorized, session } from '../services/auth';
import { StatusBadge } from '../components/StatusBadge';

type History = {
  id: string;
  category: string;
  format: string;
  rows_count: number;
  generated_at: string;
};

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

const choices = [
  { value: 'events', label: 'Catálogo de eventos observados (USGS)' },
  { value: 'ml', label: 'Estudios y experimentos Machine Learning' },
  { value: 'alerts', label: 'Centro de avisos informativos y auditoría' }
];

export function Reports() {
  const [category, setCategory] = useState('events');
  const [format, setFormat] = useState('csv');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [history, setHistory] = useState<History[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const allowed = Boolean(session.user?.permissions.includes('reportes.generar'));

  const refresh = useCallback(async () => {
    if (!allowed) return;
    try {
      setHistory(await authorized<History[]>('/api/v1/reports/exports'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar el historial de descargas');
    }
  }, [allowed]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function download() {
    if (!session.token) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (start && end && start > end) {
        throw new Error('La fecha inicial no puede superar a la fecha final.');
      }
      const p = new URLSearchParams({ category, format });
      if (start) p.set('start', new Date(start + 'T00:00:00Z').toISOString());
      if (end) p.set('end', new Date(end + 'T23:59:59Z').toISOString());

      const response = await fetch(`${API}/api/v1/reports/download?${p}`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(typeof json?.detail === 'string' ? json.detail : `Error HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sismoia_${category}_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setNotice('Reporte generado y descargado exitosamente. La exportación quedó registrada en auditoría.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible exportar el reporte');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Encabezado */}
      <div className="page-header">
        <div className="page-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <StatusBadge type="informational" />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Módulo de Exportación y Auditoría
            </span>
          </div>
          <h1>Generador de Reportes Oficiales</h1>
          <p>
            Genera informes consolidados en formatos CSV (hasta 1.000 filas con protección anti-inyección de fórmulas)
            y PDF ejecutivo con indicadores gráficos y metadatos del solicitante.
          </p>
        </div>
      </div>

      {/* Panel de Configuración de Reporte */}
      <div className="enterprise-panel" style={{ margin: 0 }}>
        <div className="panel-header">
          <div className="panel-title">
            <h2>Parámetros de Exportación</h2>
            <p>Selecciona la categoría, formato y ventana de fechas</p>
          </div>
        </div>

        <div className="panel-body">
          {!allowed ? (
            <div role="alert" className="sismo-source-error">
              <strong>Permiso denegado</strong>
              <p>Tu rol actual no tiene asignado el permiso <code>reportes.generar</code>.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px'
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      marginBottom: '6px'
                    }}
                  >
                    Categoría de datos
                  </label>
                  <select
                    className="filter-select"
                    style={{ width: '100%', padding: '10px' }}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {choices.map((c) => (
                      <option value={c.value} key={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      marginBottom: '6px'
                    }}
                  >
                    Formato de salida
                  </label>
                  <select
                    className="filter-select"
                    style={{ width: '100%', padding: '10px' }}
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                  >
                    <option value="csv">CSV · Datos tabulares (hasta 1.000 filas)</option>
                    <option value="pdf">PDF · Informe ejecutivo con gráficos (hasta 50 filas)</option>
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      marginBottom: '6px'
                    }}
                  >
                    Fecha desde (UTC)
                  </label>
                  <input
                    type="date"
                    className="filter-select"
                    style={{ width: '100%', padding: '9px' }}
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: 600,
                      marginBottom: '6px'
                    }}
                  >
                    Fecha hasta (UTC)
                  </label>
                  <input
                    type="date"
                    className="filter-select"
                    style={{ width: '100%', padding: '9px' }}
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </div>
              </div>

              {notice && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--success-bg)',
                    border: '1px solid var(--success-border)',
                    color: 'var(--success)',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{notice}</span>
                </div>
              )}

              {error && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--error-bg)',
                    border: '1px solid var(--error-border)',
                    color: 'var(--error)',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void download()}
                >
                  <FileDown size={16} />
                  <span>{busy ? 'Generando reporte…' : `Descargar ${format.toUpperCase()}`}</span>
                </button>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Generación en tiempo real con metadatos de sesión
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Historial Persistente de Exportaciones */}
      {allowed && (
        <div className="enterprise-panel" style={{ margin: 0 }}>
          <div className="panel-header">
            <div className="panel-title">
              <h2>Historial de Solicitudes</h2>
              <p>Registro de exportaciones previas asociadas a tu usuario</p>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => void refresh()}
            >
              <RefreshCw size={13} />
              <span>Actualizar historial</span>
            </button>
          </div>

          <div className="panel-body" style={{ padding: 0 }}>
            {history.length === 0 ? (
              <div
                style={{
                  padding: '32px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '13px'
                }}
              >
                No tienes exportaciones previas registradas.
              </div>
            ) : (
              <div className="table-container">
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th>Fecha / Hora (UTC)</th>
                      <th>Contenido Exportado</th>
                      <th>Formato</th>
                      <th>Registros Procesados</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td>
                          <strong>{new Date(h.generated_at).toLocaleString('es-PE', { timeZone: 'UTC' })} UTC</strong>
                        </td>
                        <td>
                          {choices.find((c) => c.value === h.category)?.label || h.category}
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: h.format === 'pdf' ? 'var(--error-bg)' : 'var(--success-bg)',
                              color: h.format === 'pdf' ? 'var(--error)' : 'var(--success)',
                              border: `1px solid ${h.format === 'pdf' ? 'var(--error-border)' : 'var(--success-border)'}`
                            }}
                          >
                            {h.format.toUpperCase()}
                          </span>
                        </td>
                        <td>{h.rows_count.toLocaleString()} filas</td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontSize: '12px' }}>
                            <CheckCircle2 size={13} />
                            <span>Auditado</span>
                          </span>
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
    </div>
  );
}
