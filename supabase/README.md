# Supabase Integration (Tickets 2-3)

This directory tracks the database schema and tooling that backs the new Supabase
stack (Postgres + pgvector).

## Migrations

- `migrations/001_init_schema.sql` – initial schema for phrases, translations, vector store, usage analytics, and the manual submissions table.
- `migrations/002_embeddings.sql` – helper functions (`get_phrases_pending_embedding`, `upsert_phrase_embedding`) used by the embedding sync script.
  
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
GEMINI_API_KEY=<embedding-provider-key>
GEMINI_EMBED_MODEL=text-embedding-004          # optional override
# Optional: direct Postgres connection string
SUPABASE_DB_URL=postgresql://username:password@host:5432/postgres
```

## Content management

User submissions are no longer collected in-app. Maintain the `public.submissions` table manually (e.g. via Supabase Table Editor) when new words are sourced from Threads or other channels.

## Embedding sync

`functions/scripts/syncEmbeddings.js` fetches phrases that lack embeddings (or whose embeddings are older than the phrase `updated_at`), generates vectors via Google Gemini Embeddings API, and upserts them using the helper functions above.

```bash
cd functions
export SUPABASE_URL=https://<project>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
export GEMINI_API_KEY=<gemini-api-key>
export GEMINI_EMBED_MODEL=text-embedding-004    # optional
export EMBEDDING_BATCH_SIZE=50                   # optional
npm run supabase:sync-embeddings
```

The script includes exponential backoff for both Gemini calls and Supabase RPC upserts.

## Next steps

- Seed the new tables with your canonical slang/translation dataset.
- Implement Supabase query API (Ticket 4) for semantic search.
- Replace Firestore reads in the application with Supabase queries once the data has been fully migrated.
