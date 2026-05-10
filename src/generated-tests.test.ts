import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { debounce } from './generated-code';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should delay function execution', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn();
    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledOnce();
  });

  it('should reset timer on subsequent calls', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn();
    vi.advanceTimersByTime(50);
    debouncedFn();
    vi.advanceTimersByTime(50);
    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledOnce();
  });

  it('should pass arguments to the callback', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn('arg1', 'arg2', 42);
    vi.advanceTimersByTime(100);

    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 42);
  });

  it('should use last call arguments when debounce fires', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn('first');
    vi.advanceTimersByTime(50);
    debouncedFn('second');
    vi.advanceTimersByTime(100);

    expect(mockFn).toHaveBeenCalledWith('second');
  });

  it('should support immediate option', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100, { immediate: true });

    debouncedFn('arg1');
    expect(mockFn).toHaveBeenCalledWith('arg1');
    expect(mockFn).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledOnce();
  });

  it('should not call immediately on second invocation with immediate option', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100, { immediate: true });

    debouncedFn('first');
    expect(mockFn).toHaveBeenCalledWith('first');

    vi.advanceTimersByTime(50);
    debouncedFn('second');
    expect(mockFn).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledOnce();
  });

  it('should allow immediate call again after timer completes', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100, { immediate: true });

    debouncedFn('first');
    expect(mockFn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);

    debouncedFn('second');
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenLastCalledWith('second');
  });

  it('should support custom context option', () => {
    const mockFn = vi.fn(function (this: any) {
      return this.value;
    });
    const context = { value: 42 };
    const debouncedFn = debounce(mockFn, 100, { context });

    debouncedFn();
    vi.advanceTimersByTime(100);

    expect(mockFn).toHaveBeenCalledOnce();
  });

  it('should use default context (this) when context option is not provided', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);
    const obj = { method: debouncedFn };

    obj.method('test');
    vi.advanceTimersByTime(100);

    expect(mockFn).toHaveBeenCalledWith('test');
  });

  it('should have a cancel method', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn();
    debouncedFn.cancel();
    vi.advanceTimersByTime(100);

    expect(mockFn).not.toHaveBeenCalled();
  });

  it('should allow calling debounced function after cancel', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    debouncedFn('first');
    debouncedFn.cancel();

    debouncedFn('second');
    vi.advanceTimersByTime(100);

    expect(mockFn).toHaveBeenCalledOnce();
    expect(mockFn).toHaveBeenCalledWith('second');
  });

  it('should reset hasBeenCalled flag on cancel', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100, { immediate: true });

    debouncedFn('first');
    expect(mockFn).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(50);
    debouncedFn.cancel();

    debouncedFn('second');
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenLastCalledWith('second');
  });

  it('should handle multiple rapid calls', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100);

    for (let i = 0; i < 5; i++) {
      debouncedFn(i);
      vi.advanceTimersByTime(30);
    }

    expect(mockFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledOnce();
    expect(mockFn).toHaveBeenCalledWith(4);
  });

  it('should work with zero delay', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 0);

    debouncedFn('test');
    vi.advanceTimersByTime(0);

    expect(mockFn).toHaveBeenCalledWith('test');
  });

  it('should handle immediate and context options together', () => {
    const mockFn = vi.fn(function (this: any) {
      return this.value;
    });
    const context = { value: 100 };
    const debouncedFn = debounce(mockFn, 100, { immediate: true, context });

    debouncedFn('arg');
    expect(mockFn).toHaveBeenCalledWith('arg');

    vi.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledOnce();
  });

  it('should not call callback on cancel if immediate and not yet fired', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 100, { immediate: true });

    vi.advanceTimersByTime(50);
    debouncedFn('first');
    expect(mockFn).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(50);
    debouncedFn.cancel();

    expect(mockFn).toHaveBeenCalledOnce();
  });

  it('should be callable as a function with proper types', () => {
    const mockFn = vi.fn((a: number, b: string) => a.toString() + b);
    const debouncedFn = debounce(mockFn, 50);

    debouncedFn(5, 'test');
    vi.advanceTimersByTime(50);

    expect(mockFn).toHaveBeenCalledWith(5, 'test');
  });
});