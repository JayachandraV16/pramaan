import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Platform, Linking } from 'react-native';
import { getFileUrl } from '../../../services/api';

import {
  requestApplicationInfo,
  returnApplicationForCorrection,
  rejectApplication,
} from '../../../services/applicationService';
import {
  getAssignmentById,
  updateAssignmentStatus,
} from '../../../services/assignmentService';

type Assignment = {
  id: string;
  application_id: string;
  assigned_to_id: string;
  assigned_by_id: string;
  assignment_date: string;
  status: string;
  remarks?: string;
  application_number?: string;
  application_type?: string;
  application_status?: string;
  application_purpose?: string | null;
  application_remarks?: string | null;
  applicant_name?: string;
  applicant_email?: string | null;
  applicant_phone?: string | null;
  instrument_id?: string;
  instrument_name?: string;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string;
  location_address?: string | null;
  capacity?: string | number | null;
  capacity_unit?: string | null;
  accuracy_class?: string | null;
  schedule_id?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  verification_location?: string | null;
  schedule_status?: string | null;
  verification_id?: string | null;
  verification_status?: string | null;
  verification_decision?: 'PASS' | 'FAIL' | null;
  verification_remarks?: string | null;
  attachments?: any[];
  result_date?: string | null;
};

function getScheduleStatus(scheduledDate?: string | null, scheduledTime?: string | null) {
  if (!scheduledDate) {
    return { isReady: false, message: 'Verification cannot be started because this application has not been scheduled yet by Admin.' };
  }

  const scheduledDateStr =
    typeof scheduledDate === 'string'
      ? scheduledDate.split('T')[0]
      : new Date(scheduledDate).toISOString().split('T')[0];

  const scheduledTimeStr = scheduledTime || '00:00:00';
  const [sYear, sMonth, sDay] = scheduledDateStr.split('-').map(Number);
  const [sHour, sMin, sSec] = scheduledTimeStr.split(':').map(Number);
  const scheduledDateTime = new Date(
    sYear,
    sMonth - 1,
    sDay,
    sHour || 0,
    sMin || 0,
    sSec || 0
  );

  const now = new Date();
  if (now < scheduledDateTime) {
    return {
      isReady: false,
      message: `Scheduled for ${new Date(scheduledDate).toLocaleDateString()} at ${scheduledTimeStr}. Verification cannot start before the scheduled time.`,
    };
  }

  return { isReady: true, message: 'Scheduled time reached. You may start verification.' };
}

