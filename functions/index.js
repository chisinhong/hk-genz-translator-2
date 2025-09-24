/* eslint-env node */

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const { FieldValue } = admin.firestore;

const DEFAULT_GUEST_LIMIT = parseInt(process.env.GUEST_TRANSLATION_LIMIT || '3', 10);
const DEFAULT_REGISTERED_LIMIT = parseInt(
  process.env.DAILY_TRANSLATION_LIMIT || '10',
  10
);
const PRO_LIMIT = parseInt(process.env.PRO_TRANSLATION_LIMIT || '200', 10);
const TASK_PERMANENT_REWARD = 5;
const SHARE_REWARD_PER_USE = 2;
const SHARE_DAILY_CAP = 10; // +10 次額度（相等於 5 次分享）
const ISO_DATE_LENGTH = 10;

const TASK_IDS = {
  instagram: 'instagram',
  threads: 'threads',
  submission: 'submission',
  invite: 'invite',
  share: 'share',
};

function todayKey() {
  return new Date().toISOString().slice(0, ISO_DATE_LENGTH);
}

function determineBaseLimit(tier) {
  if (tier === 'pro') return PRO_LIMIT;
  if (tier === 'registered') return DEFAULT_REGISTERED_LIMIT;
  return DEFAULT_GUEST_LIMIT;
}

function resolveDefaultTier(contextAuth) {
  const provider =
    contextAuth?.token?.firebase?.sign_in_provider || 'anonymous';
  return provider === 'anonymous' ? 'guest' : 'registered';
}

function getCollectionPath(appId) {
  return `artifacts/${appId}/public/data/translatorUsage`;
}

function getUsersCollectionPath(appId) {
  return `artifacts/${appId}/private/metadata/users`;
}

function buildDefaultTasks() {
  return {
    instagram: false,
    threads: false,
    submissionsApproved: 0,
    invitesCompleted: 0,
    sharesToday: 0,
    sharesRecordedAt: null,
  };
}

function calculatePermanentBoost(tasks = {}) {
  const instagramBoost = tasks.instagram ? TASK_PERMANENT_REWARD : 0;
  const threadsBoost = tasks.threads ? TASK_PERMANENT_REWARD : 0;
  const submissionBoost = (tasks.submissionsApproved || 0) * TASK_PERMANENT_REWARD;
  const inviteBoost = (tasks.invitesCompleted || 0) * TASK_PERMANENT_REWARD;
  return instagramBoost + threadsBoost + submissionBoost + inviteBoost;
}

function normalizeUserDoc(rawData, fallbackTier) {
  const data = rawData || {};
  const tier = data.tier || fallbackTier;
  const today = todayKey();
  const rawTasks = { ...buildDefaultTasks(), ...(data.tasks || {}) };
  const sharesFresh = rawTasks.sharesRecordedAt === today;
  const normalizedTasks = {
    ...rawTasks,
    sharesToday: sharesFresh ? rawTasks.sharesToday || 0 : 0,
    sharesRecordedAt: sharesFresh ? today : null,
  };

  const fallbackLimit = determineBaseLimit(tier);
  let baseLimit = Number.isFinite(data.baseLimit)
    ? data.baseLimit
    : fallbackLimit;

  if (tier === 'pro') {
    baseLimit = PRO_LIMIT;
  } else {
    baseLimit = fallbackLimit;
  }

  const permanentBoost = calculatePermanentBoost(normalizedTasks);
  const sharesToday = normalizedTasks.sharesToday;
  const shareBonus = Math.min(
    sharesToday * SHARE_REWARD_PER_USE,
    SHARE_DAILY_CAP
  );

  return {
    tier,
    baseLimit,
    tasks: normalizedTasks,
    permanentBoost,
    shareBonus,
    sharesToday,
    sharesFresh,
  };
}

function buildProfilePayload(userId, normalized, appId) {
  const { tier, baseLimit, permanentBoost, shareBonus, tasks } = normalized;
  const dailyLimit =
    tier === 'pro' ? PRO_LIMIT : baseLimit + permanentBoost + shareBonus;

  return {
    userId,
    tier,
    baseLimit,
    permanentBoost,
    shareBonus,
    dailyLimit,
    tasks,
    appId,
  };
}

