import React, { useState } from 'react';
import { Loader2, User } from 'lucide-react';
import { useAuth } from '../../utils/AuthContext';

const initialForm = {
  email: '',
  password: '',
  displayName: '',
};

const AuthStatus = () => {
  const {
    user,
    tier,
    dailyLimit,
    loading,
    actionPending,
    error,
    isAnonymous,
    signIn,
    register,
    signOut,
  } = useAuth();

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [mode, setMode] = useState('signIn');
  const [formState, setFormState] = useState(initialForm);
  const [message, setMessage] = useState('');

  const togglePanel = () => {
    if (loading) return;
    setIsPanelOpen((prev) => !prev);
    setMessage('');
  };

  const handleChange = (field) => (event) => {
    setFormState((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const resetForm = () => {
    setFormState(initialForm);
    setMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    if (mode === 'register') {
      const result = await register(
        formState.email,
        formState.password,
        formState.displayName
      );
      if (!result?.success) {
        setMessage('註冊失敗，請檢查電郵或密碼。');
        return;
      }
      setMessage('註冊成功！');
      setIsPanelOpen(false);
      resetForm();
    } else {
      const result = await signIn(formState.email, formState.password);
      if (!result?.success) {
        setMessage('登入失敗，請再試一次。');
        return;
      }
      setMessage('登入成功！');
      setIsPanelOpen(false);
      resetForm();
    }
  };

  const handleSignOut = async () => {
    setMessage('');
    const result = await signOut();
    if (!result?.success) {
      setMessage('登出失敗，請稍後再試。');
    } else {
      setIsPanelOpen(false);
    }
  };

  const renderPanel = () => {
    if (!isPanelOpen) return null;

    return (
      <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white/95 p-4 text-gray-900 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">
            {mode === 'signIn' ? '登入帳戶' : '建立新帳戶'}
          </h3>
          <button
            type="button"
            className="text-xs font-semibold text-indigo-600"
            onClick={() => {
              setMode((prev) => (prev === 'signIn' ? 'register' : 'signIn'));
              setMessage('');
            }}
          >
            {mode === 'signIn' ? '我要註冊' : '已有帳戶'}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              電郵
            </label>
            <input
              type="email"
              autoComplete="email"
              value={formState.email}
              onChange={handleChange('email')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              密碼
            </label>
            <input
              type="password"
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              value={formState.password}
              onChange={handleChange('password')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="至少6個字元"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">
                顯示名稱 (選填)
              </label>
              <input
                type="text"
                autoComplete="nickname"
                value={formState.displayName}
                onChange={handleChange('displayName')}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                placeholder="例如：潮語達人"
              />
            </div>
          )}

          {message && (
            <p className="text-xs text-indigo-600">{message}</p>
          )}

          {error && (
            <p className="text-xs text-red-500">
              {error.message || '操作失敗，請稍後再試。'}
            </p>
          )}

          <button
            type="submit"
            disabled={actionPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-400"
          >
            {actionPending ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                處理中...
              </>
            ) : mode === 'signIn' ? (
              '登入'
            ) : (
              '註冊'
            )}
          </button>
        </form>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/80">
        <Loader2 className="animate-spin" size={16} />
        驗證身份中...
      </div>
    );
  }

  if (!isAnonymous && user) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={togglePanel}
          className="flex items-center gap-2 rounded-xl bg-white/20 px-3 py-2 text-sm text-white hover:bg-white/30"
        >
          <User size={16} />
          <span className="text-left">
            <span className="block font-semibold">
              {user.displayName || user.email || '已登入用戶'}
            </span>
            <span className="block text-xs text-white/70">
              {tier === 'registered' ? '註冊會員' : '訪客'} • 每日 {dailyLimit} 次
            </span>
          </span>
        </button>
        {isPanelOpen && (
          <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white/95 p-4 text-gray-900 shadow-xl">
            <p className="mb-3 text-sm font-semibold text-gray-700">
              你已登入，可使用每日 {dailyLimit} 次翻譯配額。
            </p>
            {message && <p className="mb-2 text-xs text-indigo-600">{message}</p>}
            {error && (
              <p className="mb-2 text-xs text-red-500">
                {error.message || '操作失敗，請稍後再試。'}
              </p>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              disabled={actionPending}
              className="w-full rounded-lg bg-red-500 py-2 text-sm font-semibold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-red-300"
            >
              {actionPending ? '處理中...' : '登出'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={togglePanel}
        className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm text-white hover:bg-white/25"
      >
        <User size={16} />
        <span>
          註冊/登入
          <span className="block text-xs text-white/70">
            訪客每日 {dailyLimit} 次
          </span>
        </span>
      </button>
      {renderPanel()}
    </div>
  );
};

export default AuthStatus;
