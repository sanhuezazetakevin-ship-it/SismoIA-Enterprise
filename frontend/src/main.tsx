import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './app/theme';
import { AuthProvider, Protected } from './app/auth';
import { AppLayout } from './app/layout';
import { Landing } from './features/Landing';
import { Login } from './features/Login';
import { Dashboard } from './features/Dashboard';
import { Events } from './features/Events';
import { Statistics, SeismicMap } from './features/SeismicAnalytics';
import { Placeholder } from './features/Placeholder';
import { Datasets } from './features/Datasets';
import { MLLab } from './features/MLLab';
import { Alerts } from './features/Alerts';
import { Reports } from './features/Reports';
import { Configuration } from './features/Configuration';
import './styles/index.css';
import './styles/tokens.css';
import './styles/enterprise.css';
const modules = [
  ['mapa','Mapa sísmico','Consulta cartográfica con filtros de eventos verificados (Fase 4).'],
  ['eventos','Eventos sísmicos','Registro consultable con fecha, magnitud, profundidad y fuente (Fase 3).'],
  ['estadisticas','Análisis estadístico','Series temporales, distribuciones y métricas descriptivas (Fase 4).'],
  ['ml','Machine Learning','Entrenamiento y evaluación de experimentos ML (Fase 6).'],
  ['datasets','Datasets','Calidad y versionado de conjuntos de datos (Fase 5).'],
  ['alertas','Centro de alertas','Revisión y autorización humana de notificaciones (Fase 7).'],
  ['reportes','Reportes','Exportación de informes y análisis (Fase 8).'],
  ['configuracion','Configuración','Usuarios, roles y parámetros (Fases 2 y 8).']
];
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ThemeProvider><AuthProvider><BrowserRouter><Routes>
  <Route path="/" element={<Landing/>}/><Route path="/login" element={<Login/>}/><Route path="/app" element={<Protected><AppLayout/></Protected>}><Route index element={<Dashboard/>}/>{modules.map(([path,title,description])=><Route key={path} path={path} element={path==='eventos'?<Events/>:path==='mapa'?<SeismicMap/>:path==='estadisticas'?<Statistics/>:path==='datasets'?<Datasets/>:path==='ml'?<MLLab/>:path==='alertas'?<Alerts/>:path==='reportes'?<Reports/>:path==='configuracion'?<Configuration/>:<Placeholder title={title} description={description}/>}/>)}</Route>
  <Route path="*" element={<Navigate to="/" replace/>}/>
</Routes></BrowserRouter></AuthProvider></ThemeProvider></React.StrictMode>);
