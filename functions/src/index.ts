/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import * as logger from "firebase-functions/logger";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {searchSimilarPhrases} from "./searchSimilarPhrases";
import {randomUUID} from "node:crypto";

setGlobalOptions({maxInstances: 10});

initializeApp();

const firestore = getFirestore();
const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v19.0";

type MetaPlatform = "instagram" | "threads";

interface GoogleProfilePayload {
  email?: unknown;
  displayName?: unknown;
  photoURL?: unknown;
  uid?: unknown;
  providerId?: unknown;
}

interface GoogleConnectPayload {
  appId?: unknown;
  accessToken?: unknown;
  idToken?: unknown;
  profile?: GoogleProfilePayload;
  scope?: unknown;
}

type FetchFn = (
  input: string | URL,
  init?: Record<string, unknown>,
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

interface PlatformConfig {
  appId: string;
  appSecret: string;
  tokenExchangeUrl: string;
  profileUrl: string;
  defaultScopes: string;
}

const META_ALLOWED_REDIRECTS = (process.env.META_ALLOWED_REDIRECT_URIS ?? "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const PLATFORM_CONFIG: Record<MetaPlatform, PlatformConfig> = {
  instagram: {
    appId: process.env.META_INSTAGRAM_APP_ID ?? process.env.META_APP_ID ?? "",
    appSecret: process.env.META_INSTAGRAM_APP_SECRET ??
      process.env.META_APP_SECRET ?? "",
    tokenExchangeUrl: process.env.META_INSTAGRAM_TOKEN_URL ??
      "https://graph.instagram.com/oauth/access_token",
    profileUrl: process.env.META_INSTAGRAM_PROFILE_URL ??
      "https://graph.instagram.com/me?fields=id,username,account_type",
    defaultScopes: process.env.META_INSTAGRAM_SCOPES ?? "instagram_basic",
  },
  threads: {
    appId: process.env.META_THREADS_APP_ID ?? process.env.META_APP_ID ?? "",
    appSecret: process.env.META_THREADS_APP_SECRET ??
      process.env.META_APP_SECRET ?? "",
    tokenExchangeUrl: process.env.META_THREADS_TOKEN_URL ??
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
    profileUrl: process.env.META_THREADS_PROFILE_URL ??
      `https://graph.facebook.com/${GRAPH_VERSION}/me?fields=id,name`,
    defaultScopes: process.env.META_THREADS_SCOPES ?? "public_profile",
  },
};

function resolveSelectedPlatform(
  existing: Record<string, unknown> | undefined,
): MetaPlatform | null {
  if (!existing) return null;
  const rawSocial = existing.socialConnections;
  if (!rawSocial || typeof rawSocial !== "object") return null;
  const meta = (rawSocial as Record<string, unknown>).meta;
  if (!meta || typeof meta !== "object") return null;
  const selected = (meta as Record<string, unknown>).selectedPlatform;
  return selected === "instagram" || selected === "threads" ? selected : null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

interface MetaExchangeRequest {
  platform: MetaPlatform;
  appId: string;
  code: string;
  redirectUri: string;
  scope?: string;
}

interface TokenExchangeResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

interface ProfileSummary {
  id: string | null;
  username: string | null;
  name: string | null;
  accountType?: string | null;
}

function assertPlatformConfig(platform: MetaPlatform): PlatformConfig {
  const config = PLATFORM_CONFIG[platform];
  if (!config?.appId || !config?.appSecret) {
    throw new HttpsError(
      "failed-precondition",
      `Meta OAuth config missing for platform: ${platform}`,
    );
  }
  return config;
}

function validateRedirectUri(redirectUri: string) {
  if (!redirectUri) {
    throw new HttpsError("invalid-argument", "redirectUri is required");
  }

  try {
    // eslint-disable-next-line no-new
    const parsed = new URL(redirectUri);
    if (!parsed.protocol.startsWith("http")) {
      throw new Error("Unsupported protocol");
    }
  } catch (error) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid redirectUri provided: ${redirectUri}`,
    );
  }

  if (META_ALLOWED_REDIRECTS.length > 0 &&
    !META_ALLOWED_REDIRECTS.includes(redirectUri)) {
    throw new HttpsError(
      "permission-denied",
      "redirectUri is not in the allow list",
    );
  }
}

function normalizeProfile(data: Record<string, unknown>): ProfileSummary {
  return {
    id: typeof data.id === "string" ? data.id : null,
    username: typeof data.username === "string" ? data.username : null,
    name: typeof data.name === "string" ? data.name : null,
    accountType: typeof data.account_type === "string" ? data.account_type :
      null,
  };
}

async function exchangeToken(
  config: PlatformConfig,
  code: string,
  redirectUri: string,
): Promise<TokenExchangeResponse> {
  const fetchImpl = (globalThis as unknown as {fetch?: FetchFn}).fetch;
  if (!fetchImpl) {
    throw new HttpsError(
      "failed-precondition",
      "Fetch API not available in runtime",
    );
  }

  const form = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: redirectUri,
    code,
    grant_type: "authorization_code",
  });

  const response = await fetchImpl(config.tokenExchangeUrl, {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: form.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new HttpsError(
      "failed-precondition",
      `Meta token exchange failed: ${response.status} ${errorBody}`,
    );
  }

  return await response.json() as TokenExchangeResponse;
}

async function fetchProfile(
  config: PlatformConfig,
  accessToken: string,
): Promise<ProfileSummary | null> {
  try {
    const fetchImpl = (globalThis as unknown as {fetch?: FetchFn}).fetch;
    if (!fetchImpl) {
      throw new HttpsError(
        "failed-precondition",
        "Fetch API not available in runtime",
      );
    }
    const separator = config.profileUrl.includes("?") ? "&" : "?";
    const profileResponse = await fetchImpl(
      `${config.profileUrl}${separator}access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!profileResponse.ok) {
      return null;
    }
    const raw = await profileResponse.json() as Record<string, unknown>;
    return normalizeProfile(raw);
  } catch (error) {
    console.error("Meta profile fetch failed", error);
    return null;
  }
}

