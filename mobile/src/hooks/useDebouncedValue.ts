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

  React.useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      setDebouncedValue(value);
      return undefined;
    }

    if (!enabled || shouldFlush?.(value)) {
      setDebouncedValue(value);
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [delayMs, enabled, shouldFlush, value]);

  return debouncedValue;
}
