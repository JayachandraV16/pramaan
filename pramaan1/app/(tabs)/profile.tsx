import { router } from 'expo-router';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../../context/AuthContext';

export default function ProfileScreen() {
  const { logout } = useAuth();

  const handleLogout = async () => {
    console.log('Logout button pressed');

    await logout();

    console.log('User logged out');

    router.replace('/auth/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <Text style={styles.text}>
        Pramaan User
      </Text>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Text style={styles.logoutText}>
          Logout
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
    backgroundColor: '#ffffff',
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },

  text: {
    fontSize: 18,
    marginBottom: 40,
  },

  logoutButton: {
    backgroundColor: '#d9534f',
    paddingVertical: 16,
    paddingHorizontal: 50,
    borderRadius: 10,
  },

  logoutText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 'bold',
  },
});