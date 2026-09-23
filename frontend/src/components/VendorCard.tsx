import type { VendorCard as VendorCardData } from '../services/contracts';

export function VendorCard({ card }: { card: VendorCardData }) {
  const price = new Intl.NumberFormat('ru-KZ', {
    style: 'currency',
    currency: card.currency,
    maximumFractionDigits: 2,
  }).format(card.price_from);

  return (
    <article className="vendor-card" data-vendor-id={card.id}>
      <div className="vendor-heading">
        <div className="vendor-avatar" aria-hidden="true">{card.name.slice(0, 1)}</div>
        <div>
          <p className="vendor-category">{card.category} <span aria-hidden="true">·</span> {card.city}</p>
          <h3>{card.name}</h3>
        </div>
      </div>
      <p className="vendor-detail">{card.description_detail}</p>
      <div className="format-tags" aria-label="Форматы событий">
        {card.event_formats.map((format) => <span key={format}>{format}</span>)}
      </div>
      <div className="vendor-price">
        <strong>от {price}</strong>
        <span>{card.price_unit ?? 'Единица цены не указана'}</span>
      </div>
      <div className="provenance" aria-label="Происхождение данных">
        {card.synthetic && <span>Демонстрационный профиль</span>}
        {card.price_imputed && <span>Оценочная цена</span>}
        {card.city_imputed && <span>Город дополнен</span>}
      </div>
      <details className="match-reasons">
        <summary>Почему подходит</summary>
        <ul>{card.explanations.map((reason, index) => <li key={`${index}-${reason}`}>{reason}</li>)}</ul>
      </details>
      <div className="contact-action">
        <button className="button button--secondary" type="button" disabled aria-describedby={`contact-note-${card.id}`}>Связаться</button>
        <span id={`contact-note-${card.id}`}>Будет доступно после подключения сервиса</span>
      </div>
    </article>
  );
}
