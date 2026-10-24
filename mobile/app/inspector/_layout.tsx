import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { OfflineProvider } from '../../services/offline/OfflineContext';

export default function InspectorLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  if (user.role !== 'LMO' && user.role !== 'GATC') {
    return <Redirect href="/" />;
  }

  return (
    <OfflineProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </OfflineProvider>
  );
}