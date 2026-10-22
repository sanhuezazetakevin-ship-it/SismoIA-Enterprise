/** Demostración exclusivamente visual: jamás presentar estos valores como eventos reales. */
export const summary = [
  { label: 'Eventos registrados', value: '128', description: 'Ejemplo · últimos 7 días', icon: 'activity' },
  { label: 'Mayor magnitud', value: '5.8', description: 'Dato de demostración', icon: 'wave' },
  { label: 'Profundidad media', value: '42 km', description: 'Dato de demostración', icon: 'depth' },
  { label: 'Avisos pendientes', value: '03', description: 'Simulación sin envíos', icon: 'bell' }
] as const;
export const demoEvents = [
  { place: 'Costa central', magnitude: '5.8', depth: '38 km', date: 'Ejemplo · 10:42' },
  { place: 'Arequipa', magnitude: '4.6', depth: '62 km', date: 'Ejemplo · 09:18' },
  { place: 'Piura', magnitude: '3.4', depth: '25 km', date: 'Ejemplo · 07:33' },
  { place: 'Ica', magnitude: '4.1', depth: '44 km', date: 'Ejemplo · 06:12' }
] as const;
