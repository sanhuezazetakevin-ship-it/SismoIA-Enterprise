const numbers = [10, 14, 11, 21, 17, 19, 15];
export function DemoChart() {
  const width = 560, height = 158, max = 24;
  const pts = numbers.map((v,i) => `${24+i*85},${136-(v/max)*112}`).join(' ');
  return <div className="chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico ilustrativo de eventos durante una semana" preserveAspectRatio="none">
    {[28,70,112,140].map(y=><line key={y} x1="20" y1={y} x2="548" y2={y} className="chart-grid"/>)}
    <polyline points={pts} fill="none" className="chart-line" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
    {numbers.map((v,i)=><circle key={i} cx={24+i*85} cy={136-(v/max)*112} r="4" className="chart-point"/>)}
  </svg><div className="chart-days">{['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=><span key={d}>{d}</span>)}</div></div>;
}
