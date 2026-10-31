const clockFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const shortDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
});

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatClock(date: Date): string {
  return clockFormatter.format(date);
}

export function formatShortDate(date: Date): string {
  return shortDateFormatter.format(date).replace('.', '');
}

export function formatTime(date: Date | string): string {
  return timeFormatter.format(typeof date === 'string' ? new Date(date) : date);
}

export function formatSessionTime(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  return isToday ? formatTime(date) : shortDateFormatter.format(date).replace('.', '');
}
