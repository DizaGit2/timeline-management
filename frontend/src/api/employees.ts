import { axiosInstance as axios } from "./axiosInstance";

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

  const { data } = await axios.get<Employee[]>(`/api/employees`, {
    params: qp,
  });
  return data;
}

export async function getEmployee(id: string): Promise<Employee> {
  const { data } = await axios.get<Employee>(`/api/employees/${id}`);
  return data;
}

export async function createEmployee(payload: CreateEmployeePayload): Promise<Employee> {
  const { data } = await axios.post<Employee>(`/api/employees`, payload);
  return data;
}

export async function updateEmployee(
  id: string,
  payload: UpdateEmployeePayload
): Promise<Employee> {
  const { data } = await axios.put<Employee>(`/api/employees/${id}`, payload);
  return data;
}

export async function deactivateEmployee(id: string): Promise<void> {
  await axios.delete(`/api/employees/${id}`);
}

export async function reactivateEmployee(id: string): Promise<Employee> {
  const { data } = await axios.post<Employee>(
    `/api/employees/${id}/reactivate`,
    {}
  );
  return data;
}
