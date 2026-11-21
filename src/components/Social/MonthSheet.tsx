import { useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, Grid2X2 } from 'lucide-react';
import { eventsInRange } from '../../lib/calendar';
import './month-sheet.css';

type SchoolEvent = {id:string; title:string; startDate:string; endDate?:string; time?:string; location?:string};
// The native modal keeps focus inside and makes the grid beneath it inert.
// Its transparent, viewport-sized surface is the outside-click target.
export function MonthOverlay({ children, onDismiss }: { children: React.ReactNode; onDismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [ready,setReady] = useState(false);
  useLayoutEffect(() => {
    const element = dialog.current!;
    element.showModal();
    setReady(true);
    return () => element.close();
  }, []);
  return <dialog ref={dialog} className="month-overlay" aria-labelledby="month-title"
    onCancel={event => { event.preventDefault(); onDismiss(); }}
    onClick={event => { if (event.target === event.currentTarget) onDismiss(); }}>
    {ready && children}
  </dialog>;
}

export default function MonthSheet({year, month, events, onMove, onBack}: {
  year:number; month:number; events:SchoolEvent[]; onMove:(direction:number)=>void; onBack:()=>void;
}) {
  const still = useReducedMotion();
  const heading = useRef<HTMLHeadingElement>(null);
  const [selected,setSelected] = useState<number | null>(null);
  useLayoutEffect(() => { heading.current?.focus({preventScroll:true}); }, []);
  const first = new Date(year,month,1), last = new Date(year,month+1,0), today = new Date();
  const entries = eventsInRange(events,first,last);
  const days = Array.from({length:last.getDate()}, (_,i) => {
    const date = new Date(year,month,i+1);
    return {date, items:eventsInRange(entries,date,date)};
  });
  const picked = selected === null ? null : days[selected-1];
  return <motion.section className="month-sheet" aria-labelledby="month-title" layoutId={still ? undefined : `month-${year}-${month}`} transition={{duration:.32,ease:[.2,.75,.25,1]}}>
    <header><div><button className="year-return" onClick={onBack}><Grid2X2 size={16}/> Year grid</button><h2 id="month-title" ref={heading} tabIndex={-1}>{first.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h2></div>
      <div className="sheet-arrows"><button aria-label="Previous month" onClick={()=>onMove(-1)}><ChevronLeft/></button><button aria-label="Next month" onClick={()=>onMove(1)}><ChevronRight/></button></div></header>
    <p className="sheet-legend"><i aria-hidden="true"/> Event day · Select a date for details</p>
    <div className="sheet-grid">
      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><span className="sheet-weekday" key={d}>{d}</span>)}
      {Array.from({length:first.getDay()},(_,i)=><span key={`empty-${i}`} aria-hidden="true"/>)}
      {days.map(({date,items})=><button key={date.getDate()} className="sheet-day" data-event={!!items.length} aria-pressed={selected===date.getDate()} aria-current={date.toDateString()===today.toDateString()?'date':undefined} aria-label={`${date.toLocaleDateString(undefined,{dateStyle:'full'})}, ${items.length} ${items.length===1?'event':'events'}`} onClick={()=>setSelected(date.getDate())}>
        <b>{date.getDate()}</b>{!!items.length && <><span className="sheet-mark" aria-hidden="true"/><small>{items[0].title}{items.length>1 && ` +${items.length-1}`}</small></>}
      </button>)}
    </div>
    <div className="sheet-detail" aria-live="polite">{picked ? <><h3>{picked.date.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})}</h3>{picked.items.length ? <ul>{picked.items.map(event=><li key={event.id}><strong>{event.title}</strong><span>{event.time || 'All day'}{event.location && ` · ${event.location}`}</span></li>)}</ul> : <p>No events scheduled for this day.</p>}</> : <p>{entries.length ? `${entries.length} scheduled ${entries.length===1?'event':'events'} this month.` : 'No events scheduled this month.'}</p>}</div>
  </motion.section>;
}
