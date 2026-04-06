import { axiosInstance as axios } from "./axiosInstance";

export type ClockEventType = "CLOCK_IN" | "CLOCK_OUT";

export interface ClockStatus {
  id: string;
  type: ClockEventType;
  timestamp: string;
}

export interface ClockInOutPayload {
  type: ClockEventType;
  idempotencyKey: string;
  timestamp?: string;
  shiftId?: string;
  notes?: string;
}

export interface OfflineClockEvent {
  type: ClockEventType;
  clientTimestamp: string;
  idempotencyKey: string;
  shiftId?: string;
  notes?: string;
}

export interface SyncResult {
  idempotencyKey: string;
  status: "processed" | "duplicate" | "error";
  timeEntryId?: string;
  error?: string;
}

export interface SyncResponse {
  processed: number;
  duplicates: number;
  errors: number;
  results: SyncResult[];
}

export async function clockInOut(payload: ClockInOutPayload): Promise<ClockStatus> {
  const { data } = await axios.post<ClockStatus>("/api/clock", payload);
  return data;
}

export async function syncClockEvents(
  events: OfflineClockEvent[]
): Promise<SyncResponse> {
  const { data } = await axios.post<SyncResponse>("/api/clock/sync", { events });
  return data;
}

export async function getClockStatus(): Promise<ClockStatus | null> {
  const { data } = await axios.get<ClockStatus | null>("/api/clock/status");
  return data;
}
