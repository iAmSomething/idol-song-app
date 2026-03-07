export type ElevationToken = {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: {
    width: number;
    height: number;
  };
  elevation: number;
};

export type ElevationTokens = {
  card: ElevationToken;
  cardProminent: ElevationToken;
  sheet: ElevationToken;
  floating: ElevationToken;
};

const baseShadowColor = '#000000';

export const elevationTokens: ElevationTokens = {
  card: {
    shadowColor: baseShadowColor,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 2,
  },
  cardProminent: {
    shadowColor: baseShadowColor,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 4,
  },
  sheet: {
    shadowColor: baseShadowColor,
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: -2,
    },
    elevation: 8,
  },
  floating: {
    shadowColor: baseShadowColor,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 6,
  },
};
