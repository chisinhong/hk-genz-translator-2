import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  ensureFirebaseApp,
  getAppId,
  getFirebaseFunctions,
} from './firebaseApp';

let ensureTierCallable;

function getUserDocRef(userId) {
  const { db } = ensureFirebaseApp();
  const appId = getAppId();
  return doc(db, `artifacts/${appId}/private/metadata/users/${userId}`);
}

export async function ensureUserTierProfile() {
  const { auth } = ensureFirebaseApp();
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('AUTH_REQUIRED');
  }

  const functionsInstance = getFirebaseFunctions();
  if (!ensureTierCallable) {
    ensureTierCallable = httpsCallable(functionsInstance, 'ensureUserTier');
  }

  const response = await ensureTierCallable({ appId: getAppId() });
  return response.data;
}

export function subscribeToUserProfile(userId, callback) {
  const docRef = getUserDocRef(userId);
  return onSnapshot(docRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.data() : null);
  });
}

export { getUserDocRef };
