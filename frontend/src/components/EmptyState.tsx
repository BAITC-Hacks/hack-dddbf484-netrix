type EmptyStateProps = {
  kind: 'initial' | 'no_category_in_city' | 'no_matches' | 'error';
  reason?: string | null;
};

export function EmptyState({ kind, reason }: EmptyStateProps) {
  if (kind === 'initial') {
    return (
      <div className="empty-state initial-state">
        <div className="empty-art" aria-hidden="true"><span>✳</span><span>✦</span><span>✧</span></div>
        <span className="small-label">БОЛЬШИЕ СОБЫТИЯ НАЧИНАЮТСЯ С ЛЮДЕЙ</span>
        <h3>Найдём тех, кто вас поймёт</h3>
        <p>Выберите город, дату и бюджет —<br />подходящие специалисты появятся здесь.</p>
        <div className="empty-benefits">
          <span><b>01</b> Ваши условия</span>
          <span><b>02</b> Проверка даты</span>
          <span><b>03</b> Понятный выбор</span>
        </div>
      </div>
    );
  }

  const title = kind === 'no_category_in_city'
    ? 'Пока нет специалистов этой категории в городе'
    : kind === 'no_matches'
      ? 'Все кандидаты исключены по условиям'
      : 'Не удалось получить результаты';

  return (
    <div className="empty-state no-results" role={kind === 'error' ? 'alert' : 'status'}>
      <div className="empty-symbol" aria-hidden="true">{kind === 'error' ? '!' : '⌕'}</div>
      <h3>{title}</h3>
      {reason && <p>{reason}</p>}
    </div>
  );
}
