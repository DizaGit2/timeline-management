import { axiosInstance as axios } from "./axiosInstance";

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
    `/api/employees/${employeeId}/availability`
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
    `/api/employees/${employeeId}/availability`,
    windows
  );
  return data;
}

export async function listUnavailability(
  employeeId: string
): Promise<UnavailabilityException[]> {
  const { data } = await axios.get<UnavailabilityException[]>(
    `/api/employees/${employeeId}/unavailability`
  );
  return data;
}

export async function createUnavailability(
  employeeId: string,
  payload: { date: string; reason?: string }
): Promise<UnavailabilityException> {
  const { data } = await axios.post<UnavailabilityException>(
    `/api/employees/${employeeId}/unavailability`,
    payload
  );
  return data;
}

export async function deleteUnavailability(
  employeeId: string,
  exceptionId: string
): Promise<void> {
  await axios.delete(
    `/api/employees/${employeeId}/unavailability/${exceptionId}`
  );
}
