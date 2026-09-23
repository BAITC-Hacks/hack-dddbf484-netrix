# Передача фронтенда на интеграцию

## Локальный запуск и проверка

Нужен Node.js 20.19+ или 22.12+.

```bash
cd frontend
npm ci
npm run dev
npm run check
```

Главная страница открывается по адресу, который напечатает Vite (обычно
`http://localhost:5173/`). В режиме разработки `/preview` переключает шесть
пар «запрос → ответ/ошибка». `npm run check` проверяет типы, запускает тесты и
создаёт production-сборку. `/preview` в production недоступен.

## Текущая граница данных

Единственная точка выбора реализации — `src/services/vendorService.ts`.
Сейчас она подключает `createMockVendorService` из
`src/services/mockVendorService.ts`, фиксированные пары находятся в
`src/mocks/scenarios.ts`, а анкеты — в `src/mocks/vendors.json`. Мок принимает
только точный запрос своего сценария; произвольный подбор отсутствует. В
`src/services/apiVendorService.ts` находится заглушка, которая возвращает
«Бэкенд ещё не подключён» и не отправляет запросов. После согласования API
реализуйте там `VendorService` и смените экспорт в `vendorService.ts`.
Компоненты, сценарии и серверные файлы для этого менять не требуется.

Предварительные пути, **ещё не существующие как подключённый API**:

| Метод | Путь | Назначение |
| --- | --- | --- |
| `GET` | `/api/options` | Справочники города, категории, формата, языка и валюта бюджета |
| `POST` | `/api/search` | Поиск по `SearchRequest`, результат `SearchResponse` |

Адреса и DTO нужно подтвердить с командой бэкенда. Не следует считать
существующий `/chat` поисковым API. API-ключей и сетевых запросов в клиенте нет.

## Предварительные типы

Точный источник типов — `src/services/contracts.ts`. Запрос:

```ts
type SearchRequest = {
  city: string;
  category: string;
  event_date: string; // YYYY-MM-DD, календарная дата без часового пояса
  budget: number; // положительное число, валюта из SearchOptions.currency
  event_format: string;
  language?: string;
  duration_minutes?: number; // положительное целое, если задано
  wishes?: string;
};
```

`getOptions()` возвращает `SearchOptions`: массивы `cities`, `categories`,
`event_formats`, `languages` и код `currency` (сейчас `KZT`). `search()`
возвращает `SearchResponse` со статусом `matches`, `no_category_in_city` или
`no_matches`; массивом `cards`; числом `total_matches`; числом
`excluded_busy`; объектом `exclusion_summary` со счётчиками `busy`, `budget`,
`event_format`, `language`, `duration`; и строкой `shortfall_reason` или `null`.
Карточка содержит `id`, `name`, `city`, `category`, `price_from`, `currency`,
`price_unit`, `event_formats`, `description_detail`, `explanations`, а также
независимые boolean-флаги `synthetic`, `price_imputed`, `city_imputed`.
Фронтенд показывает максимум три карточки в порядке ответа и не пересчитывает
причины исключения.

```ts
type SearchResponse = {
  status: 'matches' | 'no_category_in_city' | 'no_matches';
  cards: VendorCard[];
  total_matches: number;
  excluded_busy: number;
  exclusion_summary: {
    busy: number;
    budget: number;
    event_format: number;
    language: number;
    duration: number;
  };
  shortfall_reason: string | null;
};

type VendorCard = {
  id: string;
  name: string;
  city: string;
  category: string;
  price_from: number;
  currency: string;
  price_unit: string | null;
  event_formats: string[];
  description_detail: string;
  explanations: string[];
  synthetic: boolean;
  price_imputed: boolean;
  city_imputed: boolean;
};
```

Ниже три **реальных фиксированных ответа мока**. Эти примеры описывают
предварительный UI-контракт, а не обещают формат будущего API.

### Найден один подрядчик

Запрос: `{"city":"Алматы","category":"Фото и видеобудки","event_date":"2026-10-10","budget":500000,"event_format":"свадьба"}`.

