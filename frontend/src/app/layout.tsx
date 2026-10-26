import {useEffect,useState} from 'react';
import { NavLink, Outlet,useNavigate } from 'react-router-dom';
import { Activity, BarChart3, Bell, BrainCircuit, Database, FileText, LayoutDashboard, MapPinned, Settings, ShieldCheck, Menu, X, Clock, RadioTower } from 'lucide-react';
import { Brand } from '../components/Brand';
import { ThemeToggle } from '../components/ThemeToggle';
import {useAuth} from './auth';
import {logout} from '../services/auth';
const navigation = [
 {name:'Panel general',path:'/app',icon:LayoutDashboard,end:true},
 {name:'Mapa sísmico',path:'/app/mapa',icon:MapPinned},
 {name:'Eventos observados',path:'/app/eventos',icon:Activity},
 {name:'Análisis estadístico',path:'/app/estadisticas',icon:BarChart3},
 {name:'Laboratorio ML',path:'/app/ml',icon:BrainCircuit},
 {name:'Datasets',path:'/app/datasets',icon:Database},
 {name:'Centro de avisos',path:'/app/alertas',icon:Bell},
 {name:'Reportes',path:'/app/reportes',icon:FileText},
 {name:'Configuración',path:'/app/configuracion',icon:Settings}
];
function chooseStart(roles:string[]){if(roles.includes('OPERADOR_ALERTAS'))return '/app/alertas';if(roles.includes('ANALISTA'))return '/app/ml';if(roles.includes('AUDITOR'))return '/app/reportes';return '/app'}
export function AppLayout(){const {user}=useAuth();const navigate=useNavigate();const [drawer,setDrawer]=useState(false);const [now,setNow]=useState(()=>new Date());const [health,setHealth]=useState<'loading'|'ok'|'fail'>('loading');
 useEffect(()=>{const timer=window.setInterval(()=>setNow(new Date()),60000);return()=>window.clearInterval(timer)},[]);
 useEffect(()=>{let active=true;const ctrl=new AbortController();const timer=window.setTimeout(()=>ctrl.abort(),5000);fetch(`${(import.meta.env.VITE_API_BASE_URL||'http://localhost:8000').replace(/\/$/,'')}/api/v1/health`,{signal:ctrl.signal}).then(r=>{if(active)setHealth(r.ok?'ok':'fail')}).catch(()=>{if(active)setHealth('fail')}).finally(()=>window.clearTimeout(timer));return()=>{active=false;ctrl.abort();window.clearTimeout(timer)}},[]);
 const roles=user?.roles||[];const role=roles[0]||'CONSULTA';const start=chooseStart(roles);
 const ordered=[...navigation].sort((a,b)=>Number(b.path===start)-Number(a.path===start));
 async function signOut(){await logout();navigate('/login',{replace:true})}
 return <div className="app-shell"><a href="#main-content" className="sismo-skip">Saltar al contenido</a>{drawer&&<button className="drawer-backdrop" aria-label="Cerrar navegación" onClick={()=>setDrawer(false)}/>}
 <aside className={`sidebar ${drawer?'sidebar-open':''}`}><div className="sidebar-brand-line"><Brand/><button className="drawer-close" onClick={()=>setDrawer(false)} aria-label="Cerrar menú"><X size={20}/></button></div><div className="sidebar-heading">PLATAFORMA</div><nav aria-label="Navegación principal" className="side-links">{ordered.map(({name,path,icon:Icon,end})=><NavLink key={path} to={path} end={end} onClick={()=>setDrawer(false)} className={({isActive})=>`side-link ${isActive?'active':''}`}><Icon size={18} aria-hidden="true"/><span>{name}</span></NavLink>)}</nav><div className="sidebar-foot"><ShieldCheck size={17}/> Avisos sujetos a revisión humana</div></aside>
 <div className="app-main"><header className="app-top"><div className="top-identity"><button className="drawer-menu" onClick={()=>setDrawer(true)} aria-label="Abrir menú" aria-expanded={drawer}><Menu size={21}/></button><div><span className="eyebrow">SISMOIA ENTERPRISE</span><div className="top-title">Centro de monitoreo</div></div></div><div className="top-actions"><span className="top-source" title="Estado de conexión de la API; no confirma la disponibilidad de USGS"><RadioTower size={15}/> API: {health==='loading'?'Comprobando':health==='ok'?'Disponible':'Sin respuesta'}</span><span className="top-clock"><Clock size={14}/><span>{now.toLocaleTimeString('es-PE',{timeZone:'UTC',hour:'2-digit',minute:'2-digit',hour12:false})} UTC<br/>{now.toLocaleTimeString('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false})} Lima</span></span><span className="top-user"><strong>{user?.full_name||'Usuario'}</strong><small>{role.replaceAll('_',' ')}</small></span><ThemeToggle/><button className="avatar" title="Cerrar sesión" onClick={signOut} aria-label="Cerrar sesión">{user?.full_name?.slice(0,2).toUpperCase()||'US'}</button></div></header><main id="main-content" className="app-content" tabIndex={-1}><Outlet/></main></div></div>
}
