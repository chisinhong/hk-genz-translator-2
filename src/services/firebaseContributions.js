import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from 'firebase/auth';

let firebaseApp;
let firestoreDb;
let firebaseAuth;
let authReadyPromise;

function parseFirebaseConfig(rawConfig) {
  if (!rawConfig) {
    return null;
  }

  if (typeof rawConfig === 'string') {
    try {
      return JSON.parse(rawConfig);
    } catch (error) {
      console.error('解析 Firebase 設定失敗:', error);
      return null;
    }
  }

  if (typeof rawConfig === 'object') {
    return rawConfig;
  }

  return null;
}

function resolveFirebaseConfig() {
  if (typeof __firebase_config !== 'undefined') {
    const config = parseFirebaseConfig(__firebase_config);
    if (config) {
      return config;
    }
  }

  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const envConfig = import.meta.env.VITE_FIREBASE_CONFIG;
    if (envConfig) {
      const parsed = parseFirebaseConfig(envConfig);
      if (parsed) {
        return parsed;
      }
    }
  }

  return null;
}

function ensureFirebaseApp() {
  if (firebaseApp && firestoreDb && firebaseAuth) {
    return { app: firebaseApp, db: firestoreDb, auth: firebaseAuth };
  }

  const config = resolveFirebaseConfig();
  if (!config) {
    throw new Error('Firebase 設定不存在或無效，無法提交貢獻。');
  }

  try {
    if (getApps().length) {
      firebaseApp = getApp();
    } else {
      firebaseApp = initializeApp(config);
    }
    firestoreDb = getFirestore(firebaseApp);
    firebaseAuth = getAuth(firebaseApp);

    return { app: firebaseApp, db: firestoreDb, auth: firebaseAuth };
  } catch (error) {
    console.error('初始化 Firebase 失敗:', error);
    throw new Error('初始化 Firebase 失敗，請稍後再試。');
  }
}

async function ensureAuthUser() {
  const { auth } = ensureFirebaseApp();

  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve, reject) => {
      let settled = false;

      const unsubscribe = onAuthStateChanged(
        auth,
        (user) => {
          if (user) {
            settled = true;
            unsubscribe();
            resolve(user);
          }
        },
        (error) => {
          if (!settled) {
            settled = true;
            unsubscribe();
            reject(error);
          }
        }
      );

      const performSignIn = async () => {
        try {
          if (
            typeof __initial_auth_token !== 'undefined' &&
            __initial_auth_token
          ) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        } catch (error) {
          if (!settled) {
            settled = true;
            unsubscribe();
            reject(error);
          }
        }
      };

      void performSignIn();
    }).catch((error) => {
      authReadyPromise = null;
      console.error('Firebase 認證失敗:', error);
      throw new Error('Firebase 認證失敗，請稍後再試。');
    });
  }

  return authReadyPromise;
}

export async function submitContributionToFirebase(contribution) {
  const { db } = ensureFirebaseApp();
  if (!db) {
    throw new Error('Firestore 尚未初始化，無法提交貢獻。');
  }

  const user = await ensureAuthUser();
  const appId =
    typeof __app_id !== 'undefined' && __app_id ? __app_id : 'default-app-id';

  const createdAt = new Date();

  try {
    const docRef = await addDoc(
      collection(db, `artifacts/${appId}/public/data/contributions`),
      {
        ...contribution,
        userId: user.uid,
        status: 'pending',
        createdAt,
      }
    );

    return {
      firestoreId: docRef.id,
      userId: user.uid,
      status: 'pending',
      createdAt: createdAt.toISOString(),
      ...contribution,
    };
  } catch (error) {
    console.error('寫入 Firestore 失敗:', error);
    throw new Error('提交至伺服器失敗，請稍後再試。');
  }
}

export function isFirebaseConfigured() {
  try {
    return Boolean(ensureFirebaseApp().app);
  } catch (error) {
    return false;
  }
}
