import React from 'react';
import { useTester } from '../utils/TesterContext';
import AuthStatus from './Auth/AuthStatus';

export default function Header() {
  const { showTester, setShowTester } = useTester();
  const isDevelopment = import.meta.env.MODE === 'development';

  return (
    <header className="p-4">
      <nav className="container mx-auto flex justify-between items-center">
        <a href="/">
          <h1 className="text-2xl font-bold text-white">🇭🇰 GenZ翻譯器</h1>
        </a>
        <div className="flex items-center gap-3">
          {/* 開發測試切換按鈕 (正式版請移除) */}
          {isDevelopment && (
            <button
              onClick={() => setShowTester((prev) => !prev)}
              className="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-1 rounded text-sm font-medium"
            >
              {showTester ? '隱藏測試器' : '顯示測試器'}
            </button>
          )}

          <AuthStatus />
        </div>
      </nav>
    </header>
  );
}
