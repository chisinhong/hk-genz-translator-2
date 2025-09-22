/* eslint-disable react-refresh/only-export-components -- Context file exports provider and hook */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { submitContributionToFirebase } from '../services/firebaseContributions';

export const CONTRIBUTION_STAGE = {
  IDLE: 'idle',
  FORM: 'form',
  SUBMITTING: 'submitting',
  SUCCESS: 'success',
  ERROR: 'error',
};

const ContributionContext = createContext(null);

function persistContributionLocally(contribution) {
  if (typeof window === 'undefined') {
    return contribution;
  }

  try {
    const existing = JSON.parse(
      window.localStorage.getItem('user_contributions') || '[]'
    );
    const record = {
      ...contribution,
      id:
        contribution?.firestoreId ||
        contribution?.id ||
        Date.now(),
      savedAt: new Date().toISOString(),
    };

    const filtered = existing.filter((item) => item.id !== record.id);
    filtered.unshift(record);
    if (filtered.length > 50) {
      filtered.length = 50;
    }

    window.localStorage.setItem(
      'user_contributions',
      JSON.stringify(filtered)
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
      const submissionResult = await submitContributionToFirebase(payload);
      const record = persistContributionLocally(submissionResult);
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
