// src/components/Translator/TranslatorWidget.jsx
import React, { useState, useRef, useMemo } from 'react';
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
import { useTranslationUsage } from '../../utils/TranslationUsageContext';
import { trackTranslationAttempt } from '../../utils/analytics';

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
  const [copiedTranslationIndex, setCopiedTranslationIndex] = useState(null);
  const [quotaDetails, setQuotaDetails] = useState(null);

  // 使用統計
  const {
    translationCount,
    dailyLimit,
    remainingTranslations,
    isLimitReached,
    storageMode,
    isLoading: isUsageLoading,
    registerTranslationAttempt,
    refreshUsage,
  } = useTranslationUsage();

  const upgradeUrl = import.meta.env.VITE_UPGRADE_URL || '/upgrade';

  // 引用
  const inputRef = useRef(null);

  // 翻譯類型選項
  const translationTypes = [
    { value: 'genz-to-normal', label: 'GenZ潮語 → 正常廣東話', emoji: '🎯' },
    { value: 'genz-to-80s', label: 'GenZ潮語 → 80後潮語', emoji: '📼' },
    { value: 'genz-to-90s', label: 'GenZ潮語 → 90後潮語', emoji: '💿' },
    { value: 'all-to-genz', label: '全部 → GenZ潮語', emoji: '⚡' },
  ];

  const limitTypeLabels = {
    daily: '每日',
  };

  const inputLabels = {
    'genz-to-normal': '輸入GenZ潮語',
    'genz-to-80s': '輸入GenZ潮語',
    'genz-to-90s': '輸入GenZ潮語',
    'all-to-genz': '輸入正常/舊式用語',
  };

  const inputPlaceholders = {
    'genz-to-normal': '例如：今日想躺平...',
    'genz-to-80s': '例如：好想chill一chill...',
    'genz-to-90s': '例如：今晚一齊打機...',
    'all-to-genz': '例如：今晚去飲茶...',
  };

  // 快速示例
  const quickExamples = {
    'genz-to-normal': [
      '今日想躺平',
      '好emo啊',
      '芭比Q了',
      'YYDS',
      '整活時間',
      '社死現場',
    ],
    'genz-to-80s': [
      '今日想躺平',
      '這件事好炸裂',
      '今晚chill住睇戲',
      '我要打卡這間咖啡店',
    ],
    'genz-to-90s': [
      '好emo啊',
      '這個人是yyds',
      '整活時間',
      '這個穿搭很有氛圍感',
    ],
    'all-to-genz': [
      '今晚去飲茶',
      '真係好攰',
      '你今天心情不好嗎',
      '這個造型很時髦',
    ],
  };

  // 載入每日使用統計
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

    if (isLimitReached && storageMode === 'local') {
      setError(`今日翻譯次數已達上限 (${dailyLimit}次)，請明天再試或升級會員`);
      return;
    }

    // 開始翻譯
    setIsLoading(true);
    setError('');
    setOutputText('');
    setExplanation('');
    setConfidence(0);
    setCopySuccess(false);
    setCopiedTranslationIndex(null);
    setQuotaDetails(null);

    try {
      const usageResult = await registerTranslationAttempt();
      if (!usageResult.allowed) {
        setIsLoading(false);
        if (usageResult.reason === 'quota-exceeded') {
          const limit = usageResult.quota?.limit ?? dailyLimit;
          const remaining = usageResult.quota?.remaining ?? 0;
          const limitType = usageResult.quota?.limitType || 'daily';

          setQuotaDetails({
            limit,
            remaining,
            limitType,
            currentCount:
              usageResult.quota?.currentCount ?? translationCount ?? limit,
          });
          setError(
            `今日翻譯次數已達上限 (${limit}次)，請明天再試或升級會員`
          );
        } else {
          setQuotaDetails(null);
          setError(
            `今日翻譯次數已達上限 (${dailyLimit}次)，請明天再試或升級會員`
          );
        }
        return;
      }

      const appliedLimit = usageResult.quota?.limit ?? dailyLimit;
      const remainingAfterAttempt =
        usageResult.quota?.remaining ??
        Math.max(appliedLimit - usageResult.translationCount, 0);

      trackTranslationAttempt(translationType, {
        usage_mode: usageResult.storageMode,
        count_after_attempt: usageResult.translationCount,
        daily_limit: appliedLimit,
        remaining_after_attempt: remainingAfterAttempt,
        user_id: usageResult.userId || 'local-fallback',
      });

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
      // 保存到本地存儲
      try {
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
      setQuotaDetails(null);
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
    setConfidence(0);
    setCopySuccess(false);
    setCopiedTranslationIndex(null);
    setQuotaDetails(null);
  };

  const handleTranslationTypeChange = (value) => {
    setTranslationType(value);
    setError('');
    setOutputText('');
    setExplanation('');
    setConfidence(0);
    setCopySuccess(false);
    setCopiedTranslationIndex(null);
    setQuotaDetails(null);
  };

  // 複製到剪貼板
  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
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

  const handleCopySingleTranslation = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTranslationIndex(index);
      setTimeout(() => setCopiedTranslationIndex(null), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedTranslationIndex(index);
      setTimeout(() => setCopiedTranslationIndex(null), 2000);
    }
  };

  // 清空輸入
  const handleClear = () => {
    setInputText('');
    setOutputText('');
    setExplanation('');
    setError('');
    setConfidence(0);
    setCopySuccess(false);
    setCopiedTranslationIndex(null);
    setQuotaDetails(null);
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

  const handleQuotaRetry = async () => {
    const usageStatus = await refreshUsage();
    const refreshedCount =
      usageStatus?.translationCount ?? translationCount;
    const mode = usageStatus?.storageMode ?? storageMode;

    if (!inputText.trim()) {
      return;
    }

    if (mode === 'remote' || refreshedCount < dailyLimit) {
      setQuotaDetails(null);
      setError('');
      await handleTranslate();
    } else {
      setQuotaDetails((prev) => ({
        limit: dailyLimit,
        remaining: Math.max(dailyLimit - refreshedCount, 0),
        limitType: prev?.limitType || 'daily',
        currentCount: refreshedCount,
      }));
      setError(
        `今日翻譯次數已達上限 (${dailyLimit}次)，請明天再試或升級會員`
      );
    }
  };

  const handleUpgradeClick = () => {
    if (upgradeUrl) {
      window.open(upgradeUrl, '_blank', 'noopener');
    }
  };

  // 信心度顏色
  const getConfidenceColor = (conf) => {
    if (conf >= 0.8) return 'text-green-600';
    if (conf >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formattedTranslations = useMemo(() => {
    if (!outputText) return [];
    return outputText
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }, [outputText]);

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
          {isUsageLoading
            ? '載入使用狀態中...'
            : `已翻譯 ${translationCount}/${dailyLimit} 次，剩餘 ${remainingTranslations} 次`}
          {!isUsageLoading && isLimitReached && (
            <span className="text-red-300 ml-2">今日限額已用完</span>
          )}
        </p>
        {!isUsageLoading && storageMode === 'local' && (
          <p className="text-yellow-200 text-xs mt-2">
            目前使用離線計數，恢復連線後將會自動同步。
          </p>
        )}
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
              onClick={() => handleTranslationTypeChange(type.value)}
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
                {inputLabels[translationType] || '輸入要翻譯的文字'}
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
              placeholder={
                inputPlaceholders[translationType] || '例如：今日想躺平...'
              }
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
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {formattedTranslations.map((line, index) => (
                        <div
                          key={`${line}-${index}`}
                          className="flex items-start gap-3 bg-white/5 rounded-lg px-3 py-2"
                        >
                          <span className="flex-1 leading-relaxed text-white">
                            {line}
                          </span>
                          <button
                            onClick={() =>
                              handleCopySingleTranslation(line, index)
                            }
                            className="flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded-md text-white text-xs transition-colors"
                          >
                            {copiedTranslationIndex === index ? (
                              <>
                                <CheckCircle size={12} />
                                已複製
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                複製
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
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
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
              <div>
                <span className="text-red-300 block">{error}</span>
                {quotaDetails && (
                  <p className="text-red-200 text-xs mt-1">
                    剩餘翻譯次數：{quotaDetails.remaining} / {quotaDetails.limit}（
                    {limitTypeLabels[quotaDetails.limitType] ||
                      quotaDetails.limitType}
                    配額）
                  </p>
                )}
              </div>
            </div>
            {quotaDetails && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleQuotaRetry}
                  disabled={isLoading || !inputText.trim()}
                  className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={14} />
                  重試翻譯
                </button>
                <button
                  type="button"
                  onClick={handleUpgradeClick}
                  className="flex items-center gap-1 px-3 py-1 bg-purple-500/80 hover:bg-purple-500 rounded-lg text-white text-sm transition-colors"
                >
                  <Sparkles size={14} />
                  升級會員
                </button>
              </div>
            )}
          </div>
        )}

        {/* 翻譯按鈕 */}
        <div className="mt-6 text-center">
          <button
            onClick={handleTranslate}
            disabled={
              isLoading ||
              !inputText.trim() ||
              (storageMode === 'local' && isLimitReached) ||
              isUsageLoading
            }
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
                {storageMode === 'local' && isLimitReached
                  ? '已達每日限額'
                  : 'AI智能翻譯'}
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
          {(
            quickExamples[translationType] || quickExamples['genz-to-normal']
          ).map((example, index) => (
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
            💡 例句會因應目前翻譯模式而更新，點擊立即體驗
          </p>
        </div>
      </div>
    </div>
  );
};

export default TranslatorWidget;
