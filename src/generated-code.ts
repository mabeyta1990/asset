export function debounce<T extends (...args: any[]) => any>(
  callback: T,
  wait: number,
  options?: {
    context?: any;
    immediate?: boolean;
  }
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hasBeenCalled = false;

  const debouncedFn = function (this: any, ...args: Parameters<T>): void {
    const callNow = options?.immediate && !hasBeenCalled;
    const context = options?.context ?? this;

    if (timer !== undefined) {
      clearTimeout(timer);
    }

    if (callNow) {
      callback.apply(context, args);
      hasBeenCalled = true;
    }

    timer = setTimeout(() => {
      if (!options?.immediate) {
        callback.apply(context, args);
      }
      timer = undefined;
      hasBeenCalled = false;
    }, wait);
  };

  debouncedFn.cancel = function (): void {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    hasBeenCalled = false;
  };

  return debouncedFn;
}