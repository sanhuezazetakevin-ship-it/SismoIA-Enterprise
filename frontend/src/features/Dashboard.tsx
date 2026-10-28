import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  MapPinned,
  BarChart3,
  BrainCircuit,
  Bell,
  FileText,
  ArrowUpRight,
  RefreshCw,
  Layers,
  Waves,
  MapPin,
  ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { authorized } from '../services/auth';
import { ExpandableModal, ExpandButton } from '../components/ExpandableModal';

type Snapshot = {
  total: number;
  mean_magnitude: number | null;
  max_magnitude: number | null;
  mean_depth_km: number | null;
  daily: { date: string; count: number }[];
};

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
  items: EventItem[];
};

const PERIODS = [
  { label: '7D', value: 7 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
  { label: '1A', value: 365 }
];

export function Dashboard() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [recentEvents, setRecentEvents] = useState<EventItem[]>([]);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [expandChart, setExpandChart] = useState(false);

  async function loadData() {
    setBusy(true);
    setError('');
    try {
      const [summaryRes, eventsRes] = await Promise.all([
        authorized<Snapshot>(`/api/v1/analytics/summary?days=${days}&peru_only=true`),
        authorized<EventPage>('/api/v1/events?page=1&page_size=5')
      ]);
      setData(summaryRes);
      setRecentEvents(eventsRes.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar datos');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [days]);

  function getMagSeverity(mag: number | null) {
    if (mag === null) return 'low';
    if (mag >= 5.5) return 'high';
    if (mag >= 4.2) return 'med';
    return 'low';
  }

  return (
    <div className="dashboard-layout">
      {/* Barra de Control y Título */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Centro de Monitoreo</h1>
          <p className="dashboard-subtitle">
            Supervisión continua de sismicidad y tendencias geofísicas en el territorio peruano
          </p>
        </div>

        <div className="dashboard-controls">
          {/* Selector de Período Segmentado */}
          <div className="segmented-control" role="group" aria-label="Período de tiempo">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`segment-btn ${days === p.value ? 'active' : ''}`}
                onClick={() => setDays(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            className="icon-action-btn"
            onClick={loadData}
            disabled={busy}
            title="Actualizar datos"
            aria-label="Actualizar datos"
          >
            <RefreshCw size={15} className={busy ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="sismo-source-error">
          <p>{error}</p>
        </div>
      )}

      {/* Fila 1: Indicadores Clave de Desempeño (KPIs) */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Eventos Registrados</span>
            <div className="kpi-icon-wrap primary">
              <Activity size={17} />
            </div>
          </div>
          <div className="kpi-number">{data ? data.total.toLocaleString() : '—'}</div>
          <div className="kpi-trend">Ventana de {days} días activos</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Magnitud Máxima</span>
            <div className="kpi-icon-wrap danger">
              <Waves size={17} />
            </div>
          </div>
          <div className="kpi-number">
            {data?.max_magnitude !== null && data?.max_magnitude !== undefined
              ? `M ${data.max_magnitude.toFixed(1)}`
              : '—'}
          </div>
          <div className="kpi-trend">Evento de mayor energía</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Magnitud Promedio</span>
            <div className="kpi-icon-wrap warning">
              <BarChart3 size={17} />
            </div>
          </div>
          <div className="kpi-number">
            {data?.mean_magnitude !== null && data?.mean_magnitude !== undefined
              ? data.mean_magnitude.toFixed(2)
              : '—'}
          </div>
          <div className="kpi-trend">Media aritmética de la muestra</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Profundidad Media</span>
            <div className="kpi-icon-wrap info">
              <Layers size={17} />
            </div>
          </div>
          <div className="kpi-number">
            {data?.mean_depth_km !== null && data?.mean_depth_km !== undefined
              ? `${Math.round(data.mean_depth_km)} km`
              : '—'}
          </div>
          <div className="kpi-trend">
            {data && data.mean_depth_km !== null && data.mean_depth_km < 60
              ? 'Foco superficial (< 60 km)'
              : 'Foco intermedio / profundo'}
          </div>
        </div>
      </div>

      {/* Fila 2: Cuadrícula Operativa Principal (65% Gráfico | 35% Feed) */}
      <div className="dashboard-main-grid">
        {/* Gráfico de Actividad Diaria */}
        <div className="enterprise-panel chart-panel">
          <div className="panel-header">
            <div className="panel-title">
              <h2>Tendencia de Actividad</h2>
              <p>Frecuencia diaria de eventos registrados</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ExpandButton onClick={() => setExpandChart(true)} title="Ampliar gráfico de tendencia" />
              <Link to="/app/estadisticas" className="panel-link">
                <span>Análisis</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>

          <div className="panel-body">
            {data && data.daily.length > 0 ? (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={data.daily} margin={{ top: 12, right: 12, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--border)' }}
                      minTickGap={24}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        boxShadow: 'var(--shadow)',
                        color: 'var(--text)',
                        fontSize: '12px'
                      }}
                      formatter={(val: unknown) => [Number(val) || 0, 'Eventos']}
                      labelFormatter={(label) => `Fecha: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="var(--primary)"
                      strokeWidth={2.5}
                      fill="url(#areaGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-chart-state">
                {busy ? 'Cargando series temporales…' : 'Sin datos para el período seleccionado'}
              </div>
            )}
          </div>
        </div>

        {/* Feed de Sismos Recientes */}
        <div className="enterprise-panel recent-panel">
          <div className="panel-header">
            <div className="panel-title">
              <h2>Eventos Recientes</h2>
              <p>Últimos sismos observados en Perú</p>
            </div>
            <Link to="/app/eventos" className="panel-link">
              <span>Catálogo</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="panel-body" style={{ padding: 0 }}>
            {recentEvents.length > 0 ? (
              <div className="recent-list">
                {recentEvents.map((evt) => (
                  <div key={evt.id} className="recent-item">
                    <div className={`mag-indicator ${getMagSeverity(evt.magnitude)}`}>
                      {evt.magnitude !== null ? evt.magnitude.toFixed(1) : '—'}
                    </div>

                    <div className="recent-info">
                      <strong className="recent-place">{evt.place || 'Epicentro en costa / mar'}</strong>
                      <span className="recent-meta">
                        {evt.depth_km !== null ? `${Math.round(evt.depth_km)} km prof.` : ''} ·{' '}
                        {new Date(evt.occurred_at).toLocaleTimeString('es-PE', {
                          timeZone: 'America/Lima',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false
                        })}{' '}
                        Lima
                      </span>
                    </div>

                    <Link
                      to="/app/mapa"
                      className="recent-map-btn"
                      title="Ver localización en mapa"
                      aria-label="Ver localización en mapa"
                    >
                      <MapPin size={14} />
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-recent-state">
                {busy ? 'Consultando registros…' : 'Sin sismos recientes.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fila 3: Módulos Operativos Clave (Distribución Equilibrada) */}
      <div className="modules-grid">
        <Link to="/app/mapa" className="module-card">
          <div className="module-icon-box">
            <MapPinned size={20} />
          </div>
          <div className="module-content">
            <h3>Mapa Cartográfico</h3>
            <p>Visualización interactiva georreferenciada con epicentros y filtros espaciales</p>
          </div>
          <ArrowUpRight size={15} className="module-arrow" />
        </Link>

        <Link to="/app/ml" className="module-card">
          <div className="module-icon-box">
            <BrainCircuit size={20} />
          </div>
          <div className="module-content">
            <h3>Laboratorio ML</h3>
            <p>Modelos de clasificación supervisada con división temporal estricta y baselines</p>
          </div>
          <ArrowUpRight size={15} className="module-arrow" />
        </Link>

        <Link to="/app/alertas" className="module-card">
          <div className="module-icon-box">
            <Bell size={20} />
          </div>
          <div className="module-content">
            <h3>Centro de Avisos</h3>
            <p>Constructor de reglas operativas y flujo auditado de revisión por doble operador</p>
          </div>
          <ArrowUpRight size={15} className="module-arrow" />
        </Link>

        <Link to="/app/reportes" className="module-card">
          <div className="module-icon-box">
            <FileText size={20} />
          </div>
          <div className="module-content">
            <h3>Reportes Oficiales</h3>
            <p>Exportación de informes ejecutivos en formato PDF resumido y CSV saneado</p>
          </div>
          <ArrowUpRight size={15} className="module-arrow" />
        </Link>
      </div>

      {/* Modal Expandido de Gráfico */}
      <ExpandableModal
        isOpen={expandChart}
        onClose={() => setExpandChart(false)}
        title="Tendencia Temporal de Actividad Sísmica"
        subtitle={`Frecuencia diaria de eventos observados en Perú · Ventana de ${days} días`}
      >
        <div style={{ width: '100%', height: 420 }}>
          {data && data.daily.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily} margin={{ top: 20, right: 20, left: 0, bottom: 10 }}>
                <defs>
                  <linearGradient id="areaGradientExpanded" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border)' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow)',
                    color: 'var(--text)',
                    fontSize: '13px'
                  }}
                  formatter={(val: unknown) => [Number(val) || 0, 'Eventos observados']}
                  labelFormatter={(label) => `Fecha: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--primary)"
                  strokeWidth={3}
                  fill="url(#areaGradientExpanded)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              Sin datos disponibles para ampliar.
            </div>
          )}
        </div>
      </ExpandableModal>
    </div>
  );
}
