import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ScatterChart,
  Scatter,
  ZAxis,
  AreaChart,
  Area
} from 'recharts';
import {
  Maximize2,
  ExternalLink,
  MapPin
} from 'lucide-react';
import { authorized } from '../services/auth';
import { StatusBadge } from '../components/StatusBadge';
import { ExpandableModal, ExpandButton } from '../components/ExpandableModal';

type Stat = {
  total: number;
  mean_magnitude: number | null;
  max_magnitude: number | null;
  mean_depth_km: number | null;
  daily: { date: string; count: number }[];
  magnitudes: { range: string; count: number }[];
  depths: { range: string; count: number }[];
  scope: string;
};

type Point = {
  id: string;
  lat: number;
  lon: number;
  magnitude: number | null;
  depth_km: number | null;
  occurred_at: string;
  place: string | null;
  source: string;
  source_url: string | null;
};

type MapResult = {
  items: Point[];
  sampled: boolean;
  queried_at: string;
  source: string;
  period_days: number;
  cache_hit: boolean;
};

const CHART_COLOR_PRIMARY = '#0F4C5C';
const CHART_COLOR_ACCENT = '#0284C7';
const CHART_COLOR_WARNING = '#FB8B24';
const CHART_COLOR_CRITICAL = '#E36414';

const fmt = (v: number | null, dec = 1) => (v === null ? '—' : v.toFixed(dec));

function dateUTC(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'No disponible' : d.toLocaleString('es-PE', { timeZone: 'UTC' }) + ' UTC';
}

