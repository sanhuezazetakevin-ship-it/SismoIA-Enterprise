import {Activity, FlaskConical, FileCheck2} from 'lucide-react';
export type SismoStatus='observed'|'experimental'|'informational';
const defs={observed:{label:'OBSERVADO',Icon:Activity},experimental:{label:'EXPERIMENTAL',Icon:FlaskConical},informational:{label:'AVISO INFORMATIVO',Icon:FileCheck2}};
export function StatusBadge({type}:{type:SismoStatus}){const {label,Icon}=defs[type];return <span className={`sismo-status sismo-status--${type}`} aria-label={`Tipo de información: ${label}`}><Icon size={14} aria-hidden="true"/>{label}</span>}
