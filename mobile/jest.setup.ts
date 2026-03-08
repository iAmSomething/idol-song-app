import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

// Register shared native mocks once so service/config tests can stay focused on
// app behavior instead of per-file native module setup.
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);
