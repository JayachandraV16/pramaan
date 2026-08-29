import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../../context/AuthContext';

export default function TabsLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) {
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

  if (user.role !== 'INSTRUMENT_OWNER') {
    return <Redirect href="/" />;
  }

  return (
    <Tabs>
      {/* ================= DASHBOARD ================= */}

      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          headerShown: false,
        }}
      />

      {/* ================= INSTRUMENT OWNER ================= */}

      <Tabs.Screen
        name="instruments"
        options={{
          title: 'Instruments',
          href: undefined,
        }}
      />

      <Tabs.Screen
        name="applications"
        options={{
          title: 'Applications',
          href: undefined,
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="certificates"
        options={{
          title: 'Certificates',
          href: undefined,
          headerShown: false,
        }}
      />

      {/* ================= PROFILE ================= */}

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: false,
        }}
      />
    </Tabs>
  );
}