import { axiosInstance as axios } from "./axiosInstance";

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
  const { data } = await axios.get<Schedule[]>(`/api/schedules`);
  return data;
}

export async function getSchedule(id: string): Promise<Schedule> {
  const { data } = await axios.get<Schedule>(`/api/schedules/${id}`);
  return data;
}

export async function createSchedule(payload: CreateSchedulePayload): Promise<Schedule> {
  const { data } = await axios.post<Schedule>(`/api/schedules`, payload);
  return data;
}

export async function updateSchedule(
  id: string,
  payload: UpdateSchedulePayload
): Promise<Schedule> {
  const { data } = await axios.put<Schedule>(`/api/schedules/${id}`, payload);
  return data;
}

export async function deleteSchedule(id: string): Promise<void> {
  await axios.delete(`/api/schedules/${id}`);
}
