#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Sync embeddings for phrases stored in Supabase.
 *
 * Requirements:
 *   export SUPABASE_URL=https://<project>.supabase.co
 *   export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
 *   export GEMINI_API_KEY=<your-gemini-api-key>
 *   export GEMINI_EMBED_MODEL=text-embedding-004        # optional
 *
 * Optional tuning:
 *   export EMBEDDING_BATCH_SIZE=50
 *   export EMBEDDING_RETRY_LIMIT=5
 *
 * Run:
 *   npm --prefix functions run supabase:sync-embeddings
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY environment variable.');
  process.exit(1);
}

const EMBEDDING_MODEL =
  process.env.GEMINI_EMBED_MODEL || 'text-embedding-004';
const BATCH_SIZE = Number(process.env.EMBEDDING_BATCH_SIZE || '25');
const RETRY_LIMIT = Number(process.env.EMBEDDING_RETRY_LIMIT || '5');

const REST_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

async function callSupabaseRPC(fnName, body) {
  return withRetry(async () => {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/${fnName}`,
      {
        method: 'POST',
        headers: REST_HEADERS,
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      const error = new Error(
        `Supabase RPC ${fnName} failed (${response.status}): ${text}`
      );
      error.status = response.status;
      throw error;
    }

    return response.status === 204 ? null : response.json();
  }, `Supabase RPC ${fnName}`);
}

async function withRetry(fn, description) {
  let attempt = 0;
  let delay = 500;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt > RETRY_LIMIT) {
        throw error;
      }
      const wait = delay * 2 ** (attempt - 1);
      console.warn(
        `${description} failed (attempt ${attempt}/${RETRY_LIMIT}). Retrying in ${wait}ms.`,
        error.message || error
      );
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

async function fetchPendingPhrases(limit) {
  const data = await callSupabaseRPC('get_phrases_pending_embedding', {
    p_model: EMBEDDING_MODEL,
    p_limit: limit,
  });

  return Array.isArray(data) ? data : [];
}

async function generateEmbedding(text) {
  return withRetry(async () => {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: {
          parts: [{ text }],
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(
        `Gemini embedding request failed (${response.status}): ${body}`
      );
      error.status = response.status;
      throw error;
    }

    const json = await response.json();
    const embedding = json?.embedding?.values;
    if (!embedding) {
      throw new Error('Gemini response missing embedding data');
    }
    return embedding;
  }, 'Gemini embedding request');
}

async function upsertEmbedding(phraseId, embedding) {
  const embeddingLiteral = `[${embedding.join(',')}]`;
  await callSupabaseRPC('upsert_phrase_embedding', {
    p_phrase_id: phraseId,
    p_model: EMBEDDING_MODEL,
    p_embedding: embeddingLiteral,
    p_embedded_at: new Date().toISOString(),
  });
}

async function main() {
  console.log(
    `Starting embedding sync (model=${EMBEDDING_MODEL}, batchSize=${BATCH_SIZE})`
  );

  let processed = 0;
  while (true) {
    const pending = await fetchPendingPhrases(BATCH_SIZE);
    if (!pending.length) {
      break;
    }

    console.log(`Processing ${pending.length} phrases...`);
    for (const item of pending) {
      const text = item.phrase?.trim();
      if (!text) {
        console.warn('Skipping empty phrase for id', item.phrase_id);
        continue;
      }

      const embedding = await generateEmbedding(text);
      await upsertEmbedding(item.phrase_id, embedding);
      processed += 1;
    }
  }

  console.log(`Embedding sync completed. Processed ${processed} phrases.`);
}

main().catch((error) => {
  console.error('Embedding sync failed:', error);
  process.exit(1);
});
