// src/components/Translator/TranslatorWidget.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeftRight,
  Copy,
  Volume2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { geminiTranslator } from '../../services/geminiAPI';

const TranslatorWidget = () => {
  // 基本狀態
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [explanation, setExplanation] = useState('');
  const [translationType, setTranslationType] = useState('genz-to-normal');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);

  // 使用統計
  const [translationCount, setTranslationCount] = useState(0);
  const [dailyLimit] = useState(20); // 免費用戶每日限制

  // 引用
  const inputRef = useRef(null);
  const outputRef = useRef(null);

  // 翻譯類型選項
  const translationTypes = [
    { value: 'genz-to-normal', label: 'GenZ潮語 → 正常廣東話', emoji: '🎯' },
    { value: 'genz-to-80s', label: 'GenZ潮語 → 80後潮語', emoji: '📼' },
    { value: 'genz-to-90s', label: 'GenZ潮語 → 90後潮語', emoji: '💿' },
  ];

  // 快速示例
  const quickExamples = [
    '今日想躺平',
    '好emo啊',
    '芭比Q了',
    'YYDS',
    '整活時間',
    '社死現場',
  ];

  // 載入每日使用統計
  useEffect(() => {
    const loadDailyCount = () => {
      try {
        const today = new Date().toDateString();
        const dailyData = JSON.parse(
          localStorage.getItem('daily_count') || '{}'
        );
        setTranslationCount(dailyData[today] || 0);
      } catch (error) {
        console.error('載入每日統計失敗:', error);
      }
    };

    loadDailyCount();
  }, []);

  // 錯誤處理函數
  const getErrorMessage = (error) => {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return '未知錯誤';
  };

  // 檢查是否達到每日限制
  const isAtDailyLimit = translationCount >= dailyLimit;

  // 主翻譯函數
  const handleTranslate = async () => {
    // 基本驗證
    if (!inputText.trim()) {
      setError('請輸入要翻譯的文字');
      inputRef.current?.focus();
      return;
    }

    if (inputText.length > 500) {
      setError('文字長度不能超過500字元');
      return;
    }

    if (isAtDailyLimit) {
      setError(`今日翻譯次數已達上限 (${dailyLimit}次)，請明天再試或升級會員`);
      return;
    }

    // 開始翻譯
    setIsLoading(true);
    setError('');
    setOutputText('');
    setExplanation('');
    setConfidence(0);

    try {
      console.log('開始翻譯:', inputText, translationType);

      const result = await geminiTranslator.translateSlang(
        inputText,
        translationType
      );

      console.log('翻譯結果:', result);

      // 更新結果
      setOutputText(result.translation);
      setExplanation(result.explanation);
      setConfidence(result.confidence);

      // 更新統計
      const newCount = translationCount + 1;
      setTranslationCount(newCount);

      // 保存到本地存儲
      try {
        const today = new Date().toDateString();
        const dailyData = JSON.parse(
          localStorage.getItem('daily_count') || '{}'
        );
        dailyData[today] = newCount;
        localStorage.setItem('daily_count', JSON.stringify(dailyData));

        // 保存翻譯歷史
        const historyItem = {
          id: Date.now(),
          input: inputText,
          output: result.translation,
          explanation: result.explanation,
          type: translationType,
          confidence: result.confidence,
          timestamp: new Date().toISOString(),
          source: result.source,
        };

        const history = JSON.parse(
          localStorage.getItem('translation_history') || '[]'
        );
        history.unshift(historyItem);
        // 只保留最近100條記錄
        if (history.length > 100) {
          history.splice(100);
        }
        localStorage.setItem('translation_history', JSON.stringify(history));
      } catch (storageError) {
        console.warn('保存到本地存儲失敗:', storageError);
      }
    } catch (error) {
      console.error('翻譯失敗:', error);

      const errorMessage = getErrorMessage(error);
      let displayMessage = '翻譯失敗，請稍後再試';

      if (errorMessage.includes('QUOTA_EXCEEDED')) {
        displayMessage = 'API配額已用完，請稍後再試';
      } else if (errorMessage.includes('API_KEY_INVALID')) {
        displayMessage = 'API配置錯誤，請聯繫客服';
      } else if (
        errorMessage.includes('網絡') ||
        errorMessage.includes('fetch')
      ) {
        displayMessage = '網絡連接失敗，請檢查網絡連接';
      } else {
        displayMessage = `翻譯失敗: ${errorMessage}`;
      }

      setError(displayMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 快速翻譯
  const handleQuickExample = (example) => {
    setInputText(example);
    setError('');
    setOutputText('');
    setExplanation('');
  };

  // 複製到剪貼板
  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      // 備援方法
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // 清空輸入
  const handleClear = () => {
    setInputText('');
    setOutputText('');
    setExplanation('');
    setError('');
    setConfidence(0);
    inputRef.current?.focus();
  };

  // 鍵盤快捷鍵
  const handleKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      handleTranslate();
    }
  };

  // 語音播放（如果瀏覽器支持）
  const handleSpeak = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-HK';
      speechSynthesis.speak(utterance);
    }
  };

  // 信心度顏色
  const getConfidenceColor = (conf) => {
    if (conf >= 0.8) return 'text-green-600';
    if (conf >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* 翻譯器標題區域 */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
          <Sparkles className="text-yellow-400" />
          AI智能翻譯器
          <Sparkles className="text-yellow-400" />
        </h2>
        <p className="text-white/80">
          已翻譯 {translationCount}/{dailyLimit} 次
          {isAtDailyLimit && (
            <span className="text-red-300 ml-2">今日限額已用完</span>
          )}
        </p>
      </div>

      {/* 翻譯類型選擇器 */}
      <div className="mb-6">
        <label className="block text-white font-medium mb-3 text-center">
          選擇翻譯模式
        </label>
        <div className="flex flex-wrap gap-2 justify-center">
          {translationTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setTranslationType(type.value)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                translationType === type.value
                  ? 'bg-white text-purple-600 shadow-lg transform scale-105'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {type.emoji} {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* 主要翻譯區域 */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* 輸入區域 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-white font-medium">
                輸入GenZ潮語
              </label>
              <span className="text-white/60 text-sm">
                {inputText.length}/500
              </span>
            </div>

            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="例如：今日想躺平..."
              className="w-full h-32 p-4 rounded-lg bg-white/20 text-white placeholder-white/60 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent resize-none transition-all duration-200"
              disabled={isLoading}
            />

            <div className="flex gap-2">
              <button
                onClick={handleClear}
                className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm transition-colors"
                disabled={isLoading}
              >
                清空
              </button>
              {inputText && (
                <button
                  onClick={() => handleSpeak(inputText)}
                  className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm transition-colors"
                >
                  <Volume2 size={14} />
                  朗讀
                </button>
              )}
            </div>
          </div>

          {/* 輸出區域 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-white font-medium">翻譯結果</label>
              {confidence > 0 && (
                <span className={`text-sm ${getConfidenceColor(confidence)}`}>
                  信心度: {Math.round(confidence * 100)}%
                </span>
              )}
            </div>

            <div className="relative">
              <div className="w-full h-32 p-4 rounded-lg bg-white/10 text-white border border-white/30 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="animate-spin mr-2" size={20} />
                    AI正在思考中...
                  </div>
                ) : outputText ? (
                  <div>
                    <p className="mb-2">{outputText}</p>
                    {explanation && (
                      <p className="text-sm text-white/70 italic border-t border-white/20 pt-2">
                        💡 {explanation}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-white/50">翻譯結果會在這裡顯示...</p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleCopy(outputText)}
                disabled={!outputText}
                className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copySuccess ? (
                  <>
                    <CheckCircle size={14} />
                    已複製
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    複製
                  </>
                )}
              </button>
              {outputText && (
                <button
                  onClick={() => handleSpeak(outputText)}
                  className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm transition-colors"
                >
                  <Volume2 size={14} />
                  朗讀
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 錯誤提示 */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-2">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
            <span className="text-red-300">{error}</span>
          </div>
        )}

        {/* 翻譯按鈕 */}
        <div className="mt-6 text-center">
          <button
            onClick={handleTranslate}
            disabled={isLoading || !inputText.trim() || isAtDailyLimit}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                翻譯中...
              </>
            ) : (
              <>
                <ArrowLeftRight size={20} />
                {isAtDailyLimit ? '已達每日限額' : 'AI智能翻譯'}
              </>
            )}
          </button>

          <p className="text-white/60 text-sm mt-2">按 Ctrl+Enter 快速翻譯</p>
        </div>
      </div>

      {/* 快速示例 */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          ⚡ 快速試用
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {quickExamples.map((example, index) => (
            <button
              key={index}
              onClick={() => handleQuickExample(example)}
              className="p-3 bg-white/20 hover:bg-white/30 rounded-lg text-white text-left transition-all duration-200 hover:scale-105"
              disabled={isLoading}
            >
              "{example}"
            </button>
          ))}
        </div>

        <div className="mt-4 text-center">
          <p className="text-white/70 text-sm">
            💡 點擊上方例子快速體驗翻譯功能
          </p>
        </div>
      </div>
    </div>
  );
};

export default TranslatorWidget;
