import { axiosInstance as axios } from "./axiosInstance";

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

export async function fetchShifts(filters?: ShiftFilters): Promise<Shift[]> {
  const params = new URLSearchParams();
  if (filters?.scheduleId) params.set("scheduleId", filters.scheduleId);
  if (filters?.employeeId) params.set("employeeId", filters.employeeId);
  if (filters?.from) params.set("from", filters.from);
  if (filters?.to) params.set("to", filters.to);

  const { data } = await axios.get<Shift[]>(`/api/shifts`, { params });
  return data;
}

export async function createShift(payload: CreateShiftPayload): Promise<Shift> {
  const { data } = await axios.post<Shift>(`/api/shifts`, payload);
  return data;
}

export async function updateShift(
  id: string,
  payload: UpdateShiftPayload
): Promise<Shift> {
  const { data } = await axios.put<Shift>(`/api/shifts/${id}`, payload);
  return data;
}

export async function deleteShift(id: string): Promise<void> {
  await axios.delete(`/api/shifts/${id}`);
}

export async function assignEmployees(
  shiftId: string,
  employeeIds: string[]
): Promise<Shift> {
  const { data } = await axios.post<Shift>(
    `/api/shifts/${shiftId}/assign`,
    { employeeIds }
  );
  return data;
}

export async function removeAssignment(
  shiftId: string,
  employeeId: string
): Promise<void> {
  await axios.delete(`/api/shifts/${shiftId}/employees/${employeeId}`);
}

export async function fetchShiftConflicts(
  shiftId: string,
  employeeId?: string
): Promise<ShiftConflict[]> {
  const params = new URLSearchParams();
  if (employeeId) params.set("employeeId", employeeId);

  const { data } = await axios.get<{ conflicts: ShiftConflict[] }>(
    `/api/shifts/${shiftId}/conflicts`,
    { params }
  );
  return data.conflicts;
}

export async function fetchEmployees(): Promise<
  Array<{ id: string; firstName: string; lastName: string; position: string | null }>
> {
  const { data } = await axios.get(`/api/employees`);
  return data;
}

export async function fetchSchedules(): Promise<Schedule[]> {
  const { data } = await axios.get<Schedule[]>(`/api/schedules`);
  return data;
}
