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

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v19.0';

const META_ALLOWED_REDIRECTS = (process.env.META_ALLOWED_REDIRECT_URIS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const PLATFORM_CONFIG = {
  instagram: {
    appId:
      process.env.META_INSTAGRAM_APP_ID || process.env.META_APP_ID || '',
    appSecret:
      process.env.META_INSTAGRAM_APP_SECRET ||
      process.env.META_APP_SECRET ||
      '',
    tokenExchangeUrl:
      process.env.META_INSTAGRAM_TOKEN_URL ||
      'https://graph.instagram.com/oauth/access_token',
    profileUrl:
      process.env.META_INSTAGRAM_PROFILE_URL ||
      'https://graph.instagram.com/me?fields=id,username,account_type',
    defaultScopes: process.env.META_INSTAGRAM_SCOPES || 'instagram_basic',
  },
  threads: {
    appId: process.env.META_THREADS_APP_ID || process.env.META_APP_ID || '',
    appSecret:
      process.env.META_THREADS_APP_SECRET ||
      process.env.META_APP_SECRET ||
      '',
    tokenExchangeUrl:
      process.env.META_THREADS_TOKEN_URL ||
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
    profileUrl:
      process.env.META_THREADS_PROFILE_URL ||
      `https://graph.facebook.com/${GRAPH_VERSION}/me?fields=id,name`,
    defaultScopes: process.env.META_THREADS_SCOPES || 'public_profile',
  },
};

function normalizeString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function assertPlatformConfig(platform) {
  const config = PLATFORM_CONFIG[platform];
  if (!config || !config.appId || !config.appSecret) {
    throw new HttpsError(
      'failed-precondition',
      `Meta OAuth config missing for platform: ${platform}`
    );
  }
  return config;
}

function validateRedirectUri(redirectUri) {
  if (!redirectUri) {
    throw new HttpsError('invalid-argument', 'redirectUri is required');
  }

  try {
    // eslint-disable-next-line no-new
    const parsed = new URL(redirectUri);
    if (!parsed.protocol.startsWith('http')) {
      throw new Error('Unsupported protocol');
    }
  } catch (error) {
    throw new HttpsError(
      'invalid-argument',
      `Invalid redirectUri provided: ${redirectUri}`
    );
  }

  if (
    META_ALLOWED_REDIRECTS.length > 0 &&
    !META_ALLOWED_REDIRECTS.includes(redirectUri)
  ) {
    throw new HttpsError(
      'permission-denied',
      'redirectUri is not in the allow list'
    );
  }
}

function normalizeProfile(data) {
  return {
    id: typeof data.id === 'string' ? data.id : null,
    username: typeof data.username === 'string' ? data.username : null,
    name: typeof data.name === 'string' ? data.name : null,
    accountType:
      typeof data.account_type === 'string' ? data.account_type : null,
  };
}

async function exchangeToken(config, code, redirectUri) {
  const fetchImpl = globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new HttpsError(
      'failed-precondition',
      'Fetch API not available in runtime'
    );
  }

  const form = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: redirectUri,
    code,
    grant_type: 'authorization_code',
  });

  const response = await fetchImpl(config.tokenExchangeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new HttpsError(
      'failed-precondition',
      `Meta token exchange failed: ${response.status} ${errorBody}`
    );
  }

  return response.json();
}

async function fetchProfile(config, accessToken) {
  try {
    const fetchImpl = globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new HttpsError(
        'failed-precondition',
        'Fetch API not available in runtime'
      );
    }
    const separator = config.profileUrl.includes('?') ? '&' : '?';
    const profileResponse = await fetchImpl(
      `${config.profileUrl}${separator}access_token=${encodeURIComponent(
        accessToken
      )}`
    );
    if (!profileResponse.ok) {
      return null;
    }
    const raw = await profileResponse.json();
    return normalizeProfile(raw || {});
  } catch (error) {
    logger.error('Meta profile fetch failed', error);
    return null;
  }
}

function resolveSelectedPlatform(existing) {
  if (!existing || typeof existing !== 'object') return null;
  const rawSocial = existing.socialConnections;
  if (!rawSocial || typeof rawSocial !== 'object') return null;
  const meta = rawSocial.meta;
  if (!meta || typeof meta !== 'object') return null;
  const selected = meta.selectedPlatform;
  return selected === 'instagram' || selected === 'threads' ? selected : null;
}

