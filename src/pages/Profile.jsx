import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Crown,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  ExternalLink,
  Share2,
  UserPlus,
  Instagram,
  MessageCircle,
  Link2,
  Plug,
} from 'lucide-react';
import { useAuth } from '../utils/AuthContext';
import { useTranslationUsage } from '../utils/TranslationUsageContext';
import BackButton from '../components/common/BackButton';
import {
  completeUserTask,
  TASK_IDS,
  SHARE_DAILY_CAP,
  SHARE_REWARD_PER_USE,
} from '../services/tasksService';

const infoItemClass =
  'rounded-2xl bg-white/10 border border-white/10 px-4 py-5 text-left shadow-lg backdrop-blur';

const DEFAULT_TASKS = {
  instagram: false,
  threads: false,
  submissionsApproved: 0,
  invitesCompleted: 0,
  sharesToday: 0,
  sharesRecordedAt: null,
};

const TIER_LABELS = {
  guest: '訪客',
  registered: '註冊會員',
  pro: '專業版',
};

const shareDailyMax = SHARE_DAILY_CAP / SHARE_REWARD_PER_USE;


const META_PLATFORM_DETAILS = {
  threads: {
    label: 'Threads',
    description: '連結 Threads 以同步潮語更新與專屬互動。',
    Icon: MessageCircle,
  },
  instagram: {
    label: 'Instagram',
    description: '連結 Instagram 以直接分享翻譯與追蹤官方帳號。',
    Icon: Instagram,
  },
};

const META_GENERAL_ERROR = '操作失敗，請稍後再試。';

function sanitizeMetaError(rawMessage) {
  if (!rawMessage || typeof rawMessage !== 'string') {
    return META_GENERAL_ERROR;
  }
  const trimmed = rawMessage.trim();
  if (!trimmed) return META_GENERAL_ERROR;
  const spaceIndex = trimmed.indexOf(' ');
  if (trimmed.startsWith('functions/') && spaceIndex > 0) {
    return trimmed.slice(spaceIndex + 1).trim() || META_GENERAL_ERROR;
  }
  return trimmed;
}

function buildMetaErrorMessage(platformLabel, rawMessage) {
  const cleaned = sanitizeMetaError(rawMessage);
  if (cleaned.includes('App ID is not configured')) {
    return `${platformLabel || 'Meta'} 設定未完成，請稍後再試。`;
  }
  if (cleaned.includes('OAuth flow can only run in the browser')) {
    return `${platformLabel || 'Meta'} 授權需在瀏覽器中進行，請使用支援的瀏覽器重試。`;
  }
  if (cleaned === META_GENERAL_ERROR) {
    return `${platformLabel || 'Meta'} 操作失敗，請稍後再試。`;
  }
  if (platformLabel && cleaned.startsWith(platformLabel)) {
    return cleaned;
  }
  return `${platformLabel || 'Meta'} 操作失敗：${cleaned}`;
}

