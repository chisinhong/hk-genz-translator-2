import { httpsCallable } from 'firebase/functions';
import {
  ensureAuthUser,
  ensureFirebaseApp,
  getFirebaseFunctions,
} from './firebaseApp';

let queryPhrasesCallable = null;

function normalizeOptions(options = {}) {
  const topK = Number.isFinite(options.topK) ? options.topK : undefined;
  const threshold = Number.isFinite(options.threshold)
    ? options.threshold
    : undefined;

  return {
    topK,
    threshold,
  };
}

export async function querySimilarPhrasesService({
  query,
  topK,
  threshold,
} = {}) {
  const trimmed = typeof query === 'string' ? query.trim() : '';
  if (!trimmed) {
    return {
      query: '',
      topK: topK ?? 5,
      threshold: threshold ?? 0.7,
      count: 0,
      results: [],
    };
  }

  ensureFirebaseApp();
  try {
    await ensureAuthUser();
  } catch (error) {
    console.warn('Supabase 搜尋需要登入，將使用匿名登入流程。', error);
  }

  const functionsInstance = getFirebaseFunctions();

  if (!queryPhrasesCallable) {
    queryPhrasesCallable = httpsCallable(functionsInstance, 'queryPhrases');
  }

  const payload = {
    query: trimmed,
    ...normalizeOptions({ topK, threshold }),
  };

  const response = await queryPhrasesCallable(payload);
  return response?.data ?? { query: trimmed, results: [] };
}

export function resetQuerySimilarPhrasesCache() {
  queryPhrasesCallable = null;
}
