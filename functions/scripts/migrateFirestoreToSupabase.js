#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * One-off migration script:
 *   - Reads contribution documents from Firestore
 *   - Upserts them into Supabase `public.submissions`
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   export FIREBASE_APP_ID=<artifacts app id>          # optional, fallback to Supabase app id
 *   export SUPABASE_URL=https://<project>.supabase.co
 *   export SUPABASE_SERVICE_ROLE_KEY=<service role key>
 *   node scripts/migrateFirestoreToSupabase.js
 */

const admin = require('firebase-admin');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FIREBASE_APP_ID =
  process.env.FIREBASE_APP_ID ||
  process.env.APP_ID ||
  process.env.SUPABASE_APP_ID;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
  );
  process.exit(1);
}

if (!FIREBASE_APP_ID) {
  console.error(
    'Missing FIREBASE_APP_ID (artifacts/<appId>/...) environment variable.'
  );
  process.exit(1);
}

try {
  admin.initializeApp();
} catch (error) {
  console.error('Failed to initialise firebase-admin:', error);
  process.exit(1);
}

const db = admin.firestore();

async function fetchFirestoreContributions() {
  const path = `artifacts/${FIREBASE_APP_ID}/public/data/contributions`;
  console.log(`Fetching contributions from Firestore path: ${path}`);
  const snapshot = await db.collection(path).get();
  const records = snapshot.docs.map((doc) => {
    const data = doc.data() || {};
    const createdAt =
      data.createdAt && typeof data.createdAt.toDate === 'function'
        ? data.createdAt.toDate().toISOString()
        : null;
    return {
      phrase: data.word || '',
      explanation: data.explanation || '',
      example: data.example || null,
      status: data.status || 'pending',
      user_id: data.userId || null,
      source: 'firestore',
      origin_id: doc.id,
      created_at: createdAt,
      metadata: {
        firestorePath: doc.ref.path,
      },
    };
  });

  return records.filter((item) => item.phrase && item.explanation);
}

async function upsertSubmissions(records) {
  const endpoint = `${SUPABASE_URL}/rest/v1/submissions`;
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates',
  };

  const chunkSize = 200;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(chunk),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Supabase upsert failed (status ${response.status}): ${text}`
      );
    }

    console.log(
      `Upserted ${chunk.length} submissions (batch ${
        Math.floor(i / chunkSize) + 1
      }/${Math.ceil(records.length / chunkSize)})`
    );
  }
}

async function main() {
  const submissions = await fetchFirestoreContributions();
  if (!submissions.length) {
    console.log('No contributions found in Firestore.');
    return;
  }

  console.log(`Preparing to upsert ${submissions.length} submissions to Supabase.`);
  await upsertSubmissions(submissions);
  console.log('Migration completed successfully.');
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void admin.app().delete().catch(() => undefined);
  });
