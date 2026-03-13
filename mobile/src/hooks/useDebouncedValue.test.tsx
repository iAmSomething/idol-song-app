import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { useDebouncedValue } from './useDebouncedValue';

type ProbeProps = {
  delayMs?: number;
  enabled?: boolean;
  value: string;
};

function DebounceProbe({ delayMs = 250, enabled = true, value }: ProbeProps) {
  const debouncedValue = useDebouncedValue(value, delayMs, {
    enabled,
    shouldFlush: (nextValue) => nextValue.trim().length === 0,
  });

  return <Text testID="debounced-value">{debouncedValue}</Text>;
}

function readValue(tree: renderer.ReactTestRenderer): string {
  return tree.root.findByProps({ testID: 'debounced-value' }).props.children;
}

async function renderProbe(props: ProbeProps) {
  let tree: renderer.ReactTestRenderer;

  await act(async () => {
    tree = renderer.create(<DebounceProbe {...props} />);
  });

  return tree!;
}

describe('useDebouncedValue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('returns the initial value immediately', async () => {
    const tree = await renderProbe({ value: '최예나' });

    expect(readValue(tree)).toBe('최예나');
  });

  test('delays non-empty updates while enabled', async () => {
    const tree = await renderProbe({ value: '최예나' });

    await act(async () => {
      tree.update(<DebounceProbe value="YENA" />);
    });

    expect(readValue(tree)).toBe('최예나');

    await act(async () => {
      jest.advanceTimersByTime(250);
    });

    expect(readValue(tree)).toBe('YENA');
  });

  test('flushes empty updates immediately', async () => {
    const tree = await renderProbe({ value: '최예나' });

    await act(async () => {
      tree.update(<DebounceProbe value="" />);
    });

    expect(readValue(tree)).toBe('');
  });

  test('updates immediately when disabled', async () => {
    const tree = await renderProbe({ value: '최예나', enabled: false });

    await act(async () => {
      tree.update(<DebounceProbe value="YENA" enabled={false} />);
    });

    expect(readValue(tree)).toBe('YENA');
  });

  test('stays stable when rerendered with the same value', async () => {
    const tree = await renderProbe({ value: '최예나' });

    await act(async () => {
      tree.update(<DebounceProbe value="최예나" />);
      tree.update(<DebounceProbe value="최예나" />);
    });

    expect(readValue(tree)).toBe('최예나');
  });
});
