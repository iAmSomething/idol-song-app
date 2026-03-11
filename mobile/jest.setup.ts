import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

// Register shared native mocks once so service/config tests can stay focused on
// app behavior instead of per-file native module setup.
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
jest.mock('expo-notifications', () => {
  const receivedListener = {
    remove: jest.fn(),
  };
  const responseListener = {
    remove: jest.fn(),
  };

  return {
    AndroidImportance: {
      DEFAULT: 3,
    },
    IosAuthorizationStatus: {
      PROVISIONAL: 3,
    },
    addNotificationReceivedListener: jest.fn(() => receivedListener),
    addNotificationResponseReceivedListener: jest.fn(() => responseListener),
    clearLastNotificationResponseAsync: jest.fn(async () => undefined),
    getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test-token]' })),
    getLastNotificationResponseAsync: jest.fn(async () => null),
    getPermissionsAsync: jest.fn(async () => ({
      granted: false,
      canAskAgain: true,
      ios: {
        status: 0,
      },
    })),
    requestPermissionsAsync: jest.fn(async () => ({
      granted: true,
      canAskAgain: true,
      ios: {
        status: 3,
      },
    })),
    setNotificationChannelAsync: jest.fn(async () => undefined),
    setNotificationHandler: jest.fn(),
  };
});
