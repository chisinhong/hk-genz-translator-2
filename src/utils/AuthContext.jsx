/* eslint-disable react-refresh/only-export-components -- Provider plus hook */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  signOut,
  unlink,
  updateProfile,
} from 'firebase/auth';
import { ensureFirebaseApp } from '../services/firebaseApp';
import {
  ensureUserTierProfile,
  subscribeToUserProfile,
} from '../services/userProfile';
import {
  syncGoogleConnection,
  unlinkGoogleConnection,
} from '../services/googleAuthService';

const BASE_LIMITS = {
  guest: 3,
  registered: 10,
  pro: 200,
};

const TASK_PERMANENT_REWARD = 5;
const SHARE_REWARD_PER_USE = 2;
const SHARE_DAILY_CAP = 10;
const ISO_DATE_LENGTH = 10;

const DEFAULT_TASKS = {
  instagram: false,
  threads: false,
  submissionsApproved: 0,
  invitesCompleted: 0,
  sharesToday: 0,
  sharesRecordedAt: null,
};

const META_PLATFORMS = ['instagram', 'threads'];
const GOOGLE_SCOPES = ['profile', 'email'];

function createDefaultSocialConnections() {
  return {
    meta: {
      selectedPlatform: null,
      updatedAt: null,
      platforms: META_PLATFORMS.reduce((acc, platform) => {
        acc[platform] = null;
        return acc;
      }, {}),
    },
    providers: {
      google: null,
      updatedAt: null,
    },
  };
}

function createEmptyTasks() {
  return { ...DEFAULT_TASKS };
}

