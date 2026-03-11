import { colorTokens } from './colors';

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function toLinearChannel(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * toLinearChannel(r) +
    0.7152 * toLinearChannel(g) +
    0.0722 * toLinearChannel(b)
  );
}

function contrastRatio(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe('dark mode contrast QA', () => {
  test.each([
    ['light', colorTokens.light],
    ['dark', colorTokens.dark],
  ] as const)('%s semantic text colors preserve minimum readable contrast', (_scheme, tokens) => {
    expect(contrastRatio(tokens.text.primary, tokens.surface.base)).toBeGreaterThanOrEqual(14);
    expect(contrastRatio(tokens.text.secondary, tokens.surface.base)).toBeGreaterThanOrEqual(6);
    expect(contrastRatio(tokens.text.tertiary, tokens.surface.base)).toBeGreaterThanOrEqual(3.5);
    expect(contrastRatio(tokens.text.brand, tokens.surface.base)).toBeGreaterThanOrEqual(4);
  });

  test.each([
    ['light', colorTokens.light],
    ['dark', colorTokens.dark],
  ] as const)('%s status chips keep AA contrast for text over background', (_scheme, tokens) => {
    expect(contrastRatio(tokens.status.scheduled.text, tokens.status.scheduled.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.status.confirmed.text, tokens.status.confirmed.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.status.rumor.text, tokens.status.rumor.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.status.title.text, tokens.status.title.bg)).toBeGreaterThanOrEqual(4.5);
  });

  test.each([
    ['light', colorTokens.light],
    ['dark', colorTokens.dark],
  ] as const)('%s service buttons keep readable label contrast', (_scheme, tokens) => {
    expect(contrastRatio(tokens.service.spotify.icon, tokens.service.spotify.bg)).toBeGreaterThanOrEqual(4.2);
    expect(contrastRatio(tokens.service.youtubeMusic.icon, tokens.service.youtubeMusic.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens.service.youtubeMv.icon, tokens.service.youtubeMv.bg)).toBeGreaterThanOrEqual(4.5);
  });
});
