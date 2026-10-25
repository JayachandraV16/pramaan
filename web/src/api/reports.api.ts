import { 
  CategoryApprovalStat, 
  MonthlyTrendStat, 
  DashboardOverviewStats,
  RoleName 
} from '../types';
import { apiClient } from './client';

export const reportsApi = {
  /**
   * Get category-wise approvals stats from backend
   */
  async getCategoryWiseApprovals(): Promise<CategoryApprovalStat[]> {
    try {
      const response = await apiClient.get<CategoryApprovalStat[]>('/reports/category-wise-approvals');
      if (Array.isArray(response)) {
        return response;
      }
    } catch {
      // Backend does not currently implement /api/reports/category-wise-approvals
    }
    return [];
  },

  /**
   * Get last 6 months trend stats from backend
   */
  async getLastSixMonthsTrend(): Promise<MonthlyTrendStat[]> {
    try {
      const response = await apiClient.get<MonthlyTrendStat[]>('/reports/monthly-trends');
      if (Array.isArray(response)) {
        return response;
      }
    } catch {
      // Backend does not currently implement /api/reports/monthly-trends
    }
    return [];
  },

  /**
   * Get role-tailored dashboard stats and overview metrics from backend
   */
  async getDashboardOverview(role: RoleName): Promise<DashboardOverviewStats | null> {
    try {
      const response = await apiClient.get<DashboardOverviewStats>(`/dashboard/stats?role=${role}`);
      if (response) {
        return response;
      }
    } catch {
      // Backend does not currently implement /api/dashboard/stats
    }
    return null;
  },
};
