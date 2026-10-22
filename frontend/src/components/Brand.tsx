import { Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
export function Brand() { return <Link className="brand" to="/" aria-label="SismoIA Enterprise, ir al inicio"><span className="brand-symbol"><Activity size={20} strokeWidth={2.6}/></span><span><strong>SismoIA</strong><small>ENTERPRISE</small></span></Link>; }
