/// <reference types="vite/client" />
import axios from "axios";

const API = (import.meta as ImportMeta & { env: Record<string, string> }).env?.VITE_API_URL ?? "";

function authHeader() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface HoursRow {
  employeeId: string;
  employeeName: string;
  totalHours: number;
  shiftCount: number;
}

export interface UnfilledShift {
  shiftId: string;
  title: string;
  date: string;
  required: number;
  assigned: number;
}

export async function fetchHoursReport(weekStart: string): Promise<HoursRow[]> {
  const { data } = await axios.get<HoursRow[]>(`${API}/api/reports/hours`, {
    params: { weekStart },
    headers: authHeader(),
  });
  return data;
}

export async function fetchUnfilledReport(weekStart: string): Promise<UnfilledShift[]> {
  const { data } = await axios.get<UnfilledShift[]>(`${API}/api/reports/unfilled`, {
    params: { weekStart },
    headers: authHeader(),
  });
  return data;
}

export async function downloadScheduleCsv(weekStart: string): Promise<void> {
  const token = localStorage.getItem("accessToken");
  const response = await fetch(
    `${API}/api/reports/schedule/csv?weekStart=${encodeURIComponent(weekStart)}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to download CSV: ${response.statusText}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `schedule-${weekStart}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
