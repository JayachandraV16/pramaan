import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { trackApplicationPublic } from '../services/applicationService';

type PublicTrackResult = {
  applicationNumber: string;
  applicationType: string;
  status: string;
  purpose?: string | null;
  submittedAt?: string | null;
  createdAt: string;
  instrumentName: string;
  serialNumber?: string | null;
  verificationDecision?: string | null;
  resultDate?: string | null;
  certificateNumber?: string | null;
  certificateStatus?: string | null;
};

export default function PublicTrackScreen() {
  const [appNumber, setAppNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PublicTrackResult | null>(null);
  const [error, setError] = useState('');

  const handleTrack = async () => {
    if (!appNumber.trim()) {
      setError('Please enter a valid Application Number.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setResult(null);

      const data = await trackApplicationPublic(appNumber.trim());
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Application not found. Please verify the application number.');
    } finally {
      setLoading(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    let color = '#3B82F6';
    let bg = '#DBEAFE';

    if (status === 'COMPLETED') { color = '#166534'; bg = '#DCFCE7'; }
    else if (status === 'REJECTED') { color = '#991B1B'; bg = '#FEE2E2'; }
    else if (status === 'SCHEDULED') { color = '#854D0E'; bg = '#FEF08A'; }

    return (
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={[styles.badgeText, { color }]}>{status}</Text>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Public Application Tracking</Text>
      <Text style={styles.subtitle}>
        Check official Legal Metrology verification status in real time using your Application Number
      </Text>

      <View style={styles.searchBox}>
        <Text style={styles.label}>Application Number *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. APP-1740000000000-1234"
          value={appNumber}
          onChangeText={setAppNumber}
          autoCapitalize="characters"
        />

        <Pressable
          style={[styles.button, loading && styles.disabledButton]}
          disabled={loading}
          onPress={handleTrack}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Track Application Status</Text>
          )}
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {result && (
        <View style={styles.resultCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{result.applicationNumber}</Text>
            {renderStatusBadge(result.status)}
          </View>

          <View style={styles.divider} />

          <Text style={styles.detailRow}>
            Instrument Name: <Text style={styles.bold}>{result.instrumentName}</Text>
          </Text>
          {result.serialNumber && (
            <Text style={styles.detailRow}>
              Serial Number: {result.serialNumber}
            </Text>
          )}
          <Text style={styles.detailRow}>
            Type: {result.applicationType}
          </Text>
          {result.submittedAt && (
            <Text style={styles.detailRow}>
              Submitted Date: {new Date(result.submittedAt).toLocaleDateString()}
            </Text>
          )}

          {result.verificationDecision && (
            <View style={styles.decisionBox}>
              <Text style={styles.decisionTitle}>
                Verification Outcome: <Text style={result.verificationDecision === 'PASS' ? styles.passText : styles.failText}>{result.verificationDecision}</Text>
              </Text>
              {result.resultDate && (
                <Text style={styles.detailRow}>
                  Decision Date: {new Date(result.resultDate).toLocaleDateString()}
                </Text>
              )}
            </View>
          )}

          {result.certificateNumber && (
            <View style={styles.certBox}>
              <Text style={styles.certTitle}>Official Certificate Issued</Text>
              <Text style={styles.detailRow}>Certificate No: {result.certificateNumber}</Text>
              <Text style={styles.detailRow}>Status: {result.certificateStatus || 'ACTIVE'}</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#F8FAFC' },
  backButton: { marginBottom: 12 },
  backText: { color: '#2563EB', fontWeight: '600', fontSize: 15 },
  title: { fontSize: 26, fontWeight: '700', color: '#0F172A' },
  subtitle: { marginTop: 4, color: '#64748B', fontSize: 14, marginBottom: 20 },
  searchBox: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 10, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569' },
  input: { padding: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, fontSize: 14 },
  button: { backgroundColor: '#1D4ED8', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  disabledButton: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  errorBox: { padding: 12, borderRadius: 8, backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5', marginBottom: 16 },
  errorText: { color: '#991B1B', fontWeight: '600' },
  resultCard: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontWeight: '700', fontSize: 12 },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 6 },
  detailRow: { fontSize: 14, color: '#334155' },
  bold: { fontWeight: '700' },
  decisionBox: { marginTop: 8, padding: 10, backgroundColor: '#F1F5F9', borderRadius: 8 },
  decisionTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  passText: { color: '#166534', fontWeight: '700' },
  failText: { color: '#991B1B', fontWeight: '700' },
  certBox: { marginTop: 8, padding: 10, backgroundColor: '#EFF6FF', borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE' },
  certTitle: { fontSize: 14, fontWeight: '700', color: '#1E40AF' },
});