function buildUserDocPath(appId: string, uid: string) {
  return `artifacts/${appId}/private/metadata/users/${uid}`;
}

export const exchangeMetaCode = onCall(async (request) => {
  const {auth, data} = request;
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "User authentication required");
  }

  const payload = (data ?? {}) as Partial<MetaExchangeRequest>;
  const {platform, appId, code, redirectUri, scope} = payload;

  if (!platform || !["instagram", "threads"].includes(platform)) {
    throw new HttpsError("invalid-argument", "Unsupported platform");
  }
  if (!appId || typeof appId !== "string") {
    throw new HttpsError("invalid-argument", "appId is required");
  }
  if (!code || typeof code !== "string") {
    throw new HttpsError("invalid-argument", "OAuth code is required");
  }

  if (!redirectUri || typeof redirectUri !== "string") {
    throw new HttpsError("invalid-argument", "redirectUri is required");
  }
  validateRedirectUri(redirectUri);

  const config = assertPlatformConfig(platform);
  const tokenResponse = await exchangeToken(config, code, redirectUri);

  if (!tokenResponse.access_token) {
    throw new HttpsError(
      "failed-precondition",
      "Meta token response missing access_token",
    );
  }

  const now = Date.now();
  const expiresInSeconds = tokenResponse.expires_in ?? null;
  const expiresAt = expiresInSeconds ? new Date(now + expiresInSeconds * 1000) :
    null;

  const profile = await fetchProfile(config, tokenResponse.access_token);

  const docRef = firestore.doc(buildUserDocPath(appId, auth.uid));
  const updateData: Record<string, unknown> = {
    "socialConnections.meta.selectedPlatform": platform,
    "socialConnections.meta.updatedAt": FieldValue.serverTimestamp(),
  };

  updateData[`socialConnections.meta.platforms.${platform}`] = {
    accessToken: tokenResponse.access_token,
    tokenType: tokenResponse.token_type ?? "Bearer",
    expiresIn: expiresInSeconds,
    expiresAt,
    profile: profile ?? null,
    scope: scope ?? config.defaultScopes,
    linkedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await docRef.set(updateData, {merge: true});

  return {
    platform,
    selectedPlatform: platform,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    profile,
  };
});

export const unlinkMetaPlatform = onCall(async (request) => {
  const {auth, data} = request;
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "User authentication required");
  }

  const payload = (data ?? {}) as Partial<{platform: MetaPlatform; appId: string}>;
  const {platform, appId} = payload;

  if (!platform || !["instagram", "threads"].includes(platform)) {
    throw new HttpsError("invalid-argument", "Unsupported platform");
  }
  if (!appId || typeof appId !== "string") {
    throw new HttpsError("invalid-argument", "appId is required");
  }

  const docRef = firestore.doc(buildUserDocPath(appId, auth.uid));
  const snapshot = await docRef.get();
  const existing = snapshot.data() as Record<string, unknown> | undefined;
  const selected = resolveSelectedPlatform(existing);

  const updateData: Record<string, unknown> = {
    "socialConnections.meta.updatedAt": FieldValue.serverTimestamp(),
  };

  updateData[`socialConnections.meta.platforms.${platform}`] = FieldValue.delete();

  if (selected === platform) {
    updateData["socialConnections.meta.selectedPlatform"] = FieldValue.delete();
  }

  await docRef.set(updateData, {merge: true});

  return {
    platform,
    selectedPlatform: selected === platform ? null : selected,
  };
});

