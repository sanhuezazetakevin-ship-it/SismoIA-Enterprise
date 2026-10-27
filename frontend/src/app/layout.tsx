import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bell,
  BrainCircuit,
  Database,
  FileText,
  LayoutDashboard,
  MapPinned,
  Settings,
  Menu,
  X,
  Clock,
  LogOut,
  ChevronRight
} from 'lucide-react';
import { Brand } from '../components/Brand';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from './auth';
import { logout } from '../services/auth';

type NavItem = {
  name: string;
  path: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
};

type NavGroup = {
  category: string;
  items: NavItem[];
};

const navigationGroups: NavGroup[] = [
  {
    category: 'Monitoreo y Operaciones',
    items: [
      { name: 'Panel general', path: '/app', icon: LayoutDashboard, end: true },
      { name: 'Mapa sísmico', path: '/app/mapa', icon: MapPinned },
      { name: 'Eventos observados', path: '/app/eventos', icon: Activity },
      { name: 'Análisis estadístico', path: '/app/estadisticas', icon: BarChart3 }
    ]
  },
  {
    category: 'Inteligencia Analítica',
    items: [
      { name: 'Laboratorio ML', path: '/app/ml', icon: BrainCircuit },
      { name: 'Datasets y calidad', path: '/app/datasets', icon: Database }
    ]
  },
  {
    category: 'Gobernanza y Reportes',
    items: [
      { name: 'Centro de avisos', path: '/app/alertas', icon: Bell },
      { name: 'Reportes oficiales', path: '/app/reportes', icon: FileText },
      { name: 'Configuración', path: '/app/configuracion', icon: Settings }
    ]
  }
];

export function AppLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 10000);
    return () => window.clearInterval(timer);
  }, []);

  const roles = user?.roles || [];
  const primaryRole = roles[0] || 'CONSULTA';

  async function signOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  const currentItem = navigationGroups
    .flatMap((g) => g.items)
    .find((item) => (item.end ? location.pathname === item.path : location.pathname.startsWith(item.path)));

  const currentGroup = navigationGroups.find((g) => g.items.some((i) => i.path === currentItem?.path));

  return (
    <div className="app-shell">
      {/* Enlace accesible oculto (solo visible en navegación por teclado con Tab) */}
      <a href="#main-content" className="sismo-skip">
        Saltar al contenido principal
      </a>

      {drawer && (
        <button
          className="drawer-backdrop"
          aria-label="Cerrar navegación"
          onClick={() => setDrawer(false)}
        />
      )}

      {/* Sidebar Corporativo Limpio */}
      <aside className={`sidebar ${drawer ? 'sidebar-open' : ''}`} aria-label="Navegación principal">
        <div className="sidebar-header">
          <Brand />
          <button
            className="drawer-close"
            onClick={() => setDrawer(false)}
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav-container">
          {navigationGroups.map((group) => (
            <div key={group.category} className="nav-category">
              <span className="nav-category-title">{group.category}</span>
              {group.items.map(({ name, path, icon: Icon, end }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={end}
                  onClick={() => setDrawer(false)}
                  className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}
                >
                  <Icon size={17} strokeWidth={2} aria-hidden="true" />
                  <span>{name}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Área de Contenido Principal y Barra Superior */}
      <div className="app-main">
        <header className="app-top">
          <div className="top-left">
            <button
              className="drawer-toggle"
              onClick={() => setDrawer(true)}
              aria-label="Abrir navegación lateral"
            >
              <Menu size={18} />
            </button>

            <div className="top-breadcrumbs">
              <span>SismoIA</span>
              <ChevronRight size={13} strokeWidth={2.5} />
              <span>{currentGroup?.category || 'Operaciones'}</span>
              <ChevronRight size={13} strokeWidth={2.5} />
              <span className="crumb-current">{currentItem?.name || 'Panel'}</span>
            </div>
          </div>

          <div className="top-actions">
            {/* Reloj Ejecutivo Lima / UTC */}
            <div className="dual-clock">
              <Clock size={13} />
              <span>
                <strong>
                  {now.toLocaleTimeString('es-PE', {
                    timeZone: 'America/Lima',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  })}
                </strong>{' '}
                Lima
              </span>
              <span className="clock-divider">/</span>
              <span>
                {now.toLocaleTimeString('es-PE', {
                  timeZone: 'UTC',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                })}{' '}
                UTC
              </span>
            </div>

            {/* Alternador de Tema */}
            <ThemeToggle />

            {/* Perfil de Usuario Minimalista */}
            <div className="user-profile-menu">
              <div className="user-profile-info">
                <strong>{user?.full_name || 'Operador'}</strong>
                <span className="role-badge">{primaryRole.replaceAll('_', ' ')}</span>
              </div>
              <button
                className="avatar-btn"
                title="Cerrar sesión"
                onClick={signOut}
                aria-label="Cerrar sesión"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </header>

        <main id="main-content" className="app-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