exports.validateQuota = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'Authentication is required to verify quota.'
    );
  }

  const { data, auth } = request;
  const appId = typeof data.appId === 'string' ? data.appId : 'default-app-id';
  const userId = auth.uid;

  // 取得使用者的有效限額
  const userDoc = await admin
    .firestore()
    .doc(`${getUsersCollectionPath(appId)}/${userId}`)
    .get();

  const normalized = normalizeUserDoc(
    userDoc.exists ? userDoc.data() : null,
    resolveDefaultTier({ token: auth.token })
  );

  const limit =
    normalized.tier === 'pro'
      ? PRO_LIMIT
      : normalized.baseLimit + normalized.permanentBoost + normalized.shareBonus;

  if (!limit || limit <= 0) {
    throw new HttpsError(
      'failed-precondition',
      'Daily quota is not configured.'
    );
  }

  const requested = Number.isFinite(data.requested)
    ? Math.max(1, Math.floor(data.requested))
    : 1;
  const shouldConsume = data.consume !== false;

  const usageDocRef = admin
    .firestore()
    .doc(`${getCollectionPath(appId)}/${userId}`);
  const usageSnap = await usageDocRef.get();
  const usageData = usageSnap.exists ? usageSnap.data() : {};
  const counts = usageData.counts || {};
  const key = todayKey();
  const currentCount = Number.isFinite(counts[key]) ? counts[key] : 0;
  const nextCount = currentCount + requested;

  if (nextCount > limit) {
    logger.warn('quota_hit', {
      userId,
      limit,
      requested,
      currentCount,
    });
    throw new HttpsError('resource-exhausted', 'QUOTA_EXCEEDED', {
      limit,
      currentCount,
      requested,
    });
  }

  if (shouldConsume) {
    await usageDocRef.set(
      {
        userId,
        counts: { [key]: FieldValue.increment(requested) },
        lastTranslationAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  const remaining = limit - nextCount;
  return {
    allowed: true,
    limit,
    requested,
    usage: nextCount,
    remaining,
  };
});

exports.ensureUserTier = onRequest({ cors: true }, async (req, res) => {
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
    const data = req.body?.data || {};

    const appId = typeof data.appId === 'string' ? data.appId : 'default-app-id';
    const userId = contextAuth.uid;
    const firestore = admin.firestore();
    const userDocRef = firestore.doc(
      `${getUsersCollectionPath(appId)}/${userId}`
    );

    const snapshot = await userDocRef.get();
    let normalized = normalizeUserDoc(
      snapshot.exists ? snapshot.data() : null,
      resolveDefaultTier(contextAuth)
    );

    if (!normalized.sharesFresh && normalized.sharesToday) {
      normalized = {
        ...normalized,
        tasks: {
          ...normalized.tasks,
          sharesToday: 0,
          sharesRecordedAt: null,
        },
        sharesToday: 0,
        shareBonus: 0,
      };
    }

    const payload = buildProfilePayload(userId, normalized, appId);

    const updates = {
      tier: normalized.tier,
      baseLimit: normalized.baseLimit,
      tasks: normalized.tasks,
      permanentBoost: normalized.permanentBoost,
      shareBonus: normalized.shareBonus,
      dailyLimit: payload.dailyLimit,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!snapshot.exists) {
      updates.createdAt = FieldValue.serverTimestamp();
    }

    await userDocRef.set(updates, { merge: true });

    logger.info('ensure_user_tier_success', {
      userId,
      tier: payload.tier,
      dailyLimit: payload.dailyLimit,
    });

    res.json({ data: payload });
  } catch (error) {
    logger.error('ensure_user_tier_error', error);
    const code = error.code || 'internal';
    const status = code === 'unauthenticated' ? 401 : 500;
    res.status(status).json({
      error: {
        code,
        message: error.message,
      },
    });
  }
});

exports.completeTask = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const taskId = request.data?.taskId;
  if (!taskId || typeof taskId !== 'string') {
    throw new HttpsError('invalid-argument', '任務識別碼無效');
  }

  const appId =
    typeof request.data?.appId === 'string'
      ? request.data.appId
      : 'default-app-id';
  const uid = request.auth.uid;
  const firestore = admin.firestore();
  const docRef = firestore.doc(`${getUsersCollectionPath(appId)}/${uid}`);

  const result = await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);
    const normalized = normalizeUserDoc(
      snapshot.exists ? snapshot.data() : null,
      resolveDefaultTier({ token: request.auth.token })
    );

    const mutableTasks = { ...normalized.tasks };
    const today = todayKey();

    switch (taskId) {
      case TASK_IDS.instagram:
        if (mutableTasks.instagram) {
          throw new HttpsError('failed-precondition', 'TASK_ALREADY_COMPLETED');
        }
        mutableTasks.instagram = true;
        break;

      case TASK_IDS.threads:
        if (mutableTasks.threads) {
          throw new HttpsError('failed-precondition', 'TASK_ALREADY_COMPLETED');
        }
        mutableTasks.threads = true;
        break;

      case TASK_IDS.submission: {
        const incrementBy = Number.isFinite(request.data?.count)
          ? Math.max(1, Math.floor(request.data.count))
          : 1;
        mutableTasks.submissionsApproved =
          (mutableTasks.submissionsApproved || 0) + incrementBy;
        break;
      }

      case TASK_IDS.invite: {
        const incrementBy = Number.isFinite(request.data?.count)
          ? Math.max(1, Math.floor(request.data.count))
          : 1;
        mutableTasks.invitesCompleted =
          (mutableTasks.invitesCompleted || 0) + incrementBy;
        break;
      }

      case TASK_IDS.share: {
        if (mutableTasks.sharesRecordedAt !== today) {
          mutableTasks.sharesRecordedAt = today;
          mutableTasks.sharesToday = 0;
        }
        const currentShares = mutableTasks.sharesToday || 0;
        if (currentShares >= SHARE_DAILY_CAP / SHARE_REWARD_PER_USE) {
          throw new HttpsError('failed-precondition', 'SHARE_LIMIT_REACHED');
        }
        mutableTasks.sharesToday = currentShares + 1;
        break;
      }

      default:
        throw new HttpsError('invalid-argument', '未知任務');
    }

    const permanentBoost = calculatePermanentBoost(mutableTasks);
    const shareBonus =
      mutableTasks.sharesRecordedAt === today
        ? Math.min(
            (mutableTasks.sharesToday || 0) * SHARE_REWARD_PER_USE,
            SHARE_DAILY_CAP
          )
        : 0;

    const baseLimit = determineBaseLimit(normalized.tier);
    const dailyLimit =
      normalized.tier === 'pro'
        ? PRO_LIMIT
        : baseLimit + permanentBoost + shareBonus;

    transaction.set(
      docRef,
      {
        tier: normalized.tier,
        baseLimit,
        tasks: mutableTasks,
        permanentBoost,
        shareBonus,
        dailyLimit,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      userId: uid,
      tier: normalized.tier,
      baseLimit,
      permanentBoost,
      shareBonus,
      dailyLimit,
      tasks: mutableTasks,
      appId,
    };
  });

  logger.info('complete_task_success', {
    uid,
    taskId,
    dailyLimit: result.dailyLimit,
  });

  return result;
});
