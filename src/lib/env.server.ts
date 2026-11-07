import "server-only";
import { z } from "zod";

/*
  Secrets. Importing this file from browser code fails the build ("server-only"),
  so these values can never end up in a page sent to visitors.
*/
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "SUPABASE_SERVICE_ROLE_KEY is missing"),
  GEMINI_API_KEY: z.string().min(10).optional(),
  GEMINI_MODEL: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(24, "CRON_SECRET must be at least 24 characters").optional(),
  RESEND_API_KEY: z.string().min(10).optional(),
  RESEND_FROM: z.string().min(5).optional(),
  VAPID_PUBLIC_KEY: z.string().min(20).optional(),
  VAPID_PRIVATE_KEY: z.string().min(20).optional(),
  VAPID_SUBJECT: z.string().min(5).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || undefined,
    GEMINI_MODEL: process.env.GEMINI_MODEL || undefined,
    CRON_SECRET: process.env.CRON_SECRET || undefined,
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    RESEND_FROM: process.env.RESEND_FROM || undefined,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || undefined,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || undefined,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Missing or invalid server settings: ${z.prettifyError(parsed.error)}`);
  }
  cached = parsed.data;
  return cached;
}
