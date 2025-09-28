import { httpsCallable } from 'firebase/functions';
import {
  ensureFirebaseApp,
  ensureAuthUser,
  getAppId,
  getFirebaseFunctions,
} from './firebaseApp';

const SUPPORTED_PLATFORMS = ['instagram', 'threads'];
const STATE_PREFIX = 'meta_oauth_state:';

function resolveAppIdForPlatform(platform) {
  const upper = platform.toUpperCase();
  return (
    import.meta.env[`VITE_META_${upper}_APP_ID`]
    || import.meta.env.VITE_META_APP_ID
    || ''
  );
}

function resolveScopesForPlatform(platform) {
  const upper = platform.toUpperCase();
  return (
    import.meta.env[`VITE_META_${upper}_SCOPES`]
    || import.meta.env.VITE_META_DEFAULT_SCOPES
    || (platform === 'instagram' ? 'instagram_basic' : 'public_profile')
  );
}

function resolveAuthUrl() {
  return (
    import.meta.env.VITE_META_AUTH_URL
    || `https://www.facebook.com/${import.meta.env.VITE_META_GRAPH_VERSION || 'v19.0'}/dialog/oauth`
  );
}

function resolveRedirectUri() {
  if (import.meta.env.VITE_META_REDIRECT_URI) {
    return import.meta.env.VITE_META_REDIRECT_URI;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/meta-callback`;
  }
  return '/meta-callback';
}

function storageKey(state) {
  return `${STATE_PREFIX}${state}`;
}

function persistState(state, payload) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    sessionStorage.setItem(storageKey(state), JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to persist Meta OAuth state', error);
  }
}

function readState(state) {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(storageKey(state));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to read Meta OAuth state', error);
    return null;
  }
}

function clearState(state) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    sessionStorage.removeItem(storageKey(state));
  } catch (error) {
    console.warn('Failed to clear Meta OAuth state', error);
  }
}

export function consumeOAuthState(state) {
  const data = readState(state);
  clearState(state);
  return data;
}

export function startMetaOAuth(platform) {
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    throw new Error('Unsupported Meta platform');
  }

  const clientId = resolveAppIdForPlatform(platform);
  if (!clientId) {
    throw new Error('Meta App ID is not configured');
  }

  if (typeof window === 'undefined') {
    throw new Error('OAuth flow can only run in the browser');
  }

  const redirectUri = resolveRedirectUri();
  const state = crypto.randomUUID();
  const scope = resolveScopesForPlatform(platform);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    response_type: 'code',
    state,
  });

  persistState(state, {
    platform,
    redirectUri,
    scope,
    createdAt: Date.now(),
  });

  const authUrl = `${resolveAuthUrl()}?${params.toString()}`;
  window.location.assign(authUrl);
}

let exchangeCallable;
let unlinkCallable;

async function ensureCallables() {
  ensureFirebaseApp();
  await ensureAuthUser();
  const functionsInstance = getFirebaseFunctions();
  if (!exchangeCallable) {
    exchangeCallable = httpsCallable(functionsInstance, 'exchangeMetaCode');
  }
  if (!unlinkCallable) {
    unlinkCallable = httpsCallable(functionsInstance, 'unlinkMetaPlatform');
  }
}

export async function exchangeMetaOAuthCode({ platform, code, redirectUri, scope }) {
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    throw new Error('Unsupported Meta platform');
  }
  if (!code) {
    throw new Error('OAuth code missing');
  }

  await ensureCallables();
  const response = await exchangeCallable({
    appId: getAppId(),
    platform,
    code,
    redirectUri,
    scope,
  });

  return response.data;
}

export async function unlinkMetaPlatform(platform) {
  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    throw new Error('Unsupported Meta platform');
  }

  await ensureCallables();
  const response = await unlinkCallable({
    appId: getAppId(),
    platform,
  });

  return response.data;
}

export function getMetaPlatformLabel(platform) {
  switch (platform) {
    case 'instagram':
      return 'Instagram';
    case 'threads':
      return 'Threads';
    default:
      return platform;
  }
}

export function getMetaRedirectUri() {
  return resolveRedirectUri();
}

export function getMetaScopes(platform) {
  return resolveScopesForPlatform(platform);
}
