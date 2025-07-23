// src/config.ts
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    PORT: z.coerce.number().default(3000),
    AUTH_ISSUER: z.string().url(),
    SERVER_URL: z.string().url(),
    PAYOUT_PRINCIPAL: z.string().min(1),
    // For local dev, from .env
    IDENTITY_PEM_PATH: z.string().optional(),
    // For production, from a secret manager
    IDENTITY_PEM_CONTENT: z.string().optional(),
  })
  .refine((data) => data.IDENTITY_PEM_PATH || data.IDENTITY_PEM_CONTENT, {
    message:
      'Either IDENTITY_PEM_PATH or IDENTITY_PEM_CONTENT must be defined.',
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    '❌ Invalid environment variables:',
    parsedEnv.error.flatten().fieldErrors,
  );
  throw new Error('Invalid environment variables.');
}

export const config = Object.freeze(parsedEnv.data);
