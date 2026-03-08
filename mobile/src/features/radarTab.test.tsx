import renderer, { act } from 'react-test-renderer';

import RadarTabScreen from '../../app/(tabs)/radar';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

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
  test('renders radar sections from shared selector data', async () => {
    const tree = await renderRadarScreen();

    expect(tree.root.findByProps({ testID: 'radar-featured-card' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-weekly-card-yena' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-long-gap-card-weeekly' })).toBeDefined();
    expect(tree.root.findByProps({ testID: 'radar-rookie-card-atheart' })).toBeDefined();
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
