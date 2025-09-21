import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export const CONTRIBUTION_STAGE = {
  IDLE: 'idle',
  FORM: 'form',
  SUBMITTING: 'submitting',
  SUCCESS: 'success',
  ERROR: 'error',
};

const ContributionContext = createContext(null);

function persistContributionLocally(contribution) {
  try {
    const existing = JSON.parse(
      window.localStorage.getItem('user_contributions') || '[]'
    );
    const record = {
      id: Date.now(),
      ...contribution,
      createdAt: new Date().toISOString(),
    };

    existing.unshift(record);
    if (existing.length > 50) {
      existing.length = 50;
    }

    window.localStorage.setItem(
      'user_contributions',
      JSON.stringify(existing)
    );
    return record;
  } catch (error) {
    console.warn('保存用戶貢獻到 localStorage 失敗:', error);
    return contribution;
  }
}

export function ContributionProvider({ children }) {
  const [stage, setStage] = useState(CONTRIBUTION_STAGE.IDLE);
  const [lastContribution, setLastContribution] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const isModalOpen = stage !== CONTRIBUTION_STAGE.IDLE;

  const openModal = useCallback(() => {
    setStage(CONTRIBUTION_STAGE.FORM);
    setErrorMessage('');
  }, []);

  const closeModal = useCallback(() => {
    setStage(CONTRIBUTION_STAGE.IDLE);
    setErrorMessage('');
  }, []);

  const resetToForm = useCallback(() => {
    setStage(CONTRIBUTION_STAGE.FORM);
    setErrorMessage('');
  }, []);

  const submitContribution = useCallback(async (payload) => {
    setStage(CONTRIBUTION_STAGE.SUBMITTING);
    setErrorMessage('');

    try {
      // 模擬提交至遠端服務；實際實作可在此接入 Firestore 或 API
      await new Promise((resolve) => setTimeout(resolve, 600));
      const record = persistContributionLocally(payload);
      setLastContribution(record);
      setStage(CONTRIBUTION_STAGE.SUCCESS);
      return { success: true, record };
    } catch (error) {
      console.error('提交貢獻失敗:', error);
      setErrorMessage(error.message || '提交失敗，請稍後再試。');
      setStage(CONTRIBUTION_STAGE.ERROR);
      return { success: false, error };
    }
  }, []);

  const value = useMemo(
    () => ({
      stage,
      isModalOpen,
      errorMessage,
      lastContribution,
      openModal,
      closeModal,
      resetToForm,
      submitContribution,
    }),
    [
      stage,
      isModalOpen,
      errorMessage,
      lastContribution,
      openModal,
      closeModal,
      resetToForm,
      submitContribution,
    ]
  );

  return (
    <ContributionContext.Provider value={value}>
      {children}
    </ContributionContext.Provider>
  );
}

export function useContribution() {
  const context = useContext(ContributionContext);
  if (!context) {
    throw new Error('useContribution must be used within a ContributionProvider');
  }
  return context;
}
