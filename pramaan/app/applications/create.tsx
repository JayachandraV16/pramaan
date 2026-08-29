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
import { useEffect, useState } from 'react';
import { router } from 'expo-router';

import { getInstruments } from '../../services/instrumentService';
import { createApplication } from '../../services/applicationService';

type Instrument = {
  id: string;
  instrument_name: string;
  serial_number: string;
};

export default function CreateApplicationScreen() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selectedInstrument, setSelectedInstrument] = useState('');

  const [applicationType, setApplicationType] =
    useState('VERIFICATION');

  const [purpose, setPurpose] = useState('');
  const [remarks, setRemarks] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadInstruments();
  }, []);

  const loadInstruments = async () => {
    try {
      const data = await getInstruments();
      setInstruments(data);
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Failed to load instruments'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedInstrument) {
      Alert.alert(
        'Select Instrument',
        'Please select an instrument.'
      );
      return;
    }

    try {
      setSubmitting(true);

      await createApplication({
        instrumentId: selectedInstrument,
        applicationType,
        purpose: purpose.trim(),
        remarks: remarks.trim(),
      });

      Alert.alert(
        'Success',
        'Verification application submitted successfully.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Something went wrong'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>
          Loading your instruments...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>
        New Application
      </Text>

      <Text style={styles.subtitle}>
        Apply for verification of a registered instrument.
      </Text>

      <Text style={styles.label}>
        Select Instrument *
      </Text>

      {instruments.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            You have no registered instruments.
          </Text>
        </View>
      ) : (
        instruments.map((instrument) => (
          <Pressable
            key={instrument.id}
            style={[
              styles.instrumentCard,
              selectedInstrument === instrument.id &&
                styles.selectedCard,
            ]}
            onPress={() =>
              setSelectedInstrument(instrument.id)
            }
          >
            <Text style={styles.instrumentName}>
              {instrument.instrument_name}
            </Text>

            <Text style={styles.serialNumber}>
              Serial No: {instrument.serial_number}
            </Text>
          </Pressable>
        ))
      )}

      <Text style={styles.label}>
        Application Type *
      </Text>

      <View style={styles.typeContainer}>
        <Pressable
          style={[
            styles.typeButton,
            applicationType === 'VERIFICATION' &&
              styles.selectedType,
          ]}
          onPress={() =>
            setApplicationType('VERIFICATION')
          }
        >
          <Text
            style={[
              styles.typeText,
              applicationType === 'VERIFICATION' &&
                styles.selectedTypeText,
            ]}
          >
            Verification
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.typeButton,
            applicationType === 'RE_VERIFICATION' &&
              styles.selectedType,
          ]}
          onPress={() =>
            setApplicationType('RE_VERIFICATION')
          }
        >
          <Text
            style={[
              styles.typeText,
              applicationType === 'RE_VERIFICATION' &&
                styles.selectedTypeText,
            ]}
          >
            Re-Verification
          </Text>
        </Pressable>
      </View>

      <Text style={styles.label}>
        Purpose
      </Text>

      <TextInput
        style={styles.input}
        value={purpose}
        onChangeText={setPurpose}
        placeholder="Enter purpose"
      />

      <Text style={styles.label}>
        Remarks
      </Text>

      <TextInput
        style={[styles.input, styles.textArea]}
        value={remarks}
        onChangeText={setRemarks}
        placeholder="Any additional remarks"
        multiline
        numberOfLines={4}
      />

      <Pressable
        style={[
          styles.submitButton,
          submitting && styles.disabledButton,
        ]}
        onPress={handleSubmit}
        disabled={submitting || instruments.length === 0}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>
            Submit Application
          </Text>
        )}
      </Pressable>
    </ScrollView>
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
  },

  loadingText: {
    marginTop: 12,
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },

  subtitle: {
    marginTop: 6,
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 25,
  },

  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 15,
  },

  instrumentCard: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginBottom: 10,
  },

  selectedCard: {
    borderColor: '#000',
    borderWidth: 2,
  },

  instrumentName: {
    fontSize: 16,
    fontWeight: '600',
  },

  serialNumber: {
    marginTop: 4,
    opacity: 0.6,
  },

  typeContainer: {
    flexDirection: 'row',
    gap: 10,
  },

  typeButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
  },

  selectedType: {
    backgroundColor: '#000',
    borderColor: '#000',
  },

  typeText: {
    fontWeight: '500',
  },

  selectedTypeText: {
    color: '#fff',
  },

  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },

  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },

  submitButton: {
    marginTop: 30,
    backgroundColor: '#000',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },

  disabledButton: {
    opacity: 0.6,
  },

  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  emptyBox: {
    padding: 20,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
  },

  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
  },
});