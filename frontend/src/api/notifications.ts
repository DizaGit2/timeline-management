import { axiosInstance as axios } from "./axiosInstance";

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
  const { data } = await axios.get<Notification[]>(`/api/notifications`);
  return data;
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const { data } = await axios.patch<Notification>(
    `/api/notifications/${id}/read`,
    {}
  );
  return data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await axios.post(`/api/notifications/read-all`, {});
}
