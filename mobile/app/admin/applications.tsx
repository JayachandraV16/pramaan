import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AdminApplication, getAdminApplications } from '../../services/adminService';

export default function AdminApplicationsScreen() {
  const [items, setItems] = useState<AdminApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try { setError(''); setItems(await getAdminApplications()); }
    catch (err: any) { setError(err.message || 'Failed to load applications'); }
    finally { setLoading(false); setRefreshing(false); }
  };
  useFocusEffect(useCallback(() => { setLoading(true); load(); }, []));

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /><Text>Loading applications...</Text></View>;
  return <View style={styles.container}>
    <Text style={styles.title}>Applications</Text>
    <Text style={styles.subtitle}>Review submitted applications before assignment</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      contentContainerStyle={items.length ? styles.list : styles.center}
      ListEmptyComponent={<Text>No applications found.</Text>}
      renderItem={({ item }) => <Pressable style={styles.card} onPress={() => router.push({ pathname: '/admin/applications/[id]', params: { id: item.id } })}>
        <Text style={styles.cardTitle}>{item.application_number}</Text>
        <Text>Status: {item.status}</Text>
        <Text>Type: {item.application_type}</Text>
        <Text>Applicant: {item.applicant_name || item.applicant_id || 'Not provided'}</Text>
        <Text>Instrument: {item.instrument_name || item.instrument_id || 'Not provided'}</Text>
        {item.serial_number ? <Text>Serial: {item.serial_number}</Text> : null}
        {item.location_address ? <Text>Location: {item.location_address}</Text> : null}
        {item.purpose ? <Text>Purpose: {item.purpose}</Text> : null}
        {item.remarks ? <Text>Remarks: {item.remarks}</Text> : null}
        <Text style={styles.link}>Open application details</Text>
      </Pressable>}
    />
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  list: { paddingVertical: 16, gap: 12 },
  title: { fontSize: 26, fontWeight: '700' },
  subtitle: { marginTop: 5, color: '#64748B' },
  card: { padding: 16, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', gap: 5 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  error: { color: '#B91C1C', marginTop: 12 },
  link: { marginTop: 6, color: '#1D4ED8', fontWeight: '700' },
});
