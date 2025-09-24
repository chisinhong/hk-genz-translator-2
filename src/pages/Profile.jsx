import React from 'react';
import { Link } from 'react-router-dom';
import { Crown, Loader2, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../utils/AuthContext';
import { useTranslationUsage } from '../utils/TranslationUsageContext';
import { useUpgradeModalContext } from '../components/Upgrade/UpgradeModalProvider';
import BackButton from '../components/common/BackButton';

const infoItemClass =
  'rounded-2xl bg-white/10 border border-white/10 px-4 py-5 text-left shadow-lg backdrop-blur';

const ProfilePage = () => {
  const {
    user,
    tier,
    dailyLimit: tierDailyLimit,
    loading: isAuthLoading,
    actionPending,
    error,
    isAnonymous,
    signOut,
  } = useAuth();
  const {
    translationCount,
    remainingTranslations,
    dailyLimit,
    storageMode,
    isLoading: isUsageLoading,
    refreshUsage,
  } = useTranslationUsage();
  const { openModal } = useUpgradeModalContext();

  const isLoading = isAuthLoading || isUsageLoading;
  const displayName = user?.displayName || user?.email || '訪客';
  const limitToDisplay = Number.isFinite(tierDailyLimit)
    ? tierDailyLimit
    : dailyLimit;

  const handleUpgrade = () => {
    openModal({
      limit: limitToDisplay,
      currentCount: translationCount,
      remaining: remainingTranslations,
      limitType: 'daily',
    });
  };

  const handleRefresh = async () => {
    await refreshUsage();
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="container relative mx-auto max-w-4xl px-4 py-12 text-white">
      <BackButton className="absolute left-4 top-4" />
      <header className="mt-8 mb-8 flex flex-col gap-2 md:mt-0 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-white/60">
            帳戶設定
          </p>
          <h1 className="text-3xl font-bold">{displayName}</h1>
          <p className="text-white/70 text-sm">
            {isAnonymous
              ? '目前為訪客模式，登入以解鎖更多翻譯額度。'
              : `已登入 • ${tier === 'registered' ? '註冊會員' : '訪客'}層級`}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            重新整理
          </button>
          {!isAnonymous && (
            <button
              type="button"
              onClick={handleSignOut}
              disabled={actionPending}
              className="flex items-center gap-2 rounded-xl bg-red-500/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <LogOut size={16} />
              )}
              登出
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-400/40 bg-red-500/20 px-4 py-3 text-sm text-red-200">
          {error.message || '操作失敗，請稍後再試。'}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className={`${infoItemClass} flex h-full flex-col justify-between`}>
          <div className="flex items-center gap-3">
            <Crown size={20} className="text-yellow-300" />
            <div>
              <p className="text-sm uppercase tracking-widest text-white/60">
                會員層級
              </p>
              <p className="text-xl font-semibold">
                {tier === 'registered' ? '註冊會員' : '訪客'}
              </p>
            </div>
          </div>
          <div className="mt-6 space-y-2 text-sm text-white/80">
            <p>每日翻譯額度：{limitToDisplay} 次</p>
            <p>當前登入狀態：{isAnonymous ? '訪客模式' : '已登入'}</p>
            <p>資料同步：{storageMode === 'remote' ? '雲端已同步' : '離線計數'}</p>
          </div>
          <button
            type="button"
            onClick={handleUpgrade}
            className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-300 via-amber-300 to-orange-300 px-4 py-2 text-sm font-semibold text-indigo-900 transition hover:brightness-110"
          >
            <ShieldCheck size={16} />
            了解升級方案
          </button>
        </div>

        <div className={`${infoItemClass}`}>
          <p className="text-sm uppercase tracking-widest text-white/60">
            今日使用情況
          </p>
          <p className="mt-2 text-3xl font-bold">{translationCount}</p>
          <p className="text-sm text-white/70">已使用次數</p>

          <div className="mt-6 grid gap-3 text-sm">
            <div className="flex justify-between text-white/80">
              <span>剩餘次數</span>
              <span>{Math.max(remainingTranslations, 0)}</span>
            </div>
            <div className="flex justify-between text-white/80">
              <span>每日總額度</span>
              <span>{limitToDisplay}</span>
            </div>
            <div className="flex justify-between text-white/80">
              <span>統計方式</span>
              <span>{storageMode === 'remote' ? '雲端' : '本機快取'}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-6 py-6 text-sm leading-relaxed text-white/80">
        {isAnonymous ? (
          <>
            <h2 className="text-lg font-semibold text-white">如何升級？</h2>
            <p className="mt-2">
              建議先登入帳戶，再前往升級頁面。登入按鈕可於右上角找到，登入後即可於此處查看更詳細的會員資訊與翻譯額度記錄。
            </p>
            <p className="mt-4">
              或點擊
              <Link to="/" className="mx-1 underline">
                返回翻譯器
              </Link>
              開始使用。
            </p>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-white">帳戶安全</h2>
            <p className="mt-2">
              如需調整電郵、密碼或刪除帳戶，請聯絡支援團隊。我們會定期同步翻譯使用量並保障您的資料安全。
            </p>
            <p className="mt-4">
              想再找點靈感？
              <Link to="/" className="mx-1 underline">
                返回翻譯器首頁
              </Link>
              繼續創作吧！
            </p>
          </>
        )}
      </section>
    </div>
  );
};

export default ProfilePage;
