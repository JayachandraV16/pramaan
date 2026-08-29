import { apiRequest } from './api';

export type Schedule = {
  id: string;
  application_id: string;
  assignment_id: string;
  scheduled_date: string;
  scheduled_time?: string | null;
  verification_location?: string | null;
  status: string;
  remarks?: string | null;
  application_number?: string;
};

export async function getSchedules(): Promise<Schedule[]> {
  const response = await apiRequest('/schedules', {
    requiresAuth: true,
  });

  return response.data || [];
}
