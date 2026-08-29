import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { getVerifications } from '../../services/verificationService';

type Verification = { id: string; application_id: string; application_number?: string; status: string };

export default function InspectorVerificationsScreen() {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadVerifications = async () => {
    try {
      setError('');
      setVerifications(await getVerifications());
    } catch (err: any) {
      setError(err.message || 'Failed to load verifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadVerifications();
  }, []));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /><Text>Loading verifications...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verifications</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={verifications}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadVerifications(); }} />}
        contentContainerStyle={verifications.length === 0 ? styles.center : styles.list}
        ListEmptyComponent={<Text>No verifications yet.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push({ pathname: '/inspector/verification/[id]', params: { id: item.id } })}>
            <Text>{item.application_number || item.application_id} - {item.status}</Text>
          </Pressable>
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
  card: { padding: 16, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10 },
  error: { color: '#B91C1C', marginTop: 12 },
});