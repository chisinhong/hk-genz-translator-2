"use strict";
/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryPhrases = exports.unlinkGoogleProvider = exports.syncGoogleProvider = exports.unlinkMetaPlatform = exports.exchangeMetaCode = void 0;
const firebase_functions_1 = require("firebase-functions");
const logger = __importStar(require("firebase-functions/logger"));
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const searchSimilarPhrases_1 = require("./searchSimilarPhrases");
const node_crypto_1 = require("node:crypto");
(0, firebase_functions_1.setGlobalOptions)({ maxInstances: 10 });
(0, app_1.initializeApp)();
const firestore = (0, firestore_1.getFirestore)();
const GRAPH_VERSION = (_a = process.env.META_GRAPH_VERSION) !== null && _a !== void 0 ? _a : "v19.0";
const META_ALLOWED_REDIRECTS = ((_b = process.env.META_ALLOWED_REDIRECT_URIS) !== null && _b !== void 0 ? _b : "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const PLATFORM_CONFIG = {
    instagram: {
        appId: (_d = (_c = process.env.META_INSTAGRAM_APP_ID) !== null && _c !== void 0 ? _c : process.env.META_APP_ID) !== null && _d !== void 0 ? _d : "",
        appSecret: (_f = (_e = process.env.META_INSTAGRAM_APP_SECRET) !== null && _e !== void 0 ? _e : process.env.META_APP_SECRET) !== null && _f !== void 0 ? _f : "",
        tokenExchangeUrl: (_g = process.env.META_INSTAGRAM_TOKEN_URL) !== null && _g !== void 0 ? _g : "https://graph.instagram.com/oauth/access_token",
        profileUrl: (_h = process.env.META_INSTAGRAM_PROFILE_URL) !== null && _h !== void 0 ? _h : "https://graph.instagram.com/me?fields=id,username,account_type",
        defaultScopes: (_j = process.env.META_INSTAGRAM_SCOPES) !== null && _j !== void 0 ? _j : "instagram_basic",
    },
    threads: {
        appId: (_l = (_k = process.env.META_THREADS_APP_ID) !== null && _k !== void 0 ? _k : process.env.META_APP_ID) !== null && _l !== void 0 ? _l : "",
        appSecret: (_o = (_m = process.env.META_THREADS_APP_SECRET) !== null && _m !== void 0 ? _m : process.env.META_APP_SECRET) !== null && _o !== void 0 ? _o : "",
        tokenExchangeUrl: (_p = process.env.META_THREADS_TOKEN_URL) !== null && _p !== void 0 ? _p : `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
        profileUrl: (_q = process.env.META_THREADS_PROFILE_URL) !== null && _q !== void 0 ? _q : `https://graph.facebook.com/${GRAPH_VERSION}/me?fields=id,name`,
        defaultScopes: (_r = process.env.META_THREADS_SCOPES) !== null && _r !== void 0 ? _r : "public_profile",
    },
};
function resolveSelectedPlatform(existing) {
    if (!existing)
        return null;
    const rawSocial = existing.socialConnections;
    if (!rawSocial || typeof rawSocial !== "object")
        return null;
    const meta = rawSocial.meta;
    if (!meta || typeof meta !== "object")
        return null;
    const selected = meta.selectedPlatform;
    return selected === "instagram" || selected === "threads" ? selected : null;
}
function normalizeString(value) {
    if (typeof value !== "string")
        return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
}
function assertPlatformConfig(platform) {
    const config = PLATFORM_CONFIG[platform];
    if (!(config === null || config === void 0 ? void 0 : config.appId) || !(config === null || config === void 0 ? void 0 : config.appSecret)) {
        throw new https_1.HttpsError("failed-precondition", `Meta OAuth config missing for platform: ${platform}`);
    }
    return config;
}
function validateRedirectUri(redirectUri) {
    if (!redirectUri) {
        throw new https_1.HttpsError("invalid-argument", "redirectUri is required");
    }
    try {
        // eslint-disable-next-line no-new
        const parsed = new URL(redirectUri);
        if (!parsed.protocol.startsWith("http")) {
            throw new Error("Unsupported protocol");
        }
    }
    catch (error) {
        throw new https_1.HttpsError("invalid-argument", `Invalid redirectUri provided: ${redirectUri}`);
    }
    if (META_ALLOWED_REDIRECTS.length > 0 &&
        !META_ALLOWED_REDIRECTS.includes(redirectUri)) {
        throw new https_1.HttpsError("permission-denied", "redirectUri is not in the allow list");
    }
}
function normalizeProfile(data) {
    return {
        id: typeof data.id === "string" ? data.id : null,
        username: typeof data.username === "string" ? data.username : null,
        name: typeof data.name === "string" ? data.name : null,
        accountType: typeof data.account_type === "string" ? data.account_type :
            null,
    };
}
async function exchangeToken(config, code, redirectUri) {
    const fetchImpl = globalThis.fetch;
    if (!fetchImpl) {
        throw new https_1.HttpsError("failed-precondition", "Fetch API not available in runtime");
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
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new https_1.HttpsError("failed-precondition", `Meta token exchange failed: ${response.status} ${errorBody}`);
    }
    return await response.json();
}
async function fetchProfile(config, accessToken) {
    try {
        const fetchImpl = globalThis.fetch;
        if (!fetchImpl) {
            throw new https_1.HttpsError("failed-precondition", "Fetch API not available in runtime");
        }
        const separator = config.profileUrl.includes("?") ? "&" : "?";
        const profileResponse = await fetchImpl(`${config.profileUrl}${separator}access_token=${encodeURIComponent(accessToken)}`);
        if (!profileResponse.ok) {
            return null;
        }
        const raw = await profileResponse.json();
        return normalizeProfile(raw);
    }
    catch (error) {
        console.error("Meta profile fetch failed", error);
        return null;
    }
}
function buildUserDocPath(appId, uid) {
    return `artifacts/${appId}/private/metadata/users/${uid}`;
}
exports.exchangeMetaCode = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    const { auth, data } = request;
    if (!(auth === null || auth === void 0 ? void 0 : auth.uid)) {
        throw new https_1.HttpsError("unauthenticated", "User authentication required");
    }
    const payload = (data !== null && data !== void 0 ? data : {});
    const { platform, appId, code, redirectUri, scope } = payload;
    if (!platform || !["instagram", "threads"].includes(platform)) {
        throw new https_1.HttpsError("invalid-argument", "Unsupported platform");
    }
    if (!appId || typeof appId !== "string") {
        throw new https_1.HttpsError("invalid-argument", "appId is required");
    }
    if (!code || typeof code !== "string") {
        throw new https_1.HttpsError("invalid-argument", "OAuth code is required");
    }
    if (!redirectUri || typeof redirectUri !== "string") {
        throw new https_1.HttpsError("invalid-argument", "redirectUri is required");
    }
    validateRedirectUri(redirectUri);
    const config = assertPlatformConfig(platform);
    const tokenResponse = await exchangeToken(config, code, redirectUri);
    if (!tokenResponse.access_token) {
        throw new https_1.HttpsError("failed-precondition", "Meta token response missing access_token");
    }
    const now = Date.now();
    const expiresInSeconds = (_a = tokenResponse.expires_in) !== null && _a !== void 0 ? _a : null;
    const expiresAt = expiresInSeconds ? new Date(now + expiresInSeconds * 1000) :
        null;
    const profile = await fetchProfile(config, tokenResponse.access_token);
    const docRef = firestore.doc(buildUserDocPath(appId, auth.uid));
    const updateData = {
        "socialConnections.meta.selectedPlatform": platform,
        "socialConnections.meta.updatedAt": firestore_1.FieldValue.serverTimestamp(),
    };
    updateData[`socialConnections.meta.platforms.${platform}`] = {
        accessToken: tokenResponse.access_token,
        tokenType: (_b = tokenResponse.token_type) !== null && _b !== void 0 ? _b : "Bearer",
        expiresIn: expiresInSeconds,
        expiresAt,
        profile: profile !== null && profile !== void 0 ? profile : null,
        scope: scope !== null && scope !== void 0 ? scope : config.defaultScopes,
        linkedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    await docRef.set(updateData, { merge: true });
    return {
        platform,
        selectedPlatform: platform,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        profile,
    };
});
exports.unlinkMetaPlatform = (0, https_1.onCall)(async (request) => {
    const { auth, data } = request;
    if (!(auth === null || auth === void 0 ? void 0 : auth.uid)) {
        throw new https_1.HttpsError("unauthenticated", "User authentication required");
    }
    const payload = (data !== null && data !== void 0 ? data : {});
    const { platform, appId } = payload;
    if (!platform || !["instagram", "threads"].includes(platform)) {
        throw new https_1.HttpsError("invalid-argument", "Unsupported platform");
    }
    if (!appId || typeof appId !== "string") {
        throw new https_1.HttpsError("invalid-argument", "appId is required");
    }
    const docRef = firestore.doc(buildUserDocPath(appId, auth.uid));
    const snapshot = await docRef.get();
    const existing = snapshot.data();
    const selected = resolveSelectedPlatform(existing);
    const updateData = {
        "socialConnections.meta.updatedAt": firestore_1.FieldValue.serverTimestamp(),
    };
    updateData[`socialConnections.meta.platforms.${platform}`] = firestore_1.FieldValue.delete();
    if (selected === platform) {
        updateData["socialConnections.meta.selectedPlatform"] = firestore_1.FieldValue.delete();
    }
    await docRef.set(updateData, { merge: true });
    return {
        platform,
        selectedPlatform: selected === platform ? null : selected,
    };
});
exports.syncGoogleProvider = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const { auth, data } = request;
    if (!(auth === null || auth === void 0 ? void 0 : auth.uid)) {
        throw new https_1.HttpsError("unauthenticated", "User authentication required");
    }
    const payload = (data !== null && data !== void 0 ? data : {});
    const appId = normalizeString(payload.appId);
    if (!appId) {
        throw new https_1.HttpsError("invalid-argument", "appId is required");
    }
    const docRef = firestore.doc(buildUserDocPath(appId, auth.uid));
    const googleData = {
        providerId: "google.com",
        email: normalizeString((_a = payload.profile) === null || _a === void 0 ? void 0 : _a.email),
        displayName: normalizeString((_b = payload.profile) === null || _b === void 0 ? void 0 : _b.displayName),
        photoURL: normalizeString((_c = payload.profile) === null || _c === void 0 ? void 0 : _c.photoURL),
        uid: normalizeString((_d = payload.profile) === null || _d === void 0 ? void 0 : _d.uid),
        accessToken: normalizeString(payload.accessToken),
        idToken: normalizeString(payload.idToken),
        scope: normalizeString(payload.scope),
        linkedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    const updateData = {
        "socialConnections.providers.google": googleData,
        "socialConnections.providers.updatedAt": firestore_1.FieldValue.serverTimestamp(),
        "socialConnections.updatedAt": firestore_1.FieldValue.serverTimestamp(),
    };
    await docRef.set(updateData, { merge: true });
    return {
        provider: "google",
        email: (_e = googleData.email) !== null && _e !== void 0 ? _e : null,
        displayName: (_f = googleData.displayName) !== null && _f !== void 0 ? _f : null,
        photoURL: (_g = googleData.photoURL) !== null && _g !== void 0 ? _g : null,
    };
});
exports.unlinkGoogleProvider = (0, https_1.onCall)(async (request) => {
    const { auth, data } = request;
    if (!(auth === null || auth === void 0 ? void 0 : auth.uid)) {
        throw new https_1.HttpsError("unauthenticated", "User authentication required");
    }
    const payload = (data !== null && data !== void 0 ? data : {});
    const appId = normalizeString(payload.appId);
    if (!appId) {
        throw new https_1.HttpsError("invalid-argument", "appId is required");
    }
    const docRef = firestore.doc(buildUserDocPath(appId, auth.uid));
    const updateData = {
        "socialConnections.providers.google": firestore_1.FieldValue.delete(),
        "socialConnections.providers.updatedAt": firestore_1.FieldValue.serverTimestamp(),
        "socialConnections.updatedAt": firestore_1.FieldValue.serverTimestamp(),
    };
    await docRef.set(updateData, { merge: true });
    return {
        provider: "google",
        status: "unlinked",
    };
});
const MAX_TOP_K = 25;
exports.queryPhrases = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d, _e;
    const { auth, data } = request;
    const payload = (data !== null && data !== void 0 ? data : {});
    const query = typeof payload.query === "string" ? payload.query.trim() : "";
    if (!query) {
        throw new https_1.HttpsError("invalid-argument", "query must be a non-empty string");
    }
    const topK = clampNumber((_a = coerceNumber(payload.topK)) !== null && _a !== void 0 ? _a : undefined, 1, MAX_TOP_K, 5);
    const threshold = clampNumber((_b = coerceNumber(payload.threshold)) !== null && _b !== void 0 ? _b : undefined, 0, 1, 0.7);
    const requestId = safeRandomUUID();
    const totalStart = Date.now();
    logger.info("queryPhrases invoked", {
        uid: (_c = auth === null || auth === void 0 ? void 0 : auth.uid) !== null && _c !== void 0 ? _c : null,
        requestId,
        topK,
        threshold,
        queryLength: query.length,
    });
    let metricsSnapshot = null;
    try {
        const results = await (0, searchSimilarPhrases_1.searchSimilarPhrases)(query, topK, threshold, {
            onMetrics: (metrics) => {
                metricsSnapshot = metrics;
            },
        });
        const totalDurationMs = Date.now() - totalStart;
        const metricsPayload = { totalDurationMs };
        if (metricsSnapshot) {
            const snapshot = metricsSnapshot;
            metricsPayload.embeddingDurationMs = snapshot.embeddingDurationMs;
            metricsPayload.supabaseDurationMs = snapshot.supabaseDurationMs;
            metricsPayload.matchCount = snapshot.matchCount;
            metricsPayload.topSimilarity = snapshot.topSimilarity;
        }
        logger.info("queryPhrases completed", {
            uid: (_d = auth === null || auth === void 0 ? void 0 : auth.uid) !== null && _d !== void 0 ? _d : null,
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
    }
    catch (error) {
        logger.error("queryPhrases failed", {
            uid: (_e = auth === null || auth === void 0 ? void 0 : auth.uid) !== null && _e !== void 0 ? _e : null,
            requestId,
            queryLength: query.length,
            topK,
            threshold,
            durationMs: Date.now() - totalStart,
            metrics: metricsSnapshot,
            error,
        });
        throw new https_1.HttpsError("internal", "Failed to query similar phrases. Please try again later.");
    }
});
function safeRandomUUID() {
    try {
        return (0, node_crypto_1.randomUUID)();
    }
    catch (error) {
        return `query-${Date.now()}`;
    }
}
function coerceNumber(value) {
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
function clampNumber(value, min, max, fallback) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return fallback;
    }
    return Math.min(Math.max(value, min), max);
}
//# sourceMappingURL=index.js.map