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
  createUserWithEmailAndPassword,
  linkWithCredential,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { ensureFirebaseApp } from '../services/firebaseApp';
import {
  ensureUserTierProfile,
  subscribeToUserProfile,
} from '../services/userProfile';

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

function createEmptyTasks() {
  return { ...DEFAULT_TASKS };
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
    loading,
    actionPending,
    error,
  } = state;
  const unsubscribeProfileRef = useRef(null);

  const applyProfileData = useCallback((profileData, userOverride = null) => {
    setState((prev) => {
      const resolvedUser = userOverride ?? prev.user;
      const tierFromProfile = profileData?.tier;
      const resolvedTier = tierFromProfile
        || defaultTierForUser(resolvedUser)
        || prev.tier
        || 'guest';

      const normalizedTasks = normalizeTasks(profileData?.tasks);

      const resolvedBaseLimit = Number.isFinite(profileData?.baseLimit)
        ? profileData.baseLimit
        : baseLimitForTier(resolvedTier);

      const resolvedPermanentBoost = Number.isFinite(profileData?.permanentBoost)
        ? profileData.permanentBoost
        : calculatePermanentBoost(normalizedTasks);

      const resolvedShareBonus = Number.isFinite(profileData?.shareBonus)
        ? profileData.shareBonus
        : calculateShareBonus(normalizedTasks);

      const resolvedDailyLimit = Number.isFinite(profileData?.dailyLimit)
        ? profileData.dailyLimit
        : resolvedTier === 'pro'
          ? BASE_LIMITS.pro
          : resolvedBaseLimit + resolvedPermanentBoost + resolvedShareBonus;

      return {
        ...prev,
        user: resolvedUser ?? prev.user,
        tier: resolvedTier,
        baseLimit: resolvedBaseLimit,
        permanentBoost: resolvedPermanentBoost,
        shareBonus: resolvedShareBonus,
        dailyLimit: resolvedDailyLimit,
        tasks: normalizedTasks,
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
      loading,
      actionPending,
      error,
      signIn,
      register,
      signOut: signOutUser,
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
      loading,
      actionPending,
      error,
      signIn,
      register,
      signOutUser,
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
