/// <reference types="vite/client" />
import { axiosInstance as axios, getToken } from "./axiosInstance";

const BASE_URL =
  (import.meta as ImportMeta & { env: Record<string, string> }).env
    ?.VITE_API_URL ?? "";

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
  const { data } = await axios.get<HoursRow[]>(`/api/reports/hours`, {
    params: { weekStart },
  });
  return data;
}

export async function fetchUnfilledReport(weekStart: string): Promise<UnfilledShift[]> {
  const { data } = await axios.get<UnfilledShift[]>(`/api/reports/unfilled`, {
    params: { weekStart },
  });
  return data;
}

export async function downloadScheduleCsv(weekStart: string): Promise<void> {
  const token = getToken();
  const response = await fetch(
    `${BASE_URL}/api/reports/schedule/csv?weekStart=${encodeURIComponent(weekStart)}`,
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