function isObjectLike(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSocialConnections(rawConnections = null) {
  if (!isObjectLike(rawConnections)) {
    return createDefaultSocialConnections();
  }

  const meta = isObjectLike(rawConnections.meta)
    ? rawConnections.meta
    : {};
  const platforms = isObjectLike(meta.platforms) ? meta.platforms : {};

  const normalizedPlatforms = META_PLATFORMS.reduce((acc, platform) => {
    const platformData = platforms[platform];
    acc[platform] = isObjectLike(platformData) ? platformData : null;
    return acc;
  }, {});

  const selected =
    meta.selectedPlatform === 'instagram' || meta.selectedPlatform === 'threads'
      ? meta.selectedPlatform
      : null;

  return {
    meta: {
      selectedPlatform: selected,
      updatedAt: meta.updatedAt ?? null,
      platforms: normalizedPlatforms,
    },
    providers: {
      google: isObjectLike(rawConnections.providers)
        ? rawConnections.providers.google || null
        : null,
      updatedAt: isObjectLike(rawConnections.providers)
        ? rawConnections.providers.updatedAt || null
        : null,
    },
  };
}

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  GOOGLE_SCOPES.forEach((scope) => provider.addScope(scope));
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

function getTodayKey() {
  return new Date().toISOString().slice(0, ISO_DATE_LENGTH);
}

function normalizeTasks(rawTasks = {}) {
  const today = getTodayKey();
  const merged = { ...createEmptyTasks(), ...rawTasks };
  const sharesFresh = merged.sharesRecordedAt === today;
  return {
    ...merged,
    sharesToday: sharesFresh ? merged.sharesToday || 0 : 0,
    sharesRecordedAt: sharesFresh ? today : null,
  };
}

function calculatePermanentBoost(tasks) {
  if (!tasks) return 0;
  const instagramBoost = tasks.instagram ? TASK_PERMANENT_REWARD : 0;
  const threadsBoost = tasks.threads ? TASK_PERMANENT_REWARD : 0;
  const submissionBoost = (tasks.submissionsApproved || 0) * TASK_PERMANENT_REWARD;
  const inviteBoost = (tasks.invitesCompleted || 0) * TASK_PERMANENT_REWARD;
  return instagramBoost + threadsBoost + submissionBoost + inviteBoost;
}

function calculateShareBonus(tasks) {
  if (!tasks) return 0;
  const shares = Number.isFinite(tasks.sharesToday) ? tasks.sharesToday : 0;
  return Math.min(shares * SHARE_REWARD_PER_USE, SHARE_DAILY_CAP);
}

function defaultTierForUser(user) {
  if (!user) return 'guest';
  return user.isAnonymous ? 'guest' : 'registered';
}

function baseLimitForTier(tier) {
  return BASE_LIMITS[tier] ?? BASE_LIMITS.guest;
}

const AuthContext = createContext(null);

const DEFAULT_STATE = {
  user: null,
  tier: 'guest',
  baseLimit: BASE_LIMITS.guest,
  permanentBoost: 0,
  shareBonus: 0,
  dailyLimit: BASE_LIMITS.guest,
  tasks: createEmptyTasks(),
  socialConnections: createDefaultSocialConnections(),
  loading: true,
  actionPending: false,
  error: null,
};

export const AuthProvider = ({ children }) => {
  const [state, setState] = useState(DEFAULT_STATE);
  const {
    user,
    tier,
    baseLimit,
    permanentBoost,
    shareBonus,
    dailyLimit,
    tasks,
    socialConnections,
    loading,
    actionPending,
    error,
  } = state;
  const unsubscribeProfileRef = useRef(null);

  useEffect(() => {
    try {
      const { auth } = ensureFirebaseApp();
      void setPersistence(auth, browserLocalPersistence).catch((error) => {
        console.warn('設定 Firebase 認證持久化失敗:', error);
      });
    } catch (error) {
      console.warn('初始化 Firebase 認證持久化時發生錯誤:', error);
    }
  }, []);

  const applyProfileData = useCallback((profileData, userOverride = null) => {
    setState((prev) => {
      const resolvedUser = userOverride ?? prev.user;
      const tierFromProfile = profileData?.tier;
      let resolvedTier = tierFromProfile
        || prev.tier
        || defaultTierForUser(resolvedUser)
        || 'guest';

      if (resolvedUser && !resolvedUser.isAnonymous && resolvedTier === 'guest') {
        resolvedTier = 'registered';
      }

      const normalizedTasks = normalizeTasks(profileData?.tasks);

      const minimumBaseLimit = baseLimitForTier(resolvedTier);
      const resolvedBaseLimitRaw = Number.isFinite(profileData?.baseLimit)
        ? profileData.baseLimit
        : minimumBaseLimit;
      const resolvedBaseLimit = Math.max(resolvedBaseLimitRaw, minimumBaseLimit);

      const resolvedPermanentBoost = Number.isFinite(profileData?.permanentBoost)
        ? profileData.permanentBoost
        : calculatePermanentBoost(normalizedTasks);

      const resolvedShareBonus = Number.isFinite(profileData?.shareBonus)
        ? profileData.shareBonus
        : calculateShareBonus(normalizedTasks);

      const minimumDailyLimit =
        resolvedTier === 'pro'
          ? BASE_LIMITS.pro
          : baseLimitForTier(resolvedTier) +
            resolvedPermanentBoost +
            resolvedShareBonus;

      const resolvedDailyLimitRaw = Number.isFinite(profileData?.dailyLimit)
        ? profileData.dailyLimit
        : resolvedTier === 'pro'
          ? BASE_LIMITS.pro
          : resolvedBaseLimit + resolvedPermanentBoost + resolvedShareBonus;

      const resolvedDailyLimit = Math.max(
        resolvedDailyLimitRaw,
        minimumDailyLimit
      );

      const resolvedSocialConnections = normalizeSocialConnections(
        profileData?.socialConnections
      );

      return {
        ...prev,
        user: resolvedUser ?? prev.user,
        tier: resolvedTier,
        baseLimit: resolvedBaseLimit,
        permanentBoost: resolvedPermanentBoost,
        shareBonus: resolvedShareBonus,
        dailyLimit: resolvedDailyLimit,
        tasks: normalizedTasks,
        socialConnections: resolvedSocialConnections,
        loading: false,
        actionPending: false,
        error: null,
      };
    });
  }, []);

  useEffect(() => {
    let auth;
    let isMounted = true;

    try {
      ({ auth } = ensureFirebaseApp());
    } catch (initError) {
      console.warn('Firebase 未配置，使用離線模式:', initError);
      if (isMounted) {
        setState({
          user: null,
          tier: 'guest',
          baseLimit: BASE_LIMITS.guest,
          permanentBoost: 0,
          shareBonus: 0,
          dailyLimit: BASE_LIMITS.guest,
          tasks: createEmptyTasks(),
          socialConnections: createDefaultSocialConnections(),
          loading: false,
          actionPending: false,
          error: initError,
        });
      }
      return () => {
        isMounted = false;
      };
    }

    const cleanupProfileSubscription = () => {
      if (unsubscribeProfileRef.current) {
        unsubscribeProfileRef.current();
        unsubscribeProfileRef.current = null;
      }
    };

    const attachProfileListener = (uid) => {
      cleanupProfileSubscription();
      if (!uid) return;
      unsubscribeProfileRef.current = subscribeToUserProfile(uid, (profile) => {
        if (!isMounted) return;
        applyProfileData(profile);
      });
    };

    const handleUserChange = async (firebaseUser) => {
      if (!isMounted) {
        return;
      }

      if (!firebaseUser) {
        setState((prev) => ({ ...prev, loading: true }));
        try {
          await signInAnonymously(auth);
        } catch (authError) {
          console.error('匿名登入失敗:', authError);
          if (isMounted) {
            setState({
              user: null,
              tier: 'guest',
              loading: false,
              actionPending: false,
              socialConnections: createDefaultSocialConnections(),
              error: authError,
            });
          }
        }
        return;
      }

      attachProfileListener(firebaseUser.uid);

      setState((prev) => ({
        ...prev,
        user: firebaseUser,
        loading: true,
      }));

      try {
        const profile = await ensureUserTierProfile();
        if (!isMounted) return;
        applyProfileData(profile, firebaseUser);
      } catch (profileError) {
        console.error('載入用戶層級失敗:', profileError);
        if (!isMounted) return;
        applyProfileData(null, firebaseUser);
        setState((prev) => ({ ...prev, error: profileError }));
      }
    };

    const unsubscribe = onAuthStateChanged(auth, handleUserChange);

    return () => {
      isMounted = false;
      unsubscribe();
      cleanupProfileSubscription();
    };
  }, [applyProfileData]);

  const setActionState = useCallback((pending, actionError = null) => {
    setState((prev) => ({
      ...prev,
      actionPending: pending,
      error: actionError,
    }));
  }, []);

  const signIn = useCallback(async (email, password) => {
    const trimmedEmail = email?.trim();
    const trimmedPassword = password?.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setActionState(false, new Error('請輸入電郵及密碼')); 
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    const { auth } = ensureFirebaseApp();
    setActionState(true);

    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      const profile = await ensureUserTierProfile();
      applyProfileData(profile);
      setActionState(false, null);
      return { success: true };
    } catch (signInError) {
      console.error('登入失敗:', signInError);
      setActionState(false, signInError);
      return { success: false, error: signInError };
    }
  }, [setActionState, applyProfileData]);

  const register = useCallback(
    async (email, password, displayName) => {
      const trimmedEmail = email?.trim();
      const trimmedPassword = password?.trim();
      if (!trimmedEmail || !trimmedPassword) {
        setActionState(false, new Error('請輸入電郵及密碼'));
        return { success: false, error: 'INVALID_CREDENTIALS' };
      }

      const { auth } = ensureFirebaseApp();
      setActionState(true);

      try {
        let credentialUser;
        if (auth.currentUser && auth.currentUser.isAnonymous) {
          const credential = EmailAuthProvider.credential(
            trimmedEmail,
            trimmedPassword
          );
          const linkedUser = await linkWithCredential(
            auth.currentUser,
            credential
          );
          credentialUser = linkedUser.user;
        } else {
          const created = await createUserWithEmailAndPassword(
            auth,
            trimmedEmail,
            trimmedPassword
          );
          credentialUser = created.user;
        }

        if (displayName && credentialUser) {
          try {
            await updateProfile(credentialUser, { displayName });
          } catch (profileError) {
            console.warn('更新使用者名稱失敗:', profileError);
          }
        }

        const profile = await ensureUserTierProfile();
        applyProfileData(profile, credentialUser);
        setActionState(false, null);

        return { success: true };
      } catch (registerError) {
        console.error('註冊失敗:', registerError);
        setActionState(false, registerError);
        return { success: false, error: registerError };
      }
    },
    [setActionState, applyProfileData]
  );

  const signInWithGoogle = useCallback(async () => {
    const { auth } = ensureFirebaseApp();
    setActionState(true);

    const provider = createGoogleProvider();
    const scopeString = GOOGLE_SCOPES.join(' ');

    try {
      const currentUser = auth.currentUser;
      const hasCurrentUser = Boolean(currentUser);
      const hasGoogleLinked = hasCurrentUser
        ? currentUser.providerData?.some((info) => info?.providerId === 'google.com')
        : false;

      let userCredential;
      if (hasCurrentUser && !hasGoogleLinked) {
        userCredential = await linkWithPopup(currentUser, provider);
      } else {
        userCredential = await signInWithPopup(auth, provider);
      }

      const { user } = userCredential;
      const credential = GoogleAuthProvider.credentialFromResult(
        userCredential
      );
      const providerData = user?.providerData?.find(
        (item) => item?.providerId === 'google.com'
      );

      const syncResult = await syncGoogleConnection({
        accessToken: credential?.accessToken || null,
        idToken: credential?.idToken || null,
        profile: providerData
          ? {
              email: providerData.email,
              displayName: providerData.displayName,
              photoURL: providerData.photoURL,
              uid: providerData.uid,
              providerId: providerData.providerId,
            }
          : {},
        scope: scopeString,
      });

      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        socialConnections: {
          ...prev.socialConnections,
          providers: {
            ...(prev.socialConnections?.providers ?? {}),
            google: {
              email:
                syncResult?.email ?? providerData?.email ?? null,
              displayName:
                syncResult?.displayName ?? providerData?.displayName ?? null,
              photoURL:
                syncResult?.photoURL ?? providerData?.photoURL ?? null,
              uid: providerData?.uid ?? null,
              providerId: 'google.com',
              linkedAt:
                prev.socialConnections?.providers?.google?.linkedAt || nowIso,
              updatedAt: nowIso,
            },
            updatedAt: nowIso,
          },
        },
      }));

      const profile = await ensureUserTierProfile();
      applyProfileData(profile, user);
      setActionState(false, null);

      return { success: true };
    } catch (googleError) {
      if (googleError?.code === 'auth/credential-already-in-use') {
        const takeoverCredentialRaw =
          GoogleAuthProvider.credentialFromError(googleError) ||
          googleError?.customData?.credential ||
          null;
        const takeoverCredential =
          takeoverCredentialRaw &&
          typeof takeoverCredentialRaw === 'object' &&
          'providerId' in takeoverCredentialRaw
            ? takeoverCredentialRaw
            : null;

        if (takeoverCredential) {
          try {
            const takeoverResult = await signInWithCredential(
              auth,
              takeoverCredential
            );

            const { user } = takeoverResult;
            const credentialFromResult =
              GoogleAuthProvider.credentialFromResult(takeoverResult);
            const providerData = user?.providerData?.find(
              (item) => item?.providerId === 'google.com'
            );

            await syncGoogleConnection({
              accessToken: credentialFromResult?.accessToken || null,
              idToken: credentialFromResult?.idToken || null,
              profile: providerData
                ? {
                    email: providerData.email,
                    displayName: providerData.displayName,
                    photoURL: providerData.photoURL,
                    uid: providerData.uid,
                    providerId: providerData.providerId,
                  }
                : {},
              scope: scopeString,
            });

            const syncResult = await syncGoogleConnection({
              accessToken: credentialFromResult?.accessToken || null,
              idToken: credentialFromResult?.idToken || null,
              profile: providerData
                ? {
                    email: providerData.email,
                    displayName: providerData.displayName,
                    photoURL: providerData.photoURL,
                    uid: providerData.uid,
                    providerId: providerData.providerId,
                  }
                : {},
              scope: scopeString,
            });

            const takeoverIso = new Date().toISOString();
            setState((prev) => ({
              ...prev,
              socialConnections: {
                ...prev.socialConnections,
                providers: {
                  ...(prev.socialConnections?.providers ?? {}),
                  google: {
                    email:
                      syncResult?.email ?? providerData?.email ?? null,
                    displayName:
                      syncResult?.displayName ?? providerData?.displayName ?? null,
                    photoURL:
                      syncResult?.photoURL ?? providerData?.photoURL ?? null,
                    uid: providerData?.uid ?? null,
                    providerId: 'google.com',
                    linkedAt:
                      prev.socialConnections?.providers?.google?.linkedAt ||
                      takeoverIso,
                    updatedAt: takeoverIso,
                  },
                  updatedAt: takeoverIso,
                },
              },
            }));

            const profile = await ensureUserTierProfile();
            applyProfileData(profile, user);
            setActionState(false, null);

            return { success: true, switchedUser: true };
          } catch (takeoverError) {
            console.error('接手現有 Google 帳號失敗:', takeoverError);
            setActionState(false, takeoverError);
            return {
              success: false,
              error: takeoverError,
              errorCode: takeoverError?.code || 'unknown',
              errorMessage:
                takeoverError?.message || 'Google 登入失敗，請稍後再試。',
            };
          }
        }
      }

      console.error('Google 登入失敗:', googleError);
      setActionState(false, googleError);
      return {
        success: false,
        error: googleError,
        errorCode: googleError?.code || 'unknown',
        errorMessage: googleError?.message || 'Google 登入失敗，請稍後再試。',
      };
    }
  }, [applyProfileData, ensureUserTierProfile, setActionState, setState]);

  const signOutUser = useCallback(async () => {
    const { auth } = ensureFirebaseApp();
    setActionState(true);
    try {
      await signOut(auth);
      setState({
        user: null,
        tier: 'guest',
        baseLimit: BASE_LIMITS.guest,
        permanentBoost: 0,
        shareBonus: 0,
        dailyLimit: BASE_LIMITS.guest,
        tasks: createEmptyTasks(),
        socialConnections: createDefaultSocialConnections(),
        loading: false,
        actionPending: false,
        error: null,
      });
      await signInAnonymously(auth);
      return { success: true };
    } catch (signOutError) {
      console.error('登出失敗:', signOutError);
      setActionState(false, signOutError);
      return { success: false, error: signOutError };
    }
  }, [setActionState]);

  const unlinkGoogle = useCallback(async () => {
    const { auth } = ensureFirebaseApp();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return {
        success: false,
        error: new Error('尚未登入，無法解除 Google 連結。'),
      };
    }

    setActionState(true);

    try {
      try {
        await unlink(currentUser, 'google.com');
      } catch (unlinkError) {
        if (unlinkError?.code !== 'auth/no-such-provider') {
          throw unlinkError;
        }
      }

      await unlinkGoogleConnection();
      const profile = await ensureUserTierProfile();
      applyProfileData(profile, auth.currentUser);
      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        socialConnections: {
          ...prev.socialConnections,
          providers: {
            ...(prev.socialConnections?.providers ?? {}),
            google: null,
            updatedAt: nowIso,
          },
        },
      }));
      setActionState(false, null);
      return { success: true };
    } catch (unlinkError) {
      console.error('解除 Google 連結失敗:', unlinkError);
      setActionState(false, unlinkError);
      return { success: false, error: unlinkError };
    }
  }, [applyProfileData, setActionState, setState, unlinkGoogleConnection]);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await ensureUserTierProfile();
      applyProfileData(profile);
      return { success: true, profile };
    } catch (refreshError) {
      console.error('重新整理會員資料失敗:', refreshError);
      setState((prev) => ({ ...prev, error: refreshError }));
      return { success: false, error: refreshError };
    }
  }, [applyProfileData]);

  const value = useMemo(
    () => ({
      user,
      tier,
      baseLimit,
      permanentBoost,
      shareBonus,
      dailyLimit,
      tasks,
      socialConnections,
      loading,
      actionPending,
      error,
      signIn,
      register,
      signInWithGoogle,
      signOut: signOutUser,
      unlinkGoogle,
      isAnonymous: user?.isAnonymous ?? true,
      applyRemoteProfile: applyProfileData,
      refreshProfile,
    }),
    [
      user,
      tier,
      baseLimit,
      permanentBoost,
      shareBonus,
      dailyLimit,
      tasks,
      socialConnections,
      loading,
      actionPending,
      error,
      signIn,
      register,
      signInWithGoogle,
      signOutUser,
      unlinkGoogle,
      applyProfileData,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
