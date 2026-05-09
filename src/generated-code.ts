// src/add.ts
/**
 * Adds two numbers together and returns their sum.
 *
 * @param a - The first number to add.
 * @param b - The second number to add.
 * @returns The sum of `a` and `b`.
 */
export function add(a: number, b: number): number {
  return a + b;
}

// src/add.test.ts
import { describe, it, expect } from 'vitest';
import { add } from './add';

describe('add', () => {
  it('adds two positive numbers', () => {
    expect(add(5, 10)).toBe(15);
  });

  it('adds two negative numbers', () => {
    expect(add(-5, -10)).toBe(-15);
  });

  it('adds a positive and a negative number', () => {
    expect(add(10, -5)).toBe(5);
  });

  it('adds zero to zero', () => {
    expect(add(0, 0)).toBe(0);
  });

  it('adds two floating-point numbers', () => {
    expect(add(1.5, 2.5)).toBe(4.0);
  });
});