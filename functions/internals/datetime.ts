export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function getJstToday(): Date {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value) - 1;
  const day = Number(parts.find((p) => p.type === "day")!.value);
  return new Date(year, month, day);
}

function msToDays(ms: number): number {
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function calcElapsedRate(semStart: string, semEnd: string): number {
  const start = new Date(semStart + "T00:00:00+09:00");
  const end = new Date(semEnd + "T00:00:00+09:00");
  const today = getJstToday();
  const total = msToDays(end.getTime() - start.getTime());
  const elapsed = Math.max(0, msToDays(today.getTime() - start.getTime()));
  if (total <= 0) return 100;
  return round1(Math.min(100, (elapsed / total) * 100));
}

export function renderBar(pct: number, total = 10): string {
  const filled = Math.round((pct / 100) * total);
  const empty = total - filled;
  return "\u2588".repeat(filled) + "\u2591".repeat(empty);
}
