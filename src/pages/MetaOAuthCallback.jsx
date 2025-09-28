import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  consumeOAuthState,
  exchangeMetaOAuthCode,
  getMetaPlatformLabel,
} from '../services/metaConnectService';
import { useAuth } from '../utils/AuthContext';

const DEFAULT_STATUS = {
  state: 'loading',
  message: '正在驗證授權，請稍候...',
  platform: null,
};

const STATUS_ICON = {
  loading: <Loader2 size={36} className="animate-spin text-white/80" />,
  success: <CheckCircle2 size={36} className="text-emerald-300" />,
  error: <AlertCircle size={36} className="text-red-300" />,
};

function normalizeErrorMessage(rawMessage, fallback = '授權失敗，請稍後再試。') {
  if (!rawMessage || typeof rawMessage !== 'string') {
    return fallback;
  }
  const trimmed = rawMessage.trim();
  if (!trimmed) return fallback;
  const index = trimmed.indexOf(' ');
  if (trimmed.startsWith('functions/') && index > 0) {
    return trimmed.slice(index + 1).trim() || fallback;
  }
  return trimmed;
}

const MetaOAuthCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [status, setStatus] = useState(DEFAULT_STATUS);

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  useEffect(() => {
    const stateParam = searchParams.get('state');
    const codeParam = searchParams.get('code');
    const errorParam =
      searchParams.get('error') ||
      searchParams.get('error_reason') ||
      searchParams.get('error_code');
    const errorDescription =
      searchParams.get('error_description') ||
      searchParams.get('error_message');

    const redirectToSettings = (metaStatus, platform, message) => {
      const query = new URLSearchParams();
      query.set('meta', metaStatus);
      if (platform) {
        query.set('platform', platform);
      }
      if (message) {
        query.set('reason', message);
      }
      navigate(`/settings?${query.toString()}`, { replace: true });
    };

    if (!stateParam) {
      const fallbackMessage = '授權回呼缺少必要參數，請重新發起連結。';
      setStatus({ state: 'error', message: fallbackMessage, platform: null });
      redirectToSettings('error', '', fallbackMessage);
      return;
    }

    const storedState = consumeOAuthState(stateParam);

    if (!storedState) {
      const fallbackMessage = '授權資訊已過期或無效，請重新發起連結。';
      setStatus({ state: 'error', message: fallbackMessage, platform: null });
      redirectToSettings('error', '', fallbackMessage);
      return;
    }

    const { platform, redirectUri, scope } = storedState;
    const platformLabel = getMetaPlatformLabel(platform);

    if (errorParam) {
      const friendlyError = normalizeErrorMessage(
        errorDescription || errorParam,
        `${platformLabel} 授權取消或失敗，請稍後再試。`
      );
      setStatus({ state: 'error', message: friendlyError, platform });
      redirectToSettings('error', platform, friendlyError);
      return;
    }

    if (!codeParam) {
      const fallbackMessage = `${platformLabel} 授權失敗，缺少授權碼。`;
      setStatus({ state: 'error', message: fallbackMessage, platform });
      redirectToSettings('error', platform, fallbackMessage);
      return;
    }

    setStatus({
      state: 'loading',
      message: `${platformLabel} 授權資訊確認中...`,
      platform,
    });

    const exchange = async () => {
      try {
        await exchangeMetaOAuthCode({
          platform,
          code: codeParam,
          redirectUri,
          scope,
        });
        await refreshProfile().catch(() => null);
        setStatus({
          state: 'success',
          message: `${platformLabel} 已成功連結，將返回設定頁。`,
          platform,
        });
        redirectToSettings('connected', platform, '');
      } catch (exchangeError) {
        const friendlyError = normalizeErrorMessage(
          exchangeError?.message,
          `${platformLabel} 授權失敗，請稍後再試。`
        );
        setStatus({ state: 'error', message: friendlyError, platform });
        redirectToSettings('error', platform, friendlyError);
      }
    };

    void exchange();
  }, [navigate, refreshProfile, searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-700 text-white">
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
          {STATUS_ICON[status.state]}
        </div>
        <p className="mt-6 max-w-md text-sm text-white/80">{status.message}</p>
        <p className="mt-4 text-xs text-white/60">
          若無法自動跳轉，請回到 settings 頁面重新整理。
        </p>
      </div>
    </div>
  );
};

export default MetaOAuthCallback;
