import Redis from "ioredis";

const globalForRedis = global as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis ||
  new Redis({
    username: "default",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
    host: process.env.REDIS_HOST,
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

type Command = "zrange" | "sismember" | "get" | "smembers";

export async function fetchRedis(
  command: Command,
  ...args: (string | number)[]
) {
  try {
    // @ts-ignore
    const commandResult = await redis[command](...args);
    return commandResult;
  } catch (error) {
    console.error(`Error executing Redis command: ${error}`);
    throw error;
  }
}
