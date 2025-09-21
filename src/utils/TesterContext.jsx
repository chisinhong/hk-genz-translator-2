import React, { createContext, useContext, useState } from 'react';

// 建立 Context
const TesterContext = createContext();

// Provider 組件，包住 App
export function TesterProvider({ children }) {
  const [showTester, setShowTester] = useState(true); // 開發時 true, 正式版改 false

  return (
    <TesterContext.Provider value={{ showTester, setShowTester }}>
      {children}
    </TesterContext.Provider>
  );
}

// 自訂 hook，方便直接用
export function useTester() {
  return useContext(TesterContext);
}
