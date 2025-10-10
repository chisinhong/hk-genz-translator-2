const test = require('node:test');
const assert = require('node:assert/strict');

const ORIGINAL_FETCH = global.fetch;

function loadModule() {
  delete require.cache[require.resolve('../lib/searchSimilarPhrases.js')];
  return require('../lib/searchSimilarPhrases.js');
}

function createSupabaseClient(fetchImpl) {
  delete require.cache[require.resolve('../lib/supabaseClient.js')];
  const { SupabaseClient } = require('../lib/supabaseClient.js');
  return new SupabaseClient({
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: process.env.SUPABASE_ANON_KEY,
    fetchImpl,
  });
}

function withEnv(overrides, fn) {
  const original = {};
  const originalFetch = global.fetch;
  for (const key of Object.keys(overrides)) {
    original[key] = process.env[key];
    process.env[key] = overrides[key];
  }

  return fn().finally(() => {
    for (const key of Object.keys(overrides)) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
  });
}

test('searchSimilarPhrases returns formatted results', async (t) => {
  await withEnv(
    {
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      GEMINI_API_KEY: 'gemini-key',
      GEMINI_EMBED_MODEL: 'text-embedding-004',
    },
    async () => {
      let callIndex = 0;
      const fetchStub = async (url, init) => {
        callIndex += 1;
        if (callIndex === 1) {
          assert.ok(
            (url ?? '').includes('generativelanguage.googleapis.com'),
            'Expected first call to go to Gemini'
          );
          assert.equal(init.method, 'POST');
          return {
            ok: true,
            json: async () => ({ embedding: { values: [0.1, 0.2, 0.3] } }),
          };
        }

        assert.equal(
          url,
          'https://project.supabase.co/rest/v1/rpc/match_phrase_embeddings'
        );
        assert.equal(init.method, 'POST');
        const body = JSON.parse(init.body);
        assert.equal(body.p_match_count, 5);
        assert.equal(body.p_match_threshold, 0.7);
        assert.equal(
          body.p_query_embedding,
          '[0.1,0.2,0.3]'
        );
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              phrase_id: 'uuid-1',
              phrase: 'test phrase',
              similarity: 0.92,
              distance: 0.08,
              metadata: { level: 'basic' },
              translations: [
                {
                  id: 't-1',
                  variant: 'formal',
                  translation: 'formal text',
                  tone: 'formal',
                  metadata: { sample: true },
                },
              ],
            },
          ],
        };
      };

      global.fetch = fetchStub;

      const { searchSimilarPhrases } = loadModule();
      const client = createSupabaseClient(fetchStub);

      let capturedMetrics = null;
      const results = await searchSimilarPhrases(
        'hello world',
        undefined,
        undefined,
        {
          client,
          onMetrics: (metrics) => {
            capturedMetrics = metrics;
          },
        }
      );

      assert.equal(results.length, 1);
      const [first] = results;
      assert.equal(first.phraseId, 'uuid-1');
      assert.equal(first.phrase, 'test phrase');
      assert.equal(first.similarity, 0.92);
      assert.equal(first.distance, 0.08);
      assert.deepEqual(first.metadata, { level: 'basic' });
      assert.equal(first.translations.length, 1);
      assert.equal(first.translations[0].translation, 'formal text');
      assert.ok(capturedMetrics);
      assert.equal(capturedMetrics.matchCount, 1);
      assert.equal(typeof capturedMetrics.totalDurationMs, 'number');
      assert.equal(capturedMetrics.topSimilarity, 0.92);
    }
  );
});

test('searchSimilarPhrases handles empty results', async () => {
  await withEnv(
    {
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      GEMINI_API_KEY: 'gemini-key',
    },
    async () => {
      const fetchStub = async (url) => {
        if ((url ?? '').includes('generativelanguage.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({ embedding: { values: [0.4, 0.5] } }),
          };
        }

        return {
          ok: true,
          status: 204,
          json: async () => [],
        };
      };

      global.fetch = fetchStub;

      const { searchSimilarPhrases } = loadModule();
      const client = createSupabaseClient(fetchStub);
      const metrics = [];
      const results = await searchSimilarPhrases('nothing here', 3, 0.8, {
        client,
        onMetrics: (data) => metrics.push(data),
      });
      assert.deepEqual(results, []);
      assert.equal(metrics.length, 1);
      assert.equal(metrics[0].matchCount, 0);
    }
  );
});

test('searchSimilarPhrases throws when embeddings fail', async () => {
  await withEnv(
    {
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      GEMINI_API_KEY: 'gemini-key',
    },
    async () => {
      const fetchStub = async () => ({
        ok: false,
        status: 500,
        text: async () => 'error',
      });

      global.fetch = fetchStub;
      const { searchSimilarPhrases } = loadModule();
      const client = createSupabaseClient(fetchStub);

      await assert.rejects(
        () => searchSimilarPhrases('should fail', undefined, undefined, { client }),
        /Gemini embedding request failed/
      );
    }
  );
});

test('searchSimilarPhrases validates query input', async () => {
  const { searchSimilarPhrases } = loadModule();
  await assert.rejects(
    () => searchSimilarPhrases('', 5, 0.7),
    /Query text is required/
  );
});

test('restore fetch to its original implementation', () => {
  if (ORIGINAL_FETCH === undefined) {
    delete global.fetch;
  } else {
    global.fetch = ORIGINAL_FETCH;
  }
});
