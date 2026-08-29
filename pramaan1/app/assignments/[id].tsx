import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useCallback, useState } from 'react';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';

import {
  getAssignmentById,
  updateAssignmentStatus,
} from '../../services/assignmentService';

type AssignmentDetails = {
  id: string;
  application_id: string;
  assigned_to_id: string;
  assigned_by_id: string;
  assignment_date: string;
  status: string;
  remarks?: string | null;

  application_number?: string;
  application_type?: string;
  application_status?: string;

  assigned_to_name?: string;
  assigned_by_name?: string;
};

export default function AssignmentDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [assignment, setAssignment] =
    useState<AssignmentDetails | null>(null);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  const loadAssignment = async () => {
    try {
      setError('');

      const data = await getAssignmentById(id);

      console.log('ASSIGNMENT DETAILS:', data);

      setAssignment(data);
    } catch (err: any) {
      console.log('ASSIGNMENT DETAILS ERROR:', err);

      setError(
        err.message || 'Failed to load assignment'
      );
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadAssignment();
    }, [id])
  );

  const handleStatusUpdate = (
    status: 'ACCEPTED' | 'DECLINED'
  ) => {
    const action =
      status === 'ACCEPTED' ? 'accept' : 'decline';

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
                id,
                status
              );

              Alert.alert(
                'Success',
                `Assignment ${action}ed successfully`,
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      loadAssignment();
                    },
                  },
                ]
              );
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />

        <Text style={styles.message}>
          Loading assignment...
        </Text>
      </View>
    );
  }

  if (error || !assignment) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          {error || 'Assignment not found'}
        </Text>

        <Pressable
          style={styles.retryButton}
          onPress={loadAssignment}
        >
          <Text style={styles.retryText}>
            Try Again
          </Text>
        </Pressable>
      </View>
    );
  }

  const formattedType =
    assignment.application_type ===
    'RE_VERIFICATION'
      ? 'Re-Verification'
      : 'Verification';

  const canRespond =
    assignment.status === 'ASSIGNED';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Pressable
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonText}>
          ← Back
        </Text>
      </Pressable>

      <Text style={styles.title}>
        Assignment Details
      </Text>

      <Text style={styles.applicationNumber}>
        {assignment.application_number ||
          'Application'}
      </Text>

      <View style={styles.status}>
        <Text style={styles.statusText}>
          {assignment.status}
        </Text>
      </View>

      <View style={styles.card}>
        <DetailRow
          label="Application Type"
          value={formattedType}
        />

        <DetailRow
          label="Application Status"
          value={assignment.application_status}
        />

        <DetailRow
          label="Assigned Date"
          value={
            assignment.assignment_date
              ? new Date(
                  assignment.assignment_date
                ).toLocaleDateString()
              : undefined
          }
        />

        <DetailRow
          label="Remarks"
          value={assignment.remarks}
        />
      </View>

      {canRespond && (
        <View style={styles.actions}>
          <Pressable
            style={[
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
              <Text style={styles.actionText}>
                Accept Assignment
              </Text>
            )}
          </Pressable>

          <Pressable
            style={[
              styles.declineButton,
              updating && styles.disabledButton,
            ]}
            disabled={updating}
            onPress={() =>
              handleStatusUpdate('DECLINED')
            }
          >
            <Text style={styles.actionText}>
              Decline Assignment
            </Text>
          </Pressable>
        </View>
      )}

      {assignment.status === 'ACCEPTED' && (
        <Pressable
          style={styles.startButton}
          onPress={() =>
            router.push({
              pathname: '/inspector/verification/start',
              params: {
                applicationId: assignment.application_id,
                assignmentId: assignment.id,
              },
            })
          }
        >
          <Text style={styles.actionText}>
            Start Verification
          </Text>
        </Pressable>
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

  backButton: {
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

  applicationNumber: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '600',
  },

  status: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },

  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },

  card: {
    marginTop: 25,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
  },

  detailRow: {
    paddingVertical: 14,
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

  actions: {
    marginTop: 25,
    gap: 12,
  },

  acceptButton: {
    backgroundColor: '#16A34A',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },

  declineButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },

  startButton: {
    marginTop: 25,
    backgroundColor: '#2563EB',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },

  disabledButton: {
    opacity: 0.6,
  },

  actionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});