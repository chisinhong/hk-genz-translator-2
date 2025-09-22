const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const { FieldValue } = admin.firestore;

const DEFAULT_DAILY_LIMIT = parseInt(
  process.env.DAILY_TRANSLATION_LIMIT || '10',
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

exports.validateQuota = functions.https.onCall(async (data = {}, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Authentication is required to verify quota.'
    );
  }

  const limitType = typeof data.limitType === 'string' ? data.limitType : 'daily';
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
