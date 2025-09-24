/* eslint-env node */

// 1. 從 firebase-functions/v2/https 引入 onRequest
const { onRequest } = require('firebase-functions/v2/https');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const { FieldValue } = admin.firestore;

// --- 常數和輔助函數 (與 Gen 1 相同) ---
const DEFAULT_DAILY_LIMIT = parseInt(
  process.env.DAILY_TRANSLATION_LIMIT || '10',
  10
);
const REGISTERED_DAILY_LIMIT = parseInt(
  process.env.REGISTERED_TRANSLATION_LIMIT || '50',
  10
);

function resolveLimit(limitType = 'daily') {
  // ... (此函數內容不變)
  switch (limitType) {
    case 'daily':
    default:
      return DEFAULT_DAILY_LIMIT;
  }
}

function getCollectionPath(appId) {
  return `artifacts/${appId}/public/data/translatorUsage`;
}

function getUsersCollectionPath(appId) {
  return `artifacts/${appId}/private/metadata/users`;
}

function resolveDefaultTier(contextAuth) {
  const provider =
    contextAuth?.token?.firebase?.sign_in_provider || 'anonymous';
  return provider === 'anonymous' ? 'guest' : 'registered';
}

// --- validateQuota 函數 (也升級到 Gen 2 onCall) ---
exports.validateQuota = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'Authentication is required to verify quota.'
    );
  }
  const { data, auth } = request;
  // ... (其餘邏輯與 Gen 1 相同, 只是 context 變成了 request)
  const limitType =
    typeof data.limitType === 'string' ? data.limitType : 'daily';
  const requested = Number.isFinite(data.requested)
    ? Math.max(1, Math.floor(data.requested))
    : 1;
  const shouldConsume = data.consume !== false;
  const appId = typeof data.appId === 'string' ? data.appId : 'default-app-id';
  const limit = resolveLimit(limitType);
  const userId = auth.uid;

  if (!limit || limit <= 0) {
    throw new HttpsError(
      'failed-precondition',
      'Quota limit is not configured.'
    );
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const docRef = admin.firestore().doc(`${getCollectionPath(appId)}/${userId}`);
  const snapshot = await docRef.get();
  const docData = snapshot.exists ? snapshot.data() : {};
  const counts = docData.counts || {};
  const currentCount = Number.isFinite(counts[todayKey]) ? counts[todayKey] : 0;
  const nextCount = currentCount + requested;

  if (nextCount > limit) {
    logger.warn('quota_hit', {
      /* ... */
    });
    throw new HttpsError('resource-exhausted', 'QUOTA_EXCEEDED', {
      /* ... */
    });
  }

  if (shouldConsume) {
    await docRef.set(
      {
        userId,
        counts: { [todayKey]: FieldValue.increment(requested) },
        lastTranslationAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  const remaining = limit - nextCount;
  return {
    allowed: true,
    limit,
    limitType,
    requested,
    usage: nextCount,
    remaining,
  };
});

// --- ensureUserTier 函數 (Gen 2 版本) ---
// 2. 在定義函數時直接加入 cors: true 選項
exports.ensureUserTier = onRequest({ cors: true }, async (req, res) => {
  // 3. 不再需要 cors(req, res, () => { ... }) 的包裝
  try {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
      throw new HttpsError(
        'unauthenticated',
        'Authentication is required to manage user tier.'
      );
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const contextAuth = { uid: decodedToken.uid, token: decodedToken };
    const data = req.body.data || {};

    logger.info('ensure_user_tier_invocation', {
      payload: data,
      uid: contextAuth.uid,
    });

    const appId =
      typeof data.appId === 'string' ? data.appId : 'default-app-id';
    const userId = contextAuth.uid;
    const firestore = admin.firestore();
    const userDocRef = firestore.doc(
      `${getUsersCollectionPath(appId)}/${userId}`
    );

    const snapshot = await userDocRef.get();
    // 注意: Gen 2 onCall 的 context.auth 結構不同，這裡我們模擬一下
    const defaultTier = resolveDefaultTier(contextAuth);
    const defaultDailyLimit =
      defaultTier === 'registered'
        ? REGISTERED_DAILY_LIMIT
        : DEFAULT_DAILY_LIMIT;

    let tier = defaultTier;
    let dailyLimit = defaultDailyLimit;
    let needsUpdate = false;

    if (snapshot.exists) {
      const snapshotData = snapshot.data() || {};
      if (snapshotData.tier) {
        tier = snapshotData.tier;
      }
      if (Number.isFinite(snapshotData.dailyLimit)) {
        dailyLimit = snapshotData.dailyLimit;
      } else {
        needsUpdate = true;
      }
      if (!snapshotData.tier) {
        needsUpdate = true;
      }
    } else {
      needsUpdate = true;
    }

    if (needsUpdate) {
      await userDocRef.set(
        {
          createdAt: snapshot.exists
            ? snapshot.get('createdAt') || FieldValue.serverTimestamp()
            : FieldValue.serverTimestamp(),
          tier,
          dailyLimit,
          lastUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    const result = { userId, tier, dailyLimit, appId };
    logger.info('ensure_user_tier_success', result);

    // Gen 2 onRequest 直接使用 res.json()
    res.json({ data: result });
  } catch (error) {
    logger.error('ensure_user_tier_error', error);
    const errorCode = error.code || 'internal';
    const httpStatus = errorCode === 'unauthenticated' ? 401 : 500;
    res.status(httpStatus).json({
      error: {
        code: errorCode,
        message: error.message,
      },
    });
  }
});
