// 簡化版的API測試組件，避免導入問題
import React, { useState } from 'react';
import { geminiTranslator } from '../services/geminiAPI';

const SimpleTest = () => {
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 檢查API Key
  const checkApiKey = () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setResult('❌ 未找到 VITE_GEMINI_API_KEY 環境變數');
    } else if (apiKey === 'your_gemini_api_key_here') {
      setResult('⚠️ 請替換為真實的API Key');
    } else {
      setResult(`✅ API Key 已設置 (前4位: ${apiKey.substring(0, 4)}****)`);
    }
  };

  // 測試連接
  const testConnection = async () => {
    setIsLoading(true);
    setResult('正在測試連接...');

    try {
      const success = await geminiTranslator.testConnection();
      if (success) {
        setResult('✅ Gemini API 連接成功！');
      } else {
        setResult('❌ Gemini API 連接失敗');
      }
    } catch (error) {
      setResult(`❌ 連接錯誤: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 快速翻譯測試
  const testTranslation = async () => {
    setIsLoading(true);
    setResult('正在測試翻譯功能...');

    try {
      const translationResult = await geminiTranslator.translateSlang(
        '今日想躺平',
        'genz-to-normal'
      );

      setResult(`✅ 翻譯測試成功！
輸入: 今日想躺平
翻譯: ${translationResult.translation}
解釋: ${translationResult.explanation}
信心度: ${Math.round(translationResult.confidence * 100)}%
來源: ${translationResult.source}`);
    } catch (error) {
      setResult(`❌ 翻譯測試失敗: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6">
      <h3 className="text-xl font-bold text-white mb-4 text-center">
        🧪 API 快速測試
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <button
          onClick={checkApiKey}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          檢查API Key
        </button>

        <button
          onClick={testConnection}
          disabled={isLoading}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          測試連接
        </button>

        <button
          onClick={testTranslation}
          disabled={isLoading}
          className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          測試翻譯
        </button>
      </div>

      <div className="bg-black/30 rounded-lg p-4 min-h-[120px]">
        <pre className="text-green-400 text-sm whitespace-pre-wrap">
          {result || '點擊按鈕開始測試...'}
          {isLoading && (
            <span className="animate-pulse text-yellow-400">
              \n⏳ 執行中...
            </span>
          )}
        </pre>
      </div>

      <div className="mt-4 text-white/70 text-xs">
        💡 如果測試失敗，請檢查控制台 (F12) 查看詳細錯誤信息
      </div>
    </div>
  );
};

export default SimpleTest;
