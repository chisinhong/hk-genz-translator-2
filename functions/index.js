/* eslint-env node */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const { FieldValue } = admin.firestore;

const DEFAULT_DAILY_LIMIT = parseInt(
  process.env.DAILY_TRANSLATION_LIMIT || '10',
  10
);
const REGISTERED_DAILY_LIMIT = parseInt(
  process.env.REGISTERED_TRANSLATION_LIMIT || '50',
  10
);

function resolveLimit(limitType = 'daily') {
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

exports.validateQuota = functions.https.onCall(async (data = {}, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication is required to verify quota.'
      );
    }

    const limitType =
      typeof data.limitType === 'string' ? data.limitType : 'daily';
    const requested = Number.isFinite(data.requested)
      ? Math.max(1, Math.floor(data.requested))
      : 1;
    const shouldConsume = data.consume !== false;
    const appId = typeof data.appId === 'string' ? data.appId : 'default-app-id';
    const limit = resolveLimit(limitType);
    const userId = context.auth.uid;

    if (!limit || limit <= 0) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Quota limit is not configured.'
      );
    }

    const todayKey = new Date().toISOString().slice(0, 10);
    const docRef = admin
      .firestore()
      .doc(`${getCollectionPath(appId)}/${userId}`);
    const snapshot = await docRef.get();
    const docData = snapshot.exists ? snapshot.data() : {};
    const counts = docData.counts || {};
    const currentCount = Number.isFinite(counts[todayKey])
      ? counts[todayKey]
      : 0;
    const nextCount = currentCount + requested;

    if (nextCount > limit) {
      functions.logger.warn('quota_hit', {
        event: 'quota_hit',
        userId,
        limitType,
        limit,
        requested,
        currentCount,
        appId,
      });

      throw new functions.https.HttpsError(
        'resource-exhausted',
        'QUOTA_EXCEEDED',
        {
          limit,
          limitType,
          currentCount,
          remaining: Math.max(limit - currentCount, 0),
          requested,
        }
      );
    }

    if (shouldConsume) {
      await docRef.set(
        {
          userId,
          counts: {
            [todayKey]: FieldValue.increment(requested),
          },
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

exports.ensureUserTier = functions.https.onCall(async (data = {}, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Authentication is required to manage user tier.'
      );
    }

    functions.logger.info('ensure_user_tier_invocation', {
      payload: data,
      uid: context.auth.uid,
    });

    const appId = typeof data.appId === 'string' ? data.appId : 'default-app-id';
    const userId = context.auth.uid;
    const firestore = admin.firestore();
    const userDocRef = firestore.doc(
      `${getUsersCollectionPath(appId)}/${userId}`
    );

    try {
      const snapshot = await userDocRef.get();
      const defaultTier = resolveDefaultTier(context.auth);
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

      functions.logger.info('ensure_user_tier_success', {
        userId,
        tier,
        dailyLimit,
        appId,
      });

      return {
        userId,
        tier,
        dailyLimit,
        appId,
      };
    } catch (error) {
      functions.logger.error('ensure_user_tier_error', error);
      throw new functions.https.HttpsError('internal', error.message, {
        message: error?.message,
        stack: error?.stack,
      });
    }
  });
