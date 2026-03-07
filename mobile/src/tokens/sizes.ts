export type SizeTokens = {
  icon: {
    tab: number;
    meta: number;
    service: number;
  };
  button: {
    heightPrimary: number;
    heightSecondary: number;
    heightService: number;
  };
  row: {
    minHeight: number;
  };
};

export const sizeTokens: SizeTokens = {
  icon: {
    tab: 22,
    meta: 16,
    service: 18,
  },
  button: {
    heightPrimary: 52,
    heightSecondary: 44,
    heightService: 40,
  },
  row: {
    minHeight: 56,
  },
};
