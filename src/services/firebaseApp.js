/* global __firebase_config, __initial_auth_token, __app_id */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from 'firebase/auth';

let firebaseApp;
let firestoreDb;
let firebaseAuth;
let firebaseFunctions;
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

export function ensureFirebaseApp() {
  if (firebaseApp && firestoreDb && firebaseAuth) {
    return {
      app: firebaseApp,
      db: firestoreDb,
      auth: firebaseAuth,
    };
  }

  const config = resolveFirebaseConfig();
  if (!config) {
    throw new Error('Firebase 設定不存在或無效。');
  }

  try {
    if (getApps().length) {
      firebaseApp = getApp();
    } else {
      firebaseApp = initializeApp(config);
    }

    firestoreDb = getFirestore(firebaseApp);
    firebaseAuth = getAuth(firebaseApp);

    return {
      app: firebaseApp,
      db: firestoreDb,
      auth: firebaseAuth,
    };
  } catch (error) {
    console.error('初始化 Firebase 失敗:', error);
    throw new Error('初始化 Firebase 失敗。');
  }
}

export function getFirebaseFunctions() {
  const { app } = ensureFirebaseApp();

  if (!firebaseFunctions) {
    firebaseFunctions = getFunctions(app);
  }

  return firebaseFunctions;
}

export async function ensureAuthUser() {
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
      throw new Error('Firebase 認證失敗。');
    });
  }

  return authReadyPromise;
}

export function getAppId() {
  if (typeof __app_id !== 'undefined' && __app_id) {
    return __app_id;
  }

  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const envAppId = import.meta.env.VITE_FIREBASE_APP_ID;
    if (envAppId) {
      return envAppId;
    }
  }

  try {
    const { app } = ensureFirebaseApp();
    if (app?.options?.projectId) {
      return app.options.projectId;
    }
    if (app?.options?.appId) {
      return app.options.appId;
    }
  } catch (error) {
    console.warn('無法從 Firebase App 取得 appId:', error);
  }

  return 'default-app';
}

export function isFirebaseConfigured() {
  try {
    return Boolean(ensureFirebaseApp().app);
  } catch {
    return false;
  }
}
