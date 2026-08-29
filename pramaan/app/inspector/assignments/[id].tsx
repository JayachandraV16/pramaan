import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';

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
};

export default function AssignmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [assignment, setAssignment] =
    useState<Assignment | null>(null);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

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
    if (!assignment) return;

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

      {assignment.status === 'ACCEPTED' && (
        <Pressable
          style={styles.startButton}
          onPress={handleStartVerification}
        >
          <Text style={styles.startButtonText}>
            Start Verification
          </Text>
        </Pressable>
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
});