function escapeHtml(input: string) {
  return input.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

function isValidPoint(p: Point) {
  const lat = Number(p.lat), lon = Number(p.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function normalizedPoint(p: Point): Point {
  return {
    ...p,
    lat: Number(p.lat),
    lon: Number(p.lon),
    magnitude: p.magnitude === null ? null : Number(p.magnitude),
    depth_km: p.depth_km === null ? null : Number(p.depth_km)
  };
}

// ---------------------------------------------------------------------------
// VISTA: ESTADÍSTICAS SÍSMICAS (DIAGRAMAS COMPACTOS CON ZOOM EN MODAL)
// ---------------------------------------------------------------------------

export function Statistics() {
  const [days, setDays] = useState(30);
  const [minimum, setMinimum] = useState('');
  const [activeModal, setActiveModal] = useState<'daily' | 'magnitudes' | 'depths' | 'scatter' | null>(null);

  const [data, setData] = useState<Stat | null>(null);
  const [scatterPoints, setScatterPoints] = useState<{ depth: number; magnitude: number; place: string }[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setBusy(true);
    setError('');

    const summaryParams = new URLSearchParams({ days: String(days), peru_only: 'true' });
    if (minimum.trim() !== '') summaryParams.set('min_magnitude', minimum);

    const mapParams = new URLSearchParams({ days: String(days), peru_only: 'true', limit: '1000' });
    if (minimum.trim() !== '') mapParams.set('min_magnitude', minimum);

    Promise.all([
      authorized<Stat>('/api/v1/analytics/summary?' + summaryParams.toString()),
      authorized<MapResult>('/api/v1/analytics/map?' + mapParams.toString())
    ])
      .then(([summaryRes, mapRes]) => {
        if (!active) return;
        setData(summaryRes);
        const validPoints = (mapRes?.items || [])
          .filter(p => p.depth_km !== null && p.magnitude !== null && Number.isFinite(p.depth_km) && Number.isFinite(p.magnitude))
          .map(p => ({
            depth: Number(p.depth_km),
            magnitude: Number(p.magnitude),
            place: p.place || 'Ubicación no especificada'
          }));
        setScatterPoints(validPoints);
      })
      .catch(e => {
        if (active) setError(e instanceof Error ? e.message : 'Error al consultar estadísticas');
      })
      .finally(() => {
        if (active) setBusy(false);
      });

    return () => {
      active = false;
    };
  }, [days, minimum]);

  // Métricas derivadas
  const peakDaily = useMemo(() => {
    if (!data?.daily?.length) return null;
    return data.daily.reduce((max, curr) => (curr.count > max.count ? curr : max), data.daily[0]);
  }, [data]);

  const dominantMagRange = useMemo(() => {
    if (!data?.magnitudes?.length) return null;
    return data.magnitudes.reduce((max, curr) => (curr.count > max.count ? curr : max), data.magnitudes[0]);
  }, [data]);

  const dominantDepthRange = useMemo(() => {
    if (!data?.depths?.length) return null;
    return data.depths.reduce((max, curr) => (curr.count > max.count ? curr : max), data.depths[0]);
  }, [data]);

  return (
    <div>
      {/* Encabezado Corporativo */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">ANALÍTICA SÍSMICA · OBSERVATORIO RETROSPECTIVO</div>
          <h1>Distribución y Estadísticas Geofísicas</h1>
          <p>
            Análisis descriptivo multidimensional de eventos observados en el territorio peruano. Los diagramas
            laterales son interactivos; pulsa cualquiera para ampliar su vista detallada.
          </p>
        </div>

        {/* Filtros de Control Segmentados */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="segmented-control" role="group" aria-label="Ventana temporal">
            {[7, 30, 90, 365].map(p => (
              <button
                key={p}
                type="button"
                className={`segment-btn ${days === p ? 'active' : ''}`}
                onClick={() => setDays(p)}
              >
                {p === 365 ? '1 Año' : `${p} Días`}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Mín:</span>
            <select
              value={minimum}
              onChange={e => setMinimum(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                fontSize: '12.5px',
                fontWeight: 600
              }}
            >
              <option value="">Todas las magnitudes</option>
              <option value="3.5">M ≥ 3.5</option>
              <option value="4.0">M ≥ 4.0</option>
              <option value="4.5">M ≥ 4.5</option>
              <option value="5.0">M ≥ 5.0</option>
            </select>
          </div>
        </div>
      </div>

      {busy && <div className="sismo-loading" style={{ margin: '20px 0' }}>Actualizando métricas analíticas…</div>}
      {error && (
        <div role="alert" className="sismo-source-error" style={{ margin: '20px 0' }}>
          <strong>Error de consulta:</strong> {error}
        </div>
      )}

      {data && (
        <>
          {/* Tarjetas KPI Superiores */}
          <div className="sismo-metrics" style={{ marginTop: '16px' }}>
            <article className="kpi-card">
              <span>Eventos Registrados</span>
              <strong>{data.total.toLocaleString()}</strong>
              <small>Muestra en catálogo</small>
            </article>
            <article className="kpi-card">
              <span>Magnitud Promedio</span>
              <strong>{fmt(data.mean_magnitude, 2)}</strong>
              <small>Promedio aritmético</small>
            </article>
            <article className="kpi-card">
              <span>Magnitud Máxima</span>
              <strong style={{ color: (data.max_magnitude || 0) >= 6 ? 'var(--critical)' : 'var(--text)' }}>
                M {fmt(data.max_magnitude)}
              </strong>
              <small>Mayor evento del período</small>
            </article>
            <article className="kpi-card">
              <span>Profundidad Media</span>
              <strong>{fmt(data.mean_depth_km)} km</strong>
              <small>Estratificación hipocentral</small>
            </article>
          </div>

          {/* Layout Principal: Resumen Estructurado (Izquierda) + Dock de Diagramas Compactos (Derecha) */}
          <div className="analytics-layout">
            {/* Columna Principal Izquierda: Análisis de Estratificación y Categorías */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Panel de Estratificación Geológica */}
              <div className="panel" style={{ padding: '22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 750, margin: 0 }}>
                      Estratificación Hipocentral de la Sismicidad
                    </h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      Distribución por profundidad de la zona de subducción e intraplaca en el margen peruano.
                    </p>
                  </div>
                  <span className="badge badge-subtle">Criterio USGS / IGP</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {data.depths.map(d => {
                    const pct = data.total > 0 ? (d.count / data.total) * 100 : 0;
                    return (
                      <div key={d.range} style={{ fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: 600 }}>
                          <span>Profundidad {d.range} km</span>
                          <span>
                            {d.count} eventos ({pct.toFixed(1)}%)
                          </span>
                        </div>
                        <div
                          style={{
                            height: '8px',
                            background: 'var(--surface-muted)',
                            borderRadius: '4px',
                            overflow: 'hidden'
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${pct}%`,
                              backgroundColor: CHART_COLOR_PRIMARY,
                              borderRadius: '4px',
                              transition: 'width 0.4s ease'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Panel de Desglose Energético por Rangos de Magnitud */}
              <div className="panel" style={{ padding: '22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 750, margin: 0 }}>
                      Distribución Energética por Categoría
                    </h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      Frecuencia observada agrupada por magnitud en escala momento (Mw).
                    </p>
                  </div>
                  <span className="badge badge-subtle">{data.magnitudes.length} Intervalos</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
                  {data.magnitudes.map(m => {
                    const pct = data.total > 0 ? ((m.count / data.total) * 100).toFixed(1) : '0';
                    return (
                      <div
                        key={m.range}
                        style={{
                          background: 'var(--surface-muted)',
                          padding: '12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-light)'
                        }}
                      >
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                          Rango {m.range}
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', margin: '4px 0' }}>
                          {m.count}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>{pct}% del total</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Observaciones Operativas Clave */}
              <div
                className="panel"
                style={{
                  padding: '20px',
                  background: 'linear-gradient(135deg, rgba(15, 76, 92, 0.04) 0%, rgba(2, 132, 199, 0.04) 100%)',
                  border: '1px solid var(--border)'
                }}
              >
                <h3 style={{ fontSize: '14px', fontWeight: 750, margin: '0 0 10px 0', color: 'var(--primary)' }}>
                  Dictamen Analítico del Intervalo Seleccionado
                </h3>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12.5px', color: 'var(--text)', lineHeight: '1.7' }}>
                  <li>
                    Se procesaron <strong>{data.total} eventos observados</strong> en la región geográfica del Perú durante
                    los últimos <strong>{days} días</strong>.
                  </li>
                  {peakDaily && (
                    <li>
                      El pico máximo de actividad diaria se registró el <strong>{peakDaily.date}</strong> con un total de{' '}
                      <strong>{peakDaily.count} eventos</strong> detectados.
                    </li>
                  )}
                  {dominantDepthRange && (
                    <li>
                      La sismicidad preponderante se concentra en el estrato de profundidad{' '}
                      <strong>{dominantDepthRange.range} km</strong> ({dominantDepthRange.count} sismos).
                    </li>
                  )}
                  <li>
                    La tasa promedio observada se sitúa en <strong>{(data.total / days).toFixed(1)} eventos/día</strong>.
                  </li>
                </ul>
              </div>

              {/* Panel Alargado: Profundidad vs. Magnitud (Bajo Dictamen Analítico) */}
              <div
                className="panel"
                style={{
                  padding: '22px',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                }}
                onClick={() => setActiveModal('scatter')}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setActiveModal('scatter')}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 750, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Correlación Geodinámica: Profundidad vs. Magnitud</span>
                    </h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      Dispersión de los eventos observados a lo largo del perfil de subducción peruano. Pulsa para ampliar.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-subtle">{scatterPoints.length} Puntos Observados</span>
                    <ExpandButton onClick={() => setActiveModal('scatter')} />
                  </div>
                </div>

                <div style={{ height: 185, width: '100%', pointerEvents: 'none' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light, rgba(255,255,255,0.06))" />
                      <XAxis
                        type="number"
                        dataKey="depth"
                        name="Profundidad"
                        unit=" km"
                        tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                        label={{ value: 'Profundidad focal (km)', position: 'insideBottom', offset: -12, fontSize: 11, fill: 'var(--text-muted)' }}
                      />
                      <YAxis
                        type="number"
                        dataKey="magnitude"
                        name="Magnitud"
                        tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                        label={{ value: 'Mw', angle: -90, position: 'insideLeft', offset: 12, fontSize: 11, fill: 'var(--text-muted)' }}
                      />
                      <ZAxis range={[28, 28]} />
                      <Scatter data={scatterPoints} fill={CHART_COLOR_CRITICAL} opacity={0.7} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '12px',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--border-light, var(--border))',
                    fontSize: '11.5px',
                    color: 'var(--text-muted)'
                  }}
                >
                  <span>Perfil tectónico: Fosa Perú-Chile hacia el interior continental (0–700 km).</span>
                  <span className="compact-chart-zoom-hint" style={{ pointerEvents: 'auto' }}>
                    <Maximize2 size={11} /> Clic para ampliar a pantalla completa
                  </span>
                </div>
              </div>
            </div>

            {/* Columna Lateral Derecha: DOCK DE DIAGRAMAS COMPACTOS (CLIC PARA AMPLIAR) */}
            <div className="compact-chart-dock">
              <div className="compact-chart-dock-title">
                <h3>Diagramas Analíticos</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Clic para ampliar</span>
              </div>

              {/* Diagrama 1: Frecuencia Diaria (Compacto) */}
              <div
                className="compact-chart-card"
                onClick={() => setActiveModal('daily')}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setActiveModal('daily')}
                aria-label="Ampliar diagrama de frecuencia temporal diaria"
              >
                <div className="compact-chart-card-header">
                  <div>
                    <h4>Frecuencia Diaria</h4>
                    <p>Evolución cronológica ({days} días)</p>
                  </div>
                  <ExpandButton onClick={() => setActiveModal('daily')} />
                </div>
                <div className="compact-chart-preview">
                  <ResponsiveContainer width="100%" height={125}>
                    <AreaChart data={data.daily} margin={{ top: 6, right: 6, bottom: 0, left: -24 }}>
                      <defs>
                        <linearGradient id="miniDailyGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLOR_PRIMARY} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={CHART_COLOR_PRIMARY} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" hide />
                      <YAxis allowDecimals={false} hide />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke={CHART_COLOR_PRIMARY}
                        strokeWidth={2}
                        fill="url(#miniDailyGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="compact-chart-footer">
                  <span>Pico: {peakDaily?.count || 0} evts/día</span>
                  <span className="compact-chart-zoom-hint">
                    <Maximize2 size={11} /> Clic para ampliar
                  </span>
                </div>
              </div>

              {/* Diagrama 2: Distribución de Magnitudes (Compacto) */}
              <div
                className="compact-chart-card"
                onClick={() => setActiveModal('magnitudes')}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setActiveModal('magnitudes')}
                aria-label="Ampliar histograma de magnitudes"
              >
                <div className="compact-chart-card-header">
                  <div>
                    <h4>Distribución de Magnitud</h4>
                    <p>Histograma por rangos de energía</p>
                  </div>
                  <ExpandButton onClick={() => setActiveModal('magnitudes')} />
                </div>
                <div className="compact-chart-preview">
                  <ResponsiveContainer width="100%" height={125}>
                    <BarChart data={data.magnitudes} margin={{ top: 6, right: 6, bottom: 0, left: -24 }}>
                      <XAxis dataKey="range" hide />
                      <YAxis allowDecimals={false} hide />
                      <Bar dataKey="count" fill={CHART_COLOR_ACCENT} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="compact-chart-footer">
                  <span>Moda: {dominantMagRange?.range || '—'}</span>
                  <span className="compact-chart-zoom-hint">
                    <Maximize2 size={11} /> Clic para ampliar
                  </span>
                </div>
              </div>

              {/* Diagrama 3: Estratificación de Profundidad (Compacto) */}
              <div
                className="compact-chart-card"
                onClick={() => setActiveModal('depths')}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setActiveModal('depths')}
                aria-label="Ampliar histograma de profundidad focal"
              >
                <div className="compact-chart-card-header">
                  <div>
                    <h4>Estratificación de Profundidad</h4>
                    <p>Frecuencia por rango hipocentral (km)</p>
                  </div>
                  <ExpandButton onClick={() => setActiveModal('depths')} />
                </div>
                <div className="compact-chart-preview">
                  <ResponsiveContainer width="100%" height={125}>
                    <BarChart data={data.depths} margin={{ top: 6, right: 6, bottom: 0, left: -24 }}>
                      <XAxis dataKey="range" hide />
                      <YAxis allowDecimals={false} hide />
                      <Bar dataKey="count" fill={CHART_COLOR_WARNING} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="compact-chart-footer">
                  <span>Moda: {dominantDepthRange?.range || '—'} km</span>
                  <span className="compact-chart-zoom-hint">
                    <Maximize2 size={11} /> Clic para ampliar
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* MODALES DE AMPLIACIÓN (ZOOM INTERACTIVO EN ALTA RESOLUCIÓN)        */}
          {/* ================================================================= */}

          {/* Modal 1: Frecuencia Diaria Ampliada */}
          <ExpandableModal
            isOpen={activeModal === 'daily'}
            onClose={() => setActiveModal(null)}
            title="Análisis Cronológico Detallado — Frecuencia Diaria de Eventos"
            subtitle={`Registro temporal en Perú · Ventana de ${days} días · Total: ${data.total} sismos`}
          >
            <div>
              <div style={{ height: 380, width: '100%', marginBottom: '20px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.daily} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                    <defs>
                      <linearGradient id="modalDailyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLOR_PRIMARY} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={CHART_COLOR_PRIMARY} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      minTickGap={24}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      label={{ value: 'Eventos/día', angle: -90, position: 'insideLeft', offset: 0, fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(val: any) => [`${val} eventos`, 'Frecuencia']}
                      labelFormatter={label => `Fecha: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Eventos"
                      stroke={CHART_COLOR_PRIMARY}
                      strokeWidth={2.5}
                      fill="url(#modalDailyGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  background: 'var(--surface-muted)',
                  padding: '16px',
                  borderRadius: 'var(--radius)'
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Total en el período</span>
                  <div style={{ fontSize: '18px', fontWeight: 800 }}>{data.total} eventos</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Tasa Promedio Diaria</span>
                  <div style={{ fontSize: '18px', fontWeight: 800 }}>{(data.total / days).toFixed(2)} / día</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Día con Mayor Actividad</span>
                  <div style={{ fontSize: '18px', fontWeight: 800 }}>
                    {peakDaily ? `${peakDaily.date} (${peakDaily.count})` : '—'}
                  </div>
                </div>
              </div>
            </div>
          </ExpandableModal>

          {/* Modal 2: Distribución de Magnitudes Ampliada */}
          <ExpandableModal
            isOpen={activeModal === 'magnitudes'}
            onClose={() => setActiveModal(null)}
            title="Histograma de Distribución Energética — Magnitudes Sísmicas"
            subtitle={`Conteo por intervalos de magnitud · Clasificación estándar según catálogo USGS`}
          >
            <div>
              <div style={{ height: 380, width: '100%', marginBottom: '20px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.magnitudes} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                    <XAxis dataKey="range" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      label={{ value: 'N° de eventos', angle: -90, position: 'insideLeft', offset: 0, fontSize: 12 }}
                    />
                    <Tooltip formatter={(val: any) => [`${val} eventos`, 'Frecuencia']} />
                    <Bar dataKey="count" name="Eventos" fill={CHART_COLOR_ACCENT} radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  background: 'var(--surface-muted)',
                  padding: '16px',
                  borderRadius: 'var(--radius)'
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Magnitud Promedio</span>
                  <div style={{ fontSize: '18px', fontWeight: 800 }}>{fmt(data.mean_magnitude, 2)} Mw</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Magnitud Pico</span>
                  <div style={{ fontSize: '18px', fontWeight: 800 }}>{fmt(data.max_magnitude)} Mw</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Rango Más Frecuente</span>
                  <div style={{ fontSize: '18px', fontWeight: 800 }}>{dominantMagRange?.range || '—'}</div>
                </div>
              </div>
            </div>
          </ExpandableModal>

          {/* Modal 3: Estratificación de Profundidad Ampliada */}
          <ExpandableModal
            isOpen={activeModal === 'depths'}
            onClose={() => setActiveModal(null)}
            title="Estratificación de Profundidad Hipocentral"
            subtitle={`Conteo por estratos de profundidad (km) · Margen continental peruano`}
          >
            <div>
              <div style={{ height: 380, width: '100%', marginBottom: '20px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.depths} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                    <XAxis dataKey="range" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      label={{ value: 'N° de eventos', angle: -90, position: 'insideLeft', offset: 0, fontSize: 12 }}
                    />
                    <Tooltip formatter={(val: any) => [`${val} eventos`, 'Frecuencia']} />
                    <Bar dataKey="count" name="Eventos" fill={CHART_COLOR_WARNING} radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  background: 'var(--surface-muted)',
                  padding: '16px',
                  borderRadius: 'var(--radius)'
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Profundidad Media</span>
                  <div style={{ fontSize: '18px', fontWeight: 800 }}>{fmt(data.mean_depth_km)} km</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Estrato Dominante</span>
                  <div style={{ fontSize: '18px', fontWeight: 800 }}>{dominantDepthRange?.range || '—'} km</div>
                </div>
              </div>
            </div>
          </ExpandableModal>

          {/* Modal 4: Dispersión Profundidad vs. Magnitud Ampliada */}
          <ExpandableModal
            isOpen={activeModal === 'scatter'}
            onClose={() => setActiveModal(null)}
            title="Diagrama de Dispersión: Profundidad Hipocentral vs. Magnitud"
            subtitle={`Correlación geofísica de eventos observados en Perú · Muestra de ${scatterPoints.length} puntos`}
          >
            <div>
              <div style={{ height: 400, width: '100%', marginBottom: '20px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 14, right: 26, bottom: 22, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                    <XAxis
                      type="number"
                      dataKey="depth"
                      name="Profundidad"
                      unit=" km"
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      label={{ value: 'Profundidad focal (km)', position: 'insideBottom', offset: -12, fontSize: 12 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="magnitude"
                      name="Magnitud"
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      label={{ value: 'Magnitud (Mw)', angle: -90, position: 'insideLeft', offset: 0, fontSize: 12 }}
                    />
                    <ZAxis range={[40, 40]} />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      formatter={(val: any, name: any) => [
                        name === 'Profundidad' ? `${val} km` : `M ${val}`,
                        String(name)
                      ]}
                    />
                    <Scatter
                      name="Eventos Sísmicos"
                      data={scatterPoints}
                      fill={CHART_COLOR_CRITICAL}
                      opacity={0.7}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              <div
                style={{
                  background: 'var(--surface-muted)',
                  padding: '14px 18px',
                  borderRadius: 'var(--radius)',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  lineHeight: '1.6'
                }}
              >
                <strong>Interpretación geodinámica:</strong> La dispersión permite visualizar sismos superficiales
                asociados al contacto de placas (fosa Perú-Chile) versus sismos intermedios y profundos producidos por la
                deformación interna de la placa de Nazca subducida (placa oceánica bajo el continente).
              </div>
            </div>
          </ExpandableModal>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VISTA: MAPA SÍSMICO GEORREFERENCIADO
// ---------------------------------------------------------------------------

type LeafletMap = {
  setView: (center: [number, number], zoom: number) => LeafletMap;
  remove: () => void;
  fitBounds: (bounds: [number, number][], options?: object) => void;
  invalidateSize: (options?: object) => void;
};
type LeafletLayer = {
  addTo: (map: LeafletMap) => LeafletLayer;
  bindPopup: (html: string) => LeafletLayer;
  on: (name: string, listener: (event?: unknown) => void) => LeafletLayer;
  remove: () => void;
};
type LeafletAPI = {
  map: (element: HTMLElement, options?: object) => LeafletMap;
  tileLayer: (url: string, options: object) => LeafletLayer;
  divIcon: (options: object) => unknown;
  marker: (latlng: [number, number], options: object) => LeafletLayer;
};

declare global {
  interface Window {
    L?: LeafletAPI;
  }
}

let leafletLoading: Promise<LeafletAPI> | undefined;

function addRemoteScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error('No disponible: ' + src));
    };
    document.head.appendChild(script);
  });
}

function loadLeaflet(): Promise<LeafletAPI> {
  if (window.L) return Promise.resolve(window.L);
  if (leafletLoading) return leafletLoading;
  leafletLoading = (async () => {
    if (!document.querySelector('link[data-sismo-leaflet]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
      css.dataset.sismoLeaflet = 'true';
      document.head.appendChild(css);
    }
    const urls = [
      'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
      'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    ];
    for (const url of urls) {
      try {
        await addRemoteScript(url);
        if (window.L) return window.L;
      } catch {
        /* probar el siguiente proveedor */
      }
    }
    throw new Error('No se pudo cargar la biblioteca de mapas.');
  })().catch(error => {
    leafletLoading = undefined;
    throw error;
  });
  return leafletLoading;
}

function LeafletCanvas({ items, onSelect }: { items: Point[]; onSelect: (p: Point) => void }) {
  const node = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layers = useRef<LeafletLayer[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [tilesReady, setTilesReady] = useState(false);
  const [retry, setRetry] = useState(0);

  const validItems = useMemo(() => items.filter(isValidPoint).map(normalizedPoint), [items]);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    setReady(false);
    setTilesReady(false);
    setLoadError('');

    loadLeaflet()
      .then(L => {
        if (cancelled || !node.current) return;
        const map = L.map(node.current, { scrollWheelZoom: false, zoomControl: true }).setView([-9.2, -75.1], 5);
        mapRef.current = map;
        let switched = false;
        const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '© OpenStreetMap contributors'
        });
        tiles.on('load', () => {
          if (!cancelled) setTilesReady(true);
        });
        tiles.on('tileerror', () => {
          if (switched || cancelled) return;
          switched = true;
          tiles.remove();
          const backup = L.tileLayer('https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 18,
            attribution: '© OpenStreetMap contributors · © CARTO'
          });
          backup.on('load', () => {
            if (!cancelled) setTilesReady(true);
          });
          backup.on('tileerror', () => {
            if (!cancelled)
              setLoadError('No se pudieron cargar las teselas del mapa. Comprueba tu conexión a la red.');
          });
          backup.addTo(map);
        });
        tiles.addTo(map);
        setReady(true);
        requestAnimationFrame(() => map.invalidateSize());
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => map.invalidateSize());
          resizeObserver.observe(node.current);
        }
      })
      .catch(e => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'No se pudo iniciar el mapa');
      });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      layers.current.forEach(layer => layer.remove());
      layers.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [retry]);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.L) return;
    const map = mapRef.current;
    const L = window.L;
    layers.current.forEach(layer => layer.remove());
    layers.current = [];
    const positions: [number, number][] = [];

    validItems.forEach(p => {
      const latlng: [number, number] = [p.lat, p.lon];
      positions.push(latlng);
      const mag = p.magnitude ?? 0;
      const severity = mag >= 6 ? 'high' : mag >= 5 ? 'mid' : 'low';
      const size = Math.max(18, Math.min(34, 18 + mag * 2));
      const icon = L.divIcon({
        className: 'sismo-epicenter-icon',
        html: `<span class="sismo-epicenter-dot sismo-epicenter-${severity}" style="--point-size:${size}px"><span class="sismo-epicenter-center"></span></span>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
      });
      const marker = L.marker(latlng, {
        icon,
        keyboard: true,
        title: `Sismo M${mag.toFixed(1)}: ${p.place || 'Ubicación no especificada'}`
      });
      marker
        .bindPopup(
          `<strong>${escapeHtml(p.place || 'Ubicación no especificada')}</strong><div>Magnitud ${mag.toFixed(
            1
          )} · ${p.depth_km ?? '—'} km</div><small>${escapeHtml(dateUTC(p.occurred_at))}</small>`
        )
        .on('click', () => onSelect(p))
        .addTo(map);
      layers.current.push(marker);
    });

    if (positions.length) map.fitBounds(positions, { padding: [65, 65], maxZoom: 8 });
    else map.setView([-9.2, -75.1], 5);
    map.invalidateSize();
  }, [items, onSelect, ready]);

  return (
    <div className="sismo-leaflet-container">
      <div className="sismo-map-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <strong>Cartografía de Epicentros Observados</strong>
          <StatusBadge type="observed" />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {validItems.length} epicentros geolocalizados · Pulsa un marcador para ver ficha técnica
          </span>
        </div>
        <button type="button" className="button button-subtle" onClick={() => setRetry(v => v + 1)}>
          Recargar mapa
        </button>
      </div>

      <div className="sismo-map-stage">
        <div
          ref={node}
          className="sismo-leaflet-map"
          aria-label="Mapa geográfico interactivo de epicentros observados en Perú"
          role="region"
        />
        {(!ready || (!tilesReady && !loadError)) && (
          <div className="sismo-map-overlay" role="status">
            Cargando cartografía geográfica…
          </div>
        )}
        {ready && !loadError && validItems.length === 0 && (
          <div className="sismo-map-overlay sismo-map-empty" role="status">
            La consulta no devolvió epicentros con coordenadas válidas para este filtro.
          </div>
        )}
        {loadError && (
          <div className="sismo-map-overlay sismo-map-failure" role="alert">
            <strong>Mapa no disponible</strong>
            <span>{loadError}</span>
            <button type="button" onClick={() => setRetry(v => v + 1)}>
              Intentar de nuevo
            </button>
          </div>
        )}
      </div>

      <div className="sismo-map-legend">
        <span className="sismo-dot sismo-dot-low" /> M &lt; 5.0
        <span className="sismo-dot sismo-dot-mid" style={{ marginLeft: '12px' }} /> M 5.0 – 5.9
        <span className="sismo-dot sismo-dot-high" style={{ marginLeft: '12px' }} /> M ≥ 6.0
        <span className="sismo-map-attribution">Fuente: USGS FDSN · Cartografía © OpenStreetMap contributors</span>
      </div>

    </div>
  );
}

export function SeismicMap() {
  const [days, setDays] = useState(30);
  const [minimum, setMinimum] = useState('');
  const [selected, setSelected] = useState<Point | null>(null);

  const [data, setData] = useState<MapResult | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setBusy(true);
    setError('');

    const params = new URLSearchParams({ days: String(days), peru_only: 'true', limit: '1000' });
    if (minimum.trim() !== '') params.set('min_magnitude', minimum);

    authorized<MapResult>('/api/v1/analytics/map?' + params.toString())
      .then(res => {
        if (active) setData(res);
      })
      .catch(e => {
        if (active) setError(e instanceof Error ? e.message : 'Error al cargar mapa');
      })
      .finally(() => {
        if (active) setBusy(false);
      });

    return () => {
      active = false;
    };
  }, [days, minimum]);

  const rawEvents = data?.items || [];
  const events = useMemo(() => rawEvents.filter(isValidPoint).map(normalizedPoint), [data]);

  // Métricas avanzadas para la barra lateral enriquecida
  const maxMag = useMemo(() => events.reduce((max, e) => Math.max(max, e.magnitude ?? 0), 0), [events]);
  const avgDepth = useMemo(() => {
    if (!events.length) return 0;
    const depths = events.map(e => e.depth_km).filter((d): d is number => d !== null);
    return depths.length ? Math.round(depths.reduce((a, b) => a + b, 0) / depths.length) : 0;
  }, [events]);

  const superficialCount = useMemo(() => events.filter(e => (e.depth_km ?? 0) < 60).length, [events]);
  const intermediateCount = useMemo(() => events.filter(e => (e.depth_km ?? 0) >= 60 && (e.depth_km ?? 0) <= 300).length, [events]);
  const deepCount = useMemo(() => events.filter(e => (e.depth_km ?? 0) > 300).length, [events]);

  function getMagSeverityClass(mag: number | null) {
    if (mag === null) return 'low';
    if (mag >= 5.5) return 'high';
    if (mag >= 4.2) return 'med';
    return 'low';
  }

  function getStratumText(depth: number | null) {
    if (depth === null) return 'Sin dato';
    if (depth < 60) return 'Superficial (<60 km)';
    if (depth <= 300) return 'Intermedio (60-300 km)';
    return 'Profundo (>300 km)';
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <div className="eyebrow">GEOVISUALIZACIÓN ESPACIAL / PERÚ</div>
          <h1>Cartografía de Epicentros Observados</h1>
          <p>
            Localización espacial de eventos sísmicos reportados por el catálogo USGS sobre cartografía OpenStreetMap.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className="segmented-control">
            {[7, 30, 90, 365].map(p => (
              <button
                key={p}
                type="button"
                className={`segment-btn ${days === p ? 'active' : ''}`}
                onClick={() => setDays(p)}
              >
                {p === 365 ? '1 Año' : `${p}D`}
              </button>
            ))}
          </div>

          <select
            value={minimum}
            onChange={e => setMinimum(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              fontSize: '12.5px',
              fontWeight: 600
            }}
          >
            <option value="">Todas</option>
            <option value="4.0">M ≥ 4.0</option>
            <option value="4.5">M ≥ 4.5</option>
            <option value="5.0">M ≥ 5.0</option>
          </select>
        </div>
      </div>

      {busy && <div className="sismo-loading" style={{ margin: '16px 0' }}>Consultando cartografía…</div>}
      {error && <div className="sismo-source-error" style={{ margin: '16px 0' }}>{error}</div>}

      <div className="sismo-map-layout">
        <section className="panel sismo-map">
          <LeafletCanvas items={events} onSelect={setSelected} />
        </section>

        <aside className="panel sismo-detail">
          {/* 1. FICHA TÉCNICA DEL EVENTO */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 750, margin: 0 }}>Ficha Técnica del Evento</h2>
            {selected && (
              <span className={`mag-badge ${getMagSeverityClass(selected.magnitude)}`}>
                M {selected.magnitude?.toFixed(1) ?? '—'}
              </span>
            )}
          </div>

          {selected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ paddingBottom: '8px', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Localidad / Epicentro</span>
                <strong style={{ fontSize: '14px', color: 'var(--text)' }}>
                  {selected.place || 'Ubicación sin toponimia'}
                </strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Profundidad</span>
                  <strong style={{ fontSize: '15px' }}>{selected.depth_km ?? '—'} km</strong>
                  <small style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                    {getStratumText(selected.depth_km)}
                  </small>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Coordenadas</span>
                  <code style={{ fontSize: '11px' }}>{selected.lat.toFixed(3)}°, {selected.lon.toFixed(3)}°</code>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Momento de ocurrencia</span>
                <strong style={{ fontSize: '12px' }}>
                  {new Date(selected.occurred_at).toLocaleDateString('es-PE', {
                    timeZone: 'America/Lima',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}{' '}
                  ·{' '}
                  {new Date(selected.occurred_at).toLocaleTimeString('es-PE', {
                    timeZone: 'America/Lima',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  })}{' '}
                  (Hora Lima)
                </strong>
                <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11px', marginTop: '1px' }}>
                  {new Date(selected.occurred_at).toISOString().replace('T', ' ').slice(0, 16)} UTC
                </small>
              </div>

              {selected.source_url && (
                <a
                  href={selected.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                  style={{ marginTop: '4px', textAlign: 'center', justifyContent: 'center' }}
                >
                  <span>Consultar FDSN Oficial</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          ) : (
            <div
              style={{
                background: 'var(--surface-muted)',
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border)',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '12px',
                lineHeight: '1.5'
              }}
            >
              <MapPin size={22} color="var(--primary)" style={{ margin: '0 auto 6px' }} />
              <div>Selecciona un marcador en el mapa o pulsa en la lista rápida inferior para ver los parámetros focales.</div>
            </div>
          )}

          {/* 2. RESUMEN DEL CUADRANTE EN PANTALLA */}
          <div className="map-sidebar-widget">
            <h3>
              <span>Inteligencia del Cuadrante</span>
              <span style={{ fontSize: '10px', textTransform: 'none', color: 'var(--primary)', fontWeight: 600 }}>En vivo</span>
            </h3>
            <div className="map-stats-grid">
              <div className="map-stat-card">
                <span>Sismos Mapeados</span>
                <strong>{events.length}</strong>
              </div>
              <div className="map-stat-card">
                <span>Pico Energético</span>
                <strong style={{ color: maxMag >= 5.0 ? 'var(--critical)' : 'var(--text)' }}>
                  M {maxMag.toFixed(1)}
                </strong>
              </div>
              <div className="map-stat-card">
                <span>Profundidad Media</span>
                <strong>{avgDepth} km</strong>
              </div>
              <div className="map-stat-card">
                <span>Ventana Activa</span>
                <strong>{days} días</strong>
              </div>
            </div>
          </div>

          {/* 3. ESTRATIFICACIÓN HIPOCENTRAL DEL CUADRANTE */}
          <div className="map-sidebar-widget">
            <h3>
              <span>Estratificación Hipocentral</span>
              <span style={{ fontSize: '10px', textTransform: 'none', color: 'var(--text-muted)' }}>USGS/IGP</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontWeight: 600 }}>
                  <span>Superficial (&lt;60 km)</span>
                  <span>{superficialCount} ({events.length ? ((superficialCount / events.length) * 100).toFixed(0) : 0}%)</span>
                </div>
                <div style={{ height: '6px', background: 'var(--surface)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${events.length ? (superficialCount / events.length) * 100 : 0}%`,
                      background: 'var(--mag-med)'
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontWeight: 600 }}>
                  <span>Intermedio (60–300 km)</span>
                  <span>{intermediateCount} ({events.length ? ((intermediateCount / events.length) * 100).toFixed(0) : 0}%)</span>
                </div>
                <div style={{ height: '6px', background: 'var(--surface)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${events.length ? (intermediateCount / events.length) * 100 : 0}%`,
                      background: 'var(--primary)'
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', fontWeight: 600 }}>
                  <span>Profundo (&gt;300 km)</span>
                  <span>{deepCount} ({events.length ? ((deepCount / events.length) * 100).toFixed(0) : 0}%)</span>
                </div>
                <div style={{ height: '6px', background: 'var(--surface)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${events.length ? (deepCount / events.length) * 100 : 0}%`,
                      background: 'var(--info)'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4. FEED RÁPIDO DE SISMOS MAPEADOS (CLIC PARA ENFOCAR) */}
          <div className="map-sidebar-widget" style={{ marginBottom: 0 }}>
            <h3>
              <span>Sismos en el Cuadrante</span>
              <span style={{ fontSize: '10px', textTransform: 'none', color: 'var(--text-muted)' }}>{events.length} totales</span>
            </h3>
            <div className="map-feed-list">
              {events.slice(0, 15).map(p => {
                const isSelected = selected?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`map-feed-item ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelected(p)}
                  >
                    <span
                      className={`mag-badge ${getMagSeverityClass(p.magnitude)}`}
                      style={{ minWidth: '42px', padding: '2px 6px', fontSize: '11px' }}
                    >
                      M {p.magnitude?.toFixed(1) ?? '—'}
                    </span>
                    <div className="map-feed-info">
                      <strong>{p.place || 'Epicentro sin nombre'}</strong>
                      <small>
                        {p.depth_km ?? '—'} km ·{' '}
                        {new Date(p.occurred_at).toLocaleDateString('es-PE', { month: 'short', day: '2-digit' })}
                      </small>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// Compatibilidad export MagnitudeDepthScatter para imports antiguos
export function MagnitudeDepthScatter() {
  return null;
}
