import {useEffect,useState} from 'react';
import {authorized} from '../services/auth';

type EventItem={id:string;external_id:string;source:string;occurred_at:string;place:string|null;magnitude:number|null;depth_km:number|null;latitude:number;longitude:number;source_url:string|null};
type EventPage={total:number;page:number;page_size:number;items:EventItem[]};
export function Events(){
  const [data,setData]=useState<EventPage|null>(null);
  const [page,setPage]=useState(1);
  const [minimum,setMinimum]=useState('');
  const [filter,setFilter]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{let alive=true;setBusy(true);setError('');const query=new URLSearchParams({page:String(page),page_size:'20'});if(filter)query.set('min_magnitude',filter);void authorized<EventPage>('/api/v1/events?'+query.toString()).then(result=>{if(alive)setData(result)}).catch(e=>{if(alive)setError(e instanceof Error?e.message:'Error de consulta')}).finally(()=>{if(alive)setBusy(false)});return()=>{alive=false}},[page,filter]);
  return <div><div className="page-heading"><div><div className="eyebrow">MONITOREO / PERÚ</div><h1>Eventos sísmicos</h1><p>Eventos registrados y normalizados con su fuente. No constituye alerta temprana.</p></div></div>
    <section className="panel" style={{padding:20}}><div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'end',marginBottom:16}}><label style={{display:'grid',gap:6}}>Magnitud mínima<input aria-label="Magnitud mínima" type="number" step="0.1" min="-2" max="10" value={minimum} onChange={e=>setMinimum(e.target.value)} style={{padding:10,border:'1px solid var(--border)',borderRadius:8,background:'var(--surface)',color:'var(--text)'}}/></label><button onClick={()=>{setPage(1);setFilter(minimum)}} className="primary-button">Aplicar filtro</button><span style={{color:'var(--muted)'}}>{data?.total??0} eventos</span></div>
    {busy?<p>Consultando eventos…</p>:error?<p role="alert">No se pudieron cargar los eventos: {error}</p>:data?.items.length===0?<p>No hay eventos almacenados para estos filtros. Un administrador puede iniciar una sincronización USGS desde la API.</p>:<div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left',fontSize:13}}><thead><tr>{['Fecha (UTC)','Ubicación','Magnitud','Prof. km','Fuente','Detalle'].map(h=><th key={h} style={{padding:'12px 10px',borderBottom:'1px solid var(--border)'}}>{h}</th>)}</tr></thead><tbody>{data?.items.map(e=><tr key={e.id}><td style={{padding:10,borderBottom:'1px solid var(--border)'}}>{new Date(e.occurred_at).toLocaleString('es-PE',{timeZone:'UTC'})}</td><td style={{padding:10,borderBottom:'1px solid var(--border)'}}>{e.place||`${e.latitude}, ${e.longitude}`}</td><td style={{padding:10,borderBottom:'1px solid var(--border)'}}>{e.magnitude??'—'}</td><td style={{padding:10,borderBottom:'1px solid var(--border)'}}>{e.depth_km??'—'}</td><td style={{padding:10,borderBottom:'1px solid var(--border)'}}>{e.source}</td><td style={{padding:10,borderBottom:'1px solid var(--border)'}}>{e.source_url?<a href={e.source_url} target="_blank" rel="noopener noreferrer">Fuente ↗</a>:'—'}</td></tr>)}</tbody></table></div>}
    <div style={{display:'flex',gap:12,alignItems:'center',marginTop:16}}><button disabled={page<=1||busy} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page}</span><button disabled={busy||!data||page*20>=data.total} onClick={()=>setPage(p=>p+1)}>Siguiente</button></div></section></div>
}
