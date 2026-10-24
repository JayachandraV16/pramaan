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

import { getCertificates } from '../../services/certificateService';

type Certificate = {
  id: string;
  certificate_number: string;
  status?: string;
  issued_at?: string | null;
  expiry_date?: string | null;
  issue_date?: string | null;
  valid_until?: string | null;

  instrument_name?: string;
  serial_number?: string;
};

export default function CertificatesScreen() {
  const [certificates, setCertificates] = useState<
    Certificate[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadCertificates = async () => {
    try {
      setError('');

      const data = await getCertificates();

      console.log('CERTIFICATES:', data);

      setCertificates(data);
    } catch (err: any) {
      console.log('CERTIFICATES ERROR:', err);

      setError(
        err.message || 'Failed to load certificates'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadCertificates();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadCertificates();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />

        <Text style={styles.message}>
          Loading certificates...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          {error}
        </Text>

        <Pressable
          style={styles.retryButton}
          onPress={loadCertificates}
        >
          <Text style={styles.retryText}>
            Try Again
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Certificates
        </Text>

        <Text style={styles.subtitle}>
          Your issued verification certificates
        </Text>
      </View>

      <FlatList
        data={certificates}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
        contentContainerStyle={
          certificates.length === 0
            ? styles.emptyContainer
            : styles.list
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              No Certificates Yet
            </Text>

            <Text style={styles.emptyText}>
              Certificates will appear here once your
              verification process is completed.
            </Text>

            <Pressable
              style={styles.dashboardButton}
              onPress={() =>
                router.replace('/(tabs)')
              }
            >
              <Text style={styles.dashboardText}>
                Back to Dashboard
              </Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: '/certificates/[id]',
                params: { id: item.id },
              } as any)
            }
          >
            <View style={styles.cardHeader}>
              <Text style={styles.certificateNumber}>
                {item.certificate_number}
              </Text>

              {item.status && (
                <View style={styles.status}>
                  <Text style={styles.statusText}>
                    {item.status}
                  </Text>
                </View>
              )}
            </View>

            {item.instrument_name && (
              <Text style={styles.instrumentName}>
                {item.instrument_name}
              </Text>
            )}

            {item.serial_number && (
              <Text style={styles.detail}>
                Serial No: {item.serial_number}
              </Text>
            )}

            {(item.issue_date || item.issued_at) && (
              <Text style={styles.detail}>
                Issued:{' '}
                {new Date(
                  item.issue_date || item.issued_at || ''
                ).toLocaleDateString()}
              </Text>
            )}

            {(item.valid_until || item.expiry_date) && (
              <Text style={styles.detail}>
                Valid Until:{' '}
                {new Date(
                  item.valid_until || item.expiry_date || ''
                ).toLocaleDateString()}
              </Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
  },

  subtitle: {
    fontSize: 14,
    marginTop: 5,
    opacity: 0.6,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  message: {
    marginTop: 12,
  },

  error: {
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 16,
  },

  retryButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },

  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  list: {
    padding: 20,
    paddingBottom: 30,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  certificateNumber: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
  },

  status: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },

  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },

  instrumentName: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 14,
  },

  detail: {
    fontSize: 13,
    marginTop: 6,
    opacity: 0.65,
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
    fontWeight: '700',
  },

  emptyText: {
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 21,
    opacity: 0.6,
  },

  dashboardButton: {
    marginTop: 24,
    backgroundColor: '#111827',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },

  dashboardText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});