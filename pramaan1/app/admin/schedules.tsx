import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AdminAssignment, createAdminSchedule, getAdminAssignments, getAdminSchedules } from '../../services/adminService';

type Schedule = { id: string; application_id: string; assignment_id: string; application_number?: string; scheduled_date: string; scheduled_time?: string; verification_location?: string; status: string };

export default function AdminSchedulesScreen() {
  const [assignments, setAssignments] = useState<AdminAssignment[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [applicationId, setApplicationId] = useState('');
  const [assignmentId, setAssignmentId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => { try { const [a, s] = await Promise.all([getAdminAssignments(), getAdminSchedules()]); setAssignments(a.filter((item) => !['DECLINED', 'COMPLETED'].includes(item.status))); setSchedules(s); } catch (err: any) { setMessage(err.message || 'Failed to load schedules'); } finally { setLoading(false); } };
  useFocusEffect(useCallback(() => { load(); }, []));
  const submit = async () => { if (!applicationId || !assignmentId || !date) { setMessage('Select an assignment and enter a date in YYYY-MM-DD format.'); return; } try { setSubmitting(true); await createAdminSchedule({ applicationId, assignmentId, scheduledDate: date, ...(time ? { scheduledTime: time } : {}), ...(location ? { verificationLocation: location } : {}) }); setMessage('Schedule created successfully.'); setDate(''); setTime(''); setLocation(''); await load(); } catch (err: any) { setMessage(err.message || 'Failed to create schedule'); } finally { setSubmitting(false); } };
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /><Text>Loading schedules...</Text></View>;
  return <ScrollView contentContainerStyle={styles.container}><Text style={styles.title}>Schedules</Text><Text style={styles.subtitle}>Schedule an existing assignment</Text>{message ? <Text style={styles.message}>{message}</Text> : null}<Text style={styles.label}>Assignments</Text>{assignments.map((item) => <Pressable key={item.id} style={[styles.option, item.id === assignmentId && styles.selected]} onPress={() => { setAssignmentId(item.id); setApplicationId(item.application_id); }}><Text>{item.application_number || item.application_id}</Text><Text>{item.instrument_name || 'Instrument'} · {item.status}</Text></Pressable>)}<TextInput style={styles.input} placeholder="Scheduled date (YYYY-MM-DD)" value={date} onChangeText={setDate} /><TextInput style={styles.input} placeholder="Scheduled time (optional)" value={time} onChangeText={setTime} /><TextInput style={styles.input} placeholder="Verification location (optional)" value={location} onChangeText={setLocation} /><Pressable style={styles.button} disabled={submitting} onPress={submit}><Text style={styles.buttonText}>{submitting ? 'Creating...' : 'Create Schedule'}</Text></Pressable><Text style={styles.label}>Existing Schedules</Text><FlatList scrollEnabled={false} data={schedules} keyExtractor={(item) => item.id} ListEmptyComponent={<Text>No schedules found.</Text>} renderItem={({ item }) => <View style={styles.card}><Text style={styles.cardTitle}>{item.application_number || item.application_id}</Text><Text>{item.scheduled_date} · {item.status}</Text>{item.verification_location ? <Text>{item.verification_location}</Text> : null}</View>} /></ScrollView>;
}
const styles = StyleSheet.create({ container: { flexGrow: 1, padding: 20, backgroundColor: '#F8FAFC' }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }, title: { fontSize: 26, fontWeight: '700' }, subtitle: { marginTop: 5, color: '#64748B' }, label: { marginTop: 22, marginBottom: 8, fontWeight: '700' }, option: { padding: 14, marginBottom: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, gap: 4 }, selected: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' }, input: { marginTop: 10, padding: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8 }, button: { marginTop: 14, padding: 14, alignItems: 'center', backgroundColor: '#1D4ED8', borderRadius: 8 }, buttonText: { color: '#FFFFFF', fontWeight: '700' }, message: { marginTop: 12 }, card: { padding: 14, marginBottom: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, gap: 4 }, cardTitle: { fontWeight: '700' } });
