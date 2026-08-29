import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useCallback, useState } from 'react';
import { useFocusEffect, router } from 'expo-router';

import { getApplications } from '../../services/applicationService';

type Application = {
  id: string;
  application_number: string;
  application_type: string;
  status: string;
  instrument_name?: string;
  serial_number?: string;
};

export default function ApplicationsScreen() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadApplications = async () => {
    try {
      setError('');

      const data = await getApplications();

      console.log('APPLICATIONS:', data);

      setApplications(data);
    } catch (err: any) {
      console.log('APPLICATION ERROR:', err);

      setError(
        err.message || 'Failed to load applications'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadApplications();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadApplications();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Applications
        </Text>

        <Pressable
          style={styles.addButton}
          onPress={() =>
            router.push('/applications/create')
          }
        >
          <Text style={styles.addButtonText}>
            + New Application
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.message}>
            Loading applications...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>
            {error}
          </Text>

          <Pressable
            style={styles.retryButton}
            onPress={loadApplications}
          >
            <Text style={styles.retryText}>
              Try Again
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={applications}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          }
          contentContainerStyle={
            applications.length === 0
              ? styles.emptyContainer
              : styles.list
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                No Applications Yet
              </Text>

              <Text style={styles.emptyText}>
                Your verification applications will appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
  <Pressable
    style={styles.card}
    onPress={() =>
      router.push(`/applications/${item.id}`)
    }
  >
    <View style={styles.cardHeader}>
      <Text style={styles.applicationNumber}>
        {item.application_number}
      </Text>

      <View style={styles.status}>
        <Text style={styles.statusText}>
          {item.status}
        </Text>
      </View>
    </View>

    {item.instrument_name && (
      <Text style={styles.instrumentName}>
        {item.instrument_name}
      </Text>
    )}

    {item.serial_number && (
      <Text style={styles.serialNumber}>
        Serial No: {item.serial_number}
      </Text>
    )}

    <Text style={styles.applicationType}>
      {item.application_type === 'RE_VERIFICATION'
        ? 'Re-Verification'
        : 'Verification'}
    </Text>
  </Pressable>
)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 15,
  },

  addButton: {
    backgroundColor: '#000',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },

  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  message: {
    marginTop: 12,
  },

  list: {
    padding: 20,
  },

  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  applicationNumber: {
    fontSize: 14,
    fontWeight: '600',
  },

  status: {
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },

  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },

  instrumentName: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 14,
  },

  serialNumber: {
    marginTop: 4,
    opacity: 0.6,
  },

  applicationType: {
    marginTop: 12,
    fontWeight: '500',
  },

  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  empty: {
    alignItems: 'center',
    padding: 30,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },

  emptyText: {
    marginTop: 10,
    textAlign: 'center',
    opacity: 0.6,
  },

  error: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 15,
  },

  retryButton: {
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },

  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
});