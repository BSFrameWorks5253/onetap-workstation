import { useState, useMemo, useEffect } from 'react';
import { CategoryType, SearchResultItem } from '../types';
import { searchEngine } from '../services/searchEngine';

export function useSearch(maxResults: number = 25) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryType>('All');
  const [searchLatencyMs, setSearchLatencyMs] = useState(0);

  const results: SearchResultItem[] = useMemo(() => {
    const start = performance.now();
    const items = searchEngine.search(query, category, maxResults);
    const end = performance.now();
    setSearchLatencyMs(Math.round((end - start) * 100) / 100);
    return items;
  }, [query, category, maxResults]);

  const refreshIndex = () => {
    searchEngine.rebuildIndex();
  };

  return {
    query,
    setQuery,
    category,
    setCategory,
    results,
    searchLatencyMs,
    refreshIndex,
  };
}
