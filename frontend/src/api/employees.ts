/// <reference types="vite/client" />
import axios from "axios";

const API = (import.meta as ImportMeta & { env: Record<string, string> }).env?.VITE_API_URL ?? "http://localhost:3000";

function authHeader() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  hourlyRate: number | null;
  isActive: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeePayload {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  position?: string;
  hourlyRate?: number;
}

export type UpdateEmployeePayload = Partial<CreateEmployeePayload>;

export async function fetchEmployees(params?: {
  search?: string;
  status?: "active" | "inactive";
}): Promise<Employee[]> {
  const qp = new URLSearchParams();
  if (params?.search) qp.set("search", params.search);
  if (params?.status) qp.set("status", params.status);

  const { data } = await axios.get<Employee[]>(`${API}/api/employees`, {
    params: qp,
    headers: authHeader(),
  });
  return data;
}

export async function getEmployee(id: string): Promise<Employee> {
  const { data } = await axios.get<Employee>(`${API}/api/employees/${id}`, {
    headers: authHeader(),
  });
  return data;
}

export async function createEmployee(payload: CreateEmployeePayload): Promise<Employee> {
  const { data } = await axios.post<Employee>(`${API}/api/employees`, payload, {
    headers: authHeader(),
  });
  return data;
}

export async function updateEmployee(
  id: string,
  payload: UpdateEmployeePayload
): Promise<Employee> {
  const { data } = await axios.put<Employee>(`${API}/api/employees/${id}`, payload, {
    headers: authHeader(),
  });
  return data;
}

export async function deactivateEmployee(id: string): Promise<void> {
  await axios.delete(`${API}/api/employees/${id}`, { headers: authHeader() });
}

export async function reactivateEmployee(id: string): Promise<Employee> {
  const { data } = await axios.post<Employee>(
    `${API}/api/employees/${id}/reactivate`,
    {},
    { headers: authHeader() }
  );
  return data;
}
