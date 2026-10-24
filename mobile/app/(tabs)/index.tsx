import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { getApplications } from '../../services/applicationService';

type CategoryTab = 'OVERVIEW' | 'APPLICATIONS' | 'ACTIONS' | 'CERTIFICATES';

function formatStatus(status?: string): { text: string; color: string; bg: string } {
  switch (status) {
    case 'SUBMITTED':
      return { text: 'Submitted', color: '#1E40AF', bg: '#DBEAFE' };
    case 'UNDER_REVIEW':
      return { text: 'Under Review', color: '#B45309', bg: '#FEF3C7' };
    case 'SCHEDULED':
      return { text: 'Scheduled', color: '#047857', bg: '#D1FAE5' };
    case 'COMPLETED':
      return { text: 'Completed', color: '#15803D', bg: '#DCFCE7' };
    case 'DECLINED':
      return { text: 'Declined', color: '#B91C1C', bg: '#FEE2E2' };
    case 'REJECTED':
      return { text: 'Rejected', color: '#B91C1C', bg: '#FEE2E2' };
    case 'CANCELLED':
      return { text: 'Cancelled', color: '#4B5563', bg: '#F3F4F6' };
    default:
      return { text: status || 'Draft', color: '#4B5563', bg: '#F3F4F6' };
  }
}

