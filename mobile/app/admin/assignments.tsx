import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AdminApplication, AdminAssignment, createAdminAssignment, getAdminApplications, getAdminAssignments, getOfficers, Officer } from '../../services/adminService';

export default function AdminAssignmentsScreen() {
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [assignments, setAssignments] = useState<AdminAssignment[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [applicationId, setApplicationId] = useState('');
  const [officerId, setOfficerId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      setMessage('');
      const [apps, currentAssignments, eligibleOfficers] = await Promise.all([getAdminApplications(), getAdminAssignments(), getOfficers()]);
      setApplications(apps.filter((item) => !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(item.status)));
      setAssignments(currentAssignments);
      setOfficers(eligibleOfficers);
    } catch (err: any) { setMessage(err.message || 'Failed to load assignment data'); }
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const submit = async () => {
    if (!applicationId || !officerId) { setMessage('Select an application and an officer.'); return; }
    try { setSubmitting(true); await createAdminAssignment(applicationId, officerId, remarks || undefined); setRemarks(''); setMessage('Assignment created successfully.'); await load(); }
    catch (err: any) { setMessage(err.message || 'Failed to create assignment'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /><Text>Loading assignment data...</Text></View>;
  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Assignments</Text>
    <Text style={styles.subtitle}>Connect an eligible application to an active LMO or GATC officer</Text>
    {message ? <Text style={styles.message}>{message}</Text> : null}
    <Text style={styles.label}>Applications</Text>
    {applications.map((item) => <Pressable key={item.id} style={[styles.option, item.id === applicationId && styles.selected]} onPress={() => setApplicationId(item.id)}><Text>{item.application_number} · {item.status}</Text><Text>{item.instrument_name || item.instrument_id}</Text></Pressable>)}
    <Text style={styles.label}>Eligible Officers</Text>
    {officers.map((item) => <Pressable key={item.id} style={[styles.option, item.id === officerId && styles.selected]} onPress={() => setOfficerId(item.id)}><Text>{item.full_name} · {item.role}</Text><Text>{item.email || item.phone || 'No contact'}</Text></Pressable>)}
    <TextInput style={styles.input} placeholder="Assignment remarks (optional)" value={remarks} onChangeText={setRemarks} />
    <Pressable style={styles.button} disabled={submitting} onPress={submit}><Text style={styles.buttonText}>{submitting ? 'Creating...' : 'Create Assignment'}</Text></Pressable>
    <Text style={styles.label}>Existing Assignments</Text>
    <FlatList scrollEnabled={false} data={assignments} keyExtractor={(item) => item.id} ListEmptyComponent={<Text>No assignments found.</Text>} renderItem={({ item }) => <View style={styles.card}><Text style={styles.cardTitle}>{item.application_number || item.application_id}</Text><Text>{item.instrument_name || 'Instrument not provided'}</Text><Text>Status: {item.status}</Text></View>} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { marginTop: 5, color: '#64748B' },
  label: { marginTop: 22, marginBottom: 8, fontWeight: '700' },
  option: { padding: 14, marginBottom: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, gap: 4 },
  selected: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  input: { marginTop: 16, padding: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8 },
  button: { marginTop: 14, padding: 14, alignItems: 'center', backgroundColor: '#1D4ED8', borderRadius: 8 },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  message: { marginTop: 12, color: '#334155' },
  card: { padding: 14, marginBottom: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, gap: 4 },
  cardTitle: { fontWeight: '700' },
});
