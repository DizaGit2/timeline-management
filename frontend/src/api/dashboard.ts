import { axiosInstance as axios } from "./axiosInstance";

export interface DashboardStats {
  scheduleCount: number;
  employeeCount: number;
  shiftsThisWeek: number;
  unfilledShiftsThisWeek: number;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await axios.get<DashboardStats>("/api/dashboard/stats");
  return data;
}
