import type { OfflineClockEvent } from "../api/clock";

const QUEUE_KEY = "clockQueue";

export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadQueue(): OfflineClockEvent[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineClockEvent[];
  } catch {
    return [];
  }
}

function saveQueue(events: OfflineClockEvent[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(events));
  } catch {
    // localStorage unavailable (private mode, full storage) — fail silently
  }
}

export function enqueue(event: OfflineClockEvent): void {
  const current = loadQueue();
  current.push(event);
  saveQueue(current);
}

export function clearKeys(keys: string[]): void {
  if (keys.length === 0) return;
  const keySet = new Set(keys);
  const remaining = loadQueue().filter((e) => !keySet.has(e.idempotencyKey));
  saveQueue(remaining);
}
