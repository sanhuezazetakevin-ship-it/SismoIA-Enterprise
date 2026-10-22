import { NavLink, Outlet } from 'react-router-dom';
import { Activity, BarChart3, Bell, BrainCircuit, Database, FileText, LayoutDashboard, MapPinned, Settings, ShieldCheck } from 'lucide-react';
import { Brand } from '../components/Brand';
import { ThemeToggle } from '../components/ThemeToggle';
import {useAuth} from './auth';
import {logout} from '../services/auth';
import {useNavigate} from 'react-router-dom';
const navigation = [
  {name:'Panel general',path:'/app',icon:LayoutDashboard,end:true},
  {name:'Mapa sísmico',path:'/app/mapa',icon:MapPinned},
  {name:'Eventos',path:'/app/eventos',icon:Activity},
  {name:'Estadísticas',path:'/app/estadisticas',icon:BarChart3},
  {name:'Laboratorio ML',path:'/app/ml',icon:BrainCircuit},
  {name:'Datasets',path:'/app/datasets',icon:Database},
  {name:'Centro de alertas',path:'/app/alertas',icon:Bell},
  {name:'Reportes',path:'/app/reportes',icon:FileText},
  {name:'Configuración',path:'/app/configuracion',icon:Settings}
];
export function AppLayout(){const {user}=useAuth();const navigate=useNavigate();async function signOut(){await logout();navigate('/login',{replace:true})}return <div className="app-shell">
  <aside className="sidebar"><Brand/><div className="sidebar-heading">PLATAFORMA</div><nav aria-label="Navegación principal" className="side-links">{navigation.map(({name,path,icon:Icon,end})=><NavLink key={path} to={path} end={end} className={({isActive})=>`side-link ${isActive?'active':''}`}><Icon size={18} aria-hidden="true"/><span>{name}</span></NavLink>)}</nav><div className="sidebar-foot"><ShieldCheck size={17}/> Sesión autenticada</div></aside>
  <div className="app-main"><header className="app-top"><div><span className="eyebrow">SISMOIA ENTERPRISE</span><div className="top-title">Centro de monitoreo</div></div><div className="top-actions"><span className="demo-tag"><span className="demo-dot"/> Datos ilustrativos</span><ThemeToggle/><button className="avatar" title="Cerrar sesión" onClick={signOut} aria-label="Cerrar sesión">{user?.full_name?.slice(0,2).toUpperCase()||"US"}</button></div></header><main id="main-content" className="app-content"><Outlet/></main></div>
</div>}
