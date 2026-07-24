// Worker has been removed — BullMQ/Redis is no longer used.
// The conversion queue is now handled in-process by index.ts
// using a simple Node.js in-memory queue (setImmediate + async loop).
//
// This eliminates the Redis "allkeys-lru" eviction policy issue
// that was causing jobs to be silently dropped on Render free tier.
export {};
