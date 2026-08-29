import {
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';

import { router } from 'expo-router';

export default function BackToDashboard() {
  return (
    <Pressable
      style={styles.button}
      onPress={() => router.replace('/(tabs)')}
    >
      <Text style={styles.text}>
        ← Back to Dashboard
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
  },

  text: {
    fontSize: 15,
    fontWeight: '600',
  },
});