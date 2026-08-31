import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import {
  getAdminApplications,
  getAdminAssignments,
  getAdminCertificates,
  getAdminSchedules,
  getAdminVerifications,
} from '../../services/adminService';

type AdminCategoryTab = 'OVERVIEW' | 'APPLICATIONS' | 'ASSIGNMENTS' | 'SCHEDULES' | 'CERTIFICATES';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminCategoryTab>('OVERVIEW');
  const [applications, setApplications] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      setError('');
      const [apps, asgns, scheds, vers, certs] = await Promise.all([
        getAdminApplications(),
        getAdminAssignments(),
        getAdminSchedules(),
        getAdminVerifications(),
        getAdminCertificates(),
      ]);
      setApplications(Array.isArray(apps) ? apps : []);
      setAssignments(Array.isArray(asgns) ? asgns : []);
      setSchedules(Array.isArray(scheds) ? scheds : []);
      setVerifications(Array.isArray(vers) ? vers : []);
      setCertificates(Array.isArray(certs) ? certs : []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load admin dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/auth/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Filter metrics
  const unassignedApps = applications.filter((a) => a.status === 'SUBMITTED' && !a.assignment_id);
  const scheduledApps = applications.filter((a) => a.status === 'SCHEDULED');
  const eligiblePassVerifications = verifications.filter(
    (v) => v.decision === 'PASS' && !v.certificate_id
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Admin Dashboard</Text>
          <Text style={styles.subtitle}>Legal Metrology Verification Pipeline</Text>
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      {/* Category Tabs Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScrollView}
        contentContainerStyle={styles.tabsContainer}
      >
        <Pressable
          style={[styles.tabButton, activeTab === 'OVERVIEW' && styles.tabButtonActive]}
          onPress={() => setActiveTab('OVERVIEW')}
        >
          <Text style={[styles.tabText, activeTab === 'OVERVIEW' && styles.tabTextActive]}>
            OVERVIEW
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === 'APPLICATIONS' && styles.tabButtonActive]}
          onPress={() => setActiveTab('APPLICATIONS')}
        >
          <Text style={[styles.tabText, activeTab === 'APPLICATIONS' && styles.tabTextActive]}>
            APPLICATIONS
          </Text>
          <View style={[styles.badge, activeTab === 'APPLICATIONS' ? styles.badgeActive : styles.badgeInactive]}>
            <Text style={[styles.badgeText, activeTab === 'APPLICATIONS' ? styles.badgeTextActive : styles.badgeTextInactive]}>
              {applications.length}
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === 'ASSIGNMENTS' && styles.tabButtonActive]}
          onPress={() => setActiveTab('ASSIGNMENTS')}
        >
          <Text style={[styles.tabText, activeTab === 'ASSIGNMENTS' && styles.tabTextActive]}>
            ASSIGNMENTS
          </Text>
          {unassignedApps.length > 0 && (
            <View style={styles.badgeOrange}>
              <Text style={styles.badgeTextWhite}>{unassignedApps.length}</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === 'SCHEDULES' && styles.tabButtonActive]}
          onPress={() => setActiveTab('SCHEDULES')}
        >
          <Text style={[styles.tabText, activeTab === 'SCHEDULES' && styles.tabTextActive]}>
            SCHEDULES
          </Text>
          <View style={[styles.badge, activeTab === 'SCHEDULES' ? styles.badgeActive : styles.badgeInactive]}>
            <Text style={[styles.badgeText, activeTab === 'SCHEDULES' ? styles.badgeTextActive : styles.badgeTextInactive]}>
              {schedules.length}
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === 'CERTIFICATES' && styles.tabButtonActive]}
          onPress={() => setActiveTab('CERTIFICATES')}
        >
          <Text style={[styles.tabText, activeTab === 'CERTIFICATES' && styles.tabTextActive]}>
            CERTIFICATES
          </Text>
          <View style={[styles.badge, activeTab === 'CERTIFICATES' ? styles.badgeActive : styles.badgeInactive]}>
            <Text style={[styles.badgeText, activeTab === 'CERTIFICATES' ? styles.badgeTextActive : styles.badgeTextInactive]}>
              {certificates.length}
            </Text>
          </View>
        </Pressable>
      </ScrollView>

      {/* Loading / Error States */}
      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading admin pipeline metrics...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={loadData}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <View style={styles.tabContent}>
              {/* Metrics Grid */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricNumber}>{applications.length}</Text>
                  <Text style={styles.metricLabel}>Total Applications</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricNumber}>{unassignedApps.length}</Text>
                  <Text style={styles.metricLabel}>Pending Assignment</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricNumber}>{scheduledApps.length}</Text>
                  <Text style={styles.metricLabel}>Scheduled</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricNumber}>{certificates.length}</Text>
                  <Text style={styles.metricLabel}>Issued Certificates</Text>
                </View>
              </View>

              {/* Management Sections */}
              <Text style={styles.sectionTitle}>Pipeline Management Views</Text>

              <Pressable style={styles.managementCard} onPress={() => router.push('/admin/applications')}>
                <Text style={styles.cardTitle}>📄 Applications Management</Text>
                <Text style={styles.cardText}>Review submitted applications & status history</Text>
              </Pressable>

              <Pressable style={styles.managementCard} onPress={() => router.push('/admin/assignments')}>
                <Text style={styles.cardTitle}>👤 Assignment Management</Text>
                <Text style={styles.cardText}>Assign submitted applications to active LMO or GATC officers</Text>
              </Pressable>

              <Pressable style={styles.managementCard} onPress={() => router.push('/admin/schedules')}>
                <Text style={styles.cardTitle}>📅 Verification Scheduling</Text>
                <Text style={styles.cardText}>Schedule date, time, and location for assigned applications</Text>
              </Pressable>

              <Pressable style={styles.managementCard} onPress={() => router.push('/admin/verifications')}>
                <Text style={styles.cardTitle}>🔍 Field Verifications</Text>
                <Text style={styles.cardText}>View inspection observations, readings, and PASS/FAIL decisions</Text>
              </Pressable>

              <Pressable style={styles.managementCard} onPress={() => router.push('/admin/certificates')}>
                <Text style={styles.cardTitle}>🏆 Certificate Issuance</Text>
                <Text style={styles.cardText}>Issue official digital certificates with QR verification</Text>
              </Pressable>
            </View>
          )}

          {/* TAB 2: APPLICATIONS */}
          {activeTab === 'APPLICATIONS' && (
            <View style={styles.tabContent}>
              <View style={styles.tabHeaderRow}>
                <Text style={styles.sectionTitleNoMargin}>Applications ({applications.length})</Text>
                <Pressable style={styles.smallNavBtn} onPress={() => router.push('/admin/applications')}>
                  <Text style={styles.smallNavBtnText}>Open Full List →</Text>
                </Pressable>
              </View>

              {applications.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No applications found</Text>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {applications.slice(0, 10).map((item) => (
                    <View key={item.id} style={styles.itemCard}>
                      <View style={styles.itemHeader}>
                        <Text style={styles.itemTitle}>{item.application_number}</Text>
                        <View style={styles.badgeGray}>
                          <Text style={styles.badgeGrayText}>{item.status}</Text>
                        </View>
                      </View>
                      <Text style={styles.itemSub}>{item.instrument_name || 'Instrument'}</Text>
                      {item.applicant_name && <Text style={styles.itemMeta}>Applicant: {item.applicant_name}</Text>}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 3: ASSIGNMENTS */}
          {activeTab === 'ASSIGNMENTS' && (
            <View style={styles.tabContent}>
              <View style={styles.tabHeaderRow}>
                <Text style={styles.sectionTitleNoMargin}>Assignments ({assignments.length})</Text>
                <Pressable style={styles.smallNavBtn} onPress={() => router.push('/admin/assignments')}>
                  <Text style={styles.smallNavBtnText}>Assign Application →</Text>
                </Pressable>
              </View>

              {assignments.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No assignments created yet</Text>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {assignments.map((item) => (
                    <View key={item.id} style={styles.itemCard}>
                      <View style={styles.itemHeader}>
                        <Text style={styles.itemTitle}>{item.application_number || item.application_id}</Text>
                        <View style={styles.badgeGray}>
                          <Text style={styles.badgeGrayText}>{item.status}</Text>
                        </View>
                      </View>
                      <Text style={styles.itemSub}>{item.instrument_name || 'Instrument'}</Text>
                      {item.assigned_to_name && <Text style={styles.itemMeta}>Assigned To: {item.assigned_to_name}</Text>}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 4: SCHEDULES */}
          {activeTab === 'SCHEDULES' && (
            <View style={styles.tabContent}>
              <View style={styles.tabHeaderRow}>
                <Text style={styles.sectionTitleNoMargin}>Schedules ({schedules.length})</Text>
                <Pressable style={styles.smallNavBtn} onPress={() => router.push('/admin/schedules')}>
                  <Text style={styles.smallNavBtnText}>+ Create Schedule</Text>
                </Pressable>
              </View>

              {schedules.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No schedules created yet</Text>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {schedules.map((item) => (
                    <View key={item.id} style={styles.itemCard}>
                      <View style={styles.itemHeader}>
                        <Text style={styles.itemTitle}>{item.application_number || item.application_id}</Text>
                        <View style={styles.badgeGreen}>
                          <Text style={styles.badgeGreenText}>{item.status}</Text>
                        </View>
                      </View>
                      <Text style={styles.itemSub}>
                        📅 {typeof item.scheduled_date === 'string' ? item.scheduled_date.split('T')[0] : new Date(item.scheduled_date).toISOString().split('T')[0]}
                        {item.scheduled_time ? ` at ${item.scheduled_time}` : ''}
                      </Text>
                      {item.verification_location && (
                        <Text style={styles.itemMeta}>Location: {item.verification_location}</Text>
                      )}
                      {item.assigned_to_name && <Text style={styles.itemMeta}>Officer: {item.assigned_to_name}</Text>}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 5: CERTIFICATES */}
          {activeTab === 'CERTIFICATES' && (
            <View style={styles.tabContent}>
              <View style={styles.tabHeaderRow}>
                <Text style={styles.sectionTitleNoMargin}>Certificates ({certificates.length})</Text>
                <Pressable style={styles.smallNavBtn} onPress={() => router.push('/admin/certificates')}>
                  <Text style={styles.smallNavBtnText}>Certificate Center →</Text>
                </Pressable>
              </View>

              {eligiblePassVerifications.length > 0 && (
                <View style={styles.noticeBox}>
                  <Text style={styles.noticeTitle}>⚡ Eligible PASS Verifications ({eligiblePassVerifications.length})</Text>
                  <Text style={styles.noticeSub}>Verifications marked PASS ready for certificate issuance.</Text>
                </View>
              )}

              {certificates.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No certificates issued yet</Text>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {certificates.map((item) => (
                    <View key={item.id} style={styles.itemCard}>
                      <Text style={styles.itemTitle}>🏆 {item.certificate_number}</Text>
                      <Text style={styles.itemSub}>Issued: {item.issue_date}</Text>
                      <Text style={styles.itemMeta}>Status: {item.status}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </>
      )}

      {/* Account & Session / Logout Section */}
      <View style={styles.logoutSection}>
        <Text style={styles.logoutSectionTitle}>Account & Session</Text>
        <Text style={styles.logoutSectionSub}>Logged in as Admin ({user?.email || 'dev.admin@pramaan.local'})</Text>
        <Pressable style={styles.largeLogoutBtn} onPress={handleLogout}>
          <Text style={styles.largeLogoutBtnText}>🚪 Logout from Admin Account</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 3,
    color: '#64748B',
    fontSize: 14,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  logoutSection: {
    marginTop: 24,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    gap: 8,
  },
  logoutSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991B1B',
  },
  logoutSectionSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  largeLogoutBtn: {
    marginTop: 4,
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  largeLogoutBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  tabsScrollView: {
    marginBottom: 18,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  badgeInactive: {
    backgroundColor: '#F1F5F9',
  },
  badgeActive: {
    backgroundColor: '#3B82F6',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  badgeTextInactive: {
    color: '#475569',
  },
  badgeTextActive: {
    color: '#FFFFFF',
  },
  badgeOrange: {
    backgroundColor: '#D97706',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  badgeTextWhite: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  tabContent: {
    gap: 14,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  metricNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 6,
    marginBottom: 4,
  },
  sectionTitleNoMargin: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  tabHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  smallNavBtn: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  smallNavBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  managementCard: {
    padding: 16,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardText: {
    fontSize: 13,
    color: '#64748B',
  },
  stateBox: {
    padding: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  errorBox: {
    padding: 18,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 8,
  },
  retryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  emptyBox: {
    padding: 22,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  listContainer: {
    gap: 10,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemSub: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  itemMeta: {
    fontSize: 12,
    color: '#64748B',
  },
  badgeGray: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeGrayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  badgeGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeGreenText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  noticeBox: {
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    gap: 2,
    marginBottom: 6,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309',
  },
  noticeSub: {
    fontSize: 12,
    color: '#78350F',
  },
});