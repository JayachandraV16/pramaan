import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '../context/AuthContext';
import { UserProvider } from '../context/UserContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <UserProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style="dark" />
      </UserProvider>
    </AuthProvider>
  );
}