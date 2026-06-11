/** 시간 표현 유틸 (순수 함수). */

export function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}

/** ISO 문자열 → 로컬 "HH:MM" (파싱 불가 시 "--:--") */
export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** 4000 → "4.0s", 250 → "0.3s", 95000 → "1m 35s" */
export function formatDuration(ms: number): string {
  if (ms < 0) return '0.0s';
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}
