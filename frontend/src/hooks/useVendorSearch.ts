import { useEffect, useRef, useState } from 'react';
import type { SearchOptions, SearchRequest, SearchResponse } from '../services/contracts';
import { vendorService } from '../services/vendorService';

type SearchResult = { request: SearchRequest; response: SearchResponse };

export function useVendorSearch() {
  const [options, setOptions] = useState<SearchOptions | null>(null);
  const [optionsError, setOptionsError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const inFlight = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    let active = true;
    setOptionsError(false);
    vendorService.getOptions().then(
      (data) => { if (active) setOptions(data); },
      () => { if (active) setOptionsError(true); },
    );
    return () => { active = false; };
  }, [retry]);

  async function search(request: SearchRequest) {
    if (inFlight.current) return;
    inFlight.current = true;
    const currentGeneration = ++generation.current;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await vendorService.search(request);
      if (generation.current === currentGeneration) setResult({ request, response });
    } catch (cause) {
      if (generation.current === currentGeneration) {
        setError(cause instanceof Error ? cause.message : 'Не удалось выполнить поиск.');
      }
    } finally {
      if (generation.current === currentGeneration) {
        inFlight.current = false;
        setLoading(false);
      }
    }
  }

  function clear() {
    generation.current += 1;
    inFlight.current = false;
    setLoading(false);
    setError(null);
    setResult(null);
  }

  return {
    options,
    optionsError,
    loading,
    error,
    result,
    search,
    clear,
    reloadOptions: () => setRetry((value) => value + 1),
  };
}
