import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { MobileThemeProvider, mobileThemes, resolveThemeScheme, useAppTheme } from './theme';

type ProbeHostProps = {
  scheme: string;
  surfaceBase: string;
  screenTitleSize: number;
  chipRadius: number;
  primaryButtonHeight: number;
  pressFast: number;
};

function ProbeHost(_props: ProbeHostProps) {
  return null;
}

function ThemeProbe() {
  const theme = useAppTheme();

  return (
    <ProbeHost
      scheme={theme.scheme}
      surfaceBase={theme.colors.surface.base}
      screenTitleSize={theme.typography.screenTitle.fontSize}
      chipRadius={theme.radius.chip}
      primaryButtonHeight={theme.size.button.heightPrimary}
      pressFast={theme.motion.pressFast}
    />
  );
}

describe('mobile theme scaffold', () => {
  test('exposes semantic token groups for light and dark themes', () => {
    expect(mobileThemes.light.colors.surface.base).toBeDefined();
    expect(mobileThemes.light.colors.service.spotify.bg).toBeDefined();
    expect(mobileThemes.light.typography.screenTitle.fontSize).toBeGreaterThan(0);
    expect(mobileThemes.dark.colors.text.primary).toBeDefined();
    expect(mobileThemes.dark.elevation.sheet.elevation).toBeGreaterThan(0);
  });

  test('normalizes unsupported device schemes to light', () => {
    expect(resolveThemeScheme('dark')).toBe('dark');
    expect(resolveThemeScheme('light')).toBe('light');
    expect(resolveThemeScheme(null)).toBe('light');
    expect(resolveThemeScheme('high-contrast')).toBe('light');
  });

  test('provides the requested theme through the provider hook', () => {
    let tree: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(
        <MobileThemeProvider schemeOverride="dark">
          <ThemeProbe />
        </MobileThemeProvider>,
      );
    });

    const probe = tree!.root.findByType(ProbeHost);
    expect(probe.props.scheme).toBe('dark');
    expect(probe.props.surfaceBase).toBe(mobileThemes.dark.colors.surface.base);
    expect(probe.props.screenTitleSize).toBe(mobileThemes.dark.typography.screenTitle.fontSize);
    expect(probe.props.chipRadius).toBe(mobileThemes.dark.radius.chip);
    expect(probe.props.primaryButtonHeight).toBe(mobileThemes.dark.size.button.heightPrimary);
    expect(probe.props.pressFast).toBe(mobileThemes.dark.motion.pressFast);
  });
});
