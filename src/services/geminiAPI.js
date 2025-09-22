// src/services/geminiAPI.js
// Gemini API 翻譯服務 - 乾淨版本

import { GoogleGenAI } from '@google/genai';

class GeminiTranslationService {
  constructor() {
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    this.modelName =
      import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash-lite';
    this.defaultGenerationConfig = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1000,
      stopSequences: [],
    };
    this.aiClient = this.apiKey
      ? new GoogleGenAI({ apiKey: this.apiKey })
      : null;
  }

  // 基礎API調用方法
  async callGeminiAPI(prompt, maxTokens = 1000) {
    if (!this.aiClient) {
      throw new Error('Gemini API未正確初始化，請檢查API金鑰設定');
    }

    try {
      const response = await this.aiClient.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          ...this.defaultGenerationConfig,
          maxOutputTokens: maxTokens,
        },
      });

      const text = await this.extractTextFromResponse(response);

      if (!text) {
        throw new Error('Gemini API返回了空回應');
      }

      return text;
    } catch (error) {
      console.error('Gemini API調用錯誤:', error);
      throw error;
    }
  }

  // 從SDK回應中提取文字
  async extractTextFromResponse(response) {
    if (!response) return '';

    if (typeof response.text === 'function') {
      const text = await response.text();
      if (text) return text.trim();
    }

    if (typeof response.text === 'string') {
      return response.text.trim();
    }

    const innerResponse = response.response;
    if (innerResponse && innerResponse !== response) {
      const nestedText = await this.extractTextFromResponse(innerResponse);
      if (nestedText) return nestedText;
    }

    const candidates = response.candidates || innerResponse?.candidates || [];

    for (const candidate of candidates) {
      const parts = candidate?.content?.parts || [];
      const textParts = parts
        .map((part) => part?.text)
        .filter(Boolean)
        .map((part) => part.trim());

      if (textParts.length) {
        return textParts.join('\n');
      }
    }

    return '';
  }

  // 手動切換模型名稱
  setModel(modelName) {
    if (modelName) {
      this.modelName = modelName;
      console.log = modelName;
    }
  }

  // 潮語翻譯主要方法
  async translateSlang(text, translationType = 'genz-to-normal') {
    const prompts = {
      'genz-to-normal': `你是一個專業的香港潮語翻譯專家。請將以下香港GenZ潮語翻譯成正常的廣東話表達，並提供簡單解釋。

輸入文字：「${text}」

請嚴格按照以下JSON格式回答，不要添加任何其他文字：
{
  "translation": "正常廣東話表達",
  "explanation": "簡單說明這個詞的含義和使用場景",
  "confidence": 0.85
}

注意：
- 保持香港本地文化特色
- 使用日常容易理解的詞彙  
- 如果是正常詞彙，直接說明即可
- 必須返回有效的JSON格式`,

      'genz-to-80s': `你是一個香港語言文化專家。請將以下GenZ潮語轉換成80年代香港人的說法。

輸入文字：「${text}」

請嚴格按照以下JSON格式回答：
{
  "translation": "80年代的表達方式",
  "explanation": "解釋兩個年代表達的差異",
  "confidence": 0.8
}`,

      'genz-to-90s': `你是一個香港語言文化專家。請將以下GenZ潮語轉換成90年代香港人的說法。

輸入文字：「${text}」

請嚴格按照以下JSON格式回答：
{
  "translation": "90年代的表達方式", 
  "explanation": "解釋兩個年代表達的差異",
  "confidence": 0.8
}`,
    };

    const prompt = prompts[translationType] || prompts['genz-to-normal'];

    try {
      const result = await this.callGeminiAPI(prompt);
      return this.parseTranslationResult(result);
    } catch (error) {
      console.error('Gemini API調用失敗，使用備援翻譯:', error);
      return this.fallbackTranslation(text, translationType);
    }
  }

  // 解析翻譯結果
  parseTranslationResult(result) {
    try {
      // 嘗試解析JSON回應
      let jsonResult;

      // 處理可能包含markdown格式的回應
      const cleanedResult = result.replace(/```json\n?|\n?```/g, '').trim();

      try {
        jsonResult = JSON.parse(cleanedResult);
      } catch {
        // 如果JSON解析失敗，嘗試從文本中提取信息
        jsonResult = this.extractFromText(cleanedResult);
      }

      return {
        translation: jsonResult.translation || cleanedResult,
        explanation: jsonResult.explanation || '',
        source: 'ai',
        confidence: jsonResult.confidence || 0.75,
        rawResponse: result,
      };
    } catch (error) {
      console.error('結果解析失敗:', error);
      return {
        translation: result,
        explanation: '',
        source: 'ai',
        confidence: 0.5,
        rawResponse: result,
      };
    }
  }

  // 從文本中提取翻譯信息
  extractFromText(text) {
    const lines = text.split('\n').filter((line) => line.trim());
    let translation = '';
    let explanation = '';

    for (const line of lines) {
      if (line.includes('翻譯') || line.includes('表達')) {
        const match = line.match(/[:：](.+)/);
        if (match) translation = match[1].trim();
      } else if (
        line.includes('解釋') ||
        line.includes('說明') ||
        line.includes('差異')
      ) {
        const match = line.match(/[:：](.+)/);
        if (match) explanation = match[1].trim();
      }
    }

    return {
      translation: translation || text,
      explanation: explanation,
      confidence: 0.6,
    };
  }

  // 備援翻譯（使用本地詞典）
  fallbackTranslation(text, translationType) {
    const localDict = {
      'genz-to-normal': {
        躺平: {
          translation: '不想努力，選擇放棄奮鬥',
          explanation: '表示對現狀不滿但選擇消極應對',
        },
        摸魚: {
          translation: '在工作時間偷懶',
          explanation: '上班時間做私人事情或不專心工作',
        },
        emo: {
          translation: '情緒低落',
          explanation: '心情不好，感到沮喪或憂鬱',
        },
        芭比Q: {
          translation: '完蛋了',
          explanation: 'barbecue的諧音，表示事情搞砸了',
        },
        yyds: {
          translation: '永遠的神',
          explanation: '表示某人或某事物非常厲害，值得崇拜',
        },
        內卷: {
          translation: '過度競爭',
          explanation: '指惡性競爭，大家都很累但沒有實質進步',
        },
        社死: {
          translation: '社交性死亡',
          explanation: '做了很尷尬的事，覺得沒臉見人',
        },
        整活: {
          translation: '搞事情，做有趣的事',
          explanation: '指做一些有創意或搞笑的事情',
        },
        破防: {
          translation: '心理防線被突破',
          explanation: '指情緒被觸動，無法保持冷靜',
        },
      },
      'genz-to-80s': {
        躺平: {
          translation: 'hea做',
          explanation: '80年代用hea來形容懶散的狀態',
        },
        厲害: { translation: '勁', explanation: '80年代常用「勁」來表達厲害' },
        很好: { translation: '正', explanation: '80年代用「正」來表達很好' },
      },
      'genz-to-90s': {
        躺平: {
          translation: '收工',
          explanation: '90年代用收工表示不想再努力',
        },
        厲害: { translation: '激', explanation: '90年代常用「激」來表達厲害' },
        很好: {
          translation: '好正',
          explanation: '90年代用「好正」來表達很棒',
        },
      },
    };

    const dict = localDict[translationType] || localDict['genz-to-normal'];
    const normalizedText = text.toLowerCase().trim();

    // 檢查完全匹配
    let result = dict[normalizedText];

    // 如果沒有完全匹配，嘗試部分匹配
    if (!result) {
      for (const [key, value] of Object.entries(dict)) {
        if (normalizedText.includes(key) || key.includes(normalizedText)) {
          result = value;
          break;
        }
      }
    }

    if (result) {
      return {
        ...result,
        source: 'local',
        confidence: 0.9,
      };
    }

    return {
      translation: '未找到對應翻譯',
      explanation: '這個詞可能是新興潮語，我們會儘快更新詞庫',
      source: 'fallback',
      confidence: 0.1,
    };
  }

  // 測試API連接
  async testConnection() {
    try {
      const result = await this.callGeminiAPI('請回答：你好，測試連接成功');

      console.log('✅ Gemini API連接成功');
      console.log('測試回應:', result);
      return true;
    } catch (error) {
      console.error('❌ Gemini API連接失敗:', error.message);

      // 提供更詳細的錯誤信息
      if (error.message.includes('API_KEY_INVALID')) {
        console.error('請檢查VITE_GEMINI_API_KEY是否正確設置');
      } else if (error.message.includes('QUOTA_EXCEEDED')) {
        console.error('API配額已用完，請檢查使用量或升級計劃');
      }

      return false;
    }
  }

  // 批量測試翻譯效果
  async batchTest() {
    const testCases = [
      { text: '躺平', type: 'genz-to-normal' },
      { text: '今日返工好想摸魚', type: 'genz-to-normal' },
      { text: 'yyds', type: 'genz-to-80s' },
      { text: '好emo', type: 'genz-to-90s' },
      { text: '芭比Q了', type: 'genz-to-normal' },
    ];

    console.log('🧪 開始批量測試Gemini翻譯功能...\n');

    const results = [];

    for (const testCase of testCases) {
      try {
        console.log(`測試: "${testCase.text}" (${testCase.type})`);
        const result = await this.translateSlang(testCase.text, testCase.type);

        console.log(`翻譯: ${result.translation}`);
        console.log(`解釋: ${result.explanation}`);
        console.log(`來源: ${result.source} (信心度: ${result.confidence})`);
        console.log('---');

        results.push({
          input: testCase.text,
          type: testCase.type,
          success: true,
          result: result,
        });

        // 避免API調用過於頻繁
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`測試失敗: ${testCase.text}`, error.message);
        results.push({
          input: testCase.text,
          type: testCase.type,
          success: false,
          error: error.message,
        });
      }
    }

    // 統計測試結果
    const successCount = results.filter((r) => r.success).length;
    const totalCount = results.length;
    console.log(
      `\n📊 測試總結: ${successCount}/${totalCount} 成功 (${Math.round(
        (successCount / totalCount) * 100
      )}%)`
    );

    return results;
  }
}

