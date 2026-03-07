export type TypographyToken = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700';
  letterSpacing?: number;
};

export type TypographyTokens = {
  screenTitle: TypographyToken;
  sectionTitle: TypographyToken;
  cardTitle: TypographyToken;
  body: TypographyToken;
  meta: TypographyToken;
  chip: TypographyToken;
  buttonPrimary: TypographyToken;
  buttonService: TypographyToken;
};

const baseFontFamily = 'System';

export const typographyTokens: TypographyTokens = {
  screenTitle: {
    fontFamily: baseFontFamily,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  sectionTitle: {
    fontFamily: baseFontFamily,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardTitle: {
    fontFamily: baseFontFamily,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  body: {
    fontFamily: baseFontFamily,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  meta: {
    fontFamily: baseFontFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  chip: {
    fontFamily: baseFontFamily,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  buttonPrimary: {
    fontFamily: baseFontFamily,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
  },
  buttonService: {
    fontFamily: baseFontFamily,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
};
