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

const AuthContext = createContext(null);

const DEFAULT_STATE = {
  user: null,
  tier: 'guest',
  dailyLimit: 10,
  loading: true,
  actionPending: false,
  error: null,
};

export const AuthProvider = ({ children }) => {
  const [state, setState] = useState(DEFAULT_STATE);
  const { user, tier, dailyLimit, loading, actionPending, error } = state;
  const unsubscribeProfileRef = useRef(null);

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
          dailyLimit: DEFAULT_STATE.dailyLimit,
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
        setState((prev) => ({
          ...prev,
          tier: profile?.tier || prev.tier || 'guest',
          dailyLimit: Number.isFinite(profile?.dailyLimit)
            ? profile.dailyLimit
            : prev.dailyLimit,
        }));
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

      try {
        const profile = await ensureUserTierProfile();
        if (!isMounted) return;
        const resolvedTier =
          profile?.tier || (firebaseUser.isAnonymous ? 'guest' : 'registered');
        const resolvedLimit = Number.isFinite(profile?.dailyLimit)
          ? profile.dailyLimit
          : resolvedTier === 'registered'
            ? 50
            : 10;
        setState({
          user: firebaseUser,
          tier: resolvedTier,
          dailyLimit: resolvedLimit,
          loading: false,
          actionPending: false,
          error: null,
        });
      } catch (profileError) {
        console.error('載入用戶層級失敗:', profileError);
        if (!isMounted) return;
        setState({
          user: firebaseUser,
          tier: firebaseUser.isAnonymous ? 'guest' : 'registered',
          dailyLimit: firebaseUser.isAnonymous ? 10 : 50,
          loading: false,
          actionPending: false,
          error: profileError,
        });
      }
    };

    const unsubscribe = onAuthStateChanged(auth, handleUserChange);

    return () => {
      isMounted = false;
      unsubscribe();
      cleanupProfileSubscription();
    };
  }, []);

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
      const resolvedTier = profile?.tier || 'registered';
      const resolvedLimit = Number.isFinite(profile?.dailyLimit)
        ? profile.dailyLimit
        : resolvedTier === 'registered'
          ? 50
          : 10;
      setState((prev) => ({
        ...prev,
        tier: resolvedTier,
        dailyLimit: resolvedLimit,
        actionPending: false,
        error: null,
      }));
      return { success: true };
    } catch (signInError) {
      console.error('登入失敗:', signInError);
      setActionState(false, signInError);
      return { success: false, error: signInError };
    }
  }, [setActionState]);

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
        const resolvedTier = profile?.tier || 'registered';
        const resolvedLimit = Number.isFinite(profile?.dailyLimit)
          ? profile.dailyLimit
          : resolvedTier === 'registered'
            ? 50
            : 10;
        setState((prev) => ({
          ...prev,
          tier: resolvedTier,
          dailyLimit: resolvedLimit,
          actionPending: false,
          error: null,
        }));

        return { success: true };
      } catch (registerError) {
        console.error('註冊失敗:', registerError);
        setActionState(false, registerError);
        return { success: false, error: registerError };
      }
    },
    [setActionState]
  );

  const signOutUser = useCallback(async () => {
    const { auth } = ensureFirebaseApp();
    setActionState(true);
    try {
      await signOut(auth);
      setState({ ...DEFAULT_STATE, loading: false });
      await signInAnonymously(auth);
      return { success: true };
    } catch (signOutError) {
      console.error('登出失敗:', signOutError);
      setActionState(false, signOutError);
      return { success: false, error: signOutError };
    }
  }, [setActionState]);

  const value = useMemo(
    () => ({
      user,
      tier,
      dailyLimit,
      loading,
      actionPending,
      error,
      signIn,
      register,
      signOut: signOutUser,
      isAnonymous: user?.isAnonymous ?? true,
    }),
    [
      user,
      tier,
      dailyLimit,
      loading,
      actionPending,
      error,
      signIn,
      register,
      signOutUser,
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
