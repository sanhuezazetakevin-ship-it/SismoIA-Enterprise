import {MLReproducible} from './MLReproducible';
import {useState} from 'react';
import {authorized, session} from '../services/auth';

type Metrics={accuracy:number;balanced_accuracy:number;f1_macro:number};
type Experiment={study:string;target:string;n_total:number;n_train:number;n_test:number;train_end_utc:string;test_start_utc:string;class_counts:Record<string,number>;excluded:Record<string,number>;split:string;features:string[];model:string;baseline:string;metrics:Metrics;baseline_metrics:Metrics;confusion_matrix:number[][];dataset_sha256:string;limitations:string[]};
const fmt=(n:number)=>`${(n*100).toFixed(1)}%`;
export function MLLab(){
 const [days,setDays]=useState(365);const [peru,setPeru]=useState(true);const [threshold,setThreshold]=useState(4);
 const [data,setData]=useState<Experiment|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(false);
 const allowed=Boolean(session.user?.permissions.includes('modelos.entrenar'));
 async function run(){setLoading(true);setError('');setData(null);try{const params=new URLSearchParams({days:String(days),peru_only:String(peru),threshold:String(threshold)});setData(await authorized<Experiment>('/api/v1/ml/experiments/evaluate?'+params.toString(),{method:'POST'}))}catch(e){setError(e instanceof Error?e.message:'No se pudo ejecutar el experimento')}finally{setLoading(false)}}
 return <div>
  <div className="page-heading"><div><div className="eyebrow">FASE 6 / LABORATORIO EXPERIMENTAL</div><h1>Evaluación de Machine Learning</h1><p>Clasificación retrospectiva de la magnitud de eventos ya registrados. No pronostica terremotos ni genera alertas.</p></div></div>
  <div className="sismo-filters"><label>Período<select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={90}>90 días</option><option value={365}>365 días</option><option value={730}>730 días</option><option value={1825}>5 años</option></select></label>
   <label>Cobertura<select value={peru?'pe':'all'} onChange={e=>setPeru(e.target.value==='pe')}><option value="pe">Caja geográfica Perú</option><option value="all">Catálogo completo</option></select></label>
   <label>Umbral de magnitud<select value={threshold} onChange={e=>setThreshold(Number(e.target.value))}><option value={3}>M ≥ 3</option><option value={4}>M ≥ 4</option><option value={5}>M ≥ 5</option></select></label></div>
  {!allowed?<section className="panel"><p>No tienes permiso <code>modelos.entrenar</code> para ejecutar experimentos.</p></section>:<button className="button button-primary" disabled={loading} onClick={run}>{loading?'Evaluando…':'Ejecutar evaluación retrospectiva'}</button>}
  {error&&<p role="alert" style={{marginTop:16}}>{error}</p>}
  {data&&<><div className="sismo-metrics" style={{marginTop:20}}><article className="kpi-card"><span>Eventos válidos</span><strong>{data.n_total}</strong></article><article className="kpi-card"><span>Entrenamiento</span><strong>{data.n_train}</strong></article><article className="kpi-card"><span>Prueba temporal</span><strong>{data.n_test}</strong></article><article className="kpi-card"><span>F1 macro (test)</span><strong>{fmt(data.metrics.f1_macro)}</strong></article></div>
  <div className="sismo-charts"><section className="panel sismo-chart"><h2>Modelo vs. referencia simple</h2><table style={{width:'100%',textAlign:'left'}}><thead><tr><th>Métrica</th><th>Bosque aleatorio</th><th>Basal</th></tr></thead><tbody>{(['accuracy','balanced_accuracy','f1_macro'] as const).map(k=><tr key={k}><td>{k.replaceAll('_',' ')}</td><td>{fmt(data.metrics[k])}</td><td>{fmt(data.baseline_metrics[k])}</td></tr>)}</tbody></table><p className="sismo-note">Una diferencia favorable frente al basal no implica utilidad predictiva futura.</p></section>
  <section className="panel sismo-chart"><h2>Matriz de confusión (test)</h2><p>Filas: clase real; columnas: clase estimada</p><table style={{width:'100%',textAlign:'center'}}><thead><tr><th></th><th>Menor</th><th>≥ umbral</th></tr></thead><tbody>{data.confusion_matrix.map((r,i)=><tr key={i}><th>{i===0?'Menor':'≥ umbral'}</th>{r.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></section></div>
  <section className="panel sismo-chart" style={{marginTop:18}}><h2>Trazabilidad y límites</h2><p><strong>Objetivo:</strong> {data.target}. <strong>Separación:</strong> {data.split}.</p><p><strong>Variables:</strong> {data.features.join(', ')}. <strong>Intervalo de evaluación:</strong> desde {data.test_start_utc}.</p><p className="sismo-note">SHA-256 de observaciones usadas en el experimento:</p><code style={{overflowWrap:'anywhere'}}>{data.dataset_sha256}</code><ul>{data.limitations.map(x=><li key={x}>{x}</li>)}</ul></section></>}
  <MLReproducible/>
 </div>
}
