import React, { useEffect, useState } from 'react';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import {
  CONTRIBUTION_STAGE,
  useContribution,
} from '../../utils/ContributionContext';

const initialFormState = {
  word: '',
  explanation: '',
  example: '',
};

const ContributionModal = () => {
  const {
    isModalOpen,
    stage,
    errorMessage,
    lastContribution,
    closeModal,
    resetToForm,
    submitContribution,
  } = useContribution();

  const [formState, setFormState] = useState(initialFormState);
  const [showValidationHint, setShowValidationHint] = useState(false);

  const isSubmitting = stage === CONTRIBUTION_STAGE.SUBMITTING;
  const isSuccess = stage === CONTRIBUTION_STAGE.SUCCESS;

  // Reset form whenever modal closes or we go back to the form stage
  useEffect(() => {
    if (!isModalOpen) {
      setFormState(initialFormState);
      setShowValidationHint(false);
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (stage === CONTRIBUTION_STAGE.FORM) {
      setShowValidationHint(false);
    }
  }, [stage]);

  useEffect(() => {
    if (!isModalOpen) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        closeModal();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen, isSubmitting, closeModal]);

  if (!isModalOpen) {
    return null;
  }

  const updateField = (field) => (event) => {
    setFormState((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formState.word.trim() || !formState.explanation.trim()) {
      setShowValidationHint(true);
      return;
    }

    const submissionPayload = {
      word: formState.word.trim(),
      explanation: formState.explanation.trim(),
      example: formState.example.trim(),
    };

    const { success } = await submitContribution(submissionPayload);
    if (success) {
      setFormState(initialFormState);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="relative bg-gradient-to-br from-purple-700 to-indigo-800 p-8 rounded-2xl w-full max-w-lg shadow-xl">
        <button
          type="button"
          onClick={closeModal}
          disabled={isSubmitting}
          className="absolute top-4 right-4 text-white/70 hover:text-white disabled:text-white/40"
        >
          ✕
        </button>

        {isSuccess ? (
          <div className="text-center space-y-4">
            <CheckCircle className="mx-auto text-emerald-300" size={56} />
            <h3 className="text-2xl font-bold">多謝你嘅貢獻！</h3>
            <p className="text-white/80">
              我哋已經收到你提供嘅潮語，會盡快由編輯團隊審核。
            </p>
            {lastContribution && (
              <div className="bg-black/20 rounded-xl p-4 text-left text-white/80">
                <p className="font-semibold">{lastContribution.word}</p>
                <p className="text-sm mt-1">{lastContribution.explanation}</p>
                {lastContribution.example && (
                  <p className="text-xs mt-2 text-white/60">
                    例句：{lastContribution.example}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition"
              >
                完成
              </button>
              <button
                type="button"
                onClick={resetToForm}
                className="flex-1 bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg transition"
              >
                再貢獻一個
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-2xl font-bold mb-6 text-center">貢獻新潮語</h3>

            {stage === CONTRIBUTION_STAGE.ERROR && (
              <div className="mb-4 flex items-center gap-2 rounded-md bg-red-500/20 p-3 text-red-200">
                <XCircle size={20} />
                <span>{errorMessage || '提交失敗，請稍後再試。'}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm mb-1 text-white/80">新潮語</label>
                <input
                  type="text"
                  value={formState.word}
                  onChange={updateField('word')}
                  disabled={isSubmitting}
                  placeholder="例如：躺平"
                  className="w-full bg-white/10 focus:bg-white/15 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300/60"
                />
              </div>

              <div>
                <label className="block text-sm mb-1 text-white/80">
                  解釋 / 點用？
                </label>
                <textarea
                  value={formState.explanation}
                  onChange={updateField('explanation')}
                  disabled={isSubmitting}
                  placeholder="簡單講下意思、使用場合..."
                  className="w-full h-28 bg-white/10 focus:bg-white/15 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-pink-300/60"
                />
              </div>

              <div>
                <label className="block text-sm mb-1 text-white/80">
                  例句 (選填)
                </label>
                <input
                  type="text"
                  value={formState.example}
                  onChange={updateField('example')}
                  disabled={isSubmitting}
                  placeholder="今日好想躺平..."
                  className="w-full bg-white/10 focus:bg-white/15 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-300/60"
                />
              </div>

              {showValidationHint && (
                <p className="text-sm text-red-200">
                  請至少輸入潮語同埋解釋。
                </p>
              )}

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="text-white/80 hover:text-white disabled:text-white/40"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-pink-500 hover:bg-pink-600 disabled:bg-pink-500/50 px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={18} /> 提交緊...
                    </>
                  ) : (
                    '提交'
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ContributionModal;
