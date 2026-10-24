import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { getInstrumentById } from '../../services/instrumentService';
import { Instrument } from '../../types/instrument';

export default function InstrumentDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [instrument, setInstrument] =
    useState<Instrument | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadInstrument();
  }, [id]);

  const loadInstrument = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await getInstrumentById(id);

      console.log('INSTRUMENT DETAILS:', data);

      setInstrument(data);
    } catch (err: any) {
      console.log(
        'INSTRUMENT DETAILS ERROR:',
        err
      );

      setError(
        err.message || 'Failed to load instrument'
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />

        <Text style={styles.message}>
          Loading instrument...
        </Text>
      </View>
    );
  }

  if (error || !instrument) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          {error || 'Instrument not found'}
        </Text>

        <Pressable
          style={styles.retryButton}
          onPress={loadInstrument}
        >
          <Text style={styles.retryText}>
            Try Again
          </Text>
        </Pressable>

        <Pressable
          style={styles.dashboardButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.dashboardText}>
            Back to Dashboard
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Back Button */}
      <Pressable
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonText}>
          ← Back
        </Text>
      </Pressable>

      {/* Title */}
      <Text style={styles.title}>
        {instrument.instrument_name}
      </Text>

      {instrument.instrument_type_name && (
        <Text style={styles.subtitle}>
          {instrument.instrument_type_name}
        </Text>
      )}

      {/* Status */}
      <View style={styles.status}>
        <Text style={styles.statusText}>
          {instrument.status}
        </Text>
      </View>

      {/* Details */}
      <View style={styles.card}>
        <DetailRow
          label="Serial Number"
          value={instrument.serial_number}
        />

        <DetailRow
          label="Manufacturer"
          value={instrument.manufacturer}
        />

        <DetailRow
          label="Model"
          value={instrument.model}
        />

        <DetailRow
          label="Capacity"
          value={
            instrument.capacity
              ? `${instrument.capacity} ${
                  instrument.capacity_unit || ''
                }`
              : undefined
          }
        />

        <DetailRow
          label="Accuracy Class"
          value={instrument.accuracy_class}
        />

        <DetailRow
          label="Location Address"
          value={instrument.location_address}
        />

        <DetailRow
          label="Latitude"
          value={
            instrument.location_lat !== null &&
            instrument.location_lat !== undefined
              ? String(instrument.location_lat)
              : undefined
          }
        />

        <DetailRow
          label="Longitude"
          value={
            instrument.location_lng !== null &&
            instrument.location_lng !== undefined
              ? String(instrument.location_lng)
              : undefined
          }
        />
      </View>

      {/* Dashboard Button */}
      <Pressable
        style={styles.dashboardButton}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={styles.dashboardText}>
          Back to Dashboard
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.label}>
        {label}
      </Text>

      <Text style={styles.value}>
        {value !== undefined &&
        value !== null &&
        value !== ''
          ? String(value)
          : 'Not provided'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  content: {
    padding: 20,
    paddingBottom: 40,
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

  error: {
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 16,
  },

  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 20,
  },

  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
  },

  subtitle: {
    fontSize: 15,
    marginTop: 6,
    opacity: 0.6,
  },

  status: {
    alignSelf: 'flex-start',
    marginTop: 15,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },

  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },

  card: {
    marginTop: 25,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
  },

  detailRow: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  label: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 5,
  },

  value: {
    fontSize: 16,
    fontWeight: '500',
  },

  retryButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 8,
  },

  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  dashboardButton: {
    marginTop: 20,
    backgroundColor: '#111827',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },

  dashboardText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});