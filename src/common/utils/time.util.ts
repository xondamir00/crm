export function hhmmToMinutes(hhmm: string): number {
  if (!/^\d{2}:\d{2}$/.test(hhmm))
    throw new Error('Invalid time format, expected HH:mm');
  const [h, m] = hhmm.split(':').map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) throw new Error('Invalid time value');
  return h * 60 + m;
}

export function minutesToHhmm(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
