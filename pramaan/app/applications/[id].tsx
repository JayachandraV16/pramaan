import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { getApplicationById } from '../../services/applicationService';

type ApplicationDetails = {
  id: string;
  application_number: string;
  application_type: string;
  status: string;
  purpose?: string | null;
  remarks?: string | null;
  submitted_at?: string | null;
  created_at?: string | null;

  instrument_name?: string;
  serial_number?: string;
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
};

export default function ApplicationDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [application, setApplication] =
    useState<ApplicationDetails | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadApplication();
  }, [id]);

  const loadApplication = async () => {
    try {
      setError('');
      setLoading(true);

      const data = await getApplicationById(id);

      console.log('APPLICATION DETAILS:', data);

      setApplication(data);
    } catch (err: any) {
      console.log(
        'APPLICATION DETAILS ERROR:',
        err
      );

      setError(
        err.message || 'Failed to load application'
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

  const statusInfo =
    STATUS_INFO[application.status] || {
      title: application.status,
      description: 'Application status updated.',
    };

  const currentStepIndex =
    STATUS_STEPS.indexOf(application.status);

  const isRejected =
    application.status === 'REJECTED';

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
            {application.status.replace(/_/g, ' ')}
          </Text>
        </View>

        <Text style={styles.statusTitle}>
          {statusInfo.title}
        </Text>

        <Text style={styles.statusDescription}>
          {statusInfo.description}
        </Text>
      </View>

      {/* PROGRESS TRACKER */}

      {!isRejected && !isCancelled && (
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
});