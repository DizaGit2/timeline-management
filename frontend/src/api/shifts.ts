/// <reference types="vite/client" />
import axios from "axios";

const API = (import.meta as ImportMeta & { env: Record<string, string> }).env?.VITE_API_URL ?? "";

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
}

export interface Schedule {
  id: string;
  name: string;
}

export interface ShiftAssignment {
  employeeId: string;
  assignedAt: string;
  employee: Employee;
}

export interface Shift {
  id: string;
  scheduleId: string;
  schedule: Schedule;
  employeeId: string | null;
  employee: Employee | null;
  assignments: ShiftAssignment[];
  title: string;
  startTime: string;
  endTime: string;
  location: string | null;
  role: string | null;
  requiredHeadcount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShiftConflict {
  type: "double_booked" | "unavailable";
  shiftId?: string;
  message: string;
}

export interface CreateShiftPayload {
  scheduleId: string;
  title: string;
  startTime: string;
  endTime: string;
  location?: string;
  role?: string;
  requiredHeadcount?: number;
  notes?: string;
  employeeId?: string;
}

export type UpdateShiftPayload = {
  title?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  role?: string;
  requiredHeadcount?: number;
  notes?: string;
  employeeId?: string | null;
};

export interface ShiftFilters {
  scheduleId?: string;
  employeeId?: string;
  from?: string;
  to?: string;
}

function authHeader() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchShifts(filters?: ShiftFilters): Promise<Shift[]> {
  const params = new URLSearchParams();
  if (filters?.scheduleId) params.set("scheduleId", filters.scheduleId);
  if (filters?.employeeId) params.set("employeeId", filters.employeeId);
  if (filters?.from) params.set("from", filters.from);
  if (filters?.to) params.set("to", filters.to);

  const { data } = await axios.get<Shift[]>(`${API}/api/shifts`, {
    params,
    headers: authHeader(),
  });
  return data;
}

export async function createShift(payload: CreateShiftPayload): Promise<Shift> {
  const { data } = await axios.post<Shift>(`${API}/api/shifts`, payload, {
    headers: authHeader(),
  });
  return data;
}

export async function updateShift(
  id: string,
  payload: UpdateShiftPayload
): Promise<Shift> {
  const { data } = await axios.put<Shift>(`${API}/api/shifts/${id}`, payload, {
    headers: authHeader(),
  });
  return data;
}

export async function deleteShift(id: string): Promise<void> {
  await axios.delete(`${API}/api/shifts/${id}`, { headers: authHeader() });
}

export async function assignEmployees(
  shiftId: string,
  employeeIds: string[]
): Promise<Shift> {
  const { data } = await axios.post<Shift>(
    `${API}/api/shifts/${shiftId}/assign`,
    { employeeIds },
    { headers: authHeader() }
  );
  return data;
}

export async function removeAssignment(
  shiftId: string,
  employeeId: string
): Promise<void> {
  await axios.delete(`${API}/api/shifts/${shiftId}/employees/${employeeId}`, {
    headers: authHeader(),
  });
}

export async function fetchShiftConflicts(
  shiftId: string,
  employeeId?: string
): Promise<ShiftConflict[]> {
  const params = new URLSearchParams();
  if (employeeId) params.set("employeeId", employeeId);

  const { data } = await axios.get<{ conflicts: ShiftConflict[] }>(
    `${API}/api/shifts/${shiftId}/conflicts`,
    { params, headers: authHeader() }
  );
  return data.conflicts;
}

export async function fetchEmployees(): Promise<
  Array<{ id: string; firstName: string; lastName: string; position: string | null }>
> {
  const { data } = await axios.get(`${API}/api/employees`, {
    headers: authHeader(),
  });
  return data;
}

export async function fetchSchedules(): Promise<Schedule[]> {
  const { data } = await axios.get<Schedule[]>(`${API}/api/schedules`, {
    headers: authHeader(),
  });
  return data;
}
