// School events use local calendar dates, not UTC instants.
export function localMidnight(day: string) {
  return new Date(`${day}T00:00:00`);
}

export function eventsInRange<T extends { startDate: string; endDate?: string }>(events: T[], first: Date, last: Date) {
  const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const from = key(first), through = key(last);
  return events.filter(event => event.startDate && event.startDate <= through && (event.endDate || event.startDate) >= from);
}
