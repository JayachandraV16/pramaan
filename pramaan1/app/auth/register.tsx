import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { registerUser } from '../../services/authService';

export default function RegisterScreen() {
  const { login } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleRegister = async () => {
    setError('');

    if (!fullName || !password) {
      setError('Full name and password are required');
      return;
    }

    if (!email && !phone) {
      setError('Please enter email or phone number');
      return;
    }

    try {
      setIsRegistering(true);

      const response = await registerUser(
        fullName.trim(),
        email.trim(),
        phone.trim(),
        password,
        'INSTRUMENT_OWNER',
        organizationName.trim() || undefined,
        address.trim() || undefined
      );

      const { token, user } = response.data;

      await login(token, user);

      router.replace(
        user.role === 'LMO' || user.role === 'GATC'
          ? '/inspector'
          : user.role === 'ADMIN'
            ? '/admin'
            : '/(tabs)'
      );
    } catch (error: any) {
      setError(
        error.message || 'Registration failed. Please try again.'
      );
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Create Account</Text>

      <Text style={styles.subtitle}>
        Register as an Instrument Owner
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Full Name *"
        value={fullName}
        onChangeText={setFullName}
        editable={!isRegistering}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!isRegistering}
      />

      <TextInput
        style={styles.input}
        placeholder="Phone Number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        editable={!isRegistering}
      />

      <TextInput
        style={styles.input}
        placeholder="Organization Name"
        value={organizationName}
        onChangeText={setOrganizationName}
        editable={!isRegistering}
      />

      <TextInput
        style={styles.input}
        placeholder="Address"
        value={address}
        onChangeText={setAddress}
        editable={!isRegistering}
      />

      <TextInput
        style={styles.input}
        placeholder="Password *"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!isRegistering}
      />

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      <TouchableOpacity
        style={[
          styles.button,
          isRegistering && styles.disabledButton,
        ]}
        onPress={handleRegister}
        disabled={isRegistering}
      >
        {isRegistering ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>
            Create Account
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.back()}
        disabled={isRegistering}
      >
        <Text style={styles.login}>
          Already have an account? Login
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 25,
    backgroundColor: '#ffffff',
  },

  title: {
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1E3A5F',
  },

  subtitle: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 8,
    marginBottom: 30,
    color: '#666',
  },

  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },

  error: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 10,
  },

  button: {
    backgroundColor: '#1E3A5F',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 5,
  },

  disabledButton: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 'bold',
  },

  login: {
    marginTop: 25,
    textAlign: 'center',
    color: '#1E3A5F',
    fontWeight: '600',
  },
});