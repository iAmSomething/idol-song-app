import React, { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colorTokens, type MobileColorTokens } from './colors';
import { elevationTokens, type ElevationTokens } from './elevation';
import { motionTokens, type MotionTokens } from './motion';
import { radiusTokens, type RadiusTokens } from './radii';
import { sizeTokens, type SizeTokens } from './sizes';
import { spaceScale, type SpaceScale } from './spacing';
import { typographyTokens, type TypographyTokens } from './typography';

export type ThemeScheme = 'light' | 'dark';

export type MobileTheme = {
  scheme: ThemeScheme;
  colors: MobileColorTokens;
  space: SpaceScale;
  radius: RadiusTokens;
  typography: TypographyTokens;
  size: SizeTokens;
  elevation: ElevationTokens;
  motion: MotionTokens;
};

function createTheme(scheme: ThemeScheme): MobileTheme {
  return {
    scheme,
    colors: colorTokens[scheme],
    space: spaceScale,
    radius: radiusTokens,
    typography: typographyTokens,
    size: sizeTokens,
    elevation: elevationTokens,
    motion: motionTokens,
  };
}

export function resolveThemeScheme(colorScheme: string | null | undefined): ThemeScheme {
  return colorScheme === 'dark' ? 'dark' : 'light';
}

const defaultTheme = createTheme('light');

const ThemeContext = createContext<MobileTheme>(defaultTheme);

export type MobileThemeProviderProps = PropsWithChildren<{
  schemeOverride?: ThemeScheme;
}>;

export function MobileThemeProvider({ children, schemeOverride }: MobileThemeProviderProps) {
  const deviceColorScheme = useColorScheme();
  const scheme = schemeOverride ?? resolveThemeScheme(deviceColorScheme);
  const value = useMemo(() => createTheme(scheme), [scheme]);

  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    </SafeAreaProvider>
  );
}

export function useAppTheme(): MobileTheme {
  return useContext(ThemeContext);
}

export const mobileThemes = {
  light: createTheme('light'),
  dark: createTheme('dark'),
} as const;
