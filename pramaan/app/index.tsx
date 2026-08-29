import { Redirect } from 'expo-router';
import {
  ActivityIndicator,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';

export default function Index() {
  const { token, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!token || !user) {
    return <Redirect href="/auth/login" />;
  }

  if (
    user.role === 'LMO' ||
    user.role === 'GATC'
  ) {
    return <Redirect href="/inspector" />;
  }

  if (user.role === 'ADMIN') {
    return <Redirect href="/admin" />;
  }

  return <Redirect href="/auth/login" />;
}