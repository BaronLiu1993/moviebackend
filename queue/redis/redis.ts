import dotenv from "dotenv";
import { Redis } from "ioredis";

dotenv.config();

// Determine the Redis configuration
const redisConfig = process.env.REDIS_URL 
  ? process.env.REDIS_URL 
  : {
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6379,
    };

const redisOptions = {
  maxRetriesPerRequest: null,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  lazyConnect: false, 
  connectTimeout: 10000, 
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  ...(process.env.REDIS_URL && process.env.REDIS_URL.includes('rediss://') 
    ? { 
        tls: { 
          rejectUnauthorized: false 
        } 
      } 
    : {}
  )
};

// Create Redis connection with proper type handling
export const Connection = typeof redisConfig === 'string'
  ? new Redis(redisConfig, redisOptions)
  : new Redis({ ...redisConfig, ...redisOptions });

Connection.on('connect', () => {
  console.log('Redis connected successfully');
});

Connection.on('error', (err) => {
  console.error('Redis connection error:', err);
});

Connection.on('ready', () => {
  console.log('Redis ready to accept commands');
});

Connection.on('reconnecting', () => {
  console.log('Redis reconnecting...');
});

Connection.on('close', () => {
  console.log('Redis connection closed');
});