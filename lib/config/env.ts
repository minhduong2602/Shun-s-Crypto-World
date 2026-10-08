import { z } from 'zod';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GOLDRUSH_API_KEY: z.string().min(1).optional(),
  MARKET_DATA_API_KEY: z.string().min(1).optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  CRON_SHARED_SECRET: z.string().min(1).optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

type EnvInput = Record<string, string | undefined>;

function formatIssues(error: z.ZodError) {
  return error.issues.map((issue) => issue.path.join('.')).join(', ');
}

export function getPublicEnv(input: EnvInput = process.env): PublicEnv {
  const result = publicEnvSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Missing or invalid public environment variables: ${formatIssues(result.error)}`);
  }
  return result.data;
}

export function getServerEnv(input: EnvInput = process.env): ServerEnv {
  const result = serverEnvSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Missing or invalid server environment variables: ${formatIssues(result.error)}`);
  }
  return result.data;
}
