import { useState, useEffect, useCallback, useRef } from "react";
import {
  clockInOut,
  syncClockEvents,
  getClockStatus,
  ClockEventType,
} from "../api/clock";
import {
  loadQueue,
  enqueue,
  clearKeys,
  generateIdempotencyKey,
} from "../utils/clockQueue";

export type ClockState = "clocked_in" | "clocked_out" | "unknown";
export type SyncState = "idle" | "syncing" | "synced" | "error";

export interface UseClockInOutReturn {
  clockState: ClockState;
  isOnline: boolean;
  pendingCount: number;
  syncState: SyncState;
  isBusy: boolean;
  clock: (type: ClockEventType) => Promise<void>;
}

export function useClockInOut(): UseClockInOutReturn {
  const [clockState, setClockState] = useState<ClockState>("unknown");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(() => loadQueue().length);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [isBusy, setIsBusy] = useState(false);

  // Sync pending queue to server; returns true if fully synced
  const syncQueue = useCallback(async (): Promise<void> => {
    const queue = loadQueue();
    if (queue.length === 0) return;

    setSyncState("syncing");
    try {
      const response = await syncClockEvents(queue);
      // Clear events that were processed or are duplicates
      const cleared = response.results
        .filter((r) => r.status === "processed" || r.status === "duplicate")
        .map((r) => r.idempotencyKey);
      clearKeys(cleared);
      setPendingCount(loadQueue().length);
      setSyncState(loadQueue().length === 0 ? "synced" : "error");

      // Update clock state from last processed event
      if (response.results.length > 0) {
        const last = queue[queue.length - 1];
        if (last) {
          setClockState(last.type === "CLOCK_IN" ? "clocked_in" : "clocked_out");
        }
      }
    } catch {
      setSyncState("error");
    }
  }, []);

  // Fetch current clock status from server
  const fetchStatus = useCallback(async () => {
    try {
      const status = await getClockStatus();
      if (status) {
        setClockState(status.type === "CLOCK_IN" ? "clocked_in" : "clocked_out");
      } else {
        setClockState("clocked_out");
      }
    } catch {
      // Network error — leave state as unknown; queue reflects truth
    }
  }, []);

  // On mount: fetch status and sync any pending queue
  const didMount = useRef(false);
  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;

    const pending = loadQueue();
    if (pending.length > 0) {
      // Optimistically reflect last queued action
      const last = pending[pending.length - 1];
      setClockState(last.type === "CLOCK_IN" ? "clocked_in" : "clocked_out");
      if (navigator.onLine) {
        syncQueue();
      }
    } else {
      fetchStatus();
    }
  }, [fetchStatus, syncQueue]);

  // Online/offline event listeners
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      syncQueue().then(() => fetchStatus());
    }
    function handleOffline() {
      setIsOnline(false);
      setSyncState("idle");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncQueue, fetchStatus]);

  const clock = useCallback(
    async (type: ClockEventType) => {
      if (isBusy) return;
      setIsBusy(true);

      // Optimistically update UI
      setClockState(type === "CLOCK_IN" ? "clocked_in" : "clocked_out");

      const idempotencyKey = generateIdempotencyKey();
      const clientTimestamp = new Date().toISOString();

      if (!navigator.onLine) {
        // Offline: queue event for later sync
        enqueue({ type, clientTimestamp, idempotencyKey });
        setPendingCount(loadQueue().length);
        setSyncState("idle");
        setIsBusy(false);
        return;
      }

      // Online: post directly
      try {
        await clockInOut({ type, idempotencyKey, timestamp: clientTimestamp });
        setSyncState("synced");
      } catch {
        // Failed even though online — queue for retry
        enqueue({ type, clientTimestamp, idempotencyKey });
        setPendingCount(loadQueue().length);
        setSyncState("error");
      } finally {
        setIsBusy(false);
      }
    },
    [isBusy]
  );

  return { clockState, isOnline, pendingCount, syncState, isBusy, clock };
}
