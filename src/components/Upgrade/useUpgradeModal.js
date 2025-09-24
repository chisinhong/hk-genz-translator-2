import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslationUsage } from '../../utils/TranslationUsageContext';

export function useUpgradeModal() {
  const {
    dailyLimit,
    translationCount,
    storageMode,
    isLimitReached,
  } = useTranslationUsage();

  const [isOpen, setIsOpen] = useState(false);
  const [quotaSnapshot, setQuotaSnapshot] = useState(null);
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);

  useEffect(() => {
    if (storageMode === 'remote' && isLimitReached && !isOpen && !hasAutoTriggered) {
      setQuotaSnapshot({
        limit: dailyLimit,
        currentCount: translationCount,
        remaining: Math.max(dailyLimit - translationCount, 0),
        limitType: 'daily',
      });
      setIsOpen(true);
      setHasAutoTriggered(true);
    }
  }, [
    storageMode,
    isLimitReached,
    dailyLimit,
    translationCount,
    isOpen,
    hasAutoTriggered,
  ]);

  useEffect(() => {
    if (!isLimitReached) {
      setHasAutoTriggered(false);
    }
  }, [isLimitReached]);

  const openModal = useCallback(
    (details) => {
      setQuotaSnapshot((prev) => ({
        limit: details?.limit ?? prev?.limit ?? dailyLimit,
        currentCount:
          details?.currentCount ?? prev?.currentCount ?? translationCount,
        remaining:
          details?.remaining ??
          prev?.remaining ??
          Math.max(dailyLimit - translationCount, 0),
        limitType: details?.limitType || prev?.limitType || 'daily',
      }));
      setIsOpen(true);
      setHasAutoTriggered(true);
    },
    [dailyLimit, translationCount]
  );

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const controls = useMemo(
    () => ({
      isOpen,
      openModal,
      closeModal,
      quotaSnapshot,
      setQuotaDetails: openModal,
    }),
    [isOpen, openModal, closeModal, quotaSnapshot]
  );

  return controls;
}

export default useUpgradeModal;
