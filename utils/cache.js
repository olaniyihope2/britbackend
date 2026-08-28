import redis from '../config/redis.js';

// Save data to cache
export async function setCache(key, data, ttlSeconds = 60) {
  await redis.setex(key, ttlSeconds, JSON.stringify(data));
}

// Get data from cache
export async function getCache(key) {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

// Delete cache when data changes
export async function deleteCache(key) {
  await redis.del(key);
}