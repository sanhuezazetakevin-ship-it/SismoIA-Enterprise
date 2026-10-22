/** Ilustración decorativa. La cartografía real se implementará con Leaflet e ingesta oficial en fases posteriores. */
export function MapPreview(){ return <div className="map-preview"><svg viewBox="0 0 720 330" role="img" aria-label="Mapa esquemático de Perú con puntos ficticios. No representa eventos reales." preserveAspectRatio="xMidYMid slice">
<rect width="720" height="330" className="ocean"/>
<path d="M0 0H340L370 45L355 78L386 118L392 158L421 190L414 233L451 281L478 330H720V0Z" className="continent"/>
<path d="M340 0L370 45L355 78L386 118L392 158L421 190L414 233L451 281L478 330" className="coast"/>
<path d="M470 0L481 63L505 110L492 164L525 211L541 330" className="inland"/>
<text x="465" y="95" className="map-label">PERÚ</text><text x="593" y="201" className="map-label">BRASIL</text><text x="72" y="213" className="ocean-label">OCÉANO PACÍFICO</text>
{[[356,56,7],[370,110,9],[396,160,6],[412,206,11],[438,251,8],[456,299,5]].map(([x,y,r],i)=><circle key={i} cx={x} cy={y} r={r} className="map-point"/>)}
</svg><div className="map-overlay">Mapa conceptual · No georreferenciado</div></div> }
