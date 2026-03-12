import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { StyleSheet, Text, View } from 'react-native';

import { InlineFeedbackNotice, ScreenFeedbackState } from './FeedbackState';

jest.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

function hasText(tree: renderer.ReactTestRenderer, value: string): boolean {
  return tree.root.findAllByType(Text).some((node) => node.props.children === value);
}

describe('shared feedback state components', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('renders a screen-level loading state with copy', async () => {
    let tree: renderer.ReactTestRenderer;

    jest.useFakeTimers();

    await act(async () => {
      tree = renderer.create(
        <ScreenFeedbackState
          body="데이터를 불러오는 중입니다."
          eyebrow="LOADING"
          loadingLayout="calendar"
          title="Calendar"
          variant="loading"
        />,
      );
    });

    await act(async () => {
      jest.advanceTimersByTime(180);
    });

    expect(hasText(tree!, 'LOADING')).toBe(true);
    expect(hasText(tree!, 'Calendar')).toBe(true);
    expect(hasText(tree!, '데이터를 불러오는 중입니다.')).toBe(true);
    expect(tree!.root.findByProps({ testID: 'loading-skeleton-calendar' })).toBeDefined();

    await act(async () => {
      tree!.unmount();
    });
  });

  test('renders an inline notice action and calls the handler', async () => {
    const onPress = jest.fn();
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <InlineFeedbackNotice
          action={{
            label: '다시 시도',
            onPress,
            testID: 'inline-feedback-action',
          }}
          body="검색 결과가 없습니다."
          title="검색 상태"
        />,
      );
    });

    expect(hasText(tree!, '검색 상태')).toBe(true);
    expect(hasText(tree!, '검색 결과가 없습니다.')).toBe(true);

    await act(async () => {
      tree!.root.findByProps({ testID: 'inline-feedback-action' }).props.onPress();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('keeps screen-level feedback aligned to the current scroll context', async () => {
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <ScreenFeedbackState
          body="팀 상세 데이터를 찾지 못했습니다."
          eyebrow="빈 상태"
          testID="screen-feedback"
          title="팀 상세"
          variant="empty"
        />,
      );
    });

    const container = tree!.root
      .findAllByType(View)
      .find((node) => node.props.testID === 'screen-feedback');
    expect(container).toBeDefined();
    if (!container) {
      throw new Error('screen-feedback container not found');
    }
    const flattenedStyle = StyleSheet.flatten(container.props.style);

    expect(flattenedStyle.justifyContent).toBe('flex-start');
    expect(flattenedStyle.paddingTop).toBeGreaterThan(0);
  });
});
