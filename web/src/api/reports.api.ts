import { 
  CategoryApprovalStat, 
  MonthlyTrendStat, 
  DashboardOverviewStats,
  RoleName 
} from '../types';
import { simulateNetworkDelay } from './client';

export const reportsApi = {
  /**
   * Get category-wise approvals stats (matches reference JSON format)
   */
  async getCategoryWiseApprovals(): Promise<CategoryApprovalStat[]> {
    await simulateNetworkDelay(200, 350);
    // TODO: Replace with real fetch('/api/v1/reports/category-wise-approvals')
    return [
      {
        category: 'verification',
        categoryLabel: 'Weights & Measures Verification',
        approvals: 959037,
        fill: '#0b1d33', // Pramaan Navy
      },
      {
        category: 'package_commodity',
        categoryLabel: 'Packaged Commodities PCR',
        approvals: 124425,
        fill: '#0d9488', // Teal
      },
      {
        category: 'licence',
        categoryLabel: 'Manufacturer & Dealer Licences',
        approvals: 39901,
        fill: '#d97706', // Saffron/Gold
      },
      {
        category: 'nomination',
        categoryLabel: 'Company Directors Nomination',
        approvals: 1637,
        fill: '#2563eb', // Blue
      },
    ];
  },

  /**
   * Get last 6 months trend stats (matches reference JSON format)
   */
  async getLastSixMonthsTrend(): Promise<MonthlyTrendStat[]> {
    await simulateNetworkDelay(200, 350);
    // TODO: Replace with real fetch('/api/v1/reports/monthly-trends')
    return [
      { month: 'Oct 2025', submitted: 185400, approved: 172300, rejected: 13100, passRate: 92.9 },
      { month: 'Nov 2025', submitted: 210200, approved: 198600, rejected: 11600, passRate: 94.5 },
      { month: 'Dec 2025', submitted: 237889, approved: 225290, rejected: 12599, passRate: 94.7 },
      { month: 'Jan 2026', submitted: 126302, approved: 117604, rejected: 8698, passRate: 93.1 },
      { month: 'Feb 2026', submitted: 153723, approved: 143379, rejected: 10344, passRate: 93.3 },
      { month: 'Mar 2026', submitted: 192299, approved: 181458, rejected: 10841, passRate: 94.4 },
    ];
  },

  /**
   * Get role-tailored dashboard stats and overview metrics
   */
  async getDashboardOverview(role: RoleName): Promise<DashboardOverviewStats> {
    await simulateNetworkDelay(250, 450);
    // TODO: Replace with real fetch(`/api/v1/dashboard/stats?role=${role}`)

    if (role === 'INSTRUMENT_OWNER') {
      return {
        totalInstruments: 5,
        activeCertificates: 2,
        pendingApplications: 2,
        completedVerifications: 1,
        passRatePercentage: 100,
        recentActivity: [
          {
            id: 'act-1',
            type: 'APPLICATION',
            title: 'Application APP-LM-2026-00244 Under Review',
            description: 'Lab QA Precision Balance assigned to GATC testing laboratory',
            timestamp: '3 hours ago',
            status: 'UNDER_REVIEW',
          },
          {
            id: 'act-2',
            type: 'VERIFICATION',
            title: 'Weighbridge Inspection Scheduled',
            description: 'Officer Vikram Malhotra scheduled site visit for 02 March 2026',
            timestamp: 'Yesterday at 2:00 PM',
            status: 'SCHEDULED',
          },
          {
            id: 'act-3',
            type: 'CERTIFICATE',
            title: 'Certificate Issued #CERT-LM-MH-2026-098124',
            description: 'Platform scale verified with 12 months validity',
            timestamp: 'Jan 12, 2026',
            status: 'ACTIVE',
          },
        ],
      };
    }

    if (role === 'LMO' || role === 'GATC') {
      return {
        totalInstruments: 48,
        activeCertificates: 39,
        pendingApplications: 7,
        completedVerifications: 34,
        passRatePercentage: 96.2,
        recentActivity: [
          {
            id: 'act-lmo-1',
            type: 'VERIFICATION',
            title: 'Field Verification In Progress',
            description: '60T Freight Weighbridge at APMC Yard Gate 1',
            timestamp: 'Just now',
            status: 'IN_PROGRESS',
          },
          {
            id: 'act-lmo-2',
            type: 'APPLICATION',
            title: 'New Verification Request Assigned',
            description: 'Multi-Product Fuel Dispenser awaiting schedule acceptance',
            timestamp: '1 hour ago',
            status: 'ASSIGNED',
          },
          {
            id: 'act-lmo-3',
            type: 'CERTIFICATE',
            title: 'Signed Certificate for Dock Scale #2',
            description: 'Digital seal stamp generated and dispatched to owner',
            timestamp: 'Jan 12, 2026',
            status: 'ACTIVE',
          },
        ],
      };
    }

    // ADMIN Role default
    return {
      totalInstruments: 1124500,
      activeCertificates: 959037,
      pendingApplications: 14205,
      completedVerifications: 1083420,
      passRatePercentage: 94.4,
      recentActivity: [
        {
          id: 'act-adm-1',
          type: 'APPLICATION',
          title: 'Daily Application Spike in Zone 4',
          description: '1,420 agricultural mandi weighing scales submitted for renewal',
          timestamp: '20 mins ago',
          status: 'INFO',
        },
        {
          id: 'act-adm-2',
          type: 'CERTIFICATE',
          title: '14,200 Certificates Auto-Renewed',
          description: 'Batch certificate generation completed successfully',
          timestamp: '2 hours ago',
          status: 'ACTIVE',
        },
        {
          id: 'act-adm-3',
          type: 'VERIFICATION',
          title: 'GATC Lab Audit Report Logged',
          description: 'Regional Reference Standard Lab calibrated 240 primary weight standards',
          timestamp: 'Yesterday',
          status: 'COMPLETED',
        },
      ],
    };
  },
};
