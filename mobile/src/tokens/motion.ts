export type MotionTokens = {
  pressFast: number;
  pressResponsive: number;
  fadeStandard: number;
  loadingPulse: number;
  loadingDelay: number;
  sheetOpen: number;
  navigationPush: number;
  launchEnter: number;
  launchHold: number;
  launchExit: number;
};

export const motionTokens: MotionTokens = {
  pressFast: 90,
  pressResponsive: 140,
  fadeStandard: 180,
  loadingPulse: 860,
  loadingDelay: 140,
  sheetOpen: 240,
  navigationPush: 260,
  launchEnter: 220,
  launchHold: 280,
  launchExit: 180,
};
