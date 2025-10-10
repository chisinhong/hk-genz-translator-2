const test = require('node:test');
const assert = require('node:assert/strict');
const functionsTest = require('firebase-functions-test')();
const admin = require('firebase-admin');

const originalFirestore = admin.firestore;
const firestoreDescriptor = Object.getOwnPropertyDescriptor(admin, 'firestore');
const TEST_KEY = Buffer.alloc(32, 7).toString('base64');

function setupEnvironment({ fetchResponse, fetchShouldFail = false }) {
  process.env.PROVIDER_TOKEN_ENC_KEY = TEST_KEY;
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_OAUTH_TOKEN_ENDPOINT = 'https://oauth.example.com/token';

  const originalFetch = global.fetch;

  global.fetch = async () => {
    if (fetchShouldFail) {
      return {
        ok: false,
        status: 400,
        text: async () => 'bad request',
      };
    }
    return {
      ok: true,
      json: async () => fetchResponse,
    };
  };

  const fakeDoc = {
    setCalls: [],
    set(data, options) {
      this.setCalls.push({ data, options });
      return Promise.resolve();
    },
  };

  Object.defineProperty(admin, 'firestore', {
    configurable: true,
    enumerable: true,
    value: Object.assign(() => ({
      doc: () => fakeDoc,
    }), { FieldValue: originalFirestore.FieldValue }),
  });

  delete require.cache[require.resolve('../index')];
  const myFunctions = require('../index');

  return {
    myFunctions,
    fakeDoc,
    restore: () => {
      global.fetch = originalFetch;
      if (firestoreDescriptor) {
        Object.defineProperty(admin, 'firestore', firestoreDescriptor);
      } else {
        admin.firestore = originalFirestore;
      }
      delete process.env.PROVIDER_TOKEN_ENC_KEY;
      delete process.env.GOOGLE_OAUTH_CLIENT_ID;
      delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
      delete process.env.GOOGLE_OAUTH_TOKEN_ENDPOINT;
      functionsTest.cleanup();
    },
  };
}

test('handleProviderToken exchanges code and stores encrypted tokens', async () => {
  const fakeResponse = {
    access_token: 'ACCESS',
    refresh_token: 'REFRESH',
    expires_in: 3600,
    token_type: 'Bearer',
    scope: 'email profile',
  };

  const { myFunctions, fakeDoc, restore } = setupEnvironment({
    fetchResponse: fakeResponse,
  });

  try {
    const wrapped = functionsTest.wrap(myFunctions.handleProviderToken);
    const result = await wrapped({
      data: {
        provider: 'google',
        appId: 'app-123',
        code: 'auth-code',
        redirectUri: 'https://example.com/callback',
      },
      auth: { uid: 'user-1', token: {} },
    });

    assert.equal(result.provider, 'google');
    assert.equal(result.tokenType, 'Bearer');
    assert.ok(result.expiresAt);
    assert.ok(result.refreshScheduledAt);

    assert.equal(fakeDoc.setCalls.length, 1);
    const [call] = fakeDoc.setCalls;
    assert.deepEqual(call.options, { merge: true });

    const tokens = Object.entries(call.data).reduce((acc, [key, value]) => {
      const prefix = 'socialConnections.providers.google.tokens.';
      if (key.startsWith(prefix)) {
        const field = key.slice(prefix.length);
        acc[field] = value;
      }
      return acc;
    }, {});

    assert.ok(tokens.encryptedAccessToken, 'expected encrypted access token');
    assert.notEqual(tokens.encryptedAccessToken, fakeResponse.access_token);
    assert.ok(tokens.encryptedRefreshToken, 'expected encrypted refresh token');
  } finally {
    restore();
  }
});

test('handleProviderToken throws when provider exchange fails', async () => {
  const { myFunctions, restore } = setupEnvironment({
    fetchShouldFail: true,
  });

  try {
    const wrapped = functionsTest.wrap(myFunctions.handleProviderToken);

    await assert.rejects(
      () =>
        wrapped({
          data: {
            provider: 'google',
            appId: 'app-123',
            code: 'bad-code',
            redirectUri: 'https://example.com/callback',
          },
          auth: { uid: 'user-1', token: {} },
        }),
      (error) => error.code === 'failed-precondition'
    );
  } finally {
    restore();
  }
});
