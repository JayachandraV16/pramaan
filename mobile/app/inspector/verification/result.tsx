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

import { useState } from 'react';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import { apiRequest } from '../../../services/api';

export default function VerificationResultScreen() {
  const { verificationId } =
    useLocalSearchParams<{
      verificationId: string;
    }>();

  const [decision, setDecision] =
    useState<'PASS' | 'FAIL'>('PASS');

  const [remarks, setRemarks] =
    useState('');

  const [submitting, setSubmitting] =
    useState(false);

  const handleSubmit = () => {
    if (!verificationId) {
      Alert.alert(
        'Error',
        'Verification ID is missing'
      );
      return;
    }

    Alert.alert(
      'Submit Final Result',
      `Are you sure you want to submit ${decision} as the final result? This action cannot be changed.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Submit',
          onPress: submitResult,
        },
      ]
    );
  };

  const submitResult = async () => {
    try {
      setSubmitting(true);

      await apiRequest(
        `/verifications/${verificationId}/result`,
        {
          method: 'POST',
          requiresAuth: true,
          body: JSON.stringify({
            decision,

            ...(remarks.trim()
              ? {
                  remarks: remarks.trim(),
                }
              : {}),
          }),
        }
      );

      Alert.alert(
        'Verification Completed',
        `Final result submitted successfully: ${decision}`,
        [
          {
            text: 'View Verification',
            onPress: () =>
              router.replace({
                pathname:
                  '/inspector/verification/[id]',
                params: {
                  id: verificationId,
                },
              }),
          },
        ]
      );
    } catch (error: any) {
      console.log(
        'SUBMIT RESULT ERROR:',
        error
      );

      Alert.alert(
        'Error',
        error.message ||
          'Failed to submit verification result'
      );
    } finally {
      setSubmitting(false);
    }
  };

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
          ← Back to Verification
        </Text>
      </Pressable>

      <Text style={styles.title}>
        Final Verification Result
      </Text>

      <Text style={styles.subtitle}>
        Select the final decision for this
        instrument verification.
      </Text>

      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          Make sure all observations and
          measurement readings have been added
          before submitting the final result.
        </Text>
      </View>

      <Text style={styles.label}>
        Final Decision *
      </Text>

      <View style={styles.decisionContainer}>
        <Pressable
          style={[
            styles.decisionButton,
            decision === 'PASS' &&
              styles.passSelected,
          ]}
          onPress={() => setDecision('PASS')}
        >
          <Text
            style={[
              styles.decisionText,
              decision === 'PASS' &&
                styles.selectedDecisionText,
            ]}
          >
            PASS
          </Text>

          <Text
            style={[
              styles.decisionDescription,
              decision === 'PASS' &&
                styles.selectedDecisionText,
            ]}
          >
            Instrument meets verification
            requirements
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.decisionButton,
            decision === 'FAIL' &&
              styles.failSelected,
          ]}
          onPress={() => setDecision('FAIL')}
        >
          <Text
            style={[
              styles.decisionText,
              decision === 'FAIL' &&
                styles.selectedDecisionText,
            ]}
          >
            FAIL
          </Text>

          <Text
            style={[
              styles.decisionDescription,
              decision === 'FAIL' &&
                styles.selectedDecisionText,
            ]}
          >
            Instrument does not meet
            verification requirements
          </Text>
        </Pressable>
      </View>

      <Text style={styles.label}>
        Final Remarks
      </Text>

      <TextInput
        style={styles.remarksInput}
        value={remarks}
        onChangeText={setRemarks}
        placeholder="Enter final remarks (optional)"
        multiline
        textAlignVertical="top"
      />

      <Pressable
        style={[
          styles.submitButton,
          decision === 'FAIL' &&
            styles.failSubmitButton,
          submitting &&
            styles.disabledButton,
        ]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>
            Submit Final {decision} Result
          </Text>
        )}
      </Pressable>
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
    paddingBottom: 50,
  },

  backButton: {
    color: '#2563EB',
    fontWeight: '600',
    marginBottom: 24,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
  },

  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.6,
  },

  warningBox: {
    marginTop: 24,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
  },

  warningText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#92400E',
  },

  label: {
    marginTop: 28,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: '700',
  },

  decisionContainer: {
    flexDirection: 'row',
    gap: 12,
  },

  decisionButton: {
    flex: 1,
    minHeight: 150,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    justifyContent: 'center',
  },

  passSelected: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },

  failSelected: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },

  decisionText: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },

  decisionDescription: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    opacity: 0.7,
  },

  selectedDecisionText: {
    color: '#FFFFFF',
    opacity: 1,
  },

  remarksInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },

  submitButton: {
    marginTop: 30,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#16A34A',
  },

  failSubmitButton: {
    backgroundColor: '#DC2626',
  },

  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  disabledButton: {
    opacity: 0.6,
  },
});