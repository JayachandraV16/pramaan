import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { loginUser } from '../../services/authService';

export default function LoginScreen() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setError('');

    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    try {
      setIsLoggingIn(true);

      const response = await loginUser(
        email.trim(),
        password
      );

      const { token, user } = response.data;

      await login(token, user);

      router.replace('/(tabs)');
    } catch (error: any) {
      setError(
        error.message || 'Login failed. Please try again.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pramaan</Text>

      <Text style={styles.subtitle}>
        Digital Verification & Certification
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!isLoggingIn}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!isLoggingIn}
      />

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      <TouchableOpacity
        style={[
          styles.button,
          isLoggingIn && styles.disabledButton,
        ]}
        onPress={handleLogin}
        disabled={isLoggingIn}
      >
        {isLoggingIn ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>
            Login
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/auth/register')}
        disabled={isLoggingIn}
      >
        <Text style={styles.register}>
          New user? Register
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 25,
    backgroundColor: '#ffffff',
  },

  title: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1E3A5F',
  },

  subtitle: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 8,
    marginBottom: 40,
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
    marginBottom: 10,
    textAlign: 'center',
  },

  button: {
    backgroundColor: '#1E3A5F',
    padding: 16,
    borderRadius: 10,
    marginTop: 10,
    alignItems: 'center',
  },

  disabledButton: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },

  register: {
    textAlign: 'center',
    marginTop: 25,
    color: '#1E3A5F',
  },
});