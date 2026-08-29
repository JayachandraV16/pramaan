import { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
  useFocusEffect,
} from 'expo-router';

import { getInstruments } from '../../services/instrumentService';
import { Instrument } from '../../types/instrument';

export default function InstrumentsScreen() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadInstruments = async () => {
    try {
      setError('');

      const data = await getInstruments();

      setInstruments(data);
    } catch (err: any) {
      setError(
        err.message || 'Failed to load instruments'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadInstruments();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadInstruments();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Loading instruments...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* Back to Dashboard */}
      <Pressable
        style={styles.backButton}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={styles.backButtonText}>
          ← Back to Dashboard
        </Text>
      </Pressable>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            My Instruments
          </Text>

          <Text style={styles.subtitle}>
            Manage your registered instruments
          </Text>
        </View>

        <Pressable
          style={styles.addButton}
          onPress={() =>
            router.push('/instruments/new')
          }
        >
          <Text style={styles.addButtonText}>
            + Add
          </Text>
        </Pressable>
      </View>

      {/* Error */}
      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>
            {error}
          </Text>

          <Pressable
            style={styles.retryButton}
            onPress={loadInstruments}
          >
            <Text style={styles.retryText}>
              Retry
            </Text>
          </Pressable>
        </View>

      /* Empty */
      ) : instruments.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>
            No Instruments Yet
          </Text>

          <Text style={styles.emptyText}>
            Add your first instrument to get started.
          </Text>

          <Pressable
            style={styles.emptyButton}
            onPress={() =>
              router.push('/instruments/new')
            }
          >
            <Text style={styles.emptyButtonText}>
              Add Instrument
            </Text>
          </Pressable>
        </View>

      /* List */
      ) : (
        <FlatList
          data={instruments}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push(
                  `/instruments/${item.id}`
                )
              }
            >
              <View style={styles.cardHeader}>
                <Text style={styles.instrumentName}>
                  {item.instrument_name}
                </Text>

                <View style={styles.status}>
                  <Text style={styles.statusText}>
                    {item.status}
                  </Text>
                </View>
              </View>

              <Text style={styles.type}>
                {item.instrument_type_name ||
                  'Instrument'}
              </Text>

              <Text style={styles.detail}>
                Serial No: {item.serial_number}
              </Text>

              {item.manufacturer && (
                <Text style={styles.detail}>
                  Manufacturer: {item.manufacturer}
                </Text>
              )}

              {item.capacity && (
                <Text style={styles.detail}>
                  Capacity: {item.capacity}{' '}
                  {item.capacity_unit || ''}
                </Text>
              )}
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
    padding: 20,
    backgroundColor: '#FFFFFF',
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginBottom: 15,
  },

  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  headerText: {
    flex: 1,
    marginRight: 15,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
  },

  subtitle: {
    fontSize: 14,
    marginTop: 4,
    opacity: 0.6,
  },

  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },

  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  list: {
    paddingBottom: 30,
  },

  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },

  instrumentName: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    marginRight: 10,
  },

  type: {
    fontSize: 14,
    marginBottom: 10,
    opacity: 0.7,
  },

  detail: {
    fontSize: 13,
    marginTop: 4,
    opacity: 0.7,
  },

  status: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#DCFCE7',
  },

  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  loadingText: {
    marginTop: 12,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
  },

  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.6,
  },

  emptyButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#2563EB',
    borderRadius: 8,
  },

  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  errorText: {
    textAlign: 'center',
    color: '#DC2626',
  },

  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },

  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});