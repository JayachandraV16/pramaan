import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useOffline } from '../../../services/offline/OfflineContext';
import type { Draft } from '../../../services/offline/syncCore';

const STATE_LABEL: Record<Draft['state'], { text: string; color: string; bg: string }> = {
  DRAFT: { text: 'In progress', color: '#92400E', bg: '#FEF3C7' },
  READY: { text: 'Waiting to sync', color: '#1D4ED8', bg: '#DBEAFE' },
  SYNCED: { text: 'Synced', color: '#15803D', bg: '#DCFCE7' },
  NEEDS_ATTENTION: { text: 'Needs attention', color: '#B91C1C', bg: '#FEE2E2' },
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : 'never');

export default function FieldWork() {
  const { ready, state, syncing, lastReport, pendingCount, syncNow, startDraft, retryDraft, discardDraft } = useOffline();

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const drafts = Object.values(state.drafts).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const openAssignmentIds = new Set(drafts.filter((d) => d.state !== 'SYNCED').map((d) => d.assignmentId));
  const syncedAssignmentIds = new Set(drafts.filter((d) => d.state === 'SYNCED').map((d) => d.assignmentId));
  const jobs = Object.values(state.jobs).filter((j) => !syncedAssignmentIds.has(j.assignment_id));
  const offline = lastReport?.offline;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Field work</Text>
      <Text style={styles.sub}>Inspections are saved on this phone and uploaded automatically when you are online.</Text>

      <View style={[styles.banner, offline ? styles.bannerWarn : styles.bannerOk]}>
        <Text style={styles.bannerText}>
          {offline ? 'Offline - your work is safe on this phone.' : 'Connected.'} Last sync: {when(state.lastSyncAt)}
        </Text>
        <Text style={styles.bannerText}>
          {pendingCount === 0 ? 'Nothing waiting to upload.' : `${pendingCount} inspection(s) waiting to upload.`}
          {lastReport?.error && !offline ? ` ${lastReport.error}` : ''}
        </Text>
        <Pressable style={[styles.button, syncing && styles.disabled]} disabled={syncing} onPress={() => syncNow()}>
          <Text style={styles.buttonText}>{syncing ? 'Syncing...' : 'Sync now'}</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Assigned inspections ({jobs.length})</Text>
      {jobs.length === 0 && <Text style={styles.empty}>No assigned work on this phone yet. Connect and tap Sync now.</Text>}
      {jobs.map((job) => {
        const accepted = job.assignment_status === 'ACCEPTED';
        return (
          <View key={job.assignment_id} style={styles.card}>
            <Text style={styles.cardTitle}>{job.application_number}</Text>
            <Text style={styles.cardLine}>
              {job.instrument_name}
              {job.serial_number ? ` - ${job.serial_number}` : ''}
            </Text>
            <Text style={styles.cardLine}>
              {job.scheduled_date ? `Scheduled ${job.scheduled_date}${job.scheduled_time ? ` ${job.scheduled_time}` : ''}` : 'Not scheduled yet'}
              {job.verification_location ? ` at ${job.verification_location}` : ''}
            </Text>
            {accepted ? (
              <Pressable
                style={styles.button}
                onPress={() => {
                  const d = startDraft(job);
                  router.push({ pathname: '/inspector/offline/inspect', params: { id: d.clientId } });
                }}
              >
                <Text style={styles.buttonText}>{openAssignmentIds.has(job.assignment_id) ? 'Continue inspection' : 'Start inspection'}</Text>
              </Pressable>
            ) : (
              <Text style={styles.note}>Accept this assignment while online first (Assignments tab), then sync.</Text>
            )}
          </View>
        );
      })}

      <Text style={styles.section}>Saved on this phone ({drafts.length})</Text>
      {drafts.length === 0 && <Text style={styles.empty}>No inspections recorded yet.</Text>}
      {drafts.map((d) => {
        const s = STATE_LABEL[d.state];
        return (
          <View key={d.clientId} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{d.applicationNumber || d.applicationId.slice(0, 8)}</Text>
              <Text style={[styles.chip, { color: s.color, backgroundColor: s.bg }]}>{s.text}</Text>
            </View>
            <Text style={styles.cardLine}>
              {d.readings.length} reading(s), {d.observations.length} observation(s)
              {d.result ? ` - result ${d.result.decision}` : ''}
            </Text>
            {d.error && <Text style={styles.error}>{d.error}</Text>}
            <View style={styles.row}>
              {(d.state === 'DRAFT' || d.state === 'NEEDS_ATTENTION') && (
                <Pressable style={styles.linkButton} onPress={() => router.push({ pathname: '/inspector/offline/inspect', params: { id: d.clientId } })}>
                  <Text style={styles.link}>Open</Text>
                </Pressable>
              )}
              {d.state === 'NEEDS_ATTENTION' && (
                <Pressable style={styles.linkButton} onPress={() => retryDraft(d.clientId)}>
                  <Text style={styles.link}>Retry upload</Text>
                </Pressable>
              )}
              {d.state !== 'SYNCED' && !d.serverId && (
                <Pressable style={styles.linkButton} onPress={() => discardDraft(d.clientId)}>
                  <Text style={[styles.link, { color: '#B91C1C' }]}>Discard</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  page: { padding: 16, paddingTop: 48, gap: 10, backgroundColor: '#F8FAFC' },
  back: { color: '#1D4ED8', fontSize: 15 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  sub: { color: '#475569', marginBottom: 4 },
  banner: { borderRadius: 12, padding: 12, gap: 6 },
  bannerOk: { backgroundColor: '#ECFDF5' },
  bannerWarn: { backgroundColor: '#FEF3C7' },
  bannerText: { color: '#0F172A', fontSize: 13 },
  section: { marginTop: 8, fontSize: 16, fontWeight: '700', color: '#0F172A' },
  empty: { color: '#64748B' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, gap: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { fontWeight: '700', color: '#0F172A', fontSize: 15 },
  cardLine: { color: '#334155', fontSize: 13 },
  note: { color: '#92400E', fontSize: 12, marginTop: 4 },
  error: { color: '#B91C1C', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  chip: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  button: { backgroundColor: '#1D4ED8', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 6 },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700' },
  linkButton: { paddingVertical: 6, paddingRight: 12 },
  link: { color: '#1D4ED8', fontWeight: '600' },
});
