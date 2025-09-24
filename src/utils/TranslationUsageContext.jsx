/* eslint-disable react-refresh/only-export-components -- Context file exports provider and hook */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { fetchTodayUsage } from '../services/firebaseUsage';
import { isFirebaseConfigured } from '../services/firebaseApp';
import { validateUsageQuota } from '../services/quotaService';
import { useAuth } from './AuthContext';

const GUEST_LIMIT = 3;
const REGISTERED_LIMIT = 10;
const PRO_LIMIT = 200;
const DEFAULT_DAILY_LIMIT = GUEST_LIMIT;
const LOCAL_STORAGE_KEY = 'translation_usage_daily';

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readLocalUsageCount() {
  if (typeof window === 'undefined') {
    return 0;
  }

  try {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) {
      return 0;
    }

    const parsed = JSON.parse(stored);
    return typeof parsed[getTodayKey()] === 'number'
      ? parsed[getTodayKey()]
      : 0;
  } catch (error) {
    console.warn('讀取本地翻譯計數失敗:', error);
    return 0;
  }
}

function writeLocalUsageCount(newCount) {
  if (typeof window === 'undefined') {
    return newCount;
  }

  try {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    parsed[getTodayKey()] = newCount;
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
  } catch (error) {
    console.warn('寫入本地翻譯計數失敗:', error);
  }
  return newCount;
}

const TranslationUsageContext = createContext(null);

