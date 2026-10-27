import { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { authorized, session } from '../services/auth';
import './MLReproducible.css';
import { MLCompare } from './MLCompare';
import { ExpandableModal } from '../components/ExpandableModal';

type Dataset = {
  id: string;
  snapshot_id: string;
  sha256: string;
  row_count: number;
  quality: Record<string, unknown>;
  created_at: string;
};

type Study = {
  id: string;
  dataset_id: string;
  kind: string;
  algorithm: string;
  metrics: { model: Record<string, number>; baseline: Record<string, number> };
  created_at: string;
};

type Window = {
  window: number;
  n_train: number;
  n_test: number;
  train_end_utc: string;
  test_start_utc: string;
  model: Record<string, number>;
  baseline: Record<string, number>;
  class_counts?: { train: Record<string, number>; test: Record<string, number> };
};

type Temporal = {
  status?: string;
  reason?: string;
  method?: string;
  n_evaluated?: number;
  n_requested?: number;
  model_summary?: Record<string, { mean: number; std: number }>;
  baseline_summary?: Record<string, { mean: number; std: number }>;
  folds?: Window[];
  omitted?: { window: number; reason: string }[];
};

type Detail = {
  id: string;
  metrics: Study['metrics'];
  results: {
    kind: string;
    question?: string;
    features: string[];
    disclaimer: string;
    train_end_utc: string;
    test_start_utc: string;
    baseline_name?: string;
    observations: { at: string; actual: number; estimated: number }[];
    temporal_validation?: Temporal;
    per_class_metrics?: { class: string; precision: number; recall: number; f1: number; support: number }[];
    class_counts?: { train: Record<string, number>; test: Record<string, number> };
    library_versions?: Record<string, string>;
    other_baselines?: Record<string, Record<string, number>>;
    residual_percentiles_test?: { p05: number; p95: number };
    residual_note?: string;
  };
  limitations: { items: string[] };
};

type VerifyResponse = {
  status: 'identical' | 'different' | 'environment_changed';
  identical: boolean;
  metrics_match: boolean;
  results_match: boolean;
  dataset_id: string;
  dataset_sha256: string;
  study_id: string;
  kind: string;
  stored_metrics: { model: Record<string, number>; baseline: Record<string, number> };
  recalculated_metrics: { model: Record<string, number>; baseline: Record<string, number> };
  disclaimer: string;
  reason?: string;
};

const labels: Record<string, string> = {
  regression_simple: 'Regresión simple',
  regression_multiple: 'Regresión múltiple',
  classification: 'Clasificación'
};

const metricLabels: Record<string, string> = {
  mae: 'Error medio (MAE)',
  rmse: 'Error cuadrático (RMSE)',
  r2: 'Ajuste (R²)',
  f1_macro: 'F1 macro',
  precision_macro: 'Precisión macro',
  recall_macro: 'Recall macro',
  accuracy: 'Exactitud'
};

function metricName(k: string) {
  return metricLabels[k.toLowerCase()] || k.replaceAll('_', ' ');
}

function goodDirection(k: string) {
  return !['mae', 'rmse', 'mse', 'log_loss'].includes(k.toLowerCase());
}

function fmt(n: number | undefined) {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(3) : '—';
}

function outcome(d: Detail) {
  const m = d.metrics?.model || {},
    b = d.metrics?.baseline || {};
  const preferred = d.results.kind === 'classification' ? ['f1_macro', 'f1', 'accuracy'] : ['mae', 'rmse', 'r2'];
  const key = preferred.find(k => typeof m[k] === 'number' && typeof b[k] === 'number');
  if (!key)
    return {
      title: 'Sin comparación suficiente',
      message: 'Faltan métricas equivalentes del modelo y del baseline. Revisa el detalle técnico.',
      state: 'neutral'
    };
  const delta = m[key] - b[key];
  const better = goodDirection(key) ? delta > 1e-9 : delta < -1e-9;
  const same = Math.abs(delta) <= 1e-9;
  return {
    title: same
      ? 'Rendimiento similar al baseline'
      : better
      ? 'Supera al baseline en la métrica principal'
      : 'No supera al baseline en la métrica principal',
    message: `${metricName(key)}: modelo ${fmt(m[key])} · referencia ${fmt(b[key])}. ${
      better
        ? 'Esta comparación es favorable, pero no valida su uso para predecir sismos.'
        : same
        ? 'No se aprecia ventaja con esta medida.'
        : 'En esta evaluación, el comparador sencillo tuvo mejor resultado.'
    }`,
    state: better ? 'positive' : same ? 'neutral' : 'caution'
  };
}

export function MLReproducible() {
  const [snapshot, setSnapshot] = useState('');
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [studies, setStudies] = useState<Study[]>([]);
  const [selected, setSelected] = useState('');
  const [kind, setKind] = useState('regression_simple');
  const [threshold, setThreshold] = useState(4);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [technical, setTechnical] = useState(false);

  // Estados de Certificación de Reproducibilidad Criptográfica
  const [certifying, setCertifying] = useState(false);
  const [certResult, setCertResult] = useState<VerifyResponse | null>(null);
  const [showCertModal, setShowCertModal] = useState(false);

  const allowed = Boolean(session.user?.permissions.includes('modelos.entrenar'));

  async function refresh() {
    try {
      const [d, s] = await Promise.all([
        authorized<Dataset[]>('/api/v1/ml/datasets/versions'),
        authorized<Study[]>('/api/v1/ml/studies')
      ]);
      setDatasets(d);
      setStudies(s);
      setSelected(prev => (d.some(x => x.id === prev) ? prev : d[0]?.id || ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar el historial');
    }
  }

  useEffect(() => {
    if (allowed) void refresh();
  }, [allowed]);

  async function create() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const p = new URLSearchParams({ snapshot_id: snapshot.trim() });
      const d = await authorized<{ id: string; reused: boolean }>('/api/v1/ml/datasets/from-snapshot?' + p, {
        method: 'POST'
      });
      await refresh();
      setSelected(d.id);
      setNotice(d.reused ? 'Se seleccionó un dataset ya versionado.' : 'Dataset creado y guardado; ya puedes entrenar.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible crear el dataset');
    } finally {
      setBusy(false);
    }
  }

  async function show(id: string) {
    setError('');
    try {
      setDetail(await authorized<Detail>('/api/v1/ml/studies/' + id));
      setTechnical(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible abrir el resultado');
    }
  }

  async function train() {
    if (!selected) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const p = new URLSearchParams({ dataset_id: selected, kind, threshold: String(threshold) });
      const s = await authorized<{ id: string }>('/api/v1/ml/studies?' + p, { method: 'POST' });
      await refresh();
      await show(s.id);
      setNotice('Experimento terminado y guardado. Revisa el resumen de resultados.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible entrenar');
    } finally {
      setBusy(false);
    }
  }

  async function certifyStudy(studyId: string) {
    setCertifying(true);
    setError('');
    try {
      const res = await authorized<VerifyResponse>(`/api/v1/ml/studies/${studyId}/verify-reproducibility`, {
        method: 'POST'
      });
      setCertResult(res);
      setShowCertModal(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo verificar la reproducibilidad');
    } finally {
      setCertifying(false);
    }
  }

  const ds = datasets.find(d => d.id === selected);
  const recent = detail ? outcome(detail) : null;
  const temporal = detail?.results.temporal_validation;

  return (
    <section className="panel ml-simple" aria-label="Laboratorio de Machine Learning">
      <header className="ml-simple-header">
        <div>
          <span className="ml-kicker">SISMOIA / LABORATORIO DE MODELOS</span>
          <h2>Machine Learning Reproducible y Versionado</h2>
          <p>
            Análisis retrospectivo basado en snapshots inmutables con hashes SHA-256. Garantía de auditoría y
            reproducibilidad científica bit-for-bit.
          </p>
        </div>
        <span className="ml-type-chip">AUDITORÍA SHA-256</span>
      </header>

      {!allowed ? (
        <p role="status">Tu rol no tiene permiso para crear datasets ni entrenar modelos.</p>
      ) : (
        <>
          <div className="ml-guide" aria-label="Proceso del laboratorio">
            <span>1 · Congelar Datos (SHA-256)</span>
            <span>2 · Entrenar Modelo</span>
            <span>3 · Validar Resultados</span>
            <span>4 · Certificar Reproducibilidad</span>
          </div>

          <div className="ml-simple-columns">
            <article className="ml-step">
              <h3>
                <span className="ml-step-number">1</span> Preparar datos congelados
              </h3>
              <p>Usa el identificador de una captura USGS para generar un dataset inmutable.</p>
              <label htmlFor="ml-snapshot">ID del snapshot capturado</label>
              <div className="ml-inline">
                <input
                  id="ml-snapshot"
                  value={snapshot}
                  onChange={e => setSnapshot(e.target.value)}
                  placeholder="Pega el UUID del snapshot"
                />
                <button
                  type="button"
                  className="button"
                  onClick={() => void create()}
                  disabled={busy || !snapshot.trim()}
                >
                  Versionar
                </button>
              </div>
              <label htmlFor="ml-dataset">Dataset para entrenar</label>
              <select
                id="ml-dataset"
                value={selected}
                onChange={e => {
                  setSelected(e.target.value);
                  setDetail(null);
                }}
              >
                {datasets.length === 0 ? (
                  <option value="">Primero crea un dataset</option>
                ) : (
                  datasets.map(d => (
                    <option value={d.id} key={d.id}>
                      {d.id.slice(0, 8)} · {d.row_count} eventos válidos
                    </option>
                  ))
                )}
              </select>
              <p className="ml-support">
                {ds
                  ? `Seleccionado: ${ds.row_count} observaciones. Hash SHA-256: ${ds.sha256?.slice(0, 16)}…`
                  : 'Requiere al menos 40 observaciones válidas sin duplicados.'}
              </p>
            </article>

            <article className="ml-step">
              <h3>
                <span className="ml-step-number">2</span> Entrenar modelo retrospectivo
              </h3>
              <p>Selecciona la tarea a modelar con partición temporal 80/20.</p>
              <label htmlFor="ml-kind">Tarea analítica</label>
              <select id="ml-kind" value={kind} onChange={e => setKind(e.target.value)}>
                <option value="regression_simple">Regresión simple · profundidad → magnitud</option>
                <option value="regression_multiple">Regresión múltiple · coordenadas y profundidad → magnitud</option>
                <option value="classification">Clasificación · rango de magnitud</option>
              </select>
              {kind === 'classification' && (
                <>
                  <label htmlFor="ml-threshold">Umbral de clasificación (Mw)</label>
                  <input
                    id="ml-threshold"
                    type="number"
                    min="0"
                    max="9"
                    step="0.1"
                    value={threshold}
                    onChange={e => setThreshold(Number(e.target.value))}
                  />
                </>
              )}
              <button
                type="button"
                className="button button-primary ml-train"
                disabled={busy || !selected}
                onClick={() => void train()}
              >
                {busy ? 'Entrenando…' : 'Entrenar y Guardar Estudio'}
              </button>
              <p className="ml-support">
                Entrenamiento y prueba temporal cronológica sin fuga de características objetivo.
              </p>
            </article>
          </div>

          {notice && (
            <p className="ml-feedback" role="status">
              {notice}
            </p>
          )}
          {error && (
            <div
              className="sismo-source-error"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                margin: '12px 0',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <div>
                <strong>
                  {error.toLowerCase().includes('token') || error.toLowerCase().includes('autenticado')
                    ? 'Sesión no activa o expirada'
                    : 'Aviso del laboratorio:'}
                </strong>
                <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                  {error.toLowerCase().includes('token') || error.toLowerCase().includes('autenticado')
                    ? 'Tu sesión requiere autenticación activa para consultar o entrenar datasets. Inicia sesión nuevamente para continuar.'
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

          <article className="ml-step ml-history">
            <h3>
              <span className="ml-step-number">3</span> Estudios Guardados en el Registro
            </h3>
            <p>Selecciona un estudio previo para inspeccionar sus métricas y certificar reproducibilidad.</p>
            {studies.length === 0 ? (
              <p role="status">Aún no hay experimentos. Versiona un dataset y entrena un modelo.</p>
            ) : (
              <div className="ml-history-list">
                {studies.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => void show(s.id)}
                    className={'ml-history-item' + (detail?.id === s.id ? ' active' : '')}
                  >
                    <strong>{labels[s.kind] || s.kind}</strong>
                    <span>{new Date(s.created_at).toLocaleString('es-PE')}</span>
                    <small>
                      {s.algorithm} · {s.id.slice(0, 8)}
                    </small>
                    <b>Ver resultado</b>
                  </button>
                ))}
              </div>
            )}
          </article>

          <MLCompare studies={studies} />

          {/* Ficha del Estudio Guardado Seleccionado */}
          {detail && recent && (
            <article className="ml-results" aria-label="Resultado del experimento">
              <div className="ml-results-title">
                <div>
                  <span className="ml-kicker">ESTUDIO REGISTRADO</span>
                  <h3>Diagnóstico del Modelo: {labels[detail.results.kind] || detail.results.kind}</h3>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="button button-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    disabled={certifying}
                    onClick={() => void certifyStudy(detail.id)}
                  >
                    <ShieldCheck size={16} />
                    {certifying ? 'Auditando…' : 'Certificar Reproducibilidad SHA-256'}
                  </button>
                  <span className="ml-type-chip">INMUTABLE</span>
                </div>
              </div>

              <div className={'ml-verdict ' + recent.state}>
                <strong>{recent.title}</strong>
                <p>{recent.message}</p>
              </div>

              <div className="ml-check-grid">
                <div>
                  <strong>1. ¿Supera al baseline?</strong>
                  <p>{recent.title}. Estimador basal: {detail.results.baseline_name || 'Dummy'}.</p>
                </div>
                <div>
                  <strong>2. ¿Se probó con datos cronológicos posteriores?</strong>
                  <p>Sí, corte temporal en {detail.results.train_end_utc.slice(0, 10)}. Prueba desde {detail.results.test_start_utc.slice(0, 10)}.</p>
                </div>
                <div>
                  <strong>3. ¿Validación temporal multi-ventana?</strong>
                  <p>
                    {temporal?.status === 'not_evaluable'
                      ? `No evaluable: ${temporal.reason}`
                      : temporal?.n_evaluated
                      ? `${temporal.n_evaluated} ventanas temporales evaluadas sin fuga.`
                      : 'Evaluación única 80/20 completada.'}
                  </p>
                </div>
                <div>
                  <strong>4. ¿Límites reconocidos?</strong>
                  <p>{detail.limitations.items[0] || 'Análisis retrospectivo; no predice eventos futuros.'}</p>
                </div>
              </div>

              <button
                type="button"
                className="button ml-details-toggle"
                aria-expanded={technical}
                onClick={() => setTechnical(x => !x)}
              >
                {technical ? 'Ocultar detalles técnicos' : 'Ver métricas completas y trazabilidad'}
              </button>

              {technical && (
                <div className="ml-tech">
                  <h4>Comparación detallada con el baseline</h4>
                  <p>
                    {detail.results.question || 'Análisis retrospectivo'} · Referencia:{' '}
                    {detail.results.baseline_name || 'Modelo basal'}
                  </p>
                  <div className="ml-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Métrica</th>
                          <th>Modelo</th>
                          <th>Referencia</th>
                          <th>Dirección Favorable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(detail.metrics.model || {}).map(([key, val]) => (
                          <tr key={key}>
                            <th scope="row">{metricName(key)}</th>
                            <td>{fmt(val)}</td>
                            <td>{fmt(detail.metrics.baseline[key])}</td>
                            <td>{goodDirection(key) ? 'Mayor' : 'Menor'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {detail.results.per_class_metrics && (
                    <>
                      <h4>Rendimiento por clase (clasificación binaria)</h4>
                      <div className="ml-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Clase</th>
                              <th>Precisión</th>
                              <th>Recall</th>
                              <th>F1</th>
                              <th>Muestra (N)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.results.per_class_metrics.map(c => (
                              <tr key={c.class}>
                                <td>{c.class === '1' ? 'En o sobre umbral' : 'Debajo de umbral'}</td>
                                <td>{fmt(c.precision)}</td>
                                <td>{fmt(c.recall)}</td>
                                <td>{fmt(c.f1)}</td>
                                <td>{c.support}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  <h4>Validación por ventanas temporales</h4>
                  {temporal?.folds?.length ? (
                    <div className="ml-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Ventana</th>
                            <th>Entrena (N)</th>
                            <th>Prueba (N)</th>
                            <th>Fin del Entrenamiento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {temporal.folds.map(f => (
                            <tr key={f.window}>
                              <td>{f.window}</td>
                              <td>{f.n_train}</td>
                              <td>{f.n_test}</td>
                              <td>{f.train_end_utc.slice(0, 10)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Validación simple cronológica 80/20 completada para este dataset.
                    </p>
                  )}

                  {detail.results.library_versions && (
                    <p className="ml-support">
                      Entorno de dependencias: {Object.entries(detail.results.library_versions)
                        .map(([k, v]) => `${k} ${v}`)
                        .join(' · ')}
                    </p>
                  )}
                </div>
              )}
            </article>
          )}

          <article className="ml-step ml-explain">
            <h3>
              <span className="ml-step-number">4</span> Estándares de Integridad Científica SismoIA
            </h3>
            <ol>
              <li>
                <strong>Integridad Criptográfica:</strong> Todo dataset proviene de un snapshot sellado con hash SHA-256.
              </li>
              <li>
                <strong>Cero Fuga (Target Leakage):</strong> Ningún predictor deriva del valor objetivo evaluado.
              </li>
              <li>
                <strong>Partición Cronológica Estricta:</strong> Se entrena exclusivamente sobre eventos anteriores y se prueba en sismos posteriores.
              </li>
              <li>
                <strong>Comparación Obligatoria frente a Heurísticas Basales:</strong> Para justificar complejidad algorítmica.
              </li>
              <li>
                <strong>Certificación Determinística:</strong> Reproducción bit-for-bit con semilla fija sobre el mismo dataset.
              </li>
            </ol>
          </article>

          {/* ================================================================= */}
          {/* MODAL DE CERTIFICACIÓN CRIPTOGRÁFICA DE REPRODUCIBILIDAD          */}
          {/* ================================================================= */}
          <ExpandableModal
            isOpen={showCertModal}
            onClose={() => setShowCertModal(false)}
            title="Certificado Oficial de Reproducibilidad Criptográfica"
            subtitle={`Auditoría algorítmica en tiempo real · Estudio ${certResult?.study_id}`}
          >
            {certResult && (
              <div className="repro-certificate">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: 'var(--primary)', textTransform: 'uppercase' }}>
                      SISMOIA PROTOCOL · VERIFICACIÓN INDEPENDIENTE
                    </span>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '4px 0 0' }}>
                      Dictamen de Reejecución Bit-for-Bit
                    </h3>
                  </div>

                  <div
                    className={`repro-stamp ${
                      certResult.identical ? 'repro-stamp-success' : 'repro-stamp-error'
                    }`}
                  >
                    {certResult.identical ? (
                      <>
                        <ShieldCheck size={16} /> 100% IDÉNTICO Y REPRODUCIBLE
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={16} /> REEJECUCIÓN DISCREPANTE
                      </>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: '1.6' }}>
                  El motor backend ha reejecutado el entrenamiento desde cero empleando el dataset inmutable con hash
                  SHA-256 verificado, la misma partición temporal y semilla pseudoaleatoria registrada.
                </p>

                <table className="repro-meta-table">
                  <tbody>
                    <tr>
                      <td>Identificador del Estudio</td>
                      <td><code>{certResult.study_id}</code></td>
                    </tr>
                    <tr>
                      <td>Dataset ID Asociado</td>
                      <td><code>{certResult.dataset_id}</code></td>
                    </tr>
                    <tr>
                      <td>Firma SHA-256 Dataset</td>
                      <td><code style={{ wordBreak: 'break-all' }}>{certResult.dataset_sha256}</code></td>
                    </tr>
                    <tr>
                      <td>Coincidencia de Métricas</td>
                      <td>
                        <span className={`badge ${certResult.metrics_match ? 'badge-success' : 'badge-danger'}`}>
                          {certResult.metrics_match ? 'Idénticas (Delta = 0.00000)' : 'Discrepancia detectada'}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td>Coincidencia de Resultados</td>
                      <td>
                        <span className={`badge ${certResult.results_match ? 'badge-success' : 'badge-danger'}`}>
                          {certResult.results_match ? 'Verificado bit por bit' : 'Diferente'}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td>Timestamp de Certificación</td>
                      <td>{new Date().toLocaleString('es-PE')} UTC-5</td>
                    </tr>
                  </tbody>
                </table>

                <div
                  style={{
                    background: 'var(--surface)',
                    padding: '14px 18px',
                    borderRadius: 'var(--radius)',
                    marginTop: '20px',
                    border: '1px solid var(--border)',
                    fontSize: '12px',
                    color: 'var(--text-muted)'
                  }}
                >
                  <strong>Descargo formal:</strong> {certResult.disclaimer}
                </div>
              </div>
            )}
          </ExpandableModal>
        </>
      )}
    </section>
  );
}
