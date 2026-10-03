import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Automatically load .env.local and .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  // Nebius Token Factory & NVIDIA Nemotron Models
  NEBIUS_API_KEY: z.string().min(1, 'NEBIUS_API_KEY is required for Nemotron AI reasoning').optional(),
  NEBIUS_BASE_URL: z.string().url().default('https://api.tokenfactory.nebius.com/v1'),
  NVIDIA_MODEL_ID: z.string().default('nvidia/nemotron-3-super-120b-a12b'),
  NEBIUS_ULTRA_MODEL_ID: z.string().default('nvidia/Nemotron-3-Ultra-550b-a55b'),
  NEBIUS_SUPER_MODEL_ID: z.string().default('nvidia/nemotron-3-super-120b-a12b'),
  NEBIUS_NANO_MODEL_ID: z.string().default('nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B'),
  NEBIUS_FAST_MODEL_ID: z.string().default('nvidia/nemotron-3-super-120b-a12b'),

  // Tavily Search API
  TAVILY_API_KEY: z.string().min(1, 'TAVILY_API_KEY is required for autonomous web research').optional(),

  // Application Settings
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse({
    NEBIUS_API_KEY: process.env.NEBIUS_API_KEY,
    NEBIUS_BASE_URL: process.env.NEBIUS_BASE_URL,
    NVIDIA_MODEL_ID: process.env.NVIDIA_MODEL_ID,
    NEBIUS_ULTRA_MODEL_ID: process.env.NEBIUS_ULTRA_MODEL_ID,
    NEBIUS_SUPER_MODEL_ID: process.env.NEBIUS_SUPER_MODEL_ID,
    NEBIUS_NANO_MODEL_ID: process.env.NEBIUS_NANO_MODEL_ID,
    NEBIUS_FAST_MODEL_ID: process.env.NEBIUS_FAST_MODEL_ID,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
  });

  if (!result.success) {
    console.warn(
      '⚠️ Environment configuration warning:',
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
    );
    return {
      NEBIUS_BASE_URL: 'https://api.tokenfactory.nebius.com/v1',
      NVIDIA_MODEL_ID: process.env.NVIDIA_MODEL_ID || 'nvidia/nemotron-3-super-120b-a12b',
      NEBIUS_ULTRA_MODEL_ID: process.env.NEBIUS_ULTRA_MODEL_ID || 'nvidia/Nemotron-3-Ultra-550b-a55b',
      NEBIUS_SUPER_MODEL_ID: process.env.NEBIUS_SUPER_MODEL_ID || 'nvidia/nemotron-3-super-120b-a12b',
      NEBIUS_NANO_MODEL_ID: process.env.NEBIUS_NANO_MODEL_ID || 'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B',
      NEBIUS_FAST_MODEL_ID: process.env.NEBIUS_FAST_MODEL_ID || 'nvidia/nemotron-3-super-120b-a12b',
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
    } as Env;
  }

  return result.data;
}

export const env = loadEnv();
