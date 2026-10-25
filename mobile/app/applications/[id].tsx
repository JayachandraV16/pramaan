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

import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { getFileUrl } from '../../services/api';

import {
  getApplicationById,
  respondApplicationInfo,
  resubmitApplication,
  uploadAttachment,
} from '../../services/applicationService';

type ApplicationDetails = {
  id: string;
  application_number: string;
  application_type: string;
  status: string;
  purpose?: string | null;
  remarks?: string | null;
  submitted_at?: string | null;
  instrument_name?: string;
  serial_number?: string;
  assignment_status?: string | null;
  assignment_remarks?: string | null;
  verification_id?: string | null;
  verification_status?: string | null;
  verification_decision?: 'PASS' | 'FAIL' | null;
  verification_remarks?: string | null;
  result_date?: string | null;
  certificate_id?: string | null;
  certificate_number?: string | null;
  certificate_file_url?: string | null;
  certificate_status?: string | null;
  schedule_id?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  verification_location?: string | null;
  schedule_status?: string | null;
  schedule_remarks?: string | null;
  attachments?: any[];
  created_at?: string | null;
};

const STATUS_STEPS = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'SCHEDULED',
  'COMPLETED',
];

const STATUS_INFO: Record<
  string,
  { title: string; description: string }
> = {
  DRAFT: {
    title: 'Draft',
    description:
      'Your application has not been submitted yet.',
  },

  SUBMITTED: {
    title: 'Application Submitted',
    description:
      'Your verification application has been submitted and is waiting for review.',
  },

  UNDER_REVIEW: {
    title: 'Under Review',
    description:
      'Your application is currently being reviewed.',
  },

  SCHEDULED: {
    title: 'Verification Scheduled',
    description:
      'A verification schedule has been created for your instrument.',
  },

  COMPLETED: {
    title: 'Verification Completed',
    description:
      'The verification process for your instrument has been completed.',
  },

  REJECTED: {
    title: 'Application Rejected',
    description:
      'Your verification application was rejected.',
  },

  CANCELLED: {
    title: 'Application Cancelled',
    description:
      'This verification application has been cancelled.',
  },

  DECLINED: {
    title: 'Assignment Declined',
    description:
      'The assigned verification officer declined this assignment. The application can be reassigned by the administrator.',
  },
};