export default function AssignmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  const [reviewAction, setReviewAction] = useState<'NONE' | 'REQUEST' | 'RETURN' | 'REJECT'>('NONE');
  const [requestType, setRequestType] = useState<'DOCUMENT' | 'CLARIFICATION'>('DOCUMENT');
  const [requestDetails, setRequestDetails] = useState('');
  const [returnRemarks, setReturnRemarks] = useState('');
  const [rejectionReason, setRejectionReason] = useState('Incomplete Information');
  const [rejectionRemarks, setRejectionRemarks] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const handleExecuteRequestInfo = async () => {
    if (!requestDetails.trim()) {
      Alert.alert('Error', 'Please specify what document/clarification is requested.');
      return;
    }
    try {
      setActionSubmitting(true);
      await requestApplicationInfo(assignment!.application_id, {
        requestType,
        details: requestDetails.trim(),
      });
      Alert.alert('Success', 'Information requested from applicant.');
      setReviewAction('NONE');
      setRequestDetails('');
      await loadAssignment();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to request information');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleExecuteReturn = async () => {
    if (!returnRemarks.trim()) {
      Alert.alert('Error', 'Remarks are required when returning for correction.');
      return;
    }
    try {
      setActionSubmitting(true);
      await returnApplicationForCorrection(assignment!.application_id, {
        remarks: returnRemarks.trim(),
      });
      Alert.alert('Success', 'Application returned for correction.');
      setReviewAction('NONE');
      setReturnRemarks('');
      await loadAssignment();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to return application');
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleExecuteReject = async () => {
    if (!rejectionReason.trim()) {
      Alert.alert('Error', 'Rejection reason is required.');
      return;
    }
    try {
      setActionSubmitting(true);
      await rejectApplication(assignment!.application_id, {
        rejectionReason: rejectionReason.trim(),
        remarks: rejectionRemarks.trim(),
      });
      Alert.alert('Success', 'Application rejected.');
      setReviewAction('NONE');
      setRejectionRemarks('');
      await loadAssignment();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to reject application');
    } finally {
      setActionSubmitting(false);
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

  const loadAssignment = async () => {
    try {
      setError('');

      const response = await getAssignmentById(id);

      console.log('ASSIGNMENT DETAIL:', response);

      setAssignment(response);
    } catch (err: any) {
      console.log('ASSIGNMENT DETAIL ERROR:', err);

      setError(
        err.message || 'Failed to load assignment'
      );
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (id) {
        setLoading(true);
        loadAssignment();
      }
    }, [id])
  );

  const handleStatusUpdate = async (
    status: 'ACCEPTED' | 'DECLINED'
  ) => {
    if (!assignment) return;

    const action =
      status === 'ACCEPTED'
        ? 'accept'
        : 'decline';

    Alert.alert(
      `${status === 'ACCEPTED' ? 'Accept' : 'Decline'} Assignment`,
      `Are you sure you want to ${action} this assignment?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text:
            status === 'ACCEPTED'
              ? 'Accept'
              : 'Decline',
          style:
            status === 'DECLINED'
              ? 'destructive'
              : 'default',
          onPress: async () => {
            try {
              setUpdating(true);

              await updateAssignmentStatus(
                assignment.id,
                status
              );

              Alert.alert(
                'Success',
                `Assignment ${action}ed successfully`
              );

              await loadAssignment();
            } catch (err: any) {
              Alert.alert(
                'Error',
                err.message ||
                  `Failed to ${action} assignment`
              );
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleStartVerification = () => {
    if (!assignment || assignment.verification_id) return;

    router.push({
      pathname: '/inspector/verification/start',
      params: {
        applicationId: assignment.application_id,
        assignmentId: assignment.id,
        ...(assignment.schedule_id
          ? { scheduleId: assignment.schedule_id }
          : {}),
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Loading assignment...
        </Text>
      </View>
    );
  }

  if (error || !assignment) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          {error || 'Assignment not found'}
        </Text>

        <Pressable
          style={styles.retryButton}
          onPress={loadAssignment}
        >
          <Text style={styles.retryText}>
            Retry
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
      <Text style={styles.title}>
        Assignment Details
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>
          Application Number
        </Text>

        <Text style={styles.value}>
          {assignment.application_number ||
            assignment.application_id}
        </Text>

        {assignment.application_type && (
          <>
            <Text style={styles.label}>
              Application Type
            </Text>

            <Text style={styles.value}>
              {assignment.application_type ===
              'RE_VERIFICATION'
                ? 'Re-Verification'
                : 'Verification'}
            </Text>
          </>
        )}

        <Text style={styles.label}>
          Assignment Status
        </Text>

        <View style={styles.status}>
          <Text style={styles.statusText}>
            {assignment.status}
          </Text>
        </View>

        {assignment.application_status && (
          <>
            <Text style={styles.label}>
              Application Status
            </Text>

            <Text style={styles.value}>
              {assignment.application_status}
            </Text>
          </>
        )}

        {assignment.instrument_name && (
          <>
            <Text style={styles.label}>
              Instrument
            </Text>

            <Text style={styles.value}>
              {assignment.instrument_name}
            </Text>
          </>
        )}

        {assignment.serial_number && (
          <>
            <Text style={styles.label}>
              Serial Number
            </Text>

            <Text style={styles.value}>
              {assignment.serial_number}
            </Text>
          </>
        )}

        {assignment.applicant_name && (
          <>
            <Text style={styles.label}>Applicant / Owner</Text>
            <Text style={styles.value}>{assignment.applicant_name}</Text>
          </>
        )}

        {assignment.applicant_email && (
          <>
            <Text style={styles.label}>Owner Email</Text>
            <Text style={styles.value}>{assignment.applicant_email}</Text>
          </>
        )}

        {assignment.location_address && (
          <>
            <Text style={styles.label}>Instrument Location</Text>
            <Text style={styles.value}>{assignment.location_address}</Text>
          </>
        )}

        {assignment.application_purpose && (
          <>
            <Text style={styles.label}>Verification Purpose</Text>
            <Text style={styles.value}>{assignment.application_purpose}</Text>
          </>
        )}

        {assignment.application_remarks && (
          <>
            <Text style={styles.label}>Application Remarks</Text>
            <Text style={styles.value}>{assignment.application_remarks}</Text>
          </>
        )}

        {assignment.schedule_id && (
          <>
            <Text style={styles.label}>Schedule</Text>
            <Text style={styles.value}>
              {assignment.scheduled_date
                ? new Date(assignment.scheduled_date).toLocaleDateString()
                : 'Date not provided'}
              {assignment.scheduled_time ? ` at ${assignment.scheduled_time}` : ''}
            </Text>
            {assignment.verification_location && (
              <Text style={styles.value}>{assignment.verification_location}</Text>
            )}
          </>
        )}

        {assignment.remarks && (
          <>
            <Text style={styles.label}>
              Remarks
            </Text>

            <Text style={styles.value}>
              {assignment.remarks}
            </Text>
          </>
        )}
      </View>

      {assignment.status === 'ASSIGNED' && (
        <View style={styles.actionContainer}>
          <Pressable
            style={[
              styles.actionButton,
              styles.declineButton,
              updating && styles.disabledButton,
            ]}
            disabled={updating}
            onPress={() =>
              handleStatusUpdate('DECLINED')
            }
          >
            {updating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.actionButtonText}>
                Decline
              </Text>
            )}
          </Pressable>

          <Pressable
            style={[
              styles.actionButton,
              styles.acceptButton,
              updating && styles.disabledButton,
            ]}
            disabled={updating}
            onPress={() =>
              handleStatusUpdate('ACCEPTED')
            }
          >
            {updating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.actionButtonText}>
                Accept Assignment
              </Text>
            )}
          </Pressable>
        </View>
      )}

      {assignment.verification_decision && (
        <View style={[
          styles.resultBox,
          assignment.verification_decision === 'PASS'
            ? styles.passResultBox
            : styles.failResultBox,
        ]}>
          <Text style={styles.resultTitle}>
            Verification Result: {assignment.verification_decision}
          </Text>

          {assignment.verification_remarks && (
            <Text style={styles.resultText}>
              {assignment.verification_remarks}
            </Text>
          )}
        </View>
      )}

      {assignment.status === 'ACCEPTED' && !assignment.verification_id && (
        <View style={styles.reviewSection}>
          <Text style={styles.reviewTitle}>Officer Application Review Actions</Text>
          <Text style={styles.reviewSubtitle}>Perform initial review before scheduling/verifying</Text>

          <View style={styles.reviewButtonGroup}>
            <Pressable
              style={[styles.reviewButton, styles.requestBtn]}
              onPress={() => setReviewAction(reviewAction === 'REQUEST' ? 'NONE' : 'REQUEST')}
            >
              <Text style={styles.reviewButtonText}>Request Doc / Clarification</Text>
            </Pressable>

            <Pressable
              style={[styles.reviewButton, styles.returnBtn]}
              onPress={() => setReviewAction(reviewAction === 'RETURN' ? 'NONE' : 'RETURN')}
            >
              <Text style={styles.reviewButtonText}>Return for Correction</Text>
            </Pressable>

            <Pressable
              style={[styles.reviewButton, styles.rejectBtn]}
              onPress={() => setReviewAction(reviewAction === 'REJECT' ? 'NONE' : 'REJECT')}
            >
              <Text style={styles.reviewButtonText}>Reject Application</Text>
            </Pressable>
          </View>

          {/* REQUEST DOC / CLARIFICATION FORM */}
          {reviewAction === 'REQUEST' && (
            <View style={styles.actionFormCard}>
              <Text style={styles.formLabel}>Request Type</Text>
              <View style={styles.rowToggle}>
                <Pressable
                  style={[styles.toggleBtn, requestType === 'DOCUMENT' && styles.activeToggle]}
                  onPress={() => setRequestType('DOCUMENT')}
                >
                  <Text style={[styles.toggleText, requestType === 'DOCUMENT' && styles.activeToggleText]}>Request Document</Text>
                </Pressable>
                <Pressable
                  style={[styles.toggleBtn, requestType === 'CLARIFICATION' && styles.activeToggle]}
                  onPress={() => setRequestType('CLARIFICATION')}
                >
                  <Text style={[styles.toggleText, requestType === 'CLARIFICATION' && styles.activeToggleText]}>Request Clarification</Text>
                </Pressable>
              </View>

              <Text style={styles.formLabel}>Details / Instructions *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Specify what document or clarification is required from applicant..."
                value={requestDetails}
                onChangeText={setRequestDetails}
                multiline
              />

              <Pressable
                style={[styles.submitFormBtn, actionSubmitting && styles.disabledButton]}
                disabled={actionSubmitting}
                onPress={handleExecuteRequestInfo}
              >
                {actionSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitFormBtnText}>Send Request to Applicant</Text>}
              </Pressable>
            </View>
          )}

          {/* RETURN FOR CORRECTION FORM */}
          {reviewAction === 'RETURN' && (
            <View style={styles.actionFormCard}>
              <Text style={styles.formLabel}>Correction Remarks (Required) *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Explain what information needs correction by the applicant..."
                value={returnRemarks}
                onChangeText={setReturnRemarks}
                multiline
              />

              <Pressable
                style={[styles.submitFormBtn, actionSubmitting && styles.disabledButton]}
                disabled={actionSubmitting}
                onPress={handleExecuteReturn}
              >
                {actionSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitFormBtnText}>Submit Return for Correction</Text>}
              </Pressable>
            </View>
          )}

          {/* REJECT APPLICATION FORM */}
          {reviewAction === 'REJECT' && (
            <View style={styles.actionFormCard}>
              <Text style={styles.formLabel}>Rejection Reason (Required) *</Text>
              <View style={styles.reasonOptionGroup}>
                {['Incomplete Information', 'Non-compliant Instrument', 'Incorrect Documentation', 'Other'].map((r) => (
                  <Pressable
                    key={r}
                    style={[styles.reasonChip, rejectionReason === r && styles.activeReasonChip]}
                    onPress={() => setRejectionReason(r)}
                  >
                    <Text style={[styles.reasonChipText, rejectionReason === r && styles.activeReasonChipText]}>{r}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.formLabel}>Additional Remarks (Optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Additional notes for rejection..."
                value={rejectionRemarks}
                onChangeText={setRejectionRemarks}
                multiline
              />

              <Pressable
                style={[styles.submitFormBtn, styles.dangerSubmitBtn, actionSubmitting && styles.disabledButton]}
                disabled={actionSubmitting}
                onPress={handleExecuteReject}
              >
                {actionSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitFormBtnText}>Confirm Rejection</Text>}
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* UPLOADED DOCUMENTS SECTION */}
      <View style={styles.reviewSection}>
        <Text style={styles.reviewTitle}>UPLOADED DOCUMENTS</Text>
        {assignment.attachments && assignment.attachments.length > 0 ? (
          assignment.attachments.map((att: any) => {
            const uploadDate = att.created_at || att.uploaded_at;
            return (
              <View key={att.id} style={styles.docItemCard}>
                <View style={styles.docItemHeader}>
                  <Text style={styles.docItemIcon}>📄</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docItemName}>{att.file_name}</Text>
                    <Text style={styles.docItemSub}>Type: {att.category || 'DOCUMENT'}</Text>
                    <Text style={styles.docItemSub}>Submitted by: {att.uploaded_by_name || 'Applicant'}</Text>
                    {uploadDate && (
                      <Text style={styles.docItemDate}>
                        Submitted: {new Date(uploadDate).toLocaleString()}
                      </Text>
                    )}
                    {att.description && (
                      <Text style={styles.docItemDesc}>Note: {att.description}</Text>
                    )}
                  </View>
                </View>

                <Pressable
                  style={styles.viewDocBtn}
                  onPress={() => handleViewDocument(att.file_url)}
                >
                  <Text style={styles.viewDocBtnText}>VIEW DOCUMENT</Text>
                </Pressable>
              </View>
            );
          })
        ) : (
          <Text style={styles.noDocText}>No documents uploaded by applicant yet.</Text>
        )}
      </View>

      {/* VERIFICATION GATE SECTION */}
      {assignment.status === 'ACCEPTED' &&
        !assignment.verification_id &&
        assignment.application_status !== 'REJECTED' && (() => {
          const scheduleGate = getScheduleStatus(assignment.scheduled_date, assignment.scheduled_time);

          if (!scheduleGate.isReady) {
            return (
              <View style={styles.scheduleNoticeCard}>
                <Text style={styles.scheduleNoticeTitle}>📅 Verification Schedule Gate</Text>
                <Text style={styles.scheduleNoticeText}>{scheduleGate.message}</Text>
                <Pressable style={[styles.startButton, styles.disabledButton]} disabled>
                  <Text style={styles.startButtonText}>Start Verification (Disabled)</Text>
                </Pressable>
              </View>
            );
          }

          return (
            <Pressable
              style={styles.startButton}
              onPress={handleStartVerification}
            >
              <Text style={styles.startButtonText}>
                Start Verification
              </Text>
            </Pressable>
          );
        })()}

      {assignment.verification_id &&
        !assignment.verification_decision && (
          <Pressable
            style={styles.startButton}
            onPress={() =>
              router.push({
                pathname: '/inspector/verification/[id]',
                params: { id: assignment.verification_id! },
              })
            }
          >
            <Text style={styles.startButtonText}>
              Continue Verification
            </Text>
          </Pressable>
        )}

      {assignment.status === 'COMPLETED' && (
        <Text style={styles.completedText}>
          This assignment has been completed. No further verification can be started.
        </Text>
      )}

      {assignment.status === 'DECLINED' && (
        <Text style={styles.declinedText}>
          You declined this assignment. It is no longer available for verification.
        </Text>
      )}
    </ScrollView>
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
    padding: 30,
  },

  loadingText: {
    marginTop: 12,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 20,
  },

  card: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 18,
  },

  label: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.55,
    marginTop: 14,
  },

  value: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 4,
  },

  status: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },

  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },

  actionContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },

  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },

  declineButton: {
    backgroundColor: '#DC2626',
  },

  acceptButton: {
    backgroundColor: '#16A34A',
  },

  disabledButton: {
    opacity: 0.6,
  },

  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  startButton: {
    marginTop: 24,
    backgroundColor: '#2563EB',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },

  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  resultBox: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },

  passResultBox: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },

  failResultBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },

  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
  },

  resultText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },

  completedText: {
    marginTop: 24,
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },

  declinedText: {
    marginTop: 24,
    fontSize: 14,
    lineHeight: 20,
    color: '#B91C1C',
  },

  errorText: {
    color: '#DC2626',
    textAlign: 'center',
  },

  retryButton: {
    marginTop: 16,
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },

  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  reviewSection: { marginTop: 24, padding: 16, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', gap: 10 },
  reviewTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  reviewSubtitle: { fontSize: 13, color: '#64748B' },
  reviewButtonGroup: { gap: 8, marginTop: 4 },
  reviewButton: { paddingVertical: 11, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  requestBtn: { backgroundColor: '#2563EB' },
  returnBtn: { backgroundColor: '#D97706' },
  rejectBtn: { backgroundColor: '#DC2626' },
  reviewButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  actionFormCard: { marginTop: 12, padding: 14, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1', gap: 10 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#334155' },
  rowToggle: { flexDirection: 'row', gap: 8 },
  toggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6, backgroundColor: '#E2E8F0' },
  activeToggle: { backgroundColor: '#1E293B' },
  toggleText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  activeToggleText: { color: '#FFFFFF' },
  formInput: { padding: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, fontSize: 14, minHeight: 70 },
  submitFormBtn: { backgroundColor: '#1D4ED8', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  dangerSubmitBtn: { backgroundColor: '#DC2626' },
  submitFormBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  reasonOptionGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reasonChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#E2E8F0' },
  activeReasonChip: { backgroundColor: '#991B1B' },
  reasonChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  activeReasonChipText: { color: '#FFFFFF' },
  docItemCard: { marginTop: 8, padding: 12, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1', gap: 10 },
  docItemHeader: { flexDirection: 'row', gap: 10 },
  docItemIcon: { fontSize: 24 },
  docItemName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  docItemSub: { fontSize: 12, color: '#475569', marginTop: 2 },
  docItemDate: { fontSize: 11, color: '#64748B', marginTop: 3 },
  docItemDesc: { fontSize: 12, color: '#1E293B', marginTop: 4, fontStyle: 'italic' },
  viewDocBtn: { backgroundColor: '#2563EB', paddingVertical: 9, borderRadius: 6, alignItems: 'center' },
  viewDocBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  noDocText: { fontSize: 13, color: '#64748B', fontStyle: 'italic', marginTop: 4 },
  scheduleNoticeCard: { marginTop: 16, padding: 14, backgroundColor: '#FFFBEB', borderRadius: 10, borderWidth: 1, borderColor: '#FCD34D', gap: 8 },
  scheduleNoticeTitle: { fontSize: 14, fontWeight: '700', color: '#B45309' },
  scheduleNoticeText: { fontSize: 13, color: '#78350F', lineHeight: 18 },
});