# Production deployment

## Vercel

Import this Git repository as a Next.js project. Add these Production and
Preview environment variables in Vercel; do not commit their values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOLDRUSH_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `CRON_SHARED_SECRET`
- `GEMINI_API_KEY`
- `APP_URL` (the final Vercel production URL)

Build command: `npm run build`.

## Supabase Auth

In Authentication → URL Configuration, set Site URL to `APP_URL` and add:

```
https://<your-vercel-domain>/auth/callback
http://localhost:3000/auth/callback
```

Enable the Email provider and Magic Link. Each portfolio row is protected by
RLS and owned by the authenticated user.

## Telegram scheduler

Deploy the existing function with the Supabase CLI:

```
supabase functions deploy check-price-alerts
```

Set `TELEGRAM_BOT_TOKEN` and `CRON_SHARED_SECRET` as Edge Function secrets,
then create a Supabase Scheduler job that calls `check-price-alerts` with
`Authorization: Bearer <CRON_SHARED_SECRET>`. Supabase, rather than Vercel,
owns Telegram delivery to preserve idempotent alert claims.
