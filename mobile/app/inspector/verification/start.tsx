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

export default function StartVerificationScreen() {
  const {
    applicationId,
    assignmentId,
    scheduleId,
  } = useLocalSearchParams<{
    applicationId: string;
    assignmentId: string;
    scheduleId?: string;
  }>();

  const [location, setLocation] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] =
    useState(false);

  const handleStartVerification = async () => {
    if (!applicationId || !assignmentId) {
      Alert.alert(
        'Error',
        'Application or assignment information is missing'
      );
      return;
    }

    try {
      setSubmitting(true);

      const response = await apiRequest(
        '/verifications',
        {
          method: 'POST',
          requiresAuth: true,
          body: JSON.stringify({
            applicationId,
            assignmentId,
            ...(scheduleId
              ? { scheduleId }
              : {}),

            ...(location.trim()
              ? {
                  location: location.trim(),
                }
              : {}),

            ...(remarks.trim()
              ? {
                  remarks: remarks.trim(),
                }
              : {}),
          }),
        }
      );

      console.log(
        'VERIFICATION STARTED:',
        response
      );

      const verification =
        response.data || response;

      Alert.alert(
        'Verification Started',
        'You can now begin the inspection.',
        [
          {
            text: 'Start Inspection',
            onPress: () =>
              router.replace({
                pathname:
                  '/inspector/verification/[id]',
                params: {
                  id: verification.id,
                },
              }),
          },
        ]
      );
    } catch (error: any) {
      console.log(
        'START VERIFICATION ERROR:',
        error
      );

      Alert.alert(
        'Error',
        error.message ||
          'Failed to start verification'
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
          ← Back to Assignment
        </Text>
      </Pressable>

      <Text style={styles.title}>
        Start Verification
      </Text>

      <Text style={styles.subtitle}>
        Enter the initial details before starting
        the field verification.
      </Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>
          Application ID
        </Text>

        <Text style={styles.infoValue}>
          {applicationId}
        </Text>
      </View>

      <Text style={styles.label}>
        Verification Location
      </Text>

      <TextInput
        style={styles.input}
        value={location}
        onChangeText={setLocation}
        placeholder="Enter verification location"
      />

      <Text style={styles.label}>
        Initial Remarks
      </Text>

      <TextInput
        style={[
          styles.input,
          styles.multilineInput,
        ]}
        value={remarks}
        onChangeText={setRemarks}
        placeholder="Add any initial remarks"
        multiline
      />

      <Pressable
        style={[
          styles.startButton,
          submitting &&
            styles.startButtonDisabled,
        ]}
        onPress={handleStartVerification}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.startButtonText}>
            Start Verification
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
    paddingBottom: 40,
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
    fontSize: 14,
    marginTop: 6,
    marginBottom: 24,
    opacity: 0.6,
    lineHeight: 20,
  },

  infoCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    backgroundColor: '#F9FAFB',
  },

  infoLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 5,
  },

  infoValue: {
    fontSize: 13,
    fontWeight: '600',
  },

  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
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
    minHeight: 100,
    textAlignVertical: 'top',
  },

  startButton: {
    marginTop: 20,
    backgroundColor: '#16A34A',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },

  startButtonDisabled: {
    opacity: 0.6,
  },

  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});