import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  querySimilarPhrasesService,
  resetQuerySimilarPhrasesCache,
} from '../services/phraseSearchService';

const PhraseSearchContext = createContext({
  matches: [],
  isLoading: false,
  error: null,
  lastQuery: '',
  metadata: null,
  fetchSimilarPhrases: async () => ({ matches: [] }),
  resetSearch: () => {},
});

function normalizeError(error) {
  if (!error) {
    return null;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch (serializationError) {
      console.warn('無法序列化錯誤:', serializationError);
    }
  }
  return '未知錯誤';
}

export function PhraseSearchProvider({ children }) {
  const [state, setState] = useState({
    matches: [],
    isLoading: false,
    error: null,
    lastQuery: '',
    metadata: null,
  });

  const fetchSimilarPhrases = useCallback(
    async (query, options) => {
      const trimmed = typeof query === 'string' ? query.trim() : '';
      if (!trimmed) {
        setState((prev) => ({
          ...prev,
          matches: [],
          error: null,
          lastQuery: '',
          metadata: null,
          isLoading: false,
        }));
        return { matches: [], query: '' };
      }

      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        lastQuery: trimmed,
      }));

      try {
        const response = await querySimilarPhrasesService({
          query: trimmed,
          ...(options || {}),
        });

        const matches = Array.isArray(response?.results)
          ? response.results
          : [];

        setState({
          matches,
          error: null,
          isLoading: false,
          lastQuery: trimmed,
          metadata: {
            topK: response?.topK ?? options?.topK ?? undefined,
            threshold: response?.threshold ?? options?.threshold ?? undefined,
            count: response?.count ?? matches.length,
            fetchedAt: response?.fetchedAt ?? new Date().toISOString(),
          },
        });

        return { matches, response };
      } catch (error) {
        console.error('Supabase 相似詞搜尋失敗:', error);
        setState((prev) => ({
          ...prev,
          matches: [],
          isLoading: false,
          error: normalizeError(error),
          metadata: null,
        }));
        return { matches: [], error };
      }
    },
    []
  );

  const resetSearch = useCallback(() => {
    resetQuerySimilarPhrasesCache();
    setState({
      matches: [],
      isLoading: false,
      error: null,
      lastQuery: '',
      metadata: null,
    });
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      fetchSimilarPhrases,
      resetSearch,
    }),
    [state, fetchSimilarPhrases, resetSearch]
  );

  return (
    <PhraseSearchContext.Provider value={value}>
      {children}
    </PhraseSearchContext.Provider>
  );
}

export function usePhraseSearch() {
  return useContext(PhraseSearchContext);
}