// 創建服務實例
const geminiTranslator = new GeminiTranslationService();

// 導出服務實例
export { geminiTranslator };

// 快速測試函數
export const quickTest = async () => {
  try {
    console.log('🔥 快速測試開始...');

    const result = await geminiTranslator.translateSlang(
      '今日想躺平',
      'genz-to-normal'
    );
    console.log('✅ 翻譯成功:', result);

    return result;
  } catch (error) {
    console.error('❌ 快速測試失敗:', error);
    return null;
  }
};

// 完整測試套件
export const runTests = async () => {
  console.log('🚀 開始Gemini API測試...\n');

  // 1. 測試連接
  const isConnected = await geminiTranslator.testConnection();
  if (!isConnected) {
    console.log('❌ 請檢查以下項目：');
    console.log('1. VITE_GEMINI_API_KEY是否正確設置在.env文件中');
    console.log('2. 網絡連接是否正常');
    console.log('3. API配額是否足夠');
    return false;
  }

  // 2. 批量測試
  await geminiTranslator.batchTest();

  console.log('✅ 所有測試完成！');
  return true;
};

// 測試API連接
export const testConnection = async () => {
  return await geminiTranslator.testConnection();
};

// 單次翻譯測試
export const testTranslation = async (text, type = 'genz-to-normal') => {
  try {
    const result = await geminiTranslator.translateSlang(text, type);
    return result;
  } catch (error) {
    console.error('翻譯測試失敗:', error);
    return null;
  }
};

// 預設導出
export default geminiTranslator;
