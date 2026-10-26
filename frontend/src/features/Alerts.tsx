import {useEffect,useRef,useState} from 'react';
import {authorized} from '../services/auth';
import {useAuth} from '../app/auth';
import {StatusBadge} from '../components/StatusBadge';
type AlertRule={id:string;name:string;min_magnitude:number;min_lat:number|null;max_lat:number|null;min_lon:number|null;max_lon:number|null;cooldown_minutes:number;enabled:boolean};
type MonitorRun={id:string;started_at:string;status:string;examined:number;created:number;duplicates:number};
type MonitorStatus={enabled:boolean;automatic_send:boolean};
type Alert={id:string;external_event_id:string;title:string;body:string;status:string;created_at:string;created_by:string;approved_by:string|null};
export function Alerts(){const {user}=useAuth();const dialogRef=useRef<HTMLDivElement|null>(null);const returnFocusRef=useRef<HTMLElement|null>(null);const [decision,setDecision]=useState<{alert:Alert;action:'approve'|'send'|'reject'|'cancel'}|null>(null);const [reason,setReason]=useState('');const [evidence,setEvidence]=useState<any>(null);const [simulation,setSimulation]=useState<any>(null);const [snapshotId,setSnapshotId]=useState('');const [selectedRule,setSelectedRule]=useState('');const [items,setItems]=useState<Alert[]>([]);const [title,setTitle]=useState('');const [body,setBody]=useState('');const [eventId,setEventId]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [enabled,setEnabled]=useState(false);const [monitor,setMonitor]=useState<MonitorStatus|null>(null);const [runs,setRuns]=useState<MonitorRun[]>([]);const [rules,setRules]=useState<AlertRule[]>([]);const [ruleName,setRuleName]=useState('Perú — observaciones');const [ruleMag,setRuleMag]=useState('4.5');const [ruleCooldown,setRuleCooldown]=useState('60');const [useZone,setUseZone]=useState(false);const [ruleBounds,setRuleBounds]=useState({min_lat:'-18.5',max_lat:'0',min_lon:'-82',max_lon:'-68'});
async function load(){try{setItems(await authorized<Alert[]>('/api/v1/alerts'));}catch(e){setMessage(String(e))}}
useEffect(()=>{void load();void authorized<{enabled:boolean}>('/api/v1/alerts/delivery/config').then(v=>setEnabled(v.enabled)).catch(()=>{});void authorized<MonitorStatus>('/api/v1/monitoring/status').then(setMonitor).catch(()=>{});void authorized<MonitorRun[]>('/api/v1/monitoring/runs').then(setRuns).catch(()=>{});void authorized<AlertRule[]>('/api/v1/alert-rules').then(setRules).catch(()=>{});},[]);
async function openReview(alert:Alert,action:'approve'|'send'|'reject'|'cancel'){
 returnFocusRef.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
 setReason('');setEvidence(null);setDecision({alert,action});
 try{setEvidence(await authorized(`/api/v1/alerts/${alert.id}/evidence`))}catch(e){setMessage('No se pudo cargar evidencia: '+String(e))}
}

// Diálogo modal accesible: foco inicial, navegación Tab contenida, Escape y retorno del foco.
useEffect(()=>{
 if(!decision)return;
 const node=dialogRef.current;
 const field=node?.querySelector<HTMLTextAreaElement>('#review-reason');
 field?.focus();
 const onKey=(event:KeyboardEvent)=>{
  if(event.key==='Escape'){event.preventDefault();setDecision(null);return;}
  if(event.key!=='Tab'||!node)return;
  const elements=Array.from(node.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(el=>el.getClientRects().length>0);
  if(elements.length===0)return;
  const first=elements[0],last=elements[elements.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
 };
 document.addEventListener('keydown',onKey);
 return()=>{document.removeEventListener('keydown',onKey);returnFocusRef.current?.focus()};
},[decision]);

async function runSimulation(){if(!selectedRule||!snapshotId.trim()){setMessage('Selecciona una regla y escribe el UUID del snapshot.');return}
 setBusy(true);setMessage('');try{setSimulation(await authorized(`/api/v1/alert-rules/${selectedRule}/simulate?snapshot_id=${encodeURIComponent(snapshotId.trim())}`))}catch(e){setMessage(String(e))}finally{setBusy(false)}
}
async function saveRule(){setBusy(true);setMessage('');try{
const body={name:ruleName,min_magnitude:Number(ruleMag),cooldown_minutes:Number(ruleCooldown),enabled:false,...(useZone?{min_lat:Number(ruleBounds.min_lat),max_lat:Number(ruleBounds.max_lat),min_lon:Number(ruleBounds.min_lon),max_lon:Number(ruleBounds.max_lon)}:{})};
await authorized('/api/v1/alert-rules',{method:'POST',body:JSON.stringify(body)});
setRules(await authorized<AlertRule[]>('/api/v1/alert-rules'));
setMessage('Regla creada desactivada. Puedes habilitarla de forma explícita.');
}catch(e){setMessage(String(e))}finally{setBusy(false)}}
async function toggleRule(r:AlertRule){setBusy(true);setMessage('');try{
const body={name:r.name,min_magnitude:r.min_magnitude,min_lat:r.min_lat,max_lat:r.max_lat,min_lon:r.min_lon,max_lon:r.max_lon,cooldown_minutes:r.cooldown_minutes,enabled:!r.enabled};
await authorized(`/api/v1/alert-rules/${r.id}`,{method:'PUT',body:JSON.stringify(body)});
setRules(await authorized<AlertRule[]>('/api/v1/alert-rules'));
setMessage('Configuración de regla actualizada. Los avisos siguen sujetos a revisión humana.');
}catch(e){setMessage(String(e))}finally{setBusy(false)}}
async function scan(){if(!window.confirm('Consultar USGS y generar solamente candidatos pendientes, sin enviar notificaciones?'))return;setBusy(true);setMessage('');try{const r=await authorized<{examined:number;created:number;duplicates:number}>('/api/v1/monitoring/scan?days=1&minimum=4.5',{method:'POST'});setMessage(`Monitoreo completado: ${r.examined} revisados, ${r.created} nuevos, ${r.duplicates} repetidos. No se enviaron mensajes.`);await load();setRuns(await authorized<MonitorRun[]>('/api/v1/monitoring/runs'));}catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
async function call(path:string,data:unknown){setBusy(true);setMessage('');try{await authorized(path,{method:'POST',body:JSON.stringify(data)});await load();setTitle('');setBody('');setEventId('');setMessage('Operación registrada y auditada.');}catch(e){setMessage(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
return <div className="sismo-alerts"><h1>Centro de avisos informativos</h1><p>Eventos observados, sin predicción sísmica. Todo envío requiere revisión humana y acción explícita de un operador autorizado.</p><p role="status">{enabled?'ntfy habilitado: prueba solo en celulares autorizados.':'ntfy deshabilitado: ninguna notificación externa puede enviarse.'}</p>{message&&<p role="alert">{message}</p>}
<section className="panel" style={{padding:20,marginBottom:20}}><h2>Monitoreo USGS supervisado — Fase 8</h2><p>Consulta eventos recientes y propone avisos pendientes. No aprueba ni envía notificaciones automáticamente.</p><p role="status">{monitor?(monitor.enabled?'Monitoreo habilitado; envío automático desactivado.':'Monitoreo desactivado por configuración.'):'Monitoreo disponible solo para operadores autorizados.'}</p><button type="button" disabled={busy||!monitor?.enabled} onClick={()=>void scan()}>Revisar USGS y crear candidatos</button>{runs.length>0&&<p><small>Última consulta: {new Date(runs[0].started_at).toLocaleString()} · Nuevos: {runs[0].created} · Repetidos: {runs[0].duplicates}</small></p>}</section>
<section className="panel" style={{padding:20,marginBottom:20}}>
<h2>Reglas supervisadas de candidatos</h2>
<p>Las reglas controlan qué eventos pueden convertirse en candidatos. Nunca aprueban ni envían avisos automáticamente. Al crear la primera regla, el monitoreo deja de proponer eventos fuera de las reglas activas.</p>
<form onSubmit={e=>{e.preventDefault();void saveRule()}} style={{display:'grid',gap:12,maxWidth:640}}>
<label>Nombre de la regla<input required minLength={3} maxLength={100} value={ruleName} onChange={e=>setRuleName(e.target.value)}/></label>
<label>Magnitud mínima (3.5 a 9.9)<input type="number" required min={3.5} max={9.9} step={0.1} value={ruleMag} onChange={e=>setRuleMag(e.target.value)}/></label>
<label>Cooldown en minutos (0–10080)<input type="number" required min={0} max={10080} value={ruleCooldown} onChange={e=>setRuleCooldown(e.target.value)}/></label>
<label><input type="checkbox" checked={useZone} onChange={e=>setUseZone(e.target.checked)}/> Restringir a un rectángulo geográfico</label>
{useZone&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10}}>
{(['min_lat','max_lat','min_lon','max_lon'] as const).map(k=><label key={k}>{k}<input type="number" required step="any" value={ruleBounds[k]} onChange={e=>setRuleBounds(v=>({...v,[k]:e.target.value}))}/></label>)}</div>}
<button disabled={busy} type="submit">Crear regla (desactivada)</button>
</form>
{rules.length===0?<p>No hay reglas creadas; el monitoreo mantiene su comportamiento anterior.</p>:<div style={{display:'grid',gap:12,marginTop:18}}>{rules.map(r=><article key={r.id} style={{padding:12,border:'1px solid var(--border)',borderRadius:8}}><strong>{r.name}</strong><p>Magnitud ≥ {r.min_magnitude} · Cooldown: {r.cooldown_minutes} min · {r.min_lat===null?'Zona: Perú (filtro de USGS)':`Lat ${r.min_lat} a ${r.max_lat}; Lon ${r.min_lon} a ${r.max_lon}`}</p><p>Estado: {r.enabled?'Habilitada':'Deshabilitada'}</p><button disabled={busy} type="button" onClick={()=>{if(window.confirm(r.enabled?'¿Deshabilitar esta regla?':'¿Habilitar esta regla para generar candidatos pendientes?'))void toggleRule(r)}}>{r.enabled?'Deshabilitar':'Habilitar'}</button></article>)}</div>}
<div style={{marginTop:20,borderTop:'1px solid var(--border)',paddingTop:16}}><h3>Simulador histórico de reglas (sin envíos)</h3>
<p>Selecciona una regla y un snapshot existente. Esta prueba no crea candidatos ni modifica la base de avisos.</p>
<label>Regla<select value={selectedRule} onChange={e=>setSelectedRule(e.target.value)}><option value="">Seleccionar</option>{rules.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
<label>UUID del snapshot<input value={snapshotId} onChange={e=>setSnapshotId(e.target.value)} placeholder="UUID de una captura USGS" /></label>
<button type="button" disabled={busy||!selectedRule||!snapshotId.trim()} onClick={()=>void runSimulation()}>Simular sin enviar avisos</button>
{simulation&&<div role="status" className="panel" style={{padding:12,marginTop:12}}><strong>Resultado simulado</strong><p>Eventos examinados: {simulation.total_events} · Elegibles: {simulation.eligible} · Excluidos por cooldown: {simulation.cooldown_excluded}</p><p>Mensajes enviados: {simulation.messages_sent}. No se realizaron cambios.</p></div>}</div>
</section>
<section className="panel" style={{padding:20,marginBottom:20}}><h2>Crear borrador para revisión</h2><form onSubmit={e=>{e.preventDefault();void call('/api/v1/alerts',{source:'USGS',external_event_id:eventId,title,body})}} style={{display:'grid',gap:12}}><label>ID del evento USGS<input required maxLength={150} value={eventId} onChange={e=>setEventId(e.target.value)}/></label><label>Título<input required minLength={10} maxLength={140} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Descripción informativa<textarea required minLength={20} maxLength={500} value={body} onChange={e=>setBody(e.target.value)}/></label><button disabled={busy} type="submit">Crear borrador</button></form></section>
<section className="panel" style={{padding:20}}><h2>Historial de revisión</h2>{items.length===0?<p>No existen avisos o no tienes permiso para consultarlos.</p>:<div style={{display:'grid',gap:14}}>{items.map(a=><article key={a.id} style={{borderBottom:'1px solid var(--border)',paddingBottom:12}}><div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:8}}><StatusBadge type="informational"/><strong>{a.title}</strong></div><p>{a.body}</p><small>USGS {a.external_event_id} · Estado: {a.status}</small><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>{a.status==='pending'&&<><button disabled={busy||a.created_by===user?.id} title={a.created_by===user?.id?'No puedes aprobar un candidato creado por tu cuenta':undefined} onClick={()=>void openReview(a,'approve')}>Aprobar con evidencia</button>{a.created_by===user?.id&&<span className="sismo-explanation">No puedes aprobar un candidato propio.</span>}<button disabled={busy} onClick={()=>void openReview(a,'reject')}>Rechazar</button></>}{a.status==='approved'&&<><button disabled={busy||!enabled} onClick={()=>void openReview(a,'send')}>Revisar y enviar aviso</button><button disabled={busy} onClick={()=>void openReview(a,'cancel')}>Cancelar</button></>}</div></article>)}</div>}</section>{decision&&<div className="sismo-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setDecision(null)}}><div ref={dialogRef} className="sismo-dialog" role="dialog" aria-modal="true" aria-labelledby="sismo-dialog-title" aria-describedby="sismo-dialog-description"><form onSubmit={e=>{e.preventDefault();if(reason.trim().length<10)return;const d=decision;setDecision(null);void call(`/api/v1/alerts/${d.alert.id}/${d.action}`,{note:reason.trim()})}}><h2 id="sismo-dialog-title">{({approve:'Aprobar con evidencia',reject:'Rechazar candidato',send:'Confirmar envío informativo',cancel:'Cancelar aviso'} as const)[decision.action]}</h2><StatusBadge type="informational"/><h3>{decision.alert.title}</h3><p>{decision.alert.body}</p><p><strong>Procedencia:</strong> USGS {decision.alert.external_event_id}</p>{evidence?.observation?<div className="sismo-explanation"><p><strong>Snapshot:</strong> {evidence.observation.snapshot_id}</p><p>Magnitud: {evidence.observation.magnitude} · Profundidad: {evidence.observation.depth_km} km</p><p>Coordenadas: {evidence.observation.latitude}, {evidence.observation.longitude}</p><p><a href={evidence.observation.source_url||'#'} target="_blank" rel="noopener noreferrer">Ver procedencia USGS</a></p></div>:<p role="status">No existe una captura archivada de este evento. Verifica la información en USGS antes de decidir.</p>}<p><strong>Creado:</strong> {new Date(decision.alert.created_at).toLocaleString('es-PE',{timeZone:'UTC'})} UTC</p><p><strong>Estado:</strong> {decision.alert.status}</p><p id="sismo-dialog-description" className="sismo-explanation">Se trata de información sobre un evento ya observado; no es una comunicación oficial ni un pronóstico.</p><label htmlFor="review-reason">Motivo de la revisión (obligatorio, mínimo 10 caracteres)<textarea id="review-reason" required minLength={10} aria-describedby="review-reason-help" value={reason} onChange={e=>setReason(e.target.value)}/></label><p className="sismo-explanation" id="review-reason-help">Confirma la fuente y justifica la decisión. El motivo se almacena en el historial auditable de decisiones, también cuando se confirma el envío.</p><div className="sismo-dialog-actions"><button type="button" onClick={()=>setDecision(null)}>Cancelar</button><button type="submit" disabled={busy||reason.trim().length<10}>Confirmar {({approve:'aprobación',reject:'rechazo',send:'envío',cancel:'cancelación'} as const)[decision.action]}</button></div></form></div></div>}</div>}
