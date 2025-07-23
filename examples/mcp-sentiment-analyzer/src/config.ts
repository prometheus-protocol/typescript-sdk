import 'dotenv/config'; // Loads .env file for local development
import { z } from 'zod';

// Define the schema for all environment variables your application needs
const envSchema = z
  .object({
    // From auth.ts
    AUTH_ISSUER: z.string().url(),
    SERVER_URL: z.string().url(),
    // From index.ts
    PAYOUT_PRINCIPAL: z.string().min(1),
    // For local dev vs. production
    IDENTITY_PEM_PATH: z.string().optional(),
    IDENTITY_PEM_CONTENT: z.string().optional(),
    // Optional: Port for the server
    PORT: z.coerce.number().int().min(1).optional(),
  })
  .refine((data) => data.IDENTITY_PEM_PATH || data.IDENTITY_PEM_CONTENT, {
    message:
      'Either IDENTITY_PEM_PATH (for local) or IDENTITY_PEM_CONTENT (from secret) must be defined.',
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    '❌ Invalid environment variables:',
    parsedEnv.error.flatten().fieldErrors,
  );
  throw new Error('Invalid environment variables.');
}

// Export the validated and typed configuration as a frozen object
export const config = Object.freeze(parsedEnv.data);
