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
  useCallback,
  useState,
} from 'react';

import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';

import { apiRequest } from '../../../services/api';

type Observation = {
  id: string;
  observation_type: string;
  observation_description?: string | null;
  observed_value?: string | null;
  remarks?: string | null;
};

type Reading = {
  id: string;
  reading_type: string;
  expected_value?: number | null;
  observed_value: number;
  unit: string;
  tolerance?: number | null;
  result: 'PASS' | 'FAIL';
  remarks?: string | null;
};

type Verification = {
  id: string;
  application_id: string;
  assignment_id: string;
  schedule_id?: string | null;
  performed_by_id: string;
  verification_date?: string;
  location?: string | null;
  status: string;
  remarks?: string | null;

  application_number?: string;
  observations?: Observation[];
  readings?: Reading[];
  result?: any;
};

export default function VerificationScreen() {
  const { id } = useLocalSearchParams<{
    id: string;
  }>();

  const [verification, setVerification] =
    useState<Verification | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const [addingObservation, setAddingObservation] =
    useState(false);

  const [addingReading, setAddingReading] =
    useState(false);

  const [observationType, setObservationType] =
    useState('');

  const [
    observationDescription,
    setObservationDescription,
  ] = useState('');

  const [observedValue, setObservedValue] =
    useState('');

  const [observationRemarks, setObservationRemarks] =
    useState('');

  const [readingType, setReadingType] =
    useState('');

  const [expectedValue, setExpectedValue] =
    useState('');

  const [readingObservedValue, setReadingObservedValue] =
    useState('');

  const [unit, setUnit] =
    useState('');

  const [tolerance, setTolerance] =
    useState('');

  const [readingResult, setReadingResult] =
    useState<'PASS' | 'FAIL'>('PASS');

  const [readingRemarks, setReadingRemarks] =
    useState('');

  const loadVerification = async () => {
    try {
      setError('');

      const response = await apiRequest(
        `/verifications/${id}`,
        { requiresAuth: true }
      );

      console.log(
        'VERIFICATION DETAILS:',
        response
      );

      setVerification(
        response.data || response
      );
    } catch (err: any) {
      console.log(
        'VERIFICATION ERROR:',
        err
      );

      setError(
        err.message ||
          'Failed to load verification'
      );
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadVerification();
    }, [id])
  );

  const handleAddObservation = async () => {
    if (!observationType.trim()) {
      Alert.alert(
        'Required',
        'Please enter observation type'
      );
      return;
    }

    try {
      setAddingObservation(true);

      await apiRequest(
        `/verifications/${id}/observations`,
        {
          method: 'POST',
          requiresAuth: true,
          body: JSON.stringify({
            observationType:
              observationType.trim(),

            ...(observationDescription.trim()
              ? {
                  observationDescription:
                    observationDescription.trim(),
                }
              : {}),

            ...(observedValue.trim()
              ? {
                  observedValue:
                    observedValue.trim(),
                }
              : {}),

            ...(observationRemarks.trim()
              ? {
                  remarks:
                    observationRemarks.trim(),
                }
              : {}),
          }),
        }
      );

      setObservationType('');
      setObservationDescription('');
      setObservedValue('');
      setObservationRemarks('');

      Alert.alert(
        'Success',
        'Observation added successfully'
      );

      await loadVerification();
    } catch (err: any) {
      Alert.alert(
        'Error',
        err.message ||
          'Failed to add observation'
      );
    } finally {
      setAddingObservation(false);
    }
  };

  const handleAddReading = async () => {
    if (!readingType.trim()) {
      Alert.alert(
        'Required',
        'Please enter reading type'
      );
      return;
    }

    if (!readingObservedValue.trim()) {
      Alert.alert(
        'Required',
        'Please enter observed value'
      );
      return;
    }

    if (!unit.trim()) {
      Alert.alert(
        'Required',
        'Please enter unit'
      );
      return;
    }

    try {
      setAddingReading(true);

      await apiRequest(
        `/verifications/${id}/readings`,
        {
          method: 'POST',
          requiresAuth: true,
          body: JSON.stringify({
            readingType:
              readingType.trim(),

            ...(expectedValue.trim()
              ? {
                  expectedValue:
                    Number(expectedValue),
                }
              : {}),

            observedValue:
              Number(readingObservedValue),

            unit: unit.trim(),

            ...(tolerance.trim()
              ? {
                  tolerance:
                    Number(tolerance),
                }
              : {}),

            result: readingResult,

            ...(readingRemarks.trim()
              ? {
                  remarks:
                    readingRemarks.trim(),
                }
              : {}),
          }),
        }
      );

      setReadingType('');
      setExpectedValue('');
      setReadingObservedValue('');
      setUnit('');
      setTolerance('');
      setReadingResult('PASS');
      setReadingRemarks('');

      Alert.alert(
        'Success',
        'Reading added successfully'
      );

      await loadVerification();
    } catch (err: any) {
      Alert.alert(
        'Error',
        err.message ||
          'Failed to add reading'
      );
    } finally {
      setAddingReading(false);
    }
  };

  const handleSubmitResult = () => {
    Alert.alert(
      'Complete Verification',
      'Are you ready to submit the final verification result?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Continue',
          onPress: () =>
            router.push({
              pathname:
                '/inspector/verification/result',
              params: {
                verificationId: id,
              },
            }),
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Loading verification...
        </Text>
      </View>
    );
  }

  if (error || !verification) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          {error || 'Verification not found'}
        </Text>

        <Pressable
          style={styles.retryButton}
          onPress={loadVerification}
        >
          <Text style={styles.retryText}>
            Try Again
          </Text>
        </Pressable>
      </View>
    );
  }

  const isCompleted =
    verification.status === 'COMPLETED';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        onPress={() => router.back()}
      >
        <Text style={styles.backButton}>
          ← Back
        </Text>
      </Pressable>

      <Text style={styles.title}>
        Verification
      </Text>

      {verification.application_number && (
        <Text style={styles.applicationNumber}>
          {verification.application_number}
        </Text>
      )}

      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          {verification.status}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Verification Details
        </Text>

        <DetailRow
          label="Location"
          value={verification.location}
        />

        <DetailRow
          label="Remarks"
          value={verification.remarks}
          last
        />
      </View>

      {!isCompleted && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Add Observation
            </Text>

            <TextInput
              style={styles.input}
              value={observationType}
              onChangeText={setObservationType}
              placeholder="Observation type *"
            />

            <TextInput
              style={styles.input}
              value={observationDescription}
              onChangeText={
                setObservationDescription
              }
              placeholder="Description"
            />

            <TextInput
              style={styles.input}
              value={observedValue}
              onChangeText={setObservedValue}
              placeholder="Observed value"
            />

            <TextInput
              style={[
                styles.input,
                styles.multilineInput,
              ]}
              value={observationRemarks}
              onChangeText={
                setObservationRemarks
              }
              placeholder="Remarks"
              multiline
            />

            <Pressable
              style={[
                styles.secondaryButton,
                addingObservation &&
                  styles.disabledButton,
              ]}
              onPress={handleAddObservation}
              disabled={addingObservation}
            >
              {addingObservation ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>
                  Add Observation
                </Text>
              )}
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Add Measurement Reading
            </Text>

            <TextInput
              style={styles.input}
              value={readingType}
              onChangeText={setReadingType}
              placeholder="Reading type *"
            />

            <TextInput
              style={styles.input}
              value={expectedValue}
              onChangeText={setExpectedValue}
              keyboardType="decimal-pad"
              placeholder="Expected value"
            />

            <TextInput
              style={styles.input}
              value={readingObservedValue}
              onChangeText={
                setReadingObservedValue
              }
              keyboardType="decimal-pad"
              placeholder="Observed value *"
            />

            <TextInput
              style={styles.input}
              value={unit}
              onChangeText={setUnit}
              placeholder="Unit * (e.g. kg)"
            />

            <TextInput
              style={styles.input}
              value={tolerance}
              onChangeText={setTolerance}
              keyboardType="decimal-pad"
              placeholder="Tolerance"
            />

            <Text style={styles.inputLabel}>
              Reading Result
            </Text>

            <View style={styles.resultContainer}>
              <Pressable
                style={[
                  styles.resultButton,
                  readingResult === 'PASS' &&
                    styles.passSelected,
                ]}
                onPress={() =>
                  setReadingResult('PASS')
                }
              >
                <Text
                  style={[
                    styles.resultButtonText,
                    readingResult === 'PASS' &&
                      styles.selectedResultText,
                  ]}
                >
                  PASS
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.resultButton,
                  readingResult === 'FAIL' &&
                    styles.failSelected,
                ]}
                onPress={() =>
                  setReadingResult('FAIL')
                }
              >
                <Text
                  style={[
                    styles.resultButtonText,
                    readingResult === 'FAIL' &&
                      styles.selectedResultText,
                  ]}
                >
                  FAIL
                </Text>
              </Pressable>
            </View>

            <TextInput
              style={[
                styles.input,
                styles.multilineInput,
              ]}
              value={readingRemarks}
              onChangeText={setReadingRemarks}
              placeholder="Remarks"
              multiline
            />

            <Pressable
              style={[
                styles.secondaryButton,
                addingReading &&
                  styles.disabledButton,
              ]}
              onPress={handleAddReading}
              disabled={addingReading}
            >
              {addingReading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>
                  Add Reading
                </Text>
              )}
            </Pressable>
          </View>
        </>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Observations
        </Text>

        {verification.observations &&
        verification.observations.length > 0 ? (
          verification.observations.map(
            (item) => (
              <View
                key={item.id}
                style={styles.itemCard}
              >
                <Text style={styles.itemTitle}>
                  {item.observation_type}
                </Text>

                {item.observation_description && (
                  <Text style={styles.itemText}>
                    {
                      item.observation_description
                    }
                  </Text>
                )}

                {item.observed_value && (
                  <Text style={styles.itemText}>
                    Value:{' '}
                    {item.observed_value}
                  </Text>
                )}
              </View>
            )
          )
        ) : (
          <Text style={styles.emptyText}>
            No observations added yet.
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Measurement Readings
        </Text>

        {verification.readings &&
        verification.readings.length > 0 ? (
          verification.readings.map(
            (item) => (
              <View
                key={item.id}
                style={styles.itemCard}
              >
                <View style={styles.readingHeader}>
                  <Text style={styles.itemTitle}>
                    {item.reading_type}
                  </Text>

                  <Text
                    style={
                      item.result === 'PASS'
                        ? styles.passText
                        : styles.failText
                    }
                  >
                    {item.result}
                  </Text>
                </View>

                <Text style={styles.itemText}>
                  Observed:{' '}
                  {item.observed_value}{' '}
                  {item.unit}
                </Text>

                {item.expected_value !== null &&
                  item.expected_value !==
                    undefined && (
                    <Text style={styles.itemText}>
                      Expected:{' '}
                      {item.expected_value}
                    </Text>
                  )}

                {item.tolerance !== null &&
                  item.tolerance !==
                    undefined && (
                    <Text style={styles.itemText}>
                      Tolerance: ±
                      {item.tolerance}
                    </Text>
                  )}
              </View>
            )
          )
        ) : (
          <Text style={styles.emptyText}>
            No readings added yet.
          </Text>
        )}
      </View>

      {!isCompleted && (
        <Pressable
          style={styles.completeButton}
          onPress={handleSubmitResult}
        >
          <Text style={styles.buttonText}>
            Submit Final Result
          </Text>
        </Pressable>
      )}

      {isCompleted && verification.result && (
        <View style={styles.completedBox}>
          <Text style={styles.completedTitle}>
            Verification Completed
          </Text>

          <Text style={styles.completedText}>
            Final Result:{' '}
            {verification.result.decision}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function DetailRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value?: string | null;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.detailRow,
        last && styles.lastDetailRow,
      ]}
    >
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
    paddingBottom: 50,
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

  backButton: {
    color: '#2563EB',
    fontWeight: '600',
    marginBottom: 20,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
  },

  applicationNumber: {
    marginTop: 5,
    fontSize: 14,
    opacity: 0.6,
  },

  statusContainer: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E8F0FE',
  },

  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },

  card: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
  },

  detailRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  lastDetailRow: {
    borderBottomWidth: 0,
  },

  label: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 5,
  },

  value: {
    fontSize: 15,
    fontWeight: '500',
  },

  section: {
    marginTop: 28,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 14,
  },

  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },

  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },

  secondaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },

  completeButton: {
    marginTop: 35,
    backgroundColor: '#16A34A',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  disabledButton: {
    opacity: 0.6,
  },

  resultContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },

  resultButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },

  passSelected: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },

  failSelected: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },

  resultButtonText: {
    fontWeight: '700',
  },

  selectedResultText: {
    color: '#FFFFFF',
  },

  itemCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },

  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
  },

  itemText: {
    marginTop: 5,
    fontSize: 13,
    opacity: 0.7,
  },

  emptyText: {
    fontSize: 14,
    opacity: 0.6,
  },

  readingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  passText: {
    color: '#16A34A',
    fontWeight: '700',
  },

  failText: {
    color: '#DC2626',
    fontWeight: '700',
  },

  completedBox: {
    marginTop: 30,
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
  },

  completedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#166534',
  },

  completedText: {
    marginTop: 8,
    fontSize: 15,
  },
});