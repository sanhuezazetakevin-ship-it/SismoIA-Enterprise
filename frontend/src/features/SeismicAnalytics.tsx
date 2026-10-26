import {ChartFooter} from '../components/ChartFooter';
import {StatusBadge} from '../components/StatusBadge';
import {useEffect,useMemo,useRef,useState} from 'react';
import {BarChart,Bar,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis,LineChart,Line,ScatterChart,Scatter,ZAxis} from 'recharts';
import {authorized} from '../services/auth';

type Stat={total:number;mean_magnitude:number|null;max_magnitude:number|null;mean_depth_km:number|null;daily:{date:string;count:number}[];magnitudes:{range:string;count:number}[];depths:{range:string;count:number}[];scope:string};
type Point={id:string;lat:number;lon:number;magnitude:number|null;depth_km:number|null;occurred_at:string;place:string|null;source:string;source_url:string|null};
type MapResult={items:Point[];sampled:boolean;queried_at:string;source:string;period_days:number;cache_hit:boolean};
const colors=['var(--magnitude-dark)','var(--magnitude-medium)','var(--magnitude-light)','var(--primary)'];
function Filters({days,setDays,minimum,setMinimum}:{days:number;setDays:(x:number)=>void;minimum:string;setMinimum:(x:string)=>void}){return <div className="sismo-filters"><label>Período<select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>7 días</option><option value={30}>30 días</option><option value={90}>90 días</option><option value={365}>365 días</option></select></label><label>Magnitud mínima<input type="number" min="-2" max="10" step="0.1" value={minimum} onChange={e=>setMinimum(e.target.value)} placeholder="Todas"/></label></div>}
function useQuery<T>(endpoint:string){const [data,setData]=useState<T|null>(null);const [busy,setBusy]=useState(true);const [error,setError]=useState('');useEffect(()=>{let active=true;setBusy(true);setError('');authorized<T>(endpoint).then(d=>{if(active)setData(d)}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Error de consulta')}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[endpoint]);return {data,busy,error}}
function Notice({busy,error}:{busy:boolean;error:string}){return busy?<p role="status" aria-live="polite" className="sismo-loading">Consultando eventos observados en USGS…</p>:error?<div role="alert" className="sismo-source-error"><strong>USGS no respondió o la consulta falló.</strong><p>Esto no significa que no hayan ocurrido sismos. Vuelve a intentarlo o consulta la fuente original.</p><details><summary>Detalles técnicos</summary><code>{error}</code></details></div>:null}
const fmt=(v:number|null,dec=1)=>v===null?'—':v.toFixed(dec);
function MagnitudeChart({data}:{data:{range:string;count:number}[]}){return <ResponsiveContainer width="100%" height={260}><BarChart data={data}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="range" tick={{fontSize:11}}/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="count" name="Eventos" fill={colors[0]} radius={[5,5,0,0]}/></BarChart></ResponsiveContainer>}
export function Statistics(){const [days,setDays]=useState(30);const [minimum,setMinimum]=useState('');const params=new URLSearchParams({days:String(days),peru_only:'true'});if(minimum.trim()!=='')params.set('min_magnitude',minimum);const {data,busy,error}=useQuery<Stat>('/api/v1/analytics/summary?'+params.toString());return <div><div className="page-heading"><div><div className="eyebrow">ANALÍTICA / CONSULTA USGS</div><h1>Estadísticas sísmicas</h1><p>Análisis descriptivo de eventos consultados a USGS, no pronóstico de terremotos.</p></div></div><Filters days={days} setDays={setDays} minimum={minimum} setMinimum={setMinimum}/><Notice busy={busy} error={error}/>{data&&<><div className="sismo-metrics">{[['Eventos registrados',String(data.total)],['Magnitud promedio',fmt(data.mean_magnitude,2)],['Magnitud máxima',fmt(data.max_magnitude)],['Profundidad promedio',fmt(data.mean_depth_km)+' km']].map(([k,v])=><article className="kpi-card" key={k}><span>{k}</span><strong>{v}</strong></article>)}</div><div className="sismo-charts"><section className="panel sismo-chart"><h2>Frecuencia diaria</h2>{data.daily.length?<ResponsiveContainer width="100%" height={260}><LineChart data={data.daily}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date" tick={{fontSize:10}} minTickGap={26}/><YAxis allowDecimals={false}/><Tooltip/><Line type="monotone" dataKey="count" name="Eventos" stroke={colors[0]} strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer>:<p>No hay datos para este período.</p>}<ChartFooter unit="eventos/día" period={`${days} días`} sample={data.total} source="USGS" cutoff={(data as {queried_at?:string}).queried_at} filters={`Magnitud mínima: ${minimum||"todas"}`}/></section><section className="panel sismo-chart"><h2>Distribución de magnitudes</h2><MagnitudeChart data={data.magnitudes}/><ChartFooter unit="eventos por rango de magnitud" period={`${days} días`} sample={data.total} source="USGS" cutoff={(data as {queried_at?:string}).queried_at} filters={`Magnitud mínima: ${minimum||"todas"}`}/></section><section className="panel sismo-chart"><h2>Profundidad (km)</h2><MagnitudeChart data={data.depths}/><ChartFooter unit="eventos por rango de profundidad (km)" period={`${days} días`} sample={data.total} source="USGS" cutoff={(data as {queried_at?:string}).queried_at} filters={`Magnitud mínima: ${minimum||"todas"}`}/></section></div><p className="sismo-note">Fuente: USGS FDSN · Período: {days} días · Tamaño de muestra: {data.total} · Fecha de consulta: {"queried_at" in data?String(data.queried_at):"No disponible"}. Los resultados dependen del catálogo publicado y de los filtros aplicados.</p></>}<MagnitudeDepthScatter/></div>}
// Mapa de epicentros observados. Proveedores cartográficos externos no son fuentes sísmicas.
// Fallbacks y mensajes explícitos para evitar paneles vacíos ante errores de red.
type LeafletMap = {setView:(center:[number,number],zoom:number)=>LeafletMap;remove:()=>void;fitBounds:(bounds:[number,number][],options?:object)=>void;invalidateSize:(options?:object)=>void};
type LeafletLayer={addTo:(map:LeafletMap)=>LeafletLayer;bindPopup:(html:string)=>LeafletLayer;on:(name:string,listener:(event?:unknown)=>void)=>LeafletLayer;remove:()=>void};
type LeafletAPI={map:(element:HTMLElement,options?:object)=>LeafletMap;tileLayer:(url:string,options:object)=>LeafletLayer;divIcon:(options:object)=>unknown;marker:(latlng:[number,number],options:object)=>LeafletLayer};
declare global {interface Window {L?:LeafletAPI}}
let leafletLoading:Promise<LeafletAPI>|undefined;
function addRemoteScript(src:string):Promise<void>{return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=true;script.onload=()=>resolve();script.onerror=()=>{script.remove();reject(new Error('No disponible: '+src))};document.head.appendChild(script)})}
function loadLeaflet():Promise<LeafletAPI>{
  if(window.L)return Promise.resolve(window.L);
  if(leafletLoading)return leafletLoading;
  leafletLoading=(async()=>{
    if(!document.querySelector('link[data-sismo-leaflet]')){
      const css=document.createElement('link');css.rel='stylesheet';css.href='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';css.dataset.sismoLeaflet='true';document.head.appendChild(css);
    }
    const urls=['https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js','https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];
    for(const url of urls){try{await addRemoteScript(url);if(window.L)return window.L}catch{/* probar el proveedor siguiente */}}
    throw new Error('No se pudo cargar la biblioteca de mapas. Verifica conexión, bloqueo de CDN o extensiones del navegador.');
  })().catch(error=>{leafletLoading=undefined;throw error});
  return leafletLoading;
}
function escapeHtml(input:string){return input.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c))}
function isValidPoint(p:Point){const lat=Number(p.lat),lon=Number(p.lon);return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180}
function normalizedPoint(p:Point):Point{return {...p,lat:Number(p.lat),lon:Number(p.lon),magnitude:p.magnitude===null?null:Number(p.magnitude),depth_km:p.depth_km===null?null:Number(p.depth_km)}}
function dateUTC(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?'No disponible':d.toLocaleString('es-PE',{timeZone:'UTC'})+' UTC'}
function LeafletCanvas({items,onSelect}:{items:Point[];onSelect:(p:Point)=>void}){
  const node=useRef<HTMLDivElement|null>(null);
  const mapRef=useRef<LeafletMap|null>(null);
  const layers=useRef<LeafletLayer[]>([]);
  const [ready,setReady]=useState(false);
  const [loadError,setLoadError]=useState('');
  const [tilesReady,setTilesReady]=useState(false);
  const [retry,setRetry]=useState(0);
  const validItems=useMemo(()=>items.filter(isValidPoint).map(normalizedPoint),[items]);
  useEffect(()=>{
    let cancelled=false;let resizeObserver:ResizeObserver|undefined;
    setReady(false);setTilesReady(false);setLoadError('');
    loadLeaflet().then(L=>{
      if(cancelled||!node.current)return;
      const map=L.map(node.current,{scrollWheelZoom:false,zoomControl:true}).setView([-9.2,-75.1],5);
      mapRef.current=map;
      let switched=false;
      const tiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'});
      tiles.on('load',()=>{if(!cancelled)setTilesReady(true)});
      tiles.on('tileerror',()=>{
        if(switched||cancelled)return;switched=true;tiles.remove();
        const backup=L.tileLayer('https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors · © CARTO'});
        backup.on('load',()=>{if(!cancelled)setTilesReady(true)});
        backup.on('tileerror',()=>{if(!cancelled)setLoadError('No se pudieron cargar las teselas del mapa. Comprueba el acceso a OpenStreetMap o CARTO. Los datos sísmicos siguen disponibles en la lista.')});
        backup.addTo(map);
      });
      tiles.addTo(map);
      setReady(true);
      requestAnimationFrame(()=>map.invalidateSize());
      if(typeof ResizeObserver!=='undefined'){
        resizeObserver=new ResizeObserver(()=>map.invalidateSize());resizeObserver.observe(node.current);
      }
    }).catch(e=>{if(!cancelled)setLoadError(e instanceof Error?e.message:'No se pudo iniciar el mapa')});
    return()=>{cancelled=true;resizeObserver?.disconnect();layers.current.forEach(layer=>layer.remove());layers.current=[];mapRef.current?.remove();mapRef.current=null};
  },[retry]);
  useEffect(()=>{
    if(!ready||!mapRef.current||!window.L)return;
    const map=mapRef.current;const L=window.L;
    layers.current.forEach(layer=>layer.remove());layers.current=[];
    const positions:[number,number][]=[];
    validItems.forEach(p=>{
      const latlng:[number,number]=[p.lat,p.lon];positions.push(latlng);
      const mag=p.magnitude??0;
      // Marcador HTML independiente de los SVG de Leaflet y de estilos globales heredados.
      // La posición se calcula exclusivamente con latitud/longitud reales de USGS.
      const severity=mag>=6?'high':mag>=5?'mid':'low';
      const size=Math.max(18,Math.min(34,18+mag*2));
      const icon=L.divIcon({
        className:'sismo-epicenter-icon',
        html:`<span class="sismo-epicenter-dot sismo-epicenter-${severity}" style="--point-size:${size}px"><span class="sismo-epicenter-center"></span></span>`,
        iconSize:[size,size],iconAnchor:[size/2,size/2],popupAnchor:[0,-size/2]
      });
      const marker=L.marker(latlng,{icon,keyboard:true,title:`Sismo M${mag.toFixed(1)}: ${p.place||'Ubicación no especificada'}`});
      marker.bindPopup(`<strong>${escapeHtml(p.place||'Ubicación no especificada')}</strong><div>Magnitud ${mag.toFixed(1)} · ${p.depth_km??'—'} km</div><small>${escapeHtml(dateUTC(p.occurred_at))}</small>`).on('click',()=>onSelect(p)).addTo(map);
      layers.current.push(marker);
    });
    if(positions.length)map.fitBounds(positions,{padding:[65,65],maxZoom:8});
    else map.setView([-9.2,-75.1],5);
    map.invalidateSize();
  },[items,onSelect,ready]);
  return <div className="sismo-leaflet-container">
    <div className="sismo-map-toolbar"><div><strong>Explorador sísmico · Perú</strong><StatusBadge type="observed"/><span>{validItems.length} epicentros geolocalizados · pulsa un punto para ver detalles</span></div><button type="button" onClick={()=>setRetry(v=>v+1)}>Recargar mapa</button></div>
    <div className="sismo-map-stage"><div ref={node} className="sismo-leaflet-map" aria-label="Mapa geográfico interactivo de epicentros observados en Perú" role="region"/>
    {(!ready||(!tilesReady&&!loadError))&&<div className="sismo-map-overlay" role="status">Cargando cartografía geográfica…</div>}
    {ready&&!loadError&&validItems.length===0&&<div className="sismo-map-overlay sismo-map-empty" role="status">La consulta no devolvió epicentros con coordenadas válidas. Amplía el período o elimina la magnitud mínima.</div>}
    {loadError&&<div className="sismo-map-overlay sismo-map-failure" role="alert"><strong>Mapa no disponible</strong><span>{loadError}</span><button type="button" onClick={()=>setRetry(v=>v+1)}>Intentar de nuevo</button></div>}</div>
    <div className="sismo-map-legend"><span className="sismo-dot sismo-dot-low"/> M &lt; 5 <span className="sismo-dot sismo-dot-mid"/> M 5–5.9 <span className="sismo-dot sismo-dot-high"/> M ≥ 6 <span className="sismo-map-attribution">Datos: USGS · Cartografía: OSM/CARTO</span></div>
    {(loadError||validItems.length>0)&&<div className="sismo-map-events"><strong>{loadError?"Eventos disponibles sin mapa":"Epicentros recuperados (selecciona uno para consultar su ficha)"}</strong>{validItems.slice(0,10).map(p=><button key={p.id} type="button" onClick={()=>onSelect(p)}>{p.place||"Evento"} · M{p.magnitude??"—"} · {p.lat.toFixed(3)}, {p.lon.toFixed(3)}</button>)}</div>}
  </div>;
}
export function SeismicMap(){
  const [days,setDays]=useState(30);const [minimum,setMinimum]=useState('');const [selected,setSelected]=useState<Point|null>(null);
  const params=new URLSearchParams({days:String(days),peru_only:'true',limit:'1000'});if(minimum.trim()!=='')params.set('min_magnitude',minimum);
  const {data,busy,error}=useQuery<MapResult>('/api/v1/analytics/map?'+params.toString());
  const selectPoint=useMemo(()=>((point:Point)=>setSelected(point)),[]);
  const rawEvents=data?.items||[];const events=useMemo(()=>rawEvents.filter(isValidPoint).map(normalizedPoint),[data]);
  return <div><div className="page-heading"><div><div className="eyebrow">GEOVISUALIZACIÓN / PERÚ</div><h1>Mapa sísmico</h1><p>Epicentros observados reportados por USGS sobre cartografía OpenStreetMap. No es una predicción ni alerta oficial.</p></div></div>
  <Filters days={days} setDays={setDays} minimum={minimum} setMinimum={setMinimum}/><Notice busy={busy} error={error}/>
  {data&&<div className="sismo-map-diagnostics" role="status">API USGS: <strong>{rawEvents.length} eventos recibidos</strong> · <strong>{events.length} coordenadas válidas</strong> · {rawEvents.length-events.length} descartados · consulta {dateUTC(data.queried_at)}{data.sampled?' · muestra limitada a 1000':''}</div>}
  {!busy&&!error&&data&&events.length===0&&<div className="sismo-map-empty-banner" role="status">No hay epicentros para mostrar. Prueba un período mayor o una magnitud mínima menor. Si USGS tiene eventos pero aquí indica cero, revisa la petición <code>/api/v1/analytics/map</code> en las herramientas de red.</div>}
  <div className="sismo-map-layout"><section className="panel sismo-map"><LeafletCanvas items={events} onSelect={selectPoint}/><p className="sismo-note">Fuente: {data?.source||'USGS FDSN'} · Período: {days} días · Muestra: {events.length} eventos · Fecha de consulta: {data?.queried_at?dateUTC(data.queried_at):'Pendiente'}{data?.sampled?' · Muestra parcial (límite de 1000 eventos)':''}. Cartografía © OpenStreetMap contributors.</p></section>
  <aside className="panel sismo-detail"><h2>Detalle del evento</h2>{selected?<><strong>{selected.place||'Ubicación sin descripción'}</strong><p>Magnitud: {selected.magnitude??'Sin dato'}</p><p>Profundidad: {selected.depth_km??'Sin dato'} km</p><p>Fecha: {dateUTC(selected.occurred_at)}</p><p>Coordenadas: {selected.lat.toFixed(3)}, {selected.lon.toFixed(3)}</p><p>Fuente: {selected.source}</p>{selected.source_url&&<a href={selected.source_url} target="_blank" rel="noopener noreferrer">Consultar registro USGS ↗</a>}</>:<p>Selecciona un marcador del mapa para consultar el registro.</p>}<div className="sismo-note">{events.length} eventos representados{data?.sampled?' (muestra parcial)':''}. Para navegar sin desplazar toda la página utiliza los controles + y − del mapa.</div></aside></div></div>;
}
export function MagnitudeDepthScatter(){
 const [days,setDays]=useState(30);const [minimum,setMinimum]=useState('');const params=new URLSearchParams({days:String(days),peru_only:'true',limit:'1000'});if(minimum.trim()!=='')params.set('min_magnitude',minimum);
 const {data,busy,error}=useQuery<MapResult>('/api/v1/analytics/map?'+params.toString());
 const points=(data?.items||[]).filter(p=>p.depth_km!==null&&p.magnitude!==null&&Number.isFinite(p.depth_km)&&Number.isFinite(p.magnitude)).map(p=>({depth:p.depth_km as number,magnitude:p.magnitude as number,place:p.place||'Sin ubicación'}));
 return <section className="panel sismo-chart"><h2>Profundidad vs. magnitud</h2><p>Distribución de eventos observados. No indica causalidad ni predice sismos.</p><Filters days={days} setDays={setDays} minimum={minimum} setMinimum={setMinimum}/><Notice busy={busy} error={error}/>{points.length?<ResponsiveContainer width="100%" height={300}><ScatterChart margin={{top:14,right:26,bottom:22,left:8}}><CartesianGrid strokeDasharray="3 3"/><XAxis type="number" dataKey="depth" name="Profundidad" unit=" km" label={{value:'Profundidad (km)',position:'insideBottom',offset:-12}}/><YAxis type="number" dataKey="magnitude" name="Magnitud" label={{value:'Magnitud',angle:-90,position:'insideLeft'}}/><ZAxis range={[45,45]}/><Tooltip cursor={{strokeDasharray:'3 3'}}/><Scatter name="Eventos USGS" data={points} fill={colors[0]}/></ScatterChart></ResponsiveContainer>:!busy&&!error?<p>No hay eventos con profundidad y magnitud válidas para los filtros.</p>:null}<p className="sismo-note">Fuente: {data?.source||'USGS FDSN'} · Período: {days} días · Tamaño de muestra: {points.length} · Fecha de corte: {data?.queried_at?dateUTC(data.queried_at):'Pendiente'}{data?.sampled?' · Muestra parcial de hasta 1000 eventos':''}. Filtros: Perú, magnitud mínima {minimum||'sin límite adicional'}.</p></section>
}
