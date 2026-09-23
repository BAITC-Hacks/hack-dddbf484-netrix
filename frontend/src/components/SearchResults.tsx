import type { ReactNode } from 'react';
import type { ExclusionReason, SearchResponse } from '../services/contracts';
import { EmptyState } from './EmptyState';
import { ResultsSkeleton } from './ResultsSkeleton';
import { Surface } from './Surface';
import { VendorCard } from './VendorCard';

const exclusionLabels: Record<ExclusionReason, string> = {
  busy: 'заняты на дату',
  budget: 'выше бюджета',
  event_format: 'другой формат',
  language: 'не подходит язык',
  duration: 'длительность не подходит или не подтверждена',
};

type ResultsFrameProps = {
  count?: number;
  busy?: number;
  loading?: boolean;
  children: ReactNode;
};

function ResultsFrame({ count, busy, loading = false, children }: ResultsFrameProps) {
  return (
    <Surface className="results-surface">
      <section className="results" aria-labelledby="results-title" aria-busy={loading}>
        <div className="results-heading">
          <div>
            <p className="eyebrow">ПОДХОДЯТ ИМЕННО ВАМ</p>
            <h2 id="results-title">Ваша будущая команда</h2>
          </div>
          <span className="result-count">{count === undefined ? 'Всё начинается с идеи' : `Найдено: ${count}`}</span>
        </div>
        {busy !== undefined && <p className="busy-count">Исключено из-за занятости: {busy}</p>}
        <div aria-live="polite" aria-atomic="true">{children}</div>
        <div className="demo-notice"><span aria-hidden="true">ⓘ</span><p>Демонстрационный режим. Подбор по предоставленным анкетам. Синтетические и дополненные данные отмечены в карточках. Заявки и бронирования не отправляются.</p></div>
      </section>
    </Surface>
  );
}

export function SearchResults({ response }: { response: SearchResponse }) {
  return (
    <ResultsFrame count={response.total_matches} busy={response.excluded_busy}>
      {response.status === 'matches' ? (
        <>
          <div className="cards-grid">{response.cards.slice(0, 3).map((card) => <VendorCard key={card.id} card={card} />)}</div>
          {response.cards.length < 3 && response.shortfall_reason && <p className="results-note">{response.shortfall_reason}</p>}
        </>
      ) : (
        <EmptyState kind={response.status} reason={response.shortfall_reason} />
      )}
      {Object.entries(response.exclusion_summary).some(([, count]) => count > 0) && (
        <div className="exclusion-summary">
          <h3>Кто не попал в подборку</h3>
          <ul>{(Object.entries(response.exclusion_summary) as [ExclusionReason, number][])
            .filter(([, count]) => count > 0)
            .map(([reason, count]) => <li key={reason}>{count} — {exclusionLabels[reason]}</li>)}</ul>
        </div>
      )}
    </ResultsFrame>
  );
}

export function SearchResultsPlaceholder({ loading = false, error = null }: { loading?: boolean; error?: string | null }) {
  return (
    <ResultsFrame loading={loading}>
      {loading ? <ResultsSkeleton /> : error ? <EmptyState kind="error" reason={error} /> : <EmptyState kind="initial" />}
    </ResultsFrame>
  );
}
