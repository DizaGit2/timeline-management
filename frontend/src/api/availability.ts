/// <reference types="vite/client" />
import axios from "axios";

const API = (import.meta as ImportMeta & { env: Record<string, string> }).env?.VITE_API_URL ?? "http://localhost:3000";

function authHeader() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface AvailabilityWindow {
  id: string;
  employeeId: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: string;
  endTime: string;
  type: string;
}

export interface UnavailabilityException {
  id: string;
  employeeId: string;
  date: string;
  reason: string | null;
  createdAt: string;
}

export async function getAvailability(employeeId: string): Promise<AvailabilityWindow[]> {
  const { data } = await axios.get<AvailabilityWindow[]>(
    `${API}/api/employees/${employeeId}/availability`,
    { headers: authHeader() }
  );
  return data;
}

export async function replaceAvailability(
  employeeId: string,
  windows: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    type?: string;
  }>
): Promise<AvailabilityWindow[]> {
  const { data } = await axios.put<AvailabilityWindow[]>(
    `${API}/api/employees/${employeeId}/availability`,
    windows,
    { headers: authHeader() }
  );
  return data;
}

export async function listUnavailability(
  employeeId: string
): Promise<UnavailabilityException[]> {
  const { data } = await axios.get<UnavailabilityException[]>(
    `${API}/api/employees/${employeeId}/unavailability`,
    { headers: authHeader() }
  );
  return data;
}

export async function createUnavailability(
  employeeId: string,
  payload: { date: string; reason?: string }
): Promise<UnavailabilityException> {
  const { data } = await axios.post<UnavailabilityException>(
    `${API}/api/employees/${employeeId}/unavailability`,
    payload,
    { headers: authHeader() }
  );
  return data;
}

export async function deleteUnavailability(
  employeeId: string,
  exceptionId: string
): Promise<void> {
  await axios.delete(
    `${API}/api/employees/${employeeId}/unavailability/${exceptionId}`,
    { headers: authHeader() }
  );
}
