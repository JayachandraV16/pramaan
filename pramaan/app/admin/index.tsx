import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../context/AuthContext';

export default function AdminDashboard() {
  const { logout } = useAuth();

  const openApplications = () =>
    router.push('/admin/applications');

  const openAssignments = () =>
    router.push('/admin/assignments');

  const openSchedules = () =>
    router.push('/admin/schedules');

  const openVerifications = () =>
    router.push('/admin/verifications');

  const openCertificates = () =>
    router.push('/admin/certificates');

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            Admin Dashboard
          </Text>

          <Text style={styles.subtitle}>
            Manage the verification pipeline
          </Text>
        </View>

        <Pressable
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>
            Logout
          </Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        <AdminCard
          label="Applications"
          onPress={openApplications}
        />

        <AdminCard
          label="Assignments"
          onPress={openAssignments}
        />

        <AdminCard
          label="Schedules"
          onPress={openSchedules}
        />

        <AdminCard
          label="Verifications"
          onPress={openVerifications}
        />

        <AdminCard
          label="Certificates"
          onPress={openCertificates}
        />
      </View>
    </ScrollView>
  );
}

function AdminCard({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
    >
      <Text style={styles.cardTitle}>
        {label}
      </Text>

      <Text style={styles.cardText}>
        Open management view
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#F8FAFC',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111827',
  },

  subtitle: {
    marginTop: 6,
    color: '#64748B',
    fontSize: 15,
  },

  logoutButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },

  logoutText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  grid: {
    marginTop: 24,
    gap: 14,
  },

  card: {
    padding: 18,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },

  cardText: {
    color: '#64748B',
  },
});