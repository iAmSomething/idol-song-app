import React from 'react';

type UseDebouncedValueOptions<T> = {
  enabled?: boolean;
  shouldFlush?: (value: T) => boolean;
};

export function useDebouncedValue<T>(
  value: T,
  delayMs: number,
  options: UseDebouncedValueOptions<T> = {},
): T {
  const { enabled = true, shouldFlush } = options;
  const [debouncedValue, setDebouncedValue] = React.useState(value);
  const isFirstRenderRef = React.useRef(true);
  const shouldFlushRef = React.useRef(shouldFlush);

  React.useEffect(() => {
    shouldFlushRef.current = shouldFlush;
  }, [shouldFlush]);

  const assignDebouncedValue = React.useCallback((nextValue: T) => {
    setDebouncedValue((currentValue) => (
      Object.is(currentValue, nextValue) ? currentValue : nextValue
    ));
  }, []);

  React.useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      assignDebouncedValue(value);
      return undefined;
    }

    if (!enabled || shouldFlushRef.current?.(value)) {
      assignDebouncedValue(value);
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      assignDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [assignDebouncedValue, delayMs, enabled, value]);

  return debouncedValue;
}