export default function ApplicationDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [application, setApplication] = useState<ApplicationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [responseText, setResponseText] = useState('');
  const [resubmitPurpose, setResubmitPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    uri: string;
    size?: number;
    mimeType?: string;
    file?: any;
  } | null>(null);

  useEffect(() => {
    loadApplication();
  }, [id]);

  const loadApplication = async () => {
    try {
      setError('');
      setLoading(true);

      const data = await getApplicationById(id);
      setApplication(data);
      if (data && data.purpose) setResubmitPurpose(data.purpose);
    } catch (err: any) {
      setError(err.message || 'Failed to load application');
    } finally {
      setLoading(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedFile({
          name: asset.name,
          uri: asset.uri,
          size: asset.size || 1024,
          mimeType: asset.mimeType || 'application/pdf',
          file: (asset as any).file,
        });
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to select document');
    }
  };

  const handleUploadAndSubmitDocument = async () => {
    if (!selectedFile) {
      Alert.alert('File Required', 'Please select a document file to upload.');
      return;
    }
    try {
      setSubmitting(true);
      const attachment = await uploadAttachment({
        applicationId: application!.id,
        category: 'DOCUMENT',
        fileAsset: {
          uri: selectedFile.uri,
          name: selectedFile.name,
          mimeType: selectedFile.mimeType,
          file: selectedFile.file,
        },
        description: 'Submitted in response to Inspector document request',
      });

      await respondApplicationInfo(application!.id, {
        responseText: `Submitted requested document: ${selectedFile.name}`,
        attachmentId: attachment.id,
      });

      Alert.alert('✓ Success', 'Document uploaded and submitted to officer successfully!');
      setSelectedFile(null);
      await loadApplication();
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Failed to upload document');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDocument = async (fileUrl: string) => {
    if (!fileUrl) {
      Alert.alert('Error', 'Document file URL is missing');
      return;
    }
    try {
      const fullUrl = getFileUrl(fileUrl);
      if (Platform.OS === 'web') {
        window.open(fullUrl, '_blank');
      } else {
        await WebBrowser.openBrowserAsync(fullUrl);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Unable to open document');
    }
  };

  const handleRespond = async () => {
    if (!responseText.trim()) {
      Alert.alert('Error', 'Please enter your response before submitting.');
      return;
    }
    try {
      setSubmitting(true);
      await respondApplicationInfo(application!.id, { responseText: responseText.trim() });
      Alert.alert('Success', 'Response submitted successfully to officer.');
      setResponseText('');
      await loadApplication();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResubmit = async () => {
    try {
      setSubmitting(true);
      await resubmitApplication(application!.id, { purpose: resubmitPurpose.trim() });
      Alert.alert('Success', 'Application resubmitted successfully for review.');
      await loadApplication();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to resubmit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />

        <Text style={styles.message}>
          Loading application...
        </Text>
      </View>
    );
  }

  if (error || !application) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          {error || 'Application not found'}
        </Text>
      </View>
    );
  }

  const formattedType =
    application.application_type === 'RE_VERIFICATION'
      ? 'Re-Verification'
      : 'Verification';

  const displayStatus =
    application.verification_decision === 'PASS'
      ? 'CERTIFIED'
      : application.verification_decision === 'FAIL'
        ? 'REJECTED'
        : application.status;

  const statusInfo =
    application.verification_decision === 'PASS'
      ? {
          title: 'Verification Passed',
          description:
            'Your instrument passed verification and is eligible for certificate issuance.',
        }
      : application.verification_decision === 'FAIL'
        ? {
            title: 'Verification Failed',
            description:
              application.verification_remarks ||
              'Your instrument did not meet the verification requirements.',
          }
        : STATUS_INFO[application.status] || {
            title: application.status,
            description: 'Application status updated.',
          };

  const currentStepIndex =
    STATUS_STEPS.indexOf(application.status);

  const isRejected =
    application.status === 'REJECTED' ||
    application.verification_decision === 'FAIL';

  const isDeclined =
    application.status === 'DECLINED';

  const isCancelled =
    application.status === 'CANCELLED';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* APPLICATION NUMBER */}

      <Text style={styles.applicationNumber}>
        {application.application_number}
      </Text>

      {/* CURRENT STATUS */}

      <View style={styles.statusCard}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>
            {displayStatus.replace(/_/g, ' ')}
          </Text>
        </View>

        <Text style={styles.statusTitle}>
          {statusInfo.title}
        </Text>

        <Text style={styles.statusDescription}>
          {statusInfo.description}
        </Text>
      </View>

      {/* ACTION REQUIRED: DOCUMENT REQUEST */}
      {application.remarks && application.remarks.includes('[REQUESTED_DOCUMENT]') && (
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>⚡ ACTION REQUIRED: Document Requested</Text>
          <Text style={styles.actionText}>
            <Text style={{ fontWeight: '700' }}>Officer Message: </Text>
            {application.remarks.replace(/\[REQUESTED_[^\]]+\]:\s*/, '')}
          </Text>

          <View style={styles.uploadBox}>
            {selectedFile ? (
              <View style={styles.selectedFileRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedFileName}>📄 {selectedFile.name}</Text>
                  <Text style={styles.selectedFileSize}>
                    Size: {Math.round((selectedFile.size || 1024) / 1024)} KB
                  </Text>
                </View>
                <Pressable style={styles.removeFileBtn} onPress={() => setSelectedFile(null)}>
                  <Text style={styles.removeFileBtnText}>Remove</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.pickFileBtn} onPress={handlePickDocument}>
                <Text style={styles.pickFileBtnText}>📁 UPLOAD DOCUMENT (PDF / JPG / PNG)</Text>
              </Pressable>
            )}
          </View>

          <Pressable
            style={[
              styles.actionSubmitBtn,
              (!selectedFile || submitting) && styles.disabledButton,
            ]}
            disabled={!selectedFile || submitting}
            onPress={handleUploadAndSubmitDocument}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.actionSubmitBtnText}>Submit Document to Officer</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* ACTION REQUIRED: CLARIFICATION REQUEST */}
      {application.remarks && application.remarks.includes('[REQUESTED_CLARIFICATION]') && (
        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>⚡ ACTION REQUIRED: Clarification Requested</Text>
          <Text style={styles.actionText}>
            <Text style={{ fontWeight: '700' }}>Inspector Question: </Text>
            {application.remarks.replace(/\[REQUESTED_[^\]]+\]:\s*/, '')}
          </Text>

          <TextInput
            style={styles.actionInput}
            placeholder="Type your response / answer here..."
            value={responseText}
            onChangeText={setResponseText}
            multiline
          />

          <Pressable
            style={[styles.actionSubmitBtn, submitting && styles.disabledButton]}
            disabled={submitting}
            onPress={handleRespond}
          >
            {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.actionSubmitBtnText}>Submit Response to Officer</Text>}
          </Pressable>
        </View>
      )}

      {/* ACTION REQUIRED: GENERAL REQUEST FALLBACK */}
      {application.remarks &&
        application.remarks.includes('[REQUESTED_') &&
        !application.remarks.includes('[REQUESTED_DOCUMENT]') &&
        !application.remarks.includes('[REQUESTED_CLARIFICATION]') && (
          <View style={styles.actionCard}>
            <Text style={styles.actionTitle}>⚡ ACTION REQUIRED: Officer Requested Information</Text>
            <Text style={styles.actionText}>{application.remarks.replace(/\[REQUESTED_[^\]]+\]:\s*/, '')}</Text>

            <TextInput
              style={styles.actionInput}
              placeholder="Type your response or document details here..."
              value={responseText}
              onChangeText={setResponseText}
              multiline
            />

            <Pressable
              style={[styles.actionSubmitBtn, submitting && styles.disabledButton]}
              disabled={submitting}
              onPress={handleRespond}
            >
              {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.actionSubmitBtnText}>Submit Response to Officer</Text>}
            </Pressable>
          </View>
        )}

      {/* CORRECTION REQUIRED */}
      {application.remarks && application.remarks.includes('[RETURNED_FOR_CORRECTION]') && (
        <View style={styles.actionCardWarning}>
          <Text style={styles.actionTitleWarning}>⚡ CORRECTION REQUIRED: Application Returned</Text>
          <Text style={styles.actionTextWarning}>{application.remarks.replace('[RETURNED_FOR_CORRECTION]: ', '')}</Text>

          <Text style={styles.labelSmall}>Update Application Purpose *</Text>
          <TextInput
            style={styles.actionInput}
            placeholder="Update purpose or notes for resubmission..."
            value={resubmitPurpose}
            onChangeText={setResubmitPurpose}
            multiline
          />

          <Pressable
            style={[styles.actionSubmitBtnWarning, submitting && styles.disabledButton]}
            disabled={submitting}
            onPress={handleResubmit}
          >
            {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.actionSubmitBtnText}>Resubmit Application</Text>}
          </Pressable>
        </View>
      )}

      {/* PROGRESS TRACKER */}

      {!isRejected && !isCancelled && !isDeclined && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Application Progress
          </Text>

          <View style={styles.tracker}>
            {STATUS_STEPS.map((step, index) => {
              const isCompleted =
                currentStepIndex >= index;

              const isCurrent =
                currentStepIndex === index;

              return (
                <View
                  key={step}
                  style={styles.stepContainer}
                >
                  <View style={styles.stepRow}>
                    <View
                      style={[
                        styles.stepCircle,
                        isCompleted &&
                          styles.stepCircleCompleted,
                        isCurrent &&
                          styles.stepCircleCurrent,
                      ]}
                    >
                      {isCompleted && (
                        <Text style={styles.stepCheck}>
                          ✓
                        </Text>
                      )}
                    </View>

                    <View style={styles.stepContent}>
                      <Text
                        style={[
                          styles.stepTitle,
                          isCompleted &&
                            styles.stepTitleCompleted,
                        ]}
                      >
                        {step.replace(/_/g, ' ')}
                      </Text>

                      <Text
                        style={
                          styles.stepDescription
                        }
                      >
                        {
                          STATUS_INFO[step]
                            ?.description
                        }
                      </Text>
                    </View>
                  </View>

                  {index <
                    STATUS_STEPS.length - 1 && (
                    <View
                      style={[
                        styles.connector,
                        currentStepIndex > index &&
                          styles.connectorCompleted,
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* VERIFICATION SCHEDULE */}
      {application.scheduled_date && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verification Schedule</Text>
          <View style={styles.card}>
            <DetailRow
              label="Scheduled Date"
              value={
                typeof application.scheduled_date === 'string'
                  ? application.scheduled_date.split('T')[0]
                  : new Date(application.scheduled_date).toISOString().split('T')[0]
              }
            />
            {application.scheduled_time && (
              <DetailRow
                label="Scheduled Time"
                value={application.scheduled_time}
              />
            )}
            {application.verification_location && (
              <DetailRow
                label="Location"
                value={application.verification_location}
              />
            )}
            {application.schedule_status && (
              <DetailRow
                label="Schedule Status"
                value={application.schedule_status}
              />
            )}
            {application.schedule_remarks && (
              <DetailRow
                label="Remarks"
                value={application.schedule_remarks}
              />
            )}
          </View>
        </View>
      )}

      {/* VERIFICATION RESULT */}

      {application.verification_decision && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Verification Result
          </Text>

          <View style={[
            styles.resultCard,
            application.verification_decision === 'PASS'
              ? styles.passResultCard
              : styles.failResultCard,
          ]}>
            <Text style={styles.resultTitle}>
              {application.verification_decision === 'PASS'
                ? 'PASS — Verification Successful'
                : 'FAIL — Verification Unsuccessful'}
            </Text>

            {application.result_date && (
              <Text style={styles.resultDate}>
                Decided on {new Date(application.result_date).toLocaleDateString()}
              </Text>
            )}

            {application.verification_remarks && (
              <Text style={styles.resultRemarks}>
                {application.verification_remarks}
              </Text>
            )}

            {application.verification_decision === 'PASS' && (
              application.certificate_id ? (
                <View style={styles.certificateBox}>
                  <Text style={styles.certificateTitle}>
                    Certificate Issued: {application.certificate_number}
                  </Text>
                  <Pressable
                    style={styles.viewCertificateButton}
                    onPress={() =>
                      router.push({
                        pathname: '/certificates/[id]',
                        params: { id: application.certificate_id! },
                      } as any)
                    }
                  >
                    <Text style={styles.viewCertificateText}>
                      View Certificate
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.resultHint}>
                  Certificate Eligibility Confirmed (PASS). Awaiting Admin certificate issuance.
                </Text>
              )
            )}

            {application.verification_decision === 'FAIL' && (
              <Text style={styles.resultHint}>
                Correct the reported issue and submit a new verification application.
              </Text>
            )}
          </View>
        </View>
      )}

      {/* APPLICATION DETAILS */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Application Details
        </Text>

        <View style={styles.card}>
          <DetailRow
            label="Application Type"
            value={formattedType}
          />

          <DetailRow
            label="Submitted On"
            value={
              application.submitted_at
                ? new Date(
                    application.submitted_at
                  ).toLocaleDateString()
                : undefined
            }
          />

          {application.purpose && (
            <DetailRow
              label="Purpose"
              value={application.purpose}
            />
          )}

          {application.remarks && (
            <DetailRow
              label="Remarks"
              value={application.remarks}
            />
          )}
        </View>
      </View>

      {/* INSTRUMENT DETAILS */}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Instrument Details
        </Text>

        <View style={styles.card}>
          <DetailRow
            label="Instrument"
            value={application.instrument_name}
          />

          <DetailRow
            label="Serial Number"
            value={application.serial_number}
          />
        </View>
      </View>

      {/* ATTACHMENTS / UPLOADED DOCUMENTS */}
      {application.attachments && application.attachments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Uploaded Documents</Text>
          <View style={styles.card}>
            {application.attachments.map((att: any) => {
              const uploadDate = att.created_at || att.uploaded_at;
              return (
                <View key={att.id} style={styles.detailRow}>
                  <Text style={styles.label}>📄 {att.file_name} ({att.category || 'DOCUMENT'})</Text>
                  {att.description && <Text style={styles.value}>{att.description}</Text>}
                  {uploadDate && (
                    <Text style={styles.resultDate}>
                      Uploaded on {new Date(uploadDate).toLocaleString()}
                    </Text>
                  )}
                  <Pressable
                    style={[styles.viewDocBtn, { marginTop: 8 }]}
                    onPress={() => handleViewDocument(att.file_url)}
                  >
                    <Text style={styles.viewDocBtnText}>VIEW DOCUMENT</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.label}>
        {label}
      </Text>

      <Text style={styles.value}>
        {value || 'Not provided'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    color: 'red',
    textAlign: 'center',
  },

  applicationNumber: {
    fontSize: 22,
    fontWeight: 'bold',
  },

  statusCard: {
    marginTop: 20,
    padding: 18,
    borderRadius: 14,
    backgroundColor: '#F5F8FF',
    borderWidth: 1,
    borderColor: '#E3EBFF',
  },

  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },

  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },

  statusTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: 'bold',
  },

  statusDescription: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    opacity: 0.7,
  },

  section: {
    marginTop: 28,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    marginBottom: 14,
  },

  tracker: {
    paddingVertical: 5,
  },

  stepContainer: {
    minHeight: 72,
  },

  stepRow: {
    flexDirection: 'row',
  },

  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },

  stepCircleCompleted: {
    borderColor: '#000',
    backgroundColor: '#000',
  },

  stepCircleCurrent: {
    borderWidth: 3,
  },

  stepCheck: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },

  stepContent: {
    flex: 1,
    marginLeft: 14,
    paddingBottom: 10,
  },

  stepTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
  },

  stepTitleCompleted: {
    color: '#000',
    fontWeight: 'bold',
  },

  stepDescription: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    opacity: 0.55,
  },

  connector: {
    width: 2,
    height: 34,
    backgroundColor: '#ddd',
    marginLeft: 13,
    marginTop: -4,
    marginBottom: -4,
  },

  connectorCompleted: {
    backgroundColor: '#000',
  },

  resultCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },

  passResultCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },

  failResultCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },

  resultTitle: {
    fontSize: 17,
    fontWeight: '700',
  },

  resultDate: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.6,
  },

  resultRemarks: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
  },

  resultHint: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.75,
  },

  certificateBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 8,
  },

  certificateTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },

  viewCertificateButton: {
    backgroundColor: '#166534',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },

  viewCertificateText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },

  detailRow: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  label: {
    fontSize: 13,
    opacity: 0.55,
    marginBottom: 5,
  },

  value: {
    fontSize: 16,
    fontWeight: '500',
  },
  actionCard: { marginTop: 16, padding: 16, backgroundColor: '#EFF6FF', borderRadius: 12, borderWidth: 1, borderColor: '#3B82F6', gap: 8 },
  actionTitle: { fontSize: 16, fontWeight: '700', color: '#1E40AF' },
  actionText: { fontSize: 14, color: '#1E3A8A', lineHeight: 20 },
  actionInput: { marginTop: 4, padding: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, fontSize: 14, minHeight: 60 },
  actionSubmitBtn: { backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  actionSubmitBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  actionCardWarning: { marginTop: 16, padding: 16, backgroundColor: '#FFFBEB', borderRadius: 12, borderWidth: 1, borderColor: '#D97706', gap: 8 },
  actionTitleWarning: { fontSize: 16, fontWeight: '700', color: '#B45309' },
  actionTextWarning: { fontSize: 14, color: '#78350F', lineHeight: 20 },
  labelSmall: { fontSize: 12, fontWeight: '600', color: '#475569', marginTop: 4 },
  actionSubmitBtnWarning: { backgroundColor: '#D97706', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  disabledButton: { opacity: 0.6 },
  uploadBox: { marginTop: 8, marginBottom: 8 },
  pickFileBtn: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#2563EB', borderStyle: 'dashed', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center' },
  pickFileBtnText: { color: '#2563EB', fontWeight: '700', fontSize: 13 },
  selectedFileRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#93C5FD' },
  selectedFileName: { fontSize: 14, fontWeight: '700', color: '#1E3A8A' },
  selectedFileSize: { fontSize: 12, color: '#64748B', marginTop: 2 },
  removeFileBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  removeFileBtnText: { color: '#991B1B', fontWeight: '700', fontSize: 12 },
  viewDocBtn: { backgroundColor: '#2563EB', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 6, alignItems: 'center', alignSelf: 'flex-start' },
  viewDocBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
});