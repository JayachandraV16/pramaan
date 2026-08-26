import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function CertificatesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Certificates
      </Text>

      <Text style={styles.text}>
        Your certificates will appear here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  title: {
    fontSize: 26,
    fontWeight: 'bold',
  },

  text: {
    marginTop: 10,
    textAlign: 'center',
  },
});