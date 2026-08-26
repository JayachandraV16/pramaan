import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="applications"
        options={{
          title: 'Applications',
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="certificates"
        options={{
          title: 'Certificates',
          headerShown: false,
        }}
      />

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