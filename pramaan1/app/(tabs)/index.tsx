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
import { getApplications } from '../../services/applicationService';

function formatStatus(status?: string): { text: string; color: string; bg: string } {
  switch (status) {
    case 'SUBMITTED':
      return { text: 'Submitted', color: '#1E40AF', bg: '#DBEAFE' };
    case 'UNDER_REVIEW':
      return { text: 'Under Review', color: '#B45309', bg: '#FEF3C7' };
    case 'SCHEDULED':
      return { text: 'Verification Scheduled', color: '#047857', bg: '#D1FAE5' };
    case 'COMPLETED':
      return { text: 'Completed', color: '#15803D', bg: '#DCFCE7' };
    case 'DECLINED':
      return { text: 'Assignment Declined', color: '#B91C1C', bg: '#FEE2E2' };
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
  const [applications, setApplications] = useState<any[]>([]);
  const [actionApps, setActionApps] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

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
      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcome}>Welcome to Pramaan</Text>
        <Text style={styles.subtitle}>
          Manage your instruments and verification applications in one place.
        </Text>
      </View>

      {/* ACTION REQUIRED BANNER */}
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

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>

      <View style={styles.actions}>
        <Pressable style={styles.card} onPress={() => router.push('/instruments' as any)}>
          <Text style={styles.cardIcon}>⚙️</Text>
          <Text style={styles.cardTitle}>My Instruments</Text>
          <Text style={styles.cardText}>View and manage your registered instruments</Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => router.push('/instruments/new' as any)}>
          <Text style={styles.cardIcon}>＋</Text>
          <Text style={styles.cardTitle}>Add Instrument</Text>
          <Text style={styles.cardText}>Register a new instrument</Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => router.push('/applications/create' as any)}>
          <Text style={styles.cardIcon}>📋</Text>
          <Text style={styles.cardTitle}>New Application</Text>
          <Text style={styles.cardText}>Apply for instrument verification</Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => router.push('/applications' as any)}>
          <Text style={styles.cardIcon}>📄</Text>
          <Text style={styles.cardTitle}>My Applications</Text>
          <Text style={styles.cardText}>Track your verification applications</Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => router.push('/certificates' as any)}>
          <Text style={styles.cardIcon}>🏆</Text>
          <Text style={styles.cardTitle}>Certificates</Text>
          <Text style={styles.cardText}>View your issued certificates</Text>
        </Pressable>
      </View>

      {/* APPLICATION OVERVIEW SECTION */}
      <View style={styles.overviewHeaderRow}>
        <Text style={styles.sectionTitleNoMargin}>Application Overview</Text>
        <Pressable onPress={() => router.push('/applications' as any)}>
          <Text style={styles.viewAllText}>View All Applications →</Text>
        </Pressable>
      </View>

      {loading && !refreshing ? (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Fetching applications...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Unable to load applications</Text>
          <Pressable style={styles.retryBtn} onPress={loadData}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </Pressable>
        </View>
      ) : applications.length === 0 ? (
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
          {applications.slice(0, 5).map((app) => {
            const st = formatStatus(app.status);
            const hasAction =
              app.remarks &&
              (app.remarks.includes('[REQUESTED_') || app.remarks.includes('[RETURNED_FOR_CORRECTION]'));

            return (
              <View key={app.id} style={styles.appCard}>
                {/* Header Row */}
                <View style={styles.appCardHeader}>
                  <Text style={styles.appNumber}>{app.application_number}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusText, { color: st.color }]}>{st.text}</Text>
                  </View>
                </View>

                {/* Instrument Info */}
                <View style={styles.appCardBody}>
                  <Text style={styles.instrumentName}>{app.instrument_name}</Text>

                  {app.serial_number && (
                    <Text style={styles.appCardMeta}>Serial No: {app.serial_number}</Text>
                  )}

                  <Text style={styles.appCardMeta}>Type: {formatType(app.application_type)}</Text>

                  {app.submitted_at && (
                    <Text style={styles.appCardMeta}>
                      Submitted: {new Date(app.submitted_at).toLocaleDateString()}
                    </Text>
                  )}
                </View>

                {/* Verification Result if applicable */}
                {app.verification_decision && (
                  <View
                    style={[
                      styles.resultBadgeRow,
                      {
                        backgroundColor:
                          app.verification_decision === 'PASS' ? '#DCFCE7' : '#FEE2E2',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.resultBadgeText,
                        {
                          color:
                            app.verification_decision === 'PASS' ? '#15803D' : '#B91C1C',
                        },
                      ]}
                    >
                      {app.verification_decision === 'PASS'
                        ? '✓ PASS / Verified'
                        : '✕ FAIL / Verification Failed'}
                    </Text>
                  </View>
                )}

                {/* Action Required Banner */}
                {hasAction && (
                  <View style={styles.cardActionNotice}>
                    <Text style={styles.cardActionNoticeTitle}>⚡ ACTION REQUIRED</Text>
                    <Text style={styles.cardActionNoticeText}>Document requested by Inspector</Text>
                  </View>
                )}

                {/* Certificate Section */}
                {app.certificate_id ? (
                  <View style={styles.certNoticeBox}>
                    <Text style={styles.certNoticeTitle}>
                      🏆 Certificate Issued: {app.certificate_number}
                    </Text>
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

                {/* Actions */}
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
          })}
        </View>
      )}

      {/* Information Section */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How it works</Text>
        <Text style={styles.infoText}>1. Register your instrument</Text>
        <Text style={styles.infoText}>2. Submit a verification application</Text>
        <Text style={styles.infoText}>3. Track your application status</Text>
        <Text style={styles.infoText}>4. Receive your verification certificate</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  welcomeSection: {
    marginBottom: 24,
  },

  welcome: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 15,
    color: '#111827',
  },

  sectionTitleNoMargin: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },

  overviewHeaderRow: {
    marginTop: 28,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },

  actions: {
    gap: 12,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 18,
  },

  cardIcon: {
    fontSize: 25,
    marginBottom: 8,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },

  cardText: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
  },

  stateBox: {
    padding: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6B7280',
  },

  errorBox: {
    padding: 24,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
  },

  errorText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 12,
  },

  retryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },

  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  emptyBox: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },

  emptySub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 16,
  },

  createAppBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },

  createAppBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  appListContainer: {
    gap: 14,
  },

  appCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },

  appCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  appNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },

  appCardBody: {
    gap: 2,
  },

  instrumentName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },

  appCardMeta: {
    fontSize: 13,
    color: '#64748B',
  },

  resultBadgeRow: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },

  resultBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  cardActionNotice: {
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },

  cardActionNoticeTitle: {
    fontSize: 12,
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
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
    gap: 8,
  },

  certNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },

  viewCertBtn: {
    backgroundColor: '#16A34A',
    paddingVertical: 8,
    paddingHorizontal: 12,
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
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },

  openAppCardBtn: {
    alignSelf: 'flex-start',
  },

  openAppCardBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },

  infoCard: {
    marginTop: 28,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 18,
  },

  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#1E3A8A',
  },

  infoText: {
    fontSize: 14,
    marginTop: 8,
    color: '#374151',
  },

  actionBanner: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D97706',
    gap: 12,
  },

  actionBannerHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: '#B45309',
  },

  actionItemCard: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCD34D',
    gap: 6,
  },

  actionItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  actionItemNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },

  actionItemType: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },

  actionItemText: {
    fontSize: 13,
    color: '#451A03',
    lineHeight: 18,
  },

  openAppButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },

  openAppButtonText: {
    color: '#D97706',
    fontWeight: '700',
    fontSize: 13,
  },
});