const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const FFT = require('firebase-functions-test');

const SEARCH_MODULE_PATH = path.join(__dirname, '../lib/searchSimilarPhrases.js');
const INDEX_MODULE_PATH = path.join(__dirname, '../lib/index.js');

const dynamicStub = {
  impl: async (_query, _topK, _threshold, options = {}) => {
    options?.onMetrics?.({
      totalDurationMs: 5,
      embeddingDurationMs: 2,
      supabaseDurationMs: 3,
      matchCount: 0,
      topSimilarity: null,
    });
    return [];
  },
};

const originalSearchModule = require.cache[SEARCH_MODULE_PATH];
require.cache[SEARCH_MODULE_PATH] = {
  exports: {
    searchSimilarPhrases: (...args) => dynamicStub.impl(...args),
  },
};

const functions = require(INDEX_MODULE_PATH);

process.on('exit', () => {
  if (originalSearchModule) {
    require.cache[SEARCH_MODULE_PATH] = originalSearchModule;
  } else {
    delete require.cache[SEARCH_MODULE_PATH];
  }
});

function withQueryFunction(stubImpl, handler) {
  dynamicStub.impl = stubImpl;
  const fftInstance = FFT();
  const wrapped = fftInstance.wrap(functions.queryPhrases);

  return handler(wrapped).finally(() => {
    fftInstance.cleanup();
  });
}

test('queryPhrases returns structured results with rank', async () => {
  const mockResults = [
    {
      phraseId: 'uuid-1',
      phrase: 'slang',
      similarity: 0.91,
      distance: 0.09,
      metadata: { level: 'basic' },
      translations: [
        { id: 't1', variant: 'formal', translation: 'formal', tone: null, metadata: {} },
      ],
    },
    {
      phraseId: 'uuid-2',
      phrase: 'another',
      similarity: 0.84,
      distance: 0.16,
      metadata: {},
      translations: [],
    },
  ];

  await withQueryFunction(
    async (_query, topK, threshold, options) => {
      assert.equal(topK, 10);
      assert.equal(threshold, 0.6);
      options?.onMetrics?.({
        totalDurationMs: 12,
        embeddingDurationMs: 4,
        supabaseDurationMs: 6,
        matchCount: mockResults.length,
        topSimilarity: mockResults[0].similarity,
      });
      return mockResults;
    },
    async (wrapped) => {
      const response = await wrapped({
        data: {
          query: 'test phrase',
          topK: 10,
          threshold: 0.6,
        },
        auth: { uid: 'user-1', token: {} },
      });

      assert.equal(response.query, 'test phrase');
      assert.equal(response.topK, 10);
      assert.equal(response.threshold, 0.6);
      assert.equal(response.count, 2);
      assert.equal(response.results.length, 2);
      assert.deepEqual(response.results[0], {
        rank: 1,
        ...mockResults[0],
      });
      assert.deepEqual(response.results[1], {
        rank: 2,
        ...mockResults[1],
      });
      assert.ok(response.metrics);
      assert.equal(response.metrics.matchCount, 2);
      assert.equal(response.metrics.topSimilarity, 0.91);
    },
  );
});

test('queryPhrases clamps inputs and accepts string numbers', async () => {
  await withQueryFunction(
    async (_query, topK, threshold, options) => {
      assert.equal(topK, 25);
      assert.equal(threshold, 1);
      options?.onMetrics?.({
        totalDurationMs: 8,
        embeddingDurationMs: 3,
        supabaseDurationMs: 4,
        matchCount: 0,
        topSimilarity: null,
      });
      return [];
    },
    async (wrapped) => {
      const response = await wrapped({
        data: {
          query: 'text',
          topK: '100',
          threshold: '1.5',
        },
      });

      assert.equal(response.topK, 25);
      assert.equal(response.threshold, 1);
      assert.ok(response.metrics);
      assert.equal(response.metrics.matchCount, 0);
    },
  );
});

test('queryPhrases validates query input', async () => {
  await withQueryFunction(async () => [], async (wrapped) => {
    await assert.rejects(
      () =>
        wrapped({
          data: { query: '' },
        }),
      (error) => error.code === 'invalid-argument',
    );
  });
});

test('queryPhrases maps search errors to internal failure', async () => {
  await withQueryFunction(
    async () => {
      throw new Error('search failed');
    },
    async (wrapped) => {
      await assert.rejects(
        () =>
          wrapped({
            data: { query: 'boom' },
          }),
        (error) => error.code === 'internal',
      );
    },
  );
});
