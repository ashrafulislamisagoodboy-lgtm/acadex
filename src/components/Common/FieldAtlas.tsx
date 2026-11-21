import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const plates = [
  { name: 'Cassiopeia', note: 'Five bright stars form a W in the northern sky.', points: [[91,84],[153,153],[218,106],[278,130],[347,65]] },
  { name: 'The Summer Triangle', note: 'Vega, Deneb and Altair belong to three different constellations.', points: [[126,76],[310,92],[226,176]] },
  { name: 'The observatory', note: 'A field sketch of the hilltop observing station.', points: [] },
];
// Fixed positions keep the printed star field identical on every visit.
const sky = [[31,54],[38,116],[68,73],[83,169],[104,23],[104,126],[143,43],[167,105],[149,186],[187,63],[197,162],[214,31],[238,72],[265,183],[280,46],[302,167],[314,117],[328,30],[347,145],[360,192],[388,93],[411,57],[428,137],[441,180],[59,197],[73,37],[240,143],[195,204],[374,121]];

export default function FieldAtlas() {
  const [page, setPage] = useState(0);
  const { name, note, points } = plates[page];
  const path = points.map(([x,y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ') + (page === 1 ? ' Z' : '');
  const turn = (direction: number) => setPage(i => (i + direction + plates.length) % plates.length);
  return <figure className="field-atlas" aria-label="Illustrated field atlas">
    <div className="atlas-band"><span>Field atlas</span><span>Plate 0{page+1} / 03</span></div>
    <div key={page} className={`atlas-picture ${points.length ? 'is-night' : 'is-land'}`}>
      {points.length ? <svg viewBox="0 0 460 210" aria-hidden="true" fill="none">
        <g stroke="#82a5ad" opacity=".26" strokeWidth=".7">
          <circle cx="218" cy="107" r="64"/><circle cx="218" cy="107" r="100" strokeDasharray="2 5"/>
          <ellipse cx="218" cy="107" rx="184" ry="73" transform="rotate(-14 218 107)"/>
          <path d="M18 107h424M218 12v186" strokeDasharray="2 6"/>
        </g>
        {sky.map(([x,y],i) => <circle key={x+':'+y} cx={x} cy={y} r={i%3===0 ? 1.5 : .85} fill="#e7e9d6"/>)}
        <g stroke="#d0a66b" strokeWidth="1"><path d="M19 33V17h16m391 0h15v16M19 177v15h16m391 0h15v-15"/></g>
        <path className="star-trace" d={path} stroke="#e9be83" strokeWidth="1.8" pathLength="1"/>
        {points.map(([x,y],i) => <g key={i} className="atlas-star" style={{animationDelay:`${i * 90}ms`}}>
          <circle cx={x} cy={y} r="7" stroke="#d6c7a5" opacity=".45"/>
          <path d={`M${x} ${y-5}l1.6 3.4L${x+5} ${y}l-3.4 1.6L${x} ${y+5}l-1.6-3.4L${x-5} ${y}l3.4-1.6z`} fill="#fff2c8"/>
        </g>)}
        {page===1 && <g fill="#eedcba" fontSize="10" fontFamily="monospace"><text x="96" y="64">Vega</text><text x="320" y="90">Deneb</text><text x="233" y="191">Altair</text></g>}
      </svg> : <img src="/observatory.svg" alt="Hilltop observatory in pen and ink"/>}
    </div>
    <figcaption className="atlas-caption">
      <div aria-live="polite" aria-atomic="true"><strong>{name}</strong><p>{note}</p></div>
      <div className="atlas-controls"><button type="button" aria-label="Previous atlas plate" onClick={() => turn(-1)}><ChevronLeft size={17}/></button><button type="button" aria-label="Next atlas plate" onClick={() => turn(1)}><ChevronRight size={17}/></button></div>
    </figcaption>
  </figure>;
}
