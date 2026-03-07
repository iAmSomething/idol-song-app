import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs initialRouteName="calendar" screenOptions={{ headerTitleAlign: 'center' }}>
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
        }}
      />
      <Tabs.Screen
        name="radar"
        options={{
          title: 'Radar',
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
        }}
      />
    </Tabs>
  );
}
