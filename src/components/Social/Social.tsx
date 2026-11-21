import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Bell, Clock, MapPin, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, getDoc } from '../../lib/local';
import { db, auth } from '../../lib/local';

import './almanac.css';
import { dateKey, eventsInRange, localMidnight } from '../../lib/calendar';

const MonthCard = ({ year, month, entries, isSelected, onClick }: { entries: {startDate: string; endDate?: string}[]; year: number, month: number, isSelected: boolean, onClick: () => void }) => {
  const monthDate = new Date(year, month, 1);
  const monthName = monthDate.toLocaleString('default', { month: 'long' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = monthDate.getDay();

  const days = [];
  for (let i = 0; i < startDay; i++) {
    days.push(<div key={`empty-${i}`} className="p-1"></div>);
  }
  
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  for (let i = 1; i <= daysInMonth; i++) {
    const isToday = isCurrentMonth && today.getDate() === i;
    
    const key = dateKey(new Date(year, month, i));
    const scheduled = entries.some(event => event.startDate <= key && (event.endDate || event.startDate) >= key);
    days.push(<span key={i} className="almanac-day" data-today={isToday} data-event={scheduled}>{i}</span>);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={`Open ${monthName} ${year} agenda · ${entries.length} scheduled`}
      className="almanac-month"
    >
      <h3 className="month-title">{monthName} <small>{String(month + 1).padStart(2, '0')}</small></h3>
      <div className="grid grid-cols-7 text-[11px] text-center opacity-60 mb-2 font-bold">
        <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
      </div>
      <div className="grid grid-cols-7 text-xs text-center gap-y-2 font-medium">
        {days}
      </div>
      <span className="month-foot">{entries.length ? `${entries.length} scheduled` : 'No events'}</span>
    </button>
  );
};

export default function Social() {
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'agenda'>('grid');
  const [monthDate, setMonthDate] = useState(() => new Date());
  const selectedMonth = monthDate.getMonth();
  const [dayFilter, setDayFilter] = useState<'today' | 'tomorrow' | 'all'>('all');
  const [newEvent, setNewEvent] = useState({
    title: '',
    startDate: '',
    endDate: '',
    time: '',
    location: ''
  });

  const currentYear = monthDate.getFullYear();

  useEffect(() => {
    const fetchUserRole = async () => {
      if (auth.currentUser) {
        const docRef = doc(db, 'users', auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().role === 'admin') {
          setIsAdmin(true);
        }
      }
    };
    fetchUserRole().catch(err => setError(err.message));

    const q = query(collection(db, 'events'), orderBy('startDate', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setError('');
    }, (err) => {
      console.error("Error fetching events:", err);
      setError(err.message);
    });
    return unsub;
  }, []);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'events'), {
        ...newEvent,
        createdAt: serverTimestamp(),
        userId: auth.currentUser?.uid || 'anonymous'
      });
      setShowModal(false);
      setNewEvent({ title: '', startDate: '', endDate: '', time: '', location: '' });
    } catch (err) {
      console.error("Error adding event:", err);
      alert("Failed to add event. Check console for details.");
    }
  };

  const getProgress = (start: string, end: string) => {
    if (!start || !end || start === end) return 0;
    const now = new Date().getTime();
    const s = localMidnight(start).getTime();
    const endDay = localMidnight(end);
    const e = endDay.setDate(endDay.getDate() + 1);
    if (now < s) return 0;
    if (now > e) return 100;
    return ((now - s) / (e - s)) * 100;
  };

  const day = new Date();
  if (dayFilter === 'tomorrow') day.setDate(day.getDate() + 1);
  const filteredEvents = dayFilter === 'all'
    ? eventsInRange(events, new Date(currentYear, selectedMonth, 1), new Date(currentYear, selectedMonth + 1, 0))
    : eventsInRange(events, day, day);

  const selectDay = (filter: 'today' | 'tomorrow') => {
    const target = new Date();
    if (filter === 'tomorrow') target.setDate(target.getDate() + 1);
    setMonthDate(target);
    setDayFilter(filter);
  };

  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const selectedMonthName = new Date(currentYear, selectedMonth, 1).toLocaleString('default', { month: 'long' });

  const handleMonthClick = (index: number) => {
    setDayFilter('all');
    setMonthDate(new Date(currentYear, index, 1));
    setViewMode('agenda');
  };

  const nextMonth = () => handleMonthClick(selectedMonth + 1);
  const prevMonth = () => handleMonthClick(selectedMonth - 1);

  const today = new Date();
  const todayKey = dateKey(today);
  const featured = events.find(e => e.startDate <= todayKey && (e.endDate || e.startDate) >= todayKey) || events.find(e => e.startDate > todayKey);
  const ongoing = featured && featured.startDate <= todayKey;
  const showFeatured = () => {
    if (!featured) return;
    setMonthDate(ongoing ? today : localMidnight(featured.startDate));
    setDayFilter(ongoing ? 'today' : 'all'); setViewMode('agenda');
  };
  return (
    <div className="school-almanac">
      {error && <p role="alert" className="text-red-400">{error}</p>}
      <header className="almanac-cover">
        <div className="date-leaf" aria-label={today.toLocaleDateString(undefined,{dateStyle:'full'})}>
          <span>{today.toLocaleDateString(undefined,{month:'short'})}</span><strong>{today.getDate()}</strong><small>{today.toLocaleDateString(undefined,{weekday:'short'})}</small>
        </div>
        <div className="almanac-intro"><small>Acadex / School schedule</small><h1>Campus almanac</h1><p>School dates, from a single day to the whole year.</p></div>
        <div className="almanac-feature"><small>{ongoing ? 'Happening today' : 'Next on the calendar'}</small>{featured ? <button onClick={showFeatured}><strong>{featured.title}</strong><span>{ongoing ? 'Open today’s agenda' : localMidnight(featured.startDate).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})} →</span></button> : <p>No upcoming events listed.</p>}</div>
      </header>
      <div className="almanac-bar"><div><small>Schedule explorer</small><h2>{viewMode === 'grid' ? `${currentYear} at a glance` : `${selectedMonthName} ${currentYear}`}</h2></div>
        <div className="almanac-switch" aria-label="Calendar view"><button aria-pressed={viewMode==='grid'} onClick={()=>setViewMode('grid')}>Year grid</button><button aria-pressed={viewMode==='agenda'} onClick={()=>setViewMode('agenda')}>Agenda</button></div>
      </div>
      {viewMode === 'grid' ? (
        /* Calendar Grid */
        <section aria-label="Year overview"><div className="almanac-key"><span><i /> Scheduled day</span><div><button aria-label="Previous year" onClick={()=>setMonthDate(new Date(currentYear-1,selectedMonth,1))}><ChevronLeft size={18}/></button><b>{currentYear}</b><button aria-label="Next year" onClick={()=>setMonthDate(new Date(currentYear+1,selectedMonth,1))}><ChevronRight size={18}/></button></div></div><div className="almanac-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <MonthCard 
              key={i} 
              year={currentYear} 
              month={i} 
              entries={eventsInRange(events,new Date(currentYear,i,1),new Date(currentYear,i+1,0))}
              isSelected={selectedMonth === i}
              onClick={() => handleMonthClick(i)}
            />
          ))}
        </div></section>
      ) : (
        /* Agenda View */
        <div className="almanac-agenda space-y-6">
          {/* Month Selector */}
          <div className="flex items-center justify-center gap-6 text-butter">
            <button onClick={prevMonth} className="icon-button hover:bg-butter/10 rounded-full transition-all" aria-label="Previous month">
              <ChevronLeft size={24} />
            </button>
            <div className="flex items-center gap-4 text-xl font-black tracking-widest">
              <button type="button" className="min-h-11 px-2 text-butter/40 hover:text-butter/60 transition-all" onClick={prevMonth} aria-label="Go to previous month">
                {months[(selectedMonth - 1 + 12) % 12]}
              </button>
              <span key={`${currentYear}-${selectedMonth}`} className="agenda-month-name text-3xl text-butter">
                {months[selectedMonth]}
              </span>
              <button type="button" className="min-h-11 px-2 text-butter/40 hover:text-butter/60 transition-all" onClick={nextMonth} aria-label="Go to next month">
                {months[(selectedMonth + 1) % 12]}
              </button>
            </div>
            <button onClick={nextMonth} className="icon-button hover:bg-butter/10 rounded-full transition-all" aria-label="Next month">
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Filters & Add Event */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => selectDay('today')}
                aria-pressed={dayFilter === 'today'}
                className={`px-4 py-2 rounded-full font-bold text-sm transition-all border ${dayFilter === 'today' ? 'bg-butter text-forest border-butter' : 'bg-transparent text-butter/60 border-butter/20 hover:border-butter/40 hover:text-butter'}`}
              >
                Today
              </button>
              <button 
                onClick={() => selectDay('tomorrow')}
                aria-pressed={dayFilter === 'tomorrow'}
                className={`px-4 py-2 rounded-full font-bold text-sm transition-all border ${dayFilter === 'tomorrow' ? 'bg-butter text-forest border-butter' : 'bg-transparent text-butter/60 border-butter/20 hover:border-butter/40 hover:text-butter'}`}
              >
                Tomorrow
              </button>
              <button 
                onClick={() => setDayFilter('all')}
                aria-pressed={dayFilter === 'all'}
                className={`px-4 py-2 rounded-full font-bold text-sm transition-all border ${dayFilter === 'all' ? 'bg-butter text-forest border-butter' : 'bg-transparent text-butter/60 border-butter/20 hover:border-butter/40 hover:text-butter'}`}
              >
                All
              </button>
            </div>
            {isAdmin && (
              <button 
                onClick={() => setShowModal(true)} 
                className="bg-butter text-forest px-4 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-butter/90 transition-all shadow-lg shadow-butter/20"
              >
                <Plus size={20} /> <span>Add Event</span>
              </button>
            )}
          </div>

          {/* Event List */}
          <div className="space-y-4">
            {filteredEvents.map((event) => {
              const isContinuous = event.endDate && event.endDate !== event.startDate;
              const progress = isContinuous ? getProgress(event.startDate, event.endDate) : 0;
              
              const startDateObj = localMidnight(event.startDate);
              const dayOfWeek = startDateObj.toLocaleString('default', { weekday: 'short' }).toUpperCase();
              const dayOfMonth = startDateObj.getDate();
              const monthStr = startDateObj.toLocaleString('default', { month: 'short' }).toUpperCase();

              return (
                <div key={event.id} className="almanac-entry glass-card-dark border rounded-[2rem] p-6 flex items-center gap-6 transition-all group relative overflow-hidden hover:-translate-y-1">
                  {/* Left Date Section */}
                  <div className="flex flex-col items-center justify-center min-w-[60px] shrink-0">
                    <span className="text-xs font-black text-butter/60 uppercase tracking-widest">{dayOfWeek}</span>
                    <span className="text-4xl font-black text-butter my-1">{dayOfMonth}</span>
                    <span className="text-xs font-black text-butter/60 uppercase tracking-widest">{monthStr}</span>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-16 bg-butter/20 shrink-0"></div>

                  {/* Inner Content */}
                  <div className="flex-1 min-w-0">
                    <div className="rounded-2xl w-full">
                      <div className="flex items-center gap-2 text-butter/80 text-xs font-bold mb-1">
                        <Clock size={14} />
                        <span>{event.time || 'All Day'}</span>
                      </div>
                      <h3 className="font-black text-lg text-butter break-words">{event.title}</h3>
                      {event.location && (
                        <div className="flex items-center gap-1 text-butter/60 text-xs mt-1">
                          <MapPin size={12} />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                    </div>

                    {isContinuous && (
                      <div className="mt-4 max-w-md">
                        <div className="flex justify-between text-[11px] text-butter/60 mb-1 font-bold uppercase tracking-widest">
                          <span>Event Progress</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-forest rounded-full overflow-hidden border border-butter/10">
                          <div className="h-full bg-butter transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Action */}
                  <span className="w-12 h-12 rounded-full border-2 border-butter/20 flex items-center justify-center text-butter/60 shrink-0" title="Scheduled event">
                    <Bell size={20} aria-hidden="true" />
                  </span>
                </div>
              );
            })}
            {filteredEvents.length === 0 && (
              <div className="glass-card-dark text-center py-16 rounded-[2rem] border">
                <CalendarIcon className="mx-auto text-butter/20 mb-4" size={48} />
                <p className="text-butter/60 font-bold text-lg">No events scheduled.</p>
                {isAdmin && <p className="text-butter/40 text-sm mt-1">Click 'Add Event' to create one.</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showModal && (
        <div className="almanac-overlay fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="glass-card-dark border rounded-3xl p-6 w-full max-w-md" role="dialog" aria-modal="true" aria-labelledby="event-dialog-title">
            <div className="flex justify-between items-center mb-6">
              <h2 id="event-dialog-title" className="text-2xl font-black text-butter">Add event</h2>
              <button onClick={() => setShowModal(false)} className="icon-button text-butter/60 hover:text-butter" aria-label="Close event form">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddEvent} className="space-y-4">
              <div>
                <label htmlFor="event-title" className="block text-sm font-bold text-butter/70 mb-1">Event title</label>
                <input 
                  id="event-title"
                  type="text" 
                  required
                  value={newEvent.title}
                  onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                  className="w-full bg-butter/5 border border-butter/10 rounded-xl px-4 py-3 text-butter focus:border-butter/40 focus:ring-4 focus:ring-butter/15"
                  placeholder="e.g., Science Fair"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="event-start" className="block text-sm font-bold text-butter/70 mb-1">Start date</label>
                  <input 
                    id="event-start"
                    type="date" 
                    required
                    value={newEvent.startDate}
                    onChange={e => setNewEvent({...newEvent, startDate: e.target.value})}
                    className="w-full bg-butter/5 border border-butter/10 rounded-xl px-4 py-3 text-butter focus:border-butter/40 focus:ring-4 focus:ring-butter/15"
                  />
                </div>
                <div>
                  <label htmlFor="event-end" className="block text-sm font-bold text-butter/70 mb-1">End date <span className="font-medium text-butter/45">(optional)</span></label>
                  <input 
                    id="event-end"
                    type="date" 
                    value={newEvent.endDate}
                    onChange={e => setNewEvent({...newEvent, endDate: e.target.value})}
                    className="w-full bg-butter/5 border border-butter/10 rounded-xl px-4 py-3 text-butter focus:border-butter/40 focus:ring-4 focus:ring-butter/15"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="event-time" className="block text-sm font-bold text-butter/70 mb-1">Time</label>
                  <input 
                    id="event-time"
                    type="time" 
                    value={newEvent.time}
                    onChange={e => setNewEvent({...newEvent, time: e.target.value})}
                    className="w-full bg-butter/5 border border-butter/10 rounded-xl px-4 py-3 text-butter focus:border-butter/40 focus:ring-4 focus:ring-butter/15"
                  />
                </div>
                <div>
                  <label htmlFor="event-location" className="block text-sm font-bold text-butter/70 mb-1">Location</label>
                  <input 
                    id="event-location"
                    type="text" 
                    value={newEvent.location}
                    onChange={e => setNewEvent({...newEvent, location: e.target.value})}
                    className="w-full bg-butter/5 border border-butter/10 rounded-xl px-4 py-3 text-butter focus:border-butter/40 focus:ring-4 focus:ring-butter/15"
                    placeholder="e.g., Room 101"
                  />
                </div>
              </div>

              <button type="submit" className="w-full bg-butter text-forest font-black py-4 rounded-xl mt-4 hover:bg-butter/90 transition-all">
                Save event
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
