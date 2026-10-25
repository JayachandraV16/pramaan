import { apiRequest } from './api';

export type NotificationItem = {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  status: 'PENDING' | 'SENT' | 'READ' | 'FAILED';
  related_application_id?: string | null;
  related_certificate_id?: string | null;
  created_at: string;
  read_at?: string | null;
};

export async function getMyNotifications(): Promise<NotificationItem[]> {
  const response = await apiRequest('/notifications', {
    method: 'GET',
    requiresAuth: true,
  });
  return response.data;
}

export async function markNotificationAsRead(notificationId: string): Promise<NotificationItem> {
  const response = await apiRequest(`/notifications/${notificationId}/read`, {
    method: 'PATCH',
    requiresAuth: true,
  });
  return response.data;
}

export async function markAllNotificationsAsRead(): Promise<NotificationItem[]> {
  const response = await apiRequest('/notifications/read-all', {
    method: 'PATCH',
    requiresAuth: true,
  });
  return response.data;
}
