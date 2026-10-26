import {useMemo, useState} from 'react';
import {authorized} from '../services/auth';
import './MLCompare.css';

type Entry={id:string;dataset_id:string;kind:string;algorithm:string;created_at:string};
type Detail={id:string;dataset_id:string;kind:string;config:{threshold?:number;seed?:number;split?:string;features?:string[];dataset_sha256?:string};metrics:{model:Record<string,number>;baseline:Record<string,number>};results:{temporal_validation?:{status?:string;n_evaluated?:number}}};
type Props={studies:Entry[]};
type ReplayResult={status:'identical'|'different'|'environment_changed';identical:boolean;reason?:string;metrics_match?:boolean;results_match?:boolean};
const names:Record<string,string>={regression_simple:'Regresión simple',regression_multiple:'Regresión múltiple',classification:'Clasificación'};
const lowerBetter=new Set(['mae','rmse']);
const fmt=(n:number|undefined)=>typeof n==='number'&&Number.isFinite(n)?n.toFixed(4):'—';
export function MLCompare({studies}:Props){
 const [left,setLeft]=useState('');const [right,setRight]=useState('');
 const [a,setA]=useState<Detail|null>(null);const [b,setB]=useState<Detail|null>(null);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const [replayBusy,setReplayBusy]=useState(false);const [replay,setReplay]=useState<ReplayResult|null>(null);
 const optionLabel=(s:Entry)=>`${names[s.kind]||s.kind} · ${s.id.slice(0,8)} · ${new Date(s.created_at).toLocaleDateString('es-PE')}`;
 const options=useMemo(()=>studies,[studies]);
 async function compare(){
  if(!left||!right||left===right)return;
  setBusy(true);setError('');setA(null);setB(null);setReplay(null);
  try {const [first,second]=await Promise.all([authorized<Detail>(`/api/v1/ml/studies/${left}`),authorized<Detail>(`/api/v1/ml/studies/${right}`)]);setA(first);setB(second)}
  catch(e){setError(e instanceof Error?e.message:'No se pudieron cargar los experimentos')}
  finally{setBusy(false)}
 }
 async function verify(){
   if(!left)return;
   setReplayBusy(true);setReplay(null);setError('');
   try {setReplay(await authorized<ReplayResult>(`/api/v1/ml/studies/${left}/verify-reproducibility`,{method:'POST'}))}
   catch(e){setError(e instanceof Error?e.message:'No se pudo verificar la reproducción')}
   finally{setReplayBusy(false)}
 }
 const sameKind=!!a&&!!b&&a.kind===b.kind;
 const sameData=sameKind&&a!.dataset_id===b!.dataset_id&&a!.config.dataset_sha256===b!.config.dataset_sha256;
 const sameConfig=sameData&&JSON.stringify(a!.config)===JSON.stringify(b!.config);
 const metrics=sameKind?Object.keys(a!.metrics.model).filter(k=>typeof b!.metrics.model[k]==='number'):[];
 const deterministic=sameConfig&&metrics.length>0&&metrics.every(k=>a!.metrics.model[k]===b!.metrics.model[k]&&a!.metrics.baseline[k]===b!.metrics.baseline[k]);
 return <section className="ml-compare ml-step" aria-label="Comparación de experimentos">
  <h3>Comparar dos experimentos guardados</h3>
  <p>Compara primero experimentos del mismo tipo y dataset. Para verificar reproducibilidad, elige dos entrenamientos con la misma configuración y semilla.</p>
  <div className="ml-compare-form">
   <div><label htmlFor="ml-compare-a">Experimento A</label><select id="ml-compare-a" value={left} onChange={e=>{setLeft(e.target.value);setA(null);setB(null)}}><option value="">Seleccionar experimento</option>{options.map(s=><option value={s.id} key={s.id}>{optionLabel(s)}</option>)}</select></div>
   <div><label htmlFor="ml-compare-b">Experimento B</label><select id="ml-compare-b" value={right} onChange={e=>{setRight(e.target.value);setA(null);setB(null)}}><option value="">Seleccionar experimento</option>{options.map(s=><option value={s.id} key={s.id}>{optionLabel(s)}</option>)}</select></div>
   <button className="button" type="button" disabled={busy||!left||!right||left===right} onClick={()=>void compare()}>{busy?'Comparando…':'Comparar resultados'}</button>
  </div>
  <div className="ml-compare-form">
   <button className="button" type="button" disabled={!left||replayBusy||busy} onClick={()=>void verify()}>{replayBusy?'Verificando…':'Reentrenar y verificar experimento A'}</button>
  </div>
  {replay&&<p role="status" className="ml-support"><strong>{replay.status==='identical'?'Reproducción verificada':replay.status==='different'?'Los resultados difieren':'Entorno diferente'}</strong>. {replay.status==='identical'?'Los resultados y las métricas reproducidos coinciden con los guardados. Esto no demuestra predicción de terremotos.':replay.reason||`Métricas iguales: ${replay.metrics_match?'sí':'no'}; resultados completos iguales: ${replay.results_match?'sí':'no'}.`}</p>}
  {left===right&&left!==''&&<p role="status">Selecciona dos experimentos diferentes.</p>}
  {error&&<p role="alert" className="ml-error">{error}</p>}
  {a&&b&&<div role="status" className="ml-compare-result">
   {!sameKind?<p><strong>Comparación no válida:</strong> los modelos resuelven tareas diferentes. No compares directamente MAE con F1.</p>:
    !sameData?<p><strong>Conjuntos distintos:</strong> los resultados pueden mostrarse, pero no prueban cuál modelo es mejor porque no utilizan el mismo dataset versionado.</p>:
    <p><strong>Mismo dataset y tipo de modelo.</strong> {sameConfig?(deterministic?'Reproducibilidad de métricas confirmada para estas dos ejecuciones.':'Las métricas difieren pese a usar la misma configuración; revisa la reproducibilidad.'):'Configuraciones diferentes: es una comparación exploratoria, no una prueba de reproducibilidad.'}</p>}
   {sameKind&&<div className="ml-table-wrap"><table><thead><tr><th scope="col">Métrica</th><th scope="col">Experimento A</th><th scope="col">Experimento B</th><th scope="col">Baseline A</th><th scope="col">Baseline B</th><th scope="col">Interpretación</th></tr></thead><tbody>{metrics.map(k=><tr key={k}><th scope="row">{k.replaceAll('_',' ')}</th><td>{fmt(a.metrics.model[k])}</td><td>{fmt(b.metrics.model[k])}</td><td>{fmt(a.metrics.baseline[k])}</td><td>{fmt(b.metrics.baseline[k])}</td><td>{!sameData?'No comparable':a.metrics.model[k]===b.metrics.model[k]?'Igual':(lowerBetter.has(k)?b.metrics.model[k]<a.metrics.model[k]:b.metrics.model[k]>a.metrics.model[k])?'B tiene mejor resultado':'A tiene mejor resultado'}</td></tr>)}</tbody></table></div>}
   <p className="ml-support">Una coincidencia de métricas respalda la reproducibilidad de esos resultados, pero no garantiza ausencia total de fuga de datos, generalización ni predicción de terremotos.</p>
  </div>}
 </section>
}
