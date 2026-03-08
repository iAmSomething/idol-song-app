import renderer, { act } from 'react-test-renderer';

import RadarTabScreen from '../../app/(tabs)/radar';

jest.mock('expo-router', () => {
  const useLocalSearchParams = jest.fn(() => ({}));

  return {
    useRouter: () => ({
      push: jest.fn(),
      setParams: jest.fn(),
    }),
    useLocalSearchParams,
    __mock: {
      useLocalSearchParams,
    },
  };
});

const { __mock } = jest.requireMock('expo-router') as {
  __mock: {
    useLocalSearchParams: jest.Mock;
  };
};

async function renderRadarScreen() {
  let tree: renderer.ReactTestRenderer;

  await act(async () => {
    tree = renderer.create(<RadarTabScreen />);
    await Promise.resolve();
    await Promise.resolve();
  });

  return tree!;
}

describe('mobile radar tab', () => {
  beforeEach(() => {
    __mock.useLocalSearchParams.mockReturnValue({});
  });

  test('renders radar sections from shared selector data', async () => {
    const tree = await renderRadarScreen();

    expect(tree.root.findByProps({ testID: 'radar-featured-card' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-featured-card' }).props.accessibilityLabel).toContain('YENA');
    expect(tree.root.findByProps({ testID: 'radar-weekly-card-yena' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-long-gap-card-weeekly' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-rookie-card-atheart' })).toBeDefined();
  });

  test('restores the hide-empty toggle state from route params', async () => {
    __mock.useLocalSearchParams.mockReturnValue({ hideEmpty: '1' });
    const tree = await renderRadarScreen();

    expect(tree.root.findByProps({ testID: 'radar-filter-button' }).props.accessibilityState.selected).toBe(
      true,
    );
  });

  test('hides empty sections when the filter toggle is active', async () => {
    const tree = await renderRadarScreen();

    await act(async () => {
      tree.root.findByProps({ testID: 'radar-filter-button' }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'radar-featured-card' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-long-gap-card-weeekly' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-rookie-card-atheart' })).toBeDefined();
  });
});
