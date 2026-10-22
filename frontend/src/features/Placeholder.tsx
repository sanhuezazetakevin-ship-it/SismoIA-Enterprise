import { Link } from 'react-router-dom';
import { Construction } from 'lucide-react';
export function Placeholder({title,description}:{title:string;description:string}){return <div className="placeholder"><span className="placeholder-icon"><Construction size={26}/></span><span className="eyebrow">MÓDULO PLANIFICADO</span><h1>{title}</h1><p>{description}</p><p>Este módulo se implementará en su fase correspondiente. No se muestran resultados inventados como si fueran reales.</p><Link to="/app" className="button button-primary">Regresar al panel</Link></div>}
