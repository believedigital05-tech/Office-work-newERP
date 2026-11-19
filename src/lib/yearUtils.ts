export function formatYearLabel(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export function parseYearLabel(label: string): number | null {
  const start = parseInt(label.slice(0, 4), 10);
  return Number.isFinite(start) ? start : null;
}

export function getNextYearLabel(label: string): string {
  const start = parseYearLabel(label);
  return start === null ? label : formatYearLabel(start + 1);
}

export function computeCurrentFYLabel(now: Date = new Date()): string {
  const year = now.getFullYear();
  // Indian financial year runs 1 April to 31 March (month index 3 === April).
  const startYear = now.getMonth() >= 3 ? year : year - 1;
  return formatYearLabel(startYear);
}

export function computeCurrentAYLabel(now: Date = new Date()): string {
  return getNextYearLabel(computeCurrentFYLabel(now));
}

export function findClosestLabel(labels: string[], target: string): string {
  if (labels.length === 0 || labels.includes(target)) return target;
  const targetStart = parseYearLabel(target);
  if (targetStart === null) return labels[0];
  let best = labels[0];
  let bestDiff = Infinity;
  for (const label of labels) {
    const start = parseYearLabel(label);
    if (start === null) continue;
    const diff = Math.abs(start - targetStart);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = label;
    }
  }
  return best;
}
