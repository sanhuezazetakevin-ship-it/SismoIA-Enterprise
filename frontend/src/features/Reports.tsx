import {useCallback,useEffect,useState} from 'react';
import {FileDown,FileText,RefreshCw} from 'lucide-react';
import {authorized,session} from '../services/auth';

type History={id:string;category:string;format:string;rows_count:number;generated_at:string};
const API=(import.meta.env.VITE_API_BASE_URL||'http://localhost:8000').replace(/\/$/,'');
const choices=[{value:'events',label:'Eventos sísmicos USGS'},{value:'ml',label:'Experimentos Machine Learning'},{value:'alerts',label:'Centro de avisos'}];
export function Reports(){
 const [category,setCategory]=useState('events');const [format,setFormat]=useState('csv');
 const [start,setStart]=useState('');const [end,setEnd]=useState('');
 const [history,setHistory]=useState<History[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const allowed=Boolean(session.user?.permissions.includes('reportes.generar'));
 const refresh=useCallback(async()=>{if(!allowed)return;try{setHistory(await authorized<History[]>('/api/v1/reports/exports'));}catch(e){setError(e instanceof Error?e.message:'No se pudo consultar el historial');}},[allowed]);
 useEffect(()=>{void refresh()},[refresh]);
 async function download(){
  if(!session.token)return;
  setBusy(true);setError('');setNotice('');
  try{
   if(start&&end&&start>end)throw new Error('La fecha inicial no puede superar la fecha final');
   const p=new URLSearchParams({category,format});
   if(start)p.set('start',new Date(start+'T00:00:00Z').toISOString());
   if(end)p.set('end',new Date(end+'T23:59:59Z').toISOString());
   const response=await fetch(`${API}/api/v1/reports/download?${p}`,{headers:{Authorization:`Bearer ${session.token}`}});
   if(!response.ok){const json=await response.json().catch(()=>null);throw new Error(typeof json?.detail==='string'?json.detail:`HTTP ${response.status}`)}
   const blob=await response.blob();const url=URL.createObjectURL(blob);
   const a=document.createElement('a');a.href=url;a.download=`sismoia_${category}_${new Date().toISOString().slice(0,10)}.${format}`;
   document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
   setNotice('Reporte descargado. La generación quedó registrada en auditoría.');await refresh();
  }catch(e){setError(e instanceof Error?e.message:'No fue posible exportar el reporte');}finally{setBusy(false)}
 }
 return <div className="sismo-stack" style={{display:'grid',gap:18}}>
   <section className="panel"><span className="eyebrow">ENTREGA D · REPORTES</span><h1>Reportes verificables</h1>
    <p className="sismo-note">Exporta registros persistidos con fuente, fecha de corte y usuario solicitante. Los eventos provienen de snapshots almacenados, no de una nueva consulta en vivo.</p>
    {!allowed?<p role="alert">Tu rol no tiene permiso <code>reportes.generar</code>.</p>:<>
    <div className="sismo-filters">
     <label>Tipo de reporte<select value={category} onChange={e=>setCategory(e.target.value)}>{choices.map(c=><option value={c.value} key={c.value}>{c.label}</option>)}</select></label>
     <label>Formato<select value={format} onChange={e=>setFormat(e.target.value)}><option value="csv">CSV · Hasta 1000 filas</option><option value="pdf">PDF · Resumen y hasta 50 filas</option></select></label>
     <label>Desde (UTC)<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
     <label>Hasta (UTC)<input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label>
    </div>
    <button type="button" className="button button-primary" disabled={busy} onClick={()=>void download()}><FileDown size={18}/>{busy?'Generando…':`Descargar ${format.toUpperCase()}`}</button>
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
    </>}
   </section>
   {allowed&&<section className="panel"><div style={{display:'flex',gap:12,alignItems:'center',justifyContent:'space-between'}}><h2><FileText size={19}/> Historial de descargas</h2><button type="button" className="button" onClick={()=>void refresh()}><RefreshCw size={16}/> Actualizar</button></div>
    {history.length===0?<p>Sin exportaciones registradas para tu usuario.</p>:<div style={{overflowX:'auto'}}><table style={{width:'100%'}}><thead><tr><th>Fecha UTC</th><th>Contenido</th><th>Formato</th><th>Registros</th></tr></thead><tbody>{history.map(h=><tr key={h.id}><td>{new Date(h.generated_at).toLocaleString()}</td><td>{choices.find(c=>c.value===h.category)?.label||h.category}</td><td>{h.format.toUpperCase()}</td><td>{h.rows_count}</td></tr>)}</tbody></table></div>}
   </section>}
  </div>
}
