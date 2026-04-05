/**
 * Swap Requests API client — TIM-197
 *
 * Matches the endpoint spec from TIM-196 (BE):
 *   POST   /api/swap-requests
 *   PATCH  /api/swap-requests/:id/respond  (target employee)
 *   PATCH  /api/swap-requests/:id/resolve  (manager)
 *   GET    /api/swap-requests?scheduleId=&status=
 *   GET    /api/swap-requests/:id
 */

import { axiosInstance as axios } from "./axiosInstance";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SwapStatus =
  | "pending_target"
  | "pending_manager"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

export interface SwapParticipant {
  id: string;
  firstName: string;
  lastName: string;
}

export interface SwapShift {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  role: string | null;
  date: string;
}

export interface SwapRequest {
  id: string;
  scheduleId: string;
  status: SwapStatus;
  requestingEmployee: SwapParticipant;
  requestingShift: SwapShift;
  targetEmployee: SwapParticipant;
  targetShift: SwapShift;
  message: string | null;
  declineReason: string | null;
  rejectReason: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface EligibleCoworker {
  id: string;
  firstName: string;
  lastName: string;
  role: string | null;
  shift: SwapShift | null;
  hasPendingRequest: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function createSwapRequest(payload: {
  requestingShiftId: string;
  targetEmployeeId: string;
  targetShiftId: string;
  message?: string;
}): Promise<SwapRequest> {
  const { data } = await axios.post<SwapRequest>("/api/swap-requests", payload);
  return data;
}

export async function respondToSwapRequest(
  id: string,
  payload: { action: "accept" | "decline"; reason?: string }
): Promise<SwapRequest> {
  const { data } = await axios.patch<SwapRequest>(
    `/api/swap-requests/${id}/respond`,
    payload
  );
  return data;
}

export async function resolveSwapRequest(
  id: string,
  payload: { action: "approve" | "reject"; reason?: string }
): Promise<SwapRequest> {
  const { data } = await axios.patch<SwapRequest>(
    `/api/swap-requests/${id}/resolve`,
    payload
  );
  return data;
}

export async function cancelSwapRequest(id: string): Promise<SwapRequest> {
  const { data } = await axios.patch<SwapRequest>(
    `/api/swap-requests/${id}/cancel`
  );
  return data;
}

export async function fetchSwapRequests(params?: {
  scheduleId?: string;
  status?: SwapStatus | SwapStatus[];
}): Promise<SwapRequest[]> {
  const searchParams = new URLSearchParams();
  if (params?.scheduleId) searchParams.set("scheduleId", params.scheduleId);
  if (params?.status) {
    const statuses = Array.isArray(params.status)
      ? params.status
      : [params.status];
    statuses.forEach((s) => searchParams.append("status", s));
  }
  const { data } = await axios.get<SwapRequest[]>(
    `/api/swap-requests?${searchParams.toString()}`
  );
  return data;
}

export async function getSwapRequest(id: string): Promise<SwapRequest> {
  const { data } = await axios.get<SwapRequest>(`/api/swap-requests/${id}`);
  return data;
}

export async function fetchEligibleCoworkers(
  shiftId: string
): Promise<EligibleCoworker[]> {
  const { data } = await axios.get<EligibleCoworker[]>(
    `/api/swap-requests/eligible-coworkers?shiftId=${shiftId}`
  );
  return data;
}
