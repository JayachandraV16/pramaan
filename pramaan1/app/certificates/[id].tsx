import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { getCertificateById } from '../../services/certificateService';

type Certificate = {
  id: string;
  certificate_number: string;
  issue_date: string;
  valid_from: string;
  valid_until: string;
  status: string;
  certificate_file_url?: string | null;
  instrument_name?: string;
  serial_number?: string;
  manufacturer?: string | null;
  model?: string | null;
  application_number?: string;
};

const API_ORIGIN =
  Platform.OS === 'web'
    ? 'http://localhost:5000'
    : 'http://10.235.236.1:5000';

export default function CertificateDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    getCertificateById(id)
      .then(setCertificate)
      .catch((err: any) => setError(err.message || 'Failed to load certificate'))
      .finally(() => setLoading(false));
  }, [id]);

  const openPdf = async () => {
    if (!certificate?.certificate_file_url) return;
    const url = certificate.certificate_file_url.startsWith('http')
      ? certificate.certificate_file_url
      : `${API_ORIGIN}${certificate.certificate_file_url}`;

    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Unable to open certificate', 'The PDF URL could not be opened.');
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /><Text>Loading certificate...</Text></View>;
  }

  if (error || !certificate) {
    return <View style={styles.center}><Text style={styles.error}>{error || 'Certificate not found'}</Text></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()}><Text style={styles.back}>Back</Text></Pressable>
      <Text style={styles.title}>{certificate.certificate_number}</Text>
      <View style={styles.status}><Text>{certificate.status}</Text></View>
      <View style={styles.card}>
        <Detail label="Instrument" value={certificate.instrument_name} />
        <Detail label="Serial Number" value={certificate.serial_number} />
        <Detail label="Manufacturer" value={certificate.manufacturer} />
        <Detail label="Model" value={certificate.model} />
        <Detail label="Application" value={certificate.application_number} />
        <Detail label="Issue Date" value={new Date(certificate.issue_date).toLocaleDateString()} />
        <Detail label="Valid From" value={new Date(certificate.valid_from).toLocaleDateString()} />
        <Detail label="Valid Until" value={new Date(certificate.valid_until).toLocaleDateString()} />
      </View>
      {certificate.certificate_file_url ? (
        <Pressable style={styles.button} onPress={openPdf}><Text style={styles.buttonText}>Open PDF Certificate</Text></Pressable>
      ) : null}
    </ScrollView>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return <View style={styles.row}><Text style={styles.label}>{label}</Text><Text>{value || 'Not provided'}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 20, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 12 },
  back: { color: '#2563EB', fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700' },
  status: { alignSelf: 'flex-start', padding: 8, backgroundColor: '#DCFCE7', borderRadius: 8 },
  card: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 16, gap: 14 },
  row: { gap: 4 },
  label: { fontSize: 12, color: '#6B7280' },
  button: { backgroundColor: '#1D4ED8', borderRadius: 10, padding: 15, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  error: { color: '#B91C1C', textAlign: 'center' },
});
