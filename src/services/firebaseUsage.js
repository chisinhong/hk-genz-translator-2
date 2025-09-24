import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { ensureFirebaseApp, getAppId } from './firebaseApp';

const COLLECTION_PATH = 'translatorUsage';

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getUsageDocRef() {
  const { db, auth } = ensureFirebaseApp();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('AUTH_REQUIRED');
  }
  const appId = getAppId();
  const docRef = doc(db, `artifacts/${appId}/public/data/${COLLECTION_PATH}`, user.uid);
  return { docRef, user };
}

export async function fetchTodayUsage() {
  const { docRef, user } = getUsageDocRef();
  const snapshot = await getDoc(docRef);
  const todayKey = getTodayKey();

  const data = snapshot.exists() ? snapshot.data() : {};
  const counts = data?.counts || {};

  const countForToday = typeof counts[todayKey] === 'number' ? counts[todayKey] : 0;

  return {
    userId: user.uid,
    todayKey,
    count: countForToday,
    updatedAt: data?.lastTranslationAt || null,
  };
}

export async function incrementTodayUsage() {
  const { docRef, user } = getUsageDocRef();
  const todayKey = getTodayKey();

  await setDoc(
    docRef,
    {
      userId: user.uid,
      counts: {},
    },
    { merge: true }
  );

  await updateDoc(docRef, {
    [`counts.${todayKey}`]: increment(1),
    lastTranslationAt: serverTimestamp(),
  });

  return {
    userId: user.uid,
    todayKey,
  };
}
