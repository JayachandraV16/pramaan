import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AdminVerification, getAdminVerifications } from '../../services/adminService';

export default function AdminVerificationsScreen() {
  const [items, setItems] = useState<AdminVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const load = async () => { try { setError(''); setItems(await getAdminVerifications()); } catch (err: any) { setError(err.message || 'Failed to load verifications'); } finally { setLoading(false); setRefreshing(false); } };
  useFocusEffect(useCallback(() => { setLoading(true); load(); }, []));
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /><Text>Loading verifications...</Text></View>;
  return <View style={styles.container}><Text style={styles.title}>Verification Monitoring</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<FlatList data={items} keyExtractor={(item) => item.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />} contentContainerStyle={items.length ? styles.list : styles.center} ListEmptyComponent={<Text>No verifications found.</Text>} renderItem={({ item }) => <View style={styles.card}><Text style={styles.cardTitle}>{item.application_number || item.application_id}</Text><Text>Verification: {item.id}</Text><Text>Officer: {item.assigned_to_name || item.performed_by_name || 'Not provided'}</Text><Text>Instrument: {item.instrument_name || 'Not provided'}</Text><Text>Status: {item.status}</Text><Text>Decision: {item.decision || 'Pending'}</Text></View>} /></View>;
}
const styles = StyleSheet.create({ container: { flex: 1, padding: 20, backgroundColor: '#F8FAFC' }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }, list: { paddingVertical: 16, gap: 12 }, title: { fontSize: 26, fontWeight: '700' }, card: { padding: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, gap: 5 }, cardTitle: { fontSize: 17, fontWeight: '700' }, error: { color: '#B91C1C', marginTop: 12 } });
