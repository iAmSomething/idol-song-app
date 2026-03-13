import React from 'react';
import * as ReactNative from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { SummaryStrip } from './SummaryStrip';
import { MOBILE_TEXT_SCALE_LIMITS } from '../../tokens/accessibility';

const mockUseWindowDimensions = jest.spyOn(ReactNative, 'useWindowDimensions');

describe('SummaryStrip', () => {
  beforeEach(() => {
    mockUseWindowDimensions.mockReturnValue({
      fontScale: 1,
      height: 844,
      scale: 3,
      width: 390,
    });
  });

  afterEach(() => {
    mockUseWindowDimensions.mockReset();
  });

  test('uses full-width cards in wrap layout when large-text mode is active', () => {
    mockUseWindowDimensions.mockReturnValue({
      fontScale: 1.7,
      height: 844,
      scale: 3,
      width: 430,
    });

    let tree: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(
        <SummaryStrip
          items={[
            { key: 'release-count', label: '이번 달 발매', value: 2 },
            { key: 'upcoming-count', label: '예정 컴백', value: 3 },
          ]}
          layout="wrap"
          testID="summary"
        />,
      );
    });

    const firstCard = tree!.root.findByProps({ testID: 'summary-item-release-count' });
    const [valueText, labelText] = firstCard.findAllByType(Text);

    expect(firstCard.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ flexBasis: '100%' })]),
    );
    expect(valueText.props.maxFontSizeMultiplier).toBe(MOBILE_TEXT_SCALE_LIMITS.summaryValue);
    expect(labelText.props.maxFontSizeMultiplier).toBe(MOBILE_TEXT_SCALE_LIMITS.summaryLabel);
  });

  test('renders detail text without collapsing the primary value into a single truncated line', () => {
    let tree: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(
        <SummaryStrip
          items={[
            {
              kind: 'focus',
              key: 'nearest-upcoming',
              label: '가까운 일정',
              value: 'BTS',
              detail: '3월 20일',
            },
          ]}
          layout="wrap"
          testID="summary"
        />,
      );
    });

    const texts = tree!.root.findAllByType(Text).map((node) => node.props.children);
    const card = tree!.root.findByProps({ testID: 'summary-item-nearest-upcoming' });

    expect(card.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ flexBasis: '100%' })]),
    );
    expect(texts).toContain('BTS');
    expect(texts).toContain('3월 20일');
    expect(texts).toContain('가까운 일정');
  });
});
