import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { getSchedules, Schedule } from '../../services/scheduleService';

export default function InspectorSchedulesScreen() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadSchedules = async () => {
    try {
      setError('');
      setSchedules(await getSchedules());
    } catch (err: any) {
      setError(err.message || 'Failed to load schedules');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadSchedules();
  }, []));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /><Text>Loading schedules...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verification Schedule</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={schedules}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadSchedules(); }} />}
        contentContainerStyle={schedules.length === 0 ? styles.center : styles.list}
        ListEmptyComponent={<Text>No verification schedules yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.application_number || item.application_id}</Text>
            <Text>Status: {item.status}</Text>
            <Text>Date: {new Date(item.scheduled_date).toLocaleDateString()}</Text>
            {item.scheduled_time ? <Text>Time: {item.scheduled_time}</Text> : null}
            {item.verification_location ? <Text>Location: {item.verification_location}</Text> : null}
            {item.remarks ? <Text>Remarks: {item.remarks}</Text> : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  list: { paddingVertical: 16, gap: 12 },
  title: { fontSize: 26, fontWeight: '700' },
  card: { padding: 16, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, gap: 5 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  error: { color: '#B91C1C', marginTop: 12 },
});