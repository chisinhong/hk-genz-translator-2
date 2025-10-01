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
  const { auth } = ensureFirebaseApp();
  await ensureAuthUser();

  if (auth?.currentUser) {
    try {
      await auth.currentUser.getIdToken(true);
    } catch (error) {
      console.warn('Failed to refresh ID token before syncGoogleProvider', error);
    }
  }

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
