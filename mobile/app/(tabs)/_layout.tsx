import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useOptionalSafeAreaInsets } from '../../src/hooks/useOptionalSafeAreaInsets';
import { useAppTheme } from '../../src/tokens/theme';

export default function TabsLayout() {
  const theme = useAppTheme();
  const insets = useOptionalSafeAreaInsets();

  return (
    <Tabs
      initialRouteName="calendar"
      screenOptions={{
        headerShown: false,
        headerTitleAlign: 'center',
        sceneStyle: {
          backgroundColor: theme.colors.surface.base,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.surface.elevated,
          borderTopColor: theme.colors.border.subtle,
          height: 56 + insets.bottom,
          paddingTop: theme.space[8],
          paddingBottom: Math.max(insets.bottom, theme.space[8]),
        },
        tabBarActiveTintColor: theme.colors.text.brand,
        tabBarInactiveTintColor: theme.colors.text.tertiary,
        tabBarLabelStyle: {
          fontSize: theme.typography.meta.fontSize,
          fontWeight: theme.typography.meta.fontWeight,
          letterSpacing: theme.typography.meta.letterSpacing,
        },
      }}
    >
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              color={color}
              name={focused ? 'calendar-month' : 'calendar-month-outline'}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="radar"
        options={{
          title: 'Radar',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              color={color}
              name={focused ? 'radar' : 'radar'}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              color={color}
              name={focused ? 'magnify' : 'magnify'}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