function formatType(type?: string): string {
  if (type === 'RE_VERIFICATION') return 'Re-Verification';
  if (type === 'VERIFICATION') return 'Verification';
  return type || 'Verification';
}

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [actionApps, setActionApps] = useState<any[]>([]);
  const [certApps, setCertApps] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<CategoryTab>('OVERVIEW');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/auth/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      setError('');
      const apps = await getApplications();
      const list = Array.isArray(apps) ? apps : [];
      setApplications(list);

      const pendingAction = list.filter(
        (a: any) =>
          a.remarks &&
          (a.remarks.includes('[REQUESTED_') || a.remarks.includes('[RETURNED_FOR_CORRECTION]'))
      );
      setActionApps(pendingAction);

      const certificates = list.filter(
        (a: any) => a.certificate_id || a.verification_decision === 'PASS'
      );
      setCertApps(certificates);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unable to load applications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2563EB']} />
      }
    >
      {/* Header */}
      <View style={styles.welcomeSection}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.welcome}>Owner Dashboard</Text>
          <Pressable style={styles.headerLogoutBtn} onPress={handleLogout}>
            <Text style={styles.headerLogoutBtnText}>Logout</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          Manage your instruments and verification applications in one place.
        </Text>
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
          <View
            style={[styles.badge, activeTab === 'APPLICATIONS' ? styles.badgeActive : styles.badgeInactive]}
          >
            <Text
              style={[styles.badgeText, activeTab === 'APPLICATIONS' ? styles.badgeTextActive : styles.badgeTextInactive]}
            >
              {applications.length}
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === 'ACTIONS' && styles.tabButtonActive]}
          onPress={() => setActiveTab('ACTIONS')}
        >
          <Text style={[styles.tabText, activeTab === 'ACTIONS' && styles.tabTextActive]}>
            ACTION REQUIRED
          </Text>
          {actionApps.length > 0 && (
            <View style={styles.actionBadge}>
              <Text style={styles.actionBadgeText}>{actionApps.length}</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === 'CERTIFICATES' && styles.tabButtonActive]}
          onPress={() => setActiveTab('CERTIFICATES')}
        >
          <Text style={[styles.tabText, activeTab === 'CERTIFICATES' && styles.tabTextActive]}>
            CERTIFICATES
          </Text>
          <View
            style={[styles.badge, activeTab === 'CERTIFICATES' ? styles.badgeActive : styles.badgeInactive]}
          >
            <Text
              style={[styles.badgeText, activeTab === 'CERTIFICATES' ? styles.badgeTextActive : styles.badgeTextInactive]}
            >
              {certApps.length}
            </Text>
          </View>
        </Pressable>
      </ScrollView>

      {/* Loading / Error States */}
      {loading && !refreshing ? (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading owner dashboard...</Text>
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
              {/* ACTION REQUIRED BANNER IF ANY */}
              {actionApps.length > 0 && (
                <View style={styles.actionBanner}>
                  <Text style={styles.actionBannerHeader}>⚡ ACTION REQUIRED ({actionApps.length})</Text>
                  {actionApps.map((item) => (
                    <View key={item.id} style={styles.actionItemCard}>
                      <View style={styles.actionItemHeader}>
                        <Text style={styles.actionItemNumber}>{item.application_number}</Text>
                        <Text style={styles.actionItemType}>
                          {item.remarks?.includes('[RETURNED_FOR_CORRECTION]')
                            ? 'Correction Required'
                            : 'Info Requested'}
                        </Text>
                      </View>
                      <Text style={styles.actionItemText} numberOfLines={2}>
                        {item.remarks?.replace(/\[[^\]]+\]:\s*/, '')}
                      </Text>
                      <Pressable
                        style={styles.openAppButton}
                        onPress={() => router.push(`/applications/${item.id}` as any)}
                      >
                        <Text style={styles.openAppButtonText}>Open Application →</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {/* Quick Actions Grid */}
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionsGrid}>
                <Pressable style={styles.card} onPress={() => router.push('/instruments' as any)}>
                  <Text style={styles.cardIcon}>⚙️</Text>
                  <Text style={styles.cardTitle}>My Instruments</Text>
                  <Text style={styles.cardText}>View & manage registered instruments</Text>
                </Pressable>

                <Pressable style={styles.card} onPress={() => router.push('/applications/create' as any)}>
                  <Text style={styles.cardIcon}>📋</Text>
                  <Text style={styles.cardTitle}>New Application</Text>
                  <Text style={styles.cardText}>Apply for legal metrology verification</Text>
                </Pressable>
              </View>

              {/* Recent Applications Summary */}
              <View style={styles.overviewHeaderRow}>
                <Text style={styles.sectionTitleNoMargin}>Recent Applications</Text>
                <Pressable onPress={() => setActiveTab('APPLICATIONS')}>
                  <Text style={styles.viewAllText}>View All ({applications.length}) →</Text>
                </Pressable>
              </View>

              {applications.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No applications yet</Text>
                  <Text style={styles.emptySub}>Create your first verification application.</Text>
                  <Pressable
                    style={styles.createAppBtn}
                    onPress={() => router.push('/applications/create' as any)}
                  >
                    <Text style={styles.createAppBtnText}>+ New Application</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.appListContainer}>
                  {applications.slice(0, 3).map((app) => (
                    <ApplicationCard key={app.id} app={app} />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 2: APPLICATIONS */}
          {activeTab === 'APPLICATIONS' && (
            <View style={styles.tabContent}>
              <View style={styles.tabHeaderRow}>
                <Text style={styles.sectionTitleNoMargin}>All Applications ({applications.length})</Text>
                <Pressable
                  style={styles.smallAddBtn}
                  onPress={() => router.push('/applications/create' as any)}
                >
                  <Text style={styles.smallAddBtnText}>+ Apply</Text>
                </Pressable>
              </View>

              {applications.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No applications found</Text>
                  <Text style={styles.emptySub}>Register an instrument and submit a verification request.</Text>
                </View>
              ) : (
                <View style={styles.appListContainer}>
                  {applications.map((app) => (
                    <ApplicationCard key={app.id} app={app} />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 3: ACTION REQUIRED */}
          {activeTab === 'ACTIONS' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>Action Required ({actionApps.length})</Text>
              {actionApps.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>🎉 No pending action items</Text>
                  <Text style={styles.emptySub}>All your applications are up to date and in progress.</Text>
                </View>
              ) : (
                <View style={styles.appListContainer}>
                  {actionApps.map((app) => (
                    <ApplicationCard key={app.id} app={app} />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 4: CERTIFICATES */}
          {activeTab === 'CERTIFICATES' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>Issued & Verified Certificates ({certApps.length})</Text>
              {certApps.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No certificates issued yet</Text>
                  <Text style={styles.emptySub}>
                    Certificates will appear here once verifications pass and Admin issues the certificate.
                  </Text>
                </View>
              ) : (
                <View style={styles.appListContainer}>
                  {certApps.map((app) => (
                    <ApplicationCard key={app.id} app={app} />
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
        <Text style={styles.logoutSectionSub}>Logged in as ({user?.email || 'dev.owner@pramaan.local'})</Text>
        <Pressable style={styles.largeLogoutBtn} onPress={handleLogout}>
          <Text style={styles.largeLogoutBtnText}>🚪 Logout from Owner Account</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function ApplicationCard({ app }: { app: any }) {
  const st = formatStatus(app.status);
  const hasAction =
    app.remarks &&
    (app.remarks.includes('[REQUESTED_') || app.remarks.includes('[RETURNED_FOR_CORRECTION]'));

  return (
    <View style={styles.appCard}>
      {/* Header Row */}
      <View style={styles.appCardHeader}>
        <Text style={styles.appNumber}>{app.application_number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusText, { color: st.color }]}>{st.text}</Text>
        </View>
      </View>

      {/* Instrument Info */}
      <View style={styles.appCardBody}>
        <Text style={styles.instrumentName}>{app.instrument_name || 'Instrument'}</Text>
        {app.serial_number && <Text style={styles.appCardMeta}>Serial No: {app.serial_number}</Text>}
        <Text style={styles.appCardMeta}>Type: {formatType(app.application_type)}</Text>
        {app.submitted_at && (
          <Text style={styles.appCardMeta}>
            Submitted: {new Date(app.submitted_at).toLocaleDateString()}
          </Text>
        )}

        {/* Schedule Info if present */}
        {app.scheduled_date && (
          <View style={styles.scheduleMetaCard}>
            <Text style={styles.scheduleMetaText}>
              📅 Scheduled: {typeof app.scheduled_date === 'string' ? app.scheduled_date.split('T')[0] : new Date(app.scheduled_date).toISOString().split('T')[0]}
              {app.scheduled_time ? ` at ${app.scheduled_time}` : ''}
            </Text>
            {app.verification_location && (
              <Text style={styles.scheduleMetaSub}>Location: {app.verification_location}</Text>
            )}
          </View>
        )}
      </View>

      {/* Verification Result if applicable */}
      {app.verification_decision && (
        <View
          style={[
            styles.resultBadgeRow,
            { backgroundColor: app.verification_decision === 'PASS' ? '#DCFCE7' : '#FEE2E2' },
          ]}
        >
          <Text
            style={[
              styles.resultBadgeText,
              { color: app.verification_decision === 'PASS' ? '#15803D' : '#B91C1C' },
            ]}
          >
            {app.verification_decision === 'PASS' ? '✓ PASS / Verified' : '✕ FAIL / Verification Failed'}
          </Text>
        </View>
      )}

      {/* Action Required Banner */}
      {hasAction && (
        <View style={styles.cardActionNotice}>
          <Text style={styles.cardActionNoticeTitle}>⚡ ACTION REQUIRED</Text>
          <Text style={styles.cardActionNoticeText}>Document/Correction requested by Inspector</Text>
        </View>
      )}

      {/* Certificate Section */}
      {app.certificate_id ? (
        <View style={styles.certNoticeBox}>
          <Text style={styles.certNoticeTitle}>🏆 Certificate Issued: {app.certificate_number}</Text>
          <Pressable
            style={styles.viewCertBtn}
            onPress={() =>
              router.push({
                pathname: '/certificates/[id]',
                params: { id: app.certificate_id },
              } as any)
            }
          >
            <Text style={styles.viewCertBtnText}>View Certificate →</Text>
          </Pressable>
        </View>
      ) : app.verification_decision === 'PASS' ? (
        <Text style={styles.certPendingText}>
          Certificate Eligibility Confirmed (PASS). Awaiting Admin issuance.
        </Text>
      ) : null}

      {/* Footer */}
      <View style={styles.appCardFooter}>
        <Pressable
          style={styles.openAppCardBtn}
          onPress={() =>
            router.push({
              pathname: '/applications/[id]',
              params: { id: app.id },
            } as any)
          }
        >
          <Text style={styles.openAppCardBtnText}>Open Application →</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  welcomeSection: {
    marginBottom: 16,
  },
  headerLogoutBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerLogoutBtnText: {
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
  welcome: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#64748B',
  },
  tabsScrollView: {
    marginBottom: 20,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
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
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  badge: {
    paddingHorizontal: 7,
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
  actionBadge: {
    backgroundColor: '#D97706',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
  },
  actionBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  tabContent: {
    gap: 16,
  },
  tabHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  smallAddBtn: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  smallAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  sectionTitleNoMargin: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  overviewHeaderRow: {
    marginTop: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  actionsGrid: {
    gap: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
  },
  cardIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardText: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
  },
  stateBox: {
    padding: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748B',
  },
  errorBox: {
    padding: 20,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 10,
  },
  retryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  emptyBox: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 14,
    textAlign: 'center',
  },
  createAppBtn: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  createAppBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  appListContainer: {
    gap: 12,
  },
  appCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 15,
    gap: 8,
  },
  appCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  appCardBody: {
    gap: 3,
  },
  instrumentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  appCardMeta: {
    fontSize: 12,
    color: '#64748B',
  },
  scheduleMetaCard: {
    marginTop: 4,
    padding: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  scheduleMetaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  scheduleMetaSub: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 2,
  },
  resultBadgeRow: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  resultBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardActionNotice: {
    backgroundColor: '#FFFBEB',
    padding: 9,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  cardActionNoticeTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  cardActionNoticeText: {
    fontSize: 12,
    color: '#78350F',
    marginTop: 2,
  },
  certNoticeBox: {
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
    gap: 6,
  },
  certNoticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  viewCertBtn: {
    backgroundColor: '#16A34A',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  viewCertBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  certPendingText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#059669',
  },
  appCardFooter: {
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  openAppCardBtn: {
    alignSelf: 'flex-start',
  },
  openAppCardBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  actionBanner: {
    marginBottom: 16,
    padding: 14,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D97706',
    gap: 10,
  },
  actionBannerHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#B45309',
  },
  actionItemCard: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    gap: 4,
  },
  actionItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionItemNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionItemType: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  actionItemText: {
    fontSize: 12,
    color: '#451A03',
  },
  openAppButton: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  openAppButtonText: {
    color: '#D97706',
    fontWeight: '700',
    fontSize: 12,
  },
});