import { useEffect, useMemo, useRef, useState } from 'react';
import { PageLayout } from '../components/PageLayout';
import { SearchForm } from '../components/SearchForm';
import { SearchResults, SearchResultsPlaceholder } from '../components/SearchResults';
import { Surface } from '../components/Surface';
import type { SearchOptions, SearchRequest, SearchResponse } from '../services/contracts';
import { createDemoPreviewService, getDemoPreviewScenarios } from '../services/vendorService';

const scenarios = getDemoPreviewScenarios();

export default function PreviewPage() {
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const [options, setOptions] = useState<SearchOptions | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  const scenario = scenarios.find((item) => item.id === scenarioId)!;
  const service = useMemo(() => createDemoPreviewService(scenarioId), [scenarioId]);

  useEffect(() => {
    const current = ++requestId.current;
    let active = true;
    async function loadScenario() {
      try {
        const nextOptions = await service.getOptions();
        if (!active || requestId.current !== current) return;
        setOptions(nextOptions);
        const nextResponse = await service.search(scenario.request);
        if (active && requestId.current === current) setResponse(nextResponse);
      } catch (cause) {
        if (active && requestId.current === current) {
          setError(cause instanceof Error ? cause.message : 'Не удалось загрузить сценарий.');
        }
      } finally {
        if (active && requestId.current === current) setLoading(false);
      }
    }
    void loadScenario();
    return () => { active = false; requestId.current += 1; };
  }, [scenario, service]);

  function selectScenario(id: typeof scenarioId) {
    if (id === scenarioId) return;
    requestId.current += 1;
    setOptions(null);
    setResponse(null);
    setError(null);
    setLoading(true);
    setScenarioId(id);
  }

  async function search(request: SearchRequest) {
    if (loading) return;
    const current = ++requestId.current;
    setResponse(null);
    setError(null);
    setLoading(true);
    try {
      const nextResponse = await service.search(request);
      if (requestId.current === current) setResponse(nextResponse);
    } catch (cause) {
      if (requestId.current === current) {
        setError(cause instanceof Error ? cause.message : 'Не удалось выполнить поиск.');
      }
    } finally {
      if (requestId.current === current) setLoading(false);
    }
  }

  function reset() {
    requestId.current += 1;
    setResponse(null);
    setError(null);
    setLoading(false);
  }

  return (
    <PageLayout cities={options?.cities}>
      <Surface className="preview-intro">
        <p className="eyebrow">ТОЛЬКО ДЛЯ РАЗРАБОТКИ</p>
        <h1>Предпросмотр состояний</h1>
        <p>Выберите фиксированный сценарий: форма и результат загружаются через mock-сервис. Изменённый запрос может получить ошибку, потому что свободный подбор здесь не реализован.</p>
        <label htmlFor="preview-scenario">Сценарий</label>
        <select id="preview-scenario" value={scenarioId} onChange={(event) => selectScenario(event.target.value as typeof scenarioId)}>
          {scenarios.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <a href="./">Вернуться к поиску</a>
      </Surface>
      <div className="search-layout" id="search">
        <aside>
          {options
            ? <SearchForm key={scenario.id} options={options} initialValues={scenario.request} loading={loading} onSubmit={search} onReset={reset} />
            : <Surface className="search-surface options-state" role="status">Загружаем параметры поиска…</Surface>}
        </aside>
        <div>
          {response && !loading && !error
            ? <SearchResults response={response} />
            : <SearchResultsPlaceholder loading={loading} error={error} />}
        </div>
      </div>
    </PageLayout>
  );
}