export function TranslationUsageProvider({
  children,
  dailyLimit = DEFAULT_DAILY_LIMIT,
}) {
  const [state, setState] = useState({
    userId: null,
    translationCount: 0,
    dailyLimit,
    storageMode: 'remote',
    isLoading: true,
    error: null,
  });
  const { user, dailyLimit: authDailyLimit, tier, loading: isAuthLoading } =
    useAuth();

  useEffect(() => {
    let isMounted = true;

    const initialiseUsage = async () => {
      if (isAuthLoading) {
        return;
      }

      if (typeof window === 'undefined') {
        if (!isMounted) return;
        setState((prev) => ({
          ...prev,
          storageMode: 'local',
          translationCount: 0,
          isLoading: false,
        }));
        return;
      }

      if (!user || !isFirebaseConfigured()) {
        const localCount = readLocalUsageCount();
        if (!isMounted) return;
        setState((prev) => ({
          ...prev,
          userId: user?.uid || null,
          storageMode: 'local',
          translationCount: localCount,
          isLoading: false,
          error: null,
        }));
        return;
      }

      try {
        const usage = await fetchTodayUsage();
        if (!isMounted) return;
        setState((prev) => ({
          ...prev,
          userId: usage.userId,
          translationCount: usage.count,
          storageMode: 'remote',
          isLoading: false,
          dailyLimit: Number.isFinite(authDailyLimit)
            ? authDailyLimit
            : prev.dailyLimit,
          error: null,
        }));
      } catch (error) {
        console.error('載入遠端使用統計失敗:', error);
        const fallbackCount = readLocalUsageCount();
        if (!isMounted) return;
        setState((prev) => ({
          ...prev,
          userId: user?.uid || null,
          storageMode: 'local',
          translationCount: fallbackCount,
          dailyLimit: Number.isFinite(authDailyLimit)
            ? authDailyLimit
            : prev.dailyLimit,
          isLoading: false,
          error: '目前無法連線至伺服器，暫時使用離線計數。',
        }));
      }
    };

    void initialiseUsage();

    return () => {
      isMounted = false;
    };
  }, [isAuthLoading, user, authDailyLimit]);

  useEffect(() => {
    setState((prev) => ({ ...prev, dailyLimit }));
  }, [dailyLimit]);

  const refreshUsage = useCallback(async () => {
    if (!isFirebaseConfigured() || !user) {
      const localCount = readLocalUsageCount();
      setState((prev) => ({
        ...prev,
        userId: user?.uid || null,
        storageMode: 'local',
        translationCount: localCount,
        isLoading: false,
      }));
      return { storageMode: 'local', translationCount: localCount };
    }

    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const usage = await fetchTodayUsage();
      setState((prev) => ({
        ...prev,
        userId: usage.userId,
        translationCount: usage.count,
        storageMode: 'remote',
        isLoading: false,
        dailyLimit: Number.isFinite(authDailyLimit)
          ? authDailyLimit
          : prev.dailyLimit,
        error: null,
      }));
      return { storageMode: 'remote', translationCount: usage.count };
    } catch (error) {
      console.error('重新整理遠端使用統計失敗:', error);
      const fallbackCount = readLocalUsageCount();
      setState((prev) => ({
        ...prev,
        userId: user?.uid || null,
        storageMode: 'local',
        translationCount: fallbackCount,
        dailyLimit: Number.isFinite(authDailyLimit)
          ? authDailyLimit
          : prev.dailyLimit,
        isLoading: false,
        error: '目前無法連線至伺服器，暫時使用離線計數。',
      }));
      return { storageMode: 'local', translationCount: fallbackCount };
    }
  }, [authDailyLimit, user]);

  const registerTranslationAttempt = useCallback(async () => {
    if (
      state.storageMode === 'local' &&
      state.translationCount >= state.dailyLimit
    ) {
      return { allowed: false, reason: 'limit-reached' };
    }

    const currentCount = state.translationCount;
    const configuredLimit = state.dailyLimit;

    if (state.storageMode === 'remote' && user) {
      try {
        const quotaResult = await validateUsageQuota({
          limitType: 'daily',
          requested: 1,
          consume: true,
        });

        writeLocalUsageCount(quotaResult.usage);
        setState((prev) => ({
          ...prev,
          userId: user.uid,
          translationCount: quotaResult.usage,
          dailyLimit: Number.isFinite(quotaResult.limit)
            ? quotaResult.limit
            : prev.dailyLimit,
          error: null,
        }));
        return {
          allowed: true,
          storageMode: 'remote',
          translationCount: quotaResult.usage,
          userId: user.uid,
          quota: quotaResult,
        };
      } catch (error) {
        if (error?.code === 'resource-exhausted') {
          const details = error.details || {};
          const enforcedCount = Number.isFinite(details.currentCount)
            ? details.currentCount
            : currentCount;

          writeLocalUsageCount(enforcedCount);
          setState((prev) => ({
            ...prev,
            translationCount: enforcedCount,
            dailyLimit: Number.isFinite(details.limit)
              ? details.limit
              : prev.dailyLimit,
            error: '已達每日翻譯上限。',
          }));

          return {
            allowed: false,
            storageMode: 'remote',
            reason: 'quota-exceeded',
            quota: {
              remaining: Number.isFinite(details.remaining)
                ? details.remaining
                : Math.max(configuredLimit - enforcedCount, 0),
              limit: Number.isFinite(details.limit)
                ? details.limit
                : configuredLimit,
              limitType: details.limitType || 'daily',
              currentCount: enforcedCount,
            },
          };
        }

        console.error('遠端配額驗證失敗，改用本地計數:', error);
        const localCount = writeLocalUsageCount(currentCount + 1);
        setState((prev) => ({
          ...prev,
          userId: user?.uid || null,
          translationCount: localCount,
          storageMode: 'local',
          error: '無法連線至伺服器，已改用離線計數。',
        }));
        return {
          allowed: true,
          storageMode: 'local',
          translationCount: localCount,
          fallbackError: error,
        };
      }
    }

    const nextCount = writeLocalUsageCount(currentCount + 1);
    setState((prev) => ({
      ...prev,
      userId: user?.uid || null,
      translationCount: nextCount,
      storageMode: 'local',
    }));

    return {
      allowed: true,
      storageMode: 'local',
      translationCount: nextCount,
    };
  }, [
    state.translationCount,
    state.dailyLimit,
    state.storageMode,
    user,
  ]);

  useEffect(() => {
    const targetLimit = Number.isFinite(authDailyLimit)
      ? authDailyLimit
      : tier === 'pro'
        ? PRO_LIMIT
        : tier === 'registered'
          ? REGISTERED_LIMIT
          : GUEST_LIMIT;

    setState((prev) => ({
      ...prev,
      dailyLimit:
        prev.storageMode === 'remote' && Number.isFinite(prev.dailyLimit)
          ? prev.dailyLimit
          : targetLimit,
    }));
  }, [authDailyLimit, tier]);

  const value = useMemo(() => {
    const remainingTranslations = Math.max(
      state.dailyLimit - state.translationCount,
      0
    );

    return {
      userId: state.userId,
      translationCount: state.translationCount,
      dailyLimit: state.dailyLimit,
      remainingTranslations,
      isLimitReached: remainingTranslations <= 0,
      storageMode: state.storageMode,
      isLoading: state.isLoading,
      error: state.error,
      refreshUsage,
      registerTranslationAttempt,
      tier,
    };
  }, [state, refreshUsage, registerTranslationAttempt, tier]);

  return (
    <TranslationUsageContext.Provider value={value}>
      {children}
    </TranslationUsageContext.Provider>
  );
}

export function useTranslationUsage() {
  const context = useContext(TranslationUsageContext);
  if (!context) {
    throw new Error(
      'useTranslationUsage must be used within a TranslationUsageProvider'
    );
  }
  return context;
}
