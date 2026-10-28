import { useState } from 'react';
import {
  BrainCircuit,
  Maximize2,
  ShieldCheck
} from 'lucide-react';
import { MLReproducible } from './MLReproducible';
import { authorized, session } from '../services/auth';
import { ExpandableModal, ExpandButton } from '../components/ExpandableModal';

type Metrics = { accuracy: number; balanced_accuracy: number; f1_macro: number };

type Experiment = {
  study: string;
  target: string;
  n_total: number;
  n_train: number;
  n_test: number;
  train_end_utc: string;
  test_start_utc: string;
  class_counts: Record<string, number>;
  excluded: Record<string, number>;
  split: string;
  features: string[];
  model: string;
  baseline: string;
  metrics: Metrics;
  baseline_metrics: Metrics;
  confusion_matrix: number[][];
  dataset_sha256: string;
  limitations: string[];
};

const fmt = (n: number) => `${(n * 100).toFixed(1)}%`;

export function MLLab() {
  const [activeTab, setActiveTab] = useState<'benchmarking' | 'versioned'>('benchmarking');
  const [days, setDays] = useState(365);
  const [peru, setPeru] = useState(true);
  const [threshold, setThreshold] = useState(4);
  const [data, setData] = useState<Experiment | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados de modales interactivos
  const [activeModal, setActiveModal] = useState<'matrix' | 'comparison' | null>(null);

  const allowed = Boolean(session.user?.permissions.includes('modelos.entrenar'));

  async function run() {
    setLoading(true);
    setError('');
    setData(null);
    try {
      const params = new URLSearchParams({
        days: String(days),
        peru_only: String(peru),
        threshold: String(threshold)
      });
      const result = await authorized<Experiment>('/api/v1/ml/experiments/evaluate?' + params.toString(), {
        method: 'POST'
      });
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo ejecutar el experimento');
    } finally {
      setLoading(false);
    }
  }

  // Celdas de la matriz de confusión si están disponibles
  const cm = data?.confusion_matrix || [[0, 0], [0, 0]];
  const tn = cm[0]?.[0] ?? 0;
  const fp = cm[0]?.[1] ?? 0;
  const fn = cm[1]?.[0] ?? 0;
  const tp = cm[1]?.[1] ?? 0;

  return (
    <div>
      {/* Encabezado Principal */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">INTELIGENCIA ARTIFICIAL RETROSPECTIVA · LAB DE MODELOS</div>
          <h1>Evaluación de Machine Learning y Benchmarking</h1>
          <p>
            Entrenamiento y prueba temporal sobre sismos ya observados. Los diagramas y matrices son compactos;
            pulsa sobre ellos para abrir su vista expandida.
          </p>
        </div>

        {/* Selector de Pestañas de Flujo */}
        <div className="segmented-control" role="group" aria-label="Módulos de Machine Learning">
          <button
            type="button"
            className={`segment-btn ${activeTab === 'benchmarking' ? 'active' : ''}`}
            onClick={() => setActiveTab('benchmarking')}
          >
            <BrainCircuit size={14} />
            <span>Benchmarking Rápido</span>
          </button>
          <button
            type="button"
            className={`segment-btn ${activeTab === 'versioned' ? 'active' : ''}`}
            onClick={() => setActiveTab('versioned')}
          >
            <ShieldCheck size={14} />
            <span>Laboratorio Versionado (SHA-256)</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* PESTAÑA 1: BENCHMARKING RETROSPECTIVO RÁPIDO                         */}
      {/* =================================================================== */}
      {activeTab === 'benchmarking' && (
        <div>
          {/* Barra de Filtros Segmentada */}
          <div className="filter-bar" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                Período Histórico
                <select
                  value={days}
                  onChange={e => setDays(Number(e.target.value))}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    fontSize: '12.5px',
                    fontWeight: 600
                  }}
                >
                  <option value={90}>90 días</option>
                  <option value={365}>1 año (365 días)</option>
                  <option value={730}>2 años (730 días)</option>
                  <option value={1825}>5 años (1825 días)</option>
                </select>
              </label>

              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                Cobertura Geográfica
                <select
                  value={peru ? 'pe' : 'all'}
                  onChange={e => setPeru(e.target.value === 'pe')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    fontSize: '12.5px',
                    fontWeight: 600
                  }}
                >
                  <option value="pe">Caja geográfica Perú</option>
                  <option value="all">Catálogo global completo</option>
                </select>
              </label>

              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                Umbral de Clasificación
                <select
                  value={threshold}
                  onChange={e => setThreshold(Number(e.target.value))}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    fontSize: '12.5px',
                    fontWeight: 600
                  }}
                >
                  <option value={3}>M ≥ 3.0</option>
                  <option value={4}>M ≥ 4.0</option>
                  <option value={5}>M ≥ 5.0</option>
                </select>
              </label>
            </div>

            {/* Botón de Ejecución */}
            <div style={{ alignSelf: 'flex-end' }}>
              {!allowed ? (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Requiere permiso <code>modelos.entrenar</code>
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={loading}
                  onClick={run}
                  style={{ minHeight: '38px' }}
                >
                  <BrainCircuit size={15} />
                  <span>{loading ? 'Entrenando y evaluando…' : 'Ejecutar Evaluación Retrospectiva'}</span>
                </button>
              )}
            </div>
          </div>

          {error && (
            <div
              className="sismo-source-error"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                margin: '16px 0',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <div>
                <strong>
                  {error.toLowerCase().includes('token') || error.toLowerCase().includes('autenticado')
                    ? 'Sesión no activa o expirada'
                    : 'Error de evaluación:'}
                </strong>
                <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                  {error.toLowerCase().includes('token') || error.toLowerCase().includes('autenticado')
                    ? 'Tu sesión requiere autenticación activa para entrenar modelos. Inicia sesión nuevamente.'
                    : error}
                </p>
              </div>
              {(error.toLowerCase().includes('token') || error.toLowerCase().includes('autenticado')) && (
                <a href="/login" className="btn btn-outline btn-sm" style={{ flexShrink: 0, marginLeft: '16px' }}>
                  Iniciar Sesión
                </a>
              )}
            </div>
          )}

          {!data && !loading && (
            <div
              className="enterprise-panel"
              style={{
                padding: '36px',
                textAlign: 'center',
                background: 'linear-gradient(180deg, var(--surface) 0%, var(--surface-muted) 100%)'
              }}
            >
              <BrainCircuit size={36} color="var(--primary)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 750, margin: '0 0 6px 0' }}>
                Benchmarking Cronológico Independiente (80/20)
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '620px', margin: '0 auto 18px', lineHeight: '1.6' }}>
                Evalúa si un modelo Random Forest entrenado en sismos anteriores es capaz de generalizar sobre el 20%
                cronológico posterior sin fuga de características objetivo, contrastándolo contra un comparador basal.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={loading || !allowed}
                onClick={run}
              >
                <BrainCircuit size={15} />
                <span>Iniciar Evaluación Retrospectiva</span>
              </button>
            </div>
          )}

      {/* Resultados de Evaluación */}
      {data && (
        <>
          {/* Tarjetas KPI Superiores */}
          <div className="sismo-metrics" style={{ marginTop: '20px' }}>
            <article className="kpi-card">
              <span>Muestra Válida</span>
              <strong>{data.n_total.toLocaleString()}</strong>
              <small>Filtrado sin fuga</small>
            </article>
            <article className="kpi-card">
              <span>Entrenamiento</span>
              <strong>{data.n_train.toLocaleString()}</strong>
              <small>80% cronológico previo</small>
            </article>
            <article className="kpi-card">
              <span>Prueba Temporal</span>
              <strong>{data.n_test.toLocaleString()}</strong>
              <small>20% cronológico posterior</small>
            </article>
            <article className="kpi-card">
              <span>F1 Macro (Test)</span>
              <strong style={{ color: 'var(--primary)' }}>{fmt(data.metrics.f1_macro)}</strong>
              <small>vs Basal: {fmt(data.baseline_metrics.f1_macro)}</small>
            </article>
          </div>

          {/* Grid Principal: Desglose Técnico (Izquierda) + Dock de Diagramas Compactos (Derecha) */}
          <div className="analytics-layout">
            {/* Columna Izquierda: Parámetros del Experimento y Trazabilidad */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="panel" style={{ padding: '22px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 750, margin: '0 0 12px 0' }}>
                  Metodología y Partición Cronológica
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', margin: '0 0 16px 0' }}>
                  El experimento utiliza una división <strong>{data.split}</strong> para garantizar que el modelo no
                  aprenda de eventos futuros. No existe fuga de datos (data leakage): las variables de entrada son
                  estrictamente las coordenadas geodésicas y la profundidad focal.
                </p>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    fontSize: '12.5px'
                  }}
                >
                  <div style={{ background: 'var(--surface-muted)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Modelo Evaluado</span>
                    <strong>{data.model}</strong>
                  </div>
                  <div style={{ background: 'var(--surface-muted)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Referencia Basal</span>
                    <strong>{data.baseline}</strong>
                  </div>
                  <div style={{ background: 'var(--surface-muted)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Corte de Entrenamiento</span>
                    <strong>{data.train_end_utc.slice(0, 10)}</strong>
                  </div>
                  <div style={{ background: 'var(--surface-muted)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Inicio de Prueba</span>
                    <strong>{data.test_start_utc.slice(0, 10)}</strong>
                  </div>
                </div>
              </div>

              {/* Integridad Criptográfica del Dataset */}
              <div className="panel" style={{ padding: '22px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 750, margin: '0 0 8px 0' }}>
                  Integridad SHA-256 de las Observaciones
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
                  Huella digital criptográfica inmutable calculada sobre el conjunto de entrenamiento y test:
                </p>
                <div
                  style={{
                    background: 'var(--surface-muted)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    wordBreak: 'break-all',
                    border: '1px solid var(--border)'
                  }}
                >
                  {data.dataset_sha256}
                </div>
              </div>
            </div>

            {/* Columna Derecha: DOCK DE DIAGRAMAS COMPACTOS (CLIC PARA AMPLIAR) */}
            <div className="compact-chart-dock">
              <div className="compact-chart-dock-title">
                <h3>Diagramas del Modelo</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Clic para ampliar</span>
              </div>

              {/* Diagrama 1: Matriz de Confusión (Compacta) */}
              <div
                className="compact-chart-card"
                onClick={() => setActiveModal('matrix')}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setActiveModal('matrix')}
                aria-label="Ampliar matriz de confusión"
              >
                <div className="compact-chart-card-header">
                  <div>
                    <h4>Matriz de Confusión</h4>
                    <p>Conjunto de test ({data.n_test} sismos)</p>
                  </div>
                  <ExpandButton onClick={() => setActiveModal('matrix')} />
                </div>

                {/* Previsualización Mini de la Matriz 2x2 */}
                <div className="confusion-matrix-mini">
                  <div className="matrix-cell-mini matrix-cell-tn">
                    <strong>{tn}</strong>
                    <span>Verdaderos Neg</span>
                  </div>
                  <div className="matrix-cell-mini matrix-cell-fp">
                    <strong>{fp}</strong>
                    <span>Falsos Pos</span>
                  </div>
                  <div className="matrix-cell-mini matrix-cell-fn">
                    <strong>{fn}</strong>
                    <span>Falsos Neg</span>
                  </div>
                  <div className="matrix-cell-mini matrix-cell-tp">
                    <strong>{tp}</strong>
                    <span>Verdaderos Pos</span>
                  </div>
                </div>

                <div className="compact-chart-footer">
                  <span>Exactitud: {fmt(data.metrics.accuracy)}</span>
                  <span className="compact-chart-zoom-hint">
                    <Maximize2 size={11} /> Clic para ampliar
                  </span>
                </div>
              </div>

              {/* Diagrama 2: Modelo vs. Baseline (Compacto) */}
              <div
                className="compact-chart-card"
                onClick={() => setActiveModal('comparison')}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setActiveModal('comparison')}
                aria-label="Ampliar comparativa con modelo basal"
              >
                <div className="compact-chart-card-header">
                  <div>
                    <h4>Modelo vs. Referencia</h4>
                    <p>Contraste frente a estimador basal</p>
                  </div>
                  <ExpandButton onClick={() => setActiveModal('comparison')} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '8px 0' }}>
                  {(['f1_macro', 'balanced_accuracy'] as const).map(k => {
                    const diff = data.metrics[k] - data.baseline_metrics[k];
                    const isBetter = diff > 0;
                    return (
                      <div
                        key={k}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'var(--surface-muted)',
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '11.5px'
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{k === 'f1_macro' ? 'F1 Macro' : 'Bal. Accuracy'}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700 }}>{fmt(data.metrics[k])}</span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              color: isBetter ? '#059669' : '#dc2626'
                            }}
                          >
                            {isBetter ? `+${(diff * 100).toFixed(1)}%` : `${(diff * 100).toFixed(1)}%`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="compact-chart-footer">
                  <span>Algoritmo: {data.model}</span>
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

          {/* Modal 1: Matriz de Confusión Ampliada */}
          <ExpandableModal
            isOpen={activeModal === 'matrix'}
            onClose={() => setActiveModal(null)}
            title="Matriz de Confusión Detallada — Evaluación de Test Temporal"
            subtitle={`Clasificación binaria en umbral M ≥ ${threshold} · Partición temporal independiente de ${data.n_test} eventos`}
          >
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  marginBottom: '24px'
                }}
              >
                <div
                  style={{
                    background: 'rgba(14, 165, 233, 0.1)',
                    border: '1px solid rgba(14, 165, 233, 0.3)',
                    borderRadius: 'var(--radius)',
                    padding: '20px',
                    textAlign: 'center'
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>
                    Verdaderos Negativos (TN)
                  </span>
                  <div style={{ fontSize: '36px', fontWeight: 800, margin: '6px 0', color: '#0369a1' }}>{tn}</div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                    Sismos de magnitud &lt; {threshold} clasificados correctamente.
                  </p>
                </div>

                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: 'var(--radius)',
                    padding: '20px',
                    textAlign: 'center'
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>
                    Falsos Positivos (FP)
                  </span>
                  <div style={{ fontSize: '36px', fontWeight: 800, margin: '6px 0', color: '#991b1b' }}>{fp}</div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                    Sismos menores estimados erróneamente como ≥ {threshold}.
                  </p>
                </div>

                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: 'var(--radius)',
                    padding: '20px',
                    textAlign: 'center'
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>
                    Falsos Negativos (FN)
                  </span>
                  <div style={{ fontSize: '36px', fontWeight: 800, margin: '6px 0', color: '#991b1b' }}>{fn}</div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                    Sismos mayores pasados por alto por el clasificador.
                  </p>
                </div>

                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: 'var(--radius)',
                    padding: '20px',
                    textAlign: 'center'
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#065f46', textTransform: 'uppercase' }}>
                    Verdaderos Positivos (TP)
                  </span>
                  <div style={{ fontSize: '36px', fontWeight: 800, margin: '6px 0', color: '#065f46' }}>{tp}</div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                    Sismos de magnitud ≥ {threshold} clasificados con acierto.
                  </p>
                </div>
              </div>

              {/* Tabla de Métricas Diagnósticas Derivadas */}
              <div
                style={{
                  background: 'var(--surface-muted)',
                  padding: '18px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)'
                }}
              >
                <h4 style={{ fontSize: '13px', fontWeight: 750, margin: '0 0 10px 0' }}>
                  Desglose de Métricas Diagnósticas
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Exactitud Global</span>
                    <strong style={{ display: 'block', fontSize: '16px' }}>{fmt(data.metrics.accuracy)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Balanced Accuracy</span>
                    <strong style={{ display: 'block', fontSize: '16px' }}>{fmt(data.metrics.balanced_accuracy)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>F1-Score Macro</span>
                    <strong style={{ display: 'block', fontSize: '16px', color: 'var(--primary)' }}>
                      {fmt(data.metrics.f1_macro)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </ExpandableModal>

          {/* Modal 2: Comparativa Completa con el Baseline */}
          <ExpandableModal
            isOpen={activeModal === 'comparison'}
            onClose={() => setActiveModal(null)}
            title="Contraste de Desempeño: Modelo vs. Estimador Basal Simple"
            subtitle="Validación contra heurística simple para descartar sobreajuste y verificar aprendizaje real"
          >
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Métrica de Evaluación</th>
                    <th style={{ padding: '10px 12px' }}>{data.model}</th>
                    <th style={{ padding: '10px 12px' }}>{data.baseline}</th>
                    <th style={{ padding: '10px 12px' }}>Delta / Mejora Relativa</th>
                  </tr>
                </thead>
                <tbody>
                  {(['accuracy', 'balanced_accuracy', 'f1_macro'] as const).map(k => {
                    const diff = data.metrics[k] - data.baseline_metrics[k];
                    const isPositive = diff > 0;
                    return (
                      <tr key={k} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '12px', fontWeight: 600 }}>{k.replaceAll('_', ' ').toUpperCase()}</td>
                        <td style={{ padding: '12px', fontWeight: 700, color: 'var(--primary)' }}>
                          {fmt(data.metrics[k])}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                          {fmt(data.baseline_metrics[k])}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span
                            className={`badge ${isPositive ? 'badge-success' : 'badge-neutral'}`}
                            style={{ fontWeight: 700 }}
                          >
                            {isPositive ? `+${(diff * 100).toFixed(1)}%` : `${(diff * 100).toFixed(1)}%`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

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
                <strong>Nota metodológica:</strong> Un estimador basal representa el rendimiento alcanzable por una
                regla ingenua (ej. predecir siempre la clase mayoritaria). La superioridad frente al basal confirma que
                el modelo extrae patrones reales de los datos de entrenamiento sin recurrir a suposiciones triviales.
              </div>
            </div>
          </ExpandableModal>
        </>
      )}
        </div>
      )}

      {/* =================================================================== */}
      {/* PESTAÑA 2: LABORATORIO VERSIONADO INMUTABLE (SHA-256)               */}
      {/* =================================================================== */}
      {activeTab === 'versioned' && (
        <div>
          <MLReproducible />
        </div>
      )}
    </div>
  );
}
