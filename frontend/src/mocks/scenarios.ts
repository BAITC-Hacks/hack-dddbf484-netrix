import type {
  ExclusionSummary,
  SearchRequest,
  SearchResponse,
  SearchStatus,
  VendorCard,
} from '../services/contracts';
import { mockVendors } from './vendors';

export type DemoScenarioId =
  | 'three_cards'
  | 'two_cards_with_reason'
  | 'one_card'
  | 'no_category_in_city'
  | 'all_candidates_excluded'
  | 'service_error';

export type DemoScenario = {
  id: DemoScenarioId;
  request: SearchRequest;
  outcome:
    | { kind: 'response'; response: SearchResponse }
    | { kind: 'error'; message: string };
};

const byId = new Map(mockVendors.map((vendor) => [vendor.id, vendor]));

/** Look up explicitly selected original ids. This is fixture validation, not search. */
function card(id: string, request: SearchRequest): VendorCard {
  const row = byId.get(id);
  if (!row) throw new Error(`No supplied profile with id ${id}`);
  if (
    row.city !== request.city ||
    !row.categories.includes(request.category) ||
    row.busy_dates.includes(request.event_date) ||
    row.price_from > request.budget ||
    !row.event_formats.includes(request.event_format)
  ) {
    throw new Error(`Profile ${id} contradicts demo request`);
  }
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    category: request.category,
    price_from: row.price_from,
    currency: row.currency,
    price_unit: row.price_unit,
    event_formats: [...row.event_formats],
    description_detail: row.description_detail,
    explanations: [
      `Город в данных: ${row.city}`,
      `Дата ${request.event_date} не отмечена занятой в данных`,
      'Цена «от» в пределах указанного бюджета',
      `Формат в анкете: ${request.event_format}`,
    ],
    synthetic: row.synthetic,
    price_imputed: row.price_imputed,
    city_imputed: row.city_imputed,
  };
}

const emptySummary: ExclusionSummary = {
  busy: 0,
  budget: 0,
  event_format: 0,
  language: 0,
  duration: 0,
};

function response(
  status: SearchStatus,
  request: SearchRequest,
  ids: string[],
  excluded: Partial<ExclusionSummary> = {},
  shortfallReason: string | null = null,
): SearchResponse {
  const cards = ids.map((id) => card(id, request));
  const exclusion_summary = { ...emptySummary, ...excluded };
  return {
    status,
    cards,
    total_matches: cards.length,
    excluded_busy: exclusion_summary.busy,
    exclusion_summary,
    shortfall_reason: shortfallReason,
  };
}

const threeRequest: SearchRequest = {
  city: 'Алматы',
  category: 'Декоратор',
  event_date: '2026-10-11',
  budget: 3_000_000,
  event_format: 'свадьба',
};
const twoRequest: SearchRequest = { ...threeRequest, event_date: '2026-10-12' };
const oneRequest: SearchRequest = {
  city: 'Алматы',
  category: 'Фото и видеобудки',
  event_date: '2026-10-10',
  budget: 500_000,
  event_format: 'свадьба',
};
const noCategoryRequest: SearchRequest = { ...threeRequest, city: 'Зарубежье', category: 'Флорист' };
const allExcludedRequest: SearchRequest = { ...twoRequest, budget: 1_000 };

type ScenarioMap = { [K in DemoScenarioId]: DemoScenario & { id: K } };

/** Fixed, auditable request/outcome pairs. They do not imply general search. */
export const demoScenarios = {
  three_cards: {
    id: 'three_cards',
    request: threeRequest,
    outcome: {
      kind: 'response',
      response: response('matches', threeRequest, ['HK-11484', 'HK-90003', 'HK-90004']),
    },
  },
  two_cards_with_reason: {
    id: 'two_cards_with_reason',
    request: twoRequest,
    outcome: {
      kind: 'response',
      response: response(
        'matches',
        twoRequest,
        ['HK-90003', 'HK-90004'],
        { busy: 1 },
        'Третий декоратор (HK-11484) отмечен занятым на выбранную дату.',
      ),
    },
  },
  one_card: {
    id: 'one_card',
    request: oneRequest,
    outcome: {
      kind: 'response',
      response: response(
        'matches',
        oneRequest,
        ['HK-35846'],
        { busy: 1 },
        'Второй кандидат (HK-90009) отмечен занятым на выбранную дату.',
      ),
    },
  },
  no_category_in_city: {
    id: 'no_category_in_city',
    request: noCategoryRequest,
    outcome: {
      kind: 'response',
      response: response(
        'no_category_in_city',
        noCategoryRequest,
        [],
        {},
        'В данных нет флористов с городом «Зарубежье».',
      ),
    },
  },
  all_candidates_excluded: {
    id: 'all_candidates_excluded',
    request: allExcludedRequest,
    outcome: {
      kind: 'response',
      response: response(
        'no_matches',
        allExcludedRequest,
        [],
        { busy: 1, budget: 2 },
        'Один декоратор отмечен занятым на дату, цена «от» ещё двух выше указанного бюджета.',
      ),
    },
  },
  service_error: {
    id: 'service_error',
    request: threeRequest,
    outcome: { kind: 'error', message: 'Демонстрационная ошибка сервиса' },
  },
} satisfies ScenarioMap;