export const syncGoogleProvider = onCall(async (request) => {
  const {auth, data} = request;
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "User authentication required");
  }

  const payload = (data ?? {}) as GoogleConnectPayload;
  const appId = normalizeString(payload.appId);
  if (!appId) {
    throw new HttpsError("invalid-argument", "appId is required");
  }

  const docRef = firestore.doc(buildUserDocPath(appId, auth.uid));

  const googleData: Record<string, unknown> = {
    providerId: "google.com",
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

  const updateData: Record<string, unknown> = {
    "socialConnections.providers.google": googleData,
    "socialConnections.providers.updatedAt": FieldValue.serverTimestamp(),
    "socialConnections.updatedAt": FieldValue.serverTimestamp(),
  };

  await docRef.set(updateData, {merge: true});

  return {
    provider: "google",
    email: googleData.email ?? null,
    displayName: googleData.displayName ?? null,
    photoURL: googleData.photoURL ?? null,
  };
});

export const unlinkGoogleProvider = onCall(async (request) => {
  const {auth, data} = request;
  if (!auth?.uid) {
    throw new HttpsError("unauthenticated", "User authentication required");
  }

  const payload = (data ?? {}) as {appId?: unknown};
  const appId = normalizeString(payload.appId);
  if (!appId) {
    throw new HttpsError("invalid-argument", "appId is required");
  }

  const docRef = firestore.doc(buildUserDocPath(appId, auth.uid));
  const updateData: Record<string, unknown> = {
    "socialConnections.providers.google": FieldValue.delete(),
    "socialConnections.providers.updatedAt": FieldValue.serverTimestamp(),
    "socialConnections.updatedAt": FieldValue.serverTimestamp(),
  };

  await docRef.set(updateData, {merge: true});

  return {
    provider: "google",
    status: "unlinked",
  };
});

const MAX_TOP_K = 25;

export const queryPhrases = onCall(async (request) => {
  const {auth, data} = request;
  const payload = (data ?? {}) as {
    query?: unknown;
    topK?: unknown;
    threshold?: unknown;
  };

  const query = typeof payload.query === "string" ? payload.query.trim() : "";
  if (!query) {
    throw new HttpsError("invalid-argument", "query must be a non-empty string");
  }

  const topK = clampNumber(
    coerceNumber(payload.topK) ?? undefined,
    1,
    MAX_TOP_K,
    5,
  );

  const threshold = clampNumber(
    coerceNumber(payload.threshold) ?? undefined,
    0,
    1,
    0.7,
  );

  const requestId = safeRandomUUID();
  const totalStart = Date.now();

  logger.info("queryPhrases invoked", {
    uid: auth?.uid ?? null,
    requestId,
    topK,
    threshold,
    queryLength: query.length,
  });

  let metricsSnapshot: any = null;

  try {
    const results = await searchSimilarPhrases(query, topK, threshold, {
      onMetrics: (metrics) => {
        metricsSnapshot = metrics;
      },
    });

    const totalDurationMs = Date.now() - totalStart;
    const metricsPayload: {
      totalDurationMs: number;
      embeddingDurationMs?: number;
      supabaseDurationMs?: number;
      matchCount?: number;
      topSimilarity?: number | null;
    } = { totalDurationMs };

    if (metricsSnapshot) {
      const snapshot = metricsSnapshot;
      metricsPayload.embeddingDurationMs = snapshot.embeddingDurationMs;
      metricsPayload.supabaseDurationMs = snapshot.supabaseDurationMs;
      metricsPayload.matchCount = snapshot.matchCount;
      metricsPayload.topSimilarity = snapshot.topSimilarity;
    }

    logger.info("queryPhrases completed", {
      uid: auth?.uid ?? null,
      requestId,
      queryLength: query.length,
      topK,
      threshold,
      count: results.length,
      metrics: metricsPayload,
    });

    return {
      query,
      topK,
      threshold,
      count: results.length,
      metrics: metricsPayload,
      results: results.map((item, index) => ({
        rank: index + 1,
        phraseId: item.phraseId,
        phrase: item.phrase,
        similarity: item.similarity,
        distance: item.distance,
        metadata: item.metadata,
        translations: item.translations,
      })),
    };
  } catch (error) {
    logger.error("queryPhrases failed", {
      uid: auth?.uid ?? null,
      requestId,
      queryLength: query.length,
      topK,
      threshold,
      durationMs: Date.now() - totalStart,
      metrics: metricsSnapshot,
      error,
    });
    throw new HttpsError(
      "internal",
      "Failed to query similar phrases. Please try again later.",
    );
  }
});

function safeRandomUUID(): string {
  try {
    return randomUUID();
  } catch (error) {
    return `query-${Date.now()}`;
  }
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(value, min), max);
}
