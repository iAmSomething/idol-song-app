export const MOBILE_TEXT_SCALE_LIMITS = {
  screenTitle: 1.2,
  sectionTitle: 1.15,
  body: 1.1,
  meta: 1.08,
  buttonPrimary: 1.12,
  buttonService: 1.08,
  summaryValue: 1.15,
  summaryLabel: 1.08,
} as const;

export function isLargeTextMode(fontScale: number): boolean {
  return fontScale >= 1.3;
}
