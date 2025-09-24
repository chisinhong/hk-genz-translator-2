/* eslint-disable react-refresh/only-export-components -- Provider file exports hook helpers alongside component */

import React, { createContext, useContext } from 'react';
import UpgradeModal from './UpgradeModal';
import useUpgradeModal from './useUpgradeModal';

const UpgradeModalContext = createContext(null);

export const UpgradeModalProvider = ({ children }) => {
  const controller = useUpgradeModal();
  const upgradeUrl = import.meta.env.VITE_UPGRADE_URL || '/upgrade';

  const handleUpgrade = () => {
    if (upgradeUrl) {
      window.open(upgradeUrl, '_blank', 'noopener');
    }
    controller.closeModal();
  };

  return (
    <UpgradeModalContext.Provider value={controller}>
      {children}
      <UpgradeModal
        isOpen={controller.isOpen}
        stats={controller.quotaSnapshot}
        onClose={controller.closeModal}
        onUpgrade={handleUpgrade}
      />
    </UpgradeModalContext.Provider>
  );
};

export const useUpgradeModalContext = () => {
  const context = useContext(UpgradeModalContext);
  if (!context) {
    throw new Error(
      'useUpgradeModalContext must be used within an UpgradeModalProvider'
    );
  }
  return context;
};

export default UpgradeModalProvider;
