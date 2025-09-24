export const trackEvent = (eventName, parameters = {}) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, {
      ...parameters,
      timestamp: new Date().toISOString(),
    });
  }
};

// 在翻譯功能中加入追蹤
export const trackTranslation = (inputText, outputText, type, confidence) => {
  trackEvent('translation_completed', {
    translation_type: type,
    input_length: inputText.length,
    confidence_score: confidence,
    source: 'gemini_api',
  });
};

export const trackTranslationAttempt = (type, metadata = {}) => {
  trackEvent('translation_attempt', {
    translation_type: type,
    ...metadata,
  });
};

export const trackUpgradeModalOpened = (metadata = {}) => {
  trackEvent('upgrade_modal_opened', metadata);
};

export const trackUpgradeModalClosed = (metadata = {}) => {
  trackEvent('upgrade_modal_closed', metadata);
};

export const trackUpgradeModalUpgradeClick = (metadata = {}) => {
  trackEvent('upgrade_modal_upgrade_click', metadata);
};

export const trackUpgradeModalSocialClick = (metadata = {}) => {
  trackEvent('upgrade_modal_social_click', metadata);
};
