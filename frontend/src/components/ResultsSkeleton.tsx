export function ResultsSkeleton() {
  return (
    <div className="results-skeleton" role="status" aria-label="Загружаем результаты">
      <span className="loading-dot" aria-hidden="true" />
      <h3>Собираем вашу подборку</h3>
      <p>Сверяем условия и доступность на дату.</p>
      <div className="skeleton-cards" aria-hidden="true">
        {[0, 1, 2].map((index) => <div className="skeleton-card" key={index}><span /><span /><span /></div>)}
      </div>
    </div>
  );
}
