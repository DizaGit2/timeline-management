/// <reference types="vite/client" />
import axios from "axios";

const API = (import.meta as ImportMeta & { env: Record<string, string> }).env?.VITE_API_URL ?? "";

function authHeader() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface Schedule {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSchedulePayload {
  name: string;
  startDate: string;
  endDate: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export type UpdateSchedulePayload = Partial<CreateSchedulePayload>;

export async function fetchSchedules(): Promise<Schedule[]> {
  const { data } = await axios.get<Schedule[]>(`${API}/api/schedules`, {
    headers: authHeader(),
  });
  return data;
}

export async function getSchedule(id: string): Promise<Schedule> {
  const { data } = await axios.get<Schedule>(`${API}/api/schedules/${id}`, {
    headers: authHeader(),
  });
  return data;
}

export async function createSchedule(payload: CreateSchedulePayload): Promise<Schedule> {
  const { data } = await axios.post<Schedule>(`${API}/api/schedules`, payload, {
    headers: authHeader(),
  });
  return data;
}

export async function updateSchedule(
  id: string,
  payload: UpdateSchedulePayload
): Promise<Schedule> {
  const { data } = await axios.put<Schedule>(`${API}/api/schedules/${id}`, payload, {
    headers: authHeader(),
  });
  return data;
}

export async function deleteSchedule(id: string): Promise<void> {
  await axios.delete(`${API}/api/schedules/${id}`, { headers: authHeader() });
}
