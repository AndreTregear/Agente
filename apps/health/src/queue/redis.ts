import IORedis from "ioredis";
import { REDIS_URL } from "../config.js";
import { logger } from "../shared/logger.js";

let redis: any = null;

export function getRedis(): any {
  if (!redis) {
    const RedisConstructor = (IORedis as any).default || IORedis;
    redis = new RedisConstructor(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    redis.on("error", (err: Error) => {
      logger.error(err, "Redis connection error");
    });
  }
  return redis;
}

export const getRedisConnection = getRedis;

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
