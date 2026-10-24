import { useEffect, useState } from 'react';
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
import { router } from 'expo-router';

import {
  createInstrument,
  getInstrumentTypes,
} from '../../services/instrumentService';

import { InstrumentType } from '../../types/instrument';

export default function NewInstrumentScreen() {
  const [instrumentTypes, setInstrumentTypes] = useState<
    InstrumentType[]
  >([]);

  const [loadingTypes, setLoadingTypes] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [instrumentTypeId, setInstrumentTypeId] = useState('');
  const [instrumentName, setInstrumentName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [capacity, setCapacity] = useState('');
  const [capacityUnit, setCapacityUnit] = useState('');
  const [accuracyClass, setAccuracyClass] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLat, setLocationLat] = useState('');
  const [locationLng, setLocationLng] = useState('');

  useEffect(() => {
    loadInstrumentTypes();
  }, []);

  const loadInstrumentTypes = async () => {
    try {
      setLoadingTypes(true);

      const data = await getInstrumentTypes();

      setInstrumentTypes(data);
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Failed to load instrument types'
      );
    } finally {
      setLoadingTypes(false);
    }
  };

  const handleSubmit = async () => {
    if (!instrumentTypeId) {
      Alert.alert(
        'Required',
        'Please select an instrument type'
      );
      return;
    }

    if (!instrumentName.trim()) {
      Alert.alert(
        'Required',
        'Please enter instrument name'
      );
      return;
    }

    if (!serialNumber.trim()) {
      Alert.alert(
        'Required',
        'Please enter serial number'
      );
      return;
    }

    // Capacity validation
    if (
      capacity.trim() &&
      (
        Number.isNaN(Number(capacity)) ||
        Number(capacity) <= 0
      )
    ) {
      Alert.alert(
        'Invalid Capacity',
        'Please enter a valid capacity greater than 0'
      );
      return;
    }

    // Latitude validation
    if (locationLat.trim()) {
      const latitude = Number(locationLat);

      if (
        Number.isNaN(latitude) ||
        latitude < -90 ||
        latitude > 90
      ) {
        Alert.alert(
          'Invalid Latitude',
          'Latitude must be between -90 and 90'
        );
        return;
      }
    }

    // Longitude validation
    if (locationLng.trim()) {
      const longitude = Number(locationLng);

      if (
        Number.isNaN(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        Alert.alert(
          'Invalid Longitude',
          'Longitude must be between -180 and 180'
        );
        return;
      }
    }

    try {
      setSubmitting(true);

      const instrumentData = {
        instrumentTypeId,
        instrumentName: instrumentName.trim(),
        serialNumber: serialNumber.trim(),

        ...(manufacturer.trim()
          ? {
              manufacturer: manufacturer.trim(),
            }
          : {}),

        ...(model.trim()
          ? {
              model: model.trim(),
            }
          : {}),

        ...(capacity.trim()
          ? {
              capacity: Number(capacity),
            }
          : {}),

        ...(capacityUnit.trim()
          ? {
              capacityUnit: capacityUnit.trim(),
            }
          : {}),

        ...(accuracyClass.trim()
          ? {
              accuracyClass: accuracyClass.trim(),
            }
          : {}),

        ...(locationAddress.trim()
          ? {
              locationAddress:
                locationAddress.trim(),
            }
          : {}),

        ...(locationLat.trim()
          ? {
              locationLat:
                Number(locationLat),
            }
          : {}),

        ...(locationLng.trim()
          ? {
              locationLng:
                Number(locationLng),
            }
          : {}),
      };

      console.log(
        'CREATING INSTRUMENT:',
        instrumentData
      );

      await createInstrument(instrumentData);

      Alert.alert(
        'Success',
        'Instrument added successfully',
        [
          {
            text: 'OK',
            onPress: () => {
              router.back();
            },
          },
        ]
      );
    } catch (error: any) {
      console.log(
        'CREATE INSTRUMENT ERROR:',
        error
      );

      Alert.alert(
        'Error',
        error.message ||
          'Failed to create instrument'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingTypes) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>
          Loading instrument types...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>
        Add New Instrument
      </Text>

      <Text style={styles.subtitle}>
        Enter the details of your instrument
      </Text>

      <Text style={styles.label}>
        Instrument Type *
      </Text>

      <View style={styles.typeContainer}>
        {instrumentTypes.map((type) => (
          <Pressable
            key={type.id}
            style={[
              styles.typeButton,
              instrumentTypeId === type.id &&
                styles.typeButtonSelected,
            ]}
            onPress={() => {
              setInstrumentTypeId(type.id);

              if (
                type.default_unit &&
                !capacityUnit
              ) {
                setCapacityUnit(
                  type.default_unit
                );
              }
            }}
          >
            <Text
              style={[
                styles.typeButtonText,
                instrumentTypeId === type.id &&
                  styles.typeButtonTextSelected,
              ]}
            >
              {type.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>
        Instrument Name *
      </Text>

      <TextInput
        style={styles.input}
        value={instrumentName}
        onChangeText={setInstrumentName}
        placeholder="e.g. Digital Weighing Scale"
      />

      <Text style={styles.label}>
        Serial Number *
      </Text>

      <TextInput
        style={styles.input}
        value={serialNumber}
        onChangeText={setSerialNumber}
        placeholder="Enter serial number"
      />

      <Text style={styles.label}>
        Manufacturer
      </Text>

      <TextInput
        style={styles.input}
        value={manufacturer}
        onChangeText={setManufacturer}
        placeholder="Enter manufacturer"
      />

      <Text style={styles.label}>
        Model
      </Text>

      <TextInput
        style={styles.input}
        value={model}
        onChangeText={setModel}
        placeholder="Enter model"
      />

      <Text style={styles.label}>
        Capacity
      </Text>

      <TextInput
        style={styles.input}
        value={capacity}
        onChangeText={setCapacity}
        keyboardType="decimal-pad"
        placeholder="e.g. 100"
      />

      <Text style={styles.label}>
        Capacity Unit
      </Text>

      <TextInput
        style={styles.input}
        value={capacityUnit}
        onChangeText={setCapacityUnit}
        placeholder="e.g. kg"
      />

      <Text style={styles.label}>
        Accuracy Class
      </Text>

      <TextInput
        style={styles.input}
        value={accuracyClass}
        onChangeText={setAccuracyClass}
        placeholder="e.g. Class III"
      />

      <Text style={styles.label}>
        Location Address
      </Text>

      <TextInput
        style={[
          styles.input,
          styles.multilineInput,
        ]}
        value={locationAddress}
        onChangeText={setLocationAddress}
        placeholder="Enter instrument location"
        multiline
      />

      <Text style={styles.label}>
        Latitude
      </Text>

      <TextInput
        style={styles.input}
        value={locationLat}
        onChangeText={setLocationLat}
        keyboardType="decimal-pad"
        placeholder="e.g. 18.5204"
      />

      <Text style={styles.label}>
        Longitude
      </Text>

      <TextInput
        style={styles.input}
        value={locationLng}
        onChangeText={setLocationLng}
        keyboardType="decimal-pad"
        placeholder="e.g. 73.8567"
      />

      <Pressable
        style={[
          styles.submitButton,
          submitting &&
            styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>
            Add Instrument
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

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  loadingText: {
    marginTop: 12,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
  },

  subtitle: {
    fontSize: 14,
    marginTop: 5,
    marginBottom: 24,
    opacity: 0.6,
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
    minHeight: 80,
    textAlignVertical: 'top',
  },

  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 8,
  },

  typeButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  typeButtonSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },

  typeButtonText: {
    fontSize: 13,
  },

  typeButtonTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  submitButton: {
    marginTop: 20,
    backgroundColor: '#2563EB',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },

  submitButtonDisabled: {
    opacity: 0.6,
  },

  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});