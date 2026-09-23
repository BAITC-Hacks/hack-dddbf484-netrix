import { SearchForm } from '../components/SearchForm';
import { SearchResults, SearchResultsPlaceholder } from '../components/SearchResults';
import { Button } from '../components/Button';
import { PageLayout } from '../components/PageLayout';
import { Surface } from '../components/Surface';
import { useVendorSearch } from '../hooks/useVendorSearch';
import { activeDemoRequest } from '../services/vendorService';

export default function SearchPage() {
  const { options, optionsError, loading, error, result, search, clear, reloadOptions } = useVendorSearch();

  return (
    <PageLayout cities={options?.cities}>
      <section className="hero" aria-labelledby="page-title">
        <Surface className="hero-copy">
          <p className="eyebrow"><span className="tiny-star" aria-hidden="true">✳</span> ВАШЕ СОБЫТИЕ. ВАША КОМАНДА.</p>
          <h1 id="page-title">Подрядчики для вашего события</h1>
          <p className="hero-description">Найдите специалистов под вашу идею, дату и бюджет.<br className="desktop-break" /> С вниманием к деталям, которые важны именно вам.</p>
        </Surface>
        <div className="hero-art" aria-hidden="true"><span>✳</span></div>
      </section>
      <div className="search-layout" id="search">
        <aside>
          {options ? <SearchForm options={options} initialValues={activeDemoRequest} loading={loading} onSubmit={search} onReset={clear} /> : (
            <Surface className="search-surface options-state" role={optionsError ? 'alert' : 'status'}>
              {optionsError ? <><h2>Не удалось загрузить параметры</h2><p>Попробуйте ещё раз.</p><Button onClick={reloadOptions}>Повторить</Button></> : <p>Загружаем параметры поиска…</p>}
            </Surface>
          )}
        </aside>
        <div>
          {result && !loading && !error
            ? <SearchResults response={result.response} />
            : <SearchResultsPlaceholder loading={loading} error={error} />}
        </div>
      </div>
    </PageLayout>
  );
}