const ProfilePage = () => {
  const {
    user,
    tier,
    baseLimit,
    permanentBoost,
    shareBonus,
    dailyLimit: authDailyLimit,
    tasks,
    loading: isAuthLoading,
    actionPending,
    error,
    isAnonymous,
    signOut,
    signInWithGoogle,
    unlinkGoogle,
    applyRemoteProfile,
    refreshProfile,
  } = useAuth();
  const {
    translationCount,
    remainingTranslations,
    dailyLimit,
    storageMode,
    isLoading: isUsageLoading,
    refreshUsage,
  } = useTranslationUsage();

  const [activeTaskId, setActiveTaskId] = useState(null);
  const [taskFeedback, setTaskFeedback] = useState(null);


  const normalizedTasks = useMemo(
    () => ({ ...DEFAULT_TASKS, ...(tasks || {}) }),
    [tasks]
  );

  const shareProgress = normalizedTasks.sharesToday || 0;
  const limitFromUsage = Number.isFinite(dailyLimit) ? dailyLimit : null;
  const limitFromAuth = Number.isFinite(authDailyLimit) ? authDailyLimit : null;
  const limitToDisplay = limitFromUsage ?? limitFromAuth ?? 0;
  const isLoading = isAuthLoading || isUsageLoading;
  const displayName = user?.displayName || user?.email || '訪客';
  const tierLabel = TIER_LABELS[tier] || TIER_LABELS.guest;
  const submissionsApproved = normalizedTasks.submissionsApproved || 0;
  const invitesCompleted = normalizedTasks.invitesCompleted || 0;

  const tasksConfig = useMemo(
    () => [
      {
        id: TASK_IDS.instagram,
        title: '追蹤 Instagram',
        description:
          '追蹤 HK Gen-Z Translator 官方 Instagram，可立即獲得永久 +5 次翻譯額度。',
        rewardLabel: '+5 次（永久）',
        completed: !!normalizedTasks.instagram,
        repeatable: false,
        actionLabel: normalizedTasks.instagram ? '已完成' : '標記已完成',
        externalUrl: 'https://www.instagram.com/perry.plz',
        statusLine: normalizedTasks.instagram
          ? '任務已完成，永久加成已加入每日額度。'
          : '完成後可永久增加 +5 次翻譯額度。',
        successMessage: '永久額度 +5 已加入帳戶。',
        icon: <CheckCircle2 size={14} className="text-yellow-300" />,
        autoCompleteOnLink: true,
      },
      {
        id: TASK_IDS.threads,
        title: '追蹤 Threads',
        description: '追蹤官方 Threads 帳號，與我們保持最新潮語同步。',
        rewardLabel: '+5次（永久）',
        completed: !!normalizedTasks.threads,
        repeatable: false,
        actionLabel: normalizedTasks.threads ? '已完成' : '標記已完成',
        externalUrl: 'https://www.threads.net/@perry.plz',
        statusLine: normalizedTasks.threads
          ? '任務已完成，永久加成已加入每日額度。'
          : '完成後可永久增加 +5 次翻譯額度。',
        successMessage: '永久額度 +5 已加入帳戶。',
        icon: <CheckCircle2 size={14} className="text-yellow-300" />,
        autoCompleteOnLink: true,
      },
      {
        id: TASK_IDS.submission,
        title: '提交新潮語',
        description: '提交新潮語並通過審核，每個詞條永久 +5 次翻譯額度。',
        rewardLabel: '+5 次／詞（永久）',
        completed: false,
        repeatable: true,
        actionLabel: '標記已提交並通過',
        payload: { count: 1 },
        statusLine: submissionsApproved
          ? `已通過 ${submissionsApproved} 個詞條（永久加成 +${
              submissionsApproved * 5
            } 次）`
          : '每通過一個詞條即可永久增加 +5 次額度。',
        confirmation: '確認要標記 1 個已通過的潮語詞條嗎？',
        icon: <CheckCircle2 size={14} className="text-emerald-300" />,
      },
      {
        id: TASK_IDS.invite,
        title: '邀請好友註冊',
        description:
          '邀請好友註冊並完成 1 次翻譯。每位好友可永久 +5 次翻譯額度。',
        rewardLabel: '+5 次／人（永久）',
        completed: false,
        repeatable: true,
        actionLabel: '標記已邀請 1 位好友',
        payload: { count: 1 },
        statusLine: invitesCompleted
          ? `已成功邀請 ${invitesCompleted} 位好友（永久加成 +${
              invitesCompleted * 5
            } 次）`
          : '每邀請 1 位好友並完成翻譯，可永久增加 +5 次額度。',
        confirmation: '確認有 1 位好友已完成首次翻譯？',
        icon: <UserPlus size={14} className="text-sky-300" />,
      },
      {
        id: TASK_IDS.share,
        title: '分享翻譯結果',
        description:
          '分享你的翻譯成果到社交平台，每次 +2 次，單日最多 +10 次。',
        rewardLabel: '+2 次／次（每日）',
        completed: shareProgress >= shareDailyMax,
        repeatable: true,
        actionLabel:
          shareProgress >= shareDailyMax ? '今日已達上限' : '標記已分享 1 次',
        payload: { count: 1 },
        statusLine:
          shareProgress >= shareDailyMax
            ? '今日分享次數已滿額。'
            : `今日已分享 ${shareProgress} / ${shareDailyMax} 次（+${shareBonus} 次）`,
        icon: <Share2 size={14} className="text-pink-300" />,
      },
    ],
    [
      invitesCompleted,
      normalizedTasks.instagram,
      normalizedTasks.threads,
      shareBonus,
      shareProgress,
      submissionsApproved,
    ]
  );

  const socialTasks = useMemo(
    () =>
      tasksConfig.filter((task) =>
        task.id === TASK_IDS.instagram || task.id === TASK_IDS.threads
      ),
    [tasksConfig]
  );

  const otherTasks = useMemo(
    () =>
      tasksConfig.filter(
        (task) => task.id !== TASK_IDS.instagram && task.id !== TASK_IDS.threads
      ),
    [tasksConfig]
  );










  const handleTaskCompletion = async (
    task,
    { skipConfirmation = false } = {}
  ) => {
    if (task.completed && !task.repeatable) {
      return;
    }

    if (
      !skipConfirmation &&
      task.confirmation &&
      !window.confirm(task.confirmation)
    ) {
      return;
    }

    setActiveTaskId(task.id);
    setTaskFeedback(null);

    try {
      const payload = await completeUserTask(task.id, task.payload || {});
      applyRemoteProfile(payload);
      await refreshUsage();
      setTaskFeedback({
        type: 'success',
        message:
          task.successMessage ||
          `任務已更新，最新每日翻譯額度為 ${payload.dailyLimit} 次。`,
      });
    } catch (taskError) {
      console.error('任務處理失敗:', taskError);
      const errorCode = taskError?.code || '';
      const errorMessage = taskError?.message || '';
      let message = '任務處理失敗，請稍後再試。';
      if (errorCode.includes('failed-precondition')) {
        if (errorMessage.includes('TASK_ALREADY_COMPLETED')) {
          message = '此任務已完成，無需重複領取。';
        } else if (errorMessage.includes('SHARE_LIMIT_REACHED')) {
          message = '今日分享次數已達上限，明天再試！';
        }
      }
      setTaskFeedback({ type: 'error', message });
    } finally {
      setActiveTaskId(null);
    }
  };

  const handleTaskLinkClick = (task) => {
    if (task.completed && !task.repeatable) {
      if (task.externalUrl) {
        window.open(task.externalUrl, '_blank', 'noopener');
      }
      return;
    }

    if (task.externalUrl) {
      window.open(task.externalUrl, '_blank', 'noopener');
    }

    void handleTaskCompletion(task, { skipConfirmation: true });
  };

  const handleRefresh = async () => {
    await Promise.all([
      refreshProfile().catch(() => null),
      refreshUsage().catch(() => null),
    ]);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (isLoading) {
    return (
      <div className="container relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-6 px-4 py-12 text-white">
        <BackButton className="absolute left-4 top-4" />
        <Loader2 size={36} className="animate-spin text-white/70" />
        <div className="space-y-2 text-center">
          <p className="text-lg font-semibold">正在載入會員資料</p>
          <p className="text-sm text-white/70">
            為你同步最新的翻譯額度與任務進度，請稍候片刻。
          </p>
        </div>
      </div>
    );
  }


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
              : `已登入 • ${tierLabel}`}
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
        <div
          className={`${infoItemClass} flex h-full flex-col justify-between`}
        >
          <div className="flex items-center gap-3">
            <Crown size={20} className="text-yellow-300" />
            <div>
              <p className="text-sm uppercase tracking-widest text-white/60">
                會員層級
              </p>
              <p className="text-xl font-semibold">{tierLabel}</p>
            </div>
          </div>
          <div className="mt-6 space-y-2 text-sm text-white/80">
            <div className="flex justify-between">
              <span>原始額度</span>
              <span>{baseLimit} 次</span>
            </div>
            <div className="flex justify-between">
              <span>永久任務加成</span>
              <span>+{permanentBoost} 次</span>
            </div>
            <div className="flex justify-between">
              <span>今日分享加成</span>
              <span>
                +{shareBonus} 次（{shareProgress}/{shareDailyMax} 次）
              </span>
            </div>
            <div className="flex justify-between font-semibold text-white">
              <span>每日總額度</span>
              <span>{limitToDisplay} 次</span>
            </div>
            <div className="flex justify-between">
              <span>資料同步</span>
              <span>
                {storageMode === 'remote' ? '雲端已同步' : '離線計數'}
              </span>
            </div>
          </div>
          <div className="mt-6">
            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-300 via-amber-300 to-orange-300 px-4 py-2 text-sm font-semibold text-indigo-900 opacity-70"
            >
              <ShieldCheck size={16} /> 升級方案（Coming Soon）
            </button>
            <p className="mt-2 text-xs text-white/65">
              Stripe 付款整合開發中，先完成任務即可快速提升免費額度。
            </p>
          </div>
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

      <section className="mt-10">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">官方社群</h2>
            <p className="text-sm text-white/70">追蹤官方 IG 與 Threads，第一時間收到活動與潮語更新，還能獲得永久 +5 翻譯額度。</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/80">
            <p>完成任一追蹤任務：+5 次（永久）</p>
            <p>兩項全滿：共 +10 次（永久）</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {socialTasks.map((task) => {
            const detail = META_PLATFORM_DETAILS[task.id] || {};
            const Icon = detail.Icon || Plug;
            return (
              <div
                key={task.id}
                className="relative flex h-full flex-col justify-between rounded-2xl border border-white/15 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-5"
              >
                {task.completed && (
                  <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-100">
                    <CheckCircle2 size={14} /> 已完成
                  </span>
                )}
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-white">
                    <Icon size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-widest text-white/60">官方社群</p>
                    <h3 className="text-xl font-semibold">{detail.label || task.title}</h3>
                    <p className="text-sm text-white/70">{detail.description || task.description}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-white/70">{task.statusLine}</p>
                <div className="mt-6 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/80">{task.rewardLabel}</span>
                  <button
                    type="button"
                    onClick={() => handleTaskLinkClick(task)}
                    disabled={actionPending}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-indigo-900 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/50"
                  >
                    <ExternalLink size={16} />
                    {task.completed ? '再次造訪' : `前往${detail.label || ''}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>


      <section className="mt-10">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">任務中心</h2>
            <p className="text-sm text-white/70">
              完成任務可永久或每日提升翻譯額度，分享任務每日會重新計算。
            </p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/80">
            <p>永久加成：+{permanentBoost} 次</p>
            <p>
              今日分享加成：+{shareBonus} 次（剩餘{' '}
              {Math.max(shareDailyMax - shareProgress, 0)} 次）
            </p>
          </div>
        </div>

        {taskFeedback && (
          <div
            className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
              taskFeedback.type === 'success'
                ? 'border-emerald-300/40 bg-emerald-500/20 text-emerald-100'
                : 'border-red-300/40 bg-red-500/20 text-red-100'
            }`}
          >
            {taskFeedback.message}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {otherTasks.map((task) => {
            const isLoadingTask = activeTaskId === task.id;
            const isAutoTask = Boolean(task.autoCompleteOnLink);
            const disableManualAction =
              isLoadingTask ||
              actionPending ||
              (task.completed && !task.repeatable) ||
              (task.id === TASK_IDS.share && task.completed);

            return (
              <div
                key={task.id}
                className="flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-white/8 p-5"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{task.title}</h3>
                      <p className="mt-2 text-sm text-white/70">
                        {task.description}
                      </p>
                    </div>
                    <span className="rounded-full w-3xs bg-white/15 px-3 py-1 text-xs font-semibold text-white/90 text-center">
                      {task.rewardLabel}
                    </span>
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-xs text-white/60">
                    {task.icon}
                    <span>{task.statusLine}</span>
                  </p>
                  {task.completed && !task.repeatable && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-emerald-200">
                      <CheckCircle2 size={16} /> 任務已完成
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  {task.externalUrl && (
                    <button
                      type="button"
                      onClick={() => handleTaskLinkClick(task)}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isLoadingTask}
                    >
                      <ExternalLink size={14} />
                      {isAutoTask ? '前往任務連結（自動完成）' : '前往任務連結'}
                    </button>
                  )}
                  {!isAutoTask && (
                    <button
                      type="button"
                      onClick={() => handleTaskCompletion(task)}
                      disabled={disableManualAction}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/80 px-4 py-2 text-sm font-semibold text-indigo-900 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/50"
                    >
                      {isLoadingTask ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          處理中...
                        </>
                      ) : (
                        task.actionLabel
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 px-6 py-6 text-sm leading-relaxed text-white/80">
        {isAnonymous ? (
          <>
            <h2 className="text-lg font-semibold text-white">如何升級？</h2>
            <p className="mt-2">
              建議先登入帳戶，再前往任務中心解鎖更多翻譯額度。登入按鈕可於右上角找到，登入後即可於此處查看更詳細的會員資訊與翻譯額度記錄。
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
