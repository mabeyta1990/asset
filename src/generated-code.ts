/**
 * A generic Least Recently Used (LRU) cache implementation.
 * When the cache exceeds its capacity, the least recently used item is evicted.
 *
 * @typeParam K - The type of the keys stored in the cache.
 * @typeParam V - The type of the values stored in the cache.
 */
export class LRUCache<K, V> {
    private capacity: number;
    private cache: Map<K, V>;

    /**
     * Creates a new LRUCache instance.
     *
     * @param capacity - The maximum number of items the cache can hold. Must be greater than 0.
     * @throws Error if capacity is not greater than 0.
     */
    constructor(capacity: number) {
        if (capacity <= 0) {
            throw new Error("Capacity must be greater than 0.");
        }
        this.capacity = capacity;
        this.cache = new Map<K, V>();
    }

    /**
     * Retrieves the value associated with the given key, marking it as the most recently used.
     *
     * @param key - The key whose value to retrieve.
     * @returns The value associated with the key, or undefined if the key is not present.
     */
    public get(key: K): V | undefined {
        if (!this.cache.has(key)) {
            return undefined;
        }
        const value = this.cache.get(key) as V;
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    /**
     * Inserts or updates the value for a given key, marking it as the most recently used.
     * If inserting causes the cache to exceed its capacity, the least recently used item is evicted.
     *
     * @param key - The key to insert or update.
     * @param value - The value to associate with the key.
     */
    public set(key: K, value: V): void {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        this.cache.set(key, value);
        if (this.cache.size > this.capacity) {
            const lruKey = this.cache.keys().next().value as K;
            this.cache.delete(lruKey);
        }
    }

    /**
     * Returns the current number of items stored in the cache.
     *
     * @returns The current cache size.
     */
    public size(): number {
        return this.cache.size;
    }

    /**
     * Removes all items from the cache.
     */
    public clear(): void {
        this.cache.clear();
    }
}