```json
{
  "status": "matches",
  "cards": [
    {
      "id": "HK-35846",
      "name": "Аска Ленгли",
      "city": "Алматы",
      "category": "Фото и видеобудки",
      "price_from": 450000,
      "currency": "KZT",
      "price_unit": null,
      "event_formats": ["корпоратив", "свадьба", "юбилей", "конференция"],
      "description_detail": "NERV Events – команда профессионалов, для которых важен результат. Мы создаём впечатления, о которых хочется рассказывать снова и снова. Компания на рынке более 15 лет. 3 основных направления: Встреча гостей; Световые и пиксельные шоу; Интерактивные фото/видеозоны. В нашей команде – технические специалисты, артисты и менеджеры, объединённые одной целью: делать вау-эффект реальностью. Мы соединяем технологии и искусство, превращая любое событие в синтез эмоций, света и движения.",
      "explanations": [
        "Город в данных: Алматы",
        "Дата 2026-10-10 не отмечена занятой в данных",
        "Цена «от» в пределах указанного бюджета",
        "Формат в анкете: свадьба"
      ],
      "synthetic": false,
      "price_imputed": true,
      "city_imputed": true
    }
  ],
  "total_matches": 1,
  "excluded_busy": 1,
  "exclusion_summary": {
    "busy": 1,
    "budget": 0,
    "event_format": 0,
    "language": 0,
    "duration": 0
  },
  "shortfall_reason": "Второй кандидат (HK-90009) отмечен занятым на выбранную дату."
}
```

### Категории нет в городе

Запрос: `{"city":"Зарубежье","category":"Флорист","event_date":"2026-10-11","budget":3000000,"event_format":"свадьба"}`.

```json
{
  "status": "no_category_in_city",
  "cards": [],
  "total_matches": 0,
  "excluded_busy": 0,
  "exclusion_summary": {
    "busy": 0,
    "budget": 0,
    "event_format": 0,
    "language": 0,
    "duration": 0
  },
  "shortfall_reason": "В данных нет флористов с городом «Зарубежье»."
}
```

### Все кандидаты исключены

Запрос: `{"city":"Алматы","category":"Декоратор","event_date":"2026-10-12","budget":1000,"event_format":"свадьба"}`.

```json
{
  "status": "no_matches",
  "cards": [],
  "total_matches": 0,
  "excluded_busy": 1,
  "exclusion_summary": {
    "busy": 1,
    "budget": 2,
    "event_format": 0,
    "language": 0,
    "duration": 0
  },
  "shortfall_reason": "Один декоратор отмечен занятым на дату, цена «от» ещё двух выше указанного бюджета."
}
```

## Что согласовать перед подключением

- Точные пути, методы, коды ошибок и схему ошибки; нужны ли авторизация и
  отдельный базовый URL. Секреты нельзя встраивать в клиент.
- Названия полей DTO и значения справочников. `event_date` должна оставаться
  календарной датой `YYYY-MM-DD` без преобразования часового пояса.
- Валюту бюджета и цену `price_from`: число или строка Decimal, единица цены,
  налоги и смысл «от». Сейчас у исходного JSON единица цены не указана.
- Смысл `duration_minutes` и исходного `max_hours`: пакет часов нельзя
  автоматически считать максимальным временем работы.
- Как подтверждается доступность по дате. Отсутствие даты в `busy_dates` само
  по себе не доказывает доступность.
- Значение `total_matches`, лимит и пагинацию; порядок карточек; причины
  исключения и правило одного основного счётчика на подрядчика.
- Нужны ли `shortfall_reason` и `explanations` уже готовыми строками ответа,
  особенно для одной или двух карточек, или локализованные коды причин.
- Источник и обязательность `synthetic`, `price_imputed`, `city_imputed`.
  Отсутствующий флаг нельзя молча заменять на `false`.
- Формат полной исходной характеристики и индивидуальной детали; фотографии,
  рейтинги, отзывы и контакты пока не предоставлены и не отображаются.

Пока отдельный сервис связи или бронирования не определён, кнопка «Связаться»
остаётся неактивной и ничего не отправляет.
