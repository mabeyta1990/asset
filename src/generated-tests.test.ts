import { describe, it, expect } from 'vitest';
import { LRUCache } from './generated-code';

describe('LRUCache', () => {
  describe('constructor', () => {
    it('creates a cache with valid capacity', () => {
      const cache = new LRUCache<string, number>(3);
      expect(cache.size()).toBe(0);
    });

    it('throws when capacity is 0', () => {
      expect(() => new LRUCache<string, number>(0)).toThrow();
    });

    it('throws when capacity is negative', () => {
      expect(() => new LRUCache<string, number>(-1)).toThrow();
    });
  });

  describe('get and set', () => {
    it('returns undefined for missing keys', () => {
      const cache = new LRUCache<string, number>(2);
      expect(cache.get('missing')).toBeUndefined();
    });

    it('stores and retrieves values', () => {
      const cache = new LRUCache<string, number>(2);
      cache.set('a', 1);
      expect(cache.get('a')).toBe(1);
    });

    it('updates existing key', () => {
      const cache = new LRUCache<string, number>(2);
      cache.set('a', 1);
      cache.set('a', 2);
      expect(cache.get('a')).toBe(2);
      expect(cache.size()).toBe(1);
    });

    it('handles different value types', () => {
      const cache = new LRUCache<string, object>(2);
      const obj = { foo: 'bar' };
      cache.set('a', obj);
      expect(cache.get('a')).toBe(obj);
    });

    it('handles different key types', () => {
      const cache = new LRUCache<number, string>(2);
      cache.set(1, 'one');
      cache.set(2, 'two');
      expect(cache.get(1)).toBe('one');
      expect(cache.get(2)).toBe('two');
    });
  });

  describe('LRU eviction', () => {
    it('evicts least recently used item when capacity exceeded', () => {
      const cache = new LRUCache<string, number>(2);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
    });

    it('marks accessed item as most recently used via get', () => {
      const cache = new LRUCache<string, number>(2);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.get('a'); // 'a' becomes most recently used
      cache.set('c', 3); // should evict 'b'
      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBe(3);
    });

    it('marks updated item as most recently used via set', () => {
      const cache = new LRUCache<string, number>(2);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('a', 10); // 'a' becomes most recently used
      cache.set('c', 3); // should evict 'b'
      expect(cache.get('a')).toBe(10);
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBe(3);
    });

    it('respects capacity of 1', () => {
      const cache = new LRUCache<string, number>(1);
      cache.set('a', 1);
      cache.set('b', 2);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
      expect(cache.size()).toBe(1);
    });

    it('handles a chain of evictions', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4); // evict 'a'
      cache.set('e', 5); // evict 'b'
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
      expect(cache.get('e')).toBe(5);
    });
  });

  describe('size', () => {
    it('returns 0 for empty cache', () => {
      const cache = new LRUCache<string, number>(3);
      expect(cache.size()).toBe(0);
    });

    it('reflects number of items', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('a', 1);
      expect(cache.size()).toBe(1);
      cache.set('b', 2);
      expect(cache.size()).toBe(2);
    });

    it('does not exceed capacity', () => {
      const cache = new LRUCache<string, number>(2);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      expect(cache.size()).toBe(2);
    });
  });

  describe('clear', () => {
    it('removes all items', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBeUndefined();
    });

    it('allows insertion after clear', () => {
      const cache = new LRUCache<string, number>(2);
      cache.set('a', 1);
      cache.clear();
      cache.set('b', 2);
      expect(cache.get('b')).toBe(2);
      expect(cache.size()).toBe(1);
    });
  });
});