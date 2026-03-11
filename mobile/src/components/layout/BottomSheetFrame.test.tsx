import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Platform, Text } from 'react-native';

import { BottomSheetFrame } from './BottomSheetFrame';

const mockUseReducedMotion = jest.fn(() => false);

jest.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    __esModule: true,
    default: ({
      animationType,
      children,
      navigationBarTranslucent,
      statusBarTranslucent,
      visible,
    }: {
      animationType?: string;
      children?: React.ReactNode;
      navigationBarTranslucent?: boolean;
      statusBarTranslucent?: boolean;
      visible?: boolean;
    }) =>
      visible
        ? React.createElement(
            'modal-host',
            { animationType, navigationBarTranslucent, statusBarTranslucent, visible },
            children,
          )
        : null,
  };
});

describe('BottomSheetFrame', () => {
  afterEach(() => {
    mockUseReducedMotion.mockReset();
    mockUseReducedMotion.mockReturnValue(false);
  });

  test('renders the modal frame with accessibility metadata and dismiss affordances', async () => {
    const onClose = jest.fn();
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <BottomSheetFrame
          backdropTestID="bottom-sheet-backdrop"
          closeButtonTestID="bottom-sheet-close"
          isOpen
          onClose={onClose}
          sheetTestID="bottom-sheet"
          summary="임시 상태를 유지합니다."
          title="공통 시트"
        >
          <Text>시트 내용</Text>
        </BottomSheetFrame>,
      );
    });

    expect(tree!.root.findByProps({ testID: 'bottom-sheet' }).props.accessibilityViewIsModal).toBe(true);
    expect(tree!.root.findByProps({ testID: 'bottom-sheet-backdrop' })).toBeDefined();
    expect(tree!.root.findByType('modal-host' as any).props.animationType).toBe('slide');
    expect(tree!.root.findByType('modal-host' as any).props.statusBarTranslucent).toBe(Platform.OS === 'android');
    expect(tree!.root.findByType('modal-host' as any).props.navigationBarTranslucent).toBe(Platform.OS === 'android');

    await act(async () => {
      tree!.root.findByProps({ testID: 'bottom-sheet-close' }).props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      tree!.update(
        <BottomSheetFrame
          backdropTestID="bottom-sheet-backdrop"
          closeButtonTestID="bottom-sheet-close"
          isOpen={false}
          onClose={onClose}
          sheetTestID="bottom-sheet"
          title="공통 시트"
        >
          <Text>시트 내용</Text>
        </BottomSheetFrame>,
      );
    });

    expect(tree!.root.findAllByProps({ testID: 'bottom-sheet' })).toHaveLength(0);
  });

  test('falls back to fade animation when reduced motion is enabled', async () => {
    mockUseReducedMotion.mockReturnValue(true);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <BottomSheetFrame isOpen onClose={jest.fn()} sheetTestID="bottom-sheet" title="공통 시트">
          <Text>시트 내용</Text>
        </BottomSheetFrame>,
      );
    });

    expect(tree!.root.findByType('modal-host' as any).props.animationType).toBe('fade');
  });
});
