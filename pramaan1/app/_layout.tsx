import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ScreenCapture from 'expo-screen-capture';

import { AuthProvider } from '../context/AuthContext';

export default function RootLayout() {
  useEffect(() => {
    ScreenCapture.allowScreenCaptureAsync().catch((err) => {
      console.log('Screen capture allow error:', err);
    });
  }, []);

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="dark" />
    </AuthProvider>
  );
}