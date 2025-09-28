import { httpsCallable } from 'firebase/functions';
import {
  ensureFirebaseApp,
  ensureAuthUser,
  getAppId,
  getFirebaseFunctions,
} from './firebaseApp';

let syncCallable;
let unlinkCallable;

async function ensureCallables() {
  ensureFirebaseApp();
  await ensureAuthUser();
  const functionsInstance = getFirebaseFunctions();
  if (!syncCallable) {
    syncCallable = httpsCallable(functionsInstance, 'syncGoogleProvider');
  }
  if (!unlinkCallable) {
    unlinkCallable = httpsCallable(functionsInstance, 'unlinkGoogleProvider');
  }
}

export async function syncGoogleConnection({
  accessToken = null,
  idToken = null,
  profile = {},
  scope = null,
} = {}) {
  await ensureCallables();
  const response = await syncCallable({
    appId: getAppId(),
    accessToken,
    idToken,
    profile,
    scope,
  });
  return response.data;
}

export async function unlinkGoogleConnection() {
  await ensureCallables();
  const response = await unlinkCallable({
    appId: getAppId(),
  });
  return response.data;
}
