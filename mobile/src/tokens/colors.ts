export type SurfaceColorTokens = {
  base: string;
  elevated: string;
  subtle: string;
  overlay: string;
  interactive: string;
};

export type TextColorTokens = {
  primary: string;
  secondary: string;
  tertiary: string;
  inverse: string;
  brand: string;
  danger: string;
};

export type BorderColorTokens = {
  default: string;
  subtle: string;
  strong: string;
  focus: string;
};

export type StatusColorToken = {
  bg: string;
  text: string;
};

export type StatusColorTokens = {
  scheduled: StatusColorToken;
  confirmed: StatusColorToken;
  rumor: StatusColorToken;
  title: StatusColorToken;
};

export type ServiceColorToken = {
  bg: string;
  icon: string;
};

export type ServiceColorTokens = {
  spotify: ServiceColorToken;
  youtubeMusic: ServiceColorToken;
  youtubeMv: ServiceColorToken;
};

export type MobileColorTokens = {
  surface: SurfaceColorTokens;
  text: TextColorTokens;
  border: BorderColorTokens;
  status: StatusColorTokens;
  service: ServiceColorTokens;
};

const lightColors: MobileColorTokens = {
  surface: {
    base: '#F6F3EE',
    elevated: '#FFFCF7',
    subtle: '#EDE6DB',
    overlay: 'rgba(25, 22, 17, 0.54)',
    interactive: '#F2E8DA',
  },
  text: {
    primary: '#241F18',
    secondary: '#5E5549',
    tertiary: '#8A7F72',
    inverse: '#FFFCF7',
    brand: '#B55A32',
    danger: '#B63C36',
  },
  border: {
    default: '#D6CAB7',
    subtle: '#E7DDD0',
    strong: '#B4A489',
    focus: '#B55A32',
  },
  status: {
    scheduled: {
      bg: '#DCEFD8',
      text: '#2D6540',
    },
    confirmed: {
      bg: '#D8E6F6',
      text: '#1F4F84',
    },
    rumor: {
      bg: '#F6E8C8',
      text: '#8A5A12',
    },
    title: {
      bg: '#F4DDD4',
      text: '#9C4528',
    },
  },
  service: {
    spotify: {
      bg: '#DDF6E6',
      icon: '#14833B',
    },
    youtubeMusic: {
      bg: '#FDE2E6',
      icon: '#C2185B',
    },
    youtubeMv: {
      bg: '#FDE0DE',
      icon: '#C62828',
    },
  },
};

const darkColors: MobileColorTokens = {
  surface: {
    base: '#171411',
    elevated: '#211B16',
    subtle: '#2B241D',
    overlay: 'rgba(0, 0, 0, 0.64)',
    interactive: '#312820',
  },
  text: {
    primary: '#FAF4EC',
    secondary: '#D0C4B5',
    tertiary: '#A99B8A',
    inverse: '#171411',
    brand: '#F0A57C',
    danger: '#F08A7F',
  },
  border: {
    default: '#514536',
    subtle: '#3B3228',
    strong: '#6C5A46',
    focus: '#F0A57C',
  },
  status: {
    scheduled: {
      bg: '#223B2D',
      text: '#B5E2C4',
    },
    confirmed: {
      bg: '#213246',
      text: '#BCD9F8',
    },
    rumor: {
      bg: '#46361C',
      text: '#F0D08E',
    },
    title: {
      bg: '#46271F',
      text: '#F6C0AD',
    },
  },
  service: {
    spotify: {
      bg: '#183A25',
      icon: '#71D68A',
    },
    youtubeMusic: {
      bg: '#4C1930',
      icon: '#FF82B4',
    },
    youtubeMv: {
      bg: '#4A1917',
      icon: '#FF8D86',
    },
  },
};

export const colorTokens = {
  light: lightColors,
  dark: darkColors,
} as const;
