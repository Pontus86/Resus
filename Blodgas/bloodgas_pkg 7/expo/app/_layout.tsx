import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { theme } from '@/constants/theme';

function Icon({ label, color }: { label: string; color: string }) {
  return <Text style={{ fontSize: 18, color }}>{label}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.red,
        tabBarInactiveTintColor: theme.muted,
        headerStyle: { backgroundColor: theme.red },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
        tabBarStyle: { borderTopColor: theme.line },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Analys', tabBarIcon: ({ color }) => <Icon label="🩸" color={color} /> }} />
      <Tabs.Screen name="trend" options={{ title: 'Trend', tabBarIcon: ({ color }) => <Icon label="📈" color={color} /> }} />
      <Tabs.Screen name="reference" options={{ title: 'Överväg', tabBarIcon: ({ color }) => <Icon label="📖" color={color} /> }} />
      <Tabs.Screen name="scan" options={{ title: 'Skanna', tabBarIcon: ({ color }) => <Icon label="📷" color={color} /> }} />
      <Tabs.Screen name="method" options={{ title: 'Metod', tabBarIcon: ({ color }) => <Icon label="∑" color={color} /> }} />
      <Tabs.Screen name="about" options={{ title: 'Om', tabBarIcon: ({ color }) => <Icon label="👤" color={color} /> }} />
    </Tabs>
  );
}
