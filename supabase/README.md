# Supabase Integration (Ticket 2)

This directory tracks the database schema and tooling that backs the new Supabase
stack (Postgres + pgvector).

## Migrations

- `migrations/001_init_schema.sql` – initial schema for phrases, translations,
  vector store, usage analytics, and raw user submissions.  
  Run it in the Supabase SQL editor (or through the CLI) after enabling the
  required extensions:

  ```sql
  create extension if not exists "pgcrypto";
  create extension if not exists vector;
  ```

## Environment variables

Set the following locally (e.g. `.env.local`, `.env`) and in production
(Firebase Functions config, Supabase secrets, CI). **Never ship the
service role key to the browser.**

```bash
# Client side (Vite)
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>

# Server / scripts / Cloud Functions
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
# Optional: direct Postgres connection string
SUPABASE_DB_URL=postgresql://username:password@host:5432/postgres
```

If you run the migration script locally you also need:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/firebase-service-account.json
FIREBASE_APP_ID=<artifacts app id>  # e.g. genz-translator-2
```

## One-off data migration

Inside `functions/scripts` there is `migrateFirestoreToSupabase.js`.  
It reads Firestore contributions (`artifacts/<appId>/public/data/contributions`)
and upserts them into Supabase `public.submissions`.

Example invocation:

```bash
cd functions
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
export FIREBASE_APP_ID=genz-translator-2
export SUPABASE_URL=https://<project>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
npm run supabase:migrate
```

> The script uses the Supabase REST API (PostgREST). Make sure Row Level
> Security is configured to allow the service role to write to the target tables.

## Next steps

- Seed the new tables with your canonical slang/translation dataset.
- Implement embeddings generation (Ticket 3) and Supabase query API (Ticket 4).
- Replace Firestore reads in the application with Supabase queries once the
  data has been fully migrated.
