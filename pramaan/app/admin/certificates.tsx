import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AdminCertificate, getAdminCertificates, issueAdminCertificate } from '../../services/adminService';

const API_ORIGIN = 'http://10.235.236.1:5000';
export default function AdminCertificatesScreen() {
  const [items, setItems] = useState<AdminCertificate[]>([]);
  const [verificationId, setVerificationId] = useState('');
  const [instrumentId, setInstrumentId] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const load = async () => { try { setItems(await getAdminCertificates()); } catch (err: any) { setMessage(err.message || 'Failed to load certificates'); } finally { setLoading(false); } };
  useFocusEffect(useCallback(() => { load(); }, []));
  const issue = async () => { if (!verificationId || !instrumentId || !validFrom || !validUntil) { setMessage('Verification, instrument, and validity dates are required.'); return; } try { setSubmitting(true); await issueAdminCertificate({ verificationId, instrumentId, validFrom, validUntil }); setMessage('Certificate issued successfully.'); await load(); } catch (err: any) { setMessage(err.message || 'Failed to issue certificate'); } finally { setSubmitting(false); } };
  const openPdf = async (path?: string | null) => { if (!path) return; await Linking.openURL(path.startsWith('http') ? path : `${API_ORIGIN}${path}`); };
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /><Text>Loading certificates...</Text></View>;
  return <ScrollView contentContainerStyle={styles.container}><Text style={styles.title}>Certificates</Text><Text style={styles.subtitle}>Issue certificates only for completed PASS verifications</Text>{message ? <Text style={styles.message}>{message}</Text> : null}<TextInput style={styles.input} placeholder="Verification ID" value={verificationId} onChangeText={setVerificationId} /><TextInput style={styles.input} placeholder="Instrument ID" value={instrumentId} onChangeText={setInstrumentId} /><TextInput style={styles.input} placeholder="Valid from (YYYY-MM-DD)" value={validFrom} onChangeText={setValidFrom} /><TextInput style={styles.input} placeholder="Valid until (YYYY-MM-DD)" value={validUntil} onChangeText={setValidUntil} /><Pressable style={styles.button} disabled={submitting} onPress={issue}><Text style={styles.buttonText}>{submitting ? 'Issuing...' : 'Issue Certificate'}</Text></Pressable><FlatList scrollEnabled={false} data={items} keyExtractor={(item) => item.id} ListEmptyComponent={<Text>No certificates found.</Text>} renderItem={({ item }) => <View style={styles.card}><Text style={styles.cardTitle}>{item.certificate_number}</Text><Text>Instrument: {item.instrument_name || 'Not provided'}</Text><Text>Application: {item.application_number || 'Not provided'}</Text><Text>Issue date: {item.issue_date}</Text><Text>Validity: {item.valid_from} to {item.valid_until}</Text><Text>Status: {item.status}</Text>{item.certificate_file_url ? <Pressable onPress={() => openPdf(item.certificate_file_url)}><Text style={styles.link}>Open PDF</Text></Pressable> : null}</View>} /></ScrollView>;
}
const styles = StyleSheet.create({ container: { flexGrow: 1, padding: 20, backgroundColor: '#F8FAFC' }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }, title: { fontSize: 26, fontWeight: '700' }, subtitle: { marginTop: 5, color: '#64748B' }, message: { marginTop: 12 }, input: { marginTop: 10, padding: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8 }, button: { marginTop: 14, padding: 14, alignItems: 'center', backgroundColor: '#1D4ED8', borderRadius: 8 }, buttonText: { color: '#FFFFFF', fontWeight: '700' }, card: { marginTop: 14, padding: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, gap: 5 }, cardTitle: { fontSize: 17, fontWeight: '700' }, link: { color: '#1D4ED8', fontWeight: '700' } });
