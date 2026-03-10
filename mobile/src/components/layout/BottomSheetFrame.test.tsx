import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { BottomSheetFrame } from './BottomSheetFrame';

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    __esModule: true,
    default: ({ children, visible }: { children?: React.ReactNode; visible?: boolean }) =>
      visible ? React.createElement(React.Fragment, null, children) : null,
  };
});

describe('BottomSheetFrame', () => {
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
});
