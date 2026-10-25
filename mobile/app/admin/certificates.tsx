import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  AdminCertificate,
  AdminVerification,
  getAdminCertificates,
  getAdminVerifications,
  issueAdminCertificate,
} from '../../services/adminService';

import { API_ORIGIN } from '../../services/api';

export default function AdminCertificatesScreen() {
  const [certificates, setCertificates] = useState<AdminCertificate[]>([]);
  const [verifications, setVerifications] = useState<AdminVerification[]>([]);
  const [activeTab, setActiveTab] = useState<'eligible' | 'issued'>('eligible');

  const [selectedVerification, setSelectedVerification] =
    useState<AdminVerification | null>(null);

  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setMessage('');
      const [certs, verifs] = await Promise.all([
        getAdminCertificates(),
        getAdminVerifications(),
      ]);
      setCertificates(certs);
      setVerifications(verifs);
    } catch (err: any) {
      setMessage(err.message || 'Failed to load certificate data');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [])
  );

  const eligibleItems = verifications.filter(
    (v) => v.decision === 'PASS' && !v.certificate_id
  );

  const handleSelectForIssuance = (item: AdminVerification) => {
    setSelectedVerification(item);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const nextYear = new Date(Date.now() + 365 * 86400000);
    const nextYearStr = nextYear.toISOString().split('T')[0];

    setValidFrom(todayStr);
    setValidUntil(nextYearStr);
    setMessage('');
  };

  const handleIssue = async () => {
    if (!selectedVerification) return;

    if (!validFrom.trim() || !validUntil.trim()) {
      setMessage('Please specify Valid From and Valid Until dates.');
      return;
    }

    try {
      setSubmitting(true);
      setMessage('');

      await issueAdminCertificate({
        verificationId: selectedVerification.id,
        instrumentId: selectedVerification.instrument_id,
        validFrom: validFrom.trim(),
        validUntil: validUntil.trim(),
      });

      Alert.alert('Success', 'Certificate issued successfully.');
      setMessage('Certificate issued successfully.');
      setSelectedVerification(null);
      await loadData();
      setActiveTab('issued');
    } catch (err: any) {
      setMessage(err.message || 'Failed to issue certificate');
    } finally {
      setSubmitting(false);
    }
  };

  const openPdf = async (path?: string | null) => {
    if (!path) return;
    const url = path.startsWith('http') ? path : `${API_ORIGIN}${path}`;
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Error', 'Unable to open PDF certificate URL.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading certificates...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Certificates Management</Text>
      <Text style={styles.subtitle}>
        Issue & manage digital certificates for PASS verifications
      </Text>

      {message ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      ) : null}

      {/* ISSUANCE FORM (When an item is selected) */}
      {selectedVerification && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Issue New Certificate</Text>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>
              Application: <Text style={styles.bold}>{selectedVerification.application_number}</Text>
            </Text>
            <Text style={styles.summaryText}>
              Instrument: <Text style={styles.bold}>{selectedVerification.instrument_name || 'N/A'}</Text> (Serial: {selectedVerification.serial_number || 'N/A'})
            </Text>
            <Text style={styles.summaryText}>
              Officer: <Text style={styles.bold}>{selectedVerification.assigned_to_name || selectedVerification.performed_by_name || 'N/A'}</Text>
            </Text>
            <Text style={styles.summaryText}>
              Result: <Text style={styles.passBadge}>PASS</Text>
            </Text>
          </View>

          <Text style={styles.label}>Valid From (YYYY-MM-DD) *</Text>
          <TextInput
            style={styles.input}
            value={validFrom}
            onChangeText={setValidFrom}
            placeholder="YYYY-MM-DD"
          />

          <Text style={styles.label}>Valid Until (YYYY-MM-DD) *</Text>
          <TextInput
            style={styles.input}
            value={validUntil}
            onChangeText={setValidUntil}
            placeholder="YYYY-MM-DD"
          />

          <View style={styles.formActions}>
            <Pressable
              style={styles.cancelButton}
              onPress={() => setSelectedVerification(null)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>

            <Pressable
              style={[styles.submitButton, submitting && styles.disabledButton]}
              disabled={submitting}
              onPress={handleIssue}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitText}>Confirm & Issue Certificate</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* TABS */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'eligible' && styles.activeTab]}
          onPress={() => setActiveTab('eligible')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'eligible' && styles.activeTabText,
            ]}
          >
            Eligible PASS ({eligibleItems.length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'issued' && styles.activeTab]}
          onPress={() => setActiveTab('issued')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'issued' && styles.activeTabText,
            ]}
          >
            Issued Certificates ({certificates.length})
          </Text>
        </Pressable>
      </View>

      {/* TAB CONTENT: ELIGIBLE PASS VERIFICATIONS */}
      {activeTab === 'eligible' && (
        <View style={styles.section}>
          {eligibleItems.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                No pending PASS verifications awaiting certificate issuance.
              </Text>
            </View>
          ) : (
            eligibleItems.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.application_number}</Text>
                  <View style={styles.badgePass}>
                    <Text style={styles.badgePassText}>PASS</Text>
                  </View>
                </View>

                <Text style={styles.cardDetail}>
                  Instrument: <Text style={styles.bold}>{item.instrument_name || 'N/A'}</Text>
                </Text>
                {item.serial_number && (
                  <Text style={styles.cardDetail}>
                    Serial No: {item.serial_number}
                  </Text>
                )}
                <Text style={styles.cardDetail}>
                  Officer: {item.assigned_to_name || item.performed_by_name || 'N/A'}
                </Text>

                <Pressable
                  style={styles.issueButton}
                  onPress={() => handleSelectForIssuance(item)}
                >
                  <Text style={styles.issueButtonText}>Issue Certificate</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      )}

      {/* TAB CONTENT: ISSUED CERTIFICATES */}
      {activeTab === 'issued' && (
        <View style={styles.section}>
          {certificates.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No certificates issued yet.</Text>
            </View>
          ) : (
            certificates.map((cert) => (
              <View key={cert.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{cert.certificate_number}</Text>
                  <View style={styles.badgeActive}>
                    <Text style={styles.badgeActiveText}>{cert.status}</Text>
                  </View>
                </View>

                <Text style={styles.cardDetail}>
                  Application: {cert.application_number || 'N/A'}
                </Text>
                <Text style={styles.cardDetail}>
                  Instrument: {cert.instrument_name || 'N/A'}
                </Text>
                <Text style={styles.cardDetail}>
                  Validity: {cert.valid_from} to {cert.valid_until}
                </Text>

                {cert.certificate_file_url ? (
                  <Pressable
                    style={styles.pdfButton}
                    onPress={() => openPdf(cert.certificate_file_url)}
                  >
                    <Text style={styles.pdfButtonText}>Open PDF Certificate</Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#64748B', fontSize: 14 },
  title: { fontSize: 26, fontWeight: '700', color: '#0F172A' },
  subtitle: { marginTop: 4, color: '#64748B', fontSize: 14, marginBottom: 16 },
  messageBox: { padding: 12, borderRadius: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 16 },
  messageText: { color: '#1D4ED8', fontSize: 14, fontWeight: '600' },
  formCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#2563EB', marginBottom: 20, gap: 12 },
  formTitle: { fontSize: 18, fontWeight: '700', color: '#1E40AF' },
  summaryBox: { padding: 12, backgroundColor: '#F1F5F9', borderRadius: 8, gap: 4 },
  summaryText: { fontSize: 14, color: '#334155' },
  bold: { fontWeight: '700' },
  passBadge: { color: '#166534', fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: '#475569' },
  input: { padding: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, fontSize: 14 },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' },
  cancelText: { color: '#475569', fontWeight: '600' },
  submitButton: { flex: 2, padding: 14, alignItems: 'center', backgroundColor: '#1D4ED8', borderRadius: 8 },
  disabledButton: { opacity: 0.6 },
  submitText: { color: '#FFFFFF', fontWeight: '700' },
  tabContainer: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8, backgroundColor: '#E2E8F0' },
  activeTab: { backgroundColor: '#1E293B' },
  tabText: { fontWeight: '600', color: '#475569', fontSize: 14 },
  activeTabText: { color: '#FFFFFF' },
  section: { gap: 12 },
  emptyCard: { padding: 24, backgroundColor: '#FFFFFF', borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  emptyText: { color: '#64748B', fontSize: 14 },
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  badgePass: { backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgePassText: { color: '#166534', fontWeight: '700', fontSize: 12 },
  badgeActive: { backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeActiveText: { color: '#1E40AF', fontWeight: '700', fontSize: 12 },
  cardDetail: { fontSize: 14, color: '#334155' },
  issueButton: { marginTop: 8, backgroundColor: '#2563EB', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  issueButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  pdfButton: { marginTop: 8, backgroundColor: '#0F172A', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  pdfButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
});
