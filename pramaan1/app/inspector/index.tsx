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
import { getAssignments } from '../../services/assignmentService';
import { getSchedules } from '../../services/scheduleService';

type InspectorCategoryTab = 'OVERVIEW' | 'ASSIGNMENTS' | 'SCHEDULED' | 'VERIFICATION' | 'COMPLETED';

export default function InspectorDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<InspectorCategoryTab>('OVERVIEW');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
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
      const [asgns, scheds] = await Promise.all([getAssignments(), getSchedules()]);
      setAssignments(Array.isArray(asgns) ? asgns : []);
      setSchedules(Array.isArray(scheds) ? scheds : []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load inspector dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/login');
  };

  // Filter categories
  const pendingAssignments = assignments.filter((a) => a.status === 'ASSIGNED');
  const acceptedAssignments = assignments.filter((a) => a.status === 'ACCEPTED');
  const scheduledList = assignments.filter((a) => a.schedule_id || a.scheduled_date);
  const pendingVerification = assignments.filter((a) => a.status === 'ACCEPTED' && !a.verification_decision);
  const completedList = assignments.filter((a) => a.status === 'COMPLETED' || a.verification_decision);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2563EB']} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Inspector Dashboard</Text>
          <Text style={styles.welcome}>Welcome, {user?.full_name || 'Officer'} ({user?.role})</Text>
        </View>
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
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
          style={[styles.tabButton, activeTab === 'ASSIGNMENTS' && styles.tabButtonActive]}
          onPress={() => setActiveTab('ASSIGNMENTS')}
        >
          <Text style={[styles.tabText, activeTab === 'ASSIGNMENTS' && styles.tabTextActive]}>
            ASSIGNMENTS
          </Text>
          {pendingAssignments.length > 0 && (
            <View style={styles.badgeOrange}>
              <Text style={styles.badgeTextWhite}>{pendingAssignments.length}</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === 'SCHEDULED' && styles.tabButtonActive]}
          onPress={() => setActiveTab('SCHEDULED')}
        >
          <Text style={[styles.tabText, activeTab === 'SCHEDULED' && styles.tabTextActive]}>
            SCHEDULED
          </Text>
          <View style={[styles.badge, activeTab === 'SCHEDULED' ? styles.badgeActive : styles.badgeInactive]}>
            <Text style={[styles.badgeText, activeTab === 'SCHEDULED' ? styles.badgeTextActive : styles.badgeTextInactive]}>
              {scheduledList.length}
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === 'VERIFICATION' && styles.tabButtonActive]}
          onPress={() => setActiveTab('VERIFICATION')}
        >
          <Text style={[styles.tabText, activeTab === 'VERIFICATION' && styles.tabTextActive]}>
            VERIFICATION
          </Text>
          <View style={[styles.badge, activeTab === 'VERIFICATION' ? styles.badgeActive : styles.badgeInactive]}>
            <Text style={[styles.badgeText, activeTab === 'VERIFICATION' ? styles.badgeTextActive : styles.badgeTextInactive]}>
              {pendingVerification.length}
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.tabButton, activeTab === 'COMPLETED' && styles.tabButtonActive]}
          onPress={() => setActiveTab('COMPLETED')}
        >
          <Text style={[styles.tabText, activeTab === 'COMPLETED' && styles.tabTextActive]}>
            COMPLETED
          </Text>
          <View style={[styles.badge, activeTab === 'COMPLETED' ? styles.badgeActive : styles.badgeInactive]}>
            <Text style={[styles.badgeText, activeTab === 'COMPLETED' ? styles.badgeTextActive : styles.badgeTextInactive]}>
              {completedList.length}
            </Text>
          </View>
        </Pressable>
      </ScrollView>

      {/* Loading / Error States */}
      {loading && !refreshing ? (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading inspector data...</Text>
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
              {/* Summary Cards */}
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{pendingAssignments.length}</Text>
                  <Text style={styles.statLabel}>Pending Acceptance</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{scheduledList.length}</Text>
                  <Text style={styles.statLabel}>Scheduled Visits</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{completedList.length}</Text>
                  <Text style={styles.statLabel}>Completed</Text>
                </View>
              </View>

              {/* Quick Link Cards */}
              <Text style={styles.sectionTitle}>Field Execution Views</Text>
              <Pressable style={styles.actionCard} onPress={() => router.push('/inspector/assignments')}>
                <Text style={styles.actionCardTitle}>📋 All My Assignments ({assignments.length})</Text>
                <Text style={styles.actionCardSub}>View full list of assigned verification requests</Text>
              </Pressable>

              <Pressable style={styles.actionCard} onPress={() => router.push('/inspector/schedules')}>
                <Text style={styles.actionCardTitle}>📅 Verification Schedule ({schedules.length})</Text>
                <Text style={styles.actionCardSub}>View upcoming verification calendar and locations</Text>
              </Pressable>
            </View>
          )}

          {/* TAB 2: ASSIGNMENTS */}
          {activeTab === 'ASSIGNMENTS' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>Assigned Applications ({assignments.length})</Text>
              {assignments.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No assignments found</Text>
                  <Text style={styles.emptySub}>Assignments from Admin will appear here.</Text>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {assignments.map((item) => (
                    <InspectorAssignmentCard key={item.id} item={item} />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 3: SCHEDULED */}
          {activeTab === 'SCHEDULED' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>Scheduled Verifications ({scheduledList.length})</Text>
              {scheduledList.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No scheduled verifications</Text>
                  <Text style={styles.emptySub}>Admin-scheduled dates and times will appear here.</Text>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {scheduledList.map((item) => (
                    <InspectorAssignmentCard key={item.id} item={item} />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 4: VERIFICATION */}
          {activeTab === 'VERIFICATION' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>Pending Field Verification ({pendingVerification.length})</Text>
              {pendingVerification.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No verifications pending</Text>
                  <Text style={styles.emptySub}>Accepted assignments ready for verification will appear here.</Text>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {pendingVerification.map((item) => (
                    <InspectorAssignmentCard key={item.id} item={item} />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 5: COMPLETED */}
          {activeTab === 'COMPLETED' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>Completed Verifications ({completedList.length})</Text>
              {completedList.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No completed verifications</Text>
                  <Text style={styles.emptySub}>Verifications with submitted PASS/FAIL results appear here.</Text>
                </View>
              ) : (
                <View style={styles.listContainer}>
                  {completedList.map((item) => (
                    <InspectorAssignmentCard key={item.id} item={item} />
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
        <Text style={styles.logoutSectionSub}>Logged in as Inspector ({user?.full_name || 'Officer'} - {user?.role})</Text>
        <Pressable style={styles.largeLogoutBtn} onPress={handleLogout}>
          <Text style={styles.largeLogoutBtnText}>🚪 Logout from Inspector Account</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function InspectorAssignmentCard({ item }: { item: any }) {
  const isScheduled = !!item.scheduled_date;
  const dateStr = item.scheduled_date
    ? typeof item.scheduled_date === 'string'
      ? item.scheduled_date.split('T')[0]
      : new Date(item.scheduled_date).toISOString().split('T')[0]
    : null;

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/inspector/assignments/${item.id}` as any)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardAppNum}>{item.application_number || item.application_id}</Text>
        <View style={[styles.statusBadge, item.status === 'ACCEPTED' ? styles.badgeGreen : styles.badgeYellow]}>
          <Text style={styles.statusBadgeText}>{item.status}</Text>
        </View>
      </View>

      <Text style={styles.cardInstrument}>{item.instrument_name || 'Instrument'}</Text>
      {item.serial_number && <Text style={styles.cardMeta}>Serial No: {item.serial_number}</Text>}
      {item.applicant_name && <Text style={styles.cardMeta}>Applicant: {item.applicant_name}</Text>}

      {isScheduled ? (
        <View style={styles.scheduleBox}>
          <Text style={styles.scheduleText}>
            📅 {dateStr}{item.scheduled_time ? ` at ${item.scheduled_time}` : ''}
          </Text>
          {item.verification_location && (
            <Text style={styles.scheduleSub}>Location: {item.verification_location}</Text>
          )}
        </View>
      ) : (
        <Text style={styles.unscheduledText}>⏳ Not scheduled yet by Admin</Text>
      )}

      {item.verification_decision && (
        <View
          style={[
            styles.decisionBadge,
            { backgroundColor: item.verification_decision === 'PASS' ? '#DCFCE7' : '#FEE2E2' },
          ]}
        >
          <Text
            style={[
              styles.decisionText,
              { color: item.verification_decision === 'PASS' ? '#15803D' : '#B91C1C' },
            ]}
          >
            {item.verification_decision === 'PASS' ? '✓ PASS' : '✕ FAIL'}
          </Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.openText}>View Details →</Text>
      </View>
    </Pressable>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  welcome: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logoutBtnText: {
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
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  actionCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionCardSub: {
    fontSize: 12,
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
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  listContainer: {
    gap: 10,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardAppNum: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeGreen: {
    backgroundColor: '#DCFCE7',
  },
  badgeYellow: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  cardInstrument: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  cardMeta: {
    fontSize: 12,
    color: '#64748B',
  },
  scheduleBox: {
    marginTop: 4,
    padding: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  scheduleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  scheduleSub: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 2,
  },
  unscheduledText: {
    fontSize: 12,
    color: '#D97706',
    fontStyle: 'italic',
    marginTop: 2,
  },
  decisionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  decisionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardFooter: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
  },
  openText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
});