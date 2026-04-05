/// <reference types="vite/client" />
import axios from "axios";

const API = (import.meta as ImportMeta & { env: Record<string, string> }).env?.VITE_API_URL ?? "";

function authHeader() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  metadata: unknown;
  createdAt: string;
}

export async function fetchNotifications(): Promise<Notification[]> {
  const { data } = await axios.get<Notification[]>(`${API}/api/notifications`, {
    headers: authHeader(),
  });
  return data;
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const { data } = await axios.patch<Notification>(
    `${API}/api/notifications/${id}/read`,
    {},
    { headers: authHeader() }
  );
  return data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await axios.post(`${API}/api/notifications/read-all`, {}, { headers: authHeader() });
}
