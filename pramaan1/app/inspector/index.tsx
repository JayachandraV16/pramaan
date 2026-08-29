import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

export default function InspectorDashboard() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Inspector Dashboard
      </Text>

      <Text style={styles.welcome}>
        Welcome, {user?.full_name || 'Officer'}
      </Text>

      <Text style={styles.role}>
        Role: {user?.role}
      </Text>

      <Pressable
        style={styles.card}
        onPress={() =>
          router.push('/inspector/assignments')
        }
      >
        <Text style={styles.cardTitle}>
          My Assignments
        </Text>

        <Text style={styles.cardText}>
          View and manage assigned verification requests
        </Text>
      </Pressable>

      <Pressable
        style={styles.card}
        onPress={() =>
          router.push('/inspector/schedules')
        }
      >
        <Text style={styles.cardTitle}>
          Verification Schedule
        </Text>

        <Text style={styles.cardText}>
          View upcoming verification visits
        </Text>
      </Pressable>

      <Pressable
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Text style={styles.logoutText}>
          Logout
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 20,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 40,
  },

  welcome: {
    fontSize: 18,
    marginTop: 12,
  },

  role: {
    fontSize: 14,
    marginTop: 5,
    opacity: 0.6,
  },

  card: {
    marginTop: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },

  cardText: {
    fontSize: 14,
    marginTop: 6,
    opacity: 0.6,
  },

  logoutButton: {
    marginTop: 30,
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },

  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});