function buildUserDocPath(appId, uid) {
  return `artifacts/${appId}/private/metadata/users/${uid}`;
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

exports.exchangeMetaCode = onCall(async (request) => {
  const { auth, data } = request;
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'User authentication required');
  }

  const payload = data || {};
  const platform = payload.platform;
  const appId = normalizeString(payload.appId);
  const code = normalizeString(payload.code);
  const redirectUri = normalizeString(payload.redirectUri);
  const scope = normalizeString(payload.scope);

  if (platform !== 'instagram' && platform !== 'threads') {
    throw new HttpsError('invalid-argument', 'Unsupported platform');
  }
  if (!appId) {
    throw new HttpsError('invalid-argument', 'appId is required');
  }
  if (!code) {
    throw new HttpsError('invalid-argument', 'OAuth code is required');
  }
  if (!redirectUri) {
    throw new HttpsError('invalid-argument', 'redirectUri is required');
  }

  validateRedirectUri(redirectUri);

  const config = assertPlatformConfig(platform);
  const tokenResponse = await exchangeToken(config, code, redirectUri);

  if (!tokenResponse || !tokenResponse.access_token) {
    throw new HttpsError(
      'failed-precondition',
      'Meta token response missing access_token'
    );
  }

  const now = Date.now();
  const expiresInSeconds =
    typeof tokenResponse.expires_in === 'number'
      ? tokenResponse.expires_in
      : null;
  const expiresAt = expiresInSeconds
    ? new Date(now + expiresInSeconds * 1000)
    : null;

  const profile = await fetchProfile(config, tokenResponse.access_token);

  const firestore = admin.firestore();
  const docRef = firestore.doc(buildUserDocPath(appId, auth.uid));
  const updateData = {
    'socialConnections.meta.selectedPlatform': platform,
    'socialConnections.meta.updatedAt': FieldValue.serverTimestamp(),
  };

  updateData[`socialConnections.meta.platforms.${platform}`] = {
    accessToken: tokenResponse.access_token,
    tokenType: tokenResponse.token_type || 'Bearer',
    expiresIn: expiresInSeconds,
    expiresAt,
    profile: profile || null,
    scope: scope || config.defaultScopes,
    linkedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await docRef.set(updateData, { merge: true });

  return {
    platform,
    selectedPlatform: platform,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    profile,
  };
});

exports.unlinkMetaPlatform = onCall(async (request) => {
  const { auth, data } = request;
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'User authentication required');
  }

  const payload = data || {};
  const platform = payload.platform;
  const appId = normalizeString(payload.appId);

  if (platform !== 'instagram' && platform !== 'threads') {
    throw new HttpsError('invalid-argument', 'Unsupported platform');
  }
  if (!appId) {
    throw new HttpsError('invalid-argument', 'appId is required');
  }

  const firestore = admin.firestore();
  const docRef = firestore.doc(buildUserDocPath(appId, auth.uid));
  const snapshot = await docRef.get();
  const existing = snapshot.exists ? snapshot.data() : undefined;
  const selected = resolveSelectedPlatform(existing);

  const updateData = {
    'socialConnections.meta.updatedAt': FieldValue.serverTimestamp(),
  };

  updateData[`socialConnections.meta.platforms.${platform}`] =
    FieldValue.delete();

  if (selected === platform) {
    updateData['socialConnections.meta.selectedPlatform'] = FieldValue.delete();
  }

  await docRef.set(updateData, { merge: true });

  return {
    platform,
    selectedPlatform: selected === platform ? null : selected,
  };
});

exports.syncGoogleProvider = onCall(async (request) => {
  const { auth, data } = request;
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'User authentication required');
  }

  const payload = data || {};
  const appId = normalizeString(payload.appId);
  if (!appId) {
    throw new HttpsError('invalid-argument', 'appId is required');
  }

  const firestore = admin.firestore();
  const docRef = firestore.doc(buildUserDocPath(appId, auth.uid));

  const googleData = {
    providerId: 'google.com',
    email: normalizeString(payload.profile?.email),
    displayName: normalizeString(payload.profile?.displayName),
    photoURL: normalizeString(payload.profile?.photoURL),
    uid: normalizeString(payload.profile?.uid),
    accessToken: normalizeString(payload.accessToken),
    idToken: normalizeString(payload.idToken),
    scope: normalizeString(payload.scope),
    linkedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await docRef.set(
    {
      'socialConnections.providers.google': googleData,
      'socialConnections.providers.updatedAt': FieldValue.serverTimestamp(),
      'socialConnections.updatedAt': FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    provider: 'google',
    email: googleData.email || null,
    displayName: googleData.displayName || null,
    photoURL: googleData.photoURL || null,
  };
});

exports.unlinkGoogleProvider = onCall(async (request) => {
  const { auth, data } = request;
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'User authentication required');
  }

  const payload = data || {};
  const appId = normalizeString(payload.appId);
  if (!appId) {
    throw new HttpsError('invalid-argument', 'appId is required');
  }

  const firestore = admin.firestore();
  const docRef = firestore.doc(buildUserDocPath(appId, auth.uid));

  await docRef.set(
    {
      'socialConnections.providers.google': FieldValue.delete(),
      'socialConnections.providers.updatedAt': FieldValue.serverTimestamp(),
      'socialConnections.updatedAt': FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    provider: 'google',
    status: 'unlinked',
  };
});
