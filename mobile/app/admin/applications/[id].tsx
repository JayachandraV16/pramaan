import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { getApplicationById } from '../../../services/applicationService';

type Application = {
  id: string;
  application_number: string;
  application_type: string;
  status: string;
  purpose?: string | null;
  remarks?: string | null;
  applicant_name?: string;
  applicant_id?: string;
  instrument_id?: string;
  instrument_name?: string;
  serial_number?: string;
  location_address?: string | null;
};

export default function AdminApplicationDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [application, setApplication] = useState<Application | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    getApplicationById(id)
      .then(setApplication)
      .catch((err: any) => setError(err.message || 'Failed to load application'));
  }, [id]);

  if (!application && !error) return <View style={styles.center}><ActivityIndicator size="large" /><Text>Loading application...</Text></View>;
  if (error || !application) return <View style={styles.center}><Text style={styles.error}>{error || 'Application not found'}</Text></View>;

  return <ScrollView contentContainerStyle={styles.container}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>Back</Text></Pressable>
    <Text style={styles.title}>{application.application_number}</Text>
    <View style={styles.card}>
      <Detail label="Status" value={application.status} />
      <Detail label="Type" value={application.application_type} />
      <Detail label="Applicant" value={application.applicant_name || application.applicant_id} />
      <Detail label="Instrument" value={application.instrument_name || application.instrument_id} />
      <Detail label="Serial Number" value={application.serial_number} />
      <Detail label="Location" value={application.location_address} />
      <Detail label="Purpose" value={application.purpose} />
      <Detail label="Remarks" value={application.remarks} />
    </View>
    <Pressable style={styles.button} onPress={() => router.push('/admin/assignments')}><Text style={styles.buttonText}>Open Assignment Management</Text></Pressable>
  </ScrollView>;
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return <View style={styles.row}><Text style={styles.label}>{label}</Text><Text>{value || 'Not provided'}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#F8FAFC', gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  back: { color: '#1D4ED8', fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '700' },
  card: { padding: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, gap: 14 },
  row: { gap: 4 },
  label: { color: '#64748B', fontSize: 12 },
  button: { padding: 14, alignItems: 'center', backgroundColor: '#1D4ED8', borderRadius: 8 },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  error: { color: '#B91C1C' },
});