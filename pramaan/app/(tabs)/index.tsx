import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

export default function HomeScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcome}>
          Welcome to Pramaan
        </Text>

        <Text style={styles.subtitle}>
          Manage your instruments and verification
          applications in one place.
        </Text>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>
        Quick Actions
      </Text>

      <View style={styles.actions}>
        <Pressable
          style={styles.card}
          onPress={() =>
            router.push('/instruments')
          }
        >
          <Text style={styles.cardIcon}>
            ⚙️
          </Text>

          <Text style={styles.cardTitle}>
            My Instruments
          </Text>

          <Text style={styles.cardText}>
            View and manage your registered instruments
          </Text>
        </Pressable>

        <Pressable
          style={styles.card}
          onPress={() =>
            router.push('/instruments/new')
          }
        >
          <Text style={styles.cardIcon}>
            ＋
          </Text>

          <Text style={styles.cardTitle}>
            Add Instrument
          </Text>

          <Text style={styles.cardText}>
            Register a new instrument
          </Text>
        </Pressable>

        <Pressable
          style={styles.card}
          onPress={() =>
            router.push('/applications/create')
          }
        >
          <Text style={styles.cardIcon}>
            📋
          </Text>

          <Text style={styles.cardTitle}>
            New Application
          </Text>

          <Text style={styles.cardText}>
            Apply for instrument verification
          </Text>
        </Pressable>

        <Pressable
          style={styles.card}
          onPress={() =>
            router.push('/applications')
          }
        >
          <Text style={styles.cardIcon}>
            📄
          </Text>

          <Text style={styles.cardTitle}>
            My Applications
          </Text>

          <Text style={styles.cardText}>
            Track your verification applications
          </Text>
        </Pressable>

        <Pressable
          style={styles.card}
          onPress={() =>
            router.push('/certificates')
          }
        >
          <Text style={styles.cardIcon}>
            🏆
          </Text>

          <Text style={styles.cardTitle}>
            Certificates
          </Text>

          <Text style={styles.cardText}>
            View your issued certificates
          </Text>
        </Pressable>
      </View>

      {/* Information Section */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>
          How it works
        </Text>

        <Text style={styles.infoText}>
          1. Register your instrument
        </Text>

        <Text style={styles.infoText}>
          2. Submit a verification application
        </Text>

        <Text style={styles.infoText}>
          3. Track your application status
        </Text>

        <Text style={styles.infoText}>
          4. Receive your verification certificate
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  welcomeSection: {
    marginBottom: 30,
  },

  welcome: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 15,
    color: '#111827',
  },

  actions: {
    gap: 12,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 18,
  },

  cardIcon: {
    fontSize: 25,
    marginBottom: 8,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },

  cardText: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: '#6B7280',
  },

  infoCard: {
    marginTop: 28,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 18,
  },

  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#1E3A8A',
  },

  infoText: {
    fontSize: 14,
    marginTop: 8,
    color: '#374151',
  